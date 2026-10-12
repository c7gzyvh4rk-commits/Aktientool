// ─────────────────────────────────────────────────────────────────────────────
// V1.0.86 · WACC rechnet die Steuerquote in Prozentpunkten (wie Kern und Eingabe).
//
// Befund aus dem Review von PR #12: Seit V1.0.85 ist
// valuation.wacc_components.tax_rate in Speicherung, Anzeige und Eingabe
// eindeutig Prozent (0.5 = 0,5 %, 1 = 1 %, 21.71 = 21,71 %). Die drei
// WACC-Pfade deuteten den Wert aber weiter nach der Groessenordnung
// (`tr > 1 ? tr : tr * 100`): 0,5 % wurde zu 50 %, 1 % zu 100 %.
//   applyDerivedFieldsV4   — fuehrende Ableitung (Import, Neuberechnung)
//   deriveCostOfCapital    — Neuberechnung nach Komponenten-Edit (recalcFromAssumptions)
//   validateMasterJson     — Komponentenpruefung (Legacy-Hilfe, nicht im aktiven Importpfad)
// Der Browser-Ablauf steht in tests/browser/acceptance.mjs §18.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();

// Unabhaengige Kontrollrechnung (kein Produktcode): RF 4 %, ERP 6 %, Beta 1
// ⇒ CoE 10 %; Kd vor Steuern 5 %; Gewichte je 50 %.
const COMP = { rf: 0.04, erp: 0.06, beta: 1, kd: 0.05, wd: 0.5, we: 0.5 };
const ctrlWacc = (taxPct, beta = 1) => 0.5 * (4 + beta * 6) + 0.5 * 5 * (1 - taxPct / 100);
const TAXES = [0, 0.5, 1, 1.01, 21.71];
// Das Produkt rundet den WACC auf 4 Nachkommastellen (toFixed(4)) ⇒ halbe letzte Stelle.
const RND = 5e-5 + 1e-12;

test('0 · Kontrollrechnung: die beiden Beispiele des Befunds', () => {
  assert.ok(Math.abs(ctrlWacc(0.5) - 7.4875) < 1e-12);
  assert.ok(Math.abs(ctrlWacc(1) - 7.475) < 1e-12);
});

function mjWith(taxPct, flags, beta = COMP.beta) {
  return {
    schema_version: '4.0',
    meta: { ticker: 'WTAX', currency: 'USD', sub_classification: 'standard_nonfin' },
    market: { price: 50 },
    fundamentals: { revenue: [1000, 950, 900], ebit: [150, 140, 130], shares_diluted: [100, 100, 100] },
    valuation: {
      _derivationFlags: Object.assign({}, flags || {}),
      wacc_components: { risk_free: COMP.rf, risk_free_rate: COMP.rf, equity_risk_premium: COMP.erp, beta,
        cost_of_debt_pretax: COMP.kd, tax_rate: taxPct, debt_weight: COMP.wd, equity_weight: COMP.we }
    }
  };
}

// applyDerivedFieldsV4 wendet danach die bestehende WACC-Untergrenze an
// (max(Sektor 8 %, RF + 4 pp) = 8 % hier; unveraendert). Der aus den
// Komponenten abgeleitete Rohwert steht dann in _heuristicDetails.wacc_floor.previous.
const rawWacc = (mj) => mj.valuation._derivationFlags.wacc_floor_applied
  ? mj.valuation._heuristicDetails.wacc_floor.previous : mj.valuation.wacc_derived;

test('1 · applyDerivedFieldsV4: Beispiel des Befunds — abgeleiteter Rohwert, danach Untergrenze 8 %', () => {
  for (const t of TAXES) {
    const mj = mjWith(t);
    S.applyDerivedFieldsV4(mj);
    assert.equal(mj.valuation._derivationFlags.wacc_derived, 'derived', 'abgeleitet, nicht heuristisch: ' + t);
    assert.equal(mj.valuation.cost_of_equity_derived, 10, 'CoE ' + t);
    assert.ok(Math.abs(rawWacc(mj) - ctrlWacc(t)) < RND, t + ' % ⇒ ' + rawWacc(mj) + ' statt ' + ctrlWacc(t));
    assert.equal(mj.valuation.wacc_derived, 8, 'Untergrenze (unveraenderte Regel) ' + t);
    assert.equal(mj.valuation.wacc_components.tax_rate, t, 'Steuerquote unveraendert gespeichert');
  }
});

test('1b · applyDerivedFieldsV4: WACC oberhalb der Untergrenze direkt aus den Komponenten (Beta 1.5)', () => {
  for (const t of TAXES) {
    const mj = mjWith(t, null, 1.5);
    S.applyDerivedFieldsV4(mj);
    assert.equal(mj.valuation._derivationFlags.wacc_floor_applied, undefined, 'keine Untergrenze ' + t);
    assert.ok(Math.abs(mj.valuation.wacc_derived - ctrlWacc(t, 1.5)) < RND, t + ' % ⇒ ' + mj.valuation.wacc_derived + ' statt ' + ctrlWacc(t, 1.5));
    assert.equal(mj.valuation.wacc_components.derived.wacc, mj.valuation.wacc_derived);
  }
});

