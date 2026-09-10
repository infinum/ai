# Contributing

This repo is a [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces). Most of what's here today is skills, but a plugin can ship much more than that — this guide walks through the full surface area, how to add each component type, and a few gotchas we've already hit.

For the user-facing harness overview, see [README.md](README.md); for the PSDD workflow specifically, see [psdd/README.md](psdd/README.md).

## Contribution policy and licensing

This repository is published under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](LICENSE). That license governs what **downstream users** may do with the work (noncommercial use only, with attribution). It does **not** bind Infinum: as the copyright holder and licensor, Infinum retains the right to use, relicense, and commercially license the work and every contribution to it. The rules below exist to keep that IP chain clean.

**Who may contribute.** By default, contributions are accepted only from employees of **the Infinum group** — Infinum and its subsidiaries and affiliates, currently including **ETR**, **Your Majesty**, and **AMR**, plus any subsidiary or affiliate Infinum adds in the future. Work an Infinum-group employee produces in the course of their employment is owned by their employer, so these contributions are Infinum's intellectual property.

**Terms for Infinum-group contributions.** All such contributions are made as part of the work licensed under the main [LICENSE](LICENSE), with copyright held by Infinum as licensor. Because Infinum owns the copyright, it may use, sublicense, and commercially license the combined work and any individual contribution on any terms, without further permission from the contributing employee or subsidiary.

**Outside contributions are not accepted by default.** Pull requests and patches from anyone outside the Infinum group are **declined by default** and require explicit maintainer triage before they can be considered. This is the current policy and may change. If you are not an Infinum-group employee:

- Prefer opening an **issue** that describes the change, rather than a PR.
- If you do open a PR, expect it to be triaged — most will be closed with thanks. We do **not** merge third-party code without a deliberate review of provenance and licensing, because accepting outside contributions under this noncommercial license (CC BY-NC 4.0) would encumber Infinum's ability to license the work commercially.

**For maintainers triaging an outside PR:** confirm the contributor's provenance and the licensing of every changed line before merging. Absent that confirmation, close the PR — do not merge.

> This section documents intent; it is not legal advice. If you are formalizing the IP/CLA position, have Infinum's legal team review both this section and the wording in [LICENSE](LICENSE).

## Prerequisites

- **Node 24** — pinned in `package.json` `engines.node`.
- **pnpm 12** — pinned in `packageManager`; `engines.pnpm` accepts 11 and 12. Install pnpm via [pnpm.io/installation](https://pnpm.io/installation) (the simplest path is `corepack enable` on Node 24, which activates the version listed in `packageManager` automatically).

Then, from a clone of this repo:

```bash
pnpm install
pnpm run hooks            # one-time: points git at .githooks/ so the pre-commit plugin validation runs
pnpm run setup            # registers the published infinum/ai marketplace from GitHub (main branch)
pnpm run setup:local      # registers THIS checkout as the marketplace — use when iterating on plugin code or installer changes
```

`pnpm run setup` always points at `github.com/infinum/ai` regardless of what branch you're on. When you're testing changes to a plugin or to `bin/install.js` itself, use `setup:local` (equivalent to `node bin/install.js --local`) so the marketplace resolves to your working tree. The installer warns you when local mode is active.

If a previous run registered the marketplace from the other source, the installer won't silently overwrite it — it'll print a one-line `remove + re-run` instruction. To switch sources cleanly:

```bash
claude plugin marketplace remove infinum-ai
pnpm run setup:local      # or `pnpm run setup` for the GitHub version
```

## Git hooks

The repo ships a pre-commit hook in `.githooks/pre-commit` that runs `claude plugin validate` on every plugin manifest. Git does not pick up hooks from a tracked directory on its own, so run this once after cloning:

```bash
pnpm run hooks            # = git config core.hooksPath .githooks
```

This used to happen automatically through a `prepare` lifecycle script. It no longer does: pnpm runs the lifecycle scripts of a package fetched from GitHub only when the caller approves them, and from pnpm 11.25 and in pnpm 12 the approval key must be the repository URL rather than the package name. Every `pnpm dlx github:infinum/ai` user would have had to pass that key for a hook setup that is meaningless in a `dlx` tarball. Keeping the package free of lifecycle scripts keeps the install one-liner short and works on every pnpm version, at the cost of this one manual step for contributors. If you skip it, nothing breaks locally, but an invalid manifest can reach a PR: a plugin with an unrecognized root key in `plugin.json` commits fine but never appears in the marketplace listing, because Claude Code silently drops invalid plugins. Run the same check manually any time:

```bash
pnpm run validate:plugins
```

The hook skips with a warning if `claude` isn't on PATH (so doc-only contributors aren't blocked), and `git commit --no-verify` bypasses it in a pinch.

