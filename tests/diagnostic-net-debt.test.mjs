// ─────────────────────────────────────────────────────────────────────────────
// Restpunkt aus PR #2 (V1.0.77): Nettoschulden in der Reported-/Owner-FCF-
// Diagnostik (computeReverseDcfFull → reverseDcfReported/reverseDcfOwner/
// scenarioResults, _computeOwnerFcfDcf → reportedFcfFV/ownerFcfFV).
//
// Bis V1.0.76 las das Reverse-DCF-Diagnosepaar nur net_debt[0] und setzte
// sonst 0; _computeOwnerFcfDcf rechnete net_debt[0] → total_debt[0] − Cash mit
// fehlender Liquiditaet = 0 → sonst 0. Keiner der beiden Pfade pruefte Umfang,
// Herkunft oder Stichtag. Jetzt gilt dieselbe Pruefung wie fuer die
// DCF-Wertbruecke und das Growth-Modul (_resolveNetDebtForDcfBridge).
//
// Sollwerte sind unabhaengig von der Implementierung aus der Definition
// hergeleitet (beide Diagnosen: Stage 1 zehn Jahre FCF_t = FCF0·(1+g)^t, Gordon-
// Terminalwert FCF10·(1+TG)/(WACC − TG), diskontiert mit dem WACC):
//   · Reverse DCF: das implizite g erfuellt EV(g) = Kurs · Aktien + Nettoschulden.
//   · Owner-FCF-DCF: Fair Value je Aktie = (EV(g1) − Nettoschulden) / Aktien.
// Fixture: FCF 180, SBC 20 (Owner-FCF 160), 100 Mio. Aktien, Kurs 40,
// WACC 9 %, TG 3 %, g1 15 %.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();
const YE = Array.from({ length: 6 }, (_, i) => `${2025 - i}-12-31`);
const PRICE = 40, SHARES = 100, WACC = 9, TG = 3, G1 = 15, FCF = 180, SBC = 20;

// Unabhaengige Kontrollrechnung nach Definition (keine Produktfunktion).
function evAt(fcf0, gPct) {
  const w = WACC / 100, tg = TG / 100, g = gPct / 100;
  let pv = 0, cf = fcf0;
  for (let t = 1; t <= 10; t++) { cf *= (1 + g); pv += cf / Math.pow(1 + w, t); }
  return pv + (cf * (1 + tg)) / (w - tg) / Math.pow(1 + w, 10);
}
const fvPerShare = (fcf0, nd) => (evAt(fcf0, G1) - nd) / SHARES;

function mj(kind) {
  const f = {
    revenue: [1000, 800, 640, 512, 410, 328], ebit: [200, 150, 110, 80, 60, 45], ebitda: [240, 185, 140, 105, 80, 62],
    cfo: [230, 170, 125, 90, 70, 52], capex: [50, 40, 32, 26, 20, 16], fcf: [FCF, 130, 93, 64, 50, 36],
    net_income: [150, 110, 80, 58, 43, 32], eps_diluted: [1.5, 1.1, 0.8, 0.58, 0.43, 0.32],
    book_value: [2000, 1850, 1740, 1660, 1600, 1560], shares_diluted: Array(6).fill(SHARES), sbc: Array(6).fill(SBC),
    da: [40, 35, 30, 25, 20, 17]
  };
  const meta = { revenue: { periods: YE }, ebitda: { periods: YE } };
  const P0 = { periods: [YE[0]] };
  switch (kind) {
    case 'none': break;                                   // keinerlei Schulden-/Liquiditaetsangaben
    case 'debtOnly':                                      // Schulden belegt, Liquiditaet fehlt ganz
      Object.assign(f, { total_debt: [4500] }); Object.assign(meta, { total_debt: P0 }); break;
    case 'partial':                                       // Teilbetrag, Umfang offen; abgeleitetes net_debt 4,000
      Object.assign(f, { total_debt: [4500], cash_and_equivalents: [500], net_debt: [4000] });
      Object.assign(meta, { total_debt: { periods: [YE[0]], scopeComplete: false, scopeIndeterminateReason: 'Finance-Leasing offen' },
        cash_and_equivalents: P0, net_debt: { periods: [YE[0]], source_type: 'derived', source_reference: 'total_debt - cash_and_equivalents' } });
      break;
    case 'periodMismatch':                                // Liquiditaet nur zum Halbjahresstichtag
      Object.assign(f, { total_debt: [4500], cash_and_equivalents: [500] });
      Object.assign(meta, { total_debt: P0, cash_and_equivalents: { periods: ['2025-06-30'] } }); break;
    case 'valid':                                         // belegt 4,500 − 500 = 4,000, kein net_debt-Feld
      Object.assign(f, { total_debt: [4500], cash_and_equivalents: [500] });
      Object.assign(meta, { total_debt: P0, cash_and_equivalents: P0 }); break;
    case 'zero':                                          // belegt 500 − 500 = 0
      Object.assign(f, { total_debt: [500], cash_and_equivalents: [500] });
      Object.assign(meta, { total_debt: P0, cash_and_equivalents: P0 }); break;
    case 'negative':                                      // belegt 100 − 600 = −500 (Nettoliquiditaet)
      Object.assign(f, { total_debt: [100], cash_and_equivalents: [600] });
      Object.assign(meta, { total_debt: P0, cash_and_equivalents: P0 }); break;
    case 'manualNd':                                      // manuell gesetztes net_debt ohne Metadaten (Altdatenregel)
      Object.assign(f, { net_debt: [4000] }); break;
    default: throw new Error(kind);
  }
  f._v4_meta = meta;
  return { meta: { ticker: 'DND', sub_classification: 'standard_nonfin' }, fundamentals: f, market: { price: PRICE },
    valuation: { wacc_derived: WACC, growth_terminal: TG, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 10, growth_stage1: G1 } };
}

