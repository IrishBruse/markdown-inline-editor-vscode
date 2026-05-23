import * as vscode from 'vscode';
import { LRUCache } from '../utils/lru-cache';
import { MERMAID_CONSTANTS } from '../mermaid/constants';
import { createErrorSvg } from '../mermaid/error-handler';
import { tableHtmlThemeForMode, type TableRowData } from '../parser/tables-html';
import { logWarn } from '../logging';
import { renderTableSvgHost } from './table-svg-host';

export type TableRenderOptions = {
  theme: 'default' | 'dark';
  fontFamily?: string;
  contentWidth: number;
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

/**
 * Estimates editor content width in pixels for table wrapping.
 */
export function estimateEditorContentWidth(editor: vscode.TextEditor): number {
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  let maxChars = 80;
  for (const range of editor.visibleRanges) {
    for (let line = range.start.line; line <= range.end.line; line++) {
      maxChars = Math.max(maxChars, editor.document.lineAt(line).text.length);
    }
  }
  return Math.round(fontSize * 0.6 * Math.max(maxChars, 40));
}

export async function renderTableSvg(
  rows: TableRowData[],
  options: TableRenderOptions
): Promise<string> {
  const darkMode = options.theme === 'dark';
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeight = getEditorLineHeight(fontSize);
  const width = Math.max(200, options.contentWidth);
  const fallbackHeight = (options.numLines + 2) * lineHeight;

  const cacheKey = `${JSON.stringify(rows)}|${darkMode}|${width}|${fontSize}|${lineHeight}|${options.fontFamily ?? ''}`;
  const cached = tableSvgCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = Promise.resolve().then(() => {
    try {
      return renderTableSvgHost(rows, {
        theme: options.theme,
        contentWidth: width,
        fontSize,
        lineHeight,
        fontFamily: options.fontFamily,
        numLines: options.numLines,
      }, tableHtmlThemeForMode(darkMode));
    } catch (error) {
      logWarn('Table render failed', error);
      const message = error instanceof Error
        ? (error.message || error.toString() || 'Rendering failed')
        : (typeof error === 'string' ? error : String(error) || 'Rendering failed');
      return createErrorSvg(
        message.trim().length > 0 ? message : 'Table rendering failed',
        width,
        fallbackHeight,
        darkMode,
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
