import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorThemeKind, window, workspace } from 'vscode';
import {
  getWorkbenchColor,
  resolveTableColors,
  tableColorsCacheKey,
} from '../table-colors';

describe('table-colors', () => {
  const workbenchGet = vi.fn();
  const extensionGet = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    workbenchGet.mockReset();
    extensionGet.mockReset();
    vi.spyOn(window, 'activeColorTheme', 'get').mockReturnValue({
      kind: ColorThemeKind.Dark,
      label: 'Empty Dark Theme',
    } as never);
    vi.spyOn(workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'workbench') {
        return { get: workbenchGet } as never;
      }
      return { get: extensionGet } as never;
    });
    extensionGet.mockReturnValue(undefined);
    workbenchGet.mockReturnValue(undefined);
  });

  describe('getWorkbenchColor', () => {
    it('reads a top-level color customization', () => {
      workbenchGet.mockReturnValue({
        'editor.background': '#282c34',
      });
      expect(getWorkbenchColor('editor.background')).toBe('#282c34');
    });

    it('prefers theme-scoped customizations over top-level', () => {
      workbenchGet.mockReturnValue({
        'editor.background': '#111111',
        '[Empty Dark Theme]': {
          'editor.background': '#282c34',
        },
      });
      expect(getWorkbenchColor('editor.background')).toBe('#282c34');
    });

    it('returns undefined for invalid hex', () => {
      workbenchGet.mockReturnValue({
        'editor.background': 'not-a-color',
      });
      expect(getWorkbenchColor('editor.background')).toBeUndefined();
    });
  });

  describe('resolveTableColors', () => {
    it('uses extension settings when set', () => {
      extensionGet.mockImplementation((key: string) => {
        if (key === 'colors.tableBackground') return '#aabbcc';
        if (key === 'colors.tableHeaderBackground') return '#112233';
        if (key === 'colors.tableBorder') return '#445566';
        if (key === 'colors.tableText') return '#778899';
        return undefined;
      });

      expect(resolveTableColors(true)).toEqual({
        background: '#aabbcc',
        headerBackground: '#112233',
        border: '#445566',
        text: '#778899',
      });
    });

    it('falls back to workbench colors from settings.json-style customizations', () => {
      workbenchGet.mockReturnValue({
        'editor.background': '#282c34',
        'editor.foreground': '#abb2bf',
        'editorWidget.border': '#3a3f4b',
        'textCodeBlock.background': '#23282f',
      });

      expect(resolveTableColors(true)).toEqual({
        background: '#282c34',
        headerBackground: '#23282f',
        border: '#3a3f4b',
        text: '#abb2bf',
      });
    });

    it('uses built-in dark defaults when nothing is configured', () => {
      expect(resolveTableColors(true).background).toBe('#1e1e1e');
      expect(resolveTableColors(true).text).toBe('#cccccc');
    });

    it('uses built-in light defaults for light themes', () => {
      vi.spyOn(window, 'activeColorTheme', 'get').mockReturnValue({
        kind: ColorThemeKind.Light,
        label: 'Light',
      } as never);

      expect(resolveTableColors(false).background).toBe('#ffffff');
      expect(resolveTableColors(false).headerBackground).toBe('#f3f3f3');
    });
  });

  describe('tableColorsCacheKey', () => {
    it('changes when any role changes', () => {
      const a = tableColorsCacheKey({
        background: '#1',
        headerBackground: '#2',
        border: '#3',
        text: '#4',
      });
      const b = tableColorsCacheKey({
        background: '#1',
        headerBackground: '#2',
        border: '#3',
        text: '#5',
      });
      expect(a).not.toBe(b);
    });
  });
});
