import { measureTextWidth } from '../parser/tables';
import {
  tableHtmlThemeForMode,
  type TableHtmlTheme,
  type TableRowData,
} from '../parser/tables-html';

export type TableSvgHostOptions = {
  theme: 'default' | 'dark';
  contentWidth: number;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  /** Source line count; SVG is at least this tall so it covers hidden markdown rows. */
  numLines: number;
};

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
 * Renders a GFM table as native SVG in the extension host (no webview required).
 */
export function renderTableSvgHost(
  rows: TableRowData[],
  options: TableSvgHostOptions,
  theme: TableHtmlTheme = tableHtmlThemeForMode(options.theme === 'dark')
): string {
  const width = Math.max(200, options.contentWidth);
  const fontSize = options.fontSize;
  const lineHeight = options.lineHeight;
  const pad = 8;
  const fontFamily = sanitizeFontFamily(options.fontFamily);

  let columnCount = 0;
  for (const row of rows) {
    columnCount = Math.max(columnCount, row.cells.length);
  }
  if (columnCount === 0 || rows.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1" viewBox="0 0 ${width} 1"></svg>`;
  }

  const colWidth = width / columnCount;
  // Convert pixel column inner width to display-width units (matches parser/tables.ts)
  const maxDisplayWidth = Math.max(
    3,
    Math.floor((colWidth - pad * 2) / (fontSize * 0.6))
  );

  const parts: string[] = [];
  let y = 0;

  for (const row of rows) {
    const cells = row.cells;
    const cellLinesList = cells.map((cell) => wrapTextToColumnWidth(cell.text, maxDisplayWidth));

    let rowHeight = pad * 2;
    for (const lines of cellLinesList) {
      const h = lines.length * lineHeight + pad * 2;
      if (h > rowHeight) {
        rowHeight = h;
      }
    }

    let x = 0;
    for (let c = 0; c < cells.length; c++) {
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
        const textY = y + pad + fontSize + li * lineHeight;
        parts.push(
          `<text x="${x + pad}" y="${textY}" font-family="${escapeXml(fontFamily)}" ` +
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
