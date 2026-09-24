// ═══════════════════════════════════════════════════════════════════════════
// Synthetische Testdaten der Browser-Abnahme (Folgechat B)
// ───────────────────────────────────────────────────────────────────────────
// ALLE Werte sind erfunden. Sie stehen fuer kein reales Unternehmen und
// ersetzen keinen Abgleich mit echten Abschluessen.
//
// Zwei Arten:
//   · `ttmMasterJson()` — ein synthetischer SEC-Filer mit Quartalsdaten
//     (FY 2024 vollstaendig, 2025 nur Q1–Q3). Das Master-JSON entsteht ueber
//     den produktiven SEC-Aufbereitungsweg der Tool-Datei (in Node, ohne
//     Netz: tests/audit-chat12.mjs → importSecFacts) und wird danach im
//     Browser ueber die OBERFLAECHE importiert. Gleiche Zahlen wie R47:
//     FY-EBITDA 250M zum 31.12.2024, TTM-EBITDA 343,75M zum 30.09.2025,
//     Nettoschulden 400M, 100M Aktien.
//   · kleine, von Hand gebaute Master-JSONs fuer die gezielten Anzeigen
//     (Bruecke, DDM, Multiples, Financials, Snapshot-IDs).
// ═══════════════════════════════════════════════════════════════════════════
import { importSecFacts } from '../audit-chat12.mjs';

const M = 1e6;
const QEND = { 1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31' };
const form = (n) => (n === 4 ? '10-K' : '10-Q');
const filed = (y, n) => (n === 4 ? (y + 1) + '-02-15' : y + '-' + String(n * 3 + 2).padStart(2, '0') + '-01');
const cum4 = (q) => [q, 2 * q, 3 * q, 4 * q];
const cum3 = (q) => [q, 2 * q, 3 * q];
const qFlow = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-01-01', end: y + QEND[i + 1], val: v * M, form: form(i + 1), filed: filed(+y, i + 1), accn: 'f' + y + i }))) } });
const qInst = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  end: y + QEND[i + 1], val: v * M, form: form(i + 1), filed: filed(+y, i + 1), accn: 'i' + y + i }))) } });
const qShr = (spec) => ({ units: { shares: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-' + String(i * 3 + 1).padStart(2, '0') + '-01', end: y + QEND[i + 1], val: v * M,
  form: form(i + 1), filed: filed(+y, i + 1), accn: 's' + y + i }))) } });
const flat = (v4, v3) => ({ 2022: [v4, v4, v4, v4], 2023: [v4, v4, v4, v4], 2024: [v4, v4, v4, v4], 2025: [v3, v3, v3] });

