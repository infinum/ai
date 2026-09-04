# Agent instructions for `infinum/__REPO_NAME__`

This repository is an **extension marketplace** for the Infinum AI stack. It holds the __OWNER_LABEL__'s plugins and rule bundles and is layered on top of the public [infinum/ai](https://github.com/infinum/ai) base by the shared installer (`--extend infinum/__REPO_NAME__`). It contains only data — plugins, rules, and `.claude-plugin/marketplace.json`. Never add a copy of the installer, `bin/` scripts, or `pnpm` setup here; those live in `infinum/ai`.

Rules that apply to every change, by humans and agents alike:

- **Bump the plugin version on every change.** Edit `version` in `plugins/<plugin>/.claude-plugin/plugin.json` using semver — patch for fixes, minor for additions, major for breaking changes. Claude Code only picks up plugin updates when the version changes.
- **Keep names unique across sources.** The marketplace name stays `__MARKETPLACE_NAME__` (never `infinum-ai`). Prefix plugin, rule bundle, and rule file names with `__NAME_PREFIX__-` so they cannot collide with `infinum/ai` or another extension — all rules land in one shared `~/.claude/infinum/` directory.
- **No secrets, no client data.** Credentials, tokens, client documents, and personal data never go in this repository.
- **General things go upstream.** A skill or rule that any Infinum engineer could use belongs in `infinum/ai` — open a PR there instead of adding it here.

Repository layout and install instructions are in [README.md](README.md). Plugin structure, cross-platform MCP, and runtime dependencies follow the [infinum/ai contributing guide](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md).
