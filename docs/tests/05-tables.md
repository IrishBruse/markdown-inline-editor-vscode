# GFM tables

## Basic

| Name | Role |
|------|------|
| Ada  | Lead |
| Bob  | Dev  |

| Name | Age |
| ---- | --- |
| Jo   | 5   |

| aa  | bb  | cc  |
| --- | --- | --- |
| 11  | 22  | 33  |
| 44  | 55  | 66  |

## Four and five columns

| A   | B   | C   | D   |
| --- | --- | --- | --- |
| r1  | r1  | r1  | r1  |
| r2  | r2  | r2  | r2  |

| v   | w   | x   | y   | z   |
| --- | --- | --- | --- | --- |
| 1   | 2   | 3   | 4   | 5   |
| a   | b   | c   | d   | e   |

## Header vs data width

| Short | MuchLongerHeader |
| ----- | ---------------- |
| x     | y                |

| VeryWideHeaderText | B   |
| ------------------ | --- |
| 1                  | 2   |

## Column alignment

| Left | Center | Right |
|:-----|:------:|------:|
| L    |C    |     R |
| long |  mid|   1.0 |

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |  c    |

| Foo | Bar |
| --- | --- |
| x   | y   |

| L        |  C  |         R |
| :------- | :-: | --------: |
| left-pad | mid | right-pad |
| xx       | yy  |        zz |

## Default alignment (no colons)

| One   | Two  | Three |
| ----- | ---- | ----- |
| alpha | beta | gamma |

## Inline formatting in cells

| Plain | **Bold** | *Italic* | `code` |
|-------|----------|----------|--------|
| ok    | loud     | soft     | mono   |

## Links in cells

| Label                   | URL   |
| ----------------------- | ----- |
| [Docs](../../README.md) | local |

## Empty and minimal cells

| A   | B   |
| --- | --- |
|     | B   |

| Col | Val |
| --- | --- |
| B   | B   |

| X   | Y   |
| --- | --- |
|     |     |

## Compact syntax (still valid GFM)

| A   | B   |
| --- | --- |
| 1   | 2   |

## CJK and emoji width

| EN | 中文 |
|----|----|
| Hi | 你好 |

| Name | CJK  |
| ---- | ---- |
| AB   | 你好   |

| Col      | Val      |
| -------- | -------- |
| Hiragana | ひらがな     |

| Col    | Val  |
| ------ | ---- |
| Hangul | 안녕   |

| Col   | Val |
| ----- | --- |
| Emoji | 😀  |

| Col    | Val        |
| ------ | ---------- |
| Family | 👨‍👩‍👧   |

| Col  | Val    |
| ---- | ------ |
| Flag | 🇯🇵   |

| Name | CJK  | Emoji |
| ---- | ---- | ----- |
| AB   | 你好   | 😀    |
| CD   | 世界   | 🚀    |

## Whole-cell styling (synthetic cells)

| Col      | Note   |
| -------- | ------ |
| **bold** | strong |

| Col      | Note              |
| -------- | ----------------- |
| **bold** | strong underscore |

| Col      | Note     |
| -------- | -------- |
| _italic_ | emphasis |

| Col      | Note                |
| -------- | ------------------- |
| _italic_ | emphasis underscore |

| Col          | Note             |
| ------------ | ---------------- |
| **_triple_** | bold-italic star |

| Col     | Note                   |
| ------- | ---------------------- |
| **_x_** | bold-italic underscore |

| Col        | Note          |
| ---------- | ------------- |
| ~~strike~~ | strikethrough |

| Col    | Note            |
| ------ | --------------- |
| `code` | whole-cell code |

## Rich cells (native padding)

