import type { PreparedRowBand, TableLayout, TableLayoutMetrics, TableLineSliceSpec } from './layout-types';
import { appendBandBorderLines, appendWrappedCellText, BORDER_WIDTH, renderSvgFromParts } from './svg';

/** GFM header row plus `|---|---|` separator line rendered as one thead band. */
export const HEADER_SOURCE_LINES = 2;

/** Source-line index of the GFM header title row. */
const TITLE_LINE_INDEX = 0;

/** Source-line index of the GFM `|---|---|` separator row. */
const SEPARATOR_LINE_INDEX = 1;

/** Pixel height budget for merged header overlays (title row plus separator bridge). */
export function mergedHeaderBandBudgetPx(metrics: Pick<TableLayoutMetrics, 'lineHeight'>): number {
  return HEADER_SOURCE_LINES * metrics.lineHeight;
}

/** Overlay band height for the merged header title line (spans title + separator source lines). */
export function mergedHeaderOverlayBandPx(layout: Pick<TableLayout, 'metrics'>): number {
  return mergedHeaderBandBudgetPx(layout.metrics);
}

/** Pixel height of the thead band used when capping header wrap lines. */
export function headerBandHeightPx(metrics: Pick<TableLayoutMetrics, 'lineHeight'>): number {
  return mergedHeaderBandBudgetPx(metrics);
}

/** Per-source-line overlay height for thead title and separator bands. */
export function theadSourceLineBandPx(metrics: Pick<TableLayoutMetrics, 'lineHeight'>): number {
  return metrics.lineHeight;
}

/** Map title or separator source lines to header slice specs; returns null for data lines. */
export function headerSourceLineToSliceSpec(
  sourceLineIndex: number,
  layout: TableLayout,
): TableLineSliceSpec | null {
  const lineBand = theadSourceLineBandPx(layout.metrics);

  const headerSliceBase = {
    rowLayoutIndex: 0,
    subLine: 0,
    subLineCount: 1,
    sliceHeight: lineBand,
  } satisfies Partial<TableLineSliceSpec>;

  if (sourceLineIndex === TITLE_LINE_INDEX) {
    return {
      ...headerSliceBase,
      mergedHeader: true,
      useFullLineOverlay: true,
      bandBorders: { top: true, bottom: false },
    };
  }

  if (sourceLineIndex === SEPARATOR_LINE_INDEX) {
    return {
      ...headerSliceBase,
      separatorColumnBridge: true,
      useFullLineOverlay: true,
      bandBorders: { top: false, bottom: true },
    };
  }

  return null;
}

/** Row layout index for a data-row source line (after title + separator). */
export function dataRowLayoutIndexForSourceLine(sourceLineIndex: number): number {
  return sourceLineIndex - HEADER_SOURCE_LINES + 1;
}

/** Top-align merged-header labels in the two-line thead band. */
export function mergedHeaderLabelBaselineY(
  fontSize: number,
  cellPadY: number,
): number {
  return cellPadY + fontSize * 0.85;
}

/** Overlay band height for merged-header or separator-bridge slices. */
export function resolveHeaderOverlayBandHeight(
  layout: TableLayout,
  slice: TableLineSliceSpec,
  bodyTopInset: number,
): number | null {
  if (slice.separatorColumnBridge === true || slice.mergedHeader === true) {
    return theadSourceLineBandPx(layout.metrics) + bodyTopInset;
  }
  return null;
}

/** Background fill rect for a single-line thead overlay (fill bleeds to line edges; borders drawn separately). */
export function mergedHeaderFillRect(
  totalBandHeight: number,
  tableWidth: number,
  edges: { top: boolean; bottom: boolean },
): { x: number; y: number; width: number; height: number } {
  void edges.top;
  const x = BORDER_WIDTH;
  const bottomInset = edges.bottom ? BORDER_WIDTH : 0;
  return {
    x,
    y: 0,
    width: tableWidth - BORDER_WIDTH * 2,
    height: totalBandHeight - bottomInset,
  };
}

/** Background fill rect for the GFM separator bridge source line. */
export function separatorBridgeFillRect(
  bandHeight: number,
  tableWidth: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: BORDER_WIDTH,
    y: 0,
    width: tableWidth - BORDER_WIDTH * 2,
    height: bandHeight,
  };
}

/** Band budget and max visible wrap lines when preparing a merged header row band. */
export function mergedHeaderPrepareConstraints(
  layout: TableLayout,
  maxWrapLinesForBandHeight: (bandHeight: number, metrics: TableLayoutMetrics) => number,
  rowMaxWrapLines: number,
): { bandBudget: number; maxShow: number } {
  const bandBudget = theadSourceLineBandPx(layout.metrics);
  const fitsInBand = maxWrapLinesForBandHeight(bandBudget, layout.metrics);

  // Allow up to two wrap lines when the header content actually wraps.
  const maxShow = rowMaxWrapLines > 1
    ? Math.max(fitsInBand, Math.min(2, rowMaxWrapLines))
    : fitsInBand;

  return { bandBudget, maxShow };
}

