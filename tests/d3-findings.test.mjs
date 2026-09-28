// ─────────────────────────────────────────────────────────────────────────────
// Regressionstests zu den Befunden des erneuten Realdatenabgleichs D3
// (AUDIT-REAL-DATA-MCD-JNJ.md §13). Jeder Test verlangt das fachlich richtige
// Ergebnis und scheitert am Stand vor der Korrektur (V1.0.73, 04d8c83).
// Grundlage: wortgetreue SEC-Auszuege (tests/real-data/excerpts/) und die
// produktiven Funktionen der ausgelieferten HTML-Datei.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './audit-chat12.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const excerpt = (n) => JSON.parse(readFileSync(join(HERE, 'real-data', 'excerpts', n), 'utf8'));
const S = app();
const plain = (x) => JSON.parse(JSON.stringify(x));

function importFacts(facts, ticker) {
  const { extracted, derivationNotes } = S._extractSecFundamentals(facts);
  const mj = S._buildSecMasterJson({ ticker, cik: '0', companyName: ticker, sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: facts, derivationNotes });
  return { mj, extracted };
}

// ═════════════════════════════════════════════════════════════════════════════
// D3-4 · Unverwaesserte Aktienhistorie (Restluecke von F-4)
// ═════════════════════════════════════════════════════════════════════════════
test('D3-4 MCD real: shares_basic einheitlich in Mio. (keine Stueckzahlen in der Mio.-Reihe)', () => {
  const { mj } = importFacts(excerpt('mcd-d2-regression.json').facts, 'MCD');
  const sb = plain(mj.fundamentals.shares_basic);
  // 10-K-Angaben (GuV „Weighted-average shares outstanding–basic“), FY2025 … FY2016.
  assert.deepEqual(sb, [713.4, 718.3, 727.9, 736.5, 746.3, 744.6, 758.1, 778.2, 807.4, 854.4]);
  assert.ok(sb.every(v => v > 100 && v < 2000), 'keine Rohstueckzahl in der Mio.-Reihe: ' + sb.join(', '));
  const hc = plain(mj.fundamentals._v4_meta.shares_basic.history_check);
  assert.equal(hc.truncatedAt, null);
  assert.ok(hc.elements.slice(1).every(e => ['verified', 'rescaled', 'original_filing'].includes(e.status)),
    JSON.stringify(hc.elements.map(e => e.status)));
  // Periodenangaben passen weiter zur Reihe.
  assert.equal(mj.fundamentals._v4_meta.shares_basic.periods.length, sb.length);
});

test('D3-4 JNJ real: bereits einheitliche shares_basic-Reihe bleibt unveraendert', () => {
  const J = excerpt('jnj-d2-regression.json').facts;
  const raw = S._extractSecFundamentals(J).extracted.shares_basic.values;
  const { mj } = importFacts(J, 'JNJ');
  const sb = plain(mj.fundamentals.shares_basic);
  assert.equal(sb.length, raw.length);
  sb.forEach((v, i) => assert.ok(Math.abs(v - raw[i] / 1e6) < 1e-6, `Index ${i}: ${v} vs ${raw[i]}`));
});

test('D3-4 Fallback ohne verwaesserte Aktien: Ersatzreihe aus shares_basic ist einheitlich skaliert', () => {
  const src = excerpt('mcd-d2-regression.json').facts;
  const facts = JSON.parse(JSON.stringify(src));
  const root = facts['us-gaap'] ? facts['us-gaap'] : facts;
  delete root.WeightedAverageNumberOfDilutedSharesOutstanding;
  const { mj } = importFacts(facts, 'MCD');
  const sd = plain(mj.fundamentals.shares_diluted);
  assert.ok(sd.length >= 5, 'Ersatzreihe vorhanden');
  assert.ok(sd.every(v => v > 100 && v < 2000), 'Ersatzreihe ohne Rohstueckzahlen: ' + sd.join(', '));
  const m = S.computeNetShareIssuance(mj);
  if (m.status === 'ok') assert.ok(m.value > -0.5, 'keine Schein-Reduktion um ~100 %: ' + m.value);
});

// ═════════════════════════════════════════════════════════════════════════════
// D3-1 · Uebersicht: Sperrgrund statt pauschalem „Hard Stop aktiv“
// ═════════════════════════════════════════════════════════════════════════════
const NO_PRICE = 'Kein Kurs verfügbar — SEC-Import ohne Yahoo (oder Yahoo fehlgeschlagen). '
  + 'Bitte Kurs im Assumptions-Tab manuell eingeben, danach Neu berechnen.';

