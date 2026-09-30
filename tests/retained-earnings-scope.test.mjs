// ─────────────────────────────────────────────────────────────────────────────
// O-4 (V1.0.77): kombinierter Wert „Gewinnruecklagen + Kapitalruecklage“ unter
// dem Tag RetainedEarningsAccumulatedDeficit.
//
// JNJ meldet seit dem 10-K FY2022 die Bilanzzeile „Retained earnings and
// Additional-paid-in-capital“ (Primaerquelle jnj-20251228.htm, Auditbeleg
// bs.re_apic: 168,978 zum 2025-12-28) unter us-gaap:
// RetainedEarningsAccumulatedDeficit. Nach Taxonomie-Definition umfasst dieser
// Tag nur die Gewinnruecklagen. Company Facts liefern keine firmeneigenen
// Zeilenbezeichnungen; erkennbar ist die Zusammenfassung an der Datendefinition
// selbst: Der Emittent meldet BEWEGUNGEN der Kapitalruecklage
// (AdjustmentsToAdditionalPaidInCapital…), aber KEINEN eigenen Bestand
// (AdditionalPaidInCapital, AdditionalPaidInCapitalCommonStock,
// CommonStocksIncludingAdditionalPaidInCapital). Die Kapitalruecklage steckt
// dann in einer anderen Eigenkapitalzeile — der unter dem RE-Tag gemeldete Wert
// ist als reine Gewinnruecklage nicht belegt. Zerlegen laesst er sich ohne
// gemeldeten APIC-Bestand nicht.
//
// Folge bis V1.0.76: Altman Z'' (3.26 · RE / TA) haette den Wert als
// Gewinnruecklage verwendet. Altman fliesst ins Qualitaetsurteil und damit in
// die Basis-MoS. Bei JNJ verdeckt, weil EBIT fehlt; hier synthetisch MIT EBIT.
//
// Sollwerte aus der Formel Z'' = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BV/TL
// mit TA 10,000, WC 3,000 − 2,500 = 500, EBIT 400, BV 4,000, TL 6,000:
//   ohne RE-Term: 0.328 + 0.2688 + 0.7 = 1.2968
//   RE 5,000 (kombiniert) ⇒ Z'' = 2.9268 (safe);  RE 500 (rein) ⇒ Z'' = 1.4598 (grey)
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
const REAL = JSON.parse(readFileSync(join(HERE, 'real-data', 'excerpts', 're-apic-excerpt.json'), 'utf8')).companies;
const Z_BASE = 6.56 * 500 / 10000 + 6.72 * 400 / 10000 + 1.05 * 4000 / 6000;
const APIC_FLOW = 'AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue';

function facts({ re, extra = {} }) {
  const g = { 'us-gaap': {
    Revenues: secFlow(allYears(5000)), OperatingIncomeLoss: secFlow(allYears(400)),
    NetIncomeLoss: secFlow(allYears(300)), NetCashProvidedByUsedInOperatingActivities: secFlow(allYears(450)),
    PaymentsToAcquirePropertyPlantAndEquipment: secFlow(allYears(150)),
    DepreciationDepletionAndAmortization: secFlow(allYears(120)),
    CashAndCashEquivalentsAtCarryingValue: secInst(allYears(800)),
    AssetsCurrent: secInst(allYears(3000)), LiabilitiesCurrent: secInst(allYears(2500)),
    Liabilities: secInst(allYears(6000)), StockholdersEquity: secInst(allYears(4000)),
    Assets: secInst(allYears(10000)), RetainedEarningsAccumulatedDeficit: secInst(allYears(re)),
    WeightedAverageNumberOfDilutedSharesOutstanding: secShares(allYears(100))
  } };
  Object.assign(g['us-gaap'], extra);
  return g;
}
function importFacts(f) {
  const { extracted, derivationNotes } = S._extractSecFundamentals(f);
  const mj = S._buildSecMasterJson({ ticker: 'REX', cik: '0', companyName: 'REX', sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: f, derivationNotes });
  mj.market = { price: 30 };
  mj.valuation = Object.assign({}, mj.valuation || {}, { wacc_derived: 9, wacc_components: { tax_rate: 25 },
    fade: { enabled: false }, cost_of_equity: 9, growth_terminal: 2, growth_stage1: 4 });
  return { mj, extracted };
}
// Qualitaetsurteil ueber die produktiven Pfade (Import → runQualityEngine →
// synthesizeVerdict); Piotroski fest „bestanden“, ROIC − WACC neutral, damit
// das Urteil allein an Altman haengt. Die Basis-MoS liefert der produktive
// Synthesizer fuer dieses Urteil; er braucht ein bewertbares Unternehmen,
// daher die feste Bewertungs-Attrappe VAL (wie tests/roic-cash-period).
const VAL = (() => {
  const fill = (v) => Array(6).fill(v);
  return { meta: { ticker: 'VAL', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: fill(1000), ebit: fill(100), ebitda: fill(150), capex: fill(50), cfo: fill(130),
      net_income: fill(70), eps_diluted: fill(0.7), dps: fill(0.3), book_value: fill(500), total_debt: fill(600),
      cash_and_equivalents: fill(400), shares_diluted: fill(100) },
    valuation: { wacc_derived: 9, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
      cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 }, market: { price: 10 } };
})();
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

