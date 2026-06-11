import * as vscode from 'vscode';
import type { TextEditor } from 'vscode';
import type { DecorationRange } from '../parser';
import { measureTextWidth } from '../parser/tables';
import type { ScopeEntry } from './visibility-model';

const TABLE_ROW_DECORATION_TYPES = new Set<string>(['tablePipe', 'tableCell']);

export function isEditorWordWrapEnabled(uri: vscode.Uri): boolean {
  const cfg = vscode.workspace.getConfiguration('editor', uri);
  return cfg.get<string>('wordWrap', 'off') !== 'off';
}

/**
 * Returns the column limit before a line wraps, or undefined when word wrap is off.
 *
 * VS Code does not expose viewport width to extensions. For `editor.wordWrap: on`,
 * we estimate viewport columns from font size and split-editor layout.
 */
export function getWrapColumnLimit(editor: TextEditor): number | undefined {
  const cfg = vscode.workspace.getConfiguration('editor', editor.document.uri);
  const wordWrap = cfg.get<string>('wordWrap', 'off');
  if (wordWrap === 'off') {
    return undefined;
  }

  const wrapColumn = cfg.get<number>('wordWrapColumn', 80);
  if (wordWrap === 'wordWrapColumn' || wordWrap === 'bounded') {
    return wrapColumn;
  }

  return estimateViewportColumns(editor);
}

function estimateViewportColumns(editor: TextEditor): number {
  const cfg = vscode.workspace.getConfiguration('editor', editor.document.uri);
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

export function tableWouldWrap(
  editor: TextEditor,
  tableScope: ScopeEntry,
  decorations: DecorationRange[],
  lineAtOffset: (offset: number) => number,
): boolean {
  const wrapLimit = getWrapColumnLimit(editor);
  if (wrapLimit === undefined) {
    return false;
  }

  const headerLine = tableScope.range.start.line;
  const lineStartColumn = tableScope.range.start.character;
  const renderedWidth = computeRenderedTableHeaderWidth(
    decorations,
    tableScope,
    headerLine,
    lineAtOffset,
  );

  if (renderedWidth === 0) {
    return false;
  }

  return lineStartColumn + renderedWidth > wrapLimit;
}
