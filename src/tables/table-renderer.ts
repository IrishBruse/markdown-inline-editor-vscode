import * as vscode from 'vscode';
import { LRUCache } from '../utils/lru-cache';
import { MERMAID_CONSTANTS } from '../mermaid/constants';
import { createErrorSvg } from '../mermaid/error-handler';
import type { TableHtmlTheme, TableRowData } from '../parser/tables-html';
import { logWarn } from '../logging';
import { renderTableSvgHost } from './table-svg-host';
import { getTableThemeColors } from './table-theme-colors';

export type TableRenderOptions = {
  theme: TableHtmlTheme;
  fontFamily?: string;
  numLines: number;
};

const tableSvgCache = new LRUCache<string, Promise<string>>(MERMAID_CONSTANTS.DECORATION_CACHE_MAX_ENTRIES);

function getEditorLineHeight(fontSize: number): number {
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const lineHeightSetting = editorConfig.get<number>('lineHeight', 0);
  if (lineHeightSetting === 0 || lineHeightSetting < 8) {
    const multiplier = process.platform === 'darwin' ? 1.5 : 1.35;
    return Math.max(8, Math.round(fontSize * multiplier));
  }
  if (lineHeightSetting >= 10) {
    return Math.round(lineHeightSetting);
  }
  return Math.max(8, Math.round(fontSize * lineHeightSetting));
}

export async function renderTableSvg(
  rows: TableRowData[],
  options: TableRenderOptions
): Promise<string> {
  const theme = options.theme;
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeight = getEditorLineHeight(fontSize);
  const fallbackHeight = (options.numLines + 2) * lineHeight;
  const isDarkFallback = theme.cellBackground.toLowerCase() !== '#ffffff';

  const cacheKey =
    `${JSON.stringify(rows)}|${theme.foreground}|${theme.border}|${theme.headerBackground}|` +
    `${theme.cellBackground}|${fontSize}|${lineHeight}|${options.fontFamily ?? ''}`;
  const cached = tableSvgCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = Promise.resolve().then(() => {
    try {
      return renderTableSvgHost(rows, {
        fontSize,
        lineHeight,
        fontFamily: options.fontFamily,
        numLines: options.numLines,
      }, theme);
    } catch (error) {
      logWarn('Table render failed', error);
      const message = error instanceof Error
        ? (error.message || error.toString() || 'Rendering failed')
        : (typeof error === 'string' ? error : String(error) || 'Rendering failed');
      return createErrorSvg(
        message.trim().length > 0 ? message : 'Table rendering failed',
        200,
        fallbackHeight,
        isDarkFallback,
        'Table Rendering Error'
      );
    }
  });

  tableSvgCache.set(cacheKey, promise);
  promise.catch(() => {
    tableSvgCache.delete(cacheKey);
  });
  return promise;
}

export function clearTableSvgCache(): void {
  tableSvgCache.clear();
}

export { getTableThemeColors, clearTableThemeCache } from './table-theme-colors';
