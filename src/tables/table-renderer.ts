import * as os from 'os';
import { workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { measureTextWidth } from '../parser/tables';
import { ensureSvgDimensions } from '../mermaid/svg-processor';
import { resolveTableColors, type TableColors } from './table-colors';
import {
  dataRowLayoutIndexForSourceLine,
  headerBandHeightPx,
  headerSliceAllowsDecorationOverflow,
  headerSourceLineToSliceSpec,
  HEADER_SOURCE_LINES,
  mergedHeaderLabelBaselineY,
  mergedHeaderOverlayBandPx,
  mergedHeaderPrepareConstraints,
  overlayBandFillForSlice,
  renderHeaderSeparatorBridge as renderHeaderSeparatorBridgeSlice,
  resolveHeaderOverlayBandHeight,
} from './table-header-renderer';
import type {
  TableLayout,
  TableLayoutMetrics,
  TableLineSliceSpec,
  TableRowLayout,
} from './table-layout-types';

export type {
  TableLayout,
  TableLayoutMetrics,
  TableLineSliceSpec,
} from './table-layout-types';

export {
  HEADER_SOURCE_LINES,
  mergedHeaderBandBudgetPx,
  mergedHeaderOverlayBandPx,
} from './table-header-renderer';

export type TableRenderOptions = {
  isDark: boolean;
  /** When omitted, resolved from extension settings and workbench.colorCustomizations. */
  colors?: TableColors;
  fontFamily?: string;
  /** Editor line height in px; defaults from workspace settings. */
  lineHeight?: number;
  /** Editor font size in px; defaults from workspace settings. */
  fontSize?: number;
  /** When true, row bands fit source line count (per-line overlay mode). */
  capToSourceLines?: boolean;
};

const BORDER_WIDTH = 1;

/** Source lines that receive a per-line SVG overlay (title, separator bridge, and data rows). */
export function countTableOverlaySourceLines(numLines: number): number {
  return Math.max(0, numLines);
}

/** Cap column width so very wide cells do not produce oversized overlays. */
const MAX_COL_WIDTH = 400;

/** Max wrapped lines shown per overlay band (limits overlap on following source lines). */
export const MAX_BAND_LINES = 5;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Match mermaid / math decoration line-height resolution. */
export function getEditorLineMetrics(): { lineHeight: number; fontSize: number } {
  const editorConfig = workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeightSetting = editorConfig.get<number>('lineHeight', 0);
  let lineHeight: number;

  if (lineHeightSetting === 0 || lineHeightSetting < 8) {
    const multiplier = os.platform() === 'darwin' ? 1.5 : 1.35;
    lineHeight = Math.round(fontSize * multiplier);
    if (lineHeight < 8) {
      lineHeight = 8;
    }
  } else if (lineHeightSetting >= 10) {
    lineHeight = Math.round(lineHeightSetting);
  } else {
    lineHeight = Math.round(fontSize * lineHeightSetting);
  }

  return { lineHeight, fontSize };
}

function resolveTableMetrics(options: TableRenderOptions): TableLayoutMetrics {
  const editorMetrics = getEditorLineMetrics();
  const lineHeight = options.lineHeight ?? editorMetrics.lineHeight;
  const fontSize = Math.min(options.fontSize ?? editorMetrics.fontSize, lineHeight - 2);
  const charWidth = fontSize * 0.6;
  const cellPadX = Math.max(4, Math.round(fontSize * 0.35));
  const cellPadY = Math.max(2, Math.round(fontSize * 0.25));
  const minColWidth = Math.max(24, Math.round(fontSize * 3.5));
  const colors = options.colors ?? resolveTableColors(options.isDark);
  const fontFamily = options.fontFamily
    ? `${escapeXml(options.fontFamily)}, sans-serif`
    : 'var(--vscode-editor-font-family, monospace), monospace';

  return {
    lineHeight,
    fontSize,
    charWidth,
    cellPadX,
    cellPadY,
    minColWidth,
    fontFamily,
    colors,
  };
}

function maxTextUnits(colWidth: number, charWidth: number, cellPadX: number): number {
  const maxTextPx = colWidth - cellPadX * 2;
  if (maxTextPx <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(maxTextPx / charWidth));
}

function breakLongSegment(segment: string, maxUnits: number): string[] {
  const parts: string[] = [];
  let current = '';

  for (const char of segment) {
    const next = current + char;
    if (measureTextWidth(next) > maxUnits && current.length > 0) {
      parts.push(current);
      current = char;
      continue;
    }
    current = next;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : [''];
}

/** Break plain text into lines that fit within {@link maxUnits} monospace width. */
export function wrapText(text: string, maxUnits: number): string[] {
  if (maxUnits <= 0) {
    return [''];
  }
  if (text.length === 0) {
    return [''];
  }
  if (measureTextWidth(text) <= maxUnits) {
    return [text];
  }

  const lines: string[] = [];
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }

  let currentLine = '';

  const pushLine = (line: string) => {
    if (line.length > 0) {
      lines.push(line);
    }
  };

  for (const word of words) {
    const segments = measureTextWidth(word) > maxUnits
      ? breakLongSegment(word, maxUnits)
      : [word];

    for (const segment of segments) {
      const candidate = currentLine ? `${currentLine} ${segment}` : segment;
      if (measureTextWidth(candidate) <= maxUnits) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        pushLine(currentLine);
      }
      currentLine = segment;
    }
  }

  if (currentLine) {
    pushLine(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function cellPixelWidth(text: string, charWidth: number, cellPadX: number, minColWidth: number): number {
  const units = Math.max(1, measureTextWidth(text));
  return Math.max(minColWidth, Math.ceil(units * charWidth) + cellPadX * 2);
}

function computeColumnWidths(
  block: TableBlock,
  charWidth: number,
  cellPadX: number,
  minColWidth: number,
): number[] {
  const allRows = [block.header, ...block.rows];
  const numCols = block.header.length;
  const widths = new Array(numCols).fill(minColWidth);

  for (const row of allRows) {
    for (let i = 0; i < numCols; i++) {
      const w = cellPixelWidth(row[i] ?? '', charWidth, cellPadX, minColWidth);
      if (w > widths[i]) {
        widths[i] = w;
      }
    }
  }

  return widths.map((w) => Math.min(w, MAX_COL_WIDTH));
}

function wrapRowCells(
  row: string[],
  colWidths: number[],
  charWidth: number,
  cellPadX: number,
  maxWrapLines?: number,
): { wrappedCells: string[][]; maxWrapLines: number } {
  const wrappedCells: string[][] = [];
  let maxLines = 1;

  for (let colIdx = 0; colIdx < row.length; colIdx++) {
    const maxUnits = maxTextUnits(colWidths[colIdx], charWidth, cellPadX);
    let lines = wrapText(row[colIdx] ?? '', maxUnits);
    if (maxWrapLines !== undefined && lines.length > maxWrapLines) {
      lines = lines.slice(0, maxWrapLines);
    }
    wrappedCells.push(lines);
    if (lines.length > maxLines) {
      maxLines = lines.length;
    }
  }

  return { wrappedCells, maxWrapLines: maxLines };
}

/** Vertical distance between baselines for wrapped lines. */
export function wrappedLineStep(lineHeight: number, fontSize: number): number {
  return Math.max(lineHeight * 0.92, fontSize * 1.15);
}

/** Minimum vertical spacing between wrapped baselines (readable). */
function readableLineStep(fontSize: number): number {
  return fontSize * 1.15;
}

/** Pixel height cap for a single overlay band at readable line spacing. */
export function maxBandHeightPx(metrics: Pick<TableLayoutMetrics, 'fontSize' | 'cellPadY'>): number {
  const { fontSize, cellPadY } = metrics;
  if (MAX_BAND_LINES <= 1) {
    return cellPadY * 2 + fontSize;
  }
  return Math.ceil(
    cellPadY * 2 + fontSize + (MAX_BAND_LINES - 1) * readableLineStep(fontSize),
  );
}

/** Overlay band height for a slice (row wrap height capped for safety). */
export function computeBandHeightForSlice(
  layout: TableLayout,
  slice: TableLineSliceSpec,
): number {
  return Math.min(slice.sliceHeight, maxBandHeightPx(layout.metrics));
}

/** Pixel height for a band showing {@link visibleWrapLines} of wrapped text. */
export function bandContentHeight(
  visibleWrapLines: number,
  metrics: Pick<TableLayoutMetrics, 'fontSize' | 'cellPadY'>,
  lineStep: number,
): number {
  const { fontSize, cellPadY } = metrics;
  return Math.ceil(
    cellPadY * 2 + fontSize + Math.max(0, visibleWrapLines - 1) * lineStep,
  );
}

/** Band height so cell rects and decoration match visible wrapped content. */
export function resolveBandRowHeight(
  layout: TableLayout,
  slice: TableLineSliceSpec,
  visibleWrapLines: number,
  lineStep: number,
): number {
  const fromContent = bandContentHeight(visibleWrapLines, layout.metrics, lineStep);
  const sliceBudget = computeBandHeightForSlice(layout, slice);
  const maxBand = maxBandHeightPx(layout.metrics);
  if (slice.mergedHeader === true) {
    return Math.max(fromContent, slice.sliceHeight);
  }

  const { lineHeight } = layout.metrics;
  const sourceLineBudget = slice.hideSourceOnly === true
    ? lineHeight
    : (layout.rowLayouts[slice.rowLayoutIndex]?.sourceWeight ?? 1) * lineHeight;

  // One editor line per overlay: cap to line height so the band does not cover the row bottom border.
  if (sliceBudget <= sourceLineBudget) {
    return Math.min(fromContent, sourceLineBudget, maxBand);
  }

  return Math.min(Math.max(fromContent, sliceBudget), maxBand);
}

/** Keep at most {@link maxLines}; mark overflow with an ellipsis on the last line. */
export function truncateLinesForBandDisplay(lines: string[], maxLines: number): string[] {
  if (maxLines <= 0 || lines.length === 0) {
    return [''];
  }
  if (lines.length <= maxLines) {
    return lines;
  }
  const capped = lines.slice(0, maxLines);
  const lastIdx = capped.length - 1;
  const last = capped[lastIdx] ?? '';
  if (last.length <= 1) {
    capped[lastIdx] = '…';
    return capped;
  }
  capped[lastIdx] = `${last.slice(0, Math.max(0, last.length - 1)).trimEnd()}…`;
  return capped;
}

/** Max wrapped text lines that fit in a band of the given pixel height. */
export function maxWrapLinesForBandHeight(
  bandHeight: number,
  metrics: Pick<TableLayoutMetrics, 'fontSize' | 'cellPadY' | 'lineHeight'>,
): number {
  const { fontSize, cellPadY, lineHeight } = metrics;
  const inner = bandHeight - cellPadY * 2;
  if (inner <= fontSize) {
    return 1;
  }
  const lineStep = wrappedLineStep(lineHeight, fontSize);
  return Math.max(1, Math.floor((inner - fontSize) / lineStep) + 1);
}

/** Split wrapped lines across GFM source lines (header) or return all lines (data row). */
function sliceWrappedLinesForSubLine(
  lines: string[],
  subLine: number,
  subLineCount: number,
): string[] {
  if (subLineCount <= 1) {
    return lines;
  }
  const linesPerSub = Math.max(1, Math.ceil(lines.length / subLineCount));
  const start = subLine * linesPerSub;
  return lines.slice(start, start + linesPerSub);
}

function buildRowLayouts(
  block: TableBlock,
  colWidths: number[],
  metrics: TableLayoutMetrics,
  capToSourceLines: boolean,
): TableRowLayout[] {
  const { charWidth, cellPadX, lineHeight } = metrics;

  const headerBandHeight = headerBandHeightPx(metrics);
  const headerMaxWrap = capToSourceLines
    ? maxWrapLinesForBandHeight(headerBandHeight, metrics)
    : undefined;
  const headerWrap = wrapRowCells(block.header, colWidths, charWidth, cellPadX, headerMaxWrap);
  const layouts: TableRowLayout[] = [{
    isHeader: true,
    row: block.header,
    sourceWeight: HEADER_SOURCE_LINES,
    maxWrapLines: headerWrap.maxWrapLines,
    wrappedCells: headerWrap.wrappedCells,
  }];

  for (const row of block.rows) {
    const rowMaxWrap = capToSourceLines
      ? maxWrapLinesForBandHeight(lineHeight, metrics)
      : undefined;
    const wrap = wrapRowCells(row, colWidths, charWidth, cellPadX, rowMaxWrap);
    layouts.push({
      isHeader: false,
      row,
      sourceWeight: 1,
      maxWrapLines: wrap.maxWrapLines,
      wrappedCells: wrap.wrappedCells,
    });
  }

  return layouts;
}

/**
 * Row height from wrapped line count. When capped, always uses source line budget.
 */
function computeRowHeight(
  layout: TableRowLayout,
  metrics: TableLayoutMetrics,
  capToSourceLines: boolean,
): number {
  const { lineHeight, fontSize, cellPadY } = metrics;
  const minHeight = layout.sourceWeight * lineHeight;
  if (capToSourceLines) {
    return minHeight;
  }
  if (layout.maxWrapLines <= 1) {
    return minHeight;
  }

  const lineStep = wrappedLineStep(lineHeight, fontSize);
  const textBlockHeight = fontSize + (layout.maxWrapLines - 1) * lineStep;
  const contentHeight = cellPadY * 2 + textBlockHeight;
  return Math.max(minHeight, Math.ceil(contentHeight));
}

/** Split a row's pixel height across GFM source lines (header uses two lines). */
export function sliceHeightForSubLine(
  rowHeight: number,
  subLine: number,
  subLineCount: number,
): number {
  const base = Math.floor(rowHeight / subLineCount);
  const remainder = rowHeight % subLineCount;
  return base + (subLine < remainder ? 1 : 0);
}

/** True when a row's per-line overlay band is taller than one editor line. */
export function rowOverlayExceedsSourceLine(
  layout: TableLayout,
  rowLayoutIndex: number,
): boolean {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return false;
  }
  const { lineHeight } = layout.metrics;
  const slice: TableLineSliceSpec = {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight: layout.rowHeights[rowLayoutIndex] ?? lineHeight,
  };
  return resolveOverlayBandHeight(layout, slice) > lineHeight;
}

export function bodyBandHeaderInsetPx(layout: TableLayout, rowLayoutIndex: number): number {
  void layout;
  void rowLayoutIndex;
  return 0;
}

/** Maps a source line index within the table block to a row band slice. */
export function sourceLineToSliceSpec(
  sourceLineIndex: number,
  layout: TableLayout,
): TableLineSliceSpec | null {
  if (sourceLineIndex < 0) {
    return null;
  }

  const headerSlice = headerSourceLineToSliceSpec(sourceLineIndex, layout);
  if (headerSlice) {
    return headerSlice;
  }

  const { lineHeight } = layout.metrics;
  const rowLayoutIndex = dataRowLayoutIndexForSourceLine(sourceLineIndex);
  if (rowLayoutIndex >= layout.rowLayouts.length) {
    return null;
  }

  const sliceHeight = layout.rowHeights[rowLayoutIndex] ?? lineHeight;
  // When the previous row's band overflows, its bottom rule sits below this source line.
  // Draw a top rule here only in that case; otherwise the previous row's bottom rule suffices.
  const needsTopBorder = rowLayoutIndex > 1
    && rowOverlayExceedsSourceLine(layout, rowLayoutIndex - 1);
  return {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight,
    bandBorders: { top: needsTopBorder, bottom: true },
  };
}

/** True when a cell has fewer visible lines than the band and should center in the row. */
function shouldVerticallyCenterCellInBand(
  lineCount: number,
  bandWrapLines: number,
  mergedHeader: boolean,
): boolean {
  if (mergedHeader) {
    return false;
  }
  return lineCount < bandWrapLines;
}

/** SVG text y is the baseline; optionally center the text block vertically in the row. */
function firstLineBaselineY(
  rowY: number,
  rowHeight: number,
  fontSize: number,
  wrapLines: number,
  cellPadY: number,
  lineStep: number,
  verticalCenter: boolean,
): number {
  if (wrapLines <= 1 && !verticalCenter) {
    return rowY + cellPadY + fontSize * 0.85;
  }
  if (wrapLines <= 1) {
    return rowY + (rowHeight + fontSize) / 2 - fontSize * 0.15;
  }
  const textBlockHeight = fontSize + (wrapLines - 1) * lineStep;
  if (verticalCenter) {
    const topInset = Math.max(cellPadY, (rowHeight - textBlockHeight) / 2);
    return rowY + topInset + fontSize * 0.85;
  }
  return rowY + cellPadY + fontSize * 0.85;
}

function textX(
  align: null | 'left' | 'center' | 'right' | undefined,
  colX: number,
  colWidth: number,
  text: string,
  charWidth: number,
  cellPadX: number,
): number {
  const textWidth = measureTextWidth(text) * charWidth;

  if (align === 'right') {
    return colX + colWidth - cellPadX - textWidth;
  }
  if (align === 'center') {
    return colX + (colWidth - textWidth) / 2;
  }
  return colX + cellPadX;
}

function appendWrappedCellText(
  parts: string[],
  lines: string[],
  align: null | 'left' | 'center' | 'right' | undefined,
  colX: number,
  colWidth: number,
  startY: number,
  lineStep: number,
  textColor: string,
  fontFamily: string,
  fontSize: number,
  charWidth: number,
  cellPadX: number,
): void {
  if (lines.length === 0) {
    return;
  }

  parts.push(
    `<text fill="${textColor}" font-family="${fontFamily}" font-size="${fontSize}">`,
  );

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const tx = textX(align, colX, colWidth, line, charWidth, cellPadX);
    if (lineIdx === 0) {
      parts.push(`<tspan x="${tx}" y="${startY}">${escapeXml(line)}</tspan>`);
      continue;
    }
    parts.push(`<tspan x="${tx}" dy="${lineStep}">${escapeXml(line)}</tspan>`);
  }

  parts.push('</text>');
}

/** 1px filled rect on integer coords so corners and row joins stay square (no line inset gaps). */
function appendBorderRect(
  parts: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  border: string,
): void {
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${border}" shape-rendering="crispEdges"/>`,
  );
}

