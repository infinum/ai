---
name: pdd-schedule
description: >
  Use this skill to build a project schedule (a dated Gantt) that matches the ETR/Infinum
  Project Schedule tab. It takes any project information — deliverables, phases, and existing
  timelines from the SOW — and lays out phases and tasks across a week/day calendar, with each
  phase a different colour and heading, and milestones for delivery dates and client-feedback
  due dates. It always previews the schedule in chat for adjustments before building the
  spreadsheet. Triggers whenever a user wants to: create a project schedule or timeline, lay
  out a Gantt chart, schedule deliverables and milestones, or turn an SOW timeline into a
  schedule. Also trigger when the user says "schedule", "timeline", "project schedule", "gantt",
  or "lay out the phases" — even if they don't call it a skill. Output is an `.xlsx`. Cowork-ready.
---

# PDD Schedule

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and ways of working. The output reproduces the ETR/Infinum **Project Schedule** tab exactly (it's built by copying the bundled template), so its fonts and colours are already on-brand — don't re-apply the generic document styling.

Builds a **Project Schedule** — a dated Gantt of phases, tasks and milestones — in the exact
style of the ETR/Infinum Project Schedule tab. It's built from the bundled template
(`assets/schedule-template.xlsx`), so the week/day header, fonts and grid match. Read
`references/schedule-structure.md` for the layout, colours, and config shape.

Needs **openpyxl** (`pip install openpyxl --break-system-packages`). Runs locally; nothing is
written to any connected drive.

---

## Phase 0 — Gather project information

Scan the conversation and any project materials first — **SOW, deliverables list, existing
timeline, the estimate's phases, kickoff/start date, holidays, dependencies**. To build a
schedule you need:

| Item | Why it matters |
|---|---|
| **Start date** | Anchors the calendar (use the kickoff; a Monday lines weeks up cleanly). |
| **Phases** | The colour-coded sections (e.g. Discovery, UX, Visual Design, Development). |
| **Deliverables & tasks** | The rows under each phase, with durations or dates. |
| **SOW timeline / dates** | Any fixed dates, durations, or milestones already committed. |
| **Review cadence** | How long client feedback windows are (to place feedback-due milestones). |

Use what's there; ask for what's missing (at minimum the start date and the deliverables/phases).
**Don't invent committed dates** — derive them from the SOW/estimate, or ask (*Simplicity Takes Work*).

---

## Phase 1 — Draft the schedule

Lay the work out as **phases → tasks**, sequenced from the start date:

- Give **each phase its own colour and heading** (Discovery, UX, Visual Design, Development, …).
- For **every deliverable**, include the work task plus two milestones: the **delivery date**
  and the matching **client-feedback-due date** (mark both `milestone: true`). Reviews and
  approvals are easy to forget — make them explicit.
- Account for dependencies, holidays, and realistic durations.

---

## Phase 2 — Preview in chat and confirm (required)

**Always show the schedule in the conversation before building the spreadsheet.** Present it as
a compact table grouped by phase, e.g.:

| Phase | # | Task / Milestone | Start | End | Milestone |
|---|---|---|---|---|---|
| Discovery | 1.0 | Discovery kickoff | 7/8 | 7/8 | ◆ |
| Discovery | 1.1 | Stakeholder interviews | 7/9 | 7/20 | |
| Discovery | 1.2 | Discovery readout (delivery) | 7/24 | 7/24 | ◆ |
| Discovery | 1.3 | Client feedback due | 7/29 | 7/29 | ◆ |

Note the overall duration and end date. Then ask:

> Here's the draft schedule. Want to adjust anything — dates, durations, phase breakdown, or
> the delivery/feedback milestones — before I build the spreadsheet?

Wait for approval or edits. Revise and re-show if needed. Only build once the user confirms.

---

## Phase 3 — Build the spreadsheet

1. Ensure openpyxl: `pip install openpyxl --break-system-packages -q`
2. Write the approved plan to `config.json` (`title`, `start`, `phases` with tasks; set
   `milestone: true` on delivery and feedback-due dates — see `references/schedule-structure.md`).
3. Run the build script (uses the bundled template automatically):
   ```bash
   python3 "<this skill dir>/scripts/build_schedule.py" --config config.json --output "Project Schedule - [Project].xlsx"
   ```
   It keeps only the Project Schedule sheet, regenerates the week/day/date header from the start
   date, writes the colour-coded phases, tasks and milestones, and shades each task's Gantt bar.

---

## Phase 4 — Deliver

Present the `.xlsx` with `present_files` and include this **starting-point note**:

> **A note on this schedule:** These dates are a working plan based on the SOW and what you
> shared — confirm them against the team's capacity and the client's review turnaround before
> committing. Milestones (deliveries and feedback-due dates) are best-effort; adjust as the
> timeline firms up. Per *Keep It Human*, this is a shared starting point to review and refine
> **together with the team** — not a finished, committed schedule.

Then offer to adjust dates/phases or regenerate after changes.

---

## Quality checklist
- [ ] Dates come from the SOW/estimate or the user — none invented.
- [ ] Each phase has a heading and a distinct colour.
- [ ] Every deliverable has a delivery milestone **and** a client-feedback-due milestone.
- [ ] The draft was previewed in chat and approved before the spreadsheet was built.
- [ ] Gantt bars line up with each task's date range; the file opens cleanly.

## Fallback
If the bundled template is missing, ask the user for the Project Schedule template (a local
`.xlsx`) and pass it with `--template`. Install openpyxl if it isn't available.

## Files in this skill
| Path | Purpose |
|---|---|
| `SKILL.md` | This workflow |
| `assets/schedule-template.xlsx` | Bundled template (exact Project Schedule styling) |
| `scripts/build_schedule.py` | Keeps the schedule sheet, regenerates the Gantt from config |
| `references/schedule-structure.md` | Layout, colours, milestone convention, config shape |
