import * as os from 'os';
import { workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { measureTextWidth } from '../parser/tables';
import { processSvg } from '../mermaid/svg-processor';

export type TableRenderOptions = {
  isDark: boolean;
  fontFamily?: string;
  /** Editor line height in px; defaults from workspace settings. */
  lineHeight?: number;
  /** Editor font size in px; defaults from workspace settings. */
  fontSize?: number;
};

const BORDER_WIDTH = 1;
/** GFM header row plus `|---|---|` separator line rendered as one thead band. */
const HEADER_SOURCE_LINES = 2;
/** Cap column width so very wide cells do not produce oversized overlays. */
const MAX_COL_WIDTH = 400;

type RowLayout = {
  isHeader: boolean;
  row: string[];
  sourceWeight: number;
  maxWrapLines: number;
  wrappedCells: string[][];
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
): { wrappedCells: string[][]; maxWrapLines: number } {
  const wrappedCells: string[][] = [];
  let maxWrapLines = 1;

  for (let colIdx = 0; colIdx < row.length; colIdx++) {
    const maxUnits = maxTextUnits(colWidths[colIdx], charWidth, cellPadX);
    const lines = wrapText(row[colIdx] ?? '', maxUnits);
    wrappedCells.push(lines);
    if (lines.length > maxWrapLines) {
      maxWrapLines = lines.length;
    }
  }

  return { wrappedCells, maxWrapLines };
}

function buildRowLayouts(
  block: TableBlock,
  colWidths: number[],
  charWidth: number,
  cellPadX: number,
): RowLayout[] {
  const headerWrap = wrapRowCells(block.header, colWidths, charWidth, cellPadX);
  const layouts: RowLayout[] = [{
    isHeader: true,
    row: block.header,
    sourceWeight: HEADER_SOURCE_LINES,
    maxWrapLines: headerWrap.maxWrapLines,
    wrappedCells: headerWrap.wrappedCells,
  }];

  for (const row of block.rows) {
    const wrap = wrapRowCells(row, colWidths, charWidth, cellPadX);
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

/** Vertical distance between baselines for wrapped lines. */
function wrappedLineStep(lineHeight: number, fontSize: number): number {
  return Math.max(lineHeight * 0.92, fontSize * 1.15);
}

/**
 * Row height from wrapped line count (not squeezed into source line count).
 * Unwrapped rows keep one editor line per source line (header spans two).
 */
function computeRowHeight(
  layout: RowLayout,
  lineHeight: number,
  fontSize: number,
  cellPadY: number,
): number {
  const minHeight = layout.sourceWeight * lineHeight;
  if (layout.maxWrapLines <= 1) {
    return minHeight;
  }

  const lineStep = wrappedLineStep(lineHeight, fontSize);
  const textBlockHeight = fontSize + (layout.maxWrapLines - 1) * lineStep;
  const contentHeight = cellPadY * 2 + textBlockHeight;
  return Math.max(minHeight, Math.ceil(contentHeight));
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
  isHeader: boolean,
): void {
  if (lines.length === 0) {
    return;
  }

  const weight = isHeader ? ' font-weight="600"' : '';
  parts.push(
    `<text fill="${textColor}" font-family="${fontFamily}" font-size="${fontSize}"${weight}>`,
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

/**
 * Render a bordered table as SVG. The header spans the title row and GFM separator row.
 * Long cell text wraps within column bounds; row heights grow with wrapped line count.
 */
export function renderTableSvg(block: TableBlock, options: TableRenderOptions): string {
  const metrics = getEditorLineMetrics();
  const lineHeight = options.lineHeight ?? metrics.lineHeight;
  const fontSize = Math.min(options.fontSize ?? metrics.fontSize, lineHeight - 2);
  const charWidth = fontSize * 0.6;
  const cellPadX = Math.max(4, Math.round(fontSize * 0.35));
  const cellPadY = Math.max(2, Math.round(fontSize * 0.25));
  const minColWidth = Math.max(24, Math.round(fontSize * 3.5));

  const colWidths = computeColumnWidths(block, charWidth, cellPadX, minColWidth);
  const rowLayouts = buildRowLayouts(block, colWidths, charWidth, cellPadX);
  const rowHeights = rowLayouts.map((layout) =>
    computeRowHeight(layout, lineHeight, fontSize, cellPadY),
  );
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + BORDER_WIDTH * (colWidths.length + 1);
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  const bg = options.isDark ? '#1e1e1e' : '#ffffff';
  const border = options.isDark ? '#454545' : '#c8c8c8';
  const headerBg = options.isDark ? '#2d2d2d' : '#f3f3f3';
  const textColor = options.isDark ? '#cccccc' : '#333333';
  const fontFamily = options.fontFamily
    ? `${escapeXml(options.fontFamily)}, sans-serif`
    : 'var(--vscode-editor-font-family, monospace), monospace';

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
  );
  parts.push(`<rect width="${totalWidth}" height="${totalHeight}" fill="${bg}"/>`);

  let y = 0;
  for (let rowIdx = 0; rowIdx < rowLayouts.length; rowIdx++) {
    const layout = rowLayouts[rowIdx];
    const rowHeight = rowHeights[rowIdx];
    const lineStep = wrappedLineStep(lineHeight, fontSize);
    const firstLineY = firstLineBaselineY(y, rowHeight, fontSize, layout.maxWrapLines, cellPadY);

    let x = BORDER_WIDTH;
    for (let colIdx = 0; colIdx < layout.row.length; colIdx++) {
      const colWidth = colWidths[colIdx];
      const align = colIdx < block.align.length ? block.align[colIdx] : null;
      const lines = layout.wrappedCells[colIdx] ?? [''];

      parts.push(
        `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" fill="${layout.isHeader ? headerBg : bg}" stroke="${border}" stroke-width="${BORDER_WIDTH}"/>`,
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
        layout.isHeader,
      );

      x += colWidth + BORDER_WIDTH;
    }

    y += rowHeight;
  }

  parts.push('</svg>');
  return processSvg(parts.join(''), totalHeight);
}
