# Table rendering smoke checks

Automated coverage lives in `src/parser/__tests__/parser-table.test.ts` and
`src/decorator/__tests__/visibility-model.test.ts` (alignment, native vs synthetic cells,
whole-table raw reveal, wide characters, and edge cases).

For manual checks in the Extension Development Host: open any Markdown file, insert a small
GFM table (blank line before the table, separator row with at least three hyphens per column),
then move the caret into and out of the table. The whole table should switch to raw markdown
while the caret is on any row of that table.

Example:

| A | B |
|---|---|
| 1 | 2 |
