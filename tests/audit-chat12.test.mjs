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
//   B) BEFUND-NACHWEIS (characterization) — hielten eine im Audit
//      BESTAETIGTE Abweichung fest. Sie behaupteten NICHT, dass das Verhalten
//      richtig ist. Nach Korrekturchat 12C existiert KEIN solcher Test mehr:
//      B1-B4 wurden in 12A zu R1-R9, B5 in 12B zu R10-R15, B6/B7/B8 in 12C zu
//      R33/R34/R35. Alle Tests dieser Datei pruefen jetzt richtiges Verhalten.
//      Siehe AUDIT-CHAT12.md.
//
//   R) REGRESSION — pruefen das richtige Verhalten nach einer Korrektur.
//      R33 ist dabei besonders einzuordnen: A-5 ist eine OFFENGELEGTE
//      MODELLVEREINFACHUNG. Die Rechnung ist bit-genau unveraendert; geprueft
//      wird die erklaerte Konvention und ihr sichtbarer Hinweis.
// ═══════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { app, APP_FILE, refMj, scOf, refValuePerShare,
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
// B) BEFUND-NACHWEISE — hier steht keiner mehr.
//
// KORREKTURCHAT 12A (V1.0.58): A-1, A-2, A-3 behoben, B1–B4 → R1–R9.
// KORREKTURCHAT 12B (V1.0.59): A-4 behoben, B5 → R10–R15.
// KORREKTURCHAT 12C (V1.0.63): B6 → R33 (A-5, offengelegte Modellannahme),
//   B7 → R34 (A-6 behoben), B8 → R35 (A-7 behoben, echter Engine-/
//   Synthesizer-Pfad statt nachgebildeter Schluesselauswahl).
// Alle Tests dieser Datei pruefen damit richtiges Verhalten. Bleibt ein
// Charakterisierungstest noetig, muss er im Namen "BEFUND" tragen.
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

// ═══════════════════════════════════════════════════════════════════════════
// R33–R36 (Regression, Korrekturchat 12C) — sie ERSETZEN die Befund-Nachweise
// `B6` (A-5), `B7` (A-6) und `B8` (A-7) und sichern zusaetzlich den Pruefpunkt
// `O-3` ab. Erwartungswerte unabhaengig nachgerechnet bzw. gegen den
// unveraenderten Ausgangsstand V1.0.62 gemessen.
//
// WICHTIG zur Einordnung von R33: A-5 ist eine OFFENGELEGTE
// MODELLVEREINFACHUNG, keine numerisch beseitigte Ueberbewertung. Die
// Rechnung ist bit-genau unveraendert; geprueft wird, dass die Annahme
// ausdruecklich benannt und mitgefuehrt wird.
// ═══════════════════════════════════════════════════════════════════════════

// Zeitlicher Umfang der Verwaesserung: 3J-CAGR = +8 %/y (die Clamp-Obergrenze
// aus buildForecastInputs). Derselbe Datensatz wie im frueheren Nachweis `B6`.
const dilutionMj = () => refMj({ shares_diluted: [125.971, 116.640, 108.0, 100.0],
                                 net_debt: [0] });

