#!/usr/bin/env python3
"""
populate_estimate.py — fill the ETR/Infinum "Estimate Template - 2026 Format"
from a JSON spec, keeping all of the template's built-in formulas intact.

Usage:
  python3 populate_estimate.py --spec spec.json --output filled.xlsx
  (uses the bundled assets/estimate-template-2026.xlsx unless --template is given)

The script is **label-anchored** — it locates input cells by the text labels in
the template (not hard-coded row numbers), so it survives minor template edits.
It writes ONLY input cells; every total/rollup stays a live formula and
recalculates when the file is opened in Excel or Google Sheets.

After writing, it prints a Python re-computation of the section + grand totals
(and cost, if an hourly rate is given) so you can sanity-check without opening it.

Spec JSON schema (all keys optional except project_name + features):
{
  "project_name": "Acme — Marketing Website",
  "features": [
    {"section": "DISCOVERY & STRATEGY"},                 # bold, shaded heading row (no hours)
    {"name": "Homepage", "content_seo": 2, "ux": 8, "design": 16, "dev": 24},
    {"name": "Information architecture + sitemap", "ux": 24, "bold": true},  # optional bold feature
    ...
  ],
  # Empty department values are left BLANK (not 0). Use {"section": "..."} (or
  # {"name": "...", "heading": true}) for group headings; {"bold": true} bolds a key feature.
  "discovery_fixed": {"kickoff": 6, "workshop": 15, "docs_review": 10},   # overrides Summary fixed items
  "complexity": {"discovery": 0, "content_seo": 0, "ux": 0, "design": 0, "development": 0},  # 0.0–1.0
  "client_status_meetings": {"weeks": 10, "length": 0.75, "people": 2.5},
  "internal_standups":      {"weeks": 10, "length": 0.5,  "people": 3},
  "client_training_hours": 0,
  "pm_pct": 0.10,
  "scope_growth_pct": 0.0,
  "assumptions": ["...", "..."]
}

HOURS ONLY: this skill never computes or emits dollar amounts — no hourly rates, costs, or
budgets, in the Assumptions area or anywhere else. Every figure it produces is in hours. Any
conversion from hours to cost happens outside this skill.
"""
import argparse, json, os, sys
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill

# The template ships inside the skill so no Drive download is needed at run time.
BUNDLED_TEMPLATE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "assets", "estimate-template-2026.xlsx"
)

# Map a Summary section header (col A) -> Features Worksheet subtotal column
SECTION_TO_FEATURECOL = {
    "Discovery": "B",
    "Content & SEO": "C",
    "UX": "D",
    "Design": "E",
    "Development": "F",
}
# spec.complexity keys -> section header text
COMPLEXITY_KEY_TO_SECTION = {
    "discovery": "Discovery", "content_seo": "Content & SEO", "ux": "UX",
    "design": "Design", "development": "Development",
}


def norm(v):
    return str(v).strip() if v is not None else ""


def find_sheet(wb, want):
    for ws in wb.worksheets:
        if ws.title.strip().lower() == want.lower():
            return ws
    raise SystemExit(f"Sheet '{want}' not found. Sheets: {wb.sheetnames}")


