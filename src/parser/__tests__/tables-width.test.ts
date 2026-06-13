import { describe, expect, it } from 'vitest';
import {
  buildTableCellReplacement,
  detectCellStyle,
  measureTextWidth,
} from '../tables';

describe('tables width helpers', () => {
  it('buildTableCellReplacement matches source width with unified column width', () => {
    const raw = ' x     ';
    const replacement = buildTableCellReplacement(raw, 'x', 1, 5, 'left');
    expect(measureTextWidth(replacement)).toBe(measureTextWidth(raw));
    expect(replacement.indexOf('x')).toBe(1);
  });

  it('clamps unified column width to the source cell span', () => {
    const raw = ' Col ';
    const replacement = buildTableCellReplacement(raw, 'Col', 3, 8, 'left');
    expect(measureTextWidth(replacement)).toBe(measureTextWidth(raw));
  });

  it('uses consistent width measurement for source and display content', () => {
    const raw = ' 你好 ';
    const replacement = buildTableCellReplacement(raw, '你好', 4, 4, 'left');
    expect(measureTextWidth(replacement)).toBe(measureTextWidth(raw));
  });

  it('does not treat multiple inline code spans as whole-cell code', () => {
    expect(detectCellStyle('`one` and `two`')).toBeUndefined();
    expect(detectCellStyle('`code`')).toEqual({ inlineCode: true });
  });
});
