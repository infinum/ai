---
name: scaffold-extension-repo
description: Scaffold a new extension-marketplace repository that layers team- or project-specific plugins and rules on top of the public `infinum/ai` base via `--extend`. Proposes repository and marketplace names from the `infinum/ai-{type}-{name}[-private]` convention, generates the repo skeleton (marketplace.json, README with the install command, optional first plugin and rule bundle), and optionally creates the GitHub repo. Use when someone wants a team repo, a project repo, a private companion repo, or asks how to name or start an extension of the Infinum AI stack. Not Cowork-ready — shells out to local `git`, the `gh` CLI, and `pnpm` to initialise, create, and verify the repository.
---

# scaffold-extension-repo

Create a new **extension marketplace**: a repository that holds team- or project-specific plugins and rule bundles and is layered on top of the public `infinum/ai` base by the shared installer (`--extend`). The mechanism is documented in [CONTRIBUTING.md — Extending with additional marketplaces](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md#extending-with-additional-marketplaces); this skill turns it into a guided, consistent setup.

Extension repos hold **only data** — plugins, rules, and their `marketplace.json`. They never carry a copy of the installer.

## Step 1: Understand what is being created

Collect, asking only for what the user has not already said:

1. **Type** — `team` (a discipline or department: javascript, dotnet, ios, pm, bizdev, design…) or `project` (one client or product).
2. **Name** — what the team or project is called. Lowercase, kebab-case, no `infinum` prefix, no `ai` prefix (the template adds both). Prefer the name the rest of the company uses (`javascript`, not `js`; the client's short name for projects).
3. **Visibility** — what the repo will hold decides this:
   - **Public** — general conventions and skills with nothing client-specific or internal. Works for anyone with no git auth.
   - **Private** — client-specific tooling, or anything that exposes internal process. Requires Infinum git access to install.
   - **Both** — a public repo for shareable conventions plus a private companion for the rest. This mirrors the two core repos, `infinum/ai` + `infinum/ai-private`.
   If the user is unsure, ask what the first few skills or rules will be and decide from that. Project repos are almost always private (they are about a client). Team repos are often public, unless the team's work is inherently sensitive (bizdev, sales, HR).
4. **Initial content** — optional: the name of a first plugin and/or a first rule bundle. An empty skeleton is fine; do not invent content.
5. **Where to scaffold locally** — a directory to create. Default to `./<repo-name>` under the current working directory unless the user names a location.

## Step 2: Propose names

Apply the convention and show the result before creating anything:

```
infinum/ai-{type}-{name}[-private]
```

- `{type}` is `team` or `project`.
- `{name}` is the kebab-case name from Step 1.
- `-private` is appended **if and only if** the repository is private, so visibility is readable from the name alone.

Examples to model on:

| Situation | Repository | Visibility |
|---|---|---|
| JavaScript team, shareable conventions | `infinum/ai-team-javascript` | public |
| JavaScript team, internal companion | `infinum/ai-team-javascript-private` | private |
| Bizdev team — sensitive work, no public half | `infinum/ai-team-bizdev-private` | private |
| .NET team | `infinum/ai-team-dotnet` | public |
| Client project | `infinum/ai-project-<client>-private` | private |

For **both**, propose the pair together and scaffold them as two repositories with two marketplaces.

The **marketplace name** (the `name` field in `marketplace.json`) follows the repo: `infinum-ai-{type}-{name}[-private]`, e.g. `infinum-ai-team-javascript`. It must never be `infinum-ai` — the installer aborts on a marketplace-name collision because two sources with one name would shadow each other's plugins in a shared cache directory.

The two core repos sit outside the template: `infinum/ai` (the base) and `infinum/ai-private` (its private companion — installed through the very same `--extend` mechanism as any extension, but a core repo nonetheless). Do not propose renaming either of them.

Present the proposed repository name(s), marketplace name(s), and visibility and **wait for the user's confirmation** before writing files. If a name has to bend the convention (an established product name with a hyphen, say), say so and let the user decide.

## Step 3: Check for collisions

Before scaffolding, check that nothing already exists under the proposed name:

```bash
gh repo view infinum/<repo-name> >/dev/null 2>&1 && echo "exists" || echo "free"
```

If `gh` is unavailable or not authenticated, say so and continue — the check is a courtesy, not a gate.

Also remind the user of the second installer constraint: **rule file and bundle names must be unique across all sources** a person has installed, because every source's rules land in the one `~/.claude/infinum/` directory. Prefix bundle names with the team or project (`javascript-conventions`, not `conventions`).

## Step 4: Scaffold the repository

Create this layout in the chosen directory (omit `plugins/` or `rules/` if the user chose no initial content — but always create the marketplace manifest, README, and agent instructions):

```
<repo-name>/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/                          # only if a first plugin was named
│   └── <plugin-name>/
│       ├── .claude-plugin/plugin.json
│       ├── README.md
│       └── skills/<skill-name>/SKILL.md
├── rules/                            # only if a first bundle was named
│   └── <bundle-name>/
│       ├── README.md
│       └── <rule-name>.md
├── AGENTS.md
├── CLAUDE.md                         # one line: @AGENTS.md
├── .gitignore
└── README.md
```

### `.claude-plugin/marketplace.json`

```json
{
  "name": "<marketplace-name>",
  "owner": { "name": "Infinum" },
  "metadata": { "description": "<Team or project> AI plugins and rules — extension of infinum/ai" },
  "plugins": [
    { "name": "<plugin-name>", "source": "./plugins/<plugin-name>" }
  ]
}
```

Leave `plugins` as `[]` when no first plugin was named. `source` paths must be relative and inside this repo — a marketplace cannot reference plugins in another repository.

### First plugin (if named)

- `plugins/<plugin-name>/.claude-plugin/plugin.json` — `name`, `version: "1.0.0"`, one-line `description`, 2–4 `keywords`.
- `plugins/<plugin-name>/skills/<skill-name>/SKILL.md` — frontmatter (`name`, `description`) and a body that states the purpose and leaves clearly marked `TODO` sections for the team to fill in. Do not write speculative workflow content.
- `plugins/<plugin-name>/README.md` — heading, description, `## Usage` with the namespaced invocation `/<plugin-name>:<skill-name>`.

Prefix plugin names with the team or project name when they could clash with something in `infinum/ai` (`javascript-create-prd`, not `create-prd`).

### First rule bundle (if named)

- `rules/<bundle-name>/README.md` — the first non-heading line is shown by the installer as the bundle's prompt hint; make it one clear sentence.
- `rules/<bundle-name>/<rule-name>.md` — a CLAUDE.md-style instruction file with a `TODO` body.

Bundles are opt-in via `--bundles <bundle-name>`; top-level `rules/*.md` files would be installed for everyone who adds this extension, so use a bundle unless the user explicitly wants that.

### `README.md`

Generate it with these sections, filled in with the real names:

1. Title and one paragraph: what this repo is, that it extends `infinum/ai`, who owns it.
2. **Plugins** table (name, description) — empty table with a note if none yet.
3. **Rule bundles** — list, or a note that there are none yet.
4. **Install** — the preferred command first:

   ```bash
   pnpm dlx --allow-build=infinum-ai github:infinum/ai \
     --extend infinum/<repo-name> \
     --plugins <plugin-name> --bundles <bundle-name>
   ```

   Drop `--plugins` / `--bundles` if there is nothing yet. Below it, one paragraph on what the installer adds over a bare `/plugin marketplace add` (rule bundles, remembered sources, update banner, MCP mirroring) and the direct alternative:

   ```
   /plugin marketplace add infinum/<repo-name>
   /plugin install <plugin-name>@<marketplace-name>
   ```

   For a private repo, note that installing needs Infinum git access.
5. **Adding a plugin** — five steps: create `plugins/<name>/.claude-plugin/plugin.json` at `1.0.0`, add skills, add the plugin README, append to `marketplace.json`, add a row to the table.
6. **Changing a plugin** — bump `version` in its `plugin.json` on every change (patch/minor/major); Claude Code only picks up plugin updates on a version bump.
7. A link to the [infinum/ai CONTRIBUTING guide](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md) for plugin structure, cross-platform MCP, and runtime dependencies.

### `AGENTS.md` and `CLAUDE.md`

`AGENTS.md`: two or three paragraphs stating that this is an extension marketplace of `infinum/ai`, that every change to a plugin must bump its `version`, that marketplace and bundle names must stay unique with respect to `infinum/ai` and other extensions, and that nothing here may contain credentials or client data. `CLAUDE.md` contains one line: `@AGENTS.md`.

### `.gitignore`

```
node_modules/
.DS_Store
*.log
```

### License

For a **public** repo, ask whether to copy the `LICENSE` from `infinum/ai` (CC BY-NC 4.0, non-commercial) so the extension carries the same terms as the base. Do not add a license to a private repo unless asked.

## Step 5: Initialise git and, with confirmation, create the GitHub repository

```bash
cd <repo-name>
git init -q && git add -A && git commit -q -m "Scaffold <repo-name> extension marketplace"
```

Then **ask** before creating anything on GitHub — this is an outward-facing action:

```bash
gh repo create infinum/<repo-name> --<public|private> --source . --push \
  --description "<Team or project> AI plugins and rules — extension of infinum/ai"
```

If the user declines or lacks permission to create repositories in the organisation, print the command for them and stop there.

## Step 6: Verify locally

Offer to test the skeleton against the real installer from the local checkout — no GitHub access needed:

```bash
pnpm dlx --allow-build=infinum-ai github:infinum/ai --extend "$PWD" --plugins none --bundles none
```

A successful run lists the new marketplace under "Sources this run". Then remove it again so the test does not linger in the user's manifest:

```bash
pnpm dlx --allow-build=infinum-ai github:infinum/ai --remove <marketplace-name>
```

## Step 7: Hand off

Finish by printing the next steps that are not the skill's to do:

- **Org-level availability** — if non-developers should install from this marketplace via Claude Desktop or Cowork, ask an org admin to grant the Claude GitHub App access to the new repository.
- **Announce it** in the AI channel so the repo gets listed in the AI handbook's *Extending the AI Stack* chapter.
- **Ownership** — a team repo is owned by the team champion; a project repo by the project's tech lead. Name them in the README.
- **What belongs here vs. upstream** — anything general enough for every Infinum engineer should be a PR to `infinum/ai` instead; anything used by a single code repository can simply live in that repo's `.claude/` folder.

## Guardrails

- Never name a marketplace `infinum-ai`, and never copy the installer, `bin/`, or `pnpm` setup from `infinum/ai` into the extension.
- Never put credentials, tokens, or client documents into the scaffold.
- Do not write speculative skill or rule content; leave `TODO` markers for the owning team.
- Do not create or push a GitHub repository without the user's explicit yes in this session.
