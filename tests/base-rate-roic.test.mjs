// ─────────────────────────────────────────────────────────────────────────────
// O-1 (V1.0.77): vereinfachter ROIC im Wachstumsprofil (computeBaseRateLite →
// historicProfile.roicCurrent/roicPrior/roicTrend, Anzeige „Historisches
// Profil“ im Base-Rate-Lite-Block).
//
// Bis V1.0.76: NOPAT / (Eigenkapital + Schulden − Liquiditaet) je ARRAY-
// POSITION, fehlende Schulden oder Liquiditaet = 0, Steuersatz ohne Angabe
// pauschal 25 %, keine Leasingsperre. Ein scheinbar belastbarer ROIC konnte so
// aus erfundenen Nullwerten oder Werten verschiedener Stichtage entstehen —
// waehrend ROIC − WACC fuer dieselben Daten „nicht bewertbar“ war.
//
// Sollwerte aus der Definition (Steuer 25 %, EBIT 100 ⇒ NOPAT 75; Eigenkapital
// 500, Schulden 600):
//   Liquiditaet 400 ⇒ IC 700 ⇒ 10.714 %;  Liquiditaet 0 ⇒ IC 1100 ⇒ 6.818 %;
//   EBIT 80 (NOPAT 60), IC 700 ⇒ 8.571 %;  Schulden 100, Liquiditaet 300 ⇒ IC 300 ⇒ 25 %.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();
const close = (a, b, eps = 1e-9) => a != null && Math.abs(a - b) <= eps;
const YE = (n, from = 2025) => Array.from({ length: n }, (_, i) => `${from - i}-12-31`);
const MID = (n) => Array.from({ length: n }, (_, i) => `${2025 - i}-06-30`);

function mjOf({ n = 6, ebit = null, bv = 500, td = 600, cash = 400, periods = true, cashPeriods = null,
                stockPeriods = null, ebitPeriods = null, tax = 25, extraF = {}, extraMeta = {}, sub = 'standard_nonfin' } = {}) {
  const fill = (v) => Array(n).fill(v);
  const f = {
    revenue: fill(1000), ebit: ebit || fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130), fcf: fill(80),
    net_income: fill(70), eps_diluted: fill(0.7), shares_diluted: fill(100), book_value: fill(bv)
  };
  if (td != null) f.total_debt = fill(td);
  if (cash != null) f.cash_and_equivalents = fill(cash);
  Object.assign(f, extraF);
  if (periods) {
    const pE = ebitPeriods || YE(n), pS = stockPeriods || YE(n);
    f._v4_meta = Object.assign({ ebit: { periods: pE }, revenue: { periods: pE }, book_value: { periods: pS } },
      td != null ? { total_debt: { periods: pS } } : {},
      cash != null ? { cash_and_equivalents: { periods: cashPeriods || pS } } : {}, extraMeta);
  }
  return {
    meta: { ticker: 'BRL', sub_classification: sub }, fundamentals: f, market: { price: 10 },
    valuation: { wacc_derived: 9, wacc_components: tax == null ? {} : { tax_rate: tax }, fade: { enabled: false },
                 cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 }
  };
}
const hp = (m) => { const qr = S.runQualityEngine(m); return { h: S.computeBaseRateLite(m, qr, null).historicProfile, qr, m }; };
const html = (m) => S.buildBaseRateLiteDetailBlock(m, S.runQualityEngine(m), null);

const BLOCKED = {
  'Liquiditaet fehlt ganz (vorher als 0 ⇒ 6.82 %)': [mjOf({ cash: null }), /Liquidit/],
  'Schulden fehlen ganz (vorher als 0 ⇒ 75 %)': [mjOf({ td: null }), /Finanzschulden/],
  'Liquiditaet nur zum Halbjahresstichtag (vorher positionsweise 10.71 %)': [mjOf({ cashPeriods: MID(6) }), /Liquidit/],
  'Bestaende erst ab 2024 (vorher EBIT 2025 mit Bestand 2024 gepaart)': [mjOf({ stockPeriods: YE(6, 2024) }), /Eigenkapital|Finanzschulden|Liquidit/],
  'Steuersatz fehlt (vorher pauschal 25 %)': [mjOf({ tax: null }), /Steuersatz/]
};

for (const [label, [m, why]] of Object.entries(BLOCKED)) {
  test(`O-1 nicht bewertbar: ${label}`, () => {
    const { h } = hp(m);
    assert.equal(h.roicCurrent, null, 'kein ROIC aus erfundenen Werten oder fremden Stichtagen');
    assert.equal(h.roicTrend, null);
    assert.match(h.roicCurrentReason, why);
    const out = html(m);
    assert.match(out, /ROIC[^<]*vereinfacht/);
    assert.match(out, /nicht bewertbar/);
    assert.doesNotMatch(out, /ROIC akt\.[^<]*<\/span> <span[^>]*>\d/, 'keine ROIC-Zahl');
  });
}

