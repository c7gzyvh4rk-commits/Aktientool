// ─────────────────────────────────────────────────────────────────────────────
// O-4 (V1.0.79): zwei Fehler der Eigenkapitalpruefung in _checkRetainedEarningsScope
// (Stand V1.0.78, b90ca50).
//
// 1. Doppelzaehlung: CommonStocksIncludingAdditionalPaidInCapital (Summenposten)
//    wurde zusaetzlich zu CommonStockValue und AdditionalPaidInCapital addiert.
//    Stammkapital 100 + APIC 3,400 + RE 500 = Eigenkapital 4,000 ⇒ rein; mit
//    zusaetzlichem, passendem Summenposten 3,500 rechnete die Funktion
//    100 + 3,400 + 3,500 + 500 = 7,500 und sperrte die reinen Gewinnruecklagen.
// 2. Ersatznullen: fehlende Bestandteile (Vorzugskapital, OCI, eigene Aktien,
//    Minderheiten) gingen per `|| 0` als 0 ein. Eigenkapital 7,400 = Stammkapital
//    100 + APIC 3,400 + kombinierter RE-Wert 3,900 (rein 500) + Vorzugskapital
//    3,400. Fehlt das Vorzugskapital im Auszug, schliesst 100 + 3,400 + 3,900 =
//    7,400 zufaellig ⇒ „rein“. Mit Vorzugskapital: 100 + 3,900 + 3,400 = 7,400
//    nur ohne APIC, Stammkapital = 1 USD × 100 Mio. ⇒ „kombiniert“.
//
// Sollwerte aus der Datenstruktur: Summenposten und Bestandteile sind
// alternative Darstellungen desselben eingezahlten Kapitals; eine Einstufung
// setzt voraus, dass jeder Bestandteil gemeldet ist (belegte 0 zaehlt).
// Altman Z'' = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BV/TL mit TA 10,000,
// WC 500, EBIT 400, TL 6,000 und BV = Eigenkapital des Falls.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp, secFlow, secInst, secShares, allYears } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const YRS = [2022, 2023, 2024, 2025];
const instUnit = (unit, v) => ({ units: { [unit]: YRS.map(y => ({ end: y + '-12-31', val: v, form: '10-K', filed: (y + 1) + '-02-15', accn: 'u' + y })) } });
const PAR = { CommonStockParOrStatedValuePerShare: instUnit('USD/shares', 1), CommonStockSharesIssued: instUnit('shares', 100e6) };
// belegte Nullwerte: OCI, eigene Aktien, Vorzugskapital ausdruecklich mit 0 gemeldet
const ZEROS = { AccumulatedOtherComprehensiveIncomeLossNetOfTax: secInst(allYears(0)), TreasuryStockValue: secInst(allYears(0)),
  PreferredStockValue: secInst(allYears(0)) };

function facts(se, eq) {
  return { 'us-gaap': Object.assign({
    Revenues: secFlow(allYears(5000)), OperatingIncomeLoss: secFlow(allYears(400)),
    NetIncomeLoss: secFlow(allYears(300)), NetCashProvidedByUsedInOperatingActivities: secFlow(allYears(450)),
    PaymentsToAcquirePropertyPlantAndEquipment: secFlow(allYears(150)),
    CashAndCashEquivalentsAtCarryingValue: secInst(allYears(800)),
    AssetsCurrent: secInst(allYears(3000)), LiabilitiesCurrent: secInst(allYears(2500)),
    Liabilities: secInst(allYears(6000)), StockholdersEquity: secInst(allYears(se)), Assets: secInst(allYears(10000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: secShares(allYears(100))
  }, eq) };
}
const CS = (v) => ({ CommonStockValue: secInst(allYears(v)) });
const APIC = (v) => ({ AdditionalPaidInCapital: secInst(allYears(v)) });
const CSI = (v) => ({ CommonStocksIncludingAdditionalPaidInCapital: secInst(allYears(v)) });
const RE = (v) => ({ RetainedEarningsAccumulatedDeficit: secInst(allYears(v)) });

function importFacts(f) {
  const { extracted, derivationNotes } = S._extractSecFundamentals(f);
  const mj = S._buildSecMasterJson({ ticker: 'REC', cik: '0', companyName: 'REC', sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: f, derivationNotes });
  mj.market = { price: 30 };
  mj.valuation = Object.assign({}, mj.valuation || {}, { wacc_derived: 9, wacc_components: { tax_rate: 25 },
    fade: { enabled: false }, cost_of_equity: 9, growth_terminal: 2, growth_stage1: 4 });
  return mj;
}
const VAL = (() => { const fill = (v) => Array(6).fill(v);
  return { meta: { ticker: 'VAL', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: fill(1000), ebit: fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130),
      net_income: fill(70), eps_diluted: fill(0.7), dps: fill(0.3), book_value: fill(500), total_debt: fill(600),
      cash_and_equivalents: fill(400), shares_diluted: fill(100) },
    valuation: { wacc_derived: 9, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 }, market: { price: 10 } }; })();
// Import → Altman (runQualityEngine) → synthesizeVerdict → Basis-MoS; Piotroski fest bestanden.
function path(mj) {
  const qr = S.runQualityEngine(mj);
  qr.scores.piotroski = { status: 'ok', value: 8 }; qr.hardStops = [];
  qr.descriptive.roicMinusWacc = { status: 'insufficient_data', value: null };
  const v = S.synthesizeVerdict(qr); qr.verdict = v.verdict; qr.reasons = v.reasons;
  const syn = S.runFairValueSynthesizer(VAL, S.runValuationEngine(VAL), qr, Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(VAL) }));
  return { altman: qr.scores.altman, verdict: v.verdict, mosBase: syn.mosComponents.base };
}
const scope = (mj) => [...(mj.fundamentals._v4_meta.retained_earnings.reScope || [])].map(x => x.status);
const reasons = (mj) => [...(mj.fundamentals._v4_meta.retained_earnings.reScope || [])].map(x => x.reason);
const zOf = (re, bv) => 6.56 * 500 / 10000 + 3.26 * re / 10000 + 6.72 * 400 / 10000 + 1.05 * bv / 6000;

