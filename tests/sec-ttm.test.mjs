// ═══════════════════════════════════════════════════════════════════════════
// TTM-Datenbasis — Tests zum DATENBASIS-BLOCK der Anwendung
// ───────────────────────────────────────────────────────────────────────────
// Geprueft wird der Code, der auch ausgeliefert wird: src/sec-ttm.js schneidet
// den markierten Block aus der HTML-Datei aus (keine Kopie der Logik).
//
// Alle Erwartungswerte sind unabhaengig von Hand gerechnet und stehen im
// jeweiligen Test. Ausschliesslich synthetische Facts.
// ═══════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ttmMod = require(join(HERE, '..', 'src', 'sec-ttm.js'));
const api = ttmMod.loadDataBasisBlock({ realm: 'this' });

// ── Synthetische SEC-Facts ────────────────────────────────────────────────
// Kalendergeschaeftsjahr, Quartalsenden 31.03./30.06./30.09./31.12.
const QEND   = { 1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31' };
const QSTART = { 1: '-01-01', 2: '-04-01', 3: '-07-01', 4: '-10-01' };
const filedOf = (y, n) => (n === 4 ? `${+y + 1}-02-15` : `${y}-${String(n * 3 + 2).padStart(2, '0')}-01`);
const formOf  = (n) => (n === 4 ? '10-K' : '10-Q');

// Zeitraumgroesse: kumulierte Angaben (YTD bzw. Geschaeftsjahr) wie in echten
// Filings. Einzelquartale entstehen daraus in der Normalisierung.
function flowFacts(tag, perYear, through, skip) {
  const units = { USD: [] };
  for (const y of Object.keys(perYear)) {
    let cum = 0;
    for (let n = 1; n <= (through[y] ?? 4); n++) {
      cum += perYear[y][n - 1];
      if (skip && skip.some(s => s.year === y && s.through === n)) continue;
      units.USD.push({ start: `${y}-01-01`, end: `${y}${QEND[n]}`, val: cum,
        form: formOf(n), filed: filedOf(y, n), accn: `${tag}-${y}-${n}` });
    }
  }
  return { units };
}
// Stichtagsgroesse: genau ein Wert je Bilanzstichtag, kein `start`.
function instantFacts(tag, perYear, through) {
  const units = { USD: [] };
  for (const y of Object.keys(perYear)) {
    for (let n = 1; n <= (through[y] ?? 4); n++) {
      units.USD.push({ end: `${y}${QEND[n]}`, val: perYear[y][n - 1],
        form: formOf(n), filed: filedOf(y, n), accn: `${tag}-${y}-${n}` });
    }
  }
  return { units };
}
// Gewichtete Quartalsaktienzahl: Zeitraumangabe ueber genau ein Quartal.
function shareFacts(tag, perYear, through) {
  const units = { shares: [] };
  for (const y of Object.keys(perYear)) {
    for (let n = 1; n <= (through[y] ?? 4); n++) {
      units.shares.push({ start: `${y}${QSTART[n]}`, end: `${y}${QEND[n]}`, val: perYear[y][n - 1],
        form: formOf(n), filed: filedOf(y, n), accn: `${tag}-${y}-${n}` });
    }
  }
  return { units };
}

const THROUGH = { '2022': 4, '2023': 4, '2024': 4, '2025': 2 };
const REV    = { '2022': [100, 110, 120, 130], '2023': [140, 150, 160, 170], '2024': [180, 190, 200, 210], '2025': [220, 230] };
const EBIT   = { '2022': [10, 11, 12, 13],     '2023': [14, 15, 16, 17],     '2024': [18, 19, 20, 21],     '2025': [22, 23] };
const NI     = { '2022': [8, 9, 10, 11],       '2023': [12, 13, 14, 15],     '2024': [16, 17, 18, 19],     '2025': [20, 21] };
const CFO    = { '2022': [20, 21, 22, 23],     '2023': [24, 25, 26, 27],     '2024': [28, 29, 30, 31],     '2025': [32, 33] };
const CAPEX  = { '2022': [5, 5, 5, 5],         '2023': [6, 6, 6, 6],         '2024': [7, 7, 7, 7],         '2025': [8, 8] };
const DEBT   = { '2022': [500, 500, 500, 500], '2023': [520, 520, 520, 520], '2024': [540, 540, 540, 545], '2025': [550, 560] };
const LTD    = { '2022': [400, 400, 400, 400], '2023': [410, 410, 410, 410], '2024': [420, 420, 420, 425], '2025': [430, 440] };
const CASH   = { '2022': [100, 100, 100, 100], '2023': [110, 110, 110, 110], '2024': [120, 120, 120, 125], '2025': [130, 140] };
const CA     = { '2022': [200, 200, 200, 200], '2023': [210, 210, 210, 210], '2024': [220, 220, 220, 225], '2025': [230, 240] };
const CL     = { '2022': [150, 150, 150, 150], '2023': [155, 155, 155, 155], '2024': [160, 160, 160, 165], '2025': [170, 175] };
const SHARES = { '2022': [1000, 1000, 1000, 1000], '2023': [990, 990, 990, 990], '2024': [980, 980, 980, 980], '2025': [970, 960] };

function buildFacts(opts = {}) {
  const skip = opts.skipRevenue || null;
  return {
    'us-gaap': {
      Revenues: flowFacts('rev', REV, THROUGH, skip),
      OperatingIncomeLoss: flowFacts('ebit', EBIT, THROUGH),
      NetIncomeLoss: flowFacts('ni', NI, THROUGH),
      NetCashProvidedByUsedInOperatingActivities: flowFacts('cfo', CFO, THROUGH),
      PaymentsToAcquirePropertyPlantAndEquipment: flowFacts('capex', CAPEX, THROUGH),
      LongTermDebtAndCapitalLeaseObligations: instantFacts('debt', DEBT, THROUGH),
      LongTermDebtNoncurrent: instantFacts('ltd', LTD, THROUGH),
      CashAndCashEquivalentsAtCarryingValue: instantFacts('cash', CASH, THROUGH),
      AssetsCurrent: instantFacts('ca', CA, THROUGH),
      LiabilitiesCurrent: instantFacts('cl', CL, THROUGH),
      WeightedAverageNumberOfDilutedSharesOutstanding: shareFacts('sh', SHARES, THROUGH)
    },
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
      { end: '2025-07-25', val: 955, form: '10-Q', filed: '2025-08-01' }
    ] } } }
  };
}
const payloadOf = (opts) => ttmMod.quarterlyPayloadFromFacts(buildFacts(opts), {});
const datasetOf = (opts) => api.buildTtmDataset(payloadOf(opts), {});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Beide zulaessigen Rechenwege stimmen bei vollstaendigen Daten ueberein
// ═══════════════════════════════════════════════════════════════════════════
test('beide TTM-Rechenwege liefern denselben Zeitraum und denselben Wert', () => {
  const p = payloadOf();
  const rev = p.fields.revenue;

  // Weg 1 — Summe der vier Quartale bis 30.06.2025:
  //   Q3/2024 200 + Q4/2024 210 + Q1/2025 220 + Q2/2025 230 = 860
  const vier = api.computeTtmFromQuarters(rev.quarters, {});
  assert.equal(vier.ok, true, vier.reason);
  assert.equal(vier.method, 'four_quarters');
  assert.equal(vier.value, 860);
  assert.equal(vier.start, '2024-07-01');
  assert.equal(vier.end, '2025-06-30');
  assert.equal(vier.durationDays, 365);
  assert.deepEqual(vier.quarters.map(q => q.periodKey),
    ['FY2024-Q3', 'FY2024-Q4', 'FY2025-Q1', 'FY2025-Q2']);

  // Weg 2 — FY2024 (700) + YTD2/2025 (220+230=450) − YTD2/2024 (180+190=370)
  //         = 700 + 450 − 370 = 780? Nein: FY2024 = 180+190+200+210 = 780.
  //         780 + 450 − 370 = 860.
  const bruecke = api.computeTtmFromFyYtdBridge(rev.cumulatives, {});
  assert.equal(bruecke.ok, true, bruecke.reason);
  assert.equal(bruecke.method, 'fy_plus_ytd_minus_prior_ytd');
  assert.equal(bruecke.components.fiscal_year.value, 780);
  assert.equal(bruecke.components.ytd_current.value, 450);
  assert.equal(bruecke.components.ytd_prior.value, 370);
  assert.equal(bruecke.value, 860);
  assert.equal(bruecke.start, '2024-07-01');
  assert.equal(bruecke.end, '2025-06-30');

  // Uebereinstimmung in Wert UND Zeitraum
  assert.equal(vier.value, bruecke.value);
  assert.equal(vier.start, bruecke.start);
  assert.equal(vier.end, bruecke.end);
});

