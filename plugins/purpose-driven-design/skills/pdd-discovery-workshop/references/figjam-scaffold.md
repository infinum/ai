# FigJam Facilitation Board — Scaffold

How to build the discovery-workshop board. **Seed structure only — never participant content**
(no invented stickies, votes, quotes, or data). The board reads left-to-right in run order and
must look empty-and-ready.

---

## Board layout (left → right)

1. **Onboarding zone** (far left) — always first.
2. **One section per agenda item**, in run order.
3. **Parking Lot** (near the end).
4. **Synthesis tail** (optional, far right) — when the workshop should feed straight into insights.

Leave generous whitespace between sections (~200px). Put a big section header (frame or bold
text) above each so people can find their place.

### Onboarding zone contents
- **Title card:** "Discovery Workshop — [Project]", date, facilitator.
- **Agenda:** the run-of-show list (activity, time, order) — mirrors the .docx.
- **Figma basics:** 3–4 lines (how to add a sticky, vote, zoom).
- **Keyboard shortcuts:** sticky (S), text (T), vote tool, hand/space to pan.
- **Colour legend:** what each sticky colour means (see below).

### Colour legend (default)
- **Yellow** — ideas / general input
- **Blue** — questions / unknowns
- **Pink/red** — risks, concerns, blockers
- **Green** — decisions / agreements
- **Purple** — votes / priorities
(State the legend on the board; keep it consistent across sections.)

### Parking Lot
A single labelled frame for off-topic-but-important items so the facilitator can move on without
losing them.

### Synthesis tail (optional)
Three empty labelled frames in order: **Opportunity Statements → Themes → How Might We** — where
the group clusters raw output into insights at the end (or the team does it after).

---

## Per-activity working structures (seed these empty)

- **Extra, Extra! / Elevator Pitch / Press Release:** the template text as a text block + an
  empty area (or per-person lanes) for responses. For Elevator Pitch, pre-place the fill-in
  sentence: *"For [audience] who [need], [product] is a [category] that [benefit]. Unlike
  [alternative], it [differentiator]."*
- **Two Truths / Either-Or:** a small grid or the paired-option prompts with empty dot-vote zones.
- **Goals, Signals & Metrics:** an empty 3-column table (Goal / Signal / Metric).
- **Proto-Persona / Empathy:** one empty card per audience with labelled quadrants
  (Goals / Frustrations / Context / Win) or Says-Thinks-Does-Feels.
- **JTBD:** the statement template + an empty cluster area.
- **Crazy 8s:** a per-person 8-frame grid (or 4-frame for remote).
- **Lightning Demos:** an empty inspiration wall with a "name / what's good" caption stub.
- **How Might We:** an empty column headed "How might we…?".
- **Value–Effort Matrix:** an empty 2×2 with axes labelled Value (y) and Effort (x).
- **Buy a Feature:** a priced feature list (prices as placeholders) + empty "spend" lanes.
- **Dot-Voting:** the item list + a note of how many dots each person gets.
- **Rose / Bud / Thorn:** three labelled empty columns.

---

## Figma API notes (via `Figma:use_figma`)
- Read the `/figma-use` skill first if available.
- Create the file with `Figma:create_new_file` (`editorType: "figjam"`), named
  **"Discovery Workshop — [Project]"**; note the returned `file_key`.
- Build with `figma.createFrame()` for section containers, `figma.createText()` for headers and
  prompts, `figma.createSticky()` for template/legend stickies, `figma.createSection()` where
  supported for the big zones.
- Load fonts before setting text: `await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })`
  and `'Bold'`.
- Lay sections out left-to-right with consistent x-offsets; keep each activity's working area
  inside its section frame.
- End with `figma.viewport.scrollAndZoomIntoView(figma.currentPage.children)`.
- **Never** create content stickies with real answers — only templates, prompts, and legends.

## Fallback (no Figma connector)
Write the same structure as a markdown spec to
`/mnt/user-data/outputs/figjam_board_scaffold.md` — list each section top-to-bottom with its
working structure — so the facilitator can build the board by hand. Tell the user that
connecting Figma would let this be built directly.