## Installer dependencies

`bin/install.js` has a single direct dependency: `@clack/prompts`, **pinned to an exact version** (no caret) in `package.json`. The reason is that `pnpm-lock.yaml` is only honored when a contributor runs `pnpm install` from a clone — but most users install via `pnpm dlx github:infinum/ai`, and `pnpm dlx` ignores `pnpm-lock.yaml`. Without an exact pin, those two paths could resolve to different versions of `@clack/prompts`, defeating the lockfile.

When you want to upgrade `@clack/prompts` (or add another dep), bump the version in `package.json` explicitly and re-run `pnpm install` to refresh `pnpm-lock.yaml`. There's no auto-patch; we accept that small toil in exchange for installs that are bit-identical regardless of which command bootstrapped them.

## What a plugin can contain

A Claude Code plugin is a directory under `plugins/<plugin-name>/` with a manifest at `.claude-plugin/plugin.json`. Beyond that, it can include any combination of:

| Component | Location in plugin | Format | Example here |
|---|---|---|---|
| **Skill** | `skills/<name>/SKILL.md` | Markdown + YAML frontmatter | Most plugins |
| **Slash command** | `commands/<name>.md` | Markdown + frontmatter | none yet |
| **Subagent** | `agents/<name>.md` | Markdown + frontmatter | none yet |
| **Hook** | `hooks/hooks.json` (or in `plugin.json` `hooks` field) | JSON config + script | [`stack-essentials`](plugins/stack-essentials/) |
| **MCP server** | `.mcp.json` (or in `plugin.json` `mcpServers` field) | JSON config | none yet |
| **Helper script** | `scripts/<name>.sh` (called by hooks/commands) | Shell or any executable | none yet |

A single plugin can mix component types — one plugin could ship a skill plus a hook plus an MCP server. The current "one-skill-per-plugin" pattern in this repo is a convention, not a constraint.

