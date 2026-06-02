import { measureTextWidth } from '../../parser/tables';
import { ensureSvgDimensions } from '../../mermaid/svg-processor';
import type { TableLayout } from './layout-types';

export const BORDER_WIDTH = 1;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

export function appendWrappedCellText(
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
export function bandInnerFrame(
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
  verticalSpanHeight?: number;
  verticalBorders?: boolean;
};

export function appendBandBorderLines(
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

export function renderSvgFromParts(parts: string[], width: number, height: number): string {
  const body = parts.join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`;
  return ensureSvgDimensions(svg, width, height);
}
