import { createHash } from 'crypto';
import { ColorThemeKind, Range, type DecorationOptions, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import {
  estimateResponsiveTableLayout,
} from '../mermaid/editor-width';
import {
  buildGridRowPayload,
  getClipLineCount,
  layoutWrappedGridRow,
} from '../tables/responsive-svg';
import {
  computeViewportColumnWidths,
  shouldUseResponsiveLayout,
} from '../tables/responsive-layout';
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

function rowCacheKey(
  table: TableBlock,
  rowIdx: number,
  layoutKey: string,
  contentWidthPx: number,
  isDarkTheme: boolean,
  fontFamily: string,
): string {
  const source = [
    table.startPos,
    table.endPos,
    rowIdx,
    layoutKey,
    contentWidthPx,
    isDarkTheme,
    fontFamily,
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

function maxWrapLinesForRow(
  table: TableBlock,
  rowIdx: number,
  layoutWidth: number,
  editor: TextEditor,
  normalizedText: string,
  activeRowIdx: number | undefined,
  activeLines: Set<number>,
): number | undefined {
  if (activeRowIdx === undefined || rowIdx >= activeRowIdx) {
    return undefined;
  }

  const rowRange = table.rowRanges[rowIdx];
  const range = createFullLineRange(
    editor,
    rowRange.startPos,
    rowRange.endPos,
    normalizedText,
  );
  if (!range) {
    return undefined;
  }

  const wrapCount = layoutWrappedGridRow(table, rowIdx, layoutWidth).length;
  if (wrapCount <= 1) {
    return undefined;
  }

  const clipCount = getClipLineCount(range.start.line, wrapCount, activeLines);
  return clipCount < wrapCount ? clipCount : undefined;
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

    const headerRange = createFullLineRange(
      editor,
      table.rowRanges[0].startPos,
      table.rowRanges[0].endPos,
      normalizedText,
    );
    if (!headerRange) {
      continue;
    }

    const { layoutWidth, widthPx: contentWidthPx } = estimateResponsiveTableLayout(
      editor,
      headerRange.start.character,
    );
    const colWidths = computeViewportColumnWidths(table.colWidths, layoutWidth);

    const lastRowIdx = table.rowRanges.length - 1;
    const activeRowIdx = findActiveRowIdx(editor, table, normalizedText, activeLines);

    for (let rowIdx = 0; rowIdx <= lastRowIdx; rowIdx++) {
      if (rowIdx === activeRowIdx) {
        continue;
      }

      const rowRange = table.rowRanges[rowIdx];
      const range = createFullLineRange(
        editor,
        rowRange.startPos,
        rowRange.endPos,
        normalizedText,
      );
      if (!range) {
        continue;
      }

      const maxWrapLines = maxWrapLinesForRow(
        table,
        rowIdx,
        layoutWidth,
        editor,
        normalizedText,
        activeRowIdx,
        activeLines,
      );
      const { layoutKey, payload } = buildGridRowPayload(
        table,
        rowIdx,
        layoutWidth,
        contentWidthPx,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        { colWidths, maxWrapLines },
      );

      const key = rowCacheKey(
        table,
        rowIdx,
        layoutKey,
        contentWidthPx,
        isDarkTheme,
        fontFamily,
      );
      payloadsByKey.set(key, payload);
      const options = optionsByKey.get(key) ?? [];
      options.push({ range });
      optionsByKey.set(key, options);
    }
  }

  decorations.applyHidden(editor, []);
  decorations.apply(editor, optionsByKey, payloadsByKey);
}
