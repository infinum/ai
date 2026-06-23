---
name: ai-ready-screens
description: >
  Use when building, organizing, or auditing screen and user-flow files in
  Figma so MCP/AI tools can navigate screens, read the flow graph, and generate
  correct screen-level code. Triggers on: screens file, wireframes, user flow,
  prototype connections, prototype reactions, frame naming, screen states,
  flow handoff, MCP navigation. Pairs with ai-ready-design-system (which covers
  the component library, not the assembled screens).
---

# AI-Ready Screens (Infinum)

Platform-neutral rules for structuring a **screens / user-flow file** so AI tools
(Claude, MCP, Copilot, Cursor) can locate screens, read flows as a graph, and
generate correct screen-level code.

## Core principle

`ai-ready-design-system` makes the *parts* (tokens, components, layers) legible.
This skill makes the *assembled artifact* legible: a screens file is only
AI-readable if (a) every screen is findable by name, (b) the flow between screens
exists as machine-readable prototype reactions — not just visual proximity — and
(c) screens are built from library instances, not detached copies. AI tools read
the node tree and the reaction graph; an unwired flow is invisible to them.

## Layering & precedence

```
project CLAUDE.md  >  platform binding skill (flutter-m3-conventions, …)  >  ai-ready-design-system  ≈  this skill
```

This skill is a sibling of `ai-ready-design-system`, scoped to the screens file
rather than the library. It never restates the library's token/component rules —
it references them. Language- and market-specific carve-outs (e.g. localized CMS
content vs. English node names) are resolved by the project CLAUDE.md.

---

## Quick reference

| Concern | Rule | Owner |
|---|---|---|
| Screen frame name | `Section — Screen Name [State]`, English | this skill §1 |
| Flow between screens | wired as NODE prototype reactions | this skill §2 |
| Flow entry | named flow + flow-starting-point | this skill §3 |
| Screen states | one named frame per state, not a hidden variant | this skill §4 |
| Name uniqueness | unique across the file / within section | this skill §5 |
| File organization | grouped by flow into pages/sections | this skill §6 |
| Loose layers vs instances | name loose layers, no groups, never rename instances | this skill §7 |
| Tokens, instance assembly, annotations | instances, token-bound, annotations outside bounds | this skill §8 |

---

## 1. Screen frame naming

Pattern: `Section — Screen Name [State]`.

- **English node names, always** — even when in-app copy is another language.
  A screen titled "Obavijesti" is named `Notifications — List [Default]`, never
  `Obavijesti — Lista`. Rendered copy carries the locale; node names carry
  navigation. Non-English names and inconsistent casing break MCP lookups.
- **State in brackets**, appended after the screen name: `[Default]`, `[Filled]`,
  `[Error — short reason]`, `[Empty]`, `[Loading]`, `[Success]`.
- Examples: `Login — Email & Password [Error — Invalid Credentials]`,
  `Card Linking — Manual Entry [Error — Details Don't Match]`.

> Project-specific state vocabulary and any locale carve-out live in the project
> CLAUDE.md. This skill fixes the *shape* (section-prefixed, English, bracketed
> state), not the project's section names.

## 2. Prototype reactions ARE the flow graph

A flow is only machine-readable if it exists as prototype **reactions**
(trigger → destination). Visual arrows drawn as lines, or frames merely placed
left-to-right, tell an AI nothing.

- **Reactions are the flow; arrows are decoration.** Wiring reactions at all is
  table stakes — the failures are subtler. A drawn arrow or a left-to-right layout
  reads as a flow to a human and as *nothing* to an AI. Draw arrows for reviewers
  if you like, but the canonical flow MUST also exist as reactions or the graph is
  empty.
- **Wire NODE-type reactions to real destinations.** Action `type === 'NODE'`,
  `destinationId` resolving to an existing frame. No dangling or self-referencing
  destinations.
- **Name the trigger layer — and never rename an instance to do it.** The node
  carrying the reaction (the `via` edge) needs a real, role-based name
  (`cta-continue`, `link-forgot-password`), never `Frame 12`. When that node is a
  library `Button`/`Card` instance, do NOT rename the instance (§7) — wrap it (or
  the tappable row) in an auto-layout frame you own, name *that* `cta-pay`, and put
  the reaction there. The edge label is only as good as that name.
- **System transitions are edges too.** A non-tap transition — a `[Loading]` screen
  resolving to `[Default]` or `[Empty]` — still has to be a reaction (`AFTER_TIMEOUT`
  or the relevant trigger), or the result frames read as orphans. Model both
  `Loading → Results` and `Loading → Empty`.
- **One reaction per intent.** Don't stack redundant reactions on one node; an
  AI reading the graph can't tell which edge is canonical.

### Extract the flow graph (read)

Handles both the modern `reaction.actions[]` array and the legacy single
`reaction.action`.

```js
// Build { frameId: name } first so destinations resolve to readable names.
const frameMap = {};
for (const node of figma.currentPage.children) frameMap[node.id] = node.name;

const edges = [];
function walk(node, fromName, fromId) {
  const reactions = node.reactions || [];
  for (const r of reactions) {
    const actions = r.actions || (r.action ? [r.action] : []);
    for (const a of actions) {
      if (a.type === 'NODE' && a.destinationId) {
        edges.push({
          from: fromName, fromId,
          via: node.name,                       // trigger layer — name it well (§2)
          trigger: r.trigger && r.trigger.type, // ON_CLICK, ON_DRAG, …
          to: frameMap[a.destinationId] || '(off-page / unknown)',
          toId: a.destinationId,
        });
      }
    }
  }
  if ('children' in node) node.children.forEach(c => walk(c, fromName, fromId));
}
for (const f of figma.currentPage.children) {
  if (f.type === 'FRAME' || f.type === 'SECTION') walk(f, f.name, f.id);
}
return { total: edges.length, edges };
```

