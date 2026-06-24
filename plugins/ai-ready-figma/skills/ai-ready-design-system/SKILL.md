---
name: ai-ready-design-system
description: >
  Make a Figma design system AI-readable and MCP/Code-Connect-ready so code
  generation produces correct, on-brand code. The Infinum team standard for the
  exact structural moves — token architecture and scopes, component/layer/token
  naming, property wiring, structural consistency, in-file documentation — that
  make a library legible to AI tools (Claude, MCP, Copilot, Cursor) and clean to
  hand off to developers. Use when setting up or auditing a design system;
  naming a token, component, variant, property, or layer; defining enums or
  booleans; wiring component properties; checking structural consistency; or
  preparing a library for AI code generation. This is the executable build
  layer, not a conceptual primer. Platform-neutral: casing, state vocabulary,
  and token→theme mapping are resolved by a platform binding skill (e.g.
  flutter-m3-conventions) or the project CLAUDE.md — see the Platform Binding
  section.
---

# AI-Ready Design System (Infinum)

Platform-invariant rules for structuring and naming a Figma design system so AI
tools (Claude, MCP, Copilot, Cursor) and developers read it correctly.

## Core principle

AI tools read layer trees, token names, property values, and description text.
They do not see rendered output. Everything a skilled human infers from context
— brand, intent, state logic, usage rules — must be explicitly encoded in the
file structure. The rules below make that structure legible.

## Layering & precedence

```
project CLAUDE.md  >  platform binding skill (flutter-m3-conventions, …)  >  this skill
```

This skill never asserts a casing for enum values, property names, or the
semantic-color collection. Anything that varies by framework lives in the
**Platform Binding** section at the bottom and is filled in by a binding skill.
If no binding is loaded, assume the Web/CSS defaults shown there.

---

## Quick reference

| Element | Convention | Casing |
|---|---|---|
| Component name | matches the code import name exactly | PascalCase (invariant) |
| Layer name | role-based, named bottom-up, describes content | kebab-case (invariant) |
| Property name | one dimension each | → platform binding |
| Enum values | drawn from the §6 taxonomy | → platform binding |
| Boolean prefix | `is` (whole-component) / `has` (content slot) | invariant |

---

## 1. Token architecture (invariant)

Three layers. Skip one and the semantic chain breaks.

| Layer | Purpose | Naming example |
|---|---|---|
| **Primitives** | Raw values only — never bound to components directly | `neutral/90`, `blue/40`, `space/4` |
| **Semantic** | Role-based aliases to primitives; app-level meaning | `surface/action/primary`, `onSurface` |
| **Component** | Component-scoped aliases; only when no semantic token fits | `button/primary/container` |

**Decision rule** — before creating a component token, check whether an existing
semantic token expresses the intent. If it does, bind to it directly; no wrapper.
Component tokens that add no new meaning inflate the library and slow AI
navigation.

### Variable scopes — always explicit, never `ALL_SCOPES`

Scopes signal which tokens apply where. `ALL_SCOPES` pollutes every picker and
makes intent ambiguous.

| Token type | Correct scopes |
|---|---|
| Primitive — color | `[]` — hidden from all pickers |
| Primitive — radius | `CORNER_RADIUS` only |
| Background / surface color | `FRAME_FILL`, `SHAPE_FILL` |
| Text color | `TEXT_FILL` |
| Border / stroke color | `STROKE_COLOR` |
| Icon color | `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR` |
| Spacing / gap | `GAP` |
| Semantic color role | `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR` |

### No paint styles
Variables only. Paint styles don't appear in token browsers, can't be aliased,
and silently break the semantic chain AI tools follow.

### Opacity tokens — alpha primitives (Figma limitation)
Figma cannot apply an opacity modifier on top of an *aliased* color variable. So
a **reusable translucent token** (e.g. a 5%-tinted signal background) can't be
"semantic-alias + opacity" — it must be baked as a hardcoded RGBA **primitive**,
which semantics then alias to. Name them so the source is legible:
`alpha/red-500-05` = `red/500` at 5%.

> This is for *reusable* translucent tokens. A one-off translucent fill (e.g. a
> disabled container) can still set opacity at the fill level on a bound paint —
> see the platform binding's disabled-state rule.

### Code syntax
Set code syntax on every token intended for developer handoff. The exact
platform keys and formats are platform-specific — see the Platform Binding.

---

## 2. Token naming (pattern invariant; semantic-color casing → binding)

Pattern: `category/role/variant/state` — slash-separated, hyphenated phrases for
multi-word segments.

> **Figma limitation — no decimal points in variable names.** For sub-integer
> steps, replace the decimal with an underscore: `spacing/0_5`, not `spacing/0.5`.

| Category | Pattern | Avoid |
|---|---|---|
| Color — surface | `surface/action/primary` | `blue-500`, `btn-bg` |
| Color — text | `text/signal/danger` | `red/600`, `dark-text` |
| Color — border | `border/input/focus` | `outline-blue` |
| Spacing | `padding/component/md`, `gap/component/xs` | `spacing-16`, `gap2` |
| Radius | `radius/sm`, `radius/full` | `corner-8`, `rounded` |
| Typography | `font/size/body/md`, `font/weight/semibold` | `text-14`, `bold` |
| Motion | `duration/fast`, `easing/standard` | `animation-200` |
| Elevation | `elevation/level/1` | `shadow-sm` |

