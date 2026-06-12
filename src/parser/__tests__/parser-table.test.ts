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
      // 3 rows × 3 pipes each = 9, minus separator pipes
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
        // Each cell should start and end with non-breaking space
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
      // Default alignment: content starts after one NBSP
      const dataCell = cells.find((c) => c.replacement!.includes('x'));
      expect(dataCell).toBeDefined();
      // Left-aligned: starts with single NBSP then content
      expect(dataCell!.replacement!.indexOf('x')).toBe(1);
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      // Find a data row cell for the right-aligned column (column index 2, content "c")
      const rightCell = cells.find((c) => c.replacement!.includes('c'));
      expect(rightCell).toBeDefined();
      // Right-aligned: content should end with single NBSP
      expect(rightCell!.replacement!.endsWith('c\u00A0')).toBe(true);
      // Should have leading padding
      const leadingSpaces = rightCell!.replacement!.length - rightCell!.replacement!.trimStart().length;
      expect(leadingSpaces).toBeGreaterThanOrEqual(1);
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      // Find a data row cell for the center-aligned column (column index 1, content "b")
      const centerCell = cells.find((c) => c.replacement!.includes('b'));
      expect(centerCell).toBeDefined();
      // Center-aligned: should have padding on both sides
      const content = centerCell!.replacement!;
      const trimmed = content.replace(/\u00A0/g, '').trim();
      const beforeContent = content.indexOf(trimmed);
      const afterContent = content.length - beforeContent - trimmed.length;
      // Both sides should have at least 1 char of padding
      expect(beforeContent).toBeGreaterThanOrEqual(1);
      expect(afterContent).toBeGreaterThanOrEqual(1);
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
    it('should replace strikethrough-only cells with padded tableCell decorations', () => {
      const md = '| Col |\n|-----|\n| ~~strike~~ |';
      const result = parser.extractDecorations(md);
      const strikeCell = byType(result, 'tableCell').find((c) => c.replacement?.includes('strike'));
      expect(strikeCell).toBeDefined();
      expect(strikeCell!.replacement).not.toContain('~~');
      expect(strikeCell!.cellStyle?.textDecoration).toBe('line-through');
    });

    it('should detect bold cell style', () => {
      const md = '| A |\n|---|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const boldCell = cells.find((c) => c.cellStyle?.fontWeight === 'bold');
      expect(boldCell).toBeDefined();
      // replacement should not contain ** markers
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

    it('should render cells when table has no outer pipes', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
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

  describe('images in cells', () => {
    it('should emit tableCellImage with icon and url for image-only cells', () => {
      const md = '| Col | Note |\n| --- | --- |\n| ![t](https://example.com/x.png) | image |';
      const result = parser.extractDecorations(md);
      const imageCells = byType(result, 'tableCellImage');
      expect(imageCells.length).toBe(1);
      expect(imageCells[0].url).toBe('https://example.com/x.png');
      expect(imageCells[0].replacement).toContain('\u2B14');
      const altTextCells = byType(result, 'tableCell').filter((c) =>
        c.replacement?.replace(/\u00A0/g, '').trim() === 't',
      );
      expect(altTextCells).toHaveLength(0);
    });
  });

  describe('links in cells', () => {
    it('should replace link-only cells with padded tableCell decorations and url', () => {
      const md = '| Col |\n|-----|\n| [label](https://example.com) |';
      const result = parser.extractDecorations(md);
      const linkCell = byType(result, 'tableCell').find((c) => c.replacement?.includes('label'));
      expect(linkCell).toBeDefined();
      expect(linkCell!.url).toBe('https://example.com');
      expect(linkCell!.replacement).not.toContain('](');
    });

    it('should pad bare URL cells via tableCell with url', () => {
      const md = '| Col | Note |\n| --- | --- |\n| https://example.com/path/to/resource?query=1&other=2 | long URL |';
      const result = parser.extractDecorations(md);
      const urlCell = byType(result, 'tableCell').find((c) => c.url?.includes('https://example.com'));
      expect(urlCell).toBeDefined();
      expect(urlCell!.replacement).toContain('https://example.com');
      expect(measureTextWidth(urlCell!.replacement!)).toBe(
        measureTextWidth(md.slice(urlCell!.startPos, urlCell!.endPos)),
      );
    });

    it('should pad URL autolink cells via tableCell with url', () => {
      const md = '| Col |\n|-----|\n| <https://example.com> |';
      const result = parser.extractDecorations(md);
      const linkCell = byType(result, 'tableCell').find((c) => c.url === 'https://example.com');
      expect(linkCell).toBeDefined();
      expect(linkCell!.replacement).toContain('https://example.com');
      expect(linkCell!.replacement).not.toContain('<');
    });

    it('should pad email autolink cells via tableCell with url', () => {
      const md = '| Col |\n|-----|\n| <mailto:dev@example.com> |';
      const result = parser.extractDecorations(md);
      const mailCell = byType(result, 'tableCell').find((c) => c.url?.includes('mailto:'));
      expect(mailCell).toBeDefined();
      expect(mailCell!.replacement).toContain('dev@example.com');
    });

    it('should still pad plain text cells beside link cells', () => {
      const md = '| Col | Note |\n| --- | --- |\n| <https://example.com> | autolink |';
      const result = parser.extractDecorations(md);
      const noteCell = byType(result, 'tableCell').find((c) => c.replacement?.includes('autolink'));
      const linkCell = byType(result, 'tableCell').find((c) => c.url === 'https://example.com');
      expect(noteCell).toBeDefined();
      expect(linkCell).toBeDefined();
    });
  });

  describe('snake_case and literal character preservation', () => {
    it('should not strip underscores from snake_case cell content', () => {
      const md = '| Field |\n|-------|\n| snake_case |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const snakeCell = cells.find((c) => c.replacement!.includes('snake_case'));
      expect(snakeCell).toBeDefined();
    });

    it('should not strip asterisks from arithmetic expressions', () => {
      const md = '| Expr |\n|------|\n| 100*200 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const exprCell = cells.find((c) => c.replacement!.includes('100'));
      expect(exprCell).toBeDefined();
    });
  });

  describe('inline code in cells', () => {
    it('should detect inline code cell style', () => {
      const md = '| Plain | **Bold** | *Italic* | `code` |\n|-------|----------|----------|--------|\n| ok    | loud     | soft     | mono   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const codeCell = cells.find((c) => c.replacement?.includes('code') && c.cellStyle?.inlineCode);
      expect(codeCell).toBeDefined();
      expect(codeCell!.replacement).not.toContain('`');
    });
  });

  describe('link and strikethrough cell alignment', () => {
    const cases = [
      [
        'bare URL autolink',
        '| Col                 | Note    |\n| ------------------- | ------- |\n| https://example.com | autolink |',
      ],
      [
        'mailto autolink',
        '| Col                       | Note           |\n| --------------------------- | -------------- |\n| mailto:dev@example.com | mail autolink |',
      ],
      [
        'strikethrough whole cell',
        '| Col     | Note   |\n| ------- | ------ |\n| ~~gone~~ | delete |',
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
    it('should show raw syntax for mixed formatting cells', () => {
      const md = '| A |\n|---|\n| **bold** and plain |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const mixedCell = cells.find((c) => c.replacement!.includes('bold'));
      expect(mixedCell).toBeDefined();
      // Mixed formatting should show raw markdown syntax
      expect(mixedCell!.replacement).toContain('**');
      // Should NOT have cellStyle since it's mixed
      expect(mixedCell!.cellStyle).toBeUndefined();
    });
  });
});
