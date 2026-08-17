# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits that set up a
sandbox the way Team Java expects one: Infinum house rules and plugins, a
skills library, Maven Central egress, no AI attribution on commits, and the
MCP servers we actually use.

A *kit* is a declarative customization of a sandbox — a `spec.yaml` the `sbx`
engine turns into install commands, files, and network policy at sandbox
creation. Every kit here is `kind: mixin`, so they layer onto a base agent
rather than defining one.

| Kit | What it does | Agent |
|---|---|---|
| [`infinum-base`](./infinum-base/) | Drops AI attribution from commits and PRs, and allows Maven Central egress | `claude` |
| [`infinum-plugins`](./infinum-plugins/) | Registers both marketplaces, installs five plugins, installs the house rules into `~/.claude/infinum/` | `claude` |

Each of those consolidates two of the four single-purpose kits below, which
remain available and unchanged:

| Kit | What it does | Agent | Also in |
|---|---|---|---|
| [`infinum-ai`](./infinum-ai/) | Registers the `infinum/ai` marketplace, installs four plugins, installs the house rules into `~/.claude/infinum/` | `claude` | `infinum-plugins` |
| [`superpowers`](./superpowers/) | Installs the `superpowers` skills library (TDD, debugging, planning) | `claude` | `infinum-plugins` |
| [`claude-no-attribution`](./claude-no-attribution/) | Drops the "🤖 Generated with Claude Code" trailer and `Co-Authored-By` line | `claude` | `infinum-base` |
| [`maven-central`](./maven-central/) | Allows egress to Maven Central. Policy only, installs nothing | any | `infinum-base` |

Three more register an MCP server at **user scope** — available in every
project in the sandbox, not just the one it was added from — and allow only
that server's hosts. Each has a precondition the other kits don't:

| Kit | Server | Needs |
|---|---|---|
| [`context7`](./context7/) | Current, version-specific library docs | `CONTEXT7_API_KEY` in the environment |
| [`productive`](./productive/) | Projects, tasks, time entries, deals, invoices | Productive **Ultimate** plan, plus a manual OAuth login after creation |
| [`sonarcloud`](./sonarcloud/) | Code quality issues, hotspots, quality gates, coverage | `SONARQUBE_TOKEN` + `SONARQUBE_ORG` in the environment, and a reachable Docker daemon |

Each kit's own README covers its design decisions; this page covers what is
true of all of them.

## Every kit fails loudly

No kit here is best-effort. Every install step runs under `set -eu` and exits
non-zero on any error — an unreachable marketplace, a failed `claude mcp add`,
a missing credential, no `docker` on `PATH` — which **fails sandbox creation**
with the reason on stderr, prefixed `<kit> kit: ERROR`.

The alternative, which these kits used to do, is worse: warn on stderr, exit
0, and hand back a sandbox that comes up healthy and quietly lacks the thing
the kit exists to install. Nobody reads creation logs for a sandbox that
started fine. An MCP server that was never registered, or house rules that
`CLAUDE.md` advertises and doesn't have, then surface much later as the agent
behaving oddly.

Two outcomes are deliberately **not** errors:

- **Already applied.** `claude mcp add` exits 1 with "already exists" and the
  `claude plugin` commands exit 0 with "already on disk" / "already
  installed". Every script treats those as the desired end state, so
  re-applying a kit is safe.
- **`productive` awaiting its OAuth login.** That login is interactive and per
  user, so it cannot happen during unattended setup. Registration succeeding
  with the server unauthorized is the expected result — see the
  [kit README](./productive/README.md).

Credentials are checked before they're used, and are only ever read from the
environment — never hardcoded in a spec. `context7` needs `CONTEXT7_API_KEY`;
`sonarcloud` needs `SONARQUBE_TOKEN` and `SONARQUBE_ORG`. A missing one fails
creation immediately, rather than at the first tool call. What creation cannot
check is whether a credential that *is* present is valid — a revoked token or
a mismatched org key surfaces on first use.

## Applying the kits

At sandbox creation, in any order — the kits don't conflict:

