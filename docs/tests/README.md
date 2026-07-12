# Visual test fixtures

Markdown files for **manual** testing of [Markdown Inline Editor](../../README.md) in VS Code or Cursor.

## How to use

1. Open this folder in the extension development host (`F5`) or with the extension installed.
2. Confirm decorations are on (title bar eye icon, or **Toggle Markdown Decorations**).
3. Open a fixture below; move the cursor and click inside constructs to exercise **Rendered / Ghost / Raw** states.
4. For diff behavior, use **Compare** on a file against a edited copy (decorations off by default in diffs).

## Fixtures

| File | What to check |
|------|----------------|
| [01-headings.md](01-headings.md) | H1-H6 styling, raw `#` on active heading line |
| [02-text-formatting.md](02-text-formatting.md) | Bold, italic, strikethrough, inline code, emoji |
| [03-lists.md](03-lists.md) | Unordered, ordered auto-numbering, task lists, nesting |
| [04-links-images.md](04-links-images.md) | Links, images, autolinks, hover + click |
| [05-tables.md](05-tables.md) | GFM grid, alignment, inline in cells, table raw mode |
| [06-blockquotes-rules.md](06-blockquotes-rules.md) | Blockquotes, horizontal rules |
| [07-code-frontmatter.md](07-code-frontmatter.md) | Fenced blocks, frontmatter delimiters |
| [08-math.md](08-math.md) | `$...$`, `$$...$$`, `` ```math `` |
| [09-mermaid.md](09-mermaid.md) | Inline Mermaid diagrams |
| [10-mentions.md](10-mentions.md) | `@user`, `#123`, `@org/team`, repo refs |
| [11-syntax-shadowing.md](11-syntax-shadowing.md) | Guided 3-state cursor exercises |
| [12-edge-cases.md](12-edge-cases.md) | Nested/mixed constructs, tricky boundaries |
| [smoke-all.md](smoke-all.md) | One-page pass over common features |

## Automated overlay preview (tables)

From the repo root:

```bash
npm run visual:tables
```

Regenerates reports, runs table regression tests, and fails on new pipe misalignments. Outputs:

- `dist/visual/report.json` - machine-readable pass/fail summary
- `dist/visual/05-tables.txt` - source vs rendered overlay text
- `dist/visual/05-tables.html` - browser preview

Known edge-case misalignments are listed in `src/visual/table-visual-baseline.json`.

## Tips

- Toggle decorations per file to compare raw vs rendered.
- Change `markdownInlineEditor.decorations.ghostFaintOpacity` to make ghost markers easier to see.
- Use the **Markdown Inline Editor** output channel when `markdownInlineEditor.debug.logging.enabled` is on.
