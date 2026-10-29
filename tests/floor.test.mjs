// DOM-level tests for The Floor. index.html is booted in jsdom under a
// controllable clock; each test gets a fresh window and a fresh localStorage.
//
//   cd tests && npm install && npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const DAY = 86400000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Boot the page at a fixed instant. `seed` pre-populates localStorage
// (values are JSON-encoded). Returns handles plus a clock setter that also
// fires the `focus` event the app uses to re-derive the week.
function boot({ now = new Date(2026, 8, 5, 10, 0), seed = {} } = {}) {
  let fixed = now.getTime();
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      const Real = window.Date;
      class Fixed extends Real {
        constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
        static now() { return fixed; }
      }
      window.Date = Fixed;
      window.confirm = () => true;
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, JSON.stringify(v));
    },
  });
  const w = dom.window;
  return {
    w,
    $: s => w.document.querySelector(s),
    $$: s => [...w.document.querySelectorAll(s)],
    stored: k => { const r = w.localStorage.getItem(k); return r == null ? null : JSON.parse(r); },
    setClock(d) { fixed = d.getTime(); w.dispatchEvent(new w.Event('focus')); },
    year: now.getFullYear(),
    week: w.weekNumber(now),
    marks: w.eval('MARKS'),
    routines: w.eval('ROUTINES'),
  };
}

/* ---- the week clock ---- */

test('weekStart is the exact inverse of weekNumber for every day 2025–2027', () => {
  const { w } = boot();
  for (let t = new Date(2025, 0, 1).getTime(); t <= new Date(2027, 11, 31).getTime(); t += DAY) {
    const d = new Date(t);
    const y = d.getFullYear(), n = w.weekNumber(d), s = w.weekStart(y, n);
    assert.equal(w.weekNumber(s), n, `weekStart(${y}, ${n}) lands in week ${n}`);
    assert.ok(s.getTime() <= t && t - s.getTime() < 7 * DAY, `${d.toDateString()} lies inside its week`);
  }
});

test('version tag in the page matches the service worker cache name', () => {
  const { $ } = boot();
  const cache = /const CACHE = 'floor-(v\d+)'/.exec(SW)[1];
  assert.equal($('.ver').textContent.trim(), cache);
});

/* ---- tabs ---- */

test('opens on the Floor; the Workouts tab swaps panels and aria-selected', () => {
  const { $ } = boot();
  assert.equal($('#view-floor').hidden, false);
  assert.equal($('#view-workouts').hidden, true);
  assert.equal($('#tab-floor').getAttribute('aria-selected'), 'true');
  $('#tab-workouts').click();
  assert.equal($('#view-floor').hidden, true);
  assert.equal($('#view-workouts').hidden, false);
  assert.equal($('#tab-workouts').getAttribute('aria-selected'), 'true');
  assert.equal($('#tab-floor').getAttribute('aria-selected'), 'false');
  $('#tab-floor').click();
  assert.equal($('#view-floor').hidden, false);
});

/* ---- the floor ---- */

test('tapping a row logs a session and persists; a filled pip taps back', () => {
  const { $, stored, year, week } = boot();
  const key = `floor-${year}-w${week}`;
  assert.equal(stored(key), null, 'a fresh week has no record');
  $('.row[data-id="car"]').click();
  assert.deepEqual(stored(key), { car: 1, str: 0, yog: 0 });
  assert.equal($('.row[data-id="car"] .row-state').textContent, '30 min');
  assert.equal($('.pip[data-id="car"][data-i="0"]').classList.contains('filled'), true);
  $('.pip[data-id="car"][data-i="0"]').click();
  assert.deepEqual(stored(key), { car: 0, str: 0, yog: 0 });
  assert.equal($('.row[data-id="car"] .row-state').textContent, '0 min');
});

test('sessions cap at the target and the footer marks a complete floor', () => {
  const { $, $$, stored, year, week, marks } = boot();
  for (const m of marks) for (let i = 0; i < m.target + 2; i++) $(`.row[data-id="${m.id}"]`).click();
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 5, str: 2, yog: 2 });
  assert.equal($('#floor-count').textContent, '3 / 3');
  assert.equal($('#floor-footer').classList.contains('done'), true);
  assert.equal($$('.pip.filled').length, 9);
});

