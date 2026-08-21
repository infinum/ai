# infinum-full

One mixin that takes a fresh `claude` sandbox to a working Infinum setup. Apply
it at creation time and you get:

- Claude Code's commit and PR attribution switched off.
- Maven Central reachable, so Maven, Gradle, sbt and Coursier can resolve
  dependencies.
- The `infinum-ai` plugin marketplace registered, with four Infinum plugins
  installed.
- The Infinum house rules installed at `~/.claude/infinum/` and imported from
  `~/.claude/CLAUDE.md`.
- The `superpowers` skills library installed.
- Three MCP servers (`context7`, `productive`, `sonarqube`) registered at user
  scope, so they are available in every project in the sandbox. Two of them
  authenticate from optional sandbox secrets; the third needs an OAuth login.
- Agent instructions describing all of the above, so the agent knows what it
  has.

Everything the kit does is documented on this page, and the spec depends on
nothing outside this directory.

## Prerequisites

- **Base agent `claude`.** The kit is a mixin with `requires.agent: claude`.
  That is the only prerequisite. The `sonarqube` MCP server runs as a container
  image, and Docker comes with the sandbox: the `claude` image ships the CLI,
  the engine wires a daemon in at creation, and uid 1000 (the user every
  install step runs as) is in the `docker` group. Nothing to arrange on the
  host.

### Credentials

Two API keys, both **optional** and both supplied as **sandbox secrets**. The
kit declares them under `credentials[]`, so `sbx secret set` is the supported
path and the token itself never enters the sandbox. Set them on the host before
creating the sandbox:

```console
$ sbx secret set context7  --sandbox my-sandbox -t '<key>'
$ sbx secret set sonarqube --sandbox my-sandbox -t '<token>'
```

Drop `--sandbox` to store a secret globally, for every sandbox on the host.

| Sandbox secret | Server | Where to get it | If unbound |
|---|---|---|---|
| `context7` | `context7` | <https://context7.com/dashboard> (free) | Registered with no `Authorization` header. It works, on Context7's shared public rate limit, and can start failing mid-session once that is exhausted |
| `sonarqube` | `sonarqube` | SonarQube Cloud → **My Account → Security** | Registered with no credentials, so every tool call fails with a SonarQube authentication error |

An unbound credential warns on the creation log and the server is registered
anyway, so creation still succeeds. You just get a server that is rate-limited
or unauthenticated. Both entries are `required: false`, so nothing fails for
want of a key.

**`SONARQUBE_ORG` is not a secret.** An organization key is configuration, and
there is nothing for the proxy to inject it into, so it is read from the
creation environment. The `sonarqube` server needs *both* it and the token:

```console
$ SONARQUBE_ORG=<org-key> sbx run claude --kit ./infinum-full/ /path/to/project
```

Find it in the URL of the organization's SonarQube Cloud page.

`productive` needs no credential at creation time. It needs an interactive
OAuth login afterwards, once per user:

```console
$ claude mcp login productive            # add --no-browser in a headless session
```

#### The token never reaches the sandbox

Inside the container, `CONTEXT7_API_KEY` and `SONARQUBE_TOKEN` hold the literal
string `proxy-managed`. The install steps register *that* sentinel, and the
egress proxy substitutes the real value on outbound requests to
`mcp.context7.com` and `sonarcloud.io`. So `claude mcp get context7` showing
`Authorization: Bearer proxy-managed` is correct and working, not a
misconfiguration to repair.

Because of this, the steps decide whether a credential exists from
`SBX_CRED_CONTEXT7_MODE` / `SBX_CRED_SONARQUBE_MODE` (`apikey`, `oauth` or
`none`) rather than from the variable's contents.

#### Host-side binding

`sbx` resolves each secret through the user's own binding in
`~/.config/sbx/credentials.yaml`, which declares the domains the credential may
be sent to. With no binding for a service, sandbox creation prompts for
first-time setup. For secret-store sourcing the binding is an empty discovery
list plus the domains:

