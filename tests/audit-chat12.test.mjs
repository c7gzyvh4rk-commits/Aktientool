// ═══════════════════════════════════════════════════════════════════════════
// AUDIT (Chat 12) — unabhaengige Referenz- und Gegenbeispiele
// ───────────────────────────────────────────────────────────────────────────
// Geprueft wird der ausgelieferte Code der Tool-Datei ueber die END-ZU-ENDE-
// Aufrufwege (modelDcf, modelDcfMidcycle, computeSensitivityMatrix,
// solveReverseDcfGrowth, runMonteCarloDcf, buildReverseDcfOverviewCard,
// buildReverseDcfDiagnosticBlock, buildSnapshotForecastTargets).
//
// Zwei Arten von Tests, ausdruecklich getrennt:
//
//   A) REFERENZ — Erwartungswerte unabhaengig nachgerechnet (refValuePerShare
//      in audit-chat12.mjs bzw. von Hand im Test). Diese Tests sichern
//      richtiges Verhalten ab.
//
//   B) BEFUND-NACHWEIS (characterization) — halten eine im Audit BESTAETIGTE
//      Abweichung fest. Sie behaupten NICHT, dass das Verhalten richtig ist.
//      Jeder dieser Tests nennt im Kommentar den Befund und die Erwartung,
//      die nach der Korrektur gelten muss. Produktcode wurde in diesem
//      Auftrag nicht geaendert (Auditauftrag), deshalb sind sie gruen.
//      Siehe AUDIT-CHAT12.md.
// ═══════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, refMj, scOf, refValuePerShare,
         evalInApp, importSecFacts, secFactsWithDebt, secInst, allYears,
         fullyDocumented, noNoncurrentLeases,
         secQuarterlyFactsWithDebt, secQInst, ttmViewOf } from './audit-chat12.mjs';

// Quartalswerte fuer alle vier Geschaeftsjahre des synthetischen Filers.
const qAllYears = (v) => ({ 2022: v, 2023: v, 2024: v, 2025: v });

const S = app();

// ═══════════════════════════════════════════════════════════════════════════
// A) REFERENZFAELLE
// ═══════════════════════════════════════════════════════════════════════════

test('A1 Referenz: konstanter FCFF — EV = FCFF/WACC, exakt und ohne Nettoschulden', () => {
  // Von Hand: FCFF = 200·0,75 + 50 − 50 = 150M p.a.; g1 = tg = 0 %, WACC 10 %.
  //   PV(Jahre 1..10) = 150 · (1 − 1,1^-10)/0,10 = 921,68504...M
  //   TV am Ende Jahr 10 = 150/0,10 = 1.500M ⇒ PV = 1.500/1,1^10 = 578,31495...M
  //   Summe = 1.500,000M ⇒ 15,00 USD je Aktie bei 100M Aktien.
  const annuity = (1 - Math.pow(1.1, -10)) / 0.10;
  const pv1to10 = 150 * annuity;
  const pvTv = (150 / 0.10) / Math.pow(1.1, 10);
  assert.ok(Math.abs(pv1to10 + pvTv - 1500) < 1e-9, 'Handrechnung selbst konsistent');

  const r = S.modelDcf(refMj({ net_debt: [0] }), scOf(0, 0, 10, 20));
  assert.equal(r.applicable, true);
  assert.ok(Math.abs(r._operatingValueAbsBase - 1500) < 1e-6, 'EV = 1.500M, erhalten ' + r._operatingValueAbsBase);
  assert.ok(Math.abs(r._operatingValuePerShareBase - 15) < 1e-9);
  assert.ok(Math.abs(r.base - 15) < 1e-9, 'Eigenkapitalwert je Aktie 15,00');

  // Gegenbeispiel: WACC = Terminalwachstum ⇒ kein Ergebnis, kein Ersatzwert.
  const rDiv = S.modelDcf(refMj({ net_debt: [0] }), scOf(0, 10, 10, 20));
  assert.equal(rDiv.base, null, 'WACC ≤ tg liefert keinen Wert statt eines Ersatzwerts');
});

test('A1b Referenz: Kern-Aufteilung Phase 1 / Terminalwert stimmt mit der Annuitaet', () => {
  const fi = S.buildForecastInputs(refMj({ net_debt: [0] }));
  const r = S.forecastDcfCore(fi, 0, 0, 10, { enabled: false }, 20);
  const annuity = (1 - Math.pow(1.1, -10)) / 0.10;
  assert.ok(Math.abs(r._pvAbs - 150 * annuity) < 1e-6, 'PV Jahre 1..10, erhalten ' + r._pvAbs);
  assert.ok(Math.abs(r._pvTvAbs - (1500 / Math.pow(1.1, 10))) < 1e-6, 'PV Terminalwert, erhalten ' + r._pvTvAbs);
  assert.ok(Math.abs(r._totalAbs - 1500) < 1e-6);
});

test('A2 Referenz: Nettoschuldeneffekt ist genau EIN Abzug, Vorzeichen korrekt', () => {
  const per = (nd) => S.modelDcf(refMj(nd), scOf(0, 0, 10, 20));
  // Operativer Wert 15,00 je Aktie; Nettoschulden je Aktie = netDebtM/100.
  assert.ok(Math.abs(per({ net_debt: [0] }).base - 15) < 1e-9);
  assert.ok(Math.abs(per({ net_debt: [500] }).base - 10) < 1e-9, 'ND 500M ⇒ 10,00');
  assert.ok(Math.abs(per({ net_debt: [-200] }).base - 17) < 1e-9, 'Nettoliquiditaet wird addiert ⇒ 17,00');
  const neg = per({ net_debt: [2000] });
  assert.ok(Math.abs(neg.base + 5) < 1e-9, 'negatives Eigenkapital wird ausgewiesen, nicht unterdrueckt');
  assert.equal(neg.applicable, true);
  // Ableitung total_debt − Liquiditaet ergibt denselben Abzug.
  assert.ok(Math.abs(per({ total_debt: [800], cash_and_equivalents: [300] }).base - 10) < 1e-9);
  // Gegenbeispiel: fehlende Schulden-/Liquiditaetsdaten sind NICHT 0.
  const none = per({});
  assert.equal(none.base, null);
  assert.equal(none.applicable, false);
  assert.equal(none._netDebtM, null);
  assert.ok(Math.abs(none._operatingValuePerShareBase - 15) < 1e-9,
    'operativer Wert bleibt getrennt ausgewiesen');
});

test('A3 Referenz: Working-Capital-Bindung mindert den Wert genau um die gebundenen Mittel', () => {
  // Bilanz: Umlaufvermoegen 400, Zahlungsmittel 100, kurzfristige
  // Verbindlichkeiten 200, davon 100 kurzfristige Finanzschulden
  // (total_debt 800 − long_term_debt 700).
  //   OWC = (400 − 100) − (200 − 100) = 200 ⇒ Quote 20 % vom Umsatz 1.000.
  const bs = {
    net_debt: [700],
    current_assets:       [400, 400, 400, 400],
    current_liabilities:  [200, 200, 200, 200],
    cash_and_equivalents: [100, 100, 100, 100],
    total_debt:           [800, 800, 800, 800],
    long_term_debt:       [700, 700, 700, 700]
  };
  const mj = refMj(bs);
  const owc = S._resolveOwcForForecast(mj);
  assert.equal(owc.source, 'historical_median');
  assert.ok(Math.abs(owc.ratio - 0.20) < 1e-12, 'Quote 20 %, erhalten ' + owc.ratio);

  // Unabhaengige Nachrechnung (eigene Formel, s. audit-chat12.mjs).
  const exp = refValuePerShare({
    rev0: 1000, marginPct: 20, taxPct: 25, daRatio: 0.05, capexRatio: 0.05,
    owcRatio: 0.20, g1Pct: 10, tgPct: 2, waccPct: 10, sharesM: 100, netDebtM: 700
  });
  const r = S.modelDcf(mj, scOf(10, 2, 10, 20));
  assert.ok(Math.abs(r.base - exp.equityPerShare) < 1e-9,
    'erwartet ' + exp.equityPerShare + ', erhalten ' + r.base);

  // Gegenbeispiel 1: ohne WC-Bindung ist der Wert hoeher — die Differenz ist
  // genau der Barwert der gebundenen Mittel.
  const expNoWc = refValuePerShare({
    rev0: 1000, marginPct: 20, taxPct: 25, daRatio: 0.05, capexRatio: 0.05,
    owcRatio: 0, g1Pct: 10, tgPct: 2, waccPct: 10, sharesM: 100, netDebtM: 700
  });
  const mjOvr = refMj(bs, { assumptions: { owc_pct_of_revenue: 0 } });
  const rOvr = S.modelDcf(mjOvr, scOf(10, 2, 10, 20));
  assert.ok(Math.abs(rOvr.base - expNoWc.equityPerShare) < 1e-9);
  assert.ok(rOvr.base > r.base, 'WC-Bindung senkt den Wert');

  // Gegenbeispiel 2: ohne Wachstum bindet WC nichts (ΔOWC = 0) — die Quote
  // darf dann keinen Unterschied machen.
  const rG0    = S.modelDcf(refMj(bs), scOf(0, 0, 10, 20));
  const rG0Ovr = S.modelDcf(refMj(bs, { assumptions: { owc_pct_of_revenue: 0 } }), scOf(0, 0, 10, 20));
  assert.ok(Math.abs(rG0.base - rG0Ovr.base) < 1e-9,
    'bei g1 = tg = 0 ist die WC-Quote wirkungslos');

  // Gegenbeispiel 3: negative Quote setzt bei Wachstum Mittel frei.
  const mjNeg = refMj(Object.assign({}, bs, {
    current_assets: [150, 150, 150, 150]   // OWC = (150−100) − 100 = −50 ⇒ −5 %
  }));
  assert.ok(S._resolveOwcForForecast(mjNeg).ratio < 0);
  assert.ok(S.modelDcf(mjNeg, scOf(10, 2, 10, 20))._operatingValuePerShareBase >
            r._operatingValuePerShareBase);
});

test('A4 Referenz: Reverse-DCF-Roundtrip trifft das eingesetzte Wachstum', () => {
  const cases = [
    { name: 'ohne Nettoschulden',      fund: { net_debt: [0] },   g1: 6 },
    { name: 'mit Nettoschulden 500M',  fund: { net_debt: [500] }, g1: 6 },
    { name: 'mit Nettoliquiditaet',    fund: { net_debt: [-300] }, g1: 3 },
    { name: 'mit WC-Bindung 20 %',     g1: 8, fund: {
        net_debt: [700],
        current_assets: [400, 400, 400, 400], current_liabilities: [200, 200, 200, 200],
        cash_and_equivalents: [100, 100, 100, 100],
        total_debt: [800, 800, 800, 800], long_term_debt: [700, 700, 700, 700] } }
  ];
  for (const c of cases) {
    const val = { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                  wacc_derived: 10, growth_terminal: 2, growth_stage1: c.g1 };
    const mj = refMj(c.fund, val);
    const fv = S.modelDcf(mj, scOf(c.g1, 2, 10, 20)).base;
    assert.ok(fv != null, c.name + ': Haupt-DCF liefert einen Wert');
    mj.market.price = fv;
    const rev = S.solveReverseDcfGrowth(mj);
    assert.equal(rev.status, 'ok', c.name + ': ' + rev.reason);
    assert.ok(Math.abs(rev.impliedGrowthPct - c.g1) < 1e-3,
      c.name + ': erwartet ' + c.g1 + ' %, erhalten ' + rev.impliedGrowthPct);
    // Gegenprobe: der Kern bewertet beim geloesten Wachstum wieder den Kurs.
    assert.ok(Math.abs(rev.checkValuePerShare - fv) < 1e-6);
  }
  // Gegenbeispiel: ohne Nettoschulden gibt es keinen Eigenkapitalwert —
  // und damit kein implizites Wachstum. Kein stiller 0-Abzug.
  const mjNo = refMj({}, { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                           wacc_derived: 10, growth_terminal: 2, growth_stage1: 6 },
                     { price: 20 });
  assert.equal(S.solveReverseDcfGrowth(mjNo).status, 'net_debt_unknown');
});

