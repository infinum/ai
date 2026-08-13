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
| [`infinum-ai`](./infinum-ai/) | Registers the `infinum/ai` marketplace, installs four plugins, installs the house rules into `~/.claude/infinum/` | `claude` |
| [`superpowers`](./superpowers/) | Installs the `superpowers` skills library (TDD, debugging, planning) | `claude` |
| [`claude-no-attribution`](./claude-no-attribution/) | Drops the "🤖 Generated with Claude Code" trailer and `Co-Authored-By` line | `claude` |
| [`maven-central`](./maven-central/) | Allows egress to Maven Central. Policy only, installs nothing | any |

Three more register an MCP server at **user scope** — available in every
project in the sandbox, not just the one it was added from — and allow only
that server's hosts. Each has a precondition the other kits don't:

| Kit | Server | Needs |
|---|---|---|
| [`context7`](./context7/) | Current, version-specific library docs | Nothing. `CONTEXT7_API_KEY` optional, for a higher rate limit |
| [`productive`](./productive/) | Projects, tasks, time entries, deals, invoices | Productive **Ultimate** plan, plus a manual OAuth login after creation |
| [`sonarcloud`](./sonarcloud/) | Code quality issues, hotspots, quality gates, coverage | `SONARQUBE_TOKEN` + `SONARQUBE_ORG` in the environment, and a reachable Docker daemon |

A kit whose precondition isn't met warns and skips its registration rather
than failing sandbox creation. Each kit's own README covers its design
decisions; this page covers what is true of all of them.

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

Add the MCP kits per project, rather than by default — each one widens the
allowlist and adds a server the agent will reach for:

```console
$ SONARQUBE_TOKEN=... SONARQUBE_ORG=... sbx run claude \
    --kit ./infinum-ai/ \
    --kit ./context7/ \
    --kit ./sonarcloud/ \
    /path/to/project
```

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
| 1. `sbx kit validate` | **Passing**, zero warnings | **Not run** |
| 2. TCK (`scripts/test-kit.sh`) | **Passing** — validation, network/commands policy, and the `container` subtest | **Not run** |
| 3. e2e under `deny-all` | **Not run.** Needs `sbx` on `PATH` and `/dev/kvm` | **Not run** |
| 4. Manual probe in a live sandbox | **Passing** for the four together — the state below was read out of one | **Not run** |

Layer 2 runs from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib), one
kit per invocation, and needs a working Docker daemon:

```console
$ KIT=/path/to/sandbox-kits/infinum-ai go test -count=1 -run TestKitTCK ./tck/...
```

Its `container/install_execution` subtest really executes the install command
in a container, but it asserts the exit code only — and every kit here that
makes a network call exits 0 by design even when that call fails. Passing
means the script ran to the end, not that anything installed.

### What the three MCP kits have had instead

Their specs parse as YAML and their install scripts pass `sh -n`. Each script
was then run against a stubbed `claude` (and `docker`), covering success,
"already exists" on a re-run, outright failure, missing credentials, and a
missing Docker daemon: every path exits 0 and prints the guidance it means to.

That says the scripts are correct shell that fails safely. It says nothing
about the four things only layers 1–4 can tell you: that `sbx` accepts the
specs, that the declared hosts are sufficient, that the servers connect, or
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

Remember that `Install commands completed` in the create output only means the
install scripts exited 0. Every kit here that makes a network call exits 0 on
purpose even when that call fails, so for those it is not evidence that
anything installed.