const UNAVAILABLE = ['none', 'debtOnly', 'partial', 'periodMismatch'];
const VALID = { valid: 4000, zero: 0, negative: -500, manualNd: 4000 };

for (const kind of UNAVAILABLE) {
  test(`Reverse-DCF-Diagnosepaar ohne belegte Nettoschulden (${kind}): kein Wachstum, Grund sichtbar, Kern unberuehrt`, () => {
    const m = mj(kind);
    assert.equal(S._resolveNetDebtForDcfBridge(m.fundamentals).available, false, 'Vorbedingung: Bruecke nicht belegt');
    const r = S.computeReverseDcfFull(m);
    assert.equal(r.reverseDcfReported, null, 'kein Reported-Wachstum aus Nettoschulden 0/ungeprueft');
    assert.equal(r.reverseDcfOwner, null, 'kein Owner-Wachstum');
    assert.equal(r.impliedGrowthPct, null);
    assert.equal(r.applicable, false);
    assert.ok(r.scenarioResults.every(sc => sc.impliedGrowthPct == null), 'keine Kursszenarien');
    assert.equal(r.inputs.netDebtM, null, 'keine 0 und kein ungepruefter Teilbetrag');
    assert.match(r.reason, /Nettoschulden nicht belegt/);
    assert.match(r.reason, /NICHT als 0/);
    assert.equal(r.reportedFcfGateReason, r.reason);
    assert.match(r.ownerFcfWarnings[0], /Nettoschulden nicht belegt/);
    assert.equal(r.reverseDcfReportedClassification, null);
    // Unabhaengig berechenbare Diagnosen bleiben erhalten.
    assert.equal(r.sbcAdjustedFcm, FCF - SBC);
    assert.equal(r.sbc0, SBC);
    assert.ok(r.historicalBenchmark && r.historicalBenchmark.cagr3y != null);
    // Kernstatus getrennt: identisch mit dem direkten Kernaufruf.
    const core = S.solveReverseDcfGrowth(m);
    assert.equal(r.coreStatus, core.status);
    assert.equal(r.coreAvailable, core.ok === true);
    assert.equal(r.coreImpliedGrowthPct, core.ok ? core.impliedGrowthPct : null);
  });

  test(`Owner-FCF-DCF ohne belegte Nettoschulden (${kind}): kein Fair Value, SBC-Diagnose erhalten`, () => {
    const od = S._computeOwnerFcfDcf(mj(kind));
    assert.equal(od.status, 'ok', 'SBC-Diagnose selbst bleibt berechenbar');
    assert.equal(od.reportedFcfFV, null);
    assert.equal(od.ownerFcfFV, null);
    assert.equal(od.netDebtM, null);
    assert.match(od.netDebtUnavailable, /Nettoschulden nicht belegt/);
    assert.equal(od.reportedFcf, FCF);
    assert.equal(od.sbcAdjustedFcf, FCF - SBC);
    assert.equal(od.sbc, SBC);
  });

  test(`Anzeigen ohne belegte Nettoschulden (${kind}): keine Prozent-/Dollarzahl, keine 0, Grund genannt`, () => {
    const m = mj(kind);
    const html = S.buildReverseDcfDiagnosticBlock(m, S.runValuationEngine(m), []);
    const diag = html.slice(html.indexOf('Getrennte Diagnose auf REPORTED-FCF-Basis'));
    assert.ok(diag.length > 0);
    const rep = diag.slice(diag.indexOf('Reported-FCF-Basis</span>'), diag.indexOf('SBC-adj. Owner-FCF-Basis'));
    const own = diag.slice(diag.indexOf('SBC-adj. Owner-FCF-Basis'));
    assert.doesNotMatch(rep, /[+-]?\d+\.\d\d%/, 'kein Wachstumswert in der Reported-Zeile');
    assert.match(rep, /Nettoschulden nicht belegt/);
    assert.doesNotMatch(own.slice(0, own.indexOf('</div>')), /[+-]?\d+\.\d\d%/);
    assert.match(own.slice(0, own.indexOf('</div>')), /Nettoschulden nicht belegt/);

    const ob = S._renderOwnerFcfDcfBlock(m);
    assert.doesNotMatch(ob, /DCF Fair Value: \$/, 'kein Fair Value');
    assert.doesNotMatch(ob, /NetDebt\s*\$0\s*M/, 'keine stille 0');
    assert.doesNotMatch(ob, /SBC-Abschlag \(FV\)/, 'kein daraus abgeleiteter Abschlag');
    assert.match(ob, /Nettoschulden nicht belegt/);
    assert.match(ob, /\$160 M/, 'SBC-adj. Owner-FCF bleibt sichtbar');
  });
}

