import type {
  Delete,
  Emphasis,
  InlineCode,
  Node,
  Strong,
  TableCell,
  TableRow,
  Text,
} from 'mdast';
import type { ScopeRange } from './types';
import { addScope, hasValidPosition } from './common';

export function extractCellPlainText(cell: TableCell): string {
  const walk = (node: Node): string => {
    switch (node.type) {
      case 'text':
        return (node as Text).value;
      case 'inlineCode':
        return (node as InlineCode).value;
      case 'strong':
      case 'emphasis':
      case 'delete': {
        const parent = node as Strong | Emphasis | Delete;
        return parent.children.map(walk).join('');
      }
      default: {
        const asParent = node as { children?: Node[] };
        return asParent.children ? asParent.children.map(walk).join('') : '';
      }
    }
  };

  return cell.children.map(walk).join('');
}

/**
 * True when the cell AST contains strong, emphasis, delete, or inlineCode.
 * Used to choose raw cell text vs `extractCellPlainText` for display width.
 * This does **not** treat links or images as mixed (see `MarkdownParser` rich-native check).
 */
export function cellHasMixedFormatting(cell: TableCell): boolean {
  return cell.children.some((child) =>
    child.type === 'strong' || child.type === 'emphasis' ||
    child.type === 'delete' || child.type === 'inlineCode'
  );
}

export function detectCellStyle(
  trimmed: string,
): { fontWeight?: string; fontStyle?: string; textDecoration?: string } | undefined {
  if (
    (trimmed.startsWith('***') && trimmed.endsWith('***')) ||
    (trimmed.startsWith('___') && trimmed.endsWith('___'))
  ) {
    return { fontWeight: 'bold', fontStyle: 'italic' };
  }
  if (
    (trimmed.startsWith('**') && trimmed.endsWith('**')) ||
    (trimmed.startsWith('__') && trimmed.endsWith('__'))
  ) {
    return { fontWeight: 'bold' };
  }
  if (trimmed.startsWith('~~') && trimmed.endsWith('~~')) {
    return { textDecoration: 'line-through' };
  }
  if (
    (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) ||
    (trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2)
  ) {
    return { fontStyle: 'italic' };
  }
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2) {
    return { fontWeight: 'normal' };
  }
  return undefined;
}

export function isWideCodePoint(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f000 && code <= 0x1faff) ||
    (code >= 0x2600 && code <= 0x27bf) ||
    (code >= 0x20000 && code <= 0x2fa1f) ||
    (code >= 0x1f1e6 && code <= 0x1f1ff)
  );
}

export function isZeroWidthCodePoint(code: number): boolean {
  return (
    code === 0x200d ||
    code === 0x200c ||
    code === 0xfeff ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    (code >= 0xe0100 && code <= 0xe01ef) ||
    (code >= 0x0300 && code <= 0x036f)
  );
}

/**
 * Display width for **column budgeting** (max column width), with wide-glyph overshoot.
 */
export function measureTextWidth(plain: string): number {
  let width = 0;
  let wideOvershoot = 0;
  for (const char of plain) {
    const code = char.codePointAt(0)!;
    if (isWideCodePoint(code)) {
      width += 2;
      wideOvershoot += 0.5;
    } else if (!isZeroWidthCodePoint(code)) {
      width += 1;
    }
  }
  return width + Math.ceil(wideOvershoot);
}

/**
 * Literal monospace column count without wide overshoot (for NBSP padding).
 */
export function measureRenderedWidth(plain: string): number {
  let width = 0;
  for (const char of plain) {
    const code = char.codePointAt(0)!;
    if (isWideCodePoint(code)) {
      width += 2;
    } else if (!isZeroWidthCodePoint(code)) {
      width += 1;
    }
  }
  return width;
}

export function findPipePositions(
  text: string,
  lineStart: number,
  lineEnd: number,
): number[] {
  const pipes: number[] = [];
  for (let i = lineStart; i < lineEnd; i++) {
    if (text[i] === '|') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= lineStart && text[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        pipes.push(i);
      }
    }
  }
  return pipes;
}

export function normalizePipePositions(
  text: string,
  lineStart: number,
  trimmedLineEnd: number,
  pipes: number[],
): { positions: number[]; isVirtual: boolean[] } {
  if (pipes.length === 0) {
    return { positions: pipes, isVirtual: [] };
  }

  const positions = [...pipes];
  const isVirtual = new Array(pipes.length).fill(false);

  let firstContentPos = lineStart;
  while (firstContentPos < trimmedLineEnd && (text[firstContentPos] === ' ' || text[firstContentPos] === '\t')) {
    firstContentPos++;
  }

  if (pipes[0] !== firstContentPos) {
    const virtualLead = firstContentPos > lineStart ? firstContentPos - 1 : -1;
    positions.unshift(virtualLead);
    isVirtual.unshift(true);
  }

  if (pipes[pipes.length - 1] < trimmedLineEnd - 1) {
    positions.push(trimmedLineEnd);
    isVirtual.push(true);
  }

  return { positions, isVirtual };
}

