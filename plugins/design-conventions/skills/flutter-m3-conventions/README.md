# flutter-m3-conventions

The Flutter Material 3 **platform binding** for `ai-ready-design-system`. Resolves the framework-specific decisions that skill leaves open, and provides the full Flutter `ColorScheme` / `TextTheme` mapping needed for Figma → Flutter code generation.

## Usage

```
/design-conventions:flutter-m3-conventions
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

This skill also auto-triggers on: Flutter, M3, Material 3, ColorScheme, TextTheme, Dart, mobile design system.

## What it does

Fills the **Platform Binding** table that `ai-ready-design-system` leaves open, and adds Flutter-specific structural rules:

- **Binding answers** — enum-value casing (PascalCase), `Property=Value` naming, `Type` over `variant`, the `Default · Hovered · Focused · Pressed · Disabled` state vocabulary, `S · M · L` sizing, M3 camelCase semantic-color naming.
- **M3 Color Scheme collection** — variable names that match Flutter's `ColorScheme` exactly, plus the `custom/` prefix for non-spec roles and `on*` pairing rules.
- **Disabled state via opacity, code-syntax keys (`'ANDROID'` as the Flutter/Dart proxy — there is no `'FLUTTER'` key), variant state naming, the full `TextTheme` typography map, valid icon sizes, and widget-level rules.**

## Requires

Load **alongside** `ai-ready-design-system` (in the [`ai-ready-figma`](../../../ai-ready-figma/) plugin) — that skill defines the platform-neutral structure this one binds to. On its own, this skill has no structure to resolve.

Precedence: `project CLAUDE.md` > this skill > `ai-ready-design-system`.

## Adding more platforms

This plugin is the home for platform bindings. To add SwiftUI, Jetpack Compose, or another target, add a sibling skill folder (`skills/<platform>-conventions/`) and bump this plugin's version — no new plugin or marketplace entry needed.
