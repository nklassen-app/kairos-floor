# The Floor

A weekly habit floor, not a training program. Three marks — Cardio, Strength, Yoga —
tapped as sessions happen. Presence, not magnitude: a pip is filled or it isn't.

Implemented from the Claude Design project "The Floor" (`The Floor.dc.html` +
`the-floor-design-doc.md`), as a local-first installable PWA — no build step,
no dependencies, no account.

## Run

Serve the folder over HTTP (service workers don't register from `file://`):

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. On a phone, "Add to Home Screen" installs it standalone.

## Test

DOM-level suite: `index.html` booted in jsdom under a controllable clock, one
fresh window per test (tabs, marks, the week lens, the Workouts tab's routines /
Record / hint / draft, reset isolation, the version tag vs `sw.js`).

```sh
cd tests && npm install && npm test
```

## Layout

```
index.html                  the app — one file, no build
sw.js                       service worker; CACHE name = the version tag shown in the page
manifest.webmanifest        PWA manifest
tests/floor.test.mjs        the DOM suite (node --test + jsdom)
native/                     Capacitor Android shell (FLOOR_NATIVE_WRAPPER.md)
FLOOR_TRACKER_TAB.md        design doc for the old Tracker tab (F2, replaced by
                            Workouts in F3)
BACKLOG.md                  closed, history only — open work lives in
                            kairos-system/BACKLOG.md
```

## Data model

Per week, per mark, an integer count in `localStorage` under `floor-<year>-w<week>`:

```json
{ "car": 0-5, "str": 0-2, "yog": 0-2 }
```

Recorded workouts, one array under `workouts-log`, oldest first — only the
fields typed, values as entered (short strings, `BW` allowed), keyed by the
stable exercise ids in `ROUTINES`:

```json
[{ "id": "wmg2k1x0", "routine": "upper", "at": "2026-09-28T16:30:00.000Z",
   "weights": { "bench": "22.5", "dips": "BW" } }]
```

Typed-but-unrecorded weights sit under `workouts-draft` until Record:
`{ "routine": "upper", "fields": { "upper": { "bench": "22.5" } } }`.

The old weekly tracker records (`tracker-<year>-w<week>`, F2) stay in storage,
never read or shown — a fresh start, reversible.

Week numbering is the mock's custom formula (week 1 starts Jan 1 regardless of
weekday), preserved exactly so stored keys stay stable. Not ISO-8601 — don't swap
in an ISO week library without renumbering stored history.

Per the design doc (§7), the mock's 2026 history seeding was **not** ported —
the app starts with genuinely empty history.

## Interactions

- Tap a row (or Enter/Space when focused) → +1 session, capped at target.
- Tap a pip → set count to that pip; tapping the last filled pip undoes it.
- Reset week → confirm dialog, clears the current week only.
- The annual strip shows per-week coverage level (full / partial / thin / absent / ahead),
  with the current week outlined and updating live.
- Tap a past week in the strip → the week lens: that week's floor, read-only, with
  "Back to this week" (or tap the current cell) to return.
- Workouts tab → pick Upper Body, Lower Body or Posture & Stability; each shows its
  three parts (20′ · 40′ · 60′) with an empty weight field per exercise and last
  time's weight as a grey hint. Record saves the workout with today's date and
  clears the fields; an empty Record is refused. Record never ticks a pip.
  Routines change by push (edit `ROUTINES`, bump `sw.js`), not in the app.