test('A5 Referenz: Sensitivitaetsmatrix-Mittelzelle ist der Haupt-DCF-Wert', () => {
  const val = { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                wacc_derived: 10, growth_terminal: 2, growth_stage1: 6 };
  const mj = refMj({ net_debt: [500] }, val, { price: 20 });
  const sc = S.buildScenarios(mj);
  const dcf = S.modelDcf(mj, sc);
  const v = { scenarios: sc, router: { activeModels: ['dcf'], subClassification: 'standard_nonfin' }, error: null };
  const m = S.computeSensitivityMatrix(mj, v);
  assert.equal(m.available, true, m.reason || '');
  assert.ok(Math.abs(m.baseValue - dcf.base) < 1e-12,
    'Matrix ' + m.baseValue + ' vs. DCF ' + dcf.base);
  assert.ok(Math.abs(m.cells[2][2] - dcf.base) < 1e-12, 'zentrale Zelle = Base');
  // Gegenbeispiel: ohne Nettoschulden zeigt die Matrix keine operativen Werte.
  const mNo = S.computeSensitivityMatrix(refMj({}, val, { price: 20 }),
    { scenarios: sc, router: { activeModels: ['dcf'] }, error: null });
  assert.equal(mNo.available, false);
  assert.equal(mNo.equityValueUnavailable, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// B) BEFUND-NACHWEISE — halten bestaetigte Abweichungen fest.
//    Diese Tests behaupten NICHT, dass das Verhalten richtig ist.
//
// KORREKTURCHAT 12A (V1.0.58): Die Befunde A-1, A-2 und A-3 sind behoben.
// Ihre Nachweise B1–B4 wurden deshalb in REGRESSIONSTESTS des richtigen
// Verhaltens umgewandelt (R1–R9 unten) — sie sichern die Korrektur ab,
// statt die Abweichung festzuhalten.
// B5–B8 bleiben ausdruecklich BEFUND-NACHWEISE: die Befunde A-4 bis A-7
// sind offen und in diesem Auftrag bewusst nicht angefasst worden.
// ═══════════════════════════════════════════════════════════════════════════

// Zyklischer Referenzfall: aktuelle Marge 30 %, Mid-Cycle-Median 15 %.
function midCycleMj() {
  return {
    meta: { ticker: 'MIDC', sub_classification: 'cyclical' },
    fundamentals: {
      revenue:        [1000, 1000, 1000, 1000, 1000, 1000],
      ebit:           [300, 100, 150, 200, 150, 100],
      ebitda:         [350, 150, 200, 250, 200, 150],
      capex:          [50, 50, 50, 50, 50, 50],
      shares_diluted: [100, 100, 100, 100, 100, 100],
      net_debt:       [500]
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 20 }
  };
}
const midCycleV = (mj) => ({
  scenarios: S.buildScenarios(mj),
  router: { activeModels: ['dcf_midcycle'], subClassification: 'cyclical' },
  error: null
});

// ═══════════════════════════════════════════════════════════════════════════
// R) REGRESSION — richtiges Verhalten nach der Korrektur von A-1, A-2, A-3.
//    Erwartungswerte unabhaengig nachgerechnet bzw. aus dem Haupt-DCF
//    abgeleitet, der selbst durch A1–A5 abgesichert ist.
// ═══════════════════════════════════════════════════════════════════════════

test('R1 (A-2) Monte Carlo rechnet auf der bewerteten Mid-Cycle-Marge', () => {
  // Frueher (Befund A-2): runMonteCarloDcf() rief buildCoreValuationContext(mj, {})
  // ohne Margenbasis und rechnete deshalb mit der Ist-Marge 30 % weiter,
  // waehrend der Haupt-DCF auf den Median 15 % normalisiert war — MC-Median
  // 30,69 gegen Fair Value 12,80 in DERSELBEN Ansicht.
  const mj = midCycleMj();
  const sc = S.buildScenarios(mj);
  const dcf = S.modelDcfMidcycle(mj, sc);
  assert.equal(dcf._midCycleOpMarginPct, 15);
  assert.equal(sc.base.op_margin_pct, 30, 'Szenario traegt weiterhin die Ist-Marge');

  const v = midCycleV(mj);
  const mc = S.runMonteCarloDcf(mj, v, { seed: 4242, runs: 2000 });
  assert.ok(!mc._blocked, 'MC laeuft');

  // 1) DETERMINISTISCHER Nachweis der Annahmenweitergabe: die wirksame Marge
  //    steht am Ergebnis und ist die bewertete, nicht die Ist-Marge.
  assert.equal(mc._opMarginPctUsed, 15, 'MC rechnet mit der Mid-Cycle-Marge');
  assert.equal(mc._marginBasis, 'midcycle_median');
  assert.equal(mc.distributions.op_margin_shock.margin_basis, 'midcycle_median',
    'die Verteilungsannahmen weisen die Margenbasis aus');

  // 2) Der Median muss bei einer nichtlinearen Bewertung NICHT exakt dem
  //    Base-Wert entsprechen (Streuung von g1, WACC, tg und Margenschock
  //    wirken asymmetrisch). Geprueft wird die Groessenordnung: vorher lag er
  //    beim Doppelten, jetzt nahe am ausgewiesenen Fair Value.
  assert.ok(mc.median > 0.8 * dcf.base && mc.median < 1.25 * dcf.base,
    'MC-Median ' + mc.median.toFixed(2) + ' liegt bei DCF ' + dcf.base.toFixed(2));
  assert.ok(mc.median < 2 * dcf.base, 'kein Ist-Margen-Median mehr');

  // 3) Gegenprobe: mit der Ist-Marge ergaebe sich der alte, deutlich hoehere
  //    Median — die Weitergabe ist also wirksam und nicht zufaellig.
  const mcIst = S.runMonteCarloDcf(mj, { scenarios: sc, error: null,
    router: { activeModels: ['dcf'], subClassification: 'standard_nonfin' } },
    { seed: 4242, runs: 2000 });
  assert.equal(mcIst._marginBasis, 'scenario');
  assert.ok(mcIst.median > 2 * dcf.base,
    'Ist-Margen-Pfad ' + mcIst.median.toFixed(2) + ' als Gegenprobe');

  // 4) Gleicher Seed, gleiche Eingaben ⇒ gleiches Ergebnis.
  const mc2 = S.runMonteCarloDcf(mj, midCycleV(mj), { seed: 4242, runs: 2000 });
  assert.equal(mc2.median, mc.median, 'deterministisch bei festem Seed');

  // 5) Die Sensitivitaetsmatrix bleibt konsistent (war schon vorher richtig).
  const m = S.computeSensitivityMatrix(mj, v);
  assert.ok(Math.abs(m.baseValue - dcf.base) < 1e-12, 'Matrix bleibt konsistent');
  assert.equal(m.opMarginPctUsed, 15);
});

test('R2 (A-2) Snapshot-Prognoseziele verwenden die bewertete Mid-Cycle-Marge', () => {
  // Frueher (Befund A-2): buildSnapshotForecastTargets() las
  // scenarios.base.op_margin_pct (30 %) und speicherte damit einen
  // Prognosepfad, der nie bewertet wurde; der spaetere Soll-Ist-Vergleich
  // haette gegen diesen falschen Pfad gemessen.
  const mj = midCycleMj();
  const v = midCycleV(mj);
  const snap = S.buildSnapshotForecastTargets(mj, v);
  assert.equal(snap.available, true);
  assert.equal(snap.scenario.op_margin_pct_used, 15, 'Snapshot rechnet mit 15 %');
  // Herkunft wird mitgespeichert, damit der Vergleich nachvollziehbar bleibt.
  assert.equal(snap.scenario.op_margin_basis, 'midcycle_median');
  assert.equal(snap.scenario.op_margin_override_pct, 15);
  assert.equal(snap.scenario.op_margin_pct_scenario, 30,
    'die Szenariomarge bleibt zur Nachvollziehbarkeit erhalten');

  // Von Hand: Umsatz J1 = 1.050; FCFF bei 15 % Marge
  //   = 1.050·(0,15·0,75 + 0,05 − 0,05) = 118,125M
  // (bei der Ist-Marge 30 % waeren es 236,25M — der alte, falsche Pfad)
  assert.ok(Math.abs(snap.years[0].fcff - 118.125) < 1e-9, 'erhalten ' + snap.years[0].fcff);
  const fi = S.buildForecastInputs(mj);
  const rMid = S.forecastDcfCore(fi, 5, 2, 10, { enabled: false }, 15);
  assert.ok(Math.abs(rMid._fcfPerYearAbs[1] - 118.125) < 1e-9);

  // Der spaetere Soll-Ist-Vergleich greift auf genau diesen Pfad zu. Dafuer
  // muessen die Zielperioden bekannt sein — deshalb hier mit Periodenmeta.
  const mjP = midCycleMj();
  mjP.fundamentals._v4_meta = {
    revenue: { periods: ['2024-12-31', '2023-12-31', '2022-12-31',
                         '2021-12-31', '2020-12-31', '2019-12-31'],
               period_type: 'FY' }
  };
  const snapP = S.buildSnapshotForecastTargets(mjP, midCycleV(mjP));
  assert.equal(snapP.available, true);
  assert.equal(snapP.target_periods_known, true);
  assert.equal(snapP.scenario.op_margin_pct_used, 15);
  const target = snapP.years[0];
  const cmp = S.compareSnapshotForecastToActual(
    { forecast_targets: snapP },
    { period_end: target.target_period_end, period_type: target.target_period_type,
      revenue: 1050, fcff: 118.125, op_margin_pct: 15 });
  assert.equal(cmp.comparable, true, cmp.reason || '');
  assert.ok(Math.abs(cmp.deltas.fcff.abs) < 1e-9,
    'Soll-Ist-Vergleich misst gegen den bewerteten Pfad, erhalten ' + cmp.deltas.fcff.target);
  // Gegenprobe: gegen den alten Ist-Margen-Pfad (236,25M) waere der Ist-Wert
  // von 118,125M eine Verfehlung um −50 % gewesen.
  assert.ok(Math.abs(cmp.deltas.fcff.target - 118.125) < 1e-9);
});

test('R3 (A-2) ECHTER ENGINE-PFAD: eine Margenbasis fuer DCF, Matrix, MC, Snapshot und gespeicherten Reverse DCF', () => {
  // Der Audit pruefte A-2 an konstruierten v-Objekten. Hier laeuft der
  // vollstaendige Bewertungsprozess (runValuationEngine) einschliesslich der
  // tatsaechlich verwendeten FY-/TTM-Sicht, des gespeicherten Reverse DCF und
  // der Snapshot-Prognose.
  const mj = midCycleMj();
  const v = S.runValuationEngine(mj);
  assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
  assert.equal(v.router.activeModels.join(','), 'dcf_midcycle', 'zyklischer Pfad');

  const dm = v.modelResults.dcf_midcycle;
  assert.equal(dm.applicable, true);
  assert.equal(dm._coreOpMarginPctUsed, 15);
  assert.equal(dm._coreMarginBasis, 'midcycle_median');

  // Die Engine fuehrt EINEN aufgeloesten Stand mit.
  assert.equal(v._marginBasisAvailable, true);
  assert.equal(v._marginBasis, 'midcycle_median');
  assert.equal(v._opMarginPctUsed, 15);
  assert.equal(v._coreOpts.opMarginOverridePct, 15);
  assert.equal(v._coreOpts.resolved, true);

  // Gespeicherter Reverse DCF: Kern auf der Mid-Cycle-Marge.
  const coreMid = S.solveReverseDcfGrowth(mj, { opMarginOverridePct: 15, marginBasis: 'midcycle_median' });
  assert.equal(coreMid.status, 'ok');
  assert.equal(v.reverseDcfImpliedGrowth, coreMid.impliedGrowthPct,
    'gespeicherter Reverse DCF = Kern auf der bewerteten Marge');
  assert.equal(v._reverseDcfMarginBasis, 'midcycle_median');
  // Gegenprobe: auf der Ist-Marge waere es eine voellig andere Zahl.
  const coreIst = S.solveReverseDcfGrowth(mj);
  assert.ok(Math.abs(coreIst.impliedGrowthPct - coreMid.impliedGrowthPct) > 5,
    'Ist-Marge ' + coreIst.impliedGrowthPct.toFixed(2) + ' vs. bewertet ' + coreMid.impliedGrowthPct.toFixed(2));

  // Alle Verbraucher lesen denselben Stand aus dem Engine-Ergebnis.
  const mtx = S.computeSensitivityMatrix(mj, v);
  assert.equal(mtx.available, true);
  assert.equal(mtx.opMarginPctUsed, 15);
  assert.ok(Math.abs(mtx.baseValue - dm.base) < 1e-12);

  const mc = S.runMonteCarloDcf(mj, v, { seed: 4242, runs: 2000 });
  assert.equal(mc._opMarginPctUsed, 15);
  assert.ok(mc.median < 2 * dm.base, 'MC-Median ' + mc.median.toFixed(2));

  const snap = S.buildSnapshotForecastTargets(mj, v);
  assert.equal(snap.scenario.op_margin_pct_used, 15);
  assert.ok(Math.abs(snap.years[0].fcff - 118.125) < 1e-9);

  // Beide Reverse-DCF-Anzeigen im zyklischen Pfad zeigen denselben Kernwert.
  const gOv = Number((S.buildReverseDcfOverviewCard(mj, v)
    .match(/ov-rdcf-hero"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  const gCard = Number((S.buildReverseDcfDiagnosticBlock(mj, v, [])
    .match(/rdcf-g"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Math.abs(gCard - coreMid.impliedGrowthPct) < 0.01,
    'Karte der Bewertungsansicht ' + gCard);
  assert.ok(Math.abs(gOv - gCard) < 0.1,
    'beide Anzeigen stimmen ueberein: Uebersicht ' + gOv + ' vs. Karte ' + gCard);

  // Der EINE Anzeigeweg (Matrix, Simulation, Reverse DCF auf derselben Sicht)
  // fuehrt dieselbe Margenbasis. Er entscheidet ueber die tatsaechlich
  // verwendete FY-/TTM-Sicht (resolveValuationView) und ist damit der Weg,
  // den die Bewertungsansicht wirklich rendert.
  const blocks = S.buildValuationDiagnosticBlocks(mj, v, []);
  assert.equal(blocks.view.ok, true, blocks.view.reason || '');
  assert.equal(v.dataBasis.selected, 'fy', 'diese Sicht ist das letzte Geschaeftsjahr');
  const gCardView = Number((blocks.reverseHtml
    .match(/rdcf-g"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Math.abs(gCardView - coreMid.impliedGrowthPct) < 0.01,
    'Anzeigeweg zeigt den Kernwert ' + gCardView);
  assert.ok(/midcycle_median/.test(blocks.reverseHtml),
    'die wirksame Margenbasis steht in der Karte');
  assert.equal(/0 \(angenommen\)/.test(blocks.reverseHtml), false);
  // Die Matrixzelle des Anzeigewegs ist weiterhin der Haupt-DCF-Wert
  // (die Anzeige rundet auf eine Dezimalstelle).
  assert.ok(blocks.matrixHtml.includes(dm.base.toFixed(1)),
    'Matrix des Anzeigewegs zeigt ' + dm.base.toFixed(1));
});

test('R4 (A-2) Standard-DCF bleibt auf der Szenariomarge — kein Mid-Cycle-Override', () => {
  // Gegenprobe zur gemeinsamen Aufloesung: im Standardpfad darf keine
  // Margenbasis erzwungen werden, sonst wuerden die Szenarien (conservative/
  // optimistic) ihre eigene Marge verlieren.
  const val = { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 };
  const mj = refMj({ net_debt: [500] }, val, { price: 20 });
  const v = S.runValuationEngine(mj);
  assert.equal(v.error, undefined);
  assert.ok(v.router.activeModels.includes('dcf'), 'Standardpfad');
  assert.equal(v._marginBasis, 'scenario');
  assert.equal(v._opMarginPctUsed, null, 'kein Override im Standardpfad');
  assert.equal(v._coreOpts.opMarginOverridePct, null);

  const mc = S.runMonteCarloDcf(mj, v, { seed: 4242, runs: 500 });
  assert.equal(mc._marginBasis, 'scenario');
  assert.equal(mc._opMarginPctUsed, null);

  const snap = S.buildSnapshotForecastTargets(mj, v);
  assert.equal(snap.scenario.op_margin_basis, 'scenario');
  // Umsatz J1 = 1.050, Marge 20 % ⇒ FCFF = 1.050·(0,20·0,75 + 0,05 − 0,05) = 157,5M
  assert.ok(Math.abs(snap.years[0].fcff - 157.5) < 1e-9, 'erhalten ' + snap.years[0].fcff);

  const mtx = S.computeSensitivityMatrix(mj, v);
  assert.equal(mtx.opMarginBasis, 'scenario');
  assert.ok(Math.abs(mtx.baseValue - v.modelResults.dcf.base) < 1e-12);
});

test('R5 (A-2) manueller Margen-Override hat Vorrang vor dem Mid-Cycle-Median', () => {
  // Die Vorrangregel der Eingabegrenze (normalizeDcfCoreInput) gilt jetzt fuer
  // ALLE Verbraucher: ein ausdruecklich uebergebener Override schlaegt die
  // erneute Ableitung des historischen Medians.
  const mj = midCycleMj();
  const vOvr = { scenarios: S.buildScenarios(mj), error: null,
    router: { activeModels: ['dcf_midcycle'], subClassification: 'cyclical' },
    _coreOpts: { opMarginOverridePct: 22, marginBasis: 'override', resolved: true } };

  const mtx = S.computeSensitivityMatrix(mj, vOvr);
  assert.equal(mtx.opMarginPctUsed, 22, 'Matrix folgt dem Override');
  assert.equal(mtx.opMarginBasis, 'override');

  const mc = S.runMonteCarloDcf(mj, vOvr, { seed: 4242, runs: 500 });
  assert.equal(mc._opMarginPctUsed, 22, 'MC folgt dem Override');
  assert.equal(mc._marginBasis, 'override');

  const snap = S.buildSnapshotForecastTargets(mj, vOvr);
  assert.equal(snap.scenario.op_margin_pct_used, 22, 'Snapshot folgt dem Override');
  assert.equal(snap.scenario.op_margin_basis, 'override');
  // Umsatz J1 = 1.050, Marge 22 % ⇒ FCFF = 1.050·(0,22·0,75 + 0) = 173,25M
  assert.ok(Math.abs(snap.years[0].fcff - 173.25) < 1e-9, 'erhalten ' + snap.years[0].fcff);

  // Der Haupt-DCF auf demselben Override als Bezug.
  const fi = S.buildForecastInputs(mj);
  const rOvr = S.forecastDcfCore(fi, 5, 2, 10, { enabled: false }, 22);
  assert.ok(Math.abs(rOvr._fcfPerYearAbs[1] - 173.25) < 1e-9);

  // Ein Textwert ist KEIN gueltiger Override (keine stille Umwandlung) —
  // dann gilt wieder der Mid-Cycle-Median.
  const vBad = { scenarios: S.buildScenarios(mj), error: null,
    router: { activeModels: ['dcf_midcycle'], subClassification: 'cyclical' },
    _coreOpts: { opMarginOverridePct: '22', marginBasis: 'override' } };
  assert.equal(S.computeSensitivityMatrix(mj, vBad).opMarginPctUsed, 15);
  assert.equal(S.runMonteCarloDcf(mj, vBad, { seed: 4242, runs: 500 })._opMarginPctUsed, 15);
});

test('R6 (A-2) Mid-Cycle-Pfad ohne ableitbaren Median: erklaerter Status, kein stiller Rueckfall', () => {
  // Zu kurze Historie (< 5 Jahre) ⇒ computeMidCycleFcf liefert
  // insufficient_data. Keiner der Verbraucher darf dann auf die Ist-Marge
  // ausweichen; alle nennen denselben Grund.
  const mj = midCycleMj();
  mj.fundamentals.revenue = mj.fundamentals.revenue.slice(0, 3);
  mj.fundamentals.ebit    = mj.fundamentals.ebit.slice(0, 3);
  mj.fundamentals.capex   = mj.fundamentals.capex.slice(0, 3);
  const v = midCycleV(mj);
  assert.notEqual(S.computeMidCycleFcf(mj).status, 'ok');

  const mtx = S.computeSensitivityMatrix(mj, v);
  assert.equal(mtx.available, false);
  assert.ok(/Mid-Cycle-Marge nicht ableitbar/.test(mtx.reason), mtx.reason);

  const mc = S.runMonteCarloDcf(mj, v, { seed: 4242, runs: 200 });
  assert.equal(mc._blocked, true);
  assert.ok(/Margenbasis/.test(mc._reason), mc._reason);

  const snap = S.buildSnapshotForecastTargets(mj, v);
  assert.equal(snap.available, false);
  assert.ok(/Margenbasis/.test(snap.reason), snap.reason);

  const card = S.buildReverseDcfDiagnosticBlock(mj, v, []);
  assert.ok(/nicht berechenbar/.test(card) && /Margenbasis/.test(card));
  assert.equal(/rdcf-g"/.test(card), false, 'keine Zahl ohne gueltige Margenbasis');
});

test('R7 (A-1) Reverse-DCF-Karte der Bewertungsansicht rechnet auf dem FCFF-Kern und nutzt die zentrale Nettoschuldenaufloesung', () => {
  // Frueher (Befund A-1): die Karte rechnete mit calculateImpliedGrowth() auf
  // f.fcf[0] (CFO − CapEx) und netDebtM ?? 0 und zeigte −4,66 %, waehrend die
  // Uebersichtskarte +10,80 % auswies — 15,5 pp Unterschied in derselben
  // Anwendung, mit der Zeile "Netto-Schulden (Mio.): 0 (angenommen)".
  const mj = {
    meta: { ticker: 'RDIV', sub_classification: 'standard_nonfin' },
    fundamentals: {
      revenue: [1000, 950, 900, 850], ebit: [200, 190, 180, 170],
      ebitda: [250, 240, 230, 220], capex: [50, 50, 50, 50],
      cfo: [200, 190, 180, 170], fcf: [150, 140, 130, 120],
      shares_diluted: [100, 100, 100, 100],
      total_debt: [2000, 2000, 2000, 2000], cash_and_equivalents: [0, 0, 0, 0],
      current_assets: [300, 300, 300, 300], current_liabilities: [200, 200, 200, 200],
      long_term_debt: [1800, 1800, 1800, 1800]
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 12 }
  };
  // Nettoschulden sind NICHT gesetzt, aber ableitbar: 2.000 − 0 = 2.000M.
  const bridge = S._resolveNetDebtForDcfBridge(mj.fundamentals);
  assert.equal(bridge.available, true);
  assert.equal(bridge.netDebtM, 2000);

  const core = S.solveReverseDcfGrowth(mj);
  assert.equal(core.status, 'ok');
  assert.equal(core.netDebtPerShare, 20);

  const v = { scenarios: {}, router: { activeModels: ['dcf'] }, error: null };
  const html = S.buildReverseDcfDiagnosticBlock(mj, v, []);
  const shown = Number((html.match(/rdcf-g"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Number.isFinite(shown), 'Karte zeigt eine Zahl');
  assert.ok(Math.abs(shown - core.impliedGrowthPct) < 0.01,
    'Karte ' + shown + ' % = Kern ' + core.impliedGrowthPct.toFixed(2) + ' %');

  // Keine stille Nullannahme mehr; die abgeleiteten Nettoschulden stehen da.
  assert.equal(/0 \(angenommen\)/.test(html), false, 'keine stille Nullannahme');
  assert.ok(/2000/.test(html), 'abgeleitete Nettoschulden werden gezeigt');
  assert.ok(/total_debt\[0\]/.test(html), 'Quelle der Nettoschulden wird genannt');

  // Beide Anzeigen stimmen ueberein.
  const gOv = Number((S.buildReverseDcfOverviewCard(mj, v)
    .match(/ov-rdcf-hero"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Math.abs(gOv - core.impliedGrowthPct) < 0.1, 'Uebersichtskarte ' + gOv);

  // Die Reported-/Owner-FCF-Diagnose darf bleiben, aber nur getrennt
  // beschriftet und mit dem Basis-Hinweis.
  assert.ok(/REPORTED-FCF-Basis/.test(html), 'Diagnosepaar ist eigens beschriftet');
  assert.ok(/nicht definitionskonsistent zum Haupt-DCF/.test(html),
    'Basis-Hinweis erreicht die Karte');
  const full = S.computeReverseDcfFull(mj);
  assert.equal(full.fcfBasisConsistentWithCore, false);
  assert.ok(full.reverseDcfReported != null);
  assert.ok(Math.abs(full.reverseDcfReported - core.impliedGrowthPct) > 10,
    'die beiden Groessen sind weiterhin verschieden — deshalb getrennt beschriftet');
});

test('R8 (A-1/A-3) unbekannte Nettoschulden: nachvollziehbarer Nichtverfuegbarkeitsstatus statt Null', () => {
  // Weder net_debt noch total_debt/cash ⇒ die Bruecke ist nicht aufloesbar.
  // Der Kern liefert dann keinen Eigenkapitalwert, und BEIDE Anzeigen muessen
  // das begruenden statt eine Zahl auf einer stillen Null zu zeigen.
  const mj = refMj({ fcf: [150, 140, 130, 120], cfo: [200, 190, 180, 170] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    { price: 12 });
  const bridge = S._resolveNetDebtForDcfBridge(mj.fundamentals);
  assert.equal(bridge.available, false);

  const core = S.solveReverseDcfGrowth(mj);
  assert.equal(core.status, 'net_debt_unknown');
  assert.equal(core.impliedGrowthPct, null);

  const v = { scenarios: {}, router: { activeModels: ['dcf'] }, error: null };
  const html = S.buildReverseDcfDiagnosticBlock(mj, v, []);
  assert.equal(/rdcf-g"/.test(html), false, 'keine Hauptzahl ohne Nettoschulden');
  assert.ok(/Nettoschulden unbekannt/.test(html), 'Status wird benannt');
  assert.ok(/NICHT als 0/.test(html) || /NICHT/.test(html), 'die Nullannahme wird ausdruecklich verneint');
  assert.equal(/0 \(angenommen\)/.test(html), false);

  const card = S.buildReverseDcfOverviewCard(mj, v);
  assert.ok(/ov-rdcf-na/.test(card), 'Uebersichtskarte zeigt den Status');
  assert.ok(/Nettoschulden/.test(card));

  // Das Kernergebnis wird trotzdem in allen Rueckgabepfaden mitgefuehrt.
  const full = S.computeReverseDcfFull(mj);
  assert.ok(full.coreReverseDcf, 'coreReverseDcf ist vorhanden');
  assert.equal(full.coreStatus, 'net_debt_unknown');
  assert.equal(full.coreAvailable, false);
});

test('R9 (A-3) fehlendes oder nichtpositives FCF sperrt die verfuegbare Kernrechnung nicht', () => {
  // Frueher (Befund A-3): computeReverseDcfFull() brach bei fcf0M == null oder
  // <= 0 ab, BEVOR coreReverseDcf gebildet wurde. Die Uebersichtskarte meldete
  // "FCF₀ fehlt — Reverse DCF nicht berechenbar", obwohl der Kern ein
  // eindeutiges Ergebnis lieferte und der Haupt-DCF anwendbar war.
  const val = { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 };
  const price = 18.728383767294428;

  // (a) f.fcf fehlt vollstaendig (jede TTM-Sicht ohne gedeckten cfo).
  const mj = refMj({ net_debt: [500] }, val, { price });
  assert.ok(mj.fundamentals.fcf === undefined, 'f.fcf ist nicht besetzt');
  const core = S.solveReverseDcfGrowth(mj);
  assert.equal(core.status, 'ok');
  assert.ok(Math.abs(core.impliedGrowthPct - 5) < 1e-2);
  assert.equal(S.modelDcf(mj, scOf(5, 2, 10, 20)).applicable, true, 'Haupt-DCF ist anwendbar');

  const full = S.computeReverseDcfFull(mj);
  // Das REPORTED-Diagnosepaar bleibt gesperrt — das ist seine eigene
  // Voraussetzung. Der Kern ist davon unabhaengig.
  assert.equal(full.applicable, false, 'Reported-FCF-Diagnose bleibt gesperrt');
  assert.equal(full.reverseDcfReported, null);
  assert.equal(full.reportedFcfGateBlocked, true);
  assert.ok(full.coreReverseDcf, 'Kernergebnis wird mitgefuehrt');
  assert.equal(full.coreStatus, 'ok');
  assert.equal(full.coreAvailable, true);
  assert.equal(full.coreImpliedGrowthPct, core.impliedGrowthPct);
  assert.ok(/nicht definitionskonsistent zum Haupt-DCF/.test(full.fcfBasisNote || ''),
    'der Basis-Hinweis erreicht auch den gesperrten Pfad');

  const v = { scenarios: {}, router: { activeModels: ['dcf'] }, error: null };
  const card = S.buildReverseDcfOverviewCard(mj, v);
  assert.equal(/ov-rdcf-na/.test(card), false, 'Karte ist nicht mehr gesperrt');
  assert.equal(/FCF₀ fehlt/.test(card), false);
  const gOv = Number((card.match(/ov-rdcf-hero"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Math.abs(gOv - core.impliedGrowthPct) < 0.1, 'Karte zeigt den Kernwert ' + gOv);

  // (b) nichtpositives FCF.
  const mjNeg = refMj({ net_debt: [500], fcf: [-10, -10, -10, -10] }, val, { price });
  const fullNeg = S.computeReverseDcfFull(mjNeg);
  assert.equal(fullNeg.applicable, false);
  assert.equal(fullNeg.coreStatus, 'ok', 'Kern rechnet trotz negativem Reported-FCF');
  assert.ok(Math.abs(fullNeg.coreImpliedGrowthPct - core.impliedGrowthPct) < 1e-9);
  assert.equal(/ov-rdcf-na/.test(S.buildReverseDcfOverviewCard(mjNeg, v)), false);

  // (c) als verdaechtig markierte FCF-Groesse (fcfDataSuspect).
  const mjSus = refMj({ net_debt: [500], fcf: [900, 900, 900, 900], cfo: [950, 950, 950, 950] },
    val, { price });
  const gp = S.computeGrowthProfile(mjSus);
  assert.equal(gp.fcfDataSuspect, true, 'Datensatz loest den Suspect-Flag aus');
  const fullSus = S.computeReverseDcfFull(mjSus);
  assert.equal(fullSus.applicable, false, 'Reported-Diagnose bleibt gesperrt');
  assert.equal(fullSus.coreStatus, 'ok', 'Kern bleibt verfuegbar');
  assert.equal(/ov-rdcf-na/.test(S.buildReverseDcfOverviewCard(mjSus, v)), false);

  // (d) Financials bleiben ausdruecklich nicht anwendbar — auch im Kern.
  const mjFin = refMj({ net_debt: [500] }, val, { price });
  mjFin.meta.sub_classification = 'financial';
  const fullFin = S.computeReverseDcfFull(mjFin);
  assert.equal(fullFin.applicable, false);
  assert.equal(fullFin.coreStatus, 'not_applicable');
  assert.equal(fullFin.coreAvailable, false);
  assert.equal(S.buildReverseDcfOverviewCard(mjFin, v), '', 'keine Karte fuer Financials');
});

// ═══════════════════════════════════════════════════════════════════════════
// R10–R15 (Regression, Korrekturchat 12B) — ersetzen `B5`.
// Befund A-4 ist behoben, die Pruefpunkte O-1 und O-2 sind bestaetigt und
// behoben. Diese Tests sichern das RICHTIGE Verhalten ab.
// ═══════════════════════════════════════════════════════════════════════════

// Gemeinsame Bilanz fuer die Handrechnungen:
//   Umlaufvermoegen 400, Zahlungsmittel 100, kurzfristige Verbindlichkeiten 500,
//   davon 300 kurzfristige Finanzschulden, langfristige Schulden 700.
//   OWC = (400 − 100) − (500 − 300) = 100 ⇒ Quote +10 % vom Umsatz 1.000.
// Reihen aus dem vm-Kontext tragen dessen Array-Prototyp; fuer den
// Strukturvergleich werden sie in den Realm des Tests geholt.
const sameRealm = (a) => Array.isArray(a) || (a && typeof a.length === 'number')
  ? Array.from(a) : a;
const eqSeries = (actual, expected, msg) =>
  assert.deepEqual(sameRealm(actual), expected, msg);

const A4_BASE = {
  revenue: [1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200],
  ebitda: [250, 250, 250, 250], capex: [50, 50, 50, 50],
  shares_diluted: [100, 100, 100, 100],
  current_assets: [400, 400, 400, 400],
  current_liabilities: [500, 500, 500, 500],
  cash_and_equivalents: [100, 100, 100, 100],
  long_term_debt: [700, 700, 700, 700],
  debt_short_term: [300, 300, 300, 300]
};
const a4Mj = (fundOverrides) => ({
  meta: { sub_classification: 'standard_nonfin' },
  fundamentals: Object.assign({}, A4_BASE, fundOverrides || {}),
  valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
               wacc_derived: 10, growth_terminal: 2, growth_stage1: 8 },
  market: { price: 20 }
});

test('R10 A-4: gemeldete Schuldenkomponenten schlagen die Restgroesse — Tag-Darstellung aendert das Working Capital nicht', () => {
  // Bis V1.0.58 bildete _computeOwcHistory() die kurzfristigen Finanzschulden
  // NUR als total_debt − long_term_debt. Faellt die total_debt-Kette auf
  // `LongTermDebt` (identisch mit long_term_debt), war die Restgroesse 0 und
  // galt als GEMESSEN — obwohl debt_short_term[0] = 300 im selben Datensatz
  // steht. Jetzt hat die gemeldete Komponente Vorrang.
  const mjLt = a4Mj({ total_debt: [700, 700, 700, 700] });    // total_debt aus LongTermDebt
  const mjOk = a4Mj({ total_debt: [1000, 1000, 1000, 1000] }); // total_debt vollstaendig

  const hLt = S._computeOwcHistory(mjLt.fundamentals);
  const hOk = S._computeOwcHistory(mjOk.fundamentals);

  // Von Hand: OWC = (400 − 100) − (500 − 300) = 100 ⇒ Quote +10 %.
  for (const [name, h] of [['LongTermDebt-Darstellung', hLt], ['vollstaendige Darstellung', hOk]]) {
    assert.equal(h.years[0].shortTermDebt, 300, name + ': gemeldete Komponente wird verwendet');
    assert.equal(h.years[0].shortTermDebtStatus, 'measured', name);
    assert.match(h.years[0].shortTermDebtSource, /debt_short_term/, name);
    assert.equal(h.years[0].owc, 100, name);
    assert.equal(h.years[0].ratio, 0.10, name);
  }
  // Kernforderung: dieselbe Bilanz, dieselbe Working-Capital-Quote.
  assert.equal(hLt.years[0].ratio, hOk.years[0].ratio);
  assert.equal(hLt.years.length, hOk.years.length);

  // Die Restgroesse 0 wird nicht mehr als Messung ausgegeben; der Widerspruch
  // zu debt_short_term = 300 wird als solcher gemeldet.
  assert.equal(hLt.years[0].shortTermDebtDiscrepancyM, -300,
    'Restgroesse 0 gegen gemeldete 300 wird als Widerspruch gefuehrt');
  assert.ok((hLt.warnings || []).some(w => /widersprechen sich/.test(w)),
    'Widerspruch wird benannt: ' + JSON.stringify(hLt.warnings));
  assert.equal(hOk.years[0].shortTermDebtDiscrepancyM, null,
    'widerspruchsfreier Datensatz erzeugt keine Widerspruchsmeldung');

  // Wirkung im Bewertungsweg: die Working-Capital-Quote ist in beiden
  // Darstellungen +10 %. Der verbleibende Unterschied im Fair Value stammt
  // AUSSCHLIESSLICH aus der Nettoschuldenbruecke, weil der manuelle Import
  // total_debt = 700 ausdruecklich behauptet — das Werkzeug erfindet dort
  // keinen Ersatzwert, weist den Widerspruch aber aus.
  const rLt = S.modelDcf(mjLt, scOf(8, 2, 10, 20));
  const rOk = S.modelDcf(mjOk, scOf(8, 2, 10, 20));
  assert.equal(rLt._owcRatio, 0.10);
  assert.equal(rOk._owcRatio, 0.10);
  assert.equal(rLt._netDebtM, 600);
  assert.equal(rOk._netDebtM, 900);
  // operativer Unternehmenswert je Aktie identisch ⇒ nur der Abzug trennt sie
  assert.ok(Math.abs(rLt._operatingValuePerShareBase - rOk._operatingValuePerShareBase) < 1e-9,
    'gleiche Working-Capital-Basis ⇒ gleicher operativer Wert');
  assert.ok(Math.abs((rLt.base - rOk.base) - 3.00) < 1e-9,
    'Differenz = 300M Nettoschulden / 100M Aktien = 3,00 je Aktie, erhalten ' + (rLt.base - rOk.base));
  assert.ok((rLt.warnings || []).some(w => /widersprechen sich/.test(w)),
    'der Widerspruch erreicht den Bewertungsausweis');
  assert.ok((rLt.warnings || []).some(w => /Kurzfristige Finanzschulden im Working Capital/.test(w)),
    'die Herkunft der kurzfristigen Finanzschulden wird ausgewiesen');
});

test('R11 A-4: belegte Null, fehlende Komponente und Widerspruch bleiben getrennt', () => {
  // (a) Belegte Null: gar keine Finanzschulden ⇒ 0 ist GEMESSEN.
  const hZero = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: [0, 0, 0, 0], long_term_debt: [0, 0, 0, 0], debt_short_term: undefined
  }));
  assert.equal(hZero.years.length, 4);
  assert.equal(hZero.years[0].shortTermDebt, 0);
  assert.equal(hZero.years[0].shortTermDebtStatus, 'measured');
  assert.match(hZero.years[0].shortTermDebtSource, /keine Finanzschulden/);

  // (b) Ausdrueckliche 0 als gemeldete Komponente ist ebenfalls eine Messung.
  const hZeroComp = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: [700, 700, 700, 700], debt_short_term: [0, 0, 0, 0]
  }));
  assert.equal(hZeroComp.years[0].shortTermDebt, 0);
  assert.equal(hZeroComp.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hZeroComp.years[0].owc, -200, 'OWC = (400−100) − (500−0)');

  // (c) Fehlender Wert ist NICHT 0: ohne jede Komponente und ohne verwertbare
  //     Restgroesse bleibt das Jahr unvollstaendig.
  const hMissing = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: undefined, debt_short_term: undefined
  }));
  assert.equal(hMissing.years.length, 0);
  assert.ok(hMissing.missing.some(m => /short_term_debt/.test(m)), JSON.stringify(hMissing.missing));

  // (d) Restgroesse als Rueckfall ohne jede Komponente: zulaessig, aber
  //     ausdruecklich ABGELEITET — nicht als Messung ausgewiesen.
  const hDerived = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: [1000, 1000, 1000, 1000], debt_short_term: undefined
  }));
  assert.equal(hDerived.years[0].shortTermDebt, 300);
  assert.equal(hDerived.years[0].shortTermDebtStatus, 'derived');
  assert.equal(hDerived.years[0].shortTermDebtDerived, true);
  assert.match(hDerived.years[0].shortTermDebtSource, /total_debt − long_term_debt/);

  // (e) Inkonsistenz total_debt < long_term_debt ohne Komponente ⇒ kein Wert.
  const hNeg = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: [600, 600, 600, 600], debt_short_term: undefined
  }));
  assert.equal(hNeg.years.length, 0);
  assert.ok(hNeg.missing.some(m => /inkonsistent/.test(m)), JSON.stringify(hNeg.missing));
});

test('R12 A-4/Vollstaendigkeit: eine gemeldete Teilkomponente macht die kurzfristige Schuld nicht vollstaendig', () => {
  // KORRIGIERT in Korrekturchat 12B.1. Bis V1.0.59 erwartete dieser Test, dass
  // `LongTermDebt` 700 + `ShortTermBorrowings` 300 eine GEMESSENE kurzfristige
  // Finanzschuld von 300 ergibt. Das war fachlich falsch: `LongTermDebt`
  // enthaelt die laufenden Faelligkeiten langfristiger Schulden, weist sie aber
  // nicht getrennt aus. Wie hoch der kurzfristige Anteil der 700 ist, bleibt
  // damit offen — die 300 sind nur EIN Bestandteil der kurzfristigen Schuld.
  // V1.0.61: Der Filer meldet ausdrueckliche Nullwerte fuer Leasing; ohne sie
  // waere schon die GESAMTVERSCHULDUNG nicht bestimmt (siehe R21). Die
  // Vollstaendigkeitsluecke, um die es hier geht, betrifft allein die in den
  // 700 enthaltene, nicht bezifferte laufende Tranche.
  const mjA = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebt:        secInst(allYears(700)),
    ShortTermBorrowings: secInst(allYears(300))
  })));
  // Die Gesamtschuld bleibt bestimmt: {ltCurMat,debtNC} und {stBorrow} sind
  // disjunkt, also ist die Summe zulaessig.
  eqSeries(mjA.fundamentals.total_debt, [1000, 1000, 1000, 1000]);
  assert.equal(S._resolveNetDebtForDcfBridge(mjA.fundamentals).netDebtM, 900);
  const hA = S._computeOwcHistory(mjA.fundamentals);
  assert.equal(hA.years.length, 0, 'kein Jahr mit vollstaendig belegter kurzfristiger Schuld');
  assert.ok(hA.missing.some(m => /laufende Fälligkeiten/.test(m)),
    'die fehlende Zelle wird benannt: ' + JSON.stringify(hA.missing));
  // Keine stille Nullannahme: die bestehende ausdrueckliche Kennzeichnung gilt.
  const owcA = S._resolveOwcForForecast(mjA);
  assert.equal(owcA.measured, false);
  assert.equal(owcA.assumptionRequired, true);
  assert.equal(owcA.available, false);
  assert.equal(owcA.setBy, 'model_provisional_default');

  // (b) Sobald die laufende Tranche gemeldet ist, ist die Summe vollstaendig.
  //     Von Hand: 300 (ShortTermBorrowings) + 100 (LongTermDebtCurrent) = 400;
  //     OWC = (400 − 100) − (500 − 400) = 200 ⇒ Quote +20 %.
  const mjB = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebtNoncurrent: secInst(allYears(600)),
    LongTermDebtCurrent:    secInst(allYears(100)),
    ShortTermBorrowings:    secInst(allYears(300))
  })));
  eqSeries(mjB.fundamentals.total_debt, [1000, 1000, 1000, 1000]);
  const hB = S._computeOwcHistory(mjB.fundamentals);
  assert.equal(hB.years.length, 4);
  assert.equal(hB.years[0].shortTermDebt, 400);
  assert.equal(hB.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hB.years[0].owc, 200);
  assert.equal(hB.years[0].ratio, 0.20);
  assert.equal(hB.years[0].period, '2025-12-31');

  // (c) `DebtCurrent` deckt die kurzfristige Schuld als GANZES ab — auch ohne
  //     getrennte Aufschluesselung ist sie damit vollstaendig bestimmt.
  const mjC = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst(allYears(300))
  })));
  const hC = S._computeOwcHistory(mjC.fundamentals);
  assert.equal(hC.years.length, 4);
  assert.equal(hC.years[0].shortTermDebt, 300);
  assert.equal(hC.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hC.years[0].owc, 100);

  // (d) Dieselbe Angabe nur fuer das aktuelle Jahr: die Vorjahre sind
  //     unbekannt und werden nicht als 0 gefuehrt.
  const mjD = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst({ 2025: 300 })
  })));
  const hD = S._computeOwcHistory(mjD.fundamentals);
  assert.equal(hD.years.length, 1, 'nur das belegte Jahr');
  assert.equal(hD.years[0].shortTermDebt, 300);
  assert.ok(hD.missing.some(m => /2024-12-31/.test(m)), JSON.stringify(hD.missing));

  // (e) Angabe nur fuer AELTERE Jahre (stale): fuer den aktuellen Stichtag
  //     liegt nichts vor ⇒ keine Historie, keine Ersatzquote.
  const mjE = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst({ 2024: 300, 2023: 300, 2022: 300 })
  })));
  const hE = S._computeOwcHistory(mjE.fundamentals);
  assert.equal(hE.years.length, 0);
  const owcE = S._resolveOwcForForecast(mjE);
  assert.equal(owcE.measured, false);
  assert.equal(owcE.assumptionRequired, true);
  assert.equal(owcE.available, false);
});

