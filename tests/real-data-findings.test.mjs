// ─────────────────────────────────────────────────────────────────────────────
// Regressionstests zu den bestaetigten Befunden des Realdaten-Audits MCD/JNJ
// (AUDIT-REAL-DATA-MCD-JNJ.md, Korrekturchat D2).
//
// Jeder Test verlangt das FACHLICH RICHTIGE Ergebnis. Am Stand vor D2
// (Branch-Spitze 2f1058d) schlagen die Befundtests fehl; danach bestehen sie.
// Grundlage sind die wortgetreuen SEC-Auszuege in tests/real-data/excerpts/
// (Quelle, Abrufzeit und SHA-256 der Rohdatei jeweils in `_meta`) und die
// produktiven Funktionen der ausgelieferten HTML-Datei (tests/audit-chat12.mjs).
// Synthetische Faelle decken die Grenz- und Gegenfaelle ab.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, evalInApp } from './audit-chat12.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const excerpt = (n) => JSON.parse(readFileSync(join(HERE, 'real-data', 'excerpts', n), 'utf8'));
const S = app();
const TAGS = evalInApp('SEC_TAG_MAP');
const JNJ = excerpt('jnj-d2-regression.json').facts;
const MCD = excerpt('mcd-d2-regression.json').facts;
const M = 1e6;
const ex = (facts, field, opts) => S._extractWithFallback(facts, TAGS[field], 10, opts || {});
const plain = (x) => JSON.parse(JSON.stringify(x));   // vm-Realm → Test-Realm

// Synthetische Company-Facts. e: { start?, end, val, form?, filed, accn, fy?, fp? }
const factsOf = (map, unit = 'USD') => {
  const out = { 'us-gaap': {} };
  for (const [tag, entries] of Object.entries(map)) out['us-gaap'][tag] = { units: { [unit]: entries } };
  return out;
};
const k10 = (start, end, valM, filed, accn, fy, extra = {}) =>
  Object.assign({ start, end, val: valM * M, form: '10-K', filed, accn, fy, fp: 'FY' }, extra);

