import { createHash } from 'crypto';
import { ColorThemeKind, Range, type DecorationOptions, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import {
  estimateResponsiveTableLayout,
} from '../mermaid/editor-width';
import { buildGridTableSegmentPayload } from '../tables/responsive-svg';
import { shouldUseResponsiveLayout } from '../tables/responsive-layout';
import {
  getResponsiveTableTheme,
  ResponsiveTableDecorations,
  type ResponsiveTableDecorationPayload,
} from './responsive-table-decorations';
import { createRange } from './editor-decoration-applier';

function createFullLineRange(
  editor: TextEditor,
  startPos: number,
  endPos: number,
  normalizedText: string,
): Range | null {
  const range = createRange(editor, startPos, endPos, normalizedText);
  if (!range) {
    return null;
  }
  const line = editor.document.lineAt(range.start.line);
  return new Range(line.range.start, line.range.end);
}

function createTableSegmentRange(
  editor: TextEditor,
  table: TableBlock,
  normalizedText: string,
  fromRowIdx: number,
  toRowIdx: number,
): Range | null {
  const startRange = createFullLineRange(
    editor,
    table.rowRanges[fromRowIdx].startPos,
    table.rowRanges[fromRowIdx].endPos,
    normalizedText,
  );
  const endRange = createFullLineRange(
    editor,
    table.rowRanges[toRowIdx].startPos,
    table.rowRanges[toRowIdx].endPos,
    normalizedText,
  );
  if (!startRange || !endRange) {
    return null;
  }
  return new Range(startRange.start, endRange.end);
}

function getEditorLineHeight(fontSize: number): number {
  const editorConfig = workspace.getConfiguration('editor');
  const lineHeightSetting = editorConfig.get<number>('lineHeight', 0);
  if (lineHeightSetting === 0 || lineHeightSetting < 8) {
    const multiplier = process.platform === 'darwin' ? 1.5 : 1.35;
    return Math.max(8, Math.round(fontSize * multiplier));
  }
  if (lineHeightSetting >= 10) {
    return Math.round(lineHeightSetting);
  }
  return Math.round(fontSize * lineHeightSetting);
}

function segmentCacheKey(
  table: TableBlock,
  fromRowIdx: number,
  toRowIdx: number,
  layoutKey: string,
  contentWidthPx: number,
  isDarkTheme: boolean,
  fontFamily: string,
  maxHeightPx?: number,
): string {
  const source = [
    table.startPos,
    table.endPos,
    fromRowIdx,
    toRowIdx,
    layoutKey,
    contentWidthPx,
    isDarkTheme,
    fontFamily,
    maxHeightPx ?? '',
  ].join('\n');
  return createHash('sha256').update(source).digest('hex');
}

function findActiveRowIdx(
  editor: TextEditor,
  table: TableBlock,
  normalizedText: string,
  activeLines: Set<number>,
): number | undefined {
  for (let rowIdx = 0; rowIdx < table.rowRanges.length; rowIdx++) {
    const rowRange = table.rowRanges[rowIdx];
    const range = createFullLineRange(
      editor,
      rowRange.startPos,
      rowRange.endPos,
      normalizedText,
    );
    if (range && activeLines.has(range.start.line)) {
      return rowIdx;
    }
  }
  return undefined;
}

function applyTableSegment(
  editor: TextEditor,
  table: TableBlock,
  normalizedText: string,
  fromRowIdx: number,
  toRowIdx: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: ReturnType<typeof getResponsiveTableTheme>,
  isDarkTheme: boolean,
  optionsByKey: Map<string, DecorationOptions[]>,
  payloadsByKey: Map<string, ResponsiveTableDecorationPayload>,
  maxHeightPx?: number,
): void {
  if (fromRowIdx > toRowIdx) {
    return;
  }

  const segmentRange = createTableSegmentRange(
    editor,
    table,
    normalizedText,
    fromRowIdx,
    toRowIdx,
  );
  if (!segmentRange) {
    return;
  }

  const { layoutWidth } = estimateResponsiveTableLayout(
    editor,
    segmentRange.start.character,
  );
  const { layoutKey, payload } = buildGridTableSegmentPayload(
    table,
    fromRowIdx,
    toRowIdx,
    layoutWidth,
    0,
    fontFamily,
    fontSize,
    lineHeight,
    theme,
    maxHeightPx,
  );

  const key = segmentCacheKey(
    table,
    fromRowIdx,
    toRowIdx,
    layoutKey,
    payload.widthPx,
    isDarkTheme,
    fontFamily,
    maxHeightPx,
  );
  payloadsByKey.set(key, payload);
  const options = optionsByKey.get(key) ?? [];
  options.push({ range: segmentRange });
  optionsByKey.set(key, options);
}

export function getResponsiveTableOffsetRanges(
  tableBlocks: TableBlock[],
): { startPos: number; endPos: number }[] {
  const ranges: { startPos: number; endPos: number }[] = [];

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }
    ranges.push({ startPos: table.startPos, endPos: table.endPos });
  }

  return ranges;
}

export function applyResponsiveTableDecorations(
  editor: TextEditor,
  tableBlocks: TableBlock[],
  normalizedText: string,
  activeLines: Set<number>,
  decorations: ResponsiveTableDecorations,
): void {
  const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
    window.activeColorTheme.kind === ColorThemeKind.HighContrast;
  const editorConfig = workspace.getConfiguration('editor');
  const fontFamily = editorConfig.get<string>('fontFamily', 'monospace');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeight = getEditorLineHeight(fontSize);
  const theme = getResponsiveTableTheme(isDarkTheme);

  const optionsByKey = new Map<string, DecorationOptions[]>();
  const payloadsByKey = new Map<string, ResponsiveTableDecorationPayload>();

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const lastRowIdx = table.rowRanges.length - 1;
    const activeRowIdx = findActiveRowIdx(editor, table, normalizedText, activeLines);

    if (activeRowIdx === undefined) {
      applyTableSegment(
        editor,
        table,
        normalizedText,
        0,
        lastRowIdx,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
      );
      continue;
    }

    const activeRange = createFullLineRange(
      editor,
      table.rowRanges[activeRowIdx].startPos,
      table.rowRanges[activeRowIdx].endPos,
      normalizedText,
    );

    if (activeRowIdx > 0) {
      const anchorRange = createFullLineRange(
        editor,
        table.rowRanges[0].startPos,
        table.rowRanges[0].endPos,
        normalizedText,
      );
      const maxHeightPx = anchorRange && activeRange
        ? Math.max(lineHeight, (activeRange.start.line - anchorRange.start.line) * lineHeight)
        : undefined;
      applyTableSegment(
        editor,
        table,
        normalizedText,
        0,
        activeRowIdx - 1,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
        maxHeightPx,
      );
    }

    if (activeRowIdx < lastRowIdx) {
      const belowFrom = activeRowIdx === 1 ? 2 : activeRowIdx + 1;
      applyTableSegment(
        editor,
        table,
        normalizedText,
        belowFrom,
        lastRowIdx,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
      );
    }
  }

  decorations.applyHidden(editor, []);
  decorations.apply(editor, optionsByKey, payloadsByKey);
}
