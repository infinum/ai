# create-prd

Generate a Product Requirements Document (PRD) in Markdown. Use when the user asks to create a PRD, write product requirements, define a new feature, or mentions `/create-prd:create-prd`.

## Usage

```
/create-prd:create-prd
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill walks you through a guided flow:

1. **Describe the feature** — provide a brief description of what you want to build.
2. **Choose a save location** — specify a path or let the skill ask where to save.
3. **Answer clarifying questions** — the skill asks about goals, users, scope, edge cases, and acceptance criteria before writing anything.
4. **Review the PRD** — a structured document is generated covering overview, goals, user stories, functional requirements, non-goals, and success metrics.
5. **Iterate** — refine the PRD based on your feedback until it's ready.

The PRD is written for a junior developer audience — explicit, unambiguous, and free of unnecessary jargon.

## What is a PRD?

A PRD (Product Requirements Document), sometimes called an FRD (Feature Requirements Document), is a short, structured description of what we want to build and why. It captures the essentials in a way that's easy to review and hard to misinterpret.

In many cases, a well-refined task from your project management tool (Jira, Productive, Linear, or similar) already contains the information a PRD would capture — goals, acceptance criteria, constraints. If so, use that directly as your PRD base. When starting from scratch or filling gaps, use the `/create-prd:create-prd` skill to produce a structured document.

A typical PRD includes: a short overview of the problem and the goal, goals and non-goals (what's in and out of scope), user stories (who needs what, and why), functional requirements (what the system must do), acceptance criteria (how we know it's done), and key edge cases and constraints (including non-functional ones like performance or security).

The PRD is intentionally light on implementation details — it's about the "what" and "why", not the "how."

## When to use

| Situation | Use PRD? |
|---|---|
| Large / complex / ambiguous feature | Yes — full PRD |
| Smaller feature with clear scope | Optional — a clear description may be enough |
| Purely technical work (refactors, upgrades, migrations) | No — write a technical brief instead |
| Well-refined task with goals + acceptance criteria | Use that as your PRD base |
