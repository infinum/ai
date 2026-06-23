---
name: ui-validation
description: 'Use when: (1) implementing UI from a Figma design, (2) writing or updating snapshot tests, (3) validating UI changes against a design. Enforces the loop: implement with existing components → snapshot → fetch Figma → multimodal compare → fix or STOP-and-ask. Not Cowork-ready — runs the project''s snapshot tests in the user''s local dev environment.'
---

# UI Validation Loop

## Overview

Validate UI against its Figma design using snapshot tests plus a **multimodal visual comparison** — the agent views the recorded snapshot and the Figma screenshot in the same turn and judges whether they match.

This skill is framework-agnostic. It applies to any stack with a snapshot-testing library that records reference images to disk. Adapt the commands and file paths below to whichever library your project uses; the loop itself does not change.

**Two non-negotiable rules:**
- **Match is judged by eye**, not by a pixel-diff script. "Matches" means that when you view both images in the same turn you cannot point to a visible difference.
- **Never customize, duplicate, or replace an existing shared UI component just to match Figma.** If the shared component can't produce what Figma shows, STOP and ask the user. That is a product/design decision, not a coding problem.

## When to use

- Implementing a new view or component from a Figma design
- Updating an existing view whose design changed
- Writing or refreshing snapshot tests
- Verifying a UI change against a Figma reference

## The loop

1. **Implement / update the view** using existing shared components (design tokens, typography, the UI module's building blocks). If nothing fits, STOP and ask before inventing a custom piece.
2. **Write or update a snapshot test** for the view, using the project's snapshot-testing library.
3. **Run the test.** In most libraries the first run fails — it records the reference image. Re-run to verify it loads and matches. See [Step 3 notes](#step-3--running-the-test) for library-specific variations.
4. **Fetch the Figma screenshot** via `mcp__figma__get_screenshot` (parse fileKey and node-id from the URL the user gave you).
5. **Compare both images in the same turn.** Read the snapshot PNG, fetch the Figma screenshot, enumerate every observable difference.
6. **Decide:**
   - No visible diff → done.
   - Visible diff, fixable with existing components → **delete the old snapshot image**, go to step 1.
   - Fix would require breaking / duplicating / customizing a shared component → **STOP and ask.**
   - Diff is ambiguous (you can't tell which is correct) → **STOP and ask.**
   - Repeated fix attempts aren't converging on a match → **STOP and ask.**

## Step 3 — Running the test

Snapshot libraries fall into two broad patterns:

- **Record-on-first-run**: the first run fails with a message like "no reference found, recorded snapshot" and writes the reference to disk. Re-run the same test to verify the recorded reference now passes.
- **Explicit record command**: you must run a specific command or flag (e.g., a `record` / `--update-snapshots` variant of the test command) to write the reference, then run the test normally to verify it matches.

If you don't know which pattern your library uses, check its docs before the first run.

- If the verification re-run also fails, the test is flaky or non-deterministic — investigate before continuing (dates, animations, random ordering, environment differences, fonts not yet loaded).
- The failure output contains the exact path of the recorded/expected image file — note it for step 5.

## Step 4 — Fetching Figma

Figma URL format: `figma.com/design/<fileKey>/<fileName>?node-id=X-Y`

- Extract `fileKey` and `node-id` from the URL.
- **Convert `node-id` from `X-Y` to `X:Y`** (hyphen → colon) when passing it to the MCP tool.
- Call `mcp__figma__get_screenshot({ fileKey, nodeId })`.

## Step 5 — Compare (the critical step)

**In a single assistant turn, do all three:**
1. Read the recorded snapshot image using the Read tool (PNG/JPEG files render visually).
2. Fetch the Figma screenshot via `mcp__figma__get_screenshot`.
3. Enumerate every observable difference: colors, spacing, alignment, font weight, corner radii, shadows, icons, missing or extra elements, text content.

**Rule:** saying "matches" or "looks close" without listing concrete observations is a rule violation. Either list the diffs you see, or confirm with a specific statement that no diffs are visible — nothing in between. Don't declare a match based on inspecting your own code; load both images.

## Step 6 — Fixing

When you re-run after a code fix, the library will compare the new rendering against the old recorded reference and fail. To iterate:

1. **Delete the old snapshot image file** from the snapshots directory. The exact location varies by library — check the test output or the library's config for the path.
2. Run the test — records a new reference, fails as in step 3 (or use the library's explicit record command).
3. Re-run the test — verifies the new reference.
4. Go back to step 5 and compare the new recording against Figma.

Skipping the delete step (or forgetting the re-record command) means you'll keep comparing against the stale reference.

## Tolerance table

| Situation | Action |
|-----------|--------|
| No visible diff | Done |
| Visible diff, fixable with existing components | Delete old image, fix, loop |
| Fix needs breaking / duplicating / customizing a shared component | **STOP. Ask.** |
| Diff is ambiguous (unclear which is correct) | **STOP. Ask.** |
| Repeated attempts aren't converging | **STOP. Ask.** |

## Common mistakes

- **Re-recording to make a failing test pass without first verifying the new rendering against Figma.** Always run step 5 on the newly recorded snapshot before moving on.
- **Claiming "matches" without the multimodal comparison.** You must load both images in the same turn and list what you see.
- **Building a custom one-off component to match Figma.** Use the shared component. If it can't produce what Figma shows, that's a question for the user.
- **Treating first-run failure as a real failure** (in record-on-first-run libraries). It's recording. Re-run.
- **Forgetting to delete the old snapshot image** (or forgetting the record command for explicit-record libraries) before re-running after a code fix — the test will keep comparing against the stale reference.
- **Using the wrong test helper / host** (e.g., mobile vs. tablet vs. desktop render size) for the thing being tested.
- **Passing the raw `X-Y` node-id** to the Figma MCP tool instead of converting to `X:Y`.

## Red flags — STOP and ask

- "Close enough — I'll just re-record."
- "I'll build a custom version to match the design."
- Repeated fix attempts on the same diff without progress.
- "The Figma might be out of date." (Maybe — but that's the user's call, not yours.)
- "I can't find the existing component, so I made a new one."
- Any impulse to leave a `// TODO: doesn't quite match design` comment.
