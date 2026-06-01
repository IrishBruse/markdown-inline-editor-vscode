# Custom table rendering spec

Normative behavior for `markdownInlineEditor.tables.renderingMode: custom`.

**Implementation:** `src/tables/table-renderer.ts`, `src/decorator/custom-table-update-coordinator.ts`  
**Tests:** `src/tables/__tests__/table-custom-overlay-regression.test.ts` (header + body regressions), `src/tables/__tests__/table-renderer.test.ts`, `src/decorator/__tests__/custom-table-update-coordinator.test.ts`  
**Manual QA:** [docs/tests/05-tables.md](../tests/05-tables.md) (sections **Basic**, **Custom mode**)

## Scope

This spec covers **per-line SVG overlays** in the editor (one decoration per table source line). It does not define `inline` or `raw` table modes.

Custom mode MUST:

- Skip inline table decorations (`tablePipe`, `tableSeparatorDash`, etc.) while the cursor is outside the table.
- Render one SVG band per source line via `CustomTableUpdateCoordinator`.
- Hide source GFM under each band (opaque overlay + matching decoration height).

## Source-line mapping

For a GFM table block with `numLines` source lines (header title, separator, data rows, ...):

| Source line index | Overlay | Slice flags |
|-------------------|---------|-------------|
| `0` | Merged **thead** labels (tall band) | `mergedHeader: true` |
| `1` | **Separator hide** (no text) | `hideSeparatorRow: true` |
| `2+` | One **data** band per line | (default slice) |

`countTableOverlaySourceLines(numLines)` MUST equal `numLines`.

Each overlay decoration MUST set `color: transparent` on the source line range so GFM (`|`, `---`) is not visible under the SVG.

## Merged header (title line)

The GFM header is **two source lines** (title row + `|---|---|` separator) but **one logical thead** in the rendered grid.

### MUST

- Render thead **labels** on source line `0` in a band at least `HEADER_SOURCE_LINES * editorLineHeight` tall.
- **Vertically center** single-line header labels in the two-line thead (`HEADER_SOURCE_LINES * editorLineHeight`). Multi-line wrapped labels center in the full title band when it grows taller.
- Render the separator hide band on line `1` with **header background fill** plus grid lines (thead bottom rule). Labels stay on the title-line overlay only; `|---|---|` is hidden by fill and transparent source-line decorations.
- Draw the table **top** and **vertical** grid lines on the title band; draw the thead **bottom** on the separator hide band only.
- Clip overlay content to the band (`clipPath`) so tall SVG does not paint outside the decoration box.

### MUST NOT (regression guards)

- Top-align header labels in the title-line band (short headers like `| Col | Note |` must not hug the top border).
- Draw separator label glyphs or body background on the separator hide band.
- Leave raw GFM visible on any overlaid source line (missing `color: transparent` on decorations).
- Render header label glyphs on the separator hide band (labels must stay on the title line overlay only).
- **Split the thead** across two overlay bands by slicing header layout with `subLineCount: 2` on lines `0` and `1`. That draws a cell bottom border on the title line, which looks like `---` bleeding under the header labels.
- Render header **text** on the separator source line (line `1`).

## Data rows (source line 2+)

### MUST

- One overlay band per data source line.
- Band height (`resolveOverlayBandHeight`) MUST match the SVG `height` and the decoration `before.height`.
- For non-header slices, band height MUST NOT exceed the source-line budget (`slice.sliceHeight`, typically `editorLineHeight`). Taller bands overlap the next line and hide the row's bottom border.
- Cell `<rect>` fills MUST be inset on bordered edges so fill height is `bandHeight - BORDER_WIDTH` when a bottom grid line is drawn (and similarly for a top edge).
- Word-wrap cell text within column width; truncate with ellipsis after `MAX_BAND_LINES` (~5) visible lines.
- **Top-align** all body cell text (`cellPadY` inset from the top of the band), including single-line cells beside taller wrapped neighbors.

### MUST NOT

- Vertically center body/data cell content in the band (short cells stay top-aligned even when another column wraps).

## Grid lines (per-line overlays)

- **All bands:** fill-only cell rects plus a 1px `<rect>` border grid (`appendBandBorderLines`) on integer coordinates so corners and row joins stay square (no inset `<line>` strokes).
- Cell and band fills are inset by `BORDER_WIDTH` on edges where a border rect is drawn so fill does not bleed past borders.
- **Horizontal** header rules: merged title band draws the table **top**; separator hide band draws the thead/tbody **bottom** on thead-colored fill.
- Table slice SVGs use `ensureSvgDimensions` with `preserveAspectRatio="none"` so every band shares the same pixel width.
- **Vertical** rules: one 1px rect per column boundary; only one outer right edge (no duplicate divider before the right gutter).
- Overlay decorations set `border-radius: 0` so the editor does not round band corners.

## Decoration alignment

The coordinator MUST set decoration height from `resolveOverlayBandHeight(layout, slice)`, not a fixed `lineHeight`, except as fallback when no slice exists.

SVG output from `renderTableSvgLineSlice` MUST use the same pixel height as `resolveOverlayBandHeight` for that slice.

## Column layout

- Column width: max content width per column across all rows, clamped to `MAX_COL_WIDTH` (~400px), minimum from font metrics.
- Alignment: respect GFM column alignment from the parser (`left` / `center` / `right`).

## Interaction

- Cursor inside table block: overlays cleared; user edits raw GFM (same as selection-reveal for tables).
- Cursor outside: overlays shown; inline decorations inside the table scope remain suppressed.

## Known limitations (non-regression)

- Editor overlays do not reserve document line height; tall bands may visually overlap the next source line.
- Very tall tables render progressively (`TABLE_SVG_RENDER_BATCH_SIZE` batches).
- Tables with cursor inside show raw markdown only (no custom overlay).

## Checklist before merge (header / layout changes)

1. Open `docs/tests/05-tables.md` with `renderingMode: custom`, cursor outside tables.
2. **Basic** section: no `---` or `___` under header labels; separator line not readable as markdown.
3. Header labels visually centered in the gray thead area spanning two source lines (not stuck to the top border).
4. `npm test -- src/tables/__tests__/table-custom-overlay-regression.test.ts` passes.
