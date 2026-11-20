---
name: figma-design-accessibility-audit
description: Figma Design Accessibility Audit. Audits Figma designs against the Infinum Accessibility Guidelines and creates a new Figma file with two pages - a filled-in checklist with annotated issue examples (linked to the guidelines), and notes for developers. Use when the user asks for an accessibility audit, a11y review, WCAG check or DIR of Figma screens, or says "audit these designs".
---

# Figma Design Accessibility Audit

Produces a new Figma file for a set of designs, with two pages:

1. **a11y design audit** - the Infinum checklist filled in, plus an "Issues found" frame of annotated screenshots. It links to the Infinum Accessibility Guidelines file instead of copying it.
2. **Notes for developers** - everything that is dev-owned (alt text, ARIA, focus order, behaviour), with screenshots.

Always load `figma-use` before any `use_figma` call and pass `skillNames: "figma-use"`. Read `references/lessons.md` before judging anything. Read `references/build-patterns.md` before building.

## Step 0: Ask for inputs (do not assume)

Ask once, in one message:

- **Designs to audit**: Figma URL(s) of the file, page or section. Default scope is **every screen**, not a sample. Say how many frames you found and confirm.
- **Platform(s)**: web / iOS / Android; desktop and mobile frames both.
- **Component library**: in use or none (affects what is a design fix vs a dev fix).
- **Project phase and any fixed constraint** (handoff, locked scope, compliance level).
- **Output team/folder** for the new file (use `whoami` to list teams if unsure).
- **Audit file name**. Default: `<Project> Designs Accessibility Audit`.

Source files (user may swap for newer versions):
- Infinum Accessibility Guidelines: file key `XHKlFNWIQAEU81KlhrtjJY`. Examples node `510:29462`, checklist template node `518:30382`. Example frames link as `…/Accessibility-Guidelines?node-id=3827-<id>`.
- Status icons come from the guidelines library (see `references/build-patterns.md`).

Before building anything, show a short checklist plan (the pages you will create, the frames in scope, and the steps below) and wait for the user's approval.

## Step 1: Plan and set up

1. `create_session` for the guidelines file, the file to audit, and (after creating it) the new audit file.
2. `create_new_file` for the audit file. Rename page 1 to `a11y design audit`. Add the page `Notes for developers`.
3. Read the checklist template (`get_metadata`, `get_design_context`, `get_screenshot`) and replicate its structure natively. Figma cannot copy nodes across files by API, so rebuild with the Plugin API. Import the status icon components with `importComponentByKeyAsync`.

## Step 2: Audit

Work through **all frames** and all 60 criteria. Use programmatic checks, not eyeballing:

- Text contrast (WCAG luminance, solid ancestor background; flag text over images as unmeasurable, not failing).
- Non-text contrast (3:1) for control boundaries and meaningful icons.
- Touch-target sizes: measure the actual interactive container, not the glyph. Always check the surrounding frame; a 24px icon inside a 44px button passes.
- Text sizes, component variants (focus, error, disabled states exist or not), tab/heading/landmark annotations, form labels and cues, error states.

Verify every claim against the file before writing it. If unsure, measure again. Wrong findings cost trust.

Sort each finding by **owner** using `references/lessons.md`:
- **Design-owned** -> audit page.
- **Dev-owned** -> Notes for developers only.
- **Not yours** (copy, legal text, placeholder content, stock photos, annotated behaviour) -> omit.

## Step 3: Fill the checklist (page: a11y design audit)

One top-level frame: header (title, source link, a link to the Infinum Accessibility Guidelines file `https://www.figma.com/design/XHKlFNWIQAEU81KlhrtjJY/Accessibility-Guidelines`, scope, severity legend), status legend, then 5 columns: Perceivable, Operable, Understandable, Robust, European Web Accessibility Directive.

Rules:
- **Keep every guideline (60).** Criteria that pass get one generic finding: `All audited screens` / `Passes. No issues found in the audited designs.` with the pass icon. No specific passing examples.
- Not-applicable criteria stay with the N/A icon and a one-line reason.
- Criteria not verifiable from static design use the **to be reviewed once implemented** icon (and a reworded "check once implemented" sentence).
- Each criterion title ends with a blue `↗` that hyperlinks (only the arrow, never the whole title) to its example in the guidelines file.
- Each finding: the frame name as a blue underlined link to the original frame (hyperlink to the node), a severity emoji plus a one-to-two sentence comment, and the status icon.
- Severity: 🔴 must fix, 🟠 should address, 🔵 consider. **Never use 🟢**: it reads as a pass.
- When a finding matches an annotated example, add a line `See annotation: <example>, callout n ↗` hyperlinked to that callout.
- Show only what needs attention; no commentary on things that are fine beyond the generic pass.

## Step 4: Issues found (separate top-level frame below the checklist)

Build one top-level frame holding a grid of cards, one card per audited screen or component that has at least one design-owned issue. Each card is named `Example / <title>` and contains:

- **Header:** the example title, ending with a blue `↗` that links to the original frame.
- **Screenshot:** a cropped screenshot of the screen inside a clipping frame, with a red dashed outline around each issue and a numbered red marker next to it (see "Annotated examples" in `references/build-patterns.md`).
- **Callout column:** beside the screenshot, one callout card per marker, in marker order. Each card has a number badge matching the marker, the severity emoji with the criterion title, and a one-sentence description of the issue.

Only design-owned issues get a callout. Include only examples with at least one real issue. Re-check callout positions by screenshot after placing them.

## Step 5: Notes for developers page

One frame, 2200px wide, sections with rows `where | suggested spec | checklist item | owner chip` (Dev / Design / Content / Product / QA):

1. Global page structure (landmarks, headings, skip link)
2. Alt text and accessible names (suggested text per image/icon; descriptive link text)
3. Focus order and keyboard behaviour (tab order per page, focus trap, Esc, focus return)
4. Forms (labels, autocomplete/input purpose, error association, required)
5. Components and ARIA patterns (accordion, tabs, toggle, dialog, carousel, video)
6. Announcements and dynamic content (live regions, status messages)
7. Needs design input (open questions for the designer)
8. QA checks

Sections 1-6 end with **Visual references**: cloned screenshots with blue dashed outlines and blue numbered markers plus a legend. Include screenshots wherever they help. Use real element names from the designs.

## Step 6: Verify and report

- Count: 60 Point frames; every Point has at least one Finding.
- Screenshot each column and each new frame; fix clipping, overlaps, stray nodes, bad link ranges.
- Return and keep node IDs. Remove any stray uploads.
- Final message: link to the file, counts by severity, which pages exist, what you could not measure (photos as backgrounds, hover/focus behaviour, off-states), and anything needing human review. Remind that AI output must be reviewed before it reaches a client, and that claims about contrast are estimates where noted.

If the `designer-toolkit:ux-writing` skill is installed, use it for the finding copy. It is optional; without it, keep each finding to one or two plain sentences.
