---
name: pdd-rainbow-analysis
description: >
  Use this skill to create a Rainbow Analysis spreadsheet from user interview data.
  A Rainbow Analysis tallies recurring themes/observations across participants, assigns
  a unique color to each participant, and marks their contribution to each theme with a
  colored cell. Trigger whenever a user wants to: identify patterns across interviews,
  tally which participants mentioned which themes, create a theme frequency chart, map
  observations to participants, or do a "rainbow analysis" or "affinity analysis" on
  qualitative research. Also trigger when the user says "rainbow analysis", "theme
  tally", "observation frequency", "which participants said X", or "synthesize themes
  across interviews" — even if they don't explicitly call it a skill. Cowork-ready.
---

# PDD Rainbow Analysis Skill

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

This skill transforms user interview data into a **Rainbow Analysis spreadsheet** — a
structured matrix that maps recurring observations/themes against participants, showing
at a glance which themes are most prevalent and who contributed to each.

---

## Output Format

The spreadsheet has this structure:

| OBSERVATIONS | INSTANCES | Participant 1 | Participant 2 | … |
|---|---|---|---|---|
| Theme or observation text | Count of x marks | colored cell | colored cell | … |

- **OBSERVATIONS** column: One theme/observation per row, sorted by INSTANCES descending
- **INSTANCES** column: Count of participants who mentioned this theme (formula-driven)
- **Participant columns**: One column per participant, each with a unique background color. Cells that apply to that participant contain a bold **x** on a colored background; cells that don't are left blank (colored background, no text)
- Rows sorted by INSTANCES descending (most common themes first)
- Header row: bold, dark background, white text
- Each participant column is narrow (~40–50px); OBSERVATIONS column is wide (~350px)

---

## Phase 0: Gather Inputs

Before starting, confirm you have:
- Interview data (transcripts, CSVs, or notes) OR an existing theme list

### Step 0a: Check for existing themes

Ask the user:
> "Do you have an existing list of themes or observations you'd like to use, or should I identify them from the interview data?"

- **User has a list** → skip to Phase 1b (confirm themes)
- **User wants Claude to identify them** → proceed to Phase 1a (extract themes)

### Step 0b: Participant Summary tab — optional

Offer to include a participant summary alongside the rainbow analysis:

> "Want me to add a **Participant Summary** tab to the same workbook? It's one row per
> participant mapped across key dimensions (Audience Type, Goals, Habits, Frustrations, Needs)
> — a handy reference next to the theme matrix. I can add or drop columns if you like."

- **If yes** → note any column changes and build it as a second worksheet in Phase 3 (see
  "Optional: Participant Summary tab"). Follow the content conventions of the
  `pdd-interview-summary` skill.
- **If no** → produce the rainbow analysis only.

---

## Phase 1a: Extract Themes from Interview Data

Analyze the interview data and identify recurring observations. A good observation:
- Is specific and behavioral (not vague like "had a good experience")
- Appears across multiple participants
- Is phrased in present tense from the participant's perspective
- Is concise enough to fit in a spreadsheet cell (under ~100 characters)

Aim for 15–25 observations. More is fine if the data supports it.

---

## Phase 1b: Confirm Themes with the User

**This step is mandatory. Do not generate the spreadsheet until the user has approved the themes.**

Present the full list of observations as plain text in the conversation, in proposed sort order (most expected frequency first). Use this format:

```
Here are the observations I've identified. Let me know if you'd like to add, remove, reword, or reorder anything before I build the spreadsheet:

1. Wants to see specifics on their condition or desired service reflected on the site
2. Mentions therapist fit being important
3. Mentions insurance coverage as a primary information needed when searching
…
```

Wait for the user's response. Incorporate any changes, then confirm:
> "Got it — I'll use this final list. Building the spreadsheet now."

---

## Phase 2: Identify Participant Contributions

For each observation and each participant, determine whether the participant mentioned or exhibited that theme. Mark with **x** if yes, leave blank if no.

If working from raw transcripts or notes, scan carefully — a participant may express a theme without using the exact words. Use judgment: does their language, behavior, or sentiment reflect this observation?

---

## Phase 3: Build the Spreadsheet

Read `/mnt/skills/public/xlsx/SKILL.md` before writing any code.

### Participant color palette

Assign one background color per participant, cycling through this palette:

| # | Color name | Hex | openpyxl RGB |
|---|---|---|---|
| 1 | Coral | #F4A89A | F4A89A |
| 2 | Sky blue | #A8D1F4 | A8D1F4 |
| 3 | Mint | #A8F4C8 | A8F4C8 |
| 4 | Lavender | #C8A8F4 | C8A8F4 |
| 5 | Peach | #F4CFA8 | F4CFA8 |
| 6 | Yellow | #F4F0A8 | F4F0A8 |
| 7 | Rose | #F4A8C8 | F4A8C8 |
| 8 | Teal | #A8E8F4 | A8E8F4 |
| 9 | Sage | #C8F4A8 | C8F4A8 |
| 10 | Lilac | #E8A8F4 | E8A8F4 |

If there are more than 10 participants, cycle back through the palette.

