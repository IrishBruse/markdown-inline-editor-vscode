import * as vscode from 'vscode';
import { TableUpdateCoordinator } from '../table-update-coordinator';
import { TableDiagramDecorations } from '../table-diagram-decorations';
import type { TableBlock } from '../../parser';

vi.mock('../../tables/table-renderer', () => ({
  renderTableSvg: vi.fn().mockResolvedValue('<svg></svg>'),
  getTableThemeColors: vi.fn().mockReturnValue({
    foreground: '#cccccc',
    border: '#3c3c3c',
    headerBackground: '#2a2d2e',
    cellBackground: '#1e1e1e',
  }),
}));

vi.mock('../../mermaid/mermaid-renderer', () => ({
  svgToDataUri: vi.fn().mockReturnValue('data:image/svg+xml,test'),
}));

function makeBlock(startPos: number, endPos: number): TableBlock {
  return {
    startPos,
    endPos,
    numLines: 3,
    columnCount: 2,
    rows: [
      { isHeader: true, cells: [{ text: 'A', align: null }, { text: 'B', align: null }] },
      { isHeader: false, cells: [{ text: '1', align: null }, { text: '2', align: null }] },
    ],
  };
}

describe('TableUpdateCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits overlay when a non-empty selection spans the table', async () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |\n\nafter';
    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      text,
    );
    const block = makeBlock(0, text.indexOf('\n\nafter'));
    const selection = new vscode.Selection(
      new vscode.Position(0, 0),
      new vscode.Position(2, 5),
    );
    const editor = new (vscode.TextEditor as any)(document, [selection]);
    editor.visibleRanges = [
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(5, 0)),
    ];
    editor.setDecorations = vi.fn();

    const decorations = new TableDiagramDecorations(10);
    const applySpy = vi.spyOn(decorations, 'apply');
    const coordinator = new TableUpdateCoordinator(decorations, 2);

    await coordinator.update(editor as any, [block], text, document.version);

    expect(applySpy).toHaveBeenCalled();
    const rangesByKey = applySpy.mock.calls[0][1] as Map<string, unknown>;
    expect(rangesByKey.size).toBe(0);
  });

  it('applies overlay when selection is outside the table', async () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |\n\nafter';
    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      text,
    );
    const block = makeBlock(0, text.indexOf('\n\nafter'));
    const caret = new vscode.Selection(new vscode.Position(4, 0), new vscode.Position(4, 0));
    const editor = new (vscode.TextEditor as any)(document, [caret]);
    editor.visibleRanges = [
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(5, 0)),
    ];
    editor.setDecorations = vi.fn();

    const decorations = new TableDiagramDecorations(10);
    const applySpy = vi.spyOn(decorations, 'apply');
    const coordinator = new TableUpdateCoordinator(decorations, 2);

    await coordinator.update(editor as any, [block], text, document.version);

    expect(applySpy).toHaveBeenCalled();
    const rangesByKey = applySpy.mock.calls[0][1] as Map<string, unknown>;
    expect(rangesByKey.size).toBeGreaterThan(0);
  });
});