test('rollover: a new week starts empty and the old week colours its strip cell', () => {
  const h = boot();
  const { $, $$, stored, year, week } = h;
  $('.row[data-id="str"]').click();
  $('.row[data-id="str"]').click();                     // one mark complete → "thin"
  h.setClock(new Date(h.w.weekStart(year, week).getTime() + 7 * DAY + DAY / 2));
  assert.equal($('#week-tag').textContent, `W${week + 1}`);
  assert.equal($('.row[data-id="str"] .row-state').textContent, '0 / 2');
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 0, str: 2, yog: 0 }, 'the finished week keeps its record');
  assert.equal(stored(`floor-${year}-w${week + 1}`), null);
  const past = $$('#grid .cell')[week - 1];
  assert.equal(past.tagName, 'BUTTON');
  assert.match(past.getAttribute('aria-label'), /thin/);
});

test('target change: Strength and Yoga go to 3 from W43 2026; earlier weeks keep 2', () => {
  const h = boot({
    now: new Date(2026, 9, 18, 10, 0),                  // Sun 18 Oct = W42, the last week at 2
    seed: { 'floor-2026-w41': { car: 5, str: 2, yog: 2 } },
  });
  const { $, $$, stored, year } = h;
  assert.equal(h.week, 42);
  assert.equal($('.row[data-id="str"] .row-state').textContent, '0 / 2');
  assert.equal($$('#grid .cell')[41 - 1].getAttribute('aria-label'), 'Week 41 — full, view');
  for (let i = 0; i < 4; i++) $('.row[data-id="str"]').click();
  assert.equal(stored('floor-2026-w42').str, 2, 'W42 still caps at 2');

  h.setClock(new Date(2026, 9, 19, 8, 0));             // Mon 19 Oct = W43
  assert.equal($('#week-tag').textContent, 'W43');
  assert.equal($('.row[data-id="str"] .row-state').textContent, '0 / 3');
  assert.equal($('.row[data-id="yog"] .row-sub').textContent, '3 sessions');
  for (let i = 0; i < 4; i++) $('.row[data-id="str"]').click();
  assert.equal(stored(`floor-${year}-w43`).str, 3);
  assert.equal($$('.pip[data-id="yog"]').length, 3);
  assert.equal($$('#grid .cell')[41 - 1].getAttribute('aria-label'), 'Week 41 — full, view',
    'the old week is still full under its own target');

  $$('#grid .cell')[42 - 1].click();                    // lens on W42: read at 2
  assert.equal($('.row[data-id="str"] .row-state').textContent, '2 / 2');
  assert.equal($$('.pip[data-id="str"]').length, 2);
});

/* ---- F1: the week lens ---- */

test('week lens: a past cell renders that week read-only; back returns live', () => {
  const { $, $$, stored, year, week } = boot({
    seed: { [`floor-2026-w${34}`]: { car: 5, str: 2, yog: 1 } },
  });
  assert.ok(week > 34, 'the fixed clock sits after week 34');
  $('.row[data-id="str"]').click();                     // live week has one strength session
  const cell = $$('#grid .cell')[34 - 1];
  assert.equal(cell.tagName, 'BUTTON');
  cell.click();
  assert.equal($('#viewbar').hidden, false);
  assert.equal($('#actions').hidden, true);
  assert.equal($('#view-label').textContent, 'Viewing W34 — read-only.');
  assert.equal($('#week-tag').textContent, 'W34');
  assert.equal($('#floor-count').textContent, '2 / 3');
  assert.equal($('.row[data-id="car"] .row-state').textContent, '150 min');
  assert.ok($$('.row').every(r => r.classList.contains('ro')));
  assert.ok($$('.pip').every(p => p.disabled));
  assert.equal($$('#grid .cell')[34 - 1].classList.contains('viewing'), true);
  $('.row[data-id="car"]').click();                     // no-op in the lens
  $('.pip[data-id="car"][data-i="0"]').click();
  assert.deepEqual(stored('floor-2026-w34'), { car: 5, str: 2, yog: 1 });
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 0, str: 1, yog: 0 }, 'the live week is untouched');
  $('#back-live').click();
  assert.equal($('#viewbar').hidden, true);
  assert.equal($('#week-tag').textContent, `W${week}`);
  assert.equal($('.row[data-id="str"] .row-state').textContent, '1 / 2');
});

