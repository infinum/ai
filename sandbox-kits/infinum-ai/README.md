# infinum-ai

Registers the `infinum-ai` Claude Code plugin marketplace (the public repo
`infinum/ai`), installs four of its plugins (`stack-essentials`,
`create-prd`, `pr-review-code-simplicity`, `productive-debug`), and installs
the Infinum house rules into `~/.claude/infinum/`, chained from an
`index.md` that `~/.claude/CLAUDE.md` imports.

This is a mixin with `requires.agent: claude`: it composes onto the `claude`
base agent only, and applying it to another one is a composition error that
fails sandbox creation rather than quietly doing nothing.

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
installed here, for two different reasons. Six need local tooling or egress
this sandbox does not have. Three are design-side plugins out of scope for a
Java backend sandbox — they are not blocked by any sandbox limitation. This
table is the detail `spec.yaml`'s `agentInstructions.content` points at. The reasons
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
| `rules/<name>.md` (from the marketplace clone) | `~/.claude/infinum/<name>.md` | Overwritten on every run. `README.md` and `whoami.md` are skipped |
| — | `~/.claude/infinum/whoami.md` | Created once if missing, never overwritten again |
| — | `~/.claude/infinum/index.md` | Regenerated on every run: `@whoami.md` first, then every other rule alphabetically |
| — | `~/.claude/CLAUDE.md` | One `@/home/agent/.claude/infinum/index.md  # managed by infinum/ai` line appended only if absent (the literal, expanded path the script writes, not a `~` shorthand) |

`whoami.md` is the one file that is not treated as marketplace output: it
holds the user's own bio, so it is created from a stub the first time it is
missing and left alone on every subsequent run. That is also why the stub is
written by the install command rather than shipped as a static file under
`files/home/` — static kit files are re-placed on **every** container start,
which would overwrite the user's own bio each time the sandbox restarts.

The copy step skips `rules/whoami.md` for the same reason: nothing upstream
ships that name today, but if it did it would overwrite the bio before the
create-once guard ever ran. `rules/README.md` is contributor documentation, not
a rule, and is skipped too. Bundles
(`rules/<bundle>/`) are not installed by this kit because the copy step
globs `rules/*.md`, which matches flat files only and never descends into
a bundle subdirectory — the glob simply doesn't see them. Upstream also
gates bundles behind a TTY prompt, which a non-interactive install command
has no way to answer, so even if the glob did reach them they would still
need to be skipped.

The copy step never deletes. A rule that upstream removes therefore stays
behind in a sandbox that gets recreated on the same home volume, and
`index.md` keeps importing it, because `index.md` is regenerated from whatever
`*.md` currently sits in `~/.claude/infinum/`. That is the deliberate trade:
pruning would mean deleting files from a directory a user may have added their
own rules to. Delete a stale rule by hand if you hit it.

## Fails fast by design

The install command runs under `set -eu` and **fails sandbox creation** on the
first error, with an actionable message on stderr. Every step is mandatory:

- `claude plugin marketplace add` failing.
- any one of the four plugins failing to install — the loop stops there rather
  than pressing on with the rest.
- no `rules/*.md` found in the marketplace clone, which would mean the house
  rules this kit exists to install are missing.

It used to warn and continue instead, scoping each failure to what depended on
the network: a `github.com`-blocked sandbox still came up "wired" — `whoami.md`,
`index.md` and the `CLAUDE.md` import line all written — with no plugins and no
rules behind them. That is precisely the state worth refusing, because
`CLAUDE.md` then advertises house rules that aren't there.

One consequence of failing fast: the local wiring in step 4 is never reached
when an earlier step fails, so a failed creation leaves nothing half-written
for the next attempt to trip over.

Both `claude plugin marketplace add` and `claude plugin install` are
idempotent — they exit 0 with "already on disk" / "already installed" — so
re-applying the kit to a sandbox that already has it is not an error.

`infinum/ai` is public, so the most common cause of a failed marketplace add is
network policy blocking `github.com` — sandboxes have no default GitHub
credential and none is needed here. Check with `sbx policy log`, then retry
inside the sandbox:

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

## Usage

```console
$ sbx run claude --kit ./infinum-ai/ /path/to/project
```

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./infinum-ai/
```

> [!NOTE]
> `sbx kit add` runs the install command but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. The plugins and rules land; Claude just isn't told
> they did, including the warning that `whoami.md` may still be a stub. Use
> `sbx run --kit` for a sandbox you intend to work in. See
> [Applying the kits](../README.md#applying-the-kits).

## Verify

`Install commands completed` is now worth something for this kit: the install
command exits non-zero on every failure, so a sandbox that came up has the
marketplace, the four plugins and at least one rule. It still says nothing
about *which* rules landed, so check the outcome:

```console
$ sbx exec my-sandbox -- claude plugin marketplace list
$ sbx exec my-sandbox -- claude plugin list
$ sbx exec my-sandbox -- cat /home/agent/.claude/infinum/index.md
$ sbx exec my-sandbox -- grep infinum /home/agent/.claude/CLAUDE.md
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
```

Expect: the marketplace list includes `infinum-ai`; the plugin list includes
the four plugins above; `index.md` imports `whoami.md` plus at least
`ai-assisted-prs.md`; the `grep` finds the import line; and the `stat`
reports `agent`, not `root` — `root` means the `user: "1000"` setting on the
install command regressed.

### Combined with `claude-no-attribution` and `superpowers`

Three of these kits write `~/.claude/settings.json` — this one via
`claude plugin install`, `claude-no-attribution` via a `jq` merge,
`superpowers` via its own plugin install. They coexist because every writer
does a read-modify-write, so `--kit` order doesn't matter. This is verified in
a live sandbox, not inferred:

```console
$ sbx exec my-sandbox -- jq '.attribution, .enabledPlugins' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
```

Expect `attribution.commit`/`.pr` as `""` **and** all four plugins from this
kit (plus `superpowers`, if applied) as `true` in `enabledPlugins`, with the
file still owned by `agent`.

## References

- [Kit spec](spec.yaml)
- [MARKETPLACE.md](https://github.com/infinum/ai/blob/main/MARKETPLACE.md)
