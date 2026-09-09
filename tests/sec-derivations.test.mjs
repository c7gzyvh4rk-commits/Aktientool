// ─────────────────────────────────────────────────────────────────────────────
// Tests für die SEC-Normalisierungs- und Ableitungspfade (V1.0.37)
//
// Ausgeführt wird der real ausgelieferte Code aus der HTML-Datei (siehe
// extract-functions.mjs). Erwartungswerte sind unabhängig von Hand gerechnet
// und stehen als Kommentar an der jeweiligen Assertion.
//
//   node --test tests/
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './extract-functions.mjs';

const A = loadFunctions([
  'SEC_TAG_MAP',
  '_takeLatestContiguousFiscalYears',
  '_extractFyValues',
  '_extractWithFallback',
  '_secPeriodYear',
  '_secPeriodDaysApart',
  '_joinPeriodKeyed',
  '_secUnavailable',
  '_deriveEbitdaFromExtracted',
  '_deriveGoodwillIntangibles',
  '_deriveTangibleBookValue',
  '_deriveEbitFromPretax',
  '_applySecDerivations',
  'validatePeriodAlignment'
]);

// ── Synthetische SEC-Facts ───────────────────────────────────────────────────
// flow(...)  → Zeitraumwert (start+end), wie Income-Statement/Cashflow
// stock(...) → Stichtagswert (nur end), wie Bilanzposten
const M = 1e6;

function flow(year, valM, { endMonth = 12, endDay = 31, filed = null } = {}) {
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  const startY = endMonth === 12 ? year : year - 1;
  const startM = endMonth === 12 ? 1 : endMonth + 1;
  const start = `${startY}-${String(startM).padStart(2, '0')}-01`;
  return { start, end, val: valM * M, form: '10-K', frame: `CY${year}`,
           filed: filed || `${year + 1}-02-15`, accn: `0000-${year}-acc` };
}

function stock(year, valM, { endMonth = 12, endDay = 31 } = {}) {
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { end, val: valM * M, form: '10-K', frame: `CY${year}Q4I`,
           filed: `${year + 1}-02-15`, accn: `0000-${year}-acc` };
}

function facts(map) {
  const out = { 'us-gaap': {} };
  for (const [tag, entries] of Object.entries(map)) {
    out['us-gaap'][tag] = { units: { USD: entries } };
  }
  return out;
}

// Extrahiert ein Feld über die reale Fallback-Kette der App.
function ex(factsObj, field) {
  const tags = A.SEC_TAG_MAP[field];
  if (!tags) return { values: [], meta: null, usedTag: null };
  return A._extractWithFallback(factsObj, tags, 10);
}

