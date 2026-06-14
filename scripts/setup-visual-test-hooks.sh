#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURSOR_DIR="$ROOT/.cursor"
HOOKS_DIR="$CURSOR_DIR/hooks"
AGENTS_HOOKS="$ROOT/.agents/hooks"

mkdir -p "$HOOKS_DIR"
install -m 755 "$AGENTS_HOOKS/visual-test-tables.sh" "$HOOKS_DIR/visual-test-tables.sh"
install -m 755 "$AGENTS_HOOKS/visual-test-tables-stop.sh" "$HOOKS_DIR/visual-test-tables-stop.sh"
cp "$AGENTS_HOOKS/hooks.json" "$CURSOR_DIR/hooks.json"

echo "Installed Cursor hooks:"
echo "  $CURSOR_DIR/hooks.json"
echo "  $HOOKS_DIR/visual-test-tables.sh"
echo "  $HOOKS_DIR/visual-test-tables-stop.sh"
echo ""
echo "Restart Cursor or reload hooks if they do not fire immediately."
