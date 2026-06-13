# Table rendering fixes

From review of `docs/tests/05-tables.md` (styling and alignment gaps).

## 1. Unify exception cells into the grid

- [x] Pad link-only cells with display label text while keeping underline scoped to content glyphs (not NBSP padding)
- [x] Pad image-only cells with icon/display text without breaking image click/hover behavior
- [x] Pad strike-only cells with struck display text without line-through bleeding across alignment padding
- [x] Add fixture/integration tests for link, image, and strike rows beside plain padded cells

## 2. Wire up column width unification

- [x] Use `computeColumnWidths()` (or equivalent) in `processTable` to derive shared column widths
- [x] Pad all rows in a column to the same display width (not each cell's individual source span)
- [x] Align separator dash segments to unified column widths
- [x] Add tests for rows with uneven source spacing that should still render aligned pipes

## 3. Mixed inline formatting in cells

- [x] Decide product behavior: keep raw fallback (chosen) vs partial inline styling inside padded cells
- [x] Document raw fallback explicitly in `docs/tests/05-tables.md` checks section
- [ ] ~~If improving: render mixed inline styles inside `tableCell`~~ (deferred; raw fallback kept)

## 4. CJK and emoji width calibration

- [x] Align source vs display width measurement (consistent `measureTextWidth` for padding math)
- [x] Verify/fix CJK rows in fixture (`你好`, `ひらがな`, `안녕`)
- [x] Verify/fix emoji rows (single emoji, ZWJ family, flag sequences)
- [x] Add regression tests tied to `docs/tests/05-tables.md` CJK/emoji section

## 5. Docs and known limitations

- [x] Mark `custom` SVG wrapping mode as not yet implemented (or remove until built)
- [x] Expand checks in `docs/tests/05-tables.md` to list link/image/strike-only alignment as known limitation (until item 1 is done)
- [x] Note `tables.forceRaw` setting behavior in test doc if not already clear

## 6. Latent: link + text in same cell

- [x] Audit cells with link + surrounding text (not link-only)
- [x] Fall back to raw or apply correct mixed rendering consistently

---

## Visual regressions (`docs/tests/05-tables.md` manual review)

### 7. Rich cells (native padding) — `## Rich cells`

- [x] Pipes and separator dashes align vertically across header, separator, and data rows
- [x] Link-only cells in a wide column do not push the `Note` column or break the grid
- [x] Image-only cell (icon) aligns with padded plain cells in the same table
- [x] Regression test + visual check for all three tables in this section

### 8. Whole-cell strikethrough — `## Whole-cell styling` / `## Strikethrough whole cell`

- [x] Strikethrough applies to display text only, not across NBSP padding to the pipe (combining U+0336)
- [x] Adjacent plain cell (`strikethrough`, `delete`) renders without missing or stray line-through
- [x] Regression test for strike line scope inside padded `tableCell`

### 9. Mixed inline in one cell — `## Mixed inline in one cell`

- [x] Product decision: keep raw markers (documented limitation)
- [ ] ~~If implementing: bold/italic mid-word inside padded cells~~ (deferred)
- [x] Checks doc matches visible raw-marker behavior
- [x] Regression tests for all four tables in this section

### 10. Inline code beside text — `## Inline code beside text`

- [x] Documented as raw fallback (same as mixed inline; VS Code `before` cannot style sub-spans)
- [x] Column alignment preserved via padded raw replacement
- [x] Regression tests for both tables in this section

### 11. Long URL in cell — `## Long and dense cells`

- [x] Bare URL link-only cell stays in the padded grid; pipes line up with neighbor column
- [x] Long URL does not collapse column layout or detach `Note` header from its cell
- [x] Regression test for long URL row beside plain `long URL` cell

### 12. CJK and emoji width — `## CJK and emoji width`

- [x] Pipes align across header, separator, and body (fixture source rows corrected)
- [x] Pipes align for emoji including ZWJ family and flag sequences
- [x] Three-column table (`AB | 你好 | 😀`) keeps all column borders vertical
- [x] `measureTextWidth` treats combining marks and ZWJ joiners as zero-width where needed
- [x] Regression tests tied to each fixture table in this section

### 13. Links in cells — `## Links in cells`

- [x] Markdown link in first column pads correctly; `Label` / `URL` headers align with data
- [x] `Docs` shows link styling without breaking pipe grid; `local` stays under `URL`
- [x] Relative link path (`../../README.md`) on decoration for click/hover
- [x] Regression test for this table (wide header row + link-only data cell)