test('O-4: RE-Tag mit APIC-Bewegungen, aber ohne APIC-Bestand gilt nicht als reine Gewinnruecklage', () => {
  const { mj } = importFacts(facts({ re: 5000, extra: { [APIC_FLOW]: secFlow(allYears(50)) } }));
  const f = mj.fundamentals;
  assert.ok(Array.isArray(f.retained_earnings));
  assert.ok(f.retained_earnings.every(v => v == null), 'kein Wert als Gewinnruecklage: ' + f.retained_earnings);
  const m = f._v4_meta.retained_earnings;
  assert.equal(m.unavailablePeriods.length, 4);
  assert.match(m.unavailablePeriods[0], /^2025-12-31: /);
  assert.match(m.notes, /Kapitalr(ue|ü)cklage/);
});

test('O-4 Folgepfad: kein Altman-Wert, kein Qualitaetsurteil und keine Basis-MoS aus dem kombinierten Wert (synthetisch MIT EBIT)', () => {
  const { mj } = importFacts(facts({ re: 5000, extra: { [APIC_FLOW]: secFlow(allYears(50)) } }));
  assert.equal(mj.fundamentals.ebit[0], 400, 'EBIT vorhanden — der Fehler waere nicht verdeckt');
  const r = verdictAndMos(mj);
  assert.equal(r.altman.status, 'insufficient_data');
  assert.equal(r.altman.value, null);
  assert.match(r.altman.detail, /retained_earnings/);
  // Vorher: Z'' = 2.9268 (safe) ⇒ investable_high ⇒ Basis-MoS 15 %.
  assert.notEqual(r.verdict, 'investable_high');
  // Unabhaengige Kontrolle: dasselbe Unternehmen ganz ohne RE-Angabe.
  const { mj: none } = importFacts((() => { const x = facts({ re: 5000 }); delete x['us-gaap'].RetainedEarningsAccumulatedDeficit; return x; })());
  const c = verdictAndMos(none);
  assert.equal(r.verdict, c.verdict);
  assert.equal(r.mosBase, c.mosBase);
  assert.equal(r.verdict, 'caution_data');
  assert.equal(r.mosBase, CFG.mos.caution_data);
});

test('Gegenprobe: APIC-Bestand eigens gemeldet ⇒ RE bleibt, Altman nach Formel (1.4598, grey ⇒ caution_quality)', () => {
  const { mj } = importFacts(facts({ re: 500, extra: { [APIC_FLOW]: secFlow(allYears(50)),
    AdditionalPaidInCapital: secInst(allYears(4500)) } }));
  assert.deepEqual([...mj.fundamentals.retained_earnings], [500, 500, 500, 500]);
  const r = verdictAndMos(mj);
  assert.equal(r.altman.status, 'ok');
  assert.ok(Math.abs(r.altman.value - (Z_BASE + 3.26 * 500 / 10000)) < 1e-9, String(r.altman.value));
  assert.equal(r.verdict, 'caution_quality');
  assert.equal(r.mosBase, CFG.mos.caution_quality);
});

test('Gegenprobe: Stammkapital inkl. Kapitalruecklage (CommonStocksIncludingAdditionalPaidInCapital) ⇒ RE bleibt', () => {
  const { mj } = importFacts(facts({ re: 500, extra: { [APIC_FLOW]: secFlow(allYears(50)),
    CommonStocksIncludingAdditionalPaidInCapital: secInst(allYears(4500)) } }));
  assert.deepEqual([...mj.fundamentals.retained_earnings], [500, 500, 500, 500]);
});

test('Gegenprobe: keine APIC-Angaben ueberhaupt ⇒ RE bleibt (kein Hinweis auf eine Kapitalruecklage), Altman safe', () => {
  const { mj } = importFacts(facts({ re: 5000 }));
  assert.deepEqual([...mj.fundamentals.retained_earnings], [5000, 5000, 5000, 5000]);
  const r = verdictAndMos(mj);
  assert.ok(Math.abs(r.altman.value - (Z_BASE + 3.26 * 5000 / 10000)) < 1e-9);
  assert.equal(r.verdict, 'investable_high');
});

test('O-4 je Periode: APIC-Bestand nur fuer 2023/2022 ⇒ nur 2025/2024 verworfen', () => {
  const { mj } = importFacts(facts({ re: 800, extra: { [APIC_FLOW]: secFlow(allYears(50)),
    AdditionalPaidInCapital: secInst({ 2023: 4000, 2022: 3900 }) } }));
  assert.deepEqual([...mj.fundamentals.retained_earnings], [null, null, 800, 800]);
  const u = mj.fundamentals._v4_meta.retained_earnings.unavailablePeriods;
  assert.equal(u.length, 2);
  assert.match(u[0], /^2025-12-31/); assert.match(u[1], /^2024-12-31/);
});

test('Realdaten JNJ (Company Facts): kombinierter RE+APIC-Wert 168,978 zum 2025-12-28 wird nicht als Gewinnruecklage uebernommen', () => {
  const { extracted } = S._extractSecFundamentals(REAL.JNJ.facts);
  const re = extracted.retained_earnings;
  assert.equal(re.meta.periods[0], '2025-12-28');
  assert.equal(re.values[0], null);
  assert.ok(re.meta.unavailablePeriods.some(u => u.startsWith('2025-12-28') && /168,?978|168978/.test(u)),
    re.meta.unavailablePeriods.join(' | '));
});

test('Realdaten MCD (Company Facts, APIC-Bestand gemeldet): Gewinnruecklagen 70,282 zum 2025-12-31 bleiben', () => {
  const { extracted } = S._extractSecFundamentals(REAL.MCD.facts);
  const re = extracted.retained_earnings;
  assert.equal(re.meta.periods[0], '2025-12-31');
  assert.equal(re.values[0], 70282);
  assert.ok(!re.meta.unavailablePeriods || re.meta.unavailablePeriods.length === 0);
});
