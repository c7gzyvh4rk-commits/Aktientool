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
         evalInApp, importSecFacts, secFactsWithDebt, secInst, allYears } from './audit-chat12.mjs';

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

test('R12 A-4 am echten Importweg: die Restgroesse aus demselben Tag ist keine Messung', () => {
  // Tag-Kette: LongTermDebtAndCapitalLeaseObligations fehlt ⇒ total_debt faellt
  // auf `LongTermDebt`, mit dem die long_term_debt-Kette beginnt. Die
  // Restgroesse ist dann strukturell 0.

  // (a) Komponente periodengleich vorhanden ⇒ sie wird verwendet, und der
  //     Komponenten-Rebuild fuehrt total_debt auf den vollen Umfang.
  const mjA = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(700)),
    ShortTermBorrowings: secInst(allYears(300))
  }));
  eqSeries(mjA.fundamentals.total_debt, [1000, 1000, 1000, 1000],
    'Rebuild ergaenzt die kurzfristigen Finanzschulden');
  const hA = S._computeOwcHistory(mjA.fundamentals);
  assert.equal(hA.years[0].shortTermDebt, 300);
  assert.equal(hA.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hA.years[0].owc, 100);
  assert.equal(hA.years[0].period, '2025-12-31');

  // (b) Kurzfristige Finanzschulden klein (20 von 720): die 5-%-Schwelle des
  //     Rebuilds greift nicht mehr blind — `LongTermDebt` kann kurzfristige
  //     Finanzschulden nachweislich nicht enthalten, also haben die
  //     Komponenten Vorrang. OWC = (400−100) − (500−20) = −180.
  const mjB = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(700)),
    ShortTermBorrowings: secInst(allYears(20))
  }));
  eqSeries(mjB.fundamentals.total_debt, [720, 720, 720, 720]);
  const hB = S._computeOwcHistory(mjB.fundamentals);
  assert.equal(hB.years[0].shortTermDebt, 20);
  assert.equal(hB.years[0].shortTermDebtStatus, 'measured');
  assert.equal(hB.years[0].owc, -180);

  // (c) Komponente NUR fuer das aktuelle Jahr gemeldet: die Vorjahre sind
  //     unbekannt und werden nicht als 0 gefuehrt — die Historie bricht ab.
  const mjC = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(700)),
    ShortTermBorrowings: secInst({ 2025: 300 })
  }));
  const hC = S._computeOwcHistory(mjC.fundamentals);
  assert.equal(hC.years.length, 1, 'nur das belegte Jahr');
  assert.equal(hC.years[0].shortTermDebt, 300);
  assert.ok(hC.missing.some(m => /2024-12-31/.test(m)), JSON.stringify(hC.missing));

  // (d) Komponente nur fuer AELTERE Jahre (stale): fuer den aktuellen Stichtag
  //     liegt nichts vor; die Restgroesse aus demselben Tag ist keine Messung.
  const mjD = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(700)),
    ShortTermBorrowings: secInst({ 2024: 300, 2023: 300, 2022: 300 })
  }));
  const hD = S._computeOwcHistory(mjD.fundamentals);
  assert.equal(hD.years.length, 0, 'kein Jahr mit belegtem Stichtagswert');
  assert.ok(hD.missing.some(m => /strukturell 0/.test(m)), JSON.stringify(hD.missing));

  // Ohne belastbare Historie gibt es keine scheinpraezise Ersatzquote.
  const owcD = S._resolveOwcForForecast(mjD);
  assert.equal(owcD.measured, false);
  assert.equal(owcD.assumptionRequired, true);
  assert.equal(owcD.available, false);
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
  const viaTotal = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(1000)),
    LongTermDebtCurrent: secInst(allYears(100))
  }));
  const viaSplit = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100))
  }));
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
  const stTotal = importSecFacts(secFactsWithDebt({
    LongTermDebt:        secInst(allYears(1000)),
    LongTermDebtCurrent: secInst(allYears(100)),
    ShortTermBorrowings: secInst(allYears(50))
  }));
  const stSplit = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100)),
    ShortTermBorrowings:    secInst(allYears(50))
  }));
  eqSeries(stTotal.fundamentals.total_debt, [1050, 1050, 1050, 1050]);
  eqSeries(stSplit.fundamentals.total_debt, [1050, 1050, 1050, 1050]);
  assert.equal(S._computeOwcHistory(stTotal.fundamentals).years[0].shortTermDebt, 150);
  assert.equal(S._computeOwcHistory(stSplit.fundamentals).years[0].shortTermDebt, 150);

  // Gegenprobe zur Ueberschneidung auf der kurzfristigen Seite:
  // us-gaap:DebtCurrent enthaelt die laufenden Faelligkeiten bereits.
  const viaDebtCurrent = importSecFacts(secFactsWithDebt({
    LongTermDebtNoncurrent: secInst(allYears(900)),
    LongTermDebtCurrent:    secInst(allYears(100)),
    DebtCurrent:            secInst(allYears(150))   // = 50 Bank + 100 laufend
  }));
  eqSeries(viaDebtCurrent.fundamentals.total_debt, [1050, 1050, 1050, 1050],
    'DebtCurrent deckt die laufende Tranche ab — keine Doppelzaehlung');
  assert.equal(S._computeOwcHistory(viaDebtCurrent.fundamentals).years[0].shortTermDebt, 150);
  assert.equal(S._resolveNetDebtForDcfBridge(viaDebtCurrent.fundamentals).netDebtM, 950);

  // Nicht aufloesbare Ueberschneidung (DebtCurrent + LongTermDebt, laufende
  // Tranche nicht gemeldet): kein erfundener Summenwert, sondern ein Hinweis.
  const unresolvable = importSecFacts(secFactsWithDebt({
    LongTermDebt: secInst(allYears(1000)),
    DebtCurrent:  secInst(allYears(150))
  }));
  eqSeries(unresolvable.fundamentals.total_debt, [1000, 1000, 1000, 1000],
    'direkter Wert bleibt stehen, keine Summe aus ueberschneidenden Tags');
  assert.ok((unresolvable.meta._debt_warnings || []).some(w => /Ueberschneidung nicht aufloesbar/.test(w)),
    JSON.stringify(unresolvable.meta._debt_warnings));
});

