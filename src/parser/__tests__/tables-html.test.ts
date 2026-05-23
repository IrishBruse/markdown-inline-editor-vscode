import { readFileSync } from 'fs';
import { buildTableHtml, extractTableRowData, tableHtmlThemeForMode } from '../tables-html';
import { MarkdownParser } from '../../parser';
import { vi } from 'vitest';
import { config } from '../../config';

describe('tables-html', () => {
  it('buildTableHtml wraps cells with word-break styles', () => {
    const html = buildTableHtml([
      {
        isHeader: true,
        cells: [{ text: 'Header', align: null }],
      },
      {
        isHeader: false,
        cells: [{ text: 'Long content here', align: 'left' }],
      },
    ], tableHtmlThemeForMode(false));

    expect(html).toContain('word-wrap:break-word');
    expect(html).toContain('overflow-wrap:break-word');
    expect(html).toContain('Long content here');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
  });

  it('escapes HTML in cell text', () => {
    const html = buildTableHtml([
      {
        isHeader: false,
        cells: [{ text: '<script>', align: null }],
      },
    ]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('MarkdownParser - custom table mode', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses more than 50 tables in table-test-suite.md', () => {
    vi.spyOn(config.tables, 'renderingMode').mockReturnValue('custom');
    const text = readFileSync('docs/table-test-suite.md', 'utf8');
    const { tableBlocks } = parser.extractDecorationsWithScopes(text);
    expect(tableBlocks.length).toBeGreaterThan(50);
  });

  it('emits TableBlock without hide when renderingMode is custom', () => {
    vi.spyOn(config.tables, 'renderingMode').mockReturnValue('custom');
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = parser.extractDecorationsWithScopes(md);

    expect(result.tableBlocks).toHaveLength(1);
    expect(result.tableBlocks[0].rows.length).toBe(2);
    expect(result.tableBlocks[0].columnCount).toBe(2);
    expect(result.decorations.some((d) => d.type === 'hide')).toBe(false);
    const tableTypes = ['tablePipe', 'tableSeparatorPipe', 'tableSeparatorDash', 'tableCell'];
    expect(result.decorations.filter((d) => tableTypes.includes(d.type))).toHaveLength(0);
  });

  it('extractTableRowData reads header and body cells', () => {
    const md = '| Name | Age |\n|------|-----|\n| Jo | 5 |';
    const ast = parser['processor'].parse(md);
    const tableNode = (ast as { children: { type: string }[] }).children.find(
      (n) => n.type === 'table'
    );
    expect(tableNode).toBeDefined();
    const { rows, columnCount } = extractTableRowData(tableNode as never, md);
    expect(columnCount).toBe(2);
    expect(rows[0].isHeader).toBe(true);
    expect(rows[0].cells[0].text).toBe('Name');
    expect(rows[1].cells[1].text).toBe('5');
  });
});
