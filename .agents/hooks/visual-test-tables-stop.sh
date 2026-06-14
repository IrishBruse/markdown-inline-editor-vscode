#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

input="$(cat)"
status="$(node -e '
const input = JSON.parse(process.argv[1]);
const text = JSON.stringify(input);
const tablePattern = /(?:parser\/tables\.ts|parser\/core\.ts|decorations\.ts|decorator\.ts|05-tables\.md|table-render-preview|table-syntax|parser-table)/;
process.stdout.write(tablePattern.test(text) ? "yes" : "no");
' "$input" 2>/dev/null || echo no)"

if [[ "$status" != "yes" ]]; then
  exit 0
fi

if [[ -f dist/visual/report.json ]]; then
  if node -e '
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync("dist/visual/report.json", "utf8"));
if (report.passed) process.exit(0);
process.stdout.write(JSON.stringify({
  followup_message: "Run npm run visual:tables and fix any new table misalignments before finishing.",
}));
'; then
  exit 0
fi
fi

node -e '
process.stdout.write(JSON.stringify({
  followup_message: "Run npm run visual:tables to verify docs/tests/05-tables.md overlay alignment before finishing.",
}));
'

exit 0