test('week lens: a week with no record is the empty floor; the live cell and the workouts tab leave the lens', () => {
  const { $, $$, week } = boot();
  $$('#grid .cell')[week - 3].click();
  assert.equal($('#floor-count').textContent, '0 / 3');
  assert.equal($('#view-label').textContent, `Viewing W${week - 2} — read-only.`);
  $$('#grid .cell')[week - 1].click();                  // the `now` cell
  assert.equal($('#viewbar').hidden, true);
  $$('#grid .cell')[week - 3].click();
  $('#tab-workouts').click();
  assert.equal($('#viewbar').hidden, true, 'switching tabs drops the lens');
  assert.equal($('#week-tag').textContent, `W${week}`);
});

/* ---- F3: record a workout ---- */

const type = (h, id, v) => {
  const i = h.$(`#workout-parts input[data-id="${id}"]`);
  i.value = v;
  i.dispatchEvent(new h.w.Event('input'));
  return i;
};

test('three routines × three parts, 26 rows over 25 ids; Hip Airplane shared; fields blank', () => {
  const h = boot();
  const { $, $$, routines } = h;
  assert.deepEqual(Array.from(routines, r => r.name), ['Upper Body', 'Lower Body', 'Posture & Stability']);
  assert.ok(Array.from(routines).every(r => r.parts.length === 3));
  const per = Array.from(routines, r => r.parts.flatMap(p => Array.from(p.exercises, e => e.id)));
  assert.deepEqual(per.map(ids => ids.length), [10, 8, 8]);
  assert.equal(new Set(per.flat()).size, 25);
  assert.ok(per[1].includes('airplane') && per[2].includes('airplane'));
  per.forEach(ids => assert.equal(new Set(ids).size, ids.length, 'no id twice within a routine'));
  // opens on Upper Body
  assert.equal($('.pick[aria-pressed="true"]').textContent, 'Upper Body');
  assert.equal($$('.part-card').length, 3);
  assert.deepEqual($$('.part-card .part-name').map(e => e.textContent), ['Part 1', 'Part 2', 'Part 3']);
  assert.equal($$('#workout-parts input').length, 10);
  assert.ok($$('#workout-parts input').every(i => i.value === '' && i.placeholder === ''));
  $$('.pick')[2].click();
  assert.equal($('.pick[aria-pressed="true"]').textContent, 'Posture & Stability');
  assert.equal($$('#workout-parts input').length, 8);
});

test('Record saves the workout with its date and non-empty weights, clears the fields, confirms', () => {
  const now = new Date(2026, 8, 28, 18, 30);
  const h = boot({ now });
  const { $, $$, stored } = h;
  type(h, 'bench', ' 22.5 ');
  type(h, 'dips', 'BW');
  type(h, 'hammer', '   ');
  $('#record').click();
  const log = stored('workouts-log');
  assert.equal(log.length, 1);
  assert.equal(log[0].routine, 'upper');
  assert.equal(log[0].at, now.toISOString());
  assert.deepEqual(log[0].weights, { bench: '22.5', dips: 'BW' });
  assert.equal(typeof log[0].id, 'string');
  assert.ok($$('#workout-parts input').every(i => i.value === ''));
  assert.match($('#record-status').textContent, /^Recorded — Upper Body/);
  assert.equal($('#record-status').classList.contains('ok'), true);
  assert.equal(stored('workouts-draft').fields.upper, undefined, 'the draft for the routine is cleared');
});

test('an empty Record is refused and writes nothing', () => {
  const h = boot();
  const { $, stored } = h;
  type(h, 'bench', '  ');
  $('#record').click();
  assert.equal(stored('workouts-log'), null);
  assert.match($('#record-status').textContent, /Nothing to record/);
  assert.equal($('#record-status').classList.contains('ok'), false);
});

test('reload round-trip: the log survives and the last value shows as a grey hint, never as a value', () => {
  const h = boot({ now: new Date(2026, 8, 21, 18, 0) });
  type(h, 'bench', '20');
  h.$('#record').click();
  const log = h.stored('workouts-log');
  const r = boot({ now: new Date(2026, 8, 28, 18, 0), seed: { 'workouts-log': log } });
  const i = r.$('#workout-parts input[data-id="bench"]');
  assert.equal(i.value, '');
  assert.equal(i.placeholder, '20');
  assert.equal(r.$('#workout-parts input[data-id="csrow"]').placeholder, '');
  type(r, 'bench', '22');
  r.$('#record').click();
  assert.deepEqual(r.stored('workouts-log').map(w => w.weights.bench), ['20', '22']);
  assert.equal(r.$('#workout-parts input[data-id="bench"]').placeholder, '22', 'the newest value wins');
});

