import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Decorator } from '../../decorator';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, TextEditor, Selection, Uri } from '../../test/__mocks__/vscode';
import { config } from '../../config';
import type { TableBlock } from '../../parser';

describe('Decorator - custom tables', () => {
  const tableText = [
    '| Name | Role |',
    '|------|------|',
    '| Ada  | Lead |',
  ].join('\n');
  const text = `${tableText}\nAfter`;

  const tableBlocks: TableBlock[] = [
    {
      startPos: 0,
      endPos: tableText.length,
      numLines: 3,
      header: ['Name', 'Role'],
      rows: [['Ada', 'Lead']],
      align: [null, null],
    },
  ];

  beforeEach(() => {
    vi.spyOn(config.tables, 'renderingMode').mockReturnValue('custom');
  });

  it('applies SVG overlay when cursor is outside the table', () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const outsideOffset = text.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as never));

    (decorator as any).activeEditor = editor;
    const applyMock = vi.fn();
    (decorator as any).customTableCoordinator.overlayDecorations = {
      apply: applyMock,
      clear: vi.fn(),
    };

    (decorator as any).updateCustomTables(tableBlocks, text, document.version);

    expect(applyMock).toHaveBeenCalledTimes(1);
    const dataUris = applyMock.mock.calls[0][2] as Map<string, string>;
    expect([...dataUris.values()][0]).toMatch(/^data:image\/svg\+xml/);
  });

  it('skips overlay when cursor is inside the table', () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const selection = new Selection(
      document.positionAt(0),
      document.positionAt(tableText.length),
    );
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as never));

    (decorator as any).activeEditor = editor;
    const applyMock = vi.fn();
    (decorator as any).customTableCoordinator.overlayDecorations = {
      apply: applyMock,
      clear: vi.fn(),
    };

    (decorator as any).updateCustomTables(tableBlocks, text, document.version);

    expect(applyMock).toHaveBeenCalledTimes(1);
    const rangesByKey = applyMock.mock.calls[0][1] as Map<string, unknown[]>;
    expect(rangesByKey.size).toBe(0);
  });

  it('clears overlays when rendering mode is not custom', () => {
    vi.spyOn(config.tables, 'renderingMode').mockReturnValue('inline');
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const editor = new TextEditor(document, []);
    const decorator = new Decorator(new MarkdownParseCache({} as never));

    (decorator as any).activeEditor = editor;
    const clearMock = vi.fn();
    (decorator as any).customTableDecorations = {
      clear: clearMock,
      apply: vi.fn(),
    };

    (decorator as any).updateCustomTables(tableBlocks, text, document.version);

    expect(clearMock).toHaveBeenCalledTimes(1);
  });
});
