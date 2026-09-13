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
import { app, refMj, scOf, refValuePerShare } from './audit-chat12.mjs';

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

test('B1 BEFUND: Monte Carlo rechnet im Mid-Cycle-Pfad mit der Ist-Marge statt der Mid-Cycle-Marge', () => {
  // Befund A-2: runMonteCarloDcf() ruft buildCoreValuationContext(mj, {}) ohne
  // opMarginOverridePct. Der Haupt-DCF (modelDcfMidcycle) normalisiert dagegen
  // auf den Median. Nach der Korrektur muss der MC-Median in der Naehe des
  // DCF-Base liegen; dieser Test ist dann umzukehren.
  const mj = midCycleMj();
  const sc = S.buildScenarios(mj);
  const dcf = S.modelDcfMidcycle(mj, sc);
  assert.equal(dcf._midCycleOpMarginPct, 15);
  assert.equal(sc.base.op_margin_pct, 30, 'Szenario traegt weiterhin die Ist-Marge');

  const v = { scenarios: sc, router: { activeModels: ['dcf_midcycle'], subClassification: 'cyclical' }, error: null };
  const mc = S.runMonteCarloDcf(mj, v, { seed: 4242, runs: 2000 });
  assert.ok(!mc._blocked, 'MC laeuft');
  // Gemessene Abweichung: MC-Median liegt um mehr als das Doppelte ueber dem
  // ausgewiesenen Fair Value — beide Zahlen stehen in derselben Ansicht.
  assert.ok(mc.median > 2 * dcf.base,
    'BEFUND A-2: MC-Median ' + mc.median.toFixed(2) + ' vs. DCF ' + dcf.base.toFixed(2));
  // Die Sensitivitaetsmatrix ist dagegen konsistent (Gegenprobe).
  const m = S.computeSensitivityMatrix(mj, v);
  assert.ok(Math.abs(m.baseValue - dcf.base) < 1e-12, 'Matrix bleibt konsistent');
});

test('B2 BEFUND: Snapshot-Prognoseziele verwenden die Ist-Marge, nicht die bewertete Mid-Cycle-Marge', () => {
  // Befund A-2 (zweiter Weg): buildSnapshotForecastTargets() liest
  // scenarios.base.op_margin_pct. Der spaetere Soll-Ist-Vergleich misst damit
  // gegen einen Pfad, der nie bewertet wurde.
  const mj = midCycleMj();
  const sc = S.buildScenarios(mj);
  const v = { scenarios: sc, router: { activeModels: ['dcf_midcycle'], subClassification: 'cyclical' }, error: null };
  const snap = S.buildSnapshotForecastTargets(mj, v);
  assert.equal(snap.available, true);
  assert.equal(snap.scenario.op_margin_pct_used, 30, 'BEFUND A-2: Snapshot rechnet mit 30 %');
  // Von Hand: Umsatz J1 = 1.050; FCFF bei 30 % Marge
  //   = 1.050·(0,30·0,75 + 0,05 − 0,05) = 236,25M
  // Bei der bewerteten Mid-Cycle-Marge 15 % waeren es 118,125M.
  assert.ok(Math.abs(snap.years[0].fcff - 236.25) < 1e-9, 'erhalten ' + snap.years[0].fcff);
  const fi = S.buildForecastInputs(mj);
  const rMid = S.forecastDcfCore(fi, 5, 2, 10, { enabled: false }, 15);
  assert.ok(Math.abs(rMid._fcfPerYearAbs[1] - 118.125) < 1e-9);
});

