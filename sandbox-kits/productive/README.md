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

## Fails fast by design

The install step runs under `set -eu` and exits non-zero on any error. If
`claude mcp add` fails — most likely because `mcp.productive.io` is
unreachable — the script prints its output plus the command to retry and
**fails sandbox creation**, rather than handing back a sandbox that looks fine
and has no Productive.

Re-running the step is still safe: once the server is registered,
`claude mcp add` exits 1 with "already exists", which the script treats as
nothing left to do rather than an error. That is the one non-zero exit it
tolerates — it means the desired end state already holds.

A registered-but-*unauthorized* server is the other tolerated outcome, and the
expected state after creation: the OAuth login is interactive and per user, so
it can't happen during unattended setup and its absence is not an error — see
[Registration vs. authorization](#registration-vs-authorization).

Retry inside the sandbox:

```console
$ claude mcp add --transport http productive https://mcp.productive.io/mcp -s user
```

## Usage

```console
$ sbx run claude --kit ./productive/ /path/to/project
```

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./productive/
```

> [!NOTE]
> `sbx kit add` runs the install step but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. The server is registered, but Claude won't have
> been told it exists or that it still needs an OAuth login, which is most of
> what that note carries. Use `sbx run --kit` for a sandbox you intend to work
> in. See [Applying the kits](../README.md#applying-the-kits).

## Verify

```console
$ sbx exec my-sandbox -- claude mcp list
$ sbx exec my-sandbox -- claude mcp get productive
```

`Status: ✔ Connected` means both registration and OAuth login succeeded. A
`⏸ Pending approval` or auth-related status means the server is registered
but `claude mcp login productive` still needs to run. The server can't be
*missing* — a failed registration fails creation. A `403` whose body
starts with `Blocked by network policy` means one of the two egress entries
isn't in effect — check `sbx policy ls` and `sbx policy log`.

## References

- [Kit spec](spec.yaml)
- Productive MCP server: <https://help.productive.io/en/articles/14817386-mcp-server>
- Productive MCP connectors (alternative, tool-specific setup): <https://help.productive.io/en/articles/14838909-mcp-connectors>
