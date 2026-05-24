import { describe, expect, it } from 'vitest';
import { getTableThemeFallback } from '../../parser/tables-html';
import {
  computeColumnDisplayWidths,
  getSeparatorBorderY,
  getSourceLineIndex,
  renderTableSvgHost,
  wrapTextToColumnWidth,
} from '../table-svg-host';

const darkTheme = getTableThemeFallback(true);

describe('table-svg-host', () => {
  it('wraps long text into multiple lines', () => {
    const lines = wrapTextToColumnWidth(
      'Lorem ipsum dolor sit amet consectetur adipiscing elit',
      12
    );
    expect(lines.length).toBeGreaterThan(1);
  });

  it('renders native SVG with table cells', () => {
    const svg = renderTableSvgHost(
      [
        { isHeader: true, cells: [{ text: 'Name', align: null }] },
        { isHeader: false, cells: [{ text: 'Alice', align: null }] },
      ],
      { fontSize: 14, lineHeight: 21, numLines: 3 },
      darkTheme,
    );
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('Alice');
    expect(svg).not.toContain('foreignObject');
  });

  it('maps row indices to source lines with a gap for the separator', () => {
    expect(getSourceLineIndex(0)).toBe(0);
    expect(getSourceLineIndex(1)).toBe(2);
    expect(getSourceLineIndex(2)).toBe(3);
  });

  it('places header and body rects meeting at the separator line midpoint', () => {
    const lineHeight = 21;
    const borderY = getSeparatorBorderY(lineHeight);
    const svg = renderTableSvgHost(
      [
        { isHeader: true, cells: [{ text: 'Name', align: null }] },
        { isHeader: false, cells: [{ text: 'Jo', align: null }] },
      ],
      { fontSize: 14, lineHeight, numLines: 3 },
      darkTheme,
    );
    expect(svg).toContain(`<rect x="0" y="0"`);
    expect(svg).toContain(`height="${borderY}"`);
    expect(svg).toContain(`<rect x="0" y="${borderY}"`);
    expect(svg).toContain('height="63"');
  });

  it('sizes columns from cell content instead of a fixed editor width', () => {
    const rows = [
      { isHeader: true, cells: [{ text: 'A', align: null }, { text: 'B', align: null }] },
      { isHeader: false, cells: [{ text: '1', align: null }, { text: '2', align: null }] },
    ];
    const svg = renderTableSvgHost(
      rows,
      { fontSize: 14, lineHeight: 21, numLines: 3 },
      darkTheme,
    );
    const width = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 0);
    expect(width).toBeLessThan(140);
    expect(computeColumnDisplayWidths(rows)).toEqual([1, 1]);
  });

  it('svg height covers at least numLines of editor line height', () => {
    const svg = renderTableSvgHost(
      [{ isHeader: false, cells: [{ text: 'x', align: null }] }],
      { fontSize: 14, lineHeight: 21, numLines: 5 },
      darkTheme,
    );
    const height = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 0);
    expect(height).toBeGreaterThanOrEqual(5 * 21);
  });

  it('offsets left-aligned text by source leading spaces', () => {
    const fontSize = 14;
    const lineHeight = 21;
    const charWidth = fontSize * 0.6;
    const leadingSpaces = 2;
    const svg = renderTableSvgHost(
      [{
        isHeader: false,
        cells: [{ text: 'x', align: null, leadingSpaces, trailingSpaces: 0 }],
      }],
      { fontSize, lineHeight, numLines: 1 },
      darkTheme,
    );
    const textX = 4 + leadingSpaces * charWidth;
    expect(svg).toContain(`x="${textX}"`);
  });

  it('escapes XML in cell content', () => {
    const svg = renderTableSvgHost(
      [{ isHeader: false, cells: [{ text: '<tag>', align: null }] }],
      { fontSize: 14, lineHeight: 21, numLines: 1 },
      getTableThemeFallback(false),
    );
    expect(svg).toContain('&lt;tag&gt;');
  });
});
