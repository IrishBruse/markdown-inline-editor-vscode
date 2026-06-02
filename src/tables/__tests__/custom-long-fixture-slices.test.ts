import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser/core';
import { buildTableLayout, renderTableSvgLineSlice, sourceLineToSliceSpec } from '../table-renderer';

const fixturePath = join(
  __dirname,
  '../../test/e2e/visual/custom-long-rendered/fixture.md',
);

describe('custom-long fixture slices', () => {
  it('maps header, separator bridge, and first body source lines', () => {
    const md = readFileSync(fixturePath, 'utf8');
    const lines = md.split('\n');
    const tableStart = lines.findIndex((line) => line.startsWith('| Section Header'));
    expect(tableStart).toBe(2);

    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    const block = tableBlocks[0]!;
    expect(block.numLines).toBe(block.header.length > 0 ? 2 + block.rows.length : 0);

    const layout = buildTableLayout(block, {
      isDark: false,
      lineHeight: 18,
      fontSize: 13,
      capToSourceLines: false,
    });

    expect(sourceLineToSliceSpec(0, layout)?.mergedHeader).toBe(true);
    expect(sourceLineToSliceSpec(1, layout)?.separatorColumnBridge).toBe(true);
    expect(sourceLineToSliceSpec(1, layout)?.useFullLineOverlay).toBe(true);
    expect(renderTableSvgLineSlice(layout, 1)).toContain(layout.metrics.colors.headerBackground);

    expect(sourceLineToSliceSpec(2, layout)?.rowLayoutIndex).toBe(1);
    expect(renderTableSvgLineSlice(layout, 2)).toContain('Row 1');
  });
});
