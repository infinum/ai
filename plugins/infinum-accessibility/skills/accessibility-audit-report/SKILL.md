---
name: accessibility-audit-report
description: Build or update a web or mobile accessibility audit report (Google Doc) in the Infinum format, and generate a matching VPAT/ACR on request.
---

# Accessibility audit report and VPAT

Use this when the user is auditing a website, web app, or mobile app (Android and/or iOS) against WCAG 2.2 AA (plus platform standards) and wants findings logged in an audit report Google Doc, or wants a VPAT/ACR produced from the audit. The auditor describes each issue in plain language; Claude turns it into the issue template below and keeps every summary in sync.

The format was established on a mobile audit (MS Wallet and MS Verifier). For web audits, keep the same structure and rules and swap the platform-specific parts as noted under "Web vs mobile".

## Never invent findings

Only document issues the auditor has actually reported, shown in a screenshot they sent, or confirmed in testing they described. Never add placeholder, sample, example or speculative issues, and never pad a report to make it look complete.

- A fresh report has zero issues until the auditor reports one: empty testing sections stay empty, counts are 0, the severity list rows are blank, and the conclusion is not written until there are real findings.
- Do not carry issues, screenshots, counts, versions, devices or remarks over from a template or a previous report. Clear them.
- Do not turn a possible concern into an issue. If something looks like a problem but has not been confirmed (for example a contrast ratio that actually passes, or a platform that has not been tested), say so in chat and ask. Record only what was verified, on the platforms and browsers that were verified.
- Do not make up measurements, hex values, ratios, screen names, version numbers or WCAG mappings. If a detail is missing, ask for it or leave the cell blank.
- In the VPAT, do not claim a rating the audit does not support. Rows with no documented issue stay blank for the auditor to confirm (unless they say to treat them as Supports).

## Start: existing report or new one

1. Ask (AskUserQuestion) whether a report already exists and whether the product is web, mobile, or both. If a report exists, get the Google Doc link and work in that doc. If not, create one.
2. For a new report, collect once: client, product name(s), version(s) or URL(s) per product and platform, reviewer name and contact, review completion date, test environments (devices and OS versions, or browsers), and test tools. Do not guess versions if a version field is ambiguous.
3. Build the new report by copying a previous report as a template when one is available (Drive copy), then clear all product-specific content: key information, issue tables, screenshots, summary counts, severity list, conformance table rows, assessment conclusion. If no template is available, build the structure below from scratch. Either way, the result contains no issues.

## Report structure (keep this order and these headings)

- Title block: "Accessibility Audit Report" (prefix with "Mobile App" or "Website" as appropriate) with the product name(s), then Table of contents.
- **About the audit**: Key information table (CLIENT, APP NAME or SITE NAME, VERSION or URL, REVIEWER, CONTACT, REVIEW COMPLETION DATE). Then **Severity scale** table (Critical, High, Medium, Low, Informative with fixed descriptions) and **Conformance Scale** table (Does Not Support, Partially Supports, Supports, Not Applicable).
  - Does Not Support: 5 or more issues are associated with the guideline, or the issue is critical, or the issue appears throughout the product.
  - Partially Supports: 4 or fewer issues. Supports: none found. Not Applicable: the product has no related features.
- **Executive summary** > **Findings overview**: (1) a counts table by severity; (2) the severity list table, one row per severity with each issue listed as "NN Title", sorted by issue number and hyperlinked to the issue's heading; (3) a counts table of Does Not Support / Partially Supports / Supports / Not Applicable that sums to the number of criteria evaluated; (4) the conformance table with columns CONFORMANCE, GUIDELINE, # OF ISSUES, ISSUE LINKS (linked issue numbers). Then **Assessment conclusion**.
- **Audit report & suggested remediation**: **Methodology** (Guidelines followed; Test devices or browsers; Test tools; Testing organization), then **Test results** with four testing sections, each with a short info table (tools used, covered guidelines, user impact) and an "Identified issues" subheading holding the issue tables:
  1. Screen reader testing
  2. Semi-automated testing (automated scanners: contrast, target size)
  3. Manual testing (with accessibility settings on mobile; keyboard, zoom, reflow and text spacing on web)
  4. Exploratory testing (additional usability concerns found through manual testing, for example orientation lock)
- **Recommendations and next steps** table: Fix issues by priority; Receive VPAT; Improve accessibility in SDLC; Future improvements.

