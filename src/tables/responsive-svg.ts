import type { TableBlock } from '../parser/types';
import { measureTextWidth } from '../parser/tables';
import {
  BORDERLESS_COLUMN_GAP,
  computeBorderlessColumnWidths,
  computeViewportColumnWidths,
  estimateGridWidth,
  RESPONSIVE_LAYOUT_WIDTH,
  wrapCellLines,
} from './responsive-layout';
import { ensureSvgDimensions, svgToDataUri } from '../mermaid/svg-processor';

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
  maxHeightPx?: number;
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
const ROW_PADDING_RATIO = 0.4;

function gridLayoutWidthPx(colWidths: number[], fontSize: number): number {
  const gridWidthChars = estimateGridWidth(colWidths);
  return Math.max(1, Math.round(fontSize * CHAR_WIDTH_RATIO * gridWidthChars));
}

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
  const lastRowIdx = table.rowRanges.length - 1;
  return layoutBorderlessTableSegment(table, 0, lastRowIdx, viewportColumns);
}

export function layoutBorderlessTableSegment(
  table: TableBlock,
  fromRowIdx: number,
  toRowIdx: number,
  viewportColumns: number = RESPONSIVE_LAYOUT_WIDTH,
): BorderlessTableLayout {
  const colWidths = computeBorderlessColumnWidths(table.colWidths, viewportColumns);
  const rows: BorderlessRowLayout[] = [];

  for (let rowIdx = fromRowIdx; rowIdx <= toRowIdx; rowIdx++) {
    if (rowIdx === 1) {
      continue;
    }
    const rowLayout = layoutBorderlessRow(table, rowIdx, viewportColumns, undefined, colWidths);
    if (rowLayout.isSeparatorOnly || rowLayout.lineCount === 0) {
      continue;
    }
    rows.push(rowLayout);
  }

  return { rows, colWidths };
}

export function borderlessTableToOverlayText(layout: BorderlessTableLayout): string {
  return layout.rows
    .map((row) => borderlessRowToOverlayText(row))
    .filter((text) => text.length > 0)
    .join('\n');
}