function buildExtracted(factsObj, fields) {
  const out = {};
  for (const f of fields) out[f] = ex(factsObj, f);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Tag-Map: Vorsteuerergebnis ist kein EBIT-Ersatz
// ═════════════════════════════════════════════════════════════════════════════
test('SEC_TAG_MAP.ebit enthält nur OperatingIncomeLoss (kein Vorsteuerergebnis)', () => {
  assert.deepEqual(A.SEC_TAG_MAP.ebit, ['OperatingIncomeLoss']);
  const joined = JSON.stringify(A.SEC_TAG_MAP.ebit);
  assert.ok(!joined.includes('BeforeIncomeTaxes'),
    'Pretax-Tags dürfen nicht in der EBIT-Kette stehen');
  // Das Vorsteuerergebnis ist als eigenes Feld erhalten (für die Rekonstruktion)
  assert.ok(A.SEC_TAG_MAP.pretax_income.includes(
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'));
});

test('Goodwill/Intangibles: kombiniertes Tag und Komponenten sind getrennte Ketten', () => {
  assert.equal(A.SEC_TAG_MAP.goodwill_and_intangibles, null); // wird abgeleitet
  assert.deepEqual(A.SEC_TAG_MAP.goodwill, ['Goodwill']);
  assert.deepEqual(A.SEC_TAG_MAP.intangibles_ex_goodwill, ['IntangibleAssetsNetExcludingGoodwill']);
  assert.deepEqual(A.SEC_TAG_MAP.goodwill_and_intangibles_combined, ['IntangibleAssetsNetIncludingGoodwill']);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Extraktion: Start/Ende, Einheit, Filing-ID bleiben erhalten
// ═════════════════════════════════════════════════════════════════════════════
test('_extractFyValues behält Einheit, Start/Ende, filed und accn', () => {
  const f = facts({ OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100)] });
  const r = A._extractFyValues(f, 'OperatingIncomeLoss', 10);
  assert.deepEqual(r.values, [1200, 1100]);              // 1.2e9 / 1e6 = 1200
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31']);
  assert.deepEqual(r.meta.starts,  ['2024-01-01', '2023-01-01']);
  assert.equal(r.meta.unit, 'USD');
  assert.equal(r.meta.isFlowConcept, true);
  assert.deepEqual(r.meta.accns, ['0000-2024-acc', '0000-2023-acc']);
  assert.deepEqual(r.meta.filed, ['2025-02-15', '2024-02-15']);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. EBITDA: period-keyed statt Array-Index (fehlendes Jahr)
// ═════════════════════════════════════════════════════════════════════════════
test('EBITDA: versetzte Jahre werden nicht mehr über den Array-Index addiert', () => {
  // EBIT: FY2024, FY2023, FY2022 · D&A erst ab FY2023 getaggt (versetzter Start).
  // Alter Index-Join: ebitda[0] = EBIT(FY2024) + D&A(FY2023) → Jahresmix.
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100), flow(2022, 1000)],
    DepreciationDepletionAndAmortization: [flow(2023, 280), flow(2022, 250)]
  });
  const e = buildExtracted(f, ['ebit', 'da']);
  assert.deepEqual(e.ebit.meta.periods, ['2024-12-31', '2023-12-31', '2022-12-31']);
  assert.deepEqual(e.da.meta.periods,   ['2023-12-31', '2022-12-31']);

  const r = A._deriveEbitdaFromExtracted(e);
  // Handrechnung: FY2024 = kein D&A → null · FY2023 = 1100+280 = 1380
  //               FY2022 = 1000+250 = 1250
  assert.deepEqual(r.values, [null, 1380, 1250]);
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31', '2022-12-31']);
  // Positionstreue zur Leitserie EBIT bleibt erhalten (Slot statt Verschiebung),
  // damit nachgelagerte Kennzahlen ebitda[i]/ebit[i] dasselbe FY vergleichen.
  assert.deepEqual(e.ebit.meta.periods, r.meta.periods);
  // Der alte Index-Join hätte EBIT(FY2024) + D&A(FY2023) = 1480 ergeben:
  assert.notEqual(r.values[0], 1200 + 280);
  assert.equal(r.derived, true);
  assert.match(r.meta.derivation, /EBIT \+ D&A/);
  assert.ok(r.meta.incompletePeriods.some(p => p.startsWith('2024-12-31')));
});

test('EBITDA: Lücke innerhalb der D&A-Reihe kappt die Reihe, statt Jahre zu verschieben', () => {
  // D&A: FY2024 und FY2022, FY2023 fehlt. _extractFyValues behält für
  // Zeitraumgrößen nur den neuesten zusammenhängenden Block (FY2024).
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100), flow(2022, 1000)],
    DepreciationDepletionAndAmortization: [flow(2024, 300), flow(2022, 250)]
  });
  const e = buildExtracted(f, ['ebit', 'da']);
  assert.deepEqual(e.da.meta.periods, ['2024-12-31']);
  assert.equal(e.da.meta.gapDetected, true);

  const r = A._deriveEbitdaFromExtracted(e);
  // Handrechnung: FY2024 = 1200+300 = 1500 · FY2023/FY2022 ohne D&A → null
  assert.deepEqual(r.values, [1500, null, null]);
  assert.notEqual(r.values[2], 1000 + 250);
});

test('EBITDA: identische Perioden ergeben lückenlose Serie', () => {
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100)],
    DepreciationDepletionAndAmortization: [flow(2024, 300), flow(2023, 280)]
  });
  const r = A._deriveEbitdaFromExtracted(buildExtracted(f, ['ebit', 'da']));
  assert.deepEqual(r.values, [1500, 1380]);   // 1200+300 · 1100+280
  assert.equal(r.meta.incompletePeriods, null);
});

test('EBITDA: versetzte Jahre ohne Überschneidung → nicht ableitbar, nicht geraten', () => {
  // EBIT nur FY2024/2023, D&A nur FY2021/2020 → keine gemeinsame Periode
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100)],
    DepreciationDepletionAndAmortization: [flow(2021, 200), flow(2020, 190)]
  });
  const r = A._deriveEbitdaFromExtracted(buildExtracted(f, ['ebit', 'da']));
  assert.deepEqual(r.values, [null, null]);  // Slots der Leitserie, aber ohne Wert
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31']);
});

