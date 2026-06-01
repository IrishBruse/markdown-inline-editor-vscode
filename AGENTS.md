# AI Agent Guide for Markdown Inline Editor

Guidelines for AI agents and contributors working in this repository.

## Quick start checklist

Before committing:

1. Read this file and [CONTRIBUTING.md](CONTRIBUTING.md)
2. Change code only under `src/` (not `dist/`)
3. Add or update tests in the matching `__tests__/` directory
4. Run `npm run validate` (lint, unit tests, CRLF tests, build)

## Project context

**What this extension does:**

- Renders Markdown inline (WYSIWYG-style) using VS Code `TextEditorDecorationType`
- Parses with [remark](https://github.com/remarkjs/remark) and applies decorations
- Supports links, images, headings, lists, code blocks, tables, Mermaid, math, mentions, and more

**Tech stack:** TypeScript (strict), VS Code Extension API, remark, Vitest, esbuild.

## Repository layout

### Source (`src/`)

| Area | Key files |
|------|-----------|
| Entry | `extension.ts`, `config.ts` |
| Parsing | `parser.ts`, `parser/core.ts`, `parser-remark.ts`, `markdown-parse-cache.ts` |
| Decorations | `decorations.ts`, `decorator.ts`, `decorator/*` |
| Links | `link-provider.ts`, `link-hover-provider.ts`, `image-hover-provider.ts`, `link-click-handler.ts`, `link-targets.ts` |
| Positions | `position-mapping.ts`, `diff-context.ts` |
| Commands / wiring | `commands/`, `registration/` |

### Documentation (`docs/`)

- **`docs/tests/`** - Markdown fixtures for **manual** visual QA (headings, tables, Mermaid, syntax shadowing, etc.). See [docs/tests/README.md](docs/tests/README.md).
- There is no `docs/features/` or `docs/FAQ.md` in this fork; do not add links to those paths.

### Generated / do not edit

- `dist/` - build output
- `assets/mermaid/` - vendored Mermaid bundles (via `npm run copy:mermaid`)

## Commands

```bash
npm run validate    # lint + test + test:crlf + build (run before PRs)
npm test            # unit tests (Vitest)
npm run build       # production bundle + .vsix
npm run test:e2e    # extension tests in VS Code (CI)
npm run test:e2e:cursor  # e2e in local Cursor (dev only)
npm run test:e2e:visual  # PNG visual regression for custom table rendering
```

## Critical rules

**Parsing and performance**

- Use `markdown-parse-cache.ts` for parses; do not parse the full document on every selection change
- Use `position-mapping.ts` for CRLF/LF-safe ranges
- Handle parse errors gracefully (log, return empty decorations)

**Decorations**

- Use factories in `decorations.ts` and the decoration-type registry
- Respect the visibility model (Rendered / Ghost / Raw) in `decorator/visibility-model.ts`

**Tests**

- Place tests beside modules: `src/<module>/__tests__/<module>.test.ts`
- Mock the VS Code API following existing patterns
- For UI-visible behavior, update or add a fixture under `docs/tests/`
- For custom table rendering changes, run `npm run test:e2e:visual` to verify the VS Code PNG baseline does not regress. Fixtures live under `src/test/e2e/fixtures/tables-visual/`; if the visual change is intentional, update baselines with `npm run test:e2e:visual:update`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(parser): add support for task lists
fix(decorator): cache decorations on selection change
docs: update manual test fixture for tables
```

## Upstream

This fork tracks [SeardnaSchmid/markdown-inline-editor-vscode](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode). Remote `upstream` is the original repo; `origin` is this fork. Prefer small, focused PRs when contributing code back upstream.

## Definition of done

- [ ] Tests added or updated for behavior changes
- [ ] Custom table rendering changes pass `npm run test:e2e:visual` or include an intentionally updated PNG baseline
- [ ] README / CONTRIBUTING / `docs/tests/` updated when user-facing or manual QA changes
- [ ] `npm run validate` passes
