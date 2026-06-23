# cleanup

Tidy up the local repo once a pull request has merged: get back onto the base branch with the merge pulled in, then prune the branch (and worktree) you no longer need and the progress note that tracked the work. Local-only — it reads from and prunes the local repo, and never pushes or deletes anything on the remote.

This is the natural follow-on to the `progress` skill in the same plugin: `progress` keeps the per-feature note while you work, and `cleanup` offers to remove that note once the PR lands.

## Usage

```
/progress:cleanup [PR number or branch]
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The argument is optional — it defaults to the current branch. The skill also triggers automatically when you say things like "clean up", "tidy up", "prune the merged branch", "get back onto main", or "do the cleanup" after a PR has landed.

## What it does

1. **Confirms the PR merged** — resolves the target (argument or current branch) and checks `gh pr view`; stops if the PR isn't `MERGED`. Records the base branch, head branch, and merge commit.
2. **Detects a worktree** — compares `--git-dir` and `--git-common-dir` to tell an ordinary branch from a linked worktree, so the right path is taken later.
3. **Returns to the base branch** — refuses to proceed on uncommitted changes, then checks out the base branch and pulls (from the main working tree when in a worktree).
4. **Verifies the merge landed** — confirms the PR's merge commit is reachable from the freshly pulled base before deleting anything. Nothing is pruned until this passes.
5. **Prunes the branch (and worktree)** — removes the worktree first when present, then deletes the branch (`-d`, falling back to `-D` for squash/rebase merges). Reports which path was taken.
6. **Offers to remove the progress note** — finds the matching note under `~/.claude/progress/<project>/`, checks whether it tracks other still-open work, and asks before deleting. Branch/worktree removal is automatic; progress-note deletion always requires an explicit yes.

## When to use

| Situation | Use this skill? |
|---|---|
| A PR just merged and you want back on a fresh base branch | Yes |
| You used a worktree for the feature and want it pruned too | Yes |
| "Do the cleanup" / "tidy up the merged branch" | Yes — natural-language trigger |
| The PR is still open or was closed without merging | No — it stops; nothing is pruned for unmerged work |
| You want to delete a branch on the remote | No — this skill is local-only and never touches the remote |

## Safety invariants

- **Nothing is deleted until the PR is confirmed merged *and* its changes are present on the base branch.** Both checks must pass before any branch or worktree is removed.
- **Always asks before deleting a progress note.** Branches are recoverable via git's reflog; a deleted progress file is not, and one note may track work beyond this single PR.
- **Never pushes and never deletes on the remote.** Every operation is a local checkout, pull, branch delete, or worktree removal.

## Environment compatibility

**Works with any agent that has a persistent local checkout** of the repo plus the `git` and `gh` CLIs — Claude Code, Cursor, and similar — in terminal or app form. It relies on the local working tree, local branches/worktrees, and (optionally) progress notes under `~/.claude/progress/`.

**Not viable in Cowork** (or any other ephemeral sandbox), because there's no persistent local repo to clean up, the `gh` CLI and git remote credentials aren't present, and the `~/.claude/progress/` notes it offers to prune don't survive between sessions.
