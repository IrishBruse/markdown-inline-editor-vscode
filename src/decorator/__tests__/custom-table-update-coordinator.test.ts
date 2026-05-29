import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ColorThemeKind, window, workspace } from 'vscode';
import { MarkdownParser } from '../../parser/core';
import { CustomTableUpdateCoordinator } from '../custom-table-update-coordinator';
import { TextDocument, TextEditor, Selection, Uri } from '../../test/__mocks__/vscode';

describe('CustomTableUpdateCoordinator', () => {
  const parser = new MarkdownParser();

  beforeEach(() => {
    vi.spyOn(window, 'activeColorTheme', 'get').mockReturnValue({
      kind: ColorThemeKind.Dark,
    } as never);
    vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn(() => undefined),
    } as never);
  });

  it('renders overlays for more than 20 tables (no sync cap)', () => {
    const tables = Array.from({ length: 25 }, (_, i) => (
      `| Col${i} | Val |\n| --- | --- |\n| ${i} | x |`
    )).join('\n\n');
    const md = `${tables}\n\nAfter tables.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    expect(tableBlocks.length).toBeGreaterThan(20);

    const document = new TextDocument(Uri.file('many-tables.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = new CustomTableUpdateCoordinator({
      apply,
      clear: vi.fn(),
    });

    coordinator.update(editor, tableBlocks, md, document.version);

    expect(apply).toHaveBeenCalledTimes(1);
    const rangesByKey = apply.mock.calls[0][1] as Map<string, unknown[]>;
    const totalRanges = [...rangesByKey.values()].reduce((sum, ranges) => sum + ranges.length, 0);
    expect(totalRanges).toBe(tableBlocks.length);
  });

  it('keeps early table overlays when the document has many unique tables', () => {
    const tables = Array.from({ length: 55 }, (_, i) => (
      `| Col${i} | Val |\n| --- | --- |\n| ${i} | x |`
    )).join('\n\n');
    const md = `${tables}\n\nAfter tables.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    expect(tableBlocks.length).toBeGreaterThan(50);

    const document = new TextDocument(Uri.file('many-tables.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = new CustomTableUpdateCoordinator({
      apply,
      clear: vi.fn(),
    });

    coordinator.update(editor, tableBlocks, md, document.version);

    expect(apply).toHaveBeenCalledTimes(1);
    const rangesByKey = apply.mock.calls[0][1] as Map<string, unknown[]>;
    expect(rangesByKey.size).toBe(tableBlocks.length);
  });
});