def populate(template, spec, output):
    wb = openpyxl.load_workbook(template, data_only=False)
    try:
        wb.calculation.fullCalcOnLoad = True
    except Exception:
        pass

    # Drop the unused tracking/legacy tabs entirely — the deliverable is just the
    # Summary + Features Worksheet (these three are hidden in the template and aren't
    # referenced by the working sheets).
    for _name in ("Estimate Values", "Project Actuals", "Project Recap"):
        if _name in wb.sheetnames:
            wb.remove(wb[_name])

    fw = find_sheet(wb, "Features Worksheet")
    sm = find_sheet(wb, "Summary")

    # ---- Features Worksheet: find header row (B='Discovery', C='Content SEO') ----
    header_row = None
    for r in range(1, 10):
        if norm(fw.cell(r, 2).value) == "Discovery" and norm(fw.cell(r, 3).value).startswith("Content"):
            header_row = r
            break
    if header_row is None:
        raise SystemExit("Could not locate Features Worksheet header row.")
    first_feature_row = header_row + 1

    cols = ["discovery", "content_seo", "ux", "design", "dev", "pm"]
    heading_fill = PatternFill("solid", fgColor="FFDAE2E7")  # light blue-grey band
    heading_font = Font(bold=True, name="Arial", size=10, color="000000")
    regular_font = Font(bold=False, name="Arial", size=10, color="000000")
    for i, f in enumerate(spec.get("features", [])):
        r = first_feature_row + i
        # A feature entry can be a SECTION HEADING ({"section": "..."} or {"heading": true}):
        # bold, shaded across the row, with no department hours.
        is_heading = bool(f.get("section") or f.get("heading"))
        name = f.get("section") or f.get("name", f"Feature {i+1}")
        c1 = fw.cell(r, 1); c1.value = name
        if is_heading:
            for cc in range(1, 8):
                fw.cell(r, cc).fill = heading_fill
                fw.cell(r, cc).font = heading_font
            continue  # heading rows carry no hours
        # normalize the whole row to the regular body font (the template has stray bold on
        # some rows) — then bold the name only if explicitly requested.
        for cc in range(1, 8):
            fw.cell(r, cc).font = regular_font
        if f.get("bold"):
            c1.font = heading_font
        for j, key in enumerate(cols):
            v = f.get(key)
            # leave empty department cells BLANK (not 0); SUM treats blanks as 0
            fw.cell(r, 2 + j).value = v if isinstance(v, (int, float)) and v else None
    # subtotals (row 1) are SUM formulas already — leave them.

    # ---- Summary inputs ----
    for r in range(1, 4):
        if norm(sm.cell(r, 1).value).startswith("Project Name"):
            sm.cell(r, 1).value = f"Project Name: {spec.get('project_name','[Project Title]')}"
            break

    current_section = None
    discovery_fixed = spec.get("discovery_fixed", {})
    section_complexity = {COMPLEXITY_KEY_TO_SECTION[k]: v for k, v in spec.get("complexity", {}).items()
                          if k in COMPLEXITY_KEY_TO_SECTION}
    fixed_label_map = {
        "client kick-off meeting + prep": "kickoff",
        "discovery workshop meeting + prep": "workshop",
        "docs / requirements review": "docs_review",
    }

    for r in range(1, sm.max_row + 1):
        a = norm(sm.cell(r, 1).value); b = norm(sm.cell(r, 2).value); c = norm(sm.cell(r, 3).value)
        if a in SECTION_TO_FEATURECOL or a in ("PM", "Client Meetings Summary",
                                               "Internal Meetings Summary", "QA & Testing",
                                               "Optional Items", "Assumptions"):
            current_section = a
        if c.lower().startswith("fixed") and b.lower() in fixed_label_map:
            key = fixed_label_map[b.lower()]
            if key in discovery_fixed:
                sm.cell(r, 6).value = discovery_fixed[key]
        if c.lower().startswith("complexity factor") and current_section in section_complexity:
            sm.cell(r, 5).value = section_complexity[current_section]
        if b.lower() == "weekly status meetings" and "client_status_meetings" in spec:
            m = spec["client_status_meetings"]
            sm.cell(r, 3).value = m.get("weeks", 0); sm.cell(r, 4).value = m.get("length", 0); sm.cell(r, 5).value = m.get("people", 0)
        if b.lower() == "client training" and "client_training_hours" in spec:
            sm.cell(r, 6).value = spec["client_training_hours"]
        if b.lower() == "standups / internal status" and "internal_standups" in spec:
            m = spec["internal_standups"]
            sm.cell(r, 3).value = m.get("weeks", 0); sm.cell(r, 4).value = m.get("length", 0); sm.cell(r, 5).value = m.get("people", 0)
        if c.lower().startswith("project mgmt") and "pm_pct" in spec:
            sm.cell(r, 5).value = spec["pm_pct"]
        if b.lower() == "scope growth budget hours" and "scope_growth_pct" in spec:
            sm.cell(r, 5).value = spec["scope_growth_pct"]

    assumptions = spec.get("assumptions", [])
    if assumptions:
        arow = None
        for r in range(1, sm.max_row + 1):
            if norm(sm.cell(r, 1).value) == "Assumptions":
                arow = r
                break
        if arow:
            for i, a in enumerate(assumptions):
                sm.cell(arow + 1 + i, 1).value = f"• {a}"

    wb.save(output)
    return preview(template, spec)