test('die Gegenprobe wird je Feld ausgewiesen, nicht nur intern gerechnet', () => {
  const ds = datasetOf();
  for (const key of ['revenue', 'operating_income', 'net_income', 'cfo', 'capex']) {
    const s = ds.flows[key];
    assert.equal(s.ok, true, key + ': ' + s.reason);
    assert.equal(s.cross_check.status, 'uebereinstimmend', key);
    assert.equal(s.cross_check.deltaAbs, 0, key);
    assert.equal(s.method, 'four_quarters', key);
  }
  // Unabhaengig nachgerechnet: EBIT 20+21+22+23 = 86, CFO 30+31+32+33 = 126,
  // CapEx 7+7+8+8 = 30, Nettoergebnis 18+19+20+21 = 78.
  assert.equal(ds.flows.operating_income.values[0], 86);
  assert.equal(ds.flows.cfo.values[0], 126);
  assert.equal(ds.flows.capex.values[0], 30);
  assert.equal(ds.flows.net_income.values[0], 78);
});

test('widersprechen sich beide Wege, entsteht kein TTM-Wert', () => {
  const p = payloadOf();
  const rev = p.fields.revenue;
  // Ein gemeldetes Quartal wird nachtraeglich verfaelscht: die Summe der vier
  // Quartale passt dann nicht mehr zur Bruecke aus den Kumulierungen.
  const quarters = rev.quarters.map(q => q.periodKey === 'FY2025-Q2'
    ? Object.assign({}, q, { value: q.value + 5 }) : q);
  const s = api.buildTtmFlowSeries('revenue', { quarters, cumulatives: rev.cumulatives }, ['2025-06-30', '2024-06-30']);
  assert.equal(s.ok, false);
  assert.match(s.reason, /widersprechen sich/);
  assert.equal(s.cross_check.status, 'abweichend');
  assert.equal(s.values.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Fehlendes Quartal wird erkannt
// ═══════════════════════════════════════════════════════════════════════════
test('fehlt ein Quartal im Fenster, entsteht kein TTM-Wert', () => {
  const p = payloadOf();
  const ohneQ4 = p.fields.revenue.quarters.filter(q => q.periodKey !== 'FY2024-Q4');
  const r = api.computeTtmFromQuarters(ohneQ4, {});
  assert.equal(r.ok, false);
  assert.match(r.reason, /Quartalsreihe bricht vor FY2025-Q1 ab/);
  assert.equal(r.missingBefore, 'FY2025-Q1');
  assert.deepEqual(r.have, ['FY2025-Q2', 'FY2025-Q1']);
  assert.equal(r.value, undefined);
});

test('ein fehlendes Quartal in den Rohdaten sperrt die TTM-Datenbasis sichtbar', () => {
  // Ohne die Kumulierung YTD2/2024 lassen sich Q2/2024 und Q3/2024 nicht
  // ableiten — das juengste Fenster ist damit nicht vollstaendig belegt.
  const ds = datasetOf({ skipRevenue: [{ year: '2024', through: 2 }] });
  // Die Luecke faellt in das juengste Fenster (Q2/2024 und Q3/2024 sind nicht
  // ableitbar). Es entsteht deshalb gar kein Fenster — und kein ersatzweise
  // aelteres, das einen anderen Zeitraum abbilden wuerde.
  assert.equal(ds.window_count, 0);
  assert.equal(ds.ok, false);
  assert.equal(ds.complete, false);
  assert.ok(ds.reasons.some(r => /kein vollstaendiges TTM-Fenster/.test(r)), ds.reasons.join(' | '));
  assert.ok(ds.reasons.some(r => /bricht vor FY2024-Q4 ab/.test(r)), ds.reasons.join(' | '));

  const mj = { valuation: { data_basis: 'ttm' }, fundamentals: { _ttm: ds } };
  const res = api.resolveDataBasis(mj);
  assert.equal(res.requested, 'ttm');
  assert.equal(res.basis, 'fy', 'sichtbarer Rueckfall statt stiller Vermischung');
  assert.equal(res.fallback, true);
  assert.ok(res.reasons.length > 0);
});

test('ueberlappende oder nicht anschliessende Quartale ergeben kein Fenster', () => {
  const q = (key, fy, fq, start, end, value) => ({ periodKey: key, start, end, value, basis: 'reported',
    fiscalYear: fy, fiscalQuarter: fq, source: { filed: '2025-05-01', form: '10-Q' } });
  // Vier Quartale, aber zwischen dem zweiten und dritten klafft ein Tag.
  const luecke = [
    q('A', 2024, 3, '2024-07-01', '2024-09-30', 1), q('B', 2024, 4, '2024-10-01', '2024-12-31', 1),
    q('C', 2025, 1, '2025-01-02', '2025-03-31', 1), q('D', 2025, 2, '2025-04-01', '2025-06-30', 1)
  ];
  const r = api.computeTtmFromQuarters(luecke, {});
  assert.equal(r.ok, false);
  assert.match(r.reason, /bricht vor C ab/);
});

test('ein Quartal mit offenem Widerspruch zaehlt nicht als vollstaendig', () => {
  const p = payloadOf();
  const quarters = p.fields.revenue.quarters.map(x => x.periodKey === 'FY2025-Q1'
    ? Object.assign({}, x, { conflict: { reason: 'gemeldet weicht von der Differenz ab' } }) : x);
  const r = api.computeTtmFromQuarters(quarters, {});
  assert.equal(r.ok, false);
  assert.ok(r.rejected.some(x => x.periodKey === 'FY2025-Q1' && /Widerspruch/.test(x.reason)));
});

test('der zweite Rechenweg prueft seine Voraussetzungen einzeln', () => {
  const p = payloadOf();
  const cum = p.fields.revenue.cumulatives;
  // ohne das letzte vollstaendige Geschaeftsjahr
  const ohneFy = cum.filter(c => !(c.fiscalYear === 2024 && c.throughQuarter === 4));
  assert.match(api.computeTtmFromFyYtdBridge(ohneFy, {}).reason, /FY2024\) fehlt/);
  // ohne vergleichbares Vorjahres-YTD
  const ohnePrior = cum.filter(c => !(c.fiscalYear === 2024 && c.throughQuarter === 2));
  assert.match(api.computeTtmFromFyYtdBridge(ohnePrior, {}).reason, /Vorjahres-YTD \(FY2024-YTD2\) fehlt/);
  // Vorjahres-YTD mit abweichendem Kumulierungsbeginn
  const verschoben = cum.map(c => (c.fiscalYear === 2024 && c.throughQuarter === 2)
    ? Object.assign({}, c, { start: '2024-01-08' }) : c);
  assert.match(api.computeTtmFromFyYtdBridge(verschoben, {}).reason, /beginnt nicht zum Geschaeftsjahr/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Stichtagsdaten bleiben unveraendert
// ═══════════════════════════════════════════════════════════════════════════
test('Bilanzwerte werden vom passenden Stichtag uebernommen, nicht summiert', () => {
  const ds = datasetOf();
  const td = ds.instants.total_debt;
  assert.equal(td.ok, true, td.reason);
  // Unveraendert wie gemeldet: 30.06.2025 = 560, 30.06.2024 = 540, 30.06.2023 = 520.
  assert.deepEqual(td.values, [560, 540, 520]);
  assert.deepEqual(td.dates, ['2025-06-30', '2024-06-30', '2023-06-30']);
  assert.equal(td.method, 'balance_sheet_as_of_window_end');
  // Eine Summe der vier Stichtage waere 545+550+560+540 = 2195 — sie entsteht nicht.
  assert.notEqual(td.values[0], 2195);
  assert.deepEqual(ds.instants.cash_and_equivalents.values, [140, 120, 110]);
  assert.deepEqual(ds.instants.current_assets.values, [240, 220, 210]);
  assert.deepEqual(ds.instants.current_liabilities.values, [175, 160, 155]);
  assert.deepEqual(ds.instants.long_term_debt.values, [440, 420, 410]);
});

test('ohne Stichtag am Fensterende entsteht kein Bilanzwert', () => {
  const instants = [
    { date: '2025-03-31', value: 500, periodKey: 'FY2025-Q1', source: { filed: '2025-05-01' } },
    { date: '2024-12-31', value: 480, periodKey: 'FY2024-Q4', source: { filed: '2025-02-15' } }
  ];
  const treffer = api.selectBalanceAsOf(instants, '2025-03-31', {});
  assert.equal(treffer.ok, true);
  assert.equal(treffer.value, 500);
  assert.equal(treffer.exact, true);
  assert.equal(treffer.lagDays, 0);

  const daneben = api.selectBalanceAsOf(instants, '2025-06-30', {});
  assert.equal(daneben.ok, false);
  assert.equal(daneben.lagDays, 91);
  assert.match(daneben.reason, /91 Tage vor dem Fensterende/);

  // Ein spaeterer Stichtag wird nicht vorgezogen.
  const zuFrueh = api.selectBalanceAsOf(instants, '2024-06-30', {});
  assert.equal(zuFrueh.ok, false);
  assert.match(zuFrueh.reason, /kein Bilanzstichtag am oder vor dem 2024-06-30/);
});

test('der Bilanzwert zum Geschaeftsjahresende bleibt auf beiden Datenbasen derselbe', () => {
  // Fenster bis 31.12.2024 = Geschaeftsjahresende: der Stichtagswert ist
  // identisch mit dem Jahresabschlusswert (545), nicht neu gerechnet.
  const p = payloadOf();
  const sel = api.selectBalanceAsOf(p.fields.total_debt.instants, '2024-12-31', {});
  assert.equal(sel.ok, true);
  assert.equal(sel.value, 545);
  assert.equal(sel.date, '2024-12-31');
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Aktienzahlen und EPS gesondert
// ═══════════════════════════════════════════════════════════════════════════
test('gewichtete Aktienzahl wird gemittelt, nicht addiert', () => {
  const ds = datasetOf();
  assert.equal(ds.shares.ok, true, ds.shares.reason);
  assert.equal(ds.shares.method, 'day_weighted_mean_of_quarterly_weighted_average');
  // Fenster 01.07.2024–30.06.2025: Q3/24 92 Tage × 980, Q4/24 92 × 980,
  // Q1/25 90 × 970, Q2/25 91 × 960 → 354980 / 365 = 972,5479452054794
  const erwartet = (92 * 980 + 92 * 980 + 90 * 970 + 91 * 960) / 365;
  assert.equal(ds.shares.values[0], erwartet);
  assert.ok(Math.abs(ds.shares.values[0] - 972.5479452054794) < 1e-9);
  // Eine Summe waere 3890 — sie entsteht nicht.
  assert.notEqual(ds.shares.values[0], 3890);
  // Aktuelle Aktienzahl bleibt getrennt.
  assert.equal(ds.shares.current.value, 955);
  assert.equal(ds.shares.current.as_of, '2025-07-25');
});

test('EPS entsteht aus TTM-Ergebnis je TTM-Aktienzahl, nicht aus der Summe der Quartals-EPS', () => {
  const ds = datasetOf();
  assert.equal(ds.eps.ok, true, ds.eps.reason);
  assert.equal(ds.eps.method, 'ttm_net_income_div_ttm_weighted_shares');
  const erwartet = 78 / ((92 * 980 + 92 * 980 + 90 * 970 + 91 * 960) / 365);
  assert.equal(ds.eps.values[0], erwartet);

  // Gegenprobe mit gemeldeten Quartals-EPS: sie wird ausgewiesen, aber nicht verwendet.
  const p = payloadOf();
  p.shares.eps_diluted_quarters = {
    '2024-09-30': 18 / 980, '2024-12-31': 19 / 980, '2025-03-31': 20 / 970, '2025-06-30': 21 / 960
  };
  const ds2 = api.buildTtmDataset(p, {});
  assert.equal(ds2.eps.cross_check.used, false);
  assert.ok(ds2.eps.cross_check.sum_of_quarterly_eps > 0);
  assert.notEqual(ds2.eps.values[0], ds2.eps.cross_check.sum_of_quarterly_eps);
  assert.equal(ds2.eps.values[0], erwartet, 'der verwendete Wert bleibt unveraendert');
});

test('ohne Quartalsaktienzahlen bleibt die TTM-Basis unvollstaendig', () => {
  const p = payloadOf();
  p.shares.weighted_diluted_quarters = [];
  const ds = api.buildTtmDataset(p, {});
  assert.equal(ds.shares.ok, false);
  assert.equal(ds.eps.ok, false);
  assert.equal(ds.complete, false);
  assert.ok(ds.missing.some(m => m.app_field === 'shares_diluted'));

  // Ein gebildeter, aber unvollstaendiger Datensatz reicht NICHT zum
  // Umschalten: die Fenster stehen (ds.ok), die Aktienbasis fehlt.
  assert.equal(ds.ok, true, 'die Zeitraumreihen selbst sind gebildet');
  const res = api.resolveDataBasis({ valuation: { data_basis: 'ttm' }, fundamentals: { _ttm: ds } });
  assert.equal(res.basis, 'fy');
  assert.equal(res.available, false);
  assert.equal(res.fallback, true);
  assert.ok(res.reasons.some(r => /shares_diluted/.test(r)), res.reasons.join(' | '));
});

test('ein fehlender Bilanzstichtag allein verhindert die Umstellung', () => {
  const p = payloadOf();
  // Nur die Liquiditaet fehlt zum juengsten Fensterende.
  p.fields.cash_and_equivalents.instants =
    p.fields.cash_and_equivalents.instants.filter(x => x.date !== '2025-06-30');
  const ds = api.buildTtmDataset(p, {});
  assert.equal(ds.ok, true);
  assert.equal(ds.complete, false);
  assert.equal(ds.flows.revenue.ok, true, 'die Zeitraumgroessen bleiben unberuehrt');
  assert.ok(ds.missing.some(m => m.app_field === 'cash_and_equivalents'));
  const res = api.resolveDataBasis({ valuation: { data_basis: 'ttm' }, fundamentals: { _ttm: ds } });
  assert.equal(res.basis, 'fy');
  assert.equal(res.fallback, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// 5./6./7./8. Datenbasis: Auswahl, Ausweis, Rueckfall, Modellsperre
// ═══════════════════════════════════════════════════════════════════════════
const mjWith = (ds, basis) => ({
  meta: { as_of_date: '2025-08-10', data_cutoff_date: '2025-08-10', source_primary: 'SEC_EDGAR' },
  valuation: { data_basis: basis },
  market: { price: 50, shares_outstanding_derived: 955 },
  fundamentals: {
    _ttm: ds,
    _v4_meta: { revenue: { periods: ['2024-12-31', '2023-12-31'], period_type: 'FY' },
                shares_diluted: { source_reference: 'SEC 10-K' } },
    revenue: [780, 620], ebit: [86, 62], net_income: [70, 54],
    cfo: [118, 102], capex: [28, 24], ebitda: [120, 100],
    shares_diluted: [980, 990], eps_diluted: [0.0714, 0.0545],
    book_value: [300, 280], dps: [1, 1],
    total_debt: [545, 520], cash_and_equivalents: [125, 110],
    current_assets: [225, 210], current_liabilities: [165, 155],
    derived: { fcf: { formula: 'cfo - capex', override_series: [999, 999] } }
  }
});

test('vollstaendige TTM-Daten schalten die Datenbasis um, FY bleibt Vorgabe', () => {
  const ds = datasetOf();
  assert.equal(ds.complete, true, ds.reasons.join(' | '));

  const ohneAuswahl = api.resolveDataBasis(mjWith(ds, undefined));
  assert.equal(ohneAuswahl.requested, 'fy');
  assert.equal(ohneAuswahl.basis, 'fy');
  assert.equal(ohneAuswahl.available, true, 'TTM waere verfuegbar, wird aber nicht ungefragt verwendet');
  assert.equal(ohneAuswahl.fallback, false);

  const mitTtm = api.resolveDataBasis(mjWith(ds, 'ttm'));
  assert.equal(mitTtm.basis, 'ttm');
  assert.equal(mitTtm.fallback, false);

  const unsinn = api.resolveDataBasis(mjWith(ds, 'quartal'));
  assert.equal(unsinn.basis, 'fy');
  assert.ok(unsinn.reasons.some(r => /Unbekannte Datenbasis/.test(r)));
});

test('die TTM-Sicht traegt nur TTM-Fenster; ungedeckte Reihen bleiben leer', () => {
  const ds = datasetOf();
  const mj = mjWith(ds, 'ttm');
  const res = api.resolveDataBasis(mj);
  const view = api.buildValuationBasisView(mj, res);
  assert.notEqual(view, mj, 'die Sicht ist eine Kopie');

  // Gedeckte Felder: TTM-Werte, unabhaengig nachgerechnet.
  assert.deepEqual(view.fundamentals.revenue, [860, 700, 540]);
  assert.deepEqual(view.fundamentals.ebit, [86, 70, 54]);
  assert.deepEqual(view.fundamentals.capex, [30, 26, 22]);
  assert.deepEqual(view.fundamentals.total_debt, [560, 540, 520]);
  // Abgeleitet mit derselben Formel: cfo − capex = 126−30, 110−26, 94−22
  assert.deepEqual(view.fundamentals.fcf, [96, 84, 72]);
  // net_debt = total_debt − cash
  assert.deepEqual(view.fundamentals.net_debt, [420, 420, 410]);
  // Ungedeckt: wird geleert, NICHT mit dem Jahreswert gefuellt.
  assert.deepEqual(view.fundamentals.ebitda, []);
  assert.deepEqual(view.fundamentals.book_value, []);
  assert.deepEqual(view.fundamentals.dps, []);
  assert.equal(view.fundamentals._v4_meta.ebitda.source_type, 'unavailable');
  // Jahres-Ersatzreihe greift in der TTM-Sicht nicht.
  assert.equal(view.fundamentals.derived.fcf.override_series, null);
  // Periodenangaben je Feld
  assert.deepEqual(view.fundamentals._v4_meta.revenue.periods, ['2025-06-30', '2024-06-30', '2023-06-30']);
  assert.equal(view.fundamentals._v4_meta.revenue.period_type, 'TTM');
  assert.deepEqual(view.fundamentals._v4_meta.total_debt.periods, ['2025-06-30', '2024-06-30', '2023-06-30']);

  // Das uebergebene Master-JSON bleibt unveraendert — die Jahresreihen
  // tragen weiterhin die Qualitaetsdiagnostik.
  assert.deepEqual(mj.fundamentals.revenue, [780, 620]);
  assert.deepEqual(mj.fundamentals.ebitda, [120, 100]);
  assert.deepEqual(mj.fundamentals.book_value, [300, 280]);
  assert.deepEqual(mj.fundamentals.derived.fcf.override_series, [999, 999]);
});

test('bei FY-Auswahl bleibt das Master-JSON unveraendert dasselbe Objekt', () => {
  const ds = datasetOf();
  const mj = mjWith(ds, 'fy');
  const res = api.resolveDataBasis(mj);
  const view = api.buildValuationBasisView(mj, res);
  assert.equal(view, mj, 'FY-Auswahl erzeugt keine abweichende Sicht');
  assert.deepEqual(mj.fundamentals.revenue, [780, 620]);
});

test('Modelle ohne TTM-Deckung werden gesperrt statt aufgefuellt', () => {
  const ds = datasetOf();
  const res = api.resolveDataBasis(mjWith(ds, 'ttm'));
  // Gedeckt: revenue, ebit, net_income, cfo, capex, Bilanzposten, shares, eps
  assert.equal(res.blockedModels.dcf, undefined);
  assert.equal(res.blockedModels.dcf_midcycle, undefined);
  assert.equal(res.blockedModels.epv_floor, undefined);
  // Nicht gedeckt: book_value, tangible_book_value, dps
  assert.match(res.blockedModels.rim, /book_value/);
  assert.match(res.blockedModels.ddm, /dps/);
  assert.match(res.blockedModels.p_tbv_gordon, /tangible_book_value/);
  assert.match(res.blockedModels.excess_return, /book_value/);
  // Auf FY-Basis gibt es keine Sperre aus der Datenbasis.
  const fy = api.resolveDataBasis(mjWith(ds, 'fy'));
  assert.deepEqual(fy.blockedModels, {});
});

test('der Ausweis nennt Zeitraum, Veroeffentlichungsstand, Aktienbasis und Warnungen', () => {
  const ds = datasetOf();
  const mj = mjWith(ds, 'ttm');
  const rep = api.buildDataBasisReport(mj, api.resolveDataBasis(mj));
  assert.equal(rep.selected, 'ttm');
  assert.equal(rep.label, 'TTM (letzte vier Quartale)');
  assert.equal(rep.period.type, 'TTM');
  assert.equal(rep.period.start, '2024-07-01');
  assert.equal(rep.period.end, '2025-06-30');
  assert.equal(rep.period.duration_days, 365);
  assert.equal(rep.period.window_count, 3);
  assert.deepEqual(rep.period.quarters, ['FY2024-Q3', 'FY2024-Q4', 'FY2025-Q1', 'FY2025-Q2']);
  // Veroeffentlichungsstand: spaetestes Filing der verwendeten Angaben
  assert.equal(rep.publication.latest_filed, '2025-08-01');
  assert.equal(rep.publication.source_primary, 'SEC_EDGAR');
  // Aktienbasis: Durchschnitt und aktueller Stand getrennt
  assert.ok(Math.abs(rep.share_basis.weighted_average_ttm - 972.5479452054794) < 1e-9);
  assert.equal(rep.share_basis.current_shares, 955);
  assert.equal(rep.share_basis.current_shares_as_of, '2025-07-25');
  assert.equal(rep.share_basis.weighted_average_method, 'day_weighted_mean_of_quarterly_weighted_average');
  assert.equal(rep.fallback.active, false);
  assert.ok(rep.blocked_models.length >= 4);

  // FY-Ausweis nennt die Jahresperiode und keine TTM-Angaben
  const repFy = api.buildDataBasisReport(mjWith(ds, 'fy'), api.resolveDataBasis(mjWith(ds, 'fy')));
  assert.equal(repFy.selected, 'fy');
  assert.equal(repFy.period.end, '2024-12-31');
  assert.equal(repFy.period.type, 'FY');
  assert.equal(repFy.share_basis.weighted_average_fy, 980);
  assert.equal(repFy.share_basis.current_shares, 955);
  assert.equal(repFy.fallback.active, false);
});

test('der Rueckfall auf das Geschaeftsjahr wird im Ausweis benannt', () => {
  const ds = datasetOf({ skipRevenue: [{ year: '2024', through: 2 }] });
  const mj = mjWith(ds, 'ttm');
  const rep = api.buildDataBasisReport(mj, api.resolveDataBasis(mj));
  assert.equal(rep.selected, 'fy');
  assert.equal(rep.fallback.active, true);
  assert.ok(rep.fallback.reasons.length > 0);
  assert.ok(rep.warnings.some(w => /Angefordert war die TTM-Datenbasis/.test(w)));
  assert.equal(rep.period.type, 'FY');
});

test('abweichende Masseinheit verhindert die Umstellung — ohne Umrechnung', () => {
  const ds = api.buildTtmDataset(payloadOf(), { reportingUnit: 'units' });
  assert.equal(ds.complete, true);
  assert.equal(ds.reporting_unit, 'units');
  const mj = mjWith(ds, 'ttm');
  mj.meta.reporting_unit = 'millions';
  const res = api.resolveDataBasis(mj);
  assert.equal(res.basis, 'fy');
  assert.equal(res.available, false);
  assert.ok(res.reasons.some(r => /Masseinheit/.test(r)), res.reasons.join(' | '));
  // Passt die Einheit, wird umgestellt — derselbe Datensatz.
  mj.meta.reporting_unit = 'units';
  assert.equal(api.resolveDataBasis(mj).basis, 'ttm');
  // Fehlende Angabe auf einer Seite ist ebenfalls kein Freibrief.
  const ohne = mjWith(api.buildTtmDataset(payloadOf(), {}), 'ttm');
  ohne.meta.reporting_unit = 'millions';
  assert.equal(api.resolveDataBasis(ohne).basis, 'fy');
});

test('ohne TTM-Datensatz bleibt alles auf Jahresbasis und wird begruendet', () => {
  const mj = mjWith(undefined, 'ttm');
  delete mj.fundamentals._ttm;
  const res = api.resolveDataBasis(mj);
  assert.equal(res.basis, 'fy');
  assert.equal(res.available, false);
  assert.ok(res.reasons.some(r => /fundamentals\._ttm fehlt/.test(r)));
  assert.equal(api.buildValuationBasisView(mj, res), mj);
});

// ═══════════════════════════════════════════════════════════════════════════
// Modulgrenze: der Block bleibt frei von Oberflaeche und globalem Zustand
// ═══════════════════════════════════════════════════════════════════════════
test('der DATENBASIS-BLOCK laeuft in einer leeren Sandbox', () => {
  const isoliert = ttmMod.loadDataBasisBlock({});   // eigener vm-Kontext, kein document/window
  const ds = isoliert.buildTtmDataset(payloadOf(), {});
  assert.equal(ds.complete, true);
  assert.equal(ds.flows.revenue.values[0], 860);
  assert.equal(isoliert.DATA_BASIS_REQUIRED_HELPERS.length, 0);
});

test('der Block enthaelt keinen Zugriff auf Oberflaeche, Speicher oder Zufall', () => {
  const src = ttmMod.extractBasisBlock().source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(l => { const i = l.indexOf('//'); return i < 0 ? l : l.slice(0, i); }).join('\n');
  for (const verboten of [/\bdocument\s*\./, /\blocalStorage\b/, /\bwindow\s*\./, /\bstate\s*\./,
                          /\bMath\.random\b/, /\bnew Date\s*\(\s*\)/, /\bfetch\s*\(/, /\balert\s*\(/]) {
    assert.equal(verboten.test(src), false, 'verbotener Zugriff: ' + verboten);
  }
});