/**
 * Pipe column boundaries from remark-gfm `TableCell` positions (cell starts
 * act as interior pipe indices, plus optional leading and trailing `|`).
 */
export function getAstTablePipeOffsetsFromRow(
  row: TableRow,
  text: string,
): number[] | null {
  const cells = row.children;
  if (cells.length === 0) {
    return null;
  }
  for (const c of cells) {
    if (!hasValidPosition(c as Node)) {
      return null;
    }
  }

  const pipes: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const start = (cells[i] as TableCell).position!.start.offset!;
    if (i === 0) {
      if (text[start] === '|') {
        pipes.push(start);
      }
    } else {
      pipes.push(start);
    }
  }

  const lastCell = cells[cells.length - 1] as TableCell;
  const endOff = lastCell.position!.end.offset!;
  const trailingIdx = endOff - 1;
  if (
    trailingIdx >= 0 &&
    text[trailingIdx] === '|' &&
    (pipes.length === 0 || pipes[pipes.length - 1] !== trailingIdx)
  ) {
    pipes.push(trailingIdx);
  }

  for (let k = 1; k < pipes.length; k++) {
    if (pipes[k] <= pipes[k - 1]) {
      return null;
    }
  }

  return pipes;
}

export function getTableRowPipeLayout(
  row: TableRow,
  text: string,
  lineStart: number,
  trimmedLineEnd: number,
): { positions: number[]; isVirtual: boolean[] } {
  const astPipes = getAstTablePipeOffsetsFromRow(row, text);
  let rawPipes: number[];
  if (
    astPipes !== null &&
    astPipes.length > 0 &&
    astPipes.every((p) => p >= lineStart && p < trimmedLineEnd)
  ) {
    rawPipes = astPipes;
  } else {
    rawPipes = findPipePositions(text, lineStart, trimmedLineEnd);
  }
  return normalizePipePositions(
    text,
    lineStart,
    trimmedLineEnd,
    rawPipes,
  );
}

export function getLineRange(text: string, offset: number): [number, number] {
  const lineStart = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  return [lineStart, lineEnd];
}

export function trimLineEnd(text: string, lineStart: number, lineEnd: number): number {
  let end = lineEnd;
  while (
    end > lineStart &&
    (text[end - 1] === ' ' || text[end - 1] === '\t')
  ) {
    end--;
  }
  return end;
}

const TABLE_CELL_NBSP = '\u00A0';

/** GFM column alignment from `Table.align` entries. */
export type GfmColumnAlign = 'left' | 'right' | 'center' | null | undefined;

/**
 * NBSP repeat counts for leading and trailing cell padding (includes gutter next to pipes).
 * Shared by native pad splits and synthetic `tableCell` replacement strings.
 */
export function leadingTrailingNbspRepeatCounts(
  align: GfmColumnAlign,
  totalPad: number,
): { leading: number; trailing: number } {
  if (align === 'right') {
    return { leading: totalPad + 1, trailing: 1 };
  }
  if (align === 'center') {
    const padLeft = Math.floor(totalPad / 2);
    const padRight = totalPad - padLeft;
    return { leading: padLeft + 1, trailing: padRight + 1 };
  }
  return { leading: 1, trailing: totalPad + 1 };
}

export function buildSyntheticTableCellReplacement(
  align: GfmColumnAlign,
  totalPad: number,
  displayContent: string,
): string {
  const { leading, trailing } = leadingTrailingNbspRepeatCounts(align, totalPad);
  return TABLE_CELL_NBSP.repeat(leading) + displayContent + TABLE_CELL_NBSP.repeat(trailing);
}

export function buildNativeTableCellPadParts(
  align: GfmColumnAlign,
  totalPad: number,
): { leadingNbsp: string; trailingNbsp: string } {
  const { leading, trailing } = leadingTrailingNbspRepeatCounts(align, totalPad);
  return {
    leadingNbsp: TABLE_CELL_NBSP.repeat(leading),
    trailingNbsp: TABLE_CELL_NBSP.repeat(trailing),
  };
}

export function addTableScope(scopes: ScopeRange[], tableStart: number, tableEnd: number): void {
  addScope(scopes, tableStart, tableEnd, 'table');
}
