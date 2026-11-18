# figma-design-accessibility-audit

Audit Figma designs against the Infinum Accessibility Guidelines and produce a new Figma file with three pages. Use when the user asks for an accessibility audit, a11y review, WCAG check or DIR of Figma screens, or says "audit these designs", or mentions `/infinum-accessibility:figma-design-accessibility-audit`.

## Usage

```
/infinum-accessibility:figma-design-accessibility-audit
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill asks for the designs to audit (default: every screen), platform, component library, project phase and constraints, and where to create the audit file. It shows a short plan and waits for approval before building.

## What it produces

A new Figma file with three pages:

1. **a11y design audit**: the Infinum checklist (60 criteria) filled in, plus an "Issues found" frame of annotated screenshots.
2. **Guidelines**: a copy of the Infinum guideline examples.
3. **Notes for developers**: dev-owned items (alt text, ARIA, focus order, behaviour) with screenshots.

Findings use severity labels 🔴 must fix, 🟠 should address, 🔵 consider. Issues are sorted by owner, so dev-owned items go to the developer notes and copy or content issues are left out.

## Requirements

- Figma MCP connector (`use_figma`, `create_new_file`, `get_metadata`, `get_design_context`, `get_screenshot`).
- The `figma-use` skill from the official Figma plugin, loaded before every `use_figma` call.
- Access to the Infinum Accessibility Guidelines file.

## Part of

`infinum-accessibility`, together with `accessibility-audit-report`, which logs the audit's findings in a Google Doc report and VPAT/ACR.
