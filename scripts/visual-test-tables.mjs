#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const TABLE_TEST_TARGETS = [
  'src/visual/__tests__/table-render-preview.test.ts',
  'src/parser/__tests__/parser-table.test.ts',
  'src/parser/__tests__/parser-table-visual-fixture.test.ts',
  'src/parser/__tests__/parser-table-basic-fixture.test.ts',
  'src/parser/__tests__/parser-table-scope.test.ts',
  'src/parser/__tests__/tables-width.test.ts',
  'src/decorator/__tests__/05-tables-rendering.test.ts',
  'src/decorator/__tests__/table-syntax-integration.test.ts',
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['vitest', 'run', 'src/visual/__tests__/render-05-tables.test.ts']);
run('npx', ['vitest', 'run', ...TABLE_TEST_TARGETS]);

const reportPath = resolve(root, 'dist/visual/report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

if (!report.passed) {
  console.error('visual-test-tables: new misalignments detected:');
  for (const item of report.newMisalignments) {
    console.error(`  - ${item.label}`);
  }
  process.exit(1);
}

console.log(
  `visual-test-tables: passed (${report.totalTables} tables, ${report.misaligned} known misaligned, 0 new)`,
);