> The **semantic color collection** naming (e.g. web `surface/action/primary`
> vs. M3 `onSurface`) and its casing are platform-specific → Platform Binding.
> Primitives, spacing, radius, motion, and elevation follow this pattern on all
> platforms.

**Status / signal taxonomy** — one consistent set across all four properties:

`error · warning · success · info · neutral`

Every status concept exists in all four namespaces: `surface/signal/error`,
`text/signal/error`, `border/signal/error`, `icon/signal/error`.

---

## 3. Component names — PascalCase (invariant)

- PascalCase, matching the code import name exactly: `Button`, `InputField`,
  `NavigationItem`. A Figma↔code name mismatch breaks Code Connect and forces
  manual mapping.
- Slash `/` only for genuine sub-component families: `Navigation/Item`,
  `Avatar/Group`. Never for platform, theme, or version — those are properties,
  not separate components.

---

## 4. Layer names — kebab-case, role-based, bottom-up (invariant)

- **kebab-case** — visually distinct from component names (PascalCase) and
  property names (binding-defined).
- **Role-based, not positional/appearance** — `leading-icon` not `icon-left`;
  `helper-text` not `text-below`.
- **Bottom-up** — name deepest layers first; parent names follow from contents.
- **No default names** — `Frame 1`, `Rectangle`, `Group 3` are invisible to AI
  and scripts; rename before publishing.
- **No groups** — groups have no layout model and read inconsistently; use
  auto-layout frames.
- **Unique within parent** — duplicate siblings break `findOne(name)` targeting.
- **Name all intermediate frames** — inner containers and slots, not just the top.

Standard leaf nodes:

| Node | Name |
|---|---|
| Icon | `icon` · `leading-icon` · `trailing-icon` |
| Primary / supporting text | `label` · `description` · `helper-text` · `error-message` |
| Placeholder | `placeholder` |
| Surface / border / focus | `background` · `border` · `focus-ring` |
| Media | `avatar` · `thumbnail` |
| Other | `badge` · `divider` · `spinner` · `scrim` · `signal-icon` |

Positional vocabulary (never `icon-1`, never `frame-left`):
- horizontal → `leading-* / trailing-*`
- vertical → `top-* / bottom-*`
- importance → `primary-action / secondary-action`

---

## 5. Component properties — one dimension each (casing → binding)

- Each property = one clearly scoped dimension. Reserved dimension vocabulary:
  `state · size · variant · orientation · alignment · position` (enums);
  `label · description · placeholder · helperText · errorMessage · badgeCount` (text).
- **State is always an enum, never split into booleans.** `isDisabled` is wrong;
  `disabled` is a state. Booleans allow invalid combinations; enums make mutual
  exclusivity legible to AI.
- **One enum, not N booleans, for any mutually-exclusive dimension.** A tooltip's
  placement is `position: top | right | bottom | left` — never four booleans
  (`isTop`, `isRight`…), which permit two-true-at-once and hide the exclusivity.
  Same logic as `state`.
- **Booleans:** `is*` for whole-component conditions (`isLoading`, `isRequired`,
  `isFullWidth`, `isReadOnly`); `has*` for content-slot toggles (`hasLeadingIcon`,
  `hasBadge`, `hasDescription`).
- **Text properties match layer names** — `label` controls the `label` layer;
  `helperText` controls `helper-text`.
- **Wire every property to a child node** — TEXT → `characters`, BOOLEAN →
  `visible`, INSTANCE_SWAP → `mainComponent`. Unwired properties are invisible
  to code generation.
- **INSTANCE_SWAP preferred values** — populate icon-slot lists so AI and
  designers pick from a defined set.
- Property-name **casing**, the **visual-treatment property name**
  (`variant` vs. `Type`), and **state vocabulary/casing** → Platform Binding.

---

## 6. Enum value taxonomy (concepts invariant; casing → binding)

The *values that exist* are standard; their casing follows the binding.

- `state`: base `default · hover · focused · pressed · disabled`;
  inputs add `filled · error`; nav items use `selected`.
- `variant` families: hierarchy `primary · secondary · tertiary`;
  appearance `filled · outline · ghost`; tag `solid · subtle · surface`.
- `size`: `xs · sm · md · lg · xl`; two-size components use `sm · lg`.
- `orientation` `horizontal · vertical` · `alignment` `left · center · right`
  · `position` `top · right · bottom · left`.

---

## 7. Structural consistency (invariant)

Every variant in a component set shares the SAME layer schema — same names,
depth, types, order.

- **Hidden, not absent** — layers inactive in a variant stay present but hidden.
  This is the rule for optional content slots (`leading-icon` hidden when
  `hasLeadingIcon=false`).
- **Delete, don't hide, what doesn't belong** — layers with no role in any state
  should be deleted. AI iterates hidden layers and treats them as present;
  phantom structure is noise.
