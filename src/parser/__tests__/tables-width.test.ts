import { describe, expect, it } from 'vitest';
import {
  applyCombiningStrike,
  buildTableCellReplacement,
  COMBINING_LONG_STROKE_OVERLAY,
  detectCellStyle,
  measureOverlayWidth,
  measureTextWidth,
} from '../tables';

describe('tables width helpers', () => {
  it('buildTableCellReplacement pads to unified column overlay width', () => {
    const replacement = buildTableCellReplacement(' x     ', 'x', 1, 7, 'left');
    expect(measureOverlayWidth(replacement)).toBe(7);
    expect(replacement.indexOf('x')).toBe(1);
  });

  it('does not clamp unified column width to a narrow source span', () => {
    const replacement = buildTableCellReplacement(' Col ', 'Col', 3, 10, 'left');
    expect(measureOverlayWidth(replacement)).toBe(10);
  });

  it('uses grapheme clusters for emoji source width', () => {
    expect(measureTextWidth('👨‍👩‍👧')).toBe(2);
    expect(measureTextWidth('🇯🇵')).toBe(2);
    expect(measureOverlayWidth('👨‍👩‍👧')).toBe(1);
    expect(measureOverlayWidth('🇯🇵')).toBe(1);
  });

  it('uses overlay width for CJK table cell padding', () => {
    const replacement = buildTableCellReplacement(' 你好 ', '你好', 2, 6, 'left');
    expect(measureOverlayWidth(replacement)).toBe(6);
  });

  it('does not treat multiple inline code spans as whole-cell code', () => {
    expect(detectCellStyle('`one` and `two`')).toBeUndefined();
    expect(detectCellStyle('`code`')).toEqual({ inlineCode: true });
  });

  it('applies combining strike only to display graphemes, not padding', () => {
    const struck = applyCombiningStrike('strike');
    expect(struck).toContain(COMBINING_LONG_STROKE_OVERLAY);
    expect(measureOverlayWidth(struck)).toBe(measureOverlayWidth('strike'));
    const replacement = buildTableCellReplacement(' ~~strike~~ ', struck, measureOverlayWidth(struck), 8, 'left');
    expect(replacement.startsWith('\u00A0')).toBe(true);
    expect(replacement.slice(0, replacement.indexOf('s'))).not.toContain(COMBINING_LONG_STROKE_OVERLAY);
  });
});
