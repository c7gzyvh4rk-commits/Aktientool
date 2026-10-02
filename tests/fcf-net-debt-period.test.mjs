// ─────────────────────────────────────────────────────────────────────────────
// V1.0.80 · Nettoschulden-Stichtag ↔ FCF-Zeitraum in der Reported-/Owner-FCF-
// Diagnostik (computeReverseDcfFull → reverseDcfReported/reverseDcfOwner/
// scenarioResults, _computeOwnerFcfDcf → reportedFcfFV/ownerFcfFV, Growth-Verdict).
//
// Bis V1.0.79 prueften beide Pfade die Nettoschulden wie die DCF-Bruecke
// (_resolveNetDebtForDcfBridge: Umfang, Herkunft, Verknuepfung von Schulden und
// Liquiditaet), aber NICHT gegen den Zeitraum des FCF, mit dem sie verrechnet
// werden. Gemessen auf b523867: FCF FY2025 mit Nettoschulden zum 2024-12-31
// ⇒ Reported 15.46 %, Owner 17.02 %, FV 37.26/28.68 USD, GROWTH_WATCH.
//
// Regel (AUDIT §13.17): Stichtag am Ende des FCF-Zeitraums (FY: Geschaeftsjahres-
// ende; TTM: Ende des TTM-Fensters; FY-Rueckfall: FY-Regel), Abstand ≤ 45 Tage
// (MULTIPLES_PERIOD_TOLERANCE_DAYS). Eine Seite mit Periodenangaben muss einen
// gueltigen Stichtag fuer den verwendeten Betrag belegen; gemischte Angaben
// sperren; nur vollstaendig periodenfreie Daten laufen als ausgewiesene Annahme.
//
// Sollwerte unabhaengig hergeleitet (zehn Jahre FCF_t = FCF0·(1+g)^t,
// Gordon-Terminalwert, diskontiert mit dem WACC):
//   · Reverse DCF: EV(g*) = Kurs · Aktien + Nettoschulden
//   · Owner-/Reported-FV je Aktie = (EV(g1) − Nettoschulden) / Aktien
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, importSecFacts, secFactsWithDebt, fullyDocumented, secInst, allYears } from './audit-chat12.mjs';

const S = app();
const PRICE = 40, SHARES = 100, WACC = 9, TG = 3, G1 = 15, FCF = 180, SBC = 20;
const YE = Array.from({ length: 6 }, (_, i) => `${2025 - i}-12-31`);

function evAt(fcf0, gPct, wacc = WACC, tgPct = TG) {
  const w = wacc / 100, tg = tgPct / 100, g = gPct / 100;
  let pv = 0, cf = fcf0;
  for (let t = 1; t <= 10; t++) { cf *= (1 + g); pv += cf / Math.pow(1 + w, t); }
  return pv + (cf * (1 + tg)) / (w - tg) / Math.pow(1 + w, 10);
}
const fvPerShare = (fcf0, nd) => (evAt(fcf0, G1) - nd) / SHARES;

