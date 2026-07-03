---
name: pdd-archetypes
description: >
  Use this skill to create Purpose-Driven Design (PDD) Archetype documents from user interview data.
  Trigger whenever a user wants to: synthesize interview data into archetypes or personas, generate archetype documents with goals/frustrations/needs/habits/quotes/demographics, or analyze user research to identify audience segments. Also trigger when the user says "archetypes", "PDD archetypes", "persona documents", or "synthesize interviews into archetypes" — even if they don't call it a skill. (To build a participant summary spreadsheet, use the pdd-interview-summary skill.) Cowork-ready with the Figma remote MCP connector enabled — it builds the FigJam board via `create_new_file` + `use_figma`, both remote-server (write-to-canvas) tools reached over the agent's MCP transport rather than the local Dev Mode bridge; pending live verification.
---

# PDD Archetypes Skill

> **Before you start:** Read `${CLAUDE_SKILL_DIR}/../../instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

This skill transforms raw user interview data into polished Purpose-Driven Design (PDD) Archetype documents — **Archetype cards on a FigJam board**. It works best from a synthesized **Participant Summary**; if you don't have one, build it first with the `pdd-interview-summary` skill.

> **Cowork:** the FigJam board is created via `create_new_file` + `use_figma`, which
> are **remote** Figma MCP tools — so in Cowork this needs the Figma remote MCP
> connector enabled; the local Dev Mode desktop server doesn't expose them.

---

## Phase 0: Gather Inputs

Before starting, confirm you have:
- Interview data (transcripts, CSV summaries, or notes)
- Any existing archetype ideas from the user

### Step 0a: Check for existing archetype ideas

**This step is mandatory. Do not proceed to any other phase until the user has responded.**

Ask the user:
> "Do you have any existing ideas for what the archetypes might be — broad audience segments, roles, or patterns you've already noticed? Or would you like help identifying them from the data?"

Wait for the user's response before continuing. Then:
- **User has ideas** → record them explicitly as named hypotheses; confirm back with the user ("Got it — I'll treat these as hypotheses and validate/adjust them against the data: [list them]"); then proceed to Phase 1
- **User wants help** → acknowledge and proceed to data analysis in Phase 1 to identify patterns from scratch

### Step 0b: Participant summary — optional

A Participant Summary spreadsheet (one row per participant across key dimensions) is a useful
reference before synthesizing. If the user wants one and doesn't already have it, build it with
the **`pdd-interview-summary`** skill, then use it as the input to Phase 2. If they'd
rather skip it, go straight to Phase 2 and synthesize from the raw interview data.

---

## Phase 1: Participant Summary (optional)

If a participant summary is wanted, produce it with the **`pdd-interview-summary`** skill
— it maps every participant across Audience Type, Goals, Habits, Frustrations, Needs (plus any
custom columns) and saves an `.xlsx`. Use that spreadsheet as the analysis input for Phase 2.
Skip this phase if the user prefers to synthesize directly from the raw data.

---

## Phase 2: Identify Archetypes

Analyze the participant summary (or the raw interview data, if you skipped Phase 1) to identify 3–6 archetypes. Each archetype = a meaningful audience segment defined by shared goals, contexts, behaviors, and needs — not just demographics.

### How to identify archetypes
Look for clusters across:
- **Audience type** (seeking for self vs. child; professional role; life stage)
- **Primary motivation** (what triggered their search)
- **Biggest barriers** (cost, access, fit, time)
- **Decision-making style** (browser vs. matcher; researcher vs. pragmatist)
- **Emotional posture** (empowered, frustrated, desperate, analytical)

### Naming archetypes
Give each archetype a short, evocative name that captures their essence — not just a job title. Examples from the vet med domain: *Vet Med Student*, *Small Animal Vet*, *Practice Manager*.

Present the proposed archetypes to the user with a 1–2 sentence rationale for each. Ask for approval or adjustments before generating documents.

### Step 2b: Establish Mindset scale labels

**This step is mandatory. Do not proceed to Phase 3 until the user has approved the labels.**

Based on the interview data and domain, propose 4 mindset dimensions that will appear as bar chart labels on every archetype card. These labels must be the same across all archetypes — only the bar fill values will vary.

Present your proposed labels to the user, for example:
> "Here are the 4 Mindset dimensions I'd suggest for this project — these will appear on every archetype card:
> 1. Urgency of need
> 2. Price sensitivity
> 3. Trust in institutions
> 4. Tech comfort
>
> Do these feel right, or would you like to swap any out?"

Wait for the user's response. Incorporate any changes, then confirm the final 4 labels before moving on. Store these as the canonical label set for Phase 3.

### Step 2c: Get FigJam destination

Ask the user:
> "Where should I create the FigJam board? I can create it in any of your Figma teams — just let me know which one, or share a project URL if you'd like it placed in a specific folder."

Use `Figma:whoami` to list available teams if needed. Once the user confirms, use `Figma:create_new_file` with `editorType: "figjam"` to create a new board named **"PDD Archetypes — [Project Name]"** in the specified team. Note the returned `file_key` for use in Phase 3.

---

## Phase 3: Archetype FigJam Board

For each approved archetype, build one card on the FigJam board using the Figma Plugin API via `Figma:use_figma`. All archetype cards go on a **single FigJam board**, laid out side by side with a 100px gap between them.

### Card layout (per archetype)

Each card is a `frame` — 1400 × 900px, white background, 16px corner radius.

**Header zone (top 280px of card):**
- Filled rectangle spanning full card width, 280px tall — fill with a **light tint of the accent color** at 18% opacity over white. Compute tint in JS: `tint = { r: 1 - 0.18*(1-r), g: 1 - 0.18*(1-g), b: 1 - 0.18*(1-b) }`. Do NOT hardcode any color — tint must always derive from the archetype's own accent color.
- Accent color circle (72px diameter) at top-left — fill with the full accent color
- Archetype Name — Inter Bold, 36px, dark (`#1a1a1a`), to the right of the circle
- 1st-person narrative — Inter Regular, 14px, `#2a2a2a`, below the name, line height 21px; constrain width so it doesn't overlap the mindset bars
- Mindset bar chart (top-right, 280px wide): 4 traits stacked vertically
  - Trait label: Inter Regular, 13px
  - Background bar: full 280px wide, 14px tall, rounded 4px, fill with accent tint
  - Foreground bar: 0–280px wide (proportional to trait level 0.0–1.0), 14px tall, rounded 4px, fill accent color

