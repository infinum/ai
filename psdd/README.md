# Pragmatic Spec Driven Development (PSDD)

_Infinum's workflow for building with AI — from a quick fix to a full system._

**Pragmatic Spec Driven Development (PSDD)** is our baseline workflow for shipping features with AI — small or large. The model is the same regardless of scope: align early, plan explicitly, execute with confidence. What changes is the depth of each step — that's the _pragmatic_ part.

> **One-time setup:** if you'd rather have your agent walk you through getting the supporting skills in place, paste [`prompts/ai-engineering-setup.md`](../prompts/ai-engineering-setup.md) into your AI coding agent. It detects what you already have and offers to install whatever's missing for PRD generation, spec-driven development, local PR review, and UI validation.

---

## The PSDD 4-step model

| Step              | What happens                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| **1. Understand** | Capture requirements, constraints, edge cases, and acceptance criteria |
| **2. Design**     | Agree on technical approach and risks — no code changes yet            |
| **3. Plan**       | Convert the agreed solution into an ordered implementation plan        |
| **4. Build**      | Execute the plan and validate against the original intent              |

---

## Complexity dial — pick your lane

| Step           | Small / Low-risk                              | Purely technical                                            | Large / High-risk                                                                                                             |
| -------------- | --------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Understand** | Short prompt or a few bullet points           | Technical brief: goal, constraints, success checks, rollout | Full [PRD](#what-is-a-prd)/FRD — goals, constraints, acceptance criteria (or a well-refined task that covers the same ground) |
| **Design**     | Agree on approach in chat, keep it in context | Agree on approach in chat, keep it in context               | Written technical spec, reviewed by a fresh agent                                                                             |
| **Plan**       | Short ordered list of what changes where      | Short ordered list including rollback strategy              | Structured plan in Plan mode, reviewed before execution                                                                       |
| **Build**      | Run it, review, commit                        | Run it, validate parity, canary if needed                   | Agent execution in Build mode, step-by-step validation                                                                        |

> **Rule of thumb:** High complexity / ambiguity (especially user-facing) → full PRD. Smaller features → a clear description is enough. Purely technical work (refactors, upgrades, migrations) → skip the PRD, write a tight technical brief instead. If your task already has a well-written description with goals, constraints, and acceptance criteria from refinement — use that as your PRD base.

---

## Step 1 — Understand the feature

**Goal:** Remove uncertainty before anything else. Establish what "done" means in terms that are clear and testable.

The AI is useful here not just for generating output, but for stress-testing your thinking — surfacing edge cases, challenging assumptions, and tightening requirements before they cause problems downstream. The context you capture in this step directly determines how well the model performs in the next three.

**Model:** Use a top-tier model here (Claude Opus, Codex). Stronger reasoning uncovers better edge cases and refines requirements more reliably.

### A) Small features and changes

Use when the work is contained, the goal is clear, and the blast radius is small.

> **Shortest path:** Write a prompt that describes the feature — goal, expected behavior, and key edge cases. That prompt _is_ your Step 1 output. Use it directly as the opening message for Step 2 and start discussing the approach. No separate document or submission needed.

**What to do:**

1. Write a short description: what's the goal, what should happen, what should not happen, any key edge cases.
2. Use that description as your opening prompt for Step 2 — or, if you want to tighten requirements first, do a quick back-and-forth with the AI before moving on.

**Prompt examples:**

```
"We need a small feature: add a 'Save for later' option in the cart. Items marked 'saved'
should move to a separate list, stay across sessions, and be easy to move back to cart.
Edge cases: item goes out of stock, price changes, user not logged in.
Please ask missing questions, then propose a technical approach."
```

```
"Change: show an estimated delivery date on the checkout page based on shipping method
and destination. Don't block checkout if the estimate can't be calculated — show a
fallback. Consider caching and performance. Let's discuss the approach in Ask mode."
```

### B) Purely technical changes

Use for refactors, dependency upgrades, migrations, performance work — where the risk is technical correctness, not unclear requirements.

**What to do:** Write a tight technical brief covering goal, constraints, success checks, and rollout/rollback plan. A full PRD is usually unnecessary.

**Prompt example:**

```
"Technical change: migrate our background jobs from Celery to a managed queue service.
Goal: same behavior and reliability, improved observability.
Constraints: no user-facing changes.
Success = parity tests + canary rollout + easy rollback.
Let's talk through the safest approach."
```

### C) Large features

Use when the feature is complex, ambiguous, cross-cutting, risky, or involves many edge cases.

**What to do:**

1. Check your existing task first — if it already has a well-written description with goals, constraints, and acceptance criteria from refinement, use that as your PRD base. You don't need to create a separate document if the information is already there.
2. If you need to build a PRD from scratch (or fill gaps in an existing task), start with the best description you have and use the [PRD](#what-is-a-prd) skill to ask clarifying questions and produce a structured document.
3. Iterate until the PRD captures: goals and non-goals, functional requirements, acceptance criteria, edge cases, and relevant constraints.

**What a PRD includes:** a short problem/goal overview, goals and non-goals (scope), user stories, functional requirements, acceptance criteria, and key edge cases and constraints (including non-functional ones like performance or security). It is intentionally light on implementation details — the "what" and "why", not the "how."

**Prompt examples:**

```
"Let's create a PRD for this feature: Subscriptions / recurring deliveries.
Customers can subscribe to products (weekly/monthly), manage skips and cancellations,
and see upcoming shipments."
```

```
"Let's create a PRD for this feature: Loyalty and rewards program.
Customers earn points on purchases, unlock tiers with increasing benefits,
and redeem points at checkout. Needs rules for expiration, partial redemption,
and integration with promotions."
```

**Done when:** Requirements are clear, scoped, and testable.

---

## Step 2 — Design the solution

**Goal:** Agree on the technical direction before any code runs. This is the main control lever in the workflow.

Work in **Ask mode** (or explicitly tell the agent not to modify any files). Arrive with an initial idea of how the solution could be built, even if it's rough. Start by asking the model how it would approach the problem — frontier models are often strong at proposing solid designs and catching risks early. Compare, iterate, push back, but stay open to better ideas. The goal is not to "win" the discussion, but to arrive at the best possible approach.

**Model:** Use a top-tier model here (Claude Opus, Codex). This is where reasoning quality matters most.

**What to do:**

1. Ask: _"How would you build this?"_ — let the model propose a solution first.
2. Compare the proposed approach with your own idea. If something must be done a specific way (architecture, pattern, constraint), state it clearly. Otherwise, give the model room.
3. Iterate: refine the approach, challenge assumptions, correct when needed.

### Output of this step

Once the direction is clear, there are two paths depending on size and complexity:

**A) Lightweight (small features/changes):** Keep the agreed approach in chat and move directly to Step 3. The conversation itself carries the context.

**B) Structured (larger features):** Ask the agent to write a **technical specification** in markdown. This becomes a stable artifact describing how the feature should be built — detailed enough that anyone (including an AI agent) can implement it without ambiguity.

