// ─────────────────────────────────────────────────────────────────────────────
// Tests der isolierten SEC-Quartalsnormalisierung (src/sec-quarterly.js)
//
// Ausschliesslich synthetische Facts; alle Erwartungswerte sind unabhaengig
// von Hand gerechnet und stehen als Kommentar an der jeweiligen Assertion.
// Kein Netzwerk, kein DOM, kein Zufall.
//
//   node --test tests/sec-quarterly.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const Q = require(join(HERE, '..', 'src', 'sec-quarterly.js'));

// Tag-Listen der Anwendung (keine Kopie im Test).
const TAGS = Q.appTagMap();
const tagFor = f => TAGS[f][0];

// ── Fact-Bauer ───────────────────────────────────────────────────────────────
// flow  = Zeitraumangabe (start + end), stock = Stichtagsangabe (nur end)
function flow(start, end, val, form, filed, accn, extra = {}) {
  return { start, end, val, form, filed, accn, frame: null, ...extra };
}
function stock(end, val, form, filed, accn, extra = {}) {
  return { end, val, form, filed, accn, frame: null, ...extra };
}
// { feld: [fact, ...] } → companyfacts-artige Struktur (USD)
function facts(byField) {
  const out = { 'us-gaap': {} };
  for (const [field, entries] of Object.entries(byField)) {
    out['us-gaap'][tagFor(field)] = { units: { USD: entries } };
  }
  return out;
}

// Kalenderjahr-Geschaeftsjahr (Ende 31.12.) — Quartalsgrenzen
const CY = {
  q1: ['2024-01-01', '2024-03-31'], q2: ['2024-04-01', '2024-06-30'],
  q3: ['2024-07-01', '2024-09-30'], q4: ['2024-10-01', '2024-12-31'],
  ytd3: ['2024-01-01', '2024-03-31'], ytd6: ['2024-01-01', '2024-06-30'],
  ytd9: ['2024-01-01', '2024-09-30'], fy:  ['2024-01-01', '2024-12-31']
};
// Jahresabschluesse 10-K, damit das Geschaeftsjahresende erkennbar ist.
// FY2024 (460 Mio, veroeffentlicht 14.02.2025) und — fuer Pruefungen mit
// frueherem Datenstichtag — FY2023 (400 Mio, veroeffentlicht 14.02.2024).
const FY_ANCHOR      = flow(...CY.fy, 460e6, '10-K', '2025-02-14', 'K-2024');
const FY_ANCHOR_2023 = flow('2023-01-01', '2023-12-31', 400e6, '10-K', '2024-02-14', 'K-2023');

const qOf = (res, field, key) =>
  res.fields[field].quarters.find(x => x.periodKey === key) || null;

// ═════════════════════════════════════════════════════════════════════════════
// 1. Periodendauer und Periodenschluessel
// ═════════════════════════════════════════════════════════════════════════════
test('Periodendauer unterscheidet Quartal, Halbjahr, Neunmonats- und Jahreswert', () => {
  // Tage EINSCHLIESSLICH beider Randtage: 01.01.–31.03.2024 = 31+29+31 = 91
  assert.equal(Q.inclusiveDays(Q.parseIsoDate('2024-01-01'), Q.parseIsoDate('2024-03-31')), 91);
  assert.equal(Q.classifyPeriodDuration(91).type,  'quarter');
  assert.equal(Q.classifyPeriodDuration(182).type, 'half_year');    // 01.01.–30.06.
  assert.equal(Q.classifyPeriodDuration(274).type, 'nine_months');  // 01.01.–30.09.
  assert.equal(Q.classifyPeriodDuration(366).type, 'fiscal_year');  // 01.01.–31.12.2024
  assert.equal(Q.classifyPeriodDuration(364).type, 'fiscal_year');  // 52-Wochen-Jahr
  assert.equal(Q.classifyPeriodDuration(371).type, 'fiscal_year');  // 53-Wochen-Jahr
  assert.equal(Q.classifyPeriodDuration(45),  null);                // kein Raster
  assert.equal(Q.classifyPeriodDuration(730), null);
});

