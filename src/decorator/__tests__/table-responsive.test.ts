import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import {
  buildResponsiveTableDecorations,
  getResponsiveTableOffsetRanges,
} from '../table-responsive';

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

  it('buildResponsiveTableDecorations emits tableResponsiveRow for long-cell tables', () => {
    const tableBlocks = parseLongCellTable();
    const decorations = buildResponsiveTableDecorations(tableBlocks, []);

    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations.every((d) => d.type === 'tableResponsiveRow')).toBe(true);
    expect(decorations[0].replacement).toBeDefined();
    expect(decorations.some((d) => d.replacement?.includes('Section Header:'))).toBe(true);
  });

  it('skips responsive decorations for compact tables', () => {
    const tableBlocks = parseCompactTable();
    const decorations = buildResponsiveTableDecorations(tableBlocks, []);

    expect(decorations).toHaveLength(0);
  });

  it('skips responsive decorations for active tables', () => {
    const tableBlocks = parseLongCellTable();
    const table = tableBlocks[0];
    const activeTableOffsets = [{ startPos: table.startPos, endPos: table.endPos }];

    const decorations = buildResponsiveTableDecorations(tableBlocks, activeTableOffsets);
    expect(decorations).toHaveLength(0);
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

  it('getResponsiveTableOffsetRanges returns empty for active tables', () => {
    const tableBlocks = parseLongCellTable();
    const table = tableBlocks[0];
    const activeTableOffsets = [{ startPos: table.startPos, endPos: table.endPos }];

    const ranges = getResponsiveTableOffsetRanges(tableBlocks, activeTableOffsets);
    expect(ranges).toHaveLength(0);
  });
});
