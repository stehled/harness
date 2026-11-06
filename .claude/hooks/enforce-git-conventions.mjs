#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { gitConventionsHookOutput } from '../../tools/hooks/git-conventions.mjs';
import { readHookInput, writeHookOutput } from '../../tools/hooks/io.mjs';
import { loadConfig } from '../../tools/worktree/config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

writeHookOutput(gitConventionsHookOutput(await readHookInput(), loadConfig(root)));
