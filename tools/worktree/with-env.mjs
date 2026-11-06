#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [command, ...args] = process.argv.slice(2);

if (command === undefined) {
  console.error('Usage: node tools/worktree/with-env.mjs <command> [args...]');
  process.exit(1);
}

try {
  process.loadEnvFile(resolve(process.cwd(), '.env'));
} catch {}

const child = spawn(command, args, { stdio: 'inherit' });

child.on('error', (error) => {
  console.error(`Could not run ${command}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