test('R33 (A-5) erklaerte Modellkonvention: Verwaesserung in den Detailjahren, danach konstante Aktienzahl', () => {
  const mj = dilutionMj();
  const fi = S.buildForecastInputs(mj);
  assert.ok(Math.abs(fi.sharesGrowthPa - 8) < 1e-3, 'Verwaesserung 8 %/y');

  const r = S.forecastDcfCore(fi, 0, 2, 10, { enabled: false }, 20);

  // ── 1) Die Rechnung ist UNVERAENDERT ─────────────────────────────────
  // Referenzzahlen auf dem Ausgangsstand V1.0.62 selbst gemessen
  // (Commit d392094). A-5 wird offengelegt, nicht wegdefiniert: wer hier
  // rechnet, bekommt genau dieselben Zahlen wie vorher.
  assert.ok(Math.abs(r.total - 7.913941025347281) < 1e-12,
    'Wert je Aktie unveraendert, erhalten ' + r.total);
  assert.ok(Math.abs(r.pvTv - 2.711244966909631) < 1e-12,
    'Terminalwert je Aktie unveraendert, erhalten ' + r.pvTv);
  assert.ok(Math.abs(r._sharesYear10 - 271.9605015530696) < 1e-9);
  // Der Terminalwert wird weiterhin durch die Aktienzahl des Jahres 10
  // geteilt — das ist die erklaerte Konvention, kein stiller Nebeneffekt.
  assert.ok(Math.abs(r.pvTv - (r._pvTvAbs / r._sharesYear10)) < 1e-12,
    'Terminalwert je Aktie = PV(TV) / Aktienzahl Jahr 10');

  // ── 2) Die Konvention steht maschinenlesbar am Ergebnis ──────────────
  assert.equal(r._dilutionHorizonYears, 10);
  assert.equal(r._dilutionAppliedInTerminalValue, false);
  // Bei VERWAESSERUNG ist die Aktienzahl des Jahres 10 der tatsaechliche
  // Teiler des Hauptwerts — hier stimmt die Angabe schon seit V1.0.63.
  assert.equal(r._terminalShareCountBasis, 'shares_year_10_constant');
  assert.ok(Math.abs(r._terminalShareCount - r._sharesYear10) < 1e-12);
  assert.equal(r._sharesChangeAppliedInMainValue, true);
  assert.ok(/Detailjahren 1–10/.test(r._terminalDilutionSimplification));
  assert.ok(/konstant/.test(r._terminalDilutionSimplification));
  // Zahl und erklaerender Text stammen aus EINER Deklaration.
  // BERICHTIGT in Korrekturchat 12C.1: `TERMINAL_DILUTION` trug bis V1.0.63
  // das Feld `appliedInDetailYears: true` und genau EINE Terminalbasis. Beides
  // war eine pauschale Behauptung — sie gilt nur im Verwaesserungsfall. Die
  // Deklaration nennt jetzt beide Zweige; die konkrete Basis steht am
  // Ergebnis (siehe R37).
  const konvention = evalInApp('TERMINAL_DILUTION');
  assert.equal(konvention.horizonYears, 10);
  assert.equal(konvention.dilutionTerminalShareCountBasis, 'shares_year_10_constant');
  assert.equal(konvention.buybackOrFlatTerminalShareCountBasis, 'shares_year_0_constant');
  assert.equal(konvention.appliedInTerminalValue, false);
  assert.equal(konvention.extrapolatedToPerpetuity, false);
  assert.equal(konvention.buybackTreatment, 'diagnosis_only');
  assert.equal(konvention.appliedInDetailYears, undefined,
    'die pauschale Behauptung ist entfallen');
  assert.ok(konvention.note.indexOf('1–' + konvention.horizonYears) >= 0,
    'der Text nennt genau den deklarierten Horizont');
  assert.ok(/HEUTIGEN Aktienzahl/.test(konvention.note),
    'der Text nennt auch den Rueckkauf-/Konstantzweig');

  const dcf = S.modelDcf(mj, scOf(0, 2, 10, 20));
  assert.equal(dcf.applicable, true);
  assert.ok(Math.abs(dcf.base - 7.913941025347281) < 1e-12, 'Fair Value unveraendert');
  assert.equal(dcf._dilutionHorizonYears, 10);
  assert.equal(dcf._dilutionAppliedInDetailYears, true);
  assert.equal(dcf._dilutionAppliedInTerminalValue, false);
  assert.equal(dcf._terminalShareCountBasis, 'shares_year_10_constant');
  assert.ok(Math.abs(dcf._terminalShareCountM - r._sharesYear10) < 1e-9);
  assert.equal(dcf._sharesChangeAppliedInMainValue, true);
  assert.equal(dcf._terminalSharesGrowthPa, 0);
  assert.equal(dcf._historicalDilutionExtrapolatedToPerpetuity, false);
  assert.ok(Math.abs(dcf._sharesGrowthPaProjected - 8) < 1e-3);

  // ── 3) SICHTBARER Hinweis nennt den zeitlichen Umfang ────────────────
  const w = dcf.warnings || [];
  const label = w.find(x => /Shares-Projektion/.test(x));
  assert.ok(label, 'die Shares-Projektion wird ausgewiesen');
  assert.ok(/im Hauptwert berücksichtigt/.test(label), 'Aussage bleibt erhalten');
  assert.ok(/Detailjahre 1–10/.test(label) && /Terminalzeitpunkt/.test(label),
    'die Aussage nennt jetzt den ZEITRAUM, erhalten: ' + label);
  // Frueher (Befund A-5): "Dilution — im Hauptwert beruecksichtigt" ohne
  // jeden Zeitbezug. Genau diese unvollstaendige Formulierung darf nicht
  // mehr vorkommen.
  assert.equal(/im Hauptwert berücksichtigt'?$/.test(label.trim()), false);
  for (const x of w) {
    if (!/im Hauptwert berücksichtigt/.test(x)) continue;
    assert.ok(/Detailjahre 1–10|Detailjahren 1–10/.test(x),
      'keine Beruecksichtigungsaussage ohne Zeitraum: ' + x);
  }
  assert.ok(w.some(x => /Verwässerungs-Vereinfachung/.test(x)
                     && /Terminalwert/.test(x)
                     && /NICHT fortgeschrieben/.test(x)),
    'die Vereinfachung wird ausdruecklich als solche gekennzeichnet');
  assert.ok(w.some(x => /verwässerungsadjustiert/.test(x) && /Detailjahren 1–10/.test(x)),
    'auch die Trennung der Effekte nennt den Zeitraum');

  // ── 4) Herkunfts- und Snapshotinformationen fuehren die Annahme mit ──
  // BERICHTIGT in Korrekturchat 12C.1: Der Ausweis der Datenbasis behauptete
  // bis V1.0.63 pauschal `terminal_share_count_basis: 'shares_year_10_constant'`
  // und `applied_in_detail_years: true`. Er kennt die projizierte Rate nicht
  // (der Bewertungskern loest sie auf) und nennt deshalb jetzt BEIDE Zweige
  // samt der Stellen, die den konkreten Fall tragen.
  const rep = S.buildDataBasisReport(mj);
  assert.equal(rep.dilution.horizon_years, 10);
  assert.equal(rep.dilution.applied_in_terminal_value, false);
  assert.equal(rep.dilution.extrapolated_to_perpetuity, false);
  assert.equal(rep.dilution.terminal_share_count_basis, undefined,
    'keine pauschale Behauptung einer einzigen Basis mehr');
  assert.equal(rep.dilution.terminal_share_count_basis_dilution, 'shares_year_10_constant');
  assert.equal(rep.dilution.terminal_share_count_basis_buyback_or_flat, 'shares_year_0_constant');
  assert.equal(rep.dilution.buyback_treatment, 'diagnosis_only');
  assert.ok(/shares_growth_pa_pct > 0/.test(rep.dilution.applied_in_main_value_when));
  assert.ok(Array.isArray(rep.dilution.resolved_in) && rep.dilution.resolved_in.length === 2,
    'der Ausweis verweist auf die Stellen mit dem konkreten Fall');
  assert.ok(/Verwässerungs-Vereinfachung/.test(rep.dilution.simplification));
  assert.ok((rep.warnings || []).some(x => /Verwässerungs-Vereinfachung/.test(x)),
    'der Ausweis der Datenbasis nennt die Vereinfachung');

  const mjS = refMj({ shares_diluted: [125.971, 116.640, 108.0, 100.0], net_debt: [0] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 0 }, { price: 8 });
  const v = S.runValuationEngine(mjS);
  assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
  const snap = S.buildSnapshotForecastTargets(mjS, v);
  assert.equal(snap.available, true, snap.reason || '');
  assert.equal(snap.terminal.dilution_applied_in_terminal_value, false);
  assert.equal(snap.terminal.share_count_basis, 'shares_year_10_constant');
  assert.equal(snap.terminal.shares_growth_pa_terminal_pct, 0);
  assert.ok(Math.abs(snap.dilution.shares_growth_pa_pct - 8) < 1e-3);
  assert.equal(snap.dilution.horizon_years, 10);
  assert.equal(snap.dilution.applied_in_main_value, true, 'Verwaesserung wirkt im Hauptwert');
  assert.equal(snap.dilution.applied_in_detail_years, true);
  assert.equal(snap.dilution.applied_in_terminal_value, false);
  assert.equal(snap.dilution.extrapolated_to_perpetuity, false);
  assert.equal(snap.dilution.terminal_share_count_basis, 'shares_year_10_constant');
  assert.ok(/Verwässerungs-Vereinfachung/.test(snap.dilution.simplification));

  // ── 5) KEINE automatische ewige Fortschreibung ───────────────────────
  // Weder eine Verwaesserungs- noch eine Rueckkaufrate wird in die Ewigkeit
  // verlaengert — unabhaengig davon, was die Historie zeigt.
  const buyback = refMj({ shares_diluted: [70, 76, 83, 90], net_debt: [0] });
  const rB = S.modelDcf(buyback, scOf(0, 2, 10, 20));
  assert.ok(rB._sharesGrowthPaProjected < -0.5, 'Historie zeigt Rueckkaeufe');
  assert.equal(rB._terminalSharesGrowthPa, 0, 'auch Rueckkaeufe enden mit der Detailphase');
  // BERICHTIGT in 12C.1: Bei Rueckkaeufen wirkt die Projektion im Hauptwert
  // gar nicht — er teilt durchgehend durch die heutige Aktienzahl (R37).
  assert.equal(rB._sharesChangeAppliedInMainValue, false);
  assert.equal(rB._terminalShareCountBasis, 'shares_year_0_constant');
  assert.equal(rB._historicalDilutionExtrapolatedToPerpetuity, false);
  assert.ok((rB.warnings || []).some(x => /Aktienreduktion nur bis/.test(x)
                                       && /Jahr 10/.test(x)),
    'die Buyback-Diagnose nennt dieselbe Grenze');

  // ── 6) KEINE neue Einstellungsoberflaeche ────────────────────────────
  // Es gibt keinen Schalter fuer die Terminalannahme: eine erfundene
  // Annahme aendert am Ergebnis nichts.
  const mjX = dilutionMj();
  mjX.valuation.assumptions = { terminal_dilution_pct: 8, shares_growth_terminal_pa: 8 };
  const rX = S.modelDcf(mjX, scOf(0, 2, 10, 20));
  assert.ok(Math.abs(rX.base - dcf.base) < 1e-12,
    'keine Einstellung veraendert die Terminalannahme');
  assert.equal(rX._terminalSharesGrowthPa, 0);

  // ── 7) Die ALTERNATIVE Rechnung bleibt als BEDINGTE Sensitivitaet ────
  // Sie gilt NUR unter der zusaetzlichen Annahme, dass die Verwaesserung
  // dauerhaft mit derselben Rate weiterlaeuft. Das ist eine Annahme ueber
  // das einzelne Unternehmen, keine Korrektur des Modells — sie wird hier
  // ausdruecklich als Sensitivitaet nachgerechnet und NICHT als Sollwert.
  const s10 = r._sharesYear10;
  const wacc = 0.10, tg = 0.02, d = 0.08;
  const fcff11 = 150 * (1 + tg);            // kein Umsatzwachstum in Phase 1
  const gEff = (1 + tg) / (1 + d) - 1;      // Wert je Aktie in der ewigen Rente
  const pvTvDauerhaft = ((fcff11 / (s10 * (1 + d))) / (wacc - gEff)) / Math.pow(1 + wacc, 10);
  assert.ok(r.pvTv / pvTvDauerhaft > 2.0,
    'BEDINGTE Sensitivitaet: Terminalwert je Aktie ' + r.pvTv.toFixed(4) +
    ' gegen ' + pvTvDauerhaft.toFixed(4) + ' bei dauerhaft fortgesetzter Verwaesserung');
  // Das Modell rechnet ausdruecklich NICHT so — und sagt das auch.
  assert.ok(Math.abs(r.pvTv - (r._pvTvAbs / s10)) < 1e-12);
});

test('R34 (A-6) Mid-Cycle-D&A: direkte Werte, zulaessige Ableitung, gesetzte Annahme, sonst Nichtverfuegbarkeit', () => {
  // Frueher (Befund A-6): daTtm = (ebitda[0] − ebit[0]), sonst 0. Eine ECHTE
  // Null war damit von einer FEHLENDEN Angabe nicht unterscheidbar; der
  // ausgewiesene Referenz-FCF war zu niedrig und konnte eine falsche
  // 30-%-Abweichungswarnung ausloesen.
  const mk = (ebitda, extra) => ({
    meta: { sub_classification: 'cyclical' },
    fundamentals: Object.assign({
      revenue: [1000, 1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200, 200],
      ebitda, capex: [50, 50, 50, 50, 50], shares_diluted: [100, 100, 100, 100, 100]
    }, (extra && extra.f) || {}),
    valuation: Object.assign({ wacc_components: { tax_rate: 25 } }, (extra && extra.v) || {}),
    market: {}
  });

  // 1) Direkt gemeldeter Wert der bewerteten Periode — unveraendert.
  // Von Hand: NOPAT 150 + D&A 50 − CapEx 50 = 150M.
  const direkt = S.computeMidCycleFcf(mk([250, 250, 250, 250, 250]));
  assert.equal(direkt.status, 'ok');
  assert.ok(Math.abs(direkt.value - 150) < 1e-9, 'erhalten ' + direkt.value);
  assert.equal(direkt.daAvailable, true);
  assert.equal(direkt.daBasis, 'reported_period');
  assert.equal(direkt.daDerived, false);
  assert.ok(Math.abs(direkt.daM - 50) < 1e-9);

  // 2) ECHTE NULL bleibt eine Messung: EBITDA = EBIT ⇒ D&A = 0.
  // Von Hand: 150 + 0 − 50 = 100M — richtig, und ausdruecklich gemessen.
  const echteNull = S.computeMidCycleFcf(mk([200, 200, 200, 200, 200]));
  assert.equal(echteNull.status, 'ok');
  assert.ok(Math.abs(echteNull.value - 100) < 1e-9);
  assert.equal(echteNull.daAvailable, true);
  assert.equal(echteNull.daBasis, 'reported_period');
  assert.equal(echteNull.daM, 0, 'die gemeldete Null ist eine Messung');

  // 3) FEHLENDE D&A ⇒ begruendeter Nichtverfuegbarkeitsstatus, KEINE Zahl.
  const fehlt = S.computeMidCycleFcf(mk(undefined, { f: { fcf: [150, 150, 150, 150, 150] } }));
  assert.equal(fehlt.status, 'insufficient_data');
  assert.equal(fehlt.value, null, 'keine irrefuehrende Referenz-FCF-Zahl');
  assert.equal(fehlt.daAvailable, false);
  assert.equal(fehlt.daBasis, 'assumption_required');
  assert.ok(/nicht belegt/.test(fehlt.reason) && /keine Messung/.test(fehlt.reason),
    'Begruendung: ' + fehlt.reason);
  // Frueher waere hier fcfNorm = 100 gegen fcfTtm = 150 gelaufen, also eine
  // Abweichung von 50 % — und damit eine Warnung gegen eine unbelegte Zahl.
  assert.equal(fehlt.warning, null, 'keine daraus abgeleitete Abweichungswarnung');
  // Gegenprobe am belegten Datensatz: dieselbe Warnung greift weiterhin.
  const belegtMitAbweichung = S.computeMidCycleFcf(
    mk([250, 250, 250, 250, 250], { f: { fcf: [400, 400, 400, 400, 400] } }));
  assert.equal(belegtMitAbweichung.status, 'ok');
  assert.ok(/weicht >30%/.test(belegtMitAbweichung.warning || ''),
    'die Abweichungswarnung selbst bleibt erhalten');

  // 4) ZULAESSIGE ALTERNATIVE QUELLE: die bewertete Periode meldet kein
  //    EBITDA, andere Perioden derselben Sicht schon ⇒ abgeleiteter Median.
  //    Median von (250 − 200)/1000 = 5 % ⇒ D&A = 50M ⇒ FCF = 150M.
  const abgeleitet = S.computeMidCycleFcf(mk([null, 250, 250, 250, 250]));
  assert.equal(abgeleitet.status, 'ok');
  assert.ok(Math.abs(abgeleitet.value - 150) < 1e-9, 'erhalten ' + abgeleitet.value);
  assert.equal(abgeleitet.daAvailable, true);
  assert.equal(abgeleitet.daBasis, 'measured_ratio');
  assert.equal(abgeleitet.daDerived, true, 'ausdruecklich als abgeleitet gekennzeichnet');
  assert.ok(/abgeleitet/.test(abgeleitet.daLabel));

  // 5) AUSDRUECKLICH GESETZTE ANNAHME hat Vorrang — bestehende Prioritaet
  //    von _resolveDaForForecast, auch eine ausdrueckliche 0.
  const gesetzt = S.computeMidCycleFcf(mk([250, 250, 250, 250, 250],
    { v: { assumptions: { da_pct_of_revenue: 10 } } }));
  assert.equal(gesetzt.status, 'ok');
  assert.equal(gesetzt.daBasis, 'manual_override');
  assert.ok(Math.abs(gesetzt.daM - 100) < 1e-9, '10 % von 1.000 = 100M');
  assert.ok(Math.abs(gesetzt.value - 200) < 1e-9, '150 + 100 − 50');
  const gesetztNull = S.computeMidCycleFcf(mk(undefined,
    { v: { assumptions: { da_pct_of_revenue: 0 } } }));
  assert.equal(gesetztNull.status, 'ok', 'eine ausdrueckliche Null ist zulaessig');
  assert.equal(gesetztNull.daBasis, 'manual_override');
  assert.ok(Math.abs(gesetztNull.value - 100) < 1e-9);

  // 6) WIDERSPRECHENDE PERIODEN: EBITDA als TTM, bewerteter Umsatz als FY.
  //    Der Wert ist nicht periodengleich und gilt deshalb als nicht belegt.
  //    (_v4_meta wird hier unmittelbar gesetzt — genau dieser Datenzustand
  //    entsteht, wenn eine Sicht Reihen unterschiedlicher Periodenart traegt.)
  const konflikt = S.computeMidCycleFcf(mk([250, 250, 250, 250, 250], {
    f: { _v4_meta: { revenue: { period_type: 'FY' }, ebitda: { period_type: 'TTM' } } }
  }));
  assert.equal(konflikt.status, 'insufficient_data');
  assert.equal(konflikt.daBasis, 'period_conflict');
  assert.ok(/nicht periodengleich/.test(konflikt.reason), konflikt.reason);
  // Gegenprobe: gleiche Periodenart ⇒ unveraendert verwertbar.
  const gleich = S.computeMidCycleFcf(mk([250, 250, 250, 250, 250], {
    f: { _v4_meta: { revenue: { period_type: 'FY' }, ebitda: { period_type: 'FY' } } }
  }));
  assert.equal(gleich.status, 'ok');
  assert.ok(Math.abs(gleich.value - 150) < 1e-9);

  // 7) Wirkung auf den Bewertungspfad: ohne belegte D&A ist das Modell
  //    nicht anwendbar — mit Begruendung, ohne Ersatzzahl.
  const mjOhne = mk(undefined, { v: { fade: { enabled: false }, wacc_derived: 10,
    growth_terminal: 2, growth_stage1: 5 }, f: { net_debt: [500] } });
  mjOhne.market = { price: 20 };
  const mOhne = S.modelDcfMidcycle(mjOhne, S.buildScenarios(mjOhne));
  assert.equal(mOhne.applicable, false);
  assert.ok(/nicht belegt/.test(mOhne.reason || ''), mOhne.reason);
  // Mit belegter D&A laeuft derselbe Pfad und weist die Herkunft aus.
  const mjMit = mk([250, 250, 250, 250, 250], { v: { fade: { enabled: false },
    wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 }, f: { net_debt: [500] } });
  mjMit.market = { price: 20 };
  const mMit = S.modelDcfMidcycle(mjMit, S.buildScenarios(mjMit));
  assert.equal(mMit.applicable, true);
  assert.equal(mMit._midCycleDaBasis, 'reported_period');
  assert.ok(Math.abs(mMit._midCycleDaM - 50) < 1e-9);
  assert.ok((mMit.warnings || []).some(x => /Referenz-FCF/.test(x) && /D&A/.test(x)),
    'der sichtbare Hinweis nennt die D&A-Herkunft');
});

test('R35 (A-7) ECHTER SYNTHESIZER-PFAD: Buyback-Zuschlag im aktiven DCF-Modell inkl. dcf_midcycle', () => {
  // Frueher (Befund A-7): der Synthesizer las ausschliesslich
  // modelResults['dcf'] / ['DCF']. Fuer zyklische Titel laeuft der DCF unter
  // 'dcf_midcycle' — der Sicherheitszuschlag blieb dort stillschweigend aus.
  // Geprueft wird hier der VOLLSTAENDIGE Weg runValuationEngine →
  // runFairValueSynthesizer, nicht eine nachgebildete Schluesselauswahl.
  const CFG = evalInApp('SYNTHESIS_CONFIG');
  const cycMj = (buybackPaPct) => {
    const sd = [];
    for (let i = 0; i < 6; i++) sd.push(100 * Math.pow(1 + buybackPaPct / 100, -i));
    return {
      meta: { ticker: 'CYC', sub_classification: 'cyclical' },
      fundamentals: { revenue: [1000, 1000, 1000, 1000, 1000, 1000],
        ebit: [300, 100, 150, 200, 150, 100], ebitda: [350, 150, 200, 250, 200, 150],
        capex: [50, 50, 50, 50, 50, 50], cfo: [200, 200, 200, 200, 200, 200],
        shares_diluted: sd, net_debt: [500], total_debt: [800], cash_and_equivalents: [300] },
      valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
        wacc_derived: 10, growth_terminal: 2, growth_stage1: 5, midcycle_margin_pct: 15 },
      market: { price: 20 }
    };
  };
  const durch = (mj) => {
    const v = S.runValuationEngine(mj);
    assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
    const syn = S.runFairValueSynthesizer(mj, v, S.runQualityEngine(mj),
      Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
    return { v, syn };
  };

  // ── Der zyklische Pfad laeuft wirklich unter 'dcf_midcycle' ──────────
  const stark = cycMj(-8);
  const a = durch(stark);
  assert.equal(a.v.router.activeModels.join(','), 'dcf_midcycle');
  assert.equal(Object.keys(a.v.modelResults).join(','), 'dcf_midcycle');
  assert.equal(a.v.modelResults.dcf, undefined, 'es gibt KEIN Ergebnis unter "dcf"');
  assert.ok(a.v.modelResults.dcf_midcycle._buybackUpliftPct > 25);
  // Frueher blieb der Zuschlag hier bei 0.
  assert.equal(a.syn.mosComponents.buybackAddon, 0.10, 'Uplift > 25 % ⇒ +10 pp');
  assert.ok(Math.abs(a.syn.mosComponents._buybackUpliftPct
                     - a.v.modelResults.dcf_midcycle._buybackUpliftPct) < 1e-12,
    'der Uplift stammt aus dem tatsaechlich aktiven Modell');

  // ── Bestehende Schwellen: unterhalb, dazwischen, oberhalb ────────────
  const keiner = durch(cycMj(-1));
  assert.ok(keiner.v.modelResults.dcf_midcycle._buybackUpliftPct < 10,
    'Uplift ' + keiner.v.modelResults.dcf_midcycle._buybackUpliftPct.toFixed(2) + ' %');
  assert.equal(keiner.syn.mosComponents.buybackAddon, 0, 'unter 10 % ⇒ kein Zuschlag');
  const mittel = durch(cycMj(-2));
  const upMittel = mittel.v.modelResults.dcf_midcycle._buybackUpliftPct;
  assert.ok(upMittel > 10 && upMittel <= 25, 'Uplift ' + upMittel.toFixed(2) + ' %');
  assert.equal(mittel.syn.mosComponents.buybackAddon, 0.05, 'zwischen 10 und 25 % ⇒ +5 pp');

  // Genau AUF den Schwellen. Der Weg bleibt der echte Synthesizer samt
  // echter Schluesselauswahl; nur die Uplift-Zahl des aktiven Modells wird
  // auf den Grenzwert gesetzt, weil sie sich nicht exakt aus Daten treffen
  // laesst. Die Schwellen sind unveraendert als STRIKT groesser definiert.
  const aufSchwelle = (uplift) => {
    const mj = cycMj(-8);
    const v = S.runValuationEngine(mj);
    v.modelResults.dcf_midcycle._buybackUpliftPct = uplift;
    return S.runFairValueSynthesizer(mj, v, S.runQualityEngine(mj),
      Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
  };
  assert.equal(aufSchwelle(25).mosComponents.buybackAddon, 0.05, 'genau 25 % ⇒ noch +5 pp');
  assert.equal(aufSchwelle(25.0001).mosComponents.buybackAddon, 0.10, 'ueber 25 % ⇒ +10 pp');
  assert.equal(aufSchwelle(10).mosComponents.buybackAddon, 0, 'genau 10 % ⇒ kein Zuschlag');
  assert.equal(aufSchwelle(10.0001).mosComponents.buybackAddon, 0.05, 'ueber 10 % ⇒ +5 pp');

  // ── NICHT anwendbares DCF-Modell ⇒ kein Zuschlag ─────────────────────
  // Standardpfad ohne Nettoschuldenangabe: `modelDcf` ist NICHT anwendbar
  // (kein Eigenkapitalwert je Aktie), traegt aber weiterhin einen Uplift von
  // 94 %. RIM bleibt anwendbar, der Synthesizer laeuft also mit
  // Sicherheitsmarge — der Zuschlag muss trotzdem ausbleiben.
  const sdB = [];
  for (let i = 0; i < 6; i++) sdB.push(100 * Math.pow(1 - 0.08, -i));
  const ohneNd = {
    meta: { ticker: 'STD', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000, 1000, 1000],
      ebit: [200, 200, 200, 200, 200, 200], ebitda: [250, 250, 250, 250, 250, 250],
      capex: [50, 50, 50, 50, 50, 50], cfo: [200, 200, 200, 200, 200, 200],
      shares_diluted: sdB, eps_diluted: [2, 2, 2, 2, 2, 2],
      book_value: [500, 500, 500, 500, 500, 500], dps: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8] },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 20 }
  };
  const b = durch(ohneNd);
  assert.equal(b.v.modelResults.dcf.applicable, false, 'DCF nicht anwendbar');
  assert.ok(b.v.modelResults.dcf._buybackUpliftPct > 25, 'traegt dennoch einen hohen Uplift');
  assert.equal(b.v.modelResults.rim.applicable, true, 'der Synthesizer hat ein anderes Modell');
  assert.ok(b.syn.mosComponents, 'die Sicherheitsmarge wird wirklich gerechnet');
  assert.equal(b.syn.mosComponents.buybackAddon, 0, 'gesperrtes Modell liefert keinen Zuschlag');
  assert.equal(b.syn.mosComponents._buybackUpliftPct, 0);
  // Ist ueberhaupt kein Modell anwendbar, entsteht gar keine Sicherheitsmarge
  // — auch dann gibt es keinen Zuschlag und keinen Fehler.
  const garNichts = cycMj(-8);
  garNichts.fundamentals.ebitda = undefined;   // D&A nicht belegt ⇒ Mid-Cycle gesperrt
  const c = durch(garNichts);
  assert.equal(c.v.modelResults.dcf_midcycle.applicable, false);
  assert.equal(c.syn.status, 'no_models_applicable');
  assert.equal(c.syn.mosComponents, undefined, 'ohne Modell keine Sicherheitsmarge');
  assert.equal(c.syn.buyPrice, null);

  // ── KEIN doppelter Zuschlag ──────────────────────────────────────────
  // Liegen beide Schluessel vor, wird GENAU EINER ausgewertet — die
  // Reihenfolge des Routers entscheidet.
  const beide = cycMj(-8);
  const vBeide = S.runValuationEngine(beide);
  vBeide.modelResults.dcf = Object.assign({}, vBeide.modelResults.dcf_midcycle);
  const synBeide = S.runFairValueSynthesizer(beide, vBeide, S.runQualityEngine(beide),
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(beide) }));
  assert.equal(synBeide.mosComponents.buybackAddon, 0.10, 'hoechstens EIN Zuschlag');
  assert.ok(synBeide.mosComponents.buybackAddon <= 0.10);
  // Der Auswahlhelfer selbst liefert genau ein Ergebnis.
  const aktiv = S.runValuationEngine(cycMj(-8));
  const gewaehlt = S._resolveActiveDcfModelResult(aktiv);
  assert.ok(gewaehlt === aktiv.modelResults.dcf_midcycle, 'das aktive Modell wird gewaehlt');
  assert.equal(S._resolveActiveDcfModelResult({ modelResults: {} }), null);
  assert.equal(S._resolveActiveDcfModelResult(null), null);

  // ── Der Zuschlag veraendert den FAIR VALUE NICHT ─────────────────────
  // Er wirkt ausschliesslich auf die Sicherheitsmarge und damit auf den
  // Buy Price. Gemessen gegen den Fall ohne Zuschlag.
  assert.ok(Math.abs(a.syn.range.base - keiner.syn.range.base) < 1e-12,
    'Fair Value unabhaengig vom Zuschlag: ' + a.syn.range.base + ' vs. ' + keiner.syn.range.base);
  assert.ok(Math.abs(a.syn.range.base - mittel.syn.range.base) < 1e-12);
  assert.ok(a.syn.mosComponents.total > keiner.syn.mosComponents.total,
    'die Sicherheitsmarge steigt');
  assert.ok(a.syn.buyPrice < keiner.syn.buyPrice,
    'nur der Buy Price wird konservativer: ' + a.syn.buyPrice + ' < ' + keiner.syn.buyPrice);
  // Der Buyback-adjustierte Wert bleibt Diagnose und wird NICHT Anker.
  assert.ok(Math.abs(a.syn.range.base - a.v.modelResults.dcf_midcycle.base) < 1e-9,
    'Anker ist der konservative Hauptwert');
});

