---
name: pdd-user-interview-guide
description: >
  Use this skill to create a User Interview Guide (or User Interview / Usability Test Guide)
  for a research project. Triggers whenever a user wants to: write an interview script,
  create a user interview guide, build a research plan with screener questions, draft an
  intro script for user interviews, create a usability test plan, or prepare for qualitative
  research sessions. Also trigger when the user says "interview guide", "interview script",
  "research plan", "screener", "usability test plan", "user testing plan", or "write questions
  for user interviews" — even if they don't explicitly call it a skill. The output is a
  formatted .docx on the Infinum brand (structured sections, red accent, Infinum logo in the
  page header). Runs on the bundled python-docx generator, so it works in Cowork's base image.
---

# PDD User Interview Guide Skill

> **Before you start:** Read `${CLAUDE_SKILL_DIR}/../../instructions.md` and follow its PDD persona and Infinum brand rules throughout — including the document branding (Helvetica Neue, `#000`/`#D8262D`/`#E4EBF5`, Infinum logo top-right) on every file this skill produces.

Produces a structured, print-ready User Interview Guide (or combined User Interview /
Usability Test Guide) following the Infinum/ETR document conventions used across past
projects.

---

## Phase 1 — Gather Context

Before writing anything, confirm you have enough information to produce a high-quality guide.
Check the conversation for existing context first (project brief, SOW, prior research, archetypes).

### Required Information

If any of these are missing or unclear, ask — all in one message, not one at a time:

| Item | Why it matters |
|------|----------------|
| **Client / project name** | Document header |
| **Research goals** | Shapes the "What are we trying to learn?" section and all question selection |
| **Target audience(s)** | Determines participant segments, screener criteria, and question angles |
| **Session format** | Interview only vs. interview + usability test (determines whether a Tasks section is needed) |
| **Session length + incentive** | Used in setup and recruitment sections |
| **Recruitment source** | Respondent.io, User Interviews, client-sourced, or mix |
| **Number of participants** | By segment if multi-segment |
| **Any prototype / URL to test** | Required if usability component is included |

### Optional but Useful

- Existing personas or archetypes (use to sharpen question framing)
- Any prior research findings to validate or expand on
- Geographic or demographic filters
- Known sensitivities (e.g. mental health topics — adjust tone accordingly)

### Ask Template (if context is missing)

> Before I write the guide, I need a few things:
>
> 1. **What are the main research goals?** What do you most need to learn from these sessions?
> 2. **Who are the target participants?** (audience type, any segments)
> 3. **Interview only, or does it include a usability test?** If usability — what prototype or URL will participants look at?
> 4. **Session length and incentive?** (e.g. 45 min / $50) — I can suggest defaults if you're unsure.
> 5. **How are you recruiting?** Respondent.io, User Interviews, client contacts, or a mix?

Wait for answers before drafting.

---

## Phase 2 — Generate the Guide

Once context is confirmed, assemble the full guide as Markdown, then render it to **.docx** with
the bundled generator in Phase 3. Read `references/format-reference.md` before drafting to ensure
correct structure and style.
Draw questions from `references/question-library.md` — adapt them to the project, don't copy verbatim.

### Document Structure (in order)

1. **Header** — document title, client name, date, ETR/Infinum branding
2. **What are we trying to learn?** — internal-facing bullet list of research questions (5–10 bullets)
3. **Who do we want to talk to?** — participant segments with screening criteria
4. **Recruitment Plan** — platform(s), approach, incentive(s), logistics
5. **Screener Questions** — 3–6 questions, numbered, with branching logic where needed
6. **Intro Script** — verbatim researcher script (warm, casual, first person)
7. **Interview Questions** — organized into named subsections (Warm-Up, Background, Goals, etc.)
8. **Usability Test Tasks** *(only if usability component requested)* — task script intro + numbered tasks with probes
9. **Wrap-Up** — closing lines + final open question

### Section-by-Section Guidance

#### "What are we trying to learn?"
- Write as internal research questions (not interview questions)
- Ground each bullet in the project goals
- Example: "What information do users need before they feel ready to book an appointment?"
- 5–10 bullets; be specific, not generic

#### "Who do we want to talk to?"
- One block per participant segment
- For each: label, qualifying criteria (role, behavior, situation), any hard screener requirements
- Note if client is providing participants (flag potential bias risk)

#### Recruitment Plan
- State the platform(s) and brief rationale
- Include incentive per segment with session length
- Add recruiting fee note if using Respondent.io or User Interviews (+50% is standard)
- If using client contacts, include a short outreach email template
- **Reminder emails:** Respondent.io and User Interviews handle scheduling and reminder emails themselves — do **not** add a reminder-email step for those. Only client-sourced participants need a reminder/outreach email from our side.
- Note any pre-session logistics (NDA, app install, link to send, etc.)

