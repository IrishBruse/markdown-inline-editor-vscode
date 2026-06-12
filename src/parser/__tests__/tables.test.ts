import {
  buildTableCellReplacement,
  measureTextWidth,
} from '../tables';

describe('measureTextWidth', () => {
  it('counts ASCII as width 1', () => {
    expect(measureTextWidth('EN')).toBe(2);
  });

  it('counts CJK as width 2', () => {
    expect(measureTextWidth('你好')).toBe(4);
  });

  it('counts Hangul as width 2', () => {
    expect(measureTextWidth('안녕')).toBe(4);
  });

  it('counts emoji as width 2', () => {
    expect(measureTextWidth('😀')).toBe(2);
  });

  it('ignores zero-width joiners in emoji sequences', () => {
    expect(measureTextWidth('👨‍👩‍👧‍👦')).toBeGreaterThan(2);
  });

  it('applies CJK correction only when requested', () => {
    expect(measureTextWidth('中文')).toBe(4);
    expect(measureTextWidth('中文', { cjkCorrection: true })).toBe(5);
  });
});

describe('buildTableCellReplacement', () => {
  it('matches source cell visual width for CJK cells', () => {
    const raw = ' 你好 ';
    const display = '你好';
    const displayWidth = measureTextWidth(display, { cjkCorrection: true });
    const replacement = buildTableCellReplacement(raw, display, displayWidth, null);
    expect(measureTextWidth(replacement)).toBe(measureTextWidth(raw));
  });

  it('matches source cell visual width when rows use different padding', () => {
    const headerRaw = ' CJK  ';
    const dataRaw = ' 你好 ';
    const headerReplacement = buildTableCellReplacement(
      headerRaw,
      'CJK',
      measureTextWidth('CJK', { cjkCorrection: true }),
      null,
    );
    const dataReplacement = buildTableCellReplacement(
      dataRaw,
      '你好',
      measureTextWidth('你好', { cjkCorrection: true }),
      null,
    );
    expect(measureTextWidth(headerReplacement)).toBe(measureTextWidth(headerRaw));
    expect(measureTextWidth(dataReplacement)).toBe(measureTextWidth(dataRaw));
  });
});