test('R36 (O-3) Nullstellen des Reverse DCF: Nachrechnung, Lücken im Raster, keine behauptete Nichtexistenz', () => {
  // Zwei Randfaelle standen im Audit als UNBESTAETIGT:
  //  (a) Abbruch bei nicht auswertbarem Intervallmittel, danach wurde das
  //      Intervallmittel dennoch als Nullstelle abgelegt.
  //  (b) Vorzeichenwechsel zwischen einem auswertbaren und einem nicht
  //      auswertbaren Rasterpunkt wurden uebersprungen.
  // (b) ist mit Daten erreichbar (unten, Fall A) und war ein echter Fehler.
  // (a) ist mit Daten NICHT erreichbar — die Menge der auswertbaren
  // Wachstumsraten ist in jedem geprueften Parametersatz ein
  // zusammenhaengendes Intervall, sodass ein eingeschachtelter
  // Vorzeichenwechsel keine Luecke enthaelt. (a) wird deshalb als
  // ROBUSTHEITSPRUEFUNG mit kuenstlich eingespeistem Funktionsfehler
  // abgesichert (Fall D) — ausdruecklich KEIN Nachweis eines real
  // auftretenden Bewertungsfehlers.

  // Cash-reicher, knapp profitabler Titel mit hoher Working-Capital-Quote:
  // der operative Wert faellt mit steigendem Wachstum und wird oberhalb von
  // ca. 16,86 % negativ ⇒ der Kern liefert dort keinen Wert mehr.
  const luecke = (price) => ({
    meta: { ticker: 'O3', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000], ebit: [8, 8, 8, 8],
      ebitda: [58, 58, 58, 58], capex: [46, 46, 46, 46],
      shares_diluted: [100, 100, 100, 100], net_debt: [-2000] },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, owc_pct_of_revenue: 15 },
    market: { price }
  });

  // Das Suchraster hat hier wirklich eine Luecke.
  const ctx = S.buildCoreValuationContext(luecke(20), {});
  assert.equal(ctx.ok, true);
  assert.ok(S.coreEquityValuePerShare(ctx, 16.5, 2, 10, null) != null, 'bei 16,5 % auswertbar');
  assert.equal(S.coreEquityValuePerShare(ctx, 17.0, 2, 10, null), null, 'bei 17,0 % nicht mehr');

  // ── Fall A · die Loesung liegt IM Lueckenintervall ───────────────────
  // Unabhaengige Gegenrechnung: bei 16,65 % liegt der Modellwert bei 20,0204,
  // bei 16,70 % bei 20,0155 — ein Kurs von 20,02 wird also dazwischen
  // erklaert. V1.0.62 meldete hier `no_solution_in_range` mit der FALSCHEN
  // Begruendung, der Markt preise ein Wachstum unter −20 % ein.
  const A = S.solveReverseDcfGrowth(luecke(20.02), {});
  assert.equal(A.status, 'ok', A.reason || '');
  assert.ok(A.impliedGrowthPct > 16.6 && A.impliedGrowthPct < 16.7,
    'implizites Wachstum ' + A.impliedGrowthPct);
  assert.equal(A.rootsFound, 1);
  // Nachgerechnet mit der ECHTEN Bewertungsfunktion, Residualtoleranz erfuellt.
  assert.equal(A.residualWithinTolerance, true);
  assert.ok(Math.abs(A.residualPerShare) <= A.residualTolerancePerShare);
  assert.ok(Math.abs(A.residualPerShare) < 1e-3, 'Residuum ' + A.residualPerShare);
  const nach = S.coreEquityValuePerShare(ctx, A.impliedGrowthPct, 2, 10, null);
  assert.ok(Math.abs(nach - 20.02) <= A.residualTolerancePerShare,
    'unabhaengig nachgerechnet: ' + nach);
  assert.equal(A.searchComplete, true, 'das Lueckenintervall ist aufgeloest');

  // ── Fall B · keine Loesung bis zur Auswertbarkeitsgrenze ─────────────
  // Der Kurs liegt unter dem Wert an der Grenze. Jenseits der Grenze ist der
  // Verlauf mit dieser Bewertungsfunktion nicht bestimmbar — die Suche ist
  // also UNVOLLSTAENDIG und wird nicht als bewiesene Nichtexistenz
  // ausgegeben.
  for (const price of [20.00, 19.50, 5.00, 25.00]) {
    const r = S.solveReverseDcfGrowth(luecke(price), {});
    assert.equal(r.status, 'search_incomplete', 'Kurs ' + price + ': ' + r.status);
    assert.equal(r.impliedGrowthPct, null, 'keine Scheingenauigkeit');
    assert.equal(r.searchComplete, false);
    assert.equal(r.uniquenessProven, false);
    assert.equal(JSON.stringify(r.unresolvedIntervalsPct), '[[16.5,17]]');
    assert.equal(JSON.stringify(r.evaluableRangePct), '[-20,16.5]');
    assert.ok(/KEIN Nachweis, dass keine Lösung existiert/.test(r.reason), r.reason);
    // Die frueheren, hier sachlich falschen Begruendungen kommen nicht mehr.
    assert.equal(/es existiert keine Lösung/.test(r.reason), false);
    assert.equal(/Wachstum unter -20% ein/.test(r.reason), false);
  }

  // ── Fall C · lueckenloser Suchbereich bleibt unveraendert ────────────
  const glatt = (price) => refMj({ net_debt: [0] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2 }, { price });
  // Negative und positive Wachstumswerte, jeweils nachgerechnet.
  for (const [price, lo, hi] of [[12, -5.0, -4.0], [14.8, -2.0, -1.0], [17, 0.0, 1.0]]) {
    const r = S.solveReverseDcfGrowth(glatt(price), {});
    assert.equal(r.status, 'ok', 'Kurs ' + price + ': ' + (r.reason || ''));
    assert.ok(r.impliedGrowthPct > lo && r.impliedGrowthPct < hi,
      'Kurs ' + price + ' ⇒ ' + r.impliedGrowthPct);
    assert.equal(r.searchComplete, true);
    assert.equal(r.uniquenessProven, true);
    assert.equal(r.caveat, null);
    assert.equal(r.residualWithinTolerance, true);
    assert.ok(Math.abs(r.residualPerShare) <= r.residualTolerancePerShare);
    assert.equal(JSON.stringify(r.evaluableRangePct), '[-20,40]');
  }
  // Bereichsgrenzen: ausserhalb bleibt es bei `no_solution_in_range` — hier
  // ist die Suche VOLLSTAENDIG, die Aussage also belegt.
  for (const price of [500, 0.5]) {
    const r = S.solveReverseDcfGrowth(glatt(price), {});
    assert.equal(r.status, 'no_solution_in_range', 'Kurs ' + price + ': ' + r.status);
    assert.equal(r.searchComplete, true, 'vollstaendig auswertbar');
    assert.equal(JSON.stringify(r.unresolvedIntervalsPct), '[]');
    assert.equal(JSON.stringify(r.evaluableRangePct), '[-20,40]');
  }
  // Nichtverfuegbarkeit: ohne bekannte Nettoschulden gibt es keinen
  // Eigenkapitalwert und damit auch kein implizites Wachstum.
  const ohneNd = S.solveReverseDcfGrowth(refMj({},
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2 }, { price: 17 }), {});
  assert.equal(ohneNd.status, 'net_debt_unknown');
  assert.equal(ohneNd.impliedGrowthPct, null);
  // Und wenn der Kern im GESAMTEN Bereich nichts liefert: eigener Status.
  const garNichts = S.solveReverseDcfGrowth(refMj({ ebit: [-900, -900, -900, -900],
    ebitda: [-850, -850, -850, -850], net_debt: [0] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2 }, { price: 17 }), {});
  assert.equal(garNichts.status, 'not_evaluable');

  // ── Fall D · ROBUSTHEITSPRUEFUNG mit eingespeistem Funktionsfehler ───
  // Die Bewertungsfunktion liefert innerhalb eines eingeschachtelten
  // Vorzeichenwechsels keinen Wert mehr. V1.0.62 gab dort das
  // Intervallmittel 0,375 % als geloest aus (Residuum 0,0366 — mehr als das
  // Doppelte der Toleranz), obwohl die echte Nullstelle bei 0,3446 % liegt.
  // Jetzt entsteht kein unbelegter Wert. Das ist eine Pruefung der
  // Absicherung, KEIN mit Daten erreichbarer Bewertungsfehler.
  const mjD = glatt(17);
  const ungestoert = S.solveReverseDcfGrowth(mjD, {});
  assert.equal(ungestoert.status, 'ok');
  const echteFn = S.coreEquityValuePerShare;
  try {
    S.coreEquityValuePerShare = function (c, g, tg, wacc, m) {
      if (g > 0.3 && g < 0.4) return null;      // kuenstliche Luecke IM Intervall
      return echteFn(c, g, tg, wacc, m);
    };
    const r = S.solveReverseDcfGrowth(mjD, {});
    assert.equal(r.status, 'search_incomplete', 'kein unbelegtes Intervallmittel');
    assert.equal(r.impliedGrowthPct, null);
    assert.equal(r.rootsFound, 0);
    assert.equal(r.searchComplete, false);
    assert.equal(JSON.stringify(r.unresolvedIntervalsPct), '[[0,0.5]]');
  } finally {
    S.coreEquityValuePerShare = echteFn;
  }
  // Die Einspeisung ist zurueckgenommen — der Pfad rechnet wieder normal.
  assert.equal(S.coreEquityValuePerShare, echteFn);
  const danach = S.solveReverseDcfGrowth(mjD, {});
  assert.equal(danach.status, 'ok');
  assert.ok(Math.abs(danach.impliedGrowthPct - ungestoert.impliedGrowthPct) < 1e-12);
});


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

// ═══════════════════════════════════════════════════════════════════════════
// R37–R39 (Regression, Korrekturchat 12C.1) — die drei nach 12C unabhaengig
// reproduzierten Restfehler. Erwartungswerte unabhaengig nachgerechnet bzw.
// gegen den unveraenderten Ausgangsstand V1.0.63 (Commit 3a215ec) gemessen.
// ═══════════════════════════════════════════════════════════════════════════

// Periodenmetadaten fuer Geschaeftsjahre ab `startYear` abwaerts.
const fyMeta = (n, startYear = 2025) => {
  const periods = [], starts = [], durations = [];
  for (let k = 0; k < n; k++) {
    const y = startYear - k;
    periods.push(y + '-12-31');
    starts.push(y + '-01-01');
    durations.push(365);
  }
  return { confidence: 'high', source_type: 'reported', source_reference: 'SEC EDGAR 10-K',
           period_type: 'FY', unit: 'USD', isFlowConcept: true, periods, starts, durations };
};

// Synthetischer zyklischer Filer mit vollstaendigen Periodenmetadaten.
// EBIT sechs Jahre FY2025..FY2020, EBITDA je nach Fall.
function daPeriodMj(opts) {
  opts = opts || {};
  const f = {
    revenue:        [1000, 1000, 1000, 1000, 1000, 1000],
    ebit:           [400, 200, 200, 200, 200, 200],
    ebitda:         opts.ebitda !== undefined ? opts.ebitda : [250, 250, 250, 250, 250],
    capex:          [50, 50, 50, 50, 50, 50],
    shares_diluted: [100, 100, 100, 100, 100, 100],
    fcf:            [150, 150, 150, 150, 150, 150],
    net_debt:       [0],
    _v4_meta: Object.assign({
      revenue: fyMeta(6), ebit: fyMeta(6), capex: fyMeta(6),
      fcf: fyMeta(6), shares_diluted: fyMeta(6),
      ebitda: opts.ebitdaMeta !== undefined ? opts.ebitdaMeta : fyMeta(5, 2024)
    }, opts.meta || {})
  };
  if (opts.mutate) opts.mutate(f);
  return {
    meta: { ticker: 'DAPER', sub_classification: 'cyclical' },
    fundamentals: f,
    valuation: Object.assign({ wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 }, opts.valuation || {}),
    market: { price: 20 }
  };
}