**Content grid (below header — 6 sections in 3 columns × 2 rows):**

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| Quotes | Goals | Needs |
| Demographics | Frustrations | Habits |

Each section:
- Section label box: filled rectangle 30px tall, white Inter Bold 13px centered, fill with accent color, 6px corner radius
- 5 bullet items: Inter Regular 13px, `#1f1f1f`, prefixed with `•`, line height 18px, 6px gap between bullets
- Column gutter: 14px; top margin between header and grid: 12px

### Figma Plugin API notes
- Load fonts before use: `await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })` and `'Bold'`
- Use `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`
- Append all children to the card frame via `card.appendChild(node)`
- Set `textAutoResize = 'HEIGHT'` on text nodes with variable content so they expand to fit
- Call `figma.viewport.scrollAndZoomIntoView(figma.currentPage.children)` at the end

### Accent color palette (vary per archetype)
- Archetype 1: `#E8583A` (coral)
- Archetype 2: `#2BBFB3` (teal)
- Archetype 3: `#3BB87A` (green)
- Archetype 4: `#7B5EA7` (purple)
- Archetype 5: `#F5A623` (amber)

### Content to populate per archetype

**Archetype Name**: Short evocative name

**1st-person narrative**: ~150–200 words written as the archetype speaking — vivid, human, captures daily life and emotional relationship to the product/service

**Quotes** (5): Verbatim or lightly edited quotes from actual participants in this cluster. Wrap in curly quotes: "…"

**Demographics** (5): Data-grounded bullet points. Use real stats where available.

**Goals** (5): Present-tense action phrases — what they're trying to achieve

**Frustrations** (5): Specific blockers or pain points from the interviews

**Needs** (5): What the product/service must provide for this archetype

**Habits** (5): Observable behaviors around searching, consuming, and acting on information

**Mindset traits** (4): Bar labels must be **identical across all archetypes** — only fill values differ. Assign each a level as a fraction (0.0–1.0) based on the interview data.

---

## After generating the FigJam board

Once the board is created, share the link with the user and include this message verbatim:

> **A note on this output:** These archetype cards are a starting point, not a finished deliverable. The content has been synthesized from your interview data and should be treated as a first draft — expect to revise the narratives, refine the bullet points, and adjust the mindset bar values as your team discusses and pressure-tests each archetype. The cards are fully editable in FigJam, so feel free to reword, reorder, add images, or restructure as needed. The goal is to spark alignment, not to be the final word.

---

## Output Formats

- **Archetype FigJam Board**: Single FigJam file with one card per archetype, cards laid out side by side
- **Participant Summary** (optional, upstream): produced by the `pdd-interview-summary` skill

---

## Quality Checklist

Before presenting outputs, verify:
- [ ] Every goal, frustration, need, and habit is grounded in the interview data (not invented)
- [ ] Quotes are verbatim or clearly paraphrased
- [ ] The 1st-person narrative feels like a real person, not a marketing persona
- [ ] Archetypes are meaningfully distinct from each other
- [ ] All cards rendered without errors and each has a distinct accent color
- [ ] All archetype cards use the exact same 4 Mindset label strings
- [ ] FigJam board link is shared with the "starting point" message

---

## Reference Files

- `references/example_archetype.md` — Annotated example of a completed archetype document (vet med domain)
