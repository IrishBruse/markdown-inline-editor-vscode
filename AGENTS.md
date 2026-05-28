# AI Agent Guide for Markdown Inline Editor


## Project Context

**What This Project Does:**
- VS Code extension that renders markdown syntax inline (WYSIWYG-style)
- Uses VS Code TextEditorDecorationType to hide/show markdown syntax
- Parses markdown using remark and applies visual decorations
- Supports links, images, headings, lists, code blocks, and more

**Tech Stack:**
- TypeScript (strict mode)
- VS Code Extension API
- [remark](https://github.com/remarkjs/remark) for markdown parsing
- Vitest for testing
- esbuild for bundling

## Project Structure

### Source Code (`/src/`)

**Core Files:**
- `extension.ts` - Extension entry point, activation, command registration
- `config.ts` - Centralized configuration access (VS Code settings)
- `parser.ts` - Stable parser facade exporting parser API and shared parser types
- `parser/core.ts` - Main markdown parser implementation, converts AST to decoration ranges
- `parser/types.ts` - Shared parser result and decoration type definitions
- `parser-remark.ts` - Remark parser setup and utilities
- `decorations.ts` - Decoration type factories (transparent, faint, etc.)
- `decorator.ts` - Decoration orchestration facade, coordinates parsing and application

**Specialized Modules:**
- `diff-context.ts` - Detects diff views and applies policies
- `link-targets.ts` - Resolves link/image URLs (relative, absolute, workspace)
- `link-interactions/shared.ts` - Shared link target/range resolution used by provider, hover, and click flows
- `markdown-parse-cache.ts` - Caching layer for parsed markdown (performance critical)
- `position-mapping.ts` - Handles CRLF/LF normalization for position calculations
- `language-support.ts` - Shared list of supported markdown-like language IDs and document selectors

**Feature Modules:**
- `link-provider.ts` - Makes links clickable (DocumentLinkProvider)
- `link-hover-provider.ts` - Shows link URLs on hover
- `image-hover-provider.ts` - Shows image previews on hover
- `link-click-handler.ts` - Handles single-click navigation
- `commands/` - User-facing command registrations and implementations
- `registration/` - Provider and event-wiring helpers used by `extension.ts`

**Decoration System:**
- `decorator/decoration-type-registry.ts` - Manages decoration type lifecycle
- `decorator/visibility-model.ts` - 3-state filtering (Rendered/Ghost/Raw)
- `decorator/checkbox-toggle.ts` - Handles checkbox clicks
- `decorator/decoration-categories.ts` - Categorizes decoration types
- `decorator/file-decoration-state.ts` - Persists and migrates per-file enable/disable state
- `decorator/update-scheduler.ts` - Debounced and idle update scheduling
- `decorator/editor-decoration-applier.ts` - Range creation, scope entry building, and decoration application helpers
- `decorator/mermaid-update-coordinator.ts` - Async Mermaid rendering and decoration coordination

**Test Directories:**
- Each module has a corresponding `__tests__/` directory
- Test files use `.test.ts` extension
- Follow naming: `module-name.test.ts`

### Other Directories

- `/dist/` - Compiled output (DO NOT EDIT - generated files)
- `/docs/` - Documentation, feature specs, analysis
- `/scripts/` - Build and release automation
- `/assets/` - Icons and static files