// ═══ Fehler 1: Summenposten und Bestandteile ══════════════════════════════════
const PURE_VARIANTS = {
  'Einzelbestandteile (Stammkapital 100 + APIC 3,400)': Object.assign({}, CS(100), APIC(3400)),
  'nur Summenposten (CommonStocksIncluding… 3,500)': CSI(3500),
  'beide Darstellungen uebereinstimmend (100 + 3,400 = 3,500)': Object.assign({}, CS(100), APIC(3400), CSI(3500))
};
for (const [label, paidIn] of Object.entries(PURE_VARIANTS)) {
  test(`Fehler 1 · ${label}: reine Gewinnruecklagen 500 bleiben „rein“, Altman nach Formel`, () => {
    const mj = importFacts(facts(4000, Object.assign({}, paidIn, RE(500), ZEROS)));
    assert.deepEqual(scope(mj), ['pure', 'pure', 'pure', 'pure'], reasons(mj)[0]);
    assert.deepEqual([...mj.fundamentals.retained_earnings], [500, 500, 500, 500]);
    const r = path(mj);
    assert.equal(r.altman.status, 'ok');
    assert.ok(Math.abs(r.altman.value - zOf(500, 4000)) < 1e-9, String(r.altman.value));   // 1.4598 ⇒ grey
    assert.equal(r.verdict, 'caution_quality');
    assert.equal(r.mosBase, CFG.mos.caution_quality);
  });
}

test('Fehler 1 · redundanter passender Summenposten veraendert Wert und Einstufung nicht', () => {
  const a = importFacts(facts(4000, Object.assign({}, CS(100), APIC(3400), RE(500), ZEROS)));
  const b = importFacts(facts(4000, Object.assign({}, CS(100), APIC(3400), CSI(3500), RE(500), ZEROS)));
  assert.deepEqual([...b.fundamentals.retained_earnings], [...a.fundamentals.retained_earnings]);
  assert.deepEqual(scope(b), scope(a));
  assert.deepEqual(JSON.parse(JSON.stringify(path(b))), JSON.parse(JSON.stringify(path(a))));
});

test('Fehler 1 · widerspruechliche Darstellungen (100 + 3,400 ≠ 3,000) ⇒ ungeklaert mit Grund, keine Auswahl', () => {
  // Beide Einzeldarstellungen wuerden mit RE 500 bzw. 1,000 je fuer sich schliessen koennen;
  // der Widerspruch darf nicht durch Wahl einer Darstellung verdeckt werden.
  const mj = importFacts(facts(4000, Object.assign({}, CS(100), APIC(3400), CSI(3000), RE(500), ZEROS)));
  assert.deepEqual(scope(mj), ['unclear', 'unclear', 'unclear', 'unclear']);
  assert.match(reasons(mj)[0], /widersprechen sich/);
  assert.ok(mj.fundamentals.retained_earnings.every(v => v == null));
  assert.equal(path(mj).altman.status, 'insufficient_data');
});