test('Periodenschluessel ist das Geschaeftsjahr, nicht das Kalenderjahr', () => {
  const dez = { month: 12, day: 31 };
  assert.deepEqual(
    { fy: Q.fiscalPeriodOf(Q.parseIsoDate('2024-03-31'), dez).fiscalYear,
      q:  Q.fiscalPeriodOf(Q.parseIsoDate('2024-03-31'), dez).fiscalQuarter },
    { fy: 2024, q: 1 });
  assert.equal(Q.fiscalPeriodOf(Q.parseIsoDate('2024-12-31'), dez).fiscalQuarter, 4);

  // Geschaeftsjahresende 31.01.: die Quartale enden 30.04./31.07./31.10. im
  // Kalenderjahr 2024, gehoeren aber zum Geschaeftsjahr 2025 (Ende 31.01.2025).
  const jan = { month: 1, day: 31 };
  const p1 = Q.fiscalPeriodOf(Q.parseIsoDate('2024-04-30'), jan);
  const p4 = Q.fiscalPeriodOf(Q.parseIsoDate('2025-01-31'), jan);
  assert.deepEqual([p1.fiscalYear, p1.fiscalQuarter], [2025, 1]);
  assert.deepEqual([p4.fiscalYear, p4.fiscalQuarter], [2025, 4]);
  assert.equal(p1.fiscalYearStart, '2024-02-01');
  assert.equal(p1.fiscalYearEnd,   '2025-01-31');

  // 52/53-Wochen-Geschaeftsjahr (Ende Ende September): 28.09.2024 ist Q4 2024,
  // 28.12.2024 bereits Q1 2025.
  const sep = { month: 9, day: 30 };
  assert.deepEqual(
    [Q.fiscalPeriodOf(Q.parseIsoDate('2024-09-28'), sep).fiscalYear,
     Q.fiscalPeriodOf(Q.parseIsoDate('2024-09-28'), sep).fiscalQuarter], [2024, 4]);
  assert.deepEqual(
    [Q.fiscalPeriodOf(Q.parseIsoDate('2024-12-28'), sep).fiscalYear,
     Q.fiscalPeriodOf(Q.parseIsoDate('2024-12-28'), sep).fiscalQuarter], [2025, 1]);

  // Nicht quartalsgerechte Stichtage bekommen keinen Schluessel.
  assert.equal(Q.fiscalPeriodOf(Q.parseIsoDate('2024-05-15'), dez), null);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Einzelquartale (direkt gemeldet)
// ═════════════════════════════════════════════════════════════════════════════
test('gemeldete Einzelquartale werden uebernommen — mit Herkunft, ohne Ableitung', () => {
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      flow(...CY.q2, 110e6, '10-Q', '2024-07-25', 'Q2-2024'),
      flow(...CY.q3, 120e6, '10-Q', '2024-10-24', 'Q3-2024'),
      flow(...CY.q4, 130e6, '10-K', '2025-02-14', 'K-2024'),
      FY_ANCHOR
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.equal(res.ok, true);
  assert.deepEqual({ m: res.fiscalYearEnd.month, d: res.fiscalYearEnd.day }, { m: 12, d: 31 });

  const r = res.fields.revenue;
  assert.equal(r.usedTag, tagFor('revenue'));
  // Vier Quartale, absteigend nach Periodenende sortiert
  assert.deepEqual(r.quarters.map(x => x.periodKey),
    ['FY2024-Q4', 'FY2024-Q3', 'FY2024-Q2', 'FY2024-Q1']);
  assert.deepEqual(r.quarters.map(x => x.value), [130e6, 120e6, 110e6, 100e6]);
  assert.deepEqual(r.quarters.map(x => x.basis), ['reported', 'reported', 'reported', 'reported']);
  assert.deepEqual(r.quarters.map(x => x.derivation), [null, null, null, null]);
  assert.equal(r.gaps.length, 0);
  assert.equal(r.conflicts.length, 0);

  // Anforderung 6: Veroeffentlichungsdatum, Filing-ID, Quelle bleiben erhalten
  const q2 = qOf(res, 'revenue', 'FY2024-Q2');
  assert.deepEqual(q2.source, { form: '10-Q', accn: 'Q2-2024', filed: '2024-07-25', frame: null,
                                tag: tagFor('revenue') });
  assert.deepEqual([q2.start, q2.end, q2.durationDays], ['2024-04-01', '2024-06-30', 91]);
  assert.equal(q2.fiscalYearEnd, '2024-12-31');

  // Der Jahreswert ist vorhanden, wird aber nicht als Quartal gezaehlt.
  assert.equal(r.cumulatives.some(c => c.throughQuarter === 4 && c.value === 460e6), true);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Kumulierter operativer Cashflow → Einzelquartale
// ═════════════════════════════════════════════════════════════════════════════
test('kumulierter CFO wird zu Einzelquartalen differenziert (gleiches Geschaeftsjahr)', () => {
  // Kumuliert: 50 / 120 / 200 / 300 (Mio USD)
  // ⇒ Q1 50 · Q2 120−50 = 70 · Q3 200−120 = 80 · Q4 300−200 = 100
  const f = facts({
    cfo: [
      flow(...CY.ytd3,  50e6, '10-Q', '2024-05-01', 'Q1-2024'),
      flow(...CY.ytd6, 120e6, '10-Q', '2024-08-01', 'Q2-2024'),
      flow(...CY.ytd9, 200e6, '10-Q', '2024-11-01', 'Q3-2024'),
      flow(...CY.fy,   300e6, '10-K', '2025-02-14', 'K-2024')
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['cfo'] });
  const c = res.fields.cfo;
  assert.deepEqual(c.quarters.map(x => x.periodKey),
    ['FY2024-Q4', 'FY2024-Q3', 'FY2024-Q2', 'FY2024-Q1']);
  assert.deepEqual(c.quarters.map(x => x.value), [100e6, 80e6, 70e6, 50e6]);
  // Q1 ist die Kumulierung selbst (gemeldet), Q2–Q4 sind abgeleitet.
  assert.deepEqual(c.quarters.map(x => x.basis), ['derived', 'derived', 'derived', 'reported']);
  // Summe der Quartale = Jahreswert (Gegenprobe, unabhaengig gerechnet)
  assert.equal(c.quarters.reduce((s, x) => s + x.value, 0), 300e6);

  const q3 = qOf(res, 'cfo', 'FY2024-Q3');
  assert.equal(q3.derivation.method, 'cumulative_difference');
  assert.equal(q3.derivation.formula, 'FY2024-YTD3 − FY2024-YTD2');
  assert.deepEqual([q3.derivation.minuend.value, q3.derivation.subtrahend.value], [200e6, 120e6]);
  assert.deepEqual([q3.derivation.minuend.accn, q3.derivation.subtrahend.accn], ['Q3-2024', 'Q2-2024']);
  // Periodengrenzen des abgeleiteten Quartals: Folgetag der Vorperiode bis Ende
  assert.deepEqual([q3.start, q3.end, q3.durationDays], ['2024-07-01', '2024-09-30', 92]);
  // Ein abgeleiteter Wert ist erst mit der SPAETEREN der beiden Veroeffentlichungen bekannt
  assert.equal(q3.source.filed, '2024-11-01');
  assert.equal(q3.source.accn, null);
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Q4-Ableitung: Jahreswert − Neunmonatswert
// ═════════════════════════════════════════════════════════════════════════════
test('Q4 entsteht aus Jahreswert minus Neunmonatswert (10-K + 10-Q)', () => {
  // FY 460 − YTD9 330 = 130
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      flow(...CY.q2, 110e6, '10-Q', '2024-07-25', 'Q2-2024'),
      flow(...CY.q3, 120e6, '10-Q', '2024-10-24', 'Q3-2024'),
      flow(...CY.ytd9, 330e6, '10-Q', '2024-10-24', 'Q3-2024'),
      FY_ANCHOR // 460 Mio, 10-K, filed 2025-02-14
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  const q4 = qOf(res, 'revenue', 'FY2024-Q4');
  assert.equal(q4.value, 130e6);
  assert.equal(q4.basis, 'derived');
  assert.equal(q4.derivation.method, 'fiscal_year_minus_nine_months');
  assert.deepEqual([q4.derivation.minuend.form, q4.derivation.subtrahend.form], ['10-K', '10-Q']);
  assert.deepEqual([q4.derivation.minuend.accn, q4.derivation.subtrahend.accn], ['K-2024', 'Q3-2024']);
  assert.deepEqual([q4.start, q4.end], ['2024-10-01', '2024-12-31']);
  assert.equal(q4.source.filed, '2025-02-14'); // spaetere der beiden Veroeffentlichungen

  // Ohne 10-K-Jahreswert gibt es kein Q4 — es wird nichts ergaenzt.
  const ohneK = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      flow(...CY.q2, 110e6, '10-Q', '2024-07-25', 'Q2-2024'),
      flow(...CY.q3, 120e6, '10-Q', '2024-10-24', 'Q3-2024'),
      flow(...CY.ytd9, 330e6, '10-Q', '2024-10-24', 'Q3-2024'),
      // Jahresanker nur als Bilanzstichtag, damit das Geschaeftsjahresende
      // erkennbar bleibt — aber ohne Jahresumsatz.
    ],
    cash_and_equivalents: [stock('2024-12-31', 10e6, '10-K', '2025-02-14', 'K-2024')]
  });
  const res2 = Q.normalizeSecQuarters(ohneK, { tags: TAGS, fields: ['revenue', 'cash_and_equivalents'] });
  assert.equal(qOf(res2, 'revenue', 'FY2024-Q4'), null);
  assert.equal(res2.fields.revenue.quarters.length, 3);
});

test('kumulierte Werte verschiedener Geschaeftsjahre werden nicht verrechnet', () => {
  // FY2024-Jahreswert und FY2023-Neunmonatswert: keine Q4-Ableitung.
  const f = facts({
    revenue: [
      flow('2023-01-01', '2023-09-30', 300e6, '10-Q', '2023-10-24', 'Q3-2023'),
      FY_ANCHOR // FY2024, 460 Mio
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.equal(qOf(res, 'revenue', 'FY2024-Q4'), null);
  assert.equal(res.fields.revenue.quarters.length, 0);
});

test('rollierende Zwoelfmonatsperioden werden nicht als Geschaeftsjahr verwendet', () => {
  const f = facts({
    revenue: [
      FY_ANCHOR,
      flow('2024-04-01', '2025-03-31', 500e6, '10-Q', '2025-04-25', 'TTM'), // TTM
      flow(...CY.ytd9, 330e6, '10-Q', '2024-10-24', 'Q3-2024')
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  // Q4 2024 weiterhin aus 460 − 330 = 130; die TTM-Periode taucht nirgends auf.
  assert.equal(qOf(res, 'revenue', 'FY2024-Q4').value, 130e6);
  assert.equal(res.fields.revenue.quarters.some(x => x.value === 500e6), false);
  assert.equal(res.fields.revenue.cumulatives.some(x => x.value === 500e6), false);
  assert.equal(res.fields.revenue.notes.some(n => n.includes('2025-03-31')), true);
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Vom Kalenderjahr abweichendes Geschaeftsjahr
// ═════════════════════════════════════════════════════════════════════════════
test('abweichendes Geschaeftsjahr (Ende 31.01.) wird vollstaendig unterstuetzt', () => {
  // Geschaeftsjahr 2025: 01.02.2024 – 31.01.2025
  // Kumuliert 200 / 420 / 660 / 900 ⇒ Q1 200 · Q2 220 · Q3 240 · Q4 240
  const FY = {
    ytd3: ['2024-02-01', '2024-04-30'], ytd6: ['2024-02-01', '2024-07-31'],
    ytd9: ['2024-02-01', '2024-10-31'], fy:  ['2024-02-01', '2025-01-31']
  };
  const f = facts({
    revenue: [
      flow(...FY.ytd3, 200e6, '10-Q', '2024-06-05', 'Q1-FY25'),
      flow(...FY.ytd6, 420e6, '10-Q', '2024-09-05', 'Q2-FY25'),
      flow(...FY.ytd9, 660e6, '10-Q', '2024-12-05', 'Q3-FY25'),
      flow(...FY.fy,   900e6, '10-K', '2025-03-20', 'K-FY25')
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.deepEqual({ m: res.fiscalYearEnd.month, d: res.fiscalYearEnd.day }, { m: 1, d: 31 });
  const r = res.fields.revenue;
  // Drei der vier Quartale enden im Kalenderjahr 2024 — alle gehoeren zu FY2025.
  assert.deepEqual(r.quarters.map(x => x.periodKey),
    ['FY2025-Q4', 'FY2025-Q3', 'FY2025-Q2', 'FY2025-Q1']);
  assert.deepEqual(r.quarters.map(x => x.value), [240e6, 240e6, 220e6, 200e6]);
  assert.deepEqual(r.quarters.map(x => x.fiscalYear), [2025, 2025, 2025, 2025]);
  assert.deepEqual(r.quarters.map(x => x.end),
    ['2025-01-31', '2024-10-31', '2024-07-31', '2024-04-30']);
  assert.deepEqual(qOf(res, 'revenue', 'FY2025-Q4').derivation.formula, 'FY2025-YTD4 − FY2025-YTD3');
  assert.equal(r.gaps.length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Fehlendes Quartal — keine erfundene Reihe
// ═════════════════════════════════════════════════════════════════════════════
test('fehlendes Quartal bleibt Luecke und wird nicht ergaenzt', () => {
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      // Q2 fehlt vollstaendig (weder Einzelquartal noch Kumulierung)
      flow(...CY.q3, 120e6, '10-Q', '2024-10-24', 'Q3-2024'),
      FY_ANCHOR
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  const r = res.fields.revenue;
  assert.deepEqual(r.quarters.map(x => x.periodKey), ['FY2024-Q3', 'FY2024-Q1']);
  assert.equal(qOf(res, 'revenue', 'FY2024-Q2'), null);
  // Die Luecke wird benannt, nicht gefuellt.
  assert.deepEqual(r.gaps.map(g => g.periodKey), ['FY2024-Q2']);
  assert.equal(res.warnings.some(w => w.includes('revenue') && w.includes('Luecke')), true);
  // Q4 waere ohne Neunmonatswert nur aus dem Jahreswert ableitbar — das
  // geschieht ausdruecklich nicht.
  assert.equal(qOf(res, 'revenue', 'FY2024-Q4'), null);
  // Keine Reihe ueber die belegte Spanne hinaus
  assert.equal(r.quarters.length + r.gaps.length, 3);
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Berichtigter Abschluss
// ═════════════════════════════════════════════════════════════════════════════
test('Berichtigung: zuletzt veroeffentlichter Wert gewinnt, Vorwert bleibt sichtbar', () => {
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q',   '2024-04-25', 'Q1-2024'),
      flow(...CY.q2, 110e6, '10-Q',   '2024-07-25', 'Q2-2024'),          // urspruenglich
      flow(...CY.q2, 118e6, '10-Q/A', '2025-02-10', 'Q2-2024-A'),        // berichtigt
      flow(...CY.q3, 120e6, '10-Q',   '2024-10-24', 'Q3-2024'),
      FY_ANCHOR_2023
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  const q2 = qOf(res, 'revenue', 'FY2024-Q2');
  assert.equal(q2.value, 118e6);
  assert.equal(q2.source.form, '10-Q/A');
  assert.equal(q2.restatement.restated, true);
  assert.deepEqual(q2.restatement.supersedes.map(s => [s.value, s.accn]), [[110e6, 'Q2-2024']]);
});

test('Datenstichtag: spaeter veroeffentlichte Werte werden nicht uebernommen', () => {
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q',   '2024-04-25', 'Q1-2024'),
      flow(...CY.q2, 110e6, '10-Q',   '2024-07-25', 'Q2-2024'),
      flow(...CY.q2, 118e6, '10-Q/A', '2025-02-10', 'Q2-2024-A'),
      flow(...CY.q3, 120e6, '10-Q',   '2024-10-24', 'Q3-2024'),
      FY_ANCHOR_2023
    ]
  });
  // Stichtag 31.12.2024: die Berichtigung vom 10.02.2025 existierte noch nicht.
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'], asOfDate: '2024-12-31' });
  const q2 = qOf(res, 'revenue', 'FY2024-Q2');
  assert.equal(q2.value, 110e6);
  assert.equal(q2.source.accn, 'Q2-2024');
  assert.equal(q2.restatement.restated, false);
  assert.deepEqual(q2.restatement.supersedes, []);
  assert.equal(JSON.stringify(res.fields.revenue).includes('118000000'), false);

  // Stichtag vor jeder Veroeffentlichung des Quartals: kein Wert.
  const frueh = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'], asOfDate: '2024-05-01' });
  assert.equal(qOf(frueh, 'revenue', 'FY2024-Q2'), null);
  assert.equal(qOf(frueh, 'revenue', 'FY2024-Q1').value, 100e6);

  // Angaben ohne Veroeffentlichungsdatum lassen sich einem Stichtag nicht
  // zuordnen und werden dort nicht verwendet.
  const ohneFiled = facts({
    revenue: [flow(...CY.q1, 100e6, '10-Q', null, 'Q1-2024'), FY_ANCHOR_2023]
  });
  const res3 = Q.normalizeSecQuarters(ohneFiled, { tags: TAGS, fields: ['revenue'], asOfDate: '2024-12-31' });
  assert.equal(qOf(res3, 'revenue', 'FY2024-Q1'), null);
  // Ohne Stichtag bleibt derselbe Wert nutzbar.
  const res4 = Q.normalizeSecQuarters(ohneFiled, { tags: TAGS, fields: ['revenue'] });
  assert.equal(qOf(res4, 'revenue', 'FY2024-Q1').value, 100e6);
});

test('Widersprechende Angaben mit gleichem Veroeffentlichungsdatum ergeben keinen Wert', () => {
  const f = facts({
    revenue: [
      flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'A-1'),
      flow(...CY.q1, 105e6, '10-Q', '2024-04-25', 'A-2'),
      flow(...CY.q2, 110e6, '10-Q', '2024-07-25', 'Q2-2024'),
      FY_ANCHOR
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.equal(qOf(res, 'revenue', 'FY2024-Q1'), null);
  assert.equal(res.fields.revenue.conflicts.length, 1);
  assert.deepEqual(res.fields.revenue.conflicts[0].values.map(v => [v.value, v.accn]),
    [[105e6, 'A-2'], [100e6, 'A-1']]);
  assert.equal(res.warnings.some(w => w.includes('widerspruechliche')), true);
});

test('gemeldetes Quartal wird bei Abweichung zur Differenz nicht stillschweigend ersetzt', () => {
  // Gemeldetes Q2 = 115, Differenz der Kumulierungen = 210 − 100 = 110.
  const f = facts({
    revenue: [
      flow(...CY.ytd3, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      flow(...CY.ytd6, 210e6, '10-Q', '2024-07-25', 'Q2-2024'),
      flow(...CY.q2,   115e6, '10-Q', '2024-07-25', 'Q2-2024'),
      FY_ANCHOR
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  const q2 = qOf(res, 'revenue', 'FY2024-Q2');
  assert.equal(q2.value, 115e6);            // gemeldet, nicht gerechnet
  assert.equal(q2.basis, 'reported');
  assert.equal(q2.conflict.derivedValue, 110e6);
  assert.equal(q2.conflict.reportedMinusDerived, 5e6);
  assert.equal(res.fields.revenue.conflicts.length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. Stichtagsgroessen: Schulden, Liquiditaet, operatives Working Capital
// ═════════════════════════════════════════════════════════════════════════════
test('Bilanzstichtage werden je Stichtag gefuehrt und niemals summiert', () => {
  const f = facts({
    revenue: [FY_ANCHOR],
    total_debt:           [stock('2024-03-31', 500e6, '10-Q', '2024-04-25', 'Q1-2024'),
                           stock('2024-06-30', 520e6, '10-Q', '2024-07-25', 'Q2-2024'),
                           stock('2024-09-30', 510e6, '10-Q', '2024-10-24', 'Q3-2024'),
                           stock('2024-12-31', 480e6, '10-K', '2025-02-14', 'K-2024'),
                           // Derselbe Stichtag erneut im Folgebericht: Auswahl,
                           // niemals Addition.
                           stock('2024-12-31', 480e6, '10-Q', '2025-04-25', 'Q1-2025')],
    cash_and_equivalents: [stock('2024-09-30',  90e6, '10-Q', '2024-10-24', 'Q3-2024'),
                           stock('2024-12-31', 120e6, '10-K', '2025-02-14', 'K-2024')],
    current_assets:       [stock('2024-12-31', 300e6, '10-K', '2025-02-14', 'K-2024')],
    current_liabilities:  [stock('2024-12-31', 200e6, '10-K', '2025-02-14', 'K-2024')]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS,
    fields: ['revenue', 'total_debt', 'cash_and_equivalents', 'current_assets', 'current_liabilities'] });

  const d = res.fields.total_debt;
  assert.equal(d.kind, 'instant');
  assert.equal(d.quarters, undefined);            // kein Quartalspfad fuer Stichtagsgroessen
  assert.deepEqual(d.instants.map(x => x.date),
    ['2024-12-31', '2024-09-30', '2024-06-30', '2024-03-31']);
  assert.deepEqual(d.instants.map(x => x.value), [480e6, 510e6, 520e6, 500e6]);
  // Der doppelt gemeldete Stichtag erscheint genau einmal (keine 960 Mio).
  assert.equal(d.instants.filter(x => x.date === '2024-12-31').length, 1);
  assert.deepEqual(d.instants.map(x => x.periodKey),
    ['FY2024-Q4', 'FY2024-Q3', 'FY2024-Q2', 'FY2024-Q1']);
  assert.deepEqual(res.fields.cash_and_equivalents.instants.map(x => x.value), [120e6, 90e6]);
  // Working-Capital-Bestandteile stehen zum Jahresstichtag bereit …
  assert.equal(res.fields.current_assets.instants[0].value, 300e6);
  assert.equal(res.fields.current_liabilities.instants[0].value, 200e6);
  // … werden hier aber nicht verrechnet (die Bewertung bleibt unveraendert).
  assert.equal(res.fields.current_assets.instants[0].source.accn, 'K-2024');
});

test('Stichtagsberichtigung folgt derselben Regel wie Zeitraumwerte', () => {
  const f = facts({
    revenue: [FY_ANCHOR],
    cash_and_equivalents: [
      stock('2024-12-31', 120e6, '10-K',   '2025-02-14', 'K-2024'),
      stock('2024-12-31', 117e6, '10-K/A', '2025-06-30', 'K-2024-A')
    ]
  });
  const jetzt = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue', 'cash_and_equivalents'] });
  assert.equal(jetzt.fields.cash_and_equivalents.instants[0].value, 117e6);
  assert.equal(jetzt.fields.cash_and_equivalents.instants[0].restatement.restated, true);

  const stichtag = Q.normalizeSecQuarters(f,
    { tags: TAGS, fields: ['revenue', 'cash_and_equivalents'], asOfDate: '2025-03-31' });
  assert.equal(stichtag.fields.cash_and_equivalents.instants[0].value, 120e6);
  assert.equal(stichtag.fields.cash_and_equivalents.instants[0].restatement.restated, false);
});

test('Zeitraum- und Stichtagsangaben werden nicht vermischt', () => {
  const f = facts({
    revenue: [FY_ANCHOR, stock('2024-06-30', 999e6, '10-Q', '2024-07-25', 'Q2-2024')],
    cash_and_equivalents: [stock('2024-12-31', 120e6, '10-K', '2025-02-14', 'K-2024'),
                           flow(...CY.q4, 55e6, '10-K', '2025-02-14', 'K-2024')]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue', 'cash_and_equivalents'] });
  assert.equal(res.fields.revenue.quarters.some(x => x.value === 999e6), false);
  assert.equal(res.fields.revenue.notes.some(n => n.includes('Stichtagsangabe')), true);
  assert.deepEqual(res.fields.cash_and_equivalents.instants.map(x => x.value), [120e6]);
  assert.equal(res.fields.cash_and_equivalents.notes.some(n => n.includes('Zeitraumangabe')), true);
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. Umfang, Formulare und Fehlerfaelle
// ═════════════════════════════════════════════════════════════════════════════
test('nur 10-K/10-Q (und deren Berichtigungen) werden ausgewertet', () => {
  assert.deepEqual(Q.ACCEPTED_FORMS.slice().sort(), ['10-K', '10-K/A', '10-Q', '10-Q/A']);
  const f = facts({
    revenue: [FY_ANCHOR,
              flow(...CY.q1, 100e6, '8-K', '2024-04-25', '8K-1'),
              flow(...CY.q2, 110e6, '10-Q', '2024-07-25', 'Q2-2024')]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.equal(qOf(res, 'revenue', 'FY2024-Q1'), null);
  assert.equal(qOf(res, 'revenue', 'FY2024-Q2').value, 110e6);
});

test('ohne bestimmbares Geschaeftsjahresende wird nichts geliefert', () => {
  const f = facts({ revenue: [flow(...CY.q1, 100e6, '10-Q', '2024-04-25', 'Q1-2024')] });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.equal(res.ok, false);
  assert.match(res.reason, /Geschaeftsjahresende/);
  // Mit ausdruecklich gesetztem Geschaeftsjahresende ist derselbe Fact nutzbar.
  const res2 = Q.normalizeSecQuarters(f,
    { tags: TAGS, fields: ['revenue'], fiscalYearEnd: { month: 12, day: 31 } });
  assert.equal(res2.ok, true);
  assert.equal(res2.fiscalYearEnd.source, 'option');
  assert.equal(qOf(res2, 'revenue', 'FY2024-Q1').value, 100e6);
});

test('Umfang und Eingaben werden geprueft', () => {
  assert.equal(Q.normalizeSecQuarters(null, { tags: TAGS }).ok, false);
  assert.equal(Q.normalizeSecQuarters({}, { tags: TAGS }).ok, false);
  const f = facts({ revenue: [FY_ANCHOR] });
  assert.equal(Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['ebitda'] }).ok, false);
  assert.equal(Q.normalizeSecQuarters(f, { tags: TAGS, asOfDate: '31.12.2024' }).ok, false);
  // Umfang dieses Schrittes
  assert.deepEqual(Object.keys(Q.SEC_QUARTERLY_FIELDS),
    ['revenue', 'operating_income', 'net_income', 'cfo', 'capex',
     'total_debt', 'long_term_debt', 'cash_and_equivalents',
     'current_assets', 'current_liabilities']);
});

test('alle Felder des Umfangs laufen ueber denselben Weg', () => {
  const f = facts({
    revenue:          [flow(...CY.ytd9, 330e6, '10-Q', '2024-10-24', 'Q3-2024'), FY_ANCHOR],
    operating_income: [flow(...CY.ytd9,  66e6, '10-Q', '2024-10-24', 'Q3-2024'),
                       flow(...CY.fy,    92e6, '10-K', '2025-02-14', 'K-2024')],
    net_income:       [flow(...CY.ytd9,  45e6, '10-Q', '2024-10-24', 'Q3-2024'),
                       flow(...CY.fy,    64e6, '10-K', '2025-02-14', 'K-2024')],
    cfo:              [flow(...CY.ytd9, 200e6, '10-Q', '2024-10-24', 'Q3-2024'),
                       flow(...CY.fy,   300e6, '10-K', '2025-02-14', 'K-2024')],
    capex:            [flow(...CY.ytd9,  30e6, '10-Q', '2024-10-24', 'Q3-2024'),
                       flow(...CY.fy,    44e6, '10-K', '2025-02-14', 'K-2024')],
    long_term_debt:   [stock('2024-12-31', 400e6, '10-K', '2025-02-14', 'K-2024')]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS });
  // Q4 = Jahreswert − Neunmonatswert, je Feld unabhaengig nachgerechnet
  assert.equal(qOf(res, 'revenue',          'FY2024-Q4').value, 130e6); // 460 − 330
  assert.equal(qOf(res, 'operating_income', 'FY2024-Q4').value,  26e6); //  92 −  66
  assert.equal(qOf(res, 'net_income',       'FY2024-Q4').value,  19e6); //  64 −  45
  assert.equal(qOf(res, 'cfo',              'FY2024-Q4').value, 100e6); // 300 − 200
  assert.equal(qOf(res, 'capex',            'FY2024-Q4').value,  14e6); //  44 −  30
  assert.equal(res.fields.long_term_debt.instants[0].value, 400e6);
  for (const field of Object.keys(Q.SEC_QUARTERLY_FIELDS)) {
    assert.ok(res.fields[field], `Feld fehlt: ${field}`);
  }
});

test('Tag-Listen stammen aus der Anwendung (keine zweite Fassung)', () => {
  const map = Q.appTagMap();
  assert.deepEqual(Object.keys(map).sort(), Object.keys(Q.SEC_QUARTERLY_FIELDS).sort());
  for (const [field, tags] of Object.entries(map)) {
    assert.ok(Array.isArray(tags) && tags.length > 0, `leere Tag-Liste: ${field}`);
  }
  assert.equal(map.operating_income[0], 'OperatingIncomeLoss');
  assert.equal(map.cfo[0], 'NetCashProvidedByUsedInOperatingActivities');
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. Abgrenzung: die produktive Bewertung bleibt unberuehrt
// ═════════════════════════════════════════════════════════════════════════════
test('der Normalisierer ist nicht in die Anwendung eingebunden', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(Q.APP_FILE, 'utf8');
  assert.equal(html.includes('sec-quarterly'), false);
  assert.equal(html.includes('normalizeSecQuarters'), false);
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. Weitere Periodenformen
// ═════════════════════════════════════════════════════════════════════════════
test('Mehrquartalsperioden ohne Bezug zum Geschaeftsjahresbeginn werden verworfen', () => {
  // 01.04.–30.09.2024: sechs Monate, aber kein Geschaeftsjahresbeginn.
  // Weder Kumulierung noch Einzelquartal — und damit auch keine Grundlage
  // fuer eine Ableitung.
  const f = facts({
    revenue: [
      flow(...CY.ytd3, 100e6, '10-Q', '2024-04-25', 'Q1-2024'),
      flow('2024-04-01', '2024-09-30', 230e6, '10-Q', '2024-10-24', 'H-2024'),
      FY_ANCHOR
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  const r = res.fields.revenue;
  assert.deepEqual(r.quarters.map(x => x.periodKey), ['FY2024-Q1']);
  assert.equal(r.cumulatives.some(c => c.value === 230e6), false);
  assert.equal(r.notes.some(n => n.includes('beginnt nicht zum Geschaeftsjahr')), true);
  // Direkt an der Einordnungsfunktion geprueft
  const cls = Q.classifyFlowFact(Q.parseIsoDate('2024-04-01'), Q.parseIsoDate('2024-09-30'),
                                 { month: 12, day: 31 });
  assert.equal(cls.role, undefined);
  assert.match(cls.rejected, /Geschaeftsjahr/);
});

test('52/53-Wochen-Geschaeftsjahr (Ende Ende September) wird korrekt zerlegt', () => {
  // Geschaeftsjahr 2024: 01.10.2023 – 28.09.2024 (364 Tage, 52 Wochen)
  // Kumuliert 120 / 250 / 380 / 500 ⇒ Q1 120 · Q2 130 · Q3 130 · Q4 120
  const f = facts({
    revenue: [
      flow('2023-10-01', '2023-12-30', 120e6, '10-Q', '2024-02-01', 'Q1-FY24'),
      flow('2023-10-01', '2024-03-30', 250e6, '10-Q', '2024-05-02', 'Q2-FY24'),
      flow('2023-10-01', '2024-06-29', 380e6, '10-Q', '2024-08-01', 'Q3-FY24'),
      flow('2023-10-01', '2024-09-28', 500e6, '10-K', '2024-11-01', 'K-FY24')
    ]
  });
  const res = Q.normalizeSecQuarters(f, { tags: TAGS, fields: ['revenue'] });
  assert.deepEqual({ m: res.fiscalYearEnd.month, d: res.fiscalYearEnd.day }, { m: 9, d: 28 });
  const r = res.fields.revenue;
  assert.deepEqual(r.quarters.map(x => x.periodKey),
    ['FY2024-Q4', 'FY2024-Q3', 'FY2024-Q2', 'FY2024-Q1']);
  assert.deepEqual(r.quarters.map(x => x.value), [120e6, 130e6, 130e6, 120e6]);
  // Das erste Quartal endet im Kalenderjahr 2023, gehoert aber zu FY2024.
  assert.equal(qOf(res, 'revenue', 'FY2024-Q1').end, '2023-12-30');
  assert.equal(qOf(res, 'revenue', 'FY2024-Q4').derivation.method, 'fiscal_year_minus_nine_months');
  assert.equal(r.gaps.length, 0);
});
