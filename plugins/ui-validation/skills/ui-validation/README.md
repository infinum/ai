# ui-validation

Validate UI against a Figma design using snapshot tests and a multimodal visual comparison. Framework-agnostic — works with any stack that has a snapshot-testing library capable of recording reference images to disk.

## Usage

```
/ui-validation:ui-validation
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

Invoke when you are:

- Implementing a new view or component from a Figma design
- Updating an existing view whose design changed
- Writing or refreshing snapshot tests
- Verifying a UI change against a Figma reference

## What it does

Enforces a strict implement → snapshot → fetch Figma → multimodal compare → fix-or-stop loop:

1. **Implement with existing components** — no custom one-offs to match Figma. If the shared component can't produce the design, stop and ask.
2. **Write/update a snapshot test** using the project's snapshot library.
3. **Run the test** to record or verify the reference image.
4. **Fetch the Figma screenshot** via the Figma MCP server (`mcp__figma__get_screenshot`).
5. **Compare both images in the same turn** — read the snapshot, fetch Figma, enumerate every observable difference. No "looks close" without concrete observations.
6. **Decide:** match → done; fixable diff → delete old reference and loop; requires breaking a shared component, ambiguous, or not converging → **STOP and ask.**

## Why this matters

- **Visual correctness can't be inferred from code.** The only reliable way to verify a view matches Figma is to view both images side by side. This skill forces that step instead of letting it be skipped.
- **Shared components are a shared asset.** Duplicating or customizing them to match a single design propagates complexity across the codebase. Any design that doesn't fit the existing system is a product decision, not a coding one.

## When to use

| Situation | Use skill? |
|---|---|
| Building a new screen/component from Figma | Yes |
| Updating a view after a design change | Yes |
| Writing or refreshing snapshot tests | Yes |
| Validating a PR with UI changes against design | Yes |
| Pure logic / non-visual refactor | No |
| No Figma reference available | No — get one first, or clarify with the designer |

## Requirements

- A snapshot-testing library set up in the project that can record reference images to disk
- The Figma MCP server configured (`mcp__figma__get_screenshot` available)
- A Figma URL or node-id for the design being implemented
