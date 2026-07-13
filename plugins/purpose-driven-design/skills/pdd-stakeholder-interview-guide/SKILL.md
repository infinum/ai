---
name: pdd-stakeholder-interview-guide
description: >
  Use this skill to create a Stakeholder Interview Guide for a client project. Triggers
  whenever a user wants to: write stakeholder interview questions, create an internal
  interview guide for client team members, prepare interview scripts for executives or
  product owners, or build a guide for discovery-phase stakeholder sessions. Also trigger
  when the user says "stakeholder interview", "stakeholder guide", "interview questions
  for the client team", "discovery interviews", or "questions for [role like CEO, VP,
  marketing director]" — even if they don't explicitly call it a skill. The output is a
  formatted .docx matching the Infinum/ETR stakeholder interview style — participant list
  at the top, shared intro script, then a tailored per-person question set for each
  interviewee organized into subsections by topic. Runs on the bundled python-docx generator, so it works in Cowork's base image.
---

# PDD Stakeholder Interview Guide Skill

> **Before you start:** Read `${CLAUDE_PLUGIN_ROOT}/instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

Produces a structured, print-ready Stakeholder Interview Guide following Infinum/ETR conventions.
The guide has one tailored question set per interviewee, organized into topic subsections,
with a shared intro script at the top.

Unlike user interview guides, there is no screener or recruitment plan — stakeholders are
pre-selected internal client team members.

---

## Phase 1 — Gather Context

Check the conversation first — project brief, SOW, discovery workshop notes, and any
prior context about the client may already answer many of these.

### Required Information

If any of the following are missing, ask **all in one message**:

| Item | Why it matters |
|------|----------------|
| **Client / project name** | Document header and intro script |
| **List of interviewees** | Name + title for each person — this drives everything |
| **Project type** | Website, app, platform, etc. — shapes question framing |
| **Key project goals** | Informs "Context" subsection questions |
| **Session length** | Typically 45–60 min for stakeholder interviews |

### Ask Template (if context is missing)

> Before I write the guide, I need a few things:
>
> 1. **Who are we interviewing?** Please list each person's name and title.
> 2. **What's the project?** A brief description of what we're building and why.
> 3. **Any specific goals or questions you want to make sure we cover?**
> 4. **Session length?** (defaults to 45 minutes if not specified)

Once you have the interviewee list and project context, proceed without asking further questions —
derive role-appropriate question sets from the context and the question library.

---

## Phase 2 — Plan the Question Sets

Before writing, map each interviewee to a **role archetype** to select the right question emphasis:

| Role Archetype | Examples | Emphasis |
|---|---|---|
| **Executive / Leadership** | CEO, CCO, President, Founder | Vision, goals, differentiation, growth strategy |
| **Clinical / Product / Service** | VP Clinical, Director of Care, Product Owner | User needs, service gaps, content, outcomes data |
| **Marketing / Growth** | CMO, Marketing Director, SEO Lead | Channels, messaging, content, SEO, brand |
| **Operations / Technology** | CTO, CIO, Head of Engineering | Tech constraints, integrations, platform, workflows |
| **Business Development / Sales** | VP BD, Sales Director | Funnel, B2B partnerships, referrals, credibility signals |
| **Program / Project Manager** | Program Manager, Project Lead | Day-to-day ownership, CMS, workflows, launch logistics |

A single person may span two archetypes — e.g. a VP of Marketing & Operations gets both tracks.

**Shared questions** (appear in most or all sections):
- Background / role
- Why now / project context
- What success looks like
- Who the primary user is
- What information is most important to show users
- Main action you want users to take
- Competitors and differentiation
- Concerns and risks
- Wrap-up

**Role-specific questions** supplement the shared set. Draw from `references/question-library.md`.

---

## Phase 3 — Generate the Guide

Read `references/format-reference.md` before writing.

### Document Structure (in order)

1. **Header** — "Stakeholder Interviews", client name, date
2. **Participant List** — all interviewees listed by name + title (no screening criteria)
3. **Intro Script** — shared verbatim script, ~200 words, warm and professional
4. **Per-Participant Sections** — one H2 (`##`) section per person (or role group if sharing a session)
   - Each section has: participant name + title as the `##` heading, numbered questions inside named `###` subsections
   - **Question numbering restarts at 1 for each interviewee** and continues across that person's subsections — the generator handles this automatically as long as each interviewee is a `##` heading and their subsections are `###`
5. Each section ends with the standard wrap-up line

### Writing the Intro Script

The intro script is **shared** — used at the start of every session with every participant.
It should include:
- Interviewer name(s) and role on the project *(use [NAME] and [ROLE] placeholders)*
- What the project is and who's leading it
- Goal of the session: to hear from them, learn their perspective
- Quick notes: recording consent, session length flexibility, follow-up welcome
- "Any questions before we get started?"

