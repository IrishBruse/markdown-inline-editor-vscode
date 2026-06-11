import * as vscode from 'vscode';
import {
  computeRenderedTableHeaderWidth,
  getWrapColumnLimit,
  tableWouldWrap,
} from '../table-word-wrap';
import type { ScopeEntry } from '../visibility-model';
import type { DecorationRange } from '../../parser';
import { TextDocument, TextEditor, Selection, Position, Uri, Range } from '../../test/__mocks__/vscode';

function mockEditorConfig(options: Record<string, unknown>) {
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: <T>(key: string, defaultValue: T): T => {
      if (key in options) {
        return options[key] as T;
      }
      return defaultValue;
    },
  } as ReturnType<typeof vscode.workspace.getConfiguration>);
}

describe('table-word-wrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined wrap limit when word wrap is off', () => {
    mockEditorConfig({ wordWrap: 'off' });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '');
    const editor = new TextEditor(doc, []);
    expect(getWrapColumnLimit(editor as any)).toBeUndefined();
  });

  it('uses wordWrapColumn when editor.wordWrap is wordWrapColumn', () => {
    mockEditorConfig({ wordWrap: 'wordWrapColumn', wordWrapColumn: 60 });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '');
    const editor = new TextEditor(doc, []);
    expect(getWrapColumnLimit(editor as any)).toBe(60);
  });

  it('sums header-row replacement widths for rendered table width', () => {
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 20,
      range: new Range(new Position(0, 0), new Position(2, 0)) as any,
      kind: 'table',
    };
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' },
      { startPos: 1, endPos: 4, type: 'tableCell', replacement: ' A  ' },
      { startPos: 4, endPos: 5, type: 'tablePipe', replacement: '│' },
      { startPos: 5, endPos: 8, type: 'tableCell', replacement: ' B  ' },
      { startPos: 8, endPos: 9, type: 'tablePipe', replacement: '│' },
      { startPos: 10, endPos: 11, type: 'tablePipe', replacement: '│' },
    ];
    const width = computeRenderedTableHeaderWidth(
      decorations,
      tableScope,
      0,
      (offset) => (offset < 10 ? 0 : 1),
    );
    expect(width).toBe(11);
  });

  it('detects wrap when rendered header exceeds wrap column', () => {
    mockEditorConfig({ wordWrap: 'wordWrapColumn', wordWrapColumn: 10 });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '| A | B |\n|---|---|');
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 20,
      range: new Range(new Position(0, 0), new Position(1, 5)) as any,
      kind: 'table',
    };
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' },
      { startPos: 1, endPos: 4, type: 'tableCell', replacement: ' A  ' },
      { startPos: 4, endPos: 5, type: 'tablePipe', replacement: '│' },
      { startPos: 5, endPos: 8, type: 'tableCell', replacement: ' B  ' },
      { startPos: 8, endPos: 9, type: 'tablePipe', replacement: '│' },
    ];
    const editor = new TextEditor(doc, []);
    expect(tableWouldWrap(editor as any, tableScope, decorations, (offset) => (offset < 10 ? 0 : 1))).toBe(true);
  });

  it('does not detect wrap when word wrap is off', () => {
    mockEditorConfig({ wordWrap: 'off' });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '| A | B |');
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 9,
      range: new Range(new Position(0, 0), new Position(0, 9)) as any,
      kind: 'table',
    };
    const decorations: DecorationRange[] = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '│' },
    ];
    const editor = new TextEditor(doc, []);
    expect(tableWouldWrap(editor as any, tableScope, decorations, () => 0)).toBe(false);
  });
});
