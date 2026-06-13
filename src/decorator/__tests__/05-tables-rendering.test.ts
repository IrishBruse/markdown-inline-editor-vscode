import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownParser } from '../../parser';
import { applyFilteredDecorations, buildScopeEntries, createRange } from '../editor-decoration-applier';
import { filterDecorationsForEditor } from '../visibility-model';
import { TextDocument, TextEditor, Selection, Position, Uri } from '../../test/__mocks__/vscode';

const TABLES_MD = readFileSync('docs/tests/05-tables.md', 'utf8');

describe('05-tables.md rendering', () => {
  it('parses decorations for the full fixture', async () => {
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(TABLES_MD);
    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations.some((d) => d.type === 'heading1')).toBe(true);
    expect(decorations.some((d) => d.type === 'bold')).toBe(true);
    expect(scopes.some((s) => s.kind === 'table')).toBe(true);
  });

  it('maps parser positions to editor ranges for the full fixture', async () => {
    const parser = await MarkdownParser.create();
    const { decorations } = parser.extractDecorationsWithScopes(TABLES_MD);
    const doc = new TextDocument(Uri.file('docs/tests/05-tables.md'), 'markdown', 1, TABLES_MD);
    const editor = new TextEditor(doc, [new Selection(new Position(0, 0), new Position(0, 0))]);

    let mapped = 0;
    let failed = 0;
    for (const decoration of decorations) {
      const range = createRange(editor, decoration.startPos, decoration.endPos, TABLES_MD);
      if (range) {
        mapped++;
      } else {
        failed++;
      }
    }

    expect(failed).toBe(0);
    expect(mapped).toBe(decorations.length);
  });

  it('filters and returns heading and bold decorations for the full fixture', async () => {
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(TABLES_MD);
    const doc = new TextDocument(Uri.file('docs/tests/05-tables.md'), 'markdown', 1, TABLES_MD);
    const editor = new TextEditor(doc, [new Selection(new Position(205, 10), new Position(205, 10))]);
    const scopeEntries = buildScopeEntries(editor, scopes, TABLES_MD);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      TABLES_MD,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('heading1')?.length).toBeGreaterThan(0);
    expect(result.get('bold')?.length).toBeGreaterThan(0);
    expect(result.get('hide')?.length).toBeGreaterThan(0);
  });

  it('does not throw when a selection spans overlapping scopes in the fixture', async () => {
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(TABLES_MD);
    const doc = new TextDocument(Uri.file('docs/tests/05-tables.md'), 'markdown', 1, TABLES_MD);
    const editor = new TextEditor(doc, [new Selection(new Position(4, 0), new Position(6, 10))]);
    const scopeEntries = buildScopeEntries(editor, scopes, TABLES_MD);

    expect(() =>
      filterDecorationsForEditor(
        editor as any,
        decorations,
        scopeEntries,
        TABLES_MD,
        (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
      ),
    ).not.toThrow();
  });

  it('renders decorations with cursor on a table line', async () => {
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(TABLES_MD);
    const doc = new TextDocument(Uri.file('docs/tests/05-tables.md'), 'markdown', 1, TABLES_MD);
    const editor = new TextEditor(doc, [new Selection(new Position(5, 2), new Position(5, 2))]);
    const scopeEntries = buildScopeEntries(editor, scopes, TABLES_MD);

    const result = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      TABLES_MD,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    expect(result.get('heading2')?.length).toBeGreaterThan(0);
    expect(result.get('bold')?.length).toBeGreaterThan(0);
  });

  it('applies mixed hide decorations from the tables fixture without throwing', async () => {
    const parser = await MarkdownParser.create();
    const { decorations, scopes } = parser.extractDecorationsWithScopes(TABLES_MD);
    const doc = new TextDocument(Uri.file('docs/tests/05-tables.md'), 'markdown', 1, TABLES_MD);
    const editor = new TextEditor(doc, [new Selection(new Position(31, 0), new Position(31, 0))]);
    editor.setDecorations = vi.fn();
    const scopeEntries = buildScopeEntries(editor, scopes, TABLES_MD);

    const filtered = filterDecorationsForEditor(
      editor as any,
      decorations,
      scopeEntries,
      TABLES_MD,
      (startPos, endPos, text) => createRange(editor, startPos, endPos, text),
    );

    const hideItems = filtered.get('hide') ?? [];
    const hasMixedHide =
      hideItems.some((item) => 'range' in (item as object)) &&
      hideItems.some((item) => !('range' in (item as object)));
    expect(hasMixedHide).toBe(true);

    const registry = {
      getMap: () => new Map([['hide', { key: 'hide' }]]),
      getGhostFaintDecorationType: () => ({ key: 'ghostFaint' }),
    };

    expect(() =>
      applyFilteredDecorations(editor as any, filtered, registry as any),
    ).not.toThrow();
  });
});