test('EBITDA: Zeitraumwert und Stichtagswert werden nicht vermischt', () => {
  // D&A fälschlich als Stichtagswert getaggt → Ableitung muss verweigert werden
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200)],
    DepreciationDepletionAndAmortization: [stock(2024, 300)]
  });
  const r = A._deriveEbitdaFromExtracted(buildExtracted(f, ['ebit', 'da']));
  assert.deepEqual(r.values, []);
  assert.match(String(r.meta._derivationUnavailable), /Zeitraum- und Stichtagswerte gemischt/);
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Unterschiedliche Geschäftsjahresenden
// ═════════════════════════════════════════════════════════════════════════════
test('Abweichendes Geschäftsjahresende (Juni-FY) wird korrekt zusammengeführt', () => {
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 900, { endMonth: 6, endDay: 30 }),
                          flow(2023, 800, { endMonth: 6, endDay: 30 })],
    DepreciationDepletionAndAmortization: [flow(2024, 120, { endMonth: 6, endDay: 30 }),
                                           flow(2023, 110, { endMonth: 6, endDay: 30 })]
  });
  const r = A._deriveEbitdaFromExtracted(buildExtracted(f, ['ebit', 'da']));
  assert.deepEqual(r.values, [1020, 910]);            // 900+120 · 800+110
  assert.deepEqual(r.meta.periods, ['2024-06-30', '2023-06-30']);
});

// ERWARTUNG GEÄNDERT (V1.0.38, fachlich begründet): Vorher wurde bei
// unvereinbaren Periodenenden der ganze Slot verworfen (`values: []`). Genau
// das war Fehler 1 — im lead-Modus rücken dadurch ältere Werte an eine
// vordere Position. Erwartet wird jetzt der Slot-Erhalt mit `null`.
test('Gleiches Kalenderjahr, aber weit auseinanderliegende Periodenenden → null mit erhaltener Position', () => {
  // EBIT endet 2024-12-31, D&A endet 2024-01-31 (Rumpf-/anderes Geschäftsjahr)
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200)],
    DepreciationDepletionAndAmortization: [flow(2024, 300, { endMonth: 1, endDay: 31 })]
  });
  const r = A._deriveEbitdaFromExtracted(buildExtracted(f, ['ebit', 'da']));
  assert.deepEqual(r.values, [null]);                       // Slot bleibt, Wert nicht ermittelbar
  assert.deepEqual(r.meta.periods, ['2024-12-31']);         // Periodenzuordnung unverändert
  assert.ok((r.meta.derivationWarnings || []).some(w => /weicht \d+ Tage/.test(w)));
  assert.ok(r.meta.incompatiblePeriods.some(p => p.startsWith('2024-12-31')));
});

