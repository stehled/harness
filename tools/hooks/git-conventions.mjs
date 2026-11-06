import { isDefaultBranch } from '../worktree/config.mjs';
import { worktreeNameForBranch } from '../worktree/ports.mjs';
import { findSequence, isWord, statementEnd, tokenize } from './shell-tokens.mjs';

const OPTIONS_WITH_VALUE = new Set(['-b', '-B', '--reason']);
const PLAIN_WORD = /^[A-Za-z0-9._/@+=:,][A-Za-z0-9._/@+=:,-]*$/;

function isPlainWord(value) {
  return PLAIN_WORD.test(value);
}

export function rewriteCommand(command, { cwd, config }) {
  let current = command;
  let changed = false;

  for (const rewrite of [rewriteWorktreeAdd, rewriteBranchCheckout, rewritePrCreate]) {
    const next = rewrite(current, { cwd, config });
    if (next !== null) {
      current = next;
      changed = true;
    }
  }

  return changed ? current : null;
}

export function gitConventionsHookOutput(input, config) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string') {
    return {};
  }

  const rewritten = rewriteCommand(command, { cwd: input?.cwd, config });
  if (rewritten === null) {
    return {};
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: isOnlyRewrittenStatements(command) ? 'allow' : 'ask',
      updatedInput: { ...input.tool_input, command: rewritten },
    },
  };
}

