---
name: flutter-m3-conventions
description: >
  Flutter Material 3 platform binding for Infinum's ai-ready-design-system
  skill. Resolves the casing, property-name, state-vocabulary, semantic-color
  naming, and token→theme decisions that ai-ready-design-system leaves open,
  and provides the full Flutter ColorScheme / TextTheme mapping required for
  Figma → Flutter code generation. Use ALONGSIDE ai-ready-design-system
  whenever the project targets Flutter or Material 3. Triggers on: Flutter, M3,
  Material 3, ColorScheme, TextTheme, Dart, mobile design system. Cowork-ready.
---

# Flutter M3 Conventions (Infinum platform binding)

Load **with** `ai-ready-design-system`. That skill defines the platform-neutral
structure; this one fills its Platform Binding for Flutter and adds the Flutter
ColorScheme / TextTheme rules.

Precedence: `project CLAUDE.md > this skill > ai-ready-design-system`.

## Core principle

Flutter's `ColorScheme` and `TextTheme` classes map directly to Figma variable
names. If the names don't match exactly, code generation produces wrong
references or falls back to hardcoded values. These aren't conventions — they're
structural requirements for the design-to-code bridge to work.

---

## Binding answers

Fills the table left open in `ai-ready-design-system`. The *taxonomy* of which
values exist still comes from that skill (§6); this only sets casing and the
Flutter-specific names.

| Decision | Flutter M3 value |
|---|---|
| Enum value casing | **PascalCase** — `Primary`, `Default`, `M` |
| Property-name casing | Figma **`Property=Value`** — `Type=Primary, Size=M, State=Default` |
| Visual-treatment property name | **`Type`** (not `variant`) |
| State vocabulary | **`Default · Hovered · Focused · Pressed · Disabled`** |
| Size scale | `S · M · L` (PascalCased t-shirt scale) |
| Semantic-color collection naming | **M3 camelCase** matching `ColorScheme` (`onSurface`, `primaryContainer`) |

---

## 1. M3 Color Scheme collection

Variable names must match Flutter's `ColorScheme` properties exactly — same
casing, same spelling.

```
primary        onPrimary        primaryContainer       onPrimaryContainer
secondary      onSecondary      secondaryContainer     onSecondaryContainer
tertiary       onTertiary       tertiaryContainer      onTertiaryContainer
error          onError          errorContainer         onErrorContainer
surface        onSurface        surfaceVariant         onSurfaceVariant
outline        outlineVariant   shadow                 scrim
inverseSurface onInverseSurface inversePrimary
surfaceContainerLowest  surfaceContainerLow  surfaceContainer
surfaceContainerHigh    surfaceContainerHighest
```

**Do not add variables to this collection whose names don't exist in Flutter's
`ColorScheme` class.** Custom additions (success, warning, link, icon colors)
must be prefixed `custom/` to signal they're extensions, not standard M3 roles.

## 2. Custom extensions — `custom/` prefix

Cross-cutting semantic roles not in the M3 spec live in the M3 Color Scheme
collection with a `custom/` prefix:

```
custom/success          custom/onSuccess
custom/successContainer custom/onSuccessContainer
custom/warning          custom/onWarning
custom/warningContainer custom/onWarningContainer
custom/info             custom/onInfo
custom/link
```

