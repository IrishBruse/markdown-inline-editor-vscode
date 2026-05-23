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
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
};

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

const DEFAULT_THEME: TableHtmlTheme = {
  foreground: '#cccccc',
  border: '#3c3c3c',
  headerBackground: '#2d2d2d',
  cellBackground: 'transparent',
};

const LIGHT_THEME: TableHtmlTheme = {
  foreground: '#333333',
  border: '#cccccc',
  headerBackground: '#f3f3f3',
  cellBackground: 'transparent',
};

export function tableHtmlThemeForMode(darkMode: boolean): TableHtmlTheme {
  return darkMode ? DEFAULT_THEME : LIGHT_THEME;
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
): string {
  const parts = [
    'word-wrap:break-word',
    'overflow-wrap:break-word',
    'vertical-align:top',
    'padding:0 1px',
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
      const align = i < colAligns.length ? colAligns[i] : null;
      cells.push({ text, align, cellStyle });
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
  theme: TableHtmlTheme = DEFAULT_THEME,
): string {
  const rowsHtml: string[] = [];

  for (const row of rows) {
    const cellsHtml: string[] = [];
    const tag = row.isHeader ? 'th' : 'td';
    const bg = row.isHeader ? theme.headerBackground : theme.cellBackground;

    for (const cell of row.cells) {
      const style = [
        cellInlineStyle(cell.cellStyle, cell.align),
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
