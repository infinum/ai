# infinum-full

Base Infinum `claude` sandbox setup. It is not team-specific.

## Requires

Base agent `claude` and an `sbx` release with kit v3 support. No credentials need to be set up in advance.

## Usage

```console
sbx run claude --kit "git+https://github.com/infinum/ai.git#dir=sandbox-kits/infinum-full" <workspace-dir>
```

Applying this kit to an existing sandbox is safe: "already on disk" / "already installed" / "already
exists" are treated as done, not errors.

## What it installs

| Step                       | Installs                                                                                                                                                                                                   |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Disable Claude attribution | `attribution.commit` / `attribution.pr` = `""` in `~/.claude/settings.json`                                                                                                                                |
| Plugins & house rules      | `infinum-ai` marketplace. `create-prd`, `pr-review-code-simplicity`, `productive-debug`, `setup-audit`, `security-check` plugins ([details](https://github.com/infinum/ai/blob/main/MARKETPLACE.md)). House rules are copied to `~/.claude/infinum/` |
| Caliber                    | `caliber` marketplace (`infinum/caliber-plugin`). `caliber` plugin: `/caliber:*` commands and the `plugin:caliber:caliber` MCP server. Needs a login, see below                                           |
| Context7                   | `context7` MCP server with OAuth authentication. Needs a login, see below                                                                                                                                  |
| Git SSH to HTTPS rewrite   | GitHub SSH remotes mapped to `https://github.com/` in `~/.gitconfig`                                                                                                                                       |
| Network egress             | Maven Central, `claude.ai` connectors, GitHub, and the hosts the plugins and MCP servers need. See [`infinum-full.yaml`](./infinum-full.yaml)                                                            |

## OAuth logins

Caliber and Context7 sign in with OAuth. Log in once per sandbox (again if it is recreated); add
`--no-browser` when no browser is reachable:

```console
sbx exec <sandbox> -- claude mcp login plugin:caliber:caliber
sbx exec <sandbox> -- claude mcp login context7
```

Then run `/caliber:setup` once in each repository that should use Caliber; it writes the Caliber block into
the repository's `CLAUDE.md`/`AGENTS.md`.

## Not installed by default

To add the `superpowers` plugin (`obra/superpowers`) to a sandbox:

```console
sbx exec <sandbox> -- claude plugin marketplace add anthropics/claude-plugins-official
sbx exec <sandbox> -- claude plugin install superpowers@claude-plugins-official
```

## Verification

```console
sbx exec <sandbox> -- jq '.attribution, .enabledPlugins, .extraKnownMarketplaces' \
    /home/agent/.claude/settings.json
sbx exec <sandbox> -- cat /home/agent/.claude/infinum/index.md
sbx exec <sandbox> -- claude plugin list
sbx exec <sandbox> -- claude mcp list
```

## Editing the kit

- [`infinum-full.yaml`](./infinum-full.yaml): the [v3 kit descriptor](https://github.com/docker/sbx-kits-contrib/blob/v3/CONTRIBUTING.md).
- [`infinum-full-context.md`](./infinum-full-context.md): the agent instructions.

Network policy is per phase: a host is reachable only in the phase (`install` or `runtime`) that lists it.
Hook environments are deny-by-default: a hook must list in `env:` every variable it, or anything it runs,
reads.

Validate it locally (this builds the kit):

```console
sbx kit inspect ./infinum-full
```