export function ttmFacts() {
  return { 'us-gaap': {
    Revenues:            qFlow({ 2022: cum4(250), 2023: cum4(250), 2024: cum4(250), 2025: cum3(375) }),
    OperatingIncomeLoss: qFlow({ 2022: cum4(50),  2023: cum4(50),  2024: cum4(50),  2025: cum3(75) }),
    NetIncomeLoss:       qFlow({ 2022: cum4(37.5), 2023: cum4(37.5), 2024: cum4(37.5), 2025: cum3(56.25) }),
    NetCashProvidedByUsedInOperatingActivities: qFlow({ 2022: cum4(50), 2023: cum4(50), 2024: cum4(50), 2025: cum3(75) }),
    PaymentsToAcquirePropertyPlantAndEquipment: qFlow({ 2022: cum4(12.5), 2023: cum4(12.5), 2024: cum4(12.5), 2025: cum3(18.75) }),
    DepreciationDepletionAndAmortization:       qFlow({ 2022: cum4(12.5), 2023: cum4(12.5), 2024: cum4(12.5), 2025: cum3(18.75) }),
    CashAndCashEquivalentsAtCarryingValue: qInst(flat(100, 100)),
    DebtAndCapitalLeaseObligations:        qInst(flat(500, 500)),
    LongTermDebtNoncurrent:                qInst(flat(500, 500)),
    LongTermDebtCurrent:                   qInst(flat(0, 0)),
    ShortTermBorrowings:                   qInst(flat(0, 0)),
    FinanceLeaseLiabilityCurrent:          qInst(flat(0, 0)),
    FinanceLeaseLiabilityNoncurrent:       qInst(flat(0, 0)),
    AssetsCurrent:       qInst(flat(400, 400)),
    LiabilitiesCurrent:  qInst(flat(500, 500)),
    StockholdersEquity:  qInst(flat(3000, 3000)),
    Assets:              qInst(flat(7000, 7000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: qShr(flat(100, 100))
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2025-09-30', val: 100 * M, form: '10-Q', filed: '2025-11-01' } ] } } } };
}

// Hauptdatensatz des zusammenhaengenden Bedienungsablaufs.
export function ttmMasterJson() {
  const mj = importSecFacts(ttmFacts(), { ticker: 'SYNTB', price: 25 });
  mj.meta.company_name = 'Synthetik Browser-Abnahme (erfunden)';
  mj.valuation = mj.valuation || {};
  mj.valuation.data_basis = 'fy';
  mj.market = Object.assign({}, mj.market, { price: 25, own_multiples_median: { ev_ebitda_10y: 10 } });
  return mj;
}

// Variante mit ausgeloestem Hard Stop (Going Concern: eingeschraenktes
// Pruefungsurteil) fuer den Override-Ablauf.
export function hardStopMj() {
  const mj = ttmMasterJson();
  mj.quality_inputs = Object.assign({}, mj.quality_inputs, { auditor_opinion_status: 'qualified' });
  return mj;
}

// ── Kleine, von Hand gebaute Datensaetze ─────────────────────────────────
const META = (ticker, sub) => ({
  ticker, company_name: 'Synthetik ' + ticker + ' (erfunden)', currency: 'USD',
  reporting_unit: 'millions', exchange: 'NASDAQ', sub_classification: sub || 'standard_nonfin'
});
const small = (ticker, fund, own, extra) => Object.assign({
  schema_version: '4.0',
  meta: META(ticker),
  fundamentals: Object.assign({ revenue: [1000] }, fund),
  valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false } },
  market: { price: 20, own_multiples_median: own }
}, extra || {});

const D25 = '2025-12-31';
const dated = (p) => ({ periods: [p], isFlowConcept: false, unit: 'USD' });

// EV/EBITDA-Bruecke: EBITDA 250, Multiple 10, 100 Aktien, Nettoschulden 900
// ⇒ freigegeben waere 16,00 USD; operativer EV 2500M.
export function bridgeCases() {
  const mk = (ticker, fund, meta) => small(ticker,
    Object.assign({ ebitda: [250], shares_diluted: [100] }, fund, meta ? { _v4_meta: meta } : {}),
    { ev_ebitda_10y: 10 });
  const BR = /Bilanzstichtag des verwendeten Betrags \(net_debt\[0\]\)/;
  const EB = /Periodenende des EBITDA ist trotz vorhandener Periodenangaben nicht bestimmbar/;
  return [
    { name: 'V1.0.69 net_debt periods ["n/a"], EBITDA ohne Metadaten', expect: 'blocked', reason: BR,
      mj: mk('BRA', { net_debt: [900] }, { net_debt: { periods: ['n/a'], source_type: 'reported', unit: 'USD' } }) },
    { name: 'V1.0.69 net_debt periods [null], EBITDA ohne Metadaten', expect: 'blocked', reason: BR,
      mj: mk('BRB', { net_debt: [900] }, { net_debt: { periods: [null], source_type: 'reported', unit: 'USD' } }) },
    { name: 'V1.0.69 EBITDA periods [null], Bruecke ohne Metadaten', expect: 'blocked', reason: EB,
      mj: mk('BRC', { net_debt: [900] }, { ebitda: { periods: [null], isFlowConcept: true, unit: 'USD' } }) },
    { name: 'V1.0.69 EBITDA periods ["n/a"], Bruecke ohne Metadaten', expect: 'blocked', reason: EB,
      mj: mk('BRD', { net_debt: [900] }, { ebitda: { periods: ['n/a'], isFlowConcept: true, unit: 'USD' } }) },
    { name: '12F 1a net_debt undatiert, total_debt/cash datiert', expect: 'blocked',
      reason: /nicht bestimmbar[\s\S]*anderen Feldes/,
      mj: mk('BRE', { net_debt: [900], total_debt: [500], cash: [100] }, {
        ebitda: { periods: [D25], isFlowConcept: true, unit: 'USD' },
        net_debt: { periods: [null], source_type: 'reported', unit: 'USD' },
        total_debt: Object.assign(dated(D25), { source_type: 'reported' }),
        cash: Object.assign(dated(D25), { source_type: 'reported' }) }) },
    { name: '12F 1b EBITDA undatiert, net_debt datiert', expect: 'blocked', reason: /Periodenende des EBITDA/,
      mj: mk('BRF', { net_debt: [900] }, {
        ebitda: { periods: [null], isFlowConcept: true, unit: 'USD' },
        net_debt: Object.assign(dated(D25), { source_type: 'reported' }) }) },
    // V1.0.70: unmoeglicher Kalendertag darf nicht zum 2. Maerz normalisiert
    // werden und so eine Periodenkompatibilitaet vortaeuschen.
    { name: 'V1.0.70 EBITDA 2025-02-30 gegen net_debt 2025-03-02', expect: 'blocked',
      reason: /Periodenende des EBITDA[^\n]*2025-02-30[^\n]*kein gueltiges Kalenderdatum/,
      mj: mk('BRI', { net_debt: [900] }, {
        ebitda: { periods: ['2025-02-30'], isFlowConcept: true, unit: 'USD' },
        net_debt: Object.assign(dated('2025-03-02'), { source_type: 'reported' }) }) },
    { name: 'Gegenprobe V1.0.70: gueltiger Schalttag 2024-02-29', expect: '16.00',
      mj: mk('BRJ', { net_debt: [900] }, {
        ebitda: { periods: ['2024-02-29'], isFlowConcept: true, unit: 'USD' },
        net_debt: Object.assign(dated('2024-02-29'), { source_type: 'reported' }) }) },
    { name: 'Gegenprobe: net_debt korrekt datiert', expect: '16.00',
      mj: mk('BRG', { net_debt: [900] }, {
        ebitda: { periods: [D25], isFlowConcept: true, unit: 'USD' },
        net_debt: Object.assign(dated(D25), { source_type: 'reported' }) }) },
    { name: 'Gegenprobe: metadatenfreie Altdaten (bestehende Regel)', expect: '16.00',
      mj: mk('BRH', { net_debt: [900] }, null) }
  ];
}

// Multiple hinterlegt, Berechnungsgrundlage fehlt (wie R51).
export function multiplesMissingInputCases() {
  return [
    { name: 'EV/EBITDA ohne ebitda[0]', multipleShown: '10.0x', missing: ['ebitda[0]'],
      mj: small('MXA', { shares_diluted: [100], net_debt: [0] }, { ev_ebitda_10y: 10 }) },
    { name: 'P/E ohne eps_diluted[0]', multipleShown: '15.0x', missing: ['eps_diluted[0]'],
      mj: small('MXB', { shares_diluted: [100] }, { pe_10y: 15 }) },
    { name: 'P/FCF ohne fcf[0]', multipleShown: '20.0x', missing: ['fcf[0]'],
      mj: small('MXC', { shares_diluted: [100] }, { p_fcf_10y: 20 }) }
  ];
}
export function noMultiplesMj() { return small('MXN', { shares_diluted: [100], total_debt: [0], cash: [0] }, {}); }

// Nichtpositiver Aktienwert: EV 2500 − Nettoschulden 3000 ⇒ −5,00 USD.
export function nonPositiveMj() {
  return small('NPV', { ebitda: [250], shares_diluted: [100], total_debt: [3000], cash: [0] }, { ev_ebitda_10y: 10 });
}

// DDM-Datensaetze wie R50 (Engine-Teil).
const Y = (...ys) => ys.map(y => (y == null ? null : y + '-12-31'));
const ddmMj = (ticker, dps, periods) => ({
  schema_version: '4.0',
  meta: META(ticker, 'dividend_aristocrat'),
  fundamentals: {
    revenue: [1000, 1000, 1000, 1000, 1000, 1000, 1000],
    ebit: [200, 200, 200, 200, 200, 200, 200],
    ebitda: [250, 250, 250, 250, 250, 250, 250],
    capex: [50, 50, 50, 50, 50, 50, 50],
    fcf: [150, 150, 150, 150, 150, 150, 150],
    eps_diluted: [2, 2, 2, 2, 2, 2, 2],
    book_value: [1000, 1000, 1000, 1000, 1000, 1000, 1000],
    net_debt: [0], dps,
    shares_diluted: [100, 100, 100, 100, 100, 100, 100],
    _v4_meta: { dps: { periods } }
  },
  valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false }, wacc_derived: 10,
    cost_of_equity_derived: 10, growth_terminal: 2, growth_stage1: 5 },
  market: { price: 20 }
});
export function ddmUndatedZeroMj() {
  return ddmMj('DDMA', [1.12, 1.10, 0, 1.06, 1.04, 1.02, 1.00], Y(2026, 2025, null, 2023, 2022, 2021, 2020));
}
export function ddmNoHistoryMj() {
  return ddmMj('DDMB', [1.12, 0, 1.10, 0, 1.08, 0, 1.06, 0, 1.04], Y(2026, null, 2024, null, 2022, null, 2020, null, 2018));
}

