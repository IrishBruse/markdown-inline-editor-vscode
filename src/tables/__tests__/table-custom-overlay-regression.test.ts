/**
 * Regression tests for custom table per-line SVG overlays.
 */
import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { MarkdownParser } from '../../parser/core';
import {
  buildTableLayout,
  countTableOverlaySourceLines,
  HEADER_SOURCE_LINES,
  resolveOverlayBandHeight,
  renderTableSvgLineSlice,
  sourceLineToSliceSpec,
  type TableLayout,
} from '../table-renderer';

const metrics = { lineHeight: 18, fontSize: 13 };

function basicTable(): TableBlock {
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

function wrappedBodyTable(): TableBlock {
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
  return {
    startPos: 0,
    endPos: 100,
    numLines: 3,
    header: ['Col', 'Note'],
    rows: [[longText, 'x']],
    align: [null, null],
  };
}

function overflowThenShortRowTable(): TableBlock {
  const longText = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore',
    'et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip',
  ].join(' ');
  return {
    startPos: 0,
    endPos: 120,
    numLines: 4,
    header: ['Col', 'Note'],
    rows: [[longText, 'x'], ['short', 'y']],
    align: [null, null],
  };
}

function layoutFor(block: TableBlock = basicTable()) {
  return buildTableLayout(block, { isDark: false, ...metrics });
}

function sliceSvg(layout: TableLayout, sourceLineIndex: number): string {
  const svg = renderTableSvgLineSlice(layout, sourceLineIndex);
  expect(svg).not.toBeNull();
  return svg!;
}

function parseBandHeight(svg: string): number {
  const match = svg.match(/<svg[^>]*height="(\d+)px"/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

function labelBaselineY(svg: string, label: string): number {
  const match = svg.match(new RegExp(`<tspan x="[^"]*" y="([\\d.]+)">${label}`));
  expect(match).not.toBeNull();
  return Number(match![1]);
}

function cellRects(svg: string): {
  width: number;
  height: number;
  hasStroke: boolean;
  fill: string | null;
}[] {
  return [...svg.matchAll(/<rect[^>]*>/g)].map((m) => {
    const tag = m[0];
    const widthMatch = tag.match(/width="(\d+)"/);
    const heightMatch = tag.match(/height="(\d+)"/);
    const fillMatch = tag.match(/fill="([^"]+)"/);
    return {
      width: widthMatch ? Number(widthMatch[1]) : 0,
      height: heightMatch ? Number(heightMatch[1]) : 0,
      hasStroke: /stroke="/.test(tag),
      fill: fillMatch ? fillMatch[1] : null,
    };
  });
}

/** Cell background rects only (excludes 1px border grid rects). */
function cellFillRects(svg: string) {
  return cellRects(svg).filter((r) => r.height > 1 && r.width > 1);
}

describe('custom overlay regression: header', () => {
  const layout = layoutFor();

  it('maps title and separator source lines to header slices', () => {
    expect(sourceLineToSliceSpec(0, layout)?.mergedHeader).toBe(true);
    expect(sourceLineToSliceSpec(1, layout)?.hideSeparatorRow).toBe(true);
    expect(sourceLineToSliceSpec(2, layout)?.mergedHeader).toBeUndefined();
  });

  it('renders header labels on the title-line overlay only', () => {
    const headerSvg = sliceSvg(layout, 0);
    expect(headerSvg).toContain('Name');
    expect(headerSvg).toContain('Role');
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });

  it('uses a title band at least two editor lines tall', () => {
    const headerSvg = sliceSvg(layout, 0);
    expect(parseBandHeight(headerSvg)).toBeGreaterThanOrEqual(HEADER_SOURCE_LINES * metrics.lineHeight);
    expect(resolveOverlayBandHeight(layout, sourceLineToSliceSpec(0, layout)!)).toBe(
      parseBandHeight(headerSvg),
    );
  });

  it('vertically centers header labels in the two-line thead', () => {
    const slice = sourceLineToSliceSpec(0, layout)!;
    const headerSvg = sliceSvg(layout, 0);
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const baseline = labelBaselineY(headerSvg, 'Name');
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + layout.metrics.fontSize);
  });

  it('paints the title band with header background only', () => {
    const headerSvg = sliceSvg(layout, 0);
    const { headerBackground, background } = layout.metrics.colors;
    expect(headerSvg).toContain(`fill="${headerBackground}"`);
    expect(headerSvg).not.toContain(`fill="${background}"`);
    for (const rect of cellFillRects(headerSvg)) {
      if (rect.fill === headerBackground) {
        expect(rect.hasStroke).toBe(false);
      }
    }
  });

  it('draws the table top and thead bottom rules on the title band', () => {
    const headerSvg = sliceSvg(layout, 0);
    const bandHeight = parseBandHeight(headerSvg);
    expect(headerSvg).toMatch(/<rect x="0" y="0"[^>]*width="\d+"/);
    expect(headerSvg).toMatch(new RegExp(`<rect x="0" y="${bandHeight - 1}"[^>]*width="`));
  });

  it('renders no SVG on the separator source line', () => {
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });
});