```console
$ sbx run claude \
    --kit ./infinum-base/ \
    --kit ./infinum-plugins/ \
    /path/to/project
```

The four single-purpose kits still work, and the two forms are equivalent —
`infinum-base` carries `claude-no-attribution` plus `maven-central`, and
`infinum-plugins` carries `infinum-ai` plus `superpowers`. Mixing them is
redundant but harmless: `setup.install` lists concatenate, every step is
idempotent, and the allow-lists union.

Add the MCP kits per project, rather than by default — each one widens the
allowlist and adds a server the agent will reach for:

```console
$ CONTEXT7_API_KEY=... SONARQUBE_TOKEN=... SONARQUBE_ORG=... sbx run claude \
    --kit ./infinum-ai/ \
    --kit ./context7/ \
    --kit ./sonarcloud/ \
    /path/to/project
```

Leave one of those out and creation fails — see
[Every kit fails loudly](#every-kit-fails-loudly).

Order doesn't matter. Three of the first four write `~/.claude/settings.json`,
and each writer does a read-modify-write, so the attribution keys, the
marketplace registrations and the enabled-plugin list all survive together
regardless of which install command ran last. This is verified, not assumed —
see [Verification status](#verification-status). The three MCP kits don't
write any config file themselves — they shell out to `claude mcp add`, each
under a distinct server name, so whatever `claude` writes it does one kit at a
time and never twice to the same key. That reasoning is sound but, unlike the
claim above, unverified in a live sandbox.

### `sbx kit add` is not equivalent

`sbx kit add <sandbox> ./<kit>/` applies a kit to an already-running sandbox,
and it is the fast iteration loop when editing one of these. But for a
`kind: mixin` — which all of them are — it silently **skips the kit-memory
write**: the engine gates that write on the artifact's own
`agentInstructions.filename`, and a mixin can't carry one (a mixin contributes
*to* the base sandbox's `CLAUDE.md`, it doesn't define it). The install
commands and network policy apply; Claude just never gets told what the kit
did.

That costs more for the MCP kits than for the rest. An MCP server that is
registered and reachable but unannounced is a server the agent won't think to
call, which is the entire point of the kit.

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

One file per applied kit after `sbx run --kit`; absent or stale after
`sbx kit add`. The kit-authoring docs call this directory `kits-memory/` — go
by what is on disk.

## Using these from another machine

The kits are consumed by path above, which assumes a local clone. To use them
from anywhere, reference this repo by git URL. `sbx` requires git refs to be
pinned to a **full 40-hex commit SHA** — a branch name or tag is rejected:

```console
$ sbx run claude \
    --kit "git+https://github.com/infinum/ai.git#ref=$(git rev-parse HEAD)&dir=sandbox-kits/infinum-ai" \
    /path/to/project
```

Run that `git rev-parse HEAD` in a clone of this repo (or read the SHA off
GitHub) and paste the literal value — the substitution above only works if
you're standing in the repo. Bumping a sandbox to newer kits means changing
the pinned SHA.

## Schema version

All seven kits are `schemaVersion: "2"`, using only canonical v2 sections:
egress under `permissions.network.allow`, install steps under `setup.install`,
and the agent-facing note under `agentInstructions.content`. No v1 surfaces
and no legacy shims, so `Artifact.Warnings` is empty.

That cuts both ways: v2 is a breaking grammar, and an `sbx` release that
predates it rejects these specs outright with `field agentInstructions not
found in type spec.specFileV2` rather than degrading. If a teammate hits that,
the fix is a newer `sbx`, not a change to the kit. Most of `docker/sbx-kits-contrib`
is still on `schemaVersion: "1"` for exactly this reason.

### `mixins:` will not collapse the `--kit` flags

An umbrella `kind: sandbox` kit listing these under `mixins:` looks like the
obvious simplification of the invocation above. Two reasons it isn't.

On the `sbx` release these kits were tested against, `mixins:` validated and
then silently did nothing, reporting `field "mixins" is accepted but not yet
implemented`. Re-check that: the current spec reference tags `mixins` **P1** and
documents working resolution, so either the runtime caught up or the docs are
ahead of it.

Either way, a kit using `mixins:` must be `kind: sandbox` — which must supply
`sandbox.image` and may not carry `requires:`, because it *is* the base agent.
The umbrella would pin an image and become a new agent, not a shorthand for
`sbx run claude`. Separate `--kit` flags remain the working form.

## Verification status

The [kit-author testing guidance](https://docs.docker.com/ai/sandboxes/customize/kits/)
defines four layers. Where these kits stand:

| Layer | `claude-no-attribution`, `infinum-ai`, `maven-central`, `superpowers` | `context7`, `productive`, `sonarcloud` |
|---|---|---|
| 1. `sbx kit validate` | **Passing**, zero warnings — before the fail-loudly change; only `command:` bodies and prose moved, so re-run to confirm | **Not run** |
| 2. TCK (`scripts/test-kit.sh`) | **Stale.** Passed before the fail-loudly change; the `container` subtest is expected to fail now — see below | **Not run** |
| 3. e2e under `deny-all` | **Not run.** Needs `sbx` on `PATH` and `/dev/kvm` | **Not run** |
| 4. Manual probe in a live sandbox | **Passing** for the four together — the state below was read out of one, before the fail-loudly change | **Not run** |

Layer 2 runs from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib), one
kit per invocation, and needs a working Docker daemon:

```console
$ KIT=/path/to/sandbox-kits/infinum-ai go test -count=1 -run TestKitTCK ./tck/...
```

Its `container/install_execution` subtest really executes the install command
in a container and asserts the exit code. That assertion used to be free:
every kit that touched the network exited 0 regardless, so passing meant the
script ran to the end and nothing more. Now that the scripts propagate
failure, the same subtest asserts something real — and will **fail** in any
container where `claude` isn't on `PATH` or `github.com` isn't reachable, which
is the likely case. That is the assertion working, not a regression in the
kits: expect to run layer 2 in an environment that can actually satisfy the
install, or to read a failure there as "this container can't install the kit".

### What the install scripts have had instead

Every spec parses as YAML and every extracted install script passes `sh -n`.
Each was then run against a stubbed `claude` (and `docker`) on a hermetic
`PATH`, asserting the **exit code** for each path: success, "already exists"
on a re-run, outright failure, missing credentials, and a missing Docker
daemon — 31 assertions across the six kits with install steps, all passing.
`infinum-ai` additionally asserts its on-disk result: `whoami.md` stub,
copied rules, generated `index.md`, the `CLAUDE.md` import line, that an
upstream `whoami.md` never clobbers the stub, that `README.md` stays out of
`index.md`, and that a second run doesn't duplicate the import.

That says the scripts are correct shell that fails where it means to. It says
nothing about the four things only layers 1–4 can tell you: that `sbx` accepts
the specs, that the declared hosts are sufficient, that the servers connect, or
that Claude is told about them.

Layer 3 is the gap that matters, and it matters more now than it did with four
kits. It is the only layer that proves an allowlist is *complete*. For
`infinum-ai` and `superpowers` the `github.com`-only claim rests on the
reasoning that `claude plugin` clones over git smart-HTTP and therefore never
leaves `github.com` — sound but untested. The MCP kits are shakier still:
`sonarcloud` pulls an image from Docker Hub (three hosts, any of which may
redirect elsewhere) and `productive` completes an OAuth flow across two hosts.
A sandbox created under a permissive host policy does not test any of it. To
close the gap, from a checkout of
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
$ sbx exec my-sandbox -- claude mcp list
```

Expect `attribution.commit` and `attribution.pr` as `""`; five enabled
plugins; both marketplaces registered; `settings.json` owned by `agent`
(never `root`); `index.md` importing `whoami.md` plus at least
`ai-assisted-prs.md`; and one entry in `claude mcp list` per applied MCP kit
(`productive` will sit unconnected until someone runs `claude mcp login
productive`).

`Install commands completed` in the create output now carries real weight: the
scripts exit non-zero on failure, so a sandbox that came up got past every
check they make. It is still not a substitute for the probes above — a script
can only assert what it looked at, and none of them calls an MCP server's API
to prove a credential works.
