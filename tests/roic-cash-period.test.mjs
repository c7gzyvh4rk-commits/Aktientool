// ─────────────────────────────────────────────────────────────────────────────
// Review-Nachbesserung PR #2 (V1.0.76): ROIC − WACC ohne periodengleiche
// Liquiditaet.
//
// Bis V1.0.75 setzte computeRoicMinusWacc im Periodenmodus eine fehlende
// periodengleiche Liquiditaet still auf 0 (`const cashI = … : 0`). Damit stieg
// das investierte Kapital um die Liquiditaet, der ROIC sank — und ein
// negativer Spread loeste `value_destroyer` aus, setzte das Qualitaetsurteil
// auf `caution_quality` und hob die Basis-MoS von 15 % auf 25 %.
//
// Sollwerte sind unabhaengig von der Implementierung hergeleitet:
//   Steuer 25 %, EBIT 100 ⇒ NOPAT 75; Buchwert 500, Schulden 600.
//   Liquiditaet 400 ⇒ IC 700  ⇒ ROIC 75/700  = 10.714 %  (WACC 9 % ⇒ +1.714 pp)
//   Liquiditaet 0   ⇒ IC 1100 ⇒ ROIC 75/1100 =  6.818 %  (⇒ −2.182 pp)
//   Liquiditaet 100 ⇒ IC 1000 ⇒ ROIC 75/1000 =  7.500 %  (⇒ −1.500 pp)
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const WACC = 9;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const ROIC_400 = 75 / 700 * 100, ROIC_0 = 75 / 1100 * 100, ROIC_100 = 75 / 1000 * 100;

const YE = (n) => Array.from({ length: n }, (_, i) => `${2025 - i}-12-31`);
const MID = (y) => `${y}-06-30`;   // Halbjahresstichtag: 184 Tage vom Jahresende, kein Periodenbezug

// n Jahre bis 2025. cashPeriods/cashValues je Jahr (null = keine Angabe).
function mjOf({ n = 6, cashValues, cashPeriods, noPeriods = false }) {
  const fill = (v) => Array(n).fill(v);
  const fund = {
    revenue: fill(1000), ebit: fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130),
    net_income: fill(70), eps_diluted: fill(0.7), dps: fill(0.3), book_value: fill(500),
    total_debt: fill(600), cash_and_equivalents: cashValues, shares_diluted: fill(100)
  };
  if (!noPeriods) {
    fund._v4_meta = { ebit: { periods: YE(n) }, book_value: { periods: YE(n) },
                      total_debt: { periods: YE(n) }, cash_and_equivalents: { periods: cashPeriods } };
  }
  return {
    meta: { ticker: 'RCP', sub_classification: 'standard_nonfin' },
    fundamentals: fund,
    valuation: { wacc_derived: WACC, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 10 }
  };
}

// Grenzfall: sechs Jahre, fuer 2025–2022 liegt Liquiditaet nur zum 30.06. vor.
const edgeCase = () => mjOf({ n: 6, cashValues: Array(6).fill(400),
  cashPeriods: [MID(2025), MID(2024), MID(2023), MID(2022), '2021-12-31', '2020-12-31'] });

