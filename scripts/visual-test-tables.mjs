#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'src/visual/__tests__/table-visual.test.ts'],
  {
    cwd: root,
    env: {
      ...process.env,
      VISUAL_TABLES_WRITE: '1',
    },
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
