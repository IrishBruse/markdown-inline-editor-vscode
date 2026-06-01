import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../parser';
import { buildTableLayout, renderTableSvg, renderTableSvgLineSlice } from '../table-renderer';

const metrics = {
  lineHeight: 18,
  fontSize: 13,
  colors: {
    background: '#111111',
    headerBackground: '#222222',
    border: '#333333',
    text: '#eeeeee',
  },
};

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function compactNumber(value: string | undefined): string {
  if (value === undefined) {
    return '-';
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed * 100) / 100) : value;
}

function svgVisualScene(svg: string): string {
  const lines = [
    `svg width=${attr(svg, 'width')} height=${attr(svg, 'height')} viewBox=${attr(svg, 'viewBox')}`,
  ];
  const elements = svg.match(/<rect\b[^>]*\/>|<text\b[^>]*>.*?<\/text>/g) ?? [];

  for (const element of elements) {
    if (element.startsWith('<rect')) {
      lines.push([
        'rect',
        `x=${compactNumber(attr(element, 'x'))}`,
        `y=${compactNumber(attr(element, 'y'))}`,
        `w=${compactNumber(attr(element, 'width'))}`,
        `h=${compactNumber(attr(element, 'height'))}`,
        `fill=${attr(element, 'fill') ?? '-'}`,
        `stroke=${attr(element, 'stroke') ?? '-'}`,
      ].join(' '));
      continue;
    }

    const textFill = attr(element, 'fill') ?? '-';
    const fontSize = attr(element, 'font-size') ?? '-';
    const tspans = element.match(/<tspan\b[^>]*>.*?<\/tspan>/g) ?? [];
    for (const tspan of tspans) {
      const text = tspan
        .replace(/^<tspan\b[^>]*>/, '')
        .replace(/<\/tspan>$/, '')
        .replaceAll('&#x2026;', '[ellipsis]')
        .replaceAll('&#8230;', '[ellipsis]')
        .replaceAll(String.fromCharCode(8230), '[ellipsis]');
      lines.push([
        'text',
        `x=${compactNumber(attr(tspan, 'x'))}`,
        `y=${compactNumber(attr(tspan, 'y'))}`,
        `dy=${compactNumber(attr(tspan, 'dy'))}`,
        `fill=${textFill}`,
        `size=${fontSize}`,
        text,
      ].join(' '));
    }
  }

  return lines.join('\n');
}

function tableBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 160,
    numLines: 5,
    header: ['Left', 'Center', 'Right'],
    rows: [
      ['plain', 'mid', '1.0'],
      ['wide label', 'long wrapping content for visual snapshot', '99'],
      ['last', 'cell', '1000'],
    ],
    align: ['left', 'center', 'right'],
  };
}

