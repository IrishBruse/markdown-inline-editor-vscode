import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import {
  buildTableLayout,
  computeBandHeightForSlice,
  resolveOverlayBandHeight,
  HEADER_SOURCE_LINES,
  MAX_BAND_LINES,
  maxBandHeightPx,
  maxWrapLinesForBandHeight,
  renderTableSvg,
  renderTableSvgLineSlice,
  sourceLineToSliceSpec,
  wrapText,
  wrappedLineStep,
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
  it('maps merged header and data source lines', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const theadMinHeight = HEADER_SOURCE_LINES * metrics.lineHeight;
    expect(sourceLineToSliceSpec(0, layout)).toEqual({
      rowLayoutIndex: 0,
      subLine: 0,
      subLineCount: 1,
      sliceHeight: Math.max(theadMinHeight, layout.rowHeights[0]),
      mergedHeader: true,
      bandBorders: { top: true, bottom: true },
    });
    expect(sourceLineToSliceSpec(1, layout)).toEqual({
      rowLayoutIndex: 0,
      subLine: 0,
      subLineCount: 1,
      sliceHeight: metrics.lineHeight,
      hideSeparatorRow: true,
    });
    expect(sourceLineToSliceSpec(2, layout)).toEqual({
      rowLayoutIndex: 1,
      subLine: 0,
      subLineCount: 1,
      sliceHeight: layout.rowHeights[1],
      bandBorders: { top: false, bottom: true },
    });
    expect(sourceLineToSliceSpec(3, layout)).toEqual({
      rowLayoutIndex: 2,
      subLine: 0,
      subLineCount: 1,
      sliceHeight: layout.rowHeights[2],
      bandBorders: { top: false, bottom: true },
    });
  });
});

