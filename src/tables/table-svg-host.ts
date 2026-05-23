import { measureTextWidth } from '../parser/tables';
import {
  tableHtmlThemeForMode,
  type TableHtmlTheme,
  type TableRowData,
} from '../parser/tables-html';

export type TableSvgHostOptions = {
  theme: 'default' | 'dark';
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  /** Source line count; SVG is at least this tall so it covers hidden markdown rows. */
  numLines: number;
};

/** Horizontal inset inside a cell border (pixels). */
const CELL_PAD_X = 1;
/** Baseline offset from the top of a row's first text line (pixels). */
const CELL_TEXT_TOP = 1;

const MIN_COLUMN_DISPLAY_WIDTH = 1;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Use the first font in the editor font list, stripped of quotes. */
export function sanitizeFontFamily(fontFamily?: string): string {
  if (!fontFamily) {
    return 'sans-serif';
  }
  const first = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  return first.length > 0 ? first : 'sans-serif';
}

/**
 * Wrap plain text to fit a column using the same width metric as decorated tables.
 */
export function wrapTextToColumnWidth(text: string, maxDisplayWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (measureTextWidth(trial) > maxDisplayWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

/** Per-column display widths (character units) from cell content, matching decorated tables. */
export function computeColumnDisplayWidths(rows: TableRowData[]): number[] {
  let columnCount = 0;
  for (const row of rows) {
    columnCount = Math.max(columnCount, row.cells.length);
  }
  const widths = new Array(columnCount).fill(MIN_COLUMN_DISPLAY_WIDTH);
  for (const row of rows) {
    for (let i = 0; i < row.cells.length; i++) {
      const w = measureTextWidth(row.cells[i].text);
      if (w > widths[i]) {
        widths[i] = w;
      }
    }
  }
  return widths;
}

/**
 * Renders a GFM table as native SVG in the extension host (no webview required).
 */
export function renderTableSvgHost(
  rows: TableRowData[],
  options: TableSvgHostOptions,
  theme: TableHtmlTheme = tableHtmlThemeForMode(options.theme === 'dark')
): string {
  const fontSize = options.fontSize;
  const lineHeight = options.lineHeight;
  const charWidth = fontSize * 0.6;
  const fontFamily = sanitizeFontFamily(options.fontFamily);

  const columnDisplayWidths = computeColumnDisplayWidths(rows);
  if (columnDisplayWidths.length === 0 || rows.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';
  }

  const columnPixelWidths = columnDisplayWidths.map(
    (displayWidth) => displayWidth * charWidth + CELL_PAD_X * 2
  );
  const width = columnPixelWidths.reduce((sum, colWidth) => sum + colWidth, 0);

  const parts: string[] = [];
  let y = 0;

  for (const row of rows) {
    const cells = row.cells;
    const cellLinesList = cells.map((cell, columnIndex) =>
      wrapTextToColumnWidth(
        cell.text,
        columnDisplayWidths[columnIndex] ?? MIN_COLUMN_DISPLAY_WIDTH
      )
    );

    let rowHeight = lineHeight;
    for (const lines of cellLinesList) {
      const h = lines.length * lineHeight;
      if (h > rowHeight) {
        rowHeight = h;
      }
    }

    let x = 0;
    for (let c = 0; c < cells.length; c++) {
      const colWidth = columnPixelWidths[c] ?? columnPixelWidths[0];
      const bg = row.isHeader ? theme.headerBackground : theme.cellBackground;
      parts.push(
        `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" ` +
        `fill="${bg}" stroke="${theme.border}" stroke-width="1"/>`
      );

      const lines = cellLinesList[c];
      const cell = cells[c];
      let fontWeight = cell.cellStyle?.fontWeight ?? '';
      let fontStyle = cell.cellStyle?.fontStyle ?? '';
      const weightAttr = fontWeight ? ` font-weight="${fontWeight}"` : '';
      const styleAttr = fontStyle ? ` font-style="${fontStyle}"` : '';

      for (let li = 0; li < lines.length; li++) {
        const textY = y + CELL_TEXT_TOP + fontSize + li * lineHeight;
        parts.push(
          `<text x="${x + CELL_PAD_X}" y="${textY}" font-family="${escapeXml(fontFamily)}" ` +
          `font-size="${fontSize}" fill="${theme.foreground}"${weightAttr}${styleAttr}>${escapeXml(lines[li])}</text>`
        );
      }
      x += colWidth;
    }
    y += rowHeight;
  }

  const contentHeight = Math.max(1, y);
  const minSourceHeight = Math.max(1, options.numLines) * lineHeight;
  const totalHeight = Math.max(contentHeight, minSourceHeight);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" ` +
    `viewBox="0 0 ${width} ${totalHeight}">${parts.join('')}</svg>`
  );
}
