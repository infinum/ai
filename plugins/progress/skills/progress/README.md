# progress

Save a local, disposable per-feature progress note at session end so the next session starts with full context. Files live under `~/.claude/progress/<project>/<feature-slug>.md` — never committed, deletable once the feature ships.

## Usage

```
/progress:progress
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill also triggers automatically when you say things like "wrap up", "update progress", "end of session", or signal you're stopping for the day. It can run proactively too — when a session is clearly concluding (final commit landed, feature verified, you say "great, that's done").

## What it does

1. **Resolves project + feature slug** — `<project>` is the basename of the repo root (or current directory if not in a repo). `<feature-slug>` is the current branch with `feature/` etc. stripped, or a descriptive name when on a generic branch.
2. **Picks the right file** — lists existing notes under `~/.claude/progress/<project>/` and either updates the one matching this work or asks which one to use. Creates a new file only when the session has an obvious feature focus.
3. **Applies the evidence rule** — every bullet must trace to something concrete from the session: a diff, a commit, a TODO seen in code, or the user's own words. No speculative "we should also..." lines.
4. **Updates three sections** (any can be dropped if empty):
   - `## Active` — what's in progress right now
   - `## Done` — verifiable, with file paths or commit hashes
   - `## Carry-overs` — real follow-ups, not best-practice noise
5. **Stays out of the repo** — the file lives under `~/.claude/`, never `git add`-ed, never pushed.

## When to use

| Situation | Use this skill? |
|---|---|
| End of a coding session, want next session to pick up cleanly | Yes |
| Final commit landed, feature verified, you're stopping | Yes — proactive trigger |
| Mid-session "where am I?" check | No — read the existing file directly instead |
| Need a status update for a stakeholder | No — this format is for self/agent handoff, not reporting |
| Feature shipped | Delete the file rather than updating it |

## Where notes are stored

`~/.claude/progress/<project>/<feature-slug>.md`

- One file per feature. Disposable.
- Lives outside any project repo — won't show up in `git status`.
- Safe to delete at any time; the skill will create a fresh one next session if needed.

## Environment compatibility

**Works with any agent that has a persistent local filesystem** — Claude Code, Cursor, GitHub Copilot, Gemini CLI, Codex, Firebender, and others — in either terminal or app form. The skill just needs `~/.claude/progress/` to stick around between sessions.

**Not viable in Cowork** (or any other ephemeral sandbox), because each session starts in a fresh VM and the previous run's progress file isn't there to read.
