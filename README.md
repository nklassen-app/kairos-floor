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

## Data model

Per week, per mark, an integer count in `localStorage` under `floor-<year>-w<week>`:

```json
{ "car": 0-5, "str": 0-2, "yog": 0-2 }
```

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
