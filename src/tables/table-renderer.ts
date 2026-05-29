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

function truncateCellText(
  text: string,
  colWidth: number,
  charWidth: number,
  cellPadX: number,
): string {
  const maxTextPx = colWidth - cellPadX * 2;
  if (maxTextPx <= 0) {
    return '...';
  }
  if (measureTextWidth(text) * charWidth <= maxTextPx) {
    return text;
  }

  const ellipsis = '...';
  for (let len = text.length; len >= 0; len--) {
    const candidate = text.slice(0, len) + ellipsis;
    if (measureTextWidth(candidate) * charWidth <= maxTextPx) {
      return candidate;
    }
  }

  return ellipsis;
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

function textBaselineY(rowY: number, rowHeight: number, fontSize: number): number {
  return rowY + (rowHeight + fontSize) / 2 - fontSize * 0.15;
}

/**
 * Render a bordered table as SVG sized to {@link TableBlock.numLines} editor lines.
 * The header spans the title row and GFM separator row; data rows use one line each.
 */
export function renderTableSvg(block: TableBlock, options: TableRenderOptions): string {
  const metrics = getEditorLineMetrics();
  const lineHeight = options.lineHeight ?? metrics.lineHeight;
  const fontSize = Math.min(options.fontSize ?? metrics.fontSize, lineHeight - 2);
  const charWidth = fontSize * 0.6;
  const cellPadX = Math.max(4, Math.round(fontSize * 0.35));
  const minColWidth = Math.max(24, Math.round(fontSize * 3.5));

  const colWidths = computeColumnWidths(block, charWidth, cellPadX, minColWidth);
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + BORDER_WIDTH * (colWidths.length + 1);
  const totalHeight = block.numLines * lineHeight;

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
  for (let lineIdx = 0; lineIdx < block.numLines; lineIdx++) {
    // Separator source line is painted as part of the header band (line 0).
    if (lineIdx === 1) {
      continue;
    }

    const isHeader = lineIdx === 0;
    const dataIdx = lineIdx - HEADER_SOURCE_LINES;
    const row = isHeader ? block.header : block.rows[dataIdx];
    const rowHeight = isHeader ? lineHeight * HEADER_SOURCE_LINES : lineHeight;
    if (!row) {
      y += rowHeight;
      continue;
    }

    let x = BORDER_WIDTH;
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const colWidth = colWidths[colIdx];
      const rawCellText = row[colIdx] ?? '';
      const cellText = truncateCellText(rawCellText, colWidth, charWidth, cellPadX);
      const align = colIdx < block.align.length ? block.align[colIdx] : null;

      parts.push(
        `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" fill="${isHeader ? headerBg : bg}" stroke="${border}" stroke-width="${BORDER_WIDTH}"/>`,
      );

      const tx = textX(align, x, colWidth, cellText, charWidth, cellPadX);
      const ty = textBaselineY(y, rowHeight, fontSize);
      const weight = isHeader ? ' font-weight="600"' : '';
      parts.push(
        `<text x="${tx}" y="${ty}" fill="${textColor}" font-family="${fontFamily}" font-size="${fontSize}"${weight}>${escapeXml(cellText)}</text>`,
      );

      x += colWidth + BORDER_WIDTH;
    }

    y += rowHeight;
  }

  parts.push('</svg>');
  return processSvg(parts.join(''), totalHeight);
}
