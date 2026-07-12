import { MarkdownParser } from '../../parser';
import {
  borderlessRowToOverlayText,
  borderlessTableToOverlayText,
  buildCoveredLines,
  capWrapLines,
  formatGridLine,
  formatSeparatorGridLine,
  getClipLineCount,
  layoutBorderlessRow,
  layoutBorderlessTable,
  layoutWrappedGridRow,
  layoutWrappedGridTable,
  renderBorderlessTableSvg,
  renderResponsiveRowSvg,
} from '../responsive-svg';
import { computeBorderlessColumnWidths, computeViewportColumnWidths } from '../responsive-layout';
import { measureTextWidth } from '../../parser/tables';

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
    const longText = 'one two three four five six seven eight nine ten eleven twelve';
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

  it('fits wrapped grid lines within a narrow viewport budget', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const lines = layoutWrappedGridRow(tableBlocks[0], 2, 100);

    expect(lines.length).toBeGreaterThan(1);
    expect(measureTextWidth(lines[0])).toBeLessThanOrEqual(100);
  });

  it('shows fewer wrap lines at wider viewport width', async () => {
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

  it('caps wrap lines to a maximum count', () => {
    const lines = ['a', 'b', 'c', 'd'];
    expect(capWrapLines(lines, 2)).toEqual(['a', 'b']);
    expect(capWrapLines(lines, 0)).toEqual([]);
  });

  it('caps wrap lines at table end source line budget', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| A | B |',
      '|---|---|',
      `| x | ${longText} |`,
      `| y | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const uncapped = layoutWrappedGridRow(tableBlocks[0], 2, 40);
    const capped = layoutWrappedGridRow(tableBlocks[0], 2, 40, 1);

    expect(uncapped.length).toBeGreaterThan(1);
    expect(capped).toHaveLength(1);
  });

  it('renders separator row with dash cells', () => {
    const line = formatSeparatorGridLine([5, 10]);
    expect(line).toContain('\u2502');
    expect(line).toContain('-------');
  });

  it('renders multi-line svg at dynamic height', async () => {
    const md = '| A | B |\n|---|---|\n| x | one two three four five six seven |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const layout = layoutBorderlessRow(tableBlocks[0], 2, 20);
    const svg = renderResponsiveRowSvg(layout, {
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

    const expectedHeight = Math.round(20 * 0.9) * 2 + layout.lineCount * 20 + 1;
    expect(svg).toContain(`height="${expectedHeight}"`);
    expect(svg).toContain('x');
    expect(svg).not.toContain('\u2502');
  });

  it('buildCoveredLines marks continuation source lines', () => {
    const covered = buildCoveredLines([10, 12], [3, 1]);
    expect(covered.has(11)).toBe(true);
    expect(covered.has(12)).toBe(true);
    expect(covered.has(13)).toBe(false);
  });

  it('getClipLineCount shortens wrap span before an active line', () => {
    const activeLines = new Set([12]);
    expect(getClipLineCount(10, 4, activeLines)).toBe(2);
    expect(getClipLineCount(10, 4, new Set())).toBe(4);
  });

  it('caps column widths to the viewport budget', () => {
    const capped = computeViewportColumnWidths([14, 120], 80);
    expect(capped[0]).toBe(14);
    expect(capped[1]).toBeLessThan(120);
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

  it('matches target.md wrapped row structure', async () => {
    const longText = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor',
      'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis',
      'nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu',
      'fugiat nulla pariatur.',
    ].join(' ');
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const dataLines = layoutWrappedGridRow(tableBlocks[0], 2, 100);

    expect(dataLines.length).toBeGreaterThanOrEqual(3);
    expect(dataLines[0]).toContain('Row 1');
    expect(dataLines[1]).toMatch(/^\u2502[\s\u00A0]+\u2502/);
    expect(dataLines.at(-1)).toMatch(/^\u2502[\s\u00A0]+\u2502/);
    expect(dataLines.at(-1)).toContain('fugiat nulla pariatur');
  });

  it('layoutBorderlessRow wraps columns without pipes', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const layout = layoutBorderlessRow(tableBlocks[0], 2, 80);

    expect(layout.lineCount).toBeGreaterThan(1);
    expect(layout.columns[0][0]).toContain('Row 1');
    expect(layout.columns[1].some((line) => line.includes('Lorem'))).toBe(true);
    expect(layout.showBottomDivider).toBe(true);
    expect(borderlessRowToOverlayText(layout)).not.toContain('\u2502');
  });

  it('layoutBorderlessRow keeps short columns at natural width', () => {
    const capped = computeBorderlessColumnWidths([14, 120], 80);
    expect(capped[0]).toBe(14);
    expect(capped[1]).toBeLessThan(120);
  });

  it('layoutBorderlessRow header has bottom divider, separator row does not', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const header = layoutBorderlessRow(tableBlocks[0], 0, 80);
    const separator = layoutBorderlessRow(tableBlocks[0], 1, 80);

    expect(header.isHeader).toBe(true);
    expect(header.showBottomDivider).toBe(true);
    expect(separator.isSeparatorOnly).toBe(true);
    expect(separator.showBottomDivider).toBe(false);
  });

  it('layoutBorderlessRow caps column wrap lines', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| A | B |',
      '|---|---|',
      `| x | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const uncapped = layoutBorderlessRow(tableBlocks[0], 2, 40);
    const capped = layoutBorderlessRow(tableBlocks[0], 2, 40, 1);

    expect(uncapped.lineCount).toBeGreaterThan(1);
    expect(capped.lineCount).toBe(1);
  });

  it('layoutBorderlessTable stacks header and data rows without separator row', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const layout = layoutBorderlessTable(tableBlocks[0], 80);

    expect(layout.rows).toHaveLength(2);
    expect(layout.rows[0].isHeader).toBe(true);
    expect(layout.rows[1].columns[0][0]).toBe('x');
    expect(borderlessTableToOverlayText(layout)).not.toContain('\u2502');
  });

  it('renderBorderlessTableSvg renders stacked rows with dividers', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const layout = layoutBorderlessTable(tableBlocks[0], 80);
    const svg = renderBorderlessTableSvg(layout, {
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

    expect(svg).toContain('Section Header');
    expect(svg).toContain('Row 1');
    expect(svg).toContain('<line');
    expect(svg).not.toContain('\u2502');
  });

  it('renderResponsiveRowSvg draws horizontal divider below rows', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const layout = layoutBorderlessRow(tableBlocks[0], 0, 80);
    const svg = renderResponsiveRowSvg(layout, {
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

    expect(svg).toContain('<line');
    expect(svg).toContain('stroke="#858585"');
  });
});
