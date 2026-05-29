import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { renderTableSvg, wrapText } from '../table-renderer';

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

describe('wrapText', () => {
  it('returns a single line when text fits', () => {
    expect(wrapText('hello world', 20)).toEqual(['hello world']);
  });

  it('wraps at word boundaries', () => {
    const lines = wrapText('one two three four', 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four');
  });

  it('breaks words longer than the max width', () => {
    const lines = wrapText('abcdefghij', 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('abcdefghij');
  });
});

describe('renderTableSvg', () => {
  it('renders header and data rows with borders', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Name');
    expect(svg).toContain('Role');
    expect(svg).toContain('Ada');
    expect(svg).toContain('Bob');
    expect(svg).not.toContain('font-weight');
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
    const block = basicBlock();
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    const headerBandHeight = metrics.lineHeight * 2;
    const headerRectMatch = svg.match(
      new RegExp(`<rect[^>]*height="${headerBandHeight}"[^>]*fill="#f3f3f3"`),
    );
    expect(headerRectMatch).not.toBeNull();
  });

  it('does not draw a separate header rule line (cell strokes only)', () => {
    const svg = renderTableSvg(basicBlock(), { isDark: false, ...metrics });
    expect(svg).not.toContain('<line');
    expect(svg).not.toContain('#a8a8a8');
    expect(svg).not.toContain('#6e6e6e');
  });

  it('wraps long cell text with tspans instead of truncating', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';
    const block: TableBlock = {
      startPos: 0,
      endPos: 100,
      numLines: 3,
      header: ['Section', 'Content'],
      rows: [[longText, longText]],
      align: [null, null],
    };
    const svg = renderTableSvg(block, { isDark: false, ...metrics });
    expect(svg).toContain('<tspan');
    expect(svg).toContain('Lorem ipsum');
    expect(svg).toContain('adipiscing');
    expect(svg).toContain('dy="');
    expect(svg).not.toContain('...');
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(widthMatch).not.toBeNull();
    const totalWidth = Number(widthMatch![1]);
    expect(totalWidth).toBeLessThanOrEqual(800 + 4);
    const heightMatch = svg.match(/height="(\d+)"/);
    expect(heightMatch).not.toBeNull();
    const renderedHeight = Number(heightMatch![1]);
    expect(renderedHeight).toBeGreaterThan(block.numLines * metrics.lineHeight);
  });

  it('caps column width for very long unbroken text', () => {
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
    expect(svg).toContain('<tspan');
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(widthMatch).not.toBeNull();
    const totalWidth = Number(widthMatch![1]);
    expect(totalWidth).toBeLessThanOrEqual(400 + 2);
  });
});
