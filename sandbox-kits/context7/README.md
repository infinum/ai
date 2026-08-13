# context7

Registers [Context7](https://github.com/upstash/context7)'s MCP server with
Claude Code inside a Docker Sandbox, so the agent can pull current,
version-specific library and framework documentation instead of relying on
whatever was in its training data.

This is a mixin that requires the `claude` agent (it drives `claude mcp add`).
It contributes one entry on `permissions.network.allow` (`mcp.context7.com`)
and one `setup.install` step that registers the server at **user scope**, so
it's available in every project inside the sandbox, not just the one it was
first added from.

## Transport: remote HTTP, not local stdio

Context7 ships two ways to run:

- **Remote HTTP** — `https://mcp.context7.com/mcp`, hosted by Upstash. No
  install step beyond pointing Claude Code at the URL.
- **Local stdio** — `npx -y @upstash/context7-mcp`, run as a subprocess.

This kit uses the remote HTTP transport, registered with:

```console
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user
```

That keeps the network surface to a single host. The local option needs
Node.js in the sandbox plus egress to `registry.npmjs.org` (and whatever CDN
npm redirects to) just to fetch the package on every cold start. If your
project already has both and you'd rather run it locally, fork this kit:

```yaml
permissions:
  network:
    allow:
      - registry.npmjs.org

setup:
  install:
    - user: "1000"
      command: claude mcp add context7 -s user -- npx -y @upstash/context7-mcp
```

## API key

Context7's remote endpoint works anonymously on a shared public rate limit —
no key required. Set `CONTEXT7_API_KEY` in the sandbox environment before the
kit's install step runs, and it registers the server with that key's
`Authorization: Bearer` header instead, for a higher per-key limit. Get a
free key at [context7.com/dashboard](https://context7.com/dashboard).

`claude mcp add` writes the header at registration time; it doesn't update an
already-registered entry. Adding the key after the server is already
registered anonymously needs a manual re-add:

```console
$ claude mcp remove context7 -s user
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user \
    --header "Authorization: Bearer $CONTEXT7_API_KEY"
```

## Schema version

Written as `schemaVersion: "2"`: egress lives under `permissions.network.allow`
and the sandbox note lives under `agentInstructions.content`.

## Usage

```console
$ sbx run claude --kit ./context7/ /path/to/project
```

Combine with the other kits in this directory:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./context7/ \
    --kit ./superpowers/ \
    /path/to/project
```

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./context7/
```

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get context7
```

`Status: ✔ Connected` (or a tool call that actually resolves a library) means
it's wired up. A `403` whose body starts with `Blocked by network policy`
means the egress entry isn't in effect — check `sbx policy ls` and
`sbx policy log`.

## References

- [Kit spec](spec.yaml)
- Context7: <https://github.com/upstash/context7>
- All MCP clients / manual config reference: <https://context7.com/docs/resources/all-clients>
