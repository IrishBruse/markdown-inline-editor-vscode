import * as os from 'os';
import { workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { measureTextWidth } from '../parser/tables';
import { processSvg } from '../mermaid/svg-processor';
import { resolveTableColors, type TableColors } from './table-colors';

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
/** GFM header row plus `|---|---|` separator line rendered as one thead band. */
export const HEADER_SOURCE_LINES = 2;

/** Cap column width so very wide cells do not produce oversized overlays. */
const MAX_COL_WIDTH = 400;

type RowLayout = {
  isHeader: boolean;
  row: string[];
  sourceWeight: number;
  maxWrapLines: number;
  wrappedCells: string[][];
};

export type TableLayoutMetrics = {
  lineHeight: number;
  fontSize: number;
  charWidth: number;
  cellPadX: number;
  cellPadY: number;
  minColWidth: number;
  fontFamily: string;
  colors: TableColors;
};

export type TableLayout = {
  block: TableBlock;
  metrics: TableLayoutMetrics;
  colWidths: number[];
  rowLayouts: RowLayout[];
  rowHeights: number[];
  totalWidth: number;
  totalHeight: number;
  capToSourceLines: boolean;
};

export type TableLineSliceSpec = {
  rowLayoutIndex: number;
  subLine: number;
  subLineCount: number;
  sliceHeight: number;
};

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
function wrappedLineStep(lineHeight: number, fontSize: number): number {
  return Math.max(lineHeight * 0.92, fontSize * 1.15);
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

function sliceWrappedLinesForSubLine(
  lines: string[],
  subLine: number,
  subLineCount: number,
  maxLinesPerSubLine: number,
): string[] {
  const start = subLine * maxLinesPerSubLine;
  return lines.slice(start, start + maxLinesPerSubLine);
}

function buildRowLayouts(
  block: TableBlock,
  colWidths: number[],
  metrics: TableLayoutMetrics,
  capToSourceLines: boolean,
): RowLayout[] {
  const { charWidth, cellPadX, lineHeight } = metrics;

  const headerBandHeight = HEADER_SOURCE_LINES * lineHeight;
  const headerMaxWrap = capToSourceLines
    ? maxWrapLinesForBandHeight(headerBandHeight, metrics)
    : undefined;
  const headerWrap = wrapRowCells(block.header, colWidths, charWidth, cellPadX, headerMaxWrap);
  const layouts: RowLayout[] = [{
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
  layout: RowLayout,
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

/** Maps a source line index within the table block to a row band slice. */
export function sourceLineToSliceSpec(
  sourceLineIndex: number,
  layout: TableLayout,
): TableLineSliceSpec | null {
  if (sourceLineIndex < 0) {
    return null;
  }

  const { lineHeight } = layout.metrics;

  if (sourceLineIndex < HEADER_SOURCE_LINES) {
    const rowHeight = layout.rowHeights[0] ?? HEADER_SOURCE_LINES * lineHeight;
    return {
      rowLayoutIndex: 0,
      subLine: sourceLineIndex,
      subLineCount: HEADER_SOURCE_LINES,
      sliceHeight: sliceHeightForSubLine(rowHeight, sourceLineIndex, HEADER_SOURCE_LINES),
    };
  }

  const rowLayoutIndex = sourceLineIndex - HEADER_SOURCE_LINES + 1;
  if (rowLayoutIndex >= layout.rowLayouts.length) {
    return null;
  }

  const sliceHeight = layout.rowHeights[rowLayoutIndex] ?? lineHeight;
  return {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight,
  };
}

/** SVG text y is the baseline; center single-line cells like the pre-wrap renderer. */
function firstLineBaselineY(
  rowY: number,
  rowHeight: number,
  fontSize: number,
  maxWrapLines: number,
  cellPadY: number,
): number {
  if (maxWrapLines <= 1) {
    return rowY + (rowHeight + fontSize) / 2 - fontSize * 0.15;
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

function renderRowBand(
  parts: string[],
  layout: TableLayout,
  rowLayoutIndex: number,
  slice: TableLineSliceSpec,
): void {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return;
  }

  const { metrics, colWidths, block } = layout;
  const { lineHeight, fontSize, charWidth, cellPadX, cellPadY, fontFamily, colors } = metrics;
  const { background: bg, headerBackground: headerBg, border, text: textColor } = colors;
  const rowHeight = slice.sliceHeight;
  const maxLinesPerSubLine = maxWrapLinesForBandHeight(rowHeight, metrics);
  const lineStep = wrappedLineStep(lineHeight, fontSize);

  const cellLines: string[][] = [];
  let visibleWrapLines = 1;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const allLines = rowLayout.wrappedCells[colIdx] ?? [''];
    const lines = sliceWrappedLinesForSubLine(
      allLines,
      slice.subLine,
      slice.subLineCount,
      maxLinesPerSubLine,
    );
    cellLines.push(lines);
    if (lines.length > visibleWrapLines) {
      visibleWrapLines = lines.length;
    }
  }

  const firstLineY = firstLineBaselineY(0, rowHeight, fontSize, visibleWrapLines, cellPadY);

  let x = BORDER_WIDTH;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const colWidth = colWidths[colIdx];
    const align = colIdx < block.align.length ? block.align[colIdx] : null;
    const lines = cellLines[colIdx] ?? [''];

    parts.push(
      `<rect x="${x}" y="0" width="${colWidth}" height="${rowHeight}" fill="${rowLayout.isHeader ? headerBg : bg}" stroke="${border}" stroke-width="${BORDER_WIDTH}"/>`,
    );

    appendWrappedCellText(
      parts,
      lines,
      align,
      x,
      colWidth,
      firstLineY,
      lineStep,
      textColor,
      fontFamily,
      fontSize,
      charWidth,
      cellPadX,
    );

    x += colWidth + BORDER_WIDTH;
  }
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
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + BORDER_WIDTH * (colWidths.length + 1);
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return processSvg(svg, height);
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

  const parts: string[] = [];
  parts.push(`<rect width="${layout.totalWidth}" height="${slice.sliceHeight}" fill="${layout.metrics.colors.background}"/>`);
  renderRowBand(parts, layout, slice.rowLayoutIndex, slice);
  return renderSvgFromParts(parts, layout.totalWidth, slice.sliceHeight);
}

/**
 * Render a bordered table as SVG. The header spans the title row and GFM separator row.
 * Long cell text wraps within column bounds; row heights grow with wrapped line count unless capped.
 */
export function renderTableSvg(block: TableBlock, options: TableRenderOptions): string {
  const layout = buildTableLayout(block, options);
  const { background: bg, headerBackground: headerBg, border, text: textColor } = layout.metrics.colors;
  const { lineHeight, fontSize, charWidth, cellPadX, cellPadY, fontFamily } = layout.metrics;

  const parts: string[] = [];
  parts.push(`<rect width="${layout.totalWidth}" height="${layout.totalHeight}" fill="${bg}"/>`);

  let y = 0;
  for (let rowIdx = 0; rowIdx < layout.rowLayouts.length; rowIdx++) {
    const rowLayout = layout.rowLayouts[rowIdx];
    const rowHeight = layout.rowHeights[rowIdx];
    const lineStep = wrappedLineStep(lineHeight, fontSize);
    const firstLineY = firstLineBaselineY(y, rowHeight, fontSize, rowLayout.maxWrapLines, cellPadY);

    let x = BORDER_WIDTH;
    for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
      const colWidth = layout.colWidths[colIdx];
      const align = colIdx < block.align.length ? block.align[colIdx] : null;
      const lines = rowLayout.wrappedCells[colIdx] ?? [''];

      parts.push(
        `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" fill="${rowLayout.isHeader ? headerBg : bg}" stroke="${border}" stroke-width="${BORDER_WIDTH}"/>`,
      );

      appendWrappedCellText(
        parts,
        lines,
        align,
        x,
        colWidth,
        firstLineY,
        lineStep,
        textColor,
        fontFamily,
        fontSize,
        charWidth,
        cellPadX,
      );

      x += colWidth + BORDER_WIDTH;
    }

    y += rowHeight;
  }

  return renderSvgFromParts(parts, layout.totalWidth, layout.totalHeight);
}
