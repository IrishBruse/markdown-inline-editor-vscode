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
Captures the long-cell wrapping table at multiple window sizes (default: 800x600, 960x720, 1280x800, 1600x900).
The editor is relaunched per size via Playwright CDP.
Frames are written to `screenshots/` and the first frame is copied to `screenshot.png`.

Override sizes with `WINDOW_SIZES=960x720,1400x900 npm run screenshot:long-cell-wrapping`.

Review `screenshot.png` and confirm wrapping, alignment, and decorations look correct.
Fix regressions before finishing.

Requires `code` on PATH (`CODE_BIN`, `CDP_PORT` to override). Uses Playwright only (no xdotool or other OS-specific tooling).
