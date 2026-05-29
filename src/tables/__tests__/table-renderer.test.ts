import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { renderTableSvg } from '../table-renderer';

function basicBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 40,
    numLines: 4,
    header: ['Name', 'Role'],
    rows: [
      ['Ada', 'Lead'],
      ['Bob', 'Dev'],
    ],
    align: [null, null],
  };
}

const metrics = { lineHeight: 18, fontSize: 13 };

describe('renderTableSvg', () => {
  it('renders header and data rows with borders', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Name');
    expect(svg).toContain('Role');
    expect(svg).toContain('Ada');
    expect(svg).toContain('Bob');
    expect(svg).toContain('font-weight="600"');
  });

  it('escapes XML in cell text', () => {
    const block: TableBlock = {
      ...basicBlock(),
      header: ['A & B', 'C'],
      rows: [['<x>', 'y']],
    };
    const svg = renderTableSvg(block, { isDark: true, ...metrics });
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('&lt;x&gt;');
  });

  it('uses dark theme colors', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: true, ...metrics });
    expect(svg).toContain('#1e1e1e');
    expect(svg).toContain('#cccccc');
  });

  it('sizes SVG height to one editor line per source line', () => {
    const block = basicBlock();
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    const expectedHeight = block.numLines * metrics.lineHeight;
    expect(svg).toContain(`height="${expectedHeight}px"`);
  });

  it('spans header cells across header and separator source lines', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    const headerBandHeight = metrics.lineHeight * 2;
    expect(svg).toContain(`height="${headerBandHeight}"`);
  });

  it('caps column width and truncates long cell text with ellipsis', () => {
    const longText = 'A'.repeat(500);
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Wide'],
      rows: [[longText]],
      align: [null],
    };
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    expect(svg).not.toContain(longText);
    expect(svg).toContain('...');
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(widthMatch).not.toBeNull();
    const totalWidth = Number(widthMatch![1]);
    expect(totalWidth).toBeLessThanOrEqual(400 + 2);
  });
});