### Wire a transition (write)

```js
// Tap on a named trigger layer navigates to a destination frame.
const trigger = screenFrame.findOne(n => n.name === 'cta-continue');
await trigger.setReactionsAsync([{
  trigger: { type: 'ON_CLICK' },
  actions: [{
    type: 'NODE',
    destinationId: destinationFrame.id,
    navigation: 'NAVIGATE',
    transition: { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.3 },
    preserveScrollPosition: false,
  }],
}]);
```

> `setReactionsAsync` is the current API; the `node.reactions =` setter is
> deprecated. Load `figma:figma-use` before any `use_figma` write call.

## 3. Named flows + start points

- **Mark a flow-starting-point** on the first frame of each flow, and give the
  flow a real name (`Registration`, `Card Linking`). This gives the reaction
  graph labeled entry nodes instead of orphan frames an AI must guess at.
- A frame reachable by no reaction and flagged by no start point is an orphan —
  either wire it in or move it out of the flow.

## 4. State coverage as separate frames

- Each meaningful state is its **own named frame** (§1) — never a hidden layer or
  a component variant toggled inside one frame. MCP navigates to states by frame
  name; a toggled-inside state is unreachable.
- Draw only the states the flow depends on (`Default`, the success path, and the
  error/empty/loading states that change it) — not every permutation (value-over-completeness).

## 5. Name uniqueness

- Screen frame names unique within their section (ideally file-wide): `findOne(name)`
  and MCP resolve to the first match, so duplicates make targeting non-deterministic.
  Mostly a lint — the real risk is *latent* duplicates across a large file, not the
  obvious collisions (which get caught reflexively). Verify in audit; don't belabor.

## 6. File organization

- Group screens **by flow** into pages/sections named for the flow (`Registration`,
  `Store Locator`); keep one flow's frames contiguous, don't interleave. An agent
  should locate "the registration flow" by section name without scanning frames.

## 7. Loose layers — named and auto-laid-out; never touch instances

A screen is library instances plus the loose layers you add around them. The
rules differ by which one you're looking at:

- **Loose layers you add: name them, no defaults.** A `Rectangle 12`, `Frame 8`,
  or `Group 3` dropped on the canvas is invisible to AI and scripts — give it a
  role-based name (`hero-image`, `promo-banner`) before handoff. (Same principle
  as `ai-ready-design-system` §4, applied to the canvas rather than a component.)
- **No groups — use auto-layout frames.** Groups have no layout model and read
  inconsistently; they generate absolute-positioned code. Wrap loose content in
  auto-layout frames.
- **Never rename a library instance or its internals.** An instance's child
  layers come from the main component — renaming them doesn't propagate, is noise
  in a naming audit, and can mask the instance's origin. Rename only the loose
  layers you own; leave instances and their subtrees untouched.
- **Need a named trigger on an instance? Wrap, don't rename.** §2 wants a
  role-based name on the node that carries a reaction. When that node is a
  `Button`/`Card` instance, the fix is NOT to rename the instance — wrap it (or the
  tappable row) in an auto-layout frame you own, name that frame `cta-pay`, and
  attach the reaction to the frame. The instance stays pristine; the edge still
  gets a clean label.

The split matters: at the library level you name everything you build; at the
screens level you name what you add and keep your hands off what you placed.

---

## 8. Assembly rules

These also hold when using this skill on its own; `ai-ready-design-system`
covers them in more depth if it's installed.

- **Screens are assemblies of library instances** — never detached or locally
  re-created copies. Detached layers emit hardcoded values and break Code Connect.
- **Everything token-bound** (inherited through instances); no hardcoded hex on
  screen frames.
- **Auto-layout on screen frames**, real device sizes — not absolute positioning.
- **Annotation, spec, and accessibility layers live OUTSIDE frame bounds** —
  hidden annotation layers inside a frame still appear in MCP output.

---

## Audit & validation

**Findability** — every screen frame follows §1 naming; English node names; unique
within section.

**Flow graph** — run the §2 extraction: every intended transition appears as an
edge; no `(off-page / unknown)` destinations that should be on-page; every `via`
node has a real name; every flow has a named start point; no orphan frames (§3).

**States** — each depended-on state is its own frame (§4), reachable by name.

**Assembly** — screens are instances, token-bound, auto-laid-out; annotations
outside bounds (§8).

**The real test:** ask an AI tool, using only what it reads from the file, to
describe the registration flow step by step. If it can't trace screen → screen,
the reactions aren't wired (§2). If it names screens wrong, naming is off (§1).
If it misses a state, that state isn't its own frame (§4).

| AI output | Means |
|---|---|
| "Frames appear unconnected" / can't trace the flow | Reactions not wired — §2 |
| Refers to a screen by the wrong / a non-unique name | Naming or uniqueness — §1, §5 |
| Misses an error/empty/loading screen | State not a separate frame — §4 |
| Emits hardcoded colors for a screen | Detached instance / unbound fill — §8 |

---

## Common mistakes

- **Drawing flows as arrows/lines instead of reactions.** Looks like a flow to a
  human; invisible to an AI. Wire reactions (§2).
- **Hiding states as layers inside one frame.** Unreachable by navigation; make
  each state its own frame (§4).
- **Croatian (or other locale) node names.** Breaks lookups; names are English,
  copy is localized (§1).
- **Re-creating components locally on a screen** instead of placing library
  instances. Breaks tokens and Code Connect (inherited).
- **Orphan frames** with no incoming reaction and no start point (§3).
