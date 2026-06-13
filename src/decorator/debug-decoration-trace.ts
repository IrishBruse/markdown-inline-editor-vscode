/**
 * Temporary decoration pipeline tracing.
 * Logs to the Extension Development Host Debug Console (console.log).
 * Set enabled to false or remove this module when debugging is done.
 */
export const DECORATION_DEBUG = true;

export function dbgDecoration(label: string, data?: Record<string, unknown>): void {
  if (!DECORATION_DEBUG) {
    return;
  }
  if (data === undefined) {
    console.log(`[mdInline] ${label}`);
    return;
  }
  console.log(`[mdInline] ${label}`, data);
}

export function dbgDecorationError(label: string, error: unknown, data?: Record<string, unknown>): void {
  if (!DECORATION_DEBUG) {
    return;
  }
  const err =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
  console.log(`[mdInline] ${label}`, { ...data, error: err });
}