test('R37 (A-6) D&A wird ueber die BERICHTSPERIODEN zugeordnet, nicht ueber Array-Indizes', () => {
  // Frueher (Restbefund nach 12C): _resolveMidCycleDa() prueferte zwar FY gegen
  // TTM, verrechnete aber weiter ebitda[0] mit ebit[0]. Beginnt die
  // EBITDA-Reihe erst ein Jahr spaeter, traf EBITDA FY2024 (250) auf EBIT
  // FY2025 (400) ⇒ D&A −150 und Referenz-FCF −50, ausgewiesen als
  // `reported_period`, samt einer >30-%-Abweichungswarnung gegen 150.
  //
  // Unabhaengige Nachrechnung des RICHTIGEN Ergebnisses:
  //   Margen-Median über FY2025..FY2020 = Median(0,4; 0,2×5) = 0,20
  //   NOPAT = 1.000 × 0,20 × 0,75 = 150 · CapEx = 1.000 × 0,05 = 50
  //   Periodengleiche D&A-Quoten (FY2024..FY2020) = (250 − 200)/1.000 = 5 %
  //   ⇒ D&A = 1.000 × 5 % = 50 ⇒ Referenz-FCF = 150 + 50 − 50 = 150
  const mj = daPeriodMj();
  const mc = S.computeMidCycleFcf(mj);
  assert.equal(mc.status, 'ok');
  assert.ok(Math.abs(mc.value - 150) < 1e-9, 'Referenz-FCF 150, erhalten ' + mc.value);
  assert.ok(Math.abs(mc.daM - 50) < 1e-9, 'D&A 50, erhalten ' + mc.daM);
  // Die bewertete Periode meldet KEINE periodengleiche EBITDA-Angabe ⇒ der
  // Wert ist eine ausdrueckliche Ableitung, keine direkte Messung.
  assert.equal(mc.daBasis, 'measured_ratio');
  assert.equal(mc.daDerived, true);
  assert.equal(mc.warning, null, 'keine Abweichungswarnung gegen eine verrutschte Zahl');

  // Die Quote selbst entsteht aus periodengleichen Angaben — und nur aus
  // diesen. Die frueher enthaltene Quote (250 − 400)/1.000 = −15 % ist weg.
  const da = S._resolveDaForForecast(mj);
  assert.equal(da.source, 'measured');
  assert.equal(da.measuredPairing, 'period');
  assert.ok(Math.abs(da.measuredRatio - 0.05) < 1e-12);
  assert.equal(da.yearsUsed, 5, 'fuenf periodengleiche Paare');
  assert.equal(JSON.stringify(da.measuredPeriods),
    JSON.stringify(['2024-12-31', '2023-12-31', '2022-12-31', '2021-12-31', '2020-12-31']));
  for (const pr of da.periodPairs) {
    assert.equal(pr.period, mj.fundamentals._v4_meta.ebit.periods[pr.ebitIdx],
      'EBIT stammt aus der Periode des Slots');
    assert.equal(pr.period, mj.fundamentals._v4_meta.ebitda.periods[pr.ebitdaIdx],
      'EBITDA stammt aus DERSELBEN Periode');
  }
  assert.ok(/periodengleich zugeordnet/.test(da.sourceLabel), da.sourceLabel);

  // ── ECHTER ENGINE-PFAD ───────────────────────────────────────────────
  const v = S.runValuationEngine(mj);
  assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
  const dm = v.modelResults.dcf_midcycle;
  assert.equal(dm.applicable, true);
  assert.ok(Math.abs(dm._midCycleReferenceFcfM - 150) < 1e-9,
    'Referenz-FCF im Engine-Pfad, erhalten ' + dm._midCycleReferenceFcfM);
  assert.equal(dm._midCycleDaBasis, 'measured_ratio');
  assert.ok(Math.abs(dm._midCycleDaM - 50) < 1e-9);

  // ── Gegenprobe: ausgerichtete EBITDA-Reihe ───────────────────────────
  // Dieselben Werte, nur mit passenden Perioden gemeldet. Das Tool lieferte
  // hier schon vorher 150 — und der HAUPT-Fair-Value ist in beiden
  // Darstellungen derselbe (die Mid-Cycle-Marge haengt nicht an der D&A).
  const mjAus = daPeriodMj({ ebitda: [null, 250, 250, 250, 250, 250], ebitdaMeta: fyMeta(6) });
  const mcAus = S.computeMidCycleFcf(mjAus);
  assert.ok(Math.abs(mcAus.value - 150) < 1e-9);
  assert.equal(mcAus.daBasis, 'measured_ratio');
  const vAus = S.runValuationEngine(mjAus);
  assert.ok(Math.abs(vAus.modelResults.dcf_midcycle.base - dm.base) < 1e-12,
    'Fair Value in beiden Darstellungen gleich: ' + dm.base);

  // ── Fehlende Perioden einzelner Slots ────────────────────────────────
  // FY2022 fehlt in der EBITDA-Reihe ⇒ dieser Slot liefert keine Quote,
  // die uebrigen bleiben periodengleich. Kein Verrutschen.
  const mjLuecke = daPeriodMj({
    ebitda: [250, 250, 250, 250],
    ebitdaMeta: Object.assign(fyMeta(4, 2024), {
      periods:   ['2024-12-31', '2023-12-31', '2021-12-31', '2020-12-31'],
      starts:    ['2024-01-01', '2023-01-01', '2021-01-01', '2020-01-01'],
      durations: [365, 365, 365, 365] })
  });
  const daL = S._resolveDaForForecast(mjLuecke);
  assert.equal(daL.measuredPairing, 'period');
  assert.equal(daL.yearsUsed, 4);
  assert.ok(Math.abs(daL.measuredRatio - 0.05) < 1e-12);
  assert.ok(daL.measuredPeriods.indexOf('2022-12-31') < 0, 'FY2022 bleibt aussen vor');
  assert.ok(daL.periodMismatchCount >= 1, 'die offenen Slots werden gezaehlt');

  // ── ABWEICHENDE REIHENFOLGE ──────────────────────────────────────────
  // Dieselben Angaben, EBITDA aber aufsteigend gemeldet. Die Zuordnung
  // erfolgt ueber die Periode, nicht ueber die Position — dasselbe Ergebnis.
  const mjDreh = daPeriodMj({
    ebitda: [250, 250, 250, 250, 250],
    ebitdaMeta: Object.assign(fyMeta(5, 2024), {
      periods:   ['2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31'],
      starts:    ['2020-01-01', '2021-01-01', '2022-01-01', '2023-01-01', '2024-01-01'] })
  });
  const daD = S._resolveDaForForecast(mjDreh);
  assert.equal(daD.measuredPairing, 'period');
  assert.equal(daD.yearsUsed, 5);
  assert.ok(Math.abs(daD.measuredRatio - 0.05) < 1e-12);
  assert.ok(Math.abs(S.computeMidCycleFcf(mjDreh).value - 150) < 1e-9);

  // ── ECHTE NULL bleibt eine Messung ───────────────────────────────────
  // EBITDA = EBIT in der bewerteten Periode ⇒ D&A ist belegte 0.
  // Von Hand: 150 + 0 − 50 = 100.
  const mjNull = daPeriodMj({ ebitda: [400, 200, 200, 200, 200, 200], ebitdaMeta: fyMeta(6) });
  const mcNull = S.computeMidCycleFcf(mjNull);
  assert.equal(mcNull.status, 'ok');
  assert.equal(mcNull.daBasis, 'reported_period');
  assert.equal(mcNull.daM, 0, 'die gemeldete Null ist eine Messung');
  assert.ok(Math.abs(mcNull.value - 100) < 1e-9);

  // ── MANUELLE ANNAHME behaelt Vorrang ─────────────────────────────────
  const mjOv = daPeriodMj({ valuation: { wacc_components: { tax_rate: 25 },
    fade: { enabled: false }, wacc_derived: 10, growth_terminal: 2, growth_stage1: 5,
    assumptions: { da_pct_of_revenue: 10 } } });
  const mcOv = S.computeMidCycleFcf(mjOv);
  assert.equal(mcOv.daBasis, 'manual_override');
  assert.ok(Math.abs(mcOv.daM - 100) < 1e-9, '10 % von 1.000');
  assert.ok(Math.abs(mcOv.value - 200) < 1e-9, '150 + 100 − 50');
  // Auch eine ausdrueckliche 0 bleibt zulaessig und hat Vorrang.
  const mjOv0 = daPeriodMj({ valuation: { wacc_components: { tax_rate: 25 },
    fade: { enabled: false }, wacc_derived: 10, growth_terminal: 2, growth_stage1: 5,
    assumptions: { da_pct_of_revenue: 0 } } });
  const mcOv0 = S.computeMidCycleFcf(mjOv0);
  assert.equal(mcOv0.daBasis, 'manual_override');
  assert.ok(Math.abs(mcOv0.value - 100) < 1e-9);

  // ── KEIN Index-Rueckfall bei widersprechenden Metadaten ──────────────
  // EBITDA meldet ausschliesslich Perioden, die es in der EBIT-Reihe nicht
  // gibt. Frueher haette die Index-Paarung hier trotzdem gerechnet.
  const mjWeg = daPeriodMj({
    ebitda: [250, 250, 250],
    ebitdaMeta: Object.assign(fyMeta(3, 2015), {})
  });
  const daW = S._resolveDaForForecast(mjWeg);
  assert.equal(daW.measuredPairing, 'period');
  assert.equal(daW.measuredRatio, null, 'kein Rueckfall auf Array-Indizes');
  assert.equal(daW.source, 'assumption_required');
  const mcW = S.computeMidCycleFcf(mjWeg);
  assert.equal(mcW.status, 'insufficient_data');
  assert.equal(mcW.value, null, 'kein stiller Nullwert, keine Klemmung');
  assert.ok(/nicht belegt/.test(mcW.reason), mcW.reason);

  // ── Quartalswert gegen Jahresfenster faellt durch ─────────────────────
  // Gleiches Periodenende, aber andere Dauer ⇒ keine periodengleiche Angabe.
  const mjQ = daPeriodMj({
    ebitda: [250, 250, 250, 250, 250, 250],
    ebitdaMeta: Object.assign(fyMeta(6), {
      starts:    ['2025-10-01','2024-10-01','2023-10-01','2022-10-01','2021-10-01','2020-10-01'],
      durations: [92, 92, 92, 92, 92, 92] })
  });
  const daQ = S._resolveDaForForecast(mjQ);
  assert.equal(daQ.measuredRatio, null, 'Quartal gegen Jahr wird nicht gepaart');
  assert.equal(S.computeMidCycleFcf(mjQ).status, 'insufficient_data');

  // ── ALTDATENREGEL bleibt erhalten ────────────────────────────────────
  // Ohne Periodenmetadaten auf dem verrechneten Paar gilt unveraendert die
  // Positionszuordnung des manuellen Imports.
  const mjAlt = {
    meta: { sub_classification: 'cyclical' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000, 1000],
      ebit: [200, 200, 200, 200, 200], ebitda: [250, 250, 250, 250, 250],
      capex: [50, 50, 50, 50, 50], shares_diluted: [100, 100, 100, 100, 100] },
    valuation: { wacc_components: { tax_rate: 25 } }, market: {}
  };
  const daAlt = S._resolveDaForForecast(mjAlt);
  assert.equal(daAlt.measuredPairing, 'index');
  assert.ok(Math.abs(daAlt.measuredRatio - 0.05) < 1e-12);
  assert.ok(/Altdatenregel/.test(daAlt.sourceLabel), daAlt.sourceLabel);
  const mcAlt = S.computeMidCycleFcf(mjAlt);
  assert.equal(mcAlt.status, 'ok');
  assert.equal(mcAlt.daBasis, 'reported_period');
  assert.ok(Math.abs(mcAlt.value - 150) < 1e-9);

  // Dieser Nachweis laeuft auf einem SYNTHETISCHEN Master-JSON ueber den
  // produktiven Bewertungsweg. Er belegt KEINEN Fehler eines echten
  // SEC-Live-Imports — ein solcher wurde hier nicht geprueft.
});

