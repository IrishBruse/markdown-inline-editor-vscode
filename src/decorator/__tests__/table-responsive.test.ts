import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import { getResponsiveTableOffsetRanges } from '../table-responsive';
import { layoutResponsiveTableRow } from '../../tables/responsive-svg';

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

  it('layoutResponsiveTableRow includes both columns on one line', () => {
    const tableBlocks = parseLongCellTable();
    const line = layoutResponsiveTableRow(tableBlocks[0], 2);

    expect(line).toContain('Section Header: Row 1');
    expect(line).toContain('Detailed Placeholder Content:');
    expect(line).toContain('...');
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

  it('getResponsiveTableOffsetRanges still suppresses grid when table is active', () => {
    const tableBlocks = parseLongCellTable();
    const ranges = getResponsiveTableOffsetRanges(tableBlocks);

    expect(ranges).toHaveLength(1);
  });
});