test('D3-1 Kurzbegruendung ohne aktiven Hard Stop nennt den Sperrgrund, nicht „Hard Stop“', () => {
  const s = { position: 'blocked', status: 'ok', blockReason: NO_PRICE, range: { base: 81.81 } };
  const why = S._ovMiniWhy({ hardStops: [{ id: 'distress', name: 'Distress', triggered: false }] }, s, {});
  assert.doesNotMatch(why, /Hard Stop/);
  assert.match(why, /Kein Kurs verfügbar/);
  // MCD-Fall: keine anwendbaren Modelle.
  const why2 = S._ovMiniWhy({ hardStops: [] }, { position: 'blocked', status: 'no_models_applicable',
    blockReason: 'Keine Bewertungsmodelle aktiv — Valuation-Inputs unvollständig (kein Hard Stop)' }, {});
  assert.doesNotMatch(why2, /Hard Stop aktiv/);
  assert.match(why2, /Keine Bewertungsmodelle aktiv/);
});

test('D3-1 aktiver Hard Stop wird weiterhin mit Namen genannt', () => {
  const why = S._ovMiniWhy({ hardStops: [{ id: 'going_concern', name: 'Going Concern', triggered: true, overridden: false }] },
    { position: 'blocked', blockReason: 'Quality Verdict: reject — Hard Stop ausgelöst (siehe Quality-Tab)' }, {});
  assert.match(why, /Going Concern aktiv/);
});

test('D3-1 Kernaussage nennt den tatsaechlichen Sperrgrund', () => {
  const s = { position: 'blocked', status: 'ok', blockReason: NO_PRICE, range: { base: 81.81 } };
  const st = plain(S.ovKeyStatements({ fundamentals: {}, market: {}, meta: {} }, { hardStops: [] }, s, null));
  assert.match(st[0].text, /^Die Bewertung ist gesperrt: Kein Kurs verfügbar/);
  assert.doesNotMatch(st[0].text, /kein belastbarer Eigenkapitalwert/);
  // Ohne Sperrgrund bleibt die bisherige Aussage.
  const st2 = plain(S.ovKeyStatements({ fundamentals: {}, market: {}, meta: {} }, { hardStops: [] }, { position: 'blocked' }, null));
  assert.match(st2[0].text, /kein belastbarer Eigenkapitalwert/);
});

// ═════════════════════════════════════════════════════════════════════════════
// D3-2 · TTM-Grund nennt ein gemeldetes, aber verworfenes Quartal
// ═════════════════════════════════════════════════════════════════════════════
const Q = (fy, fq, start, end, value, extra = {}) => Object.assign({ periodKey: `FY${fy}-Q${fq}`, fiscalYear: fy, fiscalQuarter: fq,
  start, end, value, basis: 'reported', source: { form: '10-Q', filed: '2026-08-01' } }, extra);
const QUARTERS = [
  Q(2025, 3, '2025-07-01', '2025-09-30', 100),
  Q(2025, 4, '2025-10-01', '2025-12-31', 100, { basis: 'derived' }),
  Q(2026, 1, '2026-01-01', '2026-03-31', 100),
  Q(2026, 2, '2026-04-01', '2026-06-30', 100),
];

