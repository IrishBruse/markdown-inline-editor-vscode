import type {
  Delete,
  Emphasis,
  InlineCode,
  Node,
  TableRow,
  Strong,
  Table,
  TableCell,
  Text,
} from 'mdast';
import type { ScopeRange, TableBlock } from './types';
import { addScope } from './common';

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

/** True when a code point is typically rendered at double ASCII width in monospace. */
export function isWideMonospaceChar(code: number): boolean {
  return (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0x20000 && code <= 0x2fa1f) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2600 && code <= 0x27bf) ||
    (code >= 0x1f300 && code <= 0x1faff)
  );
}

export function measureTextWidth(plain: string): number {
  let width = 0;
  let wideCount = 0;
  for (const char of plain) {
    const code = char.codePointAt(0)!;
    if (isWideMonospaceChar(code)) {
      width += 2;
      wideCount++;
    } else {
      width += 1;
    }
  }
  return width + Math.ceil(wideCount * 0.25);
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

export function computeColumnWidths(tableNode: Table, source: string): number[] {
  let numCols = 0;

  for (const row of tableNode.children) {
    if (!row.position || row.position.start.offset === undefined) continue;
    const [lineStart, lineEnd] = getLineRange(source, row.position.start.offset);
    const trimmed = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmed);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmed, rawPipes);
    const cellCount = Math.max(0, pipes.length - 1);
    if (cellCount > numCols) numCols = cellCount;
  }

  const widths: number[] = new Array(numCols).fill(3);

  for (const row of tableNode.children) {
    if (!row.position || row.position.start.offset === undefined) continue;
    const [lineStart, lineEnd] = getLineRange(source, row.position.start.offset);
    const trimmed = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmed);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmed, rawPipes);

    for (let i = 0; i < pipes.length - 1 && i < numCols; i++) {
      const cellText = source.substring(pipes[i] + 1, pipes[i + 1]).trim();
      const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
      const cellStyle = detectCellStyle(cellText);
      const showRaw = !cellStyle && astCell && cellHasMixedFormatting(astCell);
      const displayText = (astCell && !showRaw)
        ? extractCellPlainText(astCell)
        : cellText;
      const width = measureTextWidth(displayText);
      if (width > widths[i]) widths[i] = width;
    }
  }

  return widths;
}

export function addTableScope(scopes: ScopeRange[], tableStart: number, tableEnd: number): void {
  addScope(scopes, tableStart, tableEnd, 'table');
}

function extractRowCells(row: TableRow): string[] {
  return row.children.map((cell) => extractCellPlainText(cell as TableCell));
}

/**
 * Build a plain-text table block for custom SVG rendering.
 */
export function buildTableBlock(node: Table, source: string): TableBlock | null {
  if (
    !node.position ||
    node.position.start.offset === undefined ||
    node.position.end.offset === undefined
  ) {
    return null;
  }

  if (node.children.length === 0) {
    return null;
  }

  const startPos = node.position.start.offset;
  const endPos = node.position.end.offset;
  const tableText = source.slice(startPos, endPos);
  const numLines = tableText.length === 0 ? 0 : (tableText.match(/\n/g)?.length ?? 0) + 1;

  const header = extractRowCells(node.children[0]);
  if (header.length === 0) {
    return null;
  }

  const colCount = header.length;
  const rows: string[][] = [];
  for (let i = 1; i < node.children.length; i++) {
    const rowCells = extractRowCells(node.children[i]);
    if (rowCells.length !== colCount) {
      return null;
    }
    rows.push(rowCells);
  }

  return {
    startPos,
    endPos,
    numLines,
    header,
    rows,
    align: node.align ?? [],
  };
}
