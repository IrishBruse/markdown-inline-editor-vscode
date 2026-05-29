import { createHash } from 'crypto';
import { ColorThemeKind, Range, TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { svgToDataUri } from '../mermaid/svg-processor';
import { getEditorLineMetrics, renderTableSvg } from '../tables/table-renderer';
import { SvgOverlayDecorations } from './mermaid-diagram-decorations';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';

/** Unique table SVG renders per event-loop turn before yielding (avoids UI jank). */
export const TABLE_SVG_RENDER_BATCH_SIZE = 20;

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

function defaultYieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export class CustomTableUpdateCoordinator {
  private updateToken = 0;

  constructor(
    private readonly overlayDecorations: SvgOverlayDecorations,
    private readonly renderBatchSize: number = TABLE_SVG_RENDER_BATCH_SIZE,
    private readonly yieldToEventLoop: () => Promise<void> = defaultYieldToEventLoop,
  ) {}

  update(
    editor: TextEditor,
    tableBlocks: TableBlock[],
    normalizedText: string,
    documentVersion: number,
  ): void {
    void this.updateAsync(editor, tableBlocks, normalizedText, documentVersion);
  }

  async updateAsync(
    editor: TextEditor,
    tableBlocks: TableBlock[],
    normalizedText: string,
    documentVersion: number,
  ): Promise<void> {
    if (tableBlocks.length === 0) {
      this.overlayDecorations.clear(editor);
      return;
    }

    const token = ++this.updateToken;
    const isDark = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    const rangesByKey = new Map<string, Range[]>();
    const dataUrisByKey = new Map<string, string>();
    const keysToRender: string[] = [];
    const blockByKey = new Map<string, TableBlock>();
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
      if (!blockByKey.has(key)) {
        blockByKey.set(key, block);
        keysToRender.push(key);
      }

      const ranges = rangesByKey.get(key) || [];
      ranges.push(range);
      rangesByKey.set(key, ranges);
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      return;
    }

    const renderOptions = { isDark, lineHeight, fontSize, fontFamily };

    for (let offset = 0; offset < keysToRender.length; offset += this.renderBatchSize) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        return;
      }

      const batch = keysToRender.slice(offset, offset + this.renderBatchSize);
      for (const key of batch) {
        const block = blockByKey.get(key);
        if (!block) {
          continue;
        }
        const svg = renderTableSvg(block, renderOptions);
        dataUrisByKey.set(key, svgToDataUri(svg));
      }

      this.overlayDecorations.apply(editor, rangesByKey, dataUrisByKey);

      const hasMore = offset + batch.length < keysToRender.length;
      if (hasMore) {
        await this.yieldToEventLoop();
      }
    }

    if (keysToRender.length === 0) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        return;
      }
      this.overlayDecorations.apply(editor, rangesByKey, dataUrisByKey);
    }
  }
}
