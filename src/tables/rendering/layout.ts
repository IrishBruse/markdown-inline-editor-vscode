import type { TableBlock } from '../../parser';
import type { TableLayout, TableLayoutMetrics, TableRowLayout } from './layout-types';
import { HEADER_SOURCE_LINES, headerBandHeightPx } from './header';
import { BORDER_WIDTH } from './svg';
import {
  computeColumnWidths,
  maxWrapLinesForBandHeight,
  resolveTableMetrics,
  wrappedLineStep,
  wrapRowCells,
  type TableRenderOptions,
} from './shared';

function buildRowLayouts(
  block: TableBlock,
  colWidths: number[],
  metrics: TableLayoutMetrics,
  capToSourceLines: boolean,
): TableRowLayout[] {
  const { charWidth, cellPadX, lineHeight } = metrics;

  const headerBandHeight = headerBandHeightPx(metrics);
  const headerMaxWrap = capToSourceLines
    ? maxWrapLinesForBandHeight(headerBandHeight, metrics)
    : undefined;
  const headerWrap = wrapRowCells(block.header, colWidths, charWidth, cellPadX, headerMaxWrap);
  const layouts: TableRowLayout[] = [{
    isHeader: true,
    row: block.header,
    sourceWeight: HEADER_SOURCE_LINES,
    maxWrapLines: headerWrap.maxWrapLines,
    wrappedCells: headerWrap.wrappedCells,
  }];

  for (const row of block.rows) {
    const rowMaxWrap = capToSourceLines
      ? maxWrapLinesForBandHeight(lineHeight, metrics)
      : undefined;
    const wrap = wrapRowCells(row, colWidths, charWidth, cellPadX, rowMaxWrap);
    layouts.push({
      isHeader: false,
      row,
      sourceWeight: 1,
      maxWrapLines: wrap.maxWrapLines,
      wrappedCells: wrap.wrappedCells,
    });
  }

  return layouts;
}

function computeRowHeight(
  layout: TableRowLayout,
  metrics: TableLayoutMetrics,
  capToSourceLines: boolean,
): number {
  const { lineHeight, fontSize, cellPadY } = metrics;
  const minHeight = layout.sourceWeight * lineHeight;
  if (capToSourceLines) {
    return minHeight;
  }
  if (layout.maxWrapLines <= 1) {
    return minHeight;
  }

  const lineStep = wrappedLineStep(lineHeight, fontSize);
  const textBlockHeight = fontSize + (layout.maxWrapLines - 1) * lineStep;
  const contentHeight = cellPadY * 2 + textBlockHeight;
  return Math.max(minHeight, Math.ceil(contentHeight));
}

/**
 * Build column widths, wrapped cells, and row heights for a table block.
 */
export function buildTableLayout(block: TableBlock, options: TableRenderOptions): TableLayout {
  const capToSourceLines = options.capToSourceLines ?? false;
  const metrics = resolveTableMetrics(options);
  const colWidths = computeColumnWidths(
    block,
    metrics.charWidth,
    metrics.cellPadX,
    metrics.minColWidth,
  );
  const rowLayouts = buildRowLayouts(block, colWidths, metrics, capToSourceLines);
  const rowHeights = rowLayouts.map((layout) =>
    computeRowHeight(layout, metrics, capToSourceLines),
  );
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + BORDER_WIDTH * 2;
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  return {
    block,
    metrics,
    colWidths,
    rowLayouts,
    rowHeights,
    totalWidth,
    totalHeight,
    capToSourceLines,
    tableStartLine: options.tableStartLine,
  };
}
