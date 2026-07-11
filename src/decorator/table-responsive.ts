import { createHash } from 'crypto';
import { ColorThemeKind, type Range, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import {
  estimateEditorContentWidthPx,
  layoutColumnsFromContentWidthPx,
} from '../mermaid/editor-width';
import { svgToDataUri } from '../mermaid/svg-processor';
import {
  buildCoveredLines,
  getClipLineCount,
  layoutWrappedGridRow,
  renderResponsiveRowSvg,
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

function rowCacheKey(
  table: TableBlock,
  rowIdx: number,
  lines: string[],
  contentWidthPx: number,
  isDarkTheme: boolean,
  fontFamily: string,
): string {
  const source = [
    table.startPos,
    table.endPos,
    rowIdx,
    lines.join('\n'),
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
  const contentWidthPx = estimateEditorContentWidthPx(editor);
  const theme = getResponsiveTableTheme(isDarkTheme);

  const rangesByKey = new Map<string, Range[]>();
  const dataUrisByKey = new Map<string, string>();

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const layoutWidth = layoutColumnsFromContentWidthPx(contentWidthPx, fontSize, 0);
    const rowLayouts: {
      rowIdx: number;
      range: Range;
      lines: string[];
      sourceLine: number;
    }[] = [];

    for (let rowIdx = 0; rowIdx < table.rowRanges.length; rowIdx++) {
      const rowRange = table.rowRanges[rowIdx];
      const range = createRange(editor, rowRange.startPos, rowRange.endPos, normalizedText);
      if (!range) {
        continue;
      }

      const lines = layoutWrappedGridRow(table, rowIdx, layoutWidth);
      if (lines.length === 0) {
        continue;
      }

      rowLayouts.push({
        rowIdx,
        range,
        lines,
        sourceLine: range.start.line,
      });
    }

    const coveredLines = buildCoveredLines(
      rowLayouts.map((layout) => layout.sourceLine),
      rowLayouts.map((layout) => layout.lines.length),
    );

    for (const layout of rowLayouts) {
      if (activeLines.has(layout.sourceLine)) {
        continue;
      }
      if (coveredLines.has(layout.sourceLine)) {
        continue;
      }

      const clipCount = getClipLineCount(
        layout.sourceLine,
        layout.lines.length,
        activeLines,
      );
      const lines = layout.lines.slice(0, clipCount);
      if (lines.length === 0) {
        continue;
      }

      const svg = renderResponsiveRowSvg(lines, {
        fontFamily,
        fontSize,
        lineHeight,
        contentWidthPx,
        layoutWidth,
        theme,
      });
      const key = rowCacheKey(
        table,
        layout.rowIdx,
        lines,
        contentWidthPx,
        isDarkTheme,
        fontFamily,
      );
      dataUrisByKey.set(key, svgToDataUri(svg));
      const ranges = rangesByKey.get(key) ?? [];
      ranges.push(layout.range);
      rangesByKey.set(key, ranges);
    }
  }

  decorations.apply(editor, rangesByKey, dataUrisByKey);
}
