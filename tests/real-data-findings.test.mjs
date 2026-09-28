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
