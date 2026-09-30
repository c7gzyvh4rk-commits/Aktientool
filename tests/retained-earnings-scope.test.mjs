// ─────────────────────────────────────────────────────────────────────────────
// O-4: Umfang des Gewinnruecklagen-Tags (us-gaap:RetainedEarningsAccumulatedDeficit)
// V1.0.77 eingefuehrt, V1.0.78 nach Nachreview PR #3 berichtigt.
//
// V1.0.77 schloss aus „APIC-Bewegungen gemeldet, aber kein APIC-Bestand“ auf
// „der Wert umfasst die Kapitalruecklage“ und verwarf ihn. Das ist kein Nachweis:
// Bei JNJ stehen die Buchungen AdjustmentsToAdditionalPaidInCapital… in der
// Eigenkapitalveraenderung zum Teil in der Spalte „Retained earnings“ — aber mit
// NEGATIVEM Vorzeichen (Belastung aus Mitarbeiterplaenen), die Gutschrift liegt
// bei den eigenen Aktien (tests/real-data/excerpts/jnj-re-primary-sources.json).
// Umgekehrt beweist ein vorhandener APIC-Bestand allein nicht, dass der RE-Wert
// rein ist (Gegenprobe „belegt kombiniert“ unten: V1.0.77 liess ihn durch).
//
// V1.0.78 unterscheidet je Stichtag aus den gemeldeten Bilanzwerten:
//   · rein     — eigener Kapitalruecklagen-Bestand (AdditionalPaidInCapital*,
//                CommonStocksIncludingAdditionalPaidInCapital) UND die
//                Eigenkapitalidentitaet Stammkapital + Kapitalruecklage + RE + OCI
//                + Vorzugskapital − eigene Aktien = Eigenkapital schliesst;
//   · kombiniert — Kapitalruecklage eigens gemeldet, Identitaet schliesst aber
//                nur OHNE sie, und das Stammkapital entspricht Nennwert × ausgegebene
//                Aktien ⇒ die Kapitalruecklage steckt im RE-Wert;
//   · ungeklaert — alles andere (u. a. kein eigener Bestand; Identitaet schliesst
//                nicht; Bestandteile fehlen). Grund als Unsicherheit formuliert.
// Nur „rein“ geht in Altman ein.
//
// Altman-Sollwerte aus Z'' = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BV/TL,
// TA 10,000, WC 3,000 − 2,500 = 500, EBIT 400, BV 4,000, TL 6,000:
//   ohne RE-Term 1.2968; RE 500 ⇒ 1.4598 (grey ⇒ Fail); RE 3,900 ⇒ 2.5682 (grey_near).
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, evalInApp, secFlow, secInst, secShares, allYears } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const HERE = dirname(fileURLToPath(import.meta.url));
const EX = (n) => JSON.parse(readFileSync(join(HERE, 'real-data', 'excerpts', n), 'utf8'));
const REAL = EX('re-apic-excerpt.json').companies;
const PRIMARY = EX('jnj-re-primary-sources.json').periods;
const Z_BASE = 6.56 * 500 / 10000 + 6.72 * 400 / 10000 + 1.05 * 4000 / 6000;
const APIC_FLOW = 'AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue';
const YRS = [2022, 2023, 2024, 2025];
const instUnit = (unit, v) => ({ units: { [unit]: YRS.map(y => ({ end: y + '-12-31', val: v, form: '10-K', filed: (y + 1) + '-02-15', accn: 'u' + y })) } });
const PAR_1_100M = { CommonStockParOrStatedValuePerShare: instUnit('USD/shares', 1), CommonStockSharesIssued: instUnit('shares', 100e6) };