function getColumnFill(
  row: BorderlessRowLayout,
  colIdx: number,
  theme: ResponsiveTableTheme,
): string {
  if (row.isHeader || colIdx === 0) {
    return theme.foreground;
  }
  return theme.mutedForeground;
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
    if (options.maxHeightPx !== undefined && yOffset + rowHeight > options.maxHeightPx) {
      break;
    }

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
        const fill = getColumnFill(row, colIdx, options.theme);
        textElements.push(
          `<text x="${xPositions[colIdx]}" y="${y}" fill="${fill}" clip-path="url(#clip)" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(text)}</text>`,
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
  colWidths?: number[],
): BorderlessRowLayout {
  const widths = colWidths ?? computeBorderlessColumnWidths(table.colWidths, viewportColumns);

  if (rowIdx === 1) {
    return {
      columns: widths.map(() => []),
      colWidths: widths,
      isHeader: false,
      isSeparatorOnly: true,
      lineCount: 0,
      showBottomDivider: false,
    };
  }

  let columns: string[][];
  let isHeader = false;
  let showBottomDivider = true;

  if (rowIdx === 0) {
    columns = buildBorderlessColumns(table.headers, widths);
    isHeader = true;
  } else {
    const dataRow = table.rows[rowIdx - 2];
    if (!dataRow) {
      return {
        columns: [],
        colWidths: widths,
        isHeader: false,
        isSeparatorOnly: false,
        lineCount: 0,
        showBottomDivider: false,
      };
    }
    columns = buildBorderlessColumns(
      dataRow.cells.map((cell) => cell.displayText),
      widths,
    );
  }

  if (maxWrapLines !== undefined) {
    columns = capBorderlessColumns(columns, maxWrapLines);
  }

  const lineCount = Math.max(1, ...columns.map((col) => col.length));

  return {
    columns,
    colWidths: widths,
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

export interface GridLinesSvgOptions extends ResponsiveTableSvgOptions {
  isHeader: boolean;
  showBottomDivider: boolean;
  colWidths: number[];
  compact?: boolean;
}

function gridPipeCharPositions(colWidths: number[]): number[] {
  const pipes = [0];
  let charIdx = 1;
  for (const width of colWidths) {
    charIdx += width + 2;
    pipes.push(charIdx);
  }
  return pipes;
}

function parseGridLineCells(line: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== PIPE) {
      index++;
      continue;
    }
    index++;
    const start = index;
    while (index < line.length && line[index] !== PIPE) {
      index++;
    }
    cells.push(line.slice(start, index));
  }
  return cells;
}

function getGridCellFill(
  colIdx: number,
  isHeader: boolean,
  theme: ResponsiveTableTheme,
): string {
  if (isHeader || colIdx === 0) {
    return theme.foreground;
  }
  return theme.mutedForeground;
}

function measureGridRowHeight(
  gridLines: string[],
  lineHeight: number,
  showBottomDivider: boolean,
  compact: boolean,
): number {
  const lineCount = Math.max(1, gridLines.length);
  if (compact) {
    return lineCount * lineHeight + (showBottomDivider ? 1 : 0);
  }
  const rowPadding = Math.round(lineHeight * ROW_PADDING_RATIO);
  return rowPadding * 2 + lineCount * lineHeight + (showBottomDivider ? 1 : 0);
}

function appendGridLinesToSvg(
  gridLines: string[],
  options: GridLinesSvgOptions,
  yOffset: number,
  textElements: string[],
  dividerElements: string[],
): number {
  const charWidth = options.fontSize * CHAR_WIDTH_RATIO;
  const widthPx = options.contentWidthPx;
  const rowPadding = options.compact
    ? 0
    : Math.round(options.lineHeight * ROW_PADDING_RATIO);
  const lineCount = Math.max(1, gridLines.length);
  const rowHeight = measureGridRowHeight(
    gridLines,
    options.lineHeight,
    options.showBottomDivider,
    options.compact ?? false,
  );
  const pipePositions = gridPipeCharPositions(options.colWidths);

  for (let lineIdx = 0; lineIdx < gridLines.length; lineIdx++) {
    const y = yOffset + rowPadding + Math.round((lineIdx + 1) * options.lineHeight * 0.8);
    const gridLine = gridLines[lineIdx];
    const cells = parseGridLineCells(gridLine);

    for (const pipeCharIdx of pipePositions) {
      if (pipeCharIdx >= gridLine.length || gridLine[pipeCharIdx] !== PIPE) {
        continue;
      }
      textElements.push(
        `<text x="${pipeCharIdx * charWidth}" y="${y}" fill="${options.theme.foreground}" clip-path="url(#clip)" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${PIPE}</text>`,
      );
    }

    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      const cellText = cells[colIdx];
      if (cellText.length === 0) {
        continue;
      }
      const x = (pipePositions[colIdx] + 1) * charWidth;
      const fill = getGridCellFill(colIdx, options.isHeader, options.theme);
      textElements.push(
        `<text x="${x}" y="${y}" fill="${fill}" clip-path="url(#clip)" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(cellText)}</text>`,
      );
    }
  }

  if (options.showBottomDivider) {
    const dividerY = yOffset + rowHeight - 0.5;
    dividerElements.push(
      `<line x1="0" y1="${dividerY}" x2="${widthPx}" y2="${dividerY}" stroke="${options.theme.separator}" stroke-width="1"/>`,
    );
  }

  return rowHeight;
}

export function renderGridLinesSvg(
  gridLines: string[],
  options: GridLinesSvgOptions,
): string {
  const textElements: string[] = [];
  const dividerElements: string[] = [];
  appendGridLinesToSvg(gridLines, options, 0, textElements, dividerElements);
  const heightPx = measureGridRowHeight(
    gridLines,
    options.lineHeight,
    options.showBottomDivider,
    options.compact ?? false,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.contentWidthPx}" height="${heightPx}" viewBox="0 0 ${options.contentWidthPx} ${heightPx}" style="overflow:hidden">`,
    '<defs><clipPath id="clip"><rect width="100%" height="100%"/></clipPath></defs>',
    '<rect width="100%" height="100%" fill="transparent"/>',
    ...textElements,
    ...dividerElements,
    '</svg>',
  ].join('');
}

