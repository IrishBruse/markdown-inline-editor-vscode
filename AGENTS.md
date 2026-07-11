# AI Agent Guide for Markdown Inline Editor

Guidelines for AI agents and contributors working in this repository.

## Project context

**What this extension does:**

- Renders Markdown inline (WYSIWYG-style) using VS Code `TextEditorDecorationType`
- Parses with [remark](https://github.com/remarkjs/remark) and applies decorations
- Supports links, images, headings, lists, code blocks, tables, Mermaid, math, mentions, and more

**Tech stack:** TypeScript (strict), VS Code Extension API, remark, Vitest, esbuild.

## Visual table testing

After table rendering or layout changes, agents must run both checks below without asking.

### Extension host screenshot

```bash
npm run screenshot:tables
```

Launches VS Code Extension Development Host with `docs/` as the workspace, opens `tests/05-tables.md`, scrolls to the long-cell wrapping table (line 326),
and writes `screenshot.png` at the repo root.

Review `screenshot.png` and confirm wrapping, alignment, and decorations look correct.
Fix regressions before finishing.

Requires `code` on PATH (`CODE_BIN`, `CDP_PORT` to override).