/** Fill color for a per-line overlay band (header title or separator bridge). */
export function overlayBandFillForSlice(
  slice: TableLineSliceSpec,
  isHeaderRow: boolean,
  headerBackground: string,
  bodyBackground: string,
): string {
  const usesHeaderFill = slice.mergedHeader === true
    || slice.separatorColumnBridge === true
    || isHeaderRow;
  return usesHeaderFill ? headerBackground : bodyBackground;
}

/** Per-line thead overlays are clipped to the source line height (no cross-line overflow). */
export function headerSliceAllowsDecorationOverflow(_slice: TableLineSliceSpec): boolean {
  return false;
}

/** Render column rules on the GFM separator source line (bridges header to body). */
export function renderHeaderSeparatorBridge(
  layout: TableLayout,
  renderLineSlice: (layout: TableLayout, sourceLineIndex: number) => string | null,
): string | null {
  const slice = headerSourceLineToSliceSpec(SEPARATOR_LINE_INDEX, layout);
  if (!slice?.separatorColumnBridge) {
    return null;
  }
  return renderLineSlice(layout, SEPARATOR_LINE_INDEX);
}

/** Render the GFM separator bridge overlay (column rules only). */
export function renderHeaderSeparatorBridgeSlice(
  layout: TableLayout,
  slice: TableLineSliceSpec,
): string {
  const bandHeight = layout.metrics.lineHeight;
  const rowLayout = layout.rowLayouts[slice.rowLayoutIndex];
  const bandFill = overlayBandFillForSlice(
    slice,
    rowLayout?.isHeader === true,
    layout.metrics.colors.headerBackground,
    layout.metrics.colors.background,
  );
  const { x: fillX, y: fillY, width: fillW, height: fillH } = separatorBridgeFillRect(
    bandHeight,
    layout.totalWidth,
  );
  const parts: string[] = [
    `<rect x="${fillX}" y="${fillY}" width="${fillW}" height="${fillH}" fill="${bandFill}"/>`,
  ];
  const bridgeEdges = slice.bandBorders ?? { top: false, bottom: true };
  appendBandBorderLines(parts, layout, 0, bandHeight, bridgeEdges);
  return renderSvgFromParts(parts, layout.totalWidth, bandHeight);
}

function renderHeaderRowBand(
  parts: string[],
  layout: TableLayout,
  slice: TableLineSliceSpec,
  prepared: PreparedRowBand,
  overlayBandHeight: number,
): void {
  const rowLayout = layout.rowLayouts[slice.rowLayoutIndex];
  if (!rowLayout) {
    return;
  }

  const { colWidths, block, metrics } = layout;
  const { fontSize, charWidth, cellPadX, cellPadY, fontFamily, colors } = metrics;
  const { text: textColor } = colors;
  const { cellLines, lineStep } = prepared;
  const edges = slice.bandBorders ?? { top: false, bottom: true };

  let x = BORDER_WIDTH;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const colWidth = colWidths[colIdx];
    const align = colIdx < block.align.length ? block.align[colIdx] : null;
    const lines = cellLines[colIdx] ?? [''];
    const cellFirstY = mergedHeaderLabelBaselineY(fontSize, cellPadY);

    appendWrappedCellText(
      parts,
      lines,
      align,
      x,
      colWidth,
      cellFirstY,
      lineStep,
      textColor,
      fontFamily,
      fontSize,
      charWidth,
      cellPadX,
    );

    x += colWidth;
  }

  appendBandBorderLines(parts, layout, 0, overlayBandHeight, edges);
}

/** Render the merged header title overlay (spans title + separator source lines). */
export function renderMergedHeaderLineSlice(
  layout: TableLayout,
  slice: TableLineSliceSpec,
  prepared: PreparedRowBand,
  sourceLineIndex: number,
): string {
  const bandHeight = layout.metrics.lineHeight;
  const rowLayout = layout.rowLayouts[slice.rowLayoutIndex];
  const bandFill = overlayBandFillForSlice(
    slice,
    rowLayout?.isHeader === true,
    layout.metrics.colors.headerBackground,
    layout.metrics.colors.background,
  );
  const edges = slice.bandBorders ?? { top: false, bottom: true };
  const fillFrame = mergedHeaderFillRect(bandHeight, layout.totalWidth, edges);
  const { x: fillX, y: fillY, width: fillW, height: fillH } = fillFrame;
  const parts: string[] = ['<g>'];
  parts.push(`<rect x="${fillX}" y="${fillY}" width="${fillW}" height="${fillH}" fill="${bandFill}"/>`);
  renderHeaderRowBand(parts, layout, slice, prepared, bandHeight);
  parts.push('</g>');
  void sourceLineIndex;
  return renderSvgFromParts(parts, layout.totalWidth, bandHeight);
}
