import * as vscode from 'vscode';

export const CONFIG_SECTION = 'markdownInlineEditor' as const;
const LEGACY_CONFIG_SECTION = 'inlineMarkdownEditor' as const;

/** Matches `#` + 3, 4, 6, or 8 hex digits (#RGB, #RGBA, #RRGGBB, #RRGGBBAA). Invalid values are treated as unset. */
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function parseHexColor(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : undefined;
}

function getSetting<T>(key: string, defaultValue: T): T {
  const current = vscode.workspace.getConfiguration(CONFIG_SECTION).get<T>(key);
  if (current !== undefined) {
    return current;
  }
  const legacy = vscode.workspace.getConfiguration(LEGACY_CONFIG_SECTION).get<T>(key);
  if (legacy !== undefined) {
    return legacy;
  }
  return defaultValue;
}

function getOptionalSetting<T>(key: string): T | undefined {
  const current = vscode.workspace.getConfiguration(CONFIG_SECTION).get<T>(key);
  if (current !== undefined) {
    return current;
  }
  return vscode.workspace.getConfiguration(LEGACY_CONFIG_SECTION).get<T>(key);
}

function getColorConfig(key: string): string | undefined {
  return parseHexColor(getOptionalSetting<string>(`colors.${key}`));
}

/** True when a configuration key under this extension changed (current or legacy namespace). */
export function configAffectsConfiguration(
  event: vscode.ConfigurationChangeEvent,
  key: string,
): boolean {
  return event.affectsConfiguration(`${CONFIG_SECTION}.${key}`)
    || event.affectsConfiguration(`${LEGACY_CONFIG_SECTION}.${key}`);
}

export const config = {
  diffView: {
    applyDecorations(): boolean {
      return getSetting('defaultBehaviors.diffView.applyDecorations', false);
    },
  },
  links: {
    singleClickOpen(): boolean {
      return getSetting('links.singleClickOpen', false);
    },
    /** Chain (🔗) icon after link text; off by default so raw markdown tables stay aligned. */
    showEmoji(): boolean {
      return getSetting('links.showEmoji', false);
    },
  },
  decorations: {
    ghostFaintOpacity(): number {
      return getSetting('decorations.ghostFaintOpacity', 0.3);
    },
    ghostLinksCollapse(): boolean {
      return getSetting('decorations.ghostLinks.collapse', false);
    },
    frontmatterDelimiterOpacity(): number {
      return getSetting('decorations.frontmatterDelimiterOpacity', 0.3);
    },
    codeBlockLanguageOpacity(): number {
      return getSetting('decorations.codeBlockLanguageOpacity', 0.3);
    },
  },
  emojis: {
    enabled(): boolean {
      return getSetting('emojis.enabled', true);
    },
  },
  math: {
    enabled(): boolean {
      return getSetting('math.enabled', true);
    },
  },
  tables: {
    /** When true, tables always show as raw GFM source with no grid decorations. */
    forceRaw(): boolean {
      return getSetting('tables.forceRaw', false);
    },
  },
  mermaid: {
    /** Override max diagram width in columns; 0 uses auto viewport estimate. */
    maxWidthColumns(): number {
      return getSetting('mermaid.maxWidthColumns', 0);
    },
  },
  orderedLists: {
    /** When true, ordered list markers are hidden and replaced with computed numbers (lazy `1.` numbering, etc.). When false, the source text is shown as written. */
    autoNumber(): boolean {
      return getSetting('orderedLists.autoNumber', true);
    },
    /** When auto-numbering is on, tint the displayed marker when it differs from the number in the source. */
    warnWhenSourceNumberDiffers(): boolean {
      return getSetting('orderedLists.warnWhenSourceNumberDiffers', true);
    },
  },
  mentions: {
    /** If set, overrides GitHub context: true = force links on, false = force off. Unset = use git remote auto-detect. */
    linksEnabled(): boolean | undefined {
      return getOptionalSetting<boolean>('mentions.linksEnabled');
    },
    /** Optional: master switch to enable/disable mention and issue-reference styling and detection. */
    enabled(): boolean {
      return getSetting('mentions.enabled', true);
    },
  },
  debug: {
    loggingEnabled(): boolean {
      return getSetting('debug.logging.enabled', false);
    },
    performanceEnabled(): boolean {
      return getSetting('debug.performance.enabled', false);
    },
  },
  colors: {
    heading1(): string | undefined {
      return getColorConfig('heading1');
    },
    heading2(): string | undefined {
      return getColorConfig('heading2');
    },
    heading3(): string | undefined {
      return getColorConfig('heading3');
    },
    heading4(): string | undefined {
      return getColorConfig('heading4');
    },
    heading5(): string | undefined {
      return getColorConfig('heading5');
    },
    heading6(): string | undefined {
      return getColorConfig('heading6');
    },
    link(): string | undefined {
      return getColorConfig('link');
    },
    listMarker(): string | undefined {
      return getColorConfig('listMarker');
    },
    inlineCode(): string | undefined {
      return getColorConfig('inlineCode');
    },
    inlineCodeBackground(): string | undefined {
      return getColorConfig('inlineCodeBackground');
    },
    emphasis(): string | undefined {
      return getColorConfig('emphasis');
    },
    blockquote(): string | undefined {
      return getColorConfig('blockquote');
    },
    image(): string | undefined {
      return getColorConfig('image');
    },
    horizontalRule(): string | undefined {
      return getColorConfig('horizontalRule');
    },
    checkbox(): string | undefined {
      return getColorConfig('checkbox');
    },
  },
} as const;
