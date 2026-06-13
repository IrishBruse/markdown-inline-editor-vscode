import { describe, expect, it } from 'vitest';
import { filterDecorationsForEditor } from '../visibility-model';
import type { DecorationRange } from '../../parser';
import { TextDocument, TextEditor, Selection, Position, Uri, Range } from '../../test/__mocks__/vscode';

describe('mergeRanges with plain position objects', () => {
  it('does not throw when many overlapping ghost-faint ranges use plain positions', () => {
    const text = '| **a** | **b** |\n| --- | --- |\n| **c** | **d** |';
    const decs: DecorationRange[] = [
      { startPos: 2, endPos: 4, type: 'hide' },
      { startPos: 6, endPos: 7, type: 'bold' },
      { startPos: 7, endPos: 9, type: 'hide' },
      { startPos: 12, endPos: 14, type: 'hide' },
      { startPos: 16, endPos: 17, type: 'bold' },
      { startPos: 17, endPos: 19, type: 'hide' },
    ];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const editor = new TextEditor(doc, [new Selection(new Position(0, 8), new Position(0, 8))]);

    const plainRangeFactory = (startPos: number, endPos: number) =>
      new Range(doc.positionAt(startPos), doc.positionAt(endPos)) as any;

    expect(() =>
      filterDecorationsForEditor(
        editor as any,
        decs,
        [],
        text,
        plainRangeFactory,
      ),
    ).not.toThrow();

    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      plainRangeFactory,
    );
    expect(result.get('bold')?.length).toBeGreaterThan(0);
  });

  it('mergeRanges tolerates plain positions when selection overlaps multiple scopes', () => {
    const text = '**hello** world';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 2, type: 'hide' },
      { startPos: 2, endPos: 7, type: 'bold' },
      { startPos: 7, endPos: 9, type: 'hide' },
    ];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const editor = new TextEditor(doc, [new Selection(new Position(0, 0), new Position(0, 9))]);
    const scopes = [
      {
        startPos: 0,
        endPos: 9,
        range: new Range(new Position(0, 0), new Position(0, 9)) as any,
        kind: 'bold',
      },
      {
        startPos: 2,
        endPos: 7,
        range: new Range(new Position(0, 2), new Position(0, 7)) as any,
      },
    ];

    expect(() =>
      filterDecorationsForEditor(
        editor as any,
        decs,
        scopes,
        text,
        (startPos, endPos) => new Range(doc.positionAt(startPos), doc.positionAt(endPos)) as any,
      ),
    ).not.toThrow();
  });
});