```yaml
bindings:
  context7:
    discovery: []
    allowedDomains:
      - mcp.context7.com
  sonarqube:
    discovery: []
    allowedDomains:
      - sonarcloud.io
```

Injection happens only for a domain that appears in **both** the kit's
`credentials[].apiKey.inject[].domain` and the user's `allowedDomains`. A
domain the kit requests and the user declines is skipped, so creation still
succeeds and the request simply goes out unauthenticated.

### Adding a credential later

The clean fix is `sbx secret set` followed by a recreate, so the install steps
run again and register the sentinel header.

In a sandbox you don't want to recreate, re-register the server by hand with a
real key pasted in. A credential supplied that way is *not* proxy-managed, so
the key does sit in `~/.claude.json`. The removal is required because
`claude mcp add` never updates an existing entry's header or env:

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

## Usage

With both secrets already set on the host (see [Credentials](#credentials)):

```console
$ SONARQUBE_ORG=<org-key> sbx run claude --kit ./infinum-full/ /path/to/project
```

or, with no credentials at all:

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
```

Applying the kit more than once is harmless. `claude plugin marketplace add`
and `claude plugin install` exit 0 with "already on disk" / "already
installed", and `claude mcp add` reports "already exists"; every step treats
those as the desired end state. The `jq` merge and the house-rules wiring
converge on re-run, and allow-lists union.

Composing it with other kits is mostly conflict-free: it declares no
`environment.variables`, so there is no last-wins override to trip over. Its
two `credentials[]` entries do carry the usual constraint, though. Another kit
declaring `service: context7` or `service: sonarqube` with a different shape is
a hard error from compose, surfacing at `sbx run` rather than at
`sbx kit validate`.

> [!NOTE]
> `sbx kit add my-sandbox ./infinum-full/` applies the install steps and the
> network policy but **not** `agentInstructions.content`, because the engine
> skips the kit-memory write for `kind: mixin` artifacts. Everything gets
> installed; the agent is just never told, which costs most for the three MCP
> servers: a server that is registered and reachable but unannounced is one the
> agent won't think to call. Use `sbx run --kit` for a sandbox you intend to
> work in.

## What the kit changes

Six install steps, run cheapest-first: the one local write, then the two
clone-and-install steps, then the three MCP registrations. Every step runs as
uid 1000, so everything it writes is owned by `agent` rather than `root`, and
any step's failure fails sandbox creation, which is why the steps needing no
network run before the ones that do. The two Maven Central hosts need no step
at all; they are network policy only.

### Commit and PR attribution off

Step 1 merges `attribution.commit = ""` and `attribution.pr = ""` into
`~/.claude/settings.json` with `jq`, reseeding the file with `{}` first if it is
missing, empty or whitespace-only. Commits and pull requests the agent creates
no longer carry the "🤖 Generated with Claude Code" trailer or the
"Co-Authored-By: Claude" line.

The merge is computed before the file is touched, and written in place, so a
`jq` failure leaves the original intact and the file keeps its own mode and
owner. Every other setting in the file is preserved.

### Maven Central egress

Network policy allows `repo.maven.apache.org` (the canonical host, used by
Maven's `central` and Gradle's `mavenCentral()`) and `repo1.maven.org` (the
legacy hostname, used by sbt, Coursier, Leiningen and older configs).

Those two are the only Maven hosts this kit adds. The Gradle Plugin Portal,
Sonatype snapshot/staging repos, Maven Central *search* and private
repositories are not among them, which is not the same as their being blocked,
since the effective policy also includes host and org rules. Check
`sbx policy ls` rather than assuming either way.

### Infinum plugins

Step 2 registers the `infinum-ai` marketplace (`infinum/ai`, cloned from
`github.com`) and installs four plugins at user scope:

| Plugin | What it does |
|---|---|
| `stack-essentials` | SessionStart update-banner hook. Its check gates on `~/.claude/infinum/.manifest.json`, which this kit never writes, so the banner never fires here |
| `create-prd` | Generate a Product Requirements Document |
| `pr-review-code-simplicity` | Review a PR through the six laws of software design |
| `productive-debug` | Investigate a Productive bug task end-to-end |

Nine other marketplace plugins are deliberately left out; see
[Installing the other plugins](#installing-the-other-plugins).

### Infinum house rules

Step 2 also copies the house rules into `~/.claude/infinum/`, reading them out
of the marketplace clone that `claude plugin marketplace add` has already made
rather than vendoring its own copies. There is nothing to drift and no second
network fetch. That holds at create time only: the kit never runs
`claude plugin marketplace update`, so a long-lived sandbox keeps its rules
pinned to the commit that was current when it was created.

| Source | Destination | Overwrite behaviour |
|---|---|---|
| `rules/<name>.md` (from the marketplace clone) | `~/.claude/infinum/<name>.md` | Overwritten on every run. `README.md` and `whoami.md` are skipped |
| Built-in stub | `~/.claude/infinum/whoami.md` | Created once if missing, then never overwritten again, since it holds the user's own bio |
| Generated | `~/.claude/infinum/index.md` | Regenerated on every run: `@whoami.md` first, then every other rule alphabetically |
| Generated | `~/.claude/CLAUDE.md` | One `@/home/agent/.claude/infinum/index.md  # managed by infinum/ai` line appended only if absent (the literal expanded path the script writes, not a `~` shorthand) |

The glob is flat, so a `rules/<bundle>/` subdirectory is never descended into,
and the copy never prunes: a rule that disappears upstream stays on disk. If
the marketplace registers but its clone has no `rules/*.md`, the step fails
creation rather than silently installing nothing.

### Superpowers skills library

Step 3 registers `anthropics/claude-plugins-official` and installs
`superpowers` from it. The official marketplace only auto-registers on an
interactive first launch ([anthropics/claude-code#66750](https://github.com/anthropics/claude-code/issues/66750)),
so a headless provisioning run needs the explicit `marketplace add`. The plugin
adds skills for brainstorming, writing and executing plans, subagent-driven
development, red/green TDD, systematic debugging and code review, and its
SessionStart hook injects an orientation skill into every session.

It is third-party code (`obra/superpowers`, public) installed unpinned at
whatever version the marketplace currently serves, and nothing here pins or
verifies it. Its `brainstorming` skill can start a local web server whose page
embeds an `<img>` pointing at `primeradiant.com`. That image is fetched by
whatever browser opens the page rather than by anything in the sandbox, and
only when all three of `SUPERPOWERS_DISABLE_TELEMETRY`, `DISABLE_TELEMETRY` and
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` are unset or falsy.

### `context7` MCP server

Step 4 registers `context7` (remote HTTP, `https://mcp.context7.com/mcp`) at
user scope. It resolves library and framework names to current,
version-specific documentation and code examples, which beats guessing from
training data when you need up-to-date API details for a dependency.

The `Authorization: Bearer` header is added only if the `context7` credential
resolved at creation time (`SBX_CRED_CONTEXT7_MODE=apikey`); otherwise the
server is registered anonymously, with a warning on the creation log. The
header carries the `proxy-managed` sentinel, and the proxy swaps in the real key
on requests to `mcp.context7.com`, the only host this server needs.

### `productive` MCP server

Step 5 registers `productive` (remote HTTP, `https://mcp.productive.io/mcp`) at
user scope. It reads and updates Productive projects and tasks, time entries,
CRM deals and contacts, resource bookings, and invoices and expenses.

Registration alone does not connect it. Productive uses per-user OAuth 2.0, so
`claude mcp login productive` is a required one-time step, and a server sitting
at `⏸ Pending approval` is the expected end state until someone runs it. On
the Productive side the account must be on the **Ultimate** plan with AI
features enabled, and each login authorizes exactly one organization
(switching orgs means `claude mcp logout productive` and logging in again).
Allowed hosts: `mcp.productive.io`, and `app.productive.io` for the OAuth
consent page.

### `sonarqube` MCP server

Step 6 registers `sonarqube` at user scope, running SonarSource's official
`sonarsource/sonarqube-mcp` Docker image against **SonarQube Cloud**. It
exposes a project's actual issues, security hotspots, quality gate status,
coverage and duplications. It is Cloud only; it does not talk to a self-hosted
SonarQube Server.

`--env SONARQUBE_TOKEN` and `--env SONARQUBE_ORG` are passed only if the
`sonarqube` credential resolved *and* `SONARQUBE_ORG` was set at creation time;
otherwise the server is registered without them, with a warning. The token's
value is the `proxy-managed` sentinel, so the swap happens on the MCP
container's own outbound calls to `sonarcloud.io`.

The step still opens with a `command -v docker` check that **fails creation**,
but that is now an assertion rather than a prerequisite: a stock `claude`
sandbox always has docker, so the branch is unreachable in practice. It stays
for the case of a customized image that strips the binary, where failing loudly
beats registering a server that can never start. Allowed hosts: Docker Hub
(`registry-1.docker.io`, `auth.docker.io`,
`production.cloudflare.docker.com`) for the image pull, and `sonarcloud.io` for
the server's own API calls.

### Agent instructions

`agentInstructions.content` tells the agent what it has: attribution off, which
Maven hosts are allowed and which are not, which plugins are installed and
which were skipped, where the house rules live, that `whoami.md` may still be
an unedited stub whose placeholder example is not fact, what each MCP server is
for, and which of them may be unauthenticated or awaiting login. It also tells
the agent that a `proxy-managed` value is a working credential rather than a
broken one, so it doesn't try to "repair" a sentinel header. This is the part
`sbx kit add` skips; see the note under [Usage](#usage).

## Verify

```console
$ sbx exec my-sandbox -- jq '.attribution, .enabledPlugins, .extraKnownMarketplaces' \
    /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- cat /home/agent/.claude/infinum/index.md
$ sbx exec my-sandbox -- claude plugin list
$ sbx exec my-sandbox -- claude mcp list
```

Expect `attribution.commit` and `attribution.pr` as `""`; five enabled plugins;
both marketplaces registered; `settings.json` owned by `agent` and never `root`
(`root` means the `user: "1000"` setting on an install step regressed);
`index.md` importing `whoami.md` plus at least `ai-assisted-prs.md`; and three
entries from `claude mcp list`.

`productive` sitting unconnected is expected until someone logs in. `context7`
or `sonarqube` failing is expected when their credentials were unbound at
creation, and the creation log carries the warning that says so. A registered
credential shows up as the `proxy-managed` sentinel, which is what a working
one looks like:

```console
$ sbx exec my-sandbox -- claude mcp get context7      # header: Bearer proxy-managed
$ sbx exec my-sandbox -- env | grep SBX_CRED          # ..._MODE=apikey per bound service
```

## Extending the kit

### Installing the other plugins

Nine `infinum-ai` plugins are left out: six need local tooling or egress this
sandbox does not have, and three are design-side and out of scope for a backend
sandbox rather than blocked by any sandbox limitation. The reasons come from
upstream [MARKETPLACE.md](https://github.com/infinum/ai/blob/main/MARKETPLACE.md)'s
Cowork column, which documents the same class of constraint.

| Plugin | Why it's excluded |
|---|---|
| `ui-validation` | Local tooling: runs the project's snapshot tests in the user's local dev environment |
| `download-figma-screenshot` | Blocked egress: hits `localhost:3845` and `api.figma.com`, both unreachable from the sandbox |
| `mobile-deploy` | Local tooling: requires the local `app-deploy` CLI and runs git against the project working tree |
| `claude-setup-audit` | Local tooling: reads `~/.claude/` outside the workspace mount |
| `security-check` | Local tooling and blocked egress: needs local package managers, `gh`, and registry/advisory egress |
| `progress` | Local tooling: needs a persistent local filesystem (`~/.claude/progress/`) plus, for cleanup, the local `gh` CLI and git checkout |
| `ai-ready-figma` | Design-side scope, and needs the Figma remote MCP connector enabled |
| `design-conventions` | Design-side scope: pure guidance, not applicable to a backend sandbox |
| `purpose-driven-design` | Design-side scope: not applicable to a backend sandbox |

Any of them is one command away inside the sandbox:
`claude plugin install <name>@infinum-ai`, or browse interactively with
`/plugin`.

### Editing the kit

Everything lives in [`spec.yaml`](spec.yaml). Each install step's body is
inline in `setup.install` as its own entry, with its own `user`, its own
numbered `description` (`1/6` … `6/6`, which is what the creation progress
output shows) and its own shell body. Those bodies are the single source of
truth for what the kit does.

Adding a host means adding it to `permissions.network.allow`. That block is
declarative, so nothing in it can be made conditional on a credential that
turned out to be missing. Failure messages spell out the fix inline, because
the creation log is often the only thing the user sees; keep that property when
adding a step. Dropping a step (for instance step 6, on an image with no
`docker`, or if you have no SonarQube Cloud organization) means editing a local
copy of the spec.

Adding a credential means a `credentials[]` entry plus its
`apiKey.inject[].domain` in `permissions.network.allow`. The spec library
rejects the kit if the domain isn't allow-listed, since credentials derive no
egress of their own. Keep `required: false` unless the sandbox genuinely cannot
work without the key, and branch the install step on
`SBX_CRED_<SERVICE>_MODE` rather than on the variable's value, which is only
ever the sentinel.

### Verification status

The [kit-authoring testing guidance](https://docs.docker.com/ai/sandboxes/customize/kits/)
defines four layers, and **none of them has been run against this kit**:

1. **`sbx kit validate`.** No `sbx` on `PATH` in the authoring environment.
2. **The TCK.** Its `container/install_execution` subtest asserts real exit
   codes, so it needs a container where `claude` is on `PATH`, `github.com` is
   reachable and a Docker daemon is available. Only the last of those is
   something a `claude` sandbox already provides.
3. **End-to-end under a `deny-all` host policy.** Needs `sbx` and `/dev/kvm`.
   This is the gap that matters most: it is the only layer that proves the
   ten-host allow-list is *complete*. Every row under `Blocked requests` in
   `sbx policy log` is a host this kit reached for and didn't declare.
4. **A manual probe in a live sandbox.** The commands under
   [Verify](#verify).

What it has had instead: the spec parses as YAML, every `apiKey.inject[].domain`
is present in `permissions.network.allow`, all six extracted install commands
pass `sh -n`, and the two credential-bearing steps were run against stubbed
`claude` and `docker` on a hermetic `PATH` across every branch: credential
bound, unbound, and (for `sonarqube`) token bound with `SONARQUBE_ORG` missing.
Docker's presence was confirmed in a live `claude` sandbox (`/usr/bin/docker`,
daemon reachable on `/var/run/docker.sock`, `agent` in the `docker` group)
rather than assumed from the spec.
An earlier harness covering all six steps' exit paths and the `settings.json`
and `CLAUDE.md` idempotency cases lived in a session scratchpad and is not in
this repository, so that part is a claim about the past rather than a check
anyone can re-run.

That says the steps are correct shell that fails where it means to. It says
nothing about what only the four layers can tell you: that `sbx` accepts the
spec, that ten hosts are enough, that the servers connect, or that Claude is
told about them.

One assumption in particular is worth singling out, because nothing here tests
it: the `sonarqube` registration relies on the sentinel swap reaching a
**nested** container's egress. The MCP server runs as `docker run` inside the
sandbox, and its calls to `sonarcloud.io` have to pass through the same proxy
for `proxy-managed` to be substituted. `context7` has no such indirection,
since the agent process itself makes those calls. If SonarQube tool calls fail
with an authentication error while `SBX_CRED_SONARQUBE_MODE=apikey`, that
assumption is where to look first, and re-registering by hand with a real token
(see [Adding a credential later](#adding-a-credential-later)) is the
workaround.

## References

- [Kit spec](spec.yaml)
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
