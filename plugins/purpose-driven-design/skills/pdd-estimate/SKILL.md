---
name: pdd-estimate
description: >
  Use this skill to build a project estimate on the standard ETR/Infinum estimate template.
  It reads the project brief or RFP, benchmarks against past estimates in the team's Estimates
  drive, proposes a feature list with draft hours per department (Discovery, Content/SEO, UX,
  Design, Dev, PM), and fills the official estimate spreadsheet — keeping all of its built-in
  formulas. Triggers whenever a user wants to: estimate a project, scope hours, build a cost or
  hours estimate, fill out the estimate template/sheet, price an RFP, or figure out how long a
  build will take. Also trigger when the user says "estimate", "estimate sheet", "scope this",
  "how many hours", "price this RFP", or "fill out the estimate" — even if they don't call it a
  skill. Output is a filled .xlsx with all formulas intact (a local file; nothing is written to Drive).
---

# PDD Estimate Skill

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and ways of working. Note: this skill's output is the **standard estimate template**, which has its own format — so the generic Infinum *document* branding (fonts/colours/logo) does **not** apply here. Keep the template's structure and formulas intact.

Builds an estimate on the team's **2026-format estimate template**, grounded in the project's
real scope and benchmarked against past estimates. This is PDD work: estimate from evidence
(comparable past projects, the actual RFP), never from a guess, and hand the team a reviewable
starting point — not a number presented as fact (*Context Before Commitment* & *Simplicity Takes Work*).

**Read first:**
- `references/template-structure.md` — exactly which cells are inputs vs. formulas.
- `references/benchmarking.md` — how to use the Estimates drive for general benchmarking.

The estimate template is **bundled in this skill** (`assets/estimate-template-2026.xlsx`) — no
download needed. The **Google Drive connector** is used only for **benchmarking** (`search_files`,
`read_file_content` — read-only) and is optional. The skill **never writes to Drive**; the
deliverable is a local .xlsx built by `scripts/populate_estimate.py`. If no Drive connector is
available, see the Fallback at the end.

---

## Phase 0 — Gather the project scope

Scan the conversation first for an RFP, brief, SOW, or prior PDD work (discovery readout,
archetypes, stakeholder notes). To estimate well you need:

| Item | Why it matters |
|---|---|
| **Project name & type** | Header + which comparables apply (marketing site / web app / native app / branding / research). |
| **Scope / deliverables** | The feature/deliverable list is the backbone of the estimate. |
| **Known constraints** | Tech stack/CMS, integrations, platforms, languages, accessibility targets. |
| **Timeline / team** | Drives meeting cadence (project weeks) and PM load. |
| **Phases** | Whether this is one estimate or phased (Discovery → Design → Build). |
| **Proposed budget (if any)** | If the client gave a budget, you must work to it — see *Rate & budget* below. |

If the RFP lives in Drive, read it with `read_file_content`. If key items are missing, ask
them **all at once**, then proceed — you have process knowledge; the user owns the scope.

### Rate & budget
The estimate is built in **hours**. Do **not** assume an hourly rate — there is no default
rate. Only convert hours to a cost if the user (or the project context) gives you the rate to
use for this engagement.

