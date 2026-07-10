# FigJam Template Specs
Source: <YOUR_FIGMA_TEMPLATE_BOARD_URL>

## Card Dimensions
- Total card size: **2464 × 1744px**
- Place cards side-by-side with **200px gap** between them (so each subsequent card starts at x + 2664)
- Wrap each card in a FigJam **section** node

---

## Colors
- Header background (top zone): `#FAD4CE` (light salmon/pink)
- Section label fills (Quotes, Goals, Needs, Demographics, Frustrations, Habits): `#E8583A` (coral/red)
- Section label text: `#FFFFFF` (white)
- Trait bar background (full width): `#FAD4CE` or light version of the accent color
- Trait bar fill (foreground): `#E8583A`
- Body text: `#1A1A1A` (near black)
- Card background: `#FFFFFF`

> Note: The template uses different accent colors per archetype in the vet med example (teal for student, orange-red for vet, green for manager). When generating multiple archetypes, vary the accent color per card for visual distinction. Suggested palette:
> - Archetype 1: `#E8583A` (coral/red)
> - Archetype 2: `#2BBFB3` (teal)
> - Archetype 3: `#3BB87A` (green)
> - Archetype 4: `#7B5EA7` (purple)
> - Archetype 5: `#F5A623` (amber)

---

## Header Zone (y: 0–560px)

### Background
- Shape: rectangle, full width (2464px), height 560px
- Fill: `#FAD4CE` (or archetype accent color lightened)

### Symbol Circle
- Shape: ellipse
- Position: x=96, y=112
- Size: 240 × 237px
- Fill: archetype accent color (e.g. `#E8583A`)
- Contains text: "Symbol Representing Archetype" (placeholder; in practice leave empty or use initials)

### Archetype Name
- Position: x=448, y=80
- Size: 468 × 96px
- Font: bold, ~52px
- Color: `#1A1A1A`

### 1st-Person Narrative
- Position: x=448, y=197
- Size: 1040 × 252px
- Font: regular, ~24px
- Color: `#1A1A1A`
- Line height: ~1.5

### Industry Mindset Bars (top-right area)
Four traits stacked vertically. For each trait:

**Trait label text:**
- x=1712, y=(29 | 159 | 289 | 418) — increments of ~130px
- Font: regular, ~24px

**Background bar (full width):**
- x=1712, y=(79 | 208 | 338 | 468)
- Size: 640 × 48px
- Fill: `#FAD4CE` (light, low opacity version of accent)

**Foreground bar (fill level):**
- x=1712, same y as background bar
- Height: 48px
- Width: 0–640px (proportional to trait level — e.g. low=160px, medium=336px, high=560px)
- Fill: archetype accent color (e.g. `#E8583A`)

---

## Content Grid (y: 608px onward)

Three columns × two rows of sections:

| | Column 1 (x=96) | Column 2 (x=864) | Column 3 (x=1656) |
|---|---|---|---|
| **Row 1** | Quotes | Goals | Needs |
| **Row 2** | Demographics | Frustrations | Habits |

### Section Label Boxes
- Size: 576 × 64px
- Row 1 labels y: **608px**
- Row 2 labels y: **1141px** (Demographics), **1141px** (Frustrations), **1142px** (Habits)
- Fill: archetype accent color
- Text: white, bold, ~24px, centered

### Bullet Item Text Nodes
Each section has 3 bullet items stacked below its label:

**Row 1 items start y:** 693–707px (slight variation per column — use 707px for consistency)
**Row 2 items start y:** 1241px

Each item:
- Width: 624px
- Height: 108px
- x: same as section column (96 / 864 / 1656)
- Vertical spacing: 130px between items (y: 707, 837, 967)
- Font: regular, ~24px
- Text prefix: `• ` (bullet + space)

---

## Figma Plugin API Notes

Use `figma.createSection()` for the card wrapper.

For text nodes:
```javascript
const t = figma.createText();
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
t.fontName = { family: "Inter", style: "Regular" };
t.characters = "• Your bullet text here";
t.x = 96; t.y = 707;
t.resize(624, 108);
```

For filled rectangles (bars, label backgrounds):
```javascript
const rect = figma.createRectangle();
rect.resize(640, 48);
rect.x = 1712; rect.y = 79;
rect.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.35, b: 0.23 } }]; // #E8583A
```

For sections:
```javascript
const section = figma.createSection();
section.name = "Archetype Name";
section.resizeWithoutConstraints(2464, 1744);
section.x = 0; // or offset for subsequent cards
```

**Always load fonts before setting text.**
Recommended font: `Inter` — use `Regular` for body, `Bold` for headers and archetype name.