test('the hint is per exercise id across routines — Hip Airplane is one line', () => {
  const h = boot();
  h.$$('.pick')[1].click();                              // Lower Body
  type(h, 'airplane', '4');
  h.$('#record').click();
  h.$$('.pick')[2].click();                              // Posture & Stability
  assert.equal(h.$('#workout-parts input[data-id="airplane"]').placeholder, '4');
  assert.equal(h.stored('workouts-log')[0].routine, 'lower');
});

test('typed-but-unrecorded weights survive a routine switch, a tab switch and a reload', () => {
  const h = boot();
  const { $, $$ } = h;
  $('#tab-workouts').click();
  type(h, 'bench', '24');
  $$('.pick')[1].click();
  type(h, 'deadlift', '60');
  $('#tab-floor').click();
  $('#tab-workouts').click();
  assert.equal($('#workout-parts input[data-id="deadlift"]').value, '60');
  $$('.pick')[0].click();
  assert.equal($('#workout-parts input[data-id="bench"]').value, '24');
  const r = boot({ seed: { 'workouts-draft': h.stored('workouts-draft') } });
  assert.equal(r.$('.pick[aria-pressed="true"]').textContent, 'Upper Body');
  assert.equal(r.$('#workout-parts input[data-id="bench"]').value, '24');
  assert.equal(r.stored('workouts-log'), null, 'a draft is not a record');
  // Record takes only the current routine; the other routine's draft stays
  r.$('#record').click();
  assert.deepEqual(r.stored('workouts-log')[0].weights, { bench: '24' });
  r.$$('.pick')[1].click();
  assert.equal(r.$('#workout-parts input[data-id="deadlift"]').value, '60');
});

test('old tracker data stays in storage untouched; the Floor tab is unaffected by Record', () => {
  const h = boot({ seed: { 'tracker-2026-w36': { bench: '20' } } });
  const { $, stored, year, week } = h;
  assert.equal($('#workout-parts input[data-id="bench"]').placeholder, '', 'old tracker data is never read');
  $('.row[data-id="str"]').click();
  type(h, 'bench', '22');
  $('#record').click();
  assert.deepEqual(stored('tracker-2026-w36'), { bench: '20' });
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 0, str: 1, yog: 0 }, 'Record never ticks a pip');
  assert.equal($('.row[data-id="str"] .row-state').textContent, '1 / 2');
});

test('Reset week clears the floor marks only; the workout log survives', () => {
  const h = boot();
  const { $, stored, year, week } = h;
  type(h, 'bench', '20');
  $('#record').click();
  $('.row[data-id="car"]').click();
  $('#reset').click();
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 0, str: 0, yog: 0 });
  assert.equal(stored('workouts-log').length, 1);
});

/* ---- progress (Workouts 2) — made-up workouts only ---- */

const LOG = [
  { id: 'w1', routine: 'upper', at: '2026-09-01T18:00:00.000Z', weights: { bench: '16', csrow: '14', dips: 'BW' } },
  { id: 'w2', routine: 'lower', at: '2026-09-03T18:00:00.000Z', weights: { deadlift: '40 kg', airplane: 'BW' } },
  { id: 'w3', routine: 'upper', at: '2026-09-08T18:00:00.000Z', weights: { bench: '18', csrow: '14' } },
  { id: 'w4', routine: 'upper', at: '2026-09-15T18:00:00.000Z', weights: { bench: '22.5', csrow: '12' } },
];
function progressOf(t) {
  t.$('#tab-workouts').click();
  t.$('#progress-open').click();
  return Object.fromEntries(t.$$('#progress .prow').map(r => [r.dataset.ex, r.textContent]));
}