### Spreadsheet construction (openpyxl)

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Color palette (hex strings, no #)
COLORS = ["F4A89A","A8D1F4","A8F4C8","C8A8F4","F4CFA8",
          "F4F0A8","F4A8C8","A8E8F4","C8F4A8","E8A8F4"]

wb = Workbook()
ws = wb.active
ws.title = "Rainbow Analysis"

participants = [...]   # list of participant names in order
observations = [...]   # list of (observation_text, {participant: bool}) dicts
                       # sorted by instance count descending

# --- Header row ---
header_fill = PatternFill("solid", start_color="1F2D3D")
header_font = Font(bold=True, color="FFFFFF", name="Arial", size=10)
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left = Alignment(horizontal="left", vertical="center", wrap_text=True)

ws["A1"] = "OBSERVATIONS"
ws["A1"].font = header_font
ws["A1"].fill = header_fill
ws["A1"].alignment = left

ws["B1"] = "INSTANCES"
ws["B1"].font = header_font
ws["B1"].fill = header_fill
ws["B1"].alignment = center

for i, name in enumerate(participants):
    col = get_column_letter(3 + i)
    cell = ws[f"{col}1"]
    cell.value = name
    cell.font = Font(bold=True, color="000000", name="Arial", size=10)
    cell.fill = PatternFill("solid", start_color=COLORS[i % len(COLORS)])
    cell.alignment = center

# --- Data rows ---
for row_idx, obs in enumerate(observations, start=2):
    text, contributions = obs["text"], obs["contributions"]
    
    # OBSERVATIONS cell
    ws.cell(row=row_idx, column=1).value = text
    ws.cell(row=row_idx, column=1).alignment = left
    ws.cell(row=row_idx, column=1).font = Font(name="Arial", size=10)
    
    # INSTANCES formula
    first_col = get_column_letter(3)
    last_col = get_column_letter(2 + len(participants))
    ws.cell(row=row_idx, column=2).value = (
        f'=COUNTA({first_col}{row_idx}:{last_col}{row_idx})'
    )
    ws.cell(row=row_idx, column=2).alignment = center
    ws.cell(row=row_idx, column=2).font = Font(name="Arial", size=10, bold=True)

    # Participant cells
    for i, name in enumerate(participants):
        col_idx = 3 + i
        cell = ws.cell(row=row_idx, column=col_idx)
        color = COLORS[i % len(COLORS)]
        cell.fill = PatternFill("solid", start_color=color)
        cell.alignment = center
        if contributions.get(name):
            cell.value = "x"
            cell.font = Font(bold=True, name="Arial", size=11, color="1F2D3D")

# --- Column widths ---
ws.column_dimensions["A"].width = 52
ws.column_dimensions["B"].width = 12
for i in range(len(participants)):
    ws.column_dimensions[get_column_letter(3 + i)].width = 14

# --- Row heights ---
ws.row_dimensions[1].height = 40
for row_idx in range(2, len(observations) + 2):
    ws.row_dimensions[row_idx].height = 22

wb.save("/mnt/user-data/outputs/rainbow_analysis.xlsx")
```

After saving, run `scripts/recalc.py` to calculate INSTANCES values:

```bash
python /mnt/skills/public/xlsx/scripts/recalc.py /mnt/user-data/outputs/rainbow_analysis.xlsx
```

Fix any formula errors before presenting the file.

### Optional: Participant Summary tab

If the user opted in (Step 0b), add a **second worksheet** to the same workbook — don't create a
separate file. Follow the content rules of the `pdd-interview-summary` skill: one row per
participant; columns *Participant Name, Audience Type, Goals, Habits, Frustrations, Needs* (plus
any the user added); concise cells (2–4 sentences) grounded in the data; write **"Not discussed"**
where a participant didn't address a topic — never invent. Add it before saving the workbook:

```python
from openpyxl.styles import Font, PatternFill, Alignment

ws2 = wb.create_sheet("Participant Summary")
columns = ["Participant Name", "Audience Type", "Goals", "Habits", "Frustrations", "Needs"]  # + custom
# Header row — light Infinum fill, bold
hfill = PatternFill("solid", start_color="E4EBF5")
for c, name in enumerate(columns, start=1):
    cell = ws2.cell(row=1, column=c, value=name)
    cell.font = Font(bold=True, name="Arial", size=10)
    cell.fill = hfill
    cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
# One row per participant (same participant set as the rainbow tab)
for r, row in enumerate(participant_rows, start=2):   # row = [name, audience, goals, ...]
    for c, val in enumerate(row, start=1):
        cell = ws2.cell(row=r, column=c, value=val)
        cell.font = Font(name="Arial", size=10)
        cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
ws2.column_dimensions["A"].width = 22
for c in range(2, len(columns) + 1):
    ws2.column_dimensions[get_column_letter(c)].width = 40
ws2.freeze_panes = "B2"   # freeze header row + name column
```

Keep the **Rainbow Analysis** as the first/active tab and the Participant Summary as the second.

---

## Phase 4: Present and Confirm

Present the file to the user and include a brief summary:

> "Here's the Rainbow Analysis — **[N] observations** across **[N] participants**, sorted by frequency. The most common theme appeared in [N] out of [N] participants. Let me know if you'd like to adjust any theme wording, add/remove observations, or change the sort order."


Include this **starting-point note** (per the plugin's output policy):

> **A note on this output:** This is a shared starting point, not a finished deliverable. Per *Keep It Human*, review it and refine it **together with the team** — the best results come from collaboration and human judgment, not from a first pass. Check every line against what you know before using or sharing it.

If you added a Participant Summary tab, mention it too (e.g. "I also included a **Participant Summary** tab mapping each participant across the key dimensions").

---

## Quality Checklist

Before presenting the file, verify:
- [ ] Observations are sorted by INSTANCES descending
- [ ] INSTANCES column uses COUNTA formula (not hardcoded values)
- [ ] Every participant has a distinct color
- [ ] Colored cells with **x** are bold and readable against their background
- [ ] Empty participant cells still have the participant's background color
- [ ] OBSERVATIONS column is wide enough for text not to be cut off
- [ ] User confirmed the theme list before the spreadsheet was built
- [ ] No formula errors (#REF!, #VALUE!, etc.)
- [ ] If requested, a Participant Summary tab was added as a second worksheet (grounded in the data; "Not discussed" for gaps; Rainbow Analysis remains the first tab)
