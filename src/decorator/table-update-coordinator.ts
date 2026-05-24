import { createHash } from 'crypto';
import { ColorThemeKind, Range, TextEditor, window, workspace } from 'vscode';
import type { TableBlock } from '../parser';
import { getTableThemeColors, renderTableSvg } from '../tables/table-renderer';
import type { TableHtmlTheme } from '../parser/tables-html';
import { svgToDataUri } from '../mermaid/mermaid-renderer';
import { TableDiagramDecorations } from './table-diagram-decorations';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';
import { logWarn } from '../logging';
import { createErrorSvg } from '../mermaid/error-handler';

type TableBlockKeyCacheEntry = {
  theme: TableHtmlTheme;
  fontFamily?: string;
  key: string;
};

const tableBlockKeyCache = new WeakMap<TableBlock, TableBlockKeyCacheEntry>();

function getTableBlockCacheKey(
  block: TableBlock,
  theme: TableHtmlTheme,
  fontFamily: string | undefined,
): string {
  const cached = tableBlockKeyCache.get(block);
  if (
    cached &&
    cached.theme.foreground === theme.foreground &&
    cached.theme.border === theme.border &&
    cached.theme.headerBackground === theme.headerBackground &&
    cached.theme.cellBackground === theme.cellBackground &&
    cached.fontFamily === fontFamily
  ) {
    return cached.key;
  }

  const keySource =
    `${JSON.stringify(block.rows)}\n${theme.foreground}\n${theme.border}\n` +
    `${theme.headerBackground}\n${theme.cellBackground}\n${fontFamily ?? ''}`;
  const key = createHash('sha256').update(keySource).digest('hex');
  tableBlockKeyCache.set(block, { theme, fontFamily, key });
  return key;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  };

  const concurrency = Math.max(1, Math.min(maxConcurrency, items.length));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export class TableUpdateCoordinator {
  private tableUpdateToken = 0;
  private latestUpdateGeneration = 0;

  /** Cancels in-flight table renders (e.g. when rendering mode changes). */
  invalidate(): void {
    this.tableUpdateToken++;
    this.latestUpdateGeneration++;
  }

  constructor(
    private readonly tableDecorations: TableDiagramDecorations,
    private readonly maxConcurrency: number
  ) {}

  async update(
    editor: TextEditor,
    tableBlocks: TableBlock[],
    normalizedText: string,
    documentVersion: number,
  ): Promise<void> {
    if (tableBlocks.length === 0) {
      this.tableDecorations.clear(editor);
      return;
    }

    const generation = ++this.latestUpdateGeneration;
    const runToken = this.tableUpdateToken;
    const tableTheme = getTableThemeColors();
    const fontFamily = workspace.getConfiguration('editor').get<string>('fontFamily');
    const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    const rangesByKey = new Map<string, Range[]>();
    const dataUrisByKey = new Map<string, string>();
    const dataUriPromisesByKey = new Map<string, Promise<string>>();

    const results = await mapWithConcurrency(
      tableBlocks,
      this.maxConcurrency,
      async (block): Promise<{ key: string; range: Range; dataUri: string } | null> => {
        if (runToken !== this.tableUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        if (isSelectionOrCursorInsideOffsets(
          block.startPos,
          block.endPos,
          normalizedText,
          editor.selections,
          editor.document
        )) {
          return null;
        }

        const range = createRange(editor, block.startPos, block.endPos, normalizedText);
        if (!range) {
          return null;
        }

        const key = getTableBlockCacheKey(block, tableTheme, fontFamily);
        let dataUriPromise = dataUriPromisesByKey.get(key);
        if (!dataUriPromise) {
          dataUriPromise = (async () => {
            try {
              const svg = await renderTableSvg(block.rows, {
                theme: tableTheme,
                fontFamily,
                numLines: block.numLines,
              });
              return svgToDataUri(svg);
            } catch (error) {
              logWarn('Table render failed', error);
              const message = error instanceof Error
                ? (error.message || error.toString() || 'Rendering failed')
                : (typeof error === 'string' ? error : String(error) || 'Rendering failed');
              const errorSvg = createErrorSvg(
                message.trim().length > 0 ? message : 'Table rendering failed',
                200,
                block.numLines * 20,
                isDarkTheme,
                'Table Rendering Error'
              );
              return svgToDataUri(errorSvg);
            }
          })();
          dataUriPromisesByKey.set(key, dataUriPromise);
        }

        const dataUri = await dataUriPromise;
        if (runToken !== this.tableUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        return { key, range, dataUri };
      }
    );

    for (const result of results) {
      if (!result) {
        continue;
      }
      dataUrisByKey.set(result.key, result.dataUri);
      const ranges = rangesByKey.get(result.key) || [];
      ranges.push(result.range);
      rangesByKey.set(result.key, ranges);
    }

    if (
      generation !== this.latestUpdateGeneration ||
      runToken !== this.tableUpdateToken ||
      editor.document.version !== documentVersion
    ) {
      return;
    }

    // Apply even when empty so disposeUnused removes overlays for tables covered by
    // selection/caret (those blocks return null above).
    this.tableDecorations.apply(editor, rangesByKey, dataUrisByKey);
  }
}
