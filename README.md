# Markdown Inline Editor

<img src="assets/icon.png" align="right" alt="Markdown Inline Editor icon" width="120" height="120">

[![Build & quality][ci-img]][ci] [![Dependency health][audit-img]][audit] [![Install on VS Code][marketplace-img]][marketplace] [![Get on Open VSX][openvsx-img]][openvsx] [![MIT License][license-img]][license]

**Typora-like Markdown editing in VS Code.** Formatting renders inline with context-aware syntax shadowing, GFM tables, Mermaid and LaTeX math, hover previews, and clickable task lists.

Your files stay plain Markdown. The extension uses editor decorations only; it never rewrites your document.

| | |
|---|---|
| **Install** | [VS Code Marketplace][marketplace] · [OpenVSX][openvsx] · [Releases][releases] |
| **Docs** | [FAQ][faq] · [Changelog][changelog] · [Feature specs](docs/features/done/) |
| **Project** | [Repository][repo] · [Issues][issues] · [Contributing][contributing] |

**Requires:** VS Code 1.100.0+ (Cursor supported).

## Demo

<p align="center">
  <img src="assets/autoplay-demo.gif" alt="Markdown Inline Editor demo" width="900">
</p>

Move the cursor onto a line for faint ghost markers; click or select inside formatted text to reveal raw Markdown for editing.

## Quick start

1. Install from the [Marketplace][marketplace], [OpenVSX][openvsx], or [Releases][releases].
2. Open a supported file: `markdown`, `md`, `mdx`, `skill`, `markdoc`, `mdc`, `juliamarkdown`, or `rmarkdown`.
3. Type as usual - formatting appears inline while syntax stays hidden.
4. Toggle per file: Command Palette → **Toggle Markdown Decorations** (`mdInline.toggleDecorations`) or the editor title bar eye icon ([per-file toggle](docs/features/done/per-file-toggle.md)).

Decorations not showing? See the [FAQ][faq].

## Syntax shadowing

Three visibility states adapt to where you are editing:

| State | When | What you see |
|-------|------|----------------|
| **Rendered** | Default | Formatted content; markers hidden |
| **Ghost** | Cursor on the line | Faint markers on that line (default 30% opacity) |
| **Raw** | Cursor or selection inside a construct | Full syntax for that construct |

**Notes:** Blockquotes, lists, and checkboxes stay rendered on the active line unless you click the marker. Headings show raw `#` on the heading line. Tables switch the whole table to raw when the cursor is anywhere inside it. Ordered lists can show computed numbers when `orderedLists.autoNumber` is on (default).

Common settings: `markdownInlineEditor.decorations.ghostFaintOpacity` (default `0.3`), `markdownInlineEditor.emojis.enabled` (default `true`). More in [syntax shadowing](docs/features/done/syntax-shadowing.md).

## Supported features

