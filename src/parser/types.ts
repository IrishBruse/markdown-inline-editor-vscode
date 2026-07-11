export interface DecorationRange {
  startPos: number;
  endPos: number;
  type: DecorationType;
  url?: string;
  level?: number;
  emoji?: string;
  replacement?: string;
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
  slug?: string;
  issueNumber?: number;
  ownerRepo?: string;
  orderedListMarkerMismatch?: boolean;
}

export interface ScopeRange {
  startPos: number;
  endPos: number;
  kind?: string;
}

export interface MermaidBlock {
  startPos: number;
  endPos: number;
  source: string;
  numLines: number;
}

export interface MathRegion {
  startPos: number;
  endPos: number;
  source: string;
  displayMode: boolean;
  numLines?: number;
}

export type TableCellStyle = {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
};

export interface TableBlockCell {
  displayText: string;
  cellStyle?: TableCellStyle;
  showRaw?: boolean;
}

export interface TableBlockRow {
  cells: TableBlockCell[];
}

export interface TableBlock {
  startPos: number;
  endPos: number;
  headers: string[];
  rows: TableBlockRow[];
  colWidths: number[];
  colAligns: (null | 'left' | 'center' | 'right')[];
  rowRanges: { startPos: number; endPos: number }[];
}

export interface ParseResult {
  decorations: DecorationRange[];
  scopes: ScopeRange[];
  mermaidBlocks: MermaidBlock[];
  mathRegions: MathRegion[];
  tableBlocks: TableBlock[];
}

export type DecorationType =
  | "hide"
  | "transparent"
  | "selectionOverlay"
  | "ghostFaint"
  | "emoji"
  | "bold"
  | "italic"
  | "boldItalic"
  | "strikethrough"
  | "code"
  | "codeBlock"
  | "codeBlockLanguage"
  | "heading"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "link"
  | "image"
  | "blockquote"
  | "listItem"
  | "orderedListItem"
  | "checkboxUnchecked"
  | "checkboxChecked"
  | "horizontalRule"
  | "frontmatter"
  | "frontmatterDelimiter"
  | "tablePipe"
  | "tableSeparatorPipe"
  | "tableSeparatorDash"
  | "tableCell"
  | "tableResponsiveRow"
  | "mention"
  | "issueReference";