// ── Pflichtfall aus dem Auftrag: Nettoschulden dürfen nicht nach vorn rücken ──
test('Fehler 1 Gegenbeispiel: unvereinbares Cash-Periodenende schiebt kein Jahr nach vorn', () => {
  const debt = { values: [600, 500], meta: { periods: ['2024-12-31', '2023-12-31'], isFlowConcept: false, unit: 'USD' } };
  const cash = { values: [100, 50],  meta: { periods: ['2024-01-31', '2023-12-31'], isFlowConcept: false, unit: 'USD' } };
  const r = A._joinPeriodKeyed(
    [{ name: 'debt', values: debt.values, meta: debt.meta },
     { name: 'cash', values: cash.values, meta: cash.meta }],
    (v) => (v.debt != null && v.cash != null) ? v.debt - v.cash : null,
    { label: 'Net Debt' }
  );
  // Handrechnung: FY2024 unvereinbar (335 Tage Abstand) → null;
  //               FY2023 = 500 − 50 = 450
  assert.deepEqual(r.values, [null, 450]);
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31']);
  // Das alte Verhalten [450] mit FY2023 an Index 0 ist ausgeschlossen:
  assert.notEqual(r.values[0], 450);
  assert.equal(r.meta.periods[0], '2024-12-31');
  assert.ok(/2024-12-31/.test(r.meta.incompatiblePeriods.join(' ')));
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Vorsteuerergebnis ohne EBIT
// ═════════════════════════════════════════════════════════════════════════════
test('Vorsteuerergebnis wird nicht als EBIT übernommen, sondern sichtbar rekonstruiert', () => {
  const f = facts({
    Revenues: [flow(2024, 5000)],
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
      [flow(2024, 900), flow(2023, 850)],
    InterestExpense: [flow(2024, 120), flow(2023, 110)],
    InvestmentIncomeInterest: [flow(2024, 20), flow(2023, 15)]
  });
  const e = buildExtracted(f, ['ebit', 'pretax_income', 'interest_expense', 'interest_income', 'da',
                               'total_equity', 'goodwill', 'intangibles_ex_goodwill',
                               'goodwill_and_intangibles_combined']);
  assert.deepEqual(e.ebit.values, [], 'kein OperatingIncomeLoss → EBIT zunächst leer');

  A._applySecDerivations(e);
  // Handrechnung: 900 + 120 − 20 = 1000 · 850 + 110 − 15 = 945
  assert.deepEqual(e.ebit.values, [1000, 945]);
  assert.equal(e.ebit.derived, true);
  assert.match(e.ebit.usedTag, /BeforeIncomeTaxes.*\+InterestExpense-InvestmentIncomeInterest/);
  assert.match(e.ebit.meta.derivation, /Vorsteuerergebnis \+ Zinsaufwand − Zinsertrag/);
});

test('Vorsteuerergebnis ohne Zinsaufwand → EBIT bleibt fehlend (kein stiller Ersatz)', () => {
  const f = facts({
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
      [flow(2024, 900)]
  });
  const e = buildExtracted(f, ['ebit', 'pretax_income', 'interest_expense', 'interest_income', 'da',
                               'total_equity', 'goodwill', 'intangibles_ex_goodwill',
                               'goodwill_and_intangibles_combined']);
  const notes = A._applySecDerivations(e);
  assert.deepEqual(e.ebit.values, []);
  assert.notEqual(e.ebit.values[0], 900);
  const ebitNote = notes.find(n => n.field === 'ebit');
  assert.equal(ebitNote.status, 'unavailable');
  assert.match(ebitNote.reason, /Pflichtkomponente/);
});

test('Fehlender Zinsertrag wird als unvollständige Rekonstruktion markiert', () => {
  const f = facts({
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
      [flow(2024, 900)],
    InterestExpense: [flow(2024, 120)]
  });
  const e = buildExtracted(f, ['pretax_income', 'interest_expense', 'interest_income']);
  const r = A._deriveEbitFromPretax(e);
  assert.deepEqual(r.values, [1020]);                 // 900 + 120, ohne Zinsertrag
  assert.equal(r.meta.confidenceHint, 'medium');
  assert.match(r.meta.reconstructionNote, /Zinsertrag nicht getaggt/);
});

test('Echtes OperatingIncomeLoss hat Vorrang vor der Rekonstruktion', () => {
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1000)],
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
      [flow(2024, 900)],
    InterestExpense: [flow(2024, 120)]
  });
  const e = buildExtracted(f, ['ebit', 'pretax_income', 'interest_expense', 'interest_income', 'da',
                               'total_equity', 'goodwill', 'intangibles_ex_goodwill',
                               'goodwill_and_intangibles_combined']);
  A._applySecDerivations(e);
  assert.deepEqual(e.ebit.values, [1000]);
  assert.equal(e.ebit.usedTag, 'OperatingIncomeLoss');
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Goodwill / Intangibles: kombiniert vs. einzeln
// ═════════════════════════════════════════════════════════════════════════════
test('Kombiniertes Intangibles-Tag wird nicht mit den Einzeltags addiert', () => {
  const f = facts({
    IntangibleAssetsNetIncludingGoodwill: [stock(2024, 5000), stock(2023, 4800)],
    Goodwill:                             [stock(2024, 3000), stock(2023, 2900)],
    IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000), stock(2023, 1900)]
  });
  const e = buildExtracted(f, ['goodwill_and_intangibles_combined', 'goodwill', 'intangibles_ex_goodwill']);
  const r = A._deriveGoodwillIntangibles(e);
  assert.deepEqual(r.values, [5000, 4800]);   // kombiniert, NICHT 5000+3000+2000
  assert.equal(r.usedTag, 'IntangibleAssetsNetIncludingGoodwill');
  assert.equal(r.meta.componentsIgnored.length, 2);
  assert.match(r.meta.doubleCountGuard, /nicht addiert/);
});

