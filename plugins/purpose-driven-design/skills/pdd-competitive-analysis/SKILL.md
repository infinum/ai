---
name: pdd-competitive-analysis
description: >
  Use this skill to run a Purpose-Driven Design (PDD) Competitive Analysis. Triggers
  whenever a user wants to: compare competitors, benchmark a client's product or website
  against rivals, evaluate market landscape, score competitors on UX or business criteria,
  or create a competitive analysis spreadsheet. Also trigger when the user says "competitive
  analysis", "compare competitors", "benchmark", "landscape review", "audit competitors",
  "score products against each other", or asks "how does our client compare to X" — even
  if they don't explicitly call it a skill. The output is a formatted .xlsx file matching
  the Infinum/ETR competitive analysis template (IBM Plex Sans font, blue header bar,
  grey category rows, 1–3 scoring with rationale columns). Cowork-ready.
---

# PDD Competitive Analysis Skill

> **Before you start:** Read `${CLAUDE_SKILL_DIR}/../../instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

Produces a structured competitive analysis spreadsheet from project data, scoring competitors
across relevant categories on a 0–3 scale with rationale. Follows the Infinum/ETR template
style (IBM Plex Sans, blue headers, grey category rows).

---

## Phase 1 — Gather Context

### Step 1: Check for project data
Look for existing project context in the conversation: project brief, research notes, SOW,
goals, target audience. Extract:
- **Client name** (for the first competitor column)
- **Project type** (website, app, portal, service, etc.)
- **Project goals / what success looks like**
- **Domain / industry**

If no project context is present, ask the user to briefly describe the project and its goals
before continuing.

### Step 2: Suggest categories, then ask for input

Based on the project type and goals, select a relevant subset from the
**Category Reference** (`references/categories.md`) and propose them. Always include at
least 5 categories; cap at 10 unless the user asks for more.

Then ask both questions together in a single message:

> **Before I build the analysis, two quick questions:**
>
> Based on the project goals, I'd suggest comparing across these categories:
> _(list suggested categories with a one-line rationale for each)_
>
> 1. **Are there any specific areas you'd like to add, remove, or swap?**
>    _(You can also say "looks good" to proceed with these)_
>
> 2. **Which competitors should be included?**
>    One column will always be the **client** ([Client Name]). Add up to 5 more.
>    I can also suggest likely competitors if you share the industry/market — just say the word.

Wait for the user's response before continuing.

---

## Phase 2 — Score and Generate

Once categories and competitors are confirmed, run the scoring and generate the spreadsheet.

### Scoring Rules
- Score each metric **0–3**:
  - **0** = Not present / doesn't work
  - **1** = Minimal / inconsistent
  - **2** = Adequate / more often than not
  - **3** = Excellent / all the time
- Leave a cell **blank** if there is genuinely insufficient information to score it (do not
  guess; leave empty rather than fabricate).
- For each score, write a **brief rationale** (1–2 sentences). This goes in a dedicated
  "Rationale" column immediately to the right of the score columns.
- The **client** is always the first scored column (after the metric label column).

### Rationale Column
Each metric row gets one rationale column (column I in the template layout, or the next
available column after all competitor score columns). The rationale should explain the
score pattern across competitors concisely, e.g.:
> "Client scores 3 — prominent sticky nav with clear labels. Competitor A scores 1 —
> hamburger menu only on mobile with no clear hierarchy."

### Scoring Rules
- Score each metric **0–3**:
  - **0** = Not present / doesn't work
  - **1** = Minimal / inconsistent
  - **2** = Adequate / more often than not
  - **3** = Excellent / all the time
- Leave a cell **blank** (`null`) if there is genuinely insufficient information — do not guess.
- For each metric row, write a **brief rationale** (1–2 sentences) comparing competitors.
  Row heights auto-size to fit the rationale text — write as much as is useful.

### Summary content
In addition to per-metric scores, prepare:
- **`summary`** — per-competitor strengths and weaknesses lists (3–6 bullets each).
  The client gets the same treatment; be honest about weaknesses — this is for internal use.
- **`opportunities`** — 3–6 opportunities for the client, each with a `title` and `detail`.
  Ground these in the scoring data: where does the client lag and where is no competitor
  currently strong? These are the highest-value items to surface.

### Output: run the generation script
Once scoring is complete, ensure openpyxl is available
(`pip install openpyxl --break-system-packages -q`), write the data to `ca_data.json` in the
format described in `references/data_schema.md`, then run the script from its location in this
skill:

```bash
python3 "<this skill dir>/scripts/generate_sheet.py" \
  --output "competitive_analysis.xlsx" \
  --data ca_data.json
```

The script produces a **two-sheet workbook**:
- **Sheet 1 — "Competitive Analysis"**: the full scoring grid with rationale column.
  Rationale rows auto-size vertically to fit their content.
- **Sheet 2 — "Summary"**: per-competitor strengths (green) and weaknesses (red),
  followed by a client opportunities section (blue).

Then present the file to the user using `present_files`.

---

## Phase 3 — Review Gate

After presenting the file, always ask:

> "Does this look right? Let me know if you'd like to adjust any scores, categories,
> add or remove competitors, or update any rationale."

Include this **starting-point note** (per the plugin's output policy):

> **A note on this output:** This is a shared starting point, not a finished deliverable. Per *Keep It Human*, review it and refine it **together with the team** — the best results come from collaboration and human judgment, not from a first pass. Check every line against what you know before using or sharing it.


Regenerate if needed.

---

## Files in this skill

| Path | Purpose |
|------|---------|
| `SKILL.md` | This file — workflow instructions |
| `scripts/generate_sheet.py` | Builds the two-sheet .xlsx from a JSON data payload |
| `references/categories.md` | Full library of category + metric options by domain |
| `references/data_schema.md` | JSON structure expected by generate_sheet.py (includes summary + opportunities fields) |
