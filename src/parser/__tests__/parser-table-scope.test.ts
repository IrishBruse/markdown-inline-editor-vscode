import { MarkdownParser } from '../../parser';

describe('MarkdownParser - table scope', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  it('emits a table scope for GFM tables', () => {
    const markdown = '| A | B |\n| - | - |\n| 1 | 2 |';
    const { scopes } = parser.extractDecorationsWithScopes(markdown);
    const tableScopes = scopes.filter((scope) => scope.kind === 'table');
    expect(tableScopes).toHaveLength(1);
    expect(tableScopes[0].startPos).toBe(0);
    expect(tableScopes[0].endPos).toBe(markdown.length);
  });

  it('still emits bold hide decorations inside table cells', () => {
    const markdown = '| **bold** | plain |';
    const { decorations } = parser.extractDecorationsWithScopes(markdown);
    expect(decorations.some((d) => d.type === 'hide')).toBe(true);
    expect(decorations.some((d) => d.type === 'bold')).toBe(true);
  });
});
