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
    circuits: w.eval('CIRCUITS'),
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

test('opens on the Floor; the Tracker tab swaps panels and aria-selected', () => {
  const { $ } = boot();
  assert.equal($('#view-floor').hidden, false);
  assert.equal($('#view-tracker').hidden, true);
  assert.equal($('#tab-floor').getAttribute('aria-selected'), 'true');
  $('#tab-tracker').click();
  assert.equal($('#view-floor').hidden, true);
  assert.equal($('#view-tracker').hidden, false);
  assert.equal($('#tab-tracker').getAttribute('aria-selected'), 'true');
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

test('week lens: a week with no record is the empty floor; the live cell and the tracker tab leave the lens', () => {
  const { $, $$, week } = boot();
  $$('#grid .cell')[week - 3].click();
  assert.equal($('#floor-count').textContent, '0 / 3');
  assert.equal($('#view-label').textContent, `Viewing W${week - 2} — read-only.`);
  $$('#grid .cell')[week - 1].click();                  // the `now` cell
  assert.equal($('#viewbar').hidden, true);
  $$('#grid .cell')[week - 3].click();
  $('#tab-tracker').click();
  assert.equal($('#viewbar').hidden, true, 'switching tabs drops the lens');
  assert.equal($('#week-tag').textContent, `W${week}`);
});

/* ---- F2: the tracker ---- */

test('three circuits of 7 / 8 / 8 exercises, ids unique, fields blank', () => {
  const { $$, circuits } = boot();
  assert.deepEqual(Array.from(circuits, c => c.exercises.length), [7, 8, 8]);
  const ids = Array.from(circuits).flatMap(c => Array.from(c.exercises, e => e.id));
  assert.equal(new Set(ids).size, 23);
  assert.equal($$('.tracker-card').length, 3);
  assert.deepEqual($$('.tracker-card').map(c => c.querySelectorAll('.trow').length), [7, 8, 8]);
  assert.ok($$('.trow input').every(i => i.value === ''));
  assert.ok($$('.thist').every(h => h.hidden));
});

test('tracker storage: debounced, non-empty values only, cleared week removes the record', async () => {
  const h = boot();
  const { $, stored, year, week, circuits } = h;
  const key = `tracker-${year}-w${week}`;
  const first = circuits[0].exercises[0].id;
  const input = $('.trow input');
  input.value = ' 20 ';
  input.dispatchEvent(new h.w.Event('input'));
  assert.equal(stored(key), null, 'nothing written before the debounce');
  await sleep(500);
  assert.deepEqual(stored(key), { [first]: '20' });
  input.value = '';
  input.dispatchEvent(new h.w.Event('input'));
  await sleep(500);
  assert.equal(stored(key), null, 'an empty week keeps no record');
});

test('history: logged weeks only, oldest → newest, across the year boundary, one open at a time', () => {
  const now = new Date(2026, 1, 10, 9, 0);           // February: 26 weeks back crosses into 2025
  const h = boot({ now, seed: {} });
  const last2025 = h.w.weekNumber(new Date(2025, 11, 31));
  const id = h.circuits[0].exercises[0].id;
  const week = h.week;
  const { $, $$ } = boot({
    now,
    seed: {
      [`tracker-2025-w${last2025}`]: { [id]: '18' },
      [`tracker-2026-w1`]: { [id]: '20' },
      [`tracker-2026-w${week - 1}`]: { [id]: '22' },
      [`tracker-2026-w${week - 2}`]: { other: 'x' },   // logged week, but not this exercise
    },
  });
  const rows = $$('.trow');
  rows[0].click();
  assert.equal(rows[0].getAttribute('aria-expanded'), 'true');
  assert.equal(rows[0].querySelector('.trow-caret').textContent, '▾');
  const hist = $$('.thist')[0];
  assert.equal(hist.hidden, false);
  assert.equal(hist.textContent, `W${last2025}/25 18 · W1 20 · W${week - 1} 22`);
  rows[1].click();
  assert.equal(hist.hidden, true, 'opening another row closes the first');
  assert.equal(rows[0].getAttribute('aria-expanded'), 'false');
  assert.equal($$('.thist')[1].textContent, 'No past entries yet.');
  rows[1].click();
  assert.equal($$('.thist')[1].hidden, true, 'tapping the open row closes it');
  assert.equal($$('.thist').filter(x => !x.hidden).length, 0);
});

test('rollover: the tracker blanks its fields, keeps the old record, and the old week shows in history', async () => {
  const h = boot();
  const { $, $$, stored, year, week, circuits } = h;
  const id = circuits[0].exercises[0].id;
  const input = $('.trow input');
  input.value = '20';
  input.dispatchEvent(new h.w.Event('input'));
  await sleep(500);
  h.setClock(new Date(h.w.weekStart(year, week).getTime() + 7 * DAY + DAY / 2));
  assert.equal($('.trow input').value, '');
  assert.deepEqual(stored(`tracker-${year}-w${week}`), { [id]: '20' });
  assert.equal(stored(`tracker-${year}-w${week + 1}`), null);
  $$('.trow')[0].click();
  assert.equal($$('.thist')[0].textContent, `W${week} 20`);
});

test('Reset week clears the floor marks only; tracker data survives', () => {
  const { $, stored, year, week } = boot({
    seed: { [`tracker-2026-w36`]: { bench: '20' } },
  });
  assert.equal(week, 36, 'the fixed clock is week 36 of 2026');
  $('.row[data-id="car"]').click();
  $('.row[data-id="yog"]').click();
  $('#reset').click();
  assert.deepEqual(stored(`floor-${year}-w${week}`), { car: 0, str: 0, yog: 0 });
  assert.deepEqual(stored(`tracker-${year}-w${week}`), { bench: '20' });
  assert.equal($('.trow input').value, '20');
});
