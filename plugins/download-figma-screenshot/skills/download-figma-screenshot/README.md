# Download Figma Screenshot

Download Figma screenshots to disk.

## The problem

Figma MCP tools (`get_screenshot`, `get_design_context`) return images inline in the conversation — the LLM can see them but cannot save them to disk. This skill provides two methods to download screenshots as local image files:

- **Method A (preferred):** Calls the local Figma Desktop MCP server (`localhost:3845`) via raw HTTP, extracts base64 image data from the JSON-RPC/SSE response, and decodes it to a PNG file. No auth token needed.
- **Method B (fallback):** Uses the Figma REST API (`api.figma.com/v1/images/...`) with a personal access token to get temporary S3 URLs for node exports.

## When to use

- Saving Figma frame screenshots as local image files
- Any time you need a Figma screenshot on disk rather than inline in the conversation

## Usage

```
/download-figma-screenshot:download-figma-screenshot <Figma URL or node ID> <output path>
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

## Requirements

- **Method A:** Figma desktop app running with MCP server enabled, `curl`, `python3`, `jq`
- **Method B:** `FIGMA_TOKEN` environment variable set to a Figma personal access token
