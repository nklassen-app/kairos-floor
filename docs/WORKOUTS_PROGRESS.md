# Workouts — seeing my lifting progress, and changing exercises

*Workouts 3, decided with N. in a session on 2026-10-27. It shapes
Workouts 2 (progress) and Workouts 4 (the exercise editor) in the Kairos
backlog.*

## What counts as progress

**The weight I used**, per exercise, over time. That is what Record
already saves, so nothing new is typed at the gym. Sets and reps stay out,
as the epic's anti-goal says.

A weight is free text. A value that starts with a number (`22.5`,
`24 kg`, `20/22`) counts by its first number; a value without one (`BW`,
`band`) is shown as written and never counts as up or down.

## What I see first: what moved

A **Progress** button beside Record, on the Workouts tab, opens one line
per exercise I have recorded:

- the first weight ever recorded → the latest, and the change
  (`16 → 22.5 · +6.5`);
- when it last went up (`up 12 Oct`). No "stalled" mark: the numbers
  speak, I judge (N., 2026-10-28);
- exercises grouped by routine, in the routine's order; an exercise in two
  routines (Hip Airplane) is one line.

Tapping a line opens that exercise's history: every recorded weight,
oldest → newest, with its date, and a small inline line chart when the
values are numbers. From a date there I can open that workout to fix a
mistyped weight or delete it, with a confirm (the Workouts 1 exception for
typos, kept).

## Changing exercises: in the app

*Reverses the 2026-09-27 decision "no in-app workout editor" (N.,
2026-10-27).*

An **Edit** mode on the Workouts tab, per routine and part:

- **add** an exercise (name and rx), **rename** one, change its **rx**,
  **remove** one, **move** one up or down within its part;
- a removed exercise keeps its history and still shows in Progress,
  marked *removed*; adding it back by the same name brings the line back;
- an exercise's id is made when it is added and never changes, so a
  rename keeps its history.

What it costs: the routines move from the page's code into the phone's
storage. The code's routines become the **first seed** only; after that
the phone's copy is the truth, and a code change to the routines no
longer reaches the phone. The phone's storage is still the only copy, as
for the log.

## Reviewed with N. (2026-10-28)

- **No "stalled" mark** (Claude had proposed one after three records
  without a rise).
- **The baseline is the first weight ever recorded**, not a recent window.
- **The phone holds the only copy of the routines** once the editor
  ships, as it does for the log: no copy-out.
- **Order:** Workouts 2 (progress) first, then Workouts 4 (the editor).

## Not built

Charts beyond the one small line, sets and reps, timers, suggestions,
export or sync, a Strength pip ticked by Record. The epic's anti-goal
stands.
