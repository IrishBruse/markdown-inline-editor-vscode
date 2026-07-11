import type { TableBlock } from '../parser/types';
import { measureTextWidth } from '../parser/tables';
import {
  computeViewportColumnWidths,
  RESPONSIVE_LAYOUT_WIDTH,
  wrapCellLines,
} from './responsive-layout';

export interface ResponsiveTableTheme {
  foreground: string;
  mutedForeground: string;
  separator: string;
}

export interface ResponsiveTableSvgOptions {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  layoutWidth?: number;
  contentWidthPx: number;
  theme: ResponsiveTableTheme;
}

const NBSP = '\u00A0';
const PIPE = '\u2502';
const MIN_FALLBACK_COL_WIDTH = 3;

function padCell(
  content: string,
  colWidth: number,
  align: null | 'left' | 'center' | 'right',
): string {
  const displayWidth = measureTextWidth(content);
  const totalPad = Math.max(0, colWidth - displayWidth);
  if (align === 'right') {
    return NBSP.repeat(totalPad + 1) + content + NBSP;
  }
  if (align === 'center') {
    const padLeft = Math.floor(totalPad / 2);
    const padRight = totalPad - padLeft;
    return NBSP.repeat(padLeft + 1) + content + NBSP.repeat(padRight + 1);
  }
  return NBSP + content + NBSP.repeat(totalPad + 1);
}

export function formatGridLine(
  cells: string[],
  colWidths: number[],
  colAligns: (null | 'left' | 'center' | 'right')[],
): string {
  const parts = cells.map((cell, index) => {
    const colWidth = index < colWidths.length ? colWidths[index] : MIN_FALLBACK_COL_WIDTH;
    const align = index < colAligns.length ? colAligns[index] : null;
    return padCell(cell, colWidth, align);
  });
  return PIPE + parts.join(PIPE) + PIPE;
}

export function formatSeparatorGridLine(colWidths: number[]): string {
  const segments = colWidths.map((width) => '-'.repeat(width + 2));
  return PIPE + segments.join(PIPE) + PIPE;
}

function buildWrappedRowLines(
  cellTexts: string[],
  colWidths: number[],
  colAligns: (null | 'left' | 'center' | 'right')[],
): string[] {
  const wrappedCells = cellTexts.map((text, index) => {
    const colWidth = index < colWidths.length ? colWidths[index] : MIN_FALLBACK_COL_WIDTH;
    return wrapCellLines(text, colWidth);
  });
  const numLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
  const lines: string[] = [];

  for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
    const cells = wrappedCells.map((cellLines) =>
      lineIdx < cellLines.length ? cellLines[lineIdx] : '',
    );
    lines.push(formatGridLine(cells, colWidths, colAligns));
  }

  return lines;
}

export function layoutWrappedGridRow(
  table: TableBlock,
  rowIdx: number,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): string[] {
  const colWidths = computeViewportColumnWidths(table.colWidths, viewportColumns);

  if (rowIdx === 0) {
    return buildWrappedRowLines(table.headers, colWidths, table.colAligns);
  }
  if (rowIdx === 1) {
    return [formatSeparatorGridLine(colWidths)];
  }

  const dataRow = table.rows[rowIdx - 2];
  if (!dataRow) {
    return [];
  }

  return buildWrappedRowLines(
    dataRow.cells.map((cell) => cell.displayText),
    colWidths,
    table.colAligns,
  );
}

export function layoutWrappedGridTable(
  table: TableBlock,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): string[][] {
  return table.rowRanges.map((_, rowIdx) =>
    layoutWrappedGridRow(table, rowIdx, viewportColumns),
  );
}

/** @deprecated Use layoutWrappedGridRow and join lines when a single string is needed. */
export function layoutResponsiveTableRow(
  table: TableBlock,
  rowIdx: number,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  return layoutWrappedGridRow(table, rowIdx, viewportColumns).join('\n');
}

/** @deprecated Use layoutWrappedGridTable. */
export function layoutResponsiveTable(
  table: TableBlock,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): string[] {
  return layoutWrappedGridTable(table, viewportColumns).map((lines) => lines.join('\n'));
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isGridSeparatorLine(line: string): boolean {
  return line.includes(PIPE) && /-/.test(line) && !/[A-Za-z0-9]/.test(line.replaceAll(PIPE, '').replaceAll('-', '').replaceAll(NBSP, '').replaceAll(' ', ''));
}

export function renderResponsiveRowSvg(
  lines: string[],
  options: ResponsiveTableSvgOptions,
): string {
  if (lines.length === 0) {
    lines = [''];
  }

  const widthPx = options.contentWidthPx;
  const heightPx = lines.length * options.lineHeight;
  const textElements: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const y = Math.round((index + 1) * options.lineHeight * 0.8);
    const fill = isGridSeparatorLine(line)
      ? options.theme.mutedForeground
      : options.theme.foreground;
    textElements.push(
      `<text x="0" y="${y}" fill="${fill}" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(line)}</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">`,
    '<rect width="100%" height="100%" fill="transparent"/>',
    ...textElements,
    '</svg>',
  ].join('');
}

export function getClipLineCount(
  sourceLine: number,
  wrapCount: number,
  activeLines: Set<number>,
): number {
  for (let offset = 1; offset < wrapCount; offset++) {
    if (activeLines.has(sourceLine + offset)) {
      return offset;
    }
  }
  return wrapCount;
}

export function buildCoveredLines(
  sourceLines: number[],
  wrapCounts: number[],
): Set<number> {
  const coveredLines = new Set<number>();
  for (let index = 0; index < sourceLines.length; index++) {
    const wrapCount = wrapCounts[index];
    const sourceLine = sourceLines[index];
    for (let offset = 1; offset < wrapCount; offset++) {
      coveredLines.add(sourceLine + offset);
    }
  }
  return coveredLines;
}
