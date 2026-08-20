# infinum-all

Every kit in this directory, as one mixin. Applying it is equivalent to
applying `infinum-base`, `infinum-plugins`, `context7`, `productive` and
`sonarcloud` together:

| # | Install step | Source kit | Network |
|---|---|---|---|
| — | *(none — policy only)* | `maven-central` | `repo.maven.apache.org`, `repo1.maven.org` |
| 1 | `attribution.commit` / `attribution.pr` → `""` in `~/.claude/settings.json` | `claude-no-attribution` | none |
| 2 | `infinum-ai` marketplace + 4 plugins + house rules into `~/.claude/infinum/` | `infinum-ai` | `github.com` |
| 3 | `claude-plugins-official` marketplace + `superpowers` plugin | `superpowers` | `github.com` |
| 4 | `context7` MCP server at user scope | `context7` | `mcp.context7.com` |
| 5 | `productive` MCP server at user scope | `productive` | `mcp.productive.io`, `app.productive.io` |
| 6 | `sonarqube` MCP server at user scope | `sonarcloud` | Docker Hub ×3, `sonarcloud.io` |

Steps run cheapest-first: the one local write, then the two clone-and-install
steps, then the three registrations. A step that fails fails sandbox creation,
so the steps needing no network fail before the ones that do.

This kit is the source of truth. The narrower kits still in this repository
are downstream of it: they are kept for sandboxes that need a subset — no
Docker daemon, no MCP servers — and a change lands here first, then gets
copied out or the narrower kit gets regenerated from this one. `infinum-base`
and `infinum-plugins` contribute nothing this kit doesn't; they are themselves
consolidations of steps 1–3 plus the Maven policy.

## Six install steps, no `files/` directory

