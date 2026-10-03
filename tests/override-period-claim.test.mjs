// ─────────────────────────────────────────────────────────────────────────────
// V1.0.82 · Ersatzreihen duerfen den Periodenkontext nicht loeschen
// (_resolveNetDebtForFlowBasis, gemeinsam fuer Diagnostik, Kern und Growth).
//
// Bis V1.0.81 setzte eine aktive Ersatzreihe (derived.<feld>.override_series)
// fuer ihre Seite nicht nur period: null (richtig: kein fremdes Datum), sondern
// auch hasCtx: false. Waren BEIDE Seiten ersetzt, galt der Fall als vollstaendig
// periodenfrei ⇒ `unverified_manual`, obwohl die ersetzten Reihen datiert waren
// (gemessen auf 00879f6: net_debt 2024-12-31, fcf 2025-12-31, beide ersetzt ⇒
// available: true). Jetzt: Datum nein, Periodenkontext ja ⇒ Sperre mit Grund.
// Unterstuetzte Ersatzfelder: derived.fcf.override_series und
// derived.net_debt.override_series (applyDerivedFieldsV4).
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();
const diag = (f) => S._resolveFcfDiagnosticNetDebt(f, 'fcf');
const both = (ndMeta, fcfMeta) => {
  const f = { net_debt: [4000], fcf: [180], _v4_meta: {},
    derived: { net_debt: { override_series: [4000] }, fcf: { override_series: [180] } } };
  if (ndMeta !== undefined) f._v4_meta.net_debt = ndMeta;
  if (fcfMeta !== undefined) f._v4_meta.fcf = fcfMeta;
  return f;
};

test('1 · kombinierter Fehlerfall (beide ersetzt, ersetzte Reihen 2024/2025): gesperrt statt unverified_manual', () => {
  const r = diag(both({ periods: ['2024-12-31'] }, { periods: ['2025-12-31'] }));
  assert.equal(r.available, false);
  assert.equal(r.blockedBy, 'period');
  assert.notEqual(r.periodCheck, 'unverified_manual');
  assert.equal(r.netDebtM, null);
  assert.match(r.reason, /Ersatzwerte \(net_debt \(manuell gesetzte Ersatzreihe\), fcf \(manuell gesetzte Ersatzreihe\)\) tragen jedoch keinen eigenen Stichtag/);
});

test('2 · beide ersetzt bei urspruenglich passenden Daten: ebenfalls gesperrt (kein eigener Stichtag)', () => {
  const r = diag(both({ periods: ['2025-12-31'] }, { periods: ['2025-12-31'] }));
  assert.equal(r.available, false);
  assert.match(r.reason, /keinen eigenen Stichtag/);
});

test('3 · unbrauchbare Periodenangaben bei beiden Ersatzreihen: kein Altdaten-Rueckfall', () => {
  for (const bad of [{ periods: null }, { periods: '2025-12-31' }, { periods: [] }, { periods: ['2025-02-30'] }]) {
    for (const [nd, fc] of [[bad, bad], [bad, undefined], [undefined, bad]]) {
      const r = diag(both(nd, fc));
      assert.equal(r.available, false, JSON.stringify([nd, fc]));
      assert.notEqual(r.periodCheck, 'unverified_manual');
    }
  }
});

test('4 · einseitige Ersatzreihe neben datierter Gegenseite: weiterhin gesperrt', () => {
  const nd = { net_debt: [4000], fcf: [180], _v4_meta: { net_debt: { periods: ['2025-12-31'] }, fcf: { periods: ['2025-12-31'] } },
    derived: { net_debt: { override_series: [4000] } } };
  assert.match(diag(nd).reason, /der Stichtag der Nettoschulden \(net_debt \(manuell gesetzte Ersatzreihe\)\) ist nicht belegt/);
  const fc = { net_debt: [4000], fcf: [180], _v4_meta: { net_debt: { periods: ['2025-12-31'] }, fcf: { periods: ['2025-12-31'] } },
    derived: { fcf: { override_series: [180] } } };
  assert.match(diag(fc).reason, /der Zeitraum des FCF \(fcf \(manuell gesetzte Ersatzreihe\)\) ist nicht belegt/);
});

test('5 · vollstaendig periodenfreie manuelle Daten mit und ohne Ersatzreihen: verfuegbar, sichtbar unverified_manual', () => {
  for (const derived of [undefined, { net_debt: { override_series: [4000] } }, { fcf: { override_series: [180] } },
                         { net_debt: { override_series: [4000] }, fcf: { override_series: [180] } }]) {
    const f = { net_debt: [4000], fcf: [180], _v4_meta: {} };
    if (derived) f.derived = derived;
    const r = diag(f);
    assert.equal(r.available, true, JSON.stringify(derived));
    assert.equal(r.netDebtM, 4000);
    assert.equal(r.periodCheck, 'unverified_manual');
    assert.match(r.assumption, /NICHT geprueft/);
  }
  // bestehende Ausnahme: leere, vom Import als unavailable markierte Reihe beansprucht nichts
  const g = { net_debt: [4000], fcf: [180], total_debt: [],
    _v4_meta: { total_debt: { source_type: 'unavailable', periods: null, scopeComplete: false } },
    derived: { net_debt: { override_series: [4000] }, fcf: { override_series: [180] } } };
  assert.equal(diag(g).periodCheck, 'unverified_manual');
});