export interface BuildGridRowPayloadOptions {
  colWidths?: number[];
  maxWrapLines?: number;
}

export function buildGridRowPayload(
  table: TableBlock,
  rowIdx: number,
  layoutWidth: number,
  _contentWidthPx: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: ResponsiveTableTheme,
  payloadOptions?: BuildGridRowPayloadOptions,
): { layoutKey: string; payload: { dataUri: string; widthPx: number; heightPx: number } } {
  const colWidths = payloadOptions?.colWidths
    ?? computeViewportColumnWidths(table.colWidths, layoutWidth);
  const gridLines = layoutWrappedGridRow(
    table,
    rowIdx,
    layoutWidth,
    payloadOptions?.maxWrapLines,
  );
  const renderWidthPx = gridLayoutWidthPx(colWidths, fontSize);
  const isHeader = rowIdx === 0;
  const showBottomDivider = rowIdx !== 1;
  let svg = renderGridLinesSvg(gridLines, {
    fontFamily,
    fontSize,
    lineHeight,
    contentWidthPx: renderWidthPx,
    layoutWidth,
    theme,
    isHeader,
    showBottomDivider,
    colWidths,
    compact: rowIdx === 1,
  });
  const heightPx = Math.ceil(
    parseFloat(svg.match(/\bheight="(\d+(?:\.\d+)?)(?:px)?"/)?.[1] ?? '1'),
  );
  svg = ensureSvgDimensions(svg, renderWidthPx, heightPx);
  return {
    layoutKey: gridLines.join('\n'),
    payload: {
      dataUri: svgToDataUri(svg),
      widthPx: renderWidthPx,
      heightPx,
    },
  };
}

export function buildGridTableSegmentPayload(
  table: TableBlock,
  fromRowIdx: number,
  toRowIdx: number,
  layoutWidth: number,
  _contentWidthPx: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: ResponsiveTableTheme,
  maxHeightPx?: number,
): { layoutKey: string; payload: { dataUri: string; widthPx: number; heightPx: number } } {
  const colWidths = computeViewportColumnWidths(table.colWidths, layoutWidth);
  const renderWidthPx = gridLayoutWidthPx(colWidths, fontSize);
  const textElements: string[] = [];
  const dividerElements: string[] = [];
  const layoutKeyParts: string[] = [];
  let yOffset = 0;

  for (let rowIdx = fromRowIdx; rowIdx <= toRowIdx; rowIdx++) {
    const gridLines = layoutWrappedGridRow(table, rowIdx, layoutWidth);
    const isHeader = rowIdx === 0;
    const isSeparator = rowIdx === 1;
    const showBottomDivider = !isSeparator;
    const rowHeight = measureGridRowHeight(
      gridLines,
      lineHeight,
      showBottomDivider,
      isSeparator,
    );
    if (maxHeightPx !== undefined && yOffset + rowHeight > maxHeightPx) {
      break;
    }

    appendGridLinesToSvg(
      gridLines,
      {
        fontFamily,
        fontSize,
        lineHeight,
        contentWidthPx: renderWidthPx,
        layoutWidth,
        theme,
        isHeader,
        showBottomDivider,
        colWidths,
        compact: isSeparator,
      },
      yOffset,
      textElements,
      dividerElements,
    );
    layoutKeyParts.push(...gridLines);
    yOffset += rowHeight;
  }

  const heightPx = Math.max(1, yOffset);
  let svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidthPx}" height="${heightPx}" viewBox="0 0 ${renderWidthPx} ${heightPx}" style="overflow:hidden">`,
    '<defs><clipPath id="clip"><rect width="100%" height="100%"/></clipPath></defs>',
    '<rect width="100%" height="100%" fill="transparent"/>',
    ...textElements,
    ...dividerElements,
    '</svg>',
  ].join('');
  svg = ensureSvgDimensions(svg, renderWidthPx, heightPx);

  return {
    layoutKey: layoutKeyParts.join('\n'),
    payload: {
      dataUri: svgToDataUri(svg),
      widthPx: renderWidthPx,
      heightPx,
    },
  };
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
      const fill = getColumnFill(layout, colIdx, options.theme);
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