Keep it warm, direct, and not overly formal. ~3–4 short paragraphs + 3 bullet notes.

### Writing Each Participant's Questions

For each person:

1. Start with 2–4 **Background / Role** questions — adapted to their specific role
2. Move to 4–6 **Context** questions — project vision, success metrics, why now
3. Add 5–8 **Users** questions — who they're trying to reach, what users need, funnel/drop-off
4. Include role-specific subsections as relevant:
   - **Content** (for marketing, PM, operations roles)
   - **Tech & Features** (for CTO/CIO, operations)
   - **B2B / Business Development** (for sales, CCO roles)
5. Always include 3–4 **Competitors** questions
6. Always include 2–3 **Risk & Concerns** questions
7. End with **Ideas** (1–2 open-ended vision questions)
8. Close with the standard wrap-up line

Don't bold questions — keep all questions in normal weight (only headings are bold).
Use *italics* for conditional or interviewer notes: *(Skip if already answered in workshop)*
Use lettered sub-items for follow-up probes.

### Question Count by Session Length

Scale question count to the session length only — not to the participant's seniority or title:

- 30 min → 15–20 questions
- 45 min → 20–28 questions
- 60 min → 28–38 questions
- Group session (multiple participants, 60–90 min) → 35–50 questions total

### Personalization

Where you know something specific about a participant — prior role, stated concern, something
they mentioned in a prior session or workshop — include a personalized question referencing it.
Examples (illustrative):
- "I was told that before this role you were the CEO of a mental health company — how did that experience shape your thinking?"
- "I heard you've worked at a couple of well-known companies in this space — what learnings are you bringing from those experiences?"
- "I know we touched on this a bit in the discovery workshop, but can you walk me through again…"

This signals preparation and typically yields the most candid answers.

---

## Phase 4 — Output

### Generate the .docx

The bundled `scripts/generate_guide.py` (python-docx) renders a Markdown file into the branded
Infinum .docx. Write the guide content to a Markdown file using these conventions:

- `# Title | Client | Month Year` → title block, red rule, and grey subtitle
- Participant list at the top, then the shared intro script
- `## Interviewee Name — Role` → one H2 section per interviewee (also **restarts question numbering**)
- `### Subsection` → H3 topic label within an interviewee's set
- `1.` numbered questions (restart at each `##`); `a.` lettered sub-items (probes)
- `- ` bullets; `*italic*` → italic grey note; `**bold**` renders at normal weight

Ensure python-docx is available, then run the script from this skill's directory:

```bash
pip install python-docx --break-system-packages -q
python3 "${CLAUDE_PLUGIN_ROOT}/skills/pdd-stakeholder-interview-guide/scripts/generate_guide.py" \
  --content stakeholder_guide_content.md \
  --output /mnt/user-data/outputs/stakeholder_interview_guide.docx
```

The generator has the **Infinum logo** embedded directly inside it (base64), so it renders in the
top-right page header even when the script runs detached from the plugin (e.g. copied elsewhere) —
no dependency on the `assets/` folder at runtime. Pass `--logo /path/to/logo-color.png` to use a
different logo. It applies the
Infinum brand throughout — Helvetica Neue, red `#D8262D` title rule, bold headings, normal-weight
questions, lettered probes.

Then validate:

```bash
python3 /mnt/skills/public/docx/scripts/office/validate.py \
  /mnt/user-data/outputs/stakeholder_interview_guide.docx
```

Then present the file using `present_files`.

### Fallback

If generation fails, write to `/mnt/user-data/outputs/stakeholder_interview_guide.md` and present.

---

## Phase 5 — Review Gate

After presenting the guide, ask:

> "Does this look right? Let me know if you'd like to adjust the question focus for any
> participant, add or remove people, change the session length, or add any project-specific
> context I should weave in."

Include this **starting-point note** (per the plugin's output policy):

> **A note on this output:** This is a shared starting point, not a finished deliverable. Per *Keep It Human*, review it and refine it **together with the team** — the best results come from collaboration and human judgment, not from a first pass. Check every line against what you know before using or sharing it.


---

## Files in This Skill

| Path | Purpose |
|------|---------|
| `SKILL.md` | This file — workflow instructions |
| `references/question-library.md` | Master question bank by role type and section |
| `references/format-reference.md` | Document structure, style, and formatting conventions |
| `scripts/generate_guide.py` | python-docx generator: Markdown → styled Infinum .docx |

**Note:** This skill bundles its own copy of `generate_guide.py` (identical to the one in
`pdd-user-interview-guide`), so it runs standalone — no dependency on other skills.
