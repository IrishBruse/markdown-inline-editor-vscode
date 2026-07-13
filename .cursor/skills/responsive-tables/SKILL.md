---
name: responsive-tables
description: Responsive long-cell GFM table rendering. Use for pipe-grid SVG, table-responsive decorators, wrapping, and visual verification.
---

# Responsive long-cell tables

Use this skill for responsive long-cell table work in markdown-inline-editor-vscode.

## Feature summary

When a GFM table has any column wider than 80 display characters, the extension switches from compact per-line pipe hiding to **responsive pipe-grid mode**:

- Long cell text **wraps inside the column** instead of forcing horizontal scroll.
- The rendered view is a **pipe grid** (Unicode box-drawing pipes), not raw `|` markdown.
- **Left column** (row labels) stays bright, **right column** content is muted.
- **Horizontal dividers** separate every row.
- Continuation lines keep an **empty left column** so pipes stay aligned.
- With the cursor **outside** the table, each row shows a wrapped pipe-grid preview.
- With the cursor **on a row**, that row shows raw GFM for editing. Rows above may clip wrap height so they do not overlap the active row.

See `docs/tests/05-tables.md` (responsive wrapping bullet) for product behavior.

## Visual target

Compare against:

| Asset | Purpose |
|-------|---------|
| `Goal.png` | Target screenshot at 800x600 (regenerate from screenshot script) |
| `Goal.md` | Target wrapped grid text at viewport 90 columns (800x600 reference) |
| `docs/tests/long-cell-wrapping.md` | Extension test fixture (single-line source rows, wrapping is decoration-only) |

Success looks like Goal: aligned pipes, dividers between rows, muted right column, 3-6 wrap lines per row at 800px (fewer at wider viewports),
no raw single-line markdown visible when not editing.

Regenerate `Goal.md` with `GOAL_WRITE=1 npm test -- --run src/tables/__tests__/responsive-svg.test.ts -t "generates Goal.md"`.

## Architecture (current approach)

**Per-row SVG decorations** - one wrapped pipe-grid SVG anchored on each source row:

1. **Per-row segment** - `buildGridRowPayload` on each table row's full source line.
2. **Shared layout** - `estimateResponsiveTableLayout()` once per table from the header start column, shared `colWidths` for all rows.
3. **Layout width** from `estimateResponsiveTableLayout()` in `src/mermaid/editor-width.ts` (viewport columns minus table start column).
4. **SVG pixel width** matches the **actual grid width** (`estimateGridWidth(colWidths)`), not the full editor viewport.
5. Grid text/layout lives in `src/tables/responsive-svg.ts` (`buildGridRowPayload`, `layoutWrappedGridRow`, `renderGridLinesSvg`).
6. Decoration application in `src/decorator/table-responsive.ts` and `src/decorator/responsive-table-decorations.ts`.
7. Rows above the active row may clip wrap lines via `getClipLineCount` + `maxWrapLines`.

Activation threshold: `RESPONSIVE_COLUMN_THRESHOLD` (80) in `src/tables/responsive-layout.ts`.

## Key files

```
src/decorator/table-responsive.ts       Per-row apply, shared layout, active-row clip
src/decorator/responsive-table-decorations.ts   SVG before-icon decorations
src/tables/responsive-svg.ts            Grid layout + SVG generation
src/tables/responsive-layout.ts         Column widths, wrapping, viewport cap
src/mermaid/editor-width.ts             Visible viewport column estimate
src/visual/table-fixture-renderer.ts    Offline overlay (per-row projection)
scripts/screenshot-long-cell-wrapping.mjs   Extension host screenshots
docs/tests/long-cell-wrapping.md        Primary fixture
```

## Verification (required after changes)

Run all checks below without asking.

### Build and unit tests

```bash
npm run compile && npm run bundle:prod
npm test -- --run src/decorator/__tests__/table-responsive.test.ts src/tables/__tests__/responsive-svg.test.ts src/mermaid/__tests__/editor-width.test.ts
```

### Extension host screenshot

```bash
npm run screenshot:long-cell-wrapping
```

Launches VS Code Extension Development Host with `docs/` as the workspace and opens `tests/long-cell-wrapping.md`.
Captures the long-cell wrapping table at one window size (default: 800x600).
Pass width and height as two numbers: `npm run screenshot:long-cell-wrapping -- 1280 800`.
Or set `WINDOW_WIDTH` and `WINDOW_HEIGHT` together.
Frames are written to `screenshots/`.

Screenshot loop:

- Default window: 800x600. Also try `npm run screenshot:long-cell-wrapping -- 1280 800`.
- Output: `screenshots/long-cell-wrapping-*.png`
- Requires `code` on PATH (`CODE_BIN`, `CDP_PORT` to override). Uses Playwright only (no xdotool or other OS-specific tooling).

Review screenshots against `Goal.png`.
Check wrap density, pipe alignment, dividers, muted colors, and that all 10 rows are reachable by scrolling.
Confirm wrapping, alignment, and decorations look correct. Fix regressions before finishing.

### Overlay regression check

```bash
npm run visual:tables
```

Overlay output is written to `dist/visual/`.
Use to verify pipe alignment and responsive layout before stopping.

## Known tricky areas

1. **Viewport width estimation** - Long table source lines must not inflate `editor.visibleRanges` end columns.
   `estimateVisibleViewportColumns()` skips or caps long lines, only trust `range.end.character` as the viewport edge
   when it is plausibly small vs line length.

2. **First paint / scroll** - Table decorations may need a viewport or selection refresh after the editor opens.
   Decorator schedules a layout settle on `setActiveEditor`, visible-range changes should refresh table decorations.

3. **Decoration order** - Call `applyHidden(editor, [])` before show decorations to clear stale hides.
   Each row uses transparent text + `before` SVG with explicit width/height.

4. **Responsive width** - `Goal.md` is generated at viewport 90 columns (~800x600).
   Wider editor windows produce fewer wrap lines by design.

5. **Active row editing** - Raw markdown with pipe artifacts while the cursor is inside a row is expected.

## Task prompt template

```
Work on responsive long-cell table rendering in markdown-inline-editor-vscode.

Read Goal.png, Goal.md, and docs/tests/long-cell-wrapping.md. Use the responsive-tables skill.

Goal: wrapped pipe-grid table in the editor matches Goal visually (pipes, dividers, muted right column, responsive wrap lines, 10 rows).

Use per-row SVG via buildGridRowPayload with shared colWidths per table.

After changes: run unit tests, npm run screenshot:long-cell-wrapping, and npm run visual:tables. Iterate until screenshots match Goal.
```
