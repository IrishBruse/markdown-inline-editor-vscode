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

type CoordinatorState = {
  uri: string;
  documentVersion: number;
  visibilitySignature: string;
  renderThemeKey: string;
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

/** Which tables are hidden vs shown given the current selection. */
export function buildTableVisibilitySignature(
  tableBlocks: TableBlock[],
  normalizedText: string,
  editor: TextEditor,
): string {
  const parts: string[] = [];
  for (const block of tableBlocks) {
    const hidden = isSelectionOrCursorInsideOffsets(
      block.startPos,
      block.endPos,
      normalizedText,
      editor.selections,
      editor.document,
    );
    parts.push(hidden ? `h:${block.startPos}` : `v:${block.startPos}`);
  }
  return parts.join('|');
}

function defaultYieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export class CustomTableUpdateCoordinator {
  private updateToken = 0;
  private appliedState: CoordinatorState | null = null;
  private inFlightSignature: string | null = null;
  private readonly svgDataUriCache = new Map<string, string>();

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

  private resetCoordinatorState(): void {
    this.appliedState = null;
    this.inFlightSignature = null;
    this.svgDataUriCache.clear();
  }

  private matchesAppliedState(
    uri: string,
    documentVersion: number,
    visibilitySignature: string,
    renderThemeKey: string,
  ): boolean {
    return (
      this.appliedState !== null &&
      this.appliedState.uri === uri &&
      this.appliedState.documentVersion === documentVersion &&
      this.appliedState.visibilitySignature === visibilitySignature &&
      this.appliedState.renderThemeKey === renderThemeKey
    );
  }

  async updateAsync(
    editor: TextEditor,
    tableBlocks: TableBlock[],
    normalizedText: string,
    documentVersion: number,
  ): Promise<void> {
    const editorUri = editor.document.uri.toString();

    if (tableBlocks.length === 0) {
      this.updateToken++;
      this.resetCoordinatorState();
      this.overlayDecorations.clear(editor);
      return;
    }

    const isDark = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;
    const { lineHeight, fontSize } = getEditorLineMetrics();
    const fontFamily = workspace.getConfiguration('editor').get<string>('fontFamily');
    const renderThemeKey = `${isDark}:${lineHeight}:${fontSize}:${fontFamily ?? ''}`;
    const visibilitySignature = buildTableVisibilitySignature(
      tableBlocks,
      normalizedText,
      editor,
    );

    if (this.inFlightSignature === visibilitySignature) {
      return;
    }

    if (this.matchesAppliedState(editorUri, documentVersion, visibilitySignature, renderThemeKey)) {
      return;
    }

    if (this.appliedState?.documentVersion !== documentVersion) {
      this.svgDataUriCache.clear();
    }

    const token = ++this.updateToken;
    this.inFlightSignature = visibilitySignature;

    const rangesByKey = new Map<string, Range[]>();
    const dataUrisByKey = new Map<string, string>();
    const keysToRender: string[] = [];
    const blockByKey = new Map<string, TableBlock>();

    for (const block of tableBlocks) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        this.inFlightSignature = null;
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
        if (!this.svgDataUriCache.has(key)) {
          keysToRender.push(key);
        }
      }

      const ranges = rangesByKey.get(key) || [];
      ranges.push(range);
      rangesByKey.set(key, ranges);
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      this.inFlightSignature = null;
      return;
    }

    const renderOptions = { isDark, lineHeight, fontSize, fontFamily };

    for (let offset = 0; offset < keysToRender.length; offset += this.renderBatchSize) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        this.inFlightSignature = null;
        return;
      }

      const batch = keysToRender.slice(offset, offset + this.renderBatchSize);
      for (const key of batch) {
        const block = blockByKey.get(key);
        if (!block) {
          continue;
        }
        const svg = renderTableSvg(block, renderOptions);
        this.svgDataUriCache.set(key, svgToDataUri(svg));
      }

      const hasMore = offset + batch.length < keysToRender.length;
      if (hasMore) {
        await this.yieldToEventLoop();
      }
    }

    for (const key of rangesByKey.keys()) {
      const cached = this.svgDataUriCache.get(key);
      if (cached) {
        dataUrisByKey.set(key, cached);
      }
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      this.inFlightSignature = null;
      return;
    }

    this.overlayDecorations.apply(editor, rangesByKey, dataUrisByKey);

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      this.inFlightSignature = null;
      return;
    }

    this.appliedState = {
      uri: editorUri,
      documentVersion,
      visibilitySignature,
      renderThemeKey,
    };
    this.inFlightSignature = null;
  }
}
