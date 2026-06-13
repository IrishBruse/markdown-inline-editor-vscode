import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser';
import { buildScopeEntries, createRange } from '../editor-decoration-applier';
import { filterDecorationsForEditor } from '../visibility-model';
import { TextDocument, TextEditor, Selection, Position, Uri } from '../../test/__mocks__/vscode';

describe('table syntax integration', () => {
  it('replaces hide markers with spaces when table scope is built from parser output', async () => {
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

    const hideItems = result.get('hide') as Array<{ renderOptions?: { before?: { contentText?: string } } }> | undefined;
    expect(hideItems?.length).toBeGreaterThan(0);
    const spaced = hideItems?.filter((item) => item.renderOptions?.before?.contentText === '  ');
    expect(spaced?.length).toBeGreaterThanOrEqual(2);
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

  it('still renders heading and table bold when the cursor is inside the table', async () => {
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
    expect(result.get('bold')?.length).toBeGreaterThan(0);
    const hideItems = result.get('hide') as Array<{ renderOptions?: { before?: { contentText?: string } } }> | undefined;
    expect(hideItems?.some((item) => item.renderOptions?.before?.contentText === '  ')).toBe(true);
  });
});
