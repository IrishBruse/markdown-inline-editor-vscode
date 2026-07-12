import { MarkdownParser } from '../../parser';
import type { TableBlock } from '../../parser/types';
import { getResponsiveTableOffsetRanges } from '../table-responsive';
import {
  buildGridRowPayload,
  layoutWrappedGridRow,
  renderGridLinesSvg,
} from '../../tables/responsive-svg';
import { computeViewportColumnWidths } from '../../tables/responsive-layout';

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

  it('layoutWrappedGridRow renders wrapped rows with pipes', () => {
    const tableBlocks = parseLongCellTable();
    const headerLines = layoutWrappedGridRow(tableBlocks[0], 0, 80);
    const dataLines = layoutWrappedGridRow(tableBlocks[0], 2, 80);

    expect(headerLines[0]).toContain('Section Header');
    expect(headerLines[0]).toContain('\u2502');
    expect(dataLines.length).toBeGreaterThan(1);
    expect(dataLines[0]).toContain('Row 1');
    expect(dataLines[0]).toContain('\u2502');
    expect(dataLines.some((line) => line.includes('Lorem'))).toBe(true);
  });

  it('renderGridLinesSvg renders wrapped rows with pipes and dividers', () => {
    const tableBlocks = parseLongCellTable();
    const table = tableBlocks[0];
    const colWidths = computeViewportColumnWidths(table.colWidths, 80);
    const headerLines = layoutWrappedGridRow(table, 0, 80);
    const dataLines = layoutWrappedGridRow(table, 2, 80);
    const headerSvg = renderGridLinesSvg(headerLines, {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      contentWidthPx: 640,
      isHeader: true,
      showBottomDivider: true,
      colWidths,
      theme: {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    });
    const dataSvg = renderGridLinesSvg(dataLines, {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      contentWidthPx: 640,
      isHeader: false,
      showBottomDivider: true,
      colWidths,
      theme: {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    });

    expect(headerSvg).toContain('<line');
    expect(headerSvg).toContain('Section Header');
    expect(headerSvg).toContain('\u2502');
    expect(dataSvg).toContain('Row 1');
    expect(dataSvg).toContain('\u2502');
    expect(dataSvg).toContain('<line');
  });

  it('buildGridRowPayload produces grid svg for each row', () => {
    const tableBlocks = parseLongCellTable();
    const { payload } = buildGridRowPayload(
      tableBlocks[0],
      2,
      80,
      640,
      'monospace',
      14,
      20,
      {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    );

    expect(payload.dataUri).toMatch(/^data:image\/svg\+xml/);
    expect(payload.widthPx).toBe(640);
    expect(payload.heightPx).toBeGreaterThan(20);
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
