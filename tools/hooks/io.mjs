import { execFileSync } from 'node:child_process';

export async function readHookInput(stream = process.stdin) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');

  return text.trim() === '' ? {} : JSON.parse(text);
}

export function writeHookOutput(output) {
  process.stdout.write(JSON.stringify(output));
}

export function run(args, options = {}) {
  try {
    const output = execFileSync(args[0], args.slice(1), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    return { ok: true, output: output.trim() };
  } catch (error) {
    return { ok: false, error: error?.stderr?.toString?.() || String(error) };
  }
}

export function git(root, args) {
  const result = run(['git', '-C', root, ...args]);
  return result.ok ? result.output : null;
}

export function currentBranch(root) {
  return git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export function isLinkedWorktree(root) {
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);
  const commonDir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);

  return gitDir !== null && commonDir !== null && gitDir !== commonDir;
}

export function commitsAhead(root, defaultBranch) {
  for (const base of [`origin/${defaultBranch}`, defaultBranch]) {
    const mergeBase = git(root, ['merge-base', base, 'HEAD']);
    if (mergeBase === null) continue;
    const count = git(root, ['rev-list', '--count', `${mergeBase}..HEAD`]);
    if (count !== null) return Number(count);
  }
  return 0;
}