// ═══ Fehler 2: fehlende Bestandteile sind keine 0 ═════════════════════════════
test('Fehler 2 · Vorzugskapital fehlt im Auszug: kombinierter Wert 3,900 wird NICHT als „rein“ freigegeben', () => {
  const eq = Object.assign({}, CS(100), APIC(3400), RE(3900), PAR,
    { AccumulatedOtherComprehensiveIncomeLossNetOfTax: secInst(allYears(0)), TreasuryStockValue: secInst(allYears(0)) });
  const mj = importFacts(facts(7400, eq));
  assert.deepEqual(scope(mj), ['unclear', 'unclear', 'unclear', 'unclear']);
  assert.match(reasons(mj)[0], /PreferredStockValue/);
  assert.match(reasons(mj)[0], /nicht gemeldet/);
  assert.ok(mj.fundamentals.retained_earnings.every(v => v == null), 'nicht an Altman');
  const r = path(mj);
  assert.equal(r.altman.status, 'insufficient_data');
  // Vorher: RE 3,900 als rein ⇒ Z'' = 0.328 + 1.2714 + 0.2688 + 1.295 = 3.1632 ⇒ safe ⇒ investable_high (15 %).
  assert.notEqual(r.verdict, 'investable_high');
  assert.equal(r.verdict, 'caution_data');
  assert.equal(r.mosBase, CFG.mos.caution_data);
});

test('Fehler 2 · vervollstaendigt (Vorzugskapital 3,400 gemeldet): belegt kombiniert, gesperrt', () => {
  const mj = importFacts(facts(7400, Object.assign({}, CS(100), APIC(3400), RE(3900), PAR,
    { AccumulatedOtherComprehensiveIncomeLossNetOfTax: secInst(allYears(0)), TreasuryStockValue: secInst(allYears(0)),
      PreferredStockValue: secInst(allYears(3400)) })));
  assert.deepEqual(scope(mj), ['combined', 'combined', 'combined', 'combined']);
  assert.ok(mj.fundamentals.retained_earnings.every(v => v == null));
  const r = path(mj);
  assert.match(r.altman.detail, /belegt kombiniert/);
  assert.equal(r.verdict, 'caution_data');
});

for (const [label, missing] of [['OCI', 'AccumulatedOtherComprehensiveIncomeLossNetOfTax'], ['eigene Aktien', 'TreasuryStockValue']]) {
  test(`Fehler 2 · ${label} nicht gemeldet ⇒ ungeklaert (keine Ersatz-0), sonst vollstaendiger reiner Fall`, () => {
    const eq = Object.assign({}, CS(100), APIC(3400), RE(500), ZEROS);
    delete eq[missing];
    const mj = importFacts(facts(4000, eq));
    assert.deepEqual(scope(mj), ['unclear', 'unclear', 'unclear', 'unclear']);
    assert.match(reasons(mj)[0], new RegExp(missing));
  });
}

test('Fehler 2 · Eigenkapital nur inkl. Minderheiten ohne MinorityInterest ⇒ ungeklaert; mit MinorityInterest 0 ⇒ rein', () => {
  const base = Object.assign({}, CS(100), APIC(3400), RE(500), ZEROS);
  const f1 = facts(4000, base); delete f1['us-gaap'].StockholdersEquity;
  f1['us-gaap'].StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest = secInst(allYears(4000));
  const m1 = importFacts(f1);
  assert.deepEqual(scope(m1), ['unclear', 'unclear', 'unclear', 'unclear']);
  assert.match(reasons(m1)[0], /MinorityInterest/);
  const f2 = JSON.parse(JSON.stringify(f1));
  f2['us-gaap'].MinorityInterest = secInst(allYears(0));
  assert.deepEqual(scope(importFacts(f2)), ['pure', 'pure', 'pure', 'pure']);
});

test('Gegenprobe · vollstaendig mit belegten Nicht-Null-Bestandteilen (OCI −200, eigene Aktien 300, Vorzugskapital 0) ⇒ rein', () => {
  // 100 + 3,400 + 1,000 − 200 − 300 + 0 = 4,000
  const mj = importFacts(facts(4000, Object.assign({}, CS(100), APIC(3400), RE(1000), {
    AccumulatedOtherComprehensiveIncomeLossNetOfTax: secInst(allYears(-200)), TreasuryStockValue: secInst(allYears(300)),
    PreferredStockValue: secInst(allYears(0)) })));
  assert.deepEqual(scope(mj), ['pure', 'pure', 'pure', 'pure']);
  const r = path(mj);
  assert.ok(Math.abs(r.altman.value - zOf(1000, 4000)) < 1e-9);
});
