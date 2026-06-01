import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser/core';
import type { TableBlock } from '../../parser';
import {
  bodyBandHeaderInsetPx,
  buildTableLayout,
  HEADER_SOURCE_LINES,
  maxBandHeightPx,
  renderHeaderSeparatorBridge,
  renderTableSvgLineSlice,
  resolveOverlayBandHeight,
  sourceLineToSliceSpec,
} from '../table-renderer';

const metrics = { isDark: false, lineHeight: 18, fontSize: 13 };

function tallWrappedHeaderBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 300,
    numLines: 4,
    header: [
      'Section Header',
      [
        'Detailed Placeholder Content with many additional words to force the header cell to wrap',
        'across at least six or seven lines in the overlay so row height exceeds max band cap',
        'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore',
        'et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris',
      ].join(' '),
    ],
    rows: [['Row 1', 'short'], ['Row 2', 'x']],
    align: [null, null],
  };
}

describe('wrapped merged header overlays', () => {
  it('uses full header row height for the title band, not MAX_BAND_LINES cap', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    expect(layout.rowLayouts[0].maxWrapLines).toBeGreaterThan(5);
    expect(layout.rowHeights[0]).toBeGreaterThan(maxBandHeightPx(layout.metrics));

    const headerSlice = sourceLineToSliceSpec(0, layout)!;
    const headerBand = resolveOverlayBandHeight(layout, headerSlice);
    expect(headerBand).toBe(layout.rowHeights[0]);

    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    expect(headerSvg.match(/height="(\d+)"/)?.[1]).toBe(String(headerBand));
  });

  it('hides the separator source line when the tall header already covers it', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const bridge = renderHeaderSeparatorBridge(layout);
    expect(bridge).toBeNull();
    expect(renderTableSvgLineSlice(layout, 1)).toBe(bridge);
  });

  it('puts the thead bottom rule on the title band when thead is taller than two source lines', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const headerBand = resolveOverlayBandHeight(layout, sourceLineToSliceSpec(0, layout)!);
    expect(headerBand).toBeGreaterThan(HEADER_SOURCE_LINES * metrics.lineHeight);
    expect(headerSvg).toMatch(new RegExp(`<rect x="0" y="${headerBand - 1}"[^>]*width="`));
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });

  it('insets the first body row fill below a tall header continuation', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const inset = bodyBandHeaderInsetPx(layout, 1);
    const headerBand = resolveOverlayBandHeight(layout, sourceLineToSliceSpec(0, layout)!);
    const firstBodyTop = HEADER_SOURCE_LINES * metrics.lineHeight;
    expect(inset).toBe(headerBand - firstBodyTop);

    const bodySlice = sourceLineToSliceSpec(2, layout)!;
    expect(bodySlice.bandBorders?.top).toBe(true);

    const bodySvg = renderTableSvgLineSlice(layout, 2)!;
    const bandHeight = Number(bodySvg.match(/height="(\d+)"/)?.[1]);
    const bodyBg = layout.metrics.colors.background;
    const fillRects = [...bodySvg.matchAll(
      new RegExp(`<rect x="\\d+" y="(\\d+)" width="\\d+" height="(\\d+)" fill="${bodyBg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
    )];
    expect(fillRects.length).toBeGreaterThan(0);
    for (const match of fillRects) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(inset);
    }
    const topRule = bodySvg.match(new RegExp(`<rect x="0" y="(${inset})"[^>]*height="1"`));
    expect(topRule).not.toBeNull();
    expect(bandHeight).toBeGreaterThan(inset);
  });

  it('renders the first body row inside the title overlay for a short docs-style header row', () => {
    const md = '| Section Header | Detailed Placeholder Content |\n| --- | --- |\n| Row 1 | x |';
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    const layout = buildTableLayout(tableBlocks[0], { ...metrics, capToSourceLines: false });
    expect(layout.rowHeights[0]).toBe(HEADER_SOURCE_LINES * metrics.lineHeight);
    const firstBody = renderTableSvgLineSlice(layout, 0);
    expect(firstBody).not.toBeNull();
    expect(firstBody).toContain('Row 1');
    expect(renderTableSvgLineSlice(layout, 1)).toBeNull();
  });
});