test('R38 (A-5) die ausgewiesene Terminal-Aktienbasis ist der TATSAECHLICHE Teiler des Hauptwerts', () => {
  // Frueher (Restbefund nach 12C): _terminalShareCount, das Modellergebnisfeld
  // und snapshot.terminal.share_count nannten IMMER die projizierte Aktienzahl
  // des Jahres 10. Der konservative Hauptwert teilt bei g <= 0 aber durchgehend
  // durch die HEUTIGE Aktienzahl. Bei −4 %/y ergab der ausgewiesene Teiler
  // 66,483264 einen Terminalwert je Aktie von 11,090784 statt der
  // tatsaechlich verwendeten 7,373515.
  const sdBuyback = [100, 100 / 0.96, 100 / Math.pow(0.96, 2), 100 / Math.pow(0.96, 3)];
  const faelle = [
    { name: 'Verwaesserung', sd: [125.971, 116.640, 108.0, 100.0],
      basis: 'shares_year_10_constant', imHauptwert: true },
    { name: 'konstant',      sd: [100, 100, 100, 100],
      basis: 'shares_year_0_constant',  imHauptwert: false },
    { name: 'Rueckkaeufe',   sd: sdBuyback,
      basis: 'shares_year_0_constant',  imHauptwert: false }
  ];

  for (const fall of faelle) {
    const mj = refMj({ shares_diluted: fall.sd, net_debt: [0] });
    const fi = S.buildForecastInputs(mj);
    const r  = S.forecastDcfCore(fi, 0, 2, 10, { enabled: false }, 20);

    // Der ausgewiesene Teiler muss den TATSAECHLICHEN Haupt-Terminalwert
    // rekonstruieren — das ist die eigentliche Zusicherung.
    assert.ok(Math.abs(r.pvTv - (r._pvTvAbs / r._terminalShareCount)) < 1e-12,
      fall.name + ': ausgewiesener Teiler rekonstruiert den Hauptwert nicht ' +
      '(pvTv ' + r.pvTv + ' vs. ' + (r._pvTvAbs / r._terminalShareCount) + ')');
    assert.equal(r._terminalShareCountBasis, fall.basis, fall.name);
    assert.equal(r._sharesChangeAppliedInMainValue, fall.imHauptwert, fall.name);
    // Die projizierte Aktienzahl des Jahres 10 bleibt als DIAGNOSE erhalten.
    assert.ok(Math.abs(r._buybackDiagnosticTerminalShareCount - r._sharesYear10) < 1e-12);

    const dcf = S.modelDcf(mj, scOf(0, 2, 10, 20));
    assert.equal(dcf._terminalShareCountBasis, fall.basis);
    assert.ok(Math.abs(dcf._terminalShareCountM - r._terminalShareCount) < 1e-12, fall.name);
    assert.equal(dcf._dilutionAppliedInDetailYears, fall.imHauptwert);
    assert.equal(dcf._sharesChangeAppliedInMainValue, fall.imHauptwert);
    assert.ok(Math.abs(dcf._buybackDiagnosticTerminalShareCountM - r._sharesYear10) < 1e-12);
    assert.equal(dcf._dilutionAppliedInTerminalValue, false, 'Terminalwert bleibt unverwaessert');
    assert.equal(dcf._terminalSharesGrowthPa, 0);
    assert.equal(dcf._historicalDilutionExtrapolatedToPerpetuity, false);
  }

  // ── Die gemeldeten Zahlen des Rueckkauffalls, von Hand nachgerechnet ──
  const mjB = refMj({ shares_diluted: sdBuyback, net_debt: [0] });
  const fiB = S.buildForecastInputs(mjB);
  assert.ok(Math.abs(fiB.sharesGrowthPa + 4) < 1e-9, 'Rueckkauf 4 %/y');
  const rB = S.forecastDcfCore(fiB, 0, 2, 10, { enabled: false }, 20);
  assert.ok(Math.abs(rB._shares0 - 100) < 1e-9);
  assert.ok(Math.abs(rB._sharesYear10 - 66.48326359915008) < 1e-9);
  assert.ok(Math.abs(rB.pvTv - 7.373515410339788) < 1e-9,
    'Haupt-Terminalwert je Aktie, erhalten ' + rB.pvTv);
  assert.ok(Math.abs(rB._terminalShareCount - 100) < 1e-9,
    'ausgewiesen wird die heutige Aktienzahl, erhalten ' + rB._terminalShareCount);
  // Gegenprobe: der frueher ausgewiesene Teiler ergaebe 11,090784 — genau die
  // Zahl, die nicht zum Hauptwert gehoert.
  assert.ok(Math.abs((rB._pvTvAbs / rB._sharesYear10) - 11.090784373639039) < 1e-9);

  // ── Die BEWERTUNG selbst ist unveraendert ────────────────────────────
  // Referenzzahlen auf dem Ausgangsstand V1.0.63 (Commit 3a215ec) gemessen.
  const dcfB = S.modelDcf(mjB, scOf(0, 2, 10, 20));
  assert.ok(Math.abs(dcfB.base - 16.590366068896806) < 1e-9,
    'Fair Value unveraendert, erhalten ' + dcfB.base);
  assert.ok(Math.abs(dcfB._buybackUpliftPct - 34.67567333289907) < 1e-9,
    'Buyback-Uplift unveraendert, erhalten ' + dcfB._buybackUpliftPct);
  const dcfD = S.modelDcf(refMj({ shares_diluted: [125.971, 116.640, 108.0, 100.0],
    net_debt: [0] }), scOf(0, 2, 10, 20));
  assert.ok(Math.abs(dcfD.base - 7.913941025347281) < 1e-12,
    'Verwaesserungsfall unveraendert, erhalten ' + dcfD.base);

  // ── SICHTBARER Hinweis nennt den Rueckkaufzweig richtig ──────────────
  const wB = dcfB.warnings || [];
  const labelB = wB.find(x => /Shares-Projektion/.test(x));
  assert.ok(labelB, 'die Shares-Projektion wird ausgewiesen');
  assert.ok(/NICHT im Hauptwert/.test(labelB) && /heutigen\s+Aktienzahl/.test(labelB),
    'der Rueckkaufzweig wird als Diagnose benannt, erhalten: ' + labelB);

  // ── SNAPSHOT beschreibt die tatsaechlich verwendete Basis ────────────
  const mjS = refMj({ shares_diluted: sdBuyback, net_debt: [0] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 0 }, { price: 20 });
  const v = S.runValuationEngine(mjS);
  assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
  const snap = S.buildSnapshotForecastTargets(mjS, v);
  assert.equal(snap.available, true, snap.reason || '');
  assert.ok(Math.abs(snap.terminal.share_count - 100) < 1e-9,
    'Snapshot nennt die heutige Aktienzahl, erhalten ' + snap.terminal.share_count);
  assert.equal(snap.terminal.share_count_basis, 'shares_year_0_constant');
  assert.ok(Math.abs(snap.terminal.buyback_diagnostic_share_count - 66.48326359915008) < 1e-9,
    'die projizierte Zahl bleibt als Diagnose erhalten');
  assert.equal(snap.dilution.applied_in_main_value, false);
  assert.equal(snap.dilution.applied_in_detail_years, false);
  assert.equal(snap.dilution.terminal_share_count_basis, 'shares_year_0_constant');
  assert.equal(snap.dilution.buyback_treatment, 'diagnosis_only');
  assert.equal(snap.dilution.applied_in_terminal_value, false);
  assert.equal(snap.dilution.extrapolated_to_perpetuity, false);

  // ── KEINE neue Einstellung ───────────────────────────────────────────
  const mjX = refMj({ shares_diluted: sdBuyback, net_debt: [0] });
  mjX.valuation.assumptions = { terminal_share_count_basis: 'shares_year_10_constant',
                                shares_growth_terminal_pa: -4 };
  const rX = S.modelDcf(mjX, scOf(0, 2, 10, 20));
  assert.ok(Math.abs(rX.base - dcfB.base) < 1e-12, 'keine Einstellung veraendert die Basis');
  assert.equal(rX._terminalShareCountBasis, 'shares_year_0_constant');
});

test('R39 (O-3) beide Reverse-DCF-Karten zeigen den Vorbehalt bei unvollstaendiger Suche', () => {
  // Frueher (Restbefund nach 12C): Der Solver meldete `searchComplete: false`,
  // `uniquenessProven: false` und einen `caveat` — beide Karten zeigten die
  // Zahl trotzdem wie ein gesichertes Ergebnis.
  const lueckeMj = (price) => ({
    meta: { ticker: 'O3GAP', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000], ebit: [8, 8, 8, 8],
      ebitda: [58, 58, 58, 58], capex: [46, 46, 46, 46], cfo: [60, 60, 60, 60],
      shares_diluted: [100, 100, 100, 100], net_debt: [-2000] },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5, owc_pct_of_revenue: 15 },
    market: { price }
  });

  // ── Fall A · Loesung gefunden, Suche unvollstaendig ──────────────────
  const mjA = lueckeMj(20.50);
  const coreA = S.solveReverseDcfGrowth(mjA, {});
  assert.equal(coreA.status, 'ok', coreA.reason || '');
  assert.ok(coreA.impliedGrowthPct > 10.5 && coreA.impliedGrowthPct < 10.7,
    'implizites Wachstum ' + coreA.impliedGrowthPct);
  assert.equal(coreA.searchComplete, false);
  assert.equal(coreA.uniquenessProven, false);
  assert.ok(coreA.caveat && coreA.caveat.length > 0, 'der Solver liefert einen Vorbehalt');
  // Die Loesung ist nachgerechnet — das bleibt so.
  assert.equal(coreA.residualWithinTolerance, true);

  const vA = S.runValuationEngine(mjA);
  const ovA   = S.buildReverseDcfOverviewCard(mjA, vA);
  const cardA = S.buildReverseDcfDiagnosticBlock(mjA, vA, []);

  for (const [name, html] of [['Uebersichtskarte', ovA], ['Bewertungskarte', cardA]]) {
    // Die Zahl steht weiterhin da …
    assert.ok(/10\.(5|6)\d*%/.test(html), name + ' zeigt die Zahl');
    // … und unmittelbar dabei der Vorbehalt.
    assert.ok(/Eindeutigkeit nicht gesichert/.test(html),
      name + ' nennt die nicht gesicherte Eindeutigkeit nicht');
    assert.ok(/gefundene Lösung/.test(html),
      name + ' kennzeichnet das Ergebnis nicht als gefundene Loesung');
    assert.ok(/unvollständige Suche/.test(html),
      name + ' nennt die unvollstaendige Suche nicht');
    // Der Text des Solvers wird uebernommen, nicht neu erfunden.
    assert.ok(html.indexOf('Rasterintervall') >= 0 || html.indexOf('nicht ausgeschlossen') >= 0,
      name + ' uebernimmt den Vorbehaltstext des Solvers nicht');
  }

  // Vorbehaltstexte laufen durch die vorhandene Escaping-Logik: der Rohtext
  // enthaelt keine Sonderzeichen, aber ein eingeschleustes Zeichen darf nicht
  // als Markup ankommen.
  const escaped = S.escapeHtml('<b>x</b>&"');
  assert.equal(escaped.indexOf('<b>'), -1, 'escapeHtml wird verwendet');
  const vBoes = S.runValuationEngine(mjA);
  const coreBoes = S.solveReverseDcfGrowth(mjA, {});
  const _origSolve = S.solveReverseDcfGrowth;
  try {
    S.solveReverseDcfGrowth = function (m, o) {
      const r = _origSolve(m, o);
      if (r && r.status === 'ok') r.caveat = '<script>böse()</script>';
      return r;
    };
    const ovX   = S.buildReverseDcfOverviewCard(mjA, vBoes);
    const cardX = S.buildReverseDcfDiagnosticBlock(mjA, vBoes, []);
    for (const [name, html] of [['Uebersichtskarte', ovX], ['Bewertungskarte', cardX]]) {
      assert.equal(html.indexOf('<script>böse()</script>'), -1,
        name + ' gibt den Vorbehaltstext ungeschuetzt aus');
      assert.ok(html.indexOf('&lt;script&gt;') >= 0, name + ' escaped den Vorbehaltstext nicht');
    }
  } finally {
    S.solveReverseDcfGrowth = _origSolve;
  }
  assert.equal(S.solveReverseDcfGrowth, _origSolve);
  assert.ok(coreBoes.status === 'ok');

  // ── Fall B · vollstaendige Suche: KEIN Vorbehalt ─────────────────────
  const mjB = refMj({ net_debt: [0] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 }, { price: 17 });
  const coreB = S.solveReverseDcfGrowth(mjB, {});
  assert.equal(coreB.status, 'ok');
  assert.equal(coreB.searchComplete, true);
  assert.equal(coreB.caveat, null);
  const vB = S.runValuationEngine(mjB);
  const ovB   = S.buildReverseDcfOverviewCard(mjB, vB);
  const cardB = S.buildReverseDcfDiagnosticBlock(mjB, vB, []);
  for (const [name, html] of [['Uebersichtskarte', ovB], ['Bewertungskarte', cardB]]) {
    assert.equal(/Eindeutigkeit nicht gesichert/.test(html), false,
      name + ' zeigt einen Vorbehalt, obwohl die Suche vollstaendig ist');
    assert.ok(/0\.3\d*%/.test(html), name + ' zeigt die regulaere Zahl');
  }

  // ── Fall C · search_incomplete OHNE Zahl bleibt unveraendert ─────────
  const mjC = lueckeMj(19.50);
  const coreC = S.solveReverseDcfGrowth(mjC, {});
  assert.equal(coreC.status, 'search_incomplete');
  assert.equal(coreC.impliedGrowthPct, null);
  const vC = S.runValuationEngine(mjC);
  const ovC   = S.buildReverseDcfOverviewCard(mjC, vC);
  const cardC = S.buildReverseDcfDiagnosticBlock(mjC, vC, []);
  for (const [name, html] of [['Uebersichtskarte', ovC], ['Bewertungskarte', cardC]]) {
    assert.ok(/Suche unvollständig/.test(html), name + ' nennt den Status nicht');
    assert.ok(/Nichtexistenz nicht bewiesen/.test(html), name + ' relativiert nicht');
  }

  // ── Der SOLVER selbst ist unveraendert ───────────────────────────────
  // Suchgrenzen, Toleranzen und Bewertungsfunktion bleiben, wie sie sind.
  const Ssearch = evalInApp('REVERSE_DCF_SEARCH');
  assert.equal(Ssearch.gLoPct, -20);
  assert.equal(Ssearch.gHiPct, 40);
  assert.equal(Ssearch.gridStepPct, 0.5);
  assert.equal(Ssearch.tolerancePp, 1e-4);
  assert.equal(Ssearch.residualRelTol, 1e-3);
  assert.equal(JSON.stringify(coreA.unresolvedIntervalsPct), '[[16.5,17]]');
  assert.equal(JSON.stringify(coreA.evaluableRangePct), '[-20,16.5]');
});

// ═══════════════════════════════════════════════════════════════════════════
// R40–R41 (Regression, Korrekturchat 12C.2) — die beiden nach 12C.1
// reproduzierten Restfehler. Erwartungswerte unabhaengig nachgerechnet bzw.
// gegen den unveraenderten Ausgangsstand V1.0.64 (Commit d55dfbd) gemessen.
// ═══════════════════════════════════════════════════════════════════════════

