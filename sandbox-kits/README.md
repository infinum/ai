# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits that set up a
sandbox the way Team Java expects one: Infinum house rules and plugins, a
skills library, Maven Central egress, no AI attribution on commits, and the
MCP servers we actually use.

A *kit* is a declarative customization of a sandbox: a `spec.yaml` the `sbx`
engine turns into install commands, files, and network policy at sandbox
creation. Both kits here are `kind: mixin`, so they layer onto a base agent
rather than defining one.

| Kit | What it does | Agent | Needs |
|---|---|---|---|
| [`infinum-full`](./infinum-full/) | Attribution off, Maven Central egress, both plugin marketplaces with five plugins, the house rules in `~/.claude/infinum/`, and the `context7` MCP server. Four `setup.install` steps, five allowed hosts | `claude` | Nothing. A Context7 API key is optional |
| [`sonarcloud`](./sonarcloud/) | The `sonarqube` MCP server: a project's real issues, security hotspots, quality gates, coverage and duplications, from SonarQube Cloud | `claude` | A SonarQube Cloud token, `SONARQUBE_ORG`, and a reachable Docker daemon |

`infinum-full` is the one to reach for first, and it is deliberately
**self-contained**: no Docker, no mandatory credential, nothing to arrange on
the host. `sonarcloud` is separate precisely because it is none of those
things — it needs a container runtime and two values you have to go and find —
so it composes on top, per project, rather than being carried by default:

```console
$ SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org-key> sbx kit add my-sandbox ./sonarcloud/
```

