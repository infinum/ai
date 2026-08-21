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
- The `context7` MCP server registered at user scope, so it is available in
  every project in the sandbox — authenticated by an optional sandbox secret,
  or against Context7's OAuth endpoint when no key is bound, which one
  `claude mcp login` finishes from inside the sandbox.
- Agent instructions describing all of the above, so the agent knows what it
  has.

SonarQube is **not** here — it is the standalone [`sonarcloud`](../sonarcloud/)
kit, which needs Docker and a SonarQube Cloud token, and taking it out leaves
this kit with no container dependency at all. Jira/Confluence, Productive and
GitHub are deliberately not registered either; see
[Atlassian, Productive and GitHub: use the connectors](#atlassian-productive-and-github-use-the-connectors).

Everything the kit does is documented on this page, and the spec depends on
nothing outside this directory.

## Prerequisites

- **Base agent `claude`.** The kit is a mixin with `requires.agent: claude`,
  and that is the whole prerequisite list. Nothing here needs Docker, a JDK, or
  anything else arranged on the host: the four install steps write files, clone
  two public marketplaces and register one remote HTTP MCP server.

### Credentials

One API key, **optional**, supplied as a **sandbox secret**. The kit declares
it under `credentials[]`, so `sbx secret set` is the supported path and the key
itself never enters the sandbox. Set it on the host before creating the
sandbox:

```console
$ sbx secret set context7 --sandbox my-sandbox -t '<key>'
```

Drop `--sandbox` to store it globally, for every sandbox on the host. Get a
free key at <https://context7.com/dashboard>.

It is optional because Context7 has a second way in. The key decides **which
endpoint step 4 registers**, not whether it registers anything:

| At creation | Registered as | What you do next |
|---|---|---|
| Key bound (`SBX_CRED_CONTEXT7_MODE=apikey`) | `https://mcp.context7.com/mcp` + `Authorization: Bearer proxy-managed` | Nothing. It works immediately, and the key never enters the sandbox |
| No key | `https://mcp.context7.com/mcp/oauth`, no header | One `claude mcp login context7` — see [Finishing the OAuth login](#finishing-the-oauth-login) |

Neither outcome is a broken or degraded server, and neither needs the sandbox
recreated. What the kit deliberately does **not** do is register Context7's
anonymous endpoint: that works on a shared public rate limit and starts failing
mid-task once it is exhausted, and because `claude mcp add` cannot amend an
existing entry, fixing it would mean removing the registration first anyway.

This kit asks for no `github` or `sonarqube` secret. It registers no GitHub or
SonarQube MCP server, so it requests no injection domain for either, and the
sandbox's own GitHub credential for git over HTTPS is untouched — `git push`
and `gh` keep working exactly as they do without this kit.

The entry is `required: false`, so an unbound key prints a note on the creation
log and creation carries on; nothing fails for want of it.

#### The key never reaches the sandbox

Inside the container, `CONTEXT7_API_KEY` holds the literal string
`proxy-managed`. Step 4 registers *that* sentinel, and the egress proxy
substitutes the real key on outbound requests to `mcp.context7.com`. So
`claude mcp get context7` showing `Authorization: Bearer proxy-managed` is
correct and working, not a misconfiguration to repair.

Because of this, the step decides whether a key exists from
`SBX_CRED_CONTEXT7_MODE` (`apikey`, `oauth` or `none`) rather than from the
variable's contents.

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
```

`context7` does not overlap with the `github` binding a sandbox typically
already has for git over HTTPS, so applying this kit prompts for no domain
expansion on it.

Injection happens only for a domain that appears in **both** the kit's
`credentials[].apiKey.inject[].domain` and the user's `allowedDomains`. A
domain the kit requests and the user declines is skipped, so creation still
succeeds — but the request then goes out carrying the literal `proxy-managed`
string, which Context7 rejects. If `SBX_CRED_CONTEXT7_MODE=apikey` and every
call fails authentication, check the binding before anything else.

### Finishing the OAuth login

When no key was bound, `context7` is registered against
`https://mcp.context7.com/mcp/oauth` and needs one interactive login. It is a
person's job, not the agent's — it signs into a Context7 account — but it
happens **inside the running sandbox**, with no recreate and no key pasted into
a command:

```console
$ sbx exec my-sandbox -- claude mcp login context7
```

With no browser reachable from that session, use the headless flow, the same
one. It prints a URL to open on any machine and takes the resulting redirect
URL pasted back, which is what makes the flow work from a sandbox at all:
Claude Code's loopback redirect is `http://localhost:3118/callback` *inside*
the container, and your browser is not:

```console
$ sbx exec my-sandbox -- claude mcp login context7 --no-browser
```

The OAuth token lives in the sandbox and does not survive a recreate, so a new
sandbox means logging in again. If that gets tedious, bind a key instead — with
`sbx secret set context7` the next sandbox comes up already authenticated and
needs no login at all.

`claude mcp logout context7` clears it.

### Switching to a key later

To move an already-registered `context7` from OAuth to a key without recreating
the sandbox, re-register it by hand. The removal is required because
`claude mcp add` never amends an existing entry — which is also why a re-run of
the kit reports "already exists" and leaves the endpoint as it found it:

```console
$ claude mcp remove context7 -s user
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user \
    --header "Authorization: Bearer <key>"
```

A key supplied that way is a real one, so it is *not* proxy-managed and does
sit in `~/.claude.json`. To get the sentinel back instead, `sbx secret set` the
key and create the next sandbox with it. Rotating a key on an
already-registered server takes the same remove-then-add pair.

### Adding SonarQube

It is a separate kit, and it goes into the same running sandbox:

```console
$ SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org-key> sbx kit add my-sandbox ./sonarcloud/
```

That kit brings its own four hosts (Docker Hub plus `sonarcloud.io`) and its
own `credentials[]` entry, so `sbx secret set sonarqube` works there too. See
[`sonarcloud/README.md`](../sonarcloud/README.md).

## Usage

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
```

That is the whole command in both cases. With the `context7` secret set on the
host (see [Credentials](#credentials)) the sandbox comes up ready to use;
without it, `context7` is registered against the OAuth endpoint and the
creation log says to run one
[`claude mcp login`](#finishing-the-oauth-login).

Applying the kit more than once is harmless. `claude plugin marketplace add`
and `claude plugin install` exit 0 with "already on disk" / "already
installed", and `claude mcp add` reports "already exists"; every step treats
those as the desired end state. The `jq` merge and the house-rules wiring
converge on re-run, and allow-lists union.

Composing it with other kits is mostly conflict-free: it declares no
`environment.variables`, so there is no last-wins override to trip over. Its
one `credentials[]` entry does carry the usual constraint — another kit
declaring `service: context7` with a different shape is a hard error from
compose, surfacing at `sbx run` rather than at `sbx kit validate` — but that is
now the only collision surface. Dropping the `github` and `sonarqube`
credentials took away the two likeliest ones, `sonarqube` most of all, since
composing this kit with [`sonarcloud`](../sonarcloud/) is exactly what someone
wanting both would do.

> [!NOTE]
> `sbx kit add my-sandbox ./infinum-full/` applies the install steps and the
> network policy but **not** `agentInstructions.content`, because the engine
> skips the kit-memory write for `kind: mixin` artifacts. Everything gets
> installed; the agent is just never told, which costs most for `context7`: a
> server that is registered and reachable but unannounced is one the agent
> won't think to call, and it also won't know a pending OAuth login is what an
> auth error means. Use `sbx run --kit` for a sandbox you intend to work in.

## What the kit changes

Four install steps, run cheapest-first: the one local write, then the two
clone-and-install steps, then the one remote MCP registration. Every step runs
as uid 1000, so everything it writes is owned by `agent` rather than `root`,
and any step's failure fails sandbox creation, which is why the steps needing
no network run before the ones that do. Every step is mandatory; the only thing
a missing credential changes is which Context7 endpoint step 4 registers. The
two Maven Central hosts need no step at all; they are network policy only.

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
| `productive-debug` | Investigate a Productive bug task end-to-end. Reads the task over MCP, so it needs the Productive Claude connector enabled on the account; this kit registers no Productive server |

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

Step 4 registers `context7` (remote HTTP) at user scope. It resolves library
and framework names to current, version-specific documentation and code
examples, which beats guessing from training data when you need up-to-date API
details for a dependency.

The step always registers something; what the credential decides is the
endpoint:

- **Key bound** (`SBX_CRED_CONTEXT7_MODE=apikey`) → `https://mcp.context7.com/mcp`
  with an `Authorization: Bearer` header carrying the `proxy-managed` sentinel.
  The proxy swaps in the real key on requests to `mcp.context7.com`.
- **No key** → `https://mcp.context7.com/mcp/oauth`, Context7's OAuth 2.0
  endpoint, with no header. Claude Code drives that flow with
  `claude mcp login`; see [Finishing the OAuth login](#finishing-the-oauth-login).

Registering the anonymous endpoint was the third option and is deliberately not
taken: it works on a shared public rate limit and starts failing mid-task once
that is exhausted, and since `claude mcp add` cannot amend an existing entry,
fixing it later means deleting the registration first. A pending login is a
better state to hand someone than a server that quietly degrades.

Two hosts: `mcp.context7.com` for the server itself (both paths), and
`context7.com` for the OAuth authorize/consent page. That second one is
reasoned from how the flow works rather than observed — see
[Verification status](#verification-status).

### Atlassian, Productive and GitHub: use the connectors

The kit registers **no** MCP server for Jira/Confluence, Productive or GitHub.
All three are supported as built-in Claude connectors, and using the connector
is the recommended route:

- It is enabled once on the user's Claude account and follows them into every
  sandbox, instead of being registered per sandbox and re-authorized after
  every recreate.
- It carries its own OAuth, so there is no sandbox secret to set, no injection
  domain to approve and no `claude mcp login` to run inside the sandbox.
- Nothing about it can fail at creation time, and it needs no entry in this
  kit's network allow-list.

So there is nothing to install for them. Enable the connector on the Claude
side, and the tools show up in the sandbox. The kit's `agentInstructions` tell
the agent this, so an absent Jira or Productive tool reads as "the connector
isn't enabled" rather than "the sandbox is broken", and the agent asks instead
of registering a replacement server.

For GitHub there is a second, independent path that this kit leaves exactly as
it was: the sandbox proxy injects GitHub credentials into git HTTPS operations,
so `git clone`, `git push`, `gh pr create` and the rest of `gh` work here with
no connector and no MCP server at all. That is usually the shortest route to
repository, issue and PR work from inside the sandbox.

### Agent instructions

`agentInstructions.content` tells the agent what it has: attribution off, which
Maven hosts are allowed and which are not, which plugins are installed and
which were skipped, where the house rules live, that `whoami.md` may still be
an unedited stub whose placeholder example is not fact, and what `context7` is
for.

The part that matters most is how it frames `context7`'s two modes, since
`claude mcp get context7` is the only thing that distinguishes them. A
`proxy-managed` header is a **working** credential, so the agent doesn't try to
"repair" a sentinel or go hunting for a key that isn't in the sandbox; the
`/mcp/oauth` endpoint means a **human** must run `claude mcp login context7`,
so an auth error there reads as a pending login to report rather than something
to route around by re-registering the server. It also says SonarQube belongs to
a different kit, that Jira/Confluence, Productive and GitHub come from Claude
connectors rather than from this kit, and that `git` and `gh` work regardless
of any of that. This is the part `sbx kit add` skips; see the note under
[Usage](#usage).

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
(`root` means the `user: "1000"` setting on an install step regressed); and
`index.md` importing `whoami.md` plus at least `ai-assisted-prs.md`.

From `claude mcp list`, expect exactly one entry: `context7`. It cannot be
missing — a failed `claude mcp add` fails creation — and nothing appears for
SonarQube, Jira, Productive or GitHub, which is the intended end state rather
than a missing step. Which mode it landed in shows in its URL:

```console
$ sbx exec my-sandbox -- claude mcp get context7      # .../mcp + Bearer proxy-managed, or .../mcp/oauth
$ sbx exec my-sandbox -- env | grep SBX_CRED          # SBX_CRED_CONTEXT7_MODE=apikey when a key is bound
```

`Bearer proxy-managed` is a working credential, not a broken one. A
`.../mcp/oauth` URL with `⏸`-style pending or auth-error status is also
correct — it means [the login](#finishing-the-oauth-login) hasn't been run yet.

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
numbered `description` (`1/5` … `5/5`, which is what the creation progress
output shows) and its own shell body. Those bodies are the single source of
truth for what the kit does.

Adding a host means adding it to `permissions.network.allow`. That block is
declarative, so nothing in it can be made conditional on a credential that
turned out to be missing — which is what lets step 4 pick either Context7
endpoint without a policy change. Failure messages spell out the fix inline,
because the creation log is often the only thing the user sees; keep that
property when adding a step. Dropping a step means editing a local copy of the
spec.

Adding a credential means a `credentials[]` entry plus its
`apiKey.inject[].domain` in `permissions.network.allow`. The spec library
rejects the kit if the domain isn't allow-listed, since credentials derive no
egress of their own. Keep `required: false` unless the sandbox genuinely cannot
work without the key, and branch the install step on
`SBX_CRED_<SERVICE>_MODE` rather than on the variable's value, which is only
ever the sentinel.

For an MCP server, that branch should never end in an unauthenticated
registration. `claude mcp add` cannot amend an existing entry, so one made
without a credential has to be removed before it can be fixed — it is an
obstacle, not a head start, and until then it sits in `claude mcp list` looking
available. Register a second, OAuth-capable endpoint if the service has one, as
step 4 does; otherwise register nothing and print the command that adds it
later.

### Verification status

The [kit-authoring testing guidance](https://docs.docker.com/ai/sandboxes/customize/kits/)
defines four layers, and **none of them has been run against this kit**:

1. **`sbx kit validate`.** No `sbx` on `PATH` in the authoring environment.
2. **The TCK.** Its `container/install_execution` subtest asserts real exit
   codes, so it needs a container where `claude` is on `PATH` and `github.com`
   is reachable.
3. **End-to-end under a `deny-all` host policy.** Needs `sbx` and `/dev/kvm`.
   This is the gap that matters most: it is the only layer that proves the
   five-host allow-list is *complete*. Every row under `Blocked requests` in
   `sbx policy log` is a host this kit reached for and didn't declare.
4. **A manual probe in a live sandbox.** The commands under
   [Verify](#verify).

What it has had instead: the spec parses as YAML, `mcp.context7.com` (the one
`apiKey.inject[].domain`) is present in `permissions.network.allow`, and all
four extracted install commands pass `sh -n`. Step 4 was run against a stubbed
`claude` on a hermetic `PATH` across every branch — 12 assertions, all passing
— checking the exit code and the argv the stub received:

| Branch | Expected |
|---|---|
| Key bound (`SBX_CRED_CONTEXT7_MODE=apikey`) | registers `…/mcp` **with** the `proxy-managed` header, exit 0 |
| Unbound | registers `…/mcp/oauth`, **no** `--header`, exit 0, note names `claude mcp login` twice (browser and `--no-browser`) |
| `SBX_CRED_CONTEXT7_MODE=oauth` | same as unbound |
| Stub reports "already exists" | exit 0, message names the URL this run wanted |
| Stub fails any other way | exit 1 |

The `sonarcloud` kit's step was exercised the same way in the same session —
9 more assertions covering its sentinel / plain-token / no-token / no-org /
no-docker branches; see [its README](../sonarcloud/README.md#verification-status).

Earlier harnesses covering the `github`, `atlassian`, `productive` and
`sonarqube` steps went away with those steps. Removing a registration deletes
the code path rather than changing it, so the remaining steps are untouched by
the removals — but that also means the `settings.json` and `CLAUDE.md`
idempotency cases, which lived in a session scratchpad, are a claim about the
past rather than a check anyone can re-run.

That says the steps are correct shell that fails where it means to, and that
step 4 picks the endpoint the credential mode calls for. It says nothing about
what only the four layers can tell you: that `sbx` accepts the spec, that five
hosts are enough, that the server connects, or that Claude is told about it.

Three things about the OAuth path are reasoned rather than observed, and all
three would be settled by one `claude mcp login context7 --no-browser` in a
live sandbox:

- **The endpoint.** `https://mcp.context7.com/mcp/oauth` comes from Context7's
  documentation, not from a request this repository has made. The authoring
  sandbox's own policy blocks `mcp.context7.com`, so even the server's
  `.well-known` metadata could not be read to confirm it.
- **The consent host.** `context7.com` is allow-listed on the assumption that
  it carries the `/authorize` page. If Context7's authorization-server
  metadata puts `/authorize`, `/register` or `/token` somewhere else, that host
  needs allow-listing too and `sbx policy log` will name it.
- **Dynamic client registration.** Claude Code requires DCR (RFC 7591) as the
  first step of an MCP OAuth flow. Context7 publishes OAuth support for
  MCP clients, so this should hold, but nothing here proves it.

If any of them turns out wrong, the fallback needs no kit change: bind a key
with `sbx secret set context7`, or re-register by hand with
[a key](#switching-to-a-key-later).

## References

- [Kit spec](spec.yaml)
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
