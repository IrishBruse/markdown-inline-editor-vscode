import type {
  Delete,
  Emphasis,
  InlineCode,
  Node,
  Strong,
  Table,
  TableCell,
  Text,
} from 'mdast';
import type { ScopeRange, TableBlock, TableBlockCell, TableBlockRow } from './types';
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

export function measureTextWidth(plain: string): number {
  let width = 0;
  let cjkCount = 0;
  for (const char of plain) {
    const code = char.codePointAt(0)!;
    if (
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0x20000 && code <= 0x2fa1f)
    ) {
      width += 2;
      cjkCount++;
    } else {
      width += 1;
    }
  }
  return width + Math.ceil(cjkCount * 0.25);
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

export function buildTableBlockFromNode(node: Table, source: string): TableBlock | null {
  if (!node.position || node.position.start.offset === undefined || node.position.end.offset === undefined) {
    return null;
  }
  if (node.children.length === 0) {
    return null;
  }

  const tableStart = node.position.start.offset;
  const tableEnd = node.position.end.offset;
  const colWidths = computeColumnWidths(node, source);
  const colAligns = node.align ?? [];
  const rowRanges: { startPos: number; endPos: number }[] = [];

  const buildCellsForRow = (rowIdx: number): TableBlockCell[] => {
    const row = node.children[rowIdx];
    if (!row.position || row.position.start.offset === undefined) {
      return [];
    }

    const rowStartOffset = row.position.start.offset;
    const [lineStart, lineEnd] = getLineRange(source, rowStartOffset);
    const trimmedLineEnd = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmedLineEnd);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmedLineEnd, rawPipes);

    const cells: TableBlockCell[] = [];
    for (let i = 0; i < pipes.length - 1; i++) {
      const cellRangeStart = pipes[i] + 1;
      const cellRangeEnd = pipes[i + 1];
      if (cellRangeStart >= cellRangeEnd) {
        continue;
      }

      const rawContent = source.substring(cellRangeStart, cellRangeEnd);
      const trimmedContent = rawContent.trim();
      const cellStyle = detectCellStyle(trimmedContent);
      const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
      const showRaw = !cellStyle && astCell !== undefined && cellHasMixedFormatting(astCell);
      const displayText = (astCell && !showRaw)
        ? extractCellPlainText(astCell)
        : trimmedContent;

      cells.push({
        displayText,
        cellStyle,
        showRaw,
      });
    }

    return cells;
  };

  const headerRow = node.children[0];
  if (!headerRow.position || headerRow.position.start.offset === undefined || headerRow.position.end.offset === undefined) {
    return null;
  }

  const headers = buildCellsForRow(0).map((cell) => cell.displayText);
  rowRanges.push({
    startPos: headerRow.position.start.offset,
    endPos: headerRow.position.end.offset,
  });

  const headerEndOffset = headerRow.position.end.offset;
  let sepLineStart = source.indexOf('\n', headerEndOffset);
  if (sepLineStart !== -1) {
    sepLineStart += 1;
    let sepLineEnd: number;
    if (node.children.length > 1 && node.children[1].position) {
      const nextRowStart = node.children[1].position.start.offset!;
      sepLineEnd = source.lastIndexOf('\n', nextRowStart - 1);
      if (sepLineEnd === -1 || sepLineEnd < sepLineStart) {
        sepLineEnd = nextRowStart;
      }
    } else {
      sepLineEnd = source.indexOf('\n', sepLineStart);
      if (sepLineEnd === -1) {
        sepLineEnd = tableEnd;
      }
    }
    rowRanges.push({ startPos: sepLineStart, endPos: sepLineEnd });
  }

  const rows: TableBlockRow[] = [];
  for (let rowIdx = 1; rowIdx < node.children.length; rowIdx++) {
    const row = node.children[rowIdx];
    if (!row.position || row.position.start.offset === undefined || row.position.end.offset === undefined) {
      continue;
    }
    rows.push({ cells: buildCellsForRow(rowIdx) });
    rowRanges.push({
      startPos: row.position.start.offset,
      endPos: row.position.end.offset,
    });
  }

  return {
    startPos: tableStart,
    endPos: tableEnd,
    headers,
    rows,
    colWidths,
    colAligns,
    rowRanges,
  };
}
