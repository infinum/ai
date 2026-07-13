---
name: pdd-discovery-workshop
description: >
  Use this skill to plan a discovery workshop for a client project. Reads the project
  information (goals, scope, stakeholders, time available) and recommends a plan — a warm-up
  plus 1–2 longer exercises (sessions are usually 1–2 hours) from the Infinum/ETR activity
  library, sequenced to fit the time. Triggers whenever a user wants to: plan or design a
  discovery workshop, build a workshop agenda or run-of-show, choose workshop activities,
  prepare a kick-off / alignment / ideation session with a client, or set up a FigJam
  facilitation board. Also trigger when the user says "discovery workshop", "workshop plan",
  "workshop agenda", "kickoff workshop", "facilitation board", "which exercises should we run",
  or "plan a session with the client" — even if they don't call it a skill. Output is a
  formatted .docx run-of-show plus a FigJam board scaffold (one section per activity).
---

# PDD Discovery Workshop Planner

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

This skill plans a discovery workshop — the session run at the **start** of a project with the
client to capture project goals, scope, and stakeholder insight. Our sessions are usually
**1–2 hours**, so the default plan is one warm-up + **1–2** longer exercises (not a packed
half-day). It reads the project context, recommends a plan, and on approval produces two outputs:

1. A **run-of-show** `.docx` — the facilitation agenda with timings, purposes, and notes.
2. A **FigJam board scaffold** — an empty, sectioned board ready to facilitate on.

This is the PDD **DISCOVER** phase. Orient the plan around alignment and evidence: a workshop
exists to *discover* real value with the client, not to confirm assumptions (*Context Before Commitment*).

**Reference files (read as needed):**
- `references/activity-library.md` — the full activity menu with times, purposes, and selection notes.
- `references/workshop-patterns.md` — how to map goals → activities, sequence, budget time, and ready-made templates.
- `references/figjam-scaffold.md` — how to build the FigJam facilitation board.
- `references/example-workshop.md` — an anonymized example workshop board, captured as a
  structural exemplar to model board shape and flow.

---

## Phase 0 — Gather project context

First scan the conversation for project background already shared (brief, SOW, prior PDD
work, stakeholder notes). Use what's there before asking.

To plan a good workshop you need:

| Item | Why it matters |
|------|----------------|
| **Project name & type** | Header, framing, and which activities fit (website / app / platform / rebrand…). |
| **Primary goals for the workshop** | The single biggest driver of activity selection. What must the team walk away knowing or deciding? |
| **Where the project is** | Brand-new vs. mid-flight changes which DISCOVER activities make sense. |
| **Who's in the room** | Number of participants, roles, seniority mix (affects warm-up + silent vs. open formats). |
| **Total time available** | Usually 1–2 hrs. Determines number of longer exercises (60 min = 1; 90 min = 1–2; 2 hrs = 2). |
| **Remote or in-person** | Affects pacing and whether a FigJam board is the primary surface. |

