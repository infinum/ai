# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits for a `claude`
sandbox:

- Infinum house rules and plugins
- A skills library
- Maven Central egress
- No Claude attribution
- The MCP servers we use

A kit is a `spec.yaml` the `sbx` engine turns into install commands, files,
and network policy at sandbox creation. Both kits here are `kind: mixin`,
requiring `claude`.

## Kits

### [`infinum-full`](./infinum-full/)

- Claude attribution off
- Maven Central egress
- `infinum-ai` plugins + house rules
- `superpowers`
- `context7` MCP (OAuth)

No credential.

### [`sonarcloud`](./sonarcloud/)

`sonarqube` MCP server against SonarQube Cloud:

- Issues
- Security hotspots
- Quality gates
- Coverage

Needs Docker, a SonarQube Cloud token, `SONARQUBE_ORG`.

```console
$ SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org-key> sbx kit add my-sandbox ./sonarcloud/
```

Jira/Confluence, Productive and GitHub aren't kits here — use the Claude
connectors, enabled once on the account rather than per sandbox. GitHub also
works independently of any connector: the sandbox's own proxy already
injects GitHub credentials into git HTTPS operations.

## Usage

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
$ SONARQUBE_TOKEN=<token> SONARQUBE_ORG=<org-key> sbx run claude \
    --kit ./infinum-full/ --kit ./sonarcloud/ /path/to/project
```

Both kits fail sandbox creation on error (unreachable marketplace, failed
`claude mcp add`, no `docker`, missing credential) instead of skipping
silently. Re-applying either is safe.

`sbx kit add <sandbox> ./<kit>/` applies a kit to a running sandbox but
skips `agentInstructions.content` for these `kind: mixin` kits — the write
is gated on `agentInstructions.filename`, which a mixin doesn't own. Use
`sbx run --kit` for a sandbox you'll work in.

## Credentials

Only `sonarcloud` needs one, declared under `credentials[]` so
`sbx secret set sonarqube` keeps the token out of the sandbox.
`SONARQUBE_ORG` is configuration, not a credential — pass it in the
creation environment. See
[`sonarcloud/README.md`](./sonarcloud/README.md#credentials).

## Remote use

Pin a git ref instead of a local path — `sbx` requires a full 40-hex commit
SHA:

```console
$ sbx run claude \
    --kit "git+https://github.com/infinum/ai.git#ref=$(git rev-parse HEAD)&dir=sandbox-kits/infinum-full" \
    /path/to/project
```

## References

- [`infinum-full`](./infinum-full/README.md)
- [`sonarcloud`](./sonarcloud/README.md)
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
