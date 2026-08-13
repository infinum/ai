# superpowers

Installs the `superpowers` Claude Code plugin (the public repo
`obra/superpowers`) from the `claude-plugins-official` marketplace.

This is a mixin with `requires.agent: claude`: it composes onto the `claude`
base agent only, and applying it to another one is a composition error that
fails sandbox creation rather than quietly doing nothing.

## Why the official marketplace

[obra/superpowers](https://github.com/obra/superpowers#claude-code)
documents two installation paths:

```
/plugin install superpowers@claude-plugins-official
```

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Both install the identical plugin. This kit uses the first path, but that
path is not zero-step in a headless sandbox: `claude-plugins-official` only
auto-registers on an interactive first launch of the CLI
(anthropics/claude-code#66750), which a non-interactive provisioning run
never triggers. So this kit runs its own explicit
`claude plugin marketplace add anthropics/claude-plugins-official` before
installing — same shape as `infinum-ai`'s `marketplace add`, just against
the built-in official repo instead of a private one. Still avoids the
second repo (`superpowers-marketplace`) entirely; one extra command, still
one network domain.

## What it installs

One plugin, `superpowers`, adding a skills library invoked with the `Skill`
tool:

| Skill | Purpose |
|---|---|
| `using-superpowers` | Orientation skill; injected into every session automatically (see below) |
| `brainstorming` | Interactive design refinement before writing a plan |
| `writing-plans` | Turn a design into a step-by-step implementation plan |
| `executing-plans` | Work through a written plan task-by-task |
| `subagent-driven-development` | Delegate plan tasks to subagents with built-in code review |
| `dispatching-parallel-agents` | Fan out independent work across agents |
| `test-driven-development` | Red/green TDD cycle |
| `systematic-debugging` | Structured root-cause debugging |
| `requesting-code-review` | Ask for a code review in the project's own terms |
| `receiving-code-review` | Act on code review feedback |
| `using-git-worktrees` | Isolate work in a git worktree |
| `finishing-a-development-branch` | Wrap up and merge a completed branch |
| `verification-before-completion` | Confirm a task is actually done before reporting it done |
| `writing-skills` | Author and test new skills for this same framework |

## SessionStart hook

The plugin registers a `SessionStart` hook that reads
`skills/using-superpowers/SKILL.md` out of the installed plugin and injects
it into context at the start of every session (`startup`, `clear`, and
`compact`). This is a local file read with no network call — it runs
identically whether or not this kit's install command ever reached GitHub on
a given day, since it reads from the plugin already cached on disk.

## Optional local UI and telemetry

The `brainstorming` skill can start a local HTTP server for an interactive
brainstorming UI. The page it serves includes a small `<img>` pointing at
`primeradiant.com`. That request is made by whatever browser opens the page
(typically the user's, via a forwarded port), not by anything running inside
this sandbox, so it is not something this kit's `permissions.network.allow`
needs to account for. It only fires when **all three** of
`SUPERPOWERS_DISABLE_TELEMETRY`, `DISABLE_TELEMETRY` and
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` are unset or falsy
(`skills/brainstorming/scripts/server.cjs`). The third one is the standard
Claude Code switch, so an environment that already sets it has this off
without doing anything.

## Supply chain

`superpowers` is third-party code — `obra/superpowers`, not an Anthropic
repository, reached through Anthropic's marketplace. Two things follow, and
neither is mitigated by this kit:

- **It is unpinned.** `claude plugin install` takes whatever version the
  marketplace currently serves; there is no version or checksum in this kit to
  compare against. Two sandboxes created a week apart can get different code.
- **It executes on every session.** The `SessionStart` hook above runs a
  bundled script at every `startup`, `clear`, and `compact`, and the
  `brainstorming` skill can start a local HTTP server.

That is an accepted risk, not an oversight: the plugin is the point of the
kit, and the `claude plugin` CLI offers no pinning to accept it more
carefully. It is worth knowing before adding this kit to a sandbox that
handles anything sensitive.

## Best-effort by design

The install step always exits 0. If either `claude plugin marketplace add` or
`claude plugin install` fails — most likely because `github.com` is
unreachable, since both commands clone over git smart-HTTP — the script warns
on stderr rather than failing the sandbox. A failed `marketplace add` short-circuits the rest of the step,
same as `infinum-ai` does for its own marketplace registration. Retry inside
the sandbox once the network issue is resolved:

```console
$ claude plugin marketplace add anthropics/claude-plugins-official
$ claude plugin install superpowers@claude-plugins-official
```

## Network

This kit adds exactly one domain to `permissions.network.allow`: `github.com`.
Registering the marketplace clones `https://github.com/anthropics/claude-plugins-official.git`;
the plugin's manifest entry in it is a `url`-type source
(`https://github.com/obra/superpowers.git`), so installing it clones that
repo directly over git smart-HTTP rather than reading it out of the
marketplace repo's own clone. Both repos are public, so no credentials are
needed.

## Usage

```console
$ sbx run claude --kit ./superpowers/ /path/to/project
```

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./superpowers/
```

> [!NOTE]
> `sbx kit add` runs the install step but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. The plugin installs and its own SessionStart hook
> still injects `using-superpowers`, so the skills work; what's missing is the
> kit's note listing them and the telemetry caveat. Use `sbx run --kit` for a
> sandbox you intend to work in. See
> [Applying the kits](../README.md#applying-the-kits).

## Verify

The install step always exits 0, so "Install commands completed" only
means the script ran to the end — it does not mean the marketplace was
registered or the plugin actually installed. Check the outcome directly:

```console
$ sbx exec my-sandbox -- claude plugin list
$ sbx exec my-sandbox -- jq '.extraKnownMarketplaces, .enabledPlugins' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
```

Expect: the plugin list includes `superpowers@claude-plugins-official`; the
`jq` output shows `claude-plugins-official` under `extraKnownMarketplaces`
and `superpowers@claude-plugins-official: true` under `enabledPlugins`; the
`stat` reports `agent`, not `root`.

Then confirm idempotency:

```console
$ sbx kit add my-sandbox ./superpowers/     # second application must stay clean
```

Expect: `claude plugin install` reports the plugin is already installed and
still exits 0.

## References

- [Kit spec](spec.yaml)
- [obra/superpowers — Claude Code install instructions](https://github.com/obra/superpowers#claude-code)
