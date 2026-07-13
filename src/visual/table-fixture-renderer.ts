import { MarkdownParser } from '../parser';
import type { DecorationRange, TableBlock } from '../parser/types';
import { getResponsiveTableOffsetRanges } from '../decorator/table-responsive';
import { layoutWrappedGridRow } from '../tables/responsive-svg';

const GRID_TABLE_TYPES = new Set([
  'tablePipe',
  'tableSeparatorPipe',
  'tableSeparatorDash',
  'tableCell',
]);
const TABLE_OVERLAY_TYPES = new Set([...GRID_TABLE_TYPES]);
const PIPE_CHARS = new Set(['|', '\u2502', '\u251c', '\u2524', '\u253c']);

export interface TableRenderSection {
  tableIndex: number;
  startLine: number;
  endLine: number;
  mode: 'compact' | 'responsive';
  sourceLines: string[];
  overlayLines: string[];
}

export interface PipeMisalignment {
  tableIndex: number;
  line: number;
  pipeIndex: number;
  expectedColumn: number;
  actualColumn: number;
}

export interface TablesOverlayResult {
  overlayText: string;
  overlayLines: string[];
  sections: TableRenderSection[];
  compactSections: TableRenderSection[];
  responsiveSections: TableRenderSection[];
  misalignments: PipeMisalignment[];
}

function lineStartOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function offsetToLine(offset: number, lineStarts: number[]): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function decorationOverlapsResponsiveRange(
  decoration: DecorationRange,
  responsiveRanges: { startPos: number; endPos: number }[],
): boolean {
  return responsiveRanges.some(
    (range) => decoration.startPos < range.endPos && decoration.endPos > range.startPos,
  );
}

function filterTableDecorations(
  decorations: DecorationRange[],
  responsiveRanges: { startPos: number; endPos: number }[],
): DecorationRange[] {
  return decorations.filter((decoration) => {
    if (!TABLE_OVERLAY_TYPES.has(decoration.type)) {
      return false;
    }
    if (
      GRID_TABLE_TYPES.has(decoration.type) &&
      decorationOverlapsResponsiveRange(decoration, responsiveRanges)
    ) {
      return false;
    }
    return decoration.replacement !== undefined;
  });
}

interface OverlayBuildResult {
  lines: string[];
  sourceLineForOverlayLine: number[];
}

function responsiveTableOverlayText(table: TableBlock, viewportColumns: number): string {
  const lines: string[] = [];
  const lastRowIdx = table.rowRanges.length - 1;
  for (let rowIdx = 0; rowIdx <= lastRowIdx; rowIdx++) {
    lines.push(...layoutWrappedGridRow(table, rowIdx, viewportColumns));
  }
  return lines.join('\n');
}

function buildOverlayLines(
  text: string,
  decorations: DecorationRange[],
  tableBlocks: TableBlock[],
  responsiveRanges: { startPos: number; endPos: number }[],
  viewportColumns: number,
): OverlayBuildResult {
  const lineStarts = lineStartOffsets(text);
  const sourceLines = text.split('\n');
  const lines: string[] = [];
  const sourceLineForOverlayLine: number[] = [];
  const responsiveTables = new Map<number, TableBlock>();
  for (const table of tableBlocks) {
    if (!responsiveRanges.some((range) => range.startPos === table.startPos && range.endPos === table.endPos)) {
      continue;
    }
    const headerLine = offsetToLine(table.rowRanges[0].startPos, lineStarts);
    responsiveTables.set(headerLine, table);
  }

  for (let lineIdx = 0; lineIdx < sourceLines.length; lineIdx++) {
    const lineStart = lineStarts[lineIdx] ?? 0;
    const lineEnd =
      lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] - 1 : text.length;

    const responsiveTable = responsiveTables.get(lineIdx);
    if (responsiveTable) {
      lines.push(responsiveTableOverlayText(responsiveTable, viewportColumns));
      sourceLineForOverlayLine.push(lineIdx);
      continue;
    }

    const isHiddenResponsiveLine = [...responsiveTables.values()].some((table) => {
      const headerLine = offsetToLine(table.rowRanges[0].startPos, lineStarts);
      const endLine = offsetToLine(Math.max(table.startPos, table.endPos - 1), lineStarts);
      return lineIdx > headerLine && lineIdx <= endLine;
    });
    if (isHiddenResponsiveLine) {
      lines.push('');
      sourceLineForOverlayLine.push(lineIdx);
      continue;
    }

    const lineDecorations = decorations
      .filter((decoration) => decoration.startPos >= lineStart && decoration.startPos <= lineEnd)
      .sort((a, b) => a.startPos - b.startPos);

    let overlay = '';
    let pos = lineStart;
    for (const decoration of lineDecorations) {
      overlay += text.slice(pos, decoration.startPos);
      overlay += decoration.replacement ?? text.slice(decoration.startPos, decoration.endPos);
      pos = decoration.endPos;
    }
    overlay += text.slice(pos, lineEnd);
    lines.push(overlay);
    sourceLineForOverlayLine.push(lineIdx);
  }

  return { lines, sourceLineForOverlayLine };
}

