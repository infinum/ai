#!/usr/bin/env python3
"""
generate_sheet.py — PDD Competitive Analysis spreadsheet generator

Sheet 1 — "Competitive Analysis"
  - IBM Plex Sans font throughout
  - Blue (#007ACC) header row for competitor names
  - Grey (#EFEFEF) category header rows
  - Dark (#2E2F32) Total Grade row
  - 0–3 scoring per metric with auto-height Rationale column
  - SUM subtotals per category, Total Grade, Overall Percentage rows
  - Optional Site Metrics section below

Sheet 2 — "Summary"
  - Strengths + Weaknesses table per competitor
  - Opportunities section for the client
"""

import argparse
import json
import math
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# ── Palette ────────────────────────────────────────────────────────────────
BLUE        = "FFD8262D"
WHITE       = "FFFFFFFF"
DARK        = "FF2E2F32"
GREY        = "FFEFEFEF"
GREEN_LIGHT = "FFE8F5E9"   # strengths tint
RED_LIGHT   = "FFFCE4EC"   # weaknesses tint
AMBER_LIGHT = "FFFFF8E1"   # opportunities tint
GREEN_HDR   = "FF388E3C"
RED_HDR     = "FFC62828"
AMBER_HDR   = "FFF57F17"
BLUE_LIGHT  = "FFFAE8E8"   # client opportunity tint

# ── Fonts ──────────────────────────────────────────────────────────────────
def font(size=11, bold=False, color=DARK, name="Helvetica Neue"):
    return Font(name=name, size=size, bold=bold, color=color)

# ── Fills ──────────────────────────────────────────────────────────────────
def solid(hex_color):
    return PatternFill("solid", fgColor=hex_color)

# ── Borders ────────────────────────────────────────────────────────────────
THIN      = Side(style="thin",   color="FFD0D0D0")
THIN_DARK = Side(style="thin",   color=DARK)
MED       = Side(style="medium", color="FFB0B0B0")

def thin_box():
    return Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

def dark_box():
    return Border(left=THIN_DARK, right=THIN_DARK,
                  top=THIN_DARK, bottom=THIN_DARK)

def med_box():
    return Border(left=MED, right=MED, top=MED, bottom=MED)

# ── Alignment helpers ──────────────────────────────────────────────────────
CENTER_V  = Alignment(horizontal="center", vertical="center", wrap_text=False)
RIGHT_V   = Alignment(horizontal="right",  vertical="center", wrap_text=False)
LEFT_WRAP = Alignment(horizontal="left",   vertical="top",    wrap_text=True)
LEFT_MID  = Alignment(horizontal="left",   vertical="center", wrap_text=True)

# ── Cell writer ────────────────────────────────────────────────────────────
def write(ws, row, col, value, *, fnt=None, fill=None, align=None,
          border=None, number_format=None):
    cell = ws.cell(row=row, column=col, value=value)
    if fnt:           cell.font          = fnt
    if fill:          cell.fill         = fill
    if align:         cell.alignment    = align
    if border:        cell.border       = border
    if number_format: cell.number_format = number_format
    return cell

# ── Row-height estimator ───────────────────────────────────────────────────
# Approximates how many lines a string will occupy in a wrapped column,
# then converts to Excel row-height points (≈ 14 pt per line at size 10–11).
CHAR_WIDTH_PX  = 7.0   # average character width in px at size 10
PT_PER_LINE    = 15    # row-height points per wrapped line
MIN_ROW_HEIGHT = 36    # minimum for metric rows (fits 2 lines comfortably)
PADDING_PT     = 8     # top + bottom padding allowance

def estimate_height(text: str, col_width_chars: float,
                    font_size: int = 10,
                    min_height: int = MIN_ROW_HEIGHT) -> int:
    """Return a row height in points that fits the wrapped text."""
    if not text:
        return min_height
    scale = font_size / 10.0
    effective_chars = col_width_chars / scale
    # Split on explicit newlines first, then wrap each paragraph
    paragraphs = str(text).split("\n")
    total_lines = 0
    for para in paragraphs:
        if not para:
            total_lines += 1
            continue
        total_lines += max(1, math.ceil(len(para) / effective_chars))
    height = int(total_lines * PT_PER_LINE * scale + PADDING_PT)
    return max(height, min_height)


# ══════════════════════════════════════════════════════════════════════════
#  SHEET 1 — Competitive Analysis
# ══════════════════════════════════════════════════════════════════════════

