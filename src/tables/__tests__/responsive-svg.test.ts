import { MarkdownParser } from '../../parser';
import { layoutResponsiveTable, renderResponsiveTableSvg } from '../responsive-svg';

describe('responsive-svg', () => {
  it('includes both column blocks in layout lines', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const md = [
      '| Section Header | Detailed Placeholder Content |',
      '| -------------- | ---------------------------- |',
      `| Row 1          | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const lines = layoutResponsiveTable(tableBlocks[0]);

    expect(lines.join('\n')).toContain('Section Header: Row 1');
    expect(lines.join('\n')).toContain('Detailed Placeholder Content:');
    expect(lines.join('\n')).toContain('Lorem ipsum');
  });

  it('renders svg with text nodes for each layout line', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    const md = [
      '| A | B |',
      '|---|---|',
      `| x | ${longText} |`,
    ].join('\n');
    const parser = await MarkdownParser.create();
    const { tableBlocks } = parser.extractDecorationsWithScopes(md);
    const svg = renderResponsiveTableSvg(tableBlocks[0], {
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

    expect(svg).toContain('<svg');
    expect(svg).toContain('A: x');
    expect(svg).toContain('B: Lorem ipsum');
  });
});
