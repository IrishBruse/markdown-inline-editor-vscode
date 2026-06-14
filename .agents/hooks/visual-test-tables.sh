#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

input="$(cat)"
touched="$(node -e '
const input = JSON.parse(process.argv[1]);
const candidates = [];

function addPath(value) {
  if (typeof value !== "string") return;
  if (value.includes("/") || value.endsWith(".ts") || value.endsWith(".md")) {
    candidates.push(value);
  }
}

function walk(value) {
  if (typeof value === "string") {
    addPath(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item);
  }
}

walk(input.tool_input);
walk(input.args);
walk(input.file_path);
walk(input.path);

const tablePattern = /(?:parser\/tables\.ts|parser\/core\.ts|decorations\.ts|decorator\.ts|05-tables\.md|table-render-preview|table-syntax|parser-table)/;
process.stdout.write([...new Set(candidates)].some((path) => tablePattern.test(path)) ? "yes" : "no");
' "$input" 2>/dev/null || echo no)"

if [[ "$touched" != "yes" ]]; then
  exit 0
fi

if ! npm run visual:tables > /tmp/visual-test-tables.log 2>&1; then
  log_tail="$(tail -n 20 /tmp/visual-test-tables.log)"
  node -e '
const fs = require("node:fs");
const reportPath = "dist/visual/report.json";
let summary = "Table visual check failed after a table-related edit.";
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const labels = (report.newMisalignments ?? []).map((item) => item.label).join(", ");
  summary = `Table visual check failed (${report.totalTables} tables, ${report.newMisalignments?.length ?? 0} new misalignments${labels ? `: ${labels}` : ""}).`;
}
process.stdout.write(JSON.stringify({
  additional_context: `${summary}\n\nFix table alignment regressions, then rerun npm run visual:tables.\n\n${process.argv[1]}`,
}));
' "$log_tail"
  exit 0
fi

node -e '
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync("dist/visual/report.json", "utf8"));
const labels = (report.misalignedTables ?? []).map((item) => item.label).join(", ");
const known = labels ? ` Known misalignments: ${labels}.` : "";
process.stdout.write(JSON.stringify({
  additional_context: `Table visual check passed automatically (${report.totalTables} tables, 0 new misalignments).${known} Reports: dist/visual/report.json, dist/visual/05-tables.txt`,
}));
'

exit 0
