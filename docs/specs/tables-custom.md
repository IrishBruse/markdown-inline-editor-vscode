# Custom table rendering spec

Normative behavior for `markdownInlineEditor.tables.renderingMode: custom`.

**Implementation:** `src/tables/table-renderer.ts`, `src/decorator/custom-table-update-coordinator.ts`  
**Tests:** `src/tables/__tests__/table-renderer.test.ts` (`multiline header band`, `sourceLineToSliceSpec`), `src/decorator/__tests__/custom-table-update-coordinator.test.ts`  
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
| `0` | Merged **thead** (title + separator source lines) | `mergedHeader: true` |
| `1` | *(none - covered by line `0` overlay)* | `sourceLineToSliceSpec(1)` returns `null` |
| `2+` | One **data** band per line | (default slice) |

`countTableOverlaySourceLines(numLines)` MUST equal `numLines - 1`.

`sourceLineToSliceSpec(1)` MUST return `null` (no second overlay that paints over centered header text).

## Merged header (title line)

The GFM header is **two source lines** (title row + `|---|---|` separator) but **one logical thead** in the rendered grid.

### MUST

- Render thead **labels** on source line `0` in one overlay band at least `HEADER_SOURCE_LINES * editorLineHeight` tall, covering both the title and GFM separator source lines.
- **Vertically center** header cell text in that band so labels sit between the table top border and the thead/tbody rule (not top-aligned). When labels wrap, the band may grow taller; center the text block in the full band.
- Draw the table **top**, **vertical**, and thead **bottom** grid lines on that single title-line overlay (thead/tbody divider at the bottom of the two-line band).
- Clip overlay content to the band (`clipPath`) so tall SVG does not paint outside the decoration box.

### MUST NOT (regression guards)

- Top-align header labels in the title-line band (short headers like `| Col | Note |` must not hug the top border).
- Render a **second overlay** on source line `1` (separator hide band). It paints over the bottom half of the centered header and the first line of wrapped body cells.
- **Split the thead** across two overlay bands by slicing header layout with `subLineCount: 2` on lines `0` and `1`. That draws a cell bottom border on the title line, which looks like `---` bleeding under the header labels.
- Render header **text** on the separator source line (line `1`).

## Data rows (source line 2+)

### MUST

- One overlay band per data source line.
- Band height (`resolveOverlayBandHeight`) MUST match the SVG `height` and the decoration `before.height`.
- Cell `<rect>` height MUST equal the band height for every column in that row.
- Word-wrap cell text within column width; truncate with ellipsis after `MAX_BAND_LINES` (~5) visible lines.
- **Top-align** all body cell text (`cellPadY` inset from the top of the band), including single-line cells beside taller wrapped neighbors.

### MUST NOT

- Vertically center body/data cell content in the band (short cells stay top-aligned even when another column wraps).

## Grid lines (per-line overlays)

- Use fill-only cell rects plus explicit `<line>` strokes (not four-sided `<rect stroke>` per cell).
- **Vertical** borders: span the full band height and extend 1px into the next band so adjacent row overlays meet.
- **Horizontal** borders: each row band draws its **bottom** edge only; the merged title band draws the **top** edge of the table. Do not draw both bottom (title) and top (separator/data) on the same seam (avoids a thick bar).
- The merged title-line band draws the thead/tbody divider as its bottom edge.

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
4. `npm test -- src/tables/__tests__/table-renderer.test.ts` passes (`multiline header band`, including `vertically centers simple header`).
