import * as vscode from 'vscode';
import { bucketWidthForCache, estimateEditorContentWidthPx, estimateVisibleViewportColumns } from '../editor-width';

vi.mock('../../config', () => ({
  config: {
    mermaid: {
      maxWidthColumns: vi.fn(() => 0),
    },
  },
}));

import { config } from '../../config';

function createEditor(visibleRanges: vscode.Range[], lines: string[] = ['x'.repeat(120)]): vscode.TextEditor {
  const document = {
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  };
  return {
    visibleRanges,
    document,
  } as unknown as vscode.TextEditor;
}

describe('estimateEditorContentWidthPx', () => {
  beforeEach(() => {
    vi.mocked(config.mermaid.maxWidthColumns).mockReturnValue(0);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (key: string, defaultValue?: number) => {
        if (key === 'fontSize') return 14;
        if (key === 'lineHeight') return 0;
        return defaultValue;
      },
    } as vscode.WorkspaceConfiguration);
  });

  it('estimates width from visible viewport columns', () => {
    const editor = createEditor([new vscode.Range(0, 0, 0, 150)]);
    const width = estimateEditorContentWidthPx(editor);
    expect(width).toBeGreaterThanOrEqual(320);
    expect(width).toBeLessThanOrEqual(Math.round(14 * 0.6 * 500));
  });

  it('uses configured maxWidthColumns override when set', () => {
    vi.mocked(config.mermaid.maxWidthColumns).mockReturnValue(100);
    const editor = createEditor([new vscode.Range(0, 0, 0, 150)]);
    expect(estimateEditorContentWidthPx(editor)).toBe(Math.round(14 * 0.6 * 100));
  });

  it('enforces a minimum width floor', () => {
    const editor = createEditor([new vscode.Range(0, 0, 0, 10)]);
    expect(estimateEditorContentWidthPx(editor)).toBeGreaterThanOrEqual(320);
  });
});

describe('estimateVisibleViewportColumns', () => {
  it('uses visible viewport width and ignores long source lines', () => {
    const editor = createEditor(
      [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 95))],
      ['| Row 1 | ' + 'x'.repeat(400)],
    );
    expect(estimateVisibleViewportColumns(editor)).toBe(95);
  });

  it('falls back to a sensible minimum when the viewport is very narrow', () => {
    const editor = createEditor([
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5)),
    ]);
    expect(estimateVisibleViewportColumns(editor)).toBe(40);
  });

  it('ignores long table rows in multi-line visible ranges', () => {
    const longRow = '| ' + 'x'.repeat(400) + ' |';
    const editor = createEditor(
      [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 20))],
      ['| Header |', longRow, '| Footer |'],
    );
    expect(estimateVisibleViewportColumns(editor)).toBeLessThan(400);
  });

  it('caps middle visible lines to the viewport edge', () => {
    const intro = 'x'.repeat(130);
    const editor = createEditor(
      [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 95))],
      ['# Title', intro, 'short line'],
    );
    expect(estimateVisibleViewportColumns(editor)).toBe(95);
  });

  it('does not treat a long table row as the viewport width', () => {
    const longRow = '| Row 1 | ' + 'x'.repeat(400) + ' |';
    const editor = createEditor(
      [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(4, 95))],
      [
        '# Long cell wrapping',
        'short intro',
        '## Custom mode',
        '| Section Header | Content |',
        longRow,
      ],
    );
    expect(estimateVisibleViewportColumns(editor)).toBe(95);
  });

  it('falls back to default columns when a long line is fully visible horizontally', () => {
    const longRow = '| Row 1 | ' + 'x'.repeat(400) + ' |';
    const editor = createEditor(
      [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(4, 400))],
      [
        '# Long cell wrapping',
        'short intro',
        '## Custom mode',
        '| Section Header | Content |',
        longRow,
      ],
    );
    expect(estimateVisibleViewportColumns(editor)).toBe(120);
  });
});

describe('bucketWidthForCache', () => {
  it('rounds width to 50px buckets', () => {
    expect(bucketWidthForCache(124)).toBe(100);
    expect(bucketWidthForCache(126)).toBe(150);
  });
});
