import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, isDefaultBranch, parseConfig, ticketBranchPattern } from './config.mjs';

describe('parseConfig', () => {
  it('keeps a default for every key the file does not name', () => {
    expect(parseConfig('{"project":"ledger"}')).toEqual({ ...DEFAULT_CONFIG, project: 'ledger' });
  });
});

describe('ticketBranchPattern', () => {
  it('accepts only the branch types the configuration names', () => {
    const pattern = ticketBranchPattern({ ...DEFAULT_CONFIG, branchTypes: ['feat', 'spike'] });

    expect(pattern.exec('spike/9-try-kafka')?.[1]).toBe('9');
    expect(pattern.test('fix/9-typo')).toBe(false);
  });

  it('treats a branch type as text and not as a pattern', () => {
    const pattern = ticketBranchPattern({ ...DEFAULT_CONFIG, branchTypes: ['f.x'] });

    expect(pattern.test('fix/3-typo')).toBe(false);
    expect(pattern.test('f.x/3-typo')).toBe(true);
  });
});

describe('isDefaultBranch', () => {
  it('reads the default branch from the configuration', () => {
    const config = { ...DEFAULT_CONFIG, defaultBranch: 'trunk' };

    expect(isDefaultBranch('trunk', config)).toBe(true);
    expect(isDefaultBranch('main', config)).toBe(false);
  });
});
