vi.mock('../../parser', () => ({
  MarkdownParser: class {
    extractDecorations() { return []; }
  },
}));

import { describe, expect, it, vi, afterEach } from 'vitest';
import { config } from '../../config';
import { filterDecorationsForEditor } from '../visibility-model';
import type { ScopeEntry } from '../visibility-model';
import type { DecorationRange } from '../../parser';
import { TextDocument, TextEditor, Selection, Position, Uri, Range } from '../../test/__mocks__/vscode';

function makeEditor(text: string, cursorLine: number, cursorChar: number) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  const sel = new Selection(new Position(cursorLine, cursorChar), new Position(cursorLine, cursorChar));
  return new TextEditor(doc, [sel]);
}

function makeEditorWithSelection(text: string, startLine: number, startChar: number, endLine: number, endChar: number) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  const sel = new Selection(new Position(startLine, startChar), new Position(endLine, endChar));
  return new TextEditor(doc, [sel]);
}

function simpleRangeFactory(startPos: number, endPos: number, text: string) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  return new Range(doc.positionAt(startPos), doc.positionAt(endPos)) as any;
}

describe('emoji decoration', () => {
  it('renders emoji replacement when cursor is not on the emoji line', () => {
    const text = ':smile:\nother line';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 7, type: 'emoji', emoji: '😊' } as any,
    ];
    const editor = makeEditor(text, 1, 0); // cursor on line 1, not line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const emojis = result.get('emoji') as any[];
    expect(emojis).toBeDefined();
    expect(emojis.length).toBe(1);
    expect((emojis[0] as any).renderOptions?.before?.contentText).toBe('😊');
  });

  it('skips emoji when cursor is inside the emoji scope (raw reveal)', () => {
    const text = ':smile:';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 7, type: 'emoji', emoji: '😊' } as any,
    ];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const scope: ScopeEntry = {
      startPos: 0,
      endPos: 7,
      range: new Range(doc.positionAt(0), doc.positionAt(7)) as any,
    };
    const editor = makeEditor(text, 0, 3); // cursor inside emoji on line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [scope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('emoji')).toBe(false);
  });

  it('does not render emoji without emoji property', () => {
    const text = ':smile:\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 7, type: 'emoji' } as any,
    ];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('emoji')).toBe(false);
  });
});


describe('table decoration rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tablePipe with replacement text when cursor is off the table', () => {
    const text = '| A |\n| - |\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const pipes = result.get('tablePipe') as any[];
    expect(pipes).toBeDefined();
    expect(pipes[0].renderOptions?.before?.contentText).toBe('│');
  });

  it('skips table decorations when cursor is on the table (whole-block reveal)', () => {
    const text = '| A |\n| - |';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' } as any,
    ];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 11,
      range: new Range(new Position(0, 0), new Position(1, 5)) as any,
      kind: 'table',
    };
    const editor = makeEditor(text, 0, 2);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [tableScope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tablePipe')).toBe(false);
  });

  it('skips table decorations when forceRaw is enabled', () => {
    vi.spyOn(config.tables, 'forceRaw').mockReturnValue(true);
    const text = '| A |\n| - |\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tablePipe')).toBe(false);
  });

  it('skips inline bold and hide decorations inside padded tableCell ranges', () => {
    const text = '| **bold** and plain | note |\nother';
    const decs: DecorationRange[] = [
      {
        startPos: 1,
        endPos: 21,
        type: 'tableCell',
        replacement: ' **bold** and plain ',
      } as any,
      { startPos: 2, endPos: 4, type: 'hide' } as any,
      { startPos: 4, endPos: 8, type: 'bold' } as any,
      { startPos: 8, endPos: 10, type: 'hide' } as any,
    ];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tableCell')).toBe(true);
    expect(result.has('bold')).toBe(false);
    expect(result.has('hide')).toBe(false);
  });

  it('renders tableCell with inlineCode color matching CodeDecorationType', () => {
    const text = '| `code` |\nother';
    const decs: DecorationRange[] = [
      {
        startPos: 0,
        endPos: 1,
        type: 'tableCell',
        replacement: ' code ',
        cellStyle: { inlineCode: true },
      } as any,
    ];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const cells = result.get('tableCell') as any[];
    expect(cells).toBeDefined();
    expect(cells[0].renderOptions?.before?.contentText).toBe(' code ');
    expect(cells[0].renderOptions?.before?.color?.id).toBe('textPreformat.foreground');
    expect(cells[0].renderOptions?.before?.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
  });

  it('renders tableCell with link color and no underline on padding', () => {
    const text = '| [label](https://example.com) |\nother';
    const decs: DecorationRange[] = [
      {
        startPos: 2,
        endPos: 32,
        type: 'tableCell',
        replacement: ' label ',
        cellStyle: { link: true },
        url: 'https://example.com',
      } as any,
    ];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const cells = result.get('tableCell') as any[];
    expect(cells).toBeDefined();
    expect(cells[0].renderOptions?.before?.contentText).toBe(' label ');
    expect(cells[0].renderOptions?.before?.color?.id).toBe('textLink.foreground');
    expect(cells[0].renderOptions?.before?.textDecoration).toBe('none');
    expect(cells[0].renderOptions?.before?.cursor).toBe('pointer');
  });

  it('skips strikethrough and hide decorations inside padded tableCell ranges', () => {
    const text = '| ~~strike~~ |\nother';
    const decs: DecorationRange[] = [
      {
        startPos: 2,
        endPos: 14,
        type: 'tableCell',
        replacement: ' strike ',
        cellStyle: { textDecoration: 'line-through' },
      } as any,
      { startPos: 2, endPos: 4, type: 'hide' } as any,
      { startPos: 4, endPos: 10, type: 'strikethrough' } as any,
      { startPos: 10, endPos: 12, type: 'hide' } as any,
    ];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tableCell')).toBe(true);
    expect(result.has('strikethrough')).toBe(false);
    expect(result.has('hide')).toBe(false);
  });

  it('routes hide markers to transparent inside table scopes without padded cells', () => {
    const text = '| [label](https://example.com) | plain |\n| --- | --- |\n| x | y |\n\nafter';
    const decs: DecorationRange[] = [
      { startPos: 2, endPos: 3, type: 'hide' } as any,
      { startPos: 8, endPos: 9, type: 'hide' } as any,
      { startPos: 3, endPos: 8, type: 'link', url: 'https://example.com' } as any,
    ];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: text.indexOf('\n\n'),
      range: new Range(doc.positionAt(0), doc.positionAt(text.indexOf('\n\n'))) as any,
      kind: 'table',
    };
    const editor = makeEditor(text, 4, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [tableScope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.get('hide')).toBeUndefined();
    expect(result.get('transparent')?.length).toBe(2);
    expect(result.get('link')?.length).toBe(1);
  });

  it('ignores scope entries with missing ranges instead of throwing', () => {
    const text = '**bold**';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' } as any,
      { startPos: 2, endPos: 6, type: 'bold' } as any,
      { startPos: 6, endPos: 8, type: 'hide' } as any,
    ];
    const editor = makeEditor(text, 0, 0);
    expect(() =>
      filterDecorationsForEditor(
        editor as any,
        decs,
        [{ startPos: 0, endPos: 8, range: undefined as any, kind: 'table' }],
        text,
        (s, e, t) => simpleRangeFactory(s, e, t),
      ),
    ).not.toThrow();
  });
});