If key items are missing, **ask all at once** (don't interrogate one at a time):

> Before I plan the workshop, a few quick things:
> 1. **What's the project?** Name + what you're building (and for whom).
> 2. **What do you most need to get out of this workshop?** e.g. align on goals, understand
>    users, prioritise scope, generate design ideas, de-risk the build.
> 3. **How much time do you have, and is it remote or in person?**
> 4. **Who's in the room?** Rough number and roles.

If the user gives goals but leaves something ambiguous that materially changes the plan
(e.g. time, or whether personas already exist), ask that one targeted follow-up rather than
guessing. Otherwise proceed — you have process knowledge; defer to the user on their context.

---

## Phase 1 — Recommend the plan

Using `workshop-patterns.md` and `activity-library.md`:

1. **Map goals → activity groups** (Step A in patterns). Identify the 1–2 groups that serve
   the stated goals.
2. **Choose the warm-up** — one, matched to the session (Extra, Extra! primes vision sessions;
   Two Truths / Either-Or teach board mechanics).
3. **Choose 1–2 longer exercises** (1 for a 60-min session; 2 for ~2 hrs; 3 only for a rare
   half/full day). Each must map to a stated goal; avoid redundant pairs (e.g. Elevator Pitch
   *and* Press Release). With little time, prefer doing one exercise well over cramming two.
4. **Sequence** them: warm-up first, diverge before converge, Context → Users → Design,
   optional retro last (Step B).
5. **Budget the time** (Step C) — sum activity midpoints + intro + transitions + breaks +
   buffer + wrap-up, and confirm it fits. Adjust if it overflows/underflows.
6. You **may suggest an activity outside the library** when no listed activity serves a goal —
   name it, timebox it, and explain the gap it fills (see the bottom of `activity-library.md`).

**Present the proposed agenda to the user before building anything** (this skill never skips
the check-in — per the plugin's "check in before proceeding"). Show it as a compact table:

| # | Activity | Time | Why it's here (goal it serves) |
|---|----------|------|--------------------------------|

Include the running total vs. available time, and 1–2 sentences on the overall logic of the
flow. Offer **one alternative** for any swappable slot ("for prioritisation I went with
Value-Effort Matrix; Buy a Feature is an option if you want more negotiation"). Then ask:

> Does this shape look right? I can swap any activity, change the depth, or re-balance the
> timing before I build the run-of-show and the FigJam board.

Wait for approval or edits before Phase 2.

---

## Phase 2 — Generate the run-of-show (.docx)

Once approved, read the docx skill instructions first (`/mnt/skills/public/docx/SKILL.md`),
then build the document. Save to `/mnt/user-data/outputs/discovery_workshop_plan.docx`.

**Branding — use the Infinum brand (see the plugin's "Brand & Document Styling" rules):**
Helvetica Neue throughout (bold headlines), black `#000000` body text, Infinum red `#D8262D`
as the accent (title rule, activity-number labels, section dividers), and `#E4EBF5` for table
header fills or the "Agenda at a glance" block. Keep it white-dominant and clean. Place the
Infinum logo small in the **top-right** of the title block — embed `assets/logo-color.png`
from this plugin's directory at ~120–160px wide (preserve its ~7:1 aspect ratio). If the logo or font can't be resolved in the
run, fall back gracefully and tell the user what was substituted.

**Structure:**
1. **Title block** — "Discovery Workshop — [Project]", date, total duration, format
   (remote/in-person), participant list/roles.
2. **Workshop goals** — 2–4 bullet goals this session is designed to achieve.
3. **Agenda at a glance** — the table from Phase 1 (activity, time, start–end clock times).
4. **Run-of-show** — one section per activity, in order. For each:
   - Activity name, timebox, and (warm-up / longer) tag.
   - **Purpose** — from the library, tailored to this project.
   - **How to run it** — 3–6 facilitation steps.
   - **Materials / board section** — what's needed; which FigJam section it maps to.
   - **Output** — what the team should leave the activity with.
5. **Facilitation notes** — roles (facilitator, note-taker, timekeeper), break plan,
   remote tips if relevant, and a parking-lot reminder.
6. **After the workshop** — suggested synthesis next steps (e.g. affinity mapping, archetypes,
   discovery readout) — name relevant PDD tools/skills.

Then validate:
```bash
python3 /mnt/skills/public/docx/scripts/office/validate.py \
  /mnt/user-data/outputs/discovery_workshop_plan.docx
```
**Fallback:** if generation fails, write the same content to
`/mnt/user-data/outputs/discovery_workshop_plan.md`.

---

## Phase 3 — Generate the FigJam board scaffold

**Checkpoint — confirm before generating the FigJam file.** Do not create the board without
an explicit go-ahead. First, re-present the workshop plan so the user can see exactly what
the board will be built from: show the finalized agenda (activity, time, order, and the goal
each serves) plus the running total vs. available time. Then ask:

> Here's the plan the FigJam board will be built from. Want me to change anything — swap an
> activity, adjust the timing, add or drop an exercise — or should I go ahead and generate
> the FigJam file?

If the user requests changes, revise the plan and re-present it; only proceed once they
confirm they want the file generated. (This gate applies even if the plan was already
approved earlier for the .docx — always reconfirm immediately before building the board.)

Once confirmed, read `references/figjam-scaffold.md`, then build the board.

1. Ask where to create it:
   > Where should I create the FigJam board? I can place it in one of your Figma teams —
   > let me know which, or share a project URL.
   Use `Figma:whoami` to list teams if needed.
2. Create a board named **"Discovery Workshop — [Project]"** via `Figma:create_new_file`
   (`editorType: "figjam"`), then build it with `Figma:use_figma` (read the `/figma-use`
   skill first if available).
3. Build the board left-to-right: an **onboarding zone first** (title card, Agenda, Figma
   basics, keyboard shortcuts), then **one section per agenda item** in run order, each
   pre-loaded with the activity's working structure (templates in `figjam-scaffold.md`).
   Add the colour legend, a Parking Lot section, and — when the workshop should feed
   straight into insights — a synthesis tail (Opportunity Statements → Themes → How Might We),
   as modelled in `example-workshop.md`.
4. **Seed structure only — never participant content.** No invented stickies, votes, quotes,
   or data (*Simplicity Takes Work*). The board must read as empty-and-ready.

**Fallback:** if Figma tools aren't connected, produce the scaffold as a markdown spec
(`/mnt/user-data/outputs/figjam_board_scaffold.md`) listing each section and its structure so
the facilitator can build it by hand — and tell the user the Figma connector would let you
build it directly.

---

## Phase 4 — Deliver & review

Present the file(s) with `present_files` and include this **starting-point warning verbatim**
(per the plugin's output policy):

> **A note on this plan:** This workshop plan and board are a starting point, not a finished
> deliverable. The activity choices and timings are recommendations based on the goals you
> shared — review them against your read of the room, the client relationship, and how the
> conversation is likely to go. Expect to swap activities, adjust timings, and refine the
> prompts. Workshops always run long, so protect your highest-value exercise. Everything is
> editable. Per *Keep It Human*, treat this as a shared starting point to review and refine
> **together with the team** — not a finished plan.

Then ask:

> Want me to adjust anything — swap an activity, change the timing, add or drop an exercise,
> or tailor the prompts for a specific activity? I can also build the stakeholder or user
> interview guides for the discovery phase if that's useful.

---

## Quality checklist

Before presenting, verify:
- [ ] Exactly **one** warm-up, placed first.
- [ ] **1–2** longer exercises for a typical 1–2 hr session (1 at 60 min; 3 only for a rare half/full day); each maps to a stated goal.
- [ ] No redundant pairs; diverge-before-converge and Context→Users→Design ordering respected.
- [ ] Time math reconciles with overhead (intro, transitions, breaks, buffer, wrap-up).
- [ ] Any off-list activity is flagged with the gap it fills.
- [ ] No fabricated content anywhere — the board and plan seed structure and prompts only.
- [ ] The agenda was shown to the user and approved before files were built.
- [ ] The plan was re-presented and the user explicitly confirmed before the FigJam file was generated.
- [ ] The starting-point warning is included with the delivered files.

---

## Files in this skill

| Path | Purpose |
|------|---------|
| `SKILL.md` | This file — workflow instructions |
| `references/activity-library.md` | The full discovery-activity menu with times, purposes, selection notes |
| `references/workshop-patterns.md` | Goal→activity mapping, sequencing, time budgeting, ready-made templates |
| `references/figjam-scaffold.md` | FigJam facilitation-board structure and Figma API notes |
| `references/example-workshop.md` | Anonymized example workshop board (structural exemplar) |
