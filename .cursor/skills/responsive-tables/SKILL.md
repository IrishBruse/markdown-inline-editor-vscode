---
name: responsive-tables
description: Pipe-grid responsive GFM tables. Use for table-responsive decorators, responsive-svg wrapping, or Goal visual verification.
---

# Pipe-grid responsive tables

**Pipe-grid** mode replaces compact pipe hiding when any GFM column exceeds 80 display characters
(`RESPONSIVE_COLUMN_THRESHOLD` in `src/tables/responsive-layout.ts`).
Long cells wrap inside the column, and the view shows aligned Unicode pipes, not raw `|` markdown.
Left column bright, right column muted, horizontal dividers between rows, empty left column on continuation lines.
Cursor outside the table: per-row wrapped previews.
Cursor on a row: raw GFM for editing (rows above may clip wrap height).
Product spec: `docs/tests/05-tables.md`.

## Work

### Step 1. Orient to Goal

Read `Goal.png`, `Goal.md`, and `docs/tests/long-cell-wrapping.md`.
`Goal.png` is a fixed, read-only visual reference. Compare screenshots against it, never copy onto it or regenerate it.

**Done when:** you can name every visual gap between current output and Goal
(pipe alignment, row dividers, muted right column, wrap line count, all 10 rows reachable by scroll).

Regenerate `Goal.md` after layout changes:

```bash
GOAL_WRITE=1 npm test -- --run src/tables/__tests__/responsive-svg.test.ts -t "generates Goal.md"
```

### Step 2. Implement per-row SVG

One decoration per uncovered table row, anchored on that row's source line.

- Call `buildGridRowPayload()` once per row; each SVG renders only that row's wrapped grid lines (`compact: true`).
- Use `buildCoveredLines()` so rows covered by a prior row's wrap preview are hidden (`display: none`) and skip decoration.
- Shared `layoutWidth` / `colWidths` from the header start column via `estimateResponsiveTableLayout()`.
- SVG pixel width matches `estimateGridWidth(colWidths)`, not the full editor viewport.
- Apply hide ranges before show decorations (transparent text + `before` SVG per uncovered line).
- Grid layout in `src/tables/responsive-svg.ts`.
- Decoration wiring in `src/decorator/table-responsive.ts` and `src/decorator/responsive-table-decorations.ts`.

**Per-row SVG only.** VS Code cannot expand a single source line for multiline `before` SVG, so covered rows must be hidden per `docs/tests/05-tables.md`.

**Done when:** uncovered rows each have their own `buildGridRowPayload()` anchor and covered rows are hidden.

### Step 3. Tight verification loop

Run without asking. Iterate until `screenshots/` matches Goal.

**Build and unit tests:**

```bash
npm run compile && npm run bundle:prod
npm test -- --run src/decorator/__tests__/table-responsive.test.ts src/tables/__tests__/responsive-svg.test.ts src/mermaid/__tests__/editor-width.test.ts
```

**Extension host screenshot:**

```bash
npm run screenshot:long-cell-wrapping
npm run screenshot:long-cell-wrapping -- 1280 800
```

Opens `docs/tests/long-cell-wrapping.md` in Extension Development Host.
Default window 800x600, pass width and height as two args, or set `WINDOW_WIDTH` and `WINDOW_HEIGHT`.
Output: `screenshots/long-cell-wrapping-*.png`.
Requires `code` on PATH (`CODE_BIN`, `CDP_PORT` to override).

**Overlay regression:**

```bash
npm run visual:tables
```

Output: `dist/visual/`.

**Done when:** unit tests pass,
800x600 frames in `screenshots/` match `Goal.png` (wrap density, alignment, dividers, muted colors, 10 scrollable rows),
1280x800 checked, overlay pipes align.

## Goal reference

| Asset | Purpose |
|-------|---------|
| `Goal.png` | Fixed visual reference (read-only, human-maintained) |
| `Goal.md` | Target grid text at viewport 90 columns (~800x600) |
| `docs/tests/long-cell-wrapping.md` | Fixture (single-line source, wrapping is decoration-only) |

Wider viewports produce fewer wrap lines by design. Raw markdown with pipe artifacts on the active row is expected.

## Key files

```
src/decorator/table-responsive.ts              Apply/hide ranges, active-row splits
src/decorator/responsive-table-decorations.ts  SVG before-icon decorations
src/tables/responsive-svg.ts                   Grid layout + SVG generation
src/tables/responsive-layout.ts                Column widths, wrapping, viewport cap
src/mermaid/editor-width.ts                    Visible viewport column estimate
src/visual/table-fixture-renderer.ts           Offline overlay (one SVG per row)
scripts/screenshot-long-cell-wrapping.mjs      Extension host screenshots
```

## Tricky areas

**Viewport width** - Long table source lines must not inflate `editor.visibleRanges` end columns.
`estimateVisibleViewportColumns()` skips or caps long lines.
Trust `range.end.character` as the viewport edge only when plausibly small vs line length.

**First paint / scroll** - Decorations may need a viewport or selection refresh after open.
Decorator schedules layout settle on `setActiveEditor`.
Visible-range changes should refresh table decorations.

**Decoration order** - Hide covered rows before show decorations on each uncovered row line.

**Covered rows** - VS Code cannot give a single source line multiline height for `before` SVG. Rows whose document line falls inside a prior row's wrap span are hidden until the cursor is on that row (see `buildCoveredLines` in `src/tables/responsive-svg.ts`).
