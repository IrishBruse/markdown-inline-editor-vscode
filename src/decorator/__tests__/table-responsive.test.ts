import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import { getResponsiveTableOffsetRanges } from '../table-responsive';
import {
  borderlessTableToOverlayText,
  layoutBorderlessTable,
  renderBorderlessTableSvg,
} from '../../tables/responsive-svg';

describe('table-responsive decorations', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  function parseLongCellTable(): TableBlock[] {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    return parser.extractDecorationsWithScopes(md).tableBlocks;
  }

  function parseCompactTable(): TableBlock[] {
    const md = [
      '| LongHeaderOne | LongHeaderTwo | LongHeaderThree |',
      '|----------------|-----------------|-----------------|',
      '| alpha value  | beta value      | gamma value     |',
    ].join('\n');
    return parser.extractDecorationsWithScopes(md).tableBlocks;
  }

  it('layoutBorderlessTable renders wrapped rows without pipes', () => {
    const tableBlocks = parseLongCellTable();
    const layout = layoutBorderlessTable(tableBlocks[0], 80);
    const overlay = borderlessTableToOverlayText(layout);

    expect(layout.rows).toHaveLength(2);
    expect(layout.rows[1].lineCount).toBeGreaterThan(1);
    expect(overlay).toContain('Row 1');
    expect(overlay).toContain('Lorem');
    expect(overlay).not.toContain('\u2502');
  });

  it('renderBorderlessTableSvg stacks rows with horizontal dividers', () => {
    const tableBlocks = parseLongCellTable();
    const layout = layoutBorderlessTable(tableBlocks[0], 80);
    const svg = renderBorderlessTableSvg(layout, {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      contentWidthPx: 640,
      theme: {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    });

    expect(svg).toContain('<line');
    expect(svg).toContain('Section Header');
    expect(svg).toContain('Row 1');
    expect(svg).not.toContain('\u2502');
  });

  it('getResponsiveTableOffsetRanges returns table spans for long-cell tables', () => {
    const tableBlocks = parseLongCellTable();
    const ranges = getResponsiveTableOffsetRanges(tableBlocks);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      startPos: tableBlocks[0].startPos,
      endPos: tableBlocks[0].endPos,
    });
  });

  it('getResponsiveTableOffsetRanges returns empty for compact tables', () => {
    const tableBlocks = parseCompactTable();
    const ranges = getResponsiveTableOffsetRanges(tableBlocks);

    expect(ranges).toHaveLength(0);
  });
});
