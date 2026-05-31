import { createHash } from 'crypto';
import {
  ColorThemeKind,
  DecorationOptions,
  Position,
  Range,
  TextEditor,
  Uri,
  window,
  workspace,
} from 'vscode';
import type { TableBlock } from '../parser';
import { svgToDataUri } from '../mermaid/svg-processor';
import { resolveTableColors, tableColorsCacheKey } from '../tables/table-colors';
import {
  buildTableLayout,
  getEditorLineMetrics,
  renderTableSvgLineSlice,
} from '../tables/table-renderer';
import { SvgOverlayDecorations } from './mermaid-diagram-decorations';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';

/** Unique table SVG slice renders per event-loop turn before yielding (avoids UI jank). */
export const TABLE_SVG_RENDER_BATCH_SIZE = 20;

type TableBlockKeyCacheEntry = {
  isDark: boolean;
  colorsKey: string;
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

type SliceRenderJob = {
  sliceKey: string;
  block: TableBlock;
  sourceLineIndex: number;
};

const tableBlockKeyCache = new WeakMap<TableBlock, TableBlockKeyCacheEntry>();

function getTableBlockCacheKey(
  block: TableBlock,
  isDark: boolean,
  colorsKey: string,
  lineHeight: number,
  fontSize: number,
  fontFamily: string | undefined,
): string {
  const cached = tableBlockKeyCache.get(block);
  if (
    cached &&
    cached.isDark === isDark &&
    cached.colorsKey === colorsKey &&
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
    colorsKey,
    numLines: block.numLines,
    lineHeight,
    fontSize,
    fontFamily,
  });
  const key = createHash('sha256').update(keySource).digest('hex');
  tableBlockKeyCache.set(block, {
    isDark,
    colorsKey,
    numLines: block.numLines,
    lineHeight,
    fontSize,
    fontFamily,
    key,
  });
  return key;
}

function sliceCacheKey(blockKey: string, sourceLineIndex: number): string {
  return `${blockKey}:${sourceLineIndex}`;
}

function createTableLineRange(
  editor: TextEditor,
  block: TableBlock,
  sourceLineIndex: number,
  normalizedText: string,
): Range | null {
  const tableRange = createRange(editor, block.startPos, block.endPos, normalizedText);
  if (!tableRange) {
    return null;
  }

  const line = tableRange.start.line + sourceLineIndex;
  if (line > tableRange.end.line) {
    return null;
  }

  const lineText = editor.document.lineAt(line);
  return new Range(new Position(line, 0), new Position(line, lineText.text.length));
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
    const tableColors = resolveTableColors(isDark);
    const colorsKey = tableColorsCacheKey(tableColors);
    const { lineHeight, fontSize } = getEditorLineMetrics();
    const fontFamily = workspace.getConfiguration('editor').get<string>('fontFamily');
    const renderThemeKey = `${isDark}:${colorsKey}:${lineHeight}:${fontSize}:${fontFamily ?? ''}`;
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

    const decorationsByKey = new Map<string, DecorationOptions[]>();
    const jobsToRender: SliceRenderJob[] = [];

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

      const blockKey = getTableBlockCacheKey(block, isDark, colorsKey, lineHeight, fontSize, fontFamily);

      for (let sourceLineIndex = 0; sourceLineIndex < block.numLines; sourceLineIndex++) {
        const lineRange = createTableLineRange(editor, block, sourceLineIndex, normalizedText);
        if (!lineRange) {
          continue;
        }

        const key = sliceCacheKey(blockKey, sourceLineIndex);

        const cachedUri = this.svgDataUriCache.get(key);
        if (cachedUri) {
          const options: DecorationOptions = {
            range: lineRange,
            renderOptions: {
              before: {
                contentIconPath: Uri.parse(cachedUri),
                textDecoration: 'none;',
              },
            },
          };
          const existing = decorationsByKey.get(key) || [];
          existing.push(options);
          decorationsByKey.set(key, existing);
          continue;
        }

        if (!jobsToRender.some((job) => job.sliceKey === key)) {
          jobsToRender.push({ sliceKey: key, block, sourceLineIndex });
        }
      }
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      this.inFlightSignature = null;
      return;
    }

    const renderOptions = {
      isDark,
      colors: tableColors,
      lineHeight,
      fontSize,
      fontFamily,
      capToSourceLines: false,
    };

    for (let offset = 0; offset < jobsToRender.length; offset += this.renderBatchSize) {
      if (token !== this.updateToken || editor.document.version !== documentVersion) {
        this.inFlightSignature = null;
        return;
      }

      const batch = jobsToRender.slice(offset, offset + this.renderBatchSize);
      for (const job of batch) {
        const layout = buildTableLayout(job.block, renderOptions);
        const svg = renderTableSvgLineSlice(layout, job.sourceLineIndex);
        if (!svg) {
          continue;
        }
        this.svgDataUriCache.set(job.sliceKey, svgToDataUri(svg));

        const lineRange = createTableLineRange(
          editor,
          job.block,
          job.sourceLineIndex,
          normalizedText,
        );
        if (!lineRange) {
          continue;
        }

        const dataUri = this.svgDataUriCache.get(job.sliceKey)!;
        const options: DecorationOptions = {
          range: lineRange,
          renderOptions: {
            before: {
              contentIconPath: Uri.parse(dataUri),
              textDecoration: 'none;',
            },
          },
        };
        const existing = decorationsByKey.get(job.sliceKey) || [];
        existing.push(options);
        decorationsByKey.set(job.sliceKey, existing);
      }

      const hasMore = offset + batch.length < jobsToRender.length;
      if (hasMore) {
        await this.yieldToEventLoop();
      }
    }

    if (token !== this.updateToken || editor.document.version !== documentVersion) {
      this.inFlightSignature = null;
      return;
    }

    this.overlayDecorations.apply(editor, decorationsByKey);

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
