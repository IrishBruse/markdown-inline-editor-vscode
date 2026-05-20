import { MarkdownParser, DecorationRange } from '../../parser';

describe('MarkdownParser - Tables', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  function byType(decs: DecorationRange[], type: string) {
    return decs.filter((d) => d.type === type);
  }

  /** Plain cells use native pad; synthetic cells use tableCell. */
  function tableCells(decs: DecorationRange[]) {
    return [...byType(decs, 'tableCell'), ...byType(decs, 'tableCellNativePad')];
  }

  describe('basic table rendering', () => {
    it('should create tablePipe decorations for pipe characters', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      // 3 rows × 3 pipes each = 9, minus separator pipes
      expect(pipes.length).toBeGreaterThanOrEqual(6);
      pipes.forEach((p) => {
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('emits one cell decoration per column for each non-separator row (three-column)', () => {
      const md = [
        '| aa | bb | cc |',
        '| -- | -- | -- |',
        '| 11 | 22 | 33 |',
        '| 44 | 55 | 66 |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const cells =
        byType(result, 'tableCell').length + byType(result, 'tableCellNativePad').length;
      expect(cells).toBe(9);
    });

    it('should create native pad decorations with leading NBSP for plain cells', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = tableCells(result);
      expect(cells.length).toBeGreaterThanOrEqual(4);
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
        expect(c.replacement!.startsWith('\u00A0')).toBe(true);
      });
    });

    it('should create separator decorations', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const sepPipes = byType(result, 'tableSeparatorPipe');
      const sepDashes = byType(result, 'tableSeparatorDash');
      expect(sepPipes.length).toBeGreaterThanOrEqual(3);
      expect(sepDashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('column alignment', () => {
    const alignedTable = [
      '| Left | Center | Right |',
      '|:-----|:------:|------:|',
      '| a    |   b    |     c |',
    ].join('\n');

    it('should left-align cells by default (pad right)', () => {
      const md = '| Foo | Bar |\n|-----|-----|\n| x   | y   |';
      const result = parser.extractDecorations(md);
      const dataLineStart = md.indexOf('| x');
      const dataPad = tableCells(result).find(
        (c) => c.startPos >= dataLineStart && md.slice(c.startPos, c.endPos) === 'x',
      );
      expect(dataPad?.replacement?.startsWith('\u00A0')).toBe(true);
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const dataLineStart = alignedTable.indexOf('| a');
      const rightPad = tableCells(result).find(
        (c) =>
          c.startPos >= dataLineStart &&
          alignedTable.slice(c.startPos, c.endPos).trim() === 'c',
      );
      expect(rightPad?.replacement?.startsWith('\u00A0')).toBe(true);
      // Right-aligned columns add most padding before visible text.
      expect((rightPad!.replacement || '').length).toBeGreaterThan(2);
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const dataLineStart = alignedTable.indexOf('| a');
      const centerPad = tableCells(result).find(
        (c) =>
          c.startPos >= dataLineStart &&
          alignedTable.slice(c.startPos, c.endPos).trim() === 'b',
      );
      expect(centerPad?.replacement?.startsWith('\u00A0')).toBe(true);
      const closingPipe = result.find(
        (d) =>
          d.type === 'tablePipe' &&
          d.startPos > centerPad!.endPos &&
          (d.replacementPrefix?.length ?? 0) > 1,
      );
      expect(closingPipe).toBeDefined();
    });
  });

  describe('CJK wide characters', () => {
    it('should account for CJK double-width in column padding', () => {
      const md = '| Name | CJK  |\n|------|------|\n| AB   | \u4F60\u597D   |';
      const result = parser.extractDecorations(md);
      tableCells(result).forEach((c) => {
        expect(c.replacement).toBeDefined();
      });
    });

    it('treats single emoji as wide so column reserves 2 columns', () => {
      const md = '| Emoji |\n|-------|\n| \uD83D\uDE00 |';
      const result = parser.extractDecorations(md);
      const dataLineStart = md.indexOf('\uD83D\uDE00');
      const emojiPad = tableCells(result).find(
        (c) =>
          c.startPos >= dataLineStart &&
          md.slice(c.startPos, c.endPos).includes('\uD83D\uDE00'),
      );
      expect(emojiPad).toBeDefined();
      const closingPipe = result.find(
        (d) =>
          d.type === 'tablePipe' &&
          d.startPos > emojiPad!.endPos &&
          (d.replacementPrefix?.length ?? 0) >= 4,
      );
      expect(closingPipe).toBeDefined();
    });

    it('counts ZWJ-joined emoji sequences using single combined width', () => {
      const family = '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67';
      const md = `| Emoji |\n|-------|\n| ${family} |`;
      const result = parser.extractDecorations(md);
      const dataLineStart = md.indexOf(family);
      const familyPad = tableCells(result).find(
        (c) => c.startPos >= dataLineStart && md.slice(c.startPos, c.endPos).includes(family),
      );
      expect(familyPad).toBeDefined();
      expect((familyPad!.replacement || '').length).toBeLessThanOrEqual(4);
    });
  });

  describe('inline formatting in cells', () => {
    it('uses native cell for whole-cell strong so source stays visible', () => {
      const md = '| A |\n|---|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.cellStyle?.fontWeight === 'bold')).toBe(false);
      expect(cells.some((c) => c.replacement?.includes('**'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });

    it('merges trailing native pad into closing tablePipe replacementPrefix', () => {
      const md = '| A |\n|---|\n| **BB** |';
      const result = parser.extractDecorations(md);
      const pads = byType(result, 'tableCellNativePad');
      const cells = byType(result, 'tableCell');
      expect(pads.length).toBeGreaterThanOrEqual(1);
      expect(cells.some((c) => c.replacement?.includes('BB'))).toBe(false);
      const dataPad = pads[pads.length - 1];
      const closingPipe = result.find(
        (d) => d.type === 'tablePipe' && d.startPos === dataPad!.endPos,
      );
      expect(closingPipe?.replacementPrefix).toBe('\u00A0');
    });

    it('uses native cell for whole-cell emphasis', () => {
      const md = '| A |\n|---|\n| *italic* |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.cellStyle?.fontStyle === 'italic')).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });

    it('uses equal native leading pad width for plain header and data cells', () => {
      const md = '| Header   |\n|----------|\n| plain    |';
      const result = parser.extractDecorations(md);
      const headerPad = tableCells(result).find((c) =>
        md.slice(c.startPos, c.endPos).includes('Header'),
      );
      const dataPad = tableCells(result).find((c) =>
        md.slice(c.startPos, c.endPos).includes('plain'),
      );
      expect(headerPad?.replacement?.length).toBe(dataPad?.replacement?.length);
    });
  });

  describe('edge cases', () => {
    it('should handle empty cells', () => {
      const md = '| A |   |\n|---|---|\n|   | B |';
      const result = parser.extractDecorations(md);
      expect(tableCells(result).length).toBeGreaterThanOrEqual(4);
    });

    it('should handle single-column table', () => {
      const md = '| A |\n|---|\n| B |';
      const result = parser.extractDecorations(md);
      expect(tableCells(result).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('outer-pipe-less tables', () => {
    it('should render outer-pipe-less table when it starts at document offset 0', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = tableCells(result);
      const pipes = byType(result, 'tablePipe');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells.every((c) => c.startPos >= 0 && c.endPos > c.startPos)).toBe(true);
      pipes.forEach((p) => {
        expect(p.startPos).toBeGreaterThanOrEqual(0);
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('should render cells when table has no outer pipes', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      expect(tableCells(result).length).toBeGreaterThanOrEqual(4);
    });

    it('should render separator for outer-pipe-less table', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const sepDashes = byType(result, 'tableSeparatorDash');
      expect(sepDashes.length).toBeGreaterThanOrEqual(2);
    });

    it('should not create pipe decorations for virtual boundary positions', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      // Virtual boundaries should not be decorated; all real pipes get │
      pipes.forEach((p) => {
        expect(p.replacement).toBe('\u2502');
      });
    });
  });

  describe('links in cells', () => {
    it('uses native cell for link so markdown link styling can apply', () => {
      const md = '| Col |\n|-----|\n| [label](https://example.com) |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.replacement?.includes('label'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('images in cells', () => {
    it('uses native cell for images and still emits a consistent pipe grid', () => {
      const md = '| Col |\n|-----|\n| ![t](https://example.com/x.png) |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
    });
  });

  describe('underscore delimiters in cells', () => {
    it('handles whole-cell ___…___ without throwing', () => {
      const md = '| Col |\n|-----|\n| ___x___ |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
    });
  });

  describe('GFM column alignment and pipes in table rows', () => {
    it('does not emit table decorations when header and separator column counts disagree', () => {
      const md = [
        '| Col | Note |',
        '| --- | ---- | ---------------- |',
        '| `   | `    | pipe inside code |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tablePipe').length).toBe(0);
    });

    it('keeps a pipe inside one cell when escaped inside inline code', () => {
      const md = [
        '| Col | Note |',
        '| --- | ---- |',
        '| `a \\| b \\| c`  | code with escaped pipes in one cell |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
      const dashes = byType(result, 'tableSeparatorDash');
      const firstColDash = dashes[0]?.replacement ?? '';
      expect(firstColDash.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('snake_case and literal character preservation', () => {
    it('should not strip underscores from snake_case cell content', () => {
      const md = '| Field |\n|-------|\n| snake_case |';
      const result = parser.extractDecorations(md);
      const snakePad = tableCells(result).find((c) =>
        md.slice(c.startPos, c.endPos).includes('snake_case'),
      );
      expect(snakePad).toBeDefined();
    });

    it('should not strip asterisks from arithmetic expressions', () => {
      const md = '| Expr |\n|------|\n| 100*200 |';
      const result = parser.extractDecorations(md);
      const exprPad = tableCells(result).find((c) =>
        md.slice(c.startPos, c.endPos).includes('100'),
      );
      expect(exprPad).toBeDefined();
    });
  });

  describe('mixed formatting fallback', () => {
    it('uses native cell for mixed formatting so markers are not in synthetic text', () => {
      const md = '| A |\n|---|\n| **bold** and plain |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.replacement?.includes('**'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rich vs plain table cells', () => {
    it('GFM three-column row with backticks at cell boundaries shows backticks not stray letters', () => {
      const md = [
        '| Col | Note | Third |',
        '| --- | ---- | ----- |',
        '| `   | `    | pipe inside code |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
      const dataLineStart = md.indexOf('| `');
      const rowCells = tableCells(result)
        .filter((c) => c.startPos >= dataLineStart)
        .sort((a, b) => a.startPos - b.startPos);
      expect(rowCells.length).toBe(3);
      expect(md.slice(rowCells[0].startPos, rowCells[0].endPos).trim()).toBe('`');
      expect(md.slice(rowCells[1].startPos, rowCells[1].endPos).trim()).toBe('`');
      expect(md.slice(rowCells[2].startPos, rowCells[2].endPos)).toContain('pipe');
    });

    it('uses synthetic padded cell for whole-cell inline code (grid aligns with pipes)', () => {
      const md = '| C |\n|---|\n| `x` |';
      const result = parser.extractDecorations(md);
      const synthetic = byType(result, 'tableCell');
      const nativePads = byType(result, 'tableCellNativePad');
      expect(synthetic.length).toBeGreaterThanOrEqual(1);
      expect(synthetic.some((c) => c.replacement?.includes('x'))).toBe(true);
      expect(nativePads.some((c) => md.slice(c.startPos, c.endPos) === 'C')).toBe(true);
    });

    it('two-column table with inline code in one cell uses synthetic tableCell', () => {
      const md = [
        '| Col    | Note            |',
        '| ------ | --------------- |',
        '| `code` | whole-cell code |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const codeCell = byType(result, 'tableCell').find((c) =>
        c.replacement?.includes('code') && !c.replacement?.includes('whole'),
      );
      expect(codeCell?.cellStyle?.useTextPreformatColors).toBe(true);
      expect(
        tableCells(result).some((c) => md.slice(c.startPos, c.endPos).includes('whole')),
      ).toBe(true);
    });

    it('keeps plain and inline-code data cells on distinct source ranges', () => {
      const md = [
        '| Col | Note | Third |',
        '| --- | ---- | ----- |',
        '| bb  | `x`  | pipe inside code |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const dataLineStart = md.indexOf('| bb');
      const rowCells = [
        ...byType(result, 'tableCell'),
        ...byType(result, 'tableCellNativePad'),
      ]
        .filter((c) => c.startPos >= dataLineStart)
        .sort((a, b) => a.startPos - b.startPos);
      expect(rowCells.length).toBe(3);
      expect(md.slice(rowCells[0].startPos, rowCells[0].endPos)).toContain('bb');
      expect(md.slice(rowCells[1].startPos, rowCells[1].endPos)).not.toContain('bb');
      expect(md.slice(rowCells[2].startPos, rowCells[2].endPos)).toContain('pipe');
    });

    it('uses native pad for plain cells so source stays clickable', () => {
      const md = '| P |\n|---|\n| plain |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCell').length).toBe(0);
      const pads = byType(result, 'tableCellNativePad');
      expect(pads.length).toBeGreaterThanOrEqual(2);
      pads.forEach((c) => {
        expect(c.replacement!.startsWith('\u00A0')).toBe(true);
      });
    });

    it('scopes plain native pad to trimmed source and hides GFM padding spaces', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const joPad = tableCells(result).find(
        (c) => md.slice(c.startPos, c.endPos) === 'Jo',
      );
      expect(joPad).toBeDefined();
      const dataLineStart = md.indexOf('| Jo');
      const hides = result.filter(
        (d) => d.type === 'hide' && d.startPos >= dataLineStart,
      );
      expect(hides.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('tableCellWidthCh (synthetic cell grid)', () => {
    it('sets tableCellWidthCh on synthetic whole-cell inline code cells', () => {
      const md = '| Col |\n|-----|\n| `xy` |';
      const result = parser.extractDecorations(md);
      const synthetic = byType(result, 'tableCell').filter((c) => c.tableCellWidthCh !== undefined);
      expect(synthetic.length).toBeGreaterThanOrEqual(1);
      synthetic.forEach((c) => {
        expect(c.tableCellWidthCh!).toBeGreaterThan(0);
      });
    });

    it('uses native pad for mixed emphasis in a cell without throwing', () => {
      const md = '| Col |\n|-----|\n| a *i* z |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
    });

    it('uses native pad for mixed underscore emphasis in a cell', () => {
      const md = '| Col |\n|-----|\n| a _i_ z |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
    });
  });
});