An issue belongs in the section for the method that found it. Do not remove a testing section just because it is empty unless the auditor says so.

## Web vs mobile

- Mobile: guidelines followed are WCAG 2.2 AA, Section 508, ADA Title II, Material Design (Android), Human Interface Guidelines (iOS). Screen readers are TalkBack and VoiceOver; scanners are Accessibility Scanner and Accessibility Inspector; manual testing uses OS accessibility settings (font scaling, dark mode, Voice Control and Voice Access, switch control).
- Web: guidelines followed are WCAG 2.2 AA, Section 508, ADA Title II, and WAI-ARIA Authoring Practices where relevant. Screen readers are typically NVDA, JAWS and VoiceOver; scanners are tools such as axe DevTools, WAVE and Lighthouse; manual testing covers keyboard navigation, focus visibility, zoom to 200% and 400% reflow, text spacing, and high contrast or forced colors. Remediation uses HTML, ARIA and CSS instead of View/Compose or UIKit/SwiftUI. Affected OS becomes affected browser or assistive technology combination.
- Criteria that are not applicable to native apps (1.4.12 Text Spacing, 2.4.1 Bypass Blocks, 2.4.5 Multiple Ways) must be evaluated on web, not marked Not Applicable.
- Adjust the "Affected OS" row label and the VPAT product name wording to match the platform.

## Issue table template (8 rows x 2 columns)

Title row `ISSUE | NN Title` (the title paragraph is a heading so it can be linked). Rows in order:

- **DESCRIPTION**: plain language, concise (two to four sentences). Say what happens, who is affected, and the impact. Extra examples are covered by "See screenshots." Do not write verbose lists of instances.
- **AFFECTED OS** (or AFFECTED BROWSER / AT): Android, iOS, or Android, iOS for mobile; browser and screen reader combinations for web.
- **SEVERITY**: Critical, High, Medium, Low, or Informative.
- **AFFECTED SCREEN** (or AFFECTED PAGE): screen or page name(s), or "All screens" and which products for app-wide issues.
- **SCREENSHOT**: the annotated screenshot(s).
- **REMEDIATION**: for issues affecting more than one platform, write the shared instructions once under a combined label (for example "Android and iOS"), then keep only platform-specific steps under separate labels. Never repeat the same fix per platform. Include concrete, implementable steps and a retest instruction.
- **WCAG REFERENCE**: for each criterion, "N.N.N Name (Level X)" followed by its Understanding URL on https://www.w3.org/WAI/WCAG22/Understanding/.

Match the existing doc's fonts, colors, label styling and bullets by copying an existing issue table's formatting rather than inventing new styling.

## Numbering and keeping summaries in sync

