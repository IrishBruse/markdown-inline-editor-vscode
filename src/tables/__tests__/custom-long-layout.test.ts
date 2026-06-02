import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../parser/core';
import {
  bodyBandHeaderInsetPx,
  buildTableLayout,
  renderTableSvgLineSlice,
  resolveOverlayBandHeight,
  sourceLineToSliceSpec,
} from '../table-renderer';

const metrics = { lineHeight: 18, fontSize: 13 };
const fixturePath = join(
  __dirname,
  '../../test/e2e/visual/custom-long-rendered/fixture.md',
);

describe('custom-long table layout', () => {
  it('uses a tall band and centers row labels beside wrapped content', () => {
    const md = readFileSync(fixturePath, 'utf8');
    const { tableBlocks } = new MarkdownParser().extractDecorationsWithScopes(md);
    const block = tableBlocks[0]!;
    const layout = buildTableLayout(block, { isDark: false, ...metrics, capToSourceLines: false });

    const slice = sourceLineToSliceSpec(2, layout)!;
    const bandHeight = resolveOverlayBandHeight(layout, slice);
    expect(bandHeight).toBeGreaterThan(metrics.lineHeight);

    const svg = renderTableSvgLineSlice(layout, 2)!;
    const row1Y = svg.match(/<tspan x="[^"]*" y="([\d.]+)">Row 1<\/tspan>/)?.[1];
    expect(row1Y).toBeDefined();
    const baseline = Number(row1Y);
    expect(baseline).toBeLessThan(bandHeight * 0.35 + layout.metrics.fontSize);

    expect(layout.totalWidth).toBeGreaterThan(500);
    expect(layout.totalWidth).toBeLessThan(600);
  });
});
