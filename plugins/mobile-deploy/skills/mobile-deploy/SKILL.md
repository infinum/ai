---
name: mobile-deploy
description: Deploy the app to selected targets (e.g. staging, UAT, production, store) by wrapping the `app-deploy trigger` CLI — resolves environments from `.deploy-options.sh`, assembles a changelog, and confirms before deploying. Use when the user wants to deploy, release, or ship a build, trigger a CI deploy, or mentions `app-deploy` or `.deploy-options.sh`. Not Cowork-ready — requires the local `app-deploy` CLI and runs git against the project working tree.
argument-hint: [targets and/or changelog, or nothing for interactive mode]
model: haiku
---

Wrap `app-deploy trigger` for non-interactive deployment. Run all operations in the current working directory. Use `AskUserQuestion` for environment selection and confirmations.

## Step 1 — Verify setup

Check the `app-deploy` CLI is installed (`command -v app-deploy`). If missing, tell the user to install it and stop.

Check `.deploy-options.sh` exists. If missing, tell the user to run `/mobile-deploy:mobile-deploy` from the repository root and stop.

## Step 2 — Extract environments

Read `.deploy-options.sh` and parse the `deploy_options` function:

- The `environments=(...)` array (may span multiple lines) holds the internal IDs, in index order.
- The `echo "[N] Display Name"` lines hold the display names; `N` matches the array index.

Combine into a table: `index  internal-id  Display Name`.

## Step 3 — Resolve targets

From `$ARGUMENTS`, extract targets if present (numbers, names, or `all`). Match names case-insensitively against display names and internal IDs; partial matches are allowed. If ambiguous, use `AskUserQuestion` to clarify. If no targets provided, use `AskUserQuestion` with `multiSelect: true` (labels: `[N] Display Name`). Require at least one selection.

## Step 4 — Resolve changelog

If `$ARGUMENTS` contains text after a `changelog:` or `message:` marker, use that.

Otherwise, use `AskUserQuestion`: *"How do you want to provide the changelog?"*
- **Enter manually** — ask via plain text reply; re-ask if empty
- **Auto-generate from git** — summarize commits since the last `ci/` tag:
  ```bash
  git log $(git describe --match 'ci/*' --abbrev=0 --tags 2>/dev/null)..HEAD --oneline
  ```
  Summarize into 1–2 short lines, preferring ticket/branch names. Show to the user for approval; let them edit if needed.

## Step 5 — Pre-flight: ensure HEAD is on remote

```bash
git branch -r --contains HEAD
```

If empty, use `AskUserQuestion`: *"HEAD is not on any remote branch. Push now?"* (Yes / No).
- Yes: run `branch_name=$(git symbolic-ref --short -q HEAD)`. If empty, HEAD is detached — tell the user to check out a branch and stop. Otherwise `git push origin "$branch_name"`; if it fails, show the error and stop.
- No: stop.

## Step 6 — Confirm and deploy

Show targets and changelog.

Check skip-confirm preference:
```bash
git config --local deploy.skip-confirm
```

If it returns `true`, skip the prompt and proceed directly to deploy.

Otherwise, use `AskUserQuestion`: *"Deploy to these targets with this changelog?"*
- **Yes**
- **Yes, and don't ask again** — run `git config --local deploy.skip-confirm true` before deploying
- **No** — stop

Then deploy:
```bash
CHANGELOG=$(cat <<'CHANGELOG_EOF'
<changelog text>
CHANGELOG_EOF
)
yes | app-deploy trigger -t "<space-separated indices>" -m "$CHANGELOG"
```

The single-quoted heredoc prevents shell expansion. The `yes |` handles the final confirmation inside `app-deploy`.

## Step 7 — Report

- **Success**: list deployed targets and changelog used.
- **Failure**: show full `app-deploy` error output.
