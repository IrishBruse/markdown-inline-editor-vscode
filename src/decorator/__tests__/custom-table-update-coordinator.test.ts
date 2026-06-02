import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ColorThemeKind, type DecorationOptions, window, workspace } from 'vscode';
import { MarkdownParser } from '../../parser/core';
import {
  buildTableLayout,
  resolveOverlayBandHeight,
  countTableOverlaySourceLines,
  getEditorLineMetrics,
  sourceLineToSliceSpec,
} from '../../tables/table-renderer';
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
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'fontSize') {
          return 13;
        }
        if (key === 'lineHeight') {
          return 0;
        }
        return defaultValue;
      }),
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
    const decorationsByKey = apply.mock.calls.at(-1)![1] as Map<string, unknown[]>;
    const totalDecorations = [...decorationsByKey.values()].reduce((sum, entries) => sum + entries.length, 0);
    const expectedDecorations = tableBlocks.reduce(
      (sum, block) => sum + block.numLines * 2,
      0,
    );
    expect(totalDecorations).toBe(expectedDecorations);
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

    const decorationsByKey = apply.mock.calls.at(-1)![1] as Map<string, unknown[]>;
    const expectedSliceKeys = tableBlocks.reduce((sum, block) => sum + block.numLines, 0);
    expect(decorationsByKey.size).toBe(expectedSliceKeys);
  });

  it('yields between SVG render batches and applies once', async () => {
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

    const expectedSliceKeys = tableBlocks.reduce((sum, block) => sum + block.numLines, 0);
    const expectedSvgJobs = tableBlocks.reduce(
      (sum, block) => sum + countTableOverlaySourceLines(block.numLines),
      0,
    );
    const expectedYields = Math.max(0, Math.ceil(expectedSvgJobs / 10) - 1);
    expect(yieldToEventLoop).toHaveBeenCalledTimes(expectedYields);
    expect(apply).toHaveBeenCalledTimes(1);
    const decorationsByKey = apply.mock.calls[0]![1] as Map<string, unknown[]>;
    expect(decorationsByKey.size).toBe(expectedSliceKeys);
  });

  it('skips re-apply when selection changes outside all tables', async () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter.';
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);
    apply.mockClear();

    const moved = document.positionAt(md.indexOf('After') + 1);
    editor.selections = [new Selection(moved, moved)];
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    expect(apply).not.toHaveBeenCalled();
  });

  it('re-applies when selection enters a table', async () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter.';
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const inside = document.positionAt(0);
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);
    apply.mockClear();

    editor.selections = [new Selection(inside, inside)];
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('exports a default batch size aligned with progressive rendering', () => {
    expect(TABLE_SVG_RENDER_BATCH_SIZE).toBe(20);
  });

  it('allows tall data row overlays to overflow into following source lines', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const md = `| Row | Content |\n| --- | --- |\n| Label | ${longText} |\n\nAfter.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const dataOverlay = [...(apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>).values()]
      .flat()
      .find((opt) => opt.range.start.line === 2 && opt.renderOptions?.before?.contentIconPath);
    expect(dataOverlay?.renderOptions?.before?.textDecoration).toContain('overflow: visible');
    expect(dataOverlay?.renderOptions?.before?.textDecoration).toContain('max-height: none');
  });

  it('sets before.height to band height for long-cell rows', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const md = `| A | B |\n| --- | --- |\n| ${longText} | x |\n\nAfter.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);

    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const { lineHeight, fontSize } = getEditorLineMetrics();
    const layout = buildTableLayout(tableBlocks[0], {
      isDark: true,
      lineHeight,
      fontSize,
      capToSourceLines: false,
    });
    const dataSlice = sourceLineToSliceSpec(2, layout)!;
    const expectedBandHeight = resolveOverlayBandHeight(layout, dataSlice);
    expect(expectedBandHeight).toBeGreaterThan(lineHeight);

    const decorationsByKey = apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>;
    const dataRowOptions = [...decorationsByKey.values()].flat().find(
      (opt) => opt.range.start.line === 2 && opt.renderOptions?.before?.contentIconPath,
    );
    expect(dataRowOptions).toBeDefined();
    expect(dataRowOptions!.renderOptions?.before?.height).toBe(`${expectedBandHeight}px`);
    expect(dataRowOptions!.renderOptions?.before?.textDecoration).toContain('overflow: visible');
    expect(dataRowOptions!.renderOptions?.before?.textDecoration).toContain('max-height: none');
  });

  it('hides GFM source on the full line and anchors the SVG on a collapsed range', async () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter.';
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const lineOptions = [...(apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>).values()]
      .flat()
      .filter((opt) => opt.range.start.line === 0);
    expect(lineOptions).toHaveLength(2);
    const hide = lineOptions.find((opt) => !opt.renderOptions?.before?.contentIconPath);
    const overlay = lineOptions.find((opt) => opt.renderOptions?.before?.contentIconPath);
    expect(hide?.range.end.character).toBeGreaterThan(0);
    expect(overlay?.range.start).toEqual(overlay?.range.end);
  });

  it('hides separator source text and uses only the merged title overlay for a short thead', async () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter.';
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const decorationsByKey = apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>;
    const allOptions = [...decorationsByKey.values()].flat();
    const separatorHide = allOptions.find(
      (opt) => opt.range.start.line === 1 && !opt.renderOptions?.before?.contentIconPath,
    );
    const separatorIcon = allOptions.find(
      (opt) => opt.range.start.line === 1 && opt.renderOptions?.before?.contentIconPath,
    );
    const titleIcon = allOptions.find(
      (opt) => opt.range.start.line === 0 && opt.renderOptions?.before?.contentIconPath,
    );
    const dataRowIcon = allOptions.find(
      (opt) => opt.range.start.line === 2 && opt.renderOptions?.before?.contentIconPath,
    );
    expect(separatorHide).toBeDefined();
    expect(separatorIcon).toBeDefined();
    expect(titleIcon).toBeDefined();
    expect(dataRowIcon).toBeDefined();
  });

  it('uses one merged title overlay when the header is taller than two lines', async () => {
    const longHeader = [
      'Detailed Placeholder Content with many additional words to force the header cell to wrap',
      'across at least six or seven lines in the overlay so row height exceeds max band cap',
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore',
      'et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris',
    ].join(' ');
    const md = `| Section Header | ${longHeader} |\n| --- | --- |\n| Row 1 | short |\n\nAfter.`;
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const titleOverlay = [...(apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>).values()]
      .flat()
      .find((opt) => opt.range.start.line === 0 && opt.renderOptions?.before?.contentIconPath);
    const separatorOptions = [...(apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>).values()]
      .flat()
      .filter((opt) => opt.range.start.line === 1);
    expect(titleOverlay).toBeDefined();
    expect(separatorOptions.some((opt) => opt.renderOptions?.before?.contentIconPath)).toBe(true);
    expect(separatorOptions.some((opt) => !opt.renderOptions?.before?.contentIconPath)).toBe(true);
  });

  it('allows merged thead title overlays to overflow into the separator source line', async () => {
    const md = [
      '| Section Header | Detailed Placeholder Content with enough words to wrap |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      'After.',
    ].join('\n');
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const document = new TextDocument(Uri.file('t.md'), 'markdown', 1, md);
    const outside = document.positionAt(md.indexOf('After'));
    const editor = new TextEditor(document, [new Selection(outside, outside)]);

    const apply = vi.fn();
    const coordinator = makeCoordinator(apply);
    await coordinator.updateAsync(editor, tableBlocks, md, document.version);

    const titleOverlay = [...(apply.mock.calls.at(-1)![1] as Map<string, DecorationOptions[]>).values()]
      .flat()
      .find((opt) => opt.range.start.line === 0 && opt.renderOptions?.before?.contentIconPath);
    expect(titleOverlay?.renderOptions?.before?.textDecoration).toContain('overflow: visible');
    expect(titleOverlay?.renderOptions?.before?.textDecoration).toContain('max-height: none');
  });
});
