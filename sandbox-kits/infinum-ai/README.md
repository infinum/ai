# infinum-ai

Registers the `infinum-ai` Claude Code plugin marketplace (the public repo
`infinum/ai`), installs four of its plugins (`stack-essentials`,
`create-prd`, `pr-review-code-simplicity`, `productive-debug`), and installs
the Infinum house rules into `~/.claude/infinum/`, chained from an
`index.md` that `~/.claude/CLAUDE.md` imports. This is a mixin,
`requires.agent: claude` — it needs the `claude` binary already on `PATH`
and does nothing without it.

## Why not the pnpm installer

`infinum/ai` ships two ways to install its plugins: the `claude plugin` CLI
and a pnpm-based installer script. This kit uses the CLI. `claude plugin` is
the non-interactive form of the `/plugin` slash command — it needs only the
`claude` binary and network access to `github.com` to clone the marketplace
repo. The pnpm path needs pnpm 11.0.8, Node 24+, and npm egress
(`registry.npmjs.org`) to resolve its own dependencies before it can do
anything. A sandbox image already has `claude`; requiring a specific pnpm
and Node version on top, plus a second network domain, buys nothing this
kit doesn't already get from the CLI.

## What it installs

| Plugin | Purpose |
|---|---|
| `stack-essentials` | SessionStart update-banner hook. Its update check gates on `~/.claude/infinum/.manifest.json`; this kit never writes that file, so the check returns before any network call and the banner never fires here, regardless of egress. |
| `create-prd` | Generate a Product Requirements Document. |
| `pr-review-code-simplicity` | Review a PR through the six laws of software design. |
| `productive-debug` | Investigate a Productive bug task end-to-end. |

## What is deliberately not installed

Nine other plugins exist in the `infinum-ai` marketplace but are not
installed here, for two different reasons — matching `spec.yaml`'s
`agentInstructions.content`. Six need local tooling or egress this sandbox does not
have. Three are design-side plugins out of scope for a Java backend
sandbox — they are not blocked by any sandbox limitation. The reasons
below come from upstream
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
`claude plugin marketplace add` step already made, rather than vendoring
its own copies — there is nothing to drift, and no second network fetch is
needed. That "nothing to drift" claim only holds at create time, though:
the kit never runs `claude plugin marketplace update`, so a long-lived
sandbox keeps the rules pinned to whatever commit was current when it was
created:

| Source | Destination | Overwrite behaviour |
|---|---|---|
| `rules/<name>.md` (from the marketplace clone) | `~/.claude/infinum/<name>.md` | Overwritten on every run |
| — | `~/.claude/infinum/whoami.md` | Created once if missing, never overwritten again |
| — | `~/.claude/infinum/index.md` | Regenerated on every run: `@whoami.md` first, then every other rule alphabetically |
| — | `~/.claude/CLAUDE.md` | One `@/home/agent/.claude/infinum/index.md  # managed by infinum/ai` line appended only if absent (the literal, expanded path the script writes, not a `~` shorthand) |

`whoami.md` is the one file that is not treated as marketplace output: it
holds the user's own bio, so it is created from a stub the first time it is
missing and left alone on every subsequent run. `rules/README.md` is
contributor documentation, not a rule, and is skipped. Bundles
(`rules/<bundle>/`) are not installed by this kit because the copy step
globs `rules/*.md`, which matches flat files only and never descends into
a bundle subdirectory — the glob simply doesn't see them. Upstream also
gates bundles behind a TTY prompt, which a non-interactive install command
has no way to answer, so even if the glob did reach them they would still
need to be skipped.

## Best-effort by design

The install command always exits 0. Every failure — `claude` missing, the
marketplace unreachable, a single plugin failing to install, no rules found
in the clone — is a warning on stderr, not a failed sandbox. `infinum/ai` is
public, so the most common cause of a failed marketplace add is network
policy blocking `github.com` — sandboxes have no default GitHub credential
and none is needed here. Check with `sbx policy log`, then retry inside the
sandbox:

```console
$ claude plugin marketplace add infinum/ai
```

## Network

This kit adds exactly one domain to `permissions.network.allow`: `github.com`.
`claude plugin marketplace add` clones the marketplace repo over git
smart-HTTP, which talks only to `github.com`.

| Host | Why it's not needed |
|---|---|
| `api.github.com` | The plugin CLI makes no REST calls |
| `codeload.github.com` | Serves tarballs, not git clones |
| `registry.npmjs.org` | Only the pnpm installer path needs npm |

## Schema version

Written as `schemaVersion: "2"`: egress lives under `permissions.network.allow`,
the install step under `setup.install`, and the sandbox note under
`agentInstructions.content`.

## Usage

```console
$ sbx run claude --kit ./infinum-ai/ /path/to/project
```

Combine with the other kits in this directory:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./maven-central/ \
    /path/to/project
```

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./infinum-ai/
```

## Verify

The install command always exits 0, so `Install commands completed` only
means the script ran to the end — it does not mean the marketplace was
reachable or the plugins installed. Check the actual outcome:

```console
$ sbx exec my-sandbox -- claude plugin marketplace list
$ sbx exec my-sandbox -- claude plugin list
$ sbx exec my-sandbox -- cat /home/agent/.claude/infinum/index.md
$ sbx exec my-sandbox -- grep infinum /home/agent/.claude/CLAUDE.md
$ sbx exec my-sandbox -- stat -c '%U %n' /home/agent/.claude/settings.json
```

Expect: the marketplace list includes `infinum-ai`; the plugin list includes
the four plugins above; `index.md` imports `whoami.md` plus at least
`ai-assisted-prs.md`; the `grep` finds the import line; and the `stat`
reports `agent`, not `root` — `root` means the `user: "1000"` setting on the
install command regressed.

### Verifying it combined with `claude-no-attribution`

The Usage section above recommends combining this kit with
`claude-no-attribution`, but that combination has not actually been run:
`claude-no-attribution` installs as **root** and rewrites the same
`~/.claude/settings.json` via `mktemp`/`mv`/`chown` (see its own
`spec.yaml`), while this kit's plugin installs write to that file as the
agent user. After running both together, confirm neither clobbers the
other:

```console
$ sbx exec my-sandbox -- jq '.enabledPlugins' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- jq '.attribution.commit' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %n' /home/agent/.claude/settings.json
```

Expect: `enabledPlugins` lists all four plugins from this kit as `true`;
`attribution.commit` is still `""`; and the `stat` still reports `agent` —
all three surviving together regardless of which kit's install command ran
last.

## References

- [Kit spec](spec.yaml)
- [MARKETPLACE.md](https://github.com/infinum/ai/blob/main/MARKETPLACE.md)
