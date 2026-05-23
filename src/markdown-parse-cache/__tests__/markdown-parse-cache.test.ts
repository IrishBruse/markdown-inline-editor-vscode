import { vi } from 'vitest';
import { config } from '../../config';
import { MarkdownParser } from '../../parser';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, Uri } from '../../test/__mocks__/vscode';

describe('MarkdownParseCache', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  it('parses and caches decorations/scopes', () => {
    const cache = new MarkdownParseCache(parser, 10);
    const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '**bold**');
    const entry = cache.get(document);

    expect(entry.decorations.length).toBeGreaterThan(0);
    expect(entry.scopes.length).toBeGreaterThanOrEqual(0);
    expect(entry.version).toBe(1);
  });

  it('returns cached entry for same version', () => {
    const cache = new MarkdownParseCache(parser, 10);
    const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '**bold**');

    const first = cache.get(document);
    const second = cache.get(document);

    expect(first).toBe(second);
  });

  it('reparses when document version changes', () => {
    const cache = new MarkdownParseCache(parser, 10);
    const document1 = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '**bold**');
    const document2 = new TextDocument(Uri.file('/test.md'), 'markdown', 2, '*italic*');

    const first = cache.get(document1);
    const second = cache.get(document2);

    expect(first).not.toBe(second);
    expect(second.version).toBe(2);
  });

  it('reparses when parse-affecting settings change', () => {
    const cache = new MarkdownParseCache(parser, 10);
    const document = new TextDocument(Uri.file('/test.md'), 'markdown', 1, '| A |\n|---|---|\n| 1 |');

    const first = cache.get(document);
    vi.spyOn(config.tables, 'renderingMode').mockReturnValue('custom');
    const second = cache.get(document);

    expect(first).not.toBe(second);
    vi.restoreAllMocks();
  });

  it('evicts least recently used entry when cache is full', () => {
    const cache = new MarkdownParseCache(parser, 2);
    const doc1 = new TextDocument(Uri.file('/test1.md'), 'markdown', 1, 'text');
    const doc2 = new TextDocument(Uri.file('/test2.md'), 'markdown', 1, 'text');
    const doc3 = new TextDocument(Uri.file('/test3.md'), 'markdown', 1, 'text');

    const entry1 = cache.get(doc1);
    cache.get(doc2);
    cache.get(doc3);

    const entry1After = cache.get(doc1);
    expect(entry1After).not.toBe(entry1);
  });
});
