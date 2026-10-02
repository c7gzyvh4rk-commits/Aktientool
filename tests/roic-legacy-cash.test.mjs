// ─────────────────────────────────────────────────────────────────────────────
// V1.0.80 · Fehlende Liquiditaet ist auch in periodenfreien Altdaten keine 0
// (computeRoicMinusWacc, _qceRoicTrend).
//
// Bis V1.0.79 galt im Positionsbezug der Altdaten `cashI = … : 0` (ROIC − WACC)
// und in beiden Modi `cash[i] != null ? cash[i] : 0` (ROIC-Trend). Eine
// fehlende Liquiditaet — ganze Reihe aus null oder einzelne Werte — erhoehte
// das investierte Kapital und senkte den ROIC. Gemessen auf b523867:
// Liquiditaet 6 × null ⇒ ROIC 6.82 %, Spread −2.18 pp ⇒ value_destroyer ⇒
// caution_quality ⇒ Basis-MoS 25 %; zwei fehlende juengste Werte ⇒ ROIC-Trend
// −3.9 pp (Score 1). Eine fehlende Liquiditaetsreihe (kein Array) war schon
// vorher „nicht bewertbar“ (Laengenpruefung).
//
// Sollwerte unabhaengig aus der Definition ROIC = EBIT·(1 − t) / (Buchwert +
// Finanzschulden − Liquiditaet) hergeleitet: t 25 %, EBIT 100 ⇒ NOPAT 75,
// Buchwert 500, Schulden 600:
//   Liquiditaet 400 ⇒ 75/700  = 10.714 % (WACC 9 % ⇒ +1.714 pp)
//   Liquiditaet 0   ⇒ 75/1100 =  6.818 % (⇒ −2.182 pp)
//   Liquiditaet 100 ⇒ 75/1000 =  7.500 % (⇒ −1.500 pp)
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const WACC = 9;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const roic = (ebit, cash) => ebit * 0.75 / (500 + 600 - cash) * 100;
const YE = (n) => Array.from({ length: n }, (_, i) => `${2025 - i}-12-31`);

// Altdaten: keinerlei Periodenangaben (kein _v4_meta), Positionsbezug.
function legacy({ n = 6, cash, ebit, dated = false, omitCash = false }) {
  const fill = (v) => Array(n).fill(v);
  const fund = {
    revenue: fill(1000), ebit: ebit || fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130),
    net_income: fill(70), eps_diluted: fill(0.7), dps: fill(0.3), book_value: fill(500),
    total_debt: fill(600), shares_diluted: fill(100)
  };
  if (!omitCash) fund.cash_and_equivalents = cash;
  if (dated) {
    fund._v4_meta = { ebit: { periods: YE(n) }, book_value: { periods: YE(n) },
                      total_debt: { periods: YE(n) }, cash_and_equivalents: { periods: YE(n) } };
  }
  return {
    meta: { ticker: 'RLC', sub_classification: 'standard_nonfin' },
    fundamentals: fund,
    valuation: { wacc_derived: WACC, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 10 }
  };
}

