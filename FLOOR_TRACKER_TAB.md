# The Floor — Tracker tab design

*Design doc for story **F2** in `BACKLOG.md`. Settled with N. 2026-09-05.
Prototype: `docs/workout-tracker.html` (removed 2026-09-27 — recover from git history; reference only, see §6).*

## 1. What it is

The Floor gains a second tab. Tab one stays the weekly habit floor untouched.
Tab two — **Tracker** — is a weight log: three sections, each a defined
circuit of exercises, and for each exercise one field per week to record the
max weight used. Presence lives on tab one; magnitude lives here.

## 2. Structure — three sections

The prototype organizes exercises as 2 flows × 3 tiers. The tracker
reorganizes them **by tier**: each section merges the Upper and Lower
exercises of that tier into one circuit. Exercises are **hardcoded** from the
prototype, names and prescriptions verbatim; fields all start blank (no data
seeded from anywhere).

**Base · 0–20′** (7)

| Exercise | Rx |
|---|---|
| Flat DB Bench Press | 3 × 8 |
| One-Arm DB Row | 3 × 10 / side |
| Seated DB Shoulder Press | 3 × 10 |
| Kettlebell Swing | 4 rnd · 40/20 |
| Goblet Squat | 4 rnd · 40/20 |
| Alternating Reverse Lunge | 4 rnd · 40/20 |
| Mountain Climbers | 2 rnd · 40/20 |

**Extension · 20–40′** (8)

| Exercise | Rx |
|---|---|
| Incline DB Press | 3 × 10 |
| Pull-Ups or Lat Pulldown | 3 × 8 |
| DB Biceps Curl | 3 × 12 |
| Overhead Triceps Extension | 3 × 12 |
| DB Romanian Deadlift | 3 rnd · 40/20 |
| Jump Squat | 3 rnd · 40/20 |
| Weighted Step-Up | 3 rnd · 40/20 / side |
| Plank Hold | 3 rnd · 40/20 |

**Finisher · 40–60′** (8)

| Exercise | Rx |
|---|---|
| Lateral Raise | 3 × 15 |
| Face Pull (band/cable) | 3 × 15 |
| Farmer's Carry | 3 × 40 m |
| Hanging Knee Raise | 3 × 12 |
| Hip Thrust | 3 rnd · 40/20 |
| Bulgarian Split Squat | 3 rnd · 40/20 / side |
| Burpees | 3 rnd · 40/20 |
| Standing Calf Raise | 3 rnd · 40/20 |

Each exercise gets a stable id (short slug, e.g. `bench`, `kbswing`) —
storage keys depend on ids, so ids never change even if a display name does.

## 3. Week model

Same clock as the floor: the custom annual numbering (week 1 starts Jan 1,
later weeks start Monday), derived from the date via the existing
`weekNumber()`, re-synced on visibility/focus exactly like tab one. No fixed
13-week program, no start date — the tracker runs indefinitely and the two
tabs always agree on what "this week" is.

## 4. Entry & history (520px, one week at a time)

Per the chosen layout ("this week + history"):

- Each exercise renders as a row: name, rx subtitle, and **one entry field
  for the current week**, blank until filled.
- Values are short free text (max 6 chars, `inputmode="decimal"`) — numbers
  in whatever unit N. uses, `BW` for bodyweight. Blank = not logged; only
  non-empty values are stored.
- Autosave on input (debounced), like everything else in the app. No save
  button, no save-state chrome.
- **Tapping the row** (outside the field) expands that exercise's history
  inline: past weeks that have a value, oldest → newest, as compact
  `W35 24` pairs. Read-only. Walks back up to 26 weeks, crossing the year
  boundary if needed. Collapsed by default; one exercise open at a time is
  fine.
- **Only the current week is editable.** History is a record, same ethos as
  the floor. *Accepted limitation:* a forgotten Sunday entry can't be
  backfilled Monday. If that bites in practice, a one-week grace edit is the
  designed loosening — not general retro-editing.

```
┌──────────────────────────────┐
│ BASE · 0–20′                 │
│ Flat DB Bench   3×8   [ 24 ] │
│ ▾ One-Arm Row  3×10   [    ] │
│   W33 22 · W34 22 · W35 24   │
│ Shoulder Press 3×10   [ 16 ] │
└──────────────────────────────┘
```

## 5. Data model

Mirrors the floor's: one localStorage record per week, keyed
`tracker-<year>-w<week>`, holding only the exercises logged that week:

```json
{ "bench": "24", "row": "22", "kbswing": "16" }
```

Values stored as entered (strings). Finished weeks stay under their keys
forever; the current week's record is created on first entry. Rollover needs
no migration — a new week simply reads an absent key and renders blank.

## 6. What is *not* ported from the prototype

- **The art direction.** The prototype's Archivo/blue/red/highlight styling
  stays in the prototype. The tracker is drawn in the Floor's existing
  tokens (desk, panel, ena, mono) — one app, one calm surface. Section
  accent colors, if any, come from the Floor palette.
- **The duration dial** (20′/40′/60′ tier visibility) — dropped for v1; all
  three sections always visible.
- **Notes textareas** — dropped for v1.
- **The 13-column grid, storage bar, clear-all button** — replaced by §4/§5.
  Week reset for tracker data is deliberately absent; "Reset week" on tab
  one keeps clearing floor marks only.
- **Its storage** (`q3-2026-workout-log` key) — never read, never migrated.

`docs/workout-tracker.html` was the design source for the exercise list. Once
the list lived in `CIRCUITS` in `index.html` it had no job left, and as a
public Pages page it called Google Fonts and wrote its own key into the app's
origin storage — removed 2026-09-27 (still in git history).

## 7. Tabs & app shell

- A tab bar at the top of the app: **Floor · Tracker**. The app opens on
  Floor (the habit floor stays the primary surface); switching is instant,
  both views live in `index.html` — still no build step, no dependencies.
- Tab choice is not persisted; every open starts on Floor.
- The annual coverage strip and the F1 week lens stay Floor-tab features;
  the tracker's history affordance is its own (§4). No coupling in v1.
- `sw.js` cache version bumps with the change so installed PWAs pick it up.