// Datierter FY-Datensatz; `bridge` setzt Schulden-/Liquiditaets-/net_debt-Angaben.
function mj({ bridge = {}, fcfPeriods = YE, cfPeriods = YE, dated = true, extraFund = {} } = {}) {
  const f = Object.assign({
    revenue: [1000, 800, 640, 512, 410, 328], ebit: [200, 150, 110, 80, 60, 45], ebitda: [240, 185, 140, 105, 80, 62],
    cfo: [230, 170, 125, 90, 70, 52], capex: [50, 40, 32, 26, 20, 16], fcf: [FCF, 130, 93, 64, 50, 36],
    net_income: [150, 110, 80, 58, 43, 32], eps_diluted: [1.5, 1.1, 0.8, 0.58, 0.43, 0.32],
    book_value: [2000, 1850, 1740, 1660, 1600, 1560], shares_diluted: Array(6).fill(SHARES), sbc: Array(6).fill(SBC),
    da: [40, 35, 30, 25, 20, 17]
  }, extraFund);
  const meta = {};
  if (dated) {
    Object.assign(meta, { revenue: { periods: YE }, ebitda: { periods: YE } });
    if (fcfPeriods) meta.fcf = { periods: fcfPeriods };
    if (cfPeriods) { meta.cfo = { periods: cfPeriods }; meta.capex = { periods: cfPeriods }; }
  }
  for (const [k, v] of Object.entries(bridge)) {
    f[k] = v.values;
    if (v.periods !== undefined) meta[k] = Object.assign({ periods: v.periods }, v.meta || {});
  }
  f._v4_meta = meta;
  return { meta: { ticker: 'FNP', sub_classification: 'standard_nonfin' }, fundamentals: f, market: { price: PRICE },
    valuation: { wacc_derived: WACC, growth_terminal: TG, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 10, growth_stage1: G1 } };
}
const debtCash = (td, cash, pTd, pCash = pTd) => ({
  total_debt: { values: [td], periods: [pTd] }, cash_and_equivalents: { values: [cash], periods: [pCash] } });

function assertComputesWith(m, nd, check) {
  const r = S.computeReverseDcfFull(m);
  assert.equal(r.applicable, true, r.reason);
  assert.equal(r.inputs.netDebtM, nd);
  assert.equal(r.netDebtPeriodCheck, check);
  for (const [g, fcf0] of [[r.reverseDcfReported, FCF], [r.reverseDcfOwner, FCF - SBC]]) {
    assert.ok(g != null);
    const target = PRICE * SHARES + nd;
    assert.ok(Math.abs(evAt(fcf0, g) - target) / target < 1e-4, `EV(${g}) = ${evAt(fcf0, g)} ≠ ${target}`);
  }
  const od = S._computeOwnerFcfDcf(m);
  assert.equal(od.netDebtM, nd);
  assert.equal(od.netDebtUnavailable, null);
  assert.equal(od.netDebtPeriodCheck, check);
  assert.ok(Math.abs(od.reportedFcfFV - fvPerShare(FCF, nd)) < 1e-9, `${od.reportedFcfFV} vs ${fvPerShare(FCF, nd)}`);
  assert.ok(Math.abs(od.ownerFcfFV - fvPerShare(FCF - SBC, nd)) < 1e-9);
  return { r, od };
}

function assertBlocked(m, reasonRe) {
  const r = S.computeReverseDcfFull(m);
  assert.equal(r.applicable, false);
  assert.equal(r.reverseDcfReported, null, 'kein Reported-Wachstum');
  assert.equal(r.reverseDcfOwner, null, 'kein Owner-Wachstum');
  assert.equal(r.impliedGrowthPct, null);
  assert.ok(r.scenarioResults.every(sc => sc.impliedGrowthPct == null), 'keine Kursszenarien');
  assert.equal(r.inputs.netDebtM, null);
  assert.equal(r.reverseDcfReportedClassification, null);
  assert.equal(r.netDebtPeriodBlocked, true);
  assert.match(r.reason, /Nettoschulden nicht dem FCF-Zeitraum zuordenbar/);
  assert.match(r.reason, reasonRe);
  assert.equal(r.reportedFcfGateReason, r.reason);
  // Unabhaengig berechenbar und erhalten: SBC-Diagnose, Umsatz-Benchmark, Kernstatus.
  assert.equal(r.sbcAdjustedFcm, FCF - SBC);
  assert.equal(r.sbc0, SBC);
  assert.ok(r.historicalBenchmark && r.historicalBenchmark.cagr3y != null);
  const core = S.solveReverseDcfGrowth(m);
  assert.equal(r.coreStatus, core.status);
  assert.equal(r.coreAvailable, core.ok === true);
  assert.equal(r.coreImpliedGrowthPct, core.ok ? core.impliedGrowthPct : null);

  const od = S._computeOwnerFcfDcf(m);
  assert.equal(od.status, 'ok', 'SBC-Diagnose bleibt');
  assert.equal(od.reportedFcfFV, null);
  assert.equal(od.ownerFcfFV, null);
  assert.equal(od.netDebtM, null);
  assert.equal(od.netDebtPeriodBlocked, true);
  assert.match(od.netDebtUnavailable, /nicht dem FCF-Zeitraum zuordenbar/);
  assert.match(od.netDebtUnavailable, reasonRe);
  assert.equal(od.sbcAdjustedFcf, FCF - SBC);
  return { r, od };
}

