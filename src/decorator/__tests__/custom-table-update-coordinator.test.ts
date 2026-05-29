import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ColorThemeKind, window, workspace } from 'vscode';
import { MarkdownParser } from '../../parser/core';
import {
  CustomTableUpdateCoordinator,
  TABLE_SVG_RENDER_BATCH_SIZE,
} from '../custom-table-update-coordinator';
import { TextDocument, TextEditor, Selection, Uri } from '../../test/__mocks__/vscode';

function makeCoordinator(apply: ReturnType<typeof vi.fn>, renderBatchSize?: number) {
  return new CustomTableUpdateCoordinator(
    { apply, clear: vi.fn() },
    renderBatchSize,
    async () => undefined,
  );
}

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

  it('renders overlays for more than 20 tables (no sync cap)', async () => {
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
    const coordinator = makeCoordinator(apply);

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    expect(apply).toHaveBeenCalled();
    const rangesByKey = apply.mock.calls.at(-1)![1] as Map<string, unknown[]>;
    const totalRanges = [...rangesByKey.values()].reduce((sum, ranges) => sum + ranges.length, 0);
    expect(totalRanges).toBe(tableBlocks.length);
  });

  it('keeps early table overlays when the document has many unique tables', async () => {
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
    const coordinator = makeCoordinator(apply);

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const rangesByKey = apply.mock.calls.at(-1)![1] as Map<string, unknown[]>;
    expect(rangesByKey.size).toBe(tableBlocks.length);
  });

  it('yields between SVG render batches', async () => {
    const tables = Array.from({ length: 25 }, (_, i) => (
      `| Col${i} | Val |\n| --- | --- |\n| ${i} | x |`
    )).join('\n\n');
    const md = `${tables}\n\nAfter tables.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);

    const document = new TextDocument(Uri.file('many-tables.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const yieldToEventLoop = vi.fn(async () => undefined);
    const coordinator = new CustomTableUpdateCoordinator(
      { apply, clear: vi.fn() },
      10,
      yieldToEventLoop,
    );

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    expect(yieldToEventLoop).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledTimes(3);
    const lastDataUris = apply.mock.calls.at(-1)![2] as Map<string, string>;
    expect(lastDataUris.size).toBe(tableBlocks.length);
  });

  it('exports a default batch size aligned with progressive rendering', () => {
    expect(TABLE_SVG_RENDER_BATCH_SIZE).toBe(20);
  });
});