#### Screener Questions
- 3–6 questions max — keep it short
- Use multiple choice where possible
- Include explicit screen-out conditions in italics: *(Screen out if only want in-person)*
- Don't ask for sensitive info in the screener beyond what's necessary to qualify

#### Intro Script
- First person, warm, natural — write as Kerrin would speak
- Must include: researcher name placeholder, purpose of session, no right/wrong answers, recording consent
- Keep it under 150 words

#### Interview Questions
- Organize into named subsections (3–5 subsections for a standard guide)
- Keep questions in normal weight — don't bold them (only headings are bold)
- Use lettered probes (a, b, c…) under key questions
- Use italics for conditional logic: *(If seeking for their child)*
- Typical subsection flow:
  1. Warm-Up / Background (2–4 questions)
  2. Core topic exploration (6–12 questions — the bulk)
  3. Website / product expectations (3–5 questions, if relevant)
  4. Decision-making / conversion (2–4 questions)
  5. Ideas & opportunities (2–3 questions)

- Scale question count to session length:
  - 30 min → 12–18 questions
  - 45 min → 18–25 questions
  - 60 min → 25–35 questions
  - 90 min → 35–50 questions (split across interview + usability)

#### Usability Test Tasks (if applicable)
- Add a short task script intro paragraph before the numbered tasks
- Each task = one realistic scenario framed as an instruction
- Include 3–6 follow-up probes per task as lettered sub-items
- End with overall impression questions (4–6 questions about the product as a whole)
- Common closing questions for usability:
  - "What do you think is working well, and where do you think it's lacking?"
  - "What features would you use the most? Why?"
  - "What features don't exist that you would like to see?"
  - "How much would you be willing to pay for something like this?"

#### Wrap-Up
- Always end with: "Is there anything we haven't covered yet that you think we should know?"

---

## Phase 3 — Output

### Generate the .docx

The bundled `scripts/generate_guide.py` (python-docx) renders a Markdown file into the branded
Infinum .docx. Write the guide content to a Markdown file using these conventions:

- `# Title | Client | Month Year` → title block, red rule, and grey subtitle
- `## Section` → H2 section heading (also **restarts question numbering**)
- `### Subsection` → H3 sub-section heading
- `1.` numbered questions (restart at each `##`); `a.` lettered sub-items (probes)
- `- ` bullets; `*italic*` → italic grey note; `**bold**` renders at normal weight

Ensure python-docx is available, then run the script from this skill's directory:

```bash
pip install python-docx --break-system-packages -q
python3 "${CLAUDE_SKILL_DIR}/scripts/generate_guide.py" \
  --content interview_guide_content.md \
  --output /mnt/user-data/outputs/user_interview_guide.docx
```

The generator embeds the **Infinum logo** (`assets/logo-color.png`, bundled at the plugin root) in
the top-right page header, auto-locating it relative to the script. Pass `--logo /path/to/logo-color.png`
to override; if the asset can't be found it falls back to the "INFINUM" wordmark. It applies the
Infinum brand throughout (Helvetica Neue, red `#D8262D` title rule, bold headings, normal-weight
questions, lettered probes).

Then validate:

```bash
python3 /mnt/skills/public/docx/scripts/office/validate.py \
  /mnt/user-data/outputs/user_interview_guide.docx
```

Then present the file using `present_files`.

### Fallback: Markdown Output

If generation fails, write the guide as a `.md` file to
`/mnt/user-data/outputs/user_interview_guide.md` and present it.

---

## Phase 4 — Review Gate

After presenting the guide, always ask:

> "Does this look right? Let me know if you'd like to adjust the research goals, add or remove
> participant segments, change the question focus, or add/remove a usability section."

Regenerate if needed.

---

## Tone & Sensitivity Notes

- For sensitive research topics (mental health, grief, medical, financial hardship): soften question language, use "with however much detail you feel comfortable sharing", avoid leading or clinical phrasing
- For B2B research: use role-based framing, focus on workflow and decision-making
- For product/app usability: balance "what do you think this is for?" (comprehension) with task-based scenarios
- Always write as if Kerrin will be speaking these words aloud — natural, warm, not stiff

---

## Files in This Skill

| Path | Purpose |
|------|---------|
| `SKILL.md` | This file — workflow instructions |
| `references/question-library.md` | Master bank of interview questions by section type |
| `references/format-reference.md` | Document structure, style, and formatting conventions |
| `scripts/generate_guide.py` | python-docx generator: Markdown → styled Infinum .docx |