// ── Gueltige Faelle ──────────────────────────────────────────────────────────
test('FY gueltig: Stichtag = Geschaeftsjahresende des FCF ⇒ geprueft, Kontrollrechnung', () => {
  const { r, od } = assertComputesWith(mj({ bridge: debtCash(4500, 500, YE[0]) }), 4000, 'period_checked');
  assert.equal(r.netDebtPeriod, '2025-12-31');
  assert.equal(r.fcfPeriod, '2025-12-31');
  assert.match(r.netDebtPeriodNote, /2025-12-31.*geprueft/);
  assert.equal(r.netDebtAssumption, null);
  assert.equal(od.netDebtAssumption, null);
});

test('FY gueltig: 52/53-Wochen-Jahr (FCF bis 2025-12-28, Bilanz 2025-12-31) und Toleranzgrenze 45 Tage', () => {
  const p = ['2025-12-28', ...YE.slice(1)];
  assertComputesWith(mj({ fcfPeriods: p, cfPeriods: p, bridge: debtCash(4500, 500, '2025-12-31') }), 4000, 'period_checked');
  // 45 Tage zulaessig, 46 nicht (2025-11-16 / 2025-11-15 bis 2025-12-31).
  assertComputesWith(mj({ bridge: debtCash(4500, 500, '2025-11-16') }), 4000, 'period_checked');
  assertBlocked(mj({ bridge: debtCash(4500, 500, '2025-11-15') }), /46 Tage Abstand/);
});

test('belegte Nettoschulden 0 und Nettoliquiditaet −500 bleiben gueltig (datiert)', () => {
  assertComputesWith(mj({ bridge: debtCash(500, 500, YE[0]) }), 0, 'period_checked');
  assertComputesWith(mj({ bridge: debtCash(100, 600, YE[0]) }), -500, 'period_checked');
  // net_debt[0] mit eigenem passendem Stichtag
  assertComputesWith(mj({ bridge: { net_debt: { values: [-500], periods: [YE[0]] } } }), -500, 'period_checked');
});

// Produktiver Importweg (SEC Company Facts) — FY und FY-Rueckfall.
test('FY ueber den produktiven Import und FY-Rueckfall bei angefordertem TTM', () => {
  const facts = secFactsWithDebt(fullyDocumented({
    LongTermDebtNoncurrent: secInst(allYears(500)), LongTermDebtCurrent: secInst(allYears(0)) }));
  const m = importSecFacts(facts, { ticker: 'FYI', price: 20 });
  m.valuation.wacc_derived = WACC; m.valuation.growth_terminal = TG;
  for (const basis of ['fy', 'ttm']) {
    m.valuation.data_basis = basis;
    const vw = S.resolveValuationView(m, null);
    assert.equal(vw.basis, 'fy', basis + ': keine Quartalsdaten ⇒ FY');
    const r = S.computeReverseDcfFull(vw.mj);
    // Kontrollrechnung: FCF FY2025 = 200 − 50 = 150; ND = 500 − 100 = 400 (beide zum 2025-12-31).
    assert.equal(r.inputs.fcf0M, 150);
    assert.equal(r.inputs.netDebtM, 400);
    assert.equal(r.netDebtPeriodCheck, 'period_checked');
    assert.equal(r.fcfPeriod, '2025-12-31');
    assert.equal(r.netDebtPeriod, '2025-12-31');
    const target = 20 * 100 + 400;
    assert.ok(Math.abs(evAt(150, r.reverseDcfReported) - target) / target < 1e-4);
  }
});

