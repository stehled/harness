#!/usr/bin/env node
import {
  commitsAhead,
  currentBranch,
  readHookInput,
  run,
  writeHookOutput,
} from '../../tools/hooks/io.mjs';
import { publishPlan } from '../../tools/hooks/pull-request.mjs';
import { loadConfig } from '../../tools/worktree/config.mjs';

const input = await readHookInput();
const cwd = input?.cwd ?? process.env.CLAUDE_PROJECT_DIR;

writeHookOutput(typeof cwd === 'string' ? publish(cwd) : {});

function publish(cwd) {
  const root = run(['git', 'rev-parse', '--show-toplevel'], { cwd });
  if (!root.ok) return {};

  const config = loadConfig(root.output);
  const plan = publishPlan({
    branch: currentBranch(cwd),
    commitsAhead: commitsAhead(cwd, config.defaultBranch),
    config,
  });
  if (plan === null) return {};

  const push = run(plan.push, { cwd });
  if (!push.ok) {
    return { systemMessage: `The push of the branch failed: ${push.error}` };
  }

  const existing = run(plan.findExisting, { cwd });
  if (existing.ok && existing.output) {
    return { systemMessage: `Pushed the branch. The pull request exists: ${existing.output}` };
  }

  const created = run(plan.create, { cwd });
  return {
    systemMessage: created.ok
      ? `Pushed the branch and opened a draft pull request: ${created.output}`
      : `Pushed the branch. The draft pull request failed: ${created.error}`,
  };
}
