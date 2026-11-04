## Commit & PR attribution disabled

`attribution.commit` and `attribution.pr` are set to `""` in
`~/.claude/settings.json`. Commits and PRs you create won't carry the
"🤖 Generated with Claude Code" trailer or the "Co-Authored-By: Claude"
line.

## Maven Central reachable

Egress is allowed to `repo.maven.apache.org`, `repo1.maven.org`, and
`build.shibboleth.net` (Maven, Gradle). A build failing with an HTTP 403
mentioning "Blocked by network policy" needs that host added to the
sandbox policy, not a build-file change.

## claude.ai connectors reachable

Egress is allowed to `claude.ai` so the claude.ai connectors enabled
on the user's account work in the sandbox.

## Infinum plugins and house rules

The `infinum-ai` marketplace (`infinum/ai`) is registered with five
plugins installed at user scope:

- `create-prd`: generate a Product Requirements Document.
- `pr-review-code-simplicity`: review a PR through the six laws of
  software design.
- `productive-debug`: investigate a Productive bug task end-to-end;
  needs the Productive Claude connector enabled.
- `setup-audit`: audit this Claude Code setup itself (settings,
  plugins, hooks, MCP config, permissions) for vulnerabilities,
  malicious code, and prompt injection. Reads `~/.claude/` in this
  sandbox, so results only reflect this sandbox's config.
- `security-check`: three skills — vet a new dependency before adopting
  it (`dependency-adoption-review`), audit a system/global package
  before installing it (`system-package-audit`), and triage reported
  vulnerabilities like Dependabot alerts (`vulnerability-report-triage`).
  Needs the package-registry/GitHub egress above, local package
  managers (`npm`/`pip`/`cargo`/`gem`/etc.), and an authenticated `gh`.

More `infinum-ai` plugins are available: install one with
`claude plugin install <name>@infinum-ai`, or browse with `/plugin`.

House rules live at `~/.claude/infinum/`, chained from `index.md`,
imported by `~/.claude/CLAUDE.md`. `whoami.md` may still be the unedited
stub. If so, don't treat its placeholder example as fact about the
user.

## Caliber

The `caliber` plugin (`infinum/caliber-plugin`) is installed at user
scope. Its `/caliber:*` commands and its MCP server
`plugin:caliber:caliber` (`https://app.caliberhq.io/mcp/plugin`) are
the way into Caliber, Infinum's AI delivery platform: specs (PRD,
brief, tech spec, plan) reviewed and approved in the portal, PR
checks, and usage telemetry. Follow the instructions the MCP server
itself provides.

Tool calls fail with an auth error until a human runs
`claude mcp login plugin:caliber:caliber` (or `--no-browser` with no
browser reachable) inside the sandbox. That's an expected gap, not a
broken install. Don't re-register the server.

`/caliber:setup` joins a repository to a Caliber project by writing
the Caliber block into its `CLAUDE.md`/`AGENTS.md`. It is a
per-repository step the human confirms; the plugin's own session note
says when to offer it. A workspace without the block simply hasn't
been set up yet.

Egress is allowed to `app.caliberhq.io` (the MCP endpoint and its
OAuth sign-in).

## `context7` MCP server

Registered at user scope against Context7's OAuth endpoint. Resolves
library/framework names to current, version-specific docs and code
examples. Use it instead of guessing from training data (add "use
context7" to a prompt, or call `resolve-library-id` then
`get-library-docs`).

Tool calls fail with an auth error until a human runs
`claude mcp login context7` (or `--no-browser` with no browser
reachable) inside the sandbox. That's an expected gap, not a broken
install. Don't re-register the server or switch it to Context7's
anonymous endpoint.

Egress is allowed to `*.context7.com` (covers the MCP endpoint and the
OAuth backend) and `context7.com` (the OAuth consent page).
