# Lessons from past audits (corrections the designer made)

## Ownership: who fixes it?

**Design-owned (goes in the audit):**
- Missing component states: error, focus, hover/pressed where design must supply, disabled, off-states
- Contrast failures (text and non-text) that are design choices
- Touch targets too small (after measuring the real container)
- Missing skip-link style (hidden and visible-on-focus states)
- No format hints / labels / cues; critical instructions buried
- Missing designs for required states (e.g. video player when video content exists)

**Dev-owned (Notes for developers only, never the audit):**
- Text alternatives of any kind (alt text, accessible names, "make link text more descriptive"). Anything under "Include text alternatives" is a dev note.
- ARIA roles/states, semantics, headings/landmarks implementation
- Focus order, focus trap, Esc handling, focus return, tab order
- Hover/focus *behaviour* of menus
- Scalable UI / text spacing / 200% zoom implementation (note only; may be to-review)
- Screen-reader announcements

**Do not report:**
- Stock photos: they are FPO. Never mention them.
- Placeholder or Lorem content
- Legal or consent copy (outside the designer's control)
- Things the user can already do in the design (e.g. review fields before submit)
- Passive indicators (carousel dots) as controls
- Decorative container borders (cards, accordion rows, dividers) for 3:1 non-text contrast
- Scrims over photos where the measured contrast passes

## Verify before claiming

- **Measure the real touch target.** A 24px icon in a 44x44 button/frame passes. Check the parent container before flagging (menu/close buttons, social links were wrongly flagged once).
- **Check mobile frames too.** Do not assume controls missing on mobile because you looked at desktop (carousel arrows existed on mobile).
- **Check interactions in the design and annotations.** Do not infer behaviour: e.g. a "can't find my state" control showed an in-page box, not navigation.
- **Check section order.** A conditional section after Patient/Student is not "right after DOB". Read the actual layer order.
- **Do not assume an element exists.** "Chip-remove icons" were mentioned without existing in the frames. Search the file.
- **Pills/tags that are links are clickable**; check with the designer if ambiguous.
- **Carousels:** check whether they auto-update. Manual carousels need no pause control.
- **Text over images** cannot be measured against a flat colour. Say so and compute the scrim if the user asks (needed: about 54% black behind 16px text, 42% behind 24px for 4.5:1 / 3:1 on white-ish photos).
- **Disabled controls** are exempt from contrast, but flag if the only instruction is in disabled text.

## Writing findings

- Lead with what is wrong in one or two sentences, name the fix. No essays.
- Short, plain, no jargon. Sentences about measured values include the number (e.g. 1.49:1 vs 3:1).
- Where a criterion cannot be verified from static frames, use the **to be reviewed once implemented** icon and say "Check once implemented that …".
- Unclear sentences get rewritten. Example: "Check the off-state track and thumb reach 3:1" -> "The toggle's off state isn't designed. Once built, check that the off-state track and thumb are at least 3:1 against their backgrounds."
- If a video/media block is optional but possible (e.g. optional video insert), include it as a to-review item alongside the other media pages.
- Keep scope: no redesign suggestions beyond the fix for the issue.

## Scope and structure rules

- Audit all frames, not a representative sample.
- Keep all 60 guidelines. Passing ones: one generic "Passes" line. Do not show specific passing examples.
- Do not show "pass" noise in Issues found; examples are for real issues only.
- Remove callouts when the user says an item is dev-only, irrelevant or wrong, and update the matching checklist finding and the dev notes.
- When a checklist item loses its last finding, replace it with the generic pass so the criterion stays.
