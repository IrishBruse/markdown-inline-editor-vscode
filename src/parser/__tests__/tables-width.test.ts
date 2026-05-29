import { describe, expect, it } from 'vitest';
import { isWideMonospaceChar, measureTextWidth } from '../tables';

describe('measureTextWidth', () => {
  it('counts Han characters as wide', () => {
    expect(measureTextWidth('你好')).toBeGreaterThan(2);
  });

  it('counts Hiragana and Hangul as wide', () => {
    expect(measureTextWidth('ひら')).toBeGreaterThan(3);
    expect(measureTextWidth('안녕')).toBeGreaterThan(3);
  });

  it('counts emoji as wide', () => {
    expect(measureTextWidth('😀')).toBeGreaterThan(1);
    expect(measureTextWidth('🚀')).toBeGreaterThan(1);
  });

  it('classifies extended scripts via isWideMonospaceChar', () => {
    expect(isWideMonospaceChar('ひ'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('안'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('😀'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('A'.codePointAt(0)!)).toBe(false);
  });
});
