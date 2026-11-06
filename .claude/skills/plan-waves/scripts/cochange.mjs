#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = { ref: 'main', minFiles: 10, top: 25, for: [], json: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--ref') opt.ref = args[++i];
  else if (a === '--min-files') opt.minFiles = Number(args[++i]);
  else if (a === '--top') opt.top = Number(args[++i]);
  else if (a === '--for') opt.for.push(args[++i]);
  else if (a === '--json') opt.json = true;
  else {
    console.error(`unknown argument: ${a}`);
    process.exit(2);
  }
}

const log = spawnSync('git', ['log', '--format=@@%h %s', '--name-only', opt.ref], {
  encoding: 'utf8',
});
if (log.status !== 0) {
  console.error(log.stderr);
  process.exit(log.status ?? 1);
}

/** @type {{ hash: string, subject: string, files: Set<string> }[]} */
const commits = [];
let current = null;
for (const raw of log.stdout.split('\n')) {
  const line = raw.trim();
  if (line.startsWith('@@')) {
    const [hash, ...subject] = line.slice(2).split(' ');
    current = { hash, subject: subject.join(' '), files: new Set() };
    commits.push(current);
  } else if (line && current) {
    current.files.add(line);
  }
}

const feature = commits.filter((c) => c.files.size >= opt.minFiles);

const touches = new Map();
for (const c of feature) {
  for (const f of c.files) touches.set(f, (touches.get(f) ?? 0) + 1);
}
const hotspots = [...touches.entries()]
  .map(([file, count]) => ({ file, count, share: count / feature.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, opt.top);

const cochange = opt.for.map((prefix) => {
  const hits = commits.filter((c) => [...c.files].some((f) => f.startsWith(prefix)));
  const counts = new Map();
  for (const c of hits) {
    for (const f of c.files) {
      if (!f.startsWith(prefix)) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  }
  const files = [...counts.entries()]
    .map(([file, count]) => ({ file, count, probability: count / hits.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, opt.top);
  return { prefix, commits: hits.length, files };
});

if (opt.json) {
  console.log(
    JSON.stringify(
      { commits: commits.length, featureCommits: feature.length, hotspots, cochange },
      null,
      2,
    ),
  );
  process.exit(0);
}

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
console.log(
  `${commits.length} commits on ${opt.ref}, ${feature.length} feature-sized (>= ${opt.minFiles} files)\n`,
);
console.log(`Hotspots: share of feature-sized commits touching the file`);
for (const h of hotspots)
  console.log(`  ${pct(h.share)}  ${String(h.count).padStart(3)}  ${h.file}`);
for (const c of cochange) {
  console.log(`\nCo-change with ${c.prefix} (${c.commits} commits): P(file | prefix touched)`);
  for (const f of c.files)
    console.log(`  ${pct(f.probability)}  ${String(f.count).padStart(3)}  ${f.file}`);
}
