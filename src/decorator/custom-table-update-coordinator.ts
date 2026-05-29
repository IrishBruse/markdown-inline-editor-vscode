import { createHash } from 'crypto';
import { ColorThemeKind, Range, TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { svgToDataUri } from '../mermaid/svg-processor';
import { getEditorLineMetrics, renderTableSvg } from '../tables/table-renderer';
import { SvgOverlayDecorations } from './mermaid-diagram-decorations';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';

type TableBlockKeyCacheEntry = {
  isDark: boolean;
  numLines: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string | undefined;
  key: string;
};

const tableBlockKeyCache = new WeakMap<TableBlock, TableBlockKeyCacheEntry>();

function getTableBlockCacheKey(
  block: TableBlock,
  isDark: boolean,
  lineHeight: number,
  fontSize: number,
  fontFamily: string | undefined,
): string {
  const cached = tableBlockKeyCache.get(block);
  if (
    cached &&
    cached.isDark === isDark &&
    cached.numLines === block.numLines &&
    cached.lineHeight === lineHeight &&
    cached.fontSize === fontSize &&
    cached.fontFamily === fontFamily
  ) {
    return cached.key;
  }

  const keySource = JSON.stringify({
    header: block.header,
    rows: block.rows,
    align: block.align,
    isDark,
    numLines: block.numLines,
    lineHeight,
    fontSize,
    fontFamily,
  });
  const key = createHash('sha256').update(keySource).digest('hex');
  tableBlockKeyCache.set(block, {
    isDark,
    numLines: block.numLines,
    lineHeight,
    fontSize,
    fontFamily,
    key,
  });
  return key;
}

export class CustomTableUpdateCoordinator {
  private updateToken = 0;

  constructor(private readonly overlayDecorations: SvgOverlayDecorations) {}

  update(
    editor: TextEditor,
    tableBlocks: TableBlock[],
    normalizedText: string,
    documentVersion: number,
  ): void {
    if (tableBlocks.length === 0) {
      this.overlayDecorations.clear(editor);
      return;
    }

    const token = ++this.updateToken;
    const isDark = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    const rangesByKey = new Map<string, Range[]>();
    const dataUrisByKey = new Map<string, string>();
    const { lineHeight, fontSize } = getEditorLineMetrics();
    const fontFamily = workspace.getConfiguration('editor').get<string>('fontFamily');

    for (const block of tableBlocks) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        return;
      }

      if (isSelectionOrCursorInsideOffsets(
        block.startPos,
        block.endPos,
        normalizedText,
        editor.selections,
        editor.document,
      )) {
        continue;
      }

      const range = createRange(editor, block.startPos, block.endPos, normalizedText);
      if (!range) {
        continue;
      }

      const key = getTableBlockCacheKey(block, isDark, lineHeight, fontSize, fontFamily);
      if (!dataUrisByKey.has(key)) {
        const svg = renderTableSvg(block, { isDark, lineHeight, fontSize, fontFamily });
        dataUrisByKey.set(key, svgToDataUri(svg));
      }

      const ranges = rangesByKey.get(key) || [];
      ranges.push(range);
      rangesByKey.set(key, ranges);
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      return;
    }

    this.overlayDecorations.apply(editor, rangesByKey, dataUrisByKey);
  }
}
