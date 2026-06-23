---
name: pr-review-code-simplicity
description: Review pull requests using the laws and rules from "Code Simplicity" by Max Kanat-Alexander. Use this skill whenever reviewing a PR, doing a code review, evaluating a diff, checking a merge request, or when someone asks you to review code changes. Also use when someone asks for feedback on code quality, maintainability, or design decisions in the context of changes being proposed. This skill applies the six laws of software design as a structured review lens. Cowork-ready.
---

# PR Review Skill: Code Simplicity

Review pull requests through the lens of six laws and their supporting rules from the science of software design. The goal is not to nitpick style — it is to catch decisions that will cost the team maintenance effort over time.

## How to use this skill

When reviewing a PR (diff, merge request, or set of code changes), work through the checklist below. Not every item will apply to every PR. Skip what is irrelevant. Flag what matters.

Structure your review as:

1. A short summary of what the PR does and whether it aligns with helping users.
2. Findings grouped by law, only for laws where you found something worth raising.
3. A verdict: approve, request changes, or comment.

Keep the tone constructive. The purpose is to help the author ship better code, not to demonstrate cleverness.

---

## Review checklist

### 1. Purpose of software: does this help people?

The purpose of software is to help people. Every change should trace back to helping users.

Ask:
- Does this change help users? Can you articulate how?
- If this is an internal refactor, does it make the system easier to maintain so it can continue helping users?
- Are there features included that don't serve any user need?
- Does this change violate or drift from the stated purpose of the software?

Flag: changes that add complexity without a clear connection to user value.

### 2. Equation of Software Design: is maintenance cost considered?

The desirability of a change equals its value divided by its effort. Over time, effort of maintenance dominates effort of implementation. Reducing maintenance effort is more important than reducing implementation effort.

Ask:
- Will this code be easy for another developer to understand and modify six months from now?
- Does this change reduce or increase the ongoing maintenance burden?
- Is the author optimizing for speed of writing at the expense of long-term maintainability?
- Are there hidden maintenance costs (e.g., new dependencies, manual processes, data migrations)?

Flag: code that is quick to write but will be expensive to maintain. Prefer the opposite: code that takes a bit more thought now but approaches zero maintenance cost over time.

### 3. Law of Change: is this code ready for a future we cannot predict?

The longer a program exists, the more probable it is that any piece of it will have to change. You cannot predict what will change, only that things will change.

Apply these sub-rules:

**Don't write code you don't need yet (YAGNI)**
- Is there code in this PR that nothing currently uses?
- Are there features or abstractions built for a hypothetical future scenario?
- Is there dead code that should be removed?

**Don't make assumptions about the future**
- Is the design locked into a specific technology, format, or workflow that might change?
- Is the code designed around what is known now, or around a prediction?

**Don't be too generic (overengineering)**
- Are there abstractions that serve no current use case?
- Is the code more generic than the current requirements demand?
- Does the genericness make the code harder to understand without a corresponding benefit?

**Do make the code easy to change**
- Could another developer modify this code without rewriting large parts of it?
- Are the pieces small and self-contained?
- Is the design rigid — would a small requirements change force a large code change?

The ideal: maximum change in the environment, minimum change in the software.

### 4. Law of Defect Probability: is this change small enough?

The chance of introducing a defect is proportional to the size of the change.

Ask:
- Is this PR doing too many things at once? Should it be split?
- Are there unrelated changes bundled in (refactors mixed with features, formatting mixed with logic)?
- Could any part of this be a separate, smaller PR?

Also apply the related rules:
- **Don't fix what isn't broken.** Is the author "fixing" something without evidence of a problem? Premature optimization is a common case.
- **DRY (Don't Repeat Yourself).** Is information duplicated? Are there copy-pasted blocks that should be extracted into shared code?

### 5. Law of Simplicity: are the individual pieces simple?

The ease of maintenance is proportional to the simplicity of individual pieces. Not the whole system — the pieces.

Ask:
- Can you understand each function, class, or module on its own?
- If something is complex, is the complexity in the problem or in the solution? If it is in the solution, it can be simplified.
- When you encounter complexity, ask: "What problem is this trying to solve?" If the answer is unclear, the design needs work.

Apply sub-rules:

**Consistency**
- Does this code follow the conventions of the existing codebase?
- Are naming patterns, spacing, structure consistent with the rest of the project?
- If the author introduces a new pattern, is it justified?

**Readability**
- Is the code spaced and structured so you can see the design by reading it?
- Are names long enough to communicate meaning but short enough to read easily?
- Do comments explain *why*, not *what*? If a comment explains what the code does, the code should be made clearer instead.

**Simplicity requires design**
- Does this code show evidence of intentional design, or does it look like it evolved by accident?
- Is there a clear structure, or is it one long block of undifferentiated logic?

If complexity is unavoidable (e.g., wrapping a complex external system), is it hidden behind a simple interface?

### 6. Law of Testing: is this tested?

The degree to which you know how software behaves is the degree to which you have accurately tested it. Unless you have tried it, you do not know that it works.

Ask:
- Are there tests for the new or changed behavior?
- Do the tests ask precise questions and expect specific answers?
- If existing code was changed, were the related tests updated?
- Are the tests accurate — do they actually verify the intended behavior, or do they just check that the code runs without crashing?

Flag: any behavioral change without a corresponding test.

---

## Output format

Structure your review like this:

```
## Summary
[1-3 sentences: what does this PR do and does it serve the purpose of helping users]

## Findings

### 1. [Law name]: [short description of the issue]
[Explain what you found, why it matters, and what you suggest]

### 2. [Law name]: [short description of the issue]
[...]

## Verdict
[Approve / Request changes / Comment]
[1-2 sentences explaining the overall assessment]
```

Only include law sections where you have a finding. A clean PR might only have a summary and a verdict.

Number every finding sequentially (1, 2, 3, …). The number is part of the heading.

Keep findings concrete. Reference specific files, functions, or lines when possible. Suggest alternatives, don't just point out problems.

---

## Severity guidance

Not all findings are equal. Use your judgment:

- **Blocking**: the change will cause maintenance pain that compounds over time, introduces unnecessary complexity, or ships untested behavior. Request changes.
- **Worth discussing**: the code works but there is a simpler or more maintainable approach. Leave as a comment for the author to consider.
- **Minor**: style or naming nits that don't affect maintainability. Mention only if there is a pattern of inconsistency, not for isolated cases.

When in doubt, ask yourself: "Will this matter in six months?" If yes, raise it. If not, let it go.