/** Inset band/cell fills inside the outer vertical border lines. */
function bandInnerFrame(
  bandHeight: number,
  tableWidth: number,
  edges: { top: boolean; bottom: boolean },
): { x: number; y: number; width: number; height: number } {
  const x = BORDER_WIDTH;
  const y = edges.top ? BORDER_WIDTH : 0;
  const bottomInset = edges.bottom ? BORDER_WIDTH : 0;
  return {
    x,
    y,
    width: tableWidth - BORDER_WIDTH * 2,
    height: bandHeight - y - bottomInset,
  };
}

type BandBorderOptions = {
  /** Height of vertical rules (defaults to {@link bandHeight}). */
  verticalSpanHeight?: number;
  /** When false, only horizontal rules from {@link edges} are drawn. */
  verticalBorders?: boolean;
};

function appendBandBorderLines(
  parts: string[],
  layout: TableLayout,
  bandTop: number,
  bandHeight: number,
  edges: { top: boolean; bottom: boolean },
  borderOptions: BandBorderOptions = {},
): void {
  const { colWidths, metrics } = layout;
  const border = metrics.colors.border;
  const tableWidth = layout.totalWidth;
  const verticalBorders = borderOptions.verticalBorders !== false;
  const verticalHeight = borderOptions.verticalSpanHeight ?? bandHeight;

  if (edges.top) {
    appendBorderRect(parts, 0, bandTop, tableWidth, BORDER_WIDTH, border);
  }
  if (edges.bottom) {
    appendBorderRect(parts, 0, bandTop + bandHeight - BORDER_WIDTH, tableWidth, BORDER_WIDTH, border);
  }

  if (!verticalBorders) {
    return;
  }

  appendBorderRect(parts, 0, bandTop, BORDER_WIDTH, verticalHeight, border);
  let x = BORDER_WIDTH;
  for (let colIdx = 0; colIdx < colWidths.length; colIdx++) {
    x += colWidths[colIdx];
    if (colIdx < colWidths.length - 1) {
      appendBorderRect(parts, x, bandTop, BORDER_WIDTH, verticalHeight, border);
    }
  }
  appendBorderRect(parts, tableWidth - BORDER_WIDTH, bandTop, BORDER_WIDTH, verticalHeight, border);
}

