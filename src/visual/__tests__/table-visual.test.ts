import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import baseline from '../table-visual-baseline.json';
import {
  type PipeMisalignment,
  type TablesOverlayResult,
  renderTablesOverlay,
} from '../table-fixture-renderer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fixturePath = path.join(repoRoot, 'docs/tests/05-tables.md');
const longCellFixturePath = path.join(
  repoRoot,
  'docs/tests/long-cell-wrapping.md',
);
const outputDir = path.join(repoRoot, 'dist/visual');
const VIEWPORTS = [80, 200] as const;

interface KnownIssue {
  tableIndex: number;
  line: number;
  pipeIndex: number;
  viewport?: number;
}

interface VisualReport {
  passed: boolean;
  fixture: string;
  viewports: Record<
    string,
    {
      tables: number;
      compactTables: number;
      responsiveTables: number;
      misalignments: PipeMisalignment[];
      newMisalignments: PipeMisalignment[];
    }
  >;
  knownIssues: KnownIssue[];
}

function misalignmentKey(issue: PipeMisalignment, viewport: number): string {
  return `${viewport}:${issue.tableIndex}:${issue.line}:${issue.pipeIndex}`;
}

function isKnownIssue(
  issue: PipeMisalignment,
  viewport: number,
  knownIssues: KnownIssue[],
): boolean {
  return knownIssues.some((known) => {
    if (known.tableIndex !== issue.tableIndex) {
      return false;
    }
    if (known.line !== issue.line) {
      return false;
    }
    if (known.pipeIndex !== issue.pipeIndex) {
      return false;
    }
    if (known.viewport !== undefined && known.viewport !== viewport) {
      return false;
    }
    return true;
  });
}

function formatViewportBlock(
  viewport: number,
  source: string,
  result: TablesOverlayResult,
): string {
  const lines = [
    `=== viewport ${viewport} columns ===`,
    '',
    '--- source ---',
    source,
    '',
    '--- overlay ---',
    result.overlayText,
    '',
    `tables: ${result.sections.length}`,
    `compact: ${result.compactSections.length}`,
    `responsive: ${result.responsiveSections.length}`,
    `misalignments: ${result.misalignments.length}`,
    '',
  ];
  return lines.join('\n');
}

function buildHtmlReport(
  source: string,
  results: Record<number, TablesOverlayResult>,
): string {
  const sections = VIEWPORTS.map((viewport) => {
    const result = results[viewport];
    return [
      `<section>`,
      `<h2>Viewport ${viewport} columns</h2>`,
      `<p>Tables: ${result.sections.length}, compact: ${result.compactSections.length}, responsive: ${result.responsiveSections.length}, misalignments: ${result.misalignments.length}</p>`,
      `<h3>Source</h3>`,
      `<pre>${escapeHtml(source)}</pre>`,
      `<h3>Overlay</h3>`,
      `<pre>${escapeHtml(result.overlayText)}</pre>`,
      `</section>`,
    ].join('\n');
  }).join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>05-tables visual overlay</title>',
    '<style>body{font-family:monospace;max-width:120ch;margin:2rem auto}pre{white-space:pre-wrap;border:1px solid #ccc;padding:1rem}</style>',
    '</head>',
    '<body>',
    '<h1>05-tables visual overlay</h1>',
    sections,
    '</body>',
    '</html>',
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

describe('table visual fixture', () => {
  const source = fs.readFileSync(fixturePath, 'utf8');
  const results = new Map<number, TablesOverlayResult>();

  beforeAll(async () => {
    for (const viewport of VIEWPORTS) {
      results.set(viewport, await renderTablesOverlay(source, viewport));
    }
  });

  it('renders compact grids without unexpected pipe misalignments', () => {
    const knownIssues = baseline.knownIssues as KnownIssue[];
    const report: VisualReport = {
      passed: true,
      fixture: path.relative(repoRoot, fixturePath),
      viewports: {},
      knownIssues,
    };

    for (const viewport of VIEWPORTS) {
      const result = results.get(viewport)!;
      const newMisalignments = result.misalignments.filter(
        (issue) => !isKnownIssue(issue, viewport, knownIssues),
      );

      report.viewports[String(viewport)] = {
        tables: result.sections.length,
        compactTables: result.compactSections.length,
        responsiveTables: result.responsiveSections.length,
        misalignments: result.misalignments,
        newMisalignments,
      };

      if (newMisalignments.length > 0) {
        report.passed = false;
      }

      expect(
        newMisalignments,
        `viewport ${viewport}: ${JSON.stringify(newMisalignments, null, 2)}`,
      ).toEqual([]);
    }

    if (process.env.VISUAL_TABLES_WRITE === '1') {
      fs.mkdirSync(outputDir, { recursive: true });

      const txt = VIEWPORTS.map((viewport) =>
        formatViewportBlock(viewport, source, results.get(viewport)!),
      ).join('\n');
      fs.writeFileSync(path.join(outputDir, '05-tables.txt'), txt, 'utf8');
      fs.writeFileSync(
        path.join(outputDir, '05-tables.html'),
        buildHtmlReport(
          source,
          Object.fromEntries(results.entries()) as Record<number, TablesOverlayResult>,
        ),
        'utf8',
      );
      fs.writeFileSync(
        path.join(outputDir, 'report.json'),
        JSON.stringify(report, null, 2) + '\n',
        'utf8',
      );
    }
  });

  it('uses responsive layout for the long-cell table at viewport 80', async () => {
    const longCellSource = fs.readFileSync(longCellFixturePath, 'utf8');
    const result = await renderTablesOverlay(longCellSource, 80);
    const longCellSection = result.sections.find((section) =>
      section.sourceLines.some((line) => line.includes('Section Header')),
    );

    expect(longCellSection).toBeDefined();
    expect(longCellSection!.mode).toBe('responsive');
    const overlay = longCellSection!.overlayLines.join('\n');
    expect(overlay).toContain('Section Header');
    expect(overlay).toContain('Detailed Placeholder Content');
  });

  it('keeps the long-cell table responsive at viewport 200', async () => {
    const longCellSource = fs.readFileSync(longCellFixturePath, 'utf8');
    const result = await renderTablesOverlay(longCellSource, 200);
    const longCellSection = result.sections.find((section) =>
      section.sourceLines.some((line) => line.includes('Section Header')),
    );

    expect(longCellSection).toBeDefined();
    expect(longCellSection!.mode).toBe('responsive');
  });

  it('renders the three-column wide grid with aligned pipes at viewport 200', () => {
    const result = results.get(200)!;
    const wideGrid = result.sections.find((section) =>
      section.sourceLines.some((line) => line.includes('ColA')),
    );

    expect(wideGrid).toBeDefined();
    expect(wideGrid!.mode).toBe('compact');
    expect(wideGrid!.overlayLines.some((line) => line.includes('ColA'))).toBe(true);

    const sectionMisalignments = result.misalignments.filter(
      (issue) => issue.tableIndex === wideGrid!.tableIndex,
    );
    expect(sectionMisalignments).toEqual([]);
  });
});