describe('custom overlay regression: body', () => {
  it('caps single-line body band height to the editor line height', () => {
    const block: TableBlock = {
      startPos: 0,
      endPos: 80,
      numLines: 5,
      header: ['A', 'B', 'C', 'D'],
      rows: [
        ['r1', 'r1', 'r1', 'r1'],
        ['r2', 'r2', 'r2', 'r2'],
        ['r3', 'r3', 'r3', 'r3'],
      ],
      align: [null, null, null, null],
    };
    const layout = layoutFor(block);
    for (const sourceLine of [2, 3, 4]) {
      const slice = sourceLineToSliceSpec(sourceLine, layout)!;
      const bandHeight = resolveOverlayBandHeight(layout, slice);
      expect(bandHeight).toBeLessThanOrEqual(metrics.lineHeight);
      const svg = sliceSvg(layout, sourceLine);
      expect(parseBandHeight(svg)).toBe(bandHeight);
    }
  });

  it('draws one outer right border (not a column divider plus outer edge)', () => {
    const layout = layoutFor();
    const svg = sliceSvg(layout, 2);
    const w = layout.totalWidth;
    expect(svg).toContain(`<rect x="${w - 1}" y="0" width="1" height="`);
  });

  it('draws rect borders on every data row overlay (not stroked cell rects)', () => {
    const layout = layoutFor();
    const border = layout.metrics.colors.border;
    for (const line of [2, 3]) {
      const svg = sliceSvg(layout, line);
      expect(cellRects(svg).every((r) => !r.hasStroke)).toBe(true);
      expect(svg).toContain(`fill="${border}"`);
      expect(svg).toMatch(/<rect x="0" y="\d+"[^>]*width="\d+"[^>]*height="1"/);
    }
  });

  it('draws a top rule only when the prior row band overflows its source line', () => {
    const border = layoutFor().metrics.colors.border;
    const topRuleFor = (layout: TableLayout) => new RegExp(
      `<rect x="0" y="0" width="${layout.totalWidth}" height="1"[^>]*fill="${border.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
    );
    const shortRows = layoutFor();
    expect(sliceSvg(shortRows, 2)).not.toMatch(topRuleFor(shortRows));
    expect(sliceSvg(shortRows, 3)).not.toMatch(topRuleFor(shortRows));

    const overflowRows = layoutFor(overflowThenShortRowTable());
    expect(sliceSvg(overflowRows, 2)).not.toMatch(topRuleFor(overflowRows));
    expect(sliceSvg(overflowRows, 3)).toMatch(topRuleFor(overflowRows));
  });

  it('fills data cells with body background, not header background', () => {
    const layout = layoutFor();
    const svg = sliceSvg(layout, 2);
    const { headerBackground, background } = layout.metrics.colors;
    const fills = cellFillRects(svg).map((r) => r.fill).filter(Boolean);
    expect(fills.every((f) => f === background)).toBe(true);
    expect(fills.some((f) => f === headerBackground)).toBe(false);
  });

  it('insets body cell fills below the bottom grid line', () => {
    const layout = layoutFor();
    const bandHeight = parseBandHeight(sliceSvg(layout, 2));
    const fillHeight = bandHeight - 1;
    const heights = cellFillRects(sliceSvg(layout, 2)).map((r) => r.height);
    expect(heights.filter((h) => h === fillHeight).length).toBeGreaterThanOrEqual(2);
  });

  it('vertically centers short body text beside a taller wrapped cell', () => {
    const layout = layoutFor(wrappedBodyTable());
    const slice = sourceLineToSliceSpec(2, layout)!;
    const svg = sliceSvg(layout, 2);
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const baseline = labelBaselineY(svg, 'x');
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + layout.metrics.fontSize);
  });

  it('uses fill-only cells on header and data overlays', () => {
    const layout = layoutFor();
    const headerSvg = sliceSvg(layout, 0);
    const dataSvg = sliceSvg(layout, 2);
    expect(cellRects(headerSvg).every((r) => !r.hasStroke)).toBe(true);
    expect(cellRects(dataSvg).every((r) => !r.hasStroke)).toBe(true);
  });
});

describe('custom overlay regression: overlay count', () => {
  it('counts one overlay per table source line', () => {
    const block = basicTable();
    expect(countTableOverlaySourceLines(block.numLines)).toBe(block.numLines);
  });

  it('parses a GFM table with one overlay job per source line', () => {
    const md = '| Name | Role |\n| --- | --- |\n| Ada | Lead |\n| Bob | Dev |';
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    expect(tableBlocks).toHaveLength(1);
    const layout = layoutFor(tableBlocks[0]);
    const overlayLines = Array.from({ length: tableBlocks[0].numLines }, (_, line) => line).filter(
      (line) => sourceLineToSliceSpec(line, layout) !== null,
    );
    expect(overlayLines).toEqual([0, 1, 2, 3]);
  });
});
