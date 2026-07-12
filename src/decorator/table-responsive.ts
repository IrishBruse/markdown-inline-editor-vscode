import { createHash } from 'crypto';
import { ColorThemeKind, type DecorationOptions, type Range, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import {
  estimateResponsiveTableLayout,
} from '../mermaid/editor-width';
import { ensureSvgDimensions, svgToDataUri } from '../mermaid/svg-processor';
import {
  borderlessTableToOverlayText,
  layoutBorderlessTableSegment,
  renderBorderlessTableSvg,
} from '../tables/responsive-svg';
import { shouldUseResponsiveLayout } from '../tables/responsive-layout';
import {
  getResponsiveTableTheme,
  ResponsiveTableDecorations,
  type ResponsiveTableDecorationPayload,
} from './responsive-table-decorations';
import { createRange } from './editor-decoration-applier';

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
    const range = createRange(editor, rowRange.startPos, rowRange.endPos, normalizedText);
    if (range && activeLines.has(range.start.line)) {
      return rowIdx;
    }
  }
  return undefined;
}

function parseSvgHeight(svg: string): number {
  const match = svg.match(/\bheight="(\d+(?:\.\d+)?)(?:px)?"/);
  return match ? Math.ceil(parseFloat(match[1])) : 1;
}

function buildSegmentPayload(
  table: TableBlock,
  fromRowIdx: number,
  toRowIdx: number,
  layoutWidth: number,
  contentWidthPx: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: ReturnType<typeof getResponsiveTableTheme>,
  maxHeightPx?: number,
): { layoutKey: string; payload: ResponsiveTableDecorationPayload } {
  const layout = layoutBorderlessTableSegment(table, fromRowIdx, toRowIdx, layoutWidth);
  let svg = renderBorderlessTableSvg(layout, {
    fontFamily,
    fontSize,
    lineHeight,
    contentWidthPx,
    layoutWidth,
    theme,
    maxHeightPx,
  });
  const heightPx = parseSvgHeight(svg);
  svg = ensureSvgDimensions(svg, contentWidthPx, heightPx);
  return {
    layoutKey: borderlessTableToOverlayText(layout),
    payload: {
      dataUri: svgToDataUri(svg),
      widthPx: contentWidthPx,
      heightPx,
    },
  };
}

function applyTableSegment(
  editor: TextEditor,
  table: TableBlock,
  normalizedText: string,
  fromRowIdx: number,
  toRowIdx: number,
  anchorRowIdx: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  theme: ReturnType<typeof getResponsiveTableTheme>,
  isDarkTheme: boolean,
  optionsByKey: Map<string, DecorationOptions[]>,
  payloadsByKey: Map<string, ResponsiveTableDecorationPayload>,
  hiddenRanges: Range[],
  maxHeightPx?: number,
): void {
  if (fromRowIdx > toRowIdx) {
    return;
  }

  const anchorRange = createRange(
    editor,
    table.rowRanges[anchorRowIdx].startPos,
    table.rowRanges[anchorRowIdx].endPos,
    normalizedText,
  );
  if (!anchorRange) {
    return;
  }

  const { layoutWidth, widthPx: contentWidthPx } = estimateResponsiveTableLayout(
    editor,
    anchorRange.start.character,
  );
  const { layoutKey, payload } = buildSegmentPayload(
    table,
    fromRowIdx,
    toRowIdx,
    layoutWidth,
    contentWidthPx,
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
    contentWidthPx,
    isDarkTheme,
    fontFamily,
    maxHeightPx,
  );
  payloadsByKey.set(key, payload);
  const options = optionsByKey.get(key) ?? [];
  options.push({ range: anchorRange });
  optionsByKey.set(key, options);

  for (let rowIdx = fromRowIdx; rowIdx <= toRowIdx; rowIdx++) {
    if (rowIdx === anchorRowIdx) {
      continue;
    }
    const rowRange = table.rowRanges[rowIdx];
    const range = createRange(editor, rowRange.startPos, rowRange.endPos, normalizedText);
    if (range) {
      hiddenRanges.push(range);
    }
  }
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
  const hiddenRanges: Range[] = [];

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
        0,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
        hiddenRanges,
      );
      continue;
    }

    const activeRange = createRange(
      editor,
      table.rowRanges[activeRowIdx].startPos,
      table.rowRanges[activeRowIdx].endPos,
      normalizedText,
    );

    if (activeRowIdx > 0) {
      const anchorRange = createRange(
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
        0,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
        hiddenRanges,
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
        belowFrom,
        fontFamily,
        fontSize,
        lineHeight,
        theme,
        isDarkTheme,
        optionsByKey,
        payloadsByKey,
        hiddenRanges,
      );
    }
  }

  decorations.apply(editor, optionsByKey, payloadsByKey);
  decorations.applyHidden(editor, hiddenRanges);
}
