#!/usr/bin/env node
import { DEFAULT_CWD, EVAL_CONFIG, loadEvalCases } from '../../tools/hooks/eval-cases.mjs';
import { rewriteCommand } from '../../tools/hooks/git-conventions.mjs';

const results = loadEvalCases().map((testCase) => {
  const actual = rewriteCommand(testCase.command, {
    cwd: testCase.cwd ?? DEFAULT_CWD,
    config: EVAL_CONFIG,
  });
  return { ...testCase, actual, passed: actual === testCase.expected };
});

const categories = new Map();
for (const result of results) {
  const tally = categories.get(result.category) ?? { passed: 0, total: 0 };
  tally.total += 1;
  tally.passed += result.passed ? 1 : 0;
  categories.set(result.category, tally);
}

console.log('\nenforce-git-conventions: rewrites against the corpus\n');
for (const [category, { passed, total }] of categories) {
  console.log(`  ${category.padEnd(16)} ${String(passed).padStart(3)} / ${total}`);
}

const failed = results.filter((result) => !result.passed);
const passed = results.length - failed.length;
console.log(`  ${'all'.padEnd(16)} ${String(passed).padStart(3)} / ${results.length}\n`);

for (const result of failed) {
  console.log(`FAIL ${result.name}`);
  console.log(`  command:  ${JSON.stringify(result.command)}`);
  console.log(`  expected: ${JSON.stringify(result.expected)}`);
  console.log(`  actual:   ${JSON.stringify(result.actual)}\n`);
}

process.exitCode = failed.length === 0 ? 0 : 1;
