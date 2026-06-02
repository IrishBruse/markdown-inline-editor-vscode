import { describe, expect, it } from 'vitest';
import {
  countVisualWrapLinesByUnits,
  estimateViewportCharsFromFont,
  getEditorWrapBoundaryUnits,
} from '../editor-line-wrap-estimate';

describe('getEditorWrapBoundaryUnits', () => {
  it('returns unbounded width when word wrap is off', () => {
    const { boundary, viewportApproximate } = getEditorWrapBoundaryUnits('off', 80, 100);
    expect(boundary).toBe(Number.MAX_SAFE_INTEGER);
    expect(viewportApproximate).toBe(false);
  });

  it('uses wordWrapColumn when mode is wordWrapColumn', () => {
    const { boundary, viewportApproximate } = getEditorWrapBoundaryUnits('wordWrapColumn', 72, 100);
    expect(boundary).toBe(72);
    expect(viewportApproximate).toBe(false);
  });

  it('uses min viewport and column when bounded', () => {
    const { boundary, viewportApproximate } = getEditorWrapBoundaryUnits('bounded', 120, 80);
    expect(boundary).toBe(80);
    expect(viewportApproximate).toBe(true);
  });

  it('uses approximate viewport when word wrap is on', () => {
    const { boundary, viewportApproximate } = getEditorWrapBoundaryUnits('on', 80, 100);
    expect(boundary).toBe(100);
    expect(viewportApproximate).toBe(true);
  });
});

describe('countVisualWrapLinesByUnits', () => {
  it('counts column wraps for padding-heavy GFM lines (few whitespace tokens)', () => {
    const line = '| Row 1          | ' + 'x'.repeat(380) + ' |';
    expect(countVisualWrapLinesByUnits(line, 80)).toBeGreaterThan(1);
  });

  it('returns 4 lines for 403 units at ~100 column viewport', () => {
    expect(countVisualWrapLinesByUnits('x'.repeat(403), 101)).toBe(4);
  });

  it('returns 1 line for whitespace-only width within boundary', () => {
    expect(countVisualWrapLinesByUnits(' '.repeat(403), 500)).toBe(1);
  });
});

describe('estimateViewportCharsFromFont', () => {
  it('derives ~133 columns at 12px font (403 chars -> 4 lines)', () => {
    const viewport = estimateViewportCharsFromFont(12);
    expect(viewport).toBeGreaterThan(100);
    expect(countVisualWrapLinesByUnits('x'.repeat(403), viewport)).toBe(4);
  });
});
