import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DecorationRange } from '../parser/types';
import { measureOverlayWidth, trimLineEnd } from '../parser/tables';

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

const TABLE_DECORATION_TYPES = new Set([
  'tablePipe',
  'tableSeparatorPipe',
  'tableSeparatorDash',
  'tableCell',
  'tableCellImage',
]);

export interface TablePreview {
  source: string;
  rendered: string;
  aligned: boolean;
  styles: string[];
}

export interface SectionPreview {
  title: string;
  tables: TablePreview[];
}

export function isTableDecoration(type: string): boolean {
  return TABLE_DECORATION_TYPES.has(type);
}

export function applyTableDecorations(md: string, decorations: DecorationRange[]): string {
  const tableDecs = decorations
    .filter((d) => isTableDecoration(d.type) && d.replacement !== undefined)
    .sort((a, b) => a.startPos - b.startPos || b.endPos - a.endPos);

  let out = '';
  for (let i = 0; i < md.length; i++) {
    const dec = tableDecs.find((d) => d.startPos === i);
    if (dec) {
      out += dec.replacement!;
      i = dec.endPos - 1;
      continue;
    }
    const hidden = tableDecs.some((d) => i >= d.startPos && i < d.endPos);
    if (!hidden) {
      out += md[i];
    }
  }
  return out;
}

export function assertAlignedPipes(rendered: string): boolean {
  const lines = rendered.split('\n').filter((line) => /[|\u2502]/.test(line));
  if (lines.length === 0) {
    return true;
  }
  const columns = lines.map((line) => findRenderedPipeColumns(line));
  const ref = columns[0];
  if (!columns.every((cols) => cols.length === ref.length)) {
    return false;
  }
  return columns.every((cols) => cols.every((v, idx) => v === ref[idx]));
}

function findRenderedPipeColumns(line: string): number[] {
  const trimmedEnd = trimLineEnd(line, 0, line.length);
  const visualAtIndex: number[] = new Array(trimmedEnd).fill(-1);
  let visualPos = 0;
  for (let i = 0; i < trimmedEnd; ) {
    visualAtIndex[i] = visualPos;
    if (line[i] === '|' || line[i] === '\u2502') {
      i++;
      continue;
    }
    const rest = line.slice(i);
    const segment = [...graphemeSegmenter.segment(rest)][0]?.segment;
    if (!segment) {
      break;
    }
    visualPos += measureOverlayWidth(segment);
    for (let j = 0; j < segment.length; j++) {
      if (i + j < visualAtIndex.length) {
        visualAtIndex[i + j] = visualPos;
      }
    }
    i += segment.length;
  }

  const columns: number[] = [];
  for (let i = 0; i < trimmedEnd; i++) {
    if (line[i] === '|' || line[i] === '\u2502') {
      columns.push(visualAtIndex[i]);
    }
  }
  return columns;
}

function tableBlocks(section: string): string[] {
  return section
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith('|'));
}

function cellStyleLabel(dec: DecorationRange): string | undefined {
  if (dec.type === 'tableCellImage') {
    return 'image';
  }
  if (dec.replacement?.includes('\u0336')) {
    return 'strike';
  }
  const style = dec.cellStyle;
  if (!style) {
    return undefined;
  }
  if (style.link) return 'link';
  if (style.inlineCode) return 'code';
  if (style.textDecoration === 'line-through') return 'strike';
  if (style.fontWeight === 'bold' && style.fontStyle === 'italic') return 'bold-italic';
  if (style.fontWeight === 'bold') return 'bold';
  if (style.fontStyle === 'italic') return 'italic';
  return undefined;
}

function collectTableStyles(md: string, decorations: DecorationRange[]): string[] {
  const tableDecs = decorations.filter(
    (d) => (d.type === 'tableCell' || d.type === 'tableCellImage') && d.startPos < md.length,
  );
  const labels = new Set<string>();
  for (const dec of tableDecs) {
    const label = cellStyleLabel(dec);
    if (label) {
      labels.add(label);
    }
  }
  return [...labels].sort();
}

