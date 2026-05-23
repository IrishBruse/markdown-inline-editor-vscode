import type { Mock } from 'vitest';
import { TableDiagramDecorations } from '../table-diagram-decorations';
import { window, ColorThemeKind, Range } from '../../test/__mocks__/vscode';

function makeEditor() {
  const calls = new Map<any, any[][]>();
  return {
    setDecorations: vi.fn((type: any, ranges: any[]) => {
      const prev = calls.get(type) ?? [];
      prev.push(ranges);
      calls.set(type, prev);
    }),
    _calls: calls,
  };
}

function makeRanges(n = 1) {
  return Array.from(
    { length: n },
    (_, i) => new Range({ line: i, character: 0 }, { line: i, character: 5 }),
  );
}

describe('TableDiagramDecorations', () => {
  beforeEach(() => {
    (window.activeColorTheme as any).kind = ColorThemeKind.Dark;
    (window.createTextEditorDecorationType as Mock).mockClear();
  });

  it('keeps all keys when a single apply exceeds the old 50-entry cap', () => {
    const tdd = new TableDiagramDecorations(60);
    const editor = makeEditor();
    const rangesByKey = new Map<string, ReturnType<typeof makeRanges>>();
    const dataUrisByKey = new Map<string, string>();

    for (let i = 0; i < 55; i++) {
      const key = `k${i}`;
      rangesByKey.set(key, makeRanges());
      dataUrisByKey.set(key, `data:${i}`);
    }

    tdd.apply(editor as any, rangesByKey, dataUrisByKey);

    expect(editor.setDecorations).toHaveBeenCalledTimes(55);
    const disposed = (window.createTextEditorDecorationType as Mock).mock.results
      .map((r) => r.value)
      .filter((type: { dispose: Mock }) => type.dispose.mock.calls.length > 0);
    expect(disposed).toHaveLength(0);
  });

});
