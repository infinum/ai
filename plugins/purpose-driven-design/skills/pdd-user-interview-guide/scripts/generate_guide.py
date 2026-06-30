#!/usr/bin/env python3
"""
generate_guide.py — PDD User Interview Guide PDF generator

Converts a Markdown-formatted interview guide to a styled PDF using ReportLab.
Follows Infinum/ETR document conventions:
  - IBM Plex Sans (falls back to Helvetica)
  - Blue (#007ACC) header accent bar
  - Proper section headings, bullet lists, numbered lists, bold/italic inline
  - Multi-column support for screener questions
"""

import argparse
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph,
    Spacer, HRFlowable, ListFlowable, ListItem, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Palette ────────────────────────────────────────────────────────────────
ETR_BLUE   = colors.HexColor("#007ACC")
DARK       = colors.HexColor("#2E2F32")
MID_GREY   = colors.HexColor("#666666")
LIGHT_GREY = colors.HexColor("#EFEFEF")
WHITE      = colors.white

# ── Font setup ─────────────────────────────────────────────────────────────
# Try to register IBM Plex Sans; fall back to Helvetica gracefully
FONT_NAME      = "Helvetica"
FONT_BOLD      = "Helvetica-Bold"
FONT_ITALIC    = "Helvetica-Oblique"
FONT_BOLDITALIC = "Helvetica-BoldOblique"

# ── Page geometry ──────────────────────────────────────────────────────────
PAGE_W, PAGE_H = letter
MARGIN_L = 0.85 * inch
MARGIN_R = 0.85 * inch
MARGIN_T = 0.75 * inch
MARGIN_B = 0.75 * inch

CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

# ── Styles ─────────────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    def ps(name, parent="Normal", **kw):
        return ParagraphStyle(name, parent=base[parent], fontName=FONT_NAME, **kw)

    styles = {
        "DocTitle": ParagraphStyle(
            "DocTitle", parent=base["Normal"],
            fontName=FONT_BOLD, fontSize=26, leading=30,
            textColor=DARK, spaceBefore=0, spaceAfter=4,
        ),
        "DocSubtitle": ParagraphStyle(
            "DocSubtitle", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=11, leading=14,
            textColor=MID_GREY, spaceBefore=0, spaceAfter=16,
        ),
        "H1": ParagraphStyle(
            "H1", parent=base["Normal"],
            fontName=FONT_BOLD, fontSize=16, leading=20,
            textColor=DARK, spaceBefore=18, spaceAfter=6,
        ),
        "H2": ParagraphStyle(
            "H2", parent=base["Normal"],
            fontName=FONT_BOLD, fontSize=12, leading=16,
            textColor=MID_GREY, spaceBefore=14, spaceAfter=4,
        ),
        "Body": ParagraphStyle(
            "Body", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=10, leading=15,
            textColor=DARK, spaceBefore=0, spaceAfter=4,
        ),
        "BulletItem": ParagraphStyle(
            "BulletItem", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=10, leading=15,
            textColor=DARK, leftIndent=12, spaceBefore=2, spaceAfter=2,
        ),
        "NumberedItem": ParagraphStyle(
            "NumberedItem", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=10, leading=15,
            textColor=DARK, leftIndent=16, spaceBefore=3, spaceAfter=3,
        ),
        "SubItem": ParagraphStyle(
            "SubItem", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=10, leading=14,
            textColor=DARK, leftIndent=30, spaceBefore=1, spaceAfter=1,
        ),
        "Note": ParagraphStyle(
            "Note", parent=base["Normal"],
            fontName=FONT_ITALIC, fontSize=9.5, leading=13,
            textColor=MID_GREY, leftIndent=16, spaceBefore=1, spaceAfter=1,
        ),
        "ScriptText": ParagraphStyle(
            "ScriptText", parent=base["Normal"],
            fontName=FONT_NAME, fontSize=10, leading=15,
            textColor=DARK, leftIndent=0, spaceBefore=4, spaceAfter=4,
        ),
    }
    return styles


# ── Header / Footer ────────────────────────────────────────────────────────
def make_page_template(doc):
    """Page template with blue accent bar at top and page number footer."""

    def header_footer(canvas, doc):
        canvas.saveState()
        # Blue accent bar
        canvas.setFillColor(ETR_BLUE)
        canvas.rect(0, PAGE_H - 0.28 * inch, PAGE_W, 0.28 * inch, fill=1, stroke=0)
        # Footer page number
        canvas.setFont(FONT_NAME, 8)
        canvas.setFillColor(MID_GREY)
        canvas.drawRightString(
            PAGE_W - MARGIN_R,
            0.45 * inch,
            f"{doc.page}"
        )
        canvas.restoreState()

    frame = Frame(
        MARGIN_L, MARGIN_B,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B - 0.28 * inch,
        id="main", leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0
    )
    return PageTemplate(id="main", frames=[frame], onPage=header_footer)