test('R14 O-2: Working-Capital-Historie verknuepft periodengetreu, nicht ueber den Array-Index', () => {
  // Filer mit einer Luecke in LongTermDebtNoncurrent (FY2024 fehlt). Dadurch
  // stehen an derselben Array-Position unterschiedliche Geschaeftsjahre:
  //   total_debt     [FY2025, FY2024, FY2023, FY2022] = 1000, 900, 800, 700
  //   long_term_debt [FY2025,         FY2023, FY2022] =  700,      500, 400
  // Bis V1.0.58 ergab die Indexverknuepfung fuer Position 1
  // 900 (FY2024) − 500 (FY2023) = 400 — ein plausibel aussehender, aber aus
  // zwei Geschaeftsjahren zusammengesetzter Wert.
  const mj = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst({ 2025: 1000, 2024: 900, 2023: 800, 2022: 700 }),
    LongTermDebtNoncurrent:                 secInst({ 2025: 700,             2023: 500, 2022: 400 })
  }));
  const f = mj.fundamentals;
  eqSeries(f.total_debt, [1000, 900, 800, 700]);
  eqSeries(f.long_term_debt, [700, 500, 400], 'Ausgangslage: Reihen unterschiedlich lang');
  eqSeries(f._v4_meta.long_term_debt.periods, ['2025-12-31', '2023-12-31', '2022-12-31']);

  const h = S._computeOwcHistory(f);
  assert.equal(h.periodKeyed, true);
  assert.equal(h.years.length, 1, 'nur das periodengleich belegte Jahr FY2025');
  assert.equal(h.years[0].period, '2025-12-31');
  assert.equal(h.years[0].shortTermDebt, 300, '1000 − 700, beide FY2025');
  assert.ok(h.missing.some(m => /2024-12-31/.test(m)),
    'FY2024 wird als unbestimmbar benannt: ' + JSON.stringify(h.missing));
  // Der frueher still erzeugte Mischwert 400 darf nirgends mehr auftreten.
  assert.equal(h.years.some(y => y.shortTermDebt === 400), false);

  // Gegenprobe: lueckenlose Perioden ⇒ alle vier Jahre, jeweils periodengleich.
  const full = importSecFacts(secFactsWithDebt({
    LongTermDebtAndCapitalLeaseObligations: secInst({ 2025: 1000, 2024: 900, 2023: 800, 2022: 700 }),
    LongTermDebtNoncurrent:                 secInst({ 2025: 700,  2024: 600, 2023: 500, 2022: 400 })
  }));
  const hFull = S._computeOwcHistory(full.fundamentals);
  assert.equal(hFull.years.length, 4);
  eqSeries(hFull.years.map(y => y.period),
    ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31']);
  eqSeries(hFull.years.map(y => y.shortTermDebt), [300, 300, 300, 300]);
  eqSeries(hFull.years.map(y => y.owc), [100, 100, 100, 100]);

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
  const variants = {
    'Noncurrent + Current': {
      LongTermDebtNoncurrent: secInst(allYears(700)),
      LongTermDebtCurrent:    secInst(allYears(300))
    },
    'LongTermDebt (gesamt) + Current': {
      LongTermDebt:        secInst(allYears(1000)),
      LongTermDebtCurrent: secInst(allYears(300))
    },
    'LongTermDebt (nur nichtlaufend) + ShortTermBorrowings': {
      LongTermDebt:        secInst(allYears(700)),
      ShortTermBorrowings: secInst(allYears(300))
    }
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
