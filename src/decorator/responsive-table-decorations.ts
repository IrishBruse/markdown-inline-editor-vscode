import { type TextEditor, window, Uri, type TextEditorDecorationType, type Range, ColorThemeKind } from 'vscode';

type ResponsiveTableDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
  isDarkTheme: boolean;
};

const DEFAULT_FOREGROUND = {
  dark: '#d4d4d4',
  light: '#3c3c3c',
} as const;

const DEFAULT_MUTED = {
  dark: '#858585',
  light: '#6a6a6a',
} as const;

export class ResponsiveTableDecorations {
  private cache = new Map<string, ResponsiveTableDecorationEntry>();
  private usageCounter = 0;

  constructor(private maxEntries: number = 30) {}

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
  }

  clear(editor: TextEditor): void {
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  private getOrCreateEntry(
    key: string,
    dataUri: string,
    isDarkTheme: boolean,
  ): ResponsiveTableDecorationEntry {
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

    const entry: ResponsiveTableDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
      isDarkTheme,
    };
    this.cache.set(key, entry);
    this.evictIfNeeded();
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

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxEntries) {
      return;
    }

    let lruKey: string | undefined;
    let lruAccess = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < lruAccess) {
        lruAccess = entry.lastUsed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey);
      entry?.decorationType.dispose();
      this.cache.delete(lruKey);
    }
  }
}

export function getResponsiveTableTheme(isDarkTheme: boolean): {
  foreground: string;
  mutedForeground: string;
  separator: string;
} {
  return {
    foreground: isDarkTheme ? DEFAULT_FOREGROUND.dark : DEFAULT_FOREGROUND.light,
    mutedForeground: isDarkTheme ? DEFAULT_MUTED.dark : DEFAULT_MUTED.light,
    separator: isDarkTheme ? DEFAULT_MUTED.dark : DEFAULT_MUTED.light,
  };
}
