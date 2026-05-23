import { type TextEditor, window, Uri, type TextEditorDecorationType, type Range, ColorThemeKind } from 'vscode';
import { MERMAID_CONSTANTS } from '../mermaid/constants';

type TableDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
  isDarkTheme: boolean;
};

export class TableDiagramDecorations {
  private cache = new Map<string, TableDecorationEntry>();
  private usageCounter = 0;

  constructor(
    private maxEntries: number = MERMAID_CONSTANTS.DECORATION_CACHE_MAX_ENTRIES,
  ) {}

  apply(editor: TextEditor, rangesByKey: Map<string, Range[]>, dataUrisByKey: Map<string, string>): void {
    const usedKeys = new Set<string>();
    const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    for (const [key, ranges] of rangesByKey.entries()) {
      const dataUri = dataUrisByKey.get(key);
      if (!dataUri || ranges.length === 0) {
        continue;
      }
      const entry = this.getOrCreateEntry(key, dataUri, isDarkTheme);
      usedKeys.add(key);
      editor.setDecorations(entry.decorationType, ranges);
    }

    this.disposeUnused(editor, usedKeys);
    this.trimCacheAfterApply(editor, usedKeys);
  }

  clear(editor: TextEditor): void {
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  clearAll(): void {
    for (const entry of this.cache.values()) {
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  private getOrCreateEntry(key: string, dataUri: string, isDarkTheme: boolean): TableDecorationEntry {
    const existing = this.cache.get(key);
    if (existing && existing.isDarkTheme === isDarkTheme) {
      existing.lastUsed = ++this.usageCounter;
      return existing;
    }

    if (existing) {
      existing.decorationType.dispose();
      this.cache.delete(key);
    }

    const decorationType = window.createTextEditorDecorationType({
      color: 'transparent',
      textDecoration: 'none; display: inline-block; width: 0;',
      before: {
        contentIconPath: Uri.parse(dataUri),
        textDecoration: 'none;',
      },
    });

    const entry: TableDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
      isDarkTheme,
    };
    this.cache.set(key, entry);
    return entry;
  }

  private disposeUnused(editor: TextEditor, usedKeys: Set<string>): void {
    for (const [key, entry] of this.cache.entries()) {
      if (usedKeys.has(key)) {
        continue;
      }
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.cache.delete(key);
    }
  }

  /**
   * Shrinks the cache after a full apply pass. Eviction is deferred so entries
   * created during the apply loop are not disposed before all ranges are set.
   */
  private trimCacheAfterApply(editor: TextEditor, protectKeys: Set<string>): void {
    while (this.cache.size > this.maxEntries) {
      const lruKey = this.findLruKey(protectKeys);
      if (!lruKey) {
        break;
      }
      this.evictKey(editor, lruKey);
    }
  }

  private findLruKey(protectKeys: Set<string>): string | undefined {
    let lruKey: string | undefined;
    let lruAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (protectKeys.has(key)) {
        continue;
      }
      if (entry.lastUsed < lruAccess) {
        lruAccess = entry.lastUsed;
        lruKey = key;
      }
    }

    if (lruKey) {
      return lruKey;
    }

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < lruAccess) {
        lruAccess = entry.lastUsed;
        lruKey = key;
      }
    }

    return lruKey;
  }

  private evictKey(editor: TextEditor, key: string): void {
    const entry = this.cache.get(key);
    if (!entry) {
      return;
    }
    editor.setDecorations(entry.decorationType, []);
    entry.decorationType.dispose();
    this.cache.delete(key);
  }
}
