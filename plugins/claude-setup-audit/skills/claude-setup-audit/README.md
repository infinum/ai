# claude-setup-audit

Audit your Claude Code installation for vulnerabilities, malicious code, prompt injection, supply-chain risks, and configuration issues across all extensibility points.

## Usage

```
/claude-setup-audit:claude-setup-audit
```

Optionally pass a focus area to narrow the scope:

```
/claude-setup-audit:claude-setup-audit hooks
/claude-setup-audit:claude-setup-audit mcp
/claude-setup-audit:claude-setup-audit skills
/claude-setup-audit:claude-setup-audit commands
```

If no argument is provided, the skill audits everything. (Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

## What it checks

| Area | What's examined |
|---|---|
| **MCP Servers** | Every `.mcp.json` in plugin cache and project-level configs |
| **Hooks** | All hook scripts referenced in user-level (`~/.claude/settings.json`, `~/.claude/settings.local.json`) and project-level (`.claude/settings.json`, `.claude/settings.local.json`) settings files |
| **Commands** | Every `.md` file in user-level (`~/.claude/commands/`), project-level (`.claude/commands/`), and plugin-provided command directories |
| **Skills** | Every `SKILL.md` plus accompanying scripts (`.js`, `.ts`, `.sh`, `.py`) and `package.json` in user-level (`~/.claude/skills/`), project-level (`.claude/skills/`), and plugin-provided skill directories |
| **Plugins** | Every `plugin.json` in the plugin cache |
| **Permissions** | Allow lists in user-level (`~/.claude/settings.json`, `~/.claude/settings.local.json`) and project-level (`.claude/settings.json`, `.claude/settings.local.json`) settings files |
| **Marketplaces** | Non-official sources in `extraKnownMarketplaces` from user-level and project-level settings files |
| **CLAUDE.md files** | User, project, and dotfile-level CLAUDE.md for injected instructions |
| **Memory files** | All project memory directories for cross-session influence |

## Threat categories

- **T1: Prompt Injection** — hidden instructions in skills, CLAUDE.md, or memory files
- **T2: Data Exfiltration** — hooks or MCP servers sending data to unexpected endpoints
- **T3: Supply Chain Risk** — unpinned versions, `pnpm dlx`, third-party marketplaces, `npm audit` vulnerabilities, malicious lifecycle scripts
- **T4: Excessive Permissions** — overly broad allow rules, stale permissions
- **T5: Code Execution Risk** — hooks spawning child processes, remote code execution
- **T6: Credential Exposure** — hardcoded tokens, logged environment variables
- **T7: Persistence & Stealth** — self-replicating hooks, obfuscated code, background processes

## Output

A structured report with:

- **Summary** — total items checked, findings by severity (CRITICAL / WARNING / INFO / OK)
- **Per-category breakdown** — specific file paths and line numbers
- **Actionable recommendations** — for each WARNING or CRITICAL finding
- **Clean bill of health** — for items that passed

## When to use

- After installing new plugins or MCP servers
- After adding third-party marketplaces
- Periodically as a hygiene check
- When onboarding to a new project with existing Claude configuration
