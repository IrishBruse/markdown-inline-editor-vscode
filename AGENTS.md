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
npm run screenshot:long-cell-wrapping
```

Launches VS Code Extension Development Host with `docs/` as the workspace and opens `tests/long-cell-wrapping.md`.
Captures the long-cell wrapping table at one window size (default: 800x600).
Pass width and height as two numbers: `npm run screenshot:long-cell-wrapping -- 1280 800`.
Or set `WINDOW_WIDTH` and `WINDOW_HEIGHT` together.
Frames are written to `screenshots/`.

Review those screenshots and confirm wrapping, alignment, and decorations look correct.
Fix regressions before finishing.

Requires `code` on PATH (`CODE_BIN`, `CDP_PORT` to override). Uses Playwright only (no xdotool or other OS-specific tooling).

### Overlay regression check

```bash
npm run visual:tables
```

Overlay output is written to `dist/visual/`.
Use to verify pipe alignment and responsive layout before stopping.
