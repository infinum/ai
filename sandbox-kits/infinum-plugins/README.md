# infinum-plugins

Registers two Claude Code plugin marketplaces, installs five plugins from
them, and installs the Infinum house rules into `~/.claude/infinum/`:

- **`infinum-ai`** (the public repo `infinum/ai`) → `stack-essentials`,
  `create-prd`, `pr-review-code-simplicity`, `productive-debug`, plus the
  house rules.
- **`claude-plugins-official`** → `superpowers`, a skills library for
  brainstorming, planning, TDD, systematic debugging and code review.

This consolidates the `infinum-ai` and `superpowers` kits, both of which
remain in this repository and are unchanged.

This is a mixin with `requires.agent: claude`: it composes onto the `claude`
base agent only, and applying it to another one is a composition error that
fails sandbox creation rather than quietly doing nothing.

## Two install steps, not one

`setup.install` holds one step per original kit, with the scripts copied
verbatim. They share no state — the only thing in common is `github.com`
egress, declared once at the kit level. Keeping them separate means each
step's `description` surfaces on its own in the creation output, so a failure
names which half broke without anyone reading the script.

## Why not the pnpm installer

`infinum/ai` ships two ways to install its plugins: the `claude plugin` CLI
and a pnpm-based installer script. This kit uses the CLI. `claude plugin` is
the non-interactive form of the `/plugin` slash command — it needs only the
`claude` binary and network access to `github.com` to clone the marketplace
repo. The pnpm path needs pnpm 11.0.8, Node 24+, and npm egress
(`registry.npmjs.org`) to resolve its own dependencies before it can do
anything. A sandbox image already has `claude`; requiring a specific pnpm and
Node version on top, plus a second network domain, buys nothing this kit
doesn't already get from the CLI.

## Why the official marketplace is registered explicitly

`claude-plugins-official` only auto-registers on an interactive first launch
([anthropics/claude-code#66750](https://github.com/anthropics/claude-code/issues/66750)).
A headless provisioning run never gets that far, so the kit registers it the
same way it registers any other marketplace.

## What it installs

| Plugin | Marketplace | Purpose |
|---|---|---|
| `stack-essentials` | `infinum-ai` | SessionStart update-banner hook. Its update check gates on `~/.claude/infinum/.manifest.json`; this kit never writes that file, so the check returns before any network call and the banner never fires here, regardless of egress. |
| `create-prd` | `infinum-ai` | Generate a Product Requirements Document. |
| `pr-review-code-simplicity` | `infinum-ai` | Review a PR through the six laws of software design. |
| `productive-debug` | `infinum-ai` | Investigate a Productive bug task end-to-end. |
| `superpowers` | `claude-plugins-official` | Skills library: brainstorming, writing/executing plans, subagent-driven development, red/green TDD, systematic debugging, code review. |

## What is deliberately not installed

Nine other plugins exist in the `infinum-ai` marketplace but are not
installed here, for two different reasons. Six need local tooling or egress
this sandbox does not have. Three are design-side plugins out of scope for a
Java backend sandbox — they are not blocked by any sandbox limitation. This
table is the detail `spec.yaml`'s `agentInstructions.content` points at. The
reasons below come from upstream
[MARKETPLACE.md](https://github.com/infinum/ai/blob/main/MARKETPLACE.md)'s
Cowork column, which documents the same class of sandboxed-environment
constraint this kit faces:

| Plugin | Why it's excluded |
|---|---|
| `ui-validation` | Local tooling — runs the project's snapshot tests in the user's local dev environment |
| `download-figma-screenshot` | Blocked egress — hits `localhost:3845` and `api.figma.com`, both unreachable from the sandbox |
| `mobile-deploy` | Local tooling — requires the local `app-deploy` CLI and runs git against the project working tree |
| `claude-setup-audit` | Local tooling — reads `~/.claude/` outside the workspace mount |
| `security-check` | Local tooling and blocked egress — needs local package managers, `gh`, and registry/advisory egress |
| `progress` | Local tooling — needs a persistent local filesystem (`~/.claude/progress/`) plus, for cleanup, the local `gh` CLI and git checkout |
| `ai-ready-figma` | Design-side scope — also needs the Figma remote MCP connector enabled |
| `design-conventions` | Design-side scope — pure guidance, not applicable to a Java backend sandbox |
| `purpose-driven-design` | Design-side scope — not applicable to a Java backend sandbox |

Any of them is one command away: `claude plugin install <name>@infinum-ai`.
You can also browse the full marketplace interactively with `/plugin`.

## House rules

The install command copies rule files out of the marketplace clone the
`claude plugin marketplace add` step already made, rather than vendoring its
own copies — there is nothing to drift, and no second network fetch is
needed. That "nothing to drift" claim only holds at create time, though: the
kit never runs `claude plugin marketplace update`, so a long-lived sandbox
keeps the rules pinned to whatever commit was current when it was created:

| Source | Destination | Overwrite behaviour |
|---|---|---|
| `rules/<name>.md` (from the marketplace clone) | `~/.claude/infinum/<name>.md` | Overwritten on every run. `README.md` and `whoami.md` are skipped |
| — | `~/.claude/infinum/whoami.md` | Created once if missing, never overwritten again |
| — | `~/.claude/infinum/index.md` | Regenerated on every run: `@whoami.md` first, then every other rule alphabetically |
| — | `~/.claude/CLAUDE.md` | One `@/home/agent/.claude/infinum/index.md  # managed by infinum/ai` line appended only if absent (the literal, expanded path the script writes, not a `~` shorthand) |

`whoami.md` is the one file that is not treated as marketplace output: it
holds the user's own bio, so it is created from a stub the first time it is
missing and left alone on every subsequent run.

## Third-party code

`superpowers` is third-party (`obra/superpowers`), installed unpinned at
whatever version the marketplace currently serves, and its SessionStart hook
runs on every session. Nothing in this kit pins or verifies it.

Its `brainstorming` skill can start a local web server whose page embeds an
`<img>` pointing at `primeradiant.com`, fetched by whatever browser opens the
page rather than by anything in the sandbox — and only when all three of
`SUPERPOWERS_DISABLE_TELEMETRY`, `DISABLE_TELEMETRY` and
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` are unset or falsy.

## Idempotency

Verified against `claude` 2.1.233 on an isolated `CLAUDE_CONFIG_DIR`:

| State | `marketplace add` | `plugin install` |
|---|---|---|
| Never-initialised config | exit 0, clones | exit 0, installs |
| Re-run | exit 0, "already on disk" | exit 0, "already installed" |

Plugin commands need no interactive onboarding first. The house-rules wiring
is idempotent by construction: `cp` overwrites and converges, `whoami.md` is
guarded by `[ ! -f ]`, `index.md` is regenerated wholesale, and the
`CLAUDE.md` import line is guarded by `grep -qsF`.

## Applying it

```console
$ sbx run claude --kit ./infinum-plugins/ /path/to/project
```

Applying it alongside `infinum-ai` or `superpowers` is redundant but
harmless: `setup.install` lists concatenate and every step is idempotent.
