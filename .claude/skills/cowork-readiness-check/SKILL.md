---
name: cowork-readiness-check
description: Audit every plugin in this marketplace for Claude Cowork compatibility. Updates the plugins table in MARKETPLACE.md with a Cowork column and appends a status suffix to each skill's frontmatter description. Contributor-only skill — lives in `.claude/skills/`, not shipped via the marketplace. Use when adding or revising a plugin, or when refreshing Cowork readiness status. Triggers on "check cowork readiness", "audit plugins for cowork", "/cowork-readiness-check".
---

# Cowork Readiness Check

Determine whether each plugin under `plugins/` is viable inside Claude Cowork's sandboxed environment, then write the verdict into the marketplace documentation so users and authors see it without having to read the limitations doc.

This is a **contributor skill** for this repo — it lives under `.claude/skills/` rather than `plugins/` because its job is to maintain the marketplace, not to ship inside it. It modifies files in `plugins/` and `MARKETPLACE.md`; it never edits itself.

Authoritative reference for the criteria: [`COWORK-LIMITATIONS.md`](../../../COWORK-LIMITATIONS.md). Re-read it before running so the heuristics stay aligned with current product reality (it changes as Cowork evolves).

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: List all plugins under plugins/
- [ ] Step 2: Classify each plugin (ready / not-ready + reason)
- [ ] Step 3: Update the plugins table in MARKETPLACE.md
- [ ] Step 4: Update each skill's SKILL.md frontmatter description
- [ ] Step 5: Print a summary
```

---

### Step 1: List all plugins

Enumerate every directory directly under `plugins/`. Each directory is one plugin. For each plugin, read:

- `plugins/<name>/.claude-plugin/plugin.json` — for the canonical name and current description
- `plugins/<name>/skills/*/SKILL.md` — for the frontmatter description and the body (heuristic evidence)
- `plugins/<name>/commands/*.md` — if present
- `plugins/<name>/agents/*.md` — if present
- `plugins/<name>/hooks/` — read the hook(s); they **do** run in Cowork, so classify by what each hook actually does (Step 2), not by mere presence
- `plugins/<name>/monitors/` — existence is itself a signal
- `plugins/<name>/.lsp.json` — existence is itself a signal
- `plugins/<name>/.mcp.json` — inspect the transport
- `plugins/<name>/bin/` — existence is itself a signal

---

### Step 2: Classify each plugin

Apply the checklist below in order. A plugin is **Not Cowork-ready** if **any** rule triggers. Otherwise it is **Cowork-ready**.

#### Hard structural rules (file-system signals)

A plugin is Not Cowork-ready if it contains any of:

- A `monitors/` directory.
- A `.lsp.json` file.
- A `bin/` directory (no PATH injection in the sandbox).
- A `.mcp.json` whose server entries use **stdio transport** — i.e. an entry with a `command` field (and typically `args`) rather than a `url`. Stdio MCP requires spawning a local subprocess on the user's machine, which the sandbox cannot do. HTTP/SSE MCP entries (with a `url`) are fine.

> **Hooks are NOT a disqualifier — correction (2026-07).** Earlier versions of this skill listed a `hooks/` directory as an automatic "Not Cowork-ready" signal. **That was wrong.** Plugin hooks **run in Cowork** — Anthropic's *Use plugins in Claude Cowork* Help Center article states: *"hooks and sub-agents run only in Cowork, so they appear grayed out in chat"* (i.e. they run in Cowork and the Claude Code terminal, just not in plain web/desktop chat). So `hooks/` presence alone does not make a plugin Not Cowork-ready. Judge what the hook *does* against the behavioral rules below: a `SessionStart` hook that `cat`s a bundled file into context is Cowork-fine; a hook that shells out to a local binary, hits `localhost`, or reaches a blocked network host is not. See [`COWORK-LIMITATIONS.md`](../../../COWORK-LIMITATIONS.md) (§ *Hooks run in Cowork* and the rules-to-Cowork-via-hook trick) for the evidence and links. Caveat: the docs say "hooks" generally; the `SessionStart` event specifically is pending our own empirical confirmation in a live Cowork session.

#### Behavioral rules (scan the SKILL.md and any commands/agents)

A plugin is Not Cowork-ready if its instructions cause the agent to:

- Connect to `localhost`, `127.0.0.1`, `host.docker.internal`, or any user-machine-local hostname.
- Reach external services from the shell beyond Anthropic-sanctioned channels — outbound `curl` to `api.figma.com`, `github.com`, npm/PyPI/Cargo registries, etc. is blocked by the Cowork egress proxy. (The agent's own `WebFetch`/`WebSearch` tools and registered MCP connectors are fine because they don't go through the shell sandbox.)
- Shell out to binaries that aren't in the Cowork base image — `brew`, `npm`, `pnpm`, `pip`, `cargo`, `gem`, `docker`, `kubectl`, project-specific CLIs, etc. Only standard POSIX tools, `git`, and the agent's built-in tools should be assumed available.
- Read or write paths outside the explicit workspace mount — `~/.claude/`, the user's home directory, system paths.
- Run the user's test suite, dev server, browser, or any process that requires their local environment.

#### Mixed cases

Some plugins have a primary path that fails and a fallback that might work (e.g., a local-MCP path with a hosted-API fallback). If **both** paths are not Cowork-ready, the plugin is Not Cowork-ready. If at least one path is genuinely viable in Cowork (e.g., the fallback goes through a registered connector or only uses agent-level tools), classify as **Cowork-ready** and note the constraint in the reason field.

#### Record the verdict

For each plugin, record:

- `name` — plugin directory name
- `verdict` — `Ready` or `Not ready`
- `reason` — required when Not ready. One short clause citing the rule that triggered. Example: "reads `~/.claude/` outside the workspace mount", "hits `localhost:3845` and `api.figma.com`", "requires local `npm`/`brew`/`pip` binaries".

---

### Step 3: Update the plugins table in `MARKETPLACE.md`

Find the existing plugins table. It currently has the header:

```
| Skill | Description | Cowork | Install |
```

For each row, fill in the Cowork column:

- **Ready** → `Ready`
- **Not ready** → `Not ready — <reason>`

Add a row for any plugin that's missing.

If the column doesn't exist yet (first run on a clean repo), insert it between Description and Install. Keep the column order and existing values otherwise unchanged. Don't reflow or re-sort rows.

---

### Step 4: Update each `SKILL.md` frontmatter description

For every skill at `plugins/<plugin>/skills/<skill>/SKILL.md`, modify the `description:` line in the frontmatter to end with a Cowork status suffix:

- **Ready** → append ` Cowork-ready.` to the description.
- **Not ready** → append ` Not Cowork-ready — <reason>.` to the description.

#### Idempotency rules

This skill is meant to be re-run. Before appending, check whether a Cowork suffix already exists:

- If the description already ends with `Cowork-ready.` or `Not Cowork-ready — …` matching the current verdict and reason, leave it alone.
- If the existing suffix has a *different* verdict or a *different* reason, **replace** the old suffix with the new one rather than appending a second.

Detect the suffix with a permissive match: anything starting with `Cowork-ready` or `Not Cowork-ready` and continuing to the end of the description string.

Preserve everything else in the description — keep the original copy, triggers, and tone intact. The suffix is a marker, not a rewrite.

---

### Step 5: Print a summary

Output to the conversation:

- Total plugins checked
- Count of Ready vs Not ready
- List of Not-ready plugins with their reasons
- The list of files modified (MARKETPLACE.md + each SKILL.md whose suffix changed)

If the verdict for any plugin changed since the previous run (i.e., you replaced a suffix rather than adding one), flag those plugins explicitly — they're the ones a reader of the diff will care about.

---

## Notes for the auditor

- This skill never edits plugin behavior or `plugin.json` files. Only documentation surfaces — the MARKETPLACE.md table and SKILL.md descriptions.
- The verdict is binary by design. If you genuinely can't decide, default to **Not ready** and write a reason starting with "Uncertain — " so the next reviewer knows to look closer.
- The Cowork sandbox is a research preview; the rules above will drift. Treat `COWORK-LIMITATIONS.md` as the source of truth and update *that* document first if you discover a rule has changed, then re-run this skill.