test('D3-2 verworfenes Quartal in der Kette: Grund nennt Quartal und Widerspruch', () => {
  const qs = plain(QUARTERS); qs[0].conflict = true;          // Q3/2025 gemeldet, aber widerspruechlich
  const r = S.computeTtmFromQuarters(qs, { anchorEnd: '2026-06-30' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /FY2025-Q3 \(Ende 2025-09-30\) ist gemeldet, aber verworfen: Quartal steht im Widerspruch/);
  assert.doesNotMatch(r.reason, /kein Quartal endet am/);
});

test('D3-2 verworfenes Ankerquartal: Grund nennt Quartal und Widerspruch', () => {
  const qs = plain(QUARTERS); qs[3].conflict = true;
  const r = S.computeTtmFromQuarters(qs, { anchorEnd: '2026-06-30' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /^kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 \(Ende 2026-06-30\) ist gemeldet, aber verworfen/);
});

test('D3-2 tatsaechlich fehlendes Quartal: bisheriger Grund bleibt', () => {
  const qs = plain(QUARTERS).filter((_, i) => i !== 0);
  const r = S.computeTtmFromQuarters(qs, { anchorEnd: '2026-06-30' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /kein Quartal endet am 2025-09-30$/);
  const ok = S.computeTtmFromQuarters(plain(QUARTERS), { anchorEnd: '2026-06-30' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value, 400);
});

// ═════════════════════════════════════════════════════════════════════════════
// D3-5 · Widerspruechliche Schuldenangaben: Umfang unbelegt, nicht „Teilbetrag“
// ═════════════════════════════════════════════════════════════════════════════
test('D3-5 MCD real: Sperre bleibt, aber 39,973 wird nicht als Teilbetrag behauptet', () => {
  const { mj } = importFacts(excerpt('mcd-d2-regression.json').facts, 'MCD');
  const b = S._resolveNetDebtForDcfBridge(mj.fundamentals);
  assert.equal(b.available, false);                           // Sperre unveraendert
  assert.match(b.reason, /widersprechen sich/);
  assert.match(b.reason, /Umfang des vorliegenden Werts ist damit nicht belegt/);
  assert.doesNotMatch(b.reason, /Der vorliegende Wert ist ein Teilbetrag/);
  const m = S.computeNetDebtToEbitda(mj);
  assert.equal(m.status, 'insufficient_data');
  assert.match(m.detail, /Umfang des vorhandenen Werts nicht belegt \(Teilbetrag nicht ausgeschlossen\)/);
  assert.doesNotMatch(m.detail, /vorhandener Wert ist ein Teilbetrag/);
});

test('D3-5 JNJ real: nachweislicher Teilbetrag (Umfang unbestimmt) bleibt als Teilbetrag benannt', () => {
  const { mj } = importFacts(excerpt('jnj-d2-regression.json').facts, 'JNJ');
  const b = S._resolveNetDebtForDcfBridge(mj.fundamentals);
  assert.equal(b.available, false);
  assert.match(b.reason, /Der vorliegende Wert ist ein Teilbetrag/);
});

// ═════════════════════════════════════════════════════════════════════════════
// D3-6 · QCE-Komponente ROIC-Trend folgt der Regel von ROIC − WACC
// ═════════════════════════════════════════════════════════════════════════════
const YEARS = ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31', '2021-12-31', '2020-12-31', '2019-12-31', '2018-12-31'];
function trendMj({ ebit = [130, 125, 120, 100, 100, 100, 100, 100], periods = YEARS, debtPeriods = null } = {}) {
  const per = (p) => ({ periods: p.slice() });
  return { meta: {}, market: {}, valuation: { wacc_components: { tax_rate: 25 } }, fundamentals: {
    ebit: ebit.slice(), book_value: YEARS.map(() => 500), total_debt: YEARS.map(() => 600), cash_and_equivalents: YEARS.map(() => 100),
    _v4_meta: { ebit: per(periods), book_value: per(periods), total_debt: per(debtPeriods || periods), cash_and_equivalents: per(periods) } } };
}
const LEASE_BLOCKED = { descriptive: { roicMinusWacc: { status: 'insufficient_data', value: null, _leaseRequired: true, _leaseAdjusted: false } } };

test('D3-6 Leasingbereinigung erforderlich, aber nicht erfuellbar: kein ROIC-Trend-Score', () => {
  const r = plain(S._qceRoicTrend(trendMj(), LEASE_BLOCKED));
  assert.notEqual(r && r.status, 'ok');
  const q = plain(S.computeQualityCapitalEfficiencyScore(LEASE_BLOCKED, trendMj()));
  const c = q.components.find(x => x.key === 'roicTrend');
  assert.equal(c.available, false);
  assert.equal(c.score, null);
});

test('D3-6 ohne Leasingsperre bleibt der ROIC-Trend wie bisher', () => {
  const ok = { descriptive: { roicMinusWacc: { status: 'ok', value: 5, _leaseAdjusted: false } } };
  const r = plain(S._qceRoicTrend(trendMj(), ok));
  assert.equal(r.status, 'ok');
  assert.ok(r.delta_pp > 0);
});

test('D3-6 Perioden: versetzte Schuldenreihe wird nicht per Position gepaart', () => {
  const shifted = YEARS.map(p => (Number(p.slice(0, 4)) - 1) + p.slice(4));   // jede Schuldenangabe ein Jahr aelter
  const r = S._qceRoicTrend(trendMj({ debtPeriods: shifted }), null);
  assert.ok(r == null || r.status !== 'ok', JSON.stringify(r));
  // Metadatenfreie Altdaten: bisheriger Positionsbezug.
  const legacy = trendMj(); delete legacy.fundamentals._v4_meta;
  assert.equal(plain(S._qceRoicTrend(legacy, null)).status, 'ok');
});
