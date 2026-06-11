import * as vscode from 'vscode';
import type { TextEditor } from 'vscode';
import type { DecorationRange } from '../parser';
import { measureTextWidth } from '../parser/tables';
import type { ScopeEntry } from './visibility-model';

const TABLE_ROW_DECORATION_TYPES = new Set<string>(['tablePipe', 'tableCell']);

function editorConfig(editor: TextEditor): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('editor', editor.document);
}

function resolveWordWrap(cfg: vscode.WorkspaceConfiguration): string {
  return cfg.get<string>('wordWrap', 'off');
}

export function isEditorWordWrapEnabled(editor: TextEditor): boolean {
  return resolveWordWrap(editorConfig(editor)) !== 'off';
}

/**
 * Returns the column limit before a line wraps or overflows the viewport.
 *
 * VS Code does not expose viewport width or per-editor Alt+Z word wrap to extensions.
 * We estimate viewport columns from font size and editor layout, and treat any table
 * wider than that as too wide for inline rendering.
 */
export function getAvailableLineWidth(editor: TextEditor): number {
  const cfg = editorConfig(editor);
  const wordWrap = resolveWordWrap(cfg);
  const viewport = estimateViewportColumns(editor);
  const wrapColumn = cfg.get<number>('wordWrapColumn', 80);

  if (wordWrap === 'wordWrapColumn') {
    return wrapColumn;
  }
  if (wordWrap === 'bounded') {
    return Math.min(wrapColumn, viewport);
  }
  if (wordWrap === 'on') {
    return viewport;
  }

  // wordWrap off (including when toggled via Alt+Z without updating settings):
  // still cap inline tables to the estimated viewport so wide grids fall back to raw.
  return viewport;
}

function estimateViewportColumns(editor: TextEditor): number {
  const cfg = editorConfig(editor);
  const fontSize = cfg.get<number>('fontSize', 14);
  const charWidth = Math.max(1, fontSize * 0.6);

  let contentWidthPx = 960;
  const viewColumn = editor.viewColumn;
  if (viewColumn !== undefined) {
    const splitCount = vscode.window.visibleTextEditors
      .filter((e) => e.viewColumn === viewColumn).length;
    contentWidthPx = Math.floor(1400 / Math.max(1, splitCount));
  }

  return Math.max(40, Math.floor(contentWidthPx / charWidth));
}

export function computeRenderedTableHeaderWidth(
  decorations: DecorationRange[],
  tableScope: ScopeEntry,
  headerLine: number,
  lineAtOffset: (offset: number) => number,
): number {
  let width = 0;
  for (const decoration of decorations) {
    if (!TABLE_ROW_DECORATION_TYPES.has(decoration.type)) {
      continue;
    }
    if (decoration.startPos < tableScope.startPos || decoration.startPos >= tableScope.endPos) {
      continue;
    }
    if (lineAtOffset(decoration.startPos) !== headerLine) {
      continue;
    }
    if (decoration.replacement !== undefined) {
      width += measureTextWidth(decoration.replacement);
    }
  }
  return width;
}

export function computeMaxRawTableLineWidth(
  originalText: string,
  tableScope: ScopeEntry,
  lineAtOffset: (offset: number) => number,
): number {
  const startLine = tableScope.range.start.line;
  const endLine = tableScope.range.end.line;
  let maxWidth = 0;

  for (let offset = tableScope.startPos; offset < tableScope.endPos; offset++) {
    if (offset > tableScope.startPos && originalText[offset - 1] !== '\n') {
      continue;
    }
    const line = lineAtOffset(offset);
    if (line < startLine || line > endLine) {
      continue;
    }

    let lineEnd = originalText.indexOf('\n', offset);
    if (lineEnd === -1 || lineEnd > tableScope.endPos) {
      lineEnd = tableScope.endPos;
    }
    let trimmedEnd = lineEnd;
    while (trimmedEnd > offset && (originalText[trimmedEnd - 1] === ' ' || originalText[trimmedEnd - 1] === '\t')) {
      trimmedEnd--;
    }
    maxWidth = Math.max(maxWidth, measureTextWidth(originalText.substring(offset, trimmedEnd)));
  }

  return maxWidth;
}

export function tableWouldWrap(
  editor: TextEditor,
  tableScope: ScopeEntry,
  decorations: DecorationRange[],
  originalText: string,
  lineAtOffset: (offset: number) => number,
): boolean {
  const availableWidth = getAvailableLineWidth(editor);
  const headerLine = tableScope.range.start.line;
  const lineStartColumn = tableScope.range.start.character;
  const renderedWidth = computeRenderedTableHeaderWidth(
    decorations,
    tableScope,
    headerLine,
    lineAtOffset,
  );
  const rawWidth = computeMaxRawTableLineWidth(originalText, tableScope, lineAtOffset);
  const effectiveWidth = Math.max(renderedWidth, rawWidth);

  if (effectiveWidth === 0) {
    return false;
  }

  return lineStartColumn + effectiveWidth > availableWidth;
}