// Eigenkapital 4,000 in allen Faellen; `eq` ergaenzt die Eigenkapitalbestandteile.
function facts(eq) {
  const g = { 'us-gaap': {
    Revenues: secFlow(allYears(5000)), OperatingIncomeLoss: secFlow(allYears(400)),
    NetIncomeLoss: secFlow(allYears(300)), NetCashProvidedByUsedInOperatingActivities: secFlow(allYears(450)),
    PaymentsToAcquirePropertyPlantAndEquipment: secFlow(allYears(150)),
    DepreciationDepletionAndAmortization: secFlow(allYears(120)),
    CashAndCashEquivalentsAtCarryingValue: secInst(allYears(800)),
    AssetsCurrent: secInst(allYears(3000)), LiabilitiesCurrent: secInst(allYears(2500)),
    Liabilities: secInst(allYears(6000)), StockholdersEquity: secInst(allYears(4000)),
    Assets: secInst(allYears(10000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: secShares(allYears(100))
  } };
  Object.assign(g['us-gaap'], eq);
  return g;
}
const CASES = {
  // Stammkapital 100 + Kapitalruecklage 3,400 + RE 500 = 4,000 ⇒ rein
  pureApic: { CommonStockValue: secInst(allYears(100)), AdditionalPaidInCapital: secInst(allYears(3400)),
    RetainedEarningsAccumulatedDeficit: secInst(allYears(500)), [APIC_FLOW]: secFlow(allYears(50)) },
  // Kapitalruecklage im Stammkapital (CommonStocksIncludingAdditionalPaidInCapital 3,500) + RE 500 = 4,000 ⇒ rein
  pureInCommon: { CommonStocksIncludingAdditionalPaidInCapital: secInst(allYears(3500)),
    RetainedEarningsAccumulatedDeficit: secInst(allYears(500)), [APIC_FLOW]: secFlow(allYears(50)) },
  // Kapitalruecklage 3,400 gemeldet, aber Stammkapital 100 (= 1 USD × 100 Mio.) + RE-Tag 3,900 = 4,000
  // ⇒ die 3,400 sind im RE-Tag enthalten (reine Gewinnruecklage 500) ⇒ belegt kombiniert
  combined: Object.assign({ CommonStockValue: secInst(allYears(100)), AdditionalPaidInCapital: secInst(allYears(3400)),
    RetainedEarningsAccumulatedDeficit: secInst(allYears(3900)) }, PAR_1_100M),
  // kein Kapitalruecklagen-Bestand, APIC-Bewegungen gemeldet, Stammkapital 100 + RE 3,900 = 4,000 ⇒ ungeklaert
  unclearMovements: { CommonStockValue: secInst(allYears(100)), RetainedEarningsAccumulatedDeficit: secInst(allYears(3900)),
    [APIC_FLOW]: secFlow(allYears(50)) },
  // keinerlei APIC-Angaben ⇒ ebenfalls ungeklaert (fehlende Bewegungen beweisen nichts)
  unclearNoApic: { CommonStockValue: secInst(allYears(100)), RetainedEarningsAccumulatedDeficit: secInst(allYears(3900)) },
  // APIC-Bestand vorhanden, Identitaet schliesst nicht (100 + 3,400 + 900 = 4,400 ≠ 4,000) ⇒ ungeklaert
  unclearNoClose: { CommonStockValue: secInst(allYears(100)), AdditionalPaidInCapital: secInst(allYears(3400)),
    RetainedEarningsAccumulatedDeficit: secInst(allYears(900)) },
  // wie combined, aber ohne Nennwert/Aktienzahl ⇒ doppelt gezaehlte Kapitalruecklage nicht zuordenbar ⇒ ungeklaert
  unclearNoPar: { CommonStockValue: secInst(allYears(100)), AdditionalPaidInCapital: secInst(allYears(3400)),
    RetainedEarningsAccumulatedDeficit: secInst(allYears(3900)) }
};

function importFacts(f) {
  const { extracted, derivationNotes } = S._extractSecFundamentals(f);
  const mj = S._buildSecMasterJson({ ticker: 'REX', cik: '0', companyName: 'REX', sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: f, derivationNotes });
  mj.market = { price: 30 };
  mj.valuation = Object.assign({}, mj.valuation || {}, { wacc_derived: 9, wacc_components: { tax_rate: 25 },
    fade: { enabled: false }, cost_of_equity: 9, growth_terminal: 2, growth_stage1: 4 });
  return { mj, extracted };
}
const VAL = (() => {
  const fill = (v) => Array(6).fill(v);
  return { meta: { ticker: 'VAL', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: fill(1000), ebit: fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130),
      net_income: fill(70), eps_diluted: fill(0.7), dps: fill(0.3), book_value: fill(500), total_debt: fill(600),
      cash_and_equivalents: fill(400), shares_diluted: fill(100) },
    valuation: { wacc_derived: 9, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 }, market: { price: 10 } };
})();
// Import → runQualityEngine (Altman) → synthesizeVerdict → Basis-MoS des Synthesizers.
// Piotroski fest „bestanden“, ROIC − WACC neutral: das Urteil haengt allein an Altman.
function verdictAndMos(mj) {
  const qr = S.runQualityEngine(mj);
  qr.scores.piotroski = { status: 'ok', value: 8 };
  qr.hardStops = [];
  qr.descriptive.roicMinusWacc = { status: 'insufficient_data', value: null };
  const v = S.synthesizeVerdict(qr);
  qr.verdict = v.verdict; qr.reasons = v.reasons;
  const syn = S.runFairValueSynthesizer(VAL, S.runValuationEngine(VAL), qr,
    Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(VAL) }));
  return { altman: qr.scores.altman, verdict: v.verdict, mosBase: syn.mosComponents.base };
}
const scopeOf = (mj) => mj.fundamentals._v4_meta.retained_earnings.reScope || [];

