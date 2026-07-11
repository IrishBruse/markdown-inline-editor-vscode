import { MarkdownParser } from '../../parser';
import {
  formatGridLine,
  formatSeparatorGridLine,
  layoutWrappedGridRow,
  layoutWrappedGridTable,
  renderResponsiveRowSvg,
} from '../responsive-svg';
import { computeViewportColumnWidths } from '../responsive-layout';

describe('responsive-svg', () => {
  it('formats pipe grid lines with box drawing pipes', () => {
    const line = formatGridLine(['A', 'B'], [3, 3], [null, null]);
    expect(line).toContain('\u2502');
    expect(line).toContain('A');
    expect(line).toContain('B');
  });

  it('wraps long cell content across multiple grid lines', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const dataLines = layoutWrappedGridRow(tableBlocks[0], 2, 80);

    expect(dataLines.length).toBeGreaterThan(1);
    expect(dataLines[0]).toContain('Row 1');
    expect(dataLines[0]).toContain('\u2502');
    expect(dataLines.some((line) => line.includes('Lorem'))).toBe(true);
    expect(dataLines.slice(1).every((line) => line.startsWith('\u2502'))).toBe(true);
  });

  it('uses empty padded cells on continuation lines', async () => {
    const longText = 'one two three four five six seven eight nine ten';
    const md = [
      '| A | B |',
      '|---|---|',
      `| x | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const dataLines = layoutWrappedGridRow(tableBlocks[0], 2, 20);

    expect(dataLines.length).toBeGreaterThan(1);
    expect(dataLines[0]).toContain('x');
    expect(dataLines[1]).toMatch(/^\u2502[\s\u00A0]+\u2502/);
  });

  it('shows more wrap lines at wider viewport width', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const narrow = layoutWrappedGridRow(tableBlocks[0], 2, 60);
    const wide = layoutWrappedGridRow(tableBlocks[0], 2, 120);

    expect(wide.length).toBeLessThan(narrow.length);
  });

  it('renders separator row with dash cells', () => {
    const line = formatSeparatorGridLine([5, 10]);
    expect(line).toContain('\u2502');
    expect(line).toContain('-------');
  });

  it('renders multi-line svg at dynamic height', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const lines = layoutWrappedGridRow(tableBlocks[0], 2, 80);
    const svg = renderResponsiveRowSvg(lines, {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      contentWidthPx: 640,
      theme: {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    });

    expect(svg).toContain(`height="${20 * lines.length}"`);
    expect(svg).toContain('x');
    expect(svg).toContain('y');
  });

  it('caps column widths to the viewport budget', () => {
    const capped = computeViewportColumnWidths([14, 120], 80);
    expect(capped[0]).toBe(14);
    expect(computeViewportColumnWidths([14, 120], 80).reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(80);
  });

  it('lays out every source row in wrapped grid mode', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const rows = layoutWrappedGridTable(tableBlocks[0], 80);

    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toContain('A');
    expect(rows[2][0]).toContain('x');
  });
});