test('R13 O-1: `LongTermDebt` als Noncurrent-Fallback zaehlt die laufenden Faelligkeiten nicht doppelt', () => {
  // us-gaap:LongTermDebt ist die GESAMTE langfristige Verschuldung
  // EINSCHLIESSLICH der laufenden Faelligkeiten. Es steht an dritter Stelle
  // der Kette SEC_TAG_MAP.debt_long_term_noncurrent. Meldet ein Filer
  // LongTermDebt und LongTermDebtCurrent, aber kein LongTermDebtNoncurrent,
  // addierte der Rebuild die laufende Tranche bis V1.0.58 zweimal.
  const TAGS = evalInApp('SEC_TAG_MAP');
  assert.equal(TAGS.debt_long_term_noncurrent[2], 'LongTermDebt',
    'Ausgangslage des Pruefpunkts unveraendert');
  assert.equal(TAGS.long_term_debt[0], 'LongTermDebt');

  // Wirtschaftlich EIN Sachverhalt, zwei zulaessige Tag-Darstellungen:
  //   langfristige Schulden gesamt 1.000, davon 100 laufende Faelligkeiten.
  const viaTotal = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebt:        secInst(allYears(1000)),
    LongTermDebtCurrent: secInst(allYears(100))
  })));
  const viaSplit = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100))
  })));
  assert.equal(viaTotal.fundamentals.debt_long_term_noncurrent[0], 1000, 'Fallback greift wie beschrieben');
  eqSeries(viaTotal.fundamentals.total_debt, [1000, 1000, 1000, 1000],
    'kein Doppelzaehlen der laufenden Faelligkeiten (frueher 1.100)');
  eqSeries(viaSplit.fundamentals.total_debt, [1000, 1000, 1000, 1000]);
  assert.equal(S._resolveNetDebtForDcfBridge(viaTotal.fundamentals).netDebtM,
               S._resolveNetDebtForDcfBridge(viaSplit.fundamentals).netDebtM,
               'gleiche Bilanz ⇒ gleiche Nettoschulden');
  assert.equal(S._resolveNetDebtForDcfBridge(viaTotal.fundamentals).netDebtM, 900);
  // kurzfristige Finanzschulden = laufende Tranche 100 in beiden Darstellungen
  assert.equal(S._computeOwcHistory(viaTotal.fundamentals).years[0].shortTermDebt, 100);
  assert.equal(S._computeOwcHistory(viaSplit.fundamentals).years[0].shortTermDebt, 100);

  // Mit zusaetzlichen kurzfristigen Bankschulden (50) — wahre Gesamtschuld 1.050.
  const stTotal = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebt:        secInst(allYears(1000)),
    LongTermDebtCurrent: secInst(allYears(100)),
    ShortTermBorrowings: secInst(allYears(50))
  })));
  const stSplit = importSecFacts(secFactsWithDebt(fullyDocumented({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100)),
    ShortTermBorrowings:    secInst(allYears(50))
  })));
  eqSeries(stTotal.fundamentals.total_debt, [1050, 1050, 1050, 1050]);
  eqSeries(stSplit.fundamentals.total_debt, [1050, 1050, 1050, 1050]);
  assert.equal(S._computeOwcHistory(stTotal.fundamentals).years[0].shortTermDebt, 150);
  assert.equal(S._computeOwcHistory(stSplit.fundamentals).years[0].shortTermDebt, 150);

  // Gegenprobe zur Ueberschneidung auf der kurzfristigen Seite:
  // us-gaap:DebtCurrent enthaelt die laufenden Faelligkeiten bereits.
  const viaDebtCurrent = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100)),
    DebtCurrent:            secInst(allYears(150))   // = 50 Bank + 100 laufend
  })));
  eqSeries(viaDebtCurrent.fundamentals.total_debt, [1050, 1050, 1050, 1050],
    'DebtCurrent deckt die laufende Tranche ab — keine Doppelzaehlung');
  assert.equal(S._computeOwcHistory(viaDebtCurrent.fundamentals).years[0].shortTermDebt, 150);
  assert.equal(S._resolveNetDebtForDcfBridge(viaDebtCurrent.fundamentals).netDebtM, 950);

  // Nicht aufloesbare Ueberschneidung (DebtCurrent + LongTermDebt, laufende
  // Tranche nicht gemeldet): kein erfundener Summenwert, sondern ein Hinweis.
  const unresolvable = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  })));
  eqSeries(unresolvable.fundamentals.total_debt, [1000, 1000, 1000, 1000],
    'direkter Wert bleibt stehen, keine Summe aus ueberschneidenden Tags');
  // V1.0.61: Die Ueberschneidung zeigt sich als Unterbestimmtheit des
  // Gleichungssystems — inhaltlich derselbe Befund, praezisere Begruendung.
  assert.ok((unresolvable.meta._debt_warnings || [])
    .some(w => /Gesamtverschuldung nicht bestimmt/.test(w)),
    JSON.stringify(unresolvable.meta._debt_warnings));
  assert.equal(unresolvable.fundamentals._v4_meta.total_debt.scopeComplete, false);
  assert.equal(S._resolveNetDebtForDcfBridge(unresolvable.fundamentals).available, false);
});