for (const [kind, nd] of Object.entries(VALID)) {
  test(`Gegenprobe belegte Nettoschulden ${nd} (${kind}): Diagnosen rechnen mit genau diesem Wert`, () => {
    const m = mj(kind);
    const r = S.computeReverseDcfFull(m);
    assert.equal(r.applicable, true);
    assert.equal(r.inputs.netDebtM, nd);
    // Definition: EV(g*) = Kurs · Aktien + Nettoschulden (Toleranz der Bisektion 1e-4 pp).
    for (const [g, fcf0] of [[r.reverseDcfReported, FCF], [r.reverseDcfOwner, FCF - SBC]]) {
      assert.ok(g != null);
      const target = PRICE * SHARES + nd;
      assert.ok(Math.abs(evAt(fcf0, g) - target) / target < 1e-4, `EV(${g}) = ${evAt(fcf0, g)} ≠ ${target}`);
    }
    const today = r.scenarioResults.find(sc => sc.label === 'Kurs heute');
    assert.ok(Math.abs(today.impliedGrowthPct - r.reverseDcfReported) < 1e-9);

    const od = S._computeOwnerFcfDcf(m);
    assert.equal(od.netDebtM, nd);
    assert.ok(od.netDebtUnavailable == null);
    assert.ok(Math.abs(od.reportedFcfFV - fvPerShare(FCF, nd)) < 1e-9, `${od.reportedFcfFV} vs ${fvPerShare(FCF, nd)}`);
    assert.ok(Math.abs(od.ownerFcfFV - fvPerShare(FCF - SBC, nd)) < 1e-9);
  });
}

test('Gegenprobe: belegte 4,000 senken den Owner-FCF-Fair-Value gegenueber belegter 0 um genau 40 je Aktie', () => {
  const a = S._computeOwnerFcfDcf(mj('zero')), b = S._computeOwnerFcfDcf(mj('valid'));
  assert.ok(Math.abs((a.reportedFcfFV - b.reportedFcfFV) - 4000 / SHARES) < 1e-9);
  assert.ok(Math.abs((a.ownerFcfFV - b.ownerFcfFV) - 4000 / SHARES) < 1e-9);
  // Vor V1.0.77 rechnete das Reverse-DCF-Paar im Fall 'valid' mit 0 (kein net_debt-Feld):
  const rz = S.computeReverseDcfFull(mj('zero')), rv = S.computeReverseDcfFull(mj('valid'));
  assert.ok(rv.reverseDcfReported > rz.reverseDcfReported + 1, `${rv.reverseDcfReported} vs ${rz.reverseDcfReported}`);
});

test('Growth-Verdict haengt nicht an einem Wachstum mit unbelegten Nettoschulden', () => {
  for (const kind of UNAVAILABLE) {
    const m = mj(kind); m.meta.sub_classification = 'high_growth';
    S._ensureGrowthAssumptionsBlock(m);
    const gr = S.runGrowthCaseEngine(m);
    assert.ok(!['GROWTH_WATCH', 'GROWTH_BUY', 'PRICED_FOR_PERFECTION', 'BUBBLE_RISK'].includes(gr.verdict), kind + ': ' + gr.verdict);
    assert.match(gr.verdictReason, /Nettoschulden nicht belegt/, kind);
  }
  const m = mj('valid'); m.meta.sub_classification = 'high_growth';
  S._ensureGrowthAssumptionsBlock(m);
  const gr = S.runGrowthCaseEngine(m);
  assert.equal(gr.reverseDcfFull.inputs.netDebtM, 4000);
  assert.notEqual(gr.verdict, 'MODEL_UNSUITABLE');
});
