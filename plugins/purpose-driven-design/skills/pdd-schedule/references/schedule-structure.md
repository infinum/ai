# Project Schedule — Structure & Styling

Output matches the ETR/Infinum **Project Schedule** tab. The build script edits a copy of the
bundled `assets/schedule-template.xlsx` (keeping only that sheet), so the week/day/date header,
fonts and grid styling are preserved exactly.

## Layout
- **Row 1:** "Week N" labels (merged across each week's 7 day-columns; Week 1 gets a `*`).
- **Row 3:** day-of-week letters — M, T, W, Th, F, Sat, Sun.
- **Row 4:** the daily dates (start at column **E**), one column per day.
- **Left columns (A–D):** A = phase heading, B = task number, C = task name, D = date range.
- **Gantt area (E onward):** each task's day cells are shaded in its phase colour for the
  task's date span. Single-day items (milestones) are one shaded cell.

## Fonts & colours
- Phase headings: **IBM Plex Sans** 11pt bold. Task rows: **Arial** 10pt (milestone names bold).
- Title (optional, top-left): IBM Plex Serif.
- **Phase bar palette** (one colour per phase, in order): `E1EC9E` (yellow-green), `F6A3C0`
  (pink), `9FB4DB` (blue), `B6D7A8` (green), `C3D83B` (lime), `6E8EC8` (blue). Opaque ARGB.

## Milestones
Mark delivery dates and client-feedback-due dates as milestones: set `"milestone": true` and
use a single day (`start` == `end`). The script renders them as a one-day marker with a `◆`
prefix and a bold task name.

## Build script config (`scripts/build_schedule.py`)
```json
{
  "title": "Acme — Website Redesign",
  "start": "2026-07-06",
  "weeks": 16,
  "phases": [
    {"name": "Discovery Process", "color": "E1EC9E", "tasks": [
      {"num": "1.0", "name": "Discovery kickoff",           "start": "2026-07-08", "end": "2026-07-08", "milestone": true},
      {"num": "1.1", "name": "Stakeholder interviews",      "start": "2026-07-09", "end": "2026-07-20"},
      {"num": "1.2", "name": "Discovery readout (delivery)", "start": "2026-07-24", "end": "2026-07-24", "milestone": true},
      {"num": "1.3", "name": "Client feedback due",         "start": "2026-07-29", "end": "2026-07-29", "milestone": true}
    ]},
    {"name": "User Experience", "color": "F6A3C0", "tasks": [ ... ]},
    {"name": "Visual Design",   "color": "9FB4DB", "tasks": [ ... ]},
    {"name": "Development",      "color": "B6D7A8", "tasks": [ ... ]}
  ]
}
```
`weeks` is optional (inferred from task dates). `color` per phase is optional (palette in order).
Use a Monday for `start` so weeks line up.
