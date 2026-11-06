import { describe, expect, it } from 'vitest';
import { expandBraces, parseCard, pathMatches, scoreTicket, summarize } from './write-set.mjs';

const CARD = `#30 Request a payout
type: feature            size: L (est. 14 files)
writes:
  certain  new   apps/api/src/payouts/{payouts.controller,payouts.service}.ts
  certain  reg   packages/contracts/src/index.ts
  certain  sch   packages/db/src/schema.ts (payouts table, payout_status enum)
  likely   new   apps/web/src/app/[locale]/(app)/accounts/[id]/payouts/, apps/web/src/lib/payouts.ts
  possible cfg   .env.example
reads: balance projection (#29)
test file: payouts.integration.test.ts (new)`;

describe('parseCard', () => {
  it('reads every write with its confidence and kind', () => {
    expect(parseCard(CARD)).toEqual([
      {
        confidence: 'certain',
        kind: 'new',
        path: 'apps/api/src/payouts/{payouts.controller,payouts.service}.ts',
      },
      { confidence: 'certain', kind: 'reg', path: 'packages/contracts/src/index.ts' },
      { confidence: 'certain', kind: 'sch', path: 'packages/db/src/schema.ts' },
      {
        confidence: 'likely',
        kind: 'new',
        path: 'apps/web/src/app/[locale]/(app)/accounts/[id]/payouts/',
      },
      { confidence: 'likely', kind: 'new', path: 'apps/web/src/lib/payouts.ts' },
      { confidence: 'possible', kind: 'cfg', path: '.env.example' },
    ]);
  });

  it('reads a real card with notes over several lines and a sibling test file', () => {
    const card = [
      'writes:',
      '  certain  new   apps/api/src/limits/calculator.ts (+ .test.ts) (pure, Seam 2):',
      '                 day boundary in a named time zone,',
      '                 daylight-saving days, rounding at the cent',
      '  likely   edit  apps/api/src/accounts/accounts.service.ts (the balance reader',
      '                 calls the calculator)',
      '',
      'reads: accounts.service.ts',
    ].join('\n');

    expect(parseCard(card)).toEqual([
      { confidence: 'certain', kind: 'new', path: 'apps/api/src/limits/calculator.ts' },
      { confidence: 'certain', kind: 'new', path: 'apps/api/src/limits/calculator.test.ts' },
      { confidence: 'likely', kind: 'edit', path: 'apps/api/src/accounts/accounts.service.ts' },
    ]);
  });

  it('reads nothing from a text without a writes block', () => {
    expect(parseCard('reads: everything\ncertain new a.ts')).toEqual([]);
  });
});

describe('expandBraces', () => {
  it('expands each brace group, also more than one', () => {
    expect(expandBraces('a/{b,c}.ts')).toEqual(['a/b.ts', 'a/c.ts']);
    expect(expandBraces('{x,y}/{1,2}')).toEqual(['x/1', 'x/2', 'y/1', 'y/2']);
    expect(expandBraces('plain.ts')).toEqual(['plain.ts']);
  });
});

describe('pathMatches', () => {
  it('reads a trailing slash as a directory', () => {
    expect(pathMatches('apps/web/src/app/[locale]/', 'apps/web/src/app/[locale]/page.tsx')).toBe(
      true,
    );
    expect(pathMatches('apps/web/', 'apps/webhooks/a.ts')).toBe(false);
  });

  it('reads a path without an extension as a directory or as that one file', () => {
    expect(pathMatches('apps/web', 'apps/web/src/page.tsx')).toBe(true);
    expect(pathMatches('apps/web', 'apps/webhooks/a.ts')).toBe(false);
    expect(pathMatches('apps/api/Dockerfile', 'apps/api/Dockerfile')).toBe(true);
  });

  it('reads one star inside a segment and two stars across segments', () => {
    expect(pathMatches('packages/db/drizzle/*', 'packages/db/drizzle/0001_a.sql')).toBe(true);
    expect(pathMatches('packages/db/drizzle/*', 'packages/db/drizzle/meta/_journal.json')).toBe(
      false,
    );
    expect(pathMatches('packages/db/drizzle/**', 'packages/db/drizzle/meta/_journal.json')).toBe(
      true,
    );
  });

  it('treats the brackets and parentheses of a route as text', () => {
    expect(pathMatches('app/(app)/[id]/*', 'app/(app)/[id]/page.tsx')).toBe(true);
    expect(pathMatches('app/(app)/[id]/*', 'app/app/i/page.tsx')).toBe(false);
  });
});

describe('scoreTicket', () => {
  const predicted = parseCard(CARD);
  const actual = [
    'apps/api/src/payouts/payouts.controller.ts',
    'packages/contracts/src/index.ts',
    'apps/web/src/app/[locale]/(app)/accounts/[id]/payouts/page.tsx',
    'apps/api/src/app.module.ts',
  ];

  it('counts a hit for each write that matches a changed file', () => {
    expect(scoreTicket({ predicted, actual }).byConfidence).toEqual({
      certain: { predicted: 3, hit: 2 },
      likely: { predicted: 2, hit: 1 },
      possible: { predicted: 1, hit: 0 },
    });
  });

  it('counts the changed files that each confidence level and those above it cover', () => {
    const score = scoreTicket({ predicted, actual });

    expect(score.coverage).toEqual({ certain: 2, likely: 3, possible: 3 });
    expect(score.missed).toEqual(['apps/api/src/app.module.ts']);
  });
});

describe('summarize', () => {
  it('adds the tickets together before it divides', () => {
    const first = scoreTicket({
      predicted: [{ confidence: 'certain', kind: 'new', path: 'a.ts' }],
      actual: ['a.ts', 'b.ts'],
    });
    const second = scoreTicket({
      predicted: [{ confidence: 'certain', kind: 'new', path: 'c.ts' }],
      actual: ['d.ts'],
    });

    expect(summarize([first, second])).toEqual({
      tickets: 2,
      actual: 3,
      precision: { certain: 0.5, likely: null, possible: null },
      recallUpTo: { certain: 1 / 3, likely: 1 / 3, possible: 1 / 3 },
    });
  });
});
