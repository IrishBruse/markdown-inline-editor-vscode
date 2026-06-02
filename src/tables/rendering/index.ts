export type {
  TableLayout,
  TableLayoutMetrics,
  TableLineSliceSpec,
  TableRowLayout,
} from './layout-types';

export {
  HEADER_SOURCE_LINES,
  dataRowLayoutIndexForSourceLine,
  headerBandHeightPx,
  headerSliceAllowsDecorationOverflow,
  headerSourceLineToSliceSpec,
  mergedHeaderBandBudgetPx,
  mergedHeaderFillRect,
  mergedHeaderLabelBaselineY,
  mergedHeaderOverlayBandPx,
  mergedHeaderPrepareConstraints,
  overlayBandFillForSlice,
  resolveHeaderOverlayBandHeight,
  separatorBridgeFillRect,
  theadSourceLineBandPx,
} from './header';

export {
  bodyBandHeaderInsetPx,
  bodySourceLineToSliceSpec,
  renderBodyLineSlice,
  renderTableSvg,
  resolveBodyOverlayBandHeight,
  rowOverlayExceedsSourceLine,
} from './body';

export { buildTableLayout } from './layout';

export {
  renderHeaderSeparatorBridge,
  renderTableSvgLineSlice,
  resolveOverlayBandHeight,
  sliceAllowsDecorationOverflow,
  sourceLineToSliceSpec,
} from './line-slice';

export {
  MAX_BAND_LINES,
  bandContentHeight,
  computeBandHeightForSlice,
  countTableOverlaySourceLines,
  getEditorLineMetrics,
  maxBandHeightPx,
  maxWrapLinesForBandHeight,
  prepareRowBand,
  resolveBandRowHeight,
  sliceHeightForSubLine,
  truncateLinesForBandDisplay,
  wrapText,
  wrappedLineStep,
  type TableRenderOptions,
} from './shared';

export { BORDER_WIDTH, bandInnerFrame } from './svg';