// Urteil, Basis-MoS und Einstiegspreis ueber die produktiven Pfade; Piotroski/
// Altman fest „bestanden“, damit das Urteil allein an ROIC − WACC haengt.
function pipeline(mj) {
  const qr = S.runQualityEngine(mj);
  qr.scores.piotroski = { status: 'ok', value: 8 };
  qr.scores.altman = { status: 'ok', value: 3.5 };
  qr.hardStops = [];
  const v = S.synthesizeVerdict(qr);
  qr.verdict = v.verdict; qr.reasons = v.reasons;
  const syn = S.runFairValueSynthesizer(mj, S.runValuationEngine(mj), qr,
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
  const trend = S._qceRoicTrend(mj, qr);
  const qce = S.computeQualityCapitalEfficiencyScore(qr, mj);
  return { rw: qr.descriptive.roicMinusWacc, trend, qce, verdict: v.verdict, reasons: [...v.reasons],
           mosBase: syn.mosComponents.base, buyPrice: syn.buyPrice };
}

test('vollstaendig fehlende Liquiditaetsreihe (6 × null): ROIC − WACC und Trend nicht bewertbar, Grund genannt', () => {
  const r = pipeline(legacy({ cash: Array(6).fill(null) }));
  assert.equal(r.rw.status, 'insufficient_data');
  assert.equal(r.rw.value, null);
  assert.match(r.rw.detail, /ohne Liquiditätsangabe ausgelassen \(Altdaten.*Position 0, Position 1, Position 2, Position 3, Position 4, Position 5/);
  assert.equal(r.trend.status, 'insufficient_data');
  assert.match(r.trend.reason, /nicht als 0 gewertet/);
  const chip = r.qce.components.find(c => c.key === 'roicTrend');
  assert.equal(chip.available, false);
  assert.match(chip.reason, /ohne Liquiditätsangabe/);
});

test('beseitigte Fehlklassifikation: kein value_destroyer, investable_high, Basis-MoS 15 % (vorher 25 %)', () => {
  const r = pipeline(legacy({ cash: Array(6).fill(null) }));
  assert.ok(!r.reasons.includes('value_destroyer'), r.reasons.join(','));
  assert.equal(r.verdict, 'investable_high');
  assert.equal(r.mosBase, CFG.mos.investable_high);
  // Einstiegspreis folgt allein der Basis-MoS: identisch mit einem Fall, in dem
  // ROIC − WACC aus anderem Grund nicht bewertbar ist (Liquiditaetsfeld fehlt ganz).
  const ref = pipeline(legacy({ omitCash: true }));
  assert.equal(ref.rw.status, 'insufficient_data');
  assert.equal(ref.mosBase, r.mosBase);
  assert.ok(close(ref.buyPrice, r.buyPrice), `${ref.buyPrice} vs ${r.buyPrice}`);
});

test('fehlendes Liquiditaetsfeld (kein Array) bleibt wie bisher nicht bewertbar', () => {
  const r = pipeline(legacy({ omitCash: true }));
  assert.equal(r.rw.status, 'insufficient_data');
  assert.equal(r.trend, null);
});

test('einzelne fehlende Werte, genug uebrige Jahre: gerechnet nur aus belegten Jahren', () => {
  const m = S.computeRoicMinusWacc(legacy({ n: 7, cash: [null, null, 400, 400, 400, 400, 400] }));
  assert.equal(m.status, 'ok');
  assert.ok(close(m.roicReported, roic(100, 400)), 'ROIC ' + m.roicReported);
  assert.ok(close(m.value, roic(100, 400) - WACC));
  assert.match(m.detail, /\(5y\)/);
  assert.match(m.detail, /ohne Liquiditätsangabe ausgelassen.*Position 0, Position 1$/);
});

test('einzelne fehlende Werte, zu wenige uebrige Jahre (4 von 5): nicht bewertbar statt Wert mit 0', () => {
  const r = pipeline(legacy({ cash: [null, null, 400, 400, 400, 400] }));
  assert.equal(r.rw.status, 'insufficient_data');
  assert.match(r.rw.detail, /4 von 5/);
  assert.match(r.rw.detail, /Position 0, Position 1/);
  // ROIC-Trend: Fenster 0–2 hat nur eine Beobachtung ⇒ kein Score (vorher −3.9 pp, Score 1).
  assert.equal(r.trend.status, 'insufficient_data');
  assert.deepEqual([...r.trend.cashMissing], ['Position 0', 'Position 1']);
  assert.equal(r.qce.components.find(c => c.key === 'roicTrend').available, false);
});

test('ROIC-Trend mit genug verbleibenden Jahren: Kontrollrechnung ohne die fehlenden Jahre', () => {
  const ebit = [130, 125, 120, 100, 100, 100, 100, 100];
  const cash = [400, null, 400, 400, null, 400, 400, 400];
  const t = S._qceRoicTrend(legacy({ n: 8, ebit, cash }), null);
  const med2 = (a, b) => (a + b) / 2;
  const recent = med2(roic(130, 400), roic(120, 400));     // Positionen 0 und 2
  const prior = med2(roic(100, 400), roic(100, 400));      // Positionen 3 und 5
  assert.equal(t.status, 'ok');
  assert.ok(close(t.recent, recent) && close(t.prior, prior), JSON.stringify(t));
  assert.ok(close(t.delta_pp, recent - prior));
});

test('belegte Liquiditaet 0 bleibt gueltig: echter negativer Spread wirkt weiter auf Urteil und MoS', () => {
  const r0 = pipeline(legacy({ cash: Array(6).fill(0) }));
  assert.equal(r0.rw.status, 'ok');
  assert.ok(close(r0.rw.roicReported, roic(100, 0)));
  assert.ok(close(r0.rw.value, roic(100, 0) - WACC));
  assert.doesNotMatch(r0.rw.detail, /ausgelassen/);
  assert.ok(r0.reasons.includes('value_destroyer'));
  assert.equal(r0.verdict, 'caution_quality');
  assert.equal(r0.mosBase, CFG.mos.caution_quality);
  assert.equal(r0.trend.status, 'ok');

  const r100 = pipeline(legacy({ cash: Array(6).fill(100) }));
  assert.ok(close(r100.rw.value, roic(100, 100) - WACC));
  assert.ok(r100.reasons.includes('value_destroyer'));
  assert.equal(r100.mosBase, CFG.mos.caution_quality);
});

test('vollstaendiger gueltiger Altdatenfall unveraendert (Positionsbezug)', () => {
  const r = pipeline(legacy({ cash: Array(6).fill(400) }));
  assert.equal(r.rw.status, 'ok');
  assert.ok(close(r.rw.value, roic(100, 400) - WACC));
  assert.doesNotMatch(r.rw.detail, /ausgelassen/);
  assert.equal(r.trend.status, 'ok');
  assert.ok(close(r.trend.delta_pp, 0));
  assert.equal(r.verdict, 'investable_high');
});

test('datierte Faelle: gueltige unveraendert; leere Liquiditaet bei gueltiger Periode auch im Trend keine 0', () => {
  const ok = pipeline(legacy({ dated: true, cash: Array(6).fill(400) }));
  assert.equal(ok.rw.status, 'ok');
  assert.ok(close(ok.rw.value, roic(100, 400) - WACC));
  assert.equal(ok.trend.status, 'ok');
  const d = S._qceRoicTrend(legacy({ dated: true, cash: [null, null, 400, 400, 400, 400] }), null);
  assert.equal(d.status, 'insufficient_data');
  assert.deepEqual([...d.cashMissing], ['2025-12-31', '2024-12-31']);
});

test('vereinfachter ROIC (O-1, computeBaseRateLite) bleibt bei fehlender Liquiditaet „nicht bewertbar“ und sonst gleich', () => {
  const mjNull = legacy({ cash: Array(6).fill(null) });
  const hp = S.computeBaseRateLite(mjNull, S.runQualityEngine(mjNull), null).historicProfile;
  assert.equal(hp.roicCurrent, null);
  assert.match(hp.roicCurrentReason, /Liquidität/);
  const mjOk = legacy({ cash: Array(6).fill(400) });
  const hp2 = S.computeBaseRateLite(mjOk, S.runQualityEngine(mjOk), null).historicProfile;
  assert.ok(close(hp2.roicCurrent, roic(100, 400)), 'vereinfacht ' + hp2.roicCurrent);
});
