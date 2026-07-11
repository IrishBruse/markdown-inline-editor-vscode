import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import { getResponsiveTableOffsetRanges } from '../table-responsive';
import { layoutResponsiveTable } from '../../tables/responsive-svg';

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

  it('layoutResponsiveTable includes every column for long-cell tables', () => {
    const tableBlocks = parseLongCellTable();
    const lines = layoutResponsiveTable(tableBlocks[0]);

    expect(lines.some((line) => line.includes('Section Header: Row 1'))).toBe(true);
    expect(lines.some((line) => line.includes('Detailed Placeholder Content:'))).toBe(true);
    expect(lines.some((line) => line.includes('Lorem ipsum'))).toBe(true);
  });

  it('getResponsiveTableOffsetRanges returns table spans for long-cell tables', () => {
    const tableBlocks = parseLongCellTable();
    const ranges = getResponsiveTableOffsetRanges(tableBlocks, []);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      startPos: tableBlocks[0].startPos,
      endPos: tableBlocks[0].endPos,
    });
  });

  it('getResponsiveTableOffsetRanges returns empty for compact tables', () => {
    const tableBlocks = parseCompactTable();
    const ranges = getResponsiveTableOffsetRanges(tableBlocks, []);

    expect(ranges).toHaveLength(0);
  });

  it('getResponsiveTableOffsetRanges returns empty for active tables', () => {
    const tableBlocks = parseLongCellTable();
    const table = tableBlocks[0];
    const activeTableOffsets = [{ startPos: table.startPos, endPos: table.endPos }];

    const ranges = getResponsiveTableOffsetRanges(tableBlocks, activeTableOffsets);
    expect(ranges).toHaveLength(0);
  });
});