test('R14 O-2: Working-Capital-Historie verknuepft periodengetreu, nicht ueber den Array-Index', () => {
  // KORRIGIERT in Korrekturchat 12B.1: Der Periodennachweis lief bis V1.0.59
  // ueber LongTermDebtAndCapitalLeaseObligations − LongTermDebtNoncurrent und
  // setzte damit voraus, dass diese Differenz die kurzfristige Schuld sei.
  // Das ist fachlich falsch (sie ist das LANGFRISTIGE Leasing, siehe R16).
  // Der Periodennachweis verwendet jetzt Angaben, die die kurzfristige Schuld
  // tatsaechlich bestimmen: `DebtCurrent` deckt sie als Ganzes ab.
  //
  // Filer mit einer Luecke in DebtCurrent (FY2024 fehlt). Dadurch stehen an
  // derselben Array-Position unterschiedliche Geschaeftsjahre:
  //   current_liabilities [FY2025, FY2024, FY2023, FY2022]
  //   debt_short_term     [FY2025,         FY2023, FY2022] = 300, 200, 150
  // Eine Indexverknuepfung haette FY2024 mit dem FY2023-Wert 200 gepaart und
  // eine plausibel aussehende, aber aus zwei Geschaeftsjahren zusammengesetzte
  // Quote erzeugt.
  const mj = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst({ 2025: 300, 2023: 200, 2022: 150 })
  }));
  const f = mj.fundamentals;
  eqSeries(f.debt_short_term, [300, 200, 150], 'Ausgangslage: Reihe kuerzer als die Bilanzreihen');
  eqSeries(f._v4_meta.debt_short_term.periods, ['2025-12-31', '2023-12-31', '2022-12-31']);
  eqSeries(f._v4_meta.current_liabilities.periods,
    ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31']);

  const h = S._computeOwcHistory(f);
  assert.equal(h.periodKeyed, true);
  assert.equal(h.years.length, 1, 'nur das periodengleich belegte Jahr FY2025');
  assert.equal(h.years[0].period, '2025-12-31');
  assert.equal(h.years[0].shortTermDebt, 300);
  assert.equal(h.years[0].owc, 100, 'OWC = (400 − 100) − (500 − 300)');
  assert.ok(h.missing.some(m => /2024-12-31/.test(m)),
    'FY2024 wird als unbestimmbar benannt: ' + JSON.stringify(h.missing));
  // Der frueher still erzeugte Mischwert (FY2024-Bilanz mit FY2023-Schuld)
  // darf nirgends mehr auftreten.
  assert.equal(h.years.some(y => y.shortTermDebt === 200), false);

  // Gegenprobe: lueckenlose Perioden ⇒ alle vier Jahre, jeweils periodengleich.
  const full = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst({ 2025: 300, 2024: 250, 2023: 200, 2022: 150 })
  }));
  const hFull = S._computeOwcHistory(full.fundamentals);
  assert.equal(hFull.years.length, 4);
  eqSeries(hFull.years.map(y => y.period),
    ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31']);
  eqSeries(hFull.years.map(y => y.shortTermDebt), [300, 250, 200, 150]);
  eqSeries(hFull.years.map(y => y.owc), [100, 50, 0, -50]);

  // Ohne jeden Periodenkontext (manueller Import) bleibt die Positionslogik
  // ausdruecklich zulaessig — sonst waeren Altdaten nicht mehr verwertbar.
  const legacy = S._computeOwcHistory(Object.assign({}, A4_BASE, {
    total_debt: [1000, 1000, 1000, 1000], debt_short_term: undefined
  }));
  assert.equal(legacy.periodKeyed, false);
  assert.equal(legacy.years.length, 4);
  assert.equal(legacy.years[0].period, null);
  assert.equal(legacy.years[0].shortTermDebtStatus, 'derived',
    'der Positionsbezug wird als abgeleitet gekennzeichnet');
});

