import type { TableBlock, TableBlockCell, TableBlockRow } from '../parser/types';
import { measureTextWidth } from '../parser/tables';
import {
  RESPONSIVE_LAYOUT_WIDTH,
  buildResponsiveSeparatorLine,
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

const ELLIPSIS = '...';

export function truncateToWidth(
  text: string,
  maxWidth: number,
  suffix: string = ELLIPSIS,
): string {
  if (maxWidth <= 0) {
    return suffix;
  }
  if (measureTextWidth(text) <= maxWidth) {
    return text;
  }

  const suffixWidth = measureTextWidth(suffix);
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measureTextWidth(text.slice(0, mid)) + suffixWidth <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low > 0 ? text.slice(0, low) + suffix : suffix;
}

export function buildCompactHeaderLine(
  headers: string[],
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  return truncateToWidth(headers.join(' | '), layoutWidth);
}

export function buildCompactSeparatorLine(
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  return buildResponsiveSeparatorLine(layoutWidth);
}

export function buildCompactDataRowLine(
  cells: TableBlockCell[],
  headers: string[],
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  const parts = cells.map((cell, index) => {
    const header = index < headers.length ? headers[index] : `Column ${index + 1}`;
    return `${header}: ${cell.displayText}`;
  });
  return truncateToWidth(parts.join(' | '), layoutWidth);
}

export function layoutResponsiveTableRow(
  table: TableBlock,
  rowIdx: number,
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string {
  if (rowIdx === 0) {
    return buildCompactHeaderLine(table.headers, layoutWidth);
  }
  if (rowIdx === 1) {
    return buildCompactSeparatorLine(layoutWidth);
  }

  const dataRow: TableBlockRow | undefined = table.rows[rowIdx - 2];
  if (!dataRow) {
    return '';
  }
  return buildCompactDataRowLine(dataRow.cells, table.headers, layoutWidth);
}

export function layoutResponsiveTable(
  table: TableBlock,
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string[] {
  return table.rowRanges.map((_, rowIdx) => layoutResponsiveTableRow(table, rowIdx, layoutWidth));
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isSeparatorLine(line: string): boolean {
  return /^-+$/.test(line.trim());
}

export function renderResponsiveRowSvg(
  line: string,
  options: ResponsiveTableSvgOptions,
): string {
  const layoutWidth = options.layoutWidth ?? RESPONSIVE_LAYOUT_WIDTH;
  const widthPx = Math.max(
    options.contentWidthPx,
    Math.round(layoutWidth * options.fontSize * 0.6) + 16,
  );
  const heightPx = options.lineHeight;

  const textElements: string[] = [];
  if (isSeparatorLine(line)) {
    const yLine = Math.round(options.lineHeight * 0.65);
    textElements.push(
      `<line x1="0" y1="${yLine}" x2="${widthPx}" y2="${yLine}" stroke="${options.theme.separator}" stroke-width="1"/>`,
    );
  } else {
    textElements.push(
      `<text x="0" y="${Math.round(options.lineHeight * 0.8)}" fill="${options.theme.foreground}" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(line)}</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">`,
    `<rect width="100%" height="100%" fill="transparent"/>`,
    ...textElements,
    '</svg>',
  ].join('');
}
