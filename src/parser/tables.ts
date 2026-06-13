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
  const hasFormatted = cell.children.some((child) =>
    child.type === 'strong' || child.type === 'emphasis' ||
    child.type === 'delete' || child.type === 'inlineCode' ||
    child.type === 'link' || child.type === 'image',
  );
  if (!hasFormatted) {
    return false;
  }
  if (isLinkOnlyCell(cell) || isImageOnlyCell(cell)) {
    return false;
  }
  if (cell.children.length === 1) {
    return false;
  }
  return true;
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

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function graphemeDisplayWidth(segment: string): number {
  if (!segment) {
    return 0;
  }
  const code = segment.codePointAt(0)!;
  if (isZeroWidthCodePoint(code)) {
    return 0;
  }
  return isWideCodePoint(code) ? 2 : 1;
}

export function measureTextWidth(plain: string, options?: { cjkCorrection?: boolean }): number {
  let width = 0;
  let cjkCount = 0;
  for (const { segment } of graphemeSegmenter.segment(plain)) {
    const code = segment.codePointAt(0)!;
    if (isZeroWidthCodePoint(code)) {
      continue;
    }
    if (
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0x20000 && code <= 0x2fa1f)
    ) {
      cjkCount++;
    }
    width += graphemeDisplayWidth(segment);
  }
  if (options?.cjkCorrection && cjkCount > 0) {
    return width + Math.ceil(cjkCount * 0.25);
  }
  return width;
}

/**
 * Padded replacement that fills the shared column content slot.
 * Padding uses NBSP so VS Code preserves monospace width in before.contentText
 * (regular spaces collapse and break pipe column alignment).
 *
 * All cells in a column share `columnWidth` so pipes line up visually even when
 * source rows use different wide-character spans between pipes.
 */
export function buildTableCellReplacement(
  _rawContent: string,
  displayContent: string,
  displayWidth: number,
  columnWidth: number,
  align: 'left' | 'right' | 'center' | null,
): string {
  const pad = '\u00A0';
  const contentSlot = Math.max(displayWidth, columnWidth);

  if (align === 'right') {
    const slotPad = contentSlot - displayWidth;
    return pad.repeat(slotPad + 1) + displayContent + pad;
  }
  if (align === 'center') {
    const extraPad = contentSlot - displayWidth;
    const padLeft = Math.floor(extraPad / 2);
    const padRight = extraPad - padLeft;
    return pad.repeat(padLeft + 1) + displayContent + pad.repeat(padRight + 1);
  }
  const padAfterContent = contentSlot - displayWidth;
  return pad + displayContent + pad.repeat(padAfterContent + 1);
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
    const inner = trimmed.slice(1, -1);
    if (!inner.includes('`')) {
      return { inlineCode: true };
    }
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
): string {
  if (astCell && isImageOnlyCell(astCell)) {
    return TABLE_CELL_IMAGE_ICON;
  }
  if (astCell) {
    return extractCellPlainText(astCell);
  }
  return cellText.trim();
}

export type TableCellRenderContext = {
  displayContent: string;
  displayWidth: number;
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    inlineCode?: boolean;
    link?: boolean;
  };
  cellType: 'tableCell' | 'tableCellImage';
  cellUrl?: string;
  /** Mixed inline cells use normal bold/italic/link decorations instead of a padded overlay. */
  skipPaddedCell?: boolean;
};

export function resolveTableCellRenderContext(
  rawContent: string,
  astCell: TableCell | undefined,
  options?: { cjkCorrection?: boolean },
): TableCellRenderContext {
  const trimmedContent = rawContent.trim();
  const markdownCellStyle = detectCellStyle(trimmedContent);
  const isWholeCellStrike = markdownCellStyle?.textDecoration === 'line-through';
  const skipPaddedCell =
    isWholeCellStrike ||
    (!markdownCellStyle && astCell !== undefined && cellHasMixedFormatting(astCell));
  const isLinkCell = !markdownCellStyle && !skipPaddedCell && !!astCell && isLinkOnlyCell(astCell);
  const isImageCell = !markdownCellStyle && !skipPaddedCell && !!astCell && isImageOnlyCell(astCell);

  let displayContent: string;
  let displayWidthSource: string;
  let cellType: 'tableCell' | 'tableCellImage' = 'tableCell';
  let cellStyle = markdownCellStyle;
  let cellUrl: string | undefined;

  if (isImageCell && astCell) {
    displayContent = TABLE_CELL_IMAGE_ICON;
    displayWidthSource = displayContent;
    cellType = 'tableCellImage';
    cellUrl = imageOnlyCellUrl(astCell);
    cellStyle = undefined;
  } else if (isLinkCell && astCell) {
    displayContent = extractCellPlainText(astCell);
    displayWidthSource = displayContent;
    cellStyle = { link: true };
    cellUrl = linkOnlyCellUrl(astCell);
  } else {
    displayContent = cellDisplayText(rawContent, astCell);
    displayWidthSource = displayContent;
  }

  const measureOpts = options?.cjkCorrection ? { cjkCorrection: true } : undefined;

  return {
    displayContent,
    displayWidth: measureTextWidth(displayWidthSource, measureOpts),
    cellStyle,
    cellType,
    cellUrl,
    skipPaddedCell: skipPaddedCell || undefined,
  };
}

export function computeColumnWidths(
  tableNode: Table,
  source: string,
  options?: { cjkCorrection?: boolean },
): number[] {
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
      const rawContent = source.substring(pipes[i] + 1, pipes[i + 1]);
      const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
      const ctx = resolveTableCellRenderContext(rawContent, astCell, options);
      if (ctx.displayWidth > widths[i]) widths[i] = ctx.displayWidth;
    }
  }

  return widths;
}

export function buildSeparatorDashReplacement(
  segContent: string,
  columnWidth?: number,
  options?: { cjkCorrection?: boolean },
): string {
  const measureOpts = options?.cjkCorrection ? { cjkCorrection: true } : undefined;
  const targetWidth = columnWidth !== undefined
    ? columnWidth + 2
    : measureTextWidth(segContent, measureOpts);
  return '-'.repeat(Math.max(1, targetWidth));
}