type PreparedRowBand = {
  cellLines: string[][];
  visibleWrapLines: number;
  rowHeight: number;
  lineStep: number;
};

/** Overlay band height including wrapped content (for decorations). */
export function resolveOverlayBandHeight(
  layout: TableLayout,
  slice: TableLineSliceSpec,
): number {
  if (slice.hideSourceOnly === true) {
    return computeBandHeightForSlice(layout, slice);
  }
  const prepared = prepareRowBand(layout, slice.rowLayoutIndex, slice);
  if (!prepared) {
    return computeBandHeightForSlice(layout, slice);
  }
  const inset = bodyBandHeaderInsetPx(layout, slice.rowLayoutIndex);
  const headerHeight = resolveHeaderOverlayBandHeight(layout, slice, prepared.rowHeight, inset);
  if (headerHeight !== null) {
    return headerHeight;
  }
  return prepared.rowHeight + inset;
}

function prepareRowBand(
  layout: TableLayout,
  rowLayoutIndex: number,
  slice: TableLineSliceSpec,
): PreparedRowBand | null {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return null;
  }

  const { lineHeight, fontSize } = layout.metrics;
  let maxShow: number;
  if (slice.mergedHeader === true) {
    maxShow = mergedHeaderPrepareConstraints(
      layout,
      maxWrapLinesForBandHeight,
      rowLayout.maxWrapLines,
    ).maxShow;
  } else {
    maxShow = maxWrapLinesForBandHeight(computeBandHeightForSlice(layout, slice), layout.metrics);
  }
  const lineStep = wrappedLineStep(lineHeight, fontSize);

  const cellLines: string[][] = [];
  let visibleWrapLines = 1;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const allLines = rowLayout.wrappedCells[colIdx] ?? [''];
    const subLines = slice.mergedHeader === true
      ? allLines
      : sliceWrappedLinesForSubLine(allLines, slice.subLine, slice.subLineCount);
    const lines = truncateLinesForBandDisplay(subLines, maxShow);
    cellLines.push(lines);
    if (lines.length > visibleWrapLines) {
      visibleWrapLines = lines.length;
    }
  }

  let rowHeight = resolveBandRowHeight(layout, slice, visibleWrapLines, lineStep);
  if (slice.mergedHeader === true) {
    rowHeight = Math.max(rowHeight, layout.metrics.lineHeight);
  }
  return { cellLines, visibleWrapLines, rowHeight, lineStep };
}