test('R40 (A-6) teilweise fehlende Periodenmetadaten heben bekannte Widersprueche nicht auf', () => {
  // Frueher (Restbefund nach 12C.1): _daPairPeriodKeyed() sah nur EBITDA und
  // EBIT an. Fehlten die EBIT-Periodenmetadaten, wurde wieder nach Position
  // gerechnet — obwohl Umsatz (FY2025…) und EBITDA (FY2024…) nachweislich
  // verschiedene Berichtsperioden tragen. Gemessen auf `d55dfbd`:
  // D&A −150M, Referenz-FCF −50M, Herkunft `reported_period`, dazu eine
  // >30-%-Abweichungswarnung — und der echte Engine-Pfad akzeptierte das.
  const ohneEbitMeta = daPeriodMj({ meta: { ebit: undefined } });
  delete ohneEbitMeta.fundamentals._v4_meta.ebit;

  const dec = S._daPairingDecision(ohneEbitMeta.fundamentals);
  assert.equal(dec.mode, 'blocked');
  assert.equal(JSON.stringify(dec.known.slice().sort()), JSON.stringify(['ebitda', 'revenue']));
  assert.ok(dec.conflicts.length > 0, 'der Widerspruch wird benannt');
  assert.ok(/revenue@2025-12-31/.test(dec.conflicts[0]) && /ebitda@2024-12-31/.test(dec.conflicts[0]),
    'Konflikt an Position 0: ' + dec.conflicts[0]);

  const mc = S.computeMidCycleFcf(ohneEbitMeta);
  assert.equal(mc.status, 'insufficient_data');
  assert.equal(mc.value, null, 'keine angeblich gemessene Zahl');
  assert.equal(mc.daM, null, 'kein D&A-Wert aus vermischten Perioden');
  assert.equal(mc.daBasis, 'period_unresolved');
  assert.equal(mc.warning, null, 'und damit auch keine abgeleitete Abweichungswarnung');
  assert.ok(/nicht belegt/.test(mc.reason) && /widersprechen/.test(mc.reason), mc.reason);

  // Der zweite Pfad darf denselben Fehler nicht erneut erzeugen: auch die
  // historische Quotenbildung liefert hier nichts.
  const da = S._resolveDaForForecast(ohneEbitMeta);
  assert.equal(da.measuredPairing, 'blocked');
  assert.equal(da.measuredRatio, null);
  assert.equal(da.source, 'assumption_required');
  assert.equal(da.ratio, null, 'keine Quote aus einer Positionszuordnung');

  // ── ECHTER ENGINE-PFAD ───────────────────────────────────────────────
  const v = S.runValuationEngine(ohneEbitMeta);
  assert.equal(v.error, undefined, 'Engine laeuft: ' + (v.error || ''));
  const dm = v.modelResults.dcf_midcycle;
  assert.equal(dm.applicable, false, 'der Mid-Cycle-Pfad wird gesperrt statt akzeptiert');
  assert.ok(/nicht belegt/.test(dm.reason || ''), dm.reason);

  // ── Unterschiedliche Positionen fehlender Metadaten ──────────────────
  // Fehlt der UMSATZ-Ausweis, widersprechen sich EBIT und EBITDA — ebenfalls
  // gesperrt.
  const ohneRevMeta = daPeriodMj();
  delete ohneRevMeta.fundamentals._v4_meta.revenue;
  const decR = S._daPairingDecision(ohneRevMeta.fundamentals);
  assert.equal(decR.mode, 'blocked');
  assert.ok(/ebit@2025-12-31/.test(decR.conflicts[0]) && /ebitda@2024-12-31/.test(decR.conflicts[0]),
    decR.conflicts[0]);
  const mcR = S.computeMidCycleFcf(ohneRevMeta);
  assert.equal(mcR.status, 'insufficient_data');
  assert.equal(mcR.value, null);
  assert.equal(mcR.warning, null);

  // Vorhandene, aber VERSCHOBENE Perioden werden richtig zugeordnet, nicht
  // gesperrt: Umsatz und EBITDA ab FY2024, EBIT ab FY2025.
  // Von Hand: D&A = EBITDA(FY2024) − EBIT(FY2024) = 250 − 200 = 50
  //           ⇒ Referenz-FCF = 150 + 50 − 50 = 150
  const verschoben = daPeriodMj();
  verschoben.fundamentals._v4_meta.revenue = fyMeta(6, 2024);
  const decV = S._daPairingDecision(verschoben.fundamentals);
  assert.equal(decV.mode, 'period');
  const mcV = S.computeMidCycleFcf(verschoben);
  assert.equal(mcV.status, 'ok');
  assert.ok(Math.abs(mcV.value - 150) < 1e-9, 'erhalten ' + mcV.value);
  assert.ok(Math.abs(mcV.daM - 50) < 1e-9);
  assert.equal(mcV.daBasis, 'reported_period', 'die bewertete Periode ist jetzt belegt');

  // ── GEGENPROBEN ──────────────────────────────────────────────────────
  // 1) Vollstaendig belegter R37-Fall bleibt korrekt.
  const mcVoll = S.computeMidCycleFcf(daPeriodMj());
  assert.equal(mcVoll.status, 'ok');
  assert.ok(Math.abs(mcVoll.value - 150) < 1e-9);
  assert.equal(mcVoll.daBasis, 'measured_ratio');
  assert.equal(S._daPairingDecision(daPeriodMj().fundamentals).mode, 'period');

  // 2) Vollstaendig metadatenlose Altdaten bleiben nutzbar — unveraenderte
  //    Positionszuordnung. Von Hand: 150 + 50 − 50 = 150.
  const altMj = {
    meta: { sub_classification: 'cyclical' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000, 1000],
      ebit: [200, 200, 200, 200, 200], ebitda: [250, 250, 250, 250, 250],
      capex: [50, 50, 50, 50, 50], shares_diluted: [100, 100, 100, 100, 100] },
    valuation: { wacc_components: { tax_rate: 25 } }, market: {}
  };
  const decAlt = S._daPairingDecision(altMj.fundamentals);
  assert.equal(decAlt.mode, 'index');
  assert.equal(decAlt.known.length, 0);
  const mcAlt = S.computeMidCycleFcf(altMj);
  assert.equal(mcAlt.status, 'ok');
  assert.ok(Math.abs(mcAlt.value - 150) < 1e-9);
  assert.equal(mcAlt.daBasis, 'reported_period');
  assert.equal(S._resolveDaForForecast(altMj).measuredPairing, 'index');

  // 3) Meldet nur EINE Reihe Perioden, kann nichts widersprechen — die
  //    Positionszuordnung bleibt zulaessig (dokumentierte Grenze, siehe
  //    AUDIT-CHAT12.md 3f), wird aber als solche gekennzeichnet.
  const nurUmsatz = daPeriodMj();
  delete nurUmsatz.fundamentals._v4_meta.ebit;
  delete nurUmsatz.fundamentals._v4_meta.ebitda;
  const decU = S._daPairingDecision(nurUmsatz.fundamentals);
  assert.equal(decU.mode, 'index');
  assert.equal(JSON.stringify(decU.known), JSON.stringify(['revenue']));
  const daU = S._resolveMidCycleDa(nurUmsatz, 1000);
  assert.equal(daU.periodMatched, false, 'nicht als periodengleich ausgewiesen');
  assert.equal(daU.pairingMode, 'index');
  assert.ok(/nach Position zugeordnet/.test(daU.label), daU.label);

  // 4) Manuelle D&A-Annahmen behalten Vorrang — auch bei gesperrter Zuordnung.
  const ovMj = daPeriodMj();
  delete ovMj.fundamentals._v4_meta.ebit;
  ovMj.valuation.assumptions = { da_pct_of_revenue: 10 };
  const mcOv = S.computeMidCycleFcf(ovMj);
  assert.equal(mcOv.status, 'ok');
  assert.equal(mcOv.daBasis, 'manual_override');
  assert.ok(Math.abs(mcOv.daM - 100) < 1e-9, '10 % von 1.000');
  assert.ok(Math.abs(mcOv.value - 200) < 1e-9, '150 + 100 − 50');
  const ov0Mj = daPeriodMj();
  delete ov0Mj.fundamentals._v4_meta.ebit;
  ov0Mj.valuation.assumptions = { da_pct_of_revenue: 0 };
  const mcOv0 = S.computeMidCycleFcf(ov0Mj);
  assert.equal(mcOv0.status, 'ok', 'eine ausdrueckliche Null bleibt zulaessig');
  assert.equal(mcOv0.daBasis, 'manual_override');
  assert.ok(Math.abs(mcOv0.value - 100) < 1e-9);

  // 5) Keine Klemmung: eine gesperrte Zuordnung liefert null, nicht 0.
  assert.notEqual(mc.value, 0);
  assert.equal(mc.value, null);

  // Dieser Nachweis laeuft auf einem SYNTHETISCHEN Master-JSON ueber den
  // produktiven Bewertungsweg. Er belegt KEINEN Fehler eines echten
  // SEC-Live-Imports — ein solcher wurde hier nicht geprueft.
});

test('R41 (A-5) der Erklaerungstext folgt dem Kernergebnis, nicht der 0,5-%-Schwelle', () => {
  // Frueher (Restbefund nach 12C.1): Die Hauptrechnung beruecksichtigt JEDE
  // positive Aktienzunahme (g > 0), der sichtbare Text richtete sich aber nach
  // einer 0,5-%-Schwelle. Bei +0,25 %/y stand deshalb „der Hauptwert rechnet
  // durchgehend mit der heutigen Aktienzahl", obwohl er mit 102,528313 Mio.
  // Aktien des Jahres 10 rechnete.
  const p = (x) => [100, 100 / x, 100 / Math.pow(x, 2), 100 / Math.pow(x, 3)];
  const faelle = [
    { name: '+0,25 %/y (unter der Schwelle)', sd: p(1.0025), g: 0.25,
      imHauptwert: true,  basis: 'shares_year_10_constant', teiler: 102.52831332277852 },
    { name: '+0,50 %/y (auf der Schwelle)',   sd: p(1.005),  g: 0.50,
      imHauptwert: true,  basis: 'shares_year_10_constant', teiler: 105.11401320407893 },
    { name: '+2,00 %/y (ueber der Schwelle)', sd: p(1.02),   g: 2.00,
      imHauptwert: true,  basis: 'shares_year_10_constant', teiler: null },
    { name: 'konstante Aktienzahl',           sd: [100, 100, 100, 100], g: 0,
      imHauptwert: false, basis: 'shares_year_0_constant',  teiler: 100 },
    { name: 'Rueckkaeufe -4 %/y',             sd: p(0.96),   g: -4,
      imHauptwert: false, basis: 'shares_year_0_constant',  teiler: 100 }
  ];

  for (const fall of faelle) {
    const mj  = refMj({ shares_diluted: fall.sd, net_debt: [0] });
    const fi  = S.buildForecastInputs(mj);
    assert.ok(Math.abs(fi.sharesGrowthPa - fall.g) < 1e-6, fall.name + ': g=' + fi.sharesGrowthPa);
    const r   = S.forecastDcfCore(fi, 0, 2, 10, { enabled: false }, 20);
    const dcf = S.modelDcf(mj, scOf(0, 2, 10, 20));

    // Der Kern ist die einzige Quelle der Aussage — und er stimmt mit der
    // tatsaechlichen Rechnung ueberein.
    assert.equal(r._sharesChangeAppliedInMainValue, fall.imHauptwert, fall.name);
    assert.equal(dcf._terminalShareCountBasis, fall.basis, fall.name);
    assert.ok(Math.abs(r.pvTv - (r._pvTvAbs / r._terminalShareCount)) < 1e-12,
      fall.name + ': ausgewiesener Teiler rekonstruiert den Hauptwert nicht');
    if (fall.teiler != null) {
      assert.ok(Math.abs(dcf._terminalShareCountM - fall.teiler) < 1e-9,
        fall.name + ': Teiler ' + dcf._terminalShareCountM);
    }

    const w = dcf.warnings || [];
    const label = w.find(x => /Shares-Projektion/.test(x));
    assert.ok(label, fall.name + ': die Shares-Projektion wird ausgewiesen');

    if (fall.imHauptwert) {
      assert.ok(/im Hauptwert berücksichtigt/.test(label),
        fall.name + ': Rechenweg falsch beschrieben — ' + label);
      assert.ok(/Detailjahre 1–10/.test(label) && /Terminalzeitpunkt/.test(label),
        fall.name + ': Zeitraum fehlt — ' + label);
      // Genau die frueher falsche Aussage darf hier nicht mehr stehen.
      assert.equal(/durchgehend mit der heutigen Aktienzahl/.test(label), false,
        fall.name + ': behauptet weiterhin die heutige Aktienzahl — ' + label);
      // Die Hinweise zur Verwaesserung haengen ebenfalls am Kernergebnis,
      // nicht mehr an der Schwelle.
      assert.ok(w.some(x => /verwässerungsadjustiert/.test(x) && /Detailjahren 1–10/.test(x)),
        fall.name + ': Trennung der Effekte fehlt');
      assert.ok(w.some(x => /Verwässerungs-Vereinfachung/.test(x)),
        fall.name + ': Vereinfachungshinweis fehlt');
    } else {
      assert.ok(/NICHT im Hauptwert/.test(label) && /durchgehend mit der heutigen Aktienzahl/.test(label),
        fall.name + ': Rechenweg falsch beschrieben — ' + label);
      assert.equal(/im Hauptwert berücksichtigt/.test(label), false, fall.name);
    }
  }

  // ── Groessenordnung bleibt eingeordnet, ohne falsche Rechenaussage ────
  const klein = S.modelDcf(refMj({ shares_diluted: p(1.0025), net_debt: [0] }), scOf(0, 2, 10, 20));
  const kleinLabel = (klein.warnings || []).find(x => /Shares-Projektion/.test(x));
  assert.ok(/geringe Dilution/.test(kleinLabel), 'die Groessenordnung wird weiterhin benannt: ' + kleinLabel);
  assert.ok(/\+0\.25%\/y/.test(kleinLabel), kleinLabel);

  // ── Die BEWERTUNG selbst ist unveraendert ────────────────────────────
  // Referenzzahlen auf dem Ausgangsstand V1.0.64 (Commit d55dfbd) gemessen.
  assert.ok(Math.abs(klein.base - 16.300651655509) < 1e-9,
    'Fair Value unveraendert, erhalten ' + klein.base);
  assert.equal(klein._buybackUpliftPct, 0);
  const rueck = S.modelDcf(refMj({ shares_diluted: p(0.96), net_debt: [0] }), scOf(0, 2, 10, 20));
  assert.ok(Math.abs(rueck.base - 16.590366068896806) < 1e-9, 'erhalten ' + rueck.base);
  assert.ok(Math.abs(rueck._buybackUpliftPct - 34.67567333289907) < 1e-9,
    'Buyback-Uplift unveraendert, erhalten ' + rueck._buybackUpliftPct);
  const stark = S.modelDcf(refMj({ shares_diluted: [125.971, 116.640, 108.0, 100.0],
    net_debt: [0] }), scOf(0, 2, 10, 20));
  assert.ok(Math.abs(stark.base - 7.913941025347281) < 1e-12, 'erhalten ' + stark.base);

  // ── Terminalkonvention und Einstellungen unveraendert ────────────────
  const konvention = evalInApp('TERMINAL_DILUTION');
  assert.equal(konvention.horizonYears, 10);
  assert.equal(konvention.appliedInTerminalValue, false);
  assert.equal(konvention.dilutionTerminalShareCountBasis, 'shares_year_10_constant');
  assert.equal(konvention.buybackOrFlatTerminalShareCountBasis, 'shares_year_0_constant');
  const mjX = refMj({ shares_diluted: p(1.0025), net_debt: [0] });
  mjX.valuation.assumptions = { shares_growth_threshold_pct: 5, terminal_share_count_basis: 'x' };
  const rX = S.modelDcf(mjX, scOf(0, 2, 10, 20));
  assert.ok(Math.abs(rX.base - klein.base) < 1e-12, 'keine neue Einstellung');
  assert.equal(rX._terminalShareCountBasis, 'shares_year_10_constant');

  // ── Split-/Clamp-Regeln unveraendert ─────────────────────────────────
  // Ein Split-Verdacht setzt sharesGrowthPa auf 0; der Hauptwert rechnet dann
  // durchgehend mit der heutigen Aktienzahl — und sagt das auch.
  const split = S.modelDcf(refMj({ shares_diluted: [200, 100, 100, 100], net_debt: [0] }),
    scOf(0, 2, 10, 20));
  assert.equal(split._sharesGrowthPaProjected, 0);
  assert.equal(split._sharesChangeAppliedInMainValue, false);
  const splitLabel = (split.warnings || []).find(x => /Shares-Projektion/.test(x));
  assert.ok(/Split\/Restatement-Verdacht/.test(splitLabel), splitLabel);
  assert.ok(/NICHT im Hauptwert/.test(splitLabel), splitLabel);
});

// ═══════════════════════════════════════════════════════════════════════════
// R42–R46 (Regression, Korrekturchat 12D) — die fuenf Befunde des
// unabhaengigen Auditberichts nach V1.0.65. Jeder Test wurde zuerst am
// unveraenderten Ausgangsstand `7b1fd10` ausgefuehrt und ist dort
// fehlgeschlagen.
// ═══════════════════════════════════════════════════════════════════════════

// ── Hilfen fuer die Vergleichsmultiples ───────────────────────────────────
const relMj = (fundOverrides, ownOverrides) => ({
  fundamentals: Object.assign({ ebitda: [250], shares_diluted: [100] }, fundOverrides || {}),
  market: { own_multiples_median: Object.assign({ ev_ebitda_10y: 10 }, ownOverrides || {}) }
});
const evModelOf = (mj) => {
  const rel = S.computeRelativeMultiplesFV(mj);
  return { rel, ev: rel.models.find(m => m.id === 'ev_ebitda_10y') };
};