def preview(template, spec):
    """Re-compute totals in Python (mirrors the template formulas) for a sanity check."""
    wb = openpyxl.load_workbook(template, data_only=False)
    sm = find_sheet(wb, "Summary")

    coeff = {}
    section = None
    for r in range(1, sm.max_row + 1):
        a = norm(sm.cell(r, 1).value); b = norm(sm.cell(r, 2).value); c = norm(sm.cell(r, 3).value)
        if a in SECTION_TO_FEATURECOL or a in ("PM", "QA & Testing", "Optional Items"):
            section = a
        e = sm.cell(r, 5).value
        if c.lower().startswith("adjust if needed") and isinstance(e, (int, float)):
            coeff.setdefault(section, []).append(e)
        if c.lower().startswith("project mgmt") and isinstance(e, (int, float)):
            coeff["PM_PCT"] = e
        if b.lower() == "uat (user acceptance testing)" and isinstance(e, (int, float)):
            coeff["UAT"] = e
        if b.lower() == "tat (tech. acceptance testing)" and isinstance(e, (int, float)):
            coeff["TAT"] = e
        if b.lower() == "design qa" and isinstance(e, (int, float)):
            coeff["DESIGNQA"] = e
        if b.lower() == "scope growth budget hours" and isinstance(e, (int, float)):
            coeff["SCOPE"] = e

    keys = ["discovery", "content_seo", "ux", "design", "dev", "pm"]
    sub = {k: 0 for k in keys}
    for f in spec.get("features", []):
        for k in keys:
            sub[k] += f.get(k, 0) or 0

    cx = {COMPLEXITY_KEY_TO_SECTION[k]: v for k, v in spec.get("complexity", {}).items()
          if k in COMPLEXITY_KEY_TO_SECTION}
    dfix = spec.get("discovery_fixed", {"kickoff": 6, "workshop": 15, "docs_review": 10})
    pm_pct = spec.get("pm_pct", coeff.get("PM_PCT", 0.10))

    def section_total(name, base, fixed=0.0):
        adj = base * (1 + cx.get(name, 0.0))
        mtg = sum(coeff.get(name, []))
        return fixed + adj * (1 + mtg)

    disc = section_total("Discovery", sub["discovery"],
                         dfix.get("kickoff", 6) + dfix.get("workshop", 15) + dfix.get("docs_review", 10))
    cont = section_total("Content & SEO", sub["content_seo"])
    ux = section_total("UX", sub["ux"])
    des = section_total("Design", sub["design"])
    dev = section_total("Development", sub["dev"])
    pm = (disc + cont + ux + des + dev) * pm_pct + sub["pm"]

    csm = spec.get("client_status_meetings", {})
    client_mtg = csm.get("weeks", 0) * csm.get("length", 0) * csm.get("people", 0) + spec.get("client_training_hours", 0)
    ism = spec.get("internal_standups", {})
    internal_mtg = ism.get("weeks", 0) * ism.get("length", 0) * ism.get("people", 0)
    qa = coeff.get("UAT", .05) * (disc + cont + ux + des) + coeff.get("TAT", .05) * dev + coeff.get("DESIGNQA", .05) * des
    scope = spec.get("scope_growth_pct", coeff.get("SCOPE", 0.0)) * (disc + cont + ux + des + dev + pm + client_mtg + qa)
    grand = disc + cont + ux + des + dev + pm + client_mtg + internal_mtg + qa + scope

    out = {
        "Discovery": round(disc, 1), "Content & SEO": round(cont, 1), "UX": round(ux, 1),
        "Design": round(des, 1), "Development": round(dev, 1), "PM": round(pm, 1),
        "Client Meetings": round(client_mtg, 1), "Internal Meetings": round(internal_mtg, 1),
        "QA & Testing": round(qa, 1), "Optional/Scope Growth": round(scope, 1),
        "ESTIMATE TOTAL (hours)": round(grand, 1),
        "feature_subtotals": {k: round(v, 1) for k, v in sub.items()},
    }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", default=BUNDLED_TEMPLATE,
                    help="Template .xlsx (defaults to the copy bundled in the skill's assets/).")
    ap.add_argument("--spec", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    if not os.path.exists(args.template):
        sys.exit(f"Template not found: {args.template}")
    spec = json.load(open(args.spec))

    # Hours only — never compute or emit dollar amounts; drop any stray rate/budget keys.
    spec.pop("hourly_rate", None); spec.pop("budget", None)
    summary = populate(args.template, spec, args.output)
    print(f"Saved: {args.output}\n")
    print("Computed preview in HOURS (file recalculates on open):")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
