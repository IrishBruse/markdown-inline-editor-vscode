/**
 * Options for rendering Mermaid diagrams
 */
export type MermaidRenderOptions = {
  theme: 'default' | 'dark';
  fontFamily?: string;
  height?: number; // Height in pixels based on line count
  numLines?: number; // Number of lines in the code block
};

/**
 * Pending render request tracking
 */
export type PendingRender = {
  resolve: (svg: string) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  kind: 'mermaid' | 'table';
};

/**
 * Message sent to webview for rendering
 */
export type RenderRequest = {
  source: string;
  darkMode: boolean;
  fontFamily?: string;
  requestId: string;
};

export type TableRenderRequest = {
  type: 'table';
  html: string;
  width: number;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  foreground: string;
  border: string;
  headerBackground: string;
  cellBackground: string;
  requestId: string;
};

/**
 * Message received from webview
 */
export type RenderResponse = {
  svg?: string;
  error?: string;
  requestId?: string;
  ready?: boolean;
};
