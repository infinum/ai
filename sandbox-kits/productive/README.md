# productive

Registers [Productive](https://productive.io)'s MCP server with Claude Code
inside a Docker Sandbox, so the agent can read and update projects, tasks,
time entries, CRM deals, resource bookings, and invoices without leaving the
conversation.

This is a mixin that requires the `claude` agent (it drives `claude mcp add`).
It contributes two entries on `permissions.network.allow`
(`mcp.productive.io`, `app.productive.io`) and one `setup.install` step that
registers the server at **user scope**, so it's available in every project
inside the sandbox, not just the one it was first added from.

## Registration vs. authorization

Unlike `context7`, this kit's install step only gets the server as far as
registered — it can't finish the connection. Productive's MCP server
authenticates with **per-user OAuth 2.0** (see [Productive's MCP server
docs](https://help.productive.io/en/articles/14817386-mcp-server)): a human
signs into Productive in a browser and authorizes one specific organization.
That can't run unattended during sandbox provisioning, so it's a manual step
after the sandbox is up:

```console
$ sbx exec my-sandbox -- claude mcp login productive
```

If there's no reachable browser (a bare SSH-style session), use the
headless flow instead — it prints a URL to open on any machine, and you paste
the resulting redirect URL back in:

```console
$ sbx exec my-sandbox -- claude mcp login productive --no-browser
```

Prerequisites on the Productive side: the account needs the **Ultimate**
subscription plan, and AI features must be enabled. Each login authorizes
exactly one organization; switching means `claude mcp logout productive`
followed by logging in again and picking a different one.

## Server URL

```
https://mcp.productive.io/mcp
```

registered with:

```console
$ claude mcp add --transport http productive https://mcp.productive.io/mcp -s user
```

Productive also publishes a separate sandbox/test-data endpoint,
`https://mcp-sandbox.productive.io`, that exercises the same actions against
a non-production organization without touching live data. This kit doesn't
register it — one connector name can only point at one URL at a time. To use
the test endpoint instead, either edit `spec.yaml`'s `URL` before running the
kit, or add a second connector by hand:

```console
$ claude mcp add --transport http productive-sandbox https://mcp-sandbox.productive.io -s user
```

## Why `app.productive.io` is on the allow-list

`mcp.productive.io` alone is enough for the MCP server itself, but
`claude mcp login` sends the user's browser to Productive's OAuth
authorize/consent page, which lives on `app.productive.io`. Without that host
allowed, the login page fails to load (`sbx policy log` will show the
block) even though the server is correctly registered.

## Schema version

Written as `schemaVersion: "2"`: egress lives under `permissions.network.allow`
and the sandbox note lives under `agentInstructions.content`.

## Usage

```console
$ sbx run claude --kit ./productive/ /path/to/project
```

Combine with the other kits in this directory:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./productive/ \
    /path/to/project
```

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./productive/
```

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get productive
```

`Status: ✔ Connected` means both registration and OAuth login succeeded. A
`⏸ Pending approval` or auth-related status means the server is registered
but `claude mcp login productive` still needs to run. A `403` whose body
starts with `Blocked by network policy` means one of the two egress entries
isn't in effect — check `sbx policy ls` and `sbx policy log`.

## References

- [Kit spec](spec.yaml)
- Productive MCP server: <https://help.productive.io/en/articles/14817386-mcp-server>
- Productive MCP connectors (alternative, tool-specific setup): <https://help.productive.io/en/articles/14838909-mcp-connectors>
