import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../worktree/config.mjs';

export const EVAL_CONFIG = Object.freeze({ ...DEFAULT_CONFIG, project: 'ledger' });

export const DEFAULT_CWD = '/Users/dev/repo';

export function loadEvalCases() {
  return JSON.parse(readFileSync(new URL('../../evals/hooks/cases.json', import.meta.url), 'utf8'));
}