Create a spec when:

- the feature is large or spans multiple components
- the implementation won't fit in a single context window
- there are important architectural or consistency constraints
- you want to start fresh chats later without losing context

### Specification review loop (recommended for large features)

For complex work, run a review loop to harden the spec before moving on:

1. Start a **new chat** (important — avoids the model anchoring on its own earlier reasoning).
2. Ask the agent to review the specification (include the [PRD](#what-is-a-prd) if available).
3. Apply improvements to the spec.
4. Repeat until feedback becomes minor or trivial.

Starting fresh each time helps the model provide more objective feedback instead of reinforcing earlier assumptions.

**Prompt examples:**

```
"We're working on the feature described above. Don't make any code changes.
How would you approach building this? Consider our existing architecture and conventions.
Outline the main components, data flow, and edge cases."
```

```
"We're working on the feature described above. No code changes.
My initial idea is to implement this using [brief approach].
How would you approach it? Compare with this direction and suggest improvements or risks."
```

```
"We're working on this feature. No code changes.
Constraints: must use existing service layer, avoid DB schema changes, keep API backward
compatible. Propose an implementation approach and call out trade-offs and edge cases."
```

```
"Based on our discussion, write a technical specification in markdown and save it as
[filename]. Include enough detail so the feature can be implemented without ambiguity."
```

```
"Review this technical specification and identify gaps, unclear areas, risks, and
edge cases. Suggest concrete improvements."
← run this in a fresh chat
```

**Done when:** Approach is agreed, risks are addressed, and the direction is stable enough to plan from.

---

## ⚠ Watch out: context window degradation

One of the most common failure modes when working with AI on larger features. Every model has a finite context window — when it fills up, the agent starts losing earlier decisions, which leads to drift and inconsistencies.

**Signs the context is degrading:** the agent repeats questions, forgets earlier decisions, or produces output that contradicts the agreed approach.

**When to split across chats:**

- The conversation is getting long and quality is dropping.
- The plan has natural seams (backend vs. frontend, data layer vs. API layer) — split along those boundaries.
- A structured artifact exists (PRD, spec, plan) — starting fresh is low-cost when the artifact carries the context.

**What to carry into a new chat:**

- Current versions of key artifacts (PRD, tech spec, plan).
- A short status summary: what's done, what's in progress, any decisions or deviations made.
- Relevant code and error output if a specific problem triggered the new chat — but leave out unrelated history.

> **Rule of thumb:** if the feature can be planned and built in a single session without quality loss, stay in one chat. If the work spans multiple components or will take many iterations, plan for multiple sessions from the start and structure your artifacts accordingly.

---

## Step 3 — Plan

**Goal:** Turn the agreed direction into a concrete, ordered implementation plan that can be reviewed before any code runs.

AI systems perform significantly better when problems are decomposed into smaller, well-defined tasks. A clear plan reduces ambiguity, keeps the agent on track, and improves both quality and predictability during the build phase.

**Model:** Use a top-tier model here (Claude Opus, Codex). Better reasoning produces clearer plans and fewer surprises during execution.

**What to do:**

1. Switch to Plan mode in Cursor or Claude Code.
2. Provide the relevant context: for small features, stay in the same chat; for larger ones, provide the PRD and tech spec. Optionally, start a fresh chat to avoid anchoring or to ensure the upcoming build fits in the context window.
3. Let the agent generate the plan, then review it: check sequencing, missing pieces (migrations, edge cases, tests, rollout), and alignment with the agreed approach.
4. Adjust anything that looks off before approving.

**Output:** A reviewed and approved plan that is specific enough to execute without improvisation.

**Prompt examples:**

```
"Generate an implementation plan based on our discussion.
Break it into clear, ordered steps with checkpoints."
```

```
"Using the attached PRD and technical specification, generate an implementation plan.
Include sequencing, affected areas, and validation steps."
```

```
"Update the plan to include migration steps and rollback strategy.
Also add tests for edge cases we discussed."
```

```
"Create a plan for this feature based on the attached PRD and spec.
Keep the plan detailed enough for execution."
← useful when starting a fresh chat for the build phase
```

**Done when:** You've reviewed the plan and are confident in the shape of the implementation.

---

## Step 4 — Build

**Goal:** Execute the plan and validate the output against the original intent.

**Model:** Switch to a cost-efficient coding model (Claude Sonnet, Codex). The build step is execution-heavy and generates a lot of tokens. Models like Codex are typically faster for iterative coding tasks, while Sonnet provides a good balance between quality and cost. Top-tier models (Opus) are usually unnecessary here since the main reasoning already happened in Steps 1–3.

### Execute

Switch to Build / Agent mode. Approve the plan and let the agent work through it autonomously. You may be asked to approve permissions for certain actions (running tests, builds, generating migrations, applying formatting, etc.). If the agent stalls or goes off-plan, stop and redirect it back to the specific step it should be executing.

> In Cursor, clicking the Build button will execute the plan. Check which model is selected for Build before clicking.

### Review

The agent may produce a lot of code — it's rarely practical to scrutinize every line. Focus review on business-critical paths and places where behavior is implemented (core services, domain logic, state transitions, API contracts). Skim supporting code (wiring, boilerplate, DTOs, UI glue) unless it looks suspicious. Check for alignment with the plan: the right changes, in the right places, without extra scope.

### Iterate

If something needs adjusting — design, quality, naming, edge cases — tell the agent what to change. The agent has full context from the problem, approach, plan, and current implementation, so refinements are usually fast and targeted without needing to re-explain decisions.

### Run and test

Run the project and test the feature. If you hit bugs, exceptions, or failing tests, paste the relevant output or logs back to the agent and ask it to fix them. Repeat until the behavior matches the original intent and acceptance criteria from Step 1.

> **Note on codebase patterns:** agents repeat patterns already present in the codebase. This is an advantage when patterns are healthy — and a problem when they aren't. Consistently messy build results are usually a signal to improve conventions or add the right rules/skills.

**Prompt examples:**

```
"Refactor the implementation of [component] to follow [pattern/convention].
Keep behavior the same and update tests if needed."
```

```
"Here's the failing test output / exception stack trace: …
Please identify the root cause and fix it. Add regression coverage if appropriate."
```

**Done when:** Output is tested and validated against the acceptance criteria defined in Step 1.

---

## What is a PRD?

A PRD (Product Requirements Document), sometimes called an FRD (Feature Requirements Document), is a short, structured description of what we want to build and why. It captures the essentials in a way that's easy to review and hard to misinterpret.

In many cases, a well-refined task from your project management tool (Jira, Productive, Linear, or similar) already contains the information a PRD would capture — goals, acceptance criteria, constraints. If so, use that directly as your PRD base. When starting from scratch or filling gaps, use the PRD skill to produce a structured document.

A typical PRD includes: a short overview of the problem and the goal, goals and non-goals (what's in and out of scope), user stories (who needs what, and why), functional requirements (what the system must do), acceptance criteria (how we know it's done), and key edge cases and constraints (including non-functional ones like performance or security).

The PRD is intentionally light on implementation details — it's about the "what" and "why", not the "how."

---

## Glossary

| Term                | Meaning                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PSDD**            | Pragmatic Spec Driven Development — Infinum's workflow for building with AI, described in this document. _Pragmatic_ because the depth of each step scales to the work.                                                   |
| **PRD / FRD**       | Product Requirements Doc / Feature Requirements Doc. Captures goals, constraints, user stories, and acceptance criteria before design or code begins. Can be generated from scratch or based on an existing refined task. |
| **Technical brief** | A lightweight alternative to a PRD for purely technical work. Covers goal, constraints, success checks, and rollout/rollback plan.                                                                                        |
| **Ask mode**        | A mode in Cursor / Claude Code where the AI explores ideas without making code changes. Used in Steps 1 and 2.                                                                                                            |
| **Plan mode**       | Generates a structured implementation plan from your context. No code runs — you review and approve first.                                                                                                                |
| **Build mode**      | Also called Agent mode. The AI executes the approved plan step by step, making actual code changes.                                                                                                                       |
| **Agent**           | The AI model acting autonomously across multiple steps — reading files, writing code, running commands — guided by the plan and context.                                                                                  |
| **Fresh agent**     | A new chat with no prior context. Useful for a second-opinion review of a spec — it catches assumptions the first conversation missed.                                                                                    |
| **Context window**  | The maximum amount of text a model can "see" at once. When it fills up, earlier context is lost and quality degrades.                                                                                                     |