test('Ohne kombiniertes Tag werden Goodwill und Intangibles addiert (period-keyed)', () => {
  const f = facts({
    Goodwill:                             [stock(2024, 3000), stock(2023, 2900)],
    IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000), stock(2023, 1900)]
  });
  const e = buildExtracted(f, ['goodwill_and_intangibles_combined', 'goodwill', 'intangibles_ex_goodwill']);
  const r = A._deriveGoodwillIntangibles(e);
  assert.deepEqual(r.values, [5000, 4800]);   // 3000+2000 · 2900+1900
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31']);
  assert.equal(r.meta.partialPeriods, null);
});

test('Goodwill-Summe: fehlendes Komponentenjahr verschiebt die Reihen nicht', () => {
  // Intangibles fehlen für FY2023
  const f = facts({
    Goodwill:                             [stock(2024, 3000), stock(2023, 2900)],
    IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000)]
  });
  const e = buildExtracted(f, ['goodwill_and_intangibles_combined', 'goodwill', 'intangibles_ex_goodwill']);
  const r = A._deriveGoodwillIntangibles(e);
  assert.deepEqual(r.values, [5000, 2900]);  // FY2023 = nur Goodwill, NICHT 2900+2000
  assert.equal(r.meta.confidenceHint, 'medium');
  assert.ok(r.meta.partialPeriods.some(p => p.startsWith('2023-12-31')));
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Tangible Book Value
// ═════════════════════════════════════════════════════════════════════════════
// ERWARTUNG GEÄNDERT (V1.0.38, fachlich begründet): Vorher ergab eine
// Teilsumme (nur Goodwill, Intangibles ex Goodwill nicht berichtet) einen
// regulären TBV von 9000 bzw. 7500. Genau das war Fehler 2 — der Abzug ist
// dann stillschweigend zu klein und der TBV zu hoch. Ohne vollständige
// Abzugsgröße ist TBV nicht berechenbar.
test('TBV: unvollständige Abzugsgröße ergibt null (weder Equity noch Teilsummen-TBV)', () => {
  const f = facts({
    StockholdersEquity: [stock(2024, 12000), stock(2023, 11000), stock(2022, 10000)],
    Goodwill:           [stock(2024, 3000),  stock(2022, 2500)]
  });
  const e = buildExtracted(f, ['total_equity', 'goodwill', 'intangibles_ex_goodwill',
                               'goodwill_and_intangibles_combined']);
  e.goodwill_and_intangibles = A._deriveGoodwillIntangibles(e);
  const r = A._deriveTangibleBookValue(e);
  // Intangibles ex Goodwill sind in keiner Periode berichtet → jede Periode
  // ist nur eine Teilsumme → kein TBV.
  assert.deepEqual(r.values, [null, null, null]);
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31', '2022-12-31']);
  assert.notEqual(r.values[0], 9000, 'Teilsumme darf keinen regulären TBV speisen');
  assert.notEqual(r.values[1], 11000, 'fehlender Goodwill darf nicht als 0 durchgehen');
  // Teilsumme bleibt nachrichtlich erhalten (union-Modus: nur die beiden
  // Perioden mit Goodwill-Meldung, FY2023 hat gar keine Komponente)
  assert.deepEqual(e.goodwill_and_intangibles.values, [3000, 2500]);
  assert.deepEqual(e.goodwill_and_intangibles.meta.periods, ['2024-12-31', '2022-12-31']);
  assert.match(r.meta.unavailableNote, /nicht berechenbar/);
});

