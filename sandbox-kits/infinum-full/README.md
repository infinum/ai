# infinum-full

The baseline Infinum setup for a Claude Code sandbox. It isn't team-specific and is a good starting point for any
project. After installing it, you get:

- the [Infinum plugins](#infinum-plugins) and [house rules](#house-rules)
- [Caliber](#caliber) and [Context7](#context7) MCP servers
- commits and PRs [without Claude attribution trailers](#commit-and-pr-attribution-disabled)
- [GitHub over HTTPS](#github-ssh-remotes-over-https), even for `git@github.com:` remotes
- [network access](#network-access) for Maven/Gradle, GitHub, claude.ai connectors and the tools above

## Install

**Prerequisites:** the `sbx` CLI installed and Infinum kits allowed. See
[Before you start](../README.md#before-you-start). You don't need to set up any credentials beforehand.

Create a sandbox with the kit:

```console
sbx run claude --kit "git+https://github.com/infinum/ai.git#dir=sandbox-kits/infinum-full" <workspace-dir>
```

You can also add it to an existing sandbox. Re-applying it is safe, because steps that are already done are skipped.
Claude won't receive the kit's instructions this way, so prefer a new sandbox:

```console
sbx kit add <sandbox> "git+https://github.com/infinum/ai.git#dir=sandbox-kits/infinum-full"
```

## After installing

Do these in order. The first three are once per sandbox; repeat them if you recreate the sandbox.

### OAuth logins

Caliber and Context7 need a one-time sign-in. Until you sign in, their tools fail with an auth error. Add
`--no-browser` when no browser is reachable:

```console
sbx exec <sandbox> -- claude mcp login plugin:caliber:caliber
sbx exec <sandbox> -- claude mcp login context7
```

You can also sign in from Claude: run `/mcp`, pick the server and choose **Authenticate**.

### Tell Claude who you are

The house rules include `~/.claude/infinum/whoami.md`, which starts as a placeholder. Ask Claude in the sandbox to
fill it in with your name, role and stack, or edit the file yourself. The kit never overwrites it.

### Enable claude.ai connectors

Atlassian, Productive and GitHub connectors come from your Claude account, not the kit. Enable the ones you use on
claude.ai. `productive-debug` needs the Productive connector.

### Set up Caliber per repository

In each repository that should use Caliber, run this once inside Claude:

```text
/caliber:setup
```

It adds the Caliber block to the repository's `CLAUDE.md`/`AGENTS.md`.

## Features

### Infinum plugins

Installed from the `infinum-ai` marketplace ([`infinum/ai`](https://github.com/infinum/ai)) at user scope:

| Plugin                      | What it does                                                                                       |
|-----------------------------|----------------------------------------------------------------------------------------------------|
| `create-prd`                | Writes a Product Requirements Document through a guided flow of clarifying questions.               |
| `pr-review-code-simplicity` | Reviews PRs against the six laws of software design from *Code Simplicity*.                        |
| `productive-debug`          | Investigates Productive bug tasks and ranks hypotheses with code evidence. Needs the Productive connector. |
| `setup-audit`               | Audits the Claude Code setup (plugins, skills, MCP servers, hooks) for security issues. Inside a sandbox it audits that sandbox's config. |
| `security-check`            | Vets new dependencies, audits system packages before install, and triages vulnerability reports.    |

See [MARKETPLACE.md](../../MARKETPLACE.md) for details and the other plugins. Install more with:

```console
claude plugin install <name>@infinum-ai
```

### House rules

Shared Infinum instructions for Claude, such as labelling AI-assisted PRs. They are copied to `~/.claude/infinum/`
and imported from `~/.claude/CLAUDE.md`. Re-applying the kit refreshes them from the marketplace but keeps your
`whoami.md`.

### Caliber

The [Caliber](https://caliber.infinum.com/) plugin ([`infinum/caliber-plugin`](https://github.com/infinum/caliber-plugin))
adds the `/caliber:*` commands for specs, plans and PR checks, plus the Caliber MCP server. It needs an
[OAuth login](#oauth-logins).

### Context7

The [Context7](https://context7.com/) MCP server gives Claude current documentation for libraries and frameworks.
It is registered at user scope with OAuth and needs an [OAuth login](#oauth-logins).

### Commit and PR attribution disabled

Commits and PRs that Claude creates don't get the "🤖 Generated with Claude Code" or
"Co-Authored-By: Claude" lines.

### GitHub SSH remotes over HTTPS

The sandbox authenticates GitHub over HTTPS through its proxy. The kit rewrites GitHub SSH URLs (`git@github.com:`,
`ssh://git@github.com/` and similar) to `https://github.com/` in `~/.gitconfig`, so existing SSH remotes keep working.

### Network access

Sandboxes block outbound traffic by default. The kit allows:

- **claude.ai** for your account's connectors
- **Maven Central** (and Shibboleth) for Maven and Gradle builds
- **GitHub** for git, `gh` and plugin updates
- **Context7** and **Caliber** for their MCP servers and sign-in
- **AI Stats** telemetry (Grafana OTLP gateway)
- **Package registries and advisory databases** (npm, PyPI, crates.io, RubyGems, deps.dev, OSV, RustSec) for
  `security-check`

See [`infinum-full.yaml`](./infinum-full.yaml) for the exact host list.

### Instructions for Claude

The kit adds a short note to Claude's context that explains all of the above. With it, Claude recognizes a missing
OAuth login or a blocked host instead of trying to "fix" the install.

## Optional extras

To add the `superpowers` plugin (`obra/superpowers`):

```console
sbx exec <sandbox> -- claude plugin marketplace add anthropics/claude-plugins-official
sbx exec <sandbox> -- claude plugin install superpowers@claude-plugins-official
```

## Troubleshooting

- **Caliber or Context7 tools fail with an auth error:** you haven't signed in yet. Run the
  [OAuth logins](#oauth-logins).
- **HTTP 403 "Blocked by network policy":** the kit doesn't allow that host. Allow it for your sandbox with
  `sbx policy allow network <host>`. If others need it too, open a PR that adds it to the kit.

---

## Contributing

### Files

- [`infinum-full.yaml`](./infinum-full.yaml): the [v3 kit descriptor](https://github.com/docker/sbx-kits-contrib/blob/v3/CONTRIBUTING.md),
  with network policy, install hooks and agent context.
- [`infinum-full-context.md`](./infinum-full-context.md): the instructions added to Claude's context.
- `README.md`: this file.

### How it works

The install hooks run in order, as the `agent` user:

1. **git:** rewrite GitHub SSH URLs to HTTPS in `~/.gitconfig`.
2. **attribution:** set `attribution.commit` and `attribution.pr` to `""` in `~/.claude/settings.json`.
3. **plugins:** add the `infinum-ai` and `caliber` marketplaces and install their plugins.
4. **house rules:** copy `rules/*.md` from the `infinum-ai` marketplace clone into `~/.claude/infinum/`, build
   `index.md` and import it from `~/.claude/CLAUDE.md`. This hook depends on the clone that hook 3 creates.
5. **MCP servers:** register `context7` (HTTP, OAuth) at user scope and print the login note. That note links to
   this README's `#oauth-logins` anchor, so keep the heading.

Things to keep in mind:

- **Network policy is per phase.** A host is reachable only in the phase (`install` or `runtime`) that lists it.
- **Hook environments are deny-by-default.** A hook must list in `env:` every variable that it, or anything it runs,
  reads.
- **Hooks must be idempotent.** "Already on disk", "already installed" and "already exists" count as success, so the
  kit can be re-applied.

### Making changes

- Bump `version` in `infinum-full.yaml` whenever the declarations change.
- Keep [Features](#features) in this README and `infinum-full-context.md` in sync with the yaml.
- Validate locally with `sbx kit inspect ./infinum-full`, then test from your branch:

  ```console
  sbx run claude --kit "git+https://github.com/infinum/ai.git#ref=<branch>&dir=sandbox-kits/infinum-full" <workspace-dir>
  ```
