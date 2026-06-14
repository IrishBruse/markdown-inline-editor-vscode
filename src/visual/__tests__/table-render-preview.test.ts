import { describe, expect, it } from 'vitest';
import {
  applyTableDecorations,
  assertAlignedPipes,
  buildTablePreview,
  buildVisualReport,
} from '../table-render-preview';

describe('table-render-preview', () => {
  it('replaces pipes and padded cells in rendered overlay text', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const decorations = [
      { startPos: 0, endPos: 1, type: 'tablePipe', replacement: '\u2502' },
      { startPos: 1, endPos: 4, type: 'tableCell', replacement: '\u00A0A\u00A0' },
      { startPos: 4, endPos: 5, type: 'tablePipe', replacement: '\u2502' },
      { startPos: 5, endPos: 8, type: 'tableCell', replacement: '\u00A0B\u00A0' },
      { startPos: 8, endPos: 9, type: 'tablePipe', replacement: '\u2502' },
    ] as const;

    const rendered = applyTableDecorations(md, [...decorations]);
    expect(rendered).toContain('\u2502');
    expect(rendered).not.toContain('| A |');
    expect(assertAlignedPipes(rendered)).toBe(true);
  });

  it('detects aligned rendered pipe columns', () => {
    const aligned = '\u2502 A \u2502 B \u2502\n\u2502---\u2502---\u2502';
    expect(assertAlignedPipes(aligned)).toBe(true);
  });

  it('collects cell style labels for the preview metadata', () => {
    const md = '| [x](https://example.com) | y |\n| --- | --- |\n| z | w |';
    const preview = buildTablePreview(md, [
      {
        startPos: 2,
        endPos: 26,
        type: 'tableCell',
        replacement: '\u00A0x\u00A0',
        cellStyle: { link: true },
      },
    ]);
    expect(preview.styles).toContain('link');
  });

  it('treats only baseline-listed tables as acceptable misalignments', () => {
    const sections = [
      {
        title: 'Known',
        tables: [{ source: '', rendered: '', aligned: false, styles: [] }],
      },
      {
        title: 'Regression',
        tables: [{ source: '', rendered: '', aligned: false, styles: [] }],
      },
    ];
    const report = buildVisualReport(sections, 'docs/tests/05-tables.md', ['Known #1']);
    expect(report.newMisalignments.map((t) => t.label)).toEqual(['Regression #1']);
    expect(report.passed).toBe(false);
  });
});
