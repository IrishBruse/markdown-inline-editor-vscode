import { MarkdownParser } from '../../parser';
import {
  buildCompactDataRowLine,
  buildCompactHeaderLine,
  layoutResponsiveTable,
  layoutResponsiveTableRow,
  renderResponsiveRowSvg,
  truncateToWidth,
} from '../responsive-svg';

describe('responsive-svg', () => {
  it('truncates long text with ellipsis', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    expect(truncateToWidth(text, 10)).toBe('abcdefg...');
  });

  it('includes every column on one compact data row line', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const dataLine = layoutResponsiveTableRow(tableBlocks[0], 2);

    expect(dataLine).toContain('Section Header: Row 1');
    expect(dataLine).toContain('Detailed Placeholder Content:');
    expect(dataLine).toContain('...');
    expect(dataLine.split('\n')).toHaveLength(1);
  });

  it('renders one compact preview line per source row', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    const md = [
      '| A | B |',
      '|---|---|',
      `| x | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const lines = layoutResponsiveTable(tableBlocks[0]);

    expect(lines).toHaveLength(3);
    expect(buildCompactHeaderLine(['A', 'B'])).toBe('A | B');
    expect(lines[2]).toContain('A: x');
    expect(lines[2]).toContain('B:');
  });

  it('renders per-row svg at one line height', async () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const line = layoutResponsiveTableRow(tableBlocks[0], 2);
    const svg = renderResponsiveRowSvg(line, {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      contentWidthPx: 640,
      theme: {
        foreground: '#d4d4d4',
        mutedForeground: '#858585',
        separator: '#858585',
      },
    });

    expect(svg).toContain('height="20"');
    expect(svg).toContain('A: x');
    expect(svg).toContain('B: y');
  });
});
