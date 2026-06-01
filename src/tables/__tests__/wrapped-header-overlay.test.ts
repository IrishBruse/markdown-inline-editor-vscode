import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser/core';
import type { TableBlock } from '../../parser';
import {
  buildTableLayout,
  HEADER_SOURCE_LINES,
  mergedHeaderBandBudgetPx,
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
  it('keeps wrapped headers to the two-line thead band', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    expect(layout.rowLayouts[0].maxWrapLines).toBeGreaterThan(5);

    const headerSlice = sourceLineToSliceSpec(0, layout)!;
    const headerBand = resolveOverlayBandHeight(layout, headerSlice);
    expect(headerBand).toBe(mergedHeaderBandBudgetPx(layout.metrics));

    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    expect(headerSvg.match(/<svg[^>]*height="(\d+)px"/)?.[1]).toBe(String(headerBand));
    expect((headerSvg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
    expect(headerSvg).toMatch(/&#x2026;|…/);
  });

  it('renders column rules on the separator source line to bridge header and body', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const bridgeSvg = renderHeaderSeparatorBridge(layout)!;
    expect(bridgeSvg).toContain(layout.metrics.colors.border);
    expect(bridgeSvg).not.toContain('Section Header');
    expect(sourceLineToSliceSpec(1, layout)?.separatorColumnBridge).toBe(true);
    const junction = 1 + layout.colWidths[0];
    expect(bridgeSvg).toContain(`<rect x="${junction}" y="0" width="1" height="${metrics.lineHeight}"`);
  });

  it('puts the thead bottom rule on the merged title overlay', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const headerBand = resolveOverlayBandHeight(layout, sourceLineToSliceSpec(0, layout)!);
    expect(headerSvg).toMatch(new RegExp(`<rect x="0" y="${headerBand - 1}"[^>]*width="`));
  });

  it('renders the first body row on the first data source line', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const bodySlice = sourceLineToSliceSpec(2, layout)!;
    expect(bodySlice.rowLayoutIndex).toBe(1);

    const bodySvg = renderTableSvgLineSlice(layout, 2)!;
    expect(bodySvg).toContain('Row 1');
  });

  it('covers the separator with the merged title overlay for a short docs-style header row', () => {
    const md = '| Section Header | Detailed Placeholder Content |\n| --- | --- |\n| Row 1 | x |';
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    const layout = buildTableLayout(tableBlocks[0], { ...metrics, capToSourceLines: false });
    expect(layout.rowHeights[0]).toBe(HEADER_SOURCE_LINES * metrics.lineHeight);
    expect(renderTableSvgLineSlice(layout, 0)).toContain(layout.metrics.colors.headerBackground);
    expect(renderTableSvgLineSlice(layout, 1)).toContain(layout.metrics.colors.border);
  });
});
