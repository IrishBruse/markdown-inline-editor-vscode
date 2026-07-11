import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import { getResponsiveTableOffsetRanges } from '../table-responsive';
import {
  buildCoveredLines,
  getClipLineCount,
  layoutWrappedGridRow,
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

  it('layoutWrappedGridRow renders both columns in a pipe grid', () => {
    const tableBlocks = parseLongCellTable();
    const lines = layoutWrappedGridRow(tableBlocks[0], 2, 80);

    expect(lines[0]).toContain('Row 1');
    expect(lines.some((line) => line.includes('Lorem'))).toBe(true);
    expect(lines.every((line) => line.includes('\u2502'))).toBe(true);
  });

  it('buildCoveredLines marks continuation source lines as covered', () => {
    const covered = buildCoveredLines([10, 12], [3, 1]);
    expect(covered.has(11)).toBe(true);
    expect(covered.has(12)).toBe(true);
    expect(covered.has(13)).toBe(false);
  });

  it('getClipLineCount shortens wrap span before an active line', () => {
    const activeLines = new Set([12]);
    expect(getClipLineCount(10, 4, activeLines)).toBe(2);
    expect(getClipLineCount(10, 4, new Set())).toBe(4);
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
