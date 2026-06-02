/**
 * Regression tests for custom table per-line SVG overlays.
 */
import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { MarkdownParser } from '../../parser/core';
import {
  bodyBandHeaderInsetPx,
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
    expect(sourceLineToSliceSpec(1, layout)?.separatorColumnBridge).toBe(true);
    expect(sourceLineToSliceSpec(2, layout)?.mergedHeader).toBeUndefined();
  });

  it('renders header labels on the title-line overlay only', () => {
    const headerSvg = sliceSvg(layout, 0);
    expect(headerSvg).toContain('Name');
    expect(headerSvg).toContain('Role');
    expect(headerSvg).not.toContain('Ada');
    expect(renderTableSvgLineSlice(layout, 1)).toContain(layout.metrics.colors.headerBackground);
  });

  it('uses a merged title overlay plus a separator bridge on the GFM divider line', () => {
    const headerSvg = sliceSvg(layout, 0);
    const titleSlice = sourceLineToSliceSpec(0, layout)!;
    expect(renderTableSvgLineSlice(layout, 1)).toContain(layout.metrics.colors.headerBackground);
    expect(parseBandHeight(headerSvg)).toBe(resolveOverlayBandHeight(layout, titleSlice));
    expect(headerSvg).toContain('Name');
    const separatorSvg = sliceSvg(layout, 1);
    expect(separatorSvg).toMatch(new RegExp(`<rect x="0" y="${layout.metrics.lineHeight - 1}"[^>]*width="`));
  });

  it('top-aligns single-line header labels in the title band', () => {
    const slice = sourceLineToSliceSpec(0, layout)!;
    const headerSvg = sliceSvg(layout, 0);
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    const baseline = labelBaselineY(headerSvg, 'Name');
    expect(baseline).toBeLessThan(bandHeight * 0.85);
  });

  it('top-aligns wrapped header labels within the thead band', () => {
    const block: TableBlock = {
      startPos: 0,
      endPos: 200,
      numLines: 3,
      header: [
        'H',
        [
          'Detailed Placeholder Content with enough words to wrap across multiple header lines',
          'and stay top-aligned instead of spreading through a tall empty band',
        ].join(' '),
      ],
      rows: [['Row', 'x']],
      align: [null, null],
    };
    const wrappedLayout = layoutFor(block);
    expect(wrappedLayout.rowLayouts[0].maxWrapLines).toBeGreaterThan(1);
    const headerSvg = sliceSvg(wrappedLayout, 0);
    const bandHeight = resolveOverlayBandHeight(wrappedLayout, sourceLineToSliceSpec(0, wrappedLayout)!);
    const firstBaseline = labelBaselineY(headerSvg, 'Detailed');
    expect(firstBaseline).toBeLessThan(bandHeight * 0.85);
    expect((headerSvg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('paints the header band with header background only', () => {
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

  it('draws the table top on the title overlay and thead bottom on the separator bridge', () => {
    const headerSvg = sliceSvg(layout, 0);
    const separatorSvg = sliceSvg(layout, 1);
    const titleHeight = parseBandHeight(headerSvg);
    expect(headerSvg).toMatch(/<rect x="0" y="0"[^>]*width="\d+"/);
    expect(headerSvg).not.toMatch(new RegExp(`<rect x="0" y="${titleHeight - 1}"[^>]*width="`));
    expect(separatorSvg).toMatch(new RegExp(`<rect x="0" y="${layout.metrics.lineHeight - 1}"[^>]*width="`));
  });

  it('draws column rules through the separator bridge overlay', () => {
    const headerSvg = sliceSvg(layout, 0);
    const separatorSvg = sliceSvg(layout, 1);
    const titleBand = parseBandHeight(headerSvg);
    const separatorBand = parseBandHeight(separatorSvg);
    const junction = 1 + layout.colWidths[0];
    expect(separatorBand).toBe(layout.metrics.lineHeight);
    expect(headerSvg).toContain(`<rect x="${junction}" y="0" width="1" height="${titleBand}"`);
    expect(separatorSvg).toContain(`<rect x="${junction}" y="0" width="1" height="${separatorBand}"`);
  });

  it('spans column rules across the full merged header overlay when the header wraps', () => {
    const wrappedLayout = layoutFor({
      startPos: 0,
      endPos: 120,
      numLines: 4,
      header: ['Section Header', 'Detailed Placeholder Content with enough words to wrap across lines'],
      rows: [['Row 1', 'x']],
      align: [null, null],
    });
    const headerSvg = sliceSvg(wrappedLayout, 0);
    const titleBand = parseBandHeight(headerSvg);
    const junction = 1 + wrappedLayout.colWidths[0];
    expect(titleBand).toBe(wrappedLayout.metrics.lineHeight);
    expect(headerSvg).toContain(`<rect x="${junction}" y="0" width="1" height="${titleBand}"`);
    expect(renderTableSvgLineSlice(wrappedLayout, 1)).toContain(wrappedLayout.metrics.colors.headerBackground);
  });

  it('matches column divider height to the title overlay band for wrapped header cells', () => {
    const longHeaderCell = [
      'Aliquam pellentesque, urna nec hendrerit mattis, dui elit commodo augue, ac consectetur massa eros et lorem.',
      'Integer molestie purus tellus, id lobortis elit pharetra vitae. Sed vel nisl ac arcu vehicula sodales.',
    ].join(' ');
    const wrappedLayout = layoutFor({
      startPos: 0,
      endPos: 400,
      numLines: 4,
      header: ['Section Header', longHeaderCell],
      rows: [
        ['Row 1', longHeaderCell],
        ['Row 2', longHeaderCell],
      ],
      align: [null, null],
    });
    const headerSvg = sliceSvg(wrappedLayout, 0);
    const titleBand = parseBandHeight(headerSvg);
    const junction = 1 + wrappedLayout.colWidths[0];
    const dividerMatch = headerSvg.match(
      new RegExp(`<rect x="${junction}" y="0" width="1" height="(\\d+)"`),
    );
    expect(dividerMatch).not.toBeNull();
    expect(Number(dividerMatch![1])).toBe(titleBand);
    expect(titleBand).toBe(wrappedLayout.metrics.lineHeight);
  });

  it('renders the first body row on the first data source line for every short thead table', () => {
    const dataSvg = sliceSvg(layout, 2);
    expect(dataSvg).toContain('Ada');
    expect(dataSvg).toContain(layout.metrics.colors.background);
    expect(dataSvg).toContain(layout.metrics.colors.border);
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
    for (const sourceLine of [2, 3]) {
      const slice = sourceLineToSliceSpec(sourceLine, layout)!;
      const bandHeight = resolveOverlayBandHeight(layout, slice);
      expect(bandHeight).toBeLessThanOrEqual(metrics.lineHeight);
      const svg = sliceSvg(layout, sourceLine);
      expect(parseBandHeight(svg)).toBe(bandHeight);
    }
  });

  it('draws one outer right border (not a column divider plus outer edge)', () => {
    const layout = layoutFor();
    const svg = sliceSvg(layout, 0);
    const w = layout.totalWidth;
    expect(svg).toContain(`<rect x="${w - 1}" y="0" width="1" height="`);
  });

  it('draws 1px internal column borders without per-cell fills stacking on junctions', () => {
    const block: TableBlock = {
      startPos: 0,
      endPos: 80,
      numLines: 3,
      header: ['Name', 'CJK', 'Emoji'],
      rows: [['AB', '你好', '😀']],
      align: [null, null, null],
    };
    const layout = layoutFor(block);
    const junction = 1 + layout.colWidths[0];
    const border = layout.metrics.colors.border;
    const svg = sliceSvg(layout, 0);
    expect(svg).toContain(`<rect x="${junction}" y="0" width="1" height="`);
    expect(svg).not.toMatch(new RegExp(`<rect x="${junction}" y="0" width="${layout.colWidths[1]}"`));
  });

  it('draws rect borders on every data row overlay (not stroked cell rects)', () => {
    const layout = layoutFor();
    const border = layout.metrics.colors.border;
    for (const line of [0, 2]) {
      const svg = sliceSvg(layout, line);
      expect(cellRects(svg).every((r) => !r.hasStroke)).toBe(true);
      expect(svg).toContain(`fill="${border}"`);
      expect(svg).toMatch(/<rect x="0" y="\d+"[^>]*width="\d+"[^>]*height="1"/);
    }
  });

  it('draws a top rule only when the prior row band overflows its source line', () => {
    const border = layoutFor().metrics.colors.border;
    const topRuleFor = (layout: TableLayout, y: number) => new RegExp(
      `<rect x="0" y="${y}" width="${layout.totalWidth}" height="1"[^>]*fill="${border.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
    );
    const shortRows = layoutFor();
    expect(sliceSvg(shortRows, 2)).not.toMatch(topRuleFor(shortRows, 0));

    const overflowRows = layoutFor(overflowThenShortRowTable());
    expect(sliceSvg(overflowRows, 3)).toMatch(
      topRuleFor(overflowRows, bodyBandHeaderInsetPx(overflowRows, 2)),
    );
  });

  it('fills data cells with body background, not header background', () => {
    const layout = layoutFor();
    const svg = sliceSvg(layout, 2);
    const { headerBackground, background } = layout.metrics.colors;
    const fills = cellFillRects(svg).map((r) => r.fill).filter(Boolean);
    expect(fills.every((f) => f === background)).toBe(true);
    expect(fills.some((f) => f === headerBackground)).toBe(false);
  });

  it('insets the band fill below the bottom grid line', () => {
    const layout = layoutFor();
    const bandHeight = parseBandHeight(sliceSvg(layout, 2));
    const fillHeight = bandHeight - 1;
    const bandFill = cellFillRects(sliceSvg(layout, 2)).find((r) => r.height === fillHeight);
    expect(bandFill).toBeDefined();
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
    const dataSvg = sliceSvg(layout, 0);
    expect(cellRects(headerSvg).every((r) => !r.hasStroke)).toBe(true);
    expect(cellRects(dataSvg).every((r) => !r.hasStroke)).toBe(true);
  });
});

describe('custom overlay regression: overlay count', () => {
  it('counts one overlay per table source line', () => {
    const block = basicTable();
    expect(countTableOverlaySourceLines(block.numLines)).toBe(block.numLines);
  });

  it('parses a GFM table with overlays on the title and data source lines', () => {
    const md = '| Name | Role |\n| --- | --- |\n| Ada | Lead |\n| Bob | Dev |';
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    expect(tableBlocks).toHaveLength(1);
    const layout = layoutFor(tableBlocks[0]);
    const overlayLines = Array.from({ length: tableBlocks[0].numLines }, (_, line) => line).filter(
      (line) => renderTableSvgLineSlice(layout, line) !== null,
    );
    expect(overlayLines).toEqual([0, 1, 2, 3]);
  });
});
