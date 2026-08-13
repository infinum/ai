# sonarcloud

Registers SonarSource's [SonarQube MCP
Server](https://github.com/SonarSource/sonarqube-mcp-server) with Claude Code
inside a Docker Sandbox, so the agent can query real code quality issues,
security hotspots, quality gates, coverage, and duplications for a project
instead of guessing from a stale local scan.

This is a mixin that requires the `claude` agent (it drives `claude mcp add`).
It contributes four entries on `permissions.network.allow` and one
`setup.install` step that registers the server at **user scope**, so it's
available in every project inside the sandbox, not just the one it was first
added from.

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
install step detects that (`command -v docker`), skips registration, and
warns instead of failing the sandbox. Fork this kit for the JAR alternative
in that case — roughly:

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

## Credentials

`SONARQUBE_TOKEN` (a [SonarQube Cloud
token](https://docs.sonarsource.com/sonarqube-cloud/managing-your-account/managing-tokens/))
and `SONARQUBE_ORG` (your [organization
key](https://sonarcloud.io/account/organizations)) must be set in the sandbox
environment before this kit's install step runs. Neither is hardcoded in the
spec — the install script only ever reads them from the environment.

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

## Schema version

Written as `schemaVersion: "2"`: egress lives under `permissions.network.allow`
and the sandbox note lives under `agentInstructions.content`.

## Usage

```console
$ SONARQUBE_TOKEN=... SONARQUBE_ORG=... sbx run claude --kit ./sonarcloud/ /path/to/project
```

Combine with the other kits in this directory:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./sonarcloud/ \
    --kit ./superpowers/ \
    /path/to/project
```

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./sonarcloud/
```

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get sonarqube
```

`Status: ✔ Connected` (or a tool call that actually returns issues/quality
gate data for a real project) means it's wired up. A `403` whose body starts
with `Blocked by network policy` means one of the four allowed hosts isn't in
effect — check `sbx policy ls` and `sbx policy log`. A missing entry in
`claude mcp list` usually means `SONARQUBE_TOKEN`/`SONARQUBE_ORG` weren't set,
or `docker` wasn't on PATH, when the install step ran — check the sandbox's
creation logs for `sonarcloud kit: WARN`.

## References

- [Kit spec](spec.yaml)
- SonarQube MCP Server: <https://github.com/SonarSource/sonarqube-mcp-server>
- Docker image: <https://hub.docker.com/r/sonarsource/sonarqube-mcp>
- Configuration reference (env vars, toolsets): <https://github.com/SonarSource/sonarqube-mcp-server#configuration>