test('Progress: one line per recorded exercise, first ever → latest with the change', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  const rows = progressOf(t);
  // what renders, not just the attribute: the Floor's CSS sets these to flex
  for (const sel of ['#picker', '#workout-parts', '.record-row', '#workout-hint'])
    assert.equal(t.w.getComputedStyle(t.$(sel)).display, 'none', sel);
  assert.equal(t.$('#progress').hidden, false);
  assert.deepEqual(Object.keys(rows), ['bench', 'csrow', 'dips', 'deadlift', 'airplane']);
  assert.match(rows.bench, /16 → 22\.5 · \+6\.5/);
  assert.match(rows.bench, /up /);
  assert.match(rows.csrow, /14 → 12 · −2/);
  assert.doesNotMatch(rows.csrow, /up /);
  assert.match(rows.deadlift, /40 kg/);
  assert.equal(t.$$('#progress .part-name').map(e => e.textContent).join(','), 'Upper Body,Lower Body');
});

test('Progress: BW is shown as written and never counts as up, down or a change', () => {
  const t = boot({ seed: { 'workouts-log': [
    { id: 'a', routine: 'upper', at: '2026-09-01T18:00:00.000Z', weights: { dips: 'BW' } },
    { id: 'b', routine: 'upper', at: '2026-09-08T18:00:00.000Z', weights: { dips: 'BW+5' } },
  ] } });
  const rows = progressOf(t);
  assert.equal(rows.dips.includes('BW → BW+5'), true);
  assert.equal(t.$$('#progress .prow[data-ex="dips"] .prow-change').length, 0);
  assert.equal(t.$$('#progress .prow[data-ex="dips"] .prow-up').length, 0);
  assert.equal(t.$$('#progress .stalled').length, 0);
});

test('Progress: nothing recorded says so; Back returns to the workout', () => {
  const t = boot();
  progressOf(t);
  assert.match(t.$('#progress').textContent, /Nothing recorded yet/);
  t.$('#progress [data-act="back"]').click();
  assert.equal(t.$('#progress').hidden, true);
  assert.equal(t.$('#workout-parts').hidden, false);
});

test("an exercise's history: dates oldest → newest, weights, and a line through the numbers", () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  progressOf(t);
  t.$('#progress .prow[data-ex="bench"]').click();
  assert.match(t.$('#progress .prog-title').textContent, /DB Bench Press/);
  assert.deepEqual(t.$$('#progress .hrow').map(r => r.dataset.workout), ['w1', 'w3', 'w4']);
  assert.deepEqual(t.$$('#progress .hrow .prow-val').map(e => e.textContent), ['16', '18', '22.5']);
  assert.equal(t.$$('#progress .prog-chart polyline').length, 1);
  assert.equal(t.$('#progress polyline').getAttribute('points').split(' ').length, 3);
  // a single counted value draws no line
  t.$('#progress [data-act="back"]').click();
  t.$('#progress .prow[data-ex="deadlift"]').click();
  assert.equal(t.$$('#progress .prog-chart').length, 0);
});

test('a past workout: a fixed weight is saved, its date unchanged; an emptied field drops it', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  progressOf(t);
  t.$('#progress .prow[data-ex="bench"]').click();
  t.$('#progress .hrow[data-workout="w3"]').click();
  const inputs = Object.fromEntries(t.$$('#progress input').map(i => [i.dataset.id, i]));
  inputs.bench.value = '19';
  inputs.csrow.value = '';
  t.$('#progress [data-act="save"]').click();
  const w3 = t.stored('workouts-log').find(w => w.id === 'w3');
  assert.deepEqual(w3.weights, { bench: '19' });
  assert.equal(w3.at, '2026-09-08T18:00:00.000Z');
  assert.equal(t.stored('workouts-log').length, 4);
  // back on the history, showing the fix
  assert.deepEqual(t.$$('#progress .hrow .prow-val').map(e => e.textContent), ['16', '19', '22.5']);
});

test('a past workout: saving with every field empty is refused; delete asks, then removes it', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  progressOf(t);
  t.$('#progress .prow[data-ex="deadlift"]').click();
  t.$('#progress .hrow[data-workout="w2"]').click();
  t.$$('#progress input').forEach(i => { i.value = ''; });
  t.$('#progress [data-act="save"]').click();
  assert.match(t.$('#progress .record-status').textContent, /delete the workout instead/);
  assert.equal(t.stored('workouts-log').length, 4);

  t.w.confirm = () => false;
  t.$('#progress [data-act="delete"]').click();
  assert.equal(t.stored('workouts-log').length, 4);
  t.w.confirm = () => true;
  t.$('#progress [data-act="delete"]').click();
  assert.deepEqual(t.stored('workouts-log').map(w => w.id), ['w1', 'w3', 'w4']);
  // deadlift has no record left: back to the list, without it
  assert.equal(t.$$('#progress .prow[data-ex="deadlift"]').length, 0);
  assert.equal(t.$$('#progress .prow[data-ex="bench"]').length, 1);
});