`infinum-full` registers no MCP server for Jira/Confluence, Productive or
GitHub. All three are supported as Claude connectors, which is the recommended
way to use them — enabled once on the account rather than per sandbox, with
their own OAuth and no entry in any kit's allow-list. See
[Atlassian, Productive and GitHub](./infinum-full/README.md#atlassian-productive-and-github-use-the-connectors).

Each kit's own README covers its design decisions; this page covers what is
true of both.

## Both kits fail loudly

Neither kit is best-effort. Every install step runs under `set -eu` and exits
non-zero on any error: an unreachable marketplace, a failed `claude mcp add`,
a missing credential, no `docker` on `PATH`. Any of those **fails sandbox
creation** with the reason on stderr, prefixed `<kit> kit: ERROR`.

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
- **`infinum-full`'s `context7` awaiting its OAuth login**, when no API key
  was bound at creation. That login is interactive and per user, so it cannot
  happen during unattended setup; the note on the creation log says so, and
  [Finishing the OAuth login](./infinum-full/README.md#finishing-the-oauth-login)
  has the command.

That second one is also the one place a missing credential doesn't fail
creation, and it is not a loophole: `infinum-full` never registers an MCP
server it knows cannot work. Without a key it registers Context7's **OAuth**
endpoint instead of the API-key one, because `claude mcp add` cannot amend an
existing entry — an unauthenticated registration would have to be removed
before it could be given a credential, which makes it an obstacle rather than
a head start. `sonarcloud` has no such second endpoint, so there it stays
fatal.

## Credentials

Both kits declare their token under `credentials[]`, so `sbx secret set` is a
supported path and the token itself **never enters the sandbox**: the engine
substitutes the literal sentinel `proxy-managed`, the install step registers
that, and the egress proxy swaps the real value in on requests to the declared
domain.

```console
$ sbx secret set context7  --sandbox my-sandbox -t '<key>'
$ sbx secret set sonarqube --sandbox my-sandbox -t '<token>'
```

Drop `--sandbox` to store a secret for every sandbox on the host. Both entries
are `required: false`, which for `sonarcloud` keeps its original route working
— `SONARQUBE_TOKEN=<token> sbx run …` — rather than forcing a host-side
binding on everyone.

Because of the sentinel, both install steps decide whether a credential exists
from `SBX_CRED_<SERVICE>_MODE` (`apikey`, `oauth` or `none`) rather than from
the variable's contents, which are never a real token when a secret resolved.

`SONARQUBE_ORG` is **not** a credential: an organization key is configuration,
and there is nothing for the proxy to inject it into, so it is always read from
the creation environment.

What creation cannot check either way is whether a credential that *is*
present is valid. A revoked token or a mismatched org key surfaces on the first
tool call.

## Why install commands, not scripts under `files/`

Both kits carry their shell inline in `setup.install`. Neither ships a script
under `files/` and runs it. That is not a style choice; it does not work:

- `files/` only recognises two targets, `files/home/` and `files/workspace/`.
  Any other subdirectory, `files/scripts/` or `files/etc/` for instance, is
  **ignored with a warning**, so a script has to land in the agent's home or
  the workspace or not at all.
- Within a kit's customizer chain, install commands are entry **2** and static
  home files are entry **4** ([lifecycle §8](https://docs.docker.com/ai/sandboxes/customize/kits/)).
  A script shipped under `files/home/` therefore isn't on disk yet when
  `setup.install` runs. The TCK's container subtest copies static files
  *before* executing install commands, so it would pass either way, which
  makes this exactly the kind of gap a green test suite hides.
- A `volumes:` entry with `type: tmpfs` doesn't help: it is mounted **empty**,
  and no `files/` target can populate it.
- `setup.files` is entry **5**, later still, so writing the scripts that way
  and running them from `setup.install` fails for the same reason.

That leaves `setup.startup`, which does run after the files land, but on
every container start, and after the container is already up rather than
before the agent binary launches. Not worth it for writes that belong in the
pre-launch phase.

So a kit that wants several logically separate scripts uses several
`setup.install` entries instead, each with its own `user`, its own
`description` (which is what shows up in the creation progress output) and its
own body. [`infinum-full`](./infinum-full/) is the kit that pushed hardest on
this, with four.

## Applying the kits

At sandbox creation. Everything except SonarQube, one flag and no environment
at all:

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
```

With SonarQube as well:

```console
$ SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org-key> sbx run claude \
    --kit ./infinum-full/ \
    --kit ./sonarcloud/ \
    /path/to/project
```

Order doesn't matter and the two don't conflict: `setup.install` lists
concatenate, allow-lists union, every step is idempotent, and their
`credentials[]` entries name different services. Neither writes a shared
config file directly — both shell out to `claude mcp add` under distinct
server names, so whatever `claude` writes it does one kit at a time and never
twice to the same key. That reasoning is sound but unverified in a live
sandbox.

Leave out `SONARQUBE_TOKEN` or `SONARQUBE_ORG` and creation fails; see
[Both kits fail loudly](#both-kits-fail-loudly).

### `sbx kit add` is not equivalent

`sbx kit add <sandbox> ./<kit>/` applies a kit to an already-running sandbox,
and it is the fast iteration loop when editing one of these — it is also how
you add `sonarcloud` to a sandbox that is already up. But for a `kind: mixin`,
which both are, it silently **skips the kit-memory write**: the engine gates
that write on the artifact's own `agentInstructions.filename`, and a mixin
can't carry one (a mixin contributes *to* the base sandbox's `CLAUDE.md`, it
doesn't define it). The install commands and network policy apply; Claude just
never gets told what the kit did.

That costs more for an MCP server than for the rest. One that is registered
and reachable but unannounced is a server the agent won't think to call, which
is the entire point of the kit — and for a keyless `context7` the agent also
won't know that an auth error means a pending login rather than a fault.

So `kit add` is fine for verifying install behaviour, and wrong for a sandbox
you intend to actually work in. Use `sbx run --kit` there.

The difference is observable, so check it rather than assume it. Each mixin's
`agentInstructions.content` lands in its own file beside the `CLAUDE.md` the
sandbox generated. For a workspace at `/path/to/project`, that is
`/path/to/kits-agent-context/<kit>.md`, not anything in your repo:

```console
$ sbx exec my-sandbox -- ls /path/to/kits-agent-context/
infinum-full.md  sonarcloud.md
```

One file per applied kit after `sbx run --kit`; absent or stale after
`sbx kit add`. The kit-authoring docs call this directory `kits-memory/`, so
go by what is on disk.

## Using these from another machine

The kits are consumed by path above, which assumes a local clone. To use them
from anywhere, reference this repo by git URL. `sbx` requires git refs to be
pinned to a **full 40-hex commit SHA**, and a branch name or tag is
rejected:

```console
$ sbx run claude \
    --kit "git+https://github.com/infinum/ai.git#ref=$(git rev-parse HEAD)&dir=sandbox-kits/infinum-full" \
    /path/to/project
```

Run that `git rev-parse HEAD` in a clone of this repo (or read the SHA off
GitHub) and paste the literal value, because the substitution above only
works if you're standing in the repo. Bumping a sandbox to newer kits means
changing the pinned SHA.

## Schema version

Both kits are `schemaVersion: "2"`, using only canonical v2 sections: egress
under `permissions.network.allow`, install steps under `setup.install`,
credentials under `credentials[]`, and the agent-facing note under
`agentInstructions.content`. No v1 surfaces and no legacy shims, so
`Artifact.Warnings` is empty.

That cuts both ways: v2 is a breaking grammar, and an `sbx` release that
predates it rejects these specs outright with `field agentInstructions not
found in type spec.specFileV2` rather than degrading. If a teammate hits that,
the fix is a newer `sbx`, not a change to the kit. Most of `docker/sbx-kits-contrib`
is still on `schemaVersion: "1"` for exactly this reason.

### `mixins:` will not collapse the `--kit` flags

An umbrella `kind: sandbox` kit listing these under `mixins:` looks like the
obvious simplification of the two-flag invocation above. Two reasons it isn't.

On the `sbx` release these kits were tested against, `mixins:` validated and
then silently did nothing, reporting `field "mixins" is accepted but not yet
implemented`. Re-check that: the current spec reference tags `mixins` **P1** and
documents working resolution, so either the runtime caught up or the docs are
ahead of it.

Either way, a kit using `mixins:` must be `kind: sandbox`, which must supply
`sandbox.image` and may not carry `requires:`, because it *is* the base agent.
The umbrella would pin an image and become a new agent, not a shorthand for
`sbx run claude`. Separate `--kit` flags remain the working form.

## Verification status

The [kit-author testing guidance](https://docs.docker.com/ai/sandboxes/customize/kits/)
defines four layers, and **none of them has been run against either kit**:

| Layer | Why not |
|---|---|
| 1. `sbx kit validate` | No `sbx` on `PATH` in the authoring environment |
| 2. TCK (`scripts/test-kit.sh`) | Needs a container where `claude` is on `PATH` and `github.com` is reachable |
| 3. e2e under `deny-all` | Needs `sbx` and `/dev/kvm`. The gap that matters — see below |
| 4. Manual probe in a live sandbox | Needs a sandbox these kits actually built |

Each kit's own README carries the detail:
[`infinum-full`](./infinum-full/README.md#verification-status) and
[`sonarcloud`](./sonarcloud/README.md#verification-status).

Layer 2 runs from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib), one
kit per invocation, and needs a working Docker daemon:

```console
$ KIT=/path/to/sandbox-kits/infinum-full go test -count=1 -run TestKitTCK ./tck/...
```

Its `container/install_execution` subtest really executes the install command
in a container and asserts the exit code. That assertion used to be free:
every kit that touched the network exited 0 regardless, so passing meant the
script ran to the end and nothing more. Now that the scripts propagate
failure, the same subtest asserts something real, and will **fail** in any
container where `claude` isn't on `PATH` or `github.com` isn't reachable, which
is the likely case. That is the assertion working, not a regression in the
kits: expect to run layer 2 in an environment that can actually satisfy the
install, or to read a failure there as "this container can't install the kit".

### What the install scripts have had instead

Every spec parses as YAML, every `credentials[].apiKey.inject[].domain` is
present in its kit's `permissions.network.allow`, and every extracted install
script passes `sh -n`. Each credential-bearing step was then run against a
stubbed `claude` (and `docker`) on a hermetic `PATH`, asserting the exit code
**and the argv the stub received** for every branch: 12 assertions for
`infinum-full`'s `context7` step (keyed endpoint with the sentinel header,
OAuth endpoint with no header, `oauth` mode, "already exists", outright
failure) and 9 for `sonarcloud` (sentinel, plain-environment token, no token,
no org, no docker). All passing.

That says the scripts are correct shell that fails where it means to, and that
each picks the registration its credential mode calls for. It says nothing
about the four things only layers 1–4 can tell you: that `sbx` accepts the
specs, that the declared hosts are sufficient, that the servers connect, or
that Claude is told about them.

Layer 3 is the gap that matters. It is the only layer that proves an allowlist
is *complete*. For the plugin steps, the `github.com`-only claim rests on the
reasoning that `claude plugin` clones over git smart-HTTP and therefore never
leaves `github.com`, which is sound but untested. The MCP paths are shakier
still: `sonarcloud` pulls an image from Docker Hub (three hosts, any of which
may redirect elsewhere), and a keyless `context7` completes an OAuth flow whose
second host, `context7.com`, is reasoned from how such flows work rather than
observed. A sandbox created under a permissive host policy does not test any
of it. To close the gap, from a checkout of
[`docker/sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib):

```console
$ ./scripts/test-kit-e2e.sh /path/to/sandbox-kits/infinum-full
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
`ai-assisted-prs.md`; and one entry in `claude mcp list` per applied MCP
server. A `context7` registered at `.../mcp/oauth` sits unconnected until
someone runs `claude mcp login context7`.

`Install commands completed` in the create output carries real weight: the
scripts exit non-zero on failure, so a sandbox that came up got past every
check they make. It is still not a substitute for the probes above: a script
can only assert what it looked at, and neither calls an MCP server's API to
prove a credential works.