Each step's body is inline in `setup.install` and there is no `files/`
directory, because a script shipped under `files/` isn't on disk yet when
`setup.install` runs — see [Why install commands, not scripts under
`files/`](../README.md#why-install-commands-not-scripts-under-files). The
logical separation those scripts were for lives in the `setup.install` list
instead: one entry per migrated kit, each with its own `description` (numbered
`1/6` … `6/6`, which is what the creation progress output shows).

## Where this kit deviates from the originals

Two deliberate changes. Everything else is the source kits' shell unchanged,
with the error prefix changed to `infinum-all kit:` and comments trimmed where
this README already carries the reasoning.

**A missing API key no longer fails creation.** `context7` and `sonarcloud`
both fail sandbox creation when their credentials are absent. That is right
for a kit you opt into per project and wrong for one kit that carries
everything: most Infinum sandboxes have no Context7 key and no SonarQube
token, and creation must not depend on them. Here, a missing credential warns
on stderr and the server is **registered anyway**:

| Situation | This kit | The single-purpose kit |
|---|---|---|
| `CONTEXT7_API_KEY` unset | Warns; registers `context7` with no `Authorization` header — it works, on Context7's shared public rate limit | Fails creation |
| `SONARQUBE_TOKEN` / `SONARQUBE_ORG` unset (either) | Warns; registers `sonarqube` with no `--env`, so tool calls fail with a SonarQube auth error | Fails creation |
| `docker` not on `PATH` | **Fails creation** | Fails creation |
| `claude mcp add` errors for any other reason | **Fails creation** | Fails creation |
| `productive` not yet logged in | Expected end state, not an error | Expected end state, not an error |

Registering unauthenticated rather than skipping is the point: the server
appears in `claude mcp list`, the agent is told it exists and told it may be
unauthenticated, and the fix is a two-command re-registration instead of a
sandbox recreate. `claude mcp add` never updates an existing entry's header or
env, so supplying the credential later always means
`claude mcp remove <name> -s user` first — see [Credentials](#credentials).

`docker` staying fatal is not an oversight. A missing daemon is an
environment problem the user has to fix, not a degraded mode this kit can
paper over, and the kit is documented as needing one. A sandbox without a
Docker daemon should use `infinum-base` + `infinum-plugins` (+ `context7` /
`productive`) instead.

**No `sbx secret set` advice.** The `context7` and `sonarcloud` kits tell you
to fix a missing credential with `sbx secret set <name> --sandbox …`. That
cannot work: `sbx secret set` feeds the credential-resolution pipeline, which
is only consulted for a service declared in a kit's `credentials[]` block, and
no kit here declares one — they read plain environment variables populated at
creation time. This kit's messages say to pass the variable in the creation
environment instead. Declaring `credentials[]` properly (with
`required: false` and a `SBX_CRED_<SERVICE>_MODE` branch) is the real fix and
is still open, in the originals as well as here.

## Requirements

- Base agent `claude` (`requires.agent: claude`).
- A reachable Docker daemon — step 6 registers a container image.
- Optional: `CONTEXT7_API_KEY`, and `SONARQUBE_TOKEN` + `SONARQUBE_ORG`, in
  the creation environment. Missing ones warn; see the table above.

## Usage

```console
$ CONTEXT7_API_KEY=... SONARQUBE_TOKEN=... SONARQUBE_ORG=... \
    sbx run claude --kit ./infinum-all/ /path/to/project
```

or, with no credentials to hand:

```console
$ sbx run claude --kit ./infinum-all/ /path/to/project
```

Applying it alongside any of the kits it consolidates is redundant but
harmless: `setup.install` lists concatenate, every step is idempotent,
allow-lists union, and `claude mcp add` reports "already exists" on the second
registration, which every step treats as the desired end state.

Nothing in this kit conflicts on `credentials[]` (it declares none) or on
`environment.variables` (likewise), so composition order doesn't matter.

## Credentials

Both servers are registered whether or not the credential was present, so
fixing one afterwards means replacing the registration:

```console
$ claude mcp remove context7 -s user
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user \
    --header "Authorization: Bearer <key>"
```

```console
$ claude mcp remove sonarqube -s user
$ claude mcp add sonarqube -s user \
    --env SONARQUBE_TOKEN=<token> --env SONARQUBE_ORG=<org-key> \
    -- docker run --init --pull=always -i --rm \
      -e SONARQUBE_TOKEN -e SONARQUBE_ORG sonarsource/sonarqube-mcp
```

A free Context7 key comes from <https://context7.com/dashboard>. A SonarQube
Cloud token comes from **My Account → Security**; the organization key is in
the URL of the organization's SonarQube Cloud page. `productive` needs no
credential at creation time — it needs an interactive OAuth login afterwards:
`claude mcp login productive` (add `--no-browser` in a headless session).

## Verify

The parent README's [what a correct install looks
like](../README.md#what-a-correct-install-looks-like) covers steps 1–3,
including `settings.json` having to be owned by `agent` and never `root`
(`root` means the `user: "1000"` setting on an install step regressed). Two
checks are specific to this kit:

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- ls /path/to/kits-agent-context/
```

Expect three MCP entries and `infinum-all.md` in the kits-agent-context
directory. `productive` sitting unconnected is expected until someone logs in;
`context7` or `sonarqube` failing is expected when their credentials were
absent at creation — the creation log carries the warning that says so.

> [!NOTE]
> `sbx kit add my-sandbox ./infinum-all/` applies the install steps and the
> network policy but **not** `agentInstructions.content` — the engine skips
> the kit-memory write for `kind: mixin` artifacts. Everything gets installed;
> the agent is just never told, which costs most for the three MCP servers: a
> server that is registered and reachable but unannounced is one the agent
> won't think to call. Use `sbx run --kit` for a sandbox you intend to work
> in. See [Applying the kits](../README.md#applying-the-kits).

## Duplication with the narrower kits

Mixins cannot compose mixins, so steps 1–3 also exist as shell in
`claude-no-attribution` / `infinum-ai` / `superpowers` and in `infinum-base` /
`infinum-plugins`, and steps 4–6 in `context7` / `productive` / `sonarcloud`.
Those copies are not kept byte-identical to these any more: a change lands
here, and a narrower kit that still needs it gets updated from here. Nothing
detects drift, by design — this direction is the only one that matters.

## Verification status

All [four testing layers](../README.md#verification-status) are **not run**:
there is no `sbx` on `PATH` in the authoring environment, and the TCK's
`container/install_execution` subtest asserts real exit codes, so it needs a
container where `claude` is on `PATH`, `github.com` is reachable and a Docker
daemon is available. Layer 3 is the gap that matters most — it is the only one
that proves the ten-host allow-list is *complete*.

What it has had instead: the spec parses as YAML, all six extracted install
commands pass `sh -n`, and each was run against stubbed `claude`, `jq` and
`docker` on a hermetic `PATH` — **53 assertions, all passing**, covering every
exit path, both credential branches, and the `settings.json` and `CLAUDE.md`
idempotency cases. That harness lived in a session scratchpad and is not in
this repository, so it is a claim about the past rather than a check anyone can
re-run.

That says the steps are correct shell that fails where it means to. It says
nothing about what only layers 1–4 can tell you: that `sbx` accepts the spec,
that ten hosts are enough, that the servers connect, or that Claude is told
about them.

## References

- [Kit spec](spec.yaml)
- The kits this one consolidates:
  [`claude-no-attribution`](../claude-no-attribution/),
  [`maven-central`](../maven-central/), [`infinum-ai`](../infinum-ai/),
  [`superpowers`](../superpowers/), [`context7`](../context7/),
  [`productive`](../productive/), [`sonarcloud`](../sonarcloud/) — and their
  pairwise consolidations [`infinum-base`](../infinum-base/) and
  [`infinum-plugins`](../infinum-plugins/)
- [Kits directory README](../README.md) — what is true of all of them
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
