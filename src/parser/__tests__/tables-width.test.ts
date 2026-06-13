import { describe, expect, it } from 'vitest';
import {
  buildTableCellReplacement,
  detectCellStyle,
  measureTextWidth,
} from '../tables';

describe('tables width helpers', () => {
  it('buildTableCellReplacement pads to unified column width', () => {
    const replacement = buildTableCellReplacement(' x     ', 'x', 1, 5, 'left');
    expect(measureTextWidth(replacement)).toBe(7);
    expect(replacement.indexOf('x')).toBe(1);
  });

  it('does not clamp unified column width to a narrow source span', () => {
    const replacement = buildTableCellReplacement(' Col ', 'Col', 3, 8, 'left');
    expect(measureTextWidth(replacement)).toBe(10);
  });

  it('uses grapheme clusters for emoji width', () => {
    expect(measureTextWidth('👨‍👩‍👧')).toBe(2);
    expect(measureTextWidth('🇯🇵')).toBe(2);
    expect(measureTextWidth('😀')).toBe(2);
  });

  it('uses consistent width measurement for CJK display content', () => {
    const replacement = buildTableCellReplacement(' 你好 ', '你好', 4, 4, 'left');
    expect(measureTextWidth(replacement)).toBe(6);
  });

  it('does not treat multiple inline code spans as whole-cell code', () => {
    expect(detectCellStyle('`one` and `two`')).toBeUndefined();
    expect(detectCellStyle('`code`')).toEqual({ inlineCode: true });
  });
});
