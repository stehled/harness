#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { addMissingVariables, parseEnvFile, renderEnvFile } from './env-file.mjs';
import { environmentForSlot, portsForSlot, resolveSlot } from './ports.mjs';

function main(argv) {
  const force = argv.includes('--force');
  const slotFlag = argv.indexOf('--slot');
  const root = repositoryRoot();
  const config = loadConfig(root);
  const examplePath = resolve(root, '.env.example');
  const envPath = resolve(root, '.env');

  const branch = currentBranch(root);
  const slot =
    slotFlag === -1
      ? resolveSlot({ branch, path: root, config })
      : Number(argv[slotFlag + 1] ?? Number.NaN);

  if (!Number.isInteger(slot) || slot < 0) {
    fail('--slot takes a non-negative whole number.');
  }

  const example = readFileSync(examplePath, 'utf8');

  if (existsSync(envPath) && !force) {
    const { contents, added } = addMissingVariables(readFileSync(envPath, 'utf8'), example);

    console.log(
      describe(`${branch} — as the existing .env has it`, parseEnvFile(contents), config),
    );

    if (added.length === 0) {
      console.log('.env already exists, so it was left alone. Regenerate it with --force.\n');
      return;
    }

    writeFileSync(envPath, contents);
    console.log(`.env already exists. Added from .env.example: ${added.join(', ')}.`);
    console.log('Every other line was left alone. Regenerate it with --force.\n');
    return;
  }

  const defaults = parseEnvFile(example);
  const values = environmentForSlot(slot, {
    postgresUser: defaults.POSTGRES_USER ?? 'harness',
    postgresPassword: defaults.POSTGRES_PASSWORD ?? 'harness',
    postgresDb: defaults.POSTGRES_DB ?? 'harness',
    config,
  });

  writeFileSync(envPath, renderEnvFile(example, values));

  console.log(describe(`slot ${slot} — ${branch}`, values, config));
  console.log('Wrote .env. Next: pnpm infra:up.\n');
}

function describe(heading, values, config) {
  const ports = portsForSlot(0);
  const rows = [
    ['web', `http://localhost:${values.WEB_PORT ?? ports.web}`],
    ['api', `http://localhost:${values.API_PORT ?? ports.api}`],
    ['postgres', `localhost:${values.POSTGRES_PORT ?? ports.postgres}`],
    ['redis', `localhost:${values.REDIS_PORT ?? ports.redis}`],
    ['compose', values.COMPOSE_PROJECT_NAME ?? config.project],
  ];

  return [
    '',
    heading,
    '',
    ...rows.map(([label, value]) => `  ${label.padEnd(9)} ${value}`),
    '',
  ].join('\n');
}

function repositoryRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function currentBranch(root) {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main(process.argv.slice(2));