test('O-1 nicht bewertbar: Leasingbereinigung erforderlich, aber nicht erfuellbar (gleiche Sperre wie ROIC − WACC)', () => {
  // retail, Leasing 400 (> 20 % von IC 700), aber nur bis 2023 periodengleich gemeldet.
  const n = 6;
  const m = mjOf({ sub: 'retail', extraF: { operating_lease_liabilities: [400, 400, 400, 400] },
    extraMeta: { operating_lease_liabilities: { periods: YE(4, 2023) } } });
  const { h, qr } = hp(m);
  assert.equal(qr.descriptive.roicMinusWacc.status, 'insufficient_data', 'Vorbedingung: bewerteter ROIC gesperrt');
  assert.equal(qr.descriptive.roicMinusWacc._leaseRequired, true);
  assert.equal(h.roicCurrent, null);
  assert.match(h.roicCurrentReason, /Leasingbereinigung erforderlich/);
  assert.equal(n, 6);
});

test('O-1 Trend nicht bestimmbar, wenn das Vergleichsjahr nicht zwei Geschaeftsjahre zurueckliegt', () => {
  // EBIT-/Bestandsperioden 2025, 2024, 2021, … (Luecke 2023/2022): Index 2 ist 2021.
  const P = ['2025-12-31', '2024-12-31', '2021-12-31', '2020-12-31', '2019-12-31', '2018-12-31'];
  const { h } = hp(mjOf({ ebitPeriods: P, stockPeriods: P, ebit: [100, 100, 80, 80, 80, 80] }));
  assert.ok(close(h.roicCurrent, 75 / 700 * 100));
  assert.equal(h.roicTrend, null, 'kein 2-Jahres-Trend ueber vier Jahre');
  assert.match(h.roicTrendReason, /2021-12-31/);
});

test('Gegenprobe: belegte, periodengleiche Angaben ⇒ ROIC 10.714 %, Trend +2.143 pp', () => {
  const m = mjOf({ ebit: [100, 100, 80, 100, 100, 100] });
  const { h } = hp(m);
  assert.ok(close(h.roicCurrent, 75 / 700 * 100), String(h.roicCurrent));
  assert.ok(close(h.roicPrior, 60 / 700 * 100), String(h.roicPrior));
  assert.ok(close(h.roicTrend, 75 / 700 * 100 - 60 / 700 * 100));
  assert.equal(h.roicCurrentPeriod, '2025-12-31');
  const out = html(m);
  assert.match(out, /10\.7%/);
  assert.match(out, /\+2\.1pp/);
  assert.match(out, /nicht der bewertete ROIC − WACC/);
});

test('Gegenprobe: belegte Liquiditaet 0 bleibt gueltig (6.818 %)', () => {
  const { h } = hp(mjOf({ cash: 0 }));
  assert.ok(close(h.roicCurrent, 75 / 1100 * 100), String(h.roicCurrent));
});

test('Gegenprobe: Nettoliquiditaet (Schulden 100, Liquiditaet 300) ⇒ 25 %', () => {
  const { h } = hp(mjOf({ td: 100, cash: 300 }));
  assert.ok(close(h.roicCurrent, 25), String(h.roicCurrent));
});

test('Gegenprobe: periodenfreie Altdaten mit allen Angaben bleiben im Positionsbezug berechenbar', () => {
  const { h } = hp(mjOf({ periods: false, ebit: [100, 100, 80, 100, 100, 100] }));
  assert.ok(close(h.roicCurrent, 75 / 700 * 100));
  assert.ok(close(h.roicTrend, 75 / 700 * 100 - 60 / 700 * 100));
  assert.ok(h.roicCurrentPeriod == null);
});

test('Keine neue Wirkung: Gesamtbewertung und Vergleiche haengen nicht am vereinfachten ROIC', () => {
  // Acht gleiche Jahre; in b fehlt die Liquiditaet fuer 2025 und 2023. ROIC − WACC
  // (Median ueber die sechs vollstaendigen Jahre) bleibt identisch, der
  // vereinfachte Einzeljahres-ROIC wird gesperrt.
  const a = mjOf({ n: 8 });
  const b = mjOf({ n: 8, extraF: { cash_and_equivalents: [null, 400, null, 400, 400, 400, 400, 400] } });
  const qa = S.runQualityEngine(a), qb = S.runQualityEngine(b);
  assert.equal(qa.descriptive.roicMinusWacc.value, qb.descriptive.roicMinusWacc.value);
  const ra = S.computeBaseRateLite(a, qa, null);
  const rb = S.computeBaseRateLite(b, qb, null);
  assert.ok(close(ra.historicProfile.roicCurrent, 75 / 700 * 100));
  assert.equal(rb.historicProfile.roicCurrent, null);
  assert.equal(qa.verdict, qb.verdict);
  assert.equal(ra.overallRating, rb.overallRating);
  assert.deepEqual(JSON.parse(JSON.stringify(ra.comparisons)), JSON.parse(JSON.stringify(rb.comparisons)));
});
