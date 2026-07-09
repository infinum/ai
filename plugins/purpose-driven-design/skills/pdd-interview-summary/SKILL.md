---
name: pdd-interview-summary
description: >
  Use this skill to build a Participant Summary spreadsheet from user-interview data — a
  reference table with one row per participant mapped across key dimensions (Audience Type,
  Goals, Habits, Frustrations, Needs, and any custom columns). It's a useful synthesis step
  before identifying archetypes or running a rainbow analysis. Triggers whenever a user wants
  to: summarize interview participants, build a participant summary/grid/matrix, map
  participants across dimensions, or create a per-participant reference table from transcripts
  or notes. Also trigger when the user says "participant summary", "participant grid", "summarize
  the participants", or "map participants across goals/frustrations/needs" — even if they don't
  call it a skill. Output is an `.xlsx` spreadsheet. Cowork-ready.
---

# PDD Interview Summary

> **Before you start:** Read `${CLAUDE_SKILL_DIR}/../../instructions.md` and follow its PDD persona and ways of working. The deliverable here is a working data spreadsheet — keep it clean and scannable; apply Infinum styling lightly (Helvetica/Arial, a `#D8262D` or `#E4EBF5` header fill) but don't over-format.

Builds a **Participant Summary** — a one-row-per-participant `.xlsx` that maps everyone across
the key interview dimensions. It's the synthesis reference the team uses *before* clustering
into archetypes or running a rainbow analysis. This is PDD **DISCOVER**-phase synthesis: capture
only what the data shows, never invent participant detail (*Simplicity Takes Work*).

---

## Phase 0 — Gather inputs & confirm columns

Confirm you have interview data (transcripts, CSV summaries, or notes). Then confirm the columns
before building — ask once:

> "I'll build a Participant Summary with one row per participant. The standard columns are:
> **Participant Name, Audience Type, Goals, Habits, Frustrations, Needs.** Want me to add or
> drop any columns before I build it?"

Record any changes. If the data is missing or thin, say so and ask for it rather than guessing.

### Standard columns
- Participant Name
- Audience Type
- Goals
- Habits
- Frustrations
- Needs
- [Any additional columns the user requested]

---

## Phase 1 — Build the spreadsheet

Read the `xlsx` skill instructions first (`/mnt/skills/public/xlsx/SKILL.md`), then build the file.

Rules for the content:
- **One row per participant; one column per dimension.**
- Cells are concise (2–4 sentences max) — capture the key insight, not raw transcript quotes.
- Use consistent, scannable phrasing across rows so columns can be compared at a glance.
- Where a participant didn't address a topic, write **"Not discussed"** (don't infer).
- Ground every cell in the actual data — no invented goals, frustrations, or needs.
- Header row: bold, with a light Infinum fill (`#E4EBF5`) or `#D8262D` with white text; freeze
  the header row and the Participant Name column so the grid stays readable as it grows.
- Save to `/mnt/user-data/outputs/participant_summary.xlsx`.

---

## Phase 2 — Present & confirm

Present the file with `present_files` and ask:

> "Here's the participant summary — **[N] participants** across **[N] dimensions**. Does anything
> look off, or should I adjust any columns or wording?"

Include this **starting-point note** (per the plugin's output policy):

> **A note on this summary:** This reflects only what the interviews actually surfaced — cells
> marked *Not discussed* are genuine gaps, not assumptions. Review it against your own read of
> the sessions before using it to synthesize archetypes or themes. Per *Keep It Human*, treat it
> as a shared starting point to review and build on **together with the team** — not a finished artifact.

Then offer the natural next steps: identify **archetypes** (`pdd-archetypes`) or run a
**rainbow analysis** (`pdd-rainbow-analysis`) from this summary.

---

## Quality checklist
- [ ] One row per participant; columns match what the user approved.
- [ ] Every cell is grounded in the data; untouched topics are marked "Not discussed".
- [ ] Cells are concise and consistently phrased across rows.
- [ ] Header row styled and frozen; Participant Name column frozen.
- [ ] The user confirmed the columns before the file was built.
- [ ] The starting-point note is included with the delivered file.
