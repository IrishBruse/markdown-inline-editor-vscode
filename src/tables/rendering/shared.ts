import * as os from 'os';
import { workspace } from 'vscode';
import { measureTextWidth } from '../../parser/tables';
import { logDebug } from '../../logging';
import { resolveTableColors, type TableColors } from '../table-colors';
import {
  HEADER_SOURCE_LINES,
  mergedHeaderOverlayBandPx,
  mergedHeaderPrepareConstraints,
  resolveHeaderOverlayBandHeight,
} from './header';
import type {
  PreparedRowBand,
  TableLayout,
  TableLayoutMetrics,
  TableLineSliceSpec,
} from './layout-types';
import { escapeXml } from './svg';

export type { PreparedRowBand };

/** Cap column width so very wide cells do not produce oversized overlays. */
const MAX_COL_WIDTH = 400;

/** Max wrapped lines shown per overlay band (limits overlap on following source lines). */
export const MAX_BAND_LINES = 5;

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
  /** Document line of the table's first GFM row (0-based); used for debug logging. */
  tableStartLine?: number;
};

/** Source lines that receive a per-line SVG overlay (merged title + data rows; separator is hide-only). */
export function countTableOverlaySourceLines(numLines: number): number {
  return Math.max(0, numLines);
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

export function resolveTableMetrics(options: TableRenderOptions): TableLayoutMetrics {
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

export function cellPixelWidth(
  text: string,
  charWidth: number,
  cellPadX: number,
  minColWidth: number,
): number {
  const units = Math.max(1, measureTextWidth(text));
  return Math.max(minColWidth, Math.ceil(units * charWidth) + cellPadX * 2);
}

export function computeColumnWidths(
  block: import('../../parser').TableBlock,
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

export function wrapRowCells(
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

/** GFM source line index for a per-line table slice. */
export function sourceLineIndexForSlice(slice: TableLineSliceSpec): number {
  if (slice.mergedHeader === true) {
    return 0;
  }
  if (slice.separatorColumnBridge === true) {
    return 1;
  }
  return slice.rowLayoutIndex + HEADER_SOURCE_LINES - 1;
}

function logSourceLineNumber(layout: TableLayout, sourceLineIndex: number): number {
  if (layout.tableStartLine !== undefined) {
    return layout.tableStartLine + sourceLineIndex + 1;
  }
  return sourceLineIndex;
}

function debugLogWrappedLines(
  layout: TableLayout,
  sourceLineIndex: number,
  cellWrapCounts: number[],
  lineStep: number,
  overlayHeightPx: number,
): void {
  const { lineHeight } = layout.metrics;
  logDebug(
    `${logSourceLineNumber(layout, sourceLineIndex)} [${cellWrapCounts.join(',')}] lh=${lineHeight} h=${overlayHeightPx}`,
  );
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

export function prepareRowBand(
  layout: TableLayout,
  rowLayoutIndex: number,
  slice: TableLineSliceSpec,
  sourceLineIndex = sourceLineIndexForSlice(slice),
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

  if (slice.mergedHeader === true) {
    debugLogWrappedLines(
      layout,
      sourceLineIndex,
      cellLines.map((lines) => lines.length),
      lineStep,
      resolveHeaderOverlayBandHeight(layout, slice, 0) ?? mergedHeaderOverlayBandPx(layout),
    );
  }

  return { cellLines, visibleWrapLines, rowHeight, lineStep };
}

export function firstLineBaselineY(
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