These are app-level roles. A token specific to one component type (e.g. a
button's container color that maps to no M3 role) belongs in Component Tokens,
not here. Every `custom/on*` token must pass 4.5:1 contrast against its paired
background.

## 3. on* color pairing

Content on a colored surface always uses that surface's `on*` counterpart.

| Surface | Content |
|---|---|
| `primary` | `onPrimary` |
| `surface` | `onSurface` |
| `error` | `onError` |
| `primaryContainer` | `onPrimaryContainer` |
| `custom/success` | `custom/onSuccess` |

Never place text/icons in the same role as their background; never mix roles
across the pairing boundary (e.g. `onSurface` text on a `primary` surface).

## 4. Disabled state

Do not create separate disabled color tokens — use opacity on existing tokens.

- **Container fill:** `onSurface` at **12%**
- **Text & icon content:** `onSurface` at **38%**

Apply opacity at the **fill level**, not on the node (node opacity affects all
children and can't be overridden per layer).

```js
// Correct — opacity on the fill paint
let fills = [...node.fills];
let paint = fills[0];
paint = figma.variables.setBoundVariableForPaint(paint, 'color', onSurfaceVariable);
paint.opacity = 0.12; // or 0.38 for content
node.fills = [paint];
```

## 5. Variable code syntax

Set code syntax on all handoff variables. Figma's API only accepts these keys —
`'FLUTTER'` is **not** valid and will throw:

| Key | Format | Example |
|---|---|---|
| `'WEB'` | `var(--token-name)` kebab-case | `var(--color-primary)` |
| `'ANDROID'` | Dart accessor path (Flutter proxy) | `colorScheme.primary` |
| `'iOS'` | Platform-specific notation | |

Use `'ANDROID'` as the Flutter/Dart proxy — there is no `'FLUTTER'` key.

## 6. Variant state naming

Figma `State=` values must match Flutter's interaction model exactly. Inventing
other names produces states that don't map to generated code.

| Figma `State=` | Flutter state |
|---|---|
| `Default` | enabled |
| `Pressed` | pressed |
| `Focused` | focused |
| `Disabled` | disabled |
| `Hovered` | hovered (add only when targeting web/desktop) |

## 7. Typography collection → `TextTheme`

Variable names must match Flutter's `TextTheme` properties. Figma text styles map
1:1; name them with M3 level names and a slash (`Display/Large`, `Body/Small`).

| Figma style | Flutter property | Size | Weight | Line height |
|---|---|---|---|---|
| `Display/Large` | `textTheme.displayLarge` | 57 | 400 | 64 |
| `Display/Medium` | `textTheme.displayMedium` | 45 | 400 | 52 |
| `Display/Small` | `textTheme.displaySmall` | 36 | 400 | 44 |
| `Headline/Large` | `textTheme.headlineLarge` | 32 | 400 | 40 |
| `Headline/Medium` | `textTheme.headlineMedium` | 28 | 400 | 36 |
| `Headline/Small` | `textTheme.headlineSmall` | 24 | 400 | 32 |
| `Title/Large` | `textTheme.titleLarge` | 22 | 400 | 28 |
| `Title/Medium` | `textTheme.titleMedium` | 16 | 500 | 24 |
| `Title/Small` | `textTheme.titleSmall` | 14 | 500 | 20 |
| `Body/Large` | `textTheme.bodyLarge` | 16 | 400 | 24 |
| `Body/Medium` | `textTheme.bodyMedium` | 14 | 400 | 20 |
| `Body/Small` | `textTheme.bodySmall` | 12 | 400 | 16 |
| `Label/Large` | `textTheme.labelLarge` | 14 | 500 | 20 |
| `Label/Medium` | `textTheme.labelMedium` | 12 | 500 | 16 |
| `Label/Small` | `textTheme.labelSmall` | 11 | 500 | 16 |

All text nodes must bind `fontSize`, `lineHeight`, `fontFamily`, and
`letterSpacing` (where applicable) — never hardcoded. When a brand typeface
replaces Roboto, apply it at `ThemeData(textTheme:)` level — sizes and weights
stay; only the family changes. Keep the M3 level name; never invent new ones.

## 8. Icon sizes

Only **16px and 24px** are valid Flutter icon sizes — they map to
`Icon(iconData, size: 16/24)`. Don't introduce other sizes without the Flutter
developer. (48×48dp touch targets are a separate, cross-platform mobile concern —
see your team's touch-target / minimum-tap-target accessibility guidance.)

## 9. Widget-level rules

- Never `Color(0xFF…)` in widgets — always `Theme.of(context).colorScheme.*`.
- Never `TextStyle(fontSize:)` in widgets — always `Theme.of(context).textTheme.*`.
- Define custom semantic colors as `ColorScheme` extension properties, in
  background + foreground pairs.
- Light and dark `ColorScheme` instances are defined separately, switched via
  `ThemeData(colorScheme:)`.

---

## Theme-mode note (project-overridable)

Theme-mode count is a project decision — defer to project CLAUDE.md. Some Flutter
projects run light-only; others ship light + dark. When dark mode exists, every
color token needs both a light and a dark value.
