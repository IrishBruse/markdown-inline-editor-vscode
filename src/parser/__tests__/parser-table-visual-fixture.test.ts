import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { MarkdownParser } from '../../parser';
import {
  findPipePositions,
  measureOverlayWidth,
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

  it('uses unified column widths in rich cells tables', () => {
    const section = extractSection('## Rich cells');
    const blocks = tableBlocks(section).slice(0, 3);
    for (const block of blocks) {
      const decs = parser.extractDecorations(block);
      const padded = decs.filter((d) => d.type === 'tableCell' || d.type === 'tableCellImage');
      const widthsByColumn = new Map<number, number>();
      for (const cell of padded) {
        const lineStart = block.lastIndexOf('\n', cell.startPos - 1) + 1;
        const pipes: number[] = [];
        for (let i = lineStart; i < block.length; i++) {
          if (block[i] === '\n') break;
          if (block[i] === '|') pipes.push(i);
        }
        let col = -1;
        for (let i = 0; i < pipes.length - 1; i++) {
          if (cell.startPos >= pipes[i] + 1 && cell.endPos <= pipes[i + 1]) {
            col = i;
            break;
          }
        }
        const width = measureOverlayWidth(cell.replacement!);
        const prev = widthsByColumn.get(col);
        if (prev === undefined) {
          widthsByColumn.set(col, width);
        } else {
          expect(width).toBe(prev);
        }
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
    const col0Cells = decs.filter((d) => {
      if (d.type !== 'tableCell') return false;
      const lineStart = block.lastIndexOf('\n', d.startPos - 1) + 1;
      const firstPipe = block.indexOf('|', lineStart);
      const secondPipe = block.indexOf('|', firstPipe + 1);
      return d.startPos > firstPipe && d.endPos <= secondPipe;
    });
    const widths = col0Cells.map((c) => measureOverlayWidth(c.replacement!));
    expect(new Set(widths).size).toBe(1);
  });

  it('pads long bare URL cell in long and dense fixture', () => {
    const block = tableBlocks(extractSection('## Long and dense cells'))[0];
    const decs = parser.extractDecorations(block);
    const urlCell = decs.find((d) => d.type === 'tableCell' && d.cellStyle?.link);
    expect(urlCell).toBeDefined();
    expect(urlCell!.replacement).toContain('https://example.com');
    const col0Cells = decs.filter((d) => {
      if (d.type !== 'tableCell') return false;
      const lineStart = block.lastIndexOf('\n', d.startPos - 1) + 1;
      const firstPipe = block.indexOf('|', lineStart);
      const secondPipe = block.indexOf('|', firstPipe + 1);
      return d.startPos > firstPipe && d.endPos <= secondPipe;
    });
    const widths = col0Cells.map((c) => measureOverlayWidth(c.replacement!));
    expect(new Set(widths).size).toBe(1);
  });

  it('uses unified column widths in CJK and emoji tables', () => {
    const section = extractSection('## CJK and emoji width');
    for (const block of tableBlocks(section)) {
      const decs = parser.extractDecorations(block);
      const widthsByColumn = new Map<number, number>();
      for (const cell of decs.filter((d) => d.type === 'tableCell')) {
        const lineStart = block.lastIndexOf('\n', cell.startPos - 1) + 1;
        const pipes: number[] = [];
        for (let i = lineStart; i < block.length; i++) {
          if (block[i] === '\n') break;
          if (block[i] === '|') pipes.push(i);
        }
        let col = -1;
        for (let i = 0; i < pipes.length - 1; i++) {
          if (cell.startPos >= pipes[i] + 1 && cell.endPos <= pipes[i + 1]) {
            col = i;
            break;
          }
        }
        const width = measureOverlayWidth(cell.replacement!);
        const prev = widthsByColumn.get(col);
        if (prev === undefined) {
          widthsByColumn.set(col, width);
        } else {
          expect(width, block).toBe(prev);
        }
      }
    }
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
