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

## API key — required

`CONTEXT7_API_KEY` must be in the environment when the kit's install step
runs. The script checks for it first and **fails sandbox creation** when it is
missing; when it's there, the server is registered with that key's
`Authorization: Bearer` header. Get a free key at
[context7.com/dashboard](https://context7.com/dashboard).

Set it as a sandbox secret, or pass it in the creation environment:

```console
$ sbx secret set context7 --sandbox my-sandbox -t '<key>'
$ CONTEXT7_API_KEY=<key> sbx run claude --kit ./context7/ /path/to/project
```

Context7's remote endpoint would also work anonymously, on a shared public
rate limit — the kit deliberately doesn't allow that. An anonymous
registration succeeds at creation and then starts refusing calls mid-session
once the shared limit is hit, which is a worse and much later failure than a
missing key at creation time.

`claude mcp add` writes the header at registration time; it doesn't update an
already-registered entry. Rotating the key needs a manual re-add:

```console
$ claude mcp remove context7 -s user
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user \
    --header "Authorization: Bearer $CONTEXT7_API_KEY"
```

## Fails fast by design

The install step runs under `set -eu` and exits non-zero on any error, so a
broken kit fails sandbox creation instead of producing a sandbox that looks
fine and has no Context7. Two cases:

- `CONTEXT7_API_KEY` unset — see [API key](#api-key--required).
- `claude mcp add` failing, most likely because `mcp.context7.com` is
  unreachable. The script prints its output plus the command to retry.

Re-running the step is still safe: once the server is registered,
`claude mcp add` exits 1 with "already exists", which the script treats as
nothing left to do rather than an error. That is the one non-zero exit it
tolerates — it means the desired end state already holds.

Retry inside the sandbox:

```console
$ claude mcp add --transport http context7 https://mcp.context7.com/mcp -s user \
    --header "Authorization: Bearer <key>"
```

## Usage

```console
$ CONTEXT7_API_KEY=<key> sbx run claude --kit ./context7/ /path/to/project
```

Creation fails if the key isn't set — see [API key](#api-key--required).

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./context7/
```

> [!NOTE]
> `sbx kit add` runs the install step but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. The server is registered and reachable; Claude just
> won't have been told it exists, so it won't reach for it. Use
> `sbx run --kit` for a sandbox you intend to work in. See
> [Applying the kits](../README.md#applying-the-kits).

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get context7
```

`Status: ✔ Connected` (or a tool call that actually resolves a library) means
it's wired up. The server can't be *missing* — a failed registration fails
creation — so an absent entry means something removed it after setup. A `403`
whose body starts with `Blocked by network policy` means the egress entry
isn't in effect — check `sbx policy ls` and `sbx policy log`.

## References

- [Kit spec](spec.yaml)
- Context7: <https://github.com/upstash/context7>
- All MCP clients / manual config reference: <https://context7.com/docs/resources/all-clients>
