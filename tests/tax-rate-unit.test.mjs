// ─────────────────────────────────────────────────────────────────────────────
// V1.0.83 · Steuerquote bleibt bei „Neu berechnen“ in Prozentpunkten.
//
// Befund der Praxisabnahme (CRH, FY2025): Der Import setzt
// wacc_components.tax_rate = 21.71 (Prozentpunkte, wie DCF_CORE_UNITS und alle
// Verbraucher `1 − taxRate / 100` erwarten). recalcFromAssumptions las das Feld
// as-tax aber mit normalizeDecimalRateInput (fuer RF/ERP/CoD gedacht) und
// schrieb 0.2171 zurueck. Gemessen auf a52897b mit dem produktiven Import:
// DCF 91.68 je Aktie nach dem Import, 124.09 nach „Neu berechnen“ ohne jede
// Aenderung (Kern rechnet mit 0,2171 % Steuern); tax_rate zudem als „manuell“
// markiert. Der Browser-Ablauf steht in tests/browser/acceptance.mjs §15.
// V1.0.85: Einheit eindeutig Prozent (Tests 2, 3, 3b, 3c); Browser §17.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();

test('1 · Prozentangabe bleibt exakt erhalten (kein Bruch, keine Rundtrip-Abweichung)', () => {
  for (const x of [21.71, 25, 21, 35.5, 100]) {
    const r = S.normalizeTaxRatePctInput(x);
    assert.equal(r.value, x, String(x));
  }
});

// V1.0.85: Das Feld zeigt den gespeicherten Wert in Prozent; die Eingabe ist
// ausdruecklich Prozent. V1.0.83 deutete Werte ≤ 1 als Bruch, sodass ein
// unveraendertes „Neu berechnen“ aus 0,5 % 50 % und aus 1 % 100 % machte.
// Die bisherige Erwartung „0.2171 ⇒ 21.71“ schrieb genau diesen Fehler fest und
// ist bewusst ersetzt.
test('2 · Prozent bleibt Prozent — auch fuer Werte ≤ 1 (keine Deutung nach Groessenordnung)', () => {
  for (const x of [0, 0.5, 1, 0.2171, 21.71, 35, 100]) {
    assert.equal(S.normalizeTaxRatePctInput(x).value, x, String(x));
    assert.equal(S.normalizeTaxRatePctInput(String(x)).value, x, 'Text ' + x);
  }
});

test('3 · Wertebereich: negativ, > 100, leer, nicht numerisch, unendlich ⇒ nicht uebernommen', () => {
  for (const x of [-0.01, -5, 100.01, 150, '', 'abc', null, undefined, Infinity, -Infinity, NaN]) {
    assert.equal(S.normalizeTaxRatePctInput(x).value, null, String(x));
  }
  assert.match(S.normalizeTaxRatePctInput(-1).warning, /Negative/);
  assert.match(S.normalizeTaxRatePctInput(150).warning, /> 100 %/);
  assert.equal(S.normalizeTaxRatePctInput(21.71).warning, null);
  assert.match(S.normalizeTaxRatePctInput(35).warning, /> 30 %/);
});

test('3b · Rundlauf Anzeige → Uebernahme: der angezeigte Wert ergibt denselben gespeicherten Wert', () => {
  for (const stored of [0, 0.5, 1, 21.71, 35]) {
    const shown = String(stored);                 // Feld as-tax zeigt den gespeicherten Wert unveraendert
    const again = S.normalizeTaxRatePctInput(parseFloat(shown)).value;
    assert.equal(again, stored, String(stored));
    assert.equal(S.normalizeTaxRatePctInput(String(again)).value, stored, 'zweiter Lauf ' + stored);
  }
});

test('3c · Feld as-tax: Beschriftung in %, Wert 0 wird angezeigt (keine leere Nullanzeige)', () => {
  const src = S.renderAssumptions.toString();
  assert.match(src, /Steuerquote \(%\)/);
  assert.doesNotMatch(src, /Tax Rate \(dez\. oder %\)/);
  assert.doesNotMatch(src, /'tax_rate'\], ''\) \|\| ''/);
});

test('4 · RF/ERP/CoD bleiben Brueche (Gegenprobe, unveraendert)', () => {
  assert.ok(Math.abs(S.normalizeDecimalRateInput(4.3).value - 0.043) < 1e-12);
  assert.equal(S.normalizeDecimalRateInput(0.06).value, 0.06);
});

test('5 · recalcFromAssumptions liest as-tax als Prozentpunkte, RF/ERP/CoD weiter als Bruch', () => {
  const src = S.recalcFromAssumptions.toString();
  const line = (id) => (src.match(new RegExp("\\{ id: '" + id + "'[^}]*\\}")) || [''])[0];
  assert.match(line('as-tax'), /normalize: 'pct_points'/);
  assert.doesNotMatch(line('as-tax'), /normalize: 'rate'/);
  for (const id of ['as-rf', 'as-erp', 'as-kd']) assert.match(line(id), /normalize: 'rate'/, id);
  assert.match(src, /f\.normalize === 'pct_points'[\s\S]{0,200}normalizeTaxRatePctInput\(raw\)/);
});

test('6 · Kern: die zurueckgeschriebene Steuerquote ist dieselbe Prozentzahl wie nach dem Import', () => {
  const mj = { fundamentals: { revenue: [1000, 950], ebit: [150, 140], capex: [50, 48], ebitda: [200, 188],
    shares_diluted: [100, 101] }, valuation: { wacc_components: { tax_rate: 21.71 } } };
  const imported = S.buildForecastInputs(mj).taxRate;
  mj.valuation.wacc_components.tax_rate = S.normalizeTaxRatePctInput(21.71).value;
  assert.equal(S.buildForecastInputs(mj).taxRate, imported);
  assert.equal(imported, 21.71);
  // Fehlerbild bis V1.0.82: normalizeDecimalRateInput(21.71) = 0.2171 ⇒ Kern rechnet 0,2171 %.
  assert.ok(Math.abs(S.normalizeDecimalRateInput(21.71).value - 0.2171) < 1e-12);
});
