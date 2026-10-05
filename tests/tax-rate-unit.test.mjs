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

test('2 · Bruchangabe (dez.) wird in Prozentpunkte umgerechnet', () => {
  assert.equal(S.normalizeTaxRatePctInput(0.2171).value, 21.71);
  assert.equal(S.normalizeTaxRatePctInput(0.25).value, 25);
  assert.equal(S.normalizeTaxRatePctInput(0.21).value, 21);
  assert.equal(S.normalizeTaxRatePctInput(0).value, 0);
});

test('3 · Wertebereich wie bei den uebrigen Raten: negativ und > 100 unzulaessig', () => {
  assert.equal(S.normalizeTaxRatePctInput(-0.01).value, null);
  assert.equal(S.normalizeTaxRatePctInput(150).value, null);
  assert.equal(S.normalizeTaxRatePctInput('').value, null);
  assert.equal(S.normalizeTaxRatePctInput('abc').value, null);
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
