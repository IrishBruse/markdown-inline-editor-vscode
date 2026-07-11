#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Visual table tests are not installed as git hooks by default.

Run manually after table-related changes:

  npm run visual:tables

Outputs land in dist/visual/:
  - report.json
  - 05-tables.txt
  - 05-tables.html

To auto-run from Cursor after edits, add a hook entry that runs:
  npm run visual:tables

See docs/tests/README.md for fixture guidance.
EOF
