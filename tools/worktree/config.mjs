import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILE = 'harness.config.json';

export const DEFAULT_CONFIG = Object.freeze({
  project: 'agent-harness',
  defaultBranch: 'main',
  reviewer: null,
  branchTypes: Object.freeze(['feat', 'fix', 'chore', 'docs']),
  worktreeRoot: '.claude/worktrees',
});

export function parseConfig(contents) {
  return { ...DEFAULT_CONFIG, ...JSON.parse(contents) };
}

export function loadConfig(root) {
  try {
    return parseConfig(readFileSync(join(root, CONFIG_FILE), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

export function ticketBranchPattern(config) {
  return new RegExp(`^(?:${config.branchTypes.map(escapeRegExp).join('|')})/(\\d+)-`);
}

export function isDefaultBranch(branch, config) {
  return branch === config.defaultBranch;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
