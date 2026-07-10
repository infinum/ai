# Benchmarking from past estimates

The team keeps every past estimate in the **Estimates** shared drive
(folder ID `0ALPxUHmMH5ICUk9PVA`). Use it for **general benchmarking** — to sanity-check
department splits and totals — not to copy another project's numbers wholesale. Every project
is different; past estimates anchor your judgment, they don't replace it.

## How to benchmark (general approach)

1. **Find analogous estimates.** Search the Estimates drive for past work of a similar
   *type* and *scope* to the new RFP. Use the Drive connector's `search_files` with the
   folder as parent, e.g.:
   `parentId = '0ALPxUHmMH5ICUk9PVA' and title contains 'website'`
   (or `'app'`, `'branding'`, `'usability'`, `'redesign'`…). Match on what the project *is*:
   marketing site vs. web app vs. native app vs. brand vs. research-only differ a lot.
   Pass `excludeContentSnippets: true` and a small `pageSize` to keep results manageable.

2. **Read 2–4 of the closest matches.** Use `read_file_content` on each. Look at:
   - the **grand total** (Summary `F2`) and overall size band;
   - the **department split** — roughly what share went to Discovery / UX / Design / Dev / PM;
   - the **feature list shape** — how granular, how many line items, what got bundled;
   - any **complexity factors / meeting cadences** they used.

3. **Derive ranges, not point answers.** From the comparables, form rough expectations
   (total band, department %s). Use these to pressure-test the per-feature hours you propose.

4. **Build the new estimate from the RFP**, then check it against those ranges. If a section
   is well outside the benchmark band, justify it (note in Assumptions) or revisit the hours.
   Flag notable deviations to the user.

## Guardrails (*Simplicity Takes Work* — pressure-test, don't guess)
- Treat all proposed hours as **drafts for the team to review**, and say so plainly.
- Don't fabricate false precision. Round to sensible increments.
- Don't claim a past project "proves" a number — cite it as a comparable, by name, so the user
  can check it.
- When the RFP is thin, list the **assumptions** you estimated against rather than inventing
  detail; surface the open questions for the user to confirm with the client.

## Reusable reference points already in the folder
- `__Estimate Template - 2026 Format` — the current template (what this skill fills).
- `__Estimate Template - Multiple Phases [2023 Format]` — older multi-phase variant.
- A wide back-catalogue of past estimates spanning websites, web and native apps, branding,
  and research engagements.