Reference: [Claude Code plugin reference](https://docs.claude.com/en/docs/claude-code/plugins-reference).

### What plugins can't ship

CLAUDE.md-style instructions that load globally on every session are **not** distributed via plugins — Claude Code has no plugin hook for "append to `~/.claude/CLAUDE.md`". For that, see [Adding rules](#adding-rules-claudemd-style-content) below.

## How to add each component type

### Skills

Use the `/scaffold-plugin` skill to scaffold a new plugin:

```
/scaffold-plugin
```

This creates `plugins/<plugin-name>/` with its own `plugin.json` (starting at `1.0.0`), one or more `SKILL.md` + `README.md` pairs under `skills/`, optional companion components (MCP server, commands, agents, hooks), registers the plugin in `.claude-plugin/marketplace.json`, and updates the Skills table in `MARKETPLACE.md`. Or do it manually:

1. Create `plugins/<skill-name>/.claude-plugin/plugin.json` with `name`, `version: "1.0.0"`, `description`, and `keywords` (all plugin metadata lives here).
2. Create `plugins/<skill-name>/skills/<skill-name>/SKILL.md` with the skill content.
3. Add a new entry to the `plugins[]` array in `.claude-plugin/marketplace.json` with just `name` and `source` — nothing else needs duplicating.
4. Add a row to the Skills table in `MARKETPLACE.md`.
5. Commit and push to `main`.

### Slash commands

A slash command is a Markdown file under `commands/` whose frontmatter declares its trigger. Once installed, the user invokes it as `/<plugin>:<command-name>`.

```
plugins/<plugin-name>/
└── commands/
    └── <command-name>.md
```

Reference: [Slash commands](https://docs.claude.com/en/docs/claude-code/slash-commands).

### Subagents

Subagents are specialized agents Claude can delegate to. Each is a Markdown file under `agents/` with a description, allowed tools, and a system prompt.

```
plugins/<plugin-name>/
└── agents/
    └── <agent-name>.md
```

Reference: [Subagents](https://docs.claude.com/en/docs/claude-code/sub-agents).

### Hooks

Hooks fire on lifecycle events (PreToolUse, PostToolUse, SessionStart, etc.) and run shell commands. Define them either in `plugin.json` under `hooks`, or in a separate `hooks/hooks.json` file. Helper scripts they invoke live under `scripts/`.

```
plugins/<plugin-name>/
├── hooks/hooks.json        # or hooks field in plugin.json
└── scripts/<script>.sh     # called by the hook
```

Reference: [Hooks reference](https://docs.claude.com/en/docs/claude-code/hooks).

### MCP servers

A plugin can declare MCP servers it expects to be available, either in `plugin.json` under `mcpServers` or in a sibling `.mcp.json`. Declaring here means installing the plugin auto-configures the server in Claude Code.

For plugins that should also run inside Claude Desktop / Gemini CLI / Cursor, see [Cross-platform MCP](#cross-platform-mcp) below — the installer can mirror your `.mcp.json` into those clients.

Reference: [MCP](https://docs.claude.com/en/docs/claude-code/mcp).

> **Portability note.** Plugins that rely on a local MCP server (anything bound to `localhost`) behave very differently in the Claude Code terminal app versus Cowork / Claude Desktop. The Cowork shell sandbox cannot reach the host's `localhost`, and there is no user-controllable setting to allowlist it. See **[COWORK-LIMITATIONS.md](COWORK-LIMITATIONS.md)** for what works in each environment and how to design plugins that degrade gracefully.

### Combination plugins

The component types above are not mutually exclusive. A plugin's directory can contain `skills/`, `commands/`, `agents/`, `hooks/`, `scripts/`, and an MCP config side by side — install once and the user gets all of them.

## How Claude Code installs and loads plugin contents

This section captures things we learned the hard way during the sa-assistant migration — some are documented but easy to miss, some aren't documented at all and we figured them out empirically. Plugin authors should read this once; it'll save a debugging session later.

### Where plugins live on disk

Two layouts depending on how the marketplace was added:

| Marketplace source | Plugin install path |
|---|---|
| Local directory (`/plugin marketplace add ./` or `add /abs/path`) | `~/.claude/plugins/marketplaces/<marketplace>/plugins/<plugin>/` |
| Remote (git URL, GitHub repo) | `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` with a `.in_use` marker file in the active version's dir |

Two things to keep in mind:

- The **versioned-cache layout** means the install path *changes on every plugin version bump*. Don't hard-code absolute paths inside skill or bin scripts — use the template variables below.
- The plugin's files in `cache/` are owned by Claude Code: they may be re-extracted on update, so anything writeable (state files, generated configs, OAuth tokens) belongs in a user-owned location like `~/.claude/<your-plugin>/` or `~/.config/<your-plugin>/`, **not** inside the plugin's own directory.

References: [Plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference), [Plugins overview](https://docs.claude.com/en/docs/claude-code/plugins).

### Template variables — which file expands which

Claude Code substitutes different template variables in different files. **Mixing them up is the most common gotcha.** Concrete rules:

| Variable | Where it's expanded | Where it's NOT |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | In `.mcp.json` (at MCP config read time) and in hook commands declared in `hooks/hooks.json` / `plugin.json` (per the [Hooks reference](https://docs.claude.com/en/docs/claude-code/hooks)). Both substitute to the absolute install path. | **Not** in `SKILL.md`, slash commands, agents. In skill Bash blocks it expands to an empty string. |
| `${CLAUDE_SKILL_DIR}` | In `SKILL.md` content (substituted at skill render time, with the absolute skill directory path) | Not in `.mcp.json`. |
| `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}` | In `SKILL.md` content | Same as above |

So:
- To reference plugin-relative files from `.mcp.json` or a hook command, use `${CLAUDE_PLUGIN_ROOT}` (see [`stack-essentials/hooks/hooks.json`](plugins/stack-essentials/hooks/hooks.json) for a working example, or Anthropic's official Discord plugin for the `.mcp.json` form).
- To reference plugin-relative bin scripts from a skill's Bash block, use `${CLAUDE_SKILL_DIR}/../../bin/...` — you have to walk up out of `skills/<name>/` yourself because there's no `${CLAUDE_PLUGIN_ROOT}` expansion for skills. (Yes, we wish there was.)

Reference: [Skills — Available string substitutions](https://docs.claude.com/en/docs/claude-code/skills).

### plugin.json schema — only declared fields

Claude Code runs `plugin.json` through a strict validator. **Unknown root keys make the entire plugin invisible** in the marketplace listing — Claude Code silently drops invalid plugins from the picker without an error. We hit this when we tried to use a custom `"mcp": { "crossPlatform": true }` field as an opt-in flag.

To verify locally: `claude plugin validate plugins/<your-plugin>`. The pre-commit hook in `.githooks/pre-commit` runs this on every plugin manifest, so most contributors won't hit it twice — but if you bypass the hook, or never ran `pnpm run hooks` after cloning, expect this failure mode.

Stick to the documented fields: `name`, `version`, `description`, `keywords`, `author`, `homepage`, `repository`, `license`, plus the component-host fields (`hooks`, `mcpServers`). If you need to signal something to a tool, use file presence (e.g., presence of `.mcp.json` as an implicit opt-in) instead of a custom field.

Reference: [Plugins reference — plugin.json schema](https://docs.claude.com/en/docs/claude-code/plugins-reference).

### MCP server scope, precedence, and dedup

Claude Code merges MCP server entries from multiple sources with this **documented precedence order** (highest → lowest):

```
local  >  project (.mcp.json)  >  user (~/.claude.json)  >  plugin-provided  >  claude.ai connectors
```

(`managed`, via MDM/policy, sits above all of these but isn't relevant for our marketplace.) Dedup runs in two flavors depending on what you're comparing:

- **Between the three user-facing scopes** (local, project, user): duplicates match **by name**. Identical names in different scopes resolve to the highest-precedence one.
- **Plugins (and claude.ai connectors) vs higher scopes**: duplicates match **by endpoint** (URL or command). If a plugin server points at the same URL/command as something at a higher scope, the plugin entry is **suppressed** — it doesn't appear in `/mcp` at all.

**Plugin MCPs stay at plugin scope — there is no scope promotion.** A plugin-shipped server is loaded from the plugin's `.mcp.json` and stays there for its lifetime. The `/mcp` UI namespaces it as `plugin:<plugin-name>:<server-name>` (e.g., `plugin:sa:productive`). It is **not** copied into `~/.claude.json` on OAuth or any other lifecycle event.

For OAuth-based remote servers (`type: "http"` with `/mcp` auth), the access token is stored in the system keychain, keyed against the plugin+server pair. Plugin updates that re-extract the cache directory don't invalidate the keychain entry — the grant survives version bumps without JSON bookkeeping.

> Earlier versions of this guide twice mis-explained the OAuth behavior — first as a token-persistence mechanism, then as UX/URL-pinning. Both wrong. The actual story is the simpler one above. The observation that originally seeded the wrong stories — a `productive` entry appearing in `~/.claude.json` — turned out to be a user-scope entry that suppressed the plugin's `productive` by endpoint match (see below). Leaving this retraction in for anyone reading the earlier text.

#### What this means in practice

**Same endpoint at a higher scope hides the plugin's server entirely.**
If a user has run `claude mcp add productive --transport http https://mcp.productive.io/mcp` (which writes to local or user scope depending on `--scope`), the sa plugin's `plugin:sa:productive` disappears from `/mcp` — even though the plugin is installed and loaded. The user sees one `productive` entry, the higher-scope one. Removing the higher-scope entry un-masks the plugin's version. **Verified empirically**: clean `pnpm setup:local` shows `plugin:sa:productive`; running `claude mcp add productive ...` afterward removes it from the listing and shows the new local/user-scope entry instead.

**Same name but different endpoint at higher scope: undocumented.** Name doesn't trigger the plugin-vs-scope dedup — only endpoint does. So in theory both could surface, but we haven't tested this combination.

**Two plugins shipping the same endpoint: undocumented and possibly buggy.** Dedup-by-endpoint is documented between plugins and *higher* scopes; the spec is silent on plugin-vs-plugin. There's a known bug ([anthropics/claude-code#32549](https://github.com/anthropics/claude-code/issues/32549)) where dedup logic introduced in 2.1.71 incorrectly suppresses servers *within* the same plugin when they share a command — if that pass also runs across plugins, two plugins shipping the same MCP endpoint could randomly hide each other. Treat plugin-vs-plugin collisions as undefined behavior until tested.

> **Future improvement under consideration.** The installer (`bin/install.js`) could detect the suppression case at install time — for any plugin entry whose endpoint matches an existing user/local/project-scope entry, surface it to the user with a one-liner like `"productive is already configured at user scope and shadows the plugin's version"` and offer to remediate (e.g., remove the shadow so the plugin's version takes effect, or replace the user-scope entry's config with the plugin's). Open design questions: how to handle a user-scope entry whose `command`/`args`/`env` differs from the plugin's, and whether removing the shadow should invalidate any OAuth grant the user has against that endpoint. Not implemented; tracked here as an idea so a future PR has a starting point.

#### Implications for plugin authors

- **A user can shadow your plugin's server.** If your plugin ships `productive` and the user has previously added their own `productive` at the same endpoint, your version is dormant on their machine until they remove it. They may not realize this — `/mcp` shows only one entry. Worth a note in your README if name collisions are likely.
- **Plugin updates can change `command`/`args`/`url` freely** — the change lands at plugin scope on next install. For OAuth servers, whether the existing keychain token still works against a new URL depends on Claude Code's keying scheme (we haven't probed); document URL migrations in release notes.
- **Plugin uninstall removes plugin-scope entries from `/mcp` but not the keychain credential** for OAuth servers. Tell users in your plugin's README how to fully revoke (e.g., "revoke the OAuth grant in the provider's UI after uninstall").
- **Pick server names defensively.** The `plugin:<plugin>:<server>` UI prefix prevents *display* confusion between plugins, but doesn't prevent dedup-by-endpoint suppression. If your endpoint is the well-known canonical one for a public service (e.g., the Productive MCP URL), expect that some users will already have it configured at a higher scope and your version will be invisible to them.

References: [MCP — connecting Claude Code to tools](https://docs.claude.com/en/docs/claude-code/mcp) (precedence + dedup rules), [Claude Code settings](https://docs.claude.com/en/docs/claude-code/settings), [anthropics/claude-code#32549](https://github.com/anthropics/claude-code/issues/32549) (within-plugin dedup bug).

### Marketplace listing vs plugin install — what runs when

A useful mental model for the install flow:

1. `claude plugin marketplace add <source>` — clones the marketplace repo to `~/.claude/plugins/marketplaces/<name>/`. **Validates every plugin's manifest** against the schema; invalid plugins are silently omitted from the listing (this is the silent-drop case the pre-commit hook protects against).
2. `claude plugin install <plugin>@<marketplace>` — for local-source plugins this is a metadata add; for remote-source plugins it extracts to `cache/<m>/<p>/<v>/`. Either way, **Claude Code does NOT run `npm install`** if the plugin ships a `package.json`. That's the plugin author's responsibility (see [Plugin runtime dependencies](#plugin-runtime-dependencies) below).
3. The plugin is now visible to Claude Code. Slash commands with `user-invocable: true` appear in `/`; MCP servers in `.mcp.json` are loaded; hooks fire on their declared events.

There's no `postinstall` hook in the plugin lifecycle. If your plugin needs setup that goes beyond what Claude Code does automatically (OAuth flows, model downloads, building a local DB), surface that as a user-invocable skill (`/your-plugin:setup`) and document it in your README — it can't run automatically.

## Versioning

- Each plugin owns its own `version` in its `plugin.json` (`plugins/<plugin-name>/.claude-plugin/plugin.json`). Bump only the plugin you changed; the other plugins keep their existing versions.
- Do **not** add a `version` field to the marketplace entry. Per Claude Code docs, when both are set, `plugin.json` always wins silently — keeping it in only one place avoids the precedence trap.
- Use the `bump-version.sh` helper to bump a single plugin: `bash .claude/skills/scaffold-plugin/bump-version.sh <plugin-name> [major|minor|patch]` (defaults to `patch`).
- Follow semver: `MAJOR.MINOR.PATCH`. Users only receive an update when this field changes.

## Gotcha: marketplace `source` paths

The Claude Code docs suggest you can set `metadata.pluginRoot: "./plugins"` and then write `"source": "create-prd"` (bare) for each plugin entry. **This does not work** as of the current CLI:

- `claude plugin validate` rejects bare names: `plugins.0.source: Invalid input` (sources must start with `./`).
- When `source` starts with `./`, it's resolved relative to the *marketplace root*, ignoring `pluginRoot` entirely. So `"./create-prd"` with `pluginRoot: "./plugins"` looks for `<repo>/create-prd`, not `<repo>/plugins/create-prd`, and install fails with `Source path does not exist`.

**What works:** drop `pluginRoot` and use full paths — `"source": "./plugins/<plugin-name>"`. That's what this marketplace does.

## Adding rules (CLAUDE.md-style content)

For shared instructions that should load on every Claude Code session — preferences, workflow conventions, glossaries — drop a Markdown file into [`rules/`](rules/). The install script copies everything in there to `~/.claude/infinum/` and chains them from a single `index.md` that's imported by `~/.claude/CLAUDE.md`.

Two flavors:

- **House rules** — files placed directly at `rules/<name>.md` are auto-installed for everyone.
- **Opt-in bundles** — subfolders like `rules/<bundle>/*.md` are prompted at install (TTY) so users can pick the role-specific bundles they want (e.g., a `rules/<team>/` bundle for team-specific instructions). In a non-interactive shell (an LLM, CI, or a piped `pnpm dlx`), pass `--bundles <names|all|none>` instead of being prompted; `--plugins` does the same for plugins, and `node bin/install.js --help` prints the live list of available rules, bundles, and plugins.

To add a house rule:

1. Create `rules/<name>.md`.
2. Push to `main`.
3. Users pick it up next time they run `pnpm dlx github:infinum/ai` (or `pnpm run setup` from a clone).

To add a bundle:

1. Create `rules/<bundle>/<name>.md` (or several files) and an optional `rules/<bundle>/README.md` whose first non-heading line is shown as the prompt hint.
2. Push to `main`. The installer's multiselect prompt will surface the bundle automatically.

No install-script changes needed — both flat files and subfolders are picked up dynamically. See [`rules/README.md`](rules/README.md) for the contract (what's user-owned vs. repo-owned).

### Rules update notifications

Rules aren't carried by Claude Code's marketplace, so they only refresh when the user re-runs the installer. To close that loop, the [`stack-essentials`](plugins/stack-essentials/) plugin (auto-installed by `bin/install.js`) registers a `SessionStart` hook that nags the user when there's drift.

The contract — three artifacts under `~/.claude/infinum/`:

| File | Written by | Read by | Purpose |
|---|---|---|---|
| `.manifest.json` `sources[id].upstreamSha` (+ a top-level `rulesUpstreamSha` mirror for old hooks) | `bin/install.js` (best-effort `git ls-remote` per repo-name source at install; null on failure) | The hook | Per-source baseline SHA to compare against later |
| `.update-check.json` `{ lastCheckedAt, latest: { <upstream>: sha } }` | The hook (after each fetch), seeded by `bin/install.js` at install | The hook | 24-hour fetch cache; suppresses the banner when cached SHA matches baseline |
| `git ls-remote https://github.com/infinum/ai refs/heads/main` | n/a | Installer + hook | Authoritative HEAD SHA of `main` — uses the user's existing git credentials, which they need anyway to install the harness |

The hook iterates the manifest's `sources` and `git ls-remote`s each one's `upstream` (the public base plus any repo-name extension added via `--extend` — see [Extending with additional marketplaces](#extending-with-additional-marketplaces)). `ls-remote` uses the user's existing git credentials and returns the HEAD SHA of `main`, not specifically the latest commit touching `rules/` — so the banner can fire on a commit that didn't change any rules. Re-running the installer in that case is a no-op (it reports "no rule changes" and rewrites nothing), so the false-positive cost is "user ran a fast idempotent installer". Local-path extensions have no remote and aren't update-checked.

If you change anything that affects how rules ship — e.g. moving files out of `rules/`, changing where the installer writes them, renaming the manifest fields — update [`plugins/stack-essentials/hooks/check-rules-updates.mjs`](plugins/stack-essentials/hooks/check-rules-updates.mjs) and the installer in lockstep, and bump the plugin's `version` so existing users get the new script via auto-update.

## Extending with additional marketplaces

The installer isn't limited to the plugins and rules in this repo. `--extend <repo|path>` layers **another marketplace** — its plugins and rule bundles — on top of the public `infinum/ai` base, so tooling can be split across repos instead of piling into one. The extra marketplace can be:

- a **private** repo, to keep skills and rules internal (e.g. the SA assistant lives in `infinum/ai-private`);
- a **public** repo — another team's, or a separate concern you'd rather keep out of the main repo;
- a **local checkout**, for development.

Because a `marketplace.json` can only reference plugins inside its own repo (see [the gotcha above](#gotcha-marketplace-source-paths)), each extra source is its own marketplace; `--extend` composes them at install time and the shared installer pulls from all of them — no fork needed.

**Shape of an extension repo** — everything except the installer:

```
<org>/<extension-repo>/
├── .claude-plugin/marketplace.json   # a DISTINCT marketplace name (not "infinum-ai")
├── plugins/<plugin>/                 # the repo's plugins
└── rules/<bundle>/                   # optional rule bundle(s)
```

**Naming** — new extension repos follow `infinum/ai-{type}-{name}[-private]`: `{type}` is `team` or `project`, `{name}` is the kebab-case team or client name, and `-private` is appended exactly when the repo is private, so visibility is readable from the name (`infinum/ai-team-javascript`, `infinum/ai-team-javascript-private`, `infinum/ai-team-bizdev-private`, `infinum/ai-project-<client>-private`). The marketplace name mirrors it: `infinum-ai-team-javascript`. A team can have a public repo and a `-private` companion, the same split as the two core repos, `infinum/ai` and `infinum/ai-private` (which sit outside the template; `ai-private` is layered on with the same `--extend` mechanism but is a core repo, not a team or project one). A contributor skill in this repo proposes the names and generates the skeleton from a bundled template: clone `infinum/ai`, start Claude Code in the checkout, and run `/scaffold-extension-repo` (it lives in [`.claude/skills/scaffold-extension-repo/`](.claude/skills/scaffold-extension-repo/), not in a marketplace plugin — creating an extension repo is a rare, one-off job, so it is not installed for everyone).

**Install** — pass `--extend` to the public installer (repeatable; value is a GitHub `owner/repo` or a local checkout path):

```bash
pnpm dlx github:infinum/ai --extend <org>/<extension-repo> --bundles <bundle>
# local checkout, for development:
pnpm dlx github:infinum/ai --extend "$PWD" --bundles <bundle>
```

- **Repo-name vs local path.** A repo-name extension is shallow-cloned for its rules and its marketplace is registered by name (so plugins track GitHub) — a private repo needs git access, a public one just works. A local-path extension is read straight from disk and needs no auth (handy for testing).
- **Remembered (apt-style).** Once added, an extension persists in the manifest; later bare `pnpm dlx … github:infinum/ai` runs pull from it automatically. The installer prints the active source list each run. `--extend none` clears the remembered set (base-only).
- **Remove.** `--remove <org>/<extension-repo>` (or the marketplace name) uninstalls the extension's plugins (read live from `claude plugin list`), drops its rules/bundles + MCP entries, deregisters its marketplace, and forgets it. It refuses to remove the base.
- **Update notifications** cover repo-name extensions (see [Rules update notifications](#rules-update-notifications)).

**The installer aborts** if two sources share a marketplace name (a collision would shadow plugins in one cache dir — don't reuse `infinum-ai`), or if two sources ship a rule file or bundle with the same name (they share the one `~/.claude/infinum/` dir).

Extension repos hold only data — plugins, rules, their `marketplace.json` — never a copy of the installer (it's reused from `infinum/ai` via `pnpm dlx`). The composition *pattern* is public; a private extension keeps its own contents private while still layering on top of the public base.

## PR labeling: `ai-assisted`

Add the `ai-assisted` label to any pull request opened against an Infinum GitHub organisation repository where AI was involved in producing any part of the change — code generated, suggested, or modified. This applies to all contribution types: production code, tests, refactors, config, scripts, and snippets.

How to apply the label:

- **Manually** — in the PR's right sidebar, click **Labels** and select `ai-assisted`.
- **Automatically** — AI tools that open PRs follow the instruction in [`AGENTS.md`](AGENTS.md) at the repo root. Engineers who installed the harness also get this rule globally via the [`ai-assisted-prs`](rules/ai-assisted-prs.md) house rule, which lands in `~/.claude/CLAUDE.md` and applies across all their Infinum repos.

This rule applies org-wide — not only to this repository.

## Cross-platform MCP

By default, a plugin's `.mcp.json` only registers with Claude Code. For plugins that should also work in **Claude Desktop**, **Gemini CLI**, and **Cursor** (the same MCP server running outside Claude Code), you don't need to do anything beyond shipping the `.mcp.json` — the marketplace installer treats its presence as the opt-in signal.

(Claude Code's `plugin.json` validator rejects unknown root keys, so we can't use an explicit `"mcp": { "crossPlatform": true }` flag. Plugins that add custom fields get silently dropped from the marketplace. Using `.mcp.json` presence is also more honest: a plugin that ships an MCP server has, by definition, declared one.)

After install, the installer reads your plugin's `.mcp.json` and writes equivalent entries into each detected client's config. `.mcp.json` is the **single source of truth** — you don't duplicate the server definition.

**Ownership tracking — the installer never overwrites entries it didn't write.** The manifest at `~/.claude/infinum/.manifest.json` records per-plugin, per-client which server names this installer wrote. On every re-run, those names are owned (overwriting them is fine — that's how plugin updates take effect). Any other name in a client's config is treated as user-set or set by another tool, and is left alone. If a name conflicts, the installer prints a one-line "skipped — kept existing X" note and tells the user how to override (remove their entry manually, then re-run). This means: it's safe to re-run `pnpm run setup` even if you have hand-curated MCP entries in Claude Desktop / Cursor / Gemini — they'll survive.

To verify the ownership policy end-to-end against a real scratch filesystem (useful when changing `bin/lib/mcp.js`):

```bash
pnpm run probe:mcp-conflict
```

The probe plants a fake plugin + a scratch client config with a conflicting user-set entry, exercises both paths (skip when unowned, overwrite when owned), and exits non-zero with a diagnostic if either path behaves incorrectly. Self-cleaning. Source: [`scripts/probe-mcp-conflict-skip.sh`](scripts/probe-mcp-conflict-skip.sh).

Use `${CLAUDE_PLUGIN_ROOT}` in `args` (or anywhere in a server entry) to reference the plugin's install dir. Claude Code substitutes this automatically; the installer substitutes it with the absolute path when writing to non-Claude-Code clients. Example:

```jsonc
// plugins/<plugin>/.mcp.json
{
  "mcpServers": {
    "your-plugin": {
      "command": "npm",
      "args": ["run", "--prefix", "${CLAUDE_PLUGIN_ROOT}", "--silent", "start"]
    }
  }
}
```

Detected client config paths:

| Client | Config path |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Cursor | `~/.cursor/mcp.json` |

The installer skips silently when a client's config file is absent.

**Other tools** (GitHub Copilot in VS Code, OpenCode, Antigravity, Codex CLI) are not auto-registered — each plugin's README should document how to point them at the plugin's MCP server manually. The plugin path the user needs is `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` (or the equivalent under `marketplaces/` for local-source plugins).

## Plugin runtime dependencies

If your plugin's MCP server (or any bin script) has npm dependencies, follow the install-on-startup pattern used by Anthropic's official Discord / Telegram / iMessage plugins:

1. Ship a `package.json` at the plugin root with `dependencies`.
2. Add a `start` script that installs deps then starts the server:

   ```json
   {
     "scripts": {
       "start": "npm install --omit=dev --silent --no-audit --no-fund && node bin/mcp-server.js"
     }
   }
   ```

3. Reference `npm start` from `.mcp.json`:

   ```jsonc
   {
     "mcpServers": {
       "your-plugin": {
         "command": "npm",
         "args": ["run", "--prefix", "${CLAUDE_PLUGIN_ROOT}", "--silent", "start"]
       }
     }
   }
   ```

This way:

- First MCP startup runs `npm install` (a few seconds; npm's cache makes repeated runs near-instant).
- Subsequent startups are no-ops against the cache.
- The plugin is self-contained and works whether installed via the marketplace installer or directly via `claude plugin install`.

The marketplace installer does **not** run `npm install` for plugins — every plugin manages its own deps via its `start` script.
