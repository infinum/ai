# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits for a `claude`
sandbox:

- Infinum house rules and plugins
- A skills library
- Maven Central egress
- No Claude attribution
- The MCP servers we use

A kit is a `spec.yaml` the `sbx` engine turns into install commands, files,
and network policy at sandbox creation. The kit here is `kind: mixin`,
requiring `claude`.

## Kits

### [`infinum-full`](./infinum-full/)

- Claude attribution off
- Maven Central egress
- `infinum-ai` plugins + house rules
- `superpowers`
- `context7` MCP (OAuth)

No credential.

Jira/Confluence, Productive and GitHub aren't kits here. Use the Claude
connectors, enabled once on the account rather than per sandbox. GitHub also
works independently of any connector: the sandbox's own proxy already
injects GitHub credentials into git HTTPS operations.

## Usage

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
```

The kit fails sandbox creation on error (unreachable marketplace, failed
`claude mcp add`) instead of skipping silently. Re-applying it is safe.

`sbx kit add <sandbox> ./<kit>/` applies a kit to a running sandbox but
skips `agentInstructions.content` for these `kind: mixin` kits: the write
is gated on `agentInstructions.filename`, which a mixin doesn't own. Use
`sbx run --kit` for a sandbox you'll work in.

## Remote use

Pin a git ref instead of a local path. `sbx` requires a full 40-hex commit
SHA:

```console
$ sbx run claude \
    --kit "git+https://github.com/infinum/ai.git#ref=$(git rev-parse HEAD)&dir=sandbox-kits/infinum-full" \
    /path/to/project
```

## References

- [`infinum-full`](./infinum-full/README.md)
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
