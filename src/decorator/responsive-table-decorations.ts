import {
  type TextEditor,
  window,
  Uri,
  type TextEditorDecorationType,
  type Range,
  ColorThemeKind,
  type DecorationOptions,
} from 'vscode';

type ResponsiveTableDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
  isDarkTheme: boolean;
};

export type ResponsiveTableDecorationPayload = {
  dataUri: string;
  widthPx: number;
  heightPx: number;
};

const DEFAULT_FOREGROUND = {
  dark: '#d4d4d4',
  light: '#3c3c3c',
} as const;

const DEFAULT_MUTED = {
  dark: '#858585',
  light: '#6a6a6a',
} as const;

const DEFAULT_DIVIDER = {
  dark: '#3e4451',
  light: '#d0d0d0',
} as const;

export class ResponsiveTableDecorations {
  private cache = new Map<string, ResponsiveTableDecorationEntry>();
  private usageCounter = 0;
  private hideDecorationType: TextEditorDecorationType | undefined;

  constructor(private maxEntries: number = 30) {}

  apply(
    editor: TextEditor,
    optionsByKey: Map<string, DecorationOptions[]>,
    payloadsByKey: Map<string, ResponsiveTableDecorationPayload>,
  ): void {
    const usedKeys = new Set<string>();
    const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    for (const [key, options] of optionsByKey.entries()) {
      const payload = payloadsByKey.get(key);
      if (!payload || options.length === 0) {
        continue;
      }
      const entry = this.getOrCreateEntry(key, payload, isDarkTheme);
      usedKeys.add(key);
      editor.setDecorations(entry.decorationType, options);
    }

    this.disposeUnused(editor, usedKeys);
  }

  clear(editor: TextEditor): void {
    if (this.hideDecorationType) {
      editor.setDecorations(this.hideDecorationType, []);
      this.hideDecorationType.dispose();
      this.hideDecorationType = undefined;
    }
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  applyHidden(editor: TextEditor, ranges: Range[]): void {
    if (ranges.length === 0) {
      return;
    }
    if (!this.hideDecorationType) {
      this.hideDecorationType = window.createTextEditorDecorationType({
        color: '#00000000',
        textDecoration: 'none; display: none;',
        after: {
          contentText: '',
        },
      });
    }
    editor.setDecorations(this.hideDecorationType, ranges);
  }

  private getOrCreateEntry(
    key: string,
    payload: ResponsiveTableDecorationPayload,
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
        contentIconPath: Uri.parse(payload.dataUri),
        textDecoration: 'none;',
        width: `${payload.widthPx}px`,
        height: `${payload.heightPx}px`,
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
    separator: isDarkTheme ? DEFAULT_DIVIDER.dark : DEFAULT_DIVIDER.light,
  };
}
