---
name: cleanup
description: Clean up the local repo after a pull request merges — switch to the PR's base branch, pull, confirm the merge landed, then delete the merged local branch (and its git worktree, if one was used) and offer to remove the feature's progress note. Use whenever a PR has just merged and the user wants to clean up, tidy up, prune the merged branch or worktree, get back onto a fresh base branch, or "do the cleanup" — even if they don't spell out every step. Not Cowork-ready — needs the local `gh` CLI and a persistent local git checkout, and reads/prunes `~/.claude/progress/` outside the workspace mount.
argument-hint: [PR number or branch — defaults to the current branch]
---

# cleanup

Tidy up the local repo once a PR has landed: get back onto the base branch with the merge pulled in, then prune the branch (and worktree) you no longer need and the progress note that tracked the work.

Operate on the current branch unless `$ARGUMENTS` names a PR number or branch. This skill only ever **reads from and prunes the local repo** — checkout, pull, delete a local branch, remove a local worktree. It never pushes and never deletes anything on the remote.

Two invariants that don't bend:

- **Nothing gets deleted until the PR is confirmed merged *and* its changes are present on the base branch.** The whole point of cleanup is to prune work that's safely landed; deleting before both are verified risks throwing away unmerged commits. Branch and worktree removal is automatic *only after* both checks pass.
- **Always ask before deleting a progress note**, even though branch/worktree removal is automatic. Branches live in git's reflog and are recoverable; a deleted progress file is gone. It's also the one artifact that may track work beyond this single PR.

## Step 1 — Identify the PR and confirm it merged

Resolve the target (`$ARGUMENTS` if given, otherwise the current branch via `git rev-parse --abbrev-ref HEAD`), then:

```bash
gh pr view <branch-or-number> --json number,state,baseRefName,headRefName,mergedAt,mergeCommit
```

- If `state` isn't `MERGED`, stop and report. Cleanup is only for merged PRs — don't prune anything for an open or closed-but-unmerged PR.
- Record `baseRefName` (the branch to return to), `headRefName` (the branch to delete), and `mergeCommit.oid` (used to verify the merge in Step 4).

## Step 2 — Detect whether you're in a worktree

```bash
git rev-parse --git-dir --git-common-dir
```

If the two paths differ, you're in a **linked worktree** — `--git-dir` points at `.git/worktrees/<name>` while `--git-common-dir` points at the main `.git`. Note this worktree's path (`git rev-parse --show-toplevel`) and the main working tree's path (the first entry of `git worktree list`); you'll need both in Step 5. If the paths are equal, it's an ordinary branch in the main working tree.

## Step 3 — Move to the base branch and update it

First make sure nothing is uncommitted: if `git status --porcelain` is non-empty, stop and tell the user. Don't stash or discard on their behalf — that's their call, not the cleanup's.

- **Ordinary branch:** `git checkout <base>` then `git pull`.
- **Worktree:** the branch you're standing on is checked out *in this worktree*, so you can't switch it here. Move to the **main working tree** first (cd to its path from Step 2), then `git checkout <base>` and `git pull` there.

## Step 4 — Confirm the merge landed

Verify the PR's merge commit is now reachable from the base branch you just pulled:

```bash
git merge-base --is-ancestor <mergeCommit.oid> HEAD && echo "merge present"
```

If it reports present, the work is safely on base. If not, stop and report — something is out of sync (wrong base, pull failed, stale fork), and pruning now could lose commits. When the merge-commit check is inconclusive (e.g. very old history), confirm by spot-checking that a file or commit you expect from the PR is actually there.

## Step 5 — Remove the branch (and worktree)

The PR is merged and its changes are on base, so prune automatically — no extra prompt (branches are recoverable via reflog if something's off).

**Worktree case — remove the worktree first.** A branch checked out in a worktree can't be deleted while that worktree exists:

```bash
git worktree remove <worktree-path>
```

If this refuses because the worktree is dirty or locked, stop and report rather than reaching for `--force` — forcing it would discard whatever is uncommitted there, which contradicts the "don't throw away unmerged work" invariant.

**Then delete the branch (both cases):**

```bash
git branch -d <headRefName>
```

`-d` refuses with *"not fully merged"* when the PR was **squash- or rebase-merged**, because the branch's individual commits never literally appear on base — they were rewritten into a single commit. That's expected, not a problem: you already confirmed the merge in Step 4. Fall back to:

```bash
git branch -D <headRefName>
```

Mention which path was taken in the report, so the user knows whether it was an ordinary merge (`-d` succeeded) or a squash/rebase merge (needed `-D`).

## Step 6 — Offer to remove the progress note

Progress notes live at `~/.claude/progress/<project>/<feature-slug>.md`, where `<project>` is the basename of the repo root (`basename "$(git rev-parse --show-toplevel)"`). List that directory:

```bash
ls "$HOME/.claude/progress/$(basename "$(git rev-parse --show-toplevel)")/" 2>/dev/null
```

Read any note that looks related — its body referencing this branch, the PR number, or the feature. Then, before suggesting deletion, account for the fact that **one note may track several PRs or branches**. Skim it for references to other work and check whether that work is also done (`gh pr view` on the other PRs). Surface what you found and let the user decide:

- Everything the note tracks is merged/complete → recommend deleting it and ask for confirmation.
- It still tracks open work → say so and recommend keeping it.

On confirmation, delete the file and remove the project directory if it's now empty. Never delete a progress note without an explicit yes.

## Step 7 — Report

Summarize what changed: base branch checked out and pulled, branch deleted (note `-d` vs `-D`), worktree removed (if there was one), and the progress-note outcome (deleted / kept / none found).
