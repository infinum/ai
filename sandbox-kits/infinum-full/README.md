# infinum-full

Base Infinum `claude` sandbox setup. It is not team-specific. The kit installs:

- Disable Claude commit and PR attribution
- Allow Maven Central hosts
- Install `infinum-ai` plugins and house rules
- Install `caliber` plugin (Caliber commands and MCP server, OAuth login)
- Add `context7` MCP using OAuth
- Rewrite GitHub SSH remotes to HTTPS

## Requires

Base agent `claude` (`requires: ["claude", "deb/jq"]`), and an `sbx` release with kit v3 support. No
credentials need to be set up in advance.

## Kit format (v3)

The kit uses the [v3 kit descriptor](https://github.com/docker/sbx-kits-contrib/blob/v3/CONTRIBUTING.md). It
is a declaration-only `kind: mixin`, with no recipe:

- [`infinum-full.yaml`](./infinum-full.yaml): the descriptor. Deltas from the v2 `spec.yaml` are marked
  `# MIGRATION NOTE:`.
- [`infinum-full-context.md`](./infinum-full-context.md): the agent instructions (`agent-context@1`).

v3 behaviour worth knowing when you edit it:

- **Network policy is split by phase.** `install` allows only `github.com` and `api.github.com`, for the
  marketplace clones and plugin installs. `runtime` holds every host listed below. A host missing from a
  phase is blocked in that phase.
- **Hook environments are deny-by-default.** The plugin hooks declare `HTTP_PROXY`/`HTTPS_PROXY` so the
  `git` clone under `claude plugin marketplace add` uses the sandbox proxy. A new hook must list every
  variable it, or anything it runs, reads.
- **Startup reconciler.** The claude kits rewrite `~/.claude/settings.json` during sandbox creation. That
  can drop the attribution keys and the `enabledPlugins` entries written by the install hooks. A
  background startup hook waits for the platform's settings (up to 60s), then re-applies both. It never
  overrides an `enabledPlugins` key that is already set. Its log is at `/tmp/infinum-full-reconcile.log`.

Check it locally (this builds the kit, which also validates it):

```console
sbx kit inspect ./infinum-full
```

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
| Plugins & house rules      | `infinum-ai` marketplace. `create-prd`, `pr-review-code-simplicity`, `productive-debug`, `setup-audit`, `security-check` skills. House rules are copied to `~/.claude/infinum/` |
| Caliber                    | `caliber` marketplace (`infinum/caliber-plugin`). `caliber` plugin: `/caliber:*` commands and the `plugin:caliber:caliber` MCP server. Needs manual login, see below for instructions                      |
| Context7                   | `context7` MCP server with OAuth authentication. Needs manual login, see below for instructions                                                                                                            |
| Git SSH to HTTPS rewrite   | GitHub SSH remotes mapped to `https://github.com/` in `~/.gitconfig`                                                                                                                                       |

### Network allow:

- `claude.ai` (claude.ai connectors)
- `repo.maven.apache.org`, `repo1.maven.org`, `build.shibboleth.net`
- `github.com`, `api.github.com`
- `*.context7.com`, `context7.com`
- `app.caliberhq.io` (Caliber MCP server and its OAuth sign-in)
- `pypi.org`, `crates.io`, `rubygems.org`, `api.osv.dev`, `rustsec.org`, `registry.npmjs.org` (`security-check` skill needs these lookups)

### Infinum plugins:

- `setup-audit`
- `create-prd`
- `pr-review-code-simplicity`
- `productive-debug`
- `security-check`

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
