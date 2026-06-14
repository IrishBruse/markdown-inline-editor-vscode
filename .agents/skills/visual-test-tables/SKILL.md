---
name: visual-test-tables
description: >-
  Automatically runs and verifies the table overlay visual check for
  markdown-inline-editor-vscode (docs/tests/05-tables.md). Use proactively
  whenever table parsing, padding, alignment, decorations, or the tables fixture
  change; before completing any table-related task; or when the user mentions
  table visual testing.
---

# Visual test tables (automatic)

This skill is **fully automatic**. Do not ask the user whether to run checks. Execute the workflow yourself whenever table-related code or fixtures change.

## Automatic triggers

Run the full check without prompting when you:

- Edit `src/parser/tables.ts`, table logic in `src/parser/core.ts`, table decorations, or `docs/tests/05-tables.md`
- Finish implementing or fixing table rendering behavior
- Are about to mark a table task complete or open a table-related PR

If Cursor hooks are installed (`npm run visual:tables:setup-hooks`), post-edit context may already be injected. Still read `dist/visual/report.json` and fix failures before finishing.

## Automatic workflow

Execute these steps in order. Do not skip unless the change cannot affect tables (for example typo-only edits outside table code).

### 1. Run the full check

```bash
npm run visual:tables
```

This single command:

1. Regenerates `dist/visual/05-tables.html`, `dist/visual/05-tables.txt`, and `dist/visual/report.json`
2. Runs all table regression tests
3. Fails on **new** misalignments (known edge cases are baselined in `src/visual/table-visual-baseline.json`)

### 2. Read machine report

Always read `dist/visual/report.json` after the command. Fields:

| Field | Meaning |
| --- | --- |
| `passed` | `true` when no new misalignments beyond baseline |
| `newMisalignments` | Regressions you must fix |
| `misalignedTables` | All misaligned tables including known baseline cases |
| `totalTables` | Tables rendered from the fixture |

For detail on failures, read only the flagged sections in `dist/visual/05-tables.txt`.

### 3. Fix and rerun until green

If `npm run visual:tables` fails or `report.passed` is `false`:

1. Fix the regression in table code or update the fixture/baseline intentionally
2. Rerun `npm run visual:tables`
3. Repeat until the command exits 0

Do not hand off a table change with a failing visual check.

### 4. Update baseline only when intentional

Add to `src/visual/table-visual-baseline.json` only when a misalignment is an accepted product limitation, not a bug. Never add new entries to mask regressions.

## Hook setup (one-time per clone)

```bash
npm run visual:tables:setup-hooks
```

Installs `.cursor/hooks.json` from `.agents/hooks/` so table-related edits auto-run the check and inject results into agent context. Re-run after cloning the repo.

## Extension host (only when needed)

The automated check does not cover cursor raw mode, link clicks, or theme styling. Use **Run Extension (05-tables fixture)** only when those behaviors changed.

## Completion report

Include this automatically in your final response when table files were touched:

```markdown
## Table visual check

- Command: npm run visual:tables (exit 0)
- Report: dist/visual/report.json
- Tables: N total, M known misaligned, 0 new
```

If the check failed and you fixed it, note what regressed and what changed.

## Rules

- **Never** skip the check after table rendering changes
- **Never** ask the user for permission to run `npm run visual:tables`
- **Never** commit `dist/visual/` output
- Prefer `report.json` over manual re-parsing of the fixture
- Add fixture rows and tests when introducing new table scenarios