export function buildTablePreview(md: string, decorations: DecorationRange[]): TablePreview {
  const tableDecs = decorations.filter((d) => isTableDecoration(d.type));
  const rendered = applyTableDecorations(md, tableDecs);
  return {
    source: md,
    rendered,
    aligned: assertAlignedPipes(rendered),
    styles: collectTableStyles(md, decorations),
  };
}

function rebaseDecorations(
  decorations: DecorationRange[],
  blockStart: number,
  blockEnd: number,
): DecorationRange[] {
  return decorations
    .filter((d) => d.startPos >= blockStart && d.endPos <= blockEnd)
    .map((d) => ({
      ...d,
      startPos: d.startPos - blockStart,
      endPos: d.endPos - blockStart,
    }));
}

export function extractSections(markdown: string): { title: string; body: string }[] {
  const matches = [...markdown.matchAll(/^## (.+)$/gm)];
  return matches.map((match, index) => {
    const title = match[1];
    const start = match.index ?? 0;
    const next = matches[index + 1]?.index ?? markdown.length;
    return { title, body: markdown.slice(start, next).trim() };
  });
}

export function buildSectionPreviews(
  markdown: string,
  decorations: DecorationRange[],
): SectionPreview[] {
  const sections: SectionPreview[] = [];
  for (const { title, body } of extractSections(markdown)) {
    const tables: TablePreview[] = [];
    for (const block of tableBlocks(body)) {
      const blockStart = markdown.indexOf(block);
      if (blockStart === -1) {
        continue;
      }
      const blockEnd = blockStart + block.length;
      const blockDecs = rebaseDecorations(decorations, blockStart, blockEnd);
      tables.push(buildTablePreview(block, blockDecs));
    }
    if (tables.length > 0) {
      sections.push({ title, tables });
    }
  }
  return sections;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderHtml(sections: SectionPreview[], sourcePath: string): string {
  const totalTables = sections.reduce((sum, section) => sum + section.tables.length, 0);
  const misaligned = sections.flatMap((section) =>
    section.tables
      .filter((table) => !table.aligned)
      .map((table) => ({ section: section.title, table })),
  );

  const summary = misaligned.length === 0
    ? `<p class="ok">${totalTables} tables rendered. All pipe columns align.</p>`
    : `<p class="warn">${totalTables} tables rendered. <strong>${misaligned.length}</strong> misaligned (see red borders below).</p>`;

  const body = sections
    .map((section) => {
      const tables = section.tables
        .map((table, index) => {
          const status = table.aligned
            ? '<span class="ok">aligned</span>'
            : '<span class="warn">misaligned</span>';
          const styles = table.styles.length > 0
            ? `<p class="meta">Cell styles: ${table.styles.join(', ')}</p>`
            : '';
          return `
<section class="table-card ${table.aligned ? 'ok' : 'bad'}" id="${slug(section.title)}-${index + 1}">
  <h3>${escapeHtml(section.title)} <span class="table-index">#${index + 1}</span> ${status}</h3>
  ${styles}
  <div class="grid">
    <div>
      <h4>Source</h4>
      <pre>${escapeHtml(table.source)}</pre>
    </div>
    <div>
      <h4>Rendered overlay</h4>
      <pre class="rendered">${escapeHtml(table.rendered)}</pre>
    </div>
  </div>
</section>`;
        })
        .join('\n');
      return `
<section class="fixture-section">
  <h2>${escapeHtml(section.title)}</h2>
  ${tables}
</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>05-tables visual preview</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1e1e1e;
      --panel: #252526;
      --border: #3c3c3c;
      --text: #d4d4d4;
      --muted: #9da5b4;
      --ok: #89d185;
      --warn: #f48771;
      --link: #3794ff;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font: 14px/1.5 var(--mono);
      background: var(--bg);
      color: var(--text);
    }
    h1, h2, h3, h4 { font-family: system-ui, sans-serif; font-weight: 600; }
    h1 { margin-top: 0; }
    .meta, .lede { color: var(--muted); font-family: system-ui, sans-serif; }
    .ok { color: var(--ok); }
    .warn { color: var(--warn); }
    .fixture-section { margin: 32px 0; }
    .table-card {
      margin: 16px 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
    }
    .table-card.bad { border-color: var(--warn); }
    .table-index { color: var(--muted); font-weight: 400; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 960px) {
      .grid { grid-template-columns: 1fr; }
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #111;
      white-space: pre;
      font: 13px/1.45 var(--mono);
    }
    pre.rendered { color: #e6e6e6; }
    a { color: var(--link); }
  </style>
</head>
<body>
  <h1>05-tables visual preview</h1>
  <p class="lede">Source: <code>${escapeHtml(sourcePath)}</code>. Rendered column simulates VS Code <code>before.contentText</code> table overlays (pipes as <code>│</code>, padded cells, hidden source spans).</p>
  ${summary}
  ${body}
</body>
</html>`;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function tableLabel(sectionTitle: string, index: number): string {
  return `${sectionTitle} #${index + 1}`;
}

export interface TablesVisualReport {
  sourcePath: string;
  totalTables: number;
  misaligned: number;
  misalignedTables: { section: string; index: number; label: string }[];
  newMisalignments: { section: string; index: number; label: string }[];
  passed: boolean;
}

export function compareToBaseline(
  misalignedTables: { section: string; index: number }[],
  knownMisaligned: string[],
): { section: string; index: number; label: string }[] {
  const known = new Set(knownMisaligned);
  return misalignedTables
    .map((table) => ({ ...table, label: tableLabel(table.section, table.index) }))
    .filter((table) => !known.has(table.label));
}

export function loadVisualBaseline(path = resolve('src/visual/table-visual-baseline.json')): string[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { knownMisaligned?: string[] };
  return raw.knownMisaligned ?? [];
}

export function buildVisualReport(
  sections: SectionPreview[],
  sourcePath: string,
  knownMisaligned: string[],
): TablesVisualReport {
  const misalignedTables = sections.flatMap((section) =>
    section.tables
      .map((table, index) => ({ section: section.title, index, table }))
      .filter(({ table }) => !table.aligned)
      .map(({ section, index }) => ({ section, index })),
  );
  const newMisalignments = compareToBaseline(misalignedTables, knownMisaligned);
  const totalTables = sections.reduce((sum, section) => sum + section.tables.length, 0);
  return {
    sourcePath,
    totalTables,
    misaligned: misalignedTables.length,
    misalignedTables: misalignedTables.map((table) => ({
      ...table,
      label: tableLabel(table.section, table.index),
    })),
    newMisalignments,
    passed: newMisalignments.length === 0,
  };
}

export function writeTablesVisualReport(options: {
  markdown: string;
  decorations: DecorationRange[];
  sourcePath: string;
  htmlPath: string;
  textPath?: string;
  jsonPath?: string;
  baselinePath?: string;
}): TablesVisualReport & { sections: SectionPreview[] } {
  const sections = buildSectionPreviews(options.markdown, options.decorations);
  const html = renderHtml(sections, options.sourcePath);
  mkdirSync(dirname(options.htmlPath), { recursive: true });
  writeFileSync(options.htmlPath, html, 'utf8');

  if (options.textPath) {
    const text = sections
      .map((section) => {
        const tables = section.tables
          .map((table, index) => {
            const flag = table.aligned ? 'OK' : 'MISALIGNED';
            return `### ${tableLabel(section.title, index)} [${flag}]\n\nSOURCE:\n${table.source}\n\nRENDERED:\n${table.rendered}\n`;
          })
          .join('\n');
        return `## ${section.title}\n\n${tables}`;
      })
      .join('\n');
    writeFileSync(options.textPath, text, 'utf8');
  }

  const knownMisaligned = loadVisualBaseline(options.baselinePath);
  const report = buildVisualReport(sections, options.sourcePath, knownMisaligned);

  if (options.jsonPath) {
    writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  return { sections, ...report };
}

export const DEFAULT_TABLES_FIXTURE = 'docs/tests/05-tables.md';

export function defaultVisualOutputPaths(root = process.cwd()): {
  htmlPath: string;
  textPath: string;
  jsonPath: string;
} {
  return {
    htmlPath: resolve(root, 'dist/visual/05-tables.html'),
    textPath: resolve(root, 'dist/visual/05-tables.txt'),
    jsonPath: resolve(root, 'dist/visual/report.json'),
  };
}
