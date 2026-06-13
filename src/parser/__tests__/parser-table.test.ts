import { MarkdownParser, DecorationRange } from '../../parser';
import { measureTextWidth } from '../tables';

describe('MarkdownParser - Tables', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  function byType(decs: DecorationRange[], type: string) {
    return decs.filter((d) => d.type === type);
  }

  describe('basic table rendering', () => {
    it('should create tablePipe decorations for pipe characters', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      expect(pipes.length).toBeGreaterThanOrEqual(6);
      pipes.forEach((p) => {
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('should create tableCell decorations with padded replacement', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
        expect(c.replacement!.startsWith('\u00A0')).toBe(true);
        expect(c.replacement!.endsWith('\u00A0')).toBe(true);
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
      const cells = byType(result, 'tableCell');
      const dataCell = cells.find((c) => c.replacement!.includes('x'));
      expect(dataCell).toBeDefined();
      expect(dataCell!.replacement!.indexOf('x')).toBe(1);
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      const rightCell = cells.find((c) => c.replacement!.includes('c'));
      expect(rightCell).toBeDefined();
      expect(rightCell!.replacement!.endsWith('c\u00A0')).toBe(true);
      const leadingSpaces = rightCell!.replacement!.length - rightCell!.replacement!.trimStart().length;
      expect(leadingSpaces).toBeGreaterThanOrEqual(1);
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      const centerCell = cells.find((c) => c.replacement!.includes('b'));
      expect(centerCell).toBeDefined();
      const content = centerCell!.replacement!;
      const trimmed = content.trim();
      const beforeContent = content.indexOf(trimmed);
      const afterContent = content.length - beforeContent - trimmed.length;
      expect(beforeContent).toBeGreaterThanOrEqual(1);
      expect(afterContent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('unified column widths', () => {
    it('pads shorter cells to the column max display width', () => {
      const md = [
        '| Short | MuchLongerHeader |',
        '| ----- | ---------------- |',
        '| x     | y                |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const shortHeader = byType(result, 'tableCell').find((c) => c.replacement?.includes('Short'));
      const shortData = byType(result, 'tableCell').find((c) => c.replacement?.includes('x'));
      expect(shortHeader).toBeDefined();
      expect(shortData).toBeDefined();
      const headerContentIndex = shortHeader!.replacement!.indexOf('Short');
      const dataContentIndex = shortData!.replacement!.indexOf('x');
      expect(headerContentIndex).toBe(dataContentIndex);
      expect(measureTextWidth(shortData!.replacement!)).toBe(
        measureTextWidth(md.slice(shortData!.startPos, shortData!.endPos)),
      );
    });

    it('aligns center column content to unified width', () => {
      const md = [
        '| Left | Center | Right |',
        '|:-----|:------:|------:|',
        '| L    |C    |     R |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const headerCenter = byType(result, 'tableCell').find((c) => c.replacement?.includes('Center'));
      const dataCenter = byType(result, 'tableCell').find((c) => c.replacement?.includes('C'));
      expect(headerCenter).toBeDefined();
      expect(dataCenter).toBeDefined();
      const headerStart = headerCenter!.replacement!.indexOf('Center');
      const dataStart = dataCenter!.replacement!.indexOf('C');
      expect(headerStart).toBe(dataStart);
    });
  });

  describe('CJK wide characters', () => {
    it('should account for CJK double-width in column padding', () => {
      const md = '| Name | CJK  |\n|------|------|\n| AB   | \u4F60\u597D   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
      });
    });

    it('should match replacement width to each cell source span', () => {
      const cases = [
        '| EN | 中文 |\n|----|------|\n| Hi | 你好 |',
        '| Name | CJK  |\n| ---- | ---- |\n| AB   | 你好 |',
        '| Col    | Val  |\n| ------ | ---- |\n| Hangul | 안녕 |',
        '| Col   | Val |\n| ----- | --- |\n| Emoji | 😀  |',
        '| Col      | Val      |\n| -------- | -------- |\n| Hiragana | ひらがな |',
        '| Col    | Val  |\n| ------ | ---- |\n| Family | 👨‍👩‍👧  |',
        '| Col  | Val |\n| ---- | --- |\n| Flag | 🇯🇵  |',
        '| Name | CJK  | Emoji |\n| ---- | ---- | ----- |\n| AB   | 你好 | 😀    |',
      ];
      for (const md of cases) {
        const result = parser.extractDecorations(md);
        for (const cell of byType(result, 'tableCell')) {
          const raw = md.slice(cell.startPos, cell.endPos);
          expect(measureTextWidth(cell.replacement!)).toBe(measureTextWidth(raw));
        }
        for (const dash of byType(result, 'tableSeparatorDash')) {
          const raw = md.slice(dash.startPos, dash.endPos);
          expect(dash.replacement!.length).toBe(measureTextWidth(raw));
        }
      }
    });
  });

  describe('inline formatting in cells', () => {
    it('should render whole-cell strikethrough via inline decorations', () => {
      const md = '| Col |\n|-----|\n| ~~strike~~ |';
      const result = parser.extractDecorations(md);
      const strikeCell = byType(result, 'tableCell').find((c) => {
        const raw = md.slice(c.startPos, c.endPos);
        return raw.includes('strike');
      });
      expect(strikeCell).toBeUndefined();
      expect(byType(result, 'strikethrough').length).toBeGreaterThan(0);
    });

    it('should detect bold cell style', () => {
      const md = '| A |\n|---|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const boldCell = cells.find((c) => c.cellStyle?.fontWeight === 'bold');
      expect(boldCell).toBeDefined();
      expect(boldCell!.replacement).not.toContain('**');
      expect(boldCell!.replacement).toContain('bold');
    });

    it('should detect italic cell style', () => {
      const md = '| A |\n|---|\n| *italic* |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const italicCell = cells.find((c) => c.cellStyle?.fontStyle === 'italic');
      expect(italicCell).toBeDefined();
    });

    it('should strip markers from width calculation', () => {
      const md = '| Header   |\n|----------|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const boldCell = cells.find((c) => c.replacement!.includes('bold'));
      const headerCell = cells.find((c) => c.replacement!.includes('Header'));
      expect(boldCell).toBeDefined();
      expect(headerCell).toBeDefined();
      expect(measureTextWidth(boldCell!.replacement!)).toBe(
        measureTextWidth(md.slice(boldCell!.startPos, boldCell!.endPos)),
      );
      expect(measureTextWidth(headerCell!.replacement!)).toBe(
        measureTextWidth(md.slice(headerCell!.startPos, headerCell!.endPos)),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty cells', () => {
      const md = '| A |   |\n|---|---|\n|   | B |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle single-column table', () => {
      const md = '| A |\n|---|\n| B |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('outer-pipe-less tables', () => {
    it('should render outer-pipe-less table when it starts at document offset 0', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pipes = byType(result, 'tablePipe');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells.every((c) => c.startPos >= 0 && c.endPos > c.startPos)).toBe(true);
      pipes.forEach((p) => {
        expect(p.startPos).toBeGreaterThanOrEqual(0);
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('should render separator for outer-pipe-less table', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const sepDashes = byType(result, 'tableSeparatorDash');
      expect(sepDashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('images in cells', () => {
    it('should pad image-only cells with tableCellImage and icon replacement', () => {
      const md = '| Col | Note |\n| --- | --- |\n| ![t](https://example.com/x.png) | image |';
      const result = parser.extractDecorations(md);
      const imageCell = byType(result, 'tableCellImage');
      expect(imageCell).toHaveLength(1);
      expect(imageCell[0].url).toBe('https://example.com/x.png');
      expect(imageCell[0].replacement).toContain('\u2B14');
      const raw = md.slice(imageCell[0].startPos, imageCell[0].endPos);
      expect(measureTextWidth(imageCell[0].replacement!)).toBe(measureTextWidth(raw));
    });
  });

  describe('links in cells', () => {
    it('should pad link-only cells with label and link cellStyle', () => {
      const md = '| Col |\n|-----|\n| [label](https://example.com) |';
      const result = parser.extractDecorations(md);
      const linkCell = byType(result, 'tableCell').find((c) => c.replacement?.includes('label'));
      expect(linkCell).toBeDefined();
      expect(linkCell!.cellStyle?.link).toBe(true);
      expect(linkCell!.url).toBe('https://example.com');
      const raw = md.slice(linkCell!.startPos, linkCell!.endPos);
      expect(measureTextWidth(linkCell!.replacement!)).toBe(measureTextWidth(raw));
    });

    it('should pad bare URL cells with link cellStyle', () => {
      const md = '| Col | Note |\n| --- | --- |\n| https://example.com/path/to/resource?query=1&other=2 | long URL |';
      const result = parser.extractDecorations(md);
      const urlCell = byType(result, 'tableCell').find((c) => c.url?.includes('https://example.com'));
      expect(urlCell).toBeDefined();
      expect(urlCell!.cellStyle?.link).toBe(true);
      expect(urlCell!.replacement).toContain('https://example.com');
      const raw = md.slice(urlCell!.startPos, urlCell!.endPos);
      expect(measureTextWidth(urlCell!.replacement!)).toBe(measureTextWidth(raw));
    });
  });

  describe('exception cells beside plain cells', () => {
    const cases = [
      [
        'link beside plain',
        '| Col | Note |\n| --- | --- |\n| [label](https://example.com) | link |',
      ],
      [
        'strike beside plain',
        '| Col      | Note   |\n| -------- | ------ |\n| ~~gone~~ | delete |',
      ],
      [
        'image beside plain',
        '| Col | Note |\n| --- | --- |\n| ![t](https://example.com/x.png) | image |',
      ],
    ] as const;

    it.each(cases)('keeps padded width for %s rows', (_label, md) => {
      const result = parser.extractDecorations(md);
      const padded = result.filter((d) => d.type === 'tableCell' || d.type === 'tableCellImage');
      expect(padded.length).toBeGreaterThanOrEqual(3);
      for (const cell of padded) {
        const raw = md.slice(cell.startPos, cell.endPos);
        expect(measureTextWidth(cell.replacement!)).toBe(measureTextWidth(raw));
      }
    });
  });

  describe('link and strikethrough cell alignment', () => {
    const cases = [
      [
        'plain cells beside link row',
        '| Col                 | Note    |\n| ------------------- | ------- |\n| plain               | data    |',
      ],
    ] as const;

    it.each(cases)('keeps padded cell width for %s rows', (_label, md) => {
      const result = parser.extractDecorations(md);
      for (const cell of byType(result, 'tableCell')) {
        const raw = md.slice(cell.startPos, cell.endPos);
        expect(measureTextWidth(cell.replacement!)).toBe(measureTextWidth(raw));
      }
      for (const dash of byType(result, 'tableSeparatorDash')) {
        const raw = md.slice(dash.startPos, dash.endPos);
        expect(dash.replacement!.length).toBe(measureTextWidth(raw));
      }
    });
  });

  describe('mixed formatting fallback', () => {
    it('should render mixed formatting cells with inline decorations instead of padded tableCell', () => {
      const md = '| A |\n|---|\n| **bold** and plain |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const mixedCell = cells.find((c) => {
        const raw = md.slice(c.startPos, c.endPos);
        return raw.includes('bold');
      });
      expect(mixedCell).toBeUndefined();
      expect(byType(result, 'bold').length).toBeGreaterThan(0);
      expect(byType(result, 'hide').length).toBeGreaterThan(0);
    });

    it('should render link mixed with plain text via inline link decorations', () => {
      const md = '| Col | Note |\n| --- | --- |\n| see [docs](https://example.com) here | mixed |';
      const result = parser.extractDecorations(md);
      const mixedCell = byType(result, 'tableCell').find((c) => {
        const raw = md.slice(c.startPos, c.endPos);
        return raw.includes('[docs]');
      });
      expect(mixedCell).toBeUndefined();
      const linkDec = byType(result, 'link').find((d) => {
        const raw = md.slice(d.startPos, d.endPos);
        return raw.includes('docs');
      });
      expect(linkDec).toBeDefined();
    });
  });
});