- If you have an hourly rate, the script computes and reports the **estimated cost** (and writes
  a rate/cost line into the sheet's Assumptions). With no rate, it produces hours only.
- **If the client provided a proposed budget**, you must work with it. Ask for the applicable
  hourly rate if you don't have one, convert the budget to a target hours ceiling
  (`budget ÷ rate`), and aim the scope at that. After drafting, compare the estimated cost to
  the budget:
  - **Within budget** — good; note the headroom.
  - **Over budget** — do **not** silently shrink hours or pad to fit. Surface the gap and
    propose concrete trade-offs for the user to choose: cut or defer features (e.g. to a
    Phase 2), reduce a complexity factor, trim meeting cadence, or flag that the scope
    genuinely needs more than the budget allows. Let the user decide before you build.
  - Record the rate used, estimated cost, and (if given) the budget and variance in the
    Assumptions so the trade-off is transparent.

---

## Phase 1 — Benchmark against past estimates

Follow `references/benchmarking.md`. Search the Estimates drive
(`parentId = '0ALPxUHmMH5ICUk9PVA'`) for 2–4 of the closest comparables by type/scope, read
them, and derive rough expectation **ranges** (total band, department split, feature
granularity). Cite the comparables by name so the user can check them. Don't copy another
project's numbers — anchor, don't clone.

---

## Phase 2 — Propose the feature list + draft hours (get approval)

Build a feature/deliverable list from the scope and propose **draft hours per department**
(Discovery, Content/SEO, UX, Design, Dev, PM) for each line. Hours are grounded in the
benchmarks and clearly flagged as drafts. Present it as a compact table for review **before
building any file**:

| Feature / Deliverable | Disc | Content/SEO | UX | Design | Dev | PM |
|---|---|---|---|---|---|---|

Below the table, show: the rough section totals, the **estimated cost** if you have an hourly
rate to apply, how it compares to the benchmark ranges (naming the comparables) and to the
**client's budget** if one was given, the **assumptions** you estimated against, and any open
questions for the client. If the draft is over budget, present the trade-off options (see *Rate
& budget*) here and let the user choose before building. Also propose the top-level levers:
Discovery fixed items (kick-off/workshop/docs), project weeks (meeting cadence), complexity
factors for any risky sections, and scope-growth %. Then ask:

> Here's the draft estimate. Want me to adjust any hours, add/remove features, change the
> complexity or meeting assumptions — or shall I build the estimate sheet from this?

Wait for approval or edits before Phase 3.

---

## Phase 3 — Build the estimate sheet

The estimate template **ships inside this skill** (`assets/estimate-template-2026.xlsx`), so
**no Drive download is needed** — the script uses the bundled copy automatically. (Do not try to
download the template at run time: the export is a very large base64 blob that gets truncated
to a temp file and stalls the flow. Only refresh the bundled copy in the rare case the template
changed — see *Refreshing the template* below.)

1. **Ensure openpyxl is available** (once per session): `pip install openpyxl --break-system-packages -q`
2. **Write the approved plan to `spec.json`** (schema documented at the top of
   `scripts/populate_estimate.py`): `project_name`, `features[]` with per-department hours.
   Group the features under **section headings** (e.g. *Discovery & Strategy*, *Content &
   Messaging*, *UX & Design*, *Development & Technology*) using `{"section": "..."}` entries —
   they render bold and shaded. Empty department cells are left **blank**, not 0. You can also
   bold a key feature with `{"bold": true}`. The spec also takes
   `discovery_fixed`, `complexity`, `client_status_meetings`, `internal_standups`,
   `client_training_hours`, `pm_pct`, `scope_growth_pct`, `assumptions`, and — for costing —
   `hourly_rate` (optional — only set it if you have a rate for this engagement; no rate is
   assumed) and `budget` (the client's proposed budget, if any).
3. **Run the populate script** using its absolute path inside this skill (the bundled template
   resolves automatically; pass `--output` only):
   ```bash
   python3 "<this skill dir>/scripts/populate_estimate.py" --spec spec.json --output "Estimate - [Project].xlsx"
   ```
   It writes only input cells (leaving every total a live formula), forces recalc-on-open, and
   prints a Python-computed preview of all section totals, the grand total, and the cost. Report
   the grand total and cost to the user — the file itself recalculates when opened.
4. **Sanity-check** the preview against the Phase-1 benchmark ranges; flag any big deviation.

> **Refreshing the template (rare).** If the master template in Drive has changed, download it
> with `download_file_content(fileId='1e4PjvihqYJ8Z6YDdMlD2SHqW804zEg-cJs5I930QoVs',
> exportMimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`. Because
> the result is large it will be saved to a temp file rather than returned inline — read that
> file, base64-decode its `content` field to a new .xlsx, and either pass it via `--template`
> for this run or replace `assets/estimate-template-2026.xlsx`.

---

## Phase 4 — Deliver

Present the filled **.xlsx** with `present_files`. Formulas are intact; it opens and
recalculates in Excel or Google Sheets. **Do not upload anything to Drive** — the estimate is
delivered as a local file for the user to review and place wherever they want. (The original
template and all existing estimates in Drive are read-only — never modify them.) If the user
later asks for it in Drive, they can drag the .xlsx in themselves, or ask and you can add it.

---

## Phase 5 — Review

Present the files with this **starting-point warning verbatim** (per the plugin's output policy):

> **A note on this estimate:** These hours are a **best guess, not a quote** — they must be
> reviewed and **confirmed with the actual team members who would do the work** before this
> estimate is used or sent to a client. They're draft figures benchmarked against comparable
> past projects and the scope as I understood it; review every line against the team's read of
> the work and its velocity. Check the assumptions, confirm the open questions with the client,
> and adjust the complexity and meeting factors to match reality. The sheet's formulas update
> as you edit the inputs.

Then offer to adjust hours, add/remove features, re-balance departments, change complexity or
meeting cadence, or produce a phased version.

---

## Quality checklist
- [ ] Scope came from the RFP/brief (or the user), not invented.
- [ ] At least 2 comparable past estimates were consulted and named.
- [ ] Draft hours were shown and approved **before** the file was built.
- [ ] Only input cells were written; all totals remain formulas (grand total in `Summary!F2`).
- [ ] The Python preview total was reported and checked against benchmark ranges.
- [ ] If an hourly rate was available, estimated cost was computed; if a budget was given, the estimate was reconciled to it (or trade-offs were surfaced and chosen).
- [ ] Assumptions and open questions are listed in the sheet and the message.
- [ ] The filled .xlsx was delivered locally; nothing was written to Drive; the original template was untouched.
- [ ] The starting-point warning is included.

---

## Fallback (no Drive connector)
The template is bundled, so you can still build the estimate without Drive. If the connector
isn't connected, skip Phase 1 benchmarking (or ask the user to paste a comparable estimate or
two), note that you couldn't benchmark against past work, and proceed to build the filled
`.xlsx` from the RFP and the user's input.

## Files in this skill
| Path | Purpose |
|---|---|
| `SKILL.md` | This workflow |
| `assets/estimate-template-2026.xlsx` | The bundled estimate template (formulas intact) |
| `scripts/populate_estimate.py` | Fills the template from a spec.json; prints a computed preview |
| `references/template-structure.md` | Which cells are inputs vs. formulas |
| `references/benchmarking.md` | Using the Estimates drive for benchmarking |
