# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits that set up a
sandbox the way Team Java expects one: Infinum house rules and plugins, a
skills library, Maven Central egress, and no AI attribution on commits.

A *kit* is a declarative customization of a sandbox — a `spec.yaml` the `sbx`
engine turns into install commands, files, and network policy at sandbox
creation. All four kits here are `kind: mixin`, so they layer onto a base
agent rather than defining one.

| Kit | What it does | Agent |
|---|---|---|
| [`infinum-ai`](./infinum-ai/) | Registers the `infinum/ai` marketplace, installs four plugins, installs the house rules into `~/.claude/infinum/` | `claude` |
| [`superpowers`](./superpowers/) | Installs the `superpowers` skills library (TDD, debugging, planning) | `claude` |
| [`claude-no-attribution`](./claude-no-attribution/) | Drops the "🤖 Generated with Claude Code" trailer and `Co-Authored-By` line | `claude` |
| [`maven-central`](./maven-central/) | Allows egress to Maven Central. Policy only, installs nothing | any |

Each kit's own README covers its design decisions. This page covers what is
true of all four.

## Applying the kits

At sandbox creation, in any order — the kits don't conflict:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./maven-central/ \
    --kit ./superpowers/ \
    /path/to/project
```

Order doesn't matter even though three of them write `~/.claude/settings.json`:
each writer does a read-modify-write, so the attribution keys, the marketplace
registrations and the enabled-plugin list all survive together regardless of
which install command ran last. This is verified, not assumed — see
[Verification status](#verification-status).

### `sbx kit add` is not equivalent

`sbx kit add <sandbox> ./<kit>/` applies a kit to an already-running sandbox,
and it is the fast iteration loop when editing one of these. But for a
`kind: mixin` — which all four are — it silently **skips the kit-memory write**:
the engine gates that write on the artifact's own
`agentInstructions.filename`, and a mixin can't carry one (a mixin contributes
*to* the base sandbox's `CLAUDE.md`, it doesn't define it). The install
commands and network policy apply; Claude just never gets told what the kit
did.

So `kit add` is fine for verifying install behaviour, and wrong for a sandbox
you intend to actually work in. Use `sbx run --kit` there.

The difference is observable, so check it rather than assume it. Each mixin's
`agentInstructions.content` lands in its own file beside the `CLAUDE.md` the
sandbox generated — for a workspace at `/path/to/project`, that is
`/path/to/kits-agent-context/<kit>.md`, not anything in your repo:

```console
$ sbx exec my-sandbox -- ls /path/to/kits-agent-context/
claude-no-attribution.md  infinum-ai.md  maven-central.md  superpowers.md
```

Four files after `sbx run --kit`; absent or stale after `sbx kit add`. The
kit-authoring docs call this directory `kits-memory/` — go by what is on disk.

## Using these from another machine

The kits are consumed by path above, which assumes a local clone. To use them
from anywhere, reference this repo by git URL. `sbx` requires git refs to be
pinned to a **full 40-hex commit SHA** — a branch name or tag is rejected:

```console
$ sbx run claude \
    --kit "git+https://github.com/infinum/ai-team-java.git#ref=$(git rev-parse HEAD)&dir=sandbox-kits/infinum-ai" \
    /path/to/project
```

Run that `git rev-parse HEAD` in a clone of this repo (or read the SHA off
GitHub) and paste the literal value — the substitution above only works if
you're standing in the repo. Bumping a sandbox to newer kits means changing
the pinned SHA.

## Schema version

All four kits are `schemaVersion: "2"`, using only canonical v2 sections:
egress under `permissions.network.allow`, install steps under `setup.install`,
and the agent-facing note under `agentInstructions.content`. No v1 surfaces
and no legacy shims, so `Artifact.Warnings` is empty for all four.

That cuts both ways: v2 is a breaking grammar, and an `sbx` release that
predates it rejects these specs outright with `field agentInstructions not
found in type spec.specFileV2` rather than degrading. If a teammate hits that,
the fix is a newer `sbx`, not a change to the kit. Most of `docker/sbx-kits-contrib`
is still on `schemaVersion: "1"` for exactly this reason.

### `mixins:` will not collapse the four `--kit` flags

An umbrella `kind: sandbox` kit listing these four under `mixins:` looks like
the obvious simplification of the invocation above. Two reasons it isn't.

On the `sbx` release these kits were tested against, `mixins:` validated and
then silently did nothing, reporting `field "mixins" is accepted but not yet
implemented`. Re-check that: the current spec reference tags `mixins` **P1** and
documents working resolution, so either the runtime caught up or the docs are
ahead of it.

Either way, a kit using `mixins:` must be `kind: sandbox` — which must supply
`sandbox.image` and may not carry `requires:`, because it *is* the base agent.
The umbrella would pin an image and become a new agent, not a shorthand for
`sbx run claude`. Four `--kit` flags remain the working form.

## Verification status

The [kit-author testing guidance](https://docs.docker.com/ai/sandboxes/customize/kits/)
defines four layers. Where these kits stand:

| Layer | Status |
|---|---|
| 1. `sbx kit validate` | **Passing.** All four load and validate with zero warnings. |
| 2. TCK (`scripts/test-kit.sh`) | **Passing.** All four pass the full suite — validation, network/commands policy, and the `container` subtest that runs a kit's install command in a real container (vacuous for `maven-central`, which declares none). |
| 3. e2e under `deny-all` | **Not run.** Needs `sbx` on `PATH` and `/dev/kvm`. |
| 4. Manual probe | **Passing** for the four-kit combination — the state below was read out of a live sandbox. |

Layer 2 runs from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib), one
kit per invocation, and needs a working Docker daemon:

```console
$ KIT=/path/to/sandbox-kits/infinum-ai go test -count=1 -run TestKitTCK ./tck/...
```

Its `container/install_execution` subtest really executes the install command
in a container, but it asserts the exit code only — and the two kits that make
network calls, `infinum-ai` and `superpowers`, exit 0 by design even when those
calls fail. Passing means the script ran to the end, not that anything
installed.

Layer 3 is the gap that matters. It is the only layer that proves the
`github.com`-only allowlists in `infinum-ai` and `superpowers` are
*complete*: today that claim rests on the reasoning that `claude plugin`
clones over git smart-HTTP and therefore never leaves `github.com`, which is
sound but untested. A sandbox created under a permissive host policy does not
test it. To close it, from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib):

```console
$ ./scripts/test-kit-e2e.sh /path/to/sandbox-kits/infinum-ai
```

(The script takes the kit directory as its argument and exports
`KIT_UNDER_TEST` itself; setting that variable on the command line has no
effect.)

Every row under `Blocked requests` in `sbx policy log` is a host the kit
reached for and didn't declare.

### What a correct install looks like

```console
$ sbx exec my-sandbox -- jq '.attribution, .enabledPlugins, .extraKnownMarketplaces' \
    /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- cat /home/agent/.claude/infinum/index.md
$ sbx exec my-sandbox -- claude plugin list
```

Expect `attribution.commit` and `attribution.pr` as `""`; five enabled
plugins; both marketplaces registered; `settings.json` owned by `agent`
(never `root`); and `index.md` importing `whoami.md` plus at least
`ai-assisted-prs.md`.

Remember that `Install commands completed` in the create output only means the
install scripts exited 0. `infinum-ai` and `superpowers` exit 0 on purpose even
when their network calls fail, so for those two it is not evidence that anything
installed.
