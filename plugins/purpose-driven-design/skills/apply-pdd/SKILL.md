---
name: apply-pdd
description: >
  Use this skill to apply the PDD framework to a specific project. Triggers whenever
  a user wants to: review a project through a PDD lens, check how PDD principles apply
  to their work, get tool recommendations for a project, audit a project against PDD,
  or understand what PDD means in practice for a specific brief or context. Also trigger
  when the user says "apply PDD", "which tools should we use", "how does PDD apply here",
  "what should we do next", or "map this project to PDD" — even if they don't explicitly
  name a skill. Cowork-ready.
---

# Apply PDD Skill

> **Before you start:** Read `${CLAUDE_SKILL_DIR}/../../instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

This skill reviews the project background gathered so far and walks through each of the
4 PDD Principles — discussing how each one applies to this specific project, flagging any
risks or gaps, and recommending concrete PDD tools to use.

---

## Phase 0: Gather Project Context

Scan the conversation for any project background that has already been shared: briefs,
SOWs, research notes, goals, client descriptions, scope details, constraints.

If no project context is present, ask:

> "To apply the PDD framework to your project, I'll need some background first. Can you
> share a brief description of the project — what it is, who it's for, what success looks
> like, and where you are in the process?"

Wait for the user's response before continuing.

Once context is available, briefly confirm your understanding:

> "Here's what I've got: [1–3 sentence summary of the project]. Is that accurate, or is
> there anything important to add before I run through the principles?"

Wait for confirmation before proceeding to Phase 1.

---

## Phase 1: Apply the 4 Principles

For each of the 4 PDD Principles, write a short analysis (3–6 sentences) that:

1. **States how the principle applies** to this specific project — not a generic definition,
   but a grounded observation about this project's context, goals, or constraints.
2. **Flags any risks or gaps** if there are signs the principle may be under-served
   (e.g. skipping research, unclear goals, assumptions being made without data).
3. **Notes if the principle is well-served** if the project context suggests it's already
   being handled well.

Use this structure for each principle:

---

### Principle [N]: [Name]

**How it applies:** [Project-specific analysis]

**Risk / Watch out:** [Flag a specific risk if present — omit this line if none]

**Status:** [One of: ✅ Well-positioned | ⚠️ Needs attention | 🔴 At risk]

---

Work through all 4 principles in order:

1. Keep It Human
2. Build What Matters
3. Simplicity Takes Work
4. Context Before Commitment

Be honest. If a principle is clearly at risk given what's been shared, say so plainly —
don't soften it to be polite. A PDD practitioner's value is in surfacing these gaps early.

---

## Phase 2: Tool Recommendations

After the principles analysis, recommend a focused set of PDD tools that are most relevant
to this project right now.

Structure the recommendations by PDD phase:

### Recommended tools for this project

Group tools under the phase they belong to (Discover, Define, Design, Develop, Evaluate,
Evolve). Only include phases that are relevant given where the project currently sits.
Within each phase, list 2–5 tools — prioritise the highest-value ones, not an exhaustive
list.

For each tool:
- **Name the tool** (use the official PDD name from the toolkit in `instructions.md`)
- **One sentence on why it's relevant** to this specific project

End the recommendations with:

> "Want me to run any of these now? Just say which one and I'll get started."

---

## Tone and Approach

- Be specific to the project — avoid generic PDD descriptions the user already knows.
- Lead with what's most important. If there's a critical gap (e.g. no user research planned
  for a project that clearly needs it), surface that prominently rather than burying it.
- Keep each principle section concise. This is an analysis to spark discussion, not an essay.
- The tool recommendations should feel curated, not exhaustive — the goal is "here's what
  will actually move the needle for you right now."

---

## Quality Checklist

Before presenting the output, verify:
- [ ] Every principle analysis references something specific from the project context
- [ ] No principle analysis is generic enough to apply to any project unchanged
- [ ] Risks are stated clearly, not hedged into meaninglessness
- [ ] Tool recommendations are limited to official PDD tools (from the toolkit in `instructions.md`)
- [ ] The output ends with an offer to run one of the recommended tools
