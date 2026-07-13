---
name: pdd-project-brief
description: >
  Use this skill to create a concise project brief that summarizes a project so far — what the
  client does, the project itself, stakeholders, goals and definition of done, out-of-scope,
  why now, users and their goals, differentiators, competitors/inspiration, sharp corners, and
  key discovery learnings. It pulls from whatever context exists (brief, RFP, stakeholder and
  user interviews, discovery workshop, competitive analysis) and flags anything unknown as a
  question for the client rather than inventing it. Triggers whenever a user wants to: summarize
  a project, write or update a project brief, capture where a project stands, onboard someone to
  a project, or consolidate discovery so far. Also trigger when the user says "project brief",
  "project summary", "brief", "summarize the project", "where are we on this project", or
  "catch me up on [project]" — even if they don't call it a skill. Output is the brief in the
  conversation plus a Markdown file. Cowork-ready.
---

# PDD Project Brief

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and ways of working. This skill's deliverable is a plain-Markdown brief (a working summary), so the generic Infinum *document* branding (fonts/colours/logo) does not apply — if the user later wants a branded one-pager, offer to produce a .docx version.

Produces a clear, honest snapshot of where a project stands. This is **DISCOVER**-phase
synthesis: it consolidates what's been learned so the team shares one source of truth, and it
feeds downstream PDD work (Central Design Challenge, Strategic Approach, Discovery Readout).

The single most important rule: **distinguish what's known from what isn't.** Anything not
established by the project materials is flagged as a question for the client — **never invented
or guessed** (*Simplicity Takes Work* — check the facts; don't guess). A confident-sounding brief
built on assumptions is worse than an honest one with open questions.

---

## Phase 0 — Gather inputs & gauge discovery status

Scan the conversation and any shared materials first: brief/RFP, SOW, stakeholder interviews,
user interviews, discovery workshop output, archetypes, competitive analysis, notes. Use what's
there before asking. If little is available, ask the user what exists and where (or to paste
it), then proceed with what you have.

Then judge **where discovery stands**, because it sets how sections are marked:
- **Discovery complete** — write full sections from the evidence.
- **Discovery in progress** — write what's known; mark the rest *In progress (preliminary)*.
- **Discovery not started / unknown** — mark affected sections *Coming soon — pending discovery*
  and list what needs to be learned.

If the user hasn't said, infer status from the materials and state your assumption.

---

## Phase 1 — Write the brief

Cover these eleven sections, in order:

1. **What the client does** — the organisation, market, what they offer.
2. **The project** — a plain-language summary of what's being built and the engagement.
3. **Key stakeholders & roles** — who's involved on the client side (and decision-makers).
4. **Main goals / definition of "done"** — the outcomes that mean success; how we'll know it's done.
5. **What is NOT in scope** — explicit exclusions and boundaries.
6. **Why now** — the trigger, timing, or pressure behind the project.
7. **Users & their goals** — who the product serves and what they're trying to achieve.
8. **Differentiators** — what makes the product distinct / its edge.
9. **Competitors / inspiration** — comparable or aspirational products.
10. **Sharp corners** — known risks, constraints, sensitivities, or tricky areas to watch.
11. **Key learnings from discovery** — the most important things learned so far (cite the source
    activity, e.g. "from stakeholder interviews" / "from the discovery workshop").

### Marking conventions (use consistently, plain text — no emoji)
- **Known** → state it plainly. Where useful, attribute it (which doc/activity it came from).
- **Unknown / missing** → write: **`To confirm with client:`** followed by the specific
  question(s) to ask. Do not fill the gap with a plausible-sounding guess.
- **Assumed (not yet verified)** → label it **`Assumption (to validate):`** so it's not mistaken
  for fact.
- **Pending discovery** → tag the section heading *(In progress — preliminary)* or
  *(Coming soon — pending discovery)* and add any preliminary notes beneath.

Keep it concise — a brief, not a report. Short paragraphs or tight bullets per section.

---

## Phase 2 — Output

Deliver the brief **in the conversation** and write it to
`/mnt/user-data/outputs/project_brief_[project].md` with this shape:

```markdown
# Project Brief: [Project Name]
_Status: Discovery complete / in progress / not started — as of [date]_

## What the client does
...
## The project
...
## Key stakeholders & roles
...
## Goals & definition of done
...
## Out of scope
...
## Why now
...
## Users & their goals
...
## Differentiators
...
## Competitors / inspiration
...
## Sharp corners
...
## Key learnings from discovery
...

## Open questions for the client
- [Consolidated list of every "To confirm with client" item above]
```

End with a consolidated **Open questions for the client** list (pull together every unknown you
flagged) so the team has a ready-made follow-up checklist.

Present the file with `present_files` and include this **starting-point note** (per the plugin's
output policy):

> **A note on this brief:** This summarizes the project as captured in the materials available
> so far. Items marked *To confirm with client* are genuine gaps — get them answered rather than
> assuming. Sections marked *in progress* will firm up as discovery continues. Review and correct
> anything before sharing it as the team's source of truth. Per *Keep It Human*, this is a shared
> starting point to review and refine **together with the team** — not a finished brief.

Then offer next steps: produce a **branded .docx** one-pager, fold the open questions into a
stakeholder interview guide, or update the brief once discovery wraps.

---

## Behavior rules
- **Never fabricate.** No invented goals, users, stakeholders, competitors, or "learnings."
- **Separate fact, assumption, and unknown** clearly using the marking conventions.
- **Attribute learnings** to their discovery source so they can be traced and trusted.
- **Be concise.** This is a brief; resist turning it into a report.
- **Flag, don't fill.** Every gap becomes a client question, surfaced in the open-questions list.

## Quality checklist
- [ ] All eleven sections present (marked *in progress* / *coming soon* where discovery isn't done).
- [ ] Every unknown is flagged as a client question, not guessed.
- [ ] Assumptions are labelled as assumptions, not stated as fact.
- [ ] Discovery learnings are attributed to their source activity.
- [ ] A consolidated "Open questions for the client" list is included.
- [ ] The Markdown file was written and the starting-point note included.