// ── Pflichtfälle aus dem Auftrag (Eigenkapital 12.000) ───────────────────────
test('Fehler 2 Gegenbeispiele: TBV nur bei vollständiger Abzugsgröße', () => {
  const eq = [stock(2024, 12000)];
  const tbvOf = (extra) => {
    const e = buildExtracted(facts(Object.assign({ StockholdersEquity: eq }, extra)),
      ['total_equity', 'goodwill', 'intangibles_ex_goodwill', 'goodwill_and_intangibles_combined']);
    e.goodwill_and_intangibles = A._deriveGoodwillIntangibles(e);
    return { tbv: A._deriveTangibleBookValue(e).values, gwi: e.goodwill_and_intangibles.values };
  };
  // a) Goodwill 3000, sonstige immaterielle Werte unbekannt → TBV null
  assert.deepEqual(tbvOf({ Goodwill: [stock(2024, 3000)] }).tbv, [null]);
  // b) Goodwill 3000, sonstige immaterielle Werte ausdrücklich 0 → 12000−3000 = 9000
  assert.deepEqual(tbvOf({ Goodwill: [stock(2024, 3000)],
                           IntangibleAssetsNetExcludingGoodwill: [stock(2024, 0)] }).tbv, [9000]);
  // c) Goodwill 3000, sonstige immaterielle Werte 2000 → 12000−5000 = 7000
  assert.deepEqual(tbvOf({ Goodwill: [stock(2024, 3000)],
                           IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000)] }).tbv, [7000]);
  // d) vollständiges kombiniertes Tag 5000 → 12000−5000 = 7000, keine Doppelzählung
  const comb = tbvOf({ IntangibleAssetsNetIncludingGoodwill: [stock(2024, 5000)],
                       Goodwill: [stock(2024, 3000)],
                       IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000)] });
  assert.deepEqual(comb.gwi, [5000]);
  assert.deepEqual(comb.tbv, [7000]);
  // e) spiegelbildlich: Goodwill unbekannt, Intangibles 2000 → TBV null
  assert.deepEqual(tbvOf({ IntangibleAssetsNetExcludingGoodwill: [stock(2024, 2000)] }).tbv, [null]);
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. Period-Alignment-Gate auf abgeleiteten Metadaten
// ═════════════════════════════════════════════════════════════════════════════
test('Abgeleitete Serien liefern periods-Meta für das Period-Alignment-Gate', () => {
  const f = facts({
    OperatingIncomeLoss: [flow(2024, 1200), flow(2023, 1100)],
    DepreciationDepletionAndAmortization: [flow(2024, 300), flow(2023, 280)],
    StockholdersEquity: [stock(2024, 12000)],
    Goodwill: [stock(2024, 3000)]
  });
  const e = buildExtracted(f, ['ebit', 'da', 'total_equity', 'goodwill',
                               'intangibles_ex_goodwill', 'goodwill_and_intangibles_combined',
                               'pretax_income', 'interest_expense', 'interest_income']);
  A._applySecDerivations(e);
  assert.deepEqual(e.ebitda.meta.periods, ['2024-12-31', '2023-12-31']);
  assert.deepEqual(e.tangible_book_value.meta.periods, ['2024-12-31']);

  // Gate sieht konsistente Jahre
  const mj = { fundamentals: {
    revenue: [5000], ebit: e.ebit.values, tangible_book_value: e.tangible_book_value.values,
    _v4_meta: {
      revenue: { periods: ['2024-12-31'] },
      ebit:    { periods: e.ebit.meta.periods },
      tangible_book_value: { periods: e.tangible_book_value.meta.periods }
    }
  } };
  assert.equal(A.validatePeriodAlignment(mj).ok, true);
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. _joinPeriodKeyed direkt
// ═════════════════════════════════════════════════════════════════════════════
test('_joinPeriodKeyed: union-Modus behält Perioden beider Serien', () => {
  const a = { values: [10, 20], meta: { periods: ['2024-12-31', '2022-12-31'], isFlowConcept: false, unit: 'USD' } };
  const b = { values: [5],      meta: { periods: ['2023-12-31'], isFlowConcept: false, unit: 'USD' } };
  const r = A._joinPeriodKeyed(
    [{ name: 'a', values: a.values, meta: a.meta, required: false },
     { name: 'b', values: b.values, meta: b.meta, required: false }],
    (v) => (v.a != null ? v.a : 0) + (v.b != null ? v.b : 0),
    { label: 'test', mode: 'union' }
  );
  assert.deepEqual(r.meta.periods, ['2024-12-31', '2023-12-31', '2022-12-31']);
  assert.deepEqual(r.values, [10, 5, 20]);
});

test('_joinPeriodKeyed: ohne periods-Meta wird nicht auf Index zurückgefallen', () => {
  const r = A._joinPeriodKeyed(
    [{ name: 'a', values: [10, 20], meta: {} },
     { name: 'b', values: [1, 2],   meta: {} }],
    (v) => (v.a != null && v.b != null) ? v.a + v.b : null,
    { label: 'test' }
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.values, []);
});