def build_analysis_sheet(wb: Workbook, data: dict) -> list:
    """Builds the scoring sheet. Returns the ordered competitors list."""
    ws = wb.active
    ws.title = "Competitive Analysis"

    project_name = data.get("project_name", "Competitive Analysis")
    client_name  = data.get("client_name",  "Client")
    categories   = data.get("categories",   [])
    site_metrics = data.get("site_metrics", [])

    # Derive ordered competitor list (client always first)
    competitors: list[str] = []
    for cat in categories:
        for metric in cat.get("metrics", []):
            for name in metric.get("scores", {}):
                if name not in competitors:
                    competitors.append(name)
            break
        if competitors:
            break
    if client_name in competitors:
        competitors.remove(client_name)
    competitors.insert(0, client_name)
    n_comp = len(competitors)

    # ── Column layout ──────────────────────────────────────────────────────
    COL_GUTTER      = 1   # A  — narrow gutter
    COL_LABEL       = 2   # B  — metric label  (width 64)
    COL_FIRST_SCORE = 3   # C  — first competitor score
    COL_LAST_SCORE  = COL_FIRST_SCORE + n_comp - 1
    COL_RATIONALE   = COL_LAST_SCORE + 1
    COL_NOTES       = COL_RATIONALE + 1

    RATIONALE_COL_WIDTH = 52.0   # chars — used for height estimation

    ws.column_dimensions[get_column_letter(COL_GUTTER)].width   = 3.5
    ws.column_dimensions[get_column_letter(COL_LABEL)].width    = 64.0
    for i in range(n_comp):
        ws.column_dimensions[get_column_letter(COL_FIRST_SCORE + i)].width = 14.0
    ws.column_dimensions[get_column_letter(COL_RATIONALE)].width = RATIONALE_COL_WIDTH
    ws.column_dimensions[get_column_letter(COL_NOTES)].width    = 22.0

    row = 1

    # ── Header block ───────────────────────────────────────────────────────
    ws.row_dimensions[row].height = 23
    write(ws, row, COL_LABEL, "DISCOVERY",
          fnt=font(11, color=DARK),
          align=Alignment(vertical="bottom"))
    row += 1

    ws.row_dimensions[row].height = 32
    write(ws, row, COL_LABEL, project_name,
          fnt=font(28, color=DARK), align=Alignment(vertical="center"))
    write(ws, row, COL_FIRST_SCORE, "Scoring: 0–3",
          fnt=font(12, bold=True, color=DARK),
          align=Alignment(horizontal="left", vertical="bottom", wrap_text=True))
    row += 1

    ws.row_dimensions[row].height = 24
    legend = [
        (COL_FIRST_SCORE,     "0 = not at all / doesn't work"),
        (COL_FIRST_SCORE + 1, "1 = minimal / inconsistent"),
        (COL_FIRST_SCORE + 2, "2 = adequate / more often than not"),
        (COL_FIRST_SCORE + 3, "3 = excellent / all the time"),
    ]
    for col_idx, text in legend:
        if col_idx <= COL_LAST_SCORE:
            write(ws, row, col_idx, text,
                  fnt=font(9, color=DARK),
                  align=Alignment(horizontal="left", vertical="bottom", wrap_text=True))
    row += 1

    ws.row_dimensions[row].height = 28
    write(ws, row, COL_LABEL, f"Client: {client_name}",
          fnt=font(12, color=DARK),
          align=Alignment(horizontal="left", vertical="top"))
    row += 1

    # ── Competitor header row ──────────────────────────────────────────────
    ws.row_dimensions[row].height = 30
    for col in [COL_GUTTER, COL_LABEL, COL_NOTES]:
        write(ws, row, col, None, fill=solid(BLUE))
    for i, name in enumerate(competitors):
        write(ws, row, COL_FIRST_SCORE + i, name,
              fnt=font(12, bold=True, color=WHITE),
              fill=solid(BLUE),
              align=RIGHT_V,
              border=thin_box())
    write(ws, row, COL_RATIONALE, "Rationale",
          fnt=font(12, bold=True, color=WHITE),
          fill=solid(BLUE),
          align=LEFT_MID,
          border=thin_box())
    row += 1

    category_sum_rows: list[int] = []

    # ── Categories + metrics ───────────────────────────────────────────────
    for cat in categories:
        cat_name   = cat.get("name", "Category")
        metrics    = cat.get("metrics", [])
        n_metrics  = len(metrics)
        cat_row    = row
        total_poss = n_metrics * 3

        ws.row_dimensions[cat_row].height = 30
        write(ws, cat_row, COL_GUTTER, None, fill=solid(GREY), border=thin_box())
        write(ws, cat_row, COL_LABEL, cat_name,
              fnt=font(14, color=DARK), fill=solid(GREY),
              align=LEFT_MID, border=thin_box())
        for i in range(n_comp):
            col     = COL_FIRST_SCORE + i
            col_ltr = get_column_letter(col)
            write(ws, cat_row, col,
                  f"=SUM({col_ltr}{cat_row+1}:{col_ltr}{cat_row+n_metrics})",
                  fnt=font(12, color=DARK), fill=solid(GREY),
                  align=RIGHT_V, border=thin_box())
        write(ws, cat_row, COL_RATIONALE, None,
              fill=solid(GREY), border=thin_box())
        write(ws, cat_row, COL_NOTES, f"Total possible: {total_poss}",
              fnt=font(11, color=DARK), fill=solid(GREY),
              align=LEFT_MID, border=thin_box())
        category_sum_rows.append(cat_row)
        row += 1

        for metric in metrics:
            label     = metric.get("label", "")
            scores    = metric.get("scores", {})
            rationale = metric.get("rationale", "")

            # Auto-size row height to fit the rationale text
            h = estimate_height(rationale, RATIONALE_COL_WIDTH, font_size=10)
            # Also make sure the label fits
            h = max(h, estimate_height(label, 64.0, font_size=11))
            ws.row_dimensions[row].height = h

            write(ws, row, COL_GUTTER, None)
            write(ws, row, COL_LABEL, label,
                  fnt=font(11, color=DARK), align=LEFT_WRAP)

            for i, comp in enumerate(competitors):
                score = scores.get(comp)
                write(ws, row, COL_FIRST_SCORE + i, score,
                      fnt=font(12, color=DARK),
                      align=CENTER_V,
                      border=Border(bottom=THIN, left=THIN, right=THIN))

            write(ws, row, COL_RATIONALE, rationale,
                  fnt=font(10, color=DARK),
                  align=LEFT_WRAP,
                  border=Border(bottom=THIN, left=THIN, right=THIN))
            row += 1

    # ── Total Grade row ────────────────────────────────────────────────────
    ws.row_dimensions[row].height = 32
    write(ws, row, COL_GUTTER, None, fill=solid(DARK), border=dark_box())
    write(ws, row, COL_LABEL, "Total Grade",
          fnt=font(14, color=WHITE), fill=solid(DARK),
          align=LEFT_MID, border=dark_box())
    for i in range(n_comp):
        col     = COL_FIRST_SCORE + i
        col_ltr = get_column_letter(col)
        refs    = ",".join(f"{col_ltr}{r}" for r in category_sum_rows)
        write(ws, row, col, f"=SUM({refs})",
              fnt=font(12, bold=True, color=WHITE),
              fill=solid(DARK), align=RIGHT_V, border=dark_box())
    total_grade_row = row
    write(ws, row, COL_RATIONALE, None, fill=solid(DARK), border=dark_box())
    max_possible = sum(len(c.get("metrics", [])) for c in categories) * 3
    write(ws, row, COL_NOTES, f"Total possible = {max_possible}",
          fnt=font(11, color=WHITE), fill=solid(DARK),
          align=LEFT_MID, border=dark_box())
    row += 1

    # ── Total Possible + Overall Percentage ───────────────────────────────
    ws.row_dimensions[row].height = 22
    write(ws, row, COL_LABEL, "Total Possible Score",
          fnt=font(12, color=DARK),
          align=Alignment(horizontal="left", vertical="bottom", wrap_text=True))
    for i in range(n_comp):
        write(ws, row, COL_FIRST_SCORE + i, max_possible,
              fnt=font(12, color=DARK), align=RIGHT_V)
    total_poss_row = row
    row += 1

    ws.row_dimensions[row].height = 22
    write(ws, row, COL_LABEL, "Overall Percentage",
          fnt=font(12, color=DARK),
          align=Alignment(horizontal="left", vertical="bottom", wrap_text=True))
    for i in range(n_comp):
        col     = COL_FIRST_SCORE + i
        col_ltr = get_column_letter(col)
        write(ws, row, col,
              f"={col_ltr}{total_grade_row}/{col_ltr}{total_poss_row}",
              fnt=font(12, color=DARK), align=RIGHT_V,
              number_format="0%")
    row += 2

    # ── Site Metrics section ───────────────────────────────────────────────
    if site_metrics:
        ws.row_dimensions[row].height = 30
        write(ws, row, COL_LABEL, "Site Metrics",
              fnt=Font(name="Helvetica Neue", size=14, color=DARK),
              fill=solid(GREY),
              align=LEFT_MID, border=thin_box())
        for i in range(n_comp):
            write(ws, row, COL_FIRST_SCORE + i, None,
                  fill=solid(GREY), border=thin_box())
        write(ws, row, COL_RATIONALE, None, fill=solid(GREY), border=thin_box())
        row += 1
        for sm in site_metrics:
            ws.row_dimensions[row].height = 22
            write(ws, row, COL_LABEL, sm.get("label", ""),
                  fnt=font(11, color=DARK), align=LEFT_WRAP)
            values = sm.get("values", {})
            for i, comp in enumerate(competitors):
                write(ws, row, COL_FIRST_SCORE + i, values.get(comp, ""),
                      fnt=font(11, color=DARK), align=CENTER_V,
                      border=Border(bottom=THIN))
            row += 1

    ws.freeze_panes = ws.cell(row=6, column=COL_FIRST_SCORE)
    ws.sheet_properties.tabColor = "007ACC"

    return competitors


