#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CONFIDENCES, parseCard, scoreTicket, summarize } from '../../tools/evals/write-set.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const samples = option('--from') ? fromFile(option('--from')) : fromGitHub(option('--issues'));
const scores = samples.map((sample) => ({ ...sample, score: scoreTicket(sample) }));
const summary = summarize(scores.map((sample) => sample.score));

if (args.includes('--json')) {
  console.log(JSON.stringify({ summary, tickets: scores }, null, 2));
} else {
  report(summary, scores);
}

function fromFile(path) {
  return JSON.parse(readFileSync(path, 'utf8')).map((sample) => ({
    ticket: sample.ticket,
    predicted: sample.predicted ?? parseCard(sample.card),
    actual: sample.actual,
  }));
}

function fromGitHub(list) {
  if (list === undefined) {
    console.error('Usage: run.mjs --issues 30,31,32 | --from samples.json [--json]');
    process.exit(2);
  }

  return list.split(',').flatMap((number) => {
    const issue = gh([
      'issue',
      'view',
      number,
      '--json',
      'comments,closedByPullRequestsReferences',
    ]);
    const card = [...issue.comments].reverse().find((comment) => /^\s*writes:/m.test(comment.body));
    const pull = issue.closedByPullRequestsReferences.at(-1);

    if (card === undefined || pull === undefined) {
      console.error(
        `#${number}: skipped, ${card === undefined ? 'no card' : 'no merged pull request'}`,
      );
      return [];
    }

    const files = execFileSync('gh', ['pr', 'diff', String(pull.number), '--name-only'], {
      encoding: 'utf8',
    });
    return [
      {
        ticket: Number(number),
        predicted: parseCard(card.body),
        actual: files.split('\n').filter(Boolean),
      },
    ];
  });
}

function gh(argv) {
  return JSON.parse(execFileSync('gh', argv, { encoding: 'utf8' }));
}

function report(summary, scores) {
  const percent = (value) => (value === null ? '   –' : `${Math.round(value * 100)}%`.padStart(4));

  console.log(`\nplan-waves: predicted write sets against merged diffs`);
  console.log(`${summary.tickets} tickets, ${summary.actual} changed files\n`);
  console.log('  confidence   precision   recall (this level and above)');
  for (const confidence of CONFIDENCES) {
    console.log(
      `  ${confidence.padEnd(12)} ${percent(summary.precision[confidence]).padStart(9)}   ${percent(summary.recallUpTo[confidence]).padStart(6)}`,
    );
  }

  for (const sample of scores) {
    if (sample.score.missed.length === 0) continue;
    console.log(`\n#${sample.ticket} changed files that no card line predicted:`);
    for (const file of sample.score.missed) console.log(`  ${file}`);
  }
  console.log('');
}