const BRANCH_FLAGS = ['-b', '-B', '-c', '-C', '--detach', '--track', '--no-track', '-q', '--quiet'];
const OWNED_STATEMENTS = [
  { words: ['git', 'worktree', 'add'], flags: BRANCH_FLAGS },
  { words: ['git', 'checkout'], flags: BRANCH_FLAGS },
  { words: ['git', 'switch'], flags: BRANCH_FLAGS },
  {
    words: ['gh', 'pr', 'create'],
    flags: [
      '--fill',
      '--draft',
      '-d',
      '--base',
      '-B',
      '--title',
      '-t',
      '--assignee',
      '-a',
      '-r',
      '--reviewer',
    ],
  },
];
const COMPANION_STATEMENTS = [
  ['cd'],
  ['pnpm', 'install'],
  ['pnpm', 'env:init'],
  ['git', 'fetch'],
  ['git', 'status'],
  ['git', 'log'],
  ['git', 'rev-parse'],
];
const COMPANION_ARGUMENT = /^-{0,2}[A-Za-z0-9._/@:,+][A-Za-z0-9._/@:,+-]*$/;
const SHELL_SYNTAX_BEYOND_SEPARATORS = /[\n\r`$<>()&\\]/;

export function isOnlyRewrittenStatements(command) {
  if (SHELL_SYNTAX_BEYOND_SEPARATORS.test(command.replaceAll('&&', ' '))) return false;

  const statements = [];
  let current = [];
  for (const token of tokenize(command)) {
    if (token.separator) {
      statements.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  statements.push(current);

  return statements.every((statement) => isOwned(statement) || isCompanion(statement));
}

function startsWithWords(statement, words) {
  return words.every((word, index) => isWord(statement[index], word));
}

function isOwned(statement) {
  const owned = OWNED_STATEMENTS.find(({ words }) => startsWithWords(statement, words));
  if (owned === undefined) return false;

  return statement.slice(owned.words.length).every((token) => {
    if (token.value.startsWith('-')) return owned.flags.includes(token.value);
    return COMPANION_ARGUMENT.test(token.value);
  });
}

function isCompanion(statement) {
  const words = COMPANION_STATEMENTS.find((candidate) => startsWithWords(statement, candidate));
  if (words === undefined) return false;
  const rest = statement.slice(words.length);
  return rest.every((token) => COMPANION_ARGUMENT.test(token.value));
}

export function isUnderWorktreeRoot(path, config) {
  const root = config.worktreeRoot.replace(/\/+$/, '');
  const normalized = path.replace(/\/+$/, '');

  return (
    normalized === root ||
    normalized.startsWith(`${root}/`) ||
    normalized.includes(`/${root}/`) ||
    normalized.endsWith(`/${root}`)
  );
}

function rewriteWorktreeAdd(command, { config }) {
  const tokens = tokenize(command);
  const addAt = findSequence(tokens, ['git', 'worktree', 'add']);
  if (addAt === -1) return null;

  let cursor = addAt + 3;
  let pathToken = null;

  while (cursor < tokens.length && !tokens[cursor].separator) {
    const token = tokens[cursor];
    if (token.value.startsWith('-')) {
      cursor += OPTIONS_WITH_VALUE.has(token.value) ? 2 : 1;
      continue;
    }
    pathToken = token;
    break;
  }

  if (pathToken === null || isUnderWorktreeRoot(pathToken.value, config)) return null;

  const base = pathToken.value.replace(/\/+$/, '').split('/').filter(Boolean).pop();
  if (base === undefined || base === '.' || base === '..' || !isPlainWord(base)) return null;

  const newPath = `${config.worktreeRoot}/${base}`;
  return command.slice(0, pathToken.start) + newPath + command.slice(pathToken.end);
}

function rewriteBranchCheckout(command, { cwd, config }) {
  if (typeof cwd === 'string' && isUnderWorktreeRoot(cwd, config)) return null;

  const tokens = tokenize(command);
  const created = findCreateBranch(tokens);
  const found = created ?? findSwitchExisting(tokens, config);
  if (found === null) return null;

  const branch = found.branchToken.value;
  if (!isPlainWord(branch)) return null;
  const name = worktreeNameForBranch(branch, config);
  const path = `${config.worktreeRoot}/${name}`;
  const end = statementEnd(tokens, found.statementStart);
  const tail = command.slice(found.branchToken.end, end);
  const worktreeAdd =
    created !== null
      ? `git worktree add ${path} -b ${branch}${tail}`
      : `git worktree add ${path} ${branch}${tail}`;
  const start = tokens[found.statementStart].start;

  return `${command.slice(0, start)}${worktreeAdd} && cd ${path}${command.slice(end)}`;
}

function rewritePrCreate(command) {
  const tokens = tokenize(command);
  const createAt = findSequence(tokens, ['gh', 'pr', 'create']);
  if (createAt === -1) return null;

  const end = statementEnd(tokens, createAt);
  const statement = tokens.filter(
    (token) => token.start >= tokens[createAt].start && token.end <= end,
  );
  if (statement.some((token) => token.value === '--draft' || token.value === '-d')) return null;

  return `${command.slice(0, end)} --draft${command.slice(end)}`;
}

function findCreateBranch(tokens) {
  for (let index = 0; index + 1 < tokens.length; index++) {
    if (!isWord(tokens[index], 'git')) continue;
    const subcommand = tokens[index + 1].value;
    const flags =
      subcommand === 'checkout' ? ['-b', '-B'] : subcommand === 'switch' ? ['-c', '-C'] : null;
    if (flags === null) continue;

    for (let cursor = index + 2; cursor < tokens.length && !tokens[cursor].separator; cursor++) {
      const next = tokens[cursor + 1];
      if (flags.includes(tokens[cursor].value) && next !== undefined && !next.separator) {
        return { statementStart: index, branchToken: next };
      }
    }
  }
  return null;
}

function findSwitchExisting(tokens, config) {
  for (let index = 0; index + 2 < tokens.length; index++) {
    if (!isWord(tokens[index], 'git') || !isWord(tokens[index + 1], 'switch')) continue;
    const argument = tokens[index + 2];
    if (argument.separator || argument.value.startsWith('-')) continue;
    if (isDefaultBranch(argument.value, config) || argument.value === '-') continue;
    return { statementStart: index, branchToken: argument };
  }
  return null;
}
