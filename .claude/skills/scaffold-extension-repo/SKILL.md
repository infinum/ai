---
name: scaffold-extension-repo
description: Scaffold a new extension-marketplace repository that layers team- or project-specific plugins and rules on top of the public `infinum/ai` base via `--extend`. Proposes repository and marketplace names from the `infinum/ai-{type}-{name}[-private]` convention, copies a ready-made template (marketplace.json, README with the install command, optional first plugin and rule bundle), fills in the names, and optionally creates the GitHub repo. Contributor-only skill — lives in `.claude/skills/` of the `infinum/ai` checkout, not shipped via the marketplace. Use when someone wants a team repo, a project repo, a private companion repo, or asks how to name or start an extension of the Infinum AI stack. Triggers on "new extension repo", "team repo", "project repo", "/scaffold-extension-repo".
---

# scaffold-extension-repo

Create a new **extension marketplace**: a repository that holds team- or project-specific plugins and rule bundles and is layered on top of the public `infinum/ai` base by the shared installer (`--extend`). The mechanism is documented in [CONTRIBUTING.md — Extending with additional marketplaces](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md#extending-with-additional-marketplaces); this skill turns it into a guided, consistent setup.

Extension repos hold **only data** — plugins, rules, and their `marketplace.json`. They never carry a copy of the installer.

This is a **contributor skill** for this repo — it lives under `.claude/skills/` rather than `plugins/` because creating an extension repo is a rare, one-off task for the person who owns it, not something every engineer needs installed. Run it from a checkout of `infinum/ai`; it is not available through the marketplace.

The skill ships a complete **template repository** next to this file, in `template/`. Scaffolding is a copy of that directory followed by a placeholder replacement — do not write the files from memory.

## Step 1: Understand what is being created

Collect, asking only for what the user has not already said:

1. **Type** — `team` (a discipline or department: javascript, dotnet, ios, pm, bizdev, design…) or `project` (one client or product).
2. **Name** — what the team or project is called. Lowercase, kebab-case, no `infinum` prefix, no `ai` prefix (the template adds both). Prefer the name the rest of the company uses (`javascript`, not `js`; the client's short name for projects).
3. **Visibility** — what the repo will hold decides this:
   - **Public** — general conventions and skills with nothing client-specific or internal. Works for anyone with no git auth.
   - **Private** — client-specific tooling, or anything that exposes internal process. Requires Infinum git access to install.
   - **Both** — a public repo for shareable conventions plus a private companion for the rest. This mirrors the two core repos, `infinum/ai` + `infinum/ai-private`.
   If the user is unsure, ask what the first few skills or rules will be and decide from that. Project repos are almost always private (they are about a client). Team repos are often public, unless the team's work is inherently sensitive (bizdev, sales, HR).
4. **Initial content** — optional: the name of a first plugin (and its first skill) and/or a first rule bundle (and its first rule). An empty skeleton is fine; do not invent content.
5. **Owner** — the person or role who maintains the repo (team champion for a team repo, tech lead for a project repo).
6. **Where to scaffold locally** — a directory to create. The working directory is the `infinum/ai` checkout, so default to a sibling of it, `../<repo-name>`, unless the user names a location. Never scaffold inside the checkout.

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

Also remind the user of the second installer constraint: **rule file and bundle names must be unique across all sources** a person has installed, because every source's rules land in the one `~/.claude/infinum/` directory. The template prefixes bundle, rule, and plugin names with the repo's name (`javascript-conventions`, not `conventions`); keep that.

## Step 4: Copy the template and fill in the names

### 4a. Locate the template

The template lives next to this skill, inside the `infinum/ai` checkout:

```bash
TEMPLATE="$(git rev-parse --show-toplevel)/.claude/skills/scaffold-extension-repo/template"
[ -d "$TEMPLATE" ] && echo "template: $TEMPLATE" || echo "template not found"
```

If the path does not resolve, the session is not running from an `infinum/ai` checkout — stop and tell the user to open one (`git clone git@github.com:infinum/ai.git` and start Claude Code there), rather than reconstructing files by hand.

### 4b. Copy it

```bash
cp -R "$TEMPLATE" "<target-dir>"
```

Then **remove what was not requested** — the template contains every optional part:

| Not requested | Remove |
|---|---|
| No first plugin | `plugins/` and the entry in `.claude-plugin/marketplace.json` (leave `"plugins": []`), plus the Plugins table row in `README.md` |
| No rule bundle | `rules/` and the Rule bundles table row in `README.md`; drop `--bundles …` from the install command |
| Public repo | the block between `<!-- private-only:start -->` and `<!-- private-only:end -->` in `README.md` (markers too) |
| Private repo | just the `<!-- private-only:… -->` markers, keeping the sentence |

### 4c. Replace the placeholders

Every placeholder is `__UPPER_SNAKE__`. Fill this table from Step 1, then apply it to file **contents** and to **directory names**:

| Placeholder | Value | Example |
|---|---|---|
| `__REPO_NAME__` | repo name without `infinum/` | `ai-team-javascript-private` |
| `__MARKETPLACE_NAME__` | `infinum-` + repo name | `infinum-ai-team-javascript-private` |
| `__NAME_PREFIX__` | the `{name}` part, used as prefix for plugin/bundle/rule names | `javascript` |
| `__OWNER_LABEL__` | human label for the team or project | `JavaScript team`, `HPB project` |
| `__OWNER__` | maintainer — person or role | `Jane Doe (team champion)` |
| `__VISIBILITY__` | `public` or `private` | `private` |
| `__PLUGIN_NAME__` | first plugin, prefixed | `javascript-create-prd` |
| `__SKILL_NAME__` | first skill in that plugin | `create-prd` |
| `__BUNDLE_NAME__` | first rule bundle, prefixed | `javascript-conventions` |
| `__RULE_NAME__` | first rule file in the bundle, prefixed | `javascript-testing` |

Rename directories first (deepest first), then replace inside files. On macOS `sed -i ''`, on Linux `sed -i`:

```bash
cd "<target-dir>"
# directories and files whose names carry a placeholder — deepest first
find . -depth -name '*__*__*' | while read -r p; do
  n=$(basename "$p" | sed -e 's/__PLUGIN_NAME__/<plugin>/g' -e 's/__SKILL_NAME__/<skill>/g' \
        -e 's/__BUNDLE_NAME__/<bundle>/g' -e 's/__RULE_NAME__/<rule>/g')
  mv "$p" "$(dirname "$p")/$n"
done
# contents
grep -rl '__[A-Z_]*__' . | xargs sed -i '' \
  -e 's/__REPO_NAME__/<repo-name>/g' -e 's/__MARKETPLACE_NAME__/<marketplace-name>/g' \
  -e 's/__NAME_PREFIX__/<name>/g' -e 's/__OWNER_LABEL__/<Owner label>/g' -e 's/__OWNER__/<owner>/g' \
  -e 's/__VISIBILITY__/<public|private>/g' -e 's/__PLUGIN_NAME__/<plugin>/g' -e 's/__SKILL_NAME__/<skill>/g' \
  -e 's/__BUNDLE_NAME__/<bundle>/g' -e 's/__RULE_NAME__/<rule>/g'
# nothing left behind
grep -rn '__[A-Z_]*__' . && echo "unreplaced placeholders above" || echo "clean"
```

Substitute the real values for the `<…>` tokens before running.

### 4d. Review what the template leaves as `TODO`

The template marks every spot that needs the owning team's input with `TODO` — plugin and bundle descriptions, the skill body, the rule body. Show the user the list (`grep -rn TODO .`) and fill in only what they dictate now. **Do not write speculative skill or rule content**; leaving `TODO`s for the team is the intended outcome.

### License

For a **public** repo, ask whether to copy the `LICENSE` from `infinum/ai` (CC BY-NC 4.0, non-commercial) so the extension carries the same terms as the base. Do not add a license to a private repo unless asked.

## Step 5: Initialise git and, with confirmation, create the GitHub repository

```bash
cd <target-dir>
git init -q && git add -A && git commit -q -m "Scaffold <repo-name> extension marketplace"
```

Then **ask** before creating anything on GitHub — this is an outward-facing action:

```bash
gh repo create infinum/<repo-name> --<public|private> --source . --push \
  --description "<Owner label> AI plugins and rules — extension of infinum/ai"
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
- **Announce it** in the AI channel, and add the repo to the team's or project's onboarding checklist — the handbook does not list extension repos; new joiners learn about them during onboarding.
- **Ownership** — the owner named in the README keeps the plugins versioned and the rules current.
- **What belongs here vs. upstream** — anything general enough for every Infinum engineer should be a PR to `infinum/ai` instead; anything used by a single code repository should simply live in that repo's `.claude/` folder.

## Guardrails

- Never name a marketplace `infinum-ai`, and never copy the installer, `bin/`, or `pnpm` setup from `infinum/ai` into the extension.
- Never put credentials, tokens, or client documents into the scaffold.
- Scaffold from `template/`, not from memory; leave `TODO` markers for the owning team rather than inventing content.
- Do not create or push a GitHub repository without the user's explicit yes in this session.
