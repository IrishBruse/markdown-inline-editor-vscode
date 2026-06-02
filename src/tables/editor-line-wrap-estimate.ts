import { type TextEditor, workspace } from 'vscode';
import { measureTextWidth } from '../parser/tables';
import { getEditorLineMetrics } from './rendering/shared';

/** 1-based document line number used for wrap-height debug logging. */
export const DEBUG_DOCUMENT_LINE_ONE_BASED = 324;

/** Fallback viewport width in monospace units when wordWrap is on or bounded. */
export const DEFAULT_VIEWPORT_WRAP_CHARS = 80;

/** Typical editor content area width (px) used to approximate viewport wrap columns. */
const EDITOR_CONTENT_WIDTH_PX = 960;

export type EditorLineWrapEstimate = {
  method: 'manual-column-units';
  wordWrap: string;
  wordWrapColumn: number;
  wrapBoundaryUnits: number;
  wrapLineCount: number;
  lineHeightPx: number;
  estimatedPixelHeightPx: number;
  fontSize: number;
  charWidthPx: number;
  lineTextLength: number;
  lineTextUnits: number;
  /** True when wrap boundary used an approximate viewport width. */
  viewportApproximate: boolean;
};

/** Resolve how many monospace width units fit on one editor visual line. */
export function getEditorWrapBoundaryUnits(
  wordWrap: string,
  wordWrapColumn: number,
  viewportCharsApprox: number,
): { boundary: number; viewportApproximate: boolean } {
  switch (wordWrap) {
    case 'off':
      return { boundary: Number.MAX_SAFE_INTEGER, viewportApproximate: false };
    case 'wordWrapColumn':
      return { boundary: wordWrapColumn, viewportApproximate: false };
    case 'bounded':
      return {
        boundary: Math.min(viewportCharsApprox, wordWrapColumn),
        viewportApproximate: true,
      };
    case 'on':
    default:
      return { boundary: viewportCharsApprox, viewportApproximate: true };
  }
}

/**
 * Approximate viewport wrap width from font size (~960px content area / char width).
 * VS Code wraps by pixel width; this is closer than a fixed 80-column guess.
 */
export function estimateViewportCharsFromFont(fontSize: number): number {
  const charWidthPx = fontSize * 0.6;
  return Math.max(DEFAULT_VIEWPORT_WRAP_CHARS, Math.floor(EDITOR_CONTENT_WIDTH_PX / charWidthPx));
}

/**
 * Count visual lines when the editor wraps by column width (not word boundaries).
 * GFM table rows with pipe padding collapse to few tokens in word-wrap but many columns visually.
 */
export function countVisualWrapLinesByUnits(lineText: string, maxUnits: number): number {
  const totalUnits = measureTextWidth(lineText);
  if (totalUnits <= 0) {
    return 1;
  }
  if (maxUnits <= 0 || totalUnits <= maxUnits) {
    return 1;
  }
  return Math.ceil(totalUnits / maxUnits);
}

/**
 * Approximate how many visual lines the editor uses for a source line (Method 2).
 * VS Code does not expose rendered line height; this uses editor word-wrap settings.
 */
export function estimateEditorLineWrap(
  lineText: string,
  options?: { editor?: TextEditor; viewportCharsApprox?: number },
): EditorLineWrapEstimate {
  const editor = options?.editor;
  const config = workspace.getConfiguration('editor', editor?.document.uri);
  const wordWrap = config.get<string>('wordWrap') ?? 'off';
  const wordWrapColumn = config.get<number>('wordWrapColumn') ?? 80;
  const { lineHeight: lineHeightPx, fontSize } = getEditorLineMetrics();
  const charWidthPx = fontSize * 0.6;
  const lineTextUnits = measureTextWidth(lineText);

  const viewportCharsApprox = options?.viewportCharsApprox
    ?? estimateViewportCharsFromFont(fontSize);

  const { boundary, viewportApproximate } = getEditorWrapBoundaryUnits(
    wordWrap,
    wordWrapColumn,
    viewportCharsApprox,
  );

  const wrapLineCount = wordWrap === 'off'
    ? 1
    : countVisualWrapLinesByUnits(lineText, boundary);
  const estimatedPixelHeightPx = wrapLineCount * lineHeightPx;

  return {
    method: 'manual-column-units',
    wordWrap,
    wordWrapColumn,
    wrapBoundaryUnits: boundary,
    wrapLineCount,
    lineHeightPx,
    estimatedPixelHeightPx,
    fontSize,
    charWidthPx,
    lineTextLength: lineText.length,
    lineTextUnits,
    viewportApproximate,
  };
}

export function isDebugDocumentLine(docLineOneBased: number): boolean {
  return docLineOneBased === DEBUG_DOCUMENT_LINE_ONE_BASED;
}
