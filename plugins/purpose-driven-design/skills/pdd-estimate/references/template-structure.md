# Estimate Template — Structure & Formulas (2026 Format)

Template file: **`__Estimate Template - 2026 Format`** (bundled at `assets/estimate-template-2026.xlsx`).
Drive file ID: `1e4PjvihqYJ8Z6YDdMlD2SHqW804zEg-cJs5I930QoVs`

The template is a Google Sheet with five tabs. **You only ever fill input cells** — every
total is a live formula and recalculates when the file is opened in Excel or Google Sheets.
The populate script (`scripts/populate_estimate.py`) writes these inputs for you; this doc
explains what it touches so you can reason about and adjust the result.

## The two sheets that matter for estimating

### 1. `Features Worksheet` — the primary input
- Header row: `A = (project name link)`, `B = Discovery`, `C = Content SEO`, `D = UX`,
  `E = Design`, `F = Dev`, `G = PM`.
- **Feature rows start on the row below the header (row 3)**: column A = feature/deliverable
  name, columns B–G = estimated **hours per department** for that feature.
- Row 1 holds the department **sub-totals** (`=SUM(B3:B75)` …). These feed the Summary.
- Leave hours at 0 for departments a feature doesn't touch. Up to ~73 feature rows.

### 2. `Summary` — rollup + the adjustment levers
- `A1` — project name (`Project Name: [Project Title]`).
- `F2` — **grand total (hours)** = sum of all section totals. This is the headline number.
- **Discovery**: three *Fixed, but editable* items in column F — Client Kick-off (default 6),
  Discovery Workshop (15), Docs/Requirements Review (10) — plus internal/readout meeting % (col E)
  and a **Complexity factor** (col E, default 0). Section total = fixed items +
  complexity-adjusted Discovery sub-total × (1 + meeting %s).
- **Content & SEO / UX / Design / Development** — same shape: a *Complexity factor* (col E) and
  meeting %s (col E) applied to that department's Features sub-total.
- **PM** = (Discovery+Content+UX+Design+Dev) × *Project Mgmt %* (col E, default 10%) + the PM
  hours entered on the Features Worksheet.
- **Client Meetings** = `Weekly Status Meetings` (Project Wks × Meeting Length × # People, cols
  C/D/E) + `Client Training` total hours (col F).
- **Internal Meetings** = `Standups / Internal Status` (Wks × Length × People).
- **QA & Testing** = UAT (% of Discovery+Content+UX+Design) + TAT (% of Dev) + Design QA
  (% of Design). Percentages in col E (default 5% each).
- **Optional Items** = Scope Growth Budget (col E %) × most of the above.
- **Assumptions** — free-text rows under the `Assumptions` header (col A).
- Column **H** is a static *Common Tasks List* reference menu — not an input, don't touch it.

## Sheets removed from the output
The template ships with three hidden tabs that the build script **deletes** from the deliverable
(they aren't referenced by the working sheets, so the estimate is just Summary + Features Worksheet):
- `Estimate Values` — a legacy rollup tab with broken `#REF!` references. The authoritative
  total is `Summary!F2`.
- `Project Actuals` / `Project Recap` — post-project tracking tabs, not part of an estimate.

## Input cells the populate script writes (label-anchored, not hard-coded rows)
| Input | Where | Spec key |
|---|---|---|
| Feature name + dept hours | `Features Worksheet` rows 3+ | `features[]` |
| Project name | `Summary` A1 | `project_name` |
| Discovery fixed items | Kick-off / Workshop / Docs rows, col F | `discovery_fixed` |
| Complexity factors | each section's *Complexity factor* row, col E | `complexity` |
| Weekly client status meetings | `Weekly Status Meetings` row, cols C/D/E | `client_status_meetings` |
| Client training hours | `Client Training` row, col F | `client_training_hours` |
| Internal standups | `Standups / Internal Status` row, cols C/D/E | `internal_standups` |
| PM % | *Project Mgmt* row, col E | `pm_pct` |
| Scope growth % | `Scope Growth Budget Hours` row, col E | `scope_growth_pct` |
| Assumptions | rows under `Assumptions`, col A | `assumptions` |

Everything else (section totals, grand total, QA, meeting math) stays formula-driven.
