# AI-assisted PR labeling

Add the `ai-assisted` label to any pull request opened against an Infinum GitHub organisation repository where AI was involved in producing any part of the change — code generated, suggested, or modified. This applies to all contribution types: production code, tests, refactors, config, scripts, and snippets.

How to apply the label:

- When creating the PR with `gh`: pass `--label ai-assisted` to `gh pr create`.
- After the PR is open: `gh pr edit <number> --add-label ai-assisted`.

Why: Infinum tracks AI involvement across the engineering org to understand where and how AI tooling is being used.
