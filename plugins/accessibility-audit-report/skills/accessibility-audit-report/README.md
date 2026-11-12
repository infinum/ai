# accessibility-audit-report

Build or update a web or mobile accessibility audit report (Google Doc) in the Infinum format, and generate a matching VPAT/ACR on request. Use when the user is auditing a website, web app, or mobile app against WCAG 2.2 AA, wants findings logged in an audit report, or asks for a VPAT/ACR, or mentions `/accessibility-audit-report:accessibility-audit-report`.

## Usage

```
/accessibility-audit-report:accessibility-audit-report
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill asks whether a report already exists and whether the product is web, mobile, or both, then:

1. **New report** — collects the key information (client, product, versions or URLs, reviewer, test environments and tools), copies a previous report as the template when one is available, and clears all product-specific content. A fresh report starts with zero issues.
2. **Logging issues** — the auditor describes each issue in plain language; the skill turns it into the report's issue template and keeps the severity list, conformance table, counts, and issue numbering in sync.
3. **Screenshots** — each screenshot sent for an issue gets an annotated copy that circles the affected area.
4. **Assessment conclusion** — a short prose summary of themes, strengths, and what needs fixing, with no counts and no specific issues.
5. **VPAT/ACR** — on request, fills a VPAT 2.5Rev (WCAG and 508 edition) from the audit's conformance table.

The skill never invents findings: it only documents issues the auditor reported, showed, or confirmed in testing.

## Requirements

- Google Docs and Google Drive connectors (the report and ACR are Google Docs).
- Python with Pillow for screenshot annotation.

## What the report contains

About the audit (key information, severity scale, conformance scale), executive summary (findings overview, severity list, conformance table, assessment conclusion), methodology, test results across four sections (screen reader, semi-automated, manual, exploratory), and recommendations and next steps.