describe('selection overlay for codeBlock/frontmatter', () => {
  it('adds selectionOverlay when non-empty selection covers a codeBlock', () => {
    const text = '```\ncode\n```';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 12, type: 'codeBlock' } as any,
    ];
    const editor = makeEditorWithSelection(text, 0, 0, 2, 3); // non-empty selection
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(true);
  });

  it('adds selectionOverlay when selection covers frontmatter', () => {
    const text = '---\ntitle: hi\n---';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 17, type: 'frontmatter' } as any,
    ];
    const editor = makeEditorWithSelection(text, 0, 0, 1, 5); // non-empty selection
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(true);
  });

  it('does not add selectionOverlay when there is no selection (cursor only)', () => {
    const text = '```\ncode\n```';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 12, type: 'codeBlock' } as any,
    ];
    const editor = makeEditor(text, 1, 2); // cursor-only (isEmpty)
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(false);
  });
});

describe('ordered list auto-numbering decoration', () => {
  it('renders replacement text when cursor is not on the list line', () => {
    const text = '1. First\n1. Second\n1. Third\nother line';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2. ' } as any,
      { startPos: 19, endPos: 22, type: 'orderedListItem', replacement: '3. ' } as any,
    ];
    const editor = makeEditor(text, 3, 0); // cursor on "other line"
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items).toHaveLength(3);
    expect(items[0].renderOptions?.before?.contentText).toBe('1. ');
    expect(items[1].renderOptions?.before?.contentText).toBe('2. ');
    expect(items[2].renderOptions?.before?.contentText).toBe('3. ');
  });

  it('skips orderedListItem when cursor overlaps marker range (raw reveal)', () => {
    const text = '1. First\n1. Second';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2. ' } as any,
    ];
    const editor = makeEditor(text, 0, 1); // cursor inside "1. " marker on line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    // Line 0 marker should be skipped (raw reveal), line 1 should render
    expect(items).toBeDefined();
    expect(items).toHaveLength(1);
    expect(items[0].renderOptions?.before?.contentText).toBe('2. ');
  });

  it('renders parenthesis delimiter in replacement', () => {
    const text = '1) First\n1) Second\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1) ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2) ' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items).toHaveLength(2);
    expect(items[0].renderOptions?.before?.contentText).toBe('1) ');
    expect(items[1].renderOptions?.before?.contentText).toBe('2) ');
  });

  it('renders custom start number in replacement', () => {
    const text = '5. Start here\n1. Next\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '5. ' } as any,
      { startPos: 14, endPos: 17, type: 'orderedListItem', replacement: '6. ' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items[0].renderOptions?.before?.contentText).toBe('5. ');
    expect(items[1].renderOptions?.before?.contentText).toBe('6. ');
  });

  it('uses warning foreground color when orderedListMarkerMismatch is set', () => {
    const text = '1. First\n1. Second\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      {
        startPos: 9,
        endPos: 12,
        type: 'orderedListItem',
        replacement: '2. ',
        orderedListMarkerMismatch: true,
      } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items[0].renderOptions?.before?.color).toBeUndefined();
    expect(items[1].renderOptions?.before?.color?.id).toBe('editorWarning.foreground');
  });
});

describe('filterDecorationsForEditor — basic cases', () => {
  it('returns empty map when no decorations', () => {
    const editor = makeEditor('hello', 0, 0);
    const result = filterDecorationsForEditor(editor as any, [], [], 'hello', (s, e, t) => simpleRangeFactory(s, e, t));
    expect(result.size).toBe(0);
  });

  it('applies non-marker semantic decorations on non-active lines', () => {
    const text = 'hello\n**bold**';
    const decs: DecorationRange[] = [
      { startPos: 6, endPos: 8, type: 'hide' } as any,
      { startPos: 8, endPos: 12, type: 'bold' } as any,
      { startPos: 12, endPos: 14, type: 'hide' } as any,
    ];
    const editor = makeEditor(text, 0, 0); // cursor on line 0, decoration on line 1
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('bold')).toBe(true);
    expect(result.has('hide')).toBe(true);
  });
});