// ═════════════════════════════════════════════════════════════════════════════
// F-2 · Geschaeftsjahreszuordnung (52/53-Wochen-Jahre)
// ═════════════════════════════════════════════════════════════════════════════
test('F-2 JNJ: FY2022 (Ende 2023-01-01) bleibt als eigenes Geschaeftsjahr erhalten', () => {
  const r = ex(JNJ, 'revenue');
  const meta = plain(r.meta);
  // 10-K-Fakten FY2016…FY2025, je Geschaeftsjahr genau ein Wert.
  assert.deepEqual(meta.periods, ['2025-12-28', '2024-12-29', '2023-12-31', '2023-01-01', '2022-01-02',
                                  '2021-01-03', '2019-12-29', '2018-12-30', '2017-12-31', '2017-01-01']);
  assert.deepEqual(meta.fiscalYears, [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
  // FY2022 und FY2021 in der zuletzt veroeffentlichten (berichtigten) Fassung:
  // 10-K FY2023/FY2024 ohne Kenvue — 79,990 bzw. 78,740 (Mio. USD).
  assert.equal(r.values[3], 79990);
  assert.equal(r.values[4], 78740);
  assert.equal(meta.gapDetected, undefined, 'keine Schein-Luecke zwischen 2021-01-03 und 2019-12-29');
  // Die urspruengliche Angabe bleibt nachvollziehbar.
  const sup = meta.supersededValues.find(s => s.period === '2023-01-01');
  assert.equal(sup.value, 94943e6);
  assert.equal(sup.accn, '0000200406-23-000016');
  // Gegenpruefung mit DocumentFiscalYearFocus der Hauptperioden: einheitlich.
  assert.equal(meta.fiscalYearCheck.status, 'consistent');
  assert.equal(meta.fiscalYearCheck.offset, 0);
});

test('F-2 JNJ: Stichtagswerte beider Jahresenden im Kalenderjahr 2023 bleiben getrennt', () => {
  const r = ex(JNJ, 'cash_and_equivalents');
  const p = plain(r.meta.periods);
  const i22 = p.indexOf('2023-01-01'), i23 = p.indexOf('2023-12-31');
  assert.ok(i22 > 0 && i23 >= 0, 'beide Bilanzstichtage vorhanden: ' + p.join(', '));
  assert.equal(r.values[i22], 12889);    // Bilanz 10-K FY2022
  assert.equal(r.values[i23], 21859);    // Bilanz 10-K FY2023
});

test('F-2 JNJ: davon abhaengige Historien nutzen dieselben Geschaeftsjahre (DPS, EBITDA-Verknuepfung)', () => {
  const dps = ex(JNJ, 'dps');
  const da  = ex(JNJ, 'da');
  const f = { dps: dps.values, _v4_meta: { dps: dps.meta } };
  const obs = S._ddmDpsObservations(f);
  assert.equal(obs.ok, true);
  assert.deepEqual(plain(obs.observations.map(o => o.year)), [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
  assert.equal(obs.observations[3].value, 4.45);   // FY2022: 1.06 + 3 × 1.13

  // EBIT synthetisch auf JNJs tatsaechlichen Perioden → EBITDA je Geschaeftsjahr.
  const periods = plain(da.meta.periods), starts = plain(da.meta.starts);
  const ebitFacts = factsOf({ OperatingIncomeLoss: periods.map((end, i) =>
    k10(starts[i], end, 1000 + i, '2026-02-11', 'acc-' + i, 2025)) });
  const ebit = ex(ebitFacts, 'ebit');
  const ebitda = S._deriveEbitdaFromExtracted({ ebit, da });
  assert.deepEqual(plain(ebitda.meta.periods), periods);
  assert.equal(ebitda.values[3], 1003 + 6970);     // FY2022: EBIT 1003 + D&A 6,970
  assert.equal(ebitda.values[2], 1002 + 7486);     // FY2023: EBIT 1002 + D&A 7,486
});

test('F-2 synthetisch: Jahreswechsel Ende Dezember/Anfang Januar erzeugt keine Luecke', () => {
  // Samstag naechst dem 31.12.: 2020-01-04, 2021-01-02, 2022-01-01, 2022-12-31, 2023-12-30, 2024-12-28
  const ends = ['2024-12-28', '2023-12-30', '2022-12-31', '2022-01-01', '2021-01-02', '2020-01-04'];
  const e = ends.map((end, i) => {
    const prev = ends[i + 1];
    const start = prev ? new Date(Date.parse(prev) + 86400000).toISOString().slice(0, 10) : '2019-01-06';
    return k10(start, end, 100 - i, '2025-02-20', 'acc-' + i, 2024 - i);
  });
  const r = S._extractFyValues(factsOf({ Revenues: e }), 'Revenues', 10);
  assert.deepEqual(plain(r.meta.periods), ends);
  assert.deepEqual(plain(r.meta.fiscalYears), [2024, 2023, 2022, 2021, 2020, 2019]);
  assert.deepEqual(plain(r.values), [100, 99, 98, 97, 96, 95]);
  assert.equal(r.meta.gapDetected, undefined);
});

test('F-2 synthetisch: normale Kalenderjahre bleiben unveraendert (MCD real)', () => {
  const r = ex(MCD, 'revenue');
  assert.deepEqual(plain(r.meta.fiscalYears), [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
  assert.deepEqual(plain(r.meta.periods).map(p => p.slice(5)), Array(10).fill('12-31'));
  assert.equal(r.values[0], 26885);
  assert.equal(r.meta.fiscalYearCheck.status, 'consistent');
});

test('F-2 synthetisch: Vergleichswerte und Berichtigung erzeugen keine doppelten Jahre', () => {
  const e = [
    k10('2023-01-01', '2023-12-31', 500, '2024-02-10', 'K23', 2023),
    k10('2022-01-01', '2022-12-31', 450, '2024-02-10', 'K23', 2023),   // Vergleichswert
    k10('2024-01-01', '2024-12-31', 560, '2025-02-10', 'K24', 2024),
    k10('2023-01-01', '2023-12-31', 480, '2025-02-10', 'K24', 2024),   // berichtigt
    k10('2022-01-01', '2022-12-31', 450, '2025-02-10', 'K24', 2024),   // Vergleichswert, unveraendert
    k10('2022-01-01', '2022-12-31', 450, '2023-02-10', 'K22', 2022)
  ];
  const r = S._extractFyValues(factsOf({ Revenues: e }), 'Revenues', 10);
  assert.deepEqual(plain(r.meta.fiscalYears), [2024, 2023, 2022]);
  assert.deepEqual(plain(r.values), [560, 480, 450]);
  assert.deepEqual(plain(r.meta.accns), ['K24', 'K24', 'K24']);
  const sup = plain(r.meta.supersededValues);
  assert.deepEqual(sup, [{ fiscalYear: 2023, period: '2023-12-31', value: 500e6, accn: 'K23',
                           filed: '2024-02-10', supersededBy: 'K24' }]);
  // fy der Vergleichsperioden (2023/2024 fuer das Jahr 2022) wird NICHT als deren
  // Geschaeftsjahr gewertet; geprueft werden nur die Hauptperioden.
  assert.equal(r.meta.fiscalYearCheck.status, 'consistent');
  assert.equal(r.meta.fiscalYearCheck.checked, 3);
});

test('F-2 synthetisch: nicht aneinander anschliessende Jahresperioden gelten nicht als lueckenlos', () => {
  // Wechsel des Geschaeftsjahresendes von Juni auf September: Rumpfperiode
  // Jul–Sep 2023 (nicht als Jahr gemeldet). Die Schluessel 2024/2023 sind
  // aufeinanderfolgend, die Perioden schliessen aber nicht aneinander an.
  const e = [
    k10('2023-10-01', '2024-09-30', 300, '2024-11-20', 'K24', 2024),
    k10('2022-07-01', '2023-06-30', 250, '2023-08-20', 'K23', 2023)
  ];
  const r = S._extractFyValues(factsOf({ Revenues: e }), 'Revenues', 10);
  assert.deepEqual(plain(r.meta.periods), ['2024-09-30']);
  assert.equal(r.meta.gapDetected, true);
  assert.deepEqual(plain(r.meta.droppedPeriods), ['2023-06-30']);
});

test('F-2 synthetisch: abweichende Benennung durch den Filer wird ausgewiesen', () => {
  const e = [
    k10('2024-01-01', '2024-12-31', 3, '2025-02-10', 'K24', 2024),
    k10('2023-01-01', '2023-12-31', 2, '2024-02-10', 'K23', 2023),
    k10('2022-01-01', '2022-12-31', 1, '2023-02-10', 'K22', 2021)    // fy passt nicht
  ];
  const r = S._extractFyValues(factsOf({ Revenues: e }), 'Revenues', 10);
  assert.equal(r.meta.fiscalYearCheck.status, 'inconsistent');
  assert.deepEqual(plain(r.meta.fiscalYearCheck.deviations),
    [{ accn: 'K22', end: '2022-12-31', fy: 2021, fiscalYear: 2022 }]);
});

test('F-2 _secPeriodYear: Anfang Januar gehoert zum Vorjahr, sonst Kalenderjahr', () => {
  assert.equal(S._secPeriodYear('2023-01-01'), 2022);
  assert.equal(S._secPeriodYear('2021-01-03'), 2020);
  assert.equal(S._secPeriodYear('2020-01-07'), 2019);
  assert.equal(S._secPeriodYear('2020-01-08'), 2020);
  assert.equal(S._secPeriodYear('2025-01-31'), 2025);   // Einzelhandel: unveraendert
  assert.equal(S._secPeriodYear('2023-12-31'), 2023);
  assert.equal(S._secPeriodYear('CY2024Q4I'), 2024);
  assert.equal(S._secPeriodYear(null), null);
});

// ═════════════════════════════════════════════════════════════════════════════
// F-1 · Vollstaendige D&A statt Teilposten
// ═════════════════════════════════════════════════════════════════════════════
// Die D&A-Extraktion des Imports: seit D2 _extractDaWithScopeCheck, davor lief
// D&A durch die generische Kette _extractWithFallback(SEC_TAG_MAP.da). So
// laesst sich derselbe Test gegen den Stand vor D2 ausfuehren.
const importDa = (F) => (typeof S._extractDaWithScopeCheck === 'function')
  ? S._extractDaWithScopeCheck(F, 10) : S._extractWithFallback(F, TAGS.da, 10);
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

test('F-1 MCD: Gesamt-D&A 2,199 (DepreciationAndAmortization) statt Teilposten 457', () => {
  const da = importDa(MCD);
  assert.equal(da.values[0], 2199);            // 10-K FY2025, Kapitalflussrechnung
  assert.equal(da.usedTag, 'DepreciationAndAmortization');
  assert.equal(da.meta.periods[0], '2025-12-31');
  assert.equal(da.meta.daSelection[0].status, 'total');
  assert.deepEqual(plain(da.meta.daScope.partialTags), ['DepreciationDepletionAndAmortization']);
  // Beleg: derselbe Bericht, dieselbe Periode, weiter Tag kleiner als enger Tag.
  const e = da.meta.daScope.evidence.find(x => x.accn === '0000063908-26-000035' && x.end === '2025-12-31');
  assert.equal(e.broadValue, 457e6);
  assert.equal(e.narrowValue, 2199e6);
  assert.match(da.meta._tagSelectionNote, /Teilposten/);
  // Kein Addieren, kein Maximum ueber alle Tags: Depreciation (1,600) ist enger und kleiner.
  assert.deepEqual(plain(da.meta.daSelection[0].candidates.map(c => [c.tag, c.value])),
    [['DepreciationDepletionAndAmortization', 457], ['DepreciationAndAmortization', 2199], ['Depreciation', 1600]]);
});

test('F-1 MCD: Weitergabe an EBITDA und gemessene D&A-Quote des DCF', () => {
  const revenue = ex(MCD, 'revenue');
  const ebit    = ex(MCD, 'ebit');
  const da      = importDa(MCD);
  const ebitda  = S._deriveEbitdaFromExtracted({ ebit, da });
  assert.equal(ebitda.values[0], 12393 + 2199);        // 14,592
  assert.equal(ebitda.meta.periods[0], '2025-12-31');
  const f = { revenue: revenue.values, ebit: ebit.values, ebitda: ebitda.values,
              _v4_meta: { revenue: revenue.meta, ebit: ebit.meta, ebitda: ebitda.meta } };
  const info = S._resolveDaForForecast({ fundamentals: f, valuation: {} });
  assert.equal(info.source, 'measured');
  // Unabhaengig nachgerechnet: Median der periodengleichen Quoten D&A/Umsatz.
  const expected = median(da.values.map((d, i) => d / revenue.values[i]));
  assert.ok(Math.abs(info.ratio - expected) < 1e-9, `Quote ${info.ratio} vs. ${expected}`);
  assert.ok(info.ratio > 0.07 && info.ratio < 0.09, 'rund 8 % statt 1.53 %');
});

test('F-1 MCD: Quartals-D&A (TTM-Weg) nutzt ebenfalls den Gesamtwert-Tag', () => {
  const n = S.normalizeSecQuarters(MCD, { fields: ['depreciation_amortization', 'revenue'] });
  const d = n.fields.depreciation_amortization;
  assert.equal(d.usedTag, 'DepreciationAndAmortization');
  const fy25 = d.quarters.filter(q => q.fiscalYear === 2025).map(q => q.value);
  assert.equal(fy25.length, 4);
  assert.equal(fy25.reduce((a, b) => a + b, 0), 2199e6);   // Summe der Quartale = Jahreswert
  assert.ok(d.notes.some(t => /DepreciationDepletionAndAmortization ist beim Filer ein Teilposten/.test(t)));
});

test('F-1 JNJ: einziger Tag DepreciationDepletionAndAmortization bleibt Gesamtwert', () => {
  const da = S._extractDaWithScopeCheck(JNJ, 10);
  assert.equal(da.values[0], 7503);
  assert.equal(da.usedTag, 'DepreciationDepletionAndAmortization');
  assert.deepEqual(plain(da.meta.daScope.partialTags), []);
  assert.equal(da.meta.fiscalYears[3], 2022);            // FY2022 aus F-2 bleibt erhalten
});

const DDA = 'DepreciationDepletionAndAmortization', DNA = 'DepreciationAndAmortization', DEP = 'Depreciation';
const y = (yr, v, accn, filed, extra) => k10(`${yr}-01-01`, `${yr}-12-31`, v, filed || `${yr + 1}-02-15`, accn || `K${yr}`, yr, extra);

test('F-1 synthetisch: Gesamtwert allein und ueberlappende gleiche Angaben (keine Addition)', () => {
  const only = S._extractDaWithScopeCheck(factsOf({ [DNA]: [y(2024, 200), y(2023, 190)] }), 10);
  assert.deepEqual(plain(only.values), [200, 190]);
  assert.equal(only.meta.daSelection[0].status, 'total');
  // DDA = D&A im selben Bericht: derselbe Betrag unter zwei Tags → einmal, weitester Tag.
  const both = S._extractDaWithScopeCheck(factsOf({ [DDA]: [y(2024, 200)], [DNA]: [y(2024, 200)] }), 10);
  assert.deepEqual(plain(both.values), [200]);
  assert.equal(both.usedTag, DDA);
  assert.deepEqual(plain(both.meta.daScope.partialTags), []);
});

test('F-1 synthetisch: Teilwert wird verworfen, auch in Jahren ohne engeren Tag (partial_only)', () => {
  const r = S._extractDaWithScopeCheck(factsOf({
    [DDA]: [y(2024, 50), y(2023, 45)],
    [DNA]: [y(2024, 200)]
  }), 10);
  assert.deepEqual(plain(r.values), [200, null]);
  assert.equal(r.meta.daSelection[1].status, 'partial_only');
  assert.deepEqual(plain(r.meta.daUnresolved.map(u => u.fiscalYear)), [2023]);
  // Folge: kein EBITDA aus einem Teilposten.
  const ebit = S._extractFyValues(factsOf({ OperatingIncomeLoss: [y(2024, 1000), y(2023, 900)] }), 'OperatingIncomeLoss', 10);
  const ebitda = S._deriveEbitdaFromExtracted({ ebit, da: r });
  assert.deepEqual(plain(ebitda.values), [1200, null]);
});

test('F-1 synthetisch: widerspruechliche Angaben ergeben keinen Wert', () => {
  // FY2024: DDA 50 < D&A 200 (Teilposten). FY2023: DDA 300 > D&A 180 im selben Bericht.
  const r = S._extractDaWithScopeCheck(factsOf({
    [DDA]: [y(2024, 50), y(2023, 300)],
    [DNA]: [y(2024, 200), y(2023, 180)]
  }), 10);
  assert.deepEqual(plain(r.meta.daScope.contradictedTags), [DDA]);
  assert.equal(r.values[0], 200);
  assert.equal(r.values[1], null);
  assert.equal(r.meta.daSelection[1].status, 'contradictory');
  // Quartalsweg: widerspruechlicher Umfang → keine D&A statt geratener Tag.
  const n = S.normalizeSecQuarters(factsOf({
    [DDA]: [y(2024, 50), y(2023, 300)], [DNA]: [y(2024, 200), y(2023, 180)],
    Revenues: [y(2024, 1000), y(2023, 900)] }), { fields: ['depreciation_amortization', 'revenue'] });
  assert.equal(n.fields.depreciation_amortization.usedTag, null);
  assert.match(n.fields.depreciation_amortization.unresolved, /widerspruechlich/);
});

test('F-1 synthetisch: unterschiedliche Perioden werden nicht verglichen', () => {
  // D&A nur fuer ein Halbjahr (10-Q) — kein Beleg gegen den Jahreswert von DDA.
  const r = S._extractDaWithScopeCheck(factsOf({
    [DDA]: [y(2024, 50)],
    [DNA]: [{ start: '2024-01-01', end: '2024-06-30', val: 120e6, form: '10-Q', filed: '2024-08-01', accn: 'Q2', fy: 2024, fp: 'Q2' }]
  }), 10);
  assert.deepEqual(plain(r.meta.daScope.partialTags), []);
  assert.deepEqual(plain(r.values), [50]);
  assert.equal(r.usedTag, DDA);
});

test('F-1 synthetisch: nur Depreciation wird verwendet, aber als Teilumfang ausgewiesen', () => {
  const r = S._extractDaWithScopeCheck(factsOf({ [DEP]: [y(2024, 80)] }), 10);
  assert.deepEqual(plain(r.values), [80]);
  assert.equal(r.meta.daSelection[0].status, 'depreciation_only');
});

// ═════════════════════════════════════════════════════════════════════════════
// F-4 · Gemischt skalierte Aktienhistorie
// ═════════════════════════════════════════════════════════════════════════════
// Produktiver Importweg ohne Browser: Extraktion + Master-JSON wie secFetchAll.
function importFacts(facts, ticker = 'X') {
  if (typeof S._extractSecFundamentals !== 'function') {
    throw new Error('Importweg _extractSecFundamentals fehlt (Stand vor D2)');
  }
  const { extracted, derivationNotes } = S._extractSecFundamentals(facts);
  const mj = S._buildSecMasterJson({ ticker, cik: '0', companyName: ticker, sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: facts, derivationNotes });
  return { mj, extracted };
}

test('F-4 MCD: jede historische Aktienangabe geprueft, Reihe einheitlich in Mio.', () => {
  const { mj } = importFacts(MCD, 'MCD');
  S.normalizeSharesInPlace(mj);
  const f = mj.fundamentals;
  assert.deepEqual(plain(f.shares_diluted.slice(0, 6)), [716.4, 721.9, 732.3, 741.3, 751.8, 750.1]);
  const hc = plain(f._v4_meta.shares_diluted.history_check);
  const st = Object.fromEntries(hc.elements.map(e => [e.period, e]));
  // FY2024/FY2023: nur als „721.9 shares“ gemeldet → Skalierung mit Beleg korrigiert.
  assert.equal(st['2024-12-31'].status, 'rescaled');
  assert.equal(st['2024-12-31'].raw, 721.9);
  assert.match(st['2024-12-31'].note, /Faktor 1000000/);
  assert.match(st['2024-12-31'].note, /8223.*11\.39/);                // NI/EPS FY2024
  // FY2022: der urspruengliche 10-K FY2022 meldete 741,300,000 → Originalangabe.
  assert.equal(st['2022-12-31'].status, 'original_filing');
  assert.deepEqual(st['2022-12-31'].source, { accn: '0000063908-23-000012', filed: '2023-02-24', val: 741300000 });
  assert.equal(st['2020-12-31'].status, 'verified');
  assert.equal(hc.truncatedAt, null);
  // Kennzahl: (716.4 − 750.1) / 750.1 = −4.49 % statt −100 %.
  const m = S.computeNetShareIssuance(mj);
  assert.equal(m.status, 'ok');
  assert.ok(Math.abs(m.value - (716.4 - 750.1) / 750.1) < 1e-9);
  assert.ok(S._qceScoreIssuance(m.value) < S._qceScoreIssuance(-1), 'keine Bestnote aus einer Scheinreduktion');
});

test('F-4 JNJ: bereits korrekte Reihe bleibt unveraendert (inkl. FY2022 aus F-2)', () => {
  const J = excerpt('jnj-d2-regression.json').facts;
  const { mj } = importFacts(J, 'JNJ');
  S.normalizeSharesInPlace(mj);
  const hc = plain(mj.fundamentals._v4_meta.shares_diluted.history_check);
  assert.ok(hc.elements.slice(1).every(e => e.status === 'verified'), JSON.stringify(hc.elements.map(e => e.status)));
  assert.equal(mj.fundamentals.shares_diluted[3], 2663.9);            // FY2022 (Ende 2023-01-01)
  assert.equal(mj.fundamentals.shares_diluted.length, 10);
});

// Altdaten/Legacy-Weg: normalizeSharesInPlace mit Periodenangaben.
const legacyMj = (shares, ni, eps, ends) => ({
  meta: {}, market: {}, fundamentals: {
    shares_diluted: shares.slice(), net_income: ni.slice(), eps_diluted: eps.slice(),
    _v4_meta: { shares_diluted: { periods: ends.slice() }, net_income: { periods: ends.slice() },
                eps_diluted: { periods: ends.slice() } } } });
const ENDS = ['2025-12-31', '2024-12-31', '2023-12-31', '2022-12-31', '2021-12-31', '2020-12-31'];

test('F-4 gemischte Skalierung im Altdatenweg: periodengleich belegt korrigiert', () => {
  const mj = legacyMj([716.4, 721.9, 732.3, 741.3, 751.8, 750100000],
    [8563, 8223, 8469, 6177, 7545.2, 4730.5], [11.95, 11.39, 11.56, 8.33, 10.04, 6.31], ENDS);
  S.normalizeSharesInPlace(mj);
  assert.deepEqual(plain(mj.fundamentals.shares_diluted), [716.4, 721.9, 732.3, 741.3, 751.8, 750.1]);
  const e5 = mj.meta._yahoo_hints._shares_history.elements[5];
  assert.equal(e5.status, 'rescaled');
  assert.equal(e5.raw, 750100000);
});

test('F-4 echte Kapitalveraenderungen werden nicht „korrigiert“', () => {
  // Rueckkauf −40 % und ein unbereinigter 2:1-Split in den aeltesten Jahren: jede Angabe
  // passt zu ihrem eigenen NI/EPS → keine Skalierung, die Split-Erkennung bleibt zustaendig.
  const shares = [600, 700, 800, 1000, 500, 500];
  const ni = [1200, 1400, 1600, 2000, 1000, 1000];
  const eps = [2, 2, 2, 2, 2, 2];
  const mj = legacyMj(shares, ni, eps, ENDS);
  S.normalizeSharesInPlace(mj);
  assert.deepEqual(plain(mj.fundamentals.shares_diluted), shares);
  assert.ok(mj.meta._yahoo_hints._shares_history.elements.slice(1).every(e => e.status === 'verified'));
  const m = S.computeNetShareIssuance(mj);
  assert.match(m.detail, /split-adjustiert/);
});

test('F-4 nicht entscheidbare Faelle: keine Korrektur, keine Scheinkennzahl', () => {
  // FY2020 ohne NI/EPS und in anderer Groessenordnung → Reihe endet davor.
  const mj = legacyMj([716.4, 721.9, 732.3, 741.3, 751.8, 750100000],
    [8563, 8223, 8469, 6177, 7545.2], [11.95, 11.39, 11.56, 8.33, 10.04], ENDS);
  mj.fundamentals._v4_meta.net_income.periods = ENDS.slice(0, 5);
  mj.fundamentals._v4_meta.eps_diluted.periods = ENDS.slice(0, 5);
  S.normalizeSharesInPlace(mj);
  assert.deepEqual(plain(mj.fundamentals.shares_diluted), [716.4, 721.9, 732.3, 741.3, 751.8]);
  assert.deepEqual(plain(mj.fundamentals._v4_meta.shares_diluted.periods), ENDS.slice(0, 5));
  const m = S.computeNetShareIssuance(mj);
  assert.equal(m.status, 'insufficient_data');
  assert.match(m.detail, /belegbare Aktienhistorie endet vor 2020-12-31/);

  // Widerspruch: NI/EPS vorhanden, aber keine Lesart passt (Faktor 3) → ebenso Ende.
  const mj2 = legacyMj([700, 700, 700, 700, 700, 2100], [1400, 1400, 1400, 1400, 1400, 1400], [2, 2, 2, 2, 2, 2], ENDS);
  S.normalizeSharesInPlace(mj2);
  assert.equal(mj2.fundamentals.shares_diluted.length, 5);
  assert.equal(mj2.meta._yahoo_hints._shares_history.elements[5].status, 'contradicted');

  // Ohne Gegenpruefung, aber gleiche Groessenordnung wie der Nachbar: unveraendert.
  const mj3 = legacyMj([700, 705, 710, 715, 720, 725], [1400, 1410], [2, 2], ENDS);
  mj3.fundamentals._v4_meta.net_income.periods = ENDS.slice(0, 2);
  mj3.fundamentals._v4_meta.eps_diluted.periods = ENDS.slice(0, 2);
  S.normalizeSharesInPlace(mj3);
  assert.deepEqual(plain(mj3.fundamentals.shares_diluted), [700, 705, 710, 715, 720, 725]);
  assert.equal(mj3.meta._yahoo_hints._shares_history.elements[5].status, 'unverifiable_consistent');
});
