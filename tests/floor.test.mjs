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