- Issue numbers are two digits, sequential in document order across all four sections. Whenever an issue is added, removed or moved, renumber everything: issue titles, severity list entries (re-sorted by number, hyperlinks pointing at the right headings), conformance table ISSUE LINKS, and any cross references.
- On each add or remove, update: findings overview severity counts, the severity list, the conformance table (add the issue number to each WCAG criterion it maps to, update the # OF ISSUES count, move the criterion between conformance rows if the counts change the rating), and the conformance counts.
- An issue that appears throughout the product counts as 5 or more instances, so its WCAG guideline goes under Does Not Support, and its # OF ISSUES cell says "Throughout" instead of a number.
- Conformance counts: criteria with no issue are Supports unless they clearly do not apply (Not Applicable). Common Not Applicable for native apps: media criteria (1.2.x) if there is no media, 1.4.2 if no audio, 1.4.12, 2.4.1, 2.4.5, and 3.1.1/3.1.2 if English only. Keep the total equal to the number of criteria evaluated.
- When an issue is removed (for example the auditor decides it is not an issue), remove its table, its severity list line, its issue links, decrement the counts, and renumber.
- Before saving a new finding, sanity check it against the threshold. Non-text contrast needs 3:1, body text 4.5:1, large text 3:1. If a reported ratio already passes, say so to the auditor before adding it.

## Screenshots

Whenever the auditor sends a screenshot for an issue, always produce an annotated copy that circles the affected area, without asking. Use PIL: draw at 4x to 6x scale and downsample, magenta outlines on light backgrounds, yellow on dark. Circle only what is affected. Send the annotated copy back to the user. Insert annotated images into the SCREENSHOT cell only when the screenshot belongs to an issue; keep a list of annotated screenshots that have no issue yet and mention them when asked what is open.

## Assessment conclusion

Write it only from real, documented findings. Prose, four short paragraphs, with no counts and no specific issues named:

1. Overall: usable in many areas but not yet conformant with WCAG 2.2 AA; issues cluster in a few themes.
2. Strengths: areas where the product does well, only ones the auditor has named or the testing actually showed (for example buttons and controls labeled appropriately and helpful additional context for screen reader users).
3. Most frequent issues and the highest severity issues, described by theme only (for example names, roles and states; announcements of status changes; color contrast; keyboard or switch access; scaling; orientation).
4. In general what needs to be fixed: shared components first, then contrast, scaling and layout, then a retest with the same assistive technologies.

Rewrite it from the current findings whenever the audit changes materially.

## Rules for report text

- Never put notes like "to be confirmed" or "verify" inside the report. Keep open questions in chat.
- Do not remind the auditor to refresh the table of contents.
- Keep descriptions concise and in plain language.
- When the auditor reports a problem on one platform or browser, ask if the others were checked, and record only what was verified.

## Google Docs mechanics

- read_doc output is huge. It is saved to a file; copy it to the scratchpad and parse it with python. Read requests with tabId are not supported.
- Edit with update_doc batchUpdate using requiredRevisionId from the latest read or write. If it fails with a revision mismatch, the auditor edited the doc: re-read and recompute indexes, never reuse old ones.
- Apply requests in descending index order within a batch so earlier indexes stay valid. To replace text in place, insert the new text at the end of the old range, then delete the old range, then reapply styles and links.
- Link severity list entries and conformance cells with updateTextStyle link.headingId pointing at the issue title heading id.
- Non-paragraph body elements have no startIndex in some cases; use e.get('startIndex', 0).
- Build issue tables with insertTable, then fill cells in one batch at descending indexes, then style labels. Verify afterward by re-reading and checking headings are sequential, the severity list is sorted, and conformance cells and counts match.
- If a connector call returns an oversized result, save the output to a file and parse it rather than retrying.
- While working on a long edit, send a brief progress message naming what you are doing.

## VPAT / ACR on request

When the auditor asks for a VPAT or ACR:

1. Scope: confirm which product (it may be one of two; for example one app only). Use the audit's conformance table as the source of ratings.
2. Template: copy an existing ACR in the VPAT 2.5Rev WCAG and 508 edition format (a prior ACR cleared of its product-specific content). If none exists, build it with these parts: title "<Product> Accessibility Conformance Report", "WCAG and 508 Edition (Based on VPAT Version 2.5Rev)", the top fields (Name of Product/Version, Report Date, Product Description, Contact Information, Notes, Evaluation Methods Used, Test devices, Test tools), Applicable Standards/Guidelines table, Terms, WCAG 2.2 Report (Table 1 Level A, Table 2 Level AA, Table 3 Level AAA removed with a note), Revised Section 508 Report (Chapter 3 FPC, Chapter 4 Hardware removed with a note, Chapter 5 Software, Chapter 6 Documentation).
3. Clearing a template: remove everything specific to the old product (top fields, devices and tools, every Conformance Level and Remarks cell) but keep headings, the standards table, terms, "Heading cell" rows, "See WCAG 2.2" rows, the 4.1.1 row and the "Section removed" notes.
4. Fill: Name of Product/Version as "<Product> Mobile Application Android and iOS" for mobile, or the product name and URL for web (no version unless unambiguous); a one-sentence product description; contact is the reviewer only (Accessibility Specialist, Infinum, their email); Notes say the client hired Infinum's Accessibility Team for an independent third party audit and which product the report covers; devices and tools from the audit with bold platform prefixes.
5. Ratings come from the audit only: Does Not Support or Partially Supports for criteria with documented issues, with remarks that summarize those real issues in one or two sentences without issue numbers. For mobile, Not Applicable for media criteria, 1.4.12, 2.4.1 and 2.4.5 (remark: "This criterion is meant for websites") and for 504.x rows (empty remark); for web, evaluate those criteria normally. Map Section 508 rows to the matching WCAG results (302.x functional performance, 502.x interoperability, 503.2 user preferences).
6. Rows with no documented issue are left blank for the auditor to confirm, unless they say to treat them as Supports (then fill Supports with a short remark). Leave the Report Date blank.
7. Fill empty cells by inserting at the cell's start index (descending order), then apply bold to labels as needed.
