/**
 * Regression tests for custom table per-line SVG overlays.
 * Spec: docs/specs/tables-custom.md
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

function cellRects(svg: string): { height: number; hasStroke: boolean; fill: string | null }[] {
  return [...svg.matchAll(/<rect[^>]*>/g)].map((m) => {
    const tag = m[0];
    const heightMatch = tag.match(/height="(\d+)"/);
    const fillMatch = tag.match(/fill="([^"]+)"/);
    return {
      height: heightMatch ? Number(heightMatch[1]) : 0,
      hasStroke: /stroke="/.test(tag),
      fill: fillMatch ? fillMatch[1] : null,
    };
  });
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
    const separatorSvg = sliceSvg(layout, 1);
    expect(headerSvg).toContain('Name');
    expect(headerSvg).toContain('Role');
    expect(separatorSvg).not.toContain('<text');
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
    for (const rect of cellRects(headerSvg)) {
      if (rect.fill === headerBackground) {
        expect(rect.hasStroke).toBe(false);
      }
    }
  });

  it('draws the table top rule on the title band, not the thead bottom', () => {
    const headerSvg = sliceSvg(layout, 0);
    const bandHeight = parseBandHeight(headerSvg);
    expect(headerSvg).toMatch(/y1="0\.5"/);
    expect(headerSvg).not.toMatch(new RegExp(`y1="${bandHeight - 0.5}"`));
  });

  it('draws the separator hide band with grid lines only (no fill over labels)', () => {
    const separatorSvg = sliceSvg(layout, 1);
    const { headerBackground, background } = layout.metrics.colors;
    expect(separatorSvg).not.toContain(`fill="${headerBackground}"`);
    expect(separatorSvg).not.toContain(`fill="${background}"`);
    expect(separatorSvg).toMatch(/<line[^>]*stroke="/);
    expect(separatorSvg).toMatch(/y1="17\.5"/);
  });
});

describe('custom overlay regression: body', () => {
  it('draws a stroked cell grid on every data row overlay', () => {
    const layout = layoutFor();
    const border = layout.metrics.colors.border;
    for (const line of [2, 3]) {
      const svg = sliceSvg(layout, line);
      const stroked = cellRects(svg).filter((r) => r.hasStroke);
      expect(stroked.length).toBe(basicTable().header.length);
      for (const rect of stroked) {
        expect(svg).toContain(`stroke="${border}"`);
      }
    }
  });

  it('fills data cells with body background, not header background', () => {
    const layout = layoutFor();
    const svg = sliceSvg(layout, 2);
    const { headerBackground, background } = layout.metrics.colors;
    const fills = cellRects(svg).map((r) => r.fill).filter(Boolean);
    expect(fills.every((f) => f === background)).toBe(true);
    expect(fills.some((f) => f === headerBackground)).toBe(false);
  });

  it('sizes each body cell rect to the full band height', () => {
    const layout = layoutFor();
    const bandHeight = parseBandHeight(sliceSvg(layout, 2));
    const heights = cellRects(sliceSvg(layout, 2)).map((r) => r.height);
    expect(heights.filter((h) => h === bandHeight).length).toBeGreaterThanOrEqual(2);
  });

  it('top-aligns short body text beside a taller wrapped cell', () => {
    const layout = layoutFor(wrappedBodyTable());
    const slice = sourceLineToSliceSpec(2, layout)!;
    const svg = sliceSvg(layout, 2);
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const baseline = labelBaselineY(svg, 'x');
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);
    expect(baseline).toBeLessThan(bandHeight * 0.45);
  });

  it('does not stroke header cells like data cells', () => {
    const layout = layoutFor();
    const headerSvg = sliceSvg(layout, 0);
    expect(cellRects(headerSvg).some((r) => r.hasStroke)).toBe(false);
    expect(cellRects(sliceSvg(layout, 2)).some((r) => r.hasStroke)).toBe(true);
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
