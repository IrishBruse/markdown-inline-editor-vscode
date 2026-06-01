import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { MarkdownParser } from '../../parser/core';
import {
  bodyBandHeaderInsetPx,
  buildTableLayout,
  maxBandHeightPx,
  MAX_BAND_LINES,
  renderTableSvgLineSlice,
  resolveOverlayBandHeight,
  rowOverlayExceedsSourceLine,
  sourceLineToSliceSpec,
} from '../table-renderer';

const metrics = { isDark: false, lineHeight: 18, fontSize: 13 };
const docsLongCellFixture = join(
  __dirname,
  '../../test/e2e/visual/custom-long-rendered/fixture.md',
);

/** First data-row Lorem paragraph from docs/tests/05-tables.md (Custom mode: long cell text). */
const docsRow1Lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

function docsLongBodyBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 400,
    numLines: 4,
    header: ['Section Header', 'Detailed Placeholder Content'],
    rows: [['Row 1', docsRow1Lorem], ['Row 2', 'short']],
    align: [null, null],
  };
}

function parseLayout(md: string) {
  const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
  return buildTableLayout(tableBlocks[0]!, { ...metrics, capToSourceLines: false });
}

function labelBaselineY(svg: string, label: string): number {
  const match = svg.match(new RegExp(`<tspan x="[^"]*" y="([\\d.]+)">${label}`));
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe('wrapped body cell overlays (05-tables long cell text)', () => {
  it('wraps docs-style Lorem across many lines in layout', () => {
    const layout = buildTableLayout(docsLongBodyBlock(), { ...metrics, capToSourceLines: false });
    expect(layout.rowLayouts[1].maxWrapLines).toBeGreaterThan(MAX_BAND_LINES);
    expect(layout.rowHeights[1]).toBeGreaterThan(metrics.lineHeight);
    expect(rowOverlayExceedsSourceLine(layout, 1)).toBe(true);
  });

  it('caps the visible body band at MAX_BAND_LINES with ellipsis', () => {
    const layout = buildTableLayout(docsLongBodyBlock(), { ...metrics, capToSourceLines: false });
    const slice = sourceLineToSliceSpec(2, layout)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    expect(bandHeight).toBe(maxBandHeightPx(layout.metrics));

    const svg = renderTableSvgLineSlice(layout, 2)!;
    expect(svg.match(/height="(\d+)"/)?.[1]).toBe(String(bandHeight));
    expect(svg).toMatch(/&#x2026;|…/);
    expect((svg.match(/<tspan/g) ?? []).length).toBeLessThanOrEqual(MAX_BAND_LINES);
  });

  it('vertically centers the row label beside wrapped content', () => {
    const layout = buildTableLayout(docsLongBodyBlock(), { ...metrics, capToSourceLines: false });
    const slice = sourceLineToSliceSpec(2, layout)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const svg = renderTableSvgLineSlice(layout, 2)!;
    const baseline = labelBaselineY(svg, 'Row 1');
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + layout.metrics.fontSize);
  });

  it('word-wraps body text with multiple tspans instead of a single truncated line', () => {
    const layout = buildTableLayout(docsLongBodyBlock(), { ...metrics, capToSourceLines: false });
    const svg = renderTableSvgLineSlice(layout, 2)!;
    expect(svg).toContain('consectetur');
    expect(svg).toContain('adipiscing');
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('draws a top rule on the following row when the prior body band overflows', () => {
    const layout = buildTableLayout(docsLongBodyBlock(), { ...metrics, capToSourceLines: false });
    expect(rowOverlayExceedsSourceLine(layout, 1)).toBe(true);
    const nextSlice = sourceLineToSliceSpec(3, layout)!;
    expect(nextSlice.bandBorders?.top).toBe(true);

    const border = layout.metrics.colors.border;
    const svg = renderTableSvgLineSlice(layout, 3)!;
    const inset = bodyBandHeaderInsetPx(layout, 2);
    expect(svg).toMatch(
      new RegExp(`<rect x="0" y="${inset}" width="${layout.totalWidth}" height="1"[^>]*fill="${border.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    );
  });

  it('breaks an unbroken long token from docs Long and dense cells', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(4);
    const md = `| Col | Note |\n| --- | --- |\n| ${token} | x |`;
    const layout = parseLayout(md);
    expect(layout.rowLayouts[1].maxWrapLines).toBeGreaterThan(1);
    const svg = renderTableSvgLineSlice(layout, 2)!;
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('matches the custom-long visual fixture derived from 05-tables.md', () => {
    const layout = parseLayout(readFileSync(docsLongCellFixture, 'utf8'));
    const slice = sourceLineToSliceSpec(2, layout)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);

    const svg = renderTableSvgLineSlice(layout, 2)!;
    const row1Y = svg.match(/<tspan x="[^"]*" y="([\d.]+)">Row 1<\/tspan>/)?.[1];
    expect(row1Y).toBeDefined();
    const baseline = Number(row1Y);
    expect(baseline).toBeGreaterThan(bandHeight * 0.28);
    expect(baseline).toBeLessThan(bandHeight * 0.65 + layout.metrics.fontSize);
    expect(layout.totalWidth).toBeGreaterThan(500);
    expect(layout.totalWidth).toBeLessThan(600);
  });
});