// Quartalsfacts: FY2024 vollstaendig, 2025 Q1–Q3 ⇒ TTM-Fenster bis 2025-09-30.
const _M6 = 1e6;
const _QEnd = { 1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31' };
const _qF = (n) => (n === 4 ? '10-K' : '10-Q');
const _qD = (y, n) => (n === 4 ? (y + 1) + '-02-15' : y + '-' + String(n * 3 + 2).padStart(2, '0') + '-01');
const _cum4 = (q) => [q, 2 * q, 3 * q, 4 * q];
const _cum3 = (q) => [q, 2 * q, 3 * q];
const _qFlow = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-01-01', end: y + _QEnd[i + 1], val: v * _M6, form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 'f' + y + i }))) } });
const _qInst = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  end: y + _QEnd[i + 1], val: v * _M6, form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 'i' + y + i }))) } });
const _qShr = (spec) => ({ units: { shares: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-' + String(i * 3 + 1).padStart(2, '0') + '-01', end: y + _QEnd[i + 1], val: v * _M6,
  form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 's' + y + i }))) } });
const _flat = (v4, v3) => ({ 2022: [v4, v4, v4, v4], 2023: [v4, v4, v4, v4], 2024: [v4, v4, v4, v4], 2025: [v3, v3, v3] });
function ttmFacts() {
  return { 'us-gaap': {
    Revenues:            _qFlow({ 2022: _cum4(250), 2023: _cum4(250), 2024: _cum4(250), 2025: _cum3(375) }),
    OperatingIncomeLoss: _qFlow({ 2022: _cum4(50),  2023: _cum4(50),  2024: _cum4(50),  2025: _cum3(75) }),
    NetIncomeLoss:       _qFlow({ 2022: _cum4(37.5), 2023: _cum4(37.5), 2024: _cum4(37.5), 2025: _cum3(56.25) }),
    NetCashProvidedByUsedInOperatingActivities: _qFlow({ 2022: _cum4(50), 2023: _cum4(50), 2024: _cum4(50), 2025: _cum3(75) }),
    PaymentsToAcquirePropertyPlantAndEquipment: _qFlow({ 2022: _cum4(12.5), 2023: _cum4(12.5), 2024: _cum4(12.5), 2025: _cum3(18.75) }),
    DepreciationDepletionAndAmortization:       _qFlow({ 2022: _cum4(12.5), 2023: _cum4(12.5), 2024: _cum4(12.5), 2025: _cum3(18.75) }),
    CashAndCashEquivalentsAtCarryingValue: _qInst(_flat(100, 100)),
    DebtAndCapitalLeaseObligations:        _qInst(_flat(500, 500)),
    LongTermDebtNoncurrent:                _qInst(_flat(500, 500)),
    LongTermDebtCurrent:                   _qInst(_flat(0, 0)),
    ShortTermBorrowings:                   _qInst(_flat(0, 0)),
    FinanceLeaseLiabilityCurrent:          _qInst(_flat(0, 0)),
    FinanceLeaseLiabilityNoncurrent:       _qInst(_flat(0, 0)),
    AssetsCurrent:       _qInst(_flat(400, 400)),
    LiabilitiesCurrent:  _qInst(_flat(500, 500)),
    StockholdersEquity:  _qInst(_flat(3000, 3000)),
    Assets:              _qInst(_flat(7000, 7000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: _qShr(_flat(100, 100))
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2025-09-30', val: 100 * _M6, form: '10-Q', filed: '2025-11-01' } ] } } } };
}
function ttmView() {
  const m = importSecFacts(ttmFacts(), { ticker: 'TTMF', price: 30 });
  m.valuation.data_basis = 'ttm'; m.valuation.wacc_derived = WACC; m.valuation.growth_terminal = TG;
  const vw = S.resolveValuationView(m, null);
  assert.equal(vw.basis, 'ttm', 'TTM muss tatsaechlich gewaehlt sein: ' + (vw.resolved.reasons || []).join(' '));
  return { m, view: vw.mj };
}

test('TTM gueltig (produktiver Weg): FCF der vier Quartale bis 2025-09-30 mit Bilanz zum 2025-09-30', () => {
  const { m, view } = ttmView();
  const r = S.computeReverseDcfFull(view);
  // Kontrollrechnung: CFO 50 + 3·75 = 275, CapEx 12.5 + 3·18.75 = 68.75 ⇒ FCF 206.25; ND 500 − 100 = 400.
  assert.equal(r.inputs.fcf0M, 206.25);
  assert.equal(r.inputs.netDebtM, 400);
  assert.equal(r.fcfPeriod, '2025-09-30');
  assert.equal(r.netDebtPeriod, '2025-09-30');
  assert.equal(r.netDebtPeriodCheck, 'period_checked');
  const target = 30 * 100 + 400;
  assert.ok(Math.abs(evAt(206.25, r.reverseDcfReported) - target) / target < 1e-4);
  // Gegenprobe FY desselben Imports: FCF 2024 = 150 zum 2024-12-31 mit Bilanz zum 2024-12-31.
  const rf = S.computeReverseDcfFull(m);
  assert.equal(rf.inputs.fcf0M, 150);
  assert.equal(rf.fcfPeriod, '2024-12-31');
  assert.equal(rf.netDebtPeriod, '2024-12-31');
  assert.equal(rf.netDebtPeriodCheck, 'period_checked');
});

test('TTM-FCF mit eingemischter FY-Bruecke (2024-12-31) ⇒ gesperrt, 273 Tage', () => {
  const { view } = ttmView();
  const f = Object.assign({}, view.fundamentals, { net_debt: [400] });
  f._v4_meta = Object.assign({}, f._v4_meta, { net_debt: { periods: ['2024-12-31'] } });
  const r = S.computeReverseDcfFull(Object.assign({}, view, { fundamentals: f }));
  assert.equal(r.reverseDcfReported, null);
  assert.equal(r.netDebtPeriodBlocked, true);
  assert.match(r.reason, /FCF-Zeitraum endet 2025-09-30.*2024-12-31 — 273 Tage/);
});

// ── Unzulaessige oder unbelegte Zuordnung ───────────────────────────────────
test('Fehlerfall: Bruecke ein Jahr aelter als der FCF (2024-12-31 zu FY2025) ⇒ gesperrt, Folgepfade', () => {
  const m = mj({ bridge: debtCash(4500, 500, '2024-12-31') });
  assert.equal(S._resolveNetDebtForDcfBridge(m.fundamentals).available, true, 'Vorbedingung: Bruecke fuer sich belegt');
  assertBlocked(m, /FCF-Zeitraum endet 2025-12-31.*2024-12-31 — 365 Tage Abstand, zulaessig sind 45/);
  // Growth-Verdict: kein Verdict aus einem so bestimmten Wachstum.
  const mg = mj({ bridge: debtCash(4500, 500, '2024-12-31') }); mg.meta.sub_classification = 'high_growth';
  S._ensureGrowthAssumptionsBlock(mg);
  const gr = S.runGrowthCaseEngine(mg);
  assert.equal(gr.verdict, 'MODEL_UNSUITABLE');
  assert.match(gr.verdictReason, /nicht dem FCF-Zeitraum zuordenbar/);
  // Einzige Kopplung an die Synthese (growthModuleFairValueActive) unveraendert gegenueber dem gueltigen Fall.
  const mv = mj({ bridge: debtCash(4500, 500, YE[0]) }); mv.meta.sub_classification = 'high_growth';
  S._ensureGrowthAssumptionsBlock(mv);
  const gv = S.runGrowthCaseEngine(mv);
  assert.notEqual(gv.verdict, 'MODEL_UNSUITABLE');
  assert.equal(gr.growthModuleFairValueActive, gv.growthModuleFairValueActive);
});

test('Fehlerfall: juengere Bilanz (Quartal nach dem Geschaeftsjahr) ist ebenfalls unzulaessig', () => {
  assertBlocked(mj({ bridge: debtCash(4500, 500, '2026-03-31') }), /2026-03-31 — 90 Tage/);
});

test('vorhandenes net_debt[0] umgeht die Pruefung nicht (eigener aelterer Stichtag, kein fremdes Datum)', () => {
  // net_debt[0] mit Stichtag 2024 hat Vorrang; total_debt/cash zum 2025-12-31 leihen ihm kein Datum.
  const m = mj({ bridge: Object.assign(debtCash(4500, 500, YE[0]),
    { net_debt: { values: [4000], periods: ['2024-12-31'] } }) });
  assertBlocked(m, /\(net_debt\[0\]\) ist 2024-12-31/);
  // net_debt[0] ohne lesbaren Stichtag trotz Periodenangaben
  for (const p of [null, 'n/a', '2025-02-30']) {
    assertBlocked(mj({ bridge: Object.assign(debtCash(4500, 500, YE[0]), { net_debt: { values: [4000], periods: [p] } }) }),
      /fuehren Periodenangaben, belegen fuer den verwendeten Betrag aber keinen gueltigen Stichtag/);
  }
  // net_debt[0] ganz ohne Metadaten neben datiertem FCF: gemischt
  assertBlocked(mj({ bridge: { net_debt: { values: [4000] } } }),
    /FCF-Zeitraum endet 2025-12-31, der Stichtag der Nettoschulden \(net_debt\[0\]\) ist nicht belegt/);
});

test('gemischte bzw. fehlende Periodenangaben der FCF-Seite sperren', () => {
  // FCF ohne Periodenangabe neben datierter Bruecke
  assertBlocked(mj({ fcfPeriods: null, bridge: debtCash(4500, 500, YE[0]) }),
    /Stichtag der Nettoschulden ist 2025-12-31, der Zeitraum des FCF \(fcf\[0\]\) ist nicht belegt/);
  // FCF mit unbrauchbarer Periodenangabe
  for (const p of [null, 'n/a', '2025-02-30', '2025/12/31']) {
    assertBlocked(mj({ fcfPeriods: [p, ...YE.slice(1)], bridge: debtCash(4500, 500, YE[0]) }),
      /Der FCF \(fcf\[0\]\) fuehrt Periodenangaben, belegt aber kein gueltiges Periodenende/);
  }
});

test('ausdruecklich gesetzte Ersatzreihen tragen keinen Stichtag; die Periode der ersetzten Reihe wird nicht uebernommen', () => {
  // net_debt-Override mit der (veralteten) Periodenangabe der SEC-Reihe 2025 — der Override selbst ist undatiert.
  const m = mj({ bridge: { net_debt: { values: [4000], periods: [YE[0]] } } });
  m.fundamentals.derived = { net_debt: { override_series: [4000] } };
  assertBlocked(m, /net_debt \(manuell gesetzte Ersatzreihe\)\) ist nicht belegt/);
  // FCF-Override neben datierter Bruecke
  const m2 = mj({ bridge: debtCash(4500, 500, YE[0]) });
  m2.fundamentals.derived = { fcf: { override_series: [FCF] } };
  const r2 = S.computeReverseDcfFull(m2);
  assert.equal(r2.reverseDcfReported, null);
  assert.match(r2.reason, /fcf \(manuell gesetzte Ersatzreihe\)\) ist nicht belegt/);
});

test('Owner-FCF ueber cfo[0] − capex[0]: Zeitraum aus beiden Reihen, Widerspruch sperrt', () => {
  const ok = mj({ fcfPeriods: null, bridge: debtCash(4500, 500, YE[0]) });
  ok.fundamentals.fcf = [];   // SBC-Diagnose faellt auf cfo[0] − capex[0] = 180 zurueck
  const od = S._computeOwnerFcfDcf(ok);
  assert.equal(od.reportedFcf, 180);
  assert.equal(od.netDebtM, 4000);
  assert.equal(od.netDebtPeriodCheck, 'period_checked');
  assert.ok(Math.abs(od.reportedFcfFV - fvPerShare(FCF, 4000)) < 1e-9);

  const bad = mj({ fcfPeriods: null, cfPeriods: null, bridge: debtCash(4500, 500, YE[0]) });
  bad.fundamentals.fcf = [];
  bad.fundamentals._v4_meta.cfo = { periods: YE };
  bad.fundamentals._v4_meta.capex = { periods: ['2024-12-31', ...YE.slice(2)] };
  const ob = S._computeOwnerFcfDcf(bad);
  assert.equal(ob.reportedFcfFV, null);
  assert.equal(ob.ownerFcfFV, null);
  assert.match(ob.netDebtUnavailable, /cfo\[0\] − capex\[0\]\) ist nicht belegt \(CFO 2025-12-31, CapEx 2024-12-31\)/);
  assert.equal(ob.sbcAdjustedFcf, FCF - SBC, 'SBC-Diagnose bleibt');
});

// ── Vollstaendig periodenfreie manuelle Daten ──────────────────────────────
test('vollstaendig periodenfreie Daten: Positionsbezug als ausgewiesene Annahme, nicht als gepruefte Gleichheit', () => {
  for (const [bridge, nd] of [[{ net_debt: { values: [4000] } }, 4000],
                              [{ total_debt: { values: [4500] }, cash_and_equivalents: { values: [500] } }, 4000],
                              [{ net_debt: { values: [0] } }, 0],
                              [{ net_debt: { values: [-500] } }, -500]]) {
    const m = mj({ dated: false, bridge });
    const { r, od } = assertComputesWith(m, nd, 'unverified_manual');
    for (const x of [r.netDebtAssumption, od.netDebtAssumption]) {
      assert.match(x, /ohne Periodenangaben/);
      assert.match(x, /NICHT geprueft/);
    }
    assert.equal(r.netDebtPeriodNote, null, 'keine Aussage „geprueft“');
    assert.equal(r.netDebtPeriod, null);
    assert.equal(r.fcfPeriod, null);
  }
});

// ── Anzeige ─────────────────────────────────────────────────────────────────
test('Anzeigen: Sperrgrund statt Zahlen; Annahme bzw. Pruefung sichtbar', () => {
  const blocked = mj({ bridge: debtCash(4500, 500, '2024-12-31') });
  const html = S.buildReverseDcfDiagnosticBlock(blocked, S.runValuationEngine(blocked), []);
  const diag = html.slice(html.indexOf('Getrennte Diagnose auf REPORTED-FCF-Basis'));
  const rep = diag.slice(diag.indexOf('Reported-FCF-Basis</span>'), diag.indexOf('SBC-adj. Owner-FCF-Basis'));
  assert.doesNotMatch(rep, /[+-]?\d+\.\d\d%/);
  assert.match(rep, /nicht dem FCF-Zeitraum zuordenbar/);
  const ob = S._renderOwnerFcfDcfBlock(blocked);
  assert.doesNotMatch(ob, /DCF Fair Value: \$/);
  assert.doesNotMatch(ob, /SBC-Abschlag \(FV\)/);
  assert.match(ob, /nicht dem FCF-Zeitraum zuordenbar/);
  assert.match(ob, /\$160 M/, 'SBC-adj. Owner-FCF bleibt sichtbar');

  const manual = mj({ dated: false, bridge: { net_debt: { values: [4000] } } });
  const hm = S.buildReverseDcfDiagnosticBlock(manual, S.runValuationEngine(manual), []);
  assert.match(hm, /Nettoschulden ↔ FCF₀/);
  assert.match(hm, /NICHT geprueft/);
  assert.match(S._renderOwnerFcfDcfBlock(manual), /NICHT geprueft/);

  const valid = mj({ bridge: debtCash(4500, 500, YE[0]) });
  const hv = S.buildReverseDcfDiagnosticBlock(valid, S.runValuationEngine(valid), []);
  assert.match(hv, /Stichtag 2025-12-31 zum FCF-Zeitraum bis 2025-12-31 geprueft/);
  assert.doesNotMatch(hv, /NICHT geprueft/);
});
