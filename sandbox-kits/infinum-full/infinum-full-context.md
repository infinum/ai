## Commit & PR attribution disabled

`attribution.commit` and `attribution.pr` are set to `""` in
`~/.claude/settings.json`. Commits and PRs you create won't carry the
"🤖 Generated with Claude Code" trailer or the "Co-Authored-By: Claude"
line.

## Network egress

Egress is allowed to `claude.ai` (the user's claude.ai connectors), Maven
Central (`repo.maven.apache.org`, `repo1.maven.org`,
`build.shibboleth.net`), GitHub, and the hosts the plugins and MCP
servers below need. A request failing with an HTTP 403 mentioning
"Blocked by network policy" needs that host added to the sandbox policy,
not a build-file change.

## Infinum plugins and house rules

Plugins from the `infinum-ai` marketplace (`infinum/ai`) are installed at
user scope. Install more with `claude plugin install <name>@infinum-ai`,
or browse with `/plugin`. In this sandbox:

- `productive-debug` needs the Productive claude.ai connector enabled.
- `setup-audit` reads this sandbox's `~/.claude/`, so its results only
  reflect this sandbox's config.
- `security-check` needs local package managers
  (`npm`/`pip`/`cargo`/`gem`/etc.) and `gh` (its GitHub auth is injected
  by the sandbox proxy, so `gh auth status` showing "not logged in" is
  expected).

House rules live at `~/.claude/infinum/`, chained from `index.md`,
imported by `~/.claude/CLAUDE.md`. `whoami.md` may still be the unedited
stub. If so, don't treat its placeholder example as fact about the
user.

## Caliber and context7 MCP servers

The `caliber` plugin (`infinum/caliber-plugin`) and the `context7` MCP
server are installed at user scope. Both servers provide their own usage
instructions.

Their tool calls fail with an auth error until a human runs
`claude mcp login plugin:caliber:caliber` or `claude mcp login context7`
(add `--no-browser` with no browser reachable) inside the sandbox. That's
an expected gap, not a broken install. Don't re-register either server,
or switch context7 to its anonymous endpoint.
