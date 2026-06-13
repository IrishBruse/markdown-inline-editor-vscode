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
| a    |   b    |     c |

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

| Label | URL |
|-------|-----|
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
|----|------|
| Hi | 你好 |

| Name | CJK  |
| ---- | ---- |
| AB   | 你好 |

| Col      | Val      |
| -------- | -------- |
| Hiragana | ひらがな |

| Col    | Val  |
| ------ | ---- |
| Hangul | 안녕 |

| Col   | Val |
| ----- | --- |
| Emoji | 😀  |

| Col    | Val |
| ------ | --- |
| Family | 👨‍👩‍👧  |

| Col  | Val |
| ---- | --- |
| Flag | 🇯🇵  |

| Name | CJK  | Emoji |
| ---- | ---- | ----- |
| AB   | 你好 | 😀    |
| CD   | 世界 | 🚀    |

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

| Col | Note |
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

## Custom mode: long cell wrapping


| Section Header | Detailed Placeholder Content                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row 1          | Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.                                                 |
| Row 2          | Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.                                                         |
| Row 3          | Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.                                |
| Row 4          | Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.                                                                                      |
| Row 5          | At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.                                                                                        |
| Row 6          | Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.                                                                                                                                                |
| Row 7          | Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.                                                                           |
| Row 8          | Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident. |
| Row 9          | Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.                                                                                            |
| Row 10         | Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.                |

Expected with `custom`: the table renders as a bordered grid with wrapped cells (like Markdown preview). Source GFM is hidden while the overlay is shown. Click inside the table to edit raw markdown (same as `selection-reveal`).

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

- Rendered: pipe grid, aligned columns, markers hidden.
- Cursor anywhere in table: **entire table** goes raw (all rows).
- Mixed heavy formatting in one cell may fall back to raw (known limitation).
- `custom` rendering mode: SVG overlay with wrapped cells; click table to edit source.
