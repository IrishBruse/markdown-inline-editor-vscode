import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { TableCell } from 'mdast';
import { countHiddenMarkerLength } from '../table-cell-hidden-length';

function firstTableCellOnLine(md: string, line: number): TableCell {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  let found: TableCell | undefined;
  visit(tree, 'tableCell', (node) => {
    if (node.position?.start?.line === line) {
      found = node as TableCell;
    }
  });
  if (!found) {
    throw new Error(`no table cell on line ${line}`);
  }
  return found;
}

describe('countHiddenMarkerLength', () => {
  it('counts only backtick fences for inline code, not GFM escape backslashes before pipes', () => {
    const md = ['| x |', '|---|', '| `a \\| b` |'].join('\n');
    const cell = firstTableCellOnLine(md, 3);
    expect(countHiddenMarkerLength(cell, md)).toBe(0);
  });
});