test('6 · gueltige datierte Daten ohne Ersatzreihen unveraendert (inkl. belegte 0 und Nettoliquiditaet)', () => {
  for (const nd of [4000, 0, -500]) {
    const r = diag({ net_debt: [nd], fcf: [180], _v4_meta: { net_debt: { periods: ['2025-12-31'] }, fcf: { periods: ['2025-12-31'] } } });
    assert.equal(r.available, true);
    assert.equal(r.netDebtM, nd);
    assert.equal(r.periodCheck, 'period_checked');
  }
  assert.equal(diag({ net_debt: [4000], fcf: [180], _v4_meta: { net_debt: { periods: ['2024-12-31'] }, fcf: { periods: ['2025-12-31'] } } }).available, false);
});

// ── Produktiver Aufbereitungsweg (Master-JSON-Import: migrateV3toV4 →
//    _enrichLegacyMeta → applyDerivedFieldsV4) bis zur Diagnostik ─────────────
const YE = Array.from({ length: 6 }, (_, i) => `${2025 - i}-12-31`);
function importedMj(ndPeriods) {
  const per = (p) => ({ periods: p.slice(), source_type: 'reported', unit: 'USD' });
  const mj = {
    schema_version: '4.0',
    meta: { ticker: 'OVR', company: 'Override Test', country: 'US', currency: 'USD', sub_classification: 'high_growth' },
    fundamentals: {
      revenue: [1000, 800, 640, 512, 410, 328], ebit: [200, 150, 110, 80, 60, 45], ebitda: [240, 185, 140, 105, 80, 62],
      cfo: [230, 170, 125, 90, 70, 52], capex: [50, 40, 32, 26, 20, 16], fcf: [150, 130, 93, 64, 50, 36],
      net_income: [150, 110, 80, 58, 43, 32], eps_diluted: [1.5, 1.1, 0.8, 0.58, 0.43, 0.32],
      book_value: [2000, 1850, 1740, 1660, 1600, 1560], shares_diluted: Array(6).fill(100), sbc: Array(6).fill(20),
      da: [40, 35, 30, 25, 20, 17], net_debt: [3000],
      _v4_meta: { revenue: per(YE), ebit: per(YE), ebitda: per(YE), cfo: per(YE), capex: per(YE), fcf: per(YE),
                  net_debt: per(ndPeriods) },
      derived: { fcf: { override_series: [180, 130, 93, 64, 50, 36] }, net_debt: { override_series: [4000] } }
    },
    valuation: { wacc_components: { tax_rate: 25 }, fade: { enabled: false }, wacc_derived: 9, growth_terminal: 3, growth_stage1: 15 },
    market: { price: 40 }
  };
  S.migrateV3toV4(mj); S._enrichLegacyMeta(mj); S.applyDerivedFieldsV4(mj);
  return mj;
}

test('produktiver Weg: kombinierter Fehlerfall bis zur Reported-/Owner-FCF-Diagnostik gesperrt', () => {
  for (const ndp of [['2024-12-31'], [YE[0]]]) {
    const mj = importedMj(ndp);
    // Vorbedingung: die unterstuetzten Ersatzreihen sind wirksam
    assert.equal(mj.fundamentals.fcf[0], 180);
    assert.equal(mj.fundamentals.net_debt[0], 4000);
    const r = S.computeReverseDcfFull(mj);
    assert.equal(r.applicable, false, String(ndp));
    assert.equal(r.reverseDcfReported, null);
    assert.equal(r.reverseDcfOwner, null);
    assert.ok(r.scenarioResults.every(sc => sc.impliedGrowthPct == null), 'keine Kursszenarien');
    assert.equal(r.netDebtPeriodBlocked, true);
    assert.match(r.reason, /keinen eigenen Stichtag/);
    const od = S._computeOwnerFcfDcf(mj);
    assert.equal(od.reportedFcfFV, null);
    assert.equal(od.ownerFcfFV, null);
    assert.equal(od.sbcAdjustedFcf, 160, 'SBC-Diagnose bleibt');
    S._ensureGrowthAssumptionsBlock(mj);
    const gr = S.runGrowthCaseEngine(mj);
    assert.equal(gr.verdict, 'MODEL_UNSUITABLE');
    assert.ok(gr.growthCases.every(c => c.fairValuePerShare == null && c.irr == null));
  }
});