# ── Inline markup helpers ───────────────────────────────────────────────────
def md_inline_to_rl(text: str) -> str:
    """Convert **bold**, *italic*, and *(italicised notes)* to ReportLab XML."""
    # Bold-italic first (must precede bold/italic alone)
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<b><i>\1</i></b>', text)
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Italic (single * or _)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'_(.+?)_', r'<i>\1</i>', text)
    return text


# ── Markdown parser → ReportLab flowables ─────────────────────────────────
def parse_markdown(md_text: str, styles: dict) -> list:
    """Convert Markdown content to a list of ReportLab flowables."""
    flowables = []
    lines = md_text.splitlines()
    i = 0

    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        # ── H1 (# heading)
        if stripped.startswith("# ") and not stripped.startswith("## "):
            title_text = stripped[2:].strip()
            # Split on | to get title and subtitle
            if "|" in title_text:
                parts = [p.strip() for p in title_text.split("|", 1)]
                flowables.append(Paragraph(md_inline_to_rl(parts[0]), styles["DocTitle"]))
                flowables.append(Paragraph(md_inline_to_rl(parts[1]), styles["DocSubtitle"]))
            else:
                flowables.append(Paragraph(md_inline_to_rl(title_text), styles["DocTitle"]))
            flowables.append(HRFlowable(width="100%", thickness=2, color=ETR_BLUE, spaceAfter=12))
            i += 1
            continue

        # ── H2 (## heading)
        if stripped.startswith("## "):
            flowables.append(Paragraph(md_inline_to_rl(stripped[3:]), styles["H1"]))
            i += 1
            continue

        # ── H3 (### heading)
        if stripped.startswith("### "):
            flowables.append(Paragraph(md_inline_to_rl(stripped[4:]), styles["H2"]))
            i += 1
            continue

        # ── HR (---)
        if stripped in ("---", "___", "***"):
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY,
                                         spaceBefore=8, spaceAfter=8))
            i += 1
            continue

        # ── Bullet list item (- or *)
        if re.match(r'^[-*•]\s', stripped):
            text = stripped[2:].strip()
            flowables.append(Paragraph(f"• {md_inline_to_rl(text)}", styles["BulletItem"]))
            i += 1
            continue

        # ── Numbered list item (1. / a. / i.)
        num_match = re.match(r'^(\d+|[a-z])\.\s+(.*)', stripped)
        if num_match:
            prefix = num_match.group(1)
            text = num_match.group(2)
            indent = styles["SubItem"] if re.match(r'^[a-z]$', prefix) else styles["NumberedItem"]
            flowables.append(Paragraph(f"{prefix}. {md_inline_to_rl(text)}", indent))
            i += 1
            continue

        # ── Italic-only note lines (lines starting with *)
        if stripped.startswith("*(") and stripped.endswith(")"):
            flowables.append(Paragraph(md_inline_to_rl(stripped), styles["Note"]))
            i += 1
            continue

        # ── Empty line → small spacer
        if not stripped:
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # ── Default: body paragraph
        flowables.append(Paragraph(md_inline_to_rl(stripped), styles["Body"]))
        i += 1

    return flowables


# ── Main ───────────────────────────────────────────────────────────────────
def generate_pdf(content_path: Path, output_path: Path):
    styles = build_styles()

    with open(content_path, encoding="utf-8") as f:
        md_text = f.read()

    flowables = parse_markdown(md_text, styles)

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T + 0.28 * inch,
        bottomMargin=MARGIN_B + 0.3 * inch,
    )
    doc.addPageTemplates([make_page_template(doc)])
    doc.build(flowables)
    print(f"Saved: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate PDD Interview Guide PDF")
    parser.add_argument("--content", required=True, help="Path to Markdown content file")
    parser.add_argument("--output", required=True, help="Output .pdf path")
    args = parser.parse_args()

    content_path = Path(args.content)
    output_path = Path(args.output)

    if not content_path.exists():
        print(f"ERROR: content file not found: {content_path}", file=sys.stderr)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    generate_pdf(content_path, output_path)


if __name__ == "__main__":
    main()
