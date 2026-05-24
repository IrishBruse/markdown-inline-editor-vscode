import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  ColorThemeKind,
  extensions,
  window,
  workspace,
} from 'vscode';
import { getTableThemeFallback, type TableHtmlTheme } from '../parser/tables-html';

type ThemeColorEntry =
  | string
  | {
      dark?: string;
      light?: string;
      highContrast?: string;
      highContrastLight?: string;
    };

type ThemeFile = {
  include?: string;
  colors?: Record<string, ThemeColorEntry>;
};

type ThemeColorMap = Record<string, string>;

let cachedTheme: TableHtmlTheme | undefined;
let cachedThemeName: string | undefined;

function isDarkTheme(): boolean {
  const kind = window.activeColorTheme.kind;
  return kind === ColorThemeKind.Dark || kind === ColorThemeKind.HighContrast;
}

function isUsableColor(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === 'transparent' || trimmed === 'none') {
    return false;
  }
  const alphaMatch = trimmed.match(/,\s*([\d.]+)\s*\)\s*$/);
  if (alphaMatch && Number.parseFloat(alphaMatch[1]) < 0.08) {
    return false;
  }
  return true;
}

function pickColor(keys: string[], resolved: ThemeColorMap, fallback: string): string {
  for (const key of keys) {
    const value = resolved[key];
    if (isUsableColor(value)) {
      return value!.trim();
    }
  }
  return fallback;
}

export function buildTableThemeFromResolved(
  resolved: ThemeColorMap,
  fallback: TableHtmlTheme,
): TableHtmlTheme {
  return {
    foreground: pickColor(['editor.foreground'], resolved, fallback.foreground),
    border: pickColor(
      ['panel.border', 'editorWidget.border', 'contrastBorder'],
      resolved,
      fallback.border,
    ),
    headerBackground: pickColor(
      [
        'editor.lineHighlightBackground',
        'editor.selectionHighlightBackground',
        'list.hoverBackground',
        'editor.inactiveSelectionBackground',
      ],
      resolved,
      fallback.headerBackground,
    ),
    cellBackground: pickColor(['editor.background'], resolved, fallback.cellBackground),
  };
}

function parseThemeJson(text: string): ThemeFile {
  const withoutBlock = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlock.replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(withoutLineComments) as ThemeFile;
}

function resolveThemeColorEntry(entry: ThemeColorEntry, kind: ColorThemeKind): string | undefined {
  if (typeof entry === 'string') {
    return entry;
  }
  if (kind === ColorThemeKind.HighContrast) {
    return entry.highContrast ?? entry.dark;
  }
  if (kind === ColorThemeKind.HighContrastLight) {
    return entry.highContrastLight ?? entry.light;
  }
  if (kind === ColorThemeKind.Light) {
    return entry.light;
  }
  return entry.dark;
}

function loadThemeFileColors(themeFilePath: string, visited = new Set<string>()): ThemeColorMap {
  const absolutePath = resolve(themeFilePath);
  if (visited.has(absolutePath) || !existsSync(absolutePath)) {
    return {};
  }
  visited.add(absolutePath);

  let colors: ThemeColorMap = {};
  try {
    const parsed = parseThemeJson(readFileSync(absolutePath, 'utf8'));
    if (parsed.include) {
      const includePath = resolve(dirname(absolutePath), parsed.include);
      colors = { ...colors, ...loadThemeFileColors(includePath, visited) };
    }
    const kind = window.activeColorTheme.kind;
    for (const [key, value] of Object.entries(parsed.colors ?? {})) {
      const resolved = resolveThemeColorEntry(value, kind);
      if (isUsableColor(resolved)) {
        colors[key] = resolved!.trim();
      }
    }
  } catch {
    return colors;
  }
  return colors;
}

function findThemeFilePath(themeName: string): string | undefined {
  const normalized = themeName.trim().toLowerCase();
  for (const extension of extensions.all) {
    const themes = extension.packageJSON?.contributes?.themes as
      | Array<{ id?: string; label: string; path: string }>
      | undefined;
    if (!themes) {
      continue;
    }
    for (const theme of themes) {
      const labelMatch = theme.label.trim().toLowerCase() === normalized;
      const idMatch = theme.id?.trim().toLowerCase() === normalized;
      if (labelMatch || idMatch) {
        return resolve(extension.extensionPath, theme.path);
      }
    }
  }
  return undefined;
}

function getWorkbenchColorCustomizations(themeName: string): ThemeColorMap {
  const all =
    workspace.getConfiguration('workbench').get<Record<string, unknown>>('colorCustomizations') ??
    {};
  const merged: ThemeColorMap = {};
  const themeKey = `[${themeName}]`;

  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith('[') && typeof value === 'string') {
      merged[key] = value;
    }
  }

  const themeSpecific = all[themeKey];
  if (themeSpecific && typeof themeSpecific === 'object' && !Array.isArray(themeSpecific)) {
    for (const [key, value] of Object.entries(themeSpecific as Record<string, unknown>)) {
      if (typeof value === 'string') {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function resolveThemeColorMap(themeName: string): ThemeColorMap {
  const themePath = findThemeFilePath(themeName);
  const fromFile = themePath ? loadThemeFileColors(themePath) : {};
  const fromSettings = getWorkbenchColorCustomizations(themeName);
  return { ...fromFile, ...fromSettings };
}

function resolveTableThemeColors(): TableHtmlTheme {
  const fallback = getTableThemeFallback(isDarkTheme());
  const themeName = workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '';
  if (!themeName) {
    return fallback;
  }
  try {
    return buildTableThemeFromResolved(resolveThemeColorMap(themeName), fallback);
  } catch {
    return fallback;
  }
}

/** Resolves table colors from the active VS Code theme file and color customizations. */
export function getTableThemeColors(): TableHtmlTheme {
  const themeName = workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '';
  if (cachedTheme && cachedThemeName === themeName) {
    return cachedTheme;
  }
  cachedThemeName = themeName;
  cachedTheme = resolveTableThemeColors();
  return cachedTheme;
}

export function clearTableThemeCache(): void {
  cachedTheme = undefined;
  cachedThemeName = undefined;
}
