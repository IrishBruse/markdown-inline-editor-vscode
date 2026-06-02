import type { TableBlock } from '../../parser';
import type { TableColors } from '../table-colors';

export type TableLayoutMetrics = {
  lineHeight: number;
  fontSize: number;
  charWidth: number;
  cellPadX: number;
  cellPadY: number;
  minColWidth: number;
  fontFamily: string;
  colors: TableColors;
};

export type TableRowLayout = {
  isHeader: boolean;
  row: string[];
  sourceWeight: number;
  maxWrapLines: number;
  wrappedCells: string[][];
};

export type TableLayout = {
  block: TableBlock;
  metrics: TableLayoutMetrics;
  colWidths: number[];
  rowLayouts: TableRowLayout[];
  rowHeights: number[];
  totalWidth: number;
  totalHeight: number;
  capToSourceLines: boolean;
  /** Document line of the table's first GFM row (0-based); used for debug logging. */
  tableStartLine?: number;
};

export type TableLineSliceSpec = {
  rowLayoutIndex: number;
  subLine: number;
  subLineCount: number;
  sliceHeight: number;
  /** Title row: one overlay spans header + separator source lines (no split borders). */
  mergedHeader?: boolean;
  /** Separator source line: header-colored band hiding `|---|---|`. */
  headerBridge?: boolean;
  /** Separator source line: column rules only (bridges header to body). */
  separatorColumnBridge?: boolean;
  /** Anchor the SVG overlay on the full source line (separator bridge). */
  useFullLineOverlay?: boolean;
  /** Source line is hidden but does not receive an SVG overlay. */
  hideSourceOnly?: boolean;
  /** Which horizontal edges to stroke on this band (per-line overlays only). */
  bandBorders?: { top: boolean; bottom: boolean };
};

export type PreparedRowBand = {
  cellLines: string[][];
  visibleWrapLines: number;
  rowHeight: number;
  lineStep: number;
};
