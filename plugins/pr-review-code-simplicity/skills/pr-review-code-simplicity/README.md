# pr-review-code-simplicity

Review pull requests through the lens of the six laws of software design from "Code Simplicity" by Max Kanat-Alexander. A structured review tool that catches decisions likely to cost the team maintenance effort over time — not a style nitpicker.

## Usage

```
/pr-review-code-simplicity:pr-review-code-simplicity
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

Invoke when you are:

- Reviewing a PR, diff, or merge request
- Self-reviewing your own change before opening a PR
- Evaluating staged or uncommitted changes
- Giving structured feedback on code quality, maintainability, or design in the context of proposed changes

## The six laws applied

| # | Law | What it asks |
|---|---|---|
| 1 | Purpose of software | Does this change help users? |
| 2 | Equation of software design | Is ongoing maintenance cost considered? |
| 3 | Law of change | Is the code ready for a future we cannot predict? (YAGNI, no speculative genericness, easy to change) |
| 4 | Law of defect probability | Is the change small enough? Should it be split? (DRY, don't fix what isn't broken) |
| 5 | Law of simplicity | Are individual pieces simple, consistent, readable? |
| 6 | Law of testing | Is the new/changed behavior tested accurately? |

## Output format

```
## Summary
[1–3 sentences: what does this PR do, does it serve users]

## Findings

### [Law name]: [short description]
[Finding, why it matters, suggested alternative]

## Verdict
[Approve / Request changes / Comment]
```

Only laws with actual findings appear in the review. A clean PR may have only a summary and a verdict.

## Severity guidance

- **Blocking** — maintenance pain that compounds, unnecessary complexity, untested behavior. Request changes.
- **Worth discussing** — works, but a simpler/more maintainable alternative exists. Leave a comment.
- **Minor** — style/naming nits. Mention only if there's a pattern.

When in doubt: *will this matter in six months?* If yes, raise it.

## When to use

| Situation | Use skill? |
|---|---|
| Reviewing a teammate's PR | Yes |
| Self-reviewing before opening a PR | Yes |
| Evaluating a big refactor for maintainability concerns | Yes |
| Dedicated security review | No — use a security-focused skill |
| Pure formatting/style review | No — linters and formatters are the right tool |

## Not a replacement for

- Automated linters, formatters, or type checkers — those handle style mechanically.
- Dedicated security or performance review — use skills focused on those concerns.
- Human judgment on product/UX/design decisions — those require domain context this skill does not carry.
