import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser';
import { measureTextWidth } from '../tables';

describe('05-tables.md basic grid alignment', () => {
  it('keeps replacement width for the first basic table', async () => {
    const tablesMd = readFileSync('docs/tests/05-tables.md', 'utf8');
    const start = tablesMd.indexOf('| Name | Role |');
    const end = tablesMd.indexOf('| Name | Age |');
    const md = tablesMd.slice(start, end).trimEnd();
    const parser = await MarkdownParser.create();
    const decs = parser.extractDecorations(md);
    for (const cell of decs.filter((d) => d.type === 'tableCell')) {
      const raw = md.slice(cell.startPos, cell.endPos);
      expect(measureTextWidth(cell.replacement!)).toBe(measureTextWidth(raw));
    }
    for (const dash of decs.filter((d) => d.type === 'tableSeparatorDash')) {
      const raw = md.slice(dash.startPos, dash.endPos);
      expect(dash.replacement!.length).toBe(measureTextWidth(raw));
    }
  });
});