// Financials wie R43: P/TBV-Gordon und Excess Return sind algebraisch identisch.
export function financialsMj() {
  return {
    schema_version: '4.0',
    meta: META('FINX', 'financial'),
    fundamentals: {
      revenue: [1000, 1000, 1000, 1000, 1000], ebit: [200, 200, 200, 200, 200],
      net_income: [130, 130, 130, 130, 130], book_value: [1000, 1000, 1000, 1000, 1000],
      tangible_book_value: [1000, 1000, 1000, 1000, 1000], eps_diluted: [1.3, 1.3, 1.3, 1.3, 1.3],
      shares_diluted: [100, 100, 100, 100, 100]
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false }, wacc_derived: 10,
      cost_of_equity_derived: 10, growth_terminal: 2, growth_stage1: 5 },
    market: { price: 14 }
  };
}

// ── Snapshot-ID-Angriffe: nur harmlose lokale Marker ─────────────────────
// Die Funktionen werden als Quelltext in die Seite gegeben (sie brauchen
// SNAPSHOT_EXPORT_KIND aus der Seite). Ein erfolgreicher Angriff wuerde
// lediglich `window.__pwned` bzw. `window.__accMarker` setzen.
const ATTACK_IDS = [
  '"><img src=x onerror="window.__pwned=1">',
  "x'); window.__accMarker=1; //",
  'x" onmouseover="window.__accMarker=1'
];
const rec = (id, ticker) => ({ id, ticker, name: 'Angriff', timestamp: '2026-01-02T03:04:05.000Z',
  masterJson: { meta: { ticker }, fundamentals: {} }, _snapshotFormat: 2 });
export const attackBundleJs = `function () { return { _kind: SNAPSHOT_EXPORT_KIND, _snapshotFormat: 2, snapshots: ${JSON.stringify(ATTACK_IDS.map((id, i) => rec(id, 'ATK' + i)))} }; }`;
export const attackRecordsJs = `function () { return ${JSON.stringify([rec('ok123', 'ATK'), rec(ATTACK_IDS[0], 'ATK')])}; }`;
