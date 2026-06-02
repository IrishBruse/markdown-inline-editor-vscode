import type { TableBlock } from '../../parser';
import type { PreparedRowBand, TableLayout, TableLineSliceSpec } from './layout-types';
import { dataRowLayoutIndexForSourceLine, overlayBandFillForSlice } from './header';
import {
  appendBandBorderLines,
  appendWrappedCellText,
  bandInnerFrame,
  BORDER_WIDTH,
  renderSvgFromParts,
} from './svg';
import {
  computeBandHeightForSlice,
  firstLineBaselineY,
  prepareRowBand,
  sourceLineIndexForSlice,
  wrappedLineStep,
  type TableRenderOptions,
} from './shared';
import { buildTableLayout } from './layout';

export const FIRST_DATA_ROW_LAYOUT_INDEX = 1;

/** Overlay band height for a data row without header-bridge inset (avoids recursion). */
function dataRowOverlayBandHeight(layout: TableLayout, rowLayoutIndex: number): number {
  const { lineHeight } = layout.metrics;
  if (rowLayoutIndex < FIRST_DATA_ROW_LAYOUT_INDEX) {
    return lineHeight;
  }
  const slice: TableLineSliceSpec = {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight: layout.rowHeights[rowLayoutIndex] ?? lineHeight,
    bandBorders: { top: false, bottom: true },
  };
  const prepared = prepareRowBand(
    layout,
    rowLayoutIndex,
    slice,
    sourceLineIndexForSlice(slice),
  );
  return prepared?.rowHeight ?? lineHeight;
}

export function bodyBandHeaderInsetPx(layout: TableLayout, rowLayoutIndex: number): number {
  const { lineHeight } = layout.metrics;

  if (rowLayoutIndex > FIRST_DATA_ROW_LAYOUT_INDEX) {
    const prevHeight = dataRowOverlayBandHeight(layout, rowLayoutIndex - 1);
    if (prevHeight > lineHeight) {
      return prevHeight - lineHeight;
    }
  }

  return 0;
}

/** Maps a data-row source line to a row band slice. */
export function bodySourceLineToSliceSpec(
  sourceLineIndex: number,
  layout: TableLayout,
): TableLineSliceSpec | null {
  const { lineHeight } = layout.metrics;
  const rowLayoutIndex = dataRowLayoutIndexForSourceLine(sourceLineIndex);
  if (rowLayoutIndex >= layout.rowLayouts.length) {
    return null;
  }

  const sliceHeight = layout.rowHeights[rowLayoutIndex] ?? lineHeight;
  const needsTopBorder = rowLayoutIndex > 1
    && rowOverlayExceedsSourceLine(layout, rowLayoutIndex - 1);
  return {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight,
    bandBorders: { top: needsTopBorder, bottom: true },
  };
}

/** True when a row's per-line overlay band is taller than one editor line. */
export function rowOverlayExceedsSourceLine(
  layout: TableLayout,
  rowLayoutIndex: number,
): boolean {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return false;
  }
  const { lineHeight } = layout.metrics;
  const slice: TableLineSliceSpec = {
    rowLayoutIndex,
    subLine: 0,
    subLineCount: 1,
    sliceHeight: layout.rowHeights[rowLayoutIndex] ?? lineHeight,
  };
  return resolveBodyOverlayBandHeight(layout, slice) > lineHeight;
}

/** Overlay band height for body rows (for decorations). */
export function resolveBodyOverlayBandHeight(
  layout: TableLayout,
  slice: TableLineSliceSpec,
): number {
  if (slice.hideSourceOnly === true) {
    return computeBandHeightForSlice(layout, slice);
  }
  const prepared = prepareRowBand(layout, slice.rowLayoutIndex, slice, sourceLineIndexForSlice(slice));
  if (!prepared) {
    return computeBandHeightForSlice(layout, slice);
  }
  const inset = bodyBandHeaderInsetPx(layout, slice.rowLayoutIndex);
  return prepared.rowHeight + inset;
}

function shouldVerticallyCenterCellInBand(
  lineCount: number,
  bandWrapLines: number,
  rowLayoutIndex: number,
): boolean {
  if (rowLayoutIndex === FIRST_DATA_ROW_LAYOUT_INDEX) {
    return false;
  }
  return lineCount < bandWrapLines;
}