function renderRowBand(
  parts: string[],
  layout: TableLayout,
  rowLayoutIndex: number,
  slice: TableLineSliceSpec,
  prepared: PreparedRowBand,
  bandTop = 0,
): void {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return;
  }

  const { colWidths, block, metrics } = layout;
  const { fontSize, charWidth, cellPadX, cellPadY, fontFamily, colors } = metrics;
  const { text: textColor } = colors;
  const { cellLines, visibleWrapLines, rowHeight, lineStep } = prepared;
  const edges = slice.bandBorders ?? { top: false, bottom: true };

  let x = BORDER_WIDTH;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const colWidth = colWidths[colIdx];
    const align = colIdx < block.align.length ? block.align[colIdx] : null;
    const lines = cellLines[colIdx] ?? [''];
    const lineCount = lines.length;
    const cellFirstY = slice.mergedHeader === true
      ? mergedHeaderLabelBaselineY(fontSize, cellPadY)
      : firstLineBaselineY(
        bandTop,
        rowHeight,
        fontSize,
        lineCount,
        cellPadY,
        lineStep,
        shouldVerticallyCenterCellInBand(lineCount, visibleWrapLines, false),
      );

    appendWrappedCellText(
      parts,
      lines,
      align,
      x,
      colWidth,
      cellFirstY,
      lineStep,
      textColor,
      fontFamily,
      fontSize,
      charWidth,
      cellPadX,
    );

    x += colWidth;
  }

  const borderBandHeight = slice.mergedHeader === true
    ? mergedHeaderOverlayBandPx(layout, rowHeight)
    : rowHeight;
  appendBandBorderLines(parts, layout, bandTop, borderBandHeight, edges);
}

