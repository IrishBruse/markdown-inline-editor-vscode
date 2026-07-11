import { createHash } from 'crypto';
import { ColorThemeKind, type Range, type TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser/types';
import { estimateEditorContentWidthPx } from '../mermaid/editor-width';
import { svgToDataUri } from '../mermaid/svg-processor';
import { renderResponsiveTableSvg } from '../tables/responsive-svg';
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

function tableCacheKey(table: TableBlock, contentWidthPx: number, isDarkTheme: boolean, fontFamily: string): string {
  const source = [
    table.startPos,
    table.endPos,
    table.headers.join('\u0001'),
    table.rows.map((row) => row.cells.map((cell) => cell.displayText).join('\u0002')).join('\u0003'),
    contentWidthPx,
    isDarkTheme,
    fontFamily,
  ].join('\n');
  return createHash('sha256').update(source).digest('hex');
}

export function getResponsiveTableOffsetRanges(
  tableBlocks: TableBlock[],
  activeTableOffsets: { startPos: number; endPos: number }[],
): { startPos: number; endPos: number }[] {
  const ranges: { startPos: number; endPos: number }[] = [];

  for (const table of tableBlocks) {
    if (!shouldUseResponsiveLayout(table.colWidths)) {
      continue;
    }

    const tableIsActive = activeTableOffsets.some((active) =>
      active.startPos <= table.endPos && active.endPos >= table.startPos,
    );
    if (tableIsActive) {
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
  activeTableOffsets: { startPos: number; endPos: number }[],
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

    const tableIsActive = activeTableOffsets.some((active) =>
      active.startPos <= table.endPos && active.endPos >= table.startPos,
    );
    if (tableIsActive) {
      continue;
    }

    const range = createRange(editor, table.startPos, table.endPos, normalizedText);
    if (!range) {
      continue;
    }

    const svg = renderResponsiveTableSvg(table, {
      fontFamily,
      fontSize,
      lineHeight,
      contentWidthPx,
      theme,
    });
    const key = tableCacheKey(table, contentWidthPx, isDarkTheme, fontFamily);
    dataUrisByKey.set(key, svgToDataUri(svg));
    const ranges = rangesByKey.get(key) ?? [];
    ranges.push(range);
    rangesByKey.set(key, ranges);
  }

  decorations.apply(editor, rangesByKey, dataUrisByKey);
}
