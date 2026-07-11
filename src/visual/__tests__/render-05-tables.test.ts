import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser';
import {
  DEFAULT_TABLES_FIXTURE,
  defaultVisualOutputPaths,
  writeTablesVisualReport,
} from '../table-render-preview';

const TABLE_TEST_GLOBS = [
  'src/visual',
  'src/parser/__tests__/parser-table',
  'src/parser/__tests__/parser-table-visual-fixture.test.ts',
  'src/parser/__tests__/parser-table-basic-fixture.test.ts',
  'src/decorator/__tests__/05-tables-rendering.test.ts',
  'src/decorator/__tests__/table-syntax-integration.test.ts',
];

describe('render 05-tables visual preview', () => {
  it('writes reports and passes the visual baseline for docs/tests/05-tables.md', async () => {
    const fixturePath = resolve(DEFAULT_TABLES_FIXTURE);
    const markdown = readFileSync(fixturePath, 'utf8');
    const parser = await MarkdownParser.create();
    const decorations = parser.extractDecorations(markdown);
    const { htmlPath, textPath, jsonPath } = defaultVisualOutputPaths();

    const result = writeTablesVisualReport({
      markdown,
      decorations,
      sourcePath: DEFAULT_TABLES_FIXTURE,
      htmlPath,
      textPath,
      jsonPath,
    });

    expect(result.totalTables).toBeGreaterThan(0);
    expect(readFileSync(htmlPath, 'utf8')).toContain('05-tables visual preview');
    expect(readFileSync(textPath, 'utf8')).toContain('RENDERED:');
    expect(readFileSync(jsonPath, 'utf8')).toContain('"passed"');
    expect(result.newMisalignments, JSON.stringify(result.newMisalignments, null, 2)).toEqual([]);

    console.log(
      `visual:tables wrote ${htmlPath} (${result.totalTables} tables, ${result.misaligned} misaligned, ${result.newMisalignments.length} new)`,
    );
  });
});
