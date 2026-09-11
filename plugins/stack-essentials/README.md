# stack-essentials

Baseline plumbing for the Infinum AI Stack. Installed automatically by `bin/install.js` (you don't need to opt in via the `/plugin` UI).

## What it does

Adds a `SessionStart` hook that compares the HEAD commit SHA of `main` on `github.com/infinum/ai` against the SHA recorded in `~/.claude/infinum/.manifest.json` at your last installer run. When they differ, a newer version of the workspace installer is available, so the hook prints a banner on stderr at session start:

```
[infinum/ai] A new version of the workspace installer is available; re-run to apply:
  pnpm dlx github:infinum/ai
```

Notifying you is all the hook does — re-running the installer is up to you (run it yourself, or have an agent run it non-interactively; see `bin/install.js --help` for the flags).

The check is cached for 24 hours in `~/.claude/infinum/.update-check.json`, so at most one `git ls-remote` per machine per day. If `git` isn't available or the request fails (offline, no credentials, GitHub down), the hook stays silent and advances the cache timestamp so it won't retry every session.

## Why it watches `main`, not `rules/`

Because `infinum/ai` is private, the hook uses `git ls-remote` (with your existing git credentials) rather than the GitHub commits API. That gives us the HEAD SHA of `main`, not specifically the latest commit touching `rules/` — so the banner can fire after a commit that didn't change any rules. That's deliberate, and why the banner just says "a new version is available" rather than claiming "rules changed". Re-running the installer when nothing rule-related moved is a fast no-op: `bin/install.js` correctly reports "no rule changes" and rewrites nothing.

## What data leaves your machine

One `git ls-remote https://github.com/infinum/ai refs/heads/main` per 24 hours, using whatever credentials your git is already configured with for this repo. Nothing is logged or sent anywhere else.

## Turning it off

Either:

- set `INFINUM_STACK_SKIP_UPDATE_CHECK=1` in your environment (the hook exits before doing anything else), or
- run `/plugin disable stack-essentials` in Claude Code.

## Why it lives in a plugin (and not just in the installer)

Plugins auto-update through the Claude Code marketplace. If we ever need to fix or improve the notification logic, the new script reaches users without them having to re-run the installer — which would be a catch-22 for a check whose whole purpose is to nag users into re-running the installer.
