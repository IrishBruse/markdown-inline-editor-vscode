import type { Table, TableCell } from 'mdast';
import {
  cellHasMixedFormatting,
  detectCellStyle,
  extractCellPlainText,
  findPipePositions,
  getLineRange,
  normalizePipePositions,
  trimLineEnd,
} from './tables';

export type TableCellData = {
  text: string;
  align: 'left' | 'center' | 'right' | null;
  /** Spaces/tabs between `|` and cell content in source. */
  leadingSpaces?: number;
  /** Spaces/tabs between cell content and `|` in source. */
  trailingSpaces?: number;
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
};

/** Counts leading/trailing whitespace in raw cell text (between pipes). */
export function countSourceEdgeSpaces(raw: string): { leading: number; trailing: number } {
  let leading = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ' ' || ch === '\t') {
      leading++;
    } else {
      break;
    }
  }

  let trailing = 0;
  for (let i = raw.length - 1; i >= leading; i--) {
    const ch = raw[i];
    if (ch === ' ' || ch === '\t') {
      trailing++;
    } else {
      break;
    }
  }

  return { leading, trailing };
}

export type TableRowData = {
  isHeader: boolean;
  cells: TableCellData[];
};

export type TableHtmlTheme = {
  foreground: string;
  border: string;
  headerBackground: string;
  cellBackground: string;
};

const DARK_FALLBACK_THEME: TableHtmlTheme = {
  foreground: '#cccccc',
  border: '#3c3c3c',
  headerBackground: '#2a2d2e',
  cellBackground: '#1e1e1e',
};

const LIGHT_FALLBACK_THEME: TableHtmlTheme = {
  foreground: '#333333',
  border: '#cccccc',
  headerBackground: '#f3f3f3',
  cellBackground: '#ffffff',
};

/** Fallback palette when VS Code theme colors cannot be resolved (e.g. in tests). */
export function getTableThemeFallback(darkMode: boolean): TableHtmlTheme {
  return darkMode ? DARK_FALLBACK_THEME : LIGHT_FALLBACK_THEME;
}

/** @deprecated Use getTableThemeColors() for live theme; this is test/fallback only. */
export function tableHtmlThemeForMode(darkMode: boolean): TableHtmlTheme {
  return getTableThemeFallback(darkMode);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellInlineStyle(
  cellStyle: TableCellData['cellStyle'],
  textAlign: 'left' | 'center' | 'right' | null,
  leadingSpaces = 0,
  trailingSpaces = 0,
): string {
  const padLeft =
    leadingSpaces > 0 ? `calc(4px + ${leadingSpaces}ch)` : '4px';
  const padRight =
    textAlign === 'right' && trailingSpaces > 0
      ? `calc(4px + ${trailingSpaces}ch)`
      : '4px';
  const parts = [
    'word-wrap:break-word',
    'overflow-wrap:break-word',
    'vertical-align:top',
    `padding:0 ${padRight} 0 ${padLeft}`,
  ];
  if (textAlign === 'center') {
    parts.push('text-align:center');
  } else if (textAlign === 'right') {
    parts.push('text-align:right');
  } else {
    parts.push('text-align:left');
  }
  if (cellStyle?.fontWeight) {
    parts.push(`font-weight:${cellStyle.fontWeight}`);
  }
  if (cellStyle?.fontStyle) {
    parts.push(`font-style:${cellStyle.fontStyle}`);
  }
  if (cellStyle?.textDecoration) {
    parts.push(`text-decoration:${cellStyle.textDecoration}`);
  }
  return parts.join(';');
}

function getCellDisplay(
  astCell: TableCell | undefined,
  rawContent: string,
): { text: string; cellStyle: TableCellData['cellStyle'] } {
  const trimmedContent = rawContent.trim();
  const cellStyle = detectCellStyle(trimmedContent);
  const showRaw = !cellStyle && astCell && cellHasMixedFormatting(astCell);
  const text = astCell && !showRaw
    ? extractCellPlainText(astCell)
    : trimmedContent;
  return { text, cellStyle };
}

/**
 * Extracts structured row/cell data from a GFM table AST node.
 */
export function extractTableRowData(node: Table, source: string): {
  rows: TableRowData[];
  columnCount: number;
} {
  const colAligns = node.align ?? [];
  let columnCount = 0;
  const rows: TableRowData[] = [];

  for (let rowIdx = 0; rowIdx < node.children.length; rowIdx++) {
    const row = node.children[rowIdx];
    if (!row.position || row.position.start.offset === undefined) {
      continue;
    }

    const rowStartOffset = row.position.start.offset;
    const [lineStart, lineEnd] = getLineRange(source, rowStartOffset);
    const trimmedLineEnd = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmedLineEnd);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmedLineEnd, rawPipes);
    const cellCount = Math.max(0, pipes.length - 1);
    if (cellCount > columnCount) {
      columnCount = cellCount;
    }

    const cells: TableCellData[] = [];
    for (let i = 0; i < pipes.length - 1; i++) {
      const cellRangeStart = pipes[i] + 1;
      const cellRangeEnd = pipes[i + 1];
      if (cellRangeStart >= cellRangeEnd) {
        continue;
      }

      const rawContent = source.substring(cellRangeStart, cellRangeEnd);
      const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
      const { text, cellStyle } = getCellDisplay(astCell, rawContent);
      const { leading, trailing } = countSourceEdgeSpaces(rawContent);
      const align = i < colAligns.length ? colAligns[i] : null;
      cells.push({
        text,
        align,
        cellStyle,
        leadingSpaces: leading,
        trailingSpaces: trailing,
      });
    }

    if (cells.length > 0) {
      rows.push({ isHeader: rowIdx === 0, cells });
    }
  }

  return { rows, columnCount };
}

/**
 * Builds an HTML table string for custom (preview-style) rendering.
 */
export function buildTableHtml(
  rows: TableRowData[],
  theme: TableHtmlTheme = DARK_FALLBACK_THEME,
): string {
  const rowsHtml: string[] = [];

  for (const row of rows) {
    const cellsHtml: string[] = [];
    const tag = row.isHeader ? 'th' : 'td';
    const bg = row.isHeader ? theme.headerBackground : theme.cellBackground;

    for (const cell of row.cells) {
      const style = [
        cellInlineStyle(
          cell.cellStyle,
          cell.align,
          cell.leadingSpaces ?? 0,
          cell.trailingSpaces ?? 0,
        ),
        `border:1px solid ${theme.border}`,
        `color:${theme.foreground}`,
        `background:${bg}`,
      ].join(';');

      cellsHtml.push(
        `<${tag} style="${style}">${escapeHtml(cell.text)}</${tag}>`,
      );
    }

    if (cellsHtml.length > 0) {
      rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
    }
  }

  const tableStyle = [
    'border-collapse:collapse',
    'table-layout:fixed',
    'width:100%',
    `color:${theme.foreground}`,
    `border:1px solid ${theme.border}`,
  ].join(';');

  return `<table style="${tableStyle}"><tbody>${rowsHtml.join('')}</tbody></table>`;
}

export function countTableSourceLines(source: string, startPos: number, endPos: number): number {
  let numLines = 1;
  for (let i = startPos; i < endPos && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      numLines++;
    }
  }
  return numLines;
}
