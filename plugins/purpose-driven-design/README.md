# Purpose Driven Design

A toolkit for the Infinum design team — a set of research, analysis, and delivery skills built around the PDD methodology.

The assistant operates as a skilled, multi-disciplinary PDD practitioner in every session. Persistent working instructions (philosophy, principles, and behaviour rules) are defined in `instructions.md`.

---

## Skills

### PDD Stakeholder Interview Guide
Produces a structured Stakeholder Interview Guide for discovery-phase sessions with client team members. Includes a shared intro script and tailored, role-appropriate question sets for each interviewee, organized into subsections by topic. Output is a formatted .docx.

**Trigger phrases:** "stakeholder interview", "stakeholder guide", "interview questions for the client team", "discovery interviews"

---

### PDD User Interview Guide
Produces a structured User Interview Guide (or combined User Interview / Usability Test Guide) for qualitative research sessions. Includes research goals, participant segments, screener questions, a recruitment plan, intro script, and interview questions. Output is a formatted .docx.

**Trigger phrases:** "interview guide", "interview script", "research plan", "screener", "usability test plan", "user testing plan"

---

### PDD Discovery Workshop
Plans a discovery workshop for a client project — recommends a warm-up plus 1–2 longer exercises from the Infinum/ETR activity library, sequenced to fit the time. Output is a formatted .docx run-of-show plus a FigJam board scaffold.

**Trigger phrases:** "discovery workshop", "workshop plan", "workshop agenda", "kickoff workshop", "facilitation board", "which exercises should we run"

---

### PDD Project Brief
Creates a concise, honest snapshot of where a project stands across eleven sections (client, project, stakeholders, goals/definition of done, out-of-scope, why now, users, differentiators, competitors, sharp corners, discovery learnings). Flags anything unknown as a question for the client rather than inventing it, and marks sections in progress when discovery isn't finished. Output is the brief in the conversation plus a Markdown file.

**Trigger phrases:** "project brief", "project summary", "summarize the project", "where are we on this project", "catch me up on [project]"

---

### PDD Risk Radar
Proactively surfaces project risks across six dimensions (Timeline, Budget, Technical, Resource, Client/Stakeholder, External) and pairs each with a mitigation and a contingency. Prioritizes by likelihood × impact and flags compound and "silent" risks. Output is a structured risk assessment in the conversation plus a Markdown file.

**Trigger phrases:** "risk radar", "risk assessment", "what are the risks", "what could go wrong", "risk register", "de-risk this"

---

### Apply PDD
Reviews project background information and walks through all 4 PDD Principles, discussing how each applies to this specific project, flagging risks or gaps, and recommending the most relevant PDD tools to use.

**Trigger phrases:** "apply PDD", "how does PDD apply here", "which tools should we use", "review this project through PDD", "map this project to PDD"

---

### PDD Interview Summary
Builds a Participant Summary spreadsheet from interview data — one row per participant mapped across key dimensions (Audience Type, Goals, Habits, Frustrations, Needs, plus any custom columns). A useful synthesis step before archetypes or a rainbow analysis. Output is an `.xlsx`.

**Trigger phrases:** "participant summary", "participant grid", "summarize the participants", "map participants across goals/frustrations/needs"

---

### PDD Archetypes
Transforms raw user interview data into polished Archetype documents on a FigJam board, with goals, frustrations, needs, habits, quotes, and demographics per archetype. Works best from a participant summary (see the PDD Interview Summary skill).

**Trigger phrases:** "create archetypes", "synthesize interviews into archetypes", "persona documents", "PDD archetypes"

---

### PDD Rainbow Analysis
Produces a Rainbow Analysis spreadsheet from user interview data — a colour-coded matrix that maps recurring observations and themes across participants, showing at a glance which themes are most prevalent and who contributed to each.

**Trigger phrases:** "rainbow analysis", "theme tally", "synthesize themes across interviews", "which participants said X", "affinity analysis"

---

### PDD Competitive Analysis
Runs a structured competitive analysis, scoring competitors across relevant UX and business categories on a 0–3 scale. Produces a two-sheet `.xlsx` workbook: a full scoring grid with rationale, and a Summary sheet with per-competitor strengths/weaknesses and strategic opportunities for the client.

**Trigger phrases:** "competitive analysis", "compare competitors", "benchmark", "landscape review", "score products against each other"

---

### PDD Schedule
Builds a project schedule (dated Gantt) matching the ETR/Infinum Project Schedule tab from deliverables and the SOW timeline — each phase a distinct colour and heading, with milestones for delivery dates and client-feedback-due dates. Always previews the schedule in chat for adjustments before building the spreadsheet. Output is an `.xlsx`.

**Trigger phrases:** "schedule", "timeline", "project schedule", "gantt", "lay out the phases"

---

### PDD Estimate
Builds a project estimate on the standard ETR/Infinum estimate template. Reads the brief/RFP, benchmarks against past estimates in the Estimates drive, proposes a feature list with draft hours per department, and fills the official sheet (keeping all formulas). Output is a filled `.xlsx` (local file; nothing is written to Drive).

**Trigger phrases:** "estimate", "estimate sheet", "scope this", "how many hours", "price this RFP", "fill out the estimate"

---

## Requirements

- **Archetypes**: Figma MCP connected (for FigJam output)
- **Competitive Analysis**: `openpyxl` Python package (`pip install openpyxl --break-system-packages`)
- **Rainbow Analysis**: `openpyxl` Python package
- **Discovery Workshop**: Figma MCP connected (for the FigJam board scaffold)
- **Schedule**: `openpyxl` Python package (uses the bundled Project Schedule template)
- **Estimate**: `openpyxl` Python package (uses the bundled estimate template). Google Drive connector (read-only) optional, for benchmarking past estimates.