function denseBlock(): TableBlock {
  return {
    startPos: 0,
    endPos: 260,
    numLines: 4,
    header: ['Section Header', 'Detailed Placeholder Content'],
    rows: [
      [
        'Row 1',
        [
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore',
          'et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip',
          'ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
          'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        ].join(' '),
      ],
      ['Row 2', 'abcdefghijklmnopqrstuvwxyz0123456789'],
    ],
    align: [null, null],
  };
}

describe('table SVG scene snapshots', () => {
  it('locks full-table renderer output for borders, fills, alignment, and wrapping', () => {
    const svg = renderTableSvg(tableBlock(), { isDark: false, ...metrics });

    expect(svgVisualScene(svg)).toMatchInlineSnapshot(`
      "svg width=471px height=90px viewBox=0 0 471 90
      rect x=- y=- w=471 h=90 fill=#111111 stroke=-
      rect x=1 y=0 w=88 h=36 fill=#222222 stroke=#333333
      text x=6 y=22.55 dy=- fill=#eeeeee size=13 Left
      rect x=90 y=0 w=330 h=36 fill=#222222 stroke=#333333
      text x=231.6 y=22.55 dy=- fill=#eeeeee size=13 Center
      rect x=421 y=0 w=49 h=36 fill=#222222 stroke=#333333
      text x=426 y=22.55 dy=- fill=#eeeeee size=13 Right
      rect x=1 y=36 w=88 h=18 fill=#111111 stroke=#333333
      text x=6 y=50.05 dy=- fill=#eeeeee size=13 plain
      rect x=90 y=36 w=330 h=18 fill=#111111 stroke=#333333
      text x=243.3 y=50.05 dy=- fill=#eeeeee size=13 mid
      rect x=421 y=36 w=49 h=18 fill=#111111 stroke=#333333
      text x=441.6 y=50.05 dy=- fill=#eeeeee size=13 1.0
      rect x=1 y=54 w=88 h=18 fill=#111111 stroke=#333333
      text x=6 y=68.05 dy=- fill=#eeeeee size=13 wide label
      rect x=90 y=54 w=330 h=18 fill=#111111 stroke=#333333
      text x=95.1 y=68.05 dy=- fill=#eeeeee size=13 long wrapping content for visual snapshot
      rect x=421 y=54 w=49 h=18 fill=#111111 stroke=#333333
      text x=449.4 y=68.05 dy=- fill=#eeeeee size=13 99
      rect x=1 y=72 w=88 h=18 fill=#111111 stroke=#333333
      text x=6 y=86.05 dy=- fill=#eeeeee size=13 last
      rect x=90 y=72 w=330 h=18 fill=#111111 stroke=#333333
      text x=239.4 y=86.05 dy=- fill=#eeeeee size=13 cell
      rect x=421 y=72 w=49 h=18 fill=#111111 stroke=#333333
      text x=433.8 y=86.05 dy=- fill=#eeeeee size=13 1000"
    `);
  });

  it('locks per-line SVG overlay output for custom table rendering', () => {
    const layout = buildTableLayout(tableBlock(), { isDark: false, ...metrics });
    const scenes = Array.from({ length: tableBlock().numLines }, (_, sourceLine) => {
      const svg = renderTableSvgLineSlice(layout, sourceLine);
      return svg === null
        ? `line ${sourceLine}: <no overlay>`
        : `line ${sourceLine}:\n${svgVisualScene(svg)}`;
    }).join('\n---\n');

    expect(scenes).toMatchInlineSnapshot(`
      "line 0:
      svg width=471px height=36px viewBox=0 0 471 36
      rect x=- y=- w=471 h=36 fill=- stroke=-
      rect x=1 y=1 w=469 h=34 fill=#222222 stroke=-
      rect x=1 y=1 w=88 h=34 fill=#222222 stroke=-
      text x=6 y=22.55 dy=- fill=#eeeeee size=13 Left
      rect x=90 y=1 w=330 h=34 fill=#222222 stroke=-
      text x=231.6 y=22.55 dy=- fill=#eeeeee size=13 Center
      rect x=421 y=1 w=49 h=34 fill=#222222 stroke=-
      text x=426 y=22.55 dy=- fill=#eeeeee size=13 Right
      rect x=0 y=0 w=471 h=1 fill=#333333 stroke=-
      rect x=0 y=35 w=471 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=36 fill=#333333 stroke=-
      rect x=89 y=0 w=1 h=36 fill=#333333 stroke=-
      rect x=420 y=0 w=1 h=36 fill=#333333 stroke=-
      rect x=470 y=0 w=1 h=36 fill=#333333 stroke=-
      ---
      line 1: <no overlay>
      ---
      line 2:
      svg width=471px height=18px viewBox=0 0 471 18
      rect x=- y=- w=471 h=18 fill=- stroke=-
      rect x=1 y=0 w=469 h=17 fill=#111111 stroke=-
      rect x=1 y=0 w=88 h=17 fill=#111111 stroke=-
      text x=6 y=14.05 dy=- fill=#eeeeee size=13 plain
      rect x=90 y=0 w=330 h=17 fill=#111111 stroke=-
      text x=243.3 y=14.05 dy=- fill=#eeeeee size=13 mid
      rect x=421 y=0 w=49 h=17 fill=#111111 stroke=-
      text x=441.6 y=14.05 dy=- fill=#eeeeee size=13 1.0
      rect x=0 y=17 w=471 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=89 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=420 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=470 y=0 w=1 h=18 fill=#333333 stroke=-
      ---
      line 3:
      svg width=471px height=18px viewBox=0 0 471 18
      rect x=- y=- w=471 h=18 fill=- stroke=-
      rect x=1 y=0 w=469 h=17 fill=#111111 stroke=-
      rect x=1 y=0 w=88 h=17 fill=#111111 stroke=-
      text x=6 y=14.05 dy=- fill=#eeeeee size=13 wide label
      rect x=90 y=0 w=330 h=17 fill=#111111 stroke=-
      text x=95.1 y=14.05 dy=- fill=#eeeeee size=13 long wrapping content for visual snapshot
      rect x=421 y=0 w=49 h=17 fill=#111111 stroke=-
      text x=449.4 y=14.05 dy=- fill=#eeeeee size=13 99
      rect x=0 y=17 w=471 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=89 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=420 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=470 y=0 w=1 h=18 fill=#333333 stroke=-
      ---
      line 4:
      svg width=471px height=18px viewBox=0 0 471 18
      rect x=- y=- w=471 h=18 fill=- stroke=-
      rect x=1 y=0 w=469 h=17 fill=#111111 stroke=-
      rect x=1 y=0 w=88 h=17 fill=#111111 stroke=-
      text x=6 y=14.05 dy=- fill=#eeeeee size=13 last
      rect x=90 y=0 w=330 h=17 fill=#111111 stroke=-
      text x=239.4 y=14.05 dy=- fill=#eeeeee size=13 cell
      rect x=421 y=0 w=49 h=17 fill=#111111 stroke=-
      text x=433.8 y=14.05 dy=- fill=#eeeeee size=13 1000
      rect x=0 y=17 w=471 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=89 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=420 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=470 y=0 w=1 h=18 fill=#333333 stroke=-"
    `);
  });

  it('locks dense custom overlay wrapping and ellipsis renderer output', () => {
    const layout = buildTableLayout(denseBlock(), { isDark: false, ...metrics });
    const rowScenes = [0, 2, 3].map((sourceLine) => {
      const svg = renderTableSvgLineSlice(layout, sourceLine);
      expect(svg).not.toBeNull();
      return `line ${sourceLine}:\n${svgVisualScene(svg!)}`;
    }).join('\n---\n');

    expect(rowScenes).toMatchInlineSnapshot(`
      "line 0:
      svg width=523px height=36px viewBox=0 0 523 36
      rect x=- y=- w=523 h=36 fill=- stroke=-
      rect x=1 y=1 w=521 h=34 fill=#222222 stroke=-
      rect x=1 y=1 w=120 h=34 fill=#222222 stroke=-
      text x=6 y=22.55 dy=- fill=#eeeeee size=13 Section Header
      rect x=122 y=1 w=400 h=34 fill=#222222 stroke=-
      text x=127 y=22.55 dy=- fill=#eeeeee size=13 Detailed Placeholder Content
      rect x=0 y=0 w=523 h=1 fill=#333333 stroke=-
      rect x=0 y=35 w=523 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=36 fill=#333333 stroke=-
      rect x=121 y=0 w=1 h=36 fill=#333333 stroke=-
      rect x=522 y=0 w=1 h=36 fill=#333333 stroke=-
      ---
      line 2:
      svg width=523px height=79px viewBox=0 0 523 79
      rect x=- y=- w=523 h=79 fill=- stroke=-
      rect x=1 y=0 w=521 h=78 fill=#111111 stroke=-
      rect x=1 y=0 w=120 h=78 fill=#111111 stroke=-
      text x=6 y=14.05 dy=- fill=#eeeeee size=13 Row 1
      rect x=122 y=0 w=400 h=78 fill=#111111 stroke=-
      text x=127 y=14.05 dy=- fill=#eeeeee size=13 Lorem ipsum dolor sit amet, consectetur adipiscing
      text x=127 y=- dy=16.56 fill=#eeeeee size=13 elit, sed do eiusmod tempor incididunt ut labore
      text x=127 y=- dy=16.56 fill=#eeeeee size=13 et dolore magna aliqua. Ut enim ad minim veniam,
      text x=127 y=- dy=16.56 fill=#eeeeee size=13 quis nostrud exercitation ullamco laboris nisi u[ellipsis]
      rect x=0 y=78 w=523 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=79 fill=#333333 stroke=-
      rect x=121 y=0 w=1 h=79 fill=#333333 stroke=-
      rect x=522 y=0 w=1 h=79 fill=#333333 stroke=-
      ---
      line 3:
      svg width=523px height=18px viewBox=0 0 523 18
      rect x=- y=- w=523 h=18 fill=- stroke=-
      rect x=1 y=0 w=521 h=17 fill=#111111 stroke=-
      rect x=1 y=0 w=120 h=17 fill=#111111 stroke=-
      text x=6 y=14.05 dy=- fill=#eeeeee size=13 Row 2
      rect x=122 y=0 w=400 h=17 fill=#111111 stroke=-
      text x=127 y=14.05 dy=- fill=#eeeeee size=13 abcdefghijklmnopqrstuvwxyz0123456789
      rect x=0 y=17 w=523 h=1 fill=#333333 stroke=-
      rect x=0 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=121 y=0 w=1 h=18 fill=#333333 stroke=-
      rect x=522 y=0 w=1 h=18 fill=#333333 stroke=-"
    `);
  });

  it('keeps the fast SVG snapshots scoped to renderer invariants', () => {
    const layout = buildTableLayout(denseBlock(), { isDark: false, ...metrics });
    const headerSvg = renderTableSvgLineSlice(layout, 0);
    const separatorSvg = renderTableSvgLineSlice(layout, 1);
    const wrappedSvg = renderTableSvgLineSlice(layout, 2);

    expect(headerSvg).toContain('Section Header');
    expect(separatorSvg).toBeNull();
    expect(wrappedSvg).toContain('&#x2026;');
    expect(wrappedSvg).toContain('shape-rendering="crispEdges"');
  });
});
