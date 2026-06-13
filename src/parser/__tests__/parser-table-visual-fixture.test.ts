import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { MarkdownParser } from '../../parser';
import {
  findPipePositions,
  measureTextWidth,
  normalizePipePositions,
  trimLineEnd,
} from '../tables';

const TABLES_MD = readFileSync('docs/tests/05-tables.md', 'utf8');

function extractSection(sectionTitle: string): string {
  const start = TABLES_MD.indexOf(sectionTitle);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = TABLES_MD.indexOf('\n## ', start + sectionTitle.length);
  return TABLES_MD.slice(start, next === -1 ? TABLES_MD.length : next);
}

function tableBlocks(section: string): string[] {
  return section
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.startsWith('|'));
}

function pipeColumns(line: string): number[] {
  const trimmed = trimLineEnd(line, 0, line.length);
  const raw = findPipePositions(line, 0, trimmed);
  return normalizePipePositions(line, 0, trimmed, raw).positions;
}

function assertAlignedPipes(block: string): void {
  const lines = block.split('\n').filter((l) => l.includes('|'));
  const columns = lines.map(pipeColumns);
  const ref = columns[0];
  for (const cols of columns) {
    expect(cols).toEqual(ref);
  }
}

describe('05-tables.md visual fixture alignment', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  const sections = [
    '## Rich cells',
    '## Links in cells',
    '## Long and dense cells',
    '## CJK and emoji width',
    '## Whole-cell styling',
    '## Strikethrough whole cell',
    '## Mixed inline in one cell',
    '## Inline code beside text',
  ] as const;

  for (const sectionTitle of sections) {
    it(`pipes align within each table in ${sectionTitle}`, () => {
      const section = extractSection(sectionTitle);
      for (const block of tableBlocks(section)) {
        assertAlignedPipes(block);
      }
    });
  }

  it('pads link and image rich cells to source width', () => {
    const section = extractSection('## Rich cells');
    const blocks = tableBlocks(section).slice(0, 3);
    for (const block of blocks) {
      const decs = parser.extractDecorations(block);
      const padded = decs.filter((d) => d.type === 'tableCell' || d.type === 'tableCellImage');
      for (const cell of padded) {
        const raw = block.slice(cell.startPos, cell.endPos);
        expect(measureTextWidth(cell.replacement!)).toBe(measureTextWidth(raw));
      }
    }
  });

  it('whole-cell strike uses inline strikethrough decorations', () => {
    const md = '| ~~strike~~ | strikethrough |\n| ---------- | ------------- |\n| ~~gone~~ | delete |';
    const decs = parser.extractDecorations(md);
    const strikeOverlay = decs.find(
      (d) => d.type === 'tableCell' && md.slice(d.startPos, d.endPos).includes('~~'),
    );
    expect(strikeOverlay).toBeUndefined();
    expect(decs.some((d) => d.type === 'strikethrough')).toBe(true);
    const plain = decs.find((d) => d.type === 'tableCell' && d.replacement?.includes('strikethrough'));
    expect(plain?.cellStyle?.textDecoration).toBeUndefined();
  });

  it('renders link-only Docs cell in links fixture with grid padding', () => {
    const block = tableBlocks(extractSection('## Links in cells'))[0];
    const decs = parser.extractDecorations(block);
    const linkCell = decs.find((d) => d.type === 'tableCell' && d.cellStyle?.link);
    expect(linkCell).toBeDefined();
    expect(linkCell!.replacement).toContain('Docs');
    expect(linkCell!.url).toContain('README.md');
    const raw = block.slice(linkCell!.startPos, linkCell!.endPos);
    expect(measureTextWidth(linkCell!.replacement!)).toBe(measureTextWidth(raw));
  });

  it('pads long bare URL cell in long and dense fixture', () => {
    const block = tableBlocks(extractSection('## Long and dense cells'))[0];
    const decs = parser.extractDecorations(block);
    const urlCell = decs.find((d) => d.type === 'tableCell' && d.cellStyle?.link);
    expect(urlCell).toBeDefined();
    expect(urlCell!.replacement).toContain('https://example.com');
    const raw = block.slice(urlCell!.startPos, urlCell!.endPos);
    expect(measureTextWidth(urlCell!.replacement!)).toBe(measureTextWidth(raw));
  });

  it('mixed inline cells render via inline bold/italic decorations', () => {
    const section = extractSection('## Mixed inline in one cell');
    for (const block of tableBlocks(section)) {
      const decs = parser.extractDecorations(block);
      const dataLine = block.split('\n')[2];
      const mixedCellStart = dataLine.indexOf('|') + 1;
      const mixedCellEnd = dataLine.indexOf('|', mixedCellStart + 1);
      const mixedRaw = dataLine.slice(mixedCellStart, mixedCellEnd);
      const mixedTableCell = decs.find((d) =>
        d.type === 'tableCell' &&
        d.startPos >= block.indexOf(dataLine) + mixedCellStart &&
        d.endPos <= block.indexOf(dataLine) + mixedCellEnd,
      );
      expect(mixedTableCell, block).toBeUndefined();

      const hasInlineFormat = decs.some((d) =>
        (d.type === 'bold' || d.type === 'italic' || d.type === 'boldItalic') &&
        d.startPos >= block.indexOf(dataLine) &&
        d.endPos <= block.indexOf(dataLine) + dataLine.length,
      );
      expect(hasInlineFormat || !/\*\*|_[^_]+_/.test(mixedRaw), block).toBe(true);
    }
  });

  it('inline code beside text cells use inline code decorations', () => {
    const section = extractSection('## Inline code beside text');
    const blocks = tableBlocks(section);
    const beforeCode = parser.extractDecorations(blocks[0]);
    const beforeCell = beforeCode.find((d) => d.type === 'tableCell' && d.replacement?.includes('`'));
    expect(beforeCell).toBeUndefined();
    expect(beforeCode.some((d) => d.type === 'code')).toBe(true);

    const twoSpans = parser.extractDecorations(blocks[1]);
    const twoCell = twoSpans.find((d) => {
      if (d.type !== 'tableCell') return false;
      const raw = blocks[1].slice(d.startPos, d.endPos);
      return raw.includes('`one`');
    });
    expect(twoCell).toBeUndefined();
    expect(twoSpans.filter((d) => d.type === 'code').length).toBeGreaterThanOrEqual(2);
  });
});
