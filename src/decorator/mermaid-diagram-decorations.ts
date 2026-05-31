import {
  type TextEditor,
  window,
  Uri,
  type TextEditorDecorationType,
  type Range,
  type DecorationOptions,
  ColorThemeKind,
} from 'vscode';

type MermaidDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
  isDarkTheme: boolean;
};

function isDecorationOptionsEntry(
  value: Range | DecorationOptions,
): value is DecorationOptions {
  return typeof value === 'object' && value !== null && 'range' in value;
}

export class MermaidDiagramDecorations {
  private cache = new Map<string, MermaidDecorationEntry>();
  private optionsCache = new Map<string, MermaidDecorationEntry>();
  private usageCounter = 0;

  constructor(private maxEntries: number = 50) {}

  /**
   * Apply SVG overlays. Each key is either:
   * - `Range[]` plus a matching entry in {@link dataUrisByKey} (Mermaid), or
   * - `DecorationOptions[]` with per-range `renderOptions.before.contentIconPath` (custom tables).
   */
  apply(
    editor: TextEditor,
    rangesByKey: Map<string, Range[] | DecorationOptions[]>,
    dataUrisByKey: Map<string, string> = new Map(),
  ): void {
    const usedKeys = new Set<string>();
    const batchKeys = new Set(rangesByKey.keys());
    const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    for (const [key, entries] of rangesByKey.entries()) {
      if (entries.length === 0) {
        continue;
      }

      if (isDecorationOptionsEntry(entries[0])) {
        const entry = this.getOrCreateOptionsEntry(key, isDarkTheme, batchKeys);
        usedKeys.add(`opt:${key}`);
        editor.setDecorations(entry.decorationType, entries as DecorationOptions[]);
        continue;
      }

      const dataUri = dataUrisByKey.get(key);
      if (!dataUri) {
        continue;
      }
      const entry = this.getOrCreateEntry(key, dataUri, isDarkTheme, batchKeys);
      usedKeys.add(`uri:${key}`);
      editor.setDecorations(entry.decorationType, entries as Range[]);
    }

    this.disposeUnused(editor, usedKeys);
  }

  clear(editor: TextEditor): void {
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
    for (const entry of this.optionsCache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.optionsCache.clear();
  }

  private getOrCreateEntry(
    key: string,
    dataUri: string,
    isDarkTheme: boolean,
    protectedKeys: ReadonlySet<string>,
  ): MermaidDecorationEntry {
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

    const entry: MermaidDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
      isDarkTheme,
    };
    this.cache.set(key, entry);
    this.evictIfNeeded(protectedKeys, 'uri');
    return entry;
  }

  private getOrCreateOptionsEntry(
    key: string,
    isDarkTheme: boolean,
    protectedKeys: ReadonlySet<string>,
  ): MermaidDecorationEntry {
    const existing = this.optionsCache.get(key);
    if (existing && existing.isDarkTheme === isDarkTheme) {
      existing.lastUsed = ++this.usageCounter;
      return existing;
    }

    if (existing) {
      existing.decorationType.dispose();
      this.optionsCache.delete(key);
    }

    const decorationType = window.createTextEditorDecorationType({
      color: 'transparent',
      textDecoration: 'none; display: inline-block; width: 0;',
      before: {
        textDecoration: 'none;',
      },
    });

    const entry: MermaidDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
      isDarkTheme,
    };
    this.optionsCache.set(key, entry);
    this.evictIfNeeded(protectedKeys, 'opt');
    return entry;
  }

  private disposeUnused(editor: TextEditor, usedKeys: Set<string>): void {
    for (const [key, entry] of this.cache.entries()) {
      if (usedKeys.has(`uri:${key}`)) {
        continue;
      }
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.cache.delete(key);
    }
    for (const [key, entry] of this.optionsCache.entries()) {
      if (usedKeys.has(`opt:${key}`)) {
        continue;
      }
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.optionsCache.delete(key);
    }
  }

  private evictIfNeeded(
    protectedKeys: ReadonlySet<string>,
    prefix: 'uri' | 'opt',
  ): void {
    const store = prefix === 'uri' ? this.cache : this.optionsCache;
    while (store.size > this.maxEntries) {
      let lruKey: string | undefined;
      let lruAccess = Infinity;
      for (const [key, entry] of store.entries()) {
        if (protectedKeys.has(key)) {
          continue;
        }
        if (entry.lastUsed < lruAccess) {
          lruAccess = entry.lastUsed;
          lruKey = key;
        }
      }

      if (!lruKey) {
        return;
      }

      const entry = store.get(lruKey);
      entry?.decorationType.dispose();
      store.delete(lruKey);
    }
  }
}

/** Shared SVG data-URI overlay decoration cache (Mermaid diagrams, custom tables, etc.). */
export { MermaidDiagramDecorations as SvgOverlayDecorations };