test('R42 (Befund 2) die EV/EBITDA-Wertbruecke behandelt fehlende Schulden nicht als Null', () => {
  // Ausgangsstand: `(f.total_debt && f.total_debt[0]) || 0` — fehlende Angaben
  // ergaben 25 USD/Aktie und galten als verfuegbar.

  // ── Pflichtfall 1: Schulden UND Liquiditaet fehlen ⇒ kein Aktienwert ──
  {
    const { rel, ev } = evModelOf(relMj({}));
    assert.equal(ev.available, false, 'unbekannt ist nicht schuldenfrei');
    assert.equal(ev.base, null);
    assert.equal(rel.hasAny, false);
    assert.equal(rel.availableCount, 0);
    assert.equal(rel.median, null);
    assert.ok(/Eigenkapitalbruecke nicht belegt/.test(ev.reason), ev.reason);
    // Der operative Unternehmenswert bleibt getrennt verfuegbar.
    assert.equal(ev.enterpriseValueM, 2500);
    assert.equal(ev.bridgeBlocked, true);
  }

  // ── Pflichtfall 2: Schulden unbekannt, Liquiditaet ausdruecklich 0 ────
  for (const fund of [{ cash: [0] }, { total_debt: [null], cash: [0] }]) {
    const { ev } = evModelOf(relMj(fund));
    assert.equal(ev.available, false, JSON.stringify(fund));
    assert.equal(ev.base, null);
  }

  // ── Pflichtfall 3: beide ausdruecklich 0 ⇒ 25 USD/Aktie ──────────────
  {
    const { ev } = evModelOf(relMj({ total_debt: [0], cash: [0] }));
    assert.equal(ev.available, true, 'gemeldete Nullwerte bleiben gueltig');
    assert.ok(Math.abs(ev.base - 25) < 1e-12, 'erhalten ' + ev.base);
    assert.equal(ev.netDebtM, 0);
  }

  // ── Pflichtfall 4: Schulden 500, Liquiditaet 0 ⇒ 20 USD/Aktie ────────
  {
    const { ev } = evModelOf(relMj({ total_debt: [500], cash: [0] }));
    assert.ok(Math.abs(ev.base - 20) < 1e-12, 'erhalten ' + ev.base);
    assert.equal(ev.netDebtM, 500);
  }

  // ── Pflichtfall 5: Schulden 0, Liquiditaet 200 ⇒ 27 USD/Aktie ────────
  // Nettoliquiditaet erhoeht den Eigenkapitalwert (Vorzeichen).
  {
    const { ev } = evModelOf(relMj({ total_debt: [0], cash: [200] }));
    assert.ok(Math.abs(ev.base - 27) < 1e-12, 'erhalten ' + ev.base);
    assert.equal(ev.netDebtM, -200);
  }

  // ── Pflichtfall 6: unvereinbare Bilanzperioden ⇒ begruendete Sperre ──
  {
    const mj = relMj({ total_debt: [500], cash: [100] });
    mj.fundamentals._v4_meta = {
      total_debt: { periods: ['2025-12-31'], isFlowConcept: false, unit: 'USD' },
      cash:       { periods: ['2024-12-31'], isFlowConcept: false, unit: 'USD' }
    };
    const { ev } = evModelOf(mj);
    assert.equal(ev.available, false);
    assert.ok(/Berichtsperioden|kompatible Periode/.test(ev.reason), ev.reason);
  }

  // ── FY-/TTM-Kontext: EBITDA-Jahr und Bilanzjahr muessen zusammenpassen ─
  {
    const mj = relMj({ total_debt: [500], cash: [100] });
    mj.fundamentals._v4_meta = {
      ebitda:     { periods: ['2025-12-31'], isFlowConcept: true,  unit: 'USD' },
      total_debt: { periods: ['2023-12-31'], isFlowConcept: false, unit: 'USD' },
      cash:       { periods: ['2023-12-31'], isFlowConcept: false, unit: 'USD' }
    };
    const { ev } = evModelOf(mj);
    assert.equal(ev.available, false, 'EV aus FY2025 gegen Bilanz FY2023');
    assert.ok(/unterschiedlichen Berichtsperioden/.test(ev.reason), ev.reason);
  }

  // ── Dieselbe gepruefte Aufloesung wie der DCF ────────────────────────
  // Ein als unvollstaendig gekennzeichneter Schuldenumfang sperrt beide.
  {
    const f = { total_debt: [500], cash: [0],
                _v4_meta: { total_debt: { scopeComplete: false,
                            scopeIndeterminateReason: 'nur langfristiger Teilbetrag belegt' } } };
    const bridge = S._resolveNetDebtForDcfBridge(f);
    assert.equal(bridge.available, false, 'DCF-Bruecke sperrt');
    const { ev } = evModelOf(relMj(f));
    assert.equal(ev.available, false, 'Vergleichsmultiple sperrt aus DEMSELBEN Grund');
    assert.ok(/Umfang|Teilbetrag/.test(ev.reason), ev.reason);
  }

  // ── Andere Vergleichsmodelle bleiben unabhaengig verfuegbar ──────────
  {
    const mj = relMj({ eps_diluted: [2], fcf: [100] },
                     { pe_10y: 15, p_fcf_10y: 20 });
    const rel = S.computeRelativeMultiplesFV(mj);
    const pe  = rel.models.find(m => m.id === 'pe_10y');
    const pfcf = rel.models.find(m => m.id === 'p_fcf_10y');
    assert.equal(pe.available, true);
    assert.ok(Math.abs(pe.base - 30) < 1e-12, 'erhalten ' + pe.base);
    assert.equal(pfcf.available, true);
    assert.ok(Math.abs(pfcf.base - 20) < 1e-12, 'erhalten ' + pfcf.base);
    assert.equal(rel.availableCount, 2, 'nur die EV-Bruecke ist gesperrt');
    assert.ok(Math.abs(rel.median - 25) < 1e-12, 'erhalten ' + rel.median);
    assert.equal(rel.bridgeBlockedCount, 1);
  }

  // ── Randfall: berechenbarer nichtpositiver Wert ist KEINE Datenluecke ─
  {
    const { rel, ev } = evModelOf(relMj({ total_debt: [3000], cash: [0] }));
    assert.equal(ev.available, true, 'der Wert ist gerechnet, nicht fehlend');
    assert.ok(Math.abs(ev.base - (-5)) < 1e-12, 'erhalten ' + ev.base);
    assert.equal(ev.nonPositive, true);
    assert.ok(/Ergebnis, kein fehlender Wert/.test(ev.excludedFromMedian), ev.excludedFromMedian);
    assert.equal(ev.reason, undefined, 'kein Datenmangel-Grund');
    assert.equal(rel.nonPositiveCount, 1);
    assert.equal(rel.availableCount, 0, 'nicht als Referenzpreis im Median');
    assert.equal(rel.median, null);
    assert.equal(rel.computedCount, 1, 'aber als berechnet gezaehlt');
  }

  // ── Bewertungs-Fallback: keine Scheinverfuegbarkeit ──────────────────
  // `fallbackMode` haengt an `hasAny`; ohne belegte Bruecke bleibt es
  // 'market_only' statt 'relative_multiples'.
  {
    const mj = relMj({});
    const rel = S.computeRelativeMultiplesFV(mj);
    assert.equal(rel.hasAny ? 'relative_multiples' : 'market_only', 'market_only');
  }
});

test('R43 (Befund 4) Financials-Modelle zaehlen als EINE Familie ohne unabhaengige Bestaetigung', () => {
  const CFG = evalInApp('SYNTHESIS_CONFIG');
  const finMj = () => ({
    meta: { ticker: 'FINX', sub_classification: 'financial' },
    fundamentals: {
      revenue: [1000, 1000, 1000, 1000, 1000],
      ebit: [200, 200, 200, 200, 200],
      net_income: [130, 130, 130, 130, 130],
      book_value: [1000, 1000, 1000, 1000, 1000],
      tangible_book_value: [1000, 1000, 1000, 1000, 1000],
      eps_diluted: [1.3, 1.3, 1.3, 1.3, 1.3],
      shares_diluted: [100, 100, 100, 100, 100]
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 wacc_derived: 10, cost_of_equity_derived: 10,
                 growth_terminal: 2, growth_stage1: 5 },
    market: { price: 14 }
  });
  const mj = finMj();
  const v  = S.runValuationEngine(mj);
  assert.equal(Array.from(v.router.activeModels).join(','), 'p_tbv_gordon,excess_return');

  // ── Die Einzelwerte bleiben fachlich unveraendert ────────────────────
  const g = v.modelResults.p_tbv_gordon;
  const e = v.modelResults.excess_return;
  assert.equal(g.applicable, true);
  assert.equal(e.applicable, true);
  assert.ok(Math.abs(g.base - 13.75) < 1e-9, 'Gordon base ' + g.base);
  assert.ok(Math.abs(e.base - 13.75) < 1e-9, 'Excess Return base ' + e.base);
  // Die Uebereinstimmung ist eine algebraische Identitaet, kein Messergebnis.
  ['conservative', 'base', 'optimistic'].forEach(k => {
    assert.ok(Math.abs(g[k] - e[k]) < 1e-9, k + ': ' + g[k] + ' vs ' + e[k]);
  });

  // ── Beide bleiben als Darstellungen sichtbar und erklaeren die Abhaengigkeit ─
  assert.equal(g.modelFamily, 'financials_book_return');
  assert.equal(e.modelFamily, 'financials_book_return');
  [g, e].forEach(m => {
    assert.ok((m.warnings || []).some(w => /keine unabhaengige Bestaetigung/i.test(w)),
      'Familienhinweis am Modell fehlt: ' + JSON.stringify(m.warnings));
  });

  // ── Synthese: eine Familie, keine hohe Uebereinstimmung ──────────────
  const syn = S.runFairValueSynthesizer(mj, v, S.runQualityEngine(mj),
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(mj) }));
  assert.equal(syn.activeModelsCount, 2, 'zwei gerechnete Darstellungen');
  assert.equal(syn.independentModelCount, 1, 'aber nur EINE unabhaengige Familie');
  assert.equal(syn.modelAgreement, 'n/a',
    'Ausgangsstand lieferte hier "high" aus zwei identischen Werten');
  assert.ok(/derselben Modellfamilie/.test(syn.modelAgreementReason), syn.modelAgreementReason);
  assert.equal(syn._confidenceLevel, 'medium',
    'Ausgangsstand lieferte "high" — eine Identitaet darf kein Vertrauen stiften');
  assert.equal(syn.modelFitConfidence, 55,
    'Ausgangsstand: 72 (zwei Modelle) — maszgeblich ist die Familienzahl');
  assert.equal((syn.modelFamilyNotes || []).length, 1);
  assert.equal(Array.from(syn.modelFamilyNotes[0].members).join(','), 'p_tbv_gordon,excess_return');

  // ── Der Fair Value selbst bleibt unveraendert ────────────────────────
  assert.ok(Math.abs(syn.range.base - 13.75) < 1e-9, 'range.base ' + syn.range.base);

  // ── Keine doppelte Gewichtung: beide teilen sich EINEN Modellslot ────
  // (rim-Gewicht je zur Haelfte — unveraendert gegenueber V1.0.65)
  assert.ok(Math.abs(syn.range.base - g.base) < 1e-9,
    'gewichtetes Ergebnis entspricht dem einen Familienwert');

  // ── Gegenprobe: wirklich unabhaengige Modelle bleiben unberuehrt ─────
  const nf = {
    meta: { ticker: 'NONFIN', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: [1000, 1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200, 200],
      ebitda: [250, 250, 250, 250, 250], capex: [50, 50, 50, 50, 50],
      fcf: [150, 150, 150, 150, 150], eps_diluted: [1.5, 1.5, 1.5, 1.5, 1.5],
      book_value: [1000, 1000, 1000, 1000, 1000], net_debt: [0],
      shares_diluted: [100, 100, 100, 100, 100] },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false }, wacc_derived: 10,
      cost_of_equity_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 20 }
  };
  const v2 = S.runValuationEngine(nf);
  const syn2 = S.runFairValueSynthesizer(nf, v2, S.runQualityEngine(nf),
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(nf) }));
  assert.equal(syn2.activeModelsCount, syn2.independentModelCount,
    'dcf + rim sind zwei Familien');
  assert.equal(syn2.modelAgreementReason, null);
  assert.equal(syn2.modelFitConfidence, 70, 'unveraendert gegenueber V1.0.65');
  assert.equal((syn2.modelFamilyNotes || []).length, 0);

  // ── Keine neue Bewertungsmethode, keine verschobenen Annahmen ────────
  const fams = evalInApp('MODEL_FAMILIES');
  assert.equal(Object.keys(fams).sort().join(','), 'excess_return,p_tbv_gordon');
});

// ── Hilfen fuer den Journal-/Import-Pfad ──────────────────────────────────
const SNAP_KEY_V = evalInApp('SNAP_KEY');
const mkSnapRec = (over) => Object.assign({
  id: 'ok123', ticker: 'AAPL', name: 'Apple', timestamp: '2026-01-02T03:04:05.000Z',
  masterJson: { meta: { ticker: 'AAPL' }, fundamentals: {} }, _snapshotFormat: 2
}, over || {});

// Rendert das Journal mit einem minimalen Element-Ersatz und liefert das
// erzeugte HTML. Der ECHTE Renderer laeuft — es wird nichts nachgebildet.
function renderJournalHtml(records) {
  const prev = S.document.getElementById;
  let html = '';
  S.localStorage.setItem(SNAP_KEY_V, JSON.stringify(records));
  S.document.getElementById = (id) => (id === 'snap-list')
    ? { set innerHTML(v) { html = v; }, get innerHTML() { return html; } }
    : null;
  try { S.renderSnapshots(); } finally { S.document.getElementById = prev; }
  return html;
}

