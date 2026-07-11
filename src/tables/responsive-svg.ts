import type { TableBlock } from '../parser/types';
import { measureTextWidth } from '../parser/tables';
import {
  BORDERLESS_COLUMN_GAP,
  computeBorderlessColumnWidths,
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

export interface BorderlessRowLayout {
  columns: string[][];
  colWidths: number[];
  isHeader: boolean;
  isSeparatorOnly: boolean;
  lineCount: number;
  showBottomDivider: boolean;
}

const NBSP = '\u00A0';
const PIPE = '\u2502';
const MIN_FALLBACK_COL_WIDTH = 3;
const CHAR_WIDTH_RATIO = 0.6;
const ROW_PADDING_RATIO = 0.75;

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

function buildWrappedGridLines(
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

function buildBorderlessColumns(
  cellTexts: string[],
  colWidths: number[],
): string[][] {
  return cellTexts.map((text, index) => {
    const colWidth = index < colWidths.length ? colWidths[index] : MIN_FALLBACK_COL_WIDTH;
    return wrapCellLines(text, colWidth);
  });
}

function capBorderlessColumns(
  columns: string[][],
  maxLines: number,
): string[][] {
  return columns.map((col) => capWrapLines(col, maxLines));
}

export function capWrapLines(lines: string[], maxLines: number): string[] {
  if (maxLines <= 0) {
    return [];
  }
  return lines.slice(0, maxLines);
}

export interface BorderlessTableLayout {
  rows: BorderlessRowLayout[];
  colWidths: number[];
}

function rowLineCount(columns: string[][]): number {
  if (columns.length === 0) {
    return 0;
  }
  return Math.max(1, ...columns.map((col) => col.length));
}

export function layoutBorderlessTable(
  table: TableBlock,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): BorderlessTableLayout {
  const colWidths = computeBorderlessColumnWidths(table.colWidths, viewportColumns);
  const rows: BorderlessRowLayout[] = [];

  const headerColumns = buildBorderlessColumns(table.headers, colWidths);
  rows.push({
    columns: headerColumns,
    colWidths,
    isHeader: true,
    isSeparatorOnly: false,
    lineCount: rowLineCount(headerColumns),
    showBottomDivider: true,
  });

  for (const dataRow of table.rows) {
    const columns = buildBorderlessColumns(
      dataRow.cells.map((cell) => cell.displayText),
      colWidths,
    );
    rows.push({
      columns,
      colWidths,
      isHeader: false,
      isSeparatorOnly: false,
      lineCount: rowLineCount(columns),
      showBottomDivider: true,
    });
  }

  return { rows, colWidths };
}

export function borderlessTableToOverlayText(layout: BorderlessTableLayout): string {
  return layout.rows
    .map((row) => borderlessRowToOverlayText(row))
    .filter((text) => text.length > 0)
    .join('\n');
}

function measureBorderlessRowHeight(
  layout: BorderlessRowLayout,
  lineHeight: number,
): number {
  if (layout.isSeparatorOnly || layout.lineCount === 0) {
    return 1;
  }
  const rowPadding = Math.round(lineHeight * ROW_PADDING_RATIO);
  const contentHeight = layout.lineCount * lineHeight;
  const dividerHeight = layout.showBottomDivider ? 1 : 0;
  return rowPadding * 2 + contentHeight + dividerHeight;
}

export function renderBorderlessTableSvg(
  tableLayout: BorderlessTableLayout,
  options: ResponsiveTableSvgOptions,
): string {
  const charWidth = options.fontSize * CHAR_WIDTH_RATIO;
  const widthPx = options.contentWidthPx;
  const rowPadding = Math.round(options.lineHeight * ROW_PADDING_RATIO);
  const xPositions = columnXPositions(tableLayout.colWidths, charWidth);
  const textElements: string[] = [];
  const dividerElements: string[] = [];
  let yOffset = 0;

  for (const row of tableLayout.rows) {
    if (row.isSeparatorOnly || row.lineCount === 0) {
      continue;
    }

    const rowHeight = measureBorderlessRowHeight(row, options.lineHeight);

    for (let lineIdx = 0; lineIdx < row.lineCount; lineIdx++) {
      const y = yOffset + rowPadding + Math.round((lineIdx + 1) * options.lineHeight * 0.8);
      for (let colIdx = 0; colIdx < row.columns.length; colIdx++) {
        const colLines = row.columns[colIdx];
        if (lineIdx >= colLines.length) {
          continue;
        }
        const text = colLines[lineIdx];
        if (text.length === 0) {
          continue;
        }
        const fill = row.isHeader
          ? options.theme.foreground
          : options.theme.mutedForeground;
        textElements.push(
          `<text x="${xPositions[colIdx]}" y="${y}" fill="${fill}" clip-path="url(#clip)" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px"${row.isHeader ? ' font-weight="600"' : ''}>${escapeSvgText(text)}</text>`,
        );
      }
    }

    if (row.showBottomDivider) {
      const dividerY = yOffset + rowHeight - 0.5;
      dividerElements.push(
        `<line x1="0" y1="${dividerY}" x2="${widthPx}" y2="${dividerY}" stroke="${options.theme.separator}" stroke-width="1"/>`,
      );
    }

    yOffset += rowHeight;
  }

  const heightPx = Math.max(1, yOffset);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" style="overflow:hidden">`,
    '<defs><clipPath id="clip"><rect width="100%" height="100%"/></clipPath></defs>',
    '<rect width="100%" height="100%" fill="transparent"/>',
    ...textElements,
    ...dividerElements,
    '</svg>',
  ].join('');
}

export function layoutBorderlessRow(
  table: TableBlock,
  rowIdx: number,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
  maxWrapLines?: number,
): BorderlessRowLayout {
  const colWidths = computeBorderlessColumnWidths(table.colWidths, viewportColumns);

  if (rowIdx === 1) {
    return {
      columns: colWidths.map(() => ['']),
      colWidths,
      isHeader: false,
      isSeparatorOnly: true,
      lineCount: 1,
      showBottomDivider: false,
    };
  }

  let columns: string[][];
  let isHeader = false;
  let showBottomDivider = true;

  if (rowIdx === 0) {
    columns = buildBorderlessColumns(table.headers, colWidths);
    isHeader = true;
  } else {
    const dataRow = table.rows[rowIdx - 2];
    if (!dataRow) {
      return {
        columns: [],
        colWidths,
        isHeader: false,
        isSeparatorOnly: false,
        lineCount: 0,
        showBottomDivider: false,
      };
    }
    columns = buildBorderlessColumns(
      dataRow.cells.map((cell) => cell.displayText),
      colWidths,
    );
  }

  if (maxWrapLines !== undefined) {
    columns = capBorderlessColumns(columns, maxWrapLines);
  }

  const lineCount = Math.max(1, ...columns.map((col) => col.length));

  return {
    columns,
    colWidths,
    isHeader,
    isSeparatorOnly: false,
    lineCount,
    showBottomDivider,
  };
}

export function borderlessRowToOverlayText(layout: BorderlessRowLayout): string {
  if (layout.isSeparatorOnly || layout.lineCount === 0) {
    return '';
  }
  const gap = ' '.repeat(BORDERLESS_COLUMN_GAP);
  const lines: string[] = [];
  for (let lineIdx = 0; lineIdx < layout.lineCount; lineIdx++) {
    const parts = layout.columns.map((col) =>
      lineIdx < col.length ? col[lineIdx] : '',
    );
    lines.push(parts.join(gap));
  }
  return lines.join('\n');
}

export function clipBorderlessLayout(
  layout: BorderlessRowLayout,
  clipCount: number,
): BorderlessRowLayout {
  const columns = layout.columns.map((col) => col.slice(0, clipCount));
  const lineCount = layout.lineCount === 0
    ? 0
    : Math.max(1, ...columns.map((col) => col.length));
  return { ...layout, columns, lineCount };
}

export function layoutWrappedGridRow(
  table: TableBlock,
  rowIdx: number,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
  maxWrapLines?: number,
): string[] {
  const colWidths = computeViewportColumnWidths(table.colWidths, viewportColumns);
  let lines: string[];

  if (rowIdx === 0) {
    lines = buildWrappedGridLines(table.headers, colWidths, table.colAligns);
  } else if (rowIdx === 1) {
    lines = [formatSeparatorGridLine(colWidths)];
  } else {
    const dataRow = table.rows[rowIdx - 2];
    if (!dataRow) {
      return [];
    }
    lines = buildWrappedGridLines(
      dataRow.cells.map((cell) => cell.displayText),
      colWidths,
      table.colAligns,
    );
  }

  if (maxWrapLines !== undefined) {
    return capWrapLines(lines, maxWrapLines);
  }
  return lines;
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

function columnXPositions(colWidths: number[], charWidth: number): number[] {
  const gapPx = BORDERLESS_COLUMN_GAP * charWidth;
  const positions: number[] = [];
  let x = 0;
  for (let i = 0; i < colWidths.length; i++) {
    positions.push(x);
    x += colWidths[i] * charWidth + gapPx;
  }
  return positions;
}

export function renderResponsiveRowSvg(
  layout: BorderlessRowLayout,
  options: ResponsiveTableSvgOptions,
): string {
  const charWidth = options.fontSize * CHAR_WIDTH_RATIO;
  const widthPx = options.contentWidthPx;

  if (layout.isSeparatorOnly) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="1" viewBox="0 0 ${widthPx} 1" style="overflow:hidden">`,
      '<rect width="100%" height="100%" fill="transparent"/>',
      '</svg>',
    ].join('');
  }

  if (layout.lineCount === 0) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="1" viewBox="0 0 ${widthPx} 1" style="overflow:hidden">`,
      '<rect width="100%" height="100%" fill="transparent"/>',
      '</svg>',
    ].join('');
  }

  const rowPadding = Math.round(options.lineHeight * ROW_PADDING_RATIO);
  const contentHeight = layout.lineCount * options.lineHeight;
  const dividerHeight = layout.showBottomDivider ? 1 : 0;
  const heightPx = rowPadding * 2 + contentHeight + dividerHeight;
  const xPositions = columnXPositions(layout.colWidths, charWidth);
  const textElements: string[] = [];

  for (let lineIdx = 0; lineIdx < layout.lineCount; lineIdx++) {
    const y = rowPadding + Math.round((lineIdx + 1) * options.lineHeight * 0.8);
    for (let colIdx = 0; colIdx < layout.columns.length; colIdx++) {
      const colLines = layout.columns[colIdx];
      if (lineIdx >= colLines.length) {
        continue;
      }
      const text = colLines[lineIdx];
      if (text.length === 0) {
        continue;
      }
      const fill = layout.isHeader
        ? options.theme.foreground
        : options.theme.mutedForeground;
      textElements.push(
        `<text x="${xPositions[colIdx]}" y="${y}" fill="${fill}" clip-path="url(#clip)" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(text)}</text>`,
      );
    }
  }

  const dividerElements: string[] = [];
  if (layout.showBottomDivider) {
    const dividerY = heightPx - 0.5;
    dividerElements.push(
      `<line x1="0" y1="${dividerY}" x2="${widthPx}" y2="${dividerY}" stroke="${options.theme.separator}" stroke-width="1"/>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" style="overflow:hidden">`,
    '<defs><clipPath id="clip"><rect width="100%" height="100%"/></clipPath></defs>',
    '<rect width="100%" height="100%" fill="transparent"/>',
    ...textElements,
    ...dividerElements,
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
