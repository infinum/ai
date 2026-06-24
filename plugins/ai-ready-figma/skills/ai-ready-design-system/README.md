# ai-ready-design-system

Make a Figma design system AI-readable and MCP/Code-Connect-ready so code generation produces correct, on-brand code. Platform-neutral rules for token architecture, component/layer/token naming, property wiring, structural consistency, and in-file documentation.

## Usage

```
/ai-ready-figma:ai-ready-design-system
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

This skill also auto-triggers when you're setting up or auditing a design system; naming a token, component, variant, property, or layer; defining enums or booleans; wiring component properties; or preparing a library for AI code generation.

## What it does

Encodes the exact structural moves that make a Figma library legible to AI tools (Claude, MCP, Copilot, Cursor) and clean to hand off to developers:

- **Token architecture** — primitives → semantic → component, with explicit variable scopes (never `ALL_SCOPES`), variables-only (no paint styles), and alpha-primitive handling for translucent tokens.
- **Naming** — invariant casing for components (PascalCase), layers (kebab-case, role-based, bottom-up), and a `category/role/variant/state` token pattern.
- **Component properties** — one dimension each, state-as-enum (never split into booleans), `is*`/`has*` boolean conventions, every property wired to a child node.
- **Structural consistency, MCP readiness, in-file documentation, and an audit/validation checklist** — including the real test: ask an AI tool to describe a component from the file alone and compare to intent.

This is the **executable build layer**, not a conceptual primer.

## Platform binding

This skill is deliberately platform-neutral — casing, state vocabulary, the semantic-color collection, and token→theme mapping are left to a **platform binding skill** or the project `CLAUDE.md`. For Flutter / Material 3, install the [`design-conventions`](../../../design-conventions/) plugin and load `flutter-m3-conventions` alongside this skill. With no binding loaded, the skill assumes Web/CSS defaults.

## Companion skills

- **`ai-ready-screens`** (same plugin) — applies the same legibility goal to the assembled screens/user-flow file rather than the component library.
- **`figma:figma-use`** (official Figma plugin) — required before any `use_figma` write call.
