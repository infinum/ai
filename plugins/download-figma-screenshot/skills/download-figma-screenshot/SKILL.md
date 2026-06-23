---
name: download-figma-screenshot
description: Download Figma screenshots to disk. Use when the user wants to save Figma frame screenshots as image files. Triggers on "download Figma screenshot", "save Figma screenshot", "figma screenshot to file", "figma to docs". Not Cowork-ready — hits `localhost:3845` and `api.figma.com`, both unreachable from the sandbox.
---

# Figma Screenshot Download

Figma MCP tools (`get_screenshot`, `get_design_context`) return images inline in the conversation — the LLM can see them but cannot save them to disk. This skill provides two methods to download screenshots as files.

**Try Method A first**; fall back to Method B if the local MCP server is unavailable.

---

## Workflow

When invoked as `/download-figma-screenshot <Figma URL or node ID> <output path>`:

1. **Parse the first argument.**
   - If it's a Figma URL (e.g. `https://www.figma.com/design/NZZ6hy1pXHM1uXsqxGkHc3/...?node-id=562-39156`), extract the `fileKey` from the path segment after `/design/` or `/file/`, and the `node-id` from the query string.
   - If it's a raw node ID, accept it directly. If `fileKey` is not otherwise known and Method B might be needed, ask the user for the Figma file URL or file key.
   - Normalize the node ID: `NODE_ID="${NODE_ID//-/:}"` (the scripts below already do this).
2. **Determine the output path.** Use the second argument. If missing, ask the user where to save the screenshot. The scripts create the parent directory automatically.
3. **Pick the method.**
   - Try **Method A** first — it needs no token. Check for a reachable MCP server at `http://127.0.0.1:3845/mcp`.
   - If MCP is unreachable but `FIGMA_TOKEN` is set, fall back to **Method B**.
   - If neither is available, tell the user what's missing (start the Figma desktop app with MCP enabled, or set `FIGMA_TOKEN`) and stop.

---

## Method A — Local Figma Desktop MCP via HTTP (preferred, no auth)

Call the local Figma Desktop MCP server at `localhost:3845` via raw HTTP. This uses the MCP JSON-RPC protocol over HTTP with SSE responses. No auth token needed — just requires the Figma desktop app running with MCP server enabled.

Run this bash script for each screenshot, substituting `NODE_ID` and `OUTPUT_PATH`:

```bash
#!/usr/bin/env bash
set -euo pipefail

NODE_ID="<nodeId>"         # e.g. "562:42262"
OUTPUT_PATH="<output.png>" # e.g. "documentation/images/accounts-overview.png"

NODE_ID="${NODE_ID//-/:}"  # normalize "562-42262" → "562:42262"

MCP_URL="http://127.0.0.1:3845/mcp"
HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

# Initialize MCP session
INIT_RESPONSE=$(curl -sS -f -i -X POST "$MCP_URL" "${HEADERS[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"figma-screenshot","version":"1.0.0"}}}')
SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "mcp-session-id:" | tr -d '\r' | awk '{print $2}')

if [ -z "$SESSION_ID" ]; then
  echo "Error: Could not get MCP session ID. Is Figma desktop app running with MCP enabled?" >&2
  exit 1
fi

# Send initialized notification
curl -sS -f -X POST "$MCP_URL" "${HEADERS[@]}" -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null 2>&1

# Call get_screenshot
TMPFILE=$(mktemp)
trap "rm -f '$TMPFILE'" EXIT

SCREENSHOT_PAYLOAD=$(jq -cn --arg nodeId "$NODE_ID" \
  '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"get_screenshot",arguments:{nodeId:$nodeId}}}')
curl -sS -f -X POST "$MCP_URL" "${HEADERS[@]}" -H "Mcp-Session-Id: $SESSION_ID" \
  -d "$SCREENSHOT_PAYLOAD" \
  -o "$TMPFILE"

# Extract base64 image and save as PNG
mkdir -p "$(dirname "$OUTPUT_PATH")"

python3 - "$TMPFILE" "$OUTPUT_PATH" <<'PY'
import json, base64, sys
tmpfile, output_path = sys.argv[1], sys.argv[2]
with open(tmpfile) as f:
    raw = f.read()
for line in raw.split('\n'):
    if line.startswith('data: '):
        data = json.loads(line[6:])
        break
else:
    print('Error: No data in MCP response', file=sys.stderr); sys.exit(1)
if 'error' in data:
    print(f"Error: {data['error'].get('message', 'Unknown')}", file=sys.stderr); sys.exit(1)
for item in data.get('result', {}).get('content', []):
    if item.get('type') == 'image':
        img = base64.b64decode(item['data'])
        with open(output_path, 'wb') as f:
            f.write(img)
        print(f'Saved {len(img)} bytes to {output_path}')
        sys.exit(0)
print('Error: No image in response', file=sys.stderr); sys.exit(1)
PY
```

For each screenshot, copy this script into a Bash tool call, substituting `NODE_ID` and `OUTPUT_PATH`. You can run multiple downloads in parallel.

---

## Method B — Figma REST API with Token (fallback)

If the local MCP server is unavailable, use the Figma REST API. This requires a `FIGMA_TOKEN` environment variable (personal access token).

```bash
FILE_KEY="<fileKey>"        # e.g. "NZZ6hy1pXHM1uXsqxGkHc3"
NODE_ID="<nodeId>"          # e.g. "562:39156"
OUTPUT_PATH="<output.png>"  # e.g. "documentation/images/accounts-overview.png"

NODE_ID="${NODE_ID//-/:}"   # normalize "562-39156" → "562:39156"

EXPORT_JSON=$(mktemp "${TMPDIR:-/tmp}/figma-export.XXXXXX.json")
trap 'rm -f "$EXPORT_JSON"' EXIT

# Step 1: Request image export (multiple node IDs can be comma-separated)
curl -sS -f -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=$NODE_ID&format=png&scale=2" \
  -o "$EXPORT_JSON"

# Step 2: Extract the temporary image URL from JSON response
IMAGE_URL=$(python3 - "$EXPORT_JSON" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
print(list(d['images'].values())[0])
PY
)

# Step 3: Download the image
mkdir -p "$(dirname "$OUTPUT_PATH")"
curl -sS -f -o "$OUTPUT_PATH" "$IMAGE_URL"
```

**Getting the token:** If `FIGMA_TOKEN` is not set, ask the user to create one at Figma → Settings → Security → Personal access tokens.

**Batch downloads:** Multiple node IDs can be comma-separated in a single API call:
```bash
curl -sS -f -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=562:42262,562:42339&format=png&scale=2"
```

---

## Notes

- **MCP inline images cannot be saved to disk directly.** That's why this skill exists.
- **Prefer Method A** — no token needed, works with the Figma desktop app.
- The `node-id` URL parameter uses `-` as separator (e.g. `562-39156`). Normalize it to `:` form (e.g. `562:39156`) before using — Method B (Figma REST API) requires `:`, and normalizing keeps the scripts consistent with the rest of this repo (see `skills/ui-validation/SKILL.md`). Both methods in this skill do the replacement automatically.
- Method B requires both `fileKey` and the normalized `nodeId` (parsed from the Figma URL). Method A only needs the normalized `nodeId`.
