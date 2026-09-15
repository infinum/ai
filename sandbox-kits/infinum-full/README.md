# infinum-full

Mixin for a `claude` sandbox. Installs:

- Claude attribution off
- Maven Central egress
- The `infinum-ai` plugin marketplace + house rules
- `superpowers`
- The `context7` MCP server

## Requires

Base agent `claude`. No credential.

## Usage

```console
$ sbx run claude --kit ./infinum-full/ /path/to/project
```

`sbx kit add` runs the install steps and network policy but skips
`agentInstructions.content`: the engine gates that write on
`agentInstructions.filename`, which a mixin doesn't own. Use `sbx run --kit`
for a sandbox you'll work in.

Re-applying is safe: "already on disk" / "already installed" / "already
exists" are treated as done, not errors.

## What it installs

| Step | Installs |
|---|---|
| 1. Claude attribution | `attribution.commit` / `attribution.pr` → `""` in `~/.claude/settings.json` |
| 2. Plugins & house rules | `infinum-ai` marketplace; `stack-essentials`, `create-prd`, `pr-review-code-simplicity`, `productive-debug`; house rules copied to `~/.claude/infinum/` |
| 3. Superpowers | `claude-plugins-official` marketplace; `superpowers` |
| 4. context7 | `context7` MCP server, OAuth |

Network:

- `repo.maven.apache.org`, `repo1.maven.org` (Maven Central)
- `github.com`
- `*.context7.com` (MCP endpoint + OAuth backend), `context7.com` (OAuth consent page)

`productive-debug` needs the Productive Claude connector enabled.
`superpowers` (`obra/superpowers`, third-party, unpinned) loads a
`brainstorming`-skill web page with an `<img>` from `primeradiant.com`,
fetched by the browser, not the sandbox. Disable via
`SUPERPOWERS_DISABLE_TELEMETRY`, `DISABLE_TELEMETRY`, or
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`.

Other `infinum-ai` plugins: `claude plugin install <name>@infinum-ai`, or
`/plugin`. Not installed here:

- `ui-validation`, `download-figma-screenshot`, `mobile-deploy`,
  `claude-setup-audit`, `security-check`, `progress` (local tooling or
  blocked egress)
- `ai-ready-figma`, `design-conventions`, `purpose-driven-design`
  (design-side scope)

## Finish the context7 login

```console
$ sbx exec my-sandbox -- claude mcp login context7
$ sbx exec my-sandbox -- claude mcp login context7 --no-browser   # no browser reachable
```

Doesn't survive a sandbox recreate. `claude mcp logout context7` clears it.

## Verify

```console
$ sbx exec my-sandbox -- jq '.attribution, .enabledPlugins, .extraKnownMarketplaces' \
    /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- cat /home/agent/.claude/infinum/index.md
$ sbx exec my-sandbox -- claude plugin list
$ sbx exec my-sandbox -- claude mcp list
```

## References

- [Kit spec](spec.yaml)
- Docker Sandboxes kit authoring: <https://docs.docker.com/ai/sandboxes/customize/kits/>
