---
name: progress
description: Update a local, disposable progress file for the feature/task you're working on, so the next session starts with full context. Files live at `~/.claude/progress/<project>/<feature-slug>.md` — local on disk, never committed, deletable once the feature ships. Use when the user says "wrap up", "update progress", "end of session", "/progress", or signals they're stopping. Also use proactively when a session is clearly concluding — final commit landed, feature verified, user says "great, that's done." Not Cowork-ready — needs a persistent local filesystem for cross-session continuity; Cowork's ephemeral sandbox doesn't preserve it.
---

# progress

A short discipline check for keeping a local, disposable progress note honest at the end of a working session. The file exists so next-session-you (or next-session-Claude) can recover the mental state of the work in 15 seconds — what feature, what's active, what's done, what's deferred.

## Where the file lives

`~/.claude/progress/<project>/<feature-slug>.md`

- `<project>` = basename of `git rev-parse --show-toplevel`, or basename of `pwd` if not in a repo.
- `<feature-slug>` = short kebab-case name. Prefer the current branch (`git branch --show-current`) with prefixes stripped (`feature/login-redesign` → `login-redesign`). If there's no branch or it's generic (`main`, `dev`), pick something descriptive of the actual work.
- One file per feature. Disposable — delete it once the feature ships.
- Never written into the project repo. Never staged, committed, or pushed.

Create `~/.claude/progress/<project>/` if it doesn't exist.

## Pick the right file

Always `ls ~/.claude/progress/<project>/` first — don't guess what's there.

- **One file** → use it.
- **Multiple files** → list them to the user and ask which one. Don't pick based on filename similarity.
- **None** → if the session has an obvious feature focus, create one. If not, ask the user for a feature name first.

## The evidence rule

Everything you write must trace to something concrete from this session: the developer's words, a git diff, a commit message, test output, a TODO you saw in the code. **No bullet, no carry-over, no scope sentence from general best-practice speculation.**

If you're tempted to write "we should probably also..." and can't quote the source, delete the line. Examples of what gets cut:

- "Consider adding tests for the new flow" (unless the user said so or you saw a missing test).
- "Refactor the navigation layer" (unless the diff or conversation surfaced it).
- "Polish empty states" (vague, no evidence).

A short honest update beats a padded one. These files exist to be trusted next session, not to look thorough.

## Shape

Three sections, all optional. **Drop a section entirely if it's empty** — don't leave dangling headings.

```markdown
# <feature-slug>

_Updated: <today's date> · branch: <current branch>_

## Active
- <what's in progress right now>

## Done
- <verifiable: files touched, behavior changed, tests added>

## Carry-overs
- <real follow-ups surfaced this session>
```

Use today's date from your system context (it's in your environment, don't guess). If the existing file uses a different shape, keep its conventions instead of forcing this one.

### Worked example

```markdown
# login-redesign

_Updated: 2026-05-26 · branch: feature/login-redesign_

## Active
- OAuth provider wiring — Apple sign-in stub compiles, callback URL still TODO in `AuthCoordinator.swift:142`

## Done
- New `LoginView` with email + password fields, validation states, and "forgot password" link (commit `a3f1c2e`)
- Fixed avatar upload crash on retry — `ProfileUploader.swift` now guards against nil session token

## Carry-overs
- User said: dark-mode pass on the new login screen, after OAuth lands
- `TODO: animate keyboard avoidance` left in `LoginView.swift:88`
```

Notice: every bullet points at a file, commit, or quoted user line. No "we should also...".

## Steps

1. Resolve project + slug. `ls ~/.claude/progress/<project>/` to see what's already there.
2. Read the existing file if one applies.
3. Update the metadata line — today's date, current branch (or omit the branch part if not in a repo).
4. Move finished items from Active → Done as one-liners. Add new bullets only when you can point at the diff, commit, message, or quoted user words that produced them.
5. Capture real carry-overs only — TODOs you hit in the code, user-said "do later", scope postponed because out of branch.
6. Drop any section that ended up empty rather than leaving an empty heading.
7. Save the file. Don't `git add` / `commit` / `push` — the progress file lives outside the repo, and repo changes need their own explicit approval.

If the session produced no material progress, a date + branch sync is a valid full update. Say so in your reply and offer to do a richer pass if the user shares what landed — don't invent bullets to fill space.