test('R15 O-1/A-4: gleiche Bilanz, verschiedene zulaessige Tags ⇒ gleiche Bewertung', () => {
  // Wirtschaftlich identische, vollstaendig belegte Bilanz in drei zulaessigen
  // Tag-Darstellungen. Gesamtschuld 1.000, davon 300 kurzfristig.
  // (In Korrekturchat 12B.1 berichtigt: die dritte Darstellung war
  // `LongTermDebt` 700 + `ShortTermBorrowings` 300 und beschrieb damit eine
  // ANDERE Bilanz — dort sind die laufenden Faelligkeiten in den 700 enthalten
  // und nicht beziffert, die Gesamtschuld waere 1.000 bei unbekannter
  // Aufteilung. Ersetzt durch `DebtCurrent`, das die kurzfristige Schuld als
  // Ganzes ausweist.)
  const variants = {
    'Noncurrent 700 + LongTermDebtCurrent 300': fullyDocumented({
      LongTermDebtNoncurrent: secInst(allYears(700)),
      LongTermDebtCurrent:    secInst(allYears(300))
    }),
    'LongTermDebt 1000 (gesamt) + LongTermDebtCurrent 300': fullyDocumented({
      LongTermDebt:        secInst(allYears(1000)),
      LongTermDebtCurrent: secInst(allYears(300))
    }),
    'Noncurrent 700 + DebtCurrent 300': noNoncurrentLeases({
      LongTermDebtNoncurrent: secInst(allYears(700)),
      DebtCurrent:            secInst(allYears(300))
    })
  };
  const results = {};
  for (const [name, tags] of Object.entries(variants)) {
    const mj = importSecFacts(secFactsWithDebt(tags));
    const h  = S._computeOwcHistory(mj.fundamentals);
    const nd = S._resolveNetDebtForDcfBridge(mj.fundamentals);
    const r  = S.modelDcf(mj, scOf(8, 2, 10, 20));
    results[name] = {
      totalDebt: mj.fundamentals.total_debt[0],
      shortTermDebt: h.years[0] && h.years[0].shortTermDebt,
      owcRatio: h.years[0] && h.years[0].ratio,
      netDebtM: nd.netDebtM,
      fairValue: r.base
    };
  }
  const names = Object.keys(results);
  const ref = results[names[0]];
  // Von Hand: total_debt 1.000, Zahlungsmittel 100 ⇒ Nettoschulden 900.
  // OWC = (400 − 100) − (500 − 300) = 100 ⇒ Quote +10 %.
  assert.equal(ref.totalDebt, 1000);
  assert.equal(ref.shortTermDebt, 300);
  assert.equal(ref.owcRatio, 0.10);
  assert.equal(ref.netDebtM, 900);
  for (const n of names.slice(1)) {
    assert.deepEqual(results[n], ref,
      'Tag-Darstellung "' + n + '" weicht ab: ' + JSON.stringify(results[n]) +
      ' vs. ' + JSON.stringify(ref));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// R16–R20 (Regression, Korrekturchat 12B.1) — die nach 12B festgestellten
// Fehler bei Schuldenumfang, Leasingueberschneidung und unklaren Nettoschulden.
// ═══════════════════════════════════════════════════════════════════════════

test('R16 Schuldenumfang: LongTermDebtAndCapitalLeaseObligations − LongTermDebtNoncurrent ist LANGFRISTIGES Leasing, keine kurzfristige Schuld', () => {
  // Nach den Dokumentationsdefinitionen der FASB-Taxonomie 2025 ist
  //   LongTermDebtAndCapitalLeaseObligations = noncurrent Schulden UND Leasing
  //   LongTermDebtNoncurrent                 = noncurrent Schulden OHNE Leasing
  // Die Differenz ist also das LANGFRISTIGE Leasing. V1.0.59 verbuchte sie als
  // "laufende Tranche" und leitete daraus eine gemessene OWC-Quote ab.
  const mj = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    LongTermDebtNoncurrent:                 secInst(allYears(700))
  }));
  const f = mj.fundamentals;
  eqSeries(f.total_debt, [1000, 1000, 1000, 1000]);
  eqSeries(f.long_term_debt, [700, 700, 700, 700]);

  const h = S._computeOwcHistory(f);
  assert.equal(h.years.length, 0,
    'die Differenz 300 darf keine kurzfristige Finanzschuld erzeugen');
  const reason = h.missing.join(' | ');
  assert.ok(/nicht bestimmt/.test(reason), reason);
  assert.ok(/laufende Fälligkeiten/.test(reason), reason);
  assert.ok(/Leasingverpflichtungen/.test(reason), reason);

  // Keine stille Nullannahme — die bestehende ausdrueckliche Kennzeichnung.
  const owc = S._resolveOwcForForecast(mj);
  assert.equal(owc.measured, false);
  assert.equal(owc.assumptionRequired, true);
  assert.equal(owc.setBy, 'model_provisional_default');

  // BERICHTIGT in Korrekturchat 12B.2: In V1.0.60 blieb der rein langfristige
  // Teilbetrag ausdruecklich als Gesamtschuld in Gebrauch — begruendet damit,
  // der Fall waere sonst nicht bewertbar. Das ist keine zulaessige Ausnahme:
  // ein nachweislicher Teilbetrag ist keine Gesamtschuld. Die blosze Warnung
  // ersetzt den Nichtverfuegbarkeitsstatus nicht.
  assert.equal(f._v4_meta.total_debt.scopeComplete, false,
    'der Teilbetrag ist nicht als Gesamtschuld belegt');
  const ndR16 = S._resolveNetDebtForDcfBridge(f);
  assert.equal(ndR16.available, false, 'Nettoschuldenbruecke gesperrt');
  assert.equal(ndR16.netDebtM, null);
  const rR16 = S.modelDcf(mj, scOf(8, 2, 10, 20));
  assert.equal(rR16.applicable, false);
  assert.equal(rR16.base, null);
  assert.ok(rR16._operatingValuePerShareBase > 0,
    'der operative Unternehmenswert bleibt getrennt verfuegbar');
  // Eine manuelle OWC-Annahme loest die unklare Gesamtschuld NICHT auf.
  const mjOv = JSON.parse(JSON.stringify(mj));
  mjOv.valuation.assumptions = { owc_pct_of_revenue: { value: 12 } };
  assert.equal(S.modelDcf(mjOv, scOf(8, 2, 10, 20)).applicable, false,
    'manuelle OWC-Annahme ersetzt die fehlende Schuldenbasis nicht');

  // Gegenprobe: dieselbe Bilanz mit ausgewiesenem Leasing. Langfristiges
  // Leasing (300) gehoert NICHT ins Working Capital, kurzfristiges (40) schon.
  // Von Hand: OWC = (400 − 100) − (500 − 40) = −160.
  const mj2 = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent:    secInst(allYears(40)),
    LongTermDebtCurrent:             secInst(allYears(0)),
    ShortTermBorrowings:             secInst(allYears(0))
  }));
  const h2 = S._computeOwcHistory(mj2.fundamentals);
  assert.equal(h2.years.length, 4);
  assert.equal(h2.years[0].shortTermDebt, 40,
    'nur das KURZFRISTIGE Leasing zaehlt, nicht die langfristigen 300');
  assert.equal(h2.years[0].owc, -160);
});

test('R17 Leasing: eine zusaetzliche Aufschluesselung veraendert Schulden, OWC und Bewertung nicht', () => {
  // `DebtCurrent` enthaelt die kurzfristigen Leasingverpflichtungen bereits.
  // Wird FinanceLeaseLiabilityCurrent zusaetzlich als Aufschluesselung
  // gemeldet, darf sich NICHTS aendern. V1.0.59 zaehlte sie doppelt
  // (Gesamtschuld 1.050 statt 1.000, Fair Value 18,6798 statt 19,61913).
  const mess = (tags) => {
    const mj = importSecFacts(secFactsWithDebt(tags));
    const h  = S._computeOwcHistory(mj.fundamentals);
    const nd = S._resolveNetDebtForDcfBridge(mj.fundamentals);
    const r  = S.modelDcf(mj, scOf(8, 2, 10, 20));
    return { totalDebt: mj.fundamentals.total_debt[0],
             shortTermDebt: h.years[0] && h.years[0].shortTermDebt,
             owcRatio: h.years[0] && h.years[0].ratio,
             netDebtM: nd.netDebtM, fairValue: r.base };
  };
  const ohne = mess(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst(allYears(300))
  }));
  const mit = mess(noNoncurrentLeases({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(50))   // in DebtCurrent enthalten
  }));
  assert.equal(ohne.totalDebt, 1000);
  assert.equal(ohne.shortTermDebt, 300);
  assert.equal(ohne.owcRatio, 0.10);
  assert.equal(ohne.netDebtM, 900);
  assert.deepEqual(mit, ohne,
    'die Aufschluesselung darf nichts veraendern: ' + JSON.stringify(mit));

  // Gegenprobe 1: tatsaechlich disjunkte Komponenten werden weiterhin addiert.
  // ShortTermBorrowings {stBorrow} + LongTermDebtCurrent {ltCurMat}
  // + FinanceLeaseLiabilityCurrent {leaseCur} = 300 + 100 + 50 = 450.
  const disjunkt = mess({
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    ShortTermBorrowings:             secInst(allYears(300)),
    LongTermDebtCurrent:             secInst(allYears(100)),
    FinanceLeaseLiabilityCurrent:    secInst(allYears(50)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0))
  });
  assert.equal(disjunkt.shortTermDebt, 450);
  assert.equal(disjunkt.totalDebt, 1150);
  assert.equal(disjunkt.netDebtM, 1050);

  // Gegenprobe 2: ausdrueckliche Null in der Aufschluesselung aendert nichts.
  const mitNull = mess(noNoncurrentLeases({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(0))
  }));
  assert.deepEqual(mitNull, ohne);

  // Gegenprobe 3: fehlende Aufschluesselung bei vorhandenem LANGFRISTIGEM
  // Leasing ⇒ die kurzfristige Leasingtranche ist unbekannt, nicht 0.
  const ohneAufschluesselung = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(200)),
    ShortTermBorrowings:             secInst(allYears(300)),
    LongTermDebtCurrent:             secInst(allYears(100))
  }));
  const hOhne = S._computeOwcHistory(ohneAufschluesselung.fundamentals);
  assert.equal(hOhne.years.length, 0);
  assert.ok(hOhne.missing.join(' ').match(/Leasingverpflichtungen/),
    JSON.stringify(hOhne.missing));

  // Gegenprobe 4: widerspruechliche Komponenten — DebtCurrent neben
  // LongTermDebt, die sich in der laufenden Tranche ueberschneiden.
  const widerspruch = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  })));
  assert.ok((widerspruch.meta._debt_warnings || [])
    .some(w => /Gesamtverschuldung nicht bestimmt/.test(w)),
    JSON.stringify(widerspruch.meta._debt_warnings));
  assert.equal(S._resolveNetDebtForDcfBridge(widerspruch.fundamentals).available, false);
});

