import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser';
import { measureOverlayWidth } from '../tables';

function assertUnifiedColumnWidths(md: string, decs: { startPos: number; endPos: number; replacement?: string }[]): void {
  const widthsByColumn = new Map<number, number>();
  for (const cell of decs) {
    const lineStart = md.lastIndexOf('\n', cell.startPos - 1) + 1;
    const pipes: number[] = [];
    for (let i = lineStart; i < md.length; i++) {
      if (md[i] === '\n') break;
      if (md[i] === '|') pipes.push(i);
    }
    let col = -1;
    for (let i = 0; i < pipes.length - 1; i++) {
      if (cell.startPos >= pipes[i] + 1 && cell.endPos <= pipes[i + 1]) {
        col = i;
        break;
      }
    }
    expect(col).toBeGreaterThanOrEqual(0);
    const width = measureOverlayWidth(cell.replacement!);
    const prev = widthsByColumn.get(col);
    if (prev === undefined) {
      widthsByColumn.set(col, width);
    } else {
      expect(width).toBe(prev);
    }
  }
}

describe('05-tables.md basic grid alignment', () => {
  it('uses unified column widths for the first basic table', async () => {
    const tablesMd = readFileSync('docs/tests/05-tables.md', 'utf8');
    const start = tablesMd.indexOf('| Name | Role |');
    const end = tablesMd.indexOf('| Name | Age |');
    const md = tablesMd.slice(start, end).trimEnd();
    const parser = await MarkdownParser.create();
    const decs = parser.extractDecorations(md);
    assertUnifiedColumnWidths(md, decs.filter((d) => d.type === 'tableCell'));
    const cellWidths = new Map<number, number>();
    for (const cell of decs.filter((d) => d.type === 'tableCell')) {
      const lineStart = md.lastIndexOf('\n', cell.startPos - 1) + 1;
      const pipes: number[] = [];
      for (let i = lineStart; i < md.length; i++) {
        if (md[i] === '\n') break;
        if (md[i] === '|') pipes.push(i);
      }
      for (let i = 0; i < pipes.length - 1; i++) {
        if (cell.startPos >= pipes[i] + 1 && cell.endPos <= pipes[i + 1]) {
          cellWidths.set(i, measureOverlayWidth(cell.replacement!));
        }
      }
    }
    for (const dash of decs.filter((d) => d.type === 'tableSeparatorDash')) {
      const lineStart = md.lastIndexOf('\n', dash.startPos - 1) + 1;
      const pipes: number[] = [];
      for (let i = lineStart; i < md.length; i++) {
        if (md[i] === '\n') break;
        if (md[i] === '|') pipes.push(i);
      }
      for (let i = 0; i < pipes.length - 1; i++) {
        if (dash.startPos >= pipes[i] + 1 && dash.endPos <= pipes[i + 1]) {
          const cellWidth = cellWidths.get(i);
          if (cellWidth !== undefined) {
            expect(dash.replacement!.length).toBe(cellWidth);
          }
        }
      }
    }
  });
});
