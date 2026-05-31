import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import {
  buildTableLayout,
  maxWrapLinesForBandHeight,
  renderTableSvg,
  renderTableSvgLineSlice,
  sliceHeightForSubLine,
  sourceLineToSliceSpec,
  wrapText,
} from '../table-renderer';

function basicBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 40,
    numLines: 4,
    header: ['Name', 'Role'],
    rows: [
      ['Ada', 'Lead'],
      ['Bob', 'Dev'],
    ],
    align: [null, null],
  };
}

const metrics = { lineHeight: 18, fontSize: 13 };

describe('wrapText', () => {
  it('returns a single line when text fits', () => {
    expect(wrapText('hello world', 20)).toEqual(['hello world']);
  });

  it('wraps at word boundaries', () => {
    const lines = wrapText('one two three four', 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four');
  });

  it('breaks words longer than the max width', () => {
    const lines = wrapText('abcdefghij', 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('abcdefghij');
  });
});

describe('sourceLineToSliceSpec', () => {
  it('maps header and data source lines', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    expect(sourceLineToSliceSpec(0, layout)).toEqual({
      rowLayoutIndex: 0,
      subLine: 0,
      subLineCount: 2,
      sliceHeight: sliceHeightForSubLine(layout.rowHeights[0], 0, 2),
    });
    expect(sourceLineToSliceSpec(1, layout)).toEqual({
      rowLayoutIndex: 0,
      subLine: 1,
      subLineCount: 2,
      sliceHeight: sliceHeightForSubLine(layout.rowHeights[0], 1, 2),
    });
    expect(sourceLineToSliceSpec(2, layout)).toEqual({
      rowLayoutIndex: 1,
      subLine: 0,
      subLineCount: 1,
      sliceHeight: layout.rowHeights[1],
    });
  });
});

describe('renderTableSvgLineSlice', () => {
  it('renders one band per source line matching row layout heights', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    let totalSliceHeight = 0;
    for (let line = 0; line < basicBlock().numLines; line++) {
      const svg = renderTableSvgLineSlice(layout, line);
      expect(svg).toContain('<svg');
      const heightMatch = svg!.match(/height="(\d+)px"/);
      expect(heightMatch).not.toBeNull();
      totalSliceHeight += Number(heightMatch![1]);
    }
    expect(totalSliceHeight).toBe(layout.totalHeight);
  });

  it('uses full wrapped height for a long cell on one source line', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Section', 'Content'],
      rows: [[longText, 'short']],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    const dataSlice = renderTableSvgLineSlice(layout, 2);
    const heightMatch = dataSlice!.match(/height="(\d+)px"/);
    expect(heightMatch).not.toBeNull();
    expect(Number(heightMatch![1])).toBeGreaterThan(metrics.lineHeight);
    expect(dataSlice).toContain('<tspan');
    expect(dataSlice).toContain('adipiscing');
  });

  it('includes row content on the matching slice', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const headerSlice = renderTableSvgLineSlice(layout, 0);
    const dataSlice = renderTableSvgLineSlice(layout, 2);
    expect(headerSlice).toContain('Name');
    expect(dataSlice).toContain('Ada');
  });
});

describe('buildTableLayout capped mode', () => {
  it('limits total height to source line count for wrapped cells', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Section', 'Content'],
      rows: [[longText, longText]],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics, capToSourceLines: true });
    expect(layout.totalHeight).toBe(block.numLines * metrics.lineHeight);
  });
});

describe('renderTableSvg', () => {
  it('renders header and data rows with borders', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Name');
    expect(svg).toContain('Role');
    expect(svg).toContain('Ada');
    expect(svg).toContain('Bob');
    expect(svg).not.toContain('font-weight');
  });

  it('escapes XML in cell text', () => {
    const block: TableBlock = {
      ...basicBlock(),
      header: ['A & B', 'C'],
      rows: [['<x>', 'y']],
    };
    const svg = renderTableSvg(block, { isDark: true, ...metrics });
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('&lt;x&gt;');
  });

  it('uses dark theme colors', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: true, ...metrics });
    expect(svg).toContain('#1e1e1e');
    expect(svg).toContain('#cccccc');
  });

  it('uses explicit table colors when provided', () => {
    const svg = renderTableSvg(basicBlock(), {
      isDark: true,
      ...metrics,
      colors: {
        background: '#282c34',
        headerBackground: '#23282f',
        border: '#3a3f4b',
        text: '#abb2bf',
      },
    });
    expect(svg).toContain('#282c34');
    expect(svg).toContain('#23282f');
    expect(svg).toContain('#3a3f4b');
    expect(svg).toContain('#abb2bf');
  });

  it('sizes SVG height to one editor line per source line', () => {
    const block = basicBlock();
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    const expectedHeight = block.numLines * metrics.lineHeight;
    expect(svg).toContain(`height="${expectedHeight}px"`);
  });

  it('spans header cells across header and separator source lines', () => {
    const block = basicBlock();
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    const headerBandHeight = metrics.lineHeight * 2;
    const headerRectMatch = svg.match(
      new RegExp(`<rect[^>]*height="${headerBandHeight}"[^>]*fill="#f3f3f3"`),
    );
    expect(headerRectMatch).not.toBeNull();
  });

  it('does not draw a separate header rule line (cell strokes only)', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    expect(svg).not.toContain('<line');
    expect(svg).not.toContain('#a8a8a8');
    expect(svg).not.toContain('#6e6e6e');
  });

  it('wraps long cell text with tspans instead of truncating', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Section', 'Content'],
      rows: [[longText, longText]],
      align: [null, null],
    };
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    expect(svg).toContain('<tspan');
    expect(svg).toContain('Lorem ipsum');
    expect(svg).toContain('adipiscing');
    expect(svg).toContain('dy="');
    expect(svg).not.toContain('...');
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(widthMatch).not.toBeNull();
    const totalWidth = Number(widthMatch![1]);
    expect(totalWidth).toBeLessThanOrEqual(800 + 4);
    const heightMatch = svg.match(/height="(\d+)"/);
    expect(heightMatch).not.toBeNull();
    const renderedHeight = Number(heightMatch![1]);
    expect(renderedHeight).toBeGreaterThan(block.numLines * metrics.lineHeight);
  });

  it('caps column width for very long unbroken text', () => {
    const longText = 'A'.repeat(500);
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Wide'],
      rows: [[longText]],
      align: [null],
    };
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    expect(svg).toContain('<tspan');
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(widthMatch).not.toBeNull();
    const totalWidth = Number(widthMatch![1]);
    expect(totalWidth).toBeLessThanOrEqual(400 + 2);
  });
});

describe('maxWrapLinesForBandHeight', () => {
  it('returns at least one line for narrow bands', () => {
    expect(maxWrapLinesForBandHeight(18, { ...metrics, cellPadY: 2 })).toBeGreaterThanOrEqual(1);
  });
});
