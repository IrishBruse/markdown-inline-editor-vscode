import type { TableBlockCell } from '../parser/types';
import { measureTextWidth } from '../parser/tables';

const NBSP = '\u00A0';

/** Any column wider than this triggers responsive layout instead of the pipe grid. */
export const RESPONSIVE_COLUMN_THRESHOLD = 80;

/** Fixed wrap width for responsive table rows (matches activation threshold). */
export const RESPONSIVE_LAYOUT_WIDTH = RESPONSIVE_COLUMN_THRESHOLD;

export function estimateGridWidth(colWidths: number[]): number {
  const numCols = colWidths.length;
  if (numCols === 0) {
    return 0;
  }
  const cellWidths = colWidths.reduce((sum, width) => sum + width + 2, 0);
  return numCols + 1 + cellWidths;
}

export function shouldUseResponsiveLayout(colWidths: number[]): boolean {
  if (colWidths.length === 0) {
    return false;
  }
  return colWidths.some((width) => width > RESPONSIVE_COLUMN_THRESHOLD);
}

export function wrapTextToWidth(
  text: string,
  maxWidth: number,
  measureFn: (value: string) => number = measureTextWidth,
): string[] {
  if (maxWidth <= 0) {
    return [text];
  }
  if (measureFn(text) <= maxWidth) {
    return [text];
  }

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (measureFn(remaining) <= maxWidth) {
      lines.push(remaining);
      break;
    }

    const spaceIdx = remaining.lastIndexOf(' ', maxWidth);
    if (spaceIdx > 0 && measureFn(remaining.slice(0, spaceIdx)) <= maxWidth) {
      lines.push(remaining.slice(0, spaceIdx));
      remaining = remaining.slice(spaceIdx + 1);
      continue;
    }

    let breakIdx = 1;
    while (breakIdx < remaining.length && measureFn(remaining.slice(0, breakIdx + 1)) <= maxWidth) {
      breakIdx++;
    }
    if (breakIdx === 1 && measureFn(remaining.slice(0, 1)) > maxWidth) {
      lines.push(remaining.slice(0, 1));
      remaining = remaining.slice(1);
      continue;
    }
    lines.push(remaining.slice(0, breakIdx));
    remaining = remaining.slice(breakIdx);
  }

  return lines.length > 0 ? lines : [''];
}

function padLineToWidth(line: string, width: number): string {
  const lineWidth = measureTextWidth(line);
  if (lineWidth >= width) {
    return line;
  }
  return line + NBSP.repeat(width - lineWidth);
}

export function buildResponsiveHeaderLine(
  headers: string[],
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  const joined = headers.join(' | ');
  const wrapped = wrapTextToWidth(joined, layoutWidth);
  return wrapped.map((line) => padLineToWidth(line, layoutWidth)).join('\n');
}

export function buildResponsiveSeparatorLine(
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  return '-'.repeat(Math.max(3, layoutWidth));
}

function formatCellBlock(
  header: string,
  cell: TableBlockCell,
  layoutWidth: number,
): string {
  const prefix = `${header}: `;
  const prefixWidth = measureTextWidth(prefix);
  const valueWidth = Math.max(1, layoutWidth - prefixWidth);
  const valueLines = wrapTextToWidth(cell.displayText, valueWidth);
  const indent = ' '.repeat(prefixWidth);

  const formattedLines = valueLines.map((line, index) => {
    if (index === 0) {
      return prefix + line;
    }
    return indent + line;
  });

  return formattedLines.join('\n');
}

export function buildResponsiveDataRow(
  cells: TableBlockCell[],
  headers: string[],
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  const cellBlocks: string[] = [];

  for (let i = 0; i < cells.length; i++) {
    const header = i < headers.length ? headers[i] : `Column ${i + 1}`;
    cellBlocks.push(formatCellBlock(header, cells[i], layoutWidth));
  }

  const rowBody = cellBlocks.join('\n\n');
  const separator = buildResponsiveSeparatorLine(layoutWidth);
  return `${rowBody}\n${separator}`;
}
