import { createHash } from 'crypto';
import { ColorThemeKind, type Range, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import {
  estimateResponsiveTableLayout,
} from '../mermaid/editor-width';
import { svgToDataUri } from '../mermaid/svg-processor';
import {
  borderlessTableToOverlayText,
  layoutBorderlessTable,
  renderBorderlessTableSvg,
} from '../tables/responsive-svg';
import { shouldUseResponsiveLayout } from '../tables/responsive-layout';
import {
  getResponsiveTableTheme,
  ResponsiveTableDecorations,
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

function tableCacheKey(
  table: TableBlock,
  layoutKey: string,
  contentWidthPx: number,
  isDarkTheme: boolean,
  fontFamily: string,
): string {
  const source = [
    table.startPos,
    table.endPos,
    layoutKey,
    contentWidthPx,
    isDarkTheme,
    fontFamily,
  ].join('\n');
  return createHash('sha256').update(source).digest('hex');
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

  const rangesByKey = new Map<string, Range[]>();
  const dataUrisByKey = new Map<string, string>();
  const hiddenRanges: Range[] = [];

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const headerRange = createRange(
      editor,
      table.rowRanges[0].startPos,
      table.rowRanges[0].endPos,
      normalizedText,
    );
    if (!headerRange) {
      continue;
    }

    const tableIsActive = table.rowRanges.some((rowRange) => {
      const range = createRange(editor, rowRange.startPos, rowRange.endPos, normalizedText);
      return range !== undefined && activeLines.has(range.start.line);
    });
    if (tableIsActive) {
      continue;
    }

    const { layoutWidth, widthPx: contentWidthPx } = estimateResponsiveTableLayout(
      editor,
      headerRange.start.character,
    );
    const layout = layoutBorderlessTable(table, layoutWidth);
    const svg = renderBorderlessTableSvg(layout, {
      fontFamily,
      fontSize,
      lineHeight,
      contentWidthPx,
      layoutWidth,
      theme,
    });
    const key = tableCacheKey(
      table,
      borderlessTableToOverlayText(layout),
      contentWidthPx,
      isDarkTheme,
      fontFamily,
    );
    dataUrisByKey.set(key, svgToDataUri(svg));
    const ranges = rangesByKey.get(key) ?? [];
    ranges.push(headerRange);
    rangesByKey.set(key, ranges);

    for (let rowIdx = 1; rowIdx < table.rowRanges.length; rowIdx++) {
      const rowRange = table.rowRanges[rowIdx];
      const range = createRange(editor, rowRange.startPos, rowRange.endPos, normalizedText);
      if (range) {
        hiddenRanges.push(range);
      }
    }
  }

  decorations.apply(editor, rangesByKey, dataUrisByKey);
  decorations.applyHidden(editor, hiddenRanges);
}
