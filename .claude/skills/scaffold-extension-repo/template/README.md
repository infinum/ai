# infinum/__REPO_NAME__

__OWNER_LABEL__ AI plugins and rules. This repository is an **extension marketplace** (`__MARKETPLACE_NAME__`) layered on top of the public [infinum/ai](https://github.com/infinum/ai) stack — it holds only what is specific to the __OWNER_LABEL__; the installer, house rules, PSDD workflow, and shared plugins stay in the base. Visibility: **__VISIBILITY__**. Owner: __OWNER__.

## Plugins

| Plugin | Description |
| --- | --- |
| [`__PLUGIN_NAME__`](plugins/__PLUGIN_NAME__/README.md) | TODO — one line on what the plugin does. |

## Rule bundles

| Bundle | Description |
| --- | --- |
| [`__BUNDLE_NAME__`](rules/__BUNDLE_NAME__/README.md) | TODO — one line on what the bundle enforces. Opt-in via `--bundles __BUNDLE_NAME__`. |

## Install

### Via the Infinum AI installer (preferred)

One command installs the base stack **and** layers this marketplace on top, remembers it for later re-runs, and includes it in the session-start update banner:

```bash
pnpm dlx github:infinum/ai \
  --extend infinum/__REPO_NAME__ \
  --plugins __PLUGIN_NAME__ --bundles __BUNDLE_NAME__
```

Prerequisites: Claude Code CLI, Node 24+, pnpm 10, 11 or 12. <!-- private-only:start -->This repository is private — installing needs Infinum GitHub access (SSH key or `gh auth login`).<!-- private-only:end -->

What the installer adds over a bare marketplace add: the opt-in rule bundles, MCP servers mirrored into Claude Desktop / Cursor / Gemini CLI, an apt-style remembered source list (later plain `pnpm dlx … github:infinum/ai` runs pull from here automatically), and update notifications when this repo changes. Remove it again with `--remove infinum/__REPO_NAME__`.

### Claude Code, directly

Plugins only, no rule bundles or update banner:

```
/plugin marketplace add infinum/__REPO_NAME__
/plugin install __PLUGIN_NAME__@__MARKETPLACE_NAME__
```

### Claude Desktop and Cowork

Once an org admin has granted the Claude GitHub App access to this repository and added the marketplace at the organisation level, the plugins can be installed from **Settings → Plugins** in Claude Desktop and used from Cowork. Plugins that need local tooling do not work there; each plugin's README states its Cowork readiness.


## Layout

```
__REPO_NAME__/
├── .claude-plugin/
│   └── marketplace.json           # marketplace manifest (lists plugins)
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/plugin.json
│       ├── README.md
│       └── skills/<skill-name>/SKILL.md
├── rules/
│   └── <bundle-name>/             # opt-in rule bundle
│       ├── README.md              # first non-heading line = installer prompt hint
│       └── <rule>.md
├── AGENTS.md                      # rules for humans and agents (CLAUDE.md imports it)
└── README.md
```

## Adding a plugin

1. Create `plugins/<plugin-name>/.claude-plugin/plugin.json` (start at `1.0.0`).
2. Add skills under `plugins/<plugin-name>/skills/<skill-name>/SKILL.md`.
3. Add `plugins/<plugin-name>/README.md`.
4. Append `{ "name": "<plugin-name>", "source": "./plugins/<plugin-name>" }` to `.claude-plugin/marketplace.json`.
5. Add a row to the Plugins table above.

## Changing a plugin

**Bump `version` in `plugins/<plugin-name>/.claude-plugin/plugin.json` on every change** — patch for fixes, minor for additions, major for breaking changes. Claude Code only picks up plugin updates when the version changes. See [AGENTS.md](AGENTS.md).

For plugin structure, cross-platform MCP, and runtime dependencies follow the [infinum/ai contributing guide](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md).
