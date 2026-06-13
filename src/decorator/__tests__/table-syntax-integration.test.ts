import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser';
import { buildScopeEntries, createRange } from '../editor-decoration-applier';
import { filterDecorationsForEditor } from '../visibility-model';
import { TextDocument, TextEditor, Selection, Position, Uri } from '../../test/__mocks__/vscode';

describe('table syntax integration', () => {
  it('renders table grid decorations when cursor is outside the table', async () => {
    const markdown = '| **bold** | plain |\n| --- | --- |\n| x | y |\n';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(3, 0), new Position(3, 0))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    expect(scopeEntries.some((scope) => scope.kind === 'table')).toBe(true);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('tablePipe')?.length).toBeGreaterThan(0);
    expect(result.get('tableCell')?.length).toBeGreaterThan(0);
  });

  it('does not throw when the cursor is inside a table scope', async () => {
    const markdown = '| **bold** | plain |\n| --- | --- |\n| x | y |';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(0, 5), new Position(0, 5))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    expect(() =>
      filterDecorationsForEditor(
        editor as any,
        decorations,
        scopeEntries,
        markdown,
        (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
      ),
    ).not.toThrow();
  });

  it('reveals raw table when cursor is inside the table', async () => {
    const markdown = '| **bold** | plain |\n| --- | --- |\n| x | y |\n\nafter';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(0, 5), new Position(0, 5))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('tablePipe')).toBeUndefined();
    expect(result.get('tableCell')).toBeUndefined();
  });

  it('renders link-colored tableCell without underline on padding', async () => {
    const markdown = '| Col | Note |\n| --- | --- |\n| [label](https://example.com) | link |\n\nafter';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(4, 0), new Position(4, 0))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    const linkCell = result.get('tableCell')?.find?.((c: {
      renderOptions?: { before?: { contentText?: string; textDecoration?: string; color?: { id?: string } } };
    }) => c.renderOptions?.before?.contentText?.includes('label'));
    expect(linkCell).toBeDefined();
    expect(linkCell?.renderOptions?.before?.textDecoration).toBe('none');
    expect(linkCell?.renderOptions?.before?.color?.id).toBe('textLink.foreground');
    expect(result.get('link')).toBeUndefined();
  });

  it('renders tableCellImage for image-only cells in the grid', async () => {
    const markdown = '| Col | Note |\n| --- | --- |\n| ![t](https://example.com/x.png) | image |\n\nafter';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(4, 0), new Position(4, 0))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('tableCellImage')?.length).toBe(1);
    expect(result.get('image')).toBeUndefined();
  });

  it('renders tableCell link style for bare URL cells', async () => {
    const markdown = '| Col | Note |\n| --- | --- |\n| https://example.com/path/to/resource?query=1&other=2 | long URL |\n\nafter';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(4, 0), new Position(4, 0))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    const urlCell = result.get('tableCell')?.find?.((c: {
      renderOptions?: { before?: { contentText?: string; textDecoration?: string } };
    }) => c.renderOptions?.before?.contentText?.includes('https://example.com'));
    expect(urlCell).toBeDefined();
    expect(urlCell?.renderOptions?.before?.textDecoration).toBe('none');
    expect(result.get('link')).toBeUndefined();
  });

  it('still renders heading decorations when the cursor is inside a table', async () => {
    const markdown = '# Title\n\n| **bold** | plain |\n| --- | --- |\n| x | y |';
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(markdown);
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, markdown);
    const editor = new TextEditor(doc, [new Selection(new Position(4, 2), new Position(4, 2))]);
    const scopeEntries = buildScopeEntries(editor, scopes, markdown);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      markdown,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('heading1')?.length).toBeGreaterThan(0);
  });
});