test('R18 unklare Gesamtschulden ergeben keine verfuegbare Nettoschuldenbruecke', () => {
  // LongTermDebt {laufende Tranche + langfristig} und DebtCurrent
  // {kurzfristig gesamt} ueberschneiden sich in der laufenden Tranche. Deren
  // Hoehe ist nicht gemeldet ⇒ die Gesamtschuld liegt irgendwo zwischen 1.000
  // und 1.150. V1.0.59 liess total_debt = 1.000 ungekennzeichnet stehen und
  // meldete netDebtM = 900 als verfuegbar.
  const mj = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  })));
  const f = mj.fundamentals;
  assert.equal(f._v4_meta.total_debt.scopeComplete, false,
    'der Teilbetrag ist als solcher gekennzeichnet');
  assert.equal(f._v4_meta.total_debt.scopeIndeterminate, true);
  assert.ok(f._v4_meta.total_debt.scopeIndeterminateReason);

  const nd = S._resolveNetDebtForDcfBridge(f);
  assert.equal(nd.available, false, 'Nettoschuldenbruecke gesperrt');
  assert.equal(nd.netDebtM, null);
  assert.ok(/bestimmen die Gesamtverschuldung nicht/.test(nd.reason || ''), nd.reason);
  // Ein bereits ABGELEITETES net_debt darf die Sperre nicht umgehen.
  assert.ok(Array.isArray(f.net_debt) && f.net_debt[0] != null,
    'die abgeleitete Reihe existiert weiterhin');
  assert.equal(f._v4_meta.net_debt.source_type, 'derived');

  // Bewertung: kein Eigenkapitalwert, aber der operative Unternehmenswert
  // bleibt getrennt ausgewiesen.
  const r = S.modelDcf(mj, scOf(8, 2, 10, 20));
  assert.equal(r.applicable, false);
  assert.equal(r.base, null);
  assert.equal(r._netDebtM, null);
  assert.ok(r._operatingValuePerShareBase > 0,
    'operativer Wert je Aktie bleibt bestehen: ' + r._operatingValuePerShareBase);

  // Alle DCF-Wege tragen denselben Status.
  const mid = S.modelDcfMidcycle ? S.modelDcfMidcycle(mj, scOf(8, 2, 10, 20)) : null;
  if (mid) assert.ok(mid.base == null,
    'Mid-Cycle liefert ebenfalls keinen Eigenkapitalwert, erhalten: ' + mid.base);
  const rev = S.solveReverseDcfGrowth(mj, {});
  assert.notEqual(rev.status, 'ok', 'Reverse DCF ohne Nettoschulden nicht loesbar: ' + rev.status);
  const matrix = S.computeSensitivityMatrix(mj);
  const zellen = (matrix && matrix.rows ? matrix.rows : []).flatMap(z => z.cells || []);
  assert.equal(zellen.some(c => c && c.value != null), false,
    'Sensitivitaetsmatrix liefert keine Eigenkapitalwerte');
  const mc = S.runMonteCarloDcf(mj, { runs: 50, seed: 4242 });
  assert.ok(!mc || mc.ok !== true || mc.median == null,
    'Monte Carlo liefert keinen Median: ' + JSON.stringify(mc && mc.median));

  // Eigenstaendig belegte Nettoschulden bleiben ausdruecklich zulaessig.
  const manuell = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  })));
  manuell.fundamentals.net_debt = [850, 850, 850, 850];
  manuell.fundamentals._v4_meta.net_debt = {
    source_type: 'reported', source_reference: 'manuelle Angabe', confidence: 'high'
  };
  const ndM = S._resolveNetDebtForDcfBridge(manuell.fundamentals);
  assert.equal(ndM.available, true, 'manuell gesetzte Nettoschulden werden nicht verworfen');
  assert.equal(ndM.netDebtM, 850);

  // Gegenprobe: ohne Ueberschneidung bleibt alles verfuegbar.
  const klar = importSecFacts(secFactsWithDebt(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(1000)),
    DebtCurrent:            secInst(allYears(150))
  })));
  assert.equal(klar.fundamentals._v4_meta.total_debt.scopeComplete, true);
  assert.equal(S._resolveNetDebtForDcfBridge(klar.fundamentals).available, true);
  assert.equal(S.modelDcf(klar, scOf(8, 2, 10, 20)).applicable, true);
});

test('R19 TTM: die Herkunft der Schuldenreihen bleibt erhalten — kein Altdatenfall', () => {
  // Die TTM-Sicht schreibt `source_reference` auf "TTM aus normalisierten
  // Quartalsdaten (…)" um. Ohne den urspruenglichen us-gaap-Tag saehe eine
  // TTM-Schuldenreihe aus wie eine Reihe ganz ohne Herkunft — und wuerde wie
  // ein manueller Altdatensatz behandelt, in dem Ueberschneidungen nicht mehr
  // erkennbar sind und die Restgroesse wieder zulaessig waere.
  const meta = { source_type: 'derived',
                 source_reference: 'TTM aus normalisierten Quartalsdaten (10-Q)',
                 source_tag: 'DebtCurrent', source_tag_inherited: true };
  assert.equal(S._secSourceTag(meta), 'DebtCurrent',
    'source_tag hat Vorrang vor der umgeschriebenen source_reference');
  assert.equal(S._secSourceTag({ source_reference: 'TTM aus normalisierten Quartalsdaten (10-Q)' }),
    null, 'ohne source_tag bleibt die Herkunft unbekannt');

  // Eine Reihe MIT Perioden, aber OHNE bestimmbare Herkunft ist kein
  // Altdatenfall: die Restgroesse bleibt gesperrt.
  const f = {
    revenue: [1000, 1000, 1000, 1000],
    current_assets: [400, 400, 400, 400],
    current_liabilities: [500, 500, 500, 500],
    cash_and_equivalents: [100, 100, 100, 100],
    total_debt: [1000, 1000, 1000, 1000],
    long_term_debt: [700, 700, 700, 700],
    _v4_meta: {}
  };
  const per = ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31'];
  ['revenue', 'current_assets', 'current_liabilities', 'cash_and_equivalents',
   'total_debt', 'long_term_debt'].forEach(k => {
    f._v4_meta[k] = { source_type: 'derived', periods: per.slice(),
                      source_reference: 'TTM aus normalisierten Quartalsdaten (10-Q)' };
  });
  const h = S._computeOwcHistory(f);
  assert.equal(h.periodKeyed, true, 'Periodenkontext wird erkannt');
  assert.equal(h.years.length, 0,
    'ohne bestimmbaren Umfang entsteht keine kurzfristige Finanzschuld aus 1000 − 700');

  // Mit erhaltener Herkunft wird dieselbe Reihe wieder auswertbar:
  // LongTermDebtNoncurrent 700 und DebtCurrent 300 sind disjunkt.
  const f2 = JSON.parse(JSON.stringify(f));
  f2.debt_short_term = [300, 300, 300, 300];
  f2._v4_meta.debt_short_term = { source_type: 'derived', periods: per.slice(),
    source_reference: 'TTM aus normalisierten Quartalsdaten (10-Q)', source_tag: 'DebtCurrent' };
  f2._v4_meta.long_term_debt.source_tag = 'LongTermDebtNoncurrent';
  f2._v4_meta.total_debt.source_tag = 'DebtAndCapitalLeaseObligations';
  const h2 = S._computeOwcHistory(f2);
  assert.equal(h2.years.length, 4);
  assert.equal(h2.years[0].shortTermDebt, 300);
  assert.equal(h2.years[0].shortTermDebtStatus, 'measured');
  assert.equal(h2.years[0].owc, 100);
});

test('R20 eine gemeinsame Semantiktabelle fuer Rebuild und Resolver', () => {
  // Der Auftrag verlangt EINE Definition der Tag-Umfaenge. Die Tabelle wird
  // hier gegen die Auftragsvorgabe (FASB-Taxonomie 2025) geprueft.
  const cells = evalInApp('DEBT_TAG_CELLS');
  const st    = Array.from(evalInApp('DEBT_CELLS_SHORT_TERM'));
  assert.deepEqual(st, ['stBorrow', 'ltCurMat', 'leaseCur']);

  const of = (t) => Array.from(cells[t]).sort();
  // langfristig/noncurrent klassifizierte Schulden UND Leasingverpflichtungen
  assert.deepEqual(of('LongTermDebtAndCapitalLeaseObligations'), ['debtNC', 'leaseNC']);
  // kurzfristig/current klassifizierte Schulden EINSCHLIESSLICH Leasing
  assert.deepEqual(of('DebtCurrent'), ['leaseCur', 'ltCurMat', 'stBorrow']);
  // kurz- UND langfristige Schulden einschliesslich Leasing
  assert.deepEqual(of('DebtAndCapitalLeaseObligations'),
    ['debtNC', 'leaseCur', 'leaseNC', 'ltCurMat', 'stBorrow']);
  // langfristig/noncurrent OHNE Leasing
  assert.deepEqual(of('LongTermDebtNoncurrent'), ['debtNC']);
  // kurzfristiger Anteil langfristiger Schulden OHNE Leasing
  assert.deepEqual(of('LongTermDebtCurrent'), ['ltCurMat']);

  // Die frueheren, fachlich falschen Merkmalstabellen existieren nicht mehr.
  assert.throws(() => evalInApp('DEBT_TAG_SCOPE'), /not defined/);
  assert.throws(() => evalInApp('STD_TAGS_INCLUDING_CURRENT_LTD'), /not defined/);
});

test('B6 BEFUND: Verwaesserung endet im Terminalwert bei Jahr 10', () => {
  // Befund A-5: forecastDcfCore() teilt den Terminalwert durch sharesYear[10].
  // Ab Jahr 11 wirkt die projizierte Verwaesserung nicht mehr, obwohl die
  // Anzeige sie als "im Hauptwert beruecksichtigt" ausweist.
  const sd = [125.971, 116.640, 108.0, 100.0];   // 3J-CAGR = +8 %/y (Clamp-Grenze)
  const mj = refMj({ shares_diluted: sd, net_debt: [0] });
  const fi = S.buildForecastInputs(mj);
  assert.ok(Math.abs(fi.sharesGrowthPa - 8) < 1e-3);

  const r = S.forecastDcfCore(fi, 0, 2, 10, { enabled: false }, 20);
  const s10 = r._sharesYear10;
  assert.ok(Math.abs(r.pvTv - (r._pvTvAbs / s10)) < 1e-12,
    'BEFUND A-5: Terminalwert wird durch die Aktienzahl des Jahres 10 geteilt');

  // Unabhaengige Gegenrechnung mit fortlaufender Verwaesserung:
  // Wert je Aktie waechst in der ewigen Rente mit (1+tg)/(1+d) − 1.
  const w = 0.10, tg = 0.02, d = 0.08;
  const fcff11 = 150 * (1 + tg);                 // FCFF Jahr 11 (kein Umsatzwachstum in Phase 1)
  const gEff = (1 + tg) / (1 + d) - 1;
  const pvTvDiluted = ((fcff11 / (s10 * (1 + d))) / (w - gEff)) / Math.pow(1 + w, 10);
  assert.ok(r.pvTv / pvTvDiluted > 2.0,
    'BEFUND A-5: Terminalwert je Aktie ' + r.pvTv.toFixed(4) +
    ' vs. ' + pvTvDiluted.toFixed(4) + ' bei fortlaufender Verwaesserung');

  const dcf = S.modelDcf(mj, scOf(0, 2, 10, 20));
  assert.ok((dcf.warnings || []).some(w2 => /im Hauptwert beruecksichtigt|im Hauptwert berücksichtigt/.test(w2)),
    'Anzeige behauptet Beruecksichtigung');
  assert.ok(!(dcf.warnings || []).some(w2 => /Terminalwert/.test(w2) && /Verw/.test(w2)),
    'BEFUND A-5: kein Hinweis, dass die Verwaesserung im Terminalwert endet');
});

test('B7 BEFUND: computeMidCycleFcf setzt fehlende D&A still auf 0', () => {
  // Befund A-6: daTtm = (ebitda[0] − ebit[0]) sonst 0. Entgegen der
  // V1.0.56-Regel ("fehlende Werte sind nicht 0") geht der ausgewiesene
  // Referenz-FCF und die 30-%-Abweichungswarnung damit von D&A = 0 aus.
  const mk = (ebitda) => ({
    meta: { sub_classification: 'cyclical' },
    fundamentals: {
      revenue: [1000, 1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200, 200],
      ebitda, capex: [50, 50, 50, 50, 50], shares_diluted: [100, 100, 100, 100, 100]
    },
    valuation: { wacc_components: { tax_rate: 25 } }, market: {}
  });
  const mitDa  = S.computeMidCycleFcf(mk([250, 250, 250, 250, 250]));
  const ohneDa = S.computeMidCycleFcf(mk([null, 250, 250, 250, 250]));
  assert.equal(mitDa.status, 'ok');
  assert.equal(ohneDa.status, 'ok', 'BEFUND A-6: kein Status "nicht belegt"');
  // Von Hand: NOPAT 150 + D&A 50 − CapEx 50 = 150 gegen 150 + 0 − 50 = 100.
  assert.ok(Math.abs(mitDa.value - 150) < 1e-9, 'erhalten ' + mitDa.value);
  assert.ok(Math.abs(ohneDa.value - 100) < 1e-9,
    'BEFUND A-6: stille Nullannahme, erhalten ' + ohneDa.value);
});

test('B8 BEFUND: Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie', () => {
  // Befund A-7: Der Synthesizer liest den Rueckkauf-Zuschlag ausschliesslich
  // aus modelResults['dcf'] / ['DCF']. Fuer zyklische Titel laeuft der DCF
  // aber unter dem Schluessel 'dcf_midcycle' (router.activeModels), sodass
  // ein starker Buyback-Uplift keinen Sicherheitszuschlag mehr ausloest.
  const mj = {
    meta: { sub_classification: 'cyclical' },
    fundamentals: {
      revenue: [1000, 1000, 1000, 1000, 1000, 1000],
      ebit:    [300, 100, 150, 200, 150, 100],
      ebitda:  [350, 150, 200, 250, 200, 150],
      capex:   [50, 50, 50, 50, 50, 50],
      shares_diluted: [70, 76, 83, 90, 98, 107],   // ca. −8 %/y (Clamp-Grenze)
      net_debt: [500]
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 20 }
  };
  const sc = S.buildScenarios(mj);
  const r = S.modelDcfMidcycle(mj, sc);
  assert.ok(r._buybackUpliftPct > 25,
    'Uplift ' + r._buybackUpliftPct.toFixed(1) + ' % wuerde +10pp MoS ausloesen');
  // Der Synthesizer findet dieses Ergebnis unter 'dcf' nicht.
  const modelResults = { dcf_midcycle: r };
  const gefunden = modelResults['dcf'] || modelResults['DCF'];
  assert.equal(gefunden, undefined, 'BEFUND A-7: Zuschlag bleibt aus');
});

// ═══════════════════════════════════════════════════════════════════════════
// R21–R25 (Regression, Korrekturchat 12B.2) — die fuenf Restbefunde nach
// 12B.1. Erwartungswerte unabhaengig nachgerechnet.
// ═══════════════════════════════════════════════════════════════════════════

// Bewertungsgroeszen eines Datensatzes in einem Griff.
const messen = (tags) => {
  const mj = importSecFacts(secFactsWithDebt(tags));
  const f  = mj.fundamentals;
  const h  = S._computeOwcHistory(f);
  const nd = S._resolveNetDebtForDcfBridge(f);
  const r  = S.modelDcf(mj, scOf(8, 2, 10, 20));
  return {
    mj, f,
    totalDebt: (f.total_debt && f.total_debt[0] != null) ? f.total_debt[0] : null,
    scopeComplete: (f._v4_meta.total_debt || {}).scopeComplete,
    shortTermDebt: h.years[0] ? h.years[0].shortTermDebt : null,
    owcRatio: h.years[0] ? h.years[0].ratio : null,
    ndAvailable: nd.available, netDebtM: nd.netDebtM, ndReason: nd.reason || null,
    applicable: r.applicable, fairValue: r.base,
    operPerShare: r._operatingValuePerShareBase
  };
};

test('R21 zusammengefasste langfristige Betraege werden vollstaendig einbezogen', () => {
  // Wirtschaftlich EINE Bilanz in zwei zulaessigen Darstellungen.
  // Von Hand: noncurrent Schulden 700 + noncurrent Leasing 300 + kurzfristig
  // gesamt 300 = 1.300; Zahlungsmittel 100 ⇒ Nettoschulden 1.200.
  // V1.0.60 bildete in Darstellung A nur 1.000 (Nettoschulden 900,
  // Fair Value ~19,61913), weil der direkte, zusammengefasste Betrag nicht
  // als Evidenz zaehlte, sondern nur als Vergleichswert.
  const A = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst(allYears(300))
  });
  const B = messen({
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(300)),
    DebtCurrent:                     secInst(allYears(300))
  });
  assert.equal(A.totalDebt, 1300, 'disjunkte current- und noncurrent-Angaben werden zusammengefuehrt');
  assert.equal(A.netDebtM, 1200);
  assert.equal(A.shortTermDebt, 300);
  assert.equal(A.owcRatio, 0.10);
  assert.equal(A.scopeComplete, true);
  assert.ok(Math.abs(A.fairValue - 16.61913) < 1e-4, 'Fair Value ' + A.fairValue);
  for (const k of ['totalDebt', 'netDebtM', 'shortTermDebt', 'owcRatio', 'applicable', 'fairValue']) {
    assert.deepEqual(B[k], A[k], 'Darstellung B weicht in ' + k + ' ab: ' + B[k] + ' vs. ' + A[k]);
  }

  // Ein direkt gemeldeter VOLLSTAENDIGER Gesamtbetrag mit ergaenzenden
  // Aufschluesselungen darf nicht doppelt zaehlen.
  const redundant = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst(allYears(300)),
    LongTermDebtNoncurrent:                 secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent:        secInst(allYears(300))
  });
  assert.equal(redundant.totalDebt, 1300, 'kein Doppelzaehlen durch redundante Aufschluesselung');
  assert.equal(redundant.netDebtM, 1200);
  assert.equal(redundant.shortTermDebt, 300);

  // Eine unvollstaendige Komponentensumme ersetzt den vollstaendigeren Betrag
  // nicht und verdeckt die fehlende Ergaenzung nicht.
  const nurNoncurrent = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    LongTermDebtNoncurrent:                 secInst(allYears(700))
  });
  assert.equal(nurNoncurrent.scopeComplete, false);
  assert.equal(nurNoncurrent.ndAvailable, false);
});

