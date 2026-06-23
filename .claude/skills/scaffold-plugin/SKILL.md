---
name: scaffold-plugin
description: Scaffold a new plugin, add components to an existing plugin, or edit an existing plugin's content. Covers skills, MCP servers, slash commands, subagents, and hooks. Handles marketplace registration, semver bumps, and Cowork re-classification so the metadata never drifts from the code.
---

This skill helps with the full lifecycle of plugins in this marketplace repo:

- **Scaffolding a new plugin** — create the directory, manifest, skill(s), optional companion components, and wire it into the marketplace.
- **Adding to an existing plugin** — drop in a new skill, MCP server, slash command, subagent, or hook alongside what's already there.
- **Editing an existing plugin** — change a skill body, fix a bug, tweak a description, or alter behavior.

Regardless of the mode, the skill enforces the things humans routinely forget: a correct semver bump on `plugin.json`; keeping a plugin's name, description, and links in lockstep across `plugin.json`, `marketplace.json`, `MARKETPLACE.md`, and the installer's live `--help`; and re-running `cowork-readiness-check` whenever the change could shift the Cowork verdict.

For reference:

- Single-skill plugin: `plugins/create-prd/` or `plugins/claude-setup-audit/`.
- Multi-skill plugin with an MCP server: several skill directories under `skills/` paired with a `.mcp.json` — see [CONTRIBUTING.md — Cross-platform MCP](../../../CONTRIBUTING.md#cross-platform-mcp) for the MCP layout.
- Full plugin component taxonomy: [`CONTRIBUTING.md` — What a plugin can contain](../../../CONTRIBUTING.md#what-a-plugin-can-contain).
- Authoritative schema for `plugin.json`: [Claude Code plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference).

## How plugin metadata surfaces

A plugin's name and description appear in several places. Some are generated from disk at runtime; one is hand-maintained — know which is which so you edit the right file and don't try to hand-fix generated output:

- **Installer `--help`** (`bin/install.js` → `printHelp`) is **generated live** by scanning the repo each run, so it never needs hand-editing and can't drift. It draws from three different sources:
  - **PLUGINS** — the plugin directory name + its **`plugin.json` `description`** (it does **not** read the plugin's README).
  - **RULE BUNDLES** — the `rules/<bundle>/` directory name + the **first non-heading, non-empty line of that bundle's `README.md`**.
  - **HOUSE RULES** — the `rules/*.md` filenames.
- **`MARKETPLACE.md`** table row is **hand-maintained** and must mirror `plugin.json`: `name` → the row's link/display + install command, `description` → the description column. This is the only checked-in copy that can fall out of sync, so it's the one to update by hand.
- A skill's own **`README.md`** is user-facing prose; nothing reads it into a generated list, so keep it accurate but it isn't a sync target.

Consequences to remember:

- **`plugin.json` `description` is canonical.** Editing it updates `--help` automatically; your only follow-up is the matching `MARKETPLACE.md` row. Never edit help text by hand — fix `plugin.json` (plugins) or the bundle `README.md` first line (bundles) instead.
- **Names come from directory names.** Renaming a plugin or skill directory silently re-labels `--help`, but it breaks the `marketplace.json` `source` path and the `MARKETPLACE.md` link unless you follow through (see [Propagate name, description, and link changes](#propagate-name-description-and-link-changes)).

## Step 1: Pick the mode

Ask the user (or infer from `$ARGUMENTS` if the skill was invoked with an initial argument like `/scaffold-plugin my-new-plugin`) which of these applies:

- **Mode A — New plugin.** Jump to [Mode A](#mode-a-scaffold-a-new-plugin).
- **Mode B — Add a component to an existing plugin** (new skill, MCP, command, agent, hook, or helper script). Jump to [Mode B](#mode-b-add-a-component-to-an-existing-plugin).
- **Mode C — Edit, rename, or remove an existing plugin or skill** (modify a skill body, fix a bug, change behavior, update metadata, rename a plugin/skill, or delete one). Jump to [Mode C](#mode-c-edit-rename-or-remove-an-existing-plugin-or-skill).

After any mode, complete [the Wrap-up](#wrap-up-after-any-mode).

---

## Mode A: Scaffold a new plugin

### A1: Decide the plugin shape

Don't assume single-skill — plugins are most powerful when skills are paired with the data sources or commands they depend on.

1. **Plugin name** — kebab-case (e.g., `my-feature-tools`). The directory under `plugins/`.
2. **One-line description** — used in `plugin.json` and the MARKETPLACE.md table row.
3. **Keywords** — 2–4 short tags for marketplace search.
4. **Skills** — one or more. For each skill collect:
   - Skill name (kebab-case; can match the plugin name when there's only one).
   - One-line description.
   - Brief summary of what it does (seeds the SKILL.md body).
5. **Companion components?** — ask the user explicitly. Skills rarely stand alone in this marketplace; surface the options so the user makes an informed call rather than discovering the gap later:
   - **MCP server** (most common pairing). If the workflow touches an external API, live dataset, or service the model can't reach on its own, an MCP server gives the agent first-class access instead of forcing the skill to shell out. Declare it in `.mcp.json` (or `mcpServers` inside `plugin.json`). For Claude Desktop / Gemini CLI / Cursor parity, see [CONTRIBUTING.md — Cross-platform MCP](../../../CONTRIBUTING.md#cross-platform-mcp).
   - **Slash commands** — fixed-shape entrypoints when auto-triggered skills aren't precise enough.
   - **Subagents** — for delegating subtasks with their own tool budget.
   - **Hooks** — for lifecycle automation (pre/post tool use, session start, etc.).
   - **Helper scripts** — invoked by hooks or commands.

   Don't add components speculatively; pick only what the workflow needs today. But explicitly ask — "does this skill need an MCP server, hooks, or a slash command alongside it?" — so the user considers it.

### A2: Create the plugin and skill files

- `plugins/<plugin-name>/.claude-plugin/plugin.json` — new plugins start at version `1.0.0`. `plugin.json` is the single source of truth for plugin metadata (`name`, `version`, `description`, `keywords`); none of these live in the marketplace entry.
- For each skill, create:
  - `plugins/<plugin-name>/skills/<skill-name>/SKILL.md` — YAML frontmatter (`name`, `description`) + body. Most skills don't need argument substitution; only append `$ARGUMENTS` at the end (or `$0`/`$1`/... for positional, or `$name` with an `arguments:` frontmatter field) if the skill is designed to take user-typed input on invocation. See [Claude Code skill substitutions](https://code.claude.com/docs/en/skills.md). Do **not** use `$@` — it's not a Claude Code substitution and just leaks into the prompt as literal text.
  - `plugins/<plugin-name>/skills/<skill-name>/README.md` — user-facing docs: heading + description, `## Usage` (with the `/<plugin>:<skill>` namespaced invocation), `## What it does`, `## When to use`.

Mirror an existing plugin's conventions — e.g. `plugins/create-prd/` for single-skill layout — rather than reinventing layout. For a multi-skill plugin, add one directory per skill under `skills/`.

### A3: Add companion components (skip if none chosen in A1)

Create files for the components selected in A1. Refer to [CONTRIBUTING.md](../../../CONTRIBUTING.md) for each component's layout and gotchas:

- **MCP server** → `plugins/<plugin-name>/.mcp.json`. Use `${CLAUDE_PLUGIN_ROOT}` to reference plugin-relative paths (it's substituted by Claude Code at MCP config read time).
- **Slash commands** → `plugins/<plugin-name>/commands/<command-name>.md`.
- **Subagents** → `plugins/<plugin-name>/agents/<agent-name>.md`.
- **Hooks** → `plugins/<plugin-name>/hooks/hooks.json` (or in the `hooks` field of `plugin.json`).
- **Helper scripts** → `plugins/<plugin-name>/scripts/<name>.sh` (or any executable).

### A4: Register the plugin in `marketplace.json`

Append a new entry to the `plugins[]` array in `.claude-plugin/marketplace.json`:

```json
{ "name": "<plugin-name>", "source": "./plugins/<plugin-name>" }
```

`name` and `source` are the only fields the marketplace entry needs. All other metadata (`description`, `version`, `keywords`) lives in `plugin.json` only — Claude Code reads them from there (default `strict: true` means `plugin.json` is the authority).

### A5: Add a row to the `MARKETPLACE.md` skills table

The link target depends on the plugin's shape:

- **Single-skill plugin** — link to the skill directory: `plugins/<plugin-name>/skills/<plugin-name>/`.
- **Multi-skill plugin** — link to the plugin root: `plugins/<plugin-name>/` (so the row covers all the plugin's skills, not just one).

Leave the Cowork column as `TBD` — the Wrap-up step fills it in. Example single-skill row:

```
| [`<plugin-name>`](plugins/<plugin-name>/skills/<plugin-name>/) | <description> | TBD | `/plugin install <plugin-name>@infinum-ai` |
```

Now proceed to the [Wrap-up](#wrap-up-after-any-mode).

---

## Mode B: Add a component to an existing plugin

### B1: Identify the target

Confirm with the user:

- **Which plugin** — list `plugins/` directories if unsure. Verify the directory exists and has `.claude-plugin/plugin.json`.
- **What's being added** — a new skill, MCP server, slash command, subagent, hook, or helper script.

If the plugin doesn't have the relevant directory yet (e.g., adding the first MCP server to a skills-only plugin), it'll be created in B2.

### B2: Create the new component

For a new **skill** in an existing plugin, create:

- `plugins/<plugin-name>/skills/<new-skill-name>/SKILL.md` — frontmatter + body. Append `$ARGUMENTS` at the end only if the skill is designed to receive user-typed input on invocation; otherwise omit substitution syntax (see A2 for the full rule). Do **not** use `$@`.
- `plugins/<plugin-name>/skills/<new-skill-name>/README.md` — user-facing docs.

If the plugin was previously single-skill (only one entry under `skills/`), make sure its MARKETPLACE.md row link still points at the right place — Wrap-up handles that.

For a new **MCP server**, **slash command**, **subagent**, **hook**, or **helper script**, follow the layout in A3 / [CONTRIBUTING.md](../../../CONTRIBUTING.md). The plugin's `marketplace.json` entry doesn't change — only `name` and `source` live there.

Adding a new component is a **minor** version bump (new functionality, no breaking change to existing surface). Apply it in the Wrap-up.

---

## Mode C: Edit, rename, or remove an existing plugin or skill

### C1: Identify the target

Confirm with the user:

- **Which plugin** and which file(s) are being edited (a SKILL.md body, a command, an MCP config, plugin.json metadata, etc.) — or whether this is a **rename** or **removal** of a whole plugin or a single skill.
- **What kind of change**:
  - **Bug fix or clarification** that doesn't change observable behavior → **patch** bump.
  - **Behavior change** that existing users will notice but won't break their flow → **minor** bump.
  - **Breaking change** (removed/renamed skill, changed required argument, removed MCP server, changed input/output contract) → **major** bump.
  - **Metadata-only** change (description, keywords) → **patch**, but also propagate the description change to the MARKETPLACE.md row in Wrap-up.

### C2: Apply the edit

Edit the relevant files directly. Watch for:

- **plugin.json description change** — must also update the MARKETPLACE.md row (Wrap-up handles this). The installer `--help` already re-reads `plugin.json`, so leave it alone.
- **SKILL.md behavioral shift** — if the skill now talks to `localhost`, shells out to local binaries, hits external endpoints, or stops doing so, the Cowork verdict may flip. Wrap-up's `cowork-readiness-check` will catch this if you re-run it; flag explicitly to the user when you think it might have shifted.
- **Renaming a plugin or a skill** — the directory name is the identity that flows into `marketplace.json`, `MARKETPLACE.md`, and the live `--help`. Rename the directory plus every file that names it; the [Wrap-up checklist](#propagate-name-description-and-link-changes) enumerates exactly what moves together. A plugin rename is a breaking (major) change.
- **Removing a skill or a whole plugin** — also remove its file(s), deregister it from `marketplace.json` / `MARKETPLACE.md` as applicable, and pick a major bump if removal breaks an established invocation. The [Wrap-up checklist](#propagate-name-description-and-link-changes) covers both cases.

---

## Wrap-up (after any mode)

### Bump the version

**Mode A** plugins are already at `1.0.0` — no bump needed unless you also edited an existing plugin in the same session.

**Mode B** plugins → minor bump (new functionality).

**Mode C** plugins → patch / minor / major per C1.

Run:

```bash
bash .claude/skills/scaffold-plugin/bump-version.sh <plugin-name> [major|minor|patch]
```

The script is the single point of truth — don't hand-edit `plugin.json` version strings.

### Propagate name, description, and link changes

`plugin.json` is canonical and the installer `--help` re-reads it live, so the only checked-in mirror you maintain by hand is `MARKETPLACE.md`. Match the action:

- **Description changed** (Mode A scaffold, or any Mode B/C edit that touched it) → update the matching row's description column in `MARKETPLACE.md` so it reads the same as `plugin.json`. (`--help` already reflects the new `plugin.json` text — leave it alone.) Copy the description across rather than re-wording it; small editorial drift between the two — a stray quote here, a reflowed clause there — is exactly what makes them look out of sync later.
- **Plugin renamed** (directory renamed — breaking, major bump). The directory name is the plugin's identity everywhere, so move all of these together:
  - the `plugins/<old>/` directory → `plugins/<new>/`,
  - `plugin.json` `name`,
  - the `marketplace.json` entry's **`name` *and* `source`** (`./plugins/<new>`),
  - the `MARKETPLACE.md` row's link target, display name, and `/plugin install <new>@infinum-ai` command.
  The installer `--help` picks up the new name automatically from the directory — no edit there.
- **Skill renamed** (a directory under `skills/` renamed) → update the skill directory, its `SKILL.md` frontmatter `name`, and its `README.md`. For a **single-skill plugin** the `MARKETPLACE.md` row links into `plugins/<plugin>/skills/<skill>/`, so repoint it at the renamed skill directory. (Multi-skill rows link to the plugin root and don't move.)
- **Plugin removed** → delete `plugins/<name>/`, remove its `marketplace.json` entry, and delete its `MARKETPLACE.md` row. `--help` drops it automatically. No version bump (the plugin is gone); record the removal in the summary.
- **Skill removed** → delete the skill directory and its files. If it leaves the plugin with a single remaining skill, flip the row link to that skill (see the transition note below). Removing a skill is breaking — major bump.

If a **single-skill plugin became multi-skill** in this run (Mode B added a second skill under `plugins/<plugin-name>/skills/`), the MARKETPLACE.md row's link target must flip from the skill directory to the plugin root:

- Before: `[`<plugin-name>`](plugins/<plugin-name>/skills/<plugin-name>/)`
- After: `[`<plugin-name>`](plugins/<plugin-name>/)`

The plugin root now hosts multiple skills, so deep-linking to one of them undersells the plugin. (The reverse transition — multi-skill back to single-skill, e.g., Mode C removed all but one skill — flips the link the other way: back to `plugins/<plugin-name>/skills/<remaining-skill>/`.)

### Run the Cowork readiness check

Invoke the `cowork-readiness-check` contributor skill any time:

- A new SKILL.md was created with a meaningful body (Mode A skills, Mode B new skills).
- A SKILL.md body's behavioral profile may have shifted (Mode C changes that add or remove localhost calls, external endpoints, local-binary shell-outs, or MCP transport changes).
- An MCP server was added or its transport changed (Mode B MCP additions, Mode C transport edits).

`cowork-readiness-check` replaces `TBD` placeholders or revises existing verdicts in the MARKETPLACE.md Cowork column, and appends a `Cowork-ready.` / `Not Cowork-ready — <reason>.` suffix to each affected SKILL.md's frontmatter description. If you scaffolded before writing the body, run it **after** the body lands — the heuristics inspect SKILL.md text and will misclassify an empty skeleton.

### Summary

Print what was created, modified, and bumped:

- New files (with paths).
- Modified files (with paths).
- `plugin.json` version: `<old> → <new>` (or "unchanged" for fresh Mode A plugins).
- `.claude-plugin/marketplace.json` — entry appended / `name`+`source` renamed / removed / unchanged.
- `MARKETPLACE.md` — row added / description synced to `plugin.json` / link or install command repointed / row removed / Cowork column updated.
- Whether `cowork-readiness-check` was run, and what changed in its output.

$ARGUMENTS
