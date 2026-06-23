#!/bin/sh
# End-to-end probe for the cross-platform MCP translator's ownership policy.
#
# Verifies two paths against a real scratch filesystem:
#
#   1. CONFLICT-SKIP — when a client config already has an entry with the
#      same name the plugin wants to write, and the manifest doesn't show
#      the installer wrote it, we leave the existing entry alone.
#
#   2. OWNED-OVERWRITE — when the manifest claims we wrote the entry on a
#      prior run, a re-run replaces it with the current plugin version
#      (legitimate plugin update path).
#
# Useful for manual reproduction and for catching regressions in
# `bin/lib/mcp.js` that the unit tests in `test/` might miss (the unit
# tests use scratch dirs too, but this probe runs against the real
# resolvePluginPath / readJsonOrEmpty / writeFile chain).
#
# Exits 0 on success, non-zero with a diagnostic on failure.
# Cleans up the scratch dir on exit.

set -e

SCRATCH=$(mktemp -d -t infinum-mcp-probe.XXXXXX)
trap 'rm -rf "$SCRATCH"' EXIT

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)

# --- Setup ----------------------------------------------------------------

# 1. Plant a fake plugin under <scratch>/.claude/plugins/marketplaces/.../
PLUGIN_DIR="$SCRATCH/.claude/plugins/marketplaces/test-mp/plugins/test-plugin"
mkdir -p "$PLUGIN_DIR/.claude-plugin"

cat > "$PLUGIN_DIR/.claude-plugin/plugin.json" <<'JSON'
{ "name": "test-plugin", "version": "1.0.0", "description": "scratch probe" }
JSON

cat > "$PLUGIN_DIR/.mcp.json" <<'JSON'
{
  "mcpServers": {
    "demo": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js", "--from-plugin"]
    }
  }
}
JSON

# 2. Plant the client config with a USER-set entry under the same name
#    PLUS an unrelated entry that must survive every run.
CLIENT_CFG="$SCRATCH/claude_desktop_config.json"
cat > "$CLIENT_CFG" <<'JSON'
{
  "mcpServers": {
    "demo": {
      "command": "my-own-tool",
      "args": ["--with-my-flags"]
    },
    "unrelated": {
      "command": "leave-me-alone"
    }
  }
}
JSON

# --- Pass 1: conflict-skip ------------------------------------------------

echo "[1/2] Conflict-skip path: empty manifest, user-set entry present"

HOME="$SCRATCH" node --input-type=module --eval "
import { registerPluginMcp } from '$REPO_ROOT/bin/lib/mcp.js';
const result = await registerPluginMcp({
  marketplaceName: 'test-mp',
  pluginName: 'test-plugin',
  clients: [{ name: 'ScratchDesktop', configPath: process.env.HOME + '/claude_desktop_config.json' }],
  mcpRegistrations: {},
});
const r = result.results[0];
if (r.status !== 'skipped-conflict' || r.skipped[0] !== 'demo') {
  console.error('FAIL: expected skipped-conflict on demo, got:', JSON.stringify(result));
  process.exit(1);
}
if (result.writtenTo.ScratchDesktop.length !== 0) {
  console.error('FAIL: writtenTo should be empty on skip, got:', JSON.stringify(result.writtenTo));
  process.exit(1);
}
" || { echo "✘ Pass 1 logic failed"; exit 1; }

# Verify the file on disk is byte-identical to what we wrote at setup.
DEMO_CMD=$(node --input-type=module --eval "
const fs = await import('node:fs/promises');
const j = JSON.parse(await fs.readFile('$CLIENT_CFG', 'utf8'));
console.log(j.mcpServers.demo.command);
")
if [ "$DEMO_CMD" != "my-own-tool" ]; then
  echo "✘ Pass 1: user's 'demo' entry was modified (command became: $DEMO_CMD)"
  exit 1
fi

UNRELATED_CMD=$(node --input-type=module --eval "
const fs = await import('node:fs/promises');
const j = JSON.parse(await fs.readFile('$CLIENT_CFG', 'utf8'));
console.log(j.mcpServers.unrelated.command);
")
if [ "$UNRELATED_CMD" != "leave-me-alone" ]; then
  echo "✘ Pass 1: 'unrelated' entry was modified"
  exit 1
fi

echo "  ✓ user-set 'demo' preserved"
echo "  ✓ 'unrelated' preserved"
echo "  ✓ status=skipped-conflict, writtenTo.ScratchDesktop=[]"

# --- Pass 2: owned-overwrite ---------------------------------------------

echo "[2/2] Owned-overwrite path: manifest claims we own demo, re-run"

HOME="$SCRATCH" node --input-type=module --eval "
import { registerPluginMcp } from '$REPO_ROOT/bin/lib/mcp.js';
const result = await registerPluginMcp({
  marketplaceName: 'test-mp',
  pluginName: 'test-plugin',
  clients: [{ name: 'ScratchDesktop', configPath: process.env.HOME + '/claude_desktop_config.json' }],
  mcpRegistrations: {
    'test-mp/test-plugin': {
      serverNames: ['demo'],
      writtenTo: { ScratchDesktop: ['demo'] }
    }
  }
});
const r = result.results[0];
if (r.status !== 'registered' || r.skipped.length !== 0) {
  console.error('FAIL: expected registered with no skips, got:', JSON.stringify(result));
  process.exit(1);
}
if (!result.writtenTo.ScratchDesktop.includes('demo')) {
  console.error('FAIL: writtenTo should include demo, got:', JSON.stringify(result.writtenTo));
  process.exit(1);
}
" || { echo "✘ Pass 2 logic failed"; exit 1; }

# Verify the on-disk demo entry is now the plugin's version (with the
# template var substituted to the absolute scratch plugin path).
DEMO_CMD=$(node --input-type=module --eval "
const fs = await import('node:fs/promises');
const j = JSON.parse(await fs.readFile('$CLIENT_CFG', 'utf8'));
console.log(j.mcpServers.demo.command);
")
if [ "$DEMO_CMD" != "node" ]; then
  echo "✘ Pass 2: 'demo' command should be 'node' (plugin's version), got: $DEMO_CMD"
  exit 1
fi

FIRST_ARG=$(node --input-type=module --eval "
const fs = await import('node:fs/promises');
const j = JSON.parse(await fs.readFile('$CLIENT_CFG', 'utf8'));
console.log(j.mcpServers.demo.args[0]);
")
case "$FIRST_ARG" in
  *'/test-plugin/server.js')
    ;;
  *)
    echo "✘ Pass 2: first arg should be substituted plugin path, got: $FIRST_ARG"
    exit 1
    ;;
esac

# 'unrelated' must STILL be preserved.
UNRELATED_CMD=$(node --input-type=module --eval "
const fs = await import('node:fs/promises');
const j = JSON.parse(await fs.readFile('$CLIENT_CFG', 'utf8'));
console.log(j.mcpServers.unrelated.command);
")
if [ "$UNRELATED_CMD" != "leave-me-alone" ]; then
  echo "✘ Pass 2: 'unrelated' entry was modified"
  exit 1
fi

echo "  ✓ 'demo' replaced with plugin version"
echo "  ✓ \${CLAUDE_PLUGIN_ROOT} substituted to absolute plugin path"
echo "  ✓ 'unrelated' still preserved"

echo
echo "✓ Both paths behave as expected."