// Qualitaetsurteil und Basis-MoS ueber die produktiven Pfade. Piotroski und
// Altman sind fest „bestanden“ gesetzt (unabhaengig von dieser Korrektur),
// damit das Urteil allein an ROIC − WACC haengt.
function verdictAndMos(mj) {
  const qr = S.runQualityEngine(mj);
  qr.scores.piotroski = { status: 'ok', value: 8 };
  qr.scores.altman = { status: 'ok', value: 3.5 };
  qr.hardStops = [];
  const v = S.synthesizeVerdict(qr);
  qr.verdict = v.verdict; qr.reasons = v.reasons;
  const syn = S.runFairValueSynthesizer(mj, S.runValuationEngine(mj), qr,
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
  return { roic: qr.descriptive.roicMinusWacc, verdict: v.verdict, reasons: [...v.reasons],
           mosBase: syn.mosComponents.base, synVerdict: syn._qualityVerdict };
}

test('fehlende periodengleiche Liquiditaet wird nicht als 0 gewertet (zu wenige vollstaendige Jahre)', () => {
  const m = S.computeRoicMinusWacc(edgeCase());
  assert.equal(m.status, 'insufficient_data');
  assert.equal(m.value, null);
  assert.match(m.detail, /periodengleiche Liquidit/);
  assert.match(m.detail, /2025-12-31/);
});

test('Liquiditaet ohne Wert bei passender Periode ist ebenfalls keine 0', () => {
  const vals = [null, null, null, null, 400, 400];
  const m = S.computeRoicMinusWacc(mjOf({ n: 6, cashValues: vals, cashPeriods: YE(6) }));
  assert.equal(m.status, 'insufficient_data');
  assert.equal(m.value, null);
});

test('genug vollstaendige Jahre: gerechnet wird ausschliesslich aus diesen', () => {
  // Sieben Jahre; 2025 und 2024 ohne periodengleiche Liquiditaet ⇒ fuenf vollstaendige.
  const m = S.computeRoicMinusWacc(mjOf({ n: 7, cashValues: Array(7).fill(400),
    cashPeriods: [MID(2025), MID(2024), '2023-12-31', '2022-12-31', '2021-12-31', '2020-12-31', '2019-12-31'] }));
  assert.equal(m.status, 'ok');
  assert.ok(close(m.roicReported, ROIC_400), 'ROIC ' + m.roicReported);
  assert.ok(close(m.value, ROIC_400 - WACC), 'Spread ' + m.value);
  assert.match(m.detail, /\(5y\)/);
  assert.match(m.detail, /ohne periodengleiche Liquidit.*2025-12-31.*2024-12-31/);
});

test('belegte periodengleiche Liquiditaet von exakt 0 bleibt gueltig', () => {
  const m = S.computeRoicMinusWacc(mjOf({ n: 6, cashValues: Array(6).fill(0), cashPeriods: YE(6) }));
  assert.equal(m.status, 'ok');
  assert.ok(close(m.roicReported, ROIC_0), 'ROIC ' + m.roicReported);
  assert.ok(close(m.value, ROIC_0 - WACC));
  assert.doesNotMatch(m.detail, /ohne periodengleiche Liquidit/);
});

test('Folgewirkung: kein value_destroyer, kein caution_quality, Basis-MoS 15 % allein wegen Nullannahme', () => {
  // Vor V1.0.76: ROIC-Median 6.818 % ⇒ Spread −2.18 pp ⇒ value_destroyer ⇒
  // caution_quality ⇒ Basis-MoS 25 %. Richtig: ROIC − WACC nicht bewertbar.
  const r = verdictAndMos(edgeCase());
  assert.equal(r.roic.status, 'insufficient_data');
  assert.ok(!r.reasons.includes('value_destroyer'), r.reasons.join(','));
  assert.equal(r.verdict, 'investable_high');
  assert.equal(r.synVerdict, 'investable_high');
  assert.equal(r.mosBase, CFG.mos.investable_high);
});

test('Gegenprobe: tatsaechlich negativer Spread mit belegter Liquiditaet loest die Folgen weiter aus', () => {
  const r = verdictAndMos(mjOf({ n: 6, cashValues: Array(6).fill(100), cashPeriods: YE(6) }));
  assert.equal(r.roic.status, 'ok');
  assert.ok(close(r.roic.value, ROIC_100 - WACC), 'Spread ' + r.roic.value);
  assert.ok(r.reasons.includes('value_destroyer'));
  assert.equal(r.verdict, 'caution_quality');
  assert.equal(r.mosBase, CFG.mos.caution_quality);
});

test('Gegenprobe positiv: belegte Liquiditaet 400 ergibt +1.71 pp und kein value_destroyer', () => {
  const r = verdictAndMos(mjOf({ n: 6, cashValues: Array(6).fill(400), cashPeriods: YE(6) }));
  assert.equal(r.roic.status, 'ok');
  assert.ok(close(r.roic.value, ROIC_400 - WACC));
  assert.ok(!r.reasons.includes('value_destroyer'));
  assert.equal(r.mosBase, CFG.mos.investable_high);
});

test('Erhalt: vollstaendig periodenfreie Altdaten behalten ihre bisherige Regel', () => {
  const m = S.computeRoicMinusWacc(mjOf({ n: 6, cashValues: Array(6).fill(400), noPeriods: true }));
  assert.equal(m.status, 'ok');
  assert.ok(close(m.roicReported, ROIC_400));
});