- **Explicit `FIXED/FILL/HUG` sizing on every auto-layout child** — unset values
  use context-dependent Figma defaults AI cannot infer.
- **Explicit alignment** — always set `primaryAxisAlignItems` and
  `counterAxisAlignItems` on every auto-layout frame.
- **Consistency check:** layer count · names · nesting depth · layer types ·
  stacking order.
- **Structural families** — when variants genuinely need different layouts (not
  just hidden slots), they form separate families: identical *within* each
  family, different *between* families. Don't force one schema to cover both.

---

## 8. AI / MCP readiness (invariant)

File structure directly determines generated-code quality. Applies to every
published component.

- **Bind every fill, stroke, and effect to a variable** — applying a collection
  to the file is not enough. Unbound layers emit hardcoded hex in generated code.

  | Layer property | Bound output | Unbound output |
  |---|---|---|
  | Fill / text / border color | `var(--token, #fallback)` | `#rrggbb` |
  | Font size | `var(--size/body, 14px)` | `text-[14px]` |

- **Auto-layout on all components and structural frames** — even single-element
  wrappers. Frames without it generate absolute-positioned code.
- **Name every meaningful layer** — names become `data-name` and inform
  generated variable/function names. Rename icon vectors (`Vector`, `Path`) to
  their role (`icon-close`).
- **Keep nesting shallow** — max 3–4 frame levels inside a component; collapse
  intermediate frames that add no meaning.
- **Consistent bounding boxes** — all icons of one size share identical bounds
  (e.g. every 24px icon is exactly 24×24).
- **Documentation layers live outside component bounds** — hidden annotation
  layers inside a component still appear in MCP output.
- **Use properties, not duplicate variants**, for anything that should be a
  boolean, text, or instance-swap (see §5).
- **Set up Code Connect** for every component with a real codebase
  implementation — MCP then returns the real import instead of generated code.

---

## 9. In-file documentation (invariant)

AI reads what's in the Figma file. Notion, Confluence, and Storybook are
invisible unless explicitly integrated.

- **Component description field** (one line): what it is + when to use.
  Machine-readable, surfaces in Dev Mode.
- **Showcase frame** (canvas, adjacent to the set):
  1. About — name + 2–3 sentences (what / when / key variants)
  2. Usage sections — one per grouping (types, sizes, states, with icon…)
  3. Do / Don't — for components with common misuse patterns
- **Cover:** purpose; when NOT to use (esp. vs. a similar component —
  `Toast` vs. `Banner`, `outline` vs. `ghost`); what each state means;
  accessibility requirements (contrast, keyboard, ARIA roles).

---

## 10. Audit & validation (invariant)

**Tokens** — no `ALL_SCOPES`; no paint styles; no hardcoded hex in semantic or
component layers; code syntax set; no duplicate aliases; signal taxonomy
complete across surface/text/border/icon.

**Components** — no default names; no groups; no duplicate siblings; identical
layer schema across variants; state is an enum; all properties wired;
INSTANCE_SWAP preferred values populated; description field set.

**Documentation** — one-line description per component; showcase frame with
About + ≥1 usage grouping.

**Validation (the real test):** ask an AI tool to describe a component using only
what it reads from the file, with no prior context. Compare to the intended spec.

| AI output | Means |
|---|---|
| Guesses purpose/usage | Undocumented |
| Wrong component name | Figma name ≠ code name |
| Wrong tokens in code | Token alignment or code syntax missing |
| References wrong variant | Layer schema inconsistent across variants |
| Ignores optional slots | Properties not wired to children |

---

## Platform Binding — resolved by the platform skill or project CLAUDE.md

This skill deliberately does NOT decide these. A binding (e.g.
`flutter-m3-conventions`) fills them in. If none is loaded, assume the Web/CSS
defaults.

| Decision | Web / CSS default | Resolved by binding |
|---|---|---|
| Enum value casing | lowercase (`primary`) | — |
| Property-name casing | camelCase (`variant`) | — |
| Visual-treatment property name | `variant` | — |
| State vocabulary / casing | `default · hover · focused · pressed · disabled` | — |
| Semantic-color collection naming | `surface/action/primary` | — |
| Token → theme mapping & code syntax | CSS vars / theme object | — |

---

## Reference components (apply the binding's casing)

**Button** — layers: `button-root › background · focus-ring · content(leading-icon
· label · trailing-icon · spinner)`. Props: `variant`, `size`, `state`,
`isLoading`, `isFullWidth`, `hasLeadingIcon`, `hasTrailingIcon`, `label`.

**InputField** — layers: `input-root › label · input-wrapper(background · border ·
content(leading-icon · placeholder · input-text · trailing-icon · clear-button)) ·
helper-text · error-message`. Props: `size`, `state`, `isRequired`, `isReadOnly`,
`hasLeadingIcon`, `hasClearButton`, `label`/`placeholder`/`helperText`/`errorMessage`.

**Tooltip** — layers: `tooltip-root › background · arrow · label`. Props:
`position` (single enum — never four booleans), `size`, `isOpen`, `label`.
Demonstrates a placement-driven component: the whole treatment turns on one
mutually-exclusive `position` dimension.
