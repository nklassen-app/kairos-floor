# kairos-floor — Backlog

Working backlog for The Floor. Same convention as the Cockpit and Horizons
backlogs: steps (`☐`) are the acceptance criteria and the functional progress
units, **unweighted**. The Floor stays what it is — a weekly habit floor, no
build step, no dependencies, no account. Nothing here adds a backend or a
library.

(The native wrapper work has its own story doc, `FLOOR_NATIVE_WRAPPER.md`.)

---

## F1 — Week lens: tap a week in the coverage strip to see its floor

**Problem.** When a week rolls over, its data isn't lost — every week persists
in `localStorage` under its own `floor-<year>-w<week>` key, and `syncWeek()`
deliberately leaves finished weeks behind for the strip to pick up. But the
annual strip renders only a 4-level color per cell; there is no way to see
*what the floor looked like* — which marks were hit, how many sessions of
each. The data is sitting there with no window onto it.

**Feature.** Tap (or keyboard-activate) a past week's cell in the annual
coverage strip → the app shows that week's floor state: the three marks with
their filled pips and counts (`150 min`, `2 / 2`, …), read-only, clearly
labeled as that week (week number + its Monday date), with an obvious way
back to the live week.

**Scope decisions (settled up front so the story stays thin):**

- **Read-only.** Past weeks are a record, not an editing surface. No
  retro-logging, no reset on a viewed week. (Presence was either marked in
  the moment or it wasn't.)
- **Reuse the marks card.** The viewer is the existing marks card rendering a
  different week's data with interactions disabled — not a second UI. A
  "viewing" banner/tag replaces the hint row; tapping the current-week cell
  or a back affordance returns to live.
- **Absent weeks open too.** A past cell with no stored key shows the empty
  floor (all pips hollow) — that *is* the record, not an error.
- **Future cells stay inert.**

**Steps:**

☐ Inverse week math: a `weekStart(y, w)` giving the first day of week `w`
  under the custom numbering (week 1 starts Jan 1; later weeks start Monday),
  so a viewed week can be captioned "Week of &lt;date&gt;" like the live one
  — must be the exact inverse of `weekNumber()`, verified round-trip for all
  weeks of 2026–2027
☐ Strip cells for past + current weeks become focusable buttons
  (role/tabindex/aria-label with week number and level), future cells stay
  inert spans
☐ A `viewedWeek` state (`null` = live): tapping a past cell sets it, and
  `render()` renders that week's stored data in the marks card with pips and
  rows non-interactive (no tick/undo/reset)
☐ Viewing chrome: header week-tag and "Week of" reflect the viewed week, a
  clear "viewing — back to this week" affordance replaces the hint/reset row,
  and the viewed cell is highlighted in the strip
☐ Live-week guarantees: tapping the current-week cell (or the back
  affordance) returns to live; `syncWeek()` on a week rollover while viewing
  doesn't corrupt state — the live week's key/data advance underneath and
  the viewer still shows the week it was opened on
☐ Absent past week renders the empty floor without JS errors, and the floor
  footer reads correctly (`0 / 3`, not "complete")
