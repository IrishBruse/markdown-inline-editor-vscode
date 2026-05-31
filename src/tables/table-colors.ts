import { window, workspace } from 'vscode';
import { config } from '../config';

export type TableColors = {
  background: string;
  headerBackground: string;
  border: string;
  text: string;
};

const DARK_DEFAULTS: TableColors = {
  background: '#1e1e1e',
  headerBackground: '#2d2d2d',
  border: '#454545',
  text: '#cccccc',
};

const LIGHT_DEFAULTS: TableColors = {
  background: '#ffffff',
  headerBackground: '#f3f3f3',
  border: '#c8c8c8',
  text: '#333333',
};

const WORKBENCH_COLOR_IDS = {
  background: 'editor.background',
  headerBackground: 'textCodeBlock.background',
  border: 'editorWidget.border',
  text: 'editor.foreground',
} as const satisfies Record<keyof TableColors, string>;

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function parseHexColor(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : undefined;
}

function readCustomizationBlock(
  block: Record<string, unknown>,
  colorId: string,
): string | undefined {
  const value = block[colorId];
  return typeof value === 'string' ? parseHexColor(value) : undefined;
}

/** Resolved workbench.colorCustomizations entry (theme block overrides top-level). */
export function getWorkbenchColor(colorId: string): string | undefined {
  const customizations = workspace
    .getConfiguration('workbench')
    .get<Record<string, unknown>>('colorCustomizations');
  if (!customizations) {
    return undefined;
  }

  const themeLabel = (window.activeColorTheme as { label?: string }).label;
  if (themeLabel) {
    const themeBlock = customizations[`[${themeLabel}]`];
    if (themeBlock && typeof themeBlock === 'object' && themeBlock !== null) {
      const fromTheme = readCustomizationBlock(themeBlock as Record<string, unknown>, colorId);
      if (fromTheme !== undefined) {
        return fromTheme;
      }
    }
  }

  return readCustomizationBlock(customizations, colorId);
}

function resolveRole(
  extensionColor: string | undefined,
  workbenchColorId: string,
  fallback: string,
): string {
  return extensionColor ?? getWorkbenchColor(workbenchColorId) ?? fallback;
}

/** Colors for custom SVG tables: extension settings, then workbench theme, then built-in defaults. */
export function resolveTableColors(isDark: boolean): TableColors {
  const defaults = isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS;

  return {
    background: resolveRole(
      config.colors.tableBackground(),
      WORKBENCH_COLOR_IDS.background,
      defaults.background,
    ),
    headerBackground: resolveRole(
      config.colors.tableHeaderBackground(),
      WORKBENCH_COLOR_IDS.headerBackground,
      defaults.headerBackground,
    ),
    border: resolveRole(
      config.colors.tableBorder(),
      WORKBENCH_COLOR_IDS.border,
      defaults.border,
    ),
    text: resolveRole(
      config.colors.tableText(),
      WORKBENCH_COLOR_IDS.text,
      defaults.text,
    ),
  };
}

export function tableColorsCacheKey(colors: TableColors): string {
  return `${colors.background}|${colors.headerBackground}|${colors.border}|${colors.text}`;
}