function renderBodyRowBand(
  parts: string[],
  layout: TableLayout,
  rowLayoutIndex: number,
  slice: TableLineSliceSpec,
  prepared: PreparedRowBand,
  bandTop: number,
): void {
  const rowLayout = layout.rowLayouts[rowLayoutIndex];
  if (!rowLayout) {
    return;
  }

  const { colWidths, block, metrics } = layout;
  const { fontSize, charWidth, cellPadX, cellPadY, fontFamily, colors } = metrics;
  const { text: textColor } = colors;
  const { cellLines, visibleWrapLines, rowHeight, lineStep } = prepared;
  const edges = slice.bandBorders ?? { top: false, bottom: true };

  let x = BORDER_WIDTH;
  for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
    const colWidth = colWidths[colIdx];
    const align = colIdx < block.align.length ? block.align[colIdx] : null;
    const lines = cellLines[colIdx] ?? [''];
    const lineCount = lines.length;
    const cellFirstY = firstLineBaselineY(
      bandTop,
      rowHeight,
      fontSize,
      lineCount,
      cellPadY,
      lineStep,
      shouldVerticallyCenterCellInBand(lineCount, visibleWrapLines, rowLayoutIndex),
    );

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

  appendBandBorderLines(parts, layout, bandTop, rowHeight, edges);
}

/** Render a data-row per-line overlay band. */
export function renderBodyLineSlice(
  layout: TableLayout,
  slice: TableLineSliceSpec,
  prepared: PreparedRowBand,
): string {
  const bodyTopInset = bodyBandHeaderInsetPx(layout, slice.rowLayoutIndex);
  const { rowHeight } = prepared;
  const bandHeight = rowHeight + bodyTopInset;
  const rowLayout = layout.rowLayouts[slice.rowLayoutIndex];
  const bandFill = overlayBandFillForSlice(
    slice,
    rowLayout?.isHeader === true,
    layout.metrics.colors.headerBackground,
    layout.metrics.colors.background,
  );
  const edges = slice.bandBorders ?? { top: false, bottom: true };
  const fillFrame = bandInnerFrame(rowHeight, layout.totalWidth, edges);
  const { x: fillX, y: fillY, width: fillW, height: fillH } = fillFrame;
  const parts: string[] = [];
  const w = layout.totalWidth;
  parts.push(
    `<defs><clipPath id="band"><rect width="${w}" height="${bandHeight}"/></clipPath></defs>`,
  );
  parts.push('<g clip-path="url(#band)">');
  parts.push(`<rect x="${fillX}" y="${fillY + bodyTopInset}" width="${fillW}" height="${fillH}" fill="${bandFill}"/>`);
  renderBodyRowBand(parts, layout, slice.rowLayoutIndex, slice, prepared, bodyTopInset);
  parts.push('</g>');
  return renderSvgFromParts(parts, w, bandHeight);
}

/**
 * Render a bordered table as SVG. The header spans the title row and GFM separator row.
 * Long cell text wraps within column bounds; row heights grow with wrapped line count unless capped.
 */
export function renderTableSvg(block: TableBlock, options: TableRenderOptions): string {
  const layout = buildTableLayout(block, options);
  const { background: bg, headerBackground: headerBg, text: textColor } = layout.metrics.colors;
  const { lineHeight, fontSize, charWidth, cellPadX, cellPadY, fontFamily } = layout.metrics;

  const parts: string[] = [];
  parts.push(`<rect width="${layout.totalWidth}" height="${layout.totalHeight}" fill="${bg}"/>`);

  let y = 0;
  for (let rowIdx = 0; rowIdx < layout.rowLayouts.length; rowIdx++) {
    const rowLayout = layout.rowLayouts[rowIdx];
    const rowHeight = layout.rowHeights[rowIdx];
    const lineStep = wrappedLineStep(lineHeight, fontSize);

    const rowFill = rowLayout.isHeader ? headerBg : bg;
    parts.push(
      `<rect x="${BORDER_WIDTH}" y="${y}" width="${layout.totalWidth - BORDER_WIDTH * 2}" height="${rowHeight}" fill="${rowFill}"/>`,
    );

    let x = BORDER_WIDTH;
    for (let colIdx = 0; colIdx < rowLayout.row.length; colIdx++) {
      const colWidth = layout.colWidths[colIdx];
      const align = colIdx < block.align.length ? block.align[colIdx] : null;
      const lines = rowLayout.wrappedCells[colIdx] ?? [''];
      const lineCount = lines.length;
      const verticalCenter = rowLayout.isHeader
        || shouldVerticallyCenterCellInBand(lineCount, rowLayout.maxWrapLines, rowIdx);
      const cellFirstY = firstLineBaselineY(
        y,
        rowHeight,
        fontSize,
        lineCount,
        cellPadY,
        lineStep,
        verticalCenter,
      );

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

    appendBandBorderLines(parts, layout, y, rowHeight, { top: rowIdx === 0, bottom: true });
    y += rowHeight;
  }

  return renderSvgFromParts(parts, layout.totalWidth, layout.totalHeight);
}
