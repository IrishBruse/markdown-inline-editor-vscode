import type {
  Delete,
  Emphasis,
  Image,
  InlineCode,
  Link,
  Node,
  Strong,
  Table,
  TableCell,
  Text,
} from 'mdast';

export function extractCellPlainText(cell: TableCell): string {
  const walk = (node: Node): string => {
    switch (node.type) {
      case 'text':
        return (node as Text).value;
      case 'inlineCode':
        return (node as InlineCode).value;
      case 'link':
        return (node as Link).children.map(walk).join('');
      case 'image':
        return (node as Image).alt ?? '';
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
    child.type === 'delete' || child.type === 'inlineCode',
  );
}

export function isLinkOnlyCell(cell: TableCell): boolean {
  return cell.children.length === 1 && cell.children[0].type === 'link';
}

export function linkOnlyCellUrl(cell: TableCell): string {
  const child = cell.children[0] as { url?: string };
  return child.url ?? '';
}

/** Glyph shown in inline-rendered table cells that contain only an image. */
export const TABLE_CELL_IMAGE_ICON = '\u2B14';

export function isImageOnlyCell(cell: TableCell): boolean {
  return cell.children.length === 1 && cell.children[0].type === 'image';
}

export function imageOnlyCellUrl(cell: TableCell): string {
  const child = cell.children[0] as Image;
  return child.url ?? '';
}

function isWideCodePoint(code: number): boolean {
  if (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0x20000 && code <= 0x2fa1f) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x2600 && code <= 0x27bf) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x1f1e6 && code <= 0x1f1ff)
  ) {
    return true;
  }
  return false;
}

function isZeroWidthCodePoint(code: number): boolean {
  return code === 0x200d || code === 0xfe0f;
}

export function measureTextWidth(plain: string, options?: { cjkCorrection?: boolean }): number {
  let width = 0;
  let cjkCount = 0;
  for (const char of plain) {
    const code = char.codePointAt(0)!;
    if (isZeroWidthCodePoint(code)) {
      continue;
    }
    if (isWideCodePoint(code)) {
      width += 2;
      if (
        (code >= 0x2e80 && code <= 0x9fff) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe4f) ||
        (code >= 0x20000 && code <= 0x2fa1f)
      ) {
        cjkCount++;
      }
    } else {
      width += 1;
    }
  }
  if (options?.cjkCorrection && cjkCount > 0) {
    return width + Math.ceil(cjkCount * 0.25);
  }
  return width;
}

/**
 * Padded replacement that fills the source cell span between pipes.
 * Padding uses NBSP so VS Code preserves monospace width in before.contentText
 * (regular spaces collapse and break pipe column alignment).
 */
export function buildTableCellReplacement(
  rawContent: string,
  displayContent: string,
  displayWidth: number,
  align: 'left' | 'right' | 'center' | null,
): string {
  const sourceWidth = measureTextWidth(rawContent);
  const totalPad = Math.max(0, sourceWidth - displayWidth - 2);
  const pad = '\u00A0';

  if (align === 'right') {
    return pad.repeat(totalPad + 1) + displayContent + pad;
  }
  if (align === 'center') {
    const padLeft = Math.floor(totalPad / 2);
    const padRight = totalPad - padLeft;
    return pad.repeat(padLeft + 1) + displayContent + pad.repeat(padRight + 1);
  }
  return pad + displayContent + pad.repeat(totalPad + 1);
}

export function detectCellStyle(
  trimmed: string,
): { fontWeight?: string; fontStyle?: string; textDecoration?: string; inlineCode?: boolean } | undefined {
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
    return { inlineCode: true };
  }
  return undefined;
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

function cellDisplayText(
  cellText: string,
  astCell: TableCell | undefined,
  showRaw: boolean,
): string {
  if (astCell && !showRaw && isImageOnlyCell(astCell)) {
    return TABLE_CELL_IMAGE_ICON;
  }
  if (astCell && !showRaw) {
    return extractCellPlainText(astCell);
  }
  return cellText.trim();
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

  const widths: number[] = new Array(numCols).fill(1);

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
      const showRaw = !cellStyle && astCell !== undefined && cellHasMixedFormatting(astCell);
      const displayText = cellDisplayText(cellText, astCell, showRaw);
      const width = measureTextWidth(displayText);
      if (width > widths[i]) widths[i] = width;
    }
  }

  return widths;
}

export function buildSeparatorDashReplacement(segContent: string): string {
  const segWidth = measureTextWidth(segContent);
  return '-'.repeat(Math.max(1, segWidth));
}