export function renderHeaderSeparatorBridge(layout: TableLayout): string | null {
  return renderHeaderSeparatorBridgeSlice(layout, renderTableSvgLineSlice);
}

/**
 * Build column widths, wrapped cells, and row heights for a table block.
 */
export function buildTableLayout(block: TableBlock, options: TableRenderOptions): TableLayout {
  const capToSourceLines = options.capToSourceLines ?? false;
  const metrics = resolveTableMetrics(options);
  const colWidths = computeColumnWidths(
    block,
    metrics.charWidth,
    metrics.cellPadX,
    metrics.minColWidth,
  );
  const rowLayouts = buildRowLayouts(block, colWidths, metrics, capToSourceLines);
  const rowHeights = rowLayouts.map((layout) =>
    computeRowHeight(layout, metrics, capToSourceLines),
  );
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + BORDER_WIDTH * 2;
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  return {
    block,
    metrics,
    colWidths,
    rowLayouts,
    rowHeights,
    totalWidth,
    totalHeight,
    capToSourceLines,
  };
}

function renderSvgFromParts(parts: string[], width: number, height: number): string {
  const body = parts.join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`;
  return ensureSvgDimensions(svg, width, height);
}

/** Allow overlay painting past the anchor source line (thead into separator, tall rows into following lines). */
export function sliceAllowsDecorationOverflow(
  slice: TableLineSliceSpec,
  bandHeight: number,
  lineHeight: number,
): boolean {
  if (headerSliceAllowsDecorationOverflow(slice)) {
    return true;
  }
  return bandHeight > lineHeight;
}

/**
 * Render one source-line band of the table (for per-line editor overlays).
 */
export function renderTableSvgLineSlice(
  layout: TableLayout,
  sourceLineIndex: number,
): string | null {
  const slice = sourceLineToSliceSpec(sourceLineIndex, layout);
  if (!slice || slice.rowLayoutIndex >= layout.rowLayouts.length) {
    return null;
  }

  if (slice.hideSourceOnly === true) {
    return null;
  }

  if (slice.separatorColumnBridge === true) {
    const bandHeight = layout.metrics.lineHeight;
    const parts: string[] = [];
    appendBandBorderLines(parts, layout, 0, bandHeight, { top: false, bottom: false });
    return renderSvgFromParts(parts, layout.totalWidth, bandHeight);
  }

  const prepared = prepareRowBand(layout, slice.rowLayoutIndex, slice);
  if (!prepared) {
    return null;
  }

  const bodyTopInset = bodyBandHeaderInsetPx(layout, slice.rowLayoutIndex);
  const { rowHeight } = prepared;
  const contentSpan = slice.mergedHeader === true
    ? mergedHeaderOverlayBandPx(layout, rowHeight)
    : rowHeight;
  const bandHeight = contentSpan + bodyTopInset;
  const rowLayout = layout.rowLayouts[slice.rowLayoutIndex];
  const bandFill = overlayBandFillForSlice(
    slice,
    rowLayout?.isHeader === true,
    layout.metrics.colors.headerBackground,
    layout.metrics.colors.background,
  );
  const edges = slice.bandBorders ?? { top: false, bottom: true };
  const { x: fillX, y: fillY, width: fillW, height: fillH } = bandInnerFrame(
    contentSpan,
    layout.totalWidth,
    edges,
  );
  const parts: string[] = [];
  const w = layout.totalWidth;
  if (slice.mergedHeader !== true) {
    parts.push(
      `<defs><clipPath id="band"><rect width="${w}" height="${bandHeight}"/></clipPath></defs>`,
    );
    parts.push('<g clip-path="url(#band)">');
  } else {
    parts.push('<g>');
  }
  parts.push(`<rect x="${fillX}" y="${fillY + bodyTopInset}" width="${fillW}" height="${fillH}" fill="${bandFill}"/>`);
  renderRowBand(parts, layout, slice.rowLayoutIndex, slice, prepared, bodyTopInset);
  parts.push('</g>');
  return renderSvgFromParts(parts, w, bandHeight);
}

/**
 * Render a bordered table as SVG. The header spans the title row and GFM separator row.
 * Long cell text wraps within column bounds; row heights grow with wrapped line count unless capped.
 */
export function renderTableSvg(block: TableBlock, options: TableRenderOptions): string {
  const layout = buildTableLayout(block, options);
  const { background: bg, headerBackground: headerBg, text: textColor } = layout.metrics.colors;
  const { lineHeight, fontSize, charWidth, cellPadX, cellPadY, fontFamily } = layout.metrics;

  const parts: string[] = [];
  parts.push(`<rect width="${layout.totalWidth}" height="${layout.totalHeight}" fill="${bg}"/>`);

  let y = 0;
  for (let rowIdx = 0; rowIdx < layout.rowLayouts.length; rowIdx++) {
    const rowLayout = layout.rowLayouts[rowIdx];
    const rowHeight = layout.rowHeights[rowIdx];
    const lineStep = wrappedLineStep(lineHeight, fontSize);

    const rowFill = rowLayout.isHeader ? headerBg : bg;
    parts.push(
      `<rect x="${BORDER_WIDTH}" y="${y}" width="${layout.totalWidth - BORDER_WIDTH * 2}" height="${rowHeight}" fill="${rowFill}"/>`,
    );

    let x = BORDER_WIDTH;
    for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
      const colWidth = layout.colWidths[colIdx];
      const align = colIdx < block.align.length ? block.align[colIdx] : null;
      const lines = rowLayout.wrappedCells[colIdx] ?? [''];
      const lineCount = lines.length;
      const verticalCenter = rowLayout.isHeader
        || shouldVerticallyCenterCellInBand(lineCount, rowLayout.maxWrapLines, false);
      const cellFirstY = firstLineBaselineY(
        y,
        rowHeight,
        fontSize,
        lineCount,
        cellPadY,
        lineStep,
        verticalCenter,
      );

      appendWrappedCellText(
        parts,
        lines,
        align,
        x,
        colWidth,
        cellFirstY,
        lineStep,
        textColor,
        fontFamily,
        fontSize,
        charWidth,
        cellPadX,
      );

      x += colWidth;
    }

    appendBandBorderLines(parts, layout, y, rowHeight, { top: rowIdx === 0, bottom: true });
    y += rowHeight;
  }

  return renderSvgFromParts(parts, layout.totalWidth, layout.totalHeight);
}
