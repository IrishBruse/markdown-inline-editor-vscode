export interface DecorationRange {
  startPos: number;
  endPos: number;
  type: DecorationType;
  url?: string;
  level?: number;
  emoji?: string;
  replacement?: string;
  /** `tablePipe` only: NBSP prefix before the pipe glyph (native cell trailing pad). */
  replacementPrefix?: string;
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    /**
     * When true, tableCell `before` uses `textPreformat.*` so whole-cell inline code
     * matches normal markdown code styling instead of `editor.foreground`.
     */
    useTextPreformatColors?: boolean;
  };
  /** `tableCell` only: `before` width in `ch` for monospace column alignment. */
  tableCellWidthCh?: number;
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

export interface ParseResult {
  decorations: DecorationRange[];
  scopes: ScopeRange[];
  mermaidBlocks: MermaidBlock[];
  mathRegions: MathRegion[];
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
  | "tableCellNativePad"
  | "mention"
  | "issueReference";
