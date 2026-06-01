import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser/core';
import type { TableBlock } from '../../parser';
import {
  buildTableLayout,
  HEADER_SOURCE_LINES,
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
    expect(headerBand).toBeLessThanOrEqual(HEADER_SOURCE_LINES * metrics.lineHeight);

    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    expect(headerSvg.match(/height="(\d+)"/)?.[1]).toBe(String(headerBand));
    expect((headerSvg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
    expect(headerSvg).toMatch(/&#x2026;|…/);
  });

  it('always renders a separator bridge overlay', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const bridge = renderHeaderSeparatorBridge(layout);
    expect(bridge).not.toBeNull();
    expect(bridge).toContain(layout.metrics.colors.headerBackground);
    expect(renderTableSvgLineSlice(layout, 1)).toBe(bridge);
  });

  it('puts the thead bottom rule on the separator bridge', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const headerSvg = renderTableSvgLineSlice(layout, 0)!;
    const headerBand = resolveOverlayBandHeight(layout, sourceLineToSliceSpec(0, layout)!);
    expect(headerBand).toBeLessThanOrEqual(HEADER_SOURCE_LINES * metrics.lineHeight);
    expect(headerSvg).not.toMatch(new RegExp(`<rect x="0" y="${headerBand - 1}"[^>]*width="`));
    const bridgeSvg = renderTableSvgLineSlice(layout, 1)!;
    expect(bridgeSvg).toMatch(new RegExp(`<rect x="0" y="${metrics.lineHeight - 1}"[^>]*width="`));
  });

  it('renders the first body row on the first data source line', () => {
    const layout = buildTableLayout(tallWrappedHeaderBlock(), { ...metrics, capToSourceLines: false });
    const bodySlice = sourceLineToSliceSpec(2, layout)!;
    expect(bodySlice.rowLayoutIndex).toBe(1);

    const bodySvg = renderTableSvgLineSlice(layout, 2)!;
    expect(bodySvg).toContain('Row 1');
  });

  it('bridges the separator for a short docs-style header row', () => {
    const md = '| Section Header | Detailed Placeholder Content |\n| --- | --- |\n| Row 1 | x |';
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    const layout = buildTableLayout(tableBlocks[0], { ...metrics, capToSourceLines: false });
    expect(layout.rowHeights[0]).toBe(HEADER_SOURCE_LINES * metrics.lineHeight);
    const bridge = renderTableSvgLineSlice(layout, 1);
    expect(bridge).not.toBeNull();
    expect(bridge).toContain(layout.metrics.colors.headerBackground);
  });
});
