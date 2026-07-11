import type { DecorationRange, TableBlock } from '../parser/types';
import {
  buildResponsiveDataRow,
  buildResponsiveHeaderLine,
  buildResponsiveSeparatorLine,
  shouldUseResponsiveLayout,
} from '../tables/responsive-layout';

export function buildResponsiveTableDecorations(
  tableBlocks: TableBlock[],
  activeTableOffsets: { startPos: number; endPos: number }[],
): DecorationRange[] {
  const decorations: DecorationRange[] = [];

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const tableIsActive = activeTableOffsets.some((active) =>
      active.startPos <= table.endPos && active.endPos >= table.startPos,
    );
    if (tableIsActive) {
      continue;
    }

    for (let rowIdx = 0; rowIdx < table.rowRanges.length; rowIdx++) {
      const rowRange = table.rowRanges[rowIdx];
      let replacement: string;

      if (rowIdx === 0) {
        replacement = buildResponsiveHeaderLine(table.headers);
      } else if (rowIdx === 1) {
        replacement = buildResponsiveSeparatorLine();
      } else {
        const dataRow = table.rows[rowIdx - 2];
        if (!dataRow) {
          continue;
        }
        replacement = buildResponsiveDataRow(dataRow.cells, table.headers);
      }

      decorations.push({
        startPos: rowRange.startPos,
        endPos: rowRange.endPos,
        type: 'tableResponsiveRow',
        replacement,
      });
    }
  }

  return decorations;
}

export function getResponsiveTableOffsetRanges(
  tableBlocks: TableBlock[],
  activeTableOffsets: { startPos: number; endPos: number }[],
): { startPos: number; endPos: number }[] {
  const ranges: { startPos: number; endPos: number }[] = [];

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const tableIsActive = activeTableOffsets.some((active) =>
      active.startPos <= table.endPos && active.endPos >= table.startPos,
    );
    if (tableIsActive) {
      continue;
    }

    ranges.push({ startPos: table.startPos, endPos: table.endPos });
  }

  return ranges;
}