test('2 · deriveCostOfCapital: derselbe WACC wie die Kontrollrechnung', () => {
  for (const t of TAXES) {
    const mj = mjWith(t);
    const r = S.deriveCostOfCapital(mj);
    assert.equal(r.wacc, true, 'abgeleitet ' + t);
    assert.ok(Math.abs(mj.valuation.wacc_derived - ctrlWacc(t)) < RND, t + ' % ⇒ ' + mj.valuation.wacc_derived + ' statt ' + ctrlWacc(t));
  }
});

test('3 · validateMasterJson: Komponentenpruefung meldet korrekten WACC nicht als Abweichung', () => {
  const warns = (t, wacc) => {
    const mj = mjWith(t); mj.valuation.wacc_derived = wacc;
    return Array.from(S.validateMasterJson(mj).warnings).filter(w => /WACC-Komponenten/.test(w));
  };
  for (const t of TAXES) {
    assert.deepEqual(warns(t, ctrlWacc(t)), [], 'korrekter WACC ' + t);
  }
  // 6.25 ist der fehlerhafte Wert bei 0,5 % (Steuer als 50 % gelesen) und weicht ab.
  assert.equal(warns(0.5, 6.25).length, 1, '6.25 bei 0,5 % ist falsch');
});

test('3b · Komponentenpruefung: Schwelle 0,5 pp unveraendert (Gegenprobe bei 21,71 %, vorher und nachher gruen)', () => {
  const warns = (t, wacc) => {
    const mj = mjWith(t); mj.valuation.wacc_derived = wacc;
    return Array.from(S.validateMasterJson(mj).warnings).filter(w => /WACC-Komponenten/.test(w));
  };
  assert.deepEqual(warns(21.71, ctrlWacc(21.71)), []);
  assert.equal(warns(21.71, ctrlWacc(21.71) + 0.6).length, 1);
  assert.deepEqual(warns(21.71, ctrlWacc(21.71) + 0.4), []);
});

test('4 · Steueraenderung wirkt in beiden Pfaden in die richtige Richtung', () => {
  for (const fn of ['applyDerivedFieldsV4', 'deriveCostOfCapital']) {
    const w = TAXES.map(t => { const mj = mjWith(t, null, 1.5); S[fn](mj); return mj.valuation.wacc_derived; });
    for (let i = 1; i < w.length; i++) assert.ok(w[i] < w[i - 1], fn + ': hoehere Steuer ⇒ niedrigerer WACC ' + w);
    // 0 % ⇒ WACC = 0.5·13 + 0.5·5 (kein Steuerschild)
    assert.ok(Math.abs(w[0] - 9) < 1e-12, fn);
  }
});

test('5 · manuelle WACC-/CoE-Overrides bleiben erhalten (Gegenprobe, vorher und nachher gruen)', () => {
  for (const fn of ['applyDerivedFieldsV4', 'deriveCostOfCapital']) {
    for (const t of TAXES) {
      const a = mjWith(t, { wacc_derived: 'manual' }); a.valuation.wacc_derived = 8.8;
      S[fn](a);
      assert.equal(a.valuation.wacc_derived, 8.8, fn + ': manueller WACC ' + t);
      assert.equal(a.valuation._derivationFlags.wacc_derived, 'manual', fn);
      const b = mjWith(t, { cost_of_equity_derived: 'manual' }); b.valuation.cost_of_equity_derived = 12;
      S[fn](b);
      assert.equal(b.valuation.cost_of_equity_derived, 12, fn + ': manuelle CoE ' + t);
    }
  }
});

test('5b · WACC aus manueller CoE mit niedriger Steuer: 0.5·12 + 0.5·5·(1 − 0,5 %)', () => {
  for (const fn of ['applyDerivedFieldsV4', 'deriveCostOfCapital']) {
    const b = mjWith(0.5, { cost_of_equity_derived: 'manual' }); b.valuation.cost_of_equity_derived = 12;
    S[fn](b);
    assert.ok(Math.abs(b.valuation.wacc_derived - (6 + 2.5 * 0.995)) < RND, fn + ': ' + b.valuation.wacc_derived);
  }
});

test('6 · keine Groessenordnungs-Heuristik fuer die Steuer mehr in den WACC-Pfaden', () => {
  for (const fn of ['applyDerivedFieldsV4', 'deriveCostOfCapital', 'validateMasterJson']) {
    const src = S[fn].toString();
    assert.doesNotMatch(src, /(tr|tax_rate)\s*>\s*1\s*\?/, fn);
  }
  // Gegenprobe: RF/ERP/CoD und Gewichte unveraendert (Kd bleibt in deriveCostOfCapital „> 1 ? : × 100“).
  assert.match(S.deriveCostOfCapital.toString(), /kd > 1 \? kd : kd \* 100/);
});
