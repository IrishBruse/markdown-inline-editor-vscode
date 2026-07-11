import {
  buildResponsiveDataRow,
  buildResponsiveHeaderLine,
  buildResponsiveSeparatorLine,
  estimateGridWidth,
  RESPONSIVE_COLUMN_THRESHOLD,
  RESPONSIVE_LAYOUT_WIDTH,
  shouldUseResponsiveLayout,
  wrapTextToWidth,
  computeViewportColumnWidths,
  wrapCellLines,
} from '../responsive-layout';
import type { TableBlockCell } from '../../parser/types';

const charWidth = (value: string) => value.length;

describe('responsive-layout', () => {
  describe('estimateGridWidth', () => {
    it('returns 0 for empty column widths', () => {
      expect(estimateGridWidth([])).toBe(0);
    });

    it('accounts for pipes, padding, and cell content', () => {
      // 2 cols: | cell1 | cell2 | => numCols + 1 + sum(width + 2)
      expect(estimateGridWidth([3, 4])).toBe(2 + 1 + (3 + 2) + (4 + 2));
    });
  });

  describe('shouldUseResponsiveLayout', () => {
    it('returns false when columns are empty', () => {
      expect(shouldUseResponsiveLayout([])).toBe(false);
    });

    it('returns false when every column is at or below the threshold', () => {
      expect(shouldUseResponsiveLayout([3, 3, RESPONSIVE_COLUMN_THRESHOLD])).toBe(false);
    });

    it('returns true when any column exceeds the threshold', () => {
      expect(shouldUseResponsiveLayout([10, RESPONSIVE_COLUMN_THRESHOLD + 1])).toBe(true);
    });

    it('activates for long-cell tables even with a wide inferred viewport', () => {
      const longCellWidths = [14, 120];
      expect(shouldUseResponsiveLayout(longCellWidths)).toBe(true);
    });
  });

  describe('wrapTextToWidth', () => {
    it('returns a single line when text fits', () => {
      expect(wrapTextToWidth('short', 10, charWidth)).toEqual(['short']);
    });

    it('wraps at word boundaries when possible', () => {
      expect(wrapTextToWidth('hello world', 5, charWidth)).toEqual(['hello', 'world']);
    });

    it('hard-breaks long tokens without spaces', () => {
      expect(wrapTextToWidth('abcdef', 3, charWidth)).toEqual(['abc', 'def']);
    });

    it('returns original text when maxWidth is non-positive', () => {
      expect(wrapTextToWidth('hello world', 0, charWidth)).toEqual(['hello world']);
    });
  });

  describe('wrapCellLines', () => {
    it('delegates to wrapTextToWidth', () => {
      expect(wrapCellLines('hello world', 5)).toEqual(['hello', 'world']);
    });
  });

  describe('computeViewportColumnWidths', () => {
    it('keeps short columns at natural width and caps long columns', () => {
      const capped = computeViewportColumnWidths([14, 120], 80);
      expect(capped[0]).toBe(14);
      expect(capped[1]).toBeLessThan(120);
    });

    it('returns minimum widths when viewport is very narrow', () => {
      const capped = computeViewportColumnWidths([14, 120], 10);
      expect(capped).toEqual([3, 3]);
    });

    it('preserves natural widths when the grid already fits', () => {
      const capped = computeViewportColumnWidths([5, 8], 80);
      expect(capped).toEqual([5, 8]);
    });
  });

  describe('buildResponsiveHeaderLine', () => {
    it('joins headers with pipes and pads to viewport width', () => {
      const line = buildResponsiveHeaderLine(['A', 'B'], 10);
      expect(line).toContain('A | B');
      expect(line.length).toBeGreaterThanOrEqual(10);
    });

    it('wraps to multiple lines when headers exceed viewport', () => {
      const line = buildResponsiveHeaderLine(['LongHeaderOne', 'LongHeaderTwo'], 12);
      expect(line.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('buildResponsiveSeparatorLine', () => {
    it('uses at least three dashes', () => {
      expect(buildResponsiveSeparatorLine(2)).toBe('---');
    });

    it('matches layout width when larger than three', () => {
      expect(buildResponsiveSeparatorLine(RESPONSIVE_LAYOUT_WIDTH)).toBe(
        '-'.repeat(RESPONSIVE_LAYOUT_WIDTH),
      );
    });
  });

  describe('buildResponsiveDataRow', () => {
    it('formats cells with header prefixes and trailing separator', () => {
      const cells: TableBlockCell[] = [
        { displayText: 'Alice' },
        { displayText: '30' },
      ];
      const row = buildResponsiveDataRow(cells, ['Name', 'Age'], 20);

      expect(row).toContain('Name: Alice');
      expect(row).toContain('Age: 30');
      expect(row.endsWith('-'.repeat(20))).toBe(true);
    });

    it('wraps long values across multiple indented lines', () => {
      const cells: TableBlockCell[] = [
        { displayText: 'one two three four' },
      ];
      const row = buildResponsiveDataRow(cells, ['Notes'], 10);

      expect(row).toContain('Notes: one');
      expect(row).toContain('two');
      expect(row.split('\n').length).toBeGreaterThan(2);
    });

    it('falls back to Column N when headers are missing', () => {
      const cells: TableBlockCell[] = [{ displayText: 'x' }];
      const row = buildResponsiveDataRow(cells, [], 12);

      expect(row).toContain('Column 1: x');
    });
  });
});