test('the Floor tab closes Progress; Record and the hints still work after it', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  progressOf(t);
  t.$('#tab-floor').click();
  t.$('#tab-workouts').click();
  assert.equal(t.$('#progress').hidden, true);
  assert.equal(t.$('#workout-parts').hidden, false);
  assert.equal(t.$('#workout-parts input[data-id="bench"]').placeholder, '22.5');
});

test('a count of bells counts by the weight: 2x16 → 2x18 is +2', () => {
  const t = boot({ seed: { 'workouts-log': [
    { id: 'a', routine: 'lower', at: '2026-09-03T18:00:00.000Z', weights: { farmer: '2x16' } },
    { id: 'b', routine: 'lower', at: '2026-09-10T18:00:00.000Z', weights: { farmer: '2 × 18' } },
  ] } });
  const rows = progressOf(t);
  assert.match(rows.farmer, /2x16 → 2 × 18 · \+2/);
});

/* ---- the exercise editor (Workouts 4) — made-up workouts only ---- */

function editRoutine(t, routine = 'upper') {
  t.$('#tab-workouts').click();
  t.$(`#picker .pick[data-id="${routine}"]`).click();
  t.$('#edit-open').click();
}
const rowOf = (t, id) => t.$(`#workout-parts .erow[data-id="${id}"]`);
const change = (t, input, v) => { input.value = v; input.dispatchEvent(new t.w.Event('change')); };
const storedRoutine = (t, id) => t.stored('workouts-routines').routines.find(r => r.id === id);
const ids = (t, routine, part) => storedRoutine(t, routine).parts[part].exercises.map(e => e.id);

test('first open writes the seed to storage once; later the phone copy is read, not the code', () => {
  const t = boot();
  const st = t.stored('workouts-routines');
  assert.equal(st.routines.length, 3);
  assert.deepEqual(st.removed, {});
  const changed = JSON.parse(JSON.stringify(st));
  changed.routines[0].parts[0].exercises[0].name = 'Floor Press';
  const t2 = boot({ seed: { 'workouts-routines': changed } });
  t2.$('#tab-workouts').click();
  assert.equal(t2.$('#workout-parts .wrow-name').textContent, 'Floor Press');
});

test('Edit swaps the Record row for Done; Done returns to the workout', () => {
  const t = boot();
  editRoutine(t);
  assert.equal(t.$('#record').hidden, true);
  assert.equal(t.$('#edit-done').hidden, false);
  assert.equal(t.$$('#workout-parts .erow[data-id]').length, 10);
  t.$('#edit-done').click();
  assert.equal(t.$('#record').hidden, false);
  assert.equal(t.$$('#workout-parts .wrow').length, 10);
});

test('rename and rx: saved at once; the id stays, so the history follows the new name', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  editRoutine(t);
  change(t, rowOf(t, 'bench').querySelector('[data-f="name"]'), 'Incline DB Press');
  change(t, rowOf(t, 'bench').querySelector('[data-f="rx"]'), '3 × 6–8');
  const ex = storedRoutine(t, 'upper').parts[0].exercises[0];
  assert.deepEqual(ex, { id: 'bench', name: 'Incline DB Press', rx: '3 × 6–8' });
  t.$('#edit-done').click();
  const rows = progressOf(t);
  assert.match(rows.bench, /Incline DB Press.*16 → 22\.5/);
});

test('an empty name is refused', () => {
  const t = boot();
  editRoutine(t);
  change(t, rowOf(t, 'bench').querySelector('[data-f="name"]'), '  ');
  assert.equal(storedRoutine(t, 'upper').parts[0].exercises[0].name, 'DB Bench Press (flat/incline)');
});

test('move up and down within a part; the ends cannot move further', () => {
  const t = boot();
  editRoutine(t);
  assert.equal(rowOf(t, 'bench').querySelector('[data-act="up"]').disabled, true);
  rowOf(t, 'bench').querySelector('[data-act="down"]').click();
  assert.deepEqual(ids(t, 'upper', 0), ['csrow', 'bench']);
  assert.equal(rowOf(t, 'bench').querySelector('[data-act="down"]').disabled, true);
  rowOf(t, 'bench').querySelector('[data-act="up"]').click();
  assert.deepEqual(ids(t, 'upper', 0), ['bench', 'csrow']);
});

