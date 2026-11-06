import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../worktree/config.mjs';
import { editDecision, editHookOutput } from './main-checkout.mjs';

const ROOT = '/Users/dev/repo';
const BASE = {
  root: ROOT,
  filePath: `${ROOT}/src/ledger.ts`,
  branch: 'feat/12-ledger',
  linkedWorktree: false,
  config: DEFAULT_CONFIG,
};

describe('editDecision', () => {
  it('refuses an edit in the main checkout on a ticket branch', () => {
    const decision = editDecision(BASE);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain("on 'feat/12-ledger', not main");
    expect(decision.reason).toContain('git worktree add .claude/worktrees/<name> feat/12-ledger');
  });

  it('allows an edit in the main checkout on the default branch', () => {
    expect(editDecision({ ...BASE, branch: 'main' })).toEqual({ allow: true });
  });

  it('allows an edit in a linked worktree on any branch', () => {
    expect(editDecision({ ...BASE, linkedWorktree: true })).toEqual({ allow: true });
  });

  it('allows maintenance of the harness itself from the main checkout', () => {
    expect(editDecision({ ...BASE, filePath: `${ROOT}/.claude/settings.json` })).toEqual({
      allow: true,
    });
  });

  it('allows an edit outside the project', () => {
    expect(editDecision({ ...BASE, filePath: '/tmp/notes.md' })).toEqual({ allow: true });
    expect(editDecision({ ...BASE, filePath: `${ROOT}-other/src/a.ts` })).toEqual({ allow: true });
  });

  it('allows an edit when git cannot name the branch', () => {
    expect(editDecision({ ...BASE, branch: null })).toEqual({ allow: true });
    expect(editDecision({ ...BASE, branch: 'HEAD' })).toEqual({ allow: true });
  });
});

describe('editHookOutput', () => {
  it('sends a deny with the reason, or nothing', () => {
    expect(editHookOutput({ allow: true })).toEqual({});
    expect(editHookOutput({ allow: false, reason: 'why' })).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'why',
      },
    });
  });
});
