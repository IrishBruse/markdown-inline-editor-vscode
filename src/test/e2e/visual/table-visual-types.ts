export type TableVisualMode = 'rendered' | 'raw';

export type TableVisualScenario = {
  id: string;
  mode: TableVisualMode;
  cursor: { line: number; character: number };
  /** Final PNG width in pixels (clip from editor top-left). */
  captureWidth: number;
  /** Final PNG height in pixels (clip from editor top-left). */
  captureHeight: number;
};
