import { describe, expect, it } from 'vitest';
import { renderTableSvgHost, wrapTextToColumnWidth } from '../table-svg-host';

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
      { theme: 'dark', contentWidth: 400, fontSize: 14, lineHeight: 21, numLines: 3 }
    );
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('Alice');
    expect(svg).not.toContain('foreignObject');
  });

  it('svg height covers at least numLines of editor line height', () => {
    const svg = renderTableSvgHost(
      [{ isHeader: false, cells: [{ text: 'x', align: null }] }],
      { theme: 'dark', contentWidth: 200, fontSize: 14, lineHeight: 21, numLines: 5 }
    );
    const height = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 0);
    expect(height).toBeGreaterThanOrEqual(5 * 21);
  });

  it('escapes XML in cell content', () => {
    const svg = renderTableSvgHost(
      [{ isHeader: false, cells: [{ text: '<tag>', align: null }] }],
      { theme: 'light', contentWidth: 300, fontSize: 14, lineHeight: 21, numLines: 1 }
    );
    expect(svg).toContain('&lt;tag&gt;');
  });
});
