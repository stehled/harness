import { describe, expect, it } from 'vitest';
import { findSequence, statementEnd, tokenize } from './shell-tokens.mjs';

describe('tokenize', () => {
  it('keeps the offsets of each token in the original command', () => {
    const command = 'git  worktree add "../a b"';
    const tokens = tokenize(command);

    expect(tokens.map((token) => token.value)).toEqual(['git', 'worktree', 'add', '../a b']);
    expect(command.slice(tokens[3].start, tokens[3].end)).toBe('"../a b"');
  });

  it('splits a separator from the words around it', () => {
    expect(tokenize('a&&b;c||d|e').map((token) => token.value)).toEqual([
      'a',
      '&&',
      'b',
      ';',
      'c',
      '||',
      'd',
      '|',
      'e',
    ]);
  });

  it('keeps a separator inside quotes as text', () => {
    expect(tokenize("echo 'a && b'").map((token) => token.value)).toEqual(['echo', 'a && b']);
  });
});

describe('findSequence', () => {
  it('finds words in order and ignores a separator with the same text', () => {
    const tokens = tokenize('echo x && git worktree add y');

    expect(findSequence(tokens, ['git', 'worktree', 'add'])).toBe(3);
    expect(findSequence(tokens, ['git', 'push'])).toBe(-1);
  });
});

describe('statementEnd', () => {
  it('stops at the first separator after the start', () => {
    const command = 'gh pr create --fill && echo done';
    const tokens = tokenize(command);

    expect(command.slice(0, statementEnd(tokens, 0))).toBe('gh pr create --fill');
  });
});