| Col                          | Note |
| ---------------------------- | ---- |
| [label](https://example.com) | link |

| Col                                  | Note                       |
| ------------------------------------ | -------------------------- |
| [example](https://example.org/other) | link text differs from URL |

| Col                             | Note  |
| ------------------------------- | ----- |
| ![t](https://example.com/x.png) | image |

| Col | Note |
| --- | ---- |
| `x` | code |

| Col   | Note      |
| ----- | --------- |
| plain | synthetic |

## Mixed inline in one cell

| Col                | Note         |
| ------------------ | ------------ |
| **bold** and plain | mixed strong |

| Col     | Note       |
| ------- | ---------- |
| a _i_ z | mixed star |

| Col     | Note             |
| ------- | ---------------- |
| a _i_ z | mixed underscore |

| Col               | Note            |
| ----------------- | --------------- |
| start **mid** end | strong mid-word |

## Literals that must not break

| field_name | a * b |
|------------|-------|
| value      | 12    |

| Col        | Note        |
| ---------- | ----------- |
| snake_case | underscores |

| Col      | Note     |
| -------- | -------- |
| 100\*200 | asterisk |

| Col        | Note |
| ---------- | ---- |
| not_a_link | text |

## Dollar math heuristic

| Col | Note              |
| --- | ----------------- |
| $x$ | inline math token |

| Col       | Note                      |
| --------- | ------------------------- |
| $$block$$ | double-dollar on one line |

## Inline code beside text

| Col                 | Note      |
| ------------------- | --------- |
| before `code` after | code span |

| Col             | Note      |
| --------------- | --------- |
| `one` and `two` | two spans |

## Autolink-style

| Col                   | Note     |
| --------------------- | -------- |
| <https://example.com> | autolink |

| Col                      | Note          |
| ------------------------ | ------------- |
| <mailto:dev@example.com> | mail autolink |

## Strikethrough whole cell

| Col      | Note   |
| -------- | ------ |
| ~~gone~~ | delete |

## Pipes and escapes inside cells

| Col             | Note         |
| --------------- | ------------ |
| use \| in prose | escaped pipe |

GFM treats every unescaped `|` on a table line as a column boundary. The header row, separator row, and body rows must all use the **same** number of columns, or remark will not parse a `table` at all and this extension will not apply the table decoration set.

**Three cells from raw pipes (not one code span):** the row below is valid GFM with three columns. The two `|` characters inside what looks like code are cell separators, so each cell is plain text (not `inlineCode` in the AST).

| Col | Note | Third            |
| --- | ---- | ---------------- |
| `   | `    | pipe inside code |

**One cell with pipes inside inline code:** escape each `|` as `\|` inside the code span.

| Col           | Note                                |
| ------------- | ----------------------------------- |
| `a \| b \| c` | code with escaped pipes in one cell |

## Long and dense cells

| Col                                                  | Note     |
| ---------------------------------------------------- | -------- |
| https://example.com/path/to/resource?query=1&other=2 | long URL |

| Col                                  | Note       |
| ------------------------------------ | ---------- |
| abcdefghijklmnopqrstuvwxyz0123456789 | long token |

## Symmetric padding check

| Header | Second |
| ------ | ------ |
| plain  | plain  |

## Many data rows

| Idx | Val |
| --- | --- |
| 1   | a   |
| 2   | b   |
| 3   | c   |
| 4   | d   |
| 5   | e   |
| 6   | f   |

## Multi-row stress

| H1  | H2  | H3  |
| --- | --- | --- |
| a   | b   | c   |
| d   | e   | f   |
| g   | h   | i   |

## Three-column wide grid

| ColA    | ColB    | ColC    |
| ------- | ------- | ------- |
| alpha   | beta    | gamma   |
| delta   | epsilon | zeta    |
| eta     | theta   | iota    |

## Tables near other blocks

Paragraph immediately above a table (blank line separates them).

| After | Para |
| ----- | ---- |
| yes   | ok   |

> Blockquote before table

| After | Quote |
| ----- | ----- |
| yes   | ok    |

- List item before table

| After | List |
| ----- | ---- |
| yes   | ok   |

---

**Checks**

- Rendered: pipe grid, aligned columns, markers hidden. Column padding uses the widest raw cell span per column so pipes line up across rows.
- Cursor anywhere in table: **entire table** goes raw (all rows).
- `markdownInlineEditor.tables.forceRaw` (default `false`): when `true`, tables always show as plain GFM with no grid decorations.
- Link-only and image-only cells participate in the padded grid (link color, image icon). Whole-cell `` ~~strike~~ `` uses padded plain text with line-through styling.
- Mixed inline formatting in one cell (bold + plain, link + surrounding text, multiple code spans) uses padded plain text; column width follows the raw source span so pipes stay aligned.
- Inline code beside plain text in one cell uses padded plain text without backticks; whole-cell `` `code` `` still uses inline-code styling.
- CJK, emoji, and ZWJ sequences use grapheme-aware overlay padding (one cell per grapheme in `before.contentText`) with unified column widths so pipes align across rows.
- Responsive wrapping: when any column exceeds 80 characters of display width, the table switches to a viewport-capped pipe grid with word-wrapped cells (continuation lines keep empty padded columns and aligned `│` pipes). Rows covered by a prior row's wrap preview are hidden until the cursor is on that row, which reveals only that row's raw GFM. Compact grid tables still reveal the whole table when the cursor is inside them.
- Three-column wide grid section: compact pipe alignment at wide viewports (`npm run visual:tables` checks viewport 200).