test('R22 TTM umgeht die Schuldensperre nicht und uebernimmt den Tag nicht blind', () => {
  // (a) Die Unklarheit bleibt am TTM-Stichtag bestehen ⇒ weiterhin gesperrt.
  const mjA = importSecFacts(secQuarterlyFactsWithDebt(noNoncurrentLeases({
    LongTermDebt: secQInst(qAllYears(1000)),
    DebtCurrent:  secQInst(qAllYears(150))
  })));
  assert.equal(S._resolveNetDebtForDcfBridge(mjA.fundamentals).available, false,
    'Jahressicht sperrt');
  const vA = ttmViewOf(mjA);
  assert.equal(vA.resolved.basis, 'ttm');
  assert.notEqual(vA.view, mjA, 'eine TTM-Sicht ist entstanden');
  const fA = vA.view.fundamentals;
  assert.equal(fA._v4_meta.total_debt.scopeComplete, false,
    'die Sicht bestimmt den Umfang fuer IHREN Stichtag — und er bleibt offen');
  assert.equal(S._resolveNetDebtForDcfBridge(fA).available, false,
    'die TTM-Sicht umgeht die Sperre nicht');
  // Ein neu abgeleitetes net_debt darf die Sperre ebenfalls nicht umgehen.
  assert.deepEqual(Array.from(fA.net_debt || []), [],
    'kein abgeleitetes net_debt bei unbelegtem Umfang');
  assert.equal(fA._v4_meta.net_debt.source_type, 'unavailable');
  assert.equal(S.modelDcf(vA.view, scOf(8, 2, 10, 20)).applicable, false);

  // (b) Zusaetzliche periodengleiche Quartalsangaben loesen sie auf.
  //     Von Hand: 1.000 + 150 − 100 (bekannte Ueberschneidung) = 1.050;
  //     Zahlungsmittel 100 ⇒ Nettoschulden 950.
  const mjB = importSecFacts(secQuarterlyFactsWithDebt(noNoncurrentLeases({
    LongTermDebt:        secQInst(qAllYears(1000)),
    DebtCurrent:         secQInst(qAllYears(150)),
    LongTermDebtCurrent: secQInst(qAllYears(100))
  })));
  const vB = ttmViewOf(mjB);
  const fB = vB.view.fundamentals;
  assert.equal(fB._v4_meta.total_debt.scopeComplete, true,
    'die FY-Sperre wird nicht pauschal kopiert — neue Quartalsangaben loesen sie auf');
  assert.equal(fB.total_debt[0], 1050);
  const ndB = S._resolveNetDebtForDcfBridge(fB);
  assert.equal(ndB.available, true);
  assert.equal(ndB.netDebtM, 950);
  assert.equal(S.modelDcf(vB.view, scOf(8, 2, 10, 20)).applicable, true);

  // (c) Herkunft: die Sicht nennt den Tag der QUARTALSDATEN, nicht den der
  //     Jahresreihe. In (b) traegt die Jahresreihe nach dem Rebuild gar keinen
  //     Tag mehr — blind uebernommen waere die Herkunft verloren.
  assert.equal(fB._v4_meta.total_debt.source_tag, 'LongTermDebt');
  assert.equal(fB._v4_meta.total_debt.source_tag_inherited, false);
  assert.equal(S._secSourceTag(mjB.fundamentals._v4_meta.total_debt), null,
    'die Jahresreihe traegt nach dem Rebuild keinen Tag');

  // Fehlende TTM-Komponenten werden nicht still aus Jahresdaten ergaenzt:
  // die kurzfristige Reihe der Sicht traegt TTM-Stichtage, keine Jahresenden.
  assert.equal(fB._v4_meta.debt_short_term.period_type, 'Stichtag');
  assert.ok(Array.isArray(fB._v4_meta.debt_short_term.periods));
});

test('R23 noncurrent-Teilbetraege sind keine vollstaendige Gesamtschuld', () => {
  // BERICHTIGT gegenueber 12B.1: dort blieb der rein langfristige Teilbetrag
  // ausdruecklich als Gesamtschuld in Gebrauch, begruendet damit, der Fall
  // waere sonst nicht bewertbar. Das ist keine zulaessige Ausnahme.
  const nur = messen({ LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)) });
  assert.equal(nur.scopeComplete, false);
  assert.equal(nur.ndAvailable, false, 'keine Nettoschulden aus einem Teilbetrag');
  assert.equal(nur.netDebtM, null);
  assert.equal(nur.applicable, false);
  assert.equal(nur.fairValue, null);
  assert.ok(nur.operPerShare > 0, 'der operative Unternehmenswert bleibt separat verfuegbar');

  // Ergaenzung nur bei periodengleicher Bestimmung des fehlenden Umfangs.
  const ergaenzt = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst(allYears(300))
  });
  assert.equal(ergaenzt.scopeComplete, true);
  assert.equal(ergaenzt.netDebtM, 1200);
  // Eine Angabe zu einem ANDEREN Stichtag ergaenzt nichts.
  const stale = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst({ 2024: 300, 2023: 300, 2022: 300 })
  });
  assert.equal(stale.scopeComplete, false);
  assert.equal(stale.ndAvailable, false);

  // Fehlende Angaben sind nicht deshalb Null, weil kein Tag gefunden wurde.
  // Ausdrueckliche Nullwerte funktionieren dagegen weiterhin.
  const explizitNull = messen({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst(allYears(0))
  });
  assert.equal(explizitNull.scopeComplete, true);
  assert.equal(explizitNull.totalDebt, 1000);
  assert.equal(explizitNull.netDebtM, 900);
  assert.equal(explizitNull.shortTermDebt, 0);

  // Ein eigenstaendig belegter vollstaendiger Gesamtbetrag genuegt allein.
  const gesamt = messen({ DebtAndCapitalLeaseObligations: secInst(allYears(1300)) });
  assert.equal(gesamt.scopeComplete, true);
  assert.equal(gesamt.netDebtM, 1200);

  // Manuelle OWC-Annahme loest die unklare Gesamtschuld NICHT auf.
  const mjOv = JSON.parse(JSON.stringify(nur.mj));
  mjOv.valuation.assumptions = { owc_pct_of_revenue: { value: 12 } };
  assert.equal(S.modelDcf(mjOv, scOf(8, 2, 10, 20)).applicable, false);

  // Ausdruecklich manuell gesetzte Nettoschulden bleiben zulaessig.
  const mjNd = JSON.parse(JSON.stringify(nur.mj));
  mjNd.fundamentals.net_debt = [880, 880, 880, 880];
  mjNd.fundamentals._v4_meta.net_debt = {
    source_type: 'reported', source_reference: 'manuelle Angabe', confidence: 'high'
  };
  const ndM = S._resolveNetDebtForDcfBridge(mjNd.fundamentals);
  assert.equal(ndM.available, true);
  assert.equal(ndM.netDebtM, 880);
});

test('R24 bekannte Ueberschneidungen werden aufgeloest statt gesperrt', () => {
  // us-gaap:LongTermDebt {laufende Tranche + langfristig} und DebtCurrent
  // {kurzfristig gesamt} ueberschneiden sich in der laufenden Tranche. Ist
  // LongTermDebtCurrent gemeldet, ist der gemeinsame Anteil BEKANNT:
  // 1.000 + 150 − 100 = 1.050. Ohne Angabe zum langfristigen Leasing bleibt
  // die Gesamtschuld allerdings ohnehin offen — der Fall wird deshalb mit
  // einer ausdruecklichen Null dafuer geprueft.
  const geloest = messen(noNoncurrentLeases({
    LongTermDebt:        secInst(allYears(1000)),
    DebtCurrent:         secInst(allYears(150)),
    LongTermDebtCurrent: secInst(allYears(100))
  }));
  assert.equal(geloest.scopeComplete, true);
  assert.equal(geloest.totalDebt, 1050);
  assert.equal(geloest.netDebtM, 950);
  assert.equal(geloest.shortTermDebt, 150);
  assert.equal(geloest.applicable, true);

  // Reihenfolge und zusaetzliche redundante Aufschluesselungen aendern nichts.
  const andereReihenfolge = messen(noNoncurrentLeases({
    LongTermDebtCurrent: secInst(allYears(100)),
    DebtCurrent:         secInst(allYears(150)),
    LongTermDebt:        secInst(allYears(1000))
  }));
  assert.equal(andereReihenfolge.totalDebt, 1050);
  assert.equal(andereReihenfolge.netDebtM, 950);

  // Zusaetzlich kurzfristiges Leasing, das in DebtCurrent bereits enthalten ist.
  const mitLeasing = messen(noNoncurrentLeases({
    LongTermDebt:                 secInst(allYears(1000)),
    DebtCurrent:                  secInst(allYears(150)),
    LongTermDebtCurrent:          secInst(allYears(100)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(30))
  }));
  assert.equal(mitLeasing.totalDebt, 1050, 'kein Doppelzaehlen des kurzfristigen Leasings');
  assert.equal(mitLeasing.netDebtM, 950);
  assert.equal(mitLeasing.shortTermDebt, 150);

  // Gegenprobe ohne LongTermDebtCurrent: die Ueberschneidung bleibt unbekannt.
  const offen = messen(noNoncurrentLeases({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  }));
  assert.equal(offen.scopeComplete, false);
  assert.equal(offen.ndAvailable, false);
  assert.equal(offen.applicable, false);

  // Eine anderweitige Datenluecke wird getrennt benannt und nicht faelschlich
  // als unbekannte Ueberschneidung bezeichnet: hier fehlt das langfristige
  // Leasing, die Ueberschneidung ist dagegen bekannt.
  const nurLeasingOffen = messen({
    LongTermDebt:        secInst(allYears(1000)),
    DebtCurrent:         secInst(allYears(150)),
    LongTermDebtCurrent: secInst(allYears(100))
  });
  assert.equal(nurLeasingOffen.scopeComplete, false);
  assert.ok(/[Ll]angfristige Leasingverpflichtungen/.test(
    nurLeasingOffen.f._v4_meta.total_debt.scopeIndeterminateReason || ''),
    nurLeasingOffen.f._v4_meta.total_debt.scopeIndeterminateReason);
});

test('R25 widerspruechliche Aufschluesselungen werden erkannt', () => {
  // Ein enthaltener nichtnegativer Teilbetrag kann nicht groesser sein als die
  // Gesamtheit: FinanceLeaseLiabilityCurrent 350 liegt in DebtCurrent 300.
  // V1.0.60 uebersprang den Wert nur als "bereits enthalten"; OWC und
  // Bewertung blieben ohne Widerspruchsmeldung verfuegbar.
  const w = messen({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(350))
  });
  assert.equal(w.scopeComplete, false);
  assert.equal(w.ndAvailable, false, 'keine gemessene Schuldenbasis bei offenem Widerspruch');
  assert.equal(w.applicable, false);
  assert.equal(w.shortTermDebt, null, 'auch das Working Capital erhaelt den Status');
  assert.ok((w.mj.meta._debt_warnings || []).some(x => /nicht größer sein/.test(x)),
    JSON.stringify(w.mj.meta._debt_warnings));

  // Aufschluesselung, die der Gesamtangabe widerspricht, ohne dass eine
  // einzelne Teilangabe sie uebersteigt: DebtCurrent 300 umfasst
  // {Bankschulden, laufende Faelligkeiten, kurzfristiges Leasing}; gemeldet
  // sind laufende Faelligkeiten 100 und kurzfristiges Leasing 250 — zusammen
  // 350. Rechnerisch waeren die Bankschulden −50, also unmoeglich.
  // (Ohne ShortTermBorrowings, weil die Tag-Kette von `debt_short_term` sonst
  //  dieses statt DebtCurrent waehlt und der Widerspruch gar nicht entstuende.)
  const gleich = messen({
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0)),
    DebtCurrent:                     secInst(allYears(300)),
    LongTermDebtCurrent:             secInst(allYears(100)),
    FinanceLeaseLiabilityCurrent:    secInst(allYears(250))
  });
  assert.equal(gleich.scopeComplete, false);
  assert.equal(gleich.ndAvailable, false);
  // V1.0.62 (Korrekturchat 12B.3): Derselbe Befund, praezisere Begruendung.
  // Bis V1.0.61 fiel dieser Fall in die generische Meldung ueber einen
  // negativen Zellwert („unvereinbar"); jetzt nennt die Pruefung auf disjunkte
  // Teilangaben beide Bestandteile und die Gesamtangabe beim Namen.
  assert.ok((gleich.mj.meta._debt_warnings || [])
    .some(x => /uebersteigen zusammen|übersteigen zusammen|unvereinbar/.test(x)),
    JSON.stringify(gleich.mj.meta._debt_warnings));
  // Keine willkuerliche Auswahl nach Reihenfolge oder groesserem Wert:
  // weder 300 noch 350 wird stillschweigend uebernommen.
  assert.equal(gleich.totalDebt, null);

  // Konsistente Aufschluesselung und ausdrueckliche Null aendern nichts.
  const ref = messen(noNoncurrentLeases({
    LongTermDebtNoncurrent: secInst(allYears(700)),
    DebtCurrent:            secInst(allYears(300))
  }));
  const konsistent = messen(noNoncurrentLeases({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(50))
  }));
  const mitNull = messen(noNoncurrentLeases({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(0))
  }));
  assert.equal(ref.totalDebt, 1000);
  assert.equal(ref.netDebtM, 900);
  for (const k of ['totalDebt', 'netDebtM', 'shortTermDebt', 'owcRatio', 'fairValue']) {
    assert.deepEqual(konsistent[k], ref[k], 'konsistente Aufschluesselung aendert ' + k);
    assert.deepEqual(mitNull[k], ref[k], 'ausdrueckliche Null aendert ' + k);
  }

  // Zulaessige Rundung (0,01 % der groessten Angabe) bleibt zulaessig.
  const rundung = messen(noNoncurrentLeases({
    LongTermDebtNoncurrent:       secInst(allYears(700)),
    DebtCurrent:                  secInst(allYears(300)),
    FinanceLeaseLiabilityCurrent: secInst(allYears(300.05))
  }));
  assert.equal(rundung.scopeComplete, true, 'Rundung ist kein materieller Widerspruch');
});