test('B3 BEFUND: Reverse-DCF-Karte der Bewertungsansicht rechnet auf f.fcf und setzt Nettoschulden still auf 0', () => {
  // Befund A-1: buildReverseDcfDiagnosticBlock() ruft calculateImpliedGrowth()
  // mit fcf0M = f.fcf[0] (CFO − CapEx) und netDebtM ?? 0 — obwohl
  // _resolveNetDebtForDcfBridge() aus total_debt − cash 2.000M ableitet.
  // Die Uebersichtskarte zeigt daneben den Kernwert.
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
  const bridge = S._resolveNetDebtForDcfBridge(mj.fundamentals);
  assert.equal(bridge.available, true);
  assert.equal(bridge.netDebtM, 2000);

  const core = S.solveReverseDcfGrowth(mj);
  assert.equal(core.status, 'ok');
  assert.equal(core.netDebtPerShare, 20);

  const html = S.buildReverseDcfDiagnosticBlock(mj, { scenarios: {}, router: { activeModels: ['dcf'] } }, []);
  const shown = Number((html.match(/rdcf-g"[^>]*>\+?(-?[\d.]+)%/) || [])[1]);
  assert.ok(Number.isFinite(shown), 'Karte zeigt eine Zahl');
  assert.ok(/0 \(angenommen\)/.test(html), 'BEFUND A-1: Karte setzt Nettoschulden auf 0');
  assert.ok(Math.abs(shown - core.impliedGrowthPct) > 10,
    'BEFUND A-1: Karte ' + shown + ' % vs. Kern ' + core.impliedGrowthPct.toFixed(2) + ' %');
});

test('B4 BEFUND: Reverse-DCF-Uebersichtskarte sperrt auf f.fcf, obwohl der Kern rechnen kann', () => {
  // Befund A-3: computeReverseDcfFull() bricht bei fehlendem/negativem
  // f.fcf[0] ab, BEVOR coreReverseDcf berechnet wird. Die Uebersichtskarte
  // zeigt danach "nicht berechenbar", obwohl solveReverseDcfGrowth() ein
  // eindeutiges Ergebnis liefert und der Haupt-DCF anwendbar ist.
  const mj = refMj({ net_debt: [500] },
    { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      wacc_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    { price: 18.728383767294428 });
  assert.ok(mj.fundamentals.fcf === undefined, 'f.fcf ist nicht besetzt');

  const core = S.solveReverseDcfGrowth(mj);
  assert.equal(core.status, 'ok');
  assert.ok(Math.abs(core.impliedGrowthPct - 5) < 1e-2);
  assert.equal(S.modelDcf(mj, scOf(5, 2, 10, 20)).applicable, true, 'Haupt-DCF ist anwendbar');

  const full = S.computeReverseDcfFull(mj);
  assert.equal(full.applicable, false);
  assert.equal(full.coreReverseDcf, undefined, 'BEFUND A-3: Kernergebnis wird gar nicht erst gebildet');
  const card = S.buildReverseDcfOverviewCard(mj);
  assert.ok(/ov-rdcf-na/.test(card) && /FCF₀ fehlt/.test(card),
    'BEFUND A-3: Karte meldet "nicht berechenbar"');
});

test('B5 BEFUND: kurzfristige Finanzschulden nur als Restgroesse — total_debt = long_term_debt kippt Working Capital und Wert', () => {
  // Befund A-4: _computeOwcHistory() bildet die kurzfristigen Finanzschulden
  // ausschliesslich als total_debt − long_term_debt und ignoriert das
  // separat extrahierte Feld debt_short_term. Faellt die Tag-Kette fuer
  // total_debt auf LongTermDebt (Kettenplatz 2, identisch mit long_term_debt),
  // gilt 0 als GEMESSEN — ohne Warnung.
  const base = {
    revenue: [1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200],
    ebitda: [250, 250, 250, 250], capex: [50, 50, 50, 50],
    shares_diluted: [100, 100, 100, 100],
    current_assets: [400, 400, 400, 400],
    current_liabilities: [500, 500, 500, 500],   // enthaelt 300 kurzfristige Finanzschulden
    cash_and_equivalents: [100, 100, 100, 100],
    long_term_debt: [700, 700, 700, 700],
    debt_short_term: [300, 300, 300, 300]        // extrahiert, aber ungenutzt
  };
  const mk = (td) => ({
    meta: { sub_classification: 'standard_nonfin' },
    fundamentals: Object.assign({}, base, { total_debt: td }),
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 wacc_derived: 10, growth_terminal: 2, growth_stage1: 8 },
    market: { price: 20 }
  });

  const mjLt = mk([700, 700, 700, 700]);    // total_debt aus LongTermDebt
  const mjOk = mk([1000, 1000, 1000, 1000]); // total_debt vollstaendig

  const hLt = S._computeOwcHistory(mjLt.fundamentals);
  const hOk = S._computeOwcHistory(mjOk.fundamentals);
  assert.equal(hLt.years[0].shortTermDebt, 0, 'BEFUND A-4: 0 gilt als gemessen');
  assert.equal(hOk.years[0].shortTermDebt, 300);
  // Von Hand: OWC = (400 − 100) − (500 − STD)
  assert.equal(hLt.years[0].owc, -200);   // Quote −20 %
  assert.equal(hOk.years[0].owc, 100);    // Quote +10 %

  const rLt = S.modelDcf(mjLt, scOf(8, 2, 10, 20));
  const rOk = S.modelDcf(mjOk, scOf(8, 2, 10, 20));
  assert.equal(rLt._netDebtM, 600);
  assert.equal(rOk._netDebtM, 900);
  // Gemessene Wirkung: derselbe Abschluss, +28,7 % Fair Value.
  assert.ok(rLt.base / rOk.base > 1.28,
    'BEFUND A-4: ' + rLt.base.toFixed(2) + ' vs. ' + rOk.base.toFixed(2));
  // Die Restgroesse 0 wird als gemessene kurzfristige Finanzschuld gefuehrt,
  // obwohl debt_short_term[0] = 300 im selben Datensatz steht. Keine Warnung
  // nennt diesen Widerspruch.
  assert.equal(hLt.years[0].shortTermDebtSource, 'total_debt \u2212 long_term_debt');
  assert.equal(mjLt.fundamentals.debt_short_term[0], 300);
  assert.ok(!(rLt.warnings || []).some(w => /debt_short_term/.test(w)),
    'BEFUND A-4: kein Hinweis auf den Widerspruch zu debt_short_term');
  assert.ok((rLt.warnings || []).some(w => /Working Capital/.test(w) && /gemessen aus Bilanzdaten/.test(w)),
    'BEFUND A-4: die gekippte Quote wird als \u201egemessen\u201c ausgewiesen');
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
