import { describe, expect, it } from 'vitest';
import { isWideMonospaceChar, measureTextWidth } from '../tables';

describe('measureTextWidth', () => {
  it('counts ASCII at single width', () => {
    expect(measureTextWidth('')).toBe(0);
    expect(measureTextWidth('hello')).toBe(5);
  });

  it('counts Han characters as wide with padding', () => {
    expect(measureTextWidth('你好')).toBe(5);
  });

  it('counts Hiragana and Hangul as wide with padding', () => {
    expect(measureTextWidth('ひら')).toBe(5);
    expect(measureTextWidth('あいう')).toBe(7);
    expect(measureTextWidth('안녕')).toBe(5);
  });

  it('counts emoji as wide with padding', () => {
    expect(measureTextWidth('😀')).toBe(3);
    expect(measureTextWidth('🚀')).toBe(3);
  });

  it('handles mixed ASCII and wide scripts', () => {
    expect(measureTextWidth('hi你')).toBe(5);
    expect(measureTextWidth('A😀B')).toBe(5);
  });

  it('classifies extended scripts via isWideMonospaceChar', () => {
    expect(isWideMonospaceChar('ひ'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('안'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('😀'.codePointAt(0)!)).toBe(true);
    expect(isWideMonospaceChar('A'.codePointAt(0)!)).toBe(false);
  });
});
