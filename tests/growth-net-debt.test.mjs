// ─────────────────────────────────────────────────────────────────────────────
// Review-Nachbesserung PR #2 (V1.0.76): Nettoschulden im Growth-Modul.
//
// Bis V1.0.75 las runGrowthCaseEngine nur net_debt[0] und setzte sonst 0.
// Folge (gemessen, identisch auf main 8b42fea): ohne Schuldenangaben und bei
// belegter Bruecke OHNE net_debt-Feld rechneten alle Szenarien schuldenfrei
// („GROWTH BUY“, WFV 77.06, E[IRR] 13.8 %); bei gesperrter Bruecke mit dem
// ungeprueften Teilbetrag. Jetzt gilt dieselbe Pruefung wie fuer die
// DCF-Wertbruecke (_resolveNetDebtForDcfBridge).
//
// Sollwerte unabhaengig von der Implementierung: Der Growth-Fair-Value ist das
// mit dem WACC ueber N Jahre diskontierte Exit-Equity je Aktie (Anzeige
// „Exit-Equity diskontiert mit WACC · pro Aktie“). Nettoschulden D senken ihn
// daher je Szenario um D / Aktien / (1 + WACC)^N, solange das Exit-Equity
// positiv bleibt. Hier: D = 4,000, 100 Mio. Aktien, WACC 9 %.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const YE = Array.from({ length: 6 }, (_, i) => `${2025 - i}-12-31`);

function mj(kind) {
  const f = {
    revenue: [1000, 800, 640, 512, 410, 328], ebit: [200, 150, 110, 80, 60, 45], ebitda: [240, 185, 140, 105, 80, 62],
    cfo: [230, 170, 125, 90, 70, 52], capex: [50, 40, 32, 26, 20, 16], fcf: [180, 130, 93, 64, 50, 36],
    net_income: [150, 110, 80, 58, 43, 32], eps_diluted: [1.5, 1.1, 0.8, 0.58, 0.43, 0.32],
    book_value: [2000, 1850, 1740, 1660, 1600, 1560], shares_diluted: Array(6).fill(100), sbc: Array(6).fill(0),
    da: [40, 35, 30, 25, 20, 17]
  };
  const meta = { revenue: { periods: YE }, ebitda: { periods: YE } };
  const P0 = { periods: [YE[0]] };
  if (kind === 'partial') {        // Teilbetrag, Umfang offen: Bruecke gesperrt, net_debt[0] = 4,000 vorhanden
    Object.assign(f, { total_debt: [4500], cash_and_equivalents: [500], net_debt: [4000] });
    Object.assign(meta, { total_debt: { periods: [YE[0]], scopeComplete: false, scopeIndeterminateReason: 'Finance-Leasing offen' },
      cash_and_equivalents: P0, net_debt: { periods: [YE[0]], source_type: 'derived', source_reference: 'total_debt - cash_and_equivalents' } });
  } else if (kind === 'valid') {   // belegte, periodengleiche Bruecke 4,500 − 500 = 4,000 (kein net_debt-Feld)
    Object.assign(f, { total_debt: [4500], cash_and_equivalents: [500] });
    Object.assign(meta, { total_debt: P0, cash_and_equivalents: P0 });
  } else if (kind === 'zero') {    // belegte, periodengleiche Nettoschulden 0
    Object.assign(f, { total_debt: [500], cash_and_equivalents: [500] });
    Object.assign(meta, { total_debt: P0, cash_and_equivalents: P0 });
  }                                // 'none': keinerlei Schuldenangaben
  f._v4_meta = meta;
  return { meta: { ticker: 'GRW', sub_classification: 'high_growth' }, fundamentals: f, market: { price: 40 },
    valuation: { wacc_derived: 9, growth_terminal: 3, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 10, growth_stage1: 15 } };
}
const run = (kind) => { const m = mj(kind); S._ensureGrowthAssumptionsBlock(m); return { m, gr: S.runGrowthCaseEngine(m) }; };

for (const kind of ['none', 'partial']) {
  test(`ohne belegte Nettoschulden (${kind}): keine Szenario-Fair-Values, keine IRR, kein GROWTH_BUY`, () => {
    const { gr } = run(kind);
    assert.equal(S._resolveNetDebtForDcfBridge(mj(kind).fundamentals).available, false);
    assert.equal(gr.netDebtM, null, 'keine 0 und kein ungepruefter Teilbetrag');
    assert.match(gr.netDebtUnavailable, /Nettoschulden nicht belegt.*NICHT als 0 angenommen/);
    for (const c of gr.growthCases) {
      assert.equal(c.fairValuePerShare, null, c.label);
      assert.equal(c.irr, null, c.label);
      assert.equal(c.irrNote, gr.netDebtUnavailable);
    }
    assert.equal(gr.weightedFairValue, null);
    assert.equal(gr.expectedIrr, null);
    assert.equal(gr.growthModuleFairValue, null);
    assert.notEqual(gr.verdict, 'GROWTH_BUY');
    assert.match(gr.verdictReason, /Nettoschulden nicht belegt/);
    // null = nicht bestimmbar, NICHT false (= Margenkalibrierung ungueltig).
    assert.equal(gr.growthModuleFairValueActive, null);
  });
}

test('Gegenprobe belegte Bruecke 4,000: Fair Values je Szenario um 4,000/100/1.09^N niedriger als bei belegter 0', () => {
  const { gr: g4 } = run('valid');
  const { gr: g0 } = run('zero');
  assert.equal(g4.netDebtM, 4000);
  assert.equal(g0.netDebtM, 0);
  assert.equal(g4.netDebtUnavailable, null);
  const N = g4.nYears;
  assert.ok(N > 0);
  const delta = 4000 / 100 / Math.pow(1.09, N);
  for (let i = 0; i < 3; i++) {
    const a = g0.growthCases[i], b = g4.growthCases[i];
    assert.ok(a.fairValuePerShare > delta, 'Exit-Equity bleibt positiv: ' + a.label);
    assert.ok(Math.abs((a.fairValuePerShare - b.fairValuePerShare) - delta) < 1e-6,
      `${a.label}: ${a.fairValuePerShare} − ${b.fairValuePerShare} ≠ ${delta}`);
  }
  // Mit belegten 4,000 kein GROWTH_BUY (vorher faelschlich schuldenfrei: GROWTH_BUY).
  assert.equal(g0.verdict, 'GROWTH_BUY');
  assert.equal(g4.verdict, 'GROWTH_WATCH');
  assert.ok(g4.weightedFairValue < g0.weightedFairValue);
  assert.equal(g4.growthModuleFairValueActive, true);
});

test('Synthese bleibt unabhaengig vom Growth-Ergebnis (Buy Price, Position, Konfidenz)', () => {
  for (const kind of ['none', 'partial', 'valid']) {
    const { m, gr } = run(kind);
    const v = S.runValuationEngine(m), q = S.runQualityEngine(m);
    const cfg = Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(m) });
    const st = evalInApp('state');
    const prev = st.growth;
    try {
      st.growth = null;
      const s0 = S.runFairValueSynthesizer(m, v, q, cfg);
      st.growth = gr;
      const s1 = S.runFairValueSynthesizer(m, v, q, cfg);
      assert.equal(s1.buyPrice, s0.buyPrice, kind);
      assert.equal(s1.position, s0.position, kind);
      assert.equal(s1.assumptionConfidence, s0.assumptionConfidence, kind);
      assert.equal(s1.finalValuationConfidence, s0.finalValuationConfidence, kind);
    } finally { st.growth = prev; }
  }
});
