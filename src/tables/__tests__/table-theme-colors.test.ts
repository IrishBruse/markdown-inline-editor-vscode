import { describe, expect, it } from 'vitest';
import { buildTableThemeFromResolved } from '../table-theme-colors';
import { getTableThemeFallback } from '../../parser/tables-html';

describe('table-theme-colors', () => {
  it('buildTableThemeFromResolved maps VS Code keys to table slots', () => {
    const fallback = getTableThemeFallback(true);
    const theme = buildTableThemeFromResolved(
      {
        'editor.foreground': '#abcdef',
        'editor.background': '#111111',
        'panel.border': '#222222',
        'editor.lineHighlightBackground': '#333333',
      },
      fallback,
    );
    expect(theme.foreground).toBe('#abcdef');
    expect(theme.cellBackground).toBe('#111111');
    expect(theme.border).toBe('#222222');
    expect(theme.headerBackground).toBe('#333333');
  });

  it('falls back when resolved colors are empty or transparent', () => {
    const fallback = getTableThemeFallback(false);
    const theme = buildTableThemeFromResolved(
      {
        'editor.foreground': '',
        'editor.background': 'transparent',
        'panel.border': 'none',
      },
      fallback,
    );
    expect(theme.foreground).toBe(fallback.foreground);
    expect(theme.cellBackground).toBe(fallback.cellBackground);
    expect(theme.border).toBe(fallback.border);
  });
});