test('Gegenprobe 1: belegt kombinierter RE+APIC-Wert bleibt gesperrt (Grund: kombiniert, belegt)', () => {
  const { mj } = importFacts(facts(CASES.combined));
  assert.deepEqual([...mj.fundamentals.retained_earnings], [null, null, null, null]);
  const sc = scopeOf(mj);
  assert.equal(sc.length, 4);
  assert.ok(sc.every(x => x.status === 'combined'), JSON.stringify(sc.map(x => x.status)));
  assert.match(sc[0].reason, /enth(ä|ae)lt die gemeldete Kapitalr(ü|ue)cklage/);
});

test('Gegenprobe 1 Folgepfad: vorher Z″ 2.5682 ⇒ investable_mid/20 %, jetzt Altman gesperrt ⇒ wie „RE fehlt“', () => {
  const r = verdictAndMos(importFacts(facts(CASES.combined)).mj);
  assert.equal(r.altman.status, 'insufficient_data');
  assert.match(r.altman.detail, /retained_earnings \(belegt kombiniert/);
  const none = verdictAndMos(importFacts(facts({ CommonStockValue: secInst(allYears(100)) })).mj);
  assert.equal(r.verdict, none.verdict);
  assert.equal(r.mosBase, none.mosBase);
  assert.equal(r.verdict, 'caution_data');
  assert.equal(r.mosBase, CFG.mos.caution_data);
});

for (const k of ['pureApic', 'pureInCommon']) {
  test(`Gegenprobe 2 (${k}): belegt reine Gewinnruecklagen bleiben, Altman nach Formel 1.4598 ⇒ caution_quality`, () => {
    const { mj } = importFacts(facts(CASES[k]));
    assert.deepEqual([...mj.fundamentals.retained_earnings], [500, 500, 500, 500]);
    assert.ok(scopeOf(mj).every(x => x.status === 'pure'));
    const r = verdictAndMos(mj);
    assert.equal(r.altman.status, 'ok');
    assert.ok(Math.abs(r.altman.value - (Z_BASE + 3.26 * 500 / 10000)) < 1e-9, String(r.altman.value));
    assert.equal(r.verdict, 'caution_quality');
    assert.equal(r.mosBase, CFG.mos.caution_quality);
  });
}

for (const [k, why] of [['unclearMovements', /kein eigener Kapitalr(ü|ue)cklagen-Bestand/],
                        ['unclearNoApic', /kein eigener Kapitalr(ü|ue)cklagen-Bestand/],
                        ['unclearNoClose', /schlie(ß|ss)t nicht/],
                        ['unclearNoPar', /nicht zuordenbar|nicht bestimmbar/]]) {
  test(`Gegenprobe 3 (${k}): Umfang ungeklaert — gesperrt, Grund als Unsicherheit, keine Tatsachenbehauptung`, () => {
    const { mj } = importFacts(facts(CASES[k]));
    assert.ok(mj.fundamentals.retained_earnings.every(v => v == null));
    const sc = scopeOf(mj);
    assert.ok(sc.length === 4 && sc.every(x => x.status === 'unclear'), JSON.stringify(sc.map(x => x.status)));
    assert.match(sc[0].reason, /ungekl(ä|ae)rt/);
    assert.match(sc[0].reason, why);
    const notes = JSON.stringify(mj.fundamentals._v4_meta.retained_earnings);
    assert.doesNotMatch(notes, /umfasst damit auch die Kapitalr/, 'keine Behauptung einer Kombination');
    const r = verdictAndMos(mj);
    assert.equal(r.altman.status, 'insufficient_data');
    assert.match(r.altman.detail, /retained_earnings \(Umfang ungekl(ä|ae)rt/);
  });
}

test('Realdaten MCD (Company Facts): Identitaet 17 + 9,641 + 70,282 − 2,414 − 79,316 ≈ −1,791 ⇒ rein, Werte bleiben', () => {
  const { extracted } = S._extractSecFundamentals(REAL.MCD.facts);
  const re = extracted.retained_earnings;
  assert.equal(re.meta.periods[0], '2025-12-31');
  assert.equal(re.values[0], 70282);
  assert.ok(re.values.every(v => v != null), JSON.stringify(re.values));
  assert.ok(re.meta.reScope.every(x => x.status === 'pure'), JSON.stringify(re.meta.reScope.map(x => x.period + ':' + x.status)));
});

test('Realdaten JNJ (Company Facts): alle Stichtage ungeklaert — weder als rein noch als belegt kombiniert behandelt', () => {
  const { extracted } = S._extractSecFundamentals(REAL.JNJ.facts);
  const re = extracted.retained_earnings;
  assert.ok(re.values.every(v => v == null), JSON.stringify(re.values));
  assert.ok(re.meta.reScope.length >= 8);
  for (const x of re.meta.reScope) {
    assert.equal(x.status, 'unclear', x.period);
    assert.doesNotMatch(x.reason, /umfasst damit|enthält die gemeldete/);
  }
});

test('Primaerquellen JNJ: FY2018–FY2022 rein, FY2023–FY2025 kombiniert — Werte stimmen mit den Company Facts ueberein', () => {
  // Einstufung nach Primaerquelle derselben Periode: Bilanzzeile + Buchungen der RE-Spalte.
  // Kapitalgutschrift = positive Buchung, die weder Ergebnis noch Rueckbuchung ist
  // (hier „Kenvue Separation/IPO“); Belastungen aus Mitarbeiterplaenen sind negativ.
  const cf = new Map(REAL.JNJ.facts['us-gaap'].RetainedEarningsAccumulatedDeficit.units.USD.map(e => [e.end, e.val / 1e6]));
  const cls = {};
  for (const p of PRIMARY) {
    assert.equal(cf.get(p.period), p.value, 'Company-Facts-Wert = Primaerquelle ' + p.period);
    const combinedLabel = /Additional-paid-in-capital/i.test(p.balanceSheetLabel);
    const capitalCredit = (p.retainedEarningsColumnFiscalYear || []).some(i =>
      i.value > 0 && !/NetIncomeLoss|DividendsCommonStockCash|StockholdersEquityOther|CumulativeEffect/.test(i.concept));
    const planDebits = (p.retainedEarningsColumnFiscalYear || []).filter(i => /AdjustmentsToAdditionalPaidInCapital/.test(i.concept));
    assert.ok(planDebits.every(i => i.value < 0), p.period + ': Buchung aus Mitarbeiterplaenen ist eine Belastung');
    cls[p.period] = combinedLabel || capitalCredit ? 'combined' : 'retained_earnings_only';
  }
  assert.deepEqual(cls, {
    '2018-12-30': 'retained_earnings_only', '2019-12-29': 'retained_earnings_only',
    '2021-01-03': 'retained_earnings_only', '2022-01-02': 'retained_earnings_only',
    '2023-01-01': 'retained_earnings_only',
    '2023-12-31': 'combined', '2024-12-29': 'combined', '2025-12-28': 'combined'
  });
  // 2023-01-01 erscheint im Folgeabschluss betragsgleich unter der Sammelbezeichnung.
  const p0101 = PRIMARY.find(p => p.period === '2023-01-01');
  assert.ok(p0101.laterPresentations.some(l => /Additional-paid-in-capital/.test(l.label) && l.value === p0101.value));
});