function findPipeColumns(line: string): number[] {
  const columns: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (PIPE_CHARS.has(line[i])) {
      columns.push(i);
    }
  }
  return columns;
}

function isTableOverlayLine(line: string): boolean {
  return findPipeColumns(line).length >= 2;
}

function isSeparatorRow(line: string): boolean {
  const segments = line.split(/[|\u2502\u251c\u2524\u253c]/).slice(1, -1);
  if (segments.length === 0) {
    return false;
  }
  return segments.every((segment) => /^[\s:\-\u00A0]+$/.test(segment));
}

export function findPipeMisalignments(
  sections: TableRenderSection[],
): PipeMisalignment[] {
  const misalignments: PipeMisalignment[] = [];

  for (const section of sections) {
    if (section.mode !== 'compact') {
      continue;
    }

    let expectedColumns: number[] | undefined;
    for (let rowIdx = 0; rowIdx < section.overlayLines.length; rowIdx++) {
      const line = section.overlayLines[rowIdx];
      if (!isTableOverlayLine(line) || isSeparatorRow(line)) {
        continue;
      }

      const columns = findPipeColumns(line);
      if (!expectedColumns) {
        expectedColumns = columns;
        continue;
      }

      const limit = Math.min(expectedColumns.length, columns.length);
      for (let pipeIdx = 0; pipeIdx < limit; pipeIdx++) {
        if (columns[pipeIdx] !== expectedColumns[pipeIdx]) {
          misalignments.push({
            tableIndex: section.tableIndex,
            line: section.startLine + rowIdx,
            pipeIndex: pipeIdx,
            expectedColumn: expectedColumns[pipeIdx],
            actualColumn: columns[pipeIdx],
          });
        }
      }
    }
  }

  return misalignments;
}

function buildSections(
  text: string,
  overlayLines: string[],
  sourceLineForOverlayLine: number[],
  tableBlocks: TableBlock[],
  responsiveRanges: { startPos: number; endPos: number }[],
): TableRenderSection[] {
  const lineStarts = lineStartOffsets(text);
  const sections: TableRenderSection[] = [];

  for (let tableIndex = 0; tableIndex < tableBlocks.length; tableIndex++) {
    const table = tableBlocks[tableIndex];
    const startLine = offsetToLine(table.startPos, lineStarts);
    const endLine = offsetToLine(Math.max(table.startPos, table.endPos - 1), lineStarts);
    const sourceLines = text.split('\n').slice(startLine, endLine + 1);
    const responsive = responsiveRanges.some(
      (range) => range.startPos === table.startPos && range.endPos === table.endPos,
    );
    const tableOverlayLines = overlayLines.filter(
      (_, idx) =>
        sourceLineForOverlayLine[idx] >= startLine &&
        sourceLineForOverlayLine[idx] <= endLine,
    );

    sections.push({
      tableIndex,
      startLine,
      endLine,
      mode: responsive ? 'responsive' : 'compact',
      sourceLines,
      overlayLines: tableOverlayLines,
    });
  }

  return sections;
}

export async function renderTablesOverlay(
  md: string,
  viewportColumns: number = 120,
): Promise<TablesOverlayResult> {
  const parser = await MarkdownParser.create();
  const { decorations, tableBlocks } = parser.extractDecorationsWithScopes(md);
  const responsiveRanges = getResponsiveTableOffsetRanges(tableBlocks);
  const tableDecorations = filterTableDecorations(decorations, responsiveRanges);
  const { lines: overlayLines, sourceLineForOverlayLine } = buildOverlayLines(
    md,
    tableDecorations,
    tableBlocks,
    responsiveRanges,
    viewportColumns,
  );
  const sections = buildSections(
    md,
    overlayLines,
    sourceLineForOverlayLine,
    tableBlocks,
    responsiveRanges,
  );
  const compactSections = sections.filter((section) => section.mode === 'compact');
  const responsiveSections = sections.filter((section) => section.mode === 'responsive');
  const misalignments = findPipeMisalignments(compactSections);

  return {
    overlayText: overlayLines.join('\n'),
    overlayLines,
    sections,
    compactSections,
    responsiveSections,
    misalignments,
  };
}
