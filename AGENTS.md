# AI Agent Guide for Markdown Inline Editor

Guidelines for AI agents and contributors working in this repository.

## Project context

**What this extension does:**

- Renders Markdown inline (WYSIWYG-style) using VS Code `TextEditorDecorationType`
- Parses with [remark](https://github.com/remarkjs/remark) and applies decorations
- Supports links, images, headings, lists, code blocks, tables, Mermaid, math, mentions, and more

**Tech stack:** TypeScript (strict), VS Code Extension API, remark, Vitest, esbuild.