test('remove asks first; a removed exercise keeps its history and shows in Progress, marked removed', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  editRoutine(t);
  t.w.confirm = () => false;
  rowOf(t, 'csrow').querySelector('[data-act="remove"]').click();
  assert.deepEqual(ids(t, 'upper', 0), ['bench', 'csrow']);
  t.w.confirm = () => true;
  rowOf(t, 'csrow').querySelector('[data-act="remove"]').click();
  assert.deepEqual(ids(t, 'upper', 0), ['bench']);
  assert.deepEqual(t.stored('workouts-routines').removed.csrow, { name: 'Chest-Supported DB Row', routine: 'upper' });
  assert.equal(t.stored('workouts-log').length, 4);
  t.$('#edit-done').click();
  assert.equal(t.$$('#workout-parts input[data-id="csrow"]').length, 0);
  const rows = progressOf(t);
  assert.match(rows.csrow, /Chest-Supported DB Row · removed.*14 → 12/);
});

test('add: a new exercise gets a new id, records like any other, and starts its own line', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  editRoutine(t);
  const add = t.$$('#workout-parts .erow[data-add]')[2];
  add.querySelector('[data-f="new-name"]').value = 'Cable Curl';
  add.querySelector('[data-f="new-rx"]').value = '3 × 12';
  add.querySelector('[data-act="add"]').click();
  const part3 = storedRoutine(t, 'upper').parts[2].exercises;
  const added = part3[part3.length - 1];
  assert.equal(added.name, 'Cable Curl');
  assert.equal(added.rx, '3 × 12');
  assert.ok(!['bench', 'csrow', 'hammer'].includes(added.id));
  t.$('#edit-done').click();
  const input = t.$(`#workout-parts input[data-id="${added.id}"]`);
  input.value = '12'; input.dispatchEvent(new t.w.Event('input'));
  t.$('#record').click();
  assert.equal(t.stored('workouts-log').at(-1).weights[added.id], '12');
  assert.match(progressOf(t)[added.id], /Cable Curl/);
});

test('an empty add is refused; adding back a removed name brings its id and history back', () => {
  const t = boot({ seed: { 'workouts-log': LOG } });
  editRoutine(t);
  t.$$('#workout-parts .erow[data-add]')[0].querySelector('[data-act="add"]').click();
  assert.equal(ids(t, 'upper', 0).length, 2);
  rowOf(t, 'csrow').querySelector('[data-act="remove"]').click();
  const add = t.$$('#workout-parts .erow[data-add]')[1];
  add.querySelector('[data-f="new-name"]').value = 'chest-supported db row';
  add.querySelector('[data-act="add"]').click();
  assert.ok(ids(t, 'upper', 1).includes('csrow'));
  assert.deepEqual(t.stored('workouts-routines').removed, {});
});

test('Hip Airplane removed from one routine stays in the other, and is not marked removed', () => {
  const t = boot();
  editRoutine(t, 'lower');
  rowOf(t, 'airplane').querySelector('[data-act="remove"]').click();
  assert.equal(t.stored('workouts-routines').removed.airplane, undefined);
  assert.ok(storedRoutine(t, 'posture').parts[1].exercises.some(e => e.id === 'airplane'));
});

test('a removed exercise typed before removal is not recorded; the Floor tab ends Edit', () => {
  const t = boot();
  t.$('#tab-workouts').click();
  const f = t.$('#workout-parts input[data-id="csrow"]');
  f.value = '14'; f.dispatchEvent(new t.w.Event('input'));
  const b = t.$('#workout-parts input[data-id="bench"]');
  b.value = '20'; b.dispatchEvent(new t.w.Event('input'));
  t.$('#edit-open').click();
  rowOf(t, 'csrow').querySelector('[data-act="remove"]').click();
  t.$('#tab-floor').click();
  t.$('#tab-workouts').click();
  assert.equal(t.$('#record').hidden, false);
  t.$('#record').click();
  assert.deepEqual(t.stored('workouts-log').at(-1).weights, { bench: '20' });
});
