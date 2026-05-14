import { describe, expect, it } from 'vitest';
import {
  buildNativeTableCellPadParts,
  buildSyntheticTableCellReplacement,
  leadingTrailingNbspRepeatCounts,
} from '../tables';

const NBSP = '\u00A0';

describe('table NBSP padding helpers', () => {
  it('matches legacy left alignment counts', () => {
    expect(leadingTrailingNbspRepeatCounts(null, 0)).toEqual({ leading: 1, trailing: 1 });
    expect(leadingTrailingNbspRepeatCounts('left', 2)).toEqual({ leading: 1, trailing: 3 });
  });

  it('matches legacy right alignment counts', () => {
    expect(leadingTrailingNbspRepeatCounts('right', 1)).toEqual({ leading: 2, trailing: 1 });
  });

  it('matches legacy center alignment counts', () => {
    expect(leadingTrailingNbspRepeatCounts('center', 3)).toEqual({ leading: 2, trailing: 3 });
  });

  it('buildSyntheticTableCellReplacement matches concatenation pattern', () => {
    const content = 'x';
    expect(buildSyntheticTableCellReplacement(null, 0, content)).toBe(
      NBSP + content + NBSP,
    );
    expect(buildSyntheticTableCellReplacement('right', 1, content)).toBe(
      NBSP.repeat(2) + content + NBSP,
    );
    const padLeft = 1;
    const padRight = 2;
    const totalPad = 3;
    expect(buildSyntheticTableCellReplacement('center', totalPad, content)).toBe(
      NBSP.repeat(padLeft + 1) + content + NBSP.repeat(padRight + 1),
    );
  });

  it('buildNativeTableCellPadParts splits like synthetic sides', () => {
    const syn = buildSyntheticTableCellReplacement('center', 4, 'hi');
    const native = buildNativeTableCellPadParts('center', 4);
    expect(native.leadingNbsp + 'hi' + native.trailingNbsp).toBe(syn);
  });
});
