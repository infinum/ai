# Plugins and connectors across Claude surfaces: a portability and capability map

## TL;DR

Skills and plugins that work in the Claude Code terminal app can silently break in Claude's other surfaces — notably Cowork mode and the Claude desktop app — for two reasons that compound each other:

1. **Sandbox isolation.** Cowork runs the agent's shell inside an isolated Linux VM with a strict egress allowlist, so anything implicitly relying on "the agent and the user share a machine" stops working: local MCP servers on `localhost`, local databases, Docker, local LLMs (Ollama), files outside an explicitly-shared folder, port-forwarded services, custom CLI tools.
2. **A narrower plugin surface.** Cowork supports a subset of the Claude Code plugin model. Skills, slash commands, subagents, bundled MCP servers (`.mcp.json`) **and hooks** run in Cowork (hooks were previously described here as unsupported — that was wrong; see [Hooks run in Cowork](#hooks-run-in-cowork--correction-to-earlier-guidance) below); `.lsp.json`, `monitors/`, `bin/` PATH injection and other shell-side extension points either don't run or have no analogue. A plugin authored for the terminal app may technically install in Cowork but only have a fraction of its surface area active.

There is also a parallel extension mechanism that is _not_ a plugin: **custom connectors**, which are remote-MCP-server registrations attached to a personal account (Pro/Max) or an organization (Team/Enterprise). Connectors live outside the plugin system and behave differently — they're the right tool for some jobs and the wrong one for others. We cover the comparison explicitly below.

None of this is a bug to be fixed by tweaking a skill — it's a deliberate isolation model and a deliberately narrower plugin surface, both with real trade-offs. Plugins we publish to the marketplace need to be written (or at minimum labeled) with this in mind, otherwise users will hit confusing failures.

All of this might change in the future, as Cowork is a research preview and both the sandbox and plugin surface are likely to evolve. Until then, this document is meant to be a reference for how the current state of things works, what the practical implications are for our plugins, and what to watch for in future updates.

## Where our skills actually run

We tend to think of "Claude" as one thing, but our plugins are executed by at least two materially different runtimes today:

**Claude Code terminal app.** The agent and any shell it spawns run on the user's Mac as the user. There's effectively no sandbox: skills inherit the user's network identity, filesystem, environment variables, and installed tooling. A skill that runs `curl http://localhost:3845`, `psql -h localhost`, or `docker ps` works exactly the way the developer expects.

**Claude Desktop / Cowork mode.** The agent's shell runs inside an isolated Linux VM whose network and filesystem are intentionally not the user's. The agent has access to a handful of mounted folders, some preinstalled tooling, and a curated set of MCP connectors — and that's it. Outbound network traffic is intercepted by an egress proxy that allowlists only platform-sanctioned destinations.

The two runtimes look identical from a plugin manifest's perspective; nothing in `.claude-plugin/plugin.json` declares which environment a skill is viable in. That's the first gap.

The second gap is in what a plugin can _contain_ in each environment. Claude Code accepts a much wider set of plugin components than Cowork does today, and that asymmetry is what makes "this plugin worked in the terminal but does almost nothing in Cowork" a realistic failure mode even when the sandbox isn't the immediate cause.

## Plugin component support: Claude Code vs Cowork

Claude Code's plugin spec (`code.claude.com/docs/en/plugins`) defines these top-level directories inside a plugin:

| Directory / file             | Purpose                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | Manifest (name, version, description, author)                         |
| `skills/`                    | Model-invoked agent skills (`<name>/SKILL.md`)                        |
| `commands/`                  | Explicit slash commands (legacy flat-file form of skills)             |
| `agents/`                    | Custom subagent definitions                                           |
| `hooks/hooks.json`           | Event handlers (PreToolUse, PostToolUse, etc.) running shell commands |
| `.mcp.json`                  | MCP server registrations bundled with the plugin                      |
| `.lsp.json`                  | Language Server Protocol configurations for code intelligence         |
| `monitors/monitors.json`     | Background watchers piping stdout into the agent as notifications     |
| `bin/`                       | Executables added to the Bash tool's `$PATH` while plugin is enabled  |
| `settings.json`              | Default settings applied when the plugin is enabled                   |

Cowork, per the official "Customize Cowork with plugins" announcement and the in-product plugin directory, is currently described as supporting **skills, slash commands, subagents, and connectors** — explicitly file-based. There is no mention of hooks, LSP, monitors, `bin/` PATH injection, or shell-mounted executables, and there's no obvious place for them to land given the sandbox model. **(Correction, 2026-07:** the *blog announcement* omits hooks, but Anthropic's [_Use plugins in Claude Cowork_](https://support.claude.com/en/articles/13837440-use-plugins-in-claude-cowork) Help Center article explicitly states hooks **run in Cowork** — see [Hooks run in Cowork](#hooks-run-in-cowork--correction-to-earlier-guidance) below. LSP, monitors, and `bin/` remain unmentioned and are treated as unsupported.)

The practical state of plugin component support, as best as I've been able to verify:

| Component                               | Claude Code terminal | Cowork                                                                                                                                      | Notes                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skills (`skills/`)                      | Yes                  | Yes                                                                                                                                         | The common denominator. Both environments fire skills on relevant context.                                                                                                                                                                                                                     |
| Slash commands (`commands/`)            | Yes                  | Yes                                                                                                                                         | Listed as supported in Cowork; legacy form of skills.                                                                                                                                                                                                                                          |
| Subagents (`agents/`)                   | Yes                  | Yes (per announcement)                                                                                                                      | Cowork advertises sub-agent support, but the marketplace plugins we've inspected lean _heavily_ on skills — only dedicated agent-style plugins (e.g. Anthropic's `pitch-agent`) actually ship `agents/`. Worth treating as "supported but rarely used" until we see more in-the-wild examples. |
| Bundled MCP (`.mcp.json`)               | Yes                  | Yes for **remote** servers; **stdio (local-subprocess) servers are not viable** because the sandbox can't launch the user's local binaries. | This is the single biggest difference in practice.                                                                                                                                                                                                                                             |
| Hooks (`hooks/`)                        | Yes                  | **Yes** — runs in Cowork; grayed out in plain chat (corrected — see below)                                                                                                                         | Corrected 2026-07 — hooks **do** run in Cowork (Help Center: "hooks and sub-agents run only in Cowork"). A hook's *value* still depends on what it does: network egress and local binaries fail, but a `SessionStart` hook that injects a bundled file into context works. See the correction section below.                                                                                                                                                    |
| LSP (`.lsp.json`)                       | Yes                  | No                                                                                                                                          | Cowork is not running a code-intelligence loop against the user's editor.                                                                                                                                                                                                                      |
| Monitors (`monitors/`)                  | Yes                  | No                                                                                                                                          | Background `tail -F`-style watchers don't make sense without the user's filesystem.                                                                                                                                                                                                            |
| `bin/` PATH injection                   | Yes                  | No                                                                                                                                          | Sandbox image has no notion of plugin-supplied user binaries.                                                                                                                                                                                                                                  |
| `settings.json` (agent activation etc.) | Yes                  | Unclear; not advertised                                                                                                                     | Likely no Cowork analogue for "activate this subagent as the main thread".                                                                                                                                                                                                                     |

The shape of the gap: a plugin can install fine in both environments and still behave very differently because the active surface area is smaller in Cowork.

## Hooks run in Cowork — correction to earlier guidance

> **Earlier versions of this document — and the `cowork-readiness-check` skill — claimed hooks do not run in Cowork. That was wrong.** It was an inference from the blog announcement's silence plus the sandbox model, written up as fact. Leaving the correction in the doc's usual retraction style so the mistake is visible, not quietly overwritten.

Anthropic's Help Center article **[_Use plugins in Claude Cowork_](https://support.claude.com/en/articles/13837440-use-plugins-in-claude-cowork)** states directly:

> "The skills bundled in a plugin work across all three [web chat, Claude Desktop chat, and Cowork], while **hooks and sub-agents run only in Cowork**, so they appear grayed out in chat."

So the accurate picture across the three Claude.ai/Desktop surfaces — plus the Claude Code terminal, where hooks have always run — is:

| Surface | Skills | Hooks |
|---|---|---|
| Claude Code terminal | ✅ | ✅ |
| Cowork | ✅ | ✅ |
| Plain web / Desktop chat (non-Cowork) | ✅ | ❌ grayed out |

Practical consequences:

- A `hooks/` directory is **not**, by itself, a reason a plugin is "Not Cowork-ready." What matters is what the hook *does*: a hook that shells out to a local binary, hits `localhost`, or reaches a host the egress proxy blocks still fails; a hook that only reads a bundled file and prints it is fine.
- The `cowork-readiness-check` skill's hard rule to the contrary has been corrected.

**Caveat (pending our own verification).** The article speaks of "hooks" as a category. We have **not** independently confirmed that the **`SessionStart`** event specifically fires inside a live Cowork session. Treat "SessionStart works in Cowork" as *documented-by-implication, not yet empirically verified by us* until we smoke-test it.

## Global instructions in Cowork: why `~/.claude` rules don't reach it — and the hook "trick" that does

Cowork does **not** read the user-global `~/.claude/CLAUDE.md` that the Claude Code terminal (and this repo's installer-shipped [`rules/`](rules/)) rely on. Cowork runs in an isolated VM whose filesystem is scoped to explicitly-connected folders, and its persistent-instruction surfaces are its own:

- **Global instructions** — _Settings → Cowork_ in Claude Desktop ("standing instructions that apply to every Cowork session").
- **Folder instructions** — project-specific context attached to a connected folder.
- **Project** files, instructions, and memory.
- A **CLAUDE.md located inside a connected folder** — not `~/.claude`.

Evidence:

- **[_Get started with Claude Cowork_](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)**: "Claude can only read and write files in folders you've connected." The documented persistent-instruction mechanisms are Global instructions, folder instructions, and project memory — with no mention of `~/.claude` or a user-global `CLAUDE.md`.
- **[claude-code issue #44098](https://github.com/anthropics/claude-code/issues/44098)** ("Expose configurable memory and CLAUDE.md paths in Cowork mode"): "Cowork mode inherits Claude Code's auto-memory system and CLAUDE.md loading, but neither path is user-configurable within Cowork's UI"; auto-memory "writes to a hardcoded local VM path"; "Cowork's sandboxed VM environment doesn't surface environment variables or a `settings.json` for user configuration." The documented CLAUDE.md workaround is a **local** CLAUDE.md in a *connected* folder acting as a "bootstrapping shim" — confirming Cowork's CLAUDE.md loading is folder-scoped, not `~/.claude`-scoped.

**Implication for this repo:** the [`rules/`](rules/) mechanism (the installer writes to `~/.claude/infinum/` and imports it from `~/.claude/CLAUDE.md`) loads in the **Claude Code terminal only**. It does **not** reach Cowork. A rule bundle is therefore the wrong vehicle for anything that must be present in a Cowork session.

### The trick: ship always-on, rule-like instructions to Cowork via a `SessionStart` hook

Because **hooks run in Cowork** but `~/.claude` rules don't, the portable way to get "always-on" instructions into a Cowork session is to **ship them as a file inside the plugin and inject them with a `SessionStart` hook**:

```jsonc
// plugins/<plugin>/hooks/hooks.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "cat \"${CLAUDE_PLUGIN_ROOT}/instructions.md\"", "timeout": 10 }
        ]
      }
    ]
  }
}
```

The hook's stdout is injected into the session context at start, so `instructions.md` behaves like an always-on rule — but delivered through a surface Cowork honors (the plugin and its hooks), not through `~/.claude`. `${CLAUDE_PLUGIN_ROOT}` **does** expand inside `hooks.json` (unlike in `SKILL.md`, where it doesn't — see [CONTRIBUTING.md — Template variables](CONTRIBUTING.md)), so the path resolves in both the terminal and the Cowork VM where the plugin is installed. (Note: the [`purpose-driven-design`](plugins/purpose-driven-design/) plugin ships a persona in `instructions.md` but does **not** use this hook — each of its skills reads that file at invocation instead. That covers all three surfaces (including plain chat, where hooks are grayed out), at the cost of only applying once a PDD skill runs rather than session-wide. Reach for the `SessionStart` hook trick when you need the instructions present from the first message regardless of whether a skill fires.)

Trade-offs and rules of thumb:

- **Scope.** The hook fires only when the plugin is *enabled*, and only in Cowork + the terminal — **not** in plain web/desktop chat (hooks are grayed out there). For chat coverage too, have the skills load the same file at invocation; skills run on all three surfaces.
- **Single source of truth.** Keep the instructions in the one plugin file. Don't also copy them into `rules/` — that creates drift and only helps the terminal.
- **Keep the hook Cowork-safe.** `cat` of a bundled file is fine; do **not** fetch from the network or invoke local binaries in a hook you want to work in Cowork (the egress proxy and missing binaries will make it fail).
- **Pending verification.** Confirm `SessionStart` actually fires in a live Cowork session (see the caveat above) before relying on this for a Cowork-critical persona.

## What Anthropic's own marketplaces actually ship

Worth cross-referencing two of Anthropic's reference marketplaces, because they tell different stories:

**`anthropics/knowledge-work-plugins`** (the Cowork-oriented set: sales, finance, data, design, engineering, HR, legal, marketing, operations, product-management, etc.) is almost entirely **skills plus `.mcp.json` connector wiring**, with a `CONNECTORS.md` documenting which MCP servers each vertical depends on. Plugins like `sales/`, `finance/`, `data/` have `.claude-plugin/`, `.mcp.json`, `skills/`, and a README — that's it. No `commands/`, no `agents/`, no `hooks/`. The shape is "domain expertise + the MCP servers needed to act on it." This is the de-facto Cowork plugin shape today.

**`anthropics/financial-services`** is more elaborate. Its `plugins/vertical-plugins/financial-analysis` directory has `.claude-plugin/`, `.mcp.json`, `commands/`, `hooks/`, _and_ `skills/`. Its `plugins/agent-plugins/pitch-agent` has both `agents/` and `skills/`. The README is explicit that some of these are also "Managed Agent templates" deployed via separate cookbooks. So the financial-services repo is using the full Claude Code plugin surface — but it's labeled as a reference for FSI builders, not as a pure Cowork distribution, and the agent-plugins are partly intended for the Managed Agents product rather than Cowork in-product.

The takeaway for us: if we want plugins that work cleanly in Cowork today, **target the shape of `knowledge-work-plugins`** — skills, MCP wiring, optional commands. Reserve `hooks/`, `monitors/`, `bin/`, and shell-driven automation for terminal-only plugins, and label them as such.

## What the Cowork sandbox actually blocks

For a skill running inside the Cowork shell, here is the practical picture I've verified:

`127.0.0.1` and `localhost` resolve to the sandbox's own loopback, not the Mac's. So any skill that talks to a service bound to `localhost` on the developer's machine fails with `Connection refused` — without ever reaching the user's machine.

`host.docker.internal` _does_ resolve to the host, but every connection is rejected by an egress proxy returning `403 — blocked-by-allowlist`. Same outcome.

Even general internet egress is blocked: outbound `curl https://example.com`, `https://github.com`, and tunneling services (ngrok, Cloudflare Tunnel) all return `403` from the proxy. There is no user-controllable setting to add destinations to this allowlist.

Crucially, the agent itself does reach the outside world through different, sanctioned channels — registered MCP connectors, the built-in `WebFetch`/`WebSearch` tools, the Control-Your-Mac connector, and so on. These are not available to skills' shell code; they're agent-level capabilities orchestrated by Claude itself.

## What this affects, in practical terms

Anything where a skill implicitly assumes "I'm on the user's machine" is at risk. Concrete categories from our existing and likely-future plugins:

Local MCP servers bound to a port (Figma Dev Mode at `:3845`, custom internal MCPs, anything launched as a subprocess). Local databases — Postgres, Redis, your project's dev DB. Local dev servers that a UI-validation or smoke-test skill would normally hit. Docker containers exposed only to localhost. Local LLM runtimes (Ollama, llama.cpp). Files outside the agent's mounted workspace folder. SSH-forwarded ports, Tailscale-only hostnames, VPN-gated internal APIs. Custom CLI tools (`gh`, `kubectl`, `aws`, `productive-cli`, anything else) that happen to be on the developer's `$PATH` but are not in the sandbox image.

The failure mode worth flagging: it's silent and easy to misread. The skill triggers, the bash call returns `Connection refused` or `403 blocked-by-allowlist`, the agent reports failure to the user, and the user doesn't have enough context to know that the same skill works fine for the same task in the terminal app.

## What "works" looks like in each environment

Roughly, workarounds rank like this:

The cleanest path is to **rebuild the skill around a hosted equivalent** of whatever it needs locally. Many vendors expose a remote MCP server, a REST API, or a hosted connector that achieves the same end result without going through the user's machine. These are reached over the agent's MCP transport, not through the shell sandbox, so they aren't subject to the egress allowlist. Cost is credential management (tokens, OAuth) and sometimes feature parity.

If a local resource is genuinely required, **registering it as a plugin-scoped MCP server** (`.mcp.json` shipped in the plugin) lets the agent reach it without going through the shell sandbox, because the agent talks to MCP servers via its own transport. This is what unblocks some local-MCP cases. Important caveat: this gives the agent tools it can call, but does not necessarily give the skill access to raw bytes. MCP tools that return inline images, files, or binary content typically surface those to the agent as visual or referenced attachments rather than as readable text — useful for "see this," not necessarily useful for "save this to disk."

When neither of the above fits, the **Control-Your-Mac / osascript connector** acts as an escape hatch: the agent can run arbitrary shell commands on the user's Mac, bypassing the sandbox entirely. It works, but it's a heavy hammer — file handoff is awkward, AppleScript-escaped commands are fragile, and the connector has to be explicitly granted by the user. It's worth reserving for things genuinely unsolvable in other ways.

Finally, **document the skill as terminal-only**. For some workflows (a skill that runs the user's actual test suite, talks to their local DB, or shells into a dev container) "Claude Code terminal only" is the honest answer. Saying so in the README is better than letting a user hit `Connection refused` and assume the skill is broken.

## Custom connectors: the parallel extension mechanism

Plugins are not the only way to extend Claude. Alongside the plugin system there is a separate concept — **custom connectors** — that confuses easily because the two overlap in capability but differ in scope, lifecycle, and where they live.

A custom connector is a registration for a **remote MCP server** attached to either a Claude personal account (Pro/Max, under _Customize → Connectors_) or a Claude organization (Team/Enterprise, under _Organization settings → Connectors_, addable only by an Owner or Primary Owner). The registration is essentially three pieces of information: a remote MCP server URL, an optional OAuth client ID and client secret in Advanced settings, and an opt-in toggle for each user inside the org who wants to actually use it. Once enabled by the Owner, individual users authenticate against it themselves, so the connector inherits _their_ permissions in the underlying system rather than running on a shared service account.

This is exactly the mechanism we've used for Productive. The connector entry points at `https://mcp.productive.io/mcp`, exposes 16 tools (`create_resource`, `delete_resource`, `describe_report`, `describe_resource`, `get_supported_currencies`, `load_resource`, `load_skills`, `perform_action`, and eight more), and was registered once at the org level. From any individual user's perspective the steps were: open the connector listing, click Connect, complete the OAuth handshake against Productive, and the tools become available in their sessions.

So: yes, **a custom connector is functionally a remote MCP server registered at the account or org level outside the plugin system**. Concretely, that means a few things differ from a plugin that bundles an MCP server via `.mcp.json`:

- **Scope and lifecycle.** A connector is configured once per account/org and persists across every session and every plugin the user has installed. A plugin's `.mcp.json` server only registers while that plugin is enabled, and is scoped to that plugin's tools.
- **Transport.** Connectors are remote-MCP only. The server has to be reachable on the public internet from Anthropic's IP ranges. Plugin-bundled MCP entries in Claude Code can also be stdio (a local subprocess), which is one of the things that does not survive a move to Cowork — the sandbox image won't run the user's local binaries.
- **Trust boundary.** Connector OAuth happens between the user and the connector's own auth server, with tokens encrypted at rest inside Claude. The plugin install flow does not by itself grant any external credentials; it just declares that _this MCP server exists_ — credential setup, if any, is whatever the MCP server requires when reached.
- **Distribution model.** A connector is added once by an admin (or by an individual user on Pro/Max). A plugin is shipped through a marketplace and installed per-plugin per-user, and can carry a connector alongside skills, commands, and agents in one package.
- **Discoverability inside the product.** Connectors show up under _Directory → Connectors_ in Cowork with their tool list. Plugins show up under _Directory → Plugins_. They look similar in the UI but are managed separately.

There is real overlap between a custom connector and a plugin whose only payload is a `.mcp.json`. In both cases the agent gains a set of MCP tools and nothing else. The difference is mostly about packaging and lifecycle: if the only thing you want to share is "talk to _this_ internal MCP server," registering it as a custom connector is lower-friction (one entry in admin settings, available everywhere, no marketplace plumbing). If you want to ship skills or commands _together with_ that server — domain prompts that teach the agent how to use the tools effectively, plus the tools themselves — bundling them as a plugin keeps everything in one place and version-pinned together. The Anthropic `knowledge-work-plugins` marketplace is essentially this latter pattern: each vertical pairs domain skills with an MCP wiring describing which connectors that vertical expects to be present.

A practical decision rule for us: **if the deliverable is "the agent can call these tools," start with a custom connector. If the deliverable is "the agent knows how to do this kind of work and which tools to use," ship a plugin** (with skills + the MCP wiring, leaving the actual MCP server either embedded or referencing a known custom connector the org has already enabled).

One small but real caveat for plugins-as-MCP-wrappers in Cowork: a plugin's `.mcp.json` configured for **stdio** transport assumes a process can be spawned on the user's machine. That assumption holds in the terminal app and does not hold in Cowork. Plugin authors who need an MCP server to be available in Cowork should register it as a **remote** MCP server (HTTP/SSE) in `.mcp.json`, or steer users toward an equivalent custom connector at the org level.

## Implications for the plugins we publish

Concrete recommendations as we add or revise skills in the marketplace:

Audit each plugin against two questions before tagging it `1.0.0`. First: does it assume `localhost` reachability, files outside the explicit workspace, or local binaries not in a typical sandbox image? Second: does it rely on Claude Code plugin components Cowork doesn't run today — `hooks/`, `monitors/`, `.lsp.json`, `bin/` PATH injection? If yes to either, it has limited portability and we should know which environments it actually targets.

Where there's a hosted equivalent, prefer it for the primary path and keep the local-resource path as a fallback. This is the difference between "works wherever Claude works" and "works on three of our laptops."

For plugins that legitimately need a local MCP server, ship the `.mcp.json` registration alongside them. It costs us nothing on the terminal app and unblocks the case for users who reach the same plugin from Cowork — _with_ the caveat above about byte-level access for binary content, and the further caveat that **stdio MCP transport will not work in Cowork** even if the server itself would otherwise be appropriate. Prefer HTTP/SSE transports for any MCP wiring intended to work across both surfaces.

When the deliverable is purely "talk to this MCP server," strongly prefer **registering it as a custom connector** at the org level rather than wrapping it in a plugin. The connector then becomes available to every Cowork user in the org without each of them needing to install a plugin, and the OAuth handshake is per-user, so permissions naturally inherit. Our Productive setup is a good template here.

Add an environment-compatibility line to each plugin's README. Even a single sentence — "Works in Claude Code terminal; in Cowork, only the read-only path is functional" — saves users meaningful time and prevents the perception of "this plugin is broken." Where useful, list explicitly which plugin components are active in which environment.

When in doubt about plugin shape, **model the Cowork-facing plugins after `anthropics/knowledge-work-plugins`** (skills + `.mcp.json` + a `CONNECTORS.md`), and reserve the fuller `anthropics/financial-services` shape (hooks, commands, bundled agents) for plugins explicitly targeted at the terminal app or at Managed Agent deployment.

Treat the absence of `localhost` allowlisting and the narrower plugin surface in Cowork as product feedback worth sending to Anthropic explicitly, not just to be raised once. These are the kinds of gaps that drive roadmap when collected with concrete examples — including ours.

## Example: file-on-disk Figma screenshots

A concrete instance of the pattern: a skill in the marketplace exists to save a Figma frame as a PNG on disk by hitting the Figma desktop app's local Dev Mode MCP server (`http://127.0.0.1:3845/mcp`). In the terminal app this works without ceremony — `curl`, decode the base64 image from the SSE response, write the bytes.

In Cowork the same `curl` call cannot reach the Figma desktop app at all: the sandbox's loopback is not the Mac's, `host.docker.internal` is blocked by the egress proxy, no tunneling service is reachable. Registering the Dev Mode MCP via the plugin's `.mcp.json` lets the agent _see_ Figma frames in Cowork via a native MCP tool, which is useful for inspection — but because MCP tool image responses tend to surface as visual attachments rather than as base64 the agent can hand to `Write`, the original use case of "PNG file in `documentation/images/`" still isn't reliably achievable in Cowork without the Control-Your-Mac escape hatch.

This shape — _works in terminal, partially works in Cowork via a hosted/registered MCP, doesn't fully solve the original use case in Cowork_ — is what we should expect for any skill whose deliverable is "raw bytes on disk, sourced from a local resource."

**Contrast — writing _to the canvas_ via the Figma *remote* MCP is Cowork-viable (correction, 2026-07).** The screenshot case above is hard in Cowork specifically because its deliverable is *bytes on disk*. A different class of Figma work — *authoring the file itself* (creating/scoping variables, renaming layers, wiring component properties or prototype reactions, building FigJam boards) — is **not** subject to the same limit. Those writes go through Figma's **remote** MCP server (`https://mcp.figma.com/mcp`, OAuth, no desktop app) via the `use_figma` / `create_new_file` tools, which per [Figma's tool matrix](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) are **remote-only** — the local `:3845` Dev Mode server doesn't even expose `use_figma`. A remote MCP connector reaches Figma over the agent's own transport, not the shell sandbox, so it isn't blocked by the egress allowlist. Net: the marketplace's Figma *authoring* skills (`ai-ready-design-system`, `ai-ready-screens`, `pdd-archetypes`, and the FigJam step of `pdd-discovery-workshop`) are viable in Cowork **when the Figma remote MCP connector is enabled** — the earlier assumption that all Figma manipulation needs the local Dev Mode bridge was wrong. Still pending our own live-session confirmation. The screenshot-to-PNG skill remains the genuine not-viable case, because *there* the deliverable is disk bytes, not a canvas mutation.

## What to watch for

Cowork is currently labeled a research preview, and both the sandbox model and the plugin surface are likely to evolve. Realistic things to keep an eye on:

A user- or org-level setting to allowlist additional hosts/ports, or an opt-in "trusted local session" mode that drops the sandbox. First-class support for stdio-launched MCP servers in Cowork (which would cover most local-tool cases without per-port allowlisting). Cowork picking up the rest of the Claude Code plugin component set — hooks, monitors, LSP — in some form, even if scoped down. Better tooling on the publishing side: a per-environment capability declaration in `plugin.json`, a portability linter, or a first-class compatibility matrix from Anthropic. Org-wide plugin marketplace installation in Cowork (the announcement explicitly flagged that "plugins are currently saved locally to your machine" with org sharing coming).

Until any of those land, the rule of thumb that's emerged is: **if a plugin's success depends on the agent being on the user's machine network, or on plugin components other than skills/commands/subagents/MCP, design it for the terminal app, ship the MCP registration so it degrades gracefully elsewhere, and label it accordingly. If the deliverable is purely "give the agent these tools," prefer a custom connector to a plugin.**

## References

- _Customize Cowork with plugins_ — Anthropic blog post: <https://claude.com/blog/cowork-plugins>
- _Use plugins in Claude Cowork_ — Help Center: <https://support.claude.com/en/articles/13837440-use-plugins-in-claude-cowork>
- _Create plugins_ (Claude Code) — full plugin spec: <https://code.claude.com/docs/en/plugins>
- _Get started with custom connectors using remote MCP_ — Help Center: <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
- `anthropics/knowledge-work-plugins` — the de-facto Cowork plugin shape: <https://github.com/anthropics/knowledge-work-plugins>
- `anthropics/financial-services` — fuller plugin surface including hooks, commands, agents: <https://github.com/anthropics/financial-services>
- _Use plugins in Claude Cowork_ — Help Center (confirms **hooks and sub-agents run only in Cowork**): <https://support.claude.com/en/articles/13837440-use-plugins-in-claude-cowork>
- _Get started with Claude Cowork_ — Help Center (folder-scoped file access; Global/folder instructions; no `~/.claude`): <https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork>
- _Expose configurable memory and CLAUDE.md paths in Cowork mode_ — claude-code issue #44098 (evidence Cowork doesn't read `~/.claude`): <https://github.com/anthropics/claude-code/issues/44098>
