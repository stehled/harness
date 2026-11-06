import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config.mjs';
import {
  environmentForSlot,
  portsForSlot,
  projectNameForSlot,
  resolveSlot,
  slotFromBranch,
  slotFromPath,
  worktreeNameForBranch,
} from './ports.mjs';

const CONFIG = { ...DEFAULT_CONFIG, project: 'ledger' };
const POSTGRES = {
  postgresUser: 'harness',
  postgresPassword: 'harness',
  postgresDb: 'harness',
  config: CONFIG,
};

describe('slotFromBranch', () => {
  it('takes the issue number of a ticket branch', () => {
    expect(slotFromBranch('feat/12-seam-one-harness', CONFIG)).toBe(12);
    expect(slotFromBranch('fix/7-expired-session', CONFIG)).toBe(7);
    expect(slotFromBranch('chore/62-worktree-port-isolation', CONFIG)).toBe(62);
    expect(slotFromBranch('docs/104-glossary', CONFIG)).toBe(104);
  });

  it('gives no slot to a branch without an issue number', () => {
    expect(slotFromBranch('main', CONFIG)).toBeUndefined();
    expect(slotFromBranch('feat/no-number', CONFIG)).toBeUndefined();
    expect(slotFromBranch('HEAD', CONFIG)).toBeUndefined();
  });
});

describe('slotFromPath', () => {
  it('is stable, so a worktree keeps its ports across runs', () => {
    expect(slotFromPath('/Users/dev/.claude/worktrees/spike')).toBe(
      slotFromPath('/Users/dev/.claude/worktrees/spike'),
    );
  });

  it('separates worktrees', () => {
    expect(slotFromPath('/Users/dev/worktrees/a')).not.toBe(slotFromPath('/Users/dev/worktrees/b'));
  });

  it('never takes the slot of the main checkout', () => {
    for (const path of ['/a', '/b', '/c', '/some/deep/worktree/path', '']) {
      expect(slotFromPath(path)).toBeGreaterThan(0);
    }
  });
});

describe('resolveSlot', () => {
  it('gives the default branch slot zero', () => {
    expect(resolveSlot({ branch: 'main', path: '/repo', config: CONFIG })).toBe(0);
  });

  it('prefers the issue number of the branch to the path', () => {
    expect(resolveSlot({ branch: 'feat/12-thing', path: '/repo-12', config: CONFIG })).toBe(12);
  });

  it('uses the path when the branch has no issue number', () => {
    expect(resolveSlot({ branch: 'spike', path: '/repo-spike', config: CONFIG })).toBe(
      slotFromPath('/repo-spike'),
    );
  });
});

describe('portsForSlot', () => {
  it('keeps the main checkout on the conventional ports', () => {
    expect(portsForSlot(0)).toEqual({ web: 3000, api: 3001, postgres: 5432, redis: 6379 });
  });

  it('gives a slot consecutive ports of its own', () => {
    expect(portsForSlot(1)).toEqual({ web: 20010, api: 20011, postgres: 20012, redis: 20013 });
    expect(portsForSlot(62)).toEqual({ web: 20620, api: 20621, postgres: 20622, redis: 20623 });
  });

  it('never overlaps two slots, and never reaches the ephemeral range', () => {
    const claimed = new Set();

    for (let slot = 1; slot <= 899; slot += 1) {
      for (const port of Object.values(portsForSlot(slot))) {
        expect(port).toBeGreaterThan(20000);
        expect(port).toBeLessThan(32768);
        expect(claimed.has(port)).toBe(false);
        claimed.add(port);
      }
    }
  });

  it('wraps an issue number past the last block', () => {
    expect(portsForSlot(900)).toEqual(portsForSlot(1));
  });
});

describe('projectNameForSlot', () => {
  it('names the Compose project after the slot, so two slots share no volume', () => {
    expect(projectNameForSlot(0, CONFIG)).toBe('ledger');
    expect(projectNameForSlot(62, CONFIG)).toBe('ledger-62');
  });
});

describe('worktreeNameForBranch', () => {
  it('gives a ticket branch the name of its slot', () => {
    expect(worktreeNameForBranch('feat/62-ports', CONFIG)).toBe('ledger-62');
  });

  it('makes a safe directory name from any other branch', () => {
    expect(worktreeNameForBranch('spike/try kafka!', CONFIG)).toBe('spike-try-kafka');
    expect(worktreeNameForBranch('///', CONFIG)).toBe('branch');
  });
});

describe('environmentForSlot', () => {
  it('derives every URL from the ports that it publishes', () => {
    expect(environmentForSlot(62, POSTGRES)).toEqual({
      COMPOSE_PROJECT_NAME: 'ledger-62',
      WEB_PORT: '20620',
      API_PORT: '20621',
      POSTGRES_PORT: '20622',
      REDIS_PORT: '20623',
      DATABASE_URL: 'postgres://harness:harness@localhost:20622/harness',
      REDIS_URL: 'redis://localhost:20623',
      API_URL: 'http://localhost:20621',
      WEB_ORIGIN: 'http://localhost:20620',
    });
  });

  it('reproduces the committed defaults for the main checkout', () => {
    expect(environmentForSlot(0, POSTGRES)).toMatchObject({
      COMPOSE_PROJECT_NAME: 'ledger',
      DATABASE_URL: 'postgres://harness:harness@localhost:5432/harness',
      API_URL: 'http://localhost:3001',
    });
  });
});