- **Text:** bold, italic, bold+italic, strikethrough, inline code
- **Structure:** headings, links, autolinks, images, blockquotes, horizontal rules, GFM pipe tables
- **Lists:** unordered, ordered (auto-numbering), task lists (click to toggle)
- **Rich content:** fenced code blocks, YAML frontmatter, emoji shortcodes, Mermaid diagrams, LaTeX math (`$...$`, `$$...$$`, `` ```math ``)
- **GitHub-style:** mentions and issue references (`@user`, `#123`, etc.)
- **Workflow:** per-file decoration toggle, raw Markdown in diffs by default, customizable syntax colors

Per-feature behavior: [docs/features/done/](docs/features/done/).

## Settings (optional)

Search Settings for **Markdown Inline Editor** (`markdownInlineEditor.*`).

| Area | Keys (defaults) |
|------|-----------------|
| Ghost markers | `decorations.ghostFaintOpacity` (`0.3`) |
| Diffs | `defaultBehaviors.diffView.applyDecorations` (`false`) |
| Links | `links.singleClickOpen` (`false`), `links.showEmoji` (`false`) |
| Math / emoji | `math.enabled` (`true`), `emojis.enabled` (`true`) |
| Ordered lists | `orderedLists.autoNumber` (`true`), `orderedLists.warnWhenSourceNumberDiffers` (`true`) |
| Mentions | `mentions.enabled` (`true`); links infer from `git remote` when unset |
| Colors | `colors.heading1` … `colors.checkbox` (15 keys) |

Example:

```json
{
  "markdownInlineEditor.decorations.ghostFaintOpacity": 0.25,
  "markdownInlineEditor.defaultBehaviors.diffView.applyDecorations": false,
  "markdownInlineEditor.links.singleClickOpen": false
}
```

## Commands

- **Toggle Markdown Decorations** (`mdInline.toggleDecorations`) - enable or disable inline rendering for the current file (persisted per URI).

## Optional companion extensions

- [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one) - shortcuts, TOC, preview helpers
- [Mermaid Chart](https://marketplace.visualstudio.com/items?itemName=MermaidChart.vscode-mermaid-chart) - Mermaid authoring tools

## Roadmap

Open a PR or comment on the linked issue to help.

- Default feature activation ([spec](docs/features/todo.md#default-feature-activation))
- Table column alignment with markup ([#21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21))
- Default decorator on/off for new files ([spec](docs/features/todo.md#default-decorator-rendering))
- Image UX improvements ([spec](docs/features/todo.md#image-ux-improvements))
- Highlighting support ([spec](docs/features/todo.md#highlighting-support))
- HTML tags ([#29](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/29))
- Footnotes ([#32](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/32))

## Development

```bash
git clone https://github.com/SeardnaSchmid/markdown-inline-editor-vscode.git
cd markdown-inline-editor-vscode
npm install
npm run validate   # lint:docs + test + build
```

Press `F5` to launch the Extension Development Host. See [CONTRIBUTING.md][contributing] and [AGENTS.md][agents] for workflow, architecture, and conventions.

## Known limitations

- GFM tables: limited multi-line cells and complex inline alignment ([#21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21))
- H1 on the first line may clip ([#4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/4))
- Very large files (~1MB+) may parse more slowly ([FAQ][faq])
- A non-interactive **Markdown Inline** activity bar entry hosts the Mermaid webview ([FAQ][faq])

Report bugs via [Issues][issues] (include VS Code version, extension version, and steps to reproduce).

## License

MIT - see [LICENSE.txt][license].

## Acknowledgments

Inspired by [markdown-inline-preview-vscode](https://github.com/domdomegg/markdown-inline-preview-vscode), [Markdown WYSIWYG](https://marketplace.visualstudio.com/items?itemName=remcohaszing.markdown-decorations), [markless](https://github.com/tejasvi/markless), [Typora](https://typora.io/), and [Obsidian](https://obsidian.md/).

Contributors: [@patrick-yip](https://github.com/patrick-yip), [@bircni](https://github.com/bircni), [@ssebs](https://github.com/ssebs), [@IrishBruse](https://github.com/IrishBruse).

[ci-img]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml/badge.svg
[ci]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml
[audit-img]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/npm-audit.yml/badge.svg?branch=main
[audit]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/npm-audit.yml
[repo]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode
[releases]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/releases
[issues]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues
[changelog]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/CHANGELOG.md
[contributing]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/CONTRIBUTING.md
[agents]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/AGENTS.md
[faq]: docs/FAQ.md
[license]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/LICENSE.txt
[marketplace]: https://marketplace.visualstudio.com/items?itemName=CodeSmith.markdown-inline-editor-vscode
[openvsx]: https://open-vsx.org/extension/CodeSmith/markdown-inline-editor-vscode
[marketplace-img]: https://img.shields.io/visual-studio-marketplace/v/CodeSmith.markdown-inline-editor-vscode?label=Install%20on%20VS%20Code&logo=visualstudiocode&logoColor=white
[openvsx-img]: https://img.shields.io/open-vsx/v/CodeSmith/markdown-inline-editor-vscode?label=Get%20on%20Open%20VSX&logo=openvsx&logoColor=white
[license-img]: https://img.shields.io/badge/License-MIT-555555?labelColor=blue
