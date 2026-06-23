# Infinum house rules

Files in this directory are CLAUDE.md-style instructions that load on every Claude Code session for anyone who has run the install script. They live here in the repo, get copied to `~/.claude/infinum/`, and are chained from a single `index.md` that's imported by `~/.claude/CLAUDE.md`.

## Two flavors: house rules and bundles

| Flavor | Location | Install behavior |
|---|---|---|
| **House rule** | `rules/<name>.md` (top-level) | Auto-installed for everyone |
| **Bundle** | `rules/<bundle>/*.md` (subfolder) | Opt-in via a TTY multiselect prompt during setup |

Bundles let a group ship role-specific or context-specific rules without forcing them on the whole company. The installer remembers which bundles each user opted into and cleans up files from bundles that were previously selected but later deselected.

## What the install script does with these files

| Source in this repo | Installed path | Owner | Overwritten on re-run? |
|---|---|---|---|
| `rules/<name>.md` | `~/.claude/infinum/<name>.md` | repo | **yes** |
| `rules/<bundle>/<name>.md` | `~/.claude/infinum/<bundle>/<name>.md` (only if opted in) | repo | **yes** (when bundle stays selected) |
| `rules/README.md`, `rules/<bundle>/README.md` | _(skipped — contributor docs)_ | — | — |
| _(generated)_ | `~/.claude/infinum/whoami.md` | **user** | **no** (created only if missing) |
| _(generated)_ | `~/.claude/infinum/index.md` | repo | yes (regenerated each run) |
| _(one line appended)_ | `~/.claude/CLAUDE.md` | user | no (idempotent) |

`whoami.md` stays user-owned forever — once you personalize it, re-running the install script never touches it again.

`index.md` is regenerated every run: `@~/.claude/infinum/whoami.md` first, then every top-level rule in alphabetical order, then files from each opted-in bundle (alphabetical by bundle, then by file).

## Adding a house rule

1. Create `rules/<name>.md`. Keep it focused on one topic.
2. Push to `main`.
3. Users pick it up next time they run `pnpm dlx --allow-build=infinum-ai github:infinum/ai`.

## Adding a bundle

1. Create `rules/<bundle>/` and drop `*.md` files inside.
2. Optionally add `rules/<bundle>/README.md`; the first non-heading line becomes the prompt hint.
3. Push to `main`. The installer's multiselect prompt will surface the bundle on the next setup run.

## Style guidance

- **One topic per file.** Easier to update, easier to remove if the rule stops applying.
- **Don't restate Claude Code documentation.** Claude already has that in context.
- **Don't list installed plugins or skills.** Their descriptions ship with the plugin metadata; mirroring them here just creates rot.
- **Write rules, not tutorials.** "Use X for Y" beats "here's everything about X".