test('R26 gesperrte DCF-Werte erhalten keine Gewichtung und keine Einstiegszone', () => {
  // Echter Engine-/Synthesizer-Pfad.
  const mj = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000))
  }), { price: 20 });
  const v = S.runValuationEngine(mj);
  const dcf = (v.modelResults || {}).dcf;
  assert.ok(dcf, 'das DCF-Modell laeuft');
  assert.equal(dcf.applicable, false);
  assert.equal(dcf.base, null);
  assert.equal(dcf._excludedFromSynthesis, true);
  assert.ok(dcf._operatingValuePerShareBase > 0);

  // SYNTHESIS_CONFIG ist eine Top-Level-Konstante und liegt nicht auf dem
  // Sandbox-Objekt; sie wird im selben Kontext ausgewertet.
  const CFG = evalInApp('SYNTHESIS_CONFIG');
  const syn = S.runFairValueSynthesizer(mj, v, S.runQualityEngine(mj),
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
  const gewichtet = Array.isArray(syn && syn._modelWeightDiag)
    ? syn._modelWeightDiag.some(d => d && d.model === 'dcf') : false;
  assert.equal(gewichtet, false, 'der gesperrte DCF wird nicht gewichtet');

  // Statusweitergabe an die uebrigen Wege.
  assert.ok(S.modelDcfMidcycle(mj, S.buildScenarios(mj)).base == null,
    'Mid-Cycle liefert keinen Eigenkapitalwert');
  assert.notEqual(S.solveReverseDcfGrowth(mj, {}).status, 'ok');
  const matrix = S.computeSensitivityMatrix(mj, v);
  const zellen = (matrix && matrix.rows ? matrix.rows : []).flatMap(z => z.cells || []);
  assert.equal(zellen.some(c => c && c.value != null), false);
  const mc = S.runMonteCarloDcf(mj, v);
  assert.ok(!mc || mc.ok !== true || mc.median == null);
});

test('R27 wiederholte Aufbereitung ist stabil', () => {
  // Weder Warnungen vervielfachen sich noch bleiben ueberholte Sperren stehen.
  const mj = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    DebtCurrent:                            secInst(allYears(300))
  }));
  const vorher = JSON.stringify(mj.fundamentals.total_debt);
  const warnVorher = (mj.meta._debt_warnings || []).length;
  S.applyDerivedFieldsV4(mj);
  S.applyDerivedFieldsV4(mj);
  assert.equal(JSON.stringify(mj.fundamentals.total_debt), vorher,
    'die Gesamtschuld bleibt bei erneuter Aufbereitung gleich');
  assert.equal(mj.fundamentals._v4_meta.total_debt.scopeComplete, true);
  assert.equal((mj.meta._debt_warnings || []).length, warnVorher,
    'keine vervielfachten Warnungen');

  // Eine tatsaechlich behobene Datenluecke hebt die Sperre auf.
  const luecke = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst(allYears(1000))
  }));
  assert.equal(luecke.fundamentals._v4_meta.total_debt.scopeComplete, false);
  luecke.fundamentals.debt_short_term = [300, 300, 300, 300];
  luecke.fundamentals._v4_meta.debt_short_term = {
    source_type: 'reported', source_reference: 'SEC EDGAR XBRL: DebtCurrent',
    confidence: 'high', periods: luecke.fundamentals._v4_meta.total_debt.periods.slice()
  };
  S.applyDerivedFieldsV4(luecke);
  assert.equal(luecke.fundamentals._v4_meta.total_debt.scopeComplete, true,
    'keine veraltete Sperre nach behobener Datenluecke');
  assert.equal(S._resolveNetDebtForDcfBridge(luecke.fundamentals).netDebtM, 1200);
});

// ═══════════════════════════════════════════════════════════════════════════
// R28–R31 (Regression, Korrekturchat 12B.3) — die Nichtnegativitaetspruefung
// des gemeinsamen Schuldensolvers. Erwartungswerte von Hand nachgerechnet.
// ═══════════════════════════════════════════════════════════════════════════

test('R28 unmoegliche Schuldenaufteilung wird als Widerspruch erkannt', () => {
  // Gesamtschulden 100, aber zwei DISJUNKTE langfristige Bestandteile
  // 70 + 50 = 120. Es gibt keine nichtnegative Aufteilung: die kurzfristigen
  // Bestandteile muessten zusammen −20 betragen.
  // V1.0.61 akzeptierte das, weil keine EINZELNE Teilangabe groesser als die
  // Gesamtangabe war: total_debt galt als vollstaendig, die kurzfristigen
  // Finanzschulden wurden als −20 "measured" ausgegeben, die Referenzbilanz
  // bekam eine OWC-Quote von −22 % und der DCF lieferte ~31,43082 je Aktie.
  const w = messen({
    DebtAndCapitalLeaseObligations:  secInst(allYears(100)),
    LongTermDebtNoncurrent:          secInst(allYears(70)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(50))
  });
  assert.equal(w.scopeComplete, false, 'keine vollstaendige Gesamtschuld');
  assert.equal(w.ndAvailable, false, 'Nettoschuldenbruecke gesperrt');
  assert.equal(w.netDebtM, null);
  assert.equal(w.applicable, false, 'kein Eigenkapitalwert');
  assert.equal(w.fairValue, null);
  assert.ok(w.operPerShare > 0, 'der operative Unternehmenswert bleibt getrennt verfuegbar');
  // Keine gemessenen negativen Schulden und keine daraus gebildete Quote.
  assert.equal(w.shortTermDebt, null);
  assert.equal(w.owcRatio, null);
  const owc = S._resolveOwcForForecast(w.mj);
  assert.equal(owc.measured, false);
  assert.equal(owc.assumptionRequired, true);
  // Die Begruendung nennt beide Bestandteile und die Gesamtangabe.
  const warn = (w.mj.meta._debt_warnings || []).join(' | ');
  assert.ok(/übersteigen zusammen/.test(warn), warn);
  assert.ok(/70\.0M/.test(warn) && /50\.0M/.test(warn) && /100\.0M/.test(warn), warn);

  // Eigenstaendig belegte Nettoschulden bleiben unveraendert zulaessig.
  const mjNd = JSON.parse(JSON.stringify(w.mj));
  mjNd.fundamentals.net_debt = [42, 42, 42, 42];
  mjNd.fundamentals._v4_meta.net_debt = {
    source_type: 'reported', source_reference: 'manuelle Angabe', confidence: 'high'
  };
  const ndM = S._resolveNetDebtForDcfBridge(mjNd.fundamentals);
  assert.equal(ndM.available, true);
  assert.equal(ndM.netDebtM, 42);

  // Echter Engine-/Synthesizer-Pfad: kein Gewicht, keine Einstiegszone.
  const mjE = importSecFacts(secFactsWithDebt({
    DebtAndCapitalLeaseObligations:  secInst(allYears(100)),
    LongTermDebtNoncurrent:          secInst(allYears(70)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(50))
  }), { price: 20 });
  const v = S.runValuationEngine(mjE);
  const dcf = (v.modelResults || {}).dcf;
  assert.equal(dcf.applicable, false);
  assert.equal(dcf._excludedFromSynthesis, true);
  const CFG = evalInApp('SYNTHESIS_CONFIG');
  const syn = S.runFairValueSynthesizer(mjE, v, S.runQualityEngine(mjE),
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mjE) }));
  const gewichtet = Array.isArray(syn && syn._modelWeightDiag)
    ? syn._modelWeightDiag.some(d => d && d.model === 'dcf') : false;
  assert.equal(gewichtet, false, 'der gesperrte DCF wird nicht gewichtet');
});

test('R29 belegte Gesamtschuld 0 belegt alle Bestandteile als 0', () => {
  // Alle enthaltenen Bestandteile sind nichtnegativ; ist ihre belegte Summe 0,
  // sind sie einzeln 0. V1.0.61 erkannte zwar die Gesamtschuld 0, hielt die
  // kurzfristigen Finanzschulden aber fuer unbekannt — der Zeilenraumtest
  // allein reicht dafuer nicht.
  const z = messen({ DebtAndCapitalLeaseObligations: secInst(allYears(0)) });
  assert.equal(z.totalDebt, 0);
  assert.equal(z.scopeComplete, true);
  assert.equal(z.shortTermDebt, 0, 'kurzfristige Finanzschulden sind belegte 0');
  // Von Hand: OWC = (400 − 100) − (500 − 0) = −200 ⇒ Quote −20 % vom Umsatz 1.000.
  const h = S._computeOwcHistory(z.f);
  assert.equal(h.years.length, 4, 'alle vier Jahre sind verwertbar');
  assert.equal(h.years[0].shortTermDebtStatus, 'measured');
  assert.equal(h.years[0].owc, -200);
  assert.equal(z.owcRatio, -0.20);
  const owc = S._resolveOwcForForecast(z.mj);
  assert.equal(owc.available, true);
  assert.equal(owc.measured, true);
  assert.equal(owc.assumptionRequired, false, 'keine Nutzereingabe noetig');
  assert.equal(owc.ratio, -0.20);
  // Nettoschulden: 0 Schulden − 100 Liquiditaet = −100 (Nettoliquiditaet).
  assert.equal(z.ndAvailable, true);
  assert.equal(z.netDebtM, -100);
  assert.equal(z.applicable, true);
});

test('R30 ein Teilbetrag 0 belegt nur seine eigenen Bestandteile', () => {
  // ABGRENZUNG zu R29: `DebtCurrent` = 0 belegt die drei KURZFRISTIGEN Zellen
  // als 0 — nicht die langfristigen. Ohne Aussage zum langfristigen Leasing
  // bleibt die Gesamtschuld offen.
  const teil = messen({
    DebtCurrent:            secInst(allYears(0)),
    LongTermDebtNoncurrent: secInst(allYears(70))
  });
  assert.equal(teil.shortTermDebt, 0, 'die kurzfristigen Bestandteile sind belegte 0');
  assert.equal(teil.scopeComplete, false, 'die Gesamtschuld bleibt offen (langfr. Leasing)');
  assert.equal(teil.ndAvailable, false);
  assert.equal(teil.applicable, false);

  // Erst die ausdrueckliche Null fuer das langfristige Leasing schliesst sie.
  const voll = messen({
    DebtCurrent:                     secInst(allYears(0)),
    LongTermDebtNoncurrent:          secInst(allYears(70)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0))
  });
  assert.equal(voll.scopeComplete, true);
  assert.equal(voll.totalDebt, 70);
  assert.equal(voll.netDebtM, -30, '70 Schulden − 100 Liquiditaet');
  assert.equal(voll.shortTermDebt, 0);
});

test('R31 Mehrdeutigkeit, Bestimmtheit und Rundung im Solver', () => {
  // (a) Zulaessige Loesungen vorhanden, Zielsumme aber nicht eindeutig:
  //     Gesamt 1.000, langfristige Schulden 700 ⇒ die restlichen 300 koennen
  //     beliebig auf kurzfristige Zellen und langfristiges Leasing entfallen.
  //     Die kurzfristige Summe liegt irgendwo in [0, 300] ⇒ unbekannt.
  const mehrdeutig = messen({
    DebtAndCapitalLeaseObligations: secInst(allYears(1000)),
    LongTermDebtNoncurrent:         secInst(allYears(700))
  });
  assert.equal(mehrdeutig.scopeComplete, true, 'die Gesamtschuld ist belegt');
  assert.equal(mehrdeutig.totalDebt, 1000);
  assert.equal(mehrdeutig.netDebtM, 900);
  assert.equal(mehrdeutig.shortTermDebt, null, 'keine erfundene Eindeutigkeit');
  assert.equal(mehrdeutig.owcRatio, null);

  // (b) Zielsumme eindeutig, obwohl die Einzelzellen es nicht sind:
  //     `DebtCurrent` 300 legt die kurzfristige SUMME fest, nicht ihre
  //     Aufteilung in Bankschulden, laufende Faelligkeiten und Leasing.
  //     Von Hand: OWC = (400 − 100) − (500 − 300) = 100 ⇒ Quote +10 %.
  const bestimmt = messen({
    DebtCurrent:                     secInst(allYears(300)),
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0))
  });
  assert.equal(bestimmt.shortTermDebt, 300);
  assert.equal(bestimmt.owcRatio, 0.10);
  assert.equal(bestimmt.totalDebt, 1000);
  assert.equal(bestimmt.netDebtM, 900);

  // (c) Kleine zulaessige Rundung (0,05 von 1.000 = 0,005 %) bleibt zulaessig
  //     und erzeugt KEINE negative gemessene Schuld.
  const rundung = messen({
    DebtAndCapitalLeaseObligations:  secInst(allYears(1000)),
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(300.05))
  });
  assert.equal(rundung.scopeComplete, true);
  assert.equal(rundung.shortTermDebt, 0, 'nicht negativ, nicht willkuerlich geklemmt');
  assert.ok(rundung.shortTermDebt >= 0);

  // (d) Materiell unmoegliche Abweichung bleibt ein Widerspruch.
  const materiell = messen({
    DebtAndCapitalLeaseObligations:  secInst(allYears(1000)),
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(350))
  });
  assert.equal(materiell.scopeComplete, false);
  assert.equal(materiell.ndAvailable, false);

  // (e) Konsistente Daten bleiben unveraendert verwertbar.
  const konsistent = messen({
    DebtAndCapitalLeaseObligations:  secInst(allYears(1000)),
    LongTermDebtNoncurrent:          secInst(allYears(700)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0)),
    DebtCurrent:                     secInst(allYears(300))
  });
  assert.equal(konsistent.scopeComplete, true);
  assert.equal(konsistent.totalDebt, 1000);
  assert.equal(konsistent.shortTermDebt, 300);
  assert.equal(konsistent.netDebtM, 900);
});

test('R32 die Solverkorrektur erreicht auch die TTM-Aufloesung', () => {
  const qAll = (v) => ({ 2022: v, 2023: v, 2024: v, 2025: v });

  // (a) Unmoegliche Aufteilung: in BEIDEN Sichten gesperrt.
  const mjW = importSecFacts(secQuarterlyFactsWithDebt({
    DebtAndCapitalLeaseObligations:  secQInst(qAll(100)),
    LongTermDebtNoncurrent:          secQInst(qAll(70)),
    FinanceLeaseLiabilityNoncurrent: secQInst(qAll(50))
  }));
  assert.equal(S._resolveNetDebtForDcfBridge(mjW.fundamentals).available, false,
    'Jahressicht gesperrt');
  const vW = ttmViewOf(mjW);
  assert.equal(vW.resolved.basis, 'ttm');
  assert.notEqual(vW.view, mjW, 'eine TTM-Sicht ist entstanden');
  assert.equal(vW.view.fundamentals._v4_meta.total_debt.scopeComplete, false);
  assert.equal(S._resolveNetDebtForDcfBridge(vW.view.fundamentals).available, false,
    'die TTM-Sicht uebernimmt die Nichtnegativitaetspruefung');
  assert.equal(S.modelDcf(vW.view, scOf(8, 2, 10, 20)).applicable, false);

  // (b) Belegte Gesamtschuld 0: auch in der TTM-Sicht sind die kurzfristigen
  //     Finanzschulden belegte 0. (`long_term_debt` ist eine Pflichtreihe der
  //     TTM-Basis und wird vom Filer ausdruecklich mit 0 gemeldet.)
  const mjZ = importSecFacts(secQuarterlyFactsWithDebt({
    DebtAndCapitalLeaseObligations: secQInst(qAll(0)),
    LongTermDebtNoncurrent:         secQInst(qAll(0))
  }));
  const vZ = ttmViewOf(mjZ);
  assert.equal(vZ.resolved.basis, 'ttm');
  assert.notEqual(vZ.view, mjZ);
  const fZ = vZ.view.fundamentals;
  assert.equal(fZ._v4_meta.total_debt.scopeComplete, true);
  assert.equal(fZ.total_debt[0], 0);
  const hZ = S._computeOwcHistory(fZ);
  assert.ok(hZ.years.length > 0, 'die TTM-Sicht liefert eine Working-Capital-Historie');
  assert.equal(hZ.years[0].shortTermDebt, 0);
  assert.equal(hZ.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hZ.years[0].ratio, -0.20);
  assert.equal(S._resolveNetDebtForDcfBridge(fZ).netDebtM, -100);
});
