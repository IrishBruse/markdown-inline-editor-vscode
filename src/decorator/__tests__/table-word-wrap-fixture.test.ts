import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarkdownParser } from '../../parser';
import { tableWouldWrap } from '../table-word-wrap';
import type { ScopeEntry } from '../visibility-model';
import { TextDocument, TextEditor, Uri, Range, Position } from '../../test/__mocks__/vscode';

describe('table-word-wrap long cell fixture', () => {
  it('detects wrap for the long-cell table in docs/tests/05-tables.md', async () => {
    const fixturePath = join(process.cwd(), 'docs/tests/05-tables.md');
    const text = readFileSync(fixturePath, 'utf8');
    const tableStart = text.indexOf('| Section Header | Detailed Placeholder Content');
    expect(tableStart).toBeGreaterThanOrEqual(0);

    const parser = await MarkdownParser.create();
    const parsed = parser.extractDecorationsWithScopes(text);
    const tableScope = parsed.scopes.find((s) => s.kind === 'table' && s.startPos === tableStart);
    expect(tableScope).toBeDefined();

    const doc = new TextDocument(Uri.file('05-tables.md'), 'markdown', 1, text);
    const linesBefore = text.substring(0, tableStart).split(/\r\n|\r|\n/).length - 1;
    const headerLineText = text.split(/\r\n|\r|\n/).find((line) => line.includes('Section Header'));
    expect(headerLineText).toBeDefined();

    const tableEndLine = linesBefore + text.substring(tableStart).split(/\r\n|\r|\n/).length - 1;
    const scope: ScopeEntry = {
      startPos: tableScope!.startPos,
      endPos: tableScope!.endPos,
      range: new Range(new Position(linesBefore, 0), new Position(tableEndLine, 0)) as any,
      kind: 'table',
    };

    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue: T): T => {
        if (key === 'wordWrap') return 'on' as T;
        if (key === 'wordWrapColumn') return 80 as T;
        return defaultValue;
      },
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    const editor = new TextEditor(doc, []);
    const lineAtOffset = (offset: number) => text.substring(0, offset).split(/\r\n|\r|\n/).length - 1;

    expect(
      tableWouldWrap(editor as any, scope, parsed.decorations, text, lineAtOffset),
    ).toBe(true);
  });
});
