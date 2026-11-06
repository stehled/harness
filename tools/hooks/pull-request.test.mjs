import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../worktree/config.mjs';
import { publishPlan } from './pull-request.mjs';

describe('publishPlan', () => {
  it('pushes and opens a draft for a ticket branch with commits', () => {
    const plan = publishPlan({
      branch: 'feat/12-ledger',
      commitsAhead: 2,
      config: { ...DEFAULT_CONFIG, reviewer: 'stehled' },
    });

    expect(plan?.push).toEqual(['git', 'push', '-u', 'origin', 'HEAD', '--quiet']);
    expect(plan?.create).toEqual([
      'gh',
      'pr',
      'create',
      '--base',
      'main',
      '--draft',
      '--fill',
      '--assignee',
      '@me',
      '--reviewer',
      'stehled',
    ]);
  });

  it('asks for no reviewer when the configuration names none', () => {
    const plan = publishPlan({ branch: 'feat/12-ledger', commitsAhead: 1, config: DEFAULT_CONFIG });

    expect(plan?.create).not.toContain('--reviewer');
  });

  it('does nothing on the default branch, on a detached head or without commits', () => {
    expect(publishPlan({ branch: 'main', commitsAhead: 3, config: DEFAULT_CONFIG })).toBeNull();
    expect(publishPlan({ branch: 'HEAD', commitsAhead: 3, config: DEFAULT_CONFIG })).toBeNull();
    expect(publishPlan({ branch: null, commitsAhead: 3, config: DEFAULT_CONFIG })).toBeNull();
    expect(
      publishPlan({ branch: 'feat/12-ledger', commitsAhead: 0, config: DEFAULT_CONFIG }),
    ).toBeNull();
  });
});
