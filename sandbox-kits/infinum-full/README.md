# infinum-full

Base Infinum `claude` sandbox setup. It is not team-specific. The kit installs:

- Disable Claude commit and PR attribution
- Allow Maven Central hosts
- Install `infinum-ai` plugins and house rules
- Install `caliber` plugin (Caliber commands and MCP server, OAuth login)
- Add `context7` MCP using OAuth
- Rewrite GitHub SSH remotes to HTTPS

## Requires

Base agent `claude`. No credentials need to be set up in advance.

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
| Plugins & house rules      | `infinum-ai` marketplace. `stack-essentials`, `create-prd`, `pr-review-code-simplicity`, `productive-debug`, `claude-setup-audit`, `security-check` skills. House rules are copied to `~/.claude/infinum/` |
| Caliber                    | `caliber` marketplace (`infinum/caliber-plugin`). `caliber` plugin: `/caliber:*` commands and the `plugin:caliber:caliber` MCP server. Needs manual login, see below for instructions                      |
| Context7                   | `context7` MCP server with OAuth authentication. Needs manual login, see below for instructions                                                                                                            |
| Git SSH to HTTPS rewrite   | `git@github.com:` and `ssh://git@ssh.github.com:443/` remotes rewritten to `https://github.com/` in `~/.gitconfig`                                                                                         |

### Network allow:

- `claude.ai` (claude.ai connectors)
- `repo.maven.apache.org`, `repo1.maven.org`, `build.shibboleth.net`
- `github.com`, `api.github.com`
- `*.context7.com`, `context7.com`
- `app.caliberhq.io` (Caliber MCP server and its OAuth sign-in)
- `pypi.org`, `crates.io`, `rubygems.org`, `api.osv.dev`, `rustsec.org`, `registry.npmjs.org` (`security-check` skill needs these lookups)

### Infinum plugins:

- `claude-setup-audit`
- `create-prd`
- `pr-review-code-simplicity`
- `productive-debug`
- `security-check`
- `stack-essentials`

See https://github.com/infinum/ai/blob/main/MARKETPLACE.md for more details on these plugins.

## Context7 login

```console
sbx exec <sandbox> -- claude mcp login context7
sbx exec <sandbox> -- claude mcp login context7 --no-browser   # no browser reachable
```

Needs to be repeated if the sandbox is recreated. `claude mcp logout context7` clears it.

## Caliber login

```console
sbx exec <sandbox> -- claude mcp login plugin:caliber:caliber
sbx exec <sandbox> -- claude mcp login plugin:caliber:caliber --no-browser   # no browser reachable
```

Needs to be repeated if the sandbox is recreated. Then run `/caliber:setup` once in each repository that
should use Caliber; it writes the Caliber block into the repository's `CLAUDE.md`/`AGENTS.md`.

## Not installed by default

The `superpowers` plugin (`obra/superpowers`) is no longer part of this kit. To add it to a sandbox:

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
