import * as vscode from 'vscode';
import {
  computeMaxRawTableLineWidth,
  computeRenderedTableHeaderWidth,
  getAvailableLineWidth,
  tableWouldWrap,
} from '../table-word-wrap';
import type { ScopeEntry } from '../visibility-model';
import type { DecorationRange } from '../../parser';
import { TextDocument, TextEditor, Uri, Range, Position } from '../../test/__mocks__/vscode';

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

  it('uses viewport width when word wrap is off', () => {
    mockEditorConfig({ wordWrap: 'off', fontSize: 14 });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '');
    const editor = new TextEditor(doc, []);
    const width = getAvailableLineWidth(editor as any);
    expect(width).toBeGreaterThan(40);
    expect(width).toBeLessThan(200);
  });

  it('uses wordWrapColumn when editor.wordWrap is wordWrapColumn', () => {
    mockEditorConfig({ wordWrap: 'wordWrapColumn', wordWrapColumn: 60 });
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '');
    const editor = new TextEditor(doc, []);
    expect(getAvailableLineWidth(editor as any)).toBe(60);
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

  it('measures raw table line width from source text', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |';
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: text.length,
      range: new Range(new Position(0, 0), new Position(2, 5)) as any,
      kind: 'table',
    };
    const lineAtOffset = (offset: number) => text.substring(0, offset).split('\n').length - 1;
    expect(computeMaxRawTableLineWidth(text, tableScope, lineAtOffset)).toBeGreaterThan(5);
  });

  it('detects wrap when rendered header exceeds available width', () => {
    mockEditorConfig({ wordWrap: 'wordWrapColumn', wordWrapColumn: 10 });
    const text = '| A | B |\n|---|---|';
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: text.length,
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
    const lineAtOffset = (offset: number) => text.substring(0, offset).split('\n').length - 1;
    expect(
      tableWouldWrap(editor as any, tableScope, decorations, text, lineAtOffset),
    ).toBe(true);
  });

  it('detects wide raw tables even when word wrap is off', () => {
    mockEditorConfig({ wordWrap: 'off', fontSize: 14 });
    const text = `| ${'x'.repeat(200)} |`;
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: text.length,
      range: new Range(new Position(0, 0), new Position(0, text.length)) as any,
      kind: 'table',
    };
    const editor = new TextEditor(doc, []);
    const lineAtOffset = () => 0;
    expect(
      tableWouldWrap(editor as any, tableScope, [], text, lineAtOffset),
    ).toBe(true);
  });
});