describe('multiline header band', () => {
  it('renders the thead on the title line only (separator line has no SVG)', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    expect(headerSvg).toContain('Name');
    expect(headerSvg).toContain('Role');
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
    const titleHeight = Number(headerSvg.match(/height="(\d+)px"/)![1]);
    expect(titleHeight).toBeGreaterThanOrEqual(HEADER_SOURCE_LINES * metrics.lineHeight);
  });

  it('vertically centers simple header labels in the two-line thead band', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const slice = sourceLineToSliceSpec(0, layout)!;
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const yMatch = headerSvg.match(/<tspan x="[^"]*" y="([\d.]+)">Name/);
    expect(yMatch).not.toBeNull();
    const baseline = Number(yMatch![1]);
    const { fontSize } = layout.metrics;
    const topAlignedMax = bandHeight * 0.28;
    expect(baseline).toBeGreaterThan(topAlignedMax);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + fontSize);
  });

  it('draws rect borders on data row overlays (not stroked cell rects)', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const dataSvg = renderTableSvgLineSlice(layout, 2)!;
    const borderColor = layout.metrics.colors.border;
    expect(dataSvg).toContain(`fill="${borderColor}"`);
    expect(dataSvg).toMatch(/<rect x="0" y="\d+"[^>]*width="\d+"[^>]*height="1"/);
    const strokeRects = [...dataSvg.matchAll(new RegExp(`<rect[^>]*stroke="${borderColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))];
    expect(strokeRects.length).toBe(0);
  });

  it('does not render an SVG band on the separator source line', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });

  it('uses header background for the merged title overlay', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    expect(headerSvg).toContain('#f3f3f3');
    expect(headerSvg).not.toMatch(/fill="#ffffff"/);
  });

  it('draws thead bottom border on the title band', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const titleHeight = Number(headerSvg.match(/height="(\d+)px"/)![1]);
    expect(headerSvg).toMatch(new RegExp(`<rect x="0" y="${titleHeight - 1}"[^>]*width="`));
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });

  it('vertically centers multiline wrapped header text', () => {
    const longHeader = 'Section Title With Extra Words For Wrapping';
    const block: TableBlock = {
      startPos: 0,
      endPos: 80,
      numLines: 3,
      header: [longHeader, 'Col B'],
      rows: [['a', 'b']],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const yMatch = headerSvg.match(/<tspan x="[^"]*" y="([\d.]+)">Section/);
    expect(yMatch).not.toBeNull();
    const firstBaseline = Number(yMatch![1]);
    const bandHeight = computeBandHeightForSlice(layout, sourceLineToSliceSpec(0, layout)!);
    const fontSize = layout.metrics.fontSize;
    expect(firstBaseline).toBeGreaterThan(bandHeight * 0.25);
    expect(firstBaseline).toBeLessThan(bandHeight * 0.65 + fontSize);
  });
});

describe('renderTableSvgLineSlice', () => {
  it('renders one band per source line at capped band height', () => {
    const layout = buildTableLayout(basicBlock(), { isDark: false, ...metrics });
    let totalSliceHeight = 0;
    for (let line = 0; line < basicBlock().numLines; line++) {
      const slice = sourceLineToSliceSpec(line, layout);
      const svg = renderTableSvgLineSlice(layout, line);
      if (!slice) {
        expect(svg).toBeNull();
        continue;
      }
      if (slice.hideSeparatorRow === true) {
        expect(svg).toBeNull();
        continue;
      }
      const bandHeight = resolveOverlayBandHeight(layout, slice);
      expect(svg).toContain('<svg');
      const heightMatch = svg!.match(/height="(\d+)px"/);
      expect(heightMatch).not.toBeNull();
      expect(Number(heightMatch![1])).toBe(bandHeight);
      totalSliceHeight += bandHeight;
    }
    const expectedTotal = Array.from({ length: basicBlock().numLines }, (_, line) => {
      const slice = sourceLineToSliceSpec(line, layout);
      if (!slice || slice.hideSeparatorRow === true) {
        return 0;
      }
      return resolveOverlayBandHeight(layout, slice);
    }).reduce((sum, h) => sum + h, 0);
    expect(totalSliceHeight).toBe(expectedTotal);
  });

  it('vertically centers a short body cell beside a taller wrapped cell', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Row', 'Content'],
      rows: [[longText, 'x']],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    const slice = sourceLineToSliceSpec(2, layout)!;
    const svg = renderTableSvgLineSlice(layout, 2)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const yMatch = svg.match(/<tspan x="[^"]*" y="([\d.]+)">x<\/tspan>/);
    expect(yMatch).not.toBeNull();
    const baseline = Number(yMatch![1]);
    const { fontSize } = layout.metrics;
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + fontSize);
  });

  it('vertically centers a row label beside a taller wrapped cell', () => {
    const longText = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore',
      'et dolore magna aliqua.',
    ].join(' ');
    const block: TableBlock = {
      startPos: 0,
      endPos: 120,
      numLines: 3,
      header: ['Label', 'Content'],
      rows: [['Row 1', longText]],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    const slice = sourceLineToSliceSpec(2, layout)!;
    const svg = renderTableSvgLineSlice(layout, 2)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const yMatch = svg.match(/<tspan x="[^"]*" y="([\d.]+)">Row 1<\/tspan>/);
    expect(yMatch).not.toBeNull();
    const baseline = Number(yMatch![1]);
    const { fontSize } = layout.metrics;
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + fontSize);
  });

  it('insets cell fills below the bottom grid line on tall data bands', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Row', 'Content'],
      rows: [[longText, 'x']],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    const svg = renderTableSvgLineSlice(layout, 2)!;
    const bandMatch = svg.match(/<svg[^>]*height="(\d+)px"/);
    expect(bandMatch).not.toBeNull();
    const bandHeight = Number(bandMatch![1]);
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);
    const fillHeight = bandHeight - 1;
    const cellHeights = [...svg.matchAll(/<rect[^>]*height="(\d+)"/g)].map((m) => Number(m[1]));
    const rowRects = cellHeights.filter((h) => h === fillHeight);
    expect(rowRects.length).toBeGreaterThanOrEqual(2);
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
    const dataSlice = renderTableSvgLineSlice(layout, 2)!;
    const heightMatch = dataSlice.match(/height="(\d+)px"/);
    expect(heightMatch).not.toBeNull();
    expect(Number(heightMatch![1])).toBeGreaterThan(metrics.lineHeight);
    expect(Number(heightMatch![1])).toBeLessThanOrEqual(maxBandHeightPx(layout.metrics));
    expect(dataSlice).toContain('<tspan');
    expect(dataSlice).toContain('adipiscing');
    const dyMatches = dataSlice.match(/dy="([^"]+)"/g) ?? [];
    for (const dy of dyMatches) {
      const value = Number(dy.match(/[\d.]+/)?.[0]);
      expect(value).toBeGreaterThanOrEqual(wrappedLineStep(metrics.lineHeight, metrics.fontSize) * 0.9);
    }
  });

  it('ellipsis when wrapped lines exceed MAX_BAND_LINES', () => {
    const longText =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
    const block: TableBlock = {
      startPos: 0,
      endPos: 200,
      numLines: 3,
      header: ['Section', 'Content'],
      rows: [[longText, 'x']],
      align: [null, null],
    };
    const layout = buildTableLayout(block, { isDark: false, ...metrics });
    expect(layout.rowLayouts[1].maxWrapLines).toBeGreaterThan(MAX_BAND_LINES);
    const svg = renderTableSvgLineSlice(layout, 2)!;
    const heightMatch = svg.match(/height="(\d+)px"/);
    expect(heightMatch).not.toBeNull();
    expect(Number(heightMatch![1])).toBe(maxBandHeightPx(layout.metrics));
    expect(svg).toMatch(/&#x2026;|…/);
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBeLessThanOrEqual(MAX_BAND_LINES);
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