# ══════════════════════════════════════════════════════════════════════════
#  SHEET 2 — Summary
# ══════════════════════════════════════════════════════════════════════════

SUMMARY_LABEL_WIDTH  = 28.0   # col A — competitor name
SUMMARY_CONTENT_WIDTH = 72.0  # col B — content

def _write_section_header(ws, row: int, label: str,
                           bg: str, text_color: str = WHITE) -> int:
    ws.row_dimensions[row].height = 28
    write(ws, row, 1, label,
          fnt=font(13, bold=True, color=text_color),
          fill=solid(bg),
          align=LEFT_MID,
          border=thin_box())
    write(ws, row, 2, None, fill=solid(bg), border=thin_box())
    return row + 1


def _write_bullet_rows(ws, row: int, items: list[str],
                        fill_color: str, font_color: str = DARK,
                        col_width: float = SUMMARY_CONTENT_WIDTH) -> int:
    for item in items:
        text = f"• {item}"
        h    = estimate_height(text, col_width, font_size=11, min_height=28)
        ws.row_dimensions[row].height = h
        write(ws, row, 1, None,
              fill=solid(fill_color),
              border=Border(left=THIN, bottom=THIN))
        write(ws, row, 2, text,
              fnt=font(11, color=font_color),
              fill=solid(fill_color),
              align=LEFT_WRAP,
              border=Border(right=THIN, bottom=THIN))
        row += 1
    return row