test('R44 (Befund 1) importierte Snapshot-IDs erzeugen kein HTML und keine Ereignisbehandler', () => {
  const XSS_QUOTE = "x'); alert('pwned'); //";
  const XSS_TAG   = '"><img src=x onerror="window.__pwned=1">';

  // ── Die gemeinsame Pruefstelle weist solche IDs ab ───────────────────
  // (dieselbe Funktion bedient Import UND den Journal-Schutz)
  for (const bad of [XSS_QUOTE, XSS_TAG, 'mit leerzeichen', 'a'.repeat(129), '<b>']) {
    const probs = S.validateSnapshotRecordStructure(mkSnapRec({ id: bad }));
    assert.ok(probs.length > 0, 'nicht abgewiesen: ' + JSON.stringify(bad));
    assert.ok(/unzulaessige Zeichen|nichtleerer Text/.test(probs[0]), probs[0]);
  }

  // ── Gueltige bestehende IDs bleiben erhalten ─────────────────────────
  // (vom Werkzeug erzeugtes Base36 und frueher exportierte Kennungen)
  for (const good of ['ok123', 'm5k2j9x1ab', 'AAPL-2026-01-02T03:04:05.000Z', 'snap_1.2']) {
    const probs = S.validateSnapshotRecordStructure(mkSnapRec({ id: good }));
    assert.equal(probs.length, 0, JSON.stringify(good) + ' → ' + probs.join(' | '));
  }

  // ── Der regulaere Importparser laesst sie nicht mehr durch ───────────
  const payload = { _kind: evalInApp('SNAPSHOT_EXPORT_KIND'), _snapshotFormat: 2,
                    snapshots: [mkSnapRec({ id: XSS_TAG })] };
  const res = S.parseSnapshotImportPayload(payload);
  assert.equal(res.ok, false, 'praeparierter Snapshot wurde importiert');
  assert.equal(res.rejected, 1);
  assert.equal(res.snapshots.length, 0, 'nichts uebernommen');
  assert.ok(/unzulaessige Zeichen/.test(res.errors.join(' ')), res.errors.join(' '));

  // ── Der ECHTE Renderer erzeugt keine Inline-Ereignisattribute mehr ───
  const html = renderJournalHtml([mkSnapRec({ id: 'ok123' })]);
  assert.equal(/onclick=/i.test(html), false, 'Inline-onclick im Journal');
  assert.equal(/\son[a-z]+\s*=\s*"/i.test(html), false, 'irgendein Inline-Ereignisattribut');
  assert.ok(/data-action="snapshot-load"/.test(html));
  assert.ok(/data-action="snapshot-recompute"/.test(html));
  assert.ok(/data-action="snapshot-delete"/.test(html));
  assert.ok(/data-action-value="ok123"/.test(html));

  // ── Ein frueher gespeicherter Schrott-Datensatz wird ausgewiesen,
  //    nicht ausgefuehrt und nicht geloescht ────────────────────────────
  const brokenHtml = renderJournalHtml([mkSnapRec({ id: XSS_TAG })]);
  assert.ok(/unbrauchbare/.test(brokenHtml), 'nicht als unbrauchbar ausgewiesen');
  assert.equal(/<img/i.test(brokenHtml), false, 'rohes Markup in der Ausgabe');
  assert.equal(/<script/i.test(brokenHtml), false);
  assert.ok(/&lt;img/.test(brokenHtml), 'Markup muss escaped erscheinen');
  const stillStored = JSON.parse(S.localStorage.getItem(SNAP_KEY_V));
  assert.equal(stillStored.length, 1, 'gespeicherter Bestand wurde veraendert');
  assert.equal(stillStored[0].id, XSS_TAG, 'Datensatz wurde umgeschrieben');

  // ── Der Ereignispfad: Delegation statt Inline-Code ───────────────────
  // Der Wert wird als ZEICHENKETTE an die Funktion gereicht; er wird nie
  // ausgewertet. Geprueft am echten _installDomActionDelegation().
  const prevDoc = S.document;
  let captured = null;
  S.document = { addEventListener: (ev, fn) => { if (ev === 'click') captured = fn; } };
  try {
    evalInApp('_domActionDelegationInstalled = false; _installDomActionDelegation();');
    assert.ok(typeof captured === 'function', 'kein Klick-Listener verbunden');
    const seen = [];
    const handlers = evalInApp('DOM_ACTION_HANDLERS');
    const origLoad = handlers['snapshot-load'];
    const el = {
      getAttribute: (a) => a === 'data-action' ? 'snapshot-load'
                         : a === 'data-action-value' ? XSS_QUOTE : null
    };
    evalInApp('window.__testSeen = [];');
    S.DOM_ACTION_HANDLERS_TEST = null;
    handlers['snapshot-load'] = (v) => { seen.push(v); };
    captured({ target: { closest: (sel) => (sel === '[data-action]' ? el : null) },
               preventDefault: () => {} });
    handlers['snapshot-load'] = origLoad;
    assert.equal(seen.length, 1, 'Handler nicht aufgerufen');
    assert.equal(seen[0], XSS_QUOTE, 'Wert wurde veraendert oder ausgewertet');
    assert.equal(typeof seen[0], 'string');
  } finally {
    S.document = prevDoc;
    evalInApp('_domActionDelegationInstalled = false;');
  }

  // ── Dasselbe Muster bei den Override-Knoepfen ────────────────────────
  const handlerTable = evalInApp('Object.keys(DOM_ACTION_HANDLERS).sort().join(",")');
  assert.equal(handlerTable,
    'override-open,override-remove,snapshot-delete,snapshot-load,snapshot-recompute');

  // Quelltextpruefung am AUSGELIEFERTEN Stand: kein Inline-Ereignisattribut
  // enthaelt mehr eine Template-Interpolation der Snapshot-/Hard-Stop-Kennung.
  const src = readFileSync(APP_FILE, 'utf8');
  assert.ok(src.indexOf('data-action="override-remove"') >= 0);
  assert.ok(src.indexOf('data-action="override-open"') >= 0);
  assert.equal(/onclick="[^"]*\$\{/.test(src), false,
    'onclick mit interpoliertem Wert im ausgelieferten Quelltext');
  for (const fn of ['loadSnapshot', 'loadSnapshotWithCurrentModel', 'deleteSnapshot',
                    'removeOverride', 'openOverrideModal']) {
    // Gesucht wird der ERZEUGENDE Code (Inline-Attribut mit interpoliertem
    // Wert), nicht die Erwaehnung des alten Musters in einem Kommentar.
    assert.equal(src.indexOf('onclick="' + fn + "('$" + '{') >= 0, false,
      'Inline-onclick fuer ' + fn + ' noch vorhanden');
  }
});

test('R45 (Befund 5) ungueltige Importe werfen keine Ausnahme und beschaedigen nichts', () => {
  // ── Master-JSON: Top-Level-Typ VOR jedem Feldzugriff ─────────────────
  const prev = S.document.getElementById;
  const status = { textContent: '', className: '' };
  const runImport = (text) => {
    S.document.getElementById = (id) => (id === 'import-master-json') ? { value: text } : status;
    try { return { ok: S.importMasterJsonFromTextarea(), err: null }; }
    catch (e) { return { ok: null, err: e }; }
    finally { S.document.getElementById = prev; }
  };
  for (const [text, was] of [['null', 'null'], ['[1,2,3]', 'ein Array'], ['"text"', 'string'], ['42', 'number']]) {
    status.textContent = '';
    const r = runImport(text);
    assert.equal(r.err, null, 'ungefangene Ausnahme bei ' + text + ': ' + (r.err && r.err.message));
    assert.equal(r.ok, false, 'Erfolgsmeldung bei ' + text);
    assert.ok(/Kein gültiges Master-JSON/.test(status.textContent), status.textContent);
    assert.ok(status.textContent.indexOf(was) >= 0, was + ' nicht benannt: ' + status.textContent);
    assert.equal(status.className, 'import-status err');
    assert.ok(/bleibt unverändert/.test(status.textContent), 'Bestandszusage fehlt');
  }
  // Kaputtes JSON bleibt wie bisher eine gemeldete Parse-Meldung.
  status.textContent = '';
  const broken = runImport('{ nicht json');
  assert.equal(broken.err, null);
  assert.equal(broken.ok, false);
  assert.ok(/JSON-Parse-Fehler/.test(status.textContent), status.textContent);

  // ── Gruppierung: Prototyp-Namen sind gewoehnliche Ticker ─────────────
  for (const ticker of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'AAPL']) {
    const recs = [mkSnapRec({ id: 's1', ticker }), mkSnapRec({ id: 's2', ticker, timestamp: '2026-02-02T00:00:00.000Z' })];
    let html = null;
    assert.doesNotThrow(() => { html = renderJournalHtml(recs); }, 'Ticker ' + ticker);
    assert.ok(html.indexOf('data-action="snapshot-load"') >= 0, 'Journal leer bei ' + ticker);
    assert.equal(/unbrauchbare/.test(html), false, ticker + ' faelschlich abgewiesen');
  }
  // Gemischt in EINEM Bestand — die Gruppierung darf nicht kippen.
  const gemischt = [mkSnapRec({ id: 'g1', ticker: 'constructor' }),
                    mkSnapRec({ id: 'g2', ticker: '__proto__' }),
                    mkSnapRec({ id: 'g3', ticker: 'AAPL' })];
  let htmlMix = null;
  assert.doesNotThrow(() => { htmlMix = renderJournalHtml(gemischt); });
  assert.equal((htmlMix.match(/data-action="snapshot-load"/g) || []).length, 3);

  // ── Ein fehlgeschlagener Snapshot-Import laesst den Bestand unberuehrt ─
  const vorher = [mkSnapRec({ id: 'keep1', ticker: 'MSFT' })];
  S.localStorage.setItem(SNAP_KEY_V, JSON.stringify(vorher));
  const bad = S.parseSnapshotImportPayload({ _kind: evalInApp('SNAPSHOT_EXPORT_KIND'),
    _snapshotFormat: 2, snapshots: [mkSnapRec({ id: 'gut1' }), mkSnapRec({ id: '<script>' })] });
  assert.equal(bad.ok, false, 'Alles-oder-nichts verletzt');
  assert.equal(bad.snapshots.length, 0);
  const nachher = JSON.parse(S.localStorage.getItem(SNAP_KEY_V));
  assert.equal(nachher.length, 1, 'Bestand veraendert');
  assert.equal(nachher[0].id, 'keep1');
  // Und der Gegenfall: zwei gueltige Datensaetze gehen durch.
  const good = S.parseSnapshotImportPayload({ _kind: evalInApp('SNAPSHOT_EXPORT_KIND'),
    _snapshotFormat: 2, snapshots: [mkSnapRec({ id: 'gut1' }), mkSnapRec({ id: 'gut2' })] });
  assert.equal(good.ok, true, good.errors.join(' | '));
  assert.equal(good.snapshots.length, 2);
});

test('R46 (Befund 3) DPS-Wachstum wird ueber die tatsaechlich vergangenen Jahre annualisiert', () => {
  const D = (f) => S._deriveDdmGrowthInputs(f, {}, { base: {} });
  const CAGR6 = (Math.pow(1.12 / 1.00, 1 / 6) - 1) * 100;   // 1,906762…%
  const CAGR5 = (Math.pow(1.12 / 1.00, 1 / 5) - 1) * 100;   // 2,292455…%

  // ── Pflichtfall 1: Luecke in der Wertereihe ueber sechs Jahresintervalle ─
  {
    const o = D({ dps: [1.12, 1.10, null, 1.06, 1.04, 1.02, 1.00] });
    assert.ok(Math.abs(o.g1DpsCagr - CAGR6) < 1e-9, 'erhalten ' + o.g1DpsCagr);
    assert.ok(Math.abs(o.g1DpsCagr - CAGR5) > 0.3, 'Ausgangsstand lieferte ' + CAGR5.toFixed(4) + '%');
    assert.equal(o.g1DpsGrowthYears, 6, 'Zeitspanne muss die tatsaechliche sein');
    assert.equal(o.g1Source, 'dps_cagr_6y', 'die Beschriftung muss dazu passen');
    assert.ok((o.g1DpsNotes || []).some(n => /tatsaechlich 6 Jahre/.test(n)), JSON.stringify(o.g1DpsNotes));
    // Die Kappung greift erst NACH der Annualisierung und verdeckt sie nicht.
    assert.ok(Math.abs(o.g1 - CAGR6) < 1e-9, 'g1 ' + o.g1);
  }

  // ── Pflichtfall 2: vollstaendige Reihe bleibt unveraendert ───────────
  {
    const o = D({ dps: [1.12, 1.10, 1.08, 1.06, 1.04, 1.00] });
    assert.ok(Math.abs(o.g1DpsCagr - CAGR5) < 1e-9, 'erhalten ' + o.g1DpsCagr);
    assert.equal(o.g1DpsGrowthYears, 5);
    assert.equal(o.g1Source, 'dps_cagr_5y');
    assert.equal((o.g1DpsNotes || []).length, 0, 'kein Sonderfall zu melden');
  }

  // ── Pflichtfall 3: fehlendes Jahr in den PERIODENLABELS selbst ───────
  // Die Werte sind lueckenlos, aber 2024 fehlt — der Platzabstand allein
  // wuerde hier 5 Jahre nennen.
  {
    const o = D({ dps: [1.12, 1.10, 1.06, 1.04, 1.02, 1.00],
      _v4_meta: { dps: { periods: ['2026-12-31', '2025-12-31', '2023-12-31',
                                   '2022-12-31', '2021-12-31', '2020-12-31'] } } });
    assert.equal(o.g1DpsGrowthYears, 6, 'Periodenabstand entscheidet');
    assert.ok(Math.abs(o.g1DpsCagr - CAGR6) < 1e-9, 'erhalten ' + o.g1DpsCagr);
    assert.equal(o.g1Source, 'dps_cagr_6y');
  }

  // ── Pflichtfall 4: Perioden vorhanden, aber nicht lesbar ─────────────
  // Kein erfundener Zeitabstand; der Grund bleibt sichtbar.
  {
    const o = D({ dps: [1.12, 1.10, 1.08, 1.06, 1.04, 1.00],
      _v4_meta: { dps: { periods: ['n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a'] } } });
    assert.equal(o.g1DpsCagr, null, 'CAGR darf nicht geraten werden');
    assert.notEqual(o.g1Source, 'dps_cagr_5y');
    assert.ok((o.g1DpsNotes || []).some(n => /nicht lesbar/.test(n)), JSON.stringify(o.g1DpsNotes));
  }
  // Gar keine Periodenangaben: dokumentierte Altdatenregel, unveraendert.
  {
    const o = D({ dps: [1.12, 1.10, 1.08, 1.06, 1.04, 1.00] });
    assert.equal(o.g1Source, 'dps_cagr_5y');
    assert.ok(Math.abs(o.g1DpsCagr - CAGR5) < 1e-9);
  }

  // ── Pflichtfall 5: gemeldete Null innerhalb der Historie ─────────────
  // Eine Null ist eine wirtschaftliche Angabe (Dividende ausgesetzt), kein
  // fehlender Wert — ein durchgehender CAGR beschreibt das nicht.
  {
    const o = D({ dps: [1.12, 1.10, 0, 1.06, 1.04, 1.02, 1.00] });
    assert.equal(o.g1DpsCagr, null, 'CAGR ueber eine Null hinweg');
    assert.equal(o.g1Source, 'dps_median_yoy', 'transparenter Ersatzweg');
    assert.ok((o.g1DpsNotes || []).some(n => /gemeldete Dividende 0/.test(n)), JSON.stringify(o.g1DpsNotes));
    assert.ok(o.g1 != null, 'das Modell bleibt rechenbar');
  }
  // Eine Null AUSSERHALB der verwendeten Spanne aendert nichts.
  {
    const o = D({ dps: [1.12, 1.10, 1.08, 1.06, 1.00, 0, 0] });
    assert.equal(o.g1Source, 'dps_cagr_3y');
    assert.equal(o.g1DpsGrowthYears, 3);
  }

  // ── Pflichtfall 6: echter DDM-Engine-Pfad, Fehler nicht durch die
  //    Kappung verdeckt (1,91 % liegt unter der 5-%-Grenze) ─────────────
  {
    const mkMj = (dps) => ({
      meta: { ticker: 'DIVX', sub_classification: 'dividend_aristocrat' },
      fundamentals: {
        revenue: [1000, 1000, 1000, 1000, 1000, 1000, 1000],
        ebit: [200, 200, 200, 200, 200, 200, 200],
        ebitda: [250, 250, 250, 250, 250, 250, 250],
        capex: [50, 50, 50, 50, 50, 50, 50],
        fcf: [150, 150, 150, 150, 150, 150, 150],
        eps_diluted: [2, 2, 2, 2, 2, 2, 2],
        book_value: [1000, 1000, 1000, 1000, 1000, 1000, 1000],
        net_debt: [0], dps,
        shares_diluted: [100, 100, 100, 100, 100, 100, 100]
      },
      valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false }, wacc_derived: 10,
        cost_of_equity_derived: 10, growth_terminal: 2, growth_stage1: 5 },
      market: { price: 20 }
    });
    const vGap = S.runValuationEngine(mkMj([1.12, 1.10, null, 1.06, 1.04, 1.02, 1.00]));
    const dGap = vGap.modelResults.ddm;
    assert.equal(dGap.applicable, true);
    assert.equal(dGap._debug_dpsGrowthYears, 6);
    assert.ok(Math.abs(dGap._debug_g1DpsCagr - CAGR6) < 1e-9);
    // Gemessen am Ausgangsstand 7b1fd10: 14.457970968495326
    assert.ok(Math.abs(dGap.base - 14.223656551734546) < 1e-9, 'erhalten ' + dGap.base);
    assert.ok(Math.abs(dGap.base - 14.457970968495326) > 0.2, 'Ausgangswert unveraendert');
    assert.ok(dGap.base < 5 * 100, 'keine Kappung im Spiel');

    // Vollstaendige Reihe: bit-genau wie am Ausgangsstand.
    const vFull = S.runValuationEngine(mkMj([1.12, 1.10, 1.08, 1.06, 1.04, 1.02, 1.00]));
    assert.ok(Math.abs(vFull.modelResults.ddm.base - 14.212416883291723) < 1e-12,
      'erhalten ' + vFull.modelResults.ddm.base);
  }

  // ── Bestehende Kappungen bleiben erhalten ───────────────────────────
  {
    const o = D({ dps: [3.00, 2.00, 1.50, 1.20, 1.10, 1.00] });   // weit ueber 5 %
    assert.equal(o.g1, 5, 'Kappung auf 5 % unveraendert');
    assert.ok(/clamped to 5.00%/.test(o.g1Note || ''), o.g1Note);
  }
});
