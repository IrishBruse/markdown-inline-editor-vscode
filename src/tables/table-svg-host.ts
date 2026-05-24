import { measureTextWidth } from '../parser/tables';
import type { TableCellData, TableHtmlTheme, TableRowData } from '../parser/tables-html';

export type TableSvgHostOptions = {
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  /** Source line count; SVG is at least this tall so it covers hidden markdown rows. */
  numLines: number;
};

/** Symmetric horizontal inset inside a cell border, in character widths per side. */
const CELL_PAD_SPACES = 2;
/** Baseline offset from the top of a source line (pixels). */
const CELL_TEXT_TOP = 1;

const MIN_COLUMN_DISPLAY_WIDTH = 1;

/** Source line index of the GFM `|---|---|` separator row. */
export const TABLE_SEPARATOR_SOURCE_LINE = 1;

/**
 * Maps a parsed table row index to the source line index in the markdown.
 * Line 1 is always the `|---|---|` separator and has no rendered row.
 */
export function getSourceLineIndex(rowIndex: number): number {
  return rowIndex === 0 ? 0 : rowIndex + 1;
}

/** Vertical center of the separator row (where `---` sits in source). */
export function getSeparatorBorderY(lineHeight: number): number {
  return (TABLE_SEPARATOR_SOURCE_LINE + 0.5) * lineHeight;
}

/** Top Y for a row background rect (header/body meet at the separator midpoint). */
export function getRowRectY(rowIndex: number, lineHeight: number): number {
  if (rowIndex === 0) {
    return 0;
  }
  if (rowIndex === 1) {
    return getSeparatorBorderY(lineHeight);
  }
  return getSourceLineIndex(rowIndex) * lineHeight;
}

/** Source line used to align cell text with editor lines. */
export function getRowTextSourceLine(rowIndex: number): number {
  return rowIndex === 0 ? 0 : getSourceLineIndex(rowIndex);
}

/** Minimum rect height so header and first body row share the separator line. */
export function getRowMinRectHeight(rowIndex: number, lineHeight: number): number {
  if (rowIndex === 0 || rowIndex === 1) {
    return lineHeight * 1.5;
  }
  return lineHeight;
}

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

/**
 * Display width for one cell when sizing columns.
 * Matches decorated-table `computeColumnWidths`: trimmed content only, no source
 * padding spaces (those only align pipes in the markdown source).
 */
export function cellContentDisplayWidth(cell: TableCellData): number {
  return measureTextWidth(cell.text);
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
      const w = cellContentDisplayWidth(row.cells[i]);
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
  theme: TableHtmlTheme,
): string {
  const fontSize = options.fontSize;
  const lineHeight = options.lineHeight;
  const charWidth = fontSize * 0.6;
  const cellPadX = CELL_PAD_SPACES * charWidth;
  const fontFamily = sanitizeFontFamily(options.fontFamily);

  const columnDisplayWidths = computeColumnDisplayWidths(rows);
  if (columnDisplayWidths.length === 0 || rows.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';
  }

  const columnPixelWidths = columnDisplayWidths.map(
    (displayWidth) => displayWidth * charWidth + cellPadX * 2,
  );
  const width = columnPixelWidths.reduce((sum, colWidth) => sum + colWidth, 0);

  const parts: string[] = [];
  const sourceLineCount = Math.max(options.numLines, getSourceLineIndex(rows.length - 1) + 1);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const cells = row.cells;
    const y = getRowRectY(rowIndex, lineHeight);
    const textSourceLine = getRowTextSourceLine(rowIndex);
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
    rowHeight = Math.max(rowHeight, getRowMinRectHeight(rowIndex, lineHeight));

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

      const align = cell.align;
      let textX = x + cellPadX;
      let anchorAttr = '';
      if (align === 'center') {
        textX = x + colWidth / 2;
        anchorAttr = ' text-anchor="middle"';
      } else if (align === 'right') {
        textX = x + colWidth - cellPadX;
        anchorAttr = ' text-anchor="end"';
      }

      const textBaseY = textSourceLine * lineHeight;
      for (let li = 0; li < lines.length; li++) {
        const textY = textBaseY + CELL_TEXT_TOP + fontSize + li * lineHeight;
        parts.push(
          `<text x="${textX}" y="${textY}" font-family="${escapeXml(fontFamily)}" ` +
          `font-size="${fontSize}" fill="${theme.foreground}"${weightAttr}${styleAttr}${anchorAttr}>` +
          `${escapeXml(lines[li])}</text>`
        );
      }
      x += colWidth;
    }
  }

  const totalHeight = Math.max(1, sourceLineCount) * lineHeight;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" ` +
    `viewBox="0 0 ${width} ${totalHeight}">${parts.join('')}</svg>`
  );
}
