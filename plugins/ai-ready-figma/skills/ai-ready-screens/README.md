# ai-ready-screens

Structure a Figma **screens / user-flow file** so AI tools can locate screens, read flows as a machine-readable graph, and generate correct screen-level code.

## Usage

```
/ai-ready-figma:ai-ready-screens
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

This skill also auto-triggers on: screens file, wireframes, user flow, prototype connections/reactions, frame naming, screen states, flow handoff, and MCP navigation.

## What it does

Where `ai-ready-design-system` makes the *parts* legible, this skill makes the *assembled artifact* legible:

- **Screen frame naming** — `Section — Screen Name [State]`, English node names always (rendered copy carries the locale, node names carry navigation).
- **Prototype reactions ARE the flow graph** — a flow is only machine-readable as `NODE` reactions (trigger → destination), not drawn arrows or left-to-right layout. Includes read (flow-graph extraction) and write (wire-a-transition) scripts.
- **Named flows + start points, state coverage as separate frames, name uniqueness, file organization by flow.**
- **Loose layers vs. instances** — name and auto-lay-out what you add; never rename library instances (wrap them instead).
- **Audit/validation** — including the real test: ask an AI tool to trace a flow step by step from the file alone.

## Companion skills

- **`ai-ready-design-system`** (same plugin) — the component-library counterpart. This skill references its rules rather than restating them.
- **`figma:figma-use`** (official Figma plugin) — required before any `use_figma` write call (e.g. wiring reactions with `setReactionsAsync`).
