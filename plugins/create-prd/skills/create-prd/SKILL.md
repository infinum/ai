---
name: create-prd
description: Generate a Product Requirements Document (PRD) in Markdown. Use when the user asks to create a PRD, write product requirements, define a new feature, or mentions /create-prd. Cowork-ready.
---

# Create PRD

Generate a clear, actionable PRD suitable for a junior developer to understand and implement.

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Receive initial prompt
- [ ] Step 2: Determine save location
- [ ] Step 3: Ask clarifying questions
- [ ] Step 4: Generate PRD
- [ ] Step 5: Iterate based on feedback
```

### Step 1: Receive Initial Prompt

The user provides a brief description of a new feature or functionality.

### Step 2: Determine Save Location

If the user's prompt includes a path (e.g., "save in Docs/Voting/"), use that. Otherwise, ask where to save the PRD within the `Docs/` directory.

**Filename:** `prd-[feature-name].md`

### Step 3: Ask Clarifying Questions

**Before writing the PRD**, ask clarifying questions to understand the "what" and "why" — not the "how." Adapt questions to the prompt, drawing from these areas:

- **Problem/Goal:** What problem does this solve? What is the main goal?
- **Target User:** Who is the primary user?
- **Core Functionality:** What key actions should a user be able to perform?
- **User Stories:** e.g., "As a [user], I want to [action] so that [benefit]."
- **Acceptance Criteria:** How will we know it's successfully implemented?
- **Scope/Boundaries:** What should this feature *not* do?
- **Data Requirements:** What data does it display or manipulate?
- **Design/UI:** Any mockups or UI guidelines?
- **Edge Cases:** Potential edge cases or error conditions?

### Step 4: Generate PRD

Based on the prompt and answers, generate a PRD with these sections:

1. **Introduction/Overview** — Feature description, problem it solves, goal.
2. **Goals** — Specific, measurable objectives.
3. **User Stories** — Narratives describing usage and benefits.
4. **Functional Requirements** — Numbered list of required functionalities. Use clear, concise language.
5. **Non-Goals (Out of Scope)** — What the feature will *not* include.
6. **Design Considerations** *(optional)* — Mockups, UI/UX requirements.
7. **Constraints & Dependencies** *(optional)* — Business or operational constraints (e.g., regulatory, performance expectations, platform support). Do not include architecture decisions or technology choices.
8. **Success Metrics** — How success will be measured.
9. **Open Questions** — Remaining questions or areas needing clarification.

**Target audience:** junior developer. Requirements must be explicit, unambiguous, and avoid unnecessary jargon.

### Step 5: Iterate

Present the PRD to the user. Incorporate feedback and refine.

## Important

- Do **NOT** start implementing the feature after creating the PRD.
- Always ask clarifying questions before writing.
- Iterate on the PRD based on user feedback.
- Keep the PRD focused on business requirements, user intent, and desired outcomes. Do not include implementation details, architecture decisions, or technology choices — those belong in a technical design document, not the PRD.
