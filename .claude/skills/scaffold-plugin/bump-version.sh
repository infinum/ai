#!/usr/bin/env bash
set -euo pipefail

# Usage: bash .claude/skills/scaffold-plugin/bump-version.sh <plugin-name> [major|minor|patch]
# Bumps the version in plugins/<plugin-name>/.claude-plugin/plugin.json.
# Defaults to "patch". The marketplace entry has no version field — plugin.json
# is the single source of truth (matches Claude Code docs guidance).

PLUGIN_NAME="${1:?Usage: bump-version.sh <plugin-name> [major|minor|patch]}"
BUMP_TYPE="${2:-patch}"

PLUGIN_JSON="plugins/${PLUGIN_NAME}/.claude-plugin/plugin.json"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

if [[ ! -f "$PLUGIN_JSON" ]]; then
  echo "Error: $PLUGIN_JSON not found. Did you pass the right plugin name?" >&2
  exit 1
fi

OLD_VERSION=$(jq -r '.version' "$PLUGIN_JSON")
IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"

case "$BUMP_TYPE" in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  *) echo "Error: bump type must be major, minor, or patch (got: $BUMP_TYPE)" >&2; exit 1 ;;
esac

jq --arg v "$NEW_VERSION" '.version = $v' "$PLUGIN_JSON" > "${PLUGIN_JSON}.tmp"
mv "${PLUGIN_JSON}.tmp" "$PLUGIN_JSON"

echo "Bumped ${PLUGIN_NAME}: ${OLD_VERSION} -> ${NEW_VERSION}"