def build_summary_sheet(wb: Workbook, data: dict, competitors: list[str]):
    ws = wb.create_sheet("Summary")

    client_name  = data.get("client_name",  "Client")
    project_name = data.get("project_name", "Competitive Analysis")
    summary      = data.get("summary", {})
    opps         = data.get("opportunities", [])

    ws.column_dimensions["A"].width = SUMMARY_LABEL_WIDTH
    ws.column_dimensions["B"].width = SUMMARY_CONTENT_WIDTH
    ws.column_dimensions["C"].width = 4   # right gutter

    row = 1

    # ── Title ──────────────────────────────────────────────────────────────
    ws.row_dimensions[row].height = 23
    write(ws, row, 1, "DISCOVERY", fnt=font(11, color=DARK),
          align=Alignment(vertical="bottom"))
    row += 1

    ws.row_dimensions[row].height = 32
    write(ws, row, 1, f"{project_name} — Summary",
          fnt=font(22, color=DARK), align=Alignment(vertical="center"))
    row += 2

    # ── Per-competitor Strengths & Weaknesses ─────────────────────────────
    ws.row_dimensions[row].height = 30
    write(ws, row, 1, "Competitor",
          fnt=font(12, bold=True, color=WHITE),
          fill=solid(BLUE), align=LEFT_MID, border=thin_box())
    write(ws, row, 2, "Strengths & Weaknesses",
          fnt=font(12, bold=True, color=WHITE),
          fill=solid(BLUE), align=LEFT_MID, border=thin_box())
    row += 1

    # ── Determine display order: client first, then others ─────────────────
    ordered = [client_name] + [c for c in competitors if c != client_name]

    for comp in ordered:
        comp_data   = summary.get(comp, {})
        strengths   = comp_data.get("strengths",   ["—"])
        weaknesses  = comp_data.get("weaknesses",  ["—"])
        is_client   = (comp == client_name)
        name_bg     = "FF007ACC" if is_client else DARK
        name_color  = WHITE

        # Competitor name cell (spans both strengths + weaknesses rows visually
        # via a top-label row, then content below)
        ws.row_dimensions[row].height = 28
        write(ws, row, 1, comp,
              fnt=font(13, bold=True, color=name_color),
              fill=solid(name_bg),
              align=LEFT_MID,
              border=thin_box())
        write(ws, row, 2, None, fill=solid(name_bg), border=thin_box())
        row += 1

        # Strengths sub-header
        ws.row_dimensions[row].height = 22
        write(ws, row, 1, "  Strengths",
              fnt=font(10, bold=True, color=GREEN_HDR),
              fill=solid(GREEN_LIGHT), align=LEFT_MID,
              border=Border(left=THIN, bottom=THIN))
        write(ws, row, 2, None, fill=solid(GREEN_LIGHT),
              border=Border(right=THIN, bottom=THIN))
        row += 1
        row = _write_bullet_rows(ws, row, strengths, GREEN_LIGHT)

        # Weaknesses sub-header
        ws.row_dimensions[row].height = 22
        write(ws, row, 1, "  Weaknesses",
              fnt=font(10, bold=True, color=RED_HDR),
              fill=solid(RED_LIGHT), align=LEFT_MID,
              border=Border(left=THIN, bottom=THIN))
        write(ws, row, 2, None, fill=solid(RED_LIGHT),
              border=Border(right=THIN, bottom=THIN))
        row += 1
        row = _write_bullet_rows(ws, row, weaknesses, RED_LIGHT)

        # Spacer between competitors
        ws.row_dimensions[row].height = 8
        row += 1

    row += 1

    # ── Opportunities for the client ──────────────────────────────────────
    ws.row_dimensions[row].height = 30
    write(ws, row, 1, "🔍  Opportunities",
          fnt=font(14, bold=True, color=WHITE),
          fill=solid(BLUE), align=LEFT_MID, border=thin_box())
    write(ws, row, 2,
          f"Areas where {client_name} can differentiate and lead",
          fnt=font(11, color=WHITE),
          fill=solid(BLUE), align=LEFT_MID, border=thin_box())
    row += 1

    if opps:
        for opp in opps:
            title    = opp.get("title", "")
            detail   = opp.get("detail", "")
            combined = f"{title}\n{detail}" if detail else title
            h = estimate_height(combined, SUMMARY_CONTENT_WIDTH,
                                font_size=11, min_height=44)
            ws.row_dimensions[row].height = h
            write(ws, row, 1, title,
                  fnt=font(11, bold=True, color=DARK),
                  fill=solid(BLUE_LIGHT),
                  align=Alignment(horizontal="left", vertical="top",
                                  wrap_text=True),
                  border=Border(left=THIN, bottom=THIN, top=THIN))
            write(ws, row, 2, detail,
                  fnt=font(11, color=DARK),
                  fill=solid(BLUE_LIGHT),
                  align=LEFT_WRAP,
                  border=Border(right=THIN, bottom=THIN, top=THIN))
            row += 1
    else:
        ws.row_dimensions[row].height = 30
        write(ws, row, 1, "No opportunities provided.", fnt=font(11, color=DARK),
              align=LEFT_MID)
        row += 1

    ws.sheet_properties.tabColor = "2E2F32"
    ws.freeze_panes = "A4"


# ══════════════════════════════════════════════════════════════════════════
#  Entry point
# ══════════════════════════════════════════════════════════════════════════

def build_workbook(data: dict) -> Workbook:
    wb = Workbook()
    competitors = build_analysis_sheet(wb, data)
    build_summary_sheet(wb, data, competitors)
    return wb


def main():
    parser = argparse.ArgumentParser(
        description="Generate PDD Competitive Analysis spreadsheet"
    )
    parser.add_argument("--data",   required=True, help="Path to JSON data file")
    parser.add_argument("--output", required=True, help="Output .xlsx path")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"ERROR: data file not found: {data_path}", file=sys.stderr)
        sys.exit(1)

    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    wb = build_workbook(data)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
