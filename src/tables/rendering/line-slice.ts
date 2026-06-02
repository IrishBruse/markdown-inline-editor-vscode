import type { TableLayout, TableLineSliceSpec } from './layout-types';
import {
  bodyBandHeaderInsetPx,
  bodySourceLineToSliceSpec,
  renderBodyLineSlice,
  resolveBodyOverlayBandHeight,
} from './body';
import {
  headerSliceAllowsDecorationOverflow,
  headerSourceLineToSliceSpec,
  renderHeaderSeparatorBridge as renderHeaderSeparatorBridgeInner,
  renderHeaderSeparatorBridgeSlice,
  renderMergedHeaderLineSlice,
  resolveHeaderOverlayBandHeight,
} from './header';
import { prepareRowBand } from './shared';

/** Maps a source line index within the table block to a row band slice. */
export function sourceLineToSliceSpec(
  sourceLineIndex: number,
  layout: TableLayout,
): TableLineSliceSpec | null {
  if (sourceLineIndex < 0) {
    return null;
  }

  const headerSlice = headerSourceLineToSliceSpec(sourceLineIndex, layout);
  if (headerSlice) {
    return headerSlice;
  }

  return bodySourceLineToSliceSpec(sourceLineIndex, layout);
}

/** Overlay band height including wrapped content (for decorations). */
export function resolveOverlayBandHeight(
  layout: TableLayout,
  slice: TableLineSliceSpec,
): number {
  const inset = bodyBandHeaderInsetPx(layout, slice.rowLayoutIndex);
  const headerHeight = resolveHeaderOverlayBandHeight(layout, slice, inset);
  if (headerHeight !== null) {
    return headerHeight;
  }
  return resolveBodyOverlayBandHeight(layout, slice);
}

/** Allow overlay painting past the anchor source line (thead into separator, tall rows into following lines). */
export function sliceAllowsDecorationOverflow(
  slice: TableLineSliceSpec,
  bandHeight: number,
  lineHeight: number,
): boolean {
  if (headerSliceAllowsDecorationOverflow(slice)) {
    return true;
  }
  return bandHeight > lineHeight;
}

/**
 * Render one source-line band of the table (for per-line editor overlays).
 */
export function renderTableSvgLineSlice(
  layout: TableLayout,
  sourceLineIndex: number,
): string | null {
  const slice = sourceLineToSliceSpec(sourceLineIndex, layout);
  if (!slice || slice.rowLayoutIndex >= layout.rowLayouts.length) {
    return null;
  }

  if (slice.hideSourceOnly === true) {
    return null;
  }

  if (slice.separatorColumnBridge === true) {
    return renderHeaderSeparatorBridgeSlice(layout, slice);
  }

  const prepared = prepareRowBand(layout, slice.rowLayoutIndex, slice, sourceLineIndex);
  if (!prepared) {
    return null;
  }

  if (slice.mergedHeader === true) {
    return renderMergedHeaderLineSlice(layout, slice, prepared, sourceLineIndex);
  }

  return renderBodyLineSlice(layout, slice, prepared);
}

export function renderHeaderSeparatorBridge(layout: TableLayout): string | null {
  return renderHeaderSeparatorBridgeInner(layout, renderTableSvgLineSlice);
}
