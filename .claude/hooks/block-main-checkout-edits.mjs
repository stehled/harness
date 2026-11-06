#!/usr/bin/env node
import {
  currentBranch,
  isLinkedWorktree,
  readHookInput,
  writeHookOutput,
} from '../../tools/hooks/io.mjs';
import { editDecision, editHookOutput } from '../../tools/hooks/main-checkout.mjs';
import { loadConfig } from '../../tools/worktree/config.mjs';

const input = await readHookInput();
const root = process.env.CLAUDE_PROJECT_DIR;
const filePath = input?.tool_input?.file_path;

if (typeof root !== 'string' || typeof filePath !== 'string') {
  writeHookOutput({});
} else {
  const decision = editDecision({
    filePath,
    root,
    branch: currentBranch(root),
    linkedWorktree: isLinkedWorktree(root),
    config: loadConfig(root),
  });
  writeHookOutput(editHookOutput(decision));
}
