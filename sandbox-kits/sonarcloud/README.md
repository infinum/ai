# sonarcloud

Registers SonarSource's [SonarQube MCP
Server](https://github.com/SonarSource/sonarqube-mcp-server) with Claude Code
inside a Docker Sandbox, so the agent can query real code quality issues,
security hotspots, quality gates, coverage, and duplications for a project
instead of guessing from a stale local scan.

This is a mixin that requires the `claude` agent (it drives `claude mcp add`).
It contributes four entries on `permissions.network.allow`, one optional
`credentials[]` entry for the SonarQube Cloud token, and one `setup.install`
step that registers the server at **user scope**, so it's available in every
project inside the sandbox, not just the one it was first added from.

It is also how you add SonarQube to a sandbox built with
[`infinum-full`](../infinum-full/), which deliberately leaves it out:
`SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org> sbx kit add my-sandbox ./sonarcloud/`.

## Requires

- Base agent `claude`
- A Docker daemon reachable from the agent user — the MCP server only runs
  as a container image
- A SonarQube Cloud token (sandbox secret or `SONARQUBE_TOKEN`) and
  `SONARQUBE_ORG`

The install step **fails sandbox creation** if any of these is missing —
see [Fails fast by design](#fails-fast-by-design).

## Usage

```console
$ SONARQUBE_TOKEN=... SONARQUBE_ORG=... sbx run claude --kit ./sonarcloud/ /path/to/project
```

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#usage).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./sonarcloud/
```

> [!NOTE]
> `sbx kit add` runs the install step but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. The server is registered and reachable; Claude just
> won't have been told it exists, so it won't reach for it. Use
> `sbx run --kit` for a sandbox you intend to work in. See
> [Usage](../README.md#usage).

## Credentials

A [SonarQube Cloud
token](https://docs.sonarsource.com/sonarqube-cloud/managing-your-account/managing-tokens/)
and `SONARQUBE_ORG` (your [organization
key](https://sonarcloud.io/account/organizations)) are both required, and the
install step **fails sandbox creation** when either is unavailable. Neither is
hardcoded in the spec.

They are different kinds of thing, and they arrive differently.

**The token** is a credential, declared under `credentials[]`, so it has two
supported sources:

```console
$ sbx secret set sonarqube --sandbox my-sandbox -t '<token>'    # sandbox secret
$ SONARQUBE_TOKEN=<token> … sbx run claude --kit ./sonarcloud/ …  # creation environment
```

The secret-store route is the better one: with a binding resolved, the token
**never enters the sandbox**. The engine sets `SONARQUBE_TOKEN` to the literal
sentinel `proxy-managed`, the install step registers *that*, and the egress
proxy substitutes the real token on outbound requests to `sonarcloud.io`. So
`claude mcp get sonarqube` showing `SONARQUBE_TOKEN=proxy-managed` is correct
and working, not a misconfiguration to repair.

Which route was taken is what `SBX_CRED_SONARQUBE_MODE` (`apikey`, `oauth` or
`none`) tells the step — never the variable's contents, which are the sentinel
in one case and the real token in the other. The credential is
`required: false` so that the environment route keeps working; `true` would
demand a host-side binding and fail creation for anyone using it.

**`SONARQUBE_ORG` is not a credential.** An organization key is configuration,
and there is nothing for the proxy to inject it into, so it is always read from
the creation environment:

```console
$ SONARQUBE_ORG=<org-key> sbx run claude --kit ./sonarcloud/ /path/to/project
```

#### Host-side binding

`sbx` resolves the secret through the user's own binding in
`~/.config/sbx/credentials.yaml`, which declares the domains the credential may
be sent to. With no binding, sandbox creation prompts for first-time setup. For
secret-store sourcing it is an empty discovery list plus the domain:

```yaml
bindings:
  sonarqube:
    discovery: []
    allowedDomains:
      - sonarcloud.io
```

Injection happens only for a domain in **both** the kit's
`credentials[].apiKey.inject[].domain` and the user's `allowedDomains`. A
declined domain does not fail creation — the request just goes out carrying the
literal `proxy-managed` string, which SonarQube rejects.

`claude mcp add` writes the env vars at registration time; it doesn't update
an already-registered entry. Rotating the token later needs a manual
re-add:

```console
$ claude mcp remove sonarqube -s user
$ claude mcp add sonarqube -s user \
    --env SONARQUBE_TOKEN=$SONARQUBE_TOKEN \
    --env SONARQUBE_ORG=$SONARQUBE_ORG \
    -- docker run --init --pull=always -i --rm \
       -e SONARQUBE_TOKEN -e SONARQUBE_ORG sonarsource/sonarqube-mcp
```

## Transport: Docker, against SonarQube Cloud only

SonarQube MCP Server ships two ways to run without a client-side plugin:

- **Docker** — SonarSource's primary, recommended path. Pulls
  `sonarsource/sonarqube-mcp` from Docker Hub and runs it as a stdio
  subprocess. This is what SonarSource's own Claude Code docs show, and what
  this kit uses.
- **Standalone JAR** — download a pinned
  `sonarqube-mcp-server-<version>.jar` from
  `binaries.sonarsource.com` and run it with `java -jar` (Java 21+). Avoids
  Docker-in-sandbox, at the cost of the kit having to also guarantee a JDK.

This kit registers the server with:

```console
$ claude mcp add sonarqube -s user \
    --env SONARQUBE_TOKEN=$SONARQUBE_TOKEN \
    --env SONARQUBE_ORG=$SONARQUBE_ORG \
    -- docker run --init --pull=always -i --rm \
       -e SONARQUBE_TOKEN -e SONARQUBE_ORG sonarsource/sonarqube-mcp
```

`permissions.network.allow` carries the three Docker Hub hosts a `docker
pull` needs (`registry-1.docker.io`, `auth.docker.io`,
`production.cloudflare.docker.com` — the same trio the `trivy` kit in
`sbx-kits-contrib` documents for pulling images) plus `sonarcloud.io` for the
server's own outbound calls to the SonarQube Cloud API.

If your sandbox has no Docker daemon reachable from the agent user, the
install step detects that (`command -v docker`) and **fails sandbox
creation** — the server only runs as a container image, so there is nothing
useful it could do instead. Drop the kit for that sandbox, or fork it for the
JAR alternative — roughly:

```yaml
permissions:
  network:
    allow:
      - binaries.sonarsource.com
      - sonarcloud.io

setup:
  install:
    - user: "1000"
      description: Install a JDK and the sonarqube-mcp-server JAR, then register it.
      command: |
        # ensure `java` (21+) is on PATH, then:
        curl -fsSL -o /home/agent/.local/share/sonarqube-mcp-server.jar \
          "https://binaries.sonarsource.com/Distribution/sonarqube-mcp-server/sonarqube-mcp-server-<version>.jar"
        claude mcp add sonarqube -s user \
          --env STORAGE_PATH=/home/agent/.local/share/sonarqube-mcp \
          --env SONARQUBE_TOKEN="$SONARQUBE_TOKEN" \
          --env SONARQUBE_ORG="$SONARQUBE_ORG" \
          -- java -jar /home/agent/.local/share/sonarqube-mcp-server.jar
```

Pin `<version>` to a specific release for reproducibility — `latest` isn't a
valid path segment on `binaries.sonarsource.com`.

## Cloud only — no SonarQube Server support

SonarQube Cloud's API host (`sonarcloud.io`) is fixed, so it can be baked
into `permissions.network.allow` ahead of time. A self-hosted SonarQube
Server lives at a URL only the user knows, which this kit can't pre-declare.
This kit deliberately only supports Cloud.

To point at a self-hosted Server instead, fork this kit: drop `SONARQUBE_ORG`
for `SONARQUBE_URL` in both the `--env` flags and the `docker run -e` list,
and add your server's host to `permissions.network.allow` (the
[upstream README](https://github.com/SonarSource/sonarqube-mcp-server#configuration)
covers the env-var differences — a Server token must be of type **USER**).

## Fails fast by design

The install step runs under `set -eu` and **fails sandbox creation** in three
cases, each with an actionable message on stderr:

- No `docker` on `PATH` — the server only runs as a container image.
- No token from either source, or `SONARQUBE_ORG` missing from the environment.
- `claude mcp add` itself failing.

Each of those used to warn and skip, which produced a healthy-looking sandbox
with no SonarQube in it — a state you only discovered later, from
`claude mcp list` or a tool call that wasn't there. Failing at creation puts
the reason in front of whoever is creating the sandbox.

Re-running the step is still safe: once the server is registered,
`claude mcp add` exits 1 with "already exists", which the script treats as
nothing left to do rather than an error. That is the one non-zero exit it
tolerates — it means the desired end state already holds. The
[Credentials](#credentials) section has the command to retry by hand.

What creation *cannot* catch is a token that is present but revoked, wrongly
scoped, or paired with a mismatched organization key — the kit registers the
server without calling the API, so those surface on the first tool call.

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get sonarqube
```

- `Status: ✔ Connected` (or a tool call that actually returns issues/quality
  gate data for a real project) — wired up correctly
- A `403` whose body starts with `Blocked by network policy` — one of the
  four allowed hosts isn't in effect; check `sbx policy ls` and
  `sbx policy log`
- An auth error with the server present — points at the token or the
  organization key, which creation does not validate

The server cannot be *missing*: every registration failure now fails
creation, so a sandbox that came up has it — and a creation that failed
says why, on stderr, prefixed `sonarcloud kit: ERROR`.

## Verification status

The spec parses as YAML, its `apiKey.inject[].domain` (`sonarcloud.io`) is
present in `permissions.network.allow`, and the install command passes
`sh -n`. It has not been run through `sbx kit validate`, a TCK run, or an
end-to-end run under a `deny-all` host policy — the only thing that proves
the four-host allow-list is complete.

One assumption is worth flagging, because nothing here tests it: the
secret-store route relies on the sentinel swap reaching a **nested**
container's egress. The MCP server runs as `docker run` inside the sandbox, so
its calls to `sonarcloud.io` have to pass through the same proxy for
`proxy-managed` to be substituted — unlike a remote HTTP server, where the
agent process itself makes the calls. If every tool call fails with a SonarQube
authentication error while `SBX_CRED_SONARQUBE_MODE=apikey`, that is where to
look first, and passing a real token in the creation environment (or
re-registering by hand, see [Credentials](#credentials)) is the workaround.

## References

- [Kit spec](spec.yaml)
- SonarQube MCP Server: <https://github.com/SonarSource/sonarqube-mcp-server>
- Docker image: <https://hub.docker.com/r/sonarsource/sonarqube-mcp>
- Configuration reference (env vars, toolsets): <https://github.com/SonarSource/sonarqube-mcp-server#configuration>
