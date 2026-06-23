# mobile-deploy

Trigger a non-interactive mobile app deployment by wrapping the `app-deploy trigger` CLI. The skill resolves which environments to deploy to, assembles a changelog, runs pre-flight checks, and confirms before deploying.

## Usage

```
/mobile-deploy:mobile-deploy [targets and/or changelog, or nothing for interactive mode]
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

Examples:

- `/mobile-deploy:mobile-deploy` — fully interactive: pick targets and changelog via prompts.
- `/mobile-deploy:mobile-deploy all changelog: Fix login crash` — deploy to all targets with the given changelog.

## What it does

1. **Verifies setup** — checks `.deploy-options.sh` exists in the working directory; otherwise stops and tells you to run from the repo root.
2. **Resolves targets** — parses the environments from `.deploy-options.sh` and matches your arguments (indices, names, or `all`), or asks interactively.
3. **Resolves the changelog** — uses text you pass, lets you enter one manually, or auto-generates a summary from git commits since the last `ci/` tag.
4. **Pre-flight** — ensures `HEAD` is on a remote branch, offering to push if not.
5. **Confirms and deploys** — shows targets + changelog, honors a `deploy.skip-confirm` git config, then runs `app-deploy trigger`.
6. **Reports** — lists what was deployed, or surfaces the full error on failure.

## When to use

| Situation | Use this skill? |
|---|---|
| Triggering a build/deploy from a mobile project wired with `app-deploy` | Yes |
| The project has a `.deploy-options.sh` at its root | Yes |
| A non-mobile project, or one without the `app-deploy` CLI installed | No |
| Inside Cowork or any sandbox without the local `app-deploy` binary | No — see below |

## Environment compatibility

**Requires the local `app-deploy` CLI** and runs git against the project working tree. Works in any agent with access to those (Claude Code terminal, etc.). Not viable in Cowork — the sandbox image has neither the `app-deploy` binary nor the project's local environment.
