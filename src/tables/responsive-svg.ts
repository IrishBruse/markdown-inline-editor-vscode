import type { TableBlock, TableBlockCell } from '../parser/types';
import {
  RESPONSIVE_LAYOUT_WIDTH,
  buildResponsiveHeaderLine,
  buildResponsiveSeparatorLine,
  buildResponsiveDataRow,
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

export interface ResponsiveTableLayout {
  lines: string[];
  widthPx: number;
  heightPx: number;
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cellBlockLines(header: string, cell: TableBlockCell, layoutWidth: number): string[] {
  const rowText = buildResponsiveDataRow([cell], [header], layoutWidth);
  const withoutSeparator = rowText.replace(/\n-+$/, '');
  return withoutSeparator.split('\n');
}

export function layoutResponsiveTable(
  table: TableBlock,
  layoutWidth: number = RESPONSIVE_LAYOUT_WIDTH,
): string[] {
  const lines: string[] = [];

  for (const headerLine of buildResponsiveHeaderLine(table.headers, layoutWidth).split('\n')) {
    lines.push(headerLine);
  }
  lines.push(buildResponsiveSeparatorLine(layoutWidth));

  for (const row of table.rows) {
    for (let i = 0; i < row.cells.length; i++) {
      const header = i < table.headers.length ? table.headers[i] : `Column ${i + 1}`;
      const blockLines = cellBlockLines(header, row.cells[i], layoutWidth);
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(...blockLines);
    }
    lines.push(buildResponsiveSeparatorLine(layoutWidth));
  }

  return lines;
}

export function measureResponsiveTableLayout(
  table: TableBlock,
  options: ResponsiveTableSvgOptions,
): ResponsiveTableLayout {
  const layoutWidth = options.layoutWidth ?? RESPONSIVE_LAYOUT_WIDTH;
  const lines = layoutResponsiveTable(table, layoutWidth);
  const widthPx = Math.max(options.contentWidthPx, Math.round(layoutWidth * options.fontSize * 0.6) + 16);
  const heightPx = Math.max(options.lineHeight, lines.length * options.lineHeight + 8);
  return { lines, widthPx, heightPx };
}

export function renderResponsiveTableSvg(
  table: TableBlock,
  options: ResponsiveTableSvgOptions,
): string {
  const layoutWidth = options.layoutWidth ?? RESPONSIVE_LAYOUT_WIDTH;
  const { lines, widthPx, heightPx } = measureResponsiveTableLayout(table, options);

  const textElements: string[] = [];
  let y = options.lineHeight;

  for (const line of lines) {
    const isSeparator = /^-+$/.test(line.trim());
    if (isSeparator) {
      const yLine = y - Math.round(options.lineHeight * 0.35);
      textElements.push(
        `<line x1="0" y1="${yLine}" x2="${widthPx}" y2="${yLine}" stroke="${options.theme.separator}" stroke-width="1"/>`,
      );
    } else {
      textElements.push(
        `<text x="0" y="${y}" fill="${options.theme.foreground}" font-family="${escapeSvgText(options.fontFamily)}" font-size="${options.fontSize}px">${escapeSvgText(line)}</text>`,
      );
    }
    y += options.lineHeight;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">`,
    `<rect width="100%" height="100%" fill="transparent"/>`,
    ...textElements,
    '</svg>',
  ].join('');
}
