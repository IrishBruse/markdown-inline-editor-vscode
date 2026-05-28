# GFM tables

## Basic

| Name | Role |
|------|------|
| Ada  | Lead |
| Bob  | Dev  |

## Column alignment

| Left | Center | Right |
|:-----|:------:|------:|
| L    |   C    |     R |
| long |  mid   |   1.0 |

## Inline formatting in cells

| Plain | **Bold** | *Italic* | `code` |
|-------|----------|----------|--------|
| ok    | loud     | soft     | mono   |

## Links in cells

| Label | URL |
|-------|-----|
| [Docs](../../README.md) | local |

## Wide / CJK (padding)

| EN | 中文 |
|----|------|
| Hi | 你好 |

## Snake_case and math-like (should not strip underscores)

| field_name | a * b |
|------------|-------|
| value      | 12    |

---

**Checks**

- Rendered: pipe grid, aligned columns, markers hidden.
- Cursor anywhere in table: **entire table** goes raw (all rows).
- Mixed heavy formatting in one cell may fall back to raw (known limitation).
