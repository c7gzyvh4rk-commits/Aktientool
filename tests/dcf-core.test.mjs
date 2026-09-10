// Tests des Bewertungskerns als Modul — ohne Browser, ohne DOM.
// Geladen wird der markierte DCF-CORE-BLOCK aus der ausgelieferten
// HTML-Datei (src/dcf-core.js), nicht eine Kopie der Logik.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const { loadDcfCore } = require(join(HERE, '..', 'src', 'dcf-core.js'));

// realm:'this' → Arrays/Objekte sind deepStrictEqual-kompatibel.
const core = loadDcfCore({ realm: 'this' });

// ── Fixture ────────────────────────────────────────────────────────────────
// Bewusst glatte Zahlen, damit die Erwartungswerte unabhängig herleitbar sind:
//   Umsatz_0 1000 · EBIT_0 200 (Marge 20 %) · EBITDA_0 250 (D&A 5 %)
//   CapEx_0 50 (5 %) · Steuerquote 25 % · 100 Mio. Aktien, konstant
//   Schulden 200, Liquidität 100 ⇒ Nettoschulden 100 Mio. ⇒ 1,00 USD/Aktie
// ⇒ FCFF_t = 0,20·0,75·Umsatz + 0,05·Umsatz − 0,05·Umsatz = 0,15 · Umsatz_t
const mkMj = (over = {}) => ({
  schema_version: '4.0',
  meta: { ticker: 'CORE', company_name: 'Core Test', country: 'US', currency: 'USD',
          as_of_date: '2025-12-31', sub_classification: 'standard_nonfin' },
  fundamentals: {
    revenue: [1000, 900, 800, 700], ebit: [200, 180, 160, 140],
    ebitda: [250, 225, 200, 175], capex: [50, 45, 40, 35],
    shares_diluted: [100, 100, 100, 100],
    total_debt: [200, 200, 200, 200], cash_and_equivalents: [100, 100, 100, 100],
    ...(over.fundamentals || {})
  },
  valuation: {
    growth_stage1: 8, growth_terminal: 2, wacc_derived: 10,
    wacc_components: { tax_rate: 25 }, fade: { enabled: false },
    ...(over.valuation || {})
  },
  market: { price: 20, ...(over.market || {}) }
});

const near = (a, b, tol = 1e-9) => assert.ok(
  a != null && Number.isFinite(a) && Math.abs(a - b) <= tol,
  `erwartet ~${b}, erhalten ${a}`);

// ── Einheitengrenze ────────────────────────────────────────────────────────
test('normalizeDcfCoreInput liefert ein vollständiges Inputobjekt', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  assert.equal(n.ok, true);
  assert.equal(n.input.units.money, 'million_usd');
  assert.equal(n.input.units.shares, 'million_shares');
  assert.equal(n.input.units.rates, 'percent_points');
  assert.equal(n.input.units.derivedRatios, 'fraction_of_revenue');
  assert.equal(n.input.units.forecastYears, 10);
  // Alles zum Rechnen Nötige steckt im Objekt.
  assert.ok(n.input.ctx && n.input.ctx.ok);
  assert.ok(n.input.scenarios && n.input.scenarios.base);
  assert.equal(n.input.pricePerShare, 20);
  assert.deepEqual(n.input.activeModels, ['dcf']);
});

test('fehlende Inputs ⇒ ok:false mit benannten Feldern, keine Ersatzwerte', () => {
  const mj = mkMj();
  mj.fundamentals.revenue = [];
  const n = core.normalizeDcfCoreInput(mj, {});
  assert.equal(n.ok, false);
  assert.equal(n.input, null);
  assert.ok(Array.isArray(n.diagnostics.missing));
  assert.ok(n.reason && n.reason.length > 0);
});

test('Grenze rechnet Brüche NICHT still in Prozentpunkte um, sondern meldet sie', () => {
  const mj = mkMj({ valuation: { wacc_derived: 0.10, growth_terminal: 0.02 } });
  const n = core.normalizeDcfCoreInput(mj, {});
  assert.equal(n.ok, true);
  const felder = n.diagnostics.unitWarnings.map(w => w.field);
  assert.ok(felder.includes('valuation.wacc_derived'), JSON.stringify(felder));
  assert.ok(felder.includes('valuation.growth_terminal'), JSON.stringify(felder));
  // Unverändert weitergereicht — eine stille Umdeutung würde Ergebnisse verschieben.
  assert.equal(n.input.scenarios.base.wacc, 0.10);
  assert.equal(n.input.scenarios.base.terminal_growth, 0.02);
});

test('0 ist kein Einheitenverdacht', () => {
  const mj = mkMj({ valuation: { growth_stage1: 0 } });
  const n = core.normalizeDcfCoreInput(mj, {});
  assert.equal(n.diagnostics.unitWarnings.some(w => w.field === 'valuation.growth_stage1'), false);
});

test('bislang stille Ersatzwerte werden als appliedDefaults ausgewiesen', () => {
  const mj = mkMj();
  delete mj.valuation.wacc_components.tax_rate;   // Kern rechnet unverändert mit 25 %
  const n = core.normalizeDcfCoreInput(mj, {});
  const felder = n.diagnostics.appliedDefaults.map(d => d.field);
  assert.ok(felder.includes('valuation.wacc_components.tax_rate'), JSON.stringify(felder));
  const eintrag = n.diagnostics.appliedDefaults.find(d => d.field === 'valuation.wacc_components.tax_rate');
  assert.equal(eintrag.value, 25);
  assert.equal(eintrag.unit, 'percent_points');
  // Working Capital ohne Historie: ebenfalls ausgewiesen, nicht versteckt.
  assert.ok(felder.includes('valuation.assumptions.owc_pct_of_revenue'), JSON.stringify(felder));
});

// ── Rechenkern ─────────────────────────────────────────────────────────────
test('Prognosereihe entspricht der handgerechneten Erwartung', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  const r = core.forecastDcfCore(n.input.ctx.fi, 8, 2, 10, { enabled: false }, 20);
  near(r._revenuePerYearAbs[1], 1080);
  near(r._ebitPerYearAbs[1], 216);
  near(r._fcfPerYearAbs[1], 162);
  near(r._revenuePerYearAbs[2], 1166.4);
  near(r._fcfPerYearAbs[2], 174.96);
  near(r._revenueYear10, 1000 * Math.pow(1.08, 10));
});

test('Nettoschuldenbrücke: operativer Wert minus 1,00 USD/Aktie', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  const d = core.coreValuationDetail(n.input.ctx, 8, 2, 10, 20);
  assert.ok(d);
  near(d.netDebtPerShare, 1.0);                       // (200 − 100) / 100
  near(d.equityValuePerShare, d.operatingValuePerShare - 1.0);
  assert.equal(d.netDebtApplied, true);
});

test('fehlende Nettoschulden ⇒ kein Eigenkapitalwert, kein 0-Ersatz', () => {
  const mj = mkMj();
  delete mj.fundamentals.total_debt;
  delete mj.fundamentals.cash_and_equivalents;
  const n = core.normalizeDcfCoreInput(mj, {});
  const d = core.coreValuationDetail(n.input.ctx, 8, 2, 10, 20);
  assert.ok(d);
  assert.equal(d.equityValuePerShare, null);
  assert.ok(d.operatingValuePerShare > 0);
  assert.match(d.equityValueUnavailableReason, /NICHT als 0/);
});

test('WACC ≤ Terminalwachstum ⇒ null statt Ersatzwert', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  assert.equal(core.coreValuationDetail(n.input.ctx, 8, 10, 10, 20), null);
  assert.equal(core.coreValuationDetail(n.input.ctx, 8, 12, 10, 20), null);
});

// ── Einstiegspunkt ─────────────────────────────────────────────────────────
test('runDcfCoreAnalysis liefert Bewertung, Reverse DCF und Matrix', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  const r = core.runDcfCoreAnalysis(n.input);
  assert.equal(r.ok, true);
  assert.equal(r.modelVersion, core.DCF_CORE_MODEL_VERSION);
  assert.ok(r.valuation.base);
  assert.ok(Number.isFinite(r.valuation.equityValuePerShare));
  assert.ok(r.reverseDcf && typeof r.reverseDcf.status === 'string');
  assert.equal(r.sensitivity.available, true);
  assert.ok(Array.isArray(r.sensitivity.cells) && r.sensitivity.cells.length > 0);
  assert.ok(Array.isArray(r.diagnostics.notes));
});

test('Einstiegspunkt liefert dieselben Zahlen wie die Einzelbausteine', () => {
  const mj = mkMj();
  const n = core.normalizeDcfCoreInput(mj, {});
  const r = core.runDcfCoreAnalysis(n.input);

  const sc = n.input.scenarios.base;
  const direkt = core.coreValuationDetail(n.input.ctx, sc.growth_stage1, sc.terminal_growth, sc.wacc, sc.op_margin_pct);
  assert.equal(r.valuation.equityValuePerShare, direkt.equityValuePerShare);
  assert.equal(r.valuation.operatingValuePerShare, direkt.operatingValuePerShare);

  const revDirekt = core.solveReverseDcfGrowth(n.input.source, {
    opMarginOverridePct: null, marginBasis: n.input.marginBasis,
    targetPricePerShare: n.input.targetPricePerShare, opMarginPct: sc.op_margin_pct });
  assert.equal(r.reverseDcf.status, revDirekt.status);
  assert.equal(r.reverseDcf.impliedGrowthPct, revDirekt.impliedGrowthPct);

  const mtxDirekt = core.computeSensitivityMatrix(n.input.source, {
    error: null, scenarios: { base: sc },
    router: { activeModels: ['dcf'], subClassification: 'standard_nonfin' },
    _coreOpts: { opMarginOverridePct: null, marginBasis: n.input.marginBasis } });
  assert.equal(r.sensitivity.baseValue, mtxDirekt.baseValue);
  assert.deepEqual(r.sensitivity.cells, mtxDirekt.cells);
});

test('which steuert, was gerechnet wird', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  const nur = core.runDcfCoreAnalysis(n.input, { valuation: true, reverseDcf: false, sensitivity: false });
  assert.ok(nur.valuation);
  assert.equal(nur.reverseDcf, null);
  assert.equal(nur.sensitivity, null);
});

test('der Kern verändert sein Inputobjekt nicht', () => {
  const mj = mkMj();
  const vorher = JSON.stringify(mj);
  const n = core.normalizeDcfCoreInput(mj, {});
  const quelleVorher = JSON.stringify(n.input.source);
  core.runDcfCoreAnalysis(n.input);
  assert.equal(JSON.stringify(mj), vorher);
  assert.equal(JSON.stringify(n.input.source), quelleVorher);
});

test('gleiche Eingabe ⇒ bitgleiche Ausgabe (deterministisch)', () => {
  const a = core.analyzeDcfFromMasterJson(mkMj(), {});
  const b = core.analyzeDcfFromMasterJson(mkMj(), {});
  assert.equal(JSON.stringify(a.valuation), JSON.stringify(b.valuation));
  assert.equal(JSON.stringify(a.sensitivity), JSON.stringify(b.sensitivity));
  assert.equal(a.reverseDcf.impliedGrowthPct, b.reverseDcf.impliedGrowthPct);
});

test('analyzeDcfFromMasterJson meldet unbrauchbare Eingaben statt zu werfen', () => {
  const r = core.analyzeDcfFromMasterJson(null, {});
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.errors.length > 0);
  assert.equal(r.valuation, null);
});

test('Mid-Cycle-Marge wird als Override durchgereicht', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), { opMarginOverridePct: 15, marginBasis: 'midcycle_median' });
  assert.equal(n.input.opMarginOverridePct, 15);
  assert.equal(n.input.marginBasis, 'midcycle_median');
  const d = core.coreValuationDetail(n.input.ctx, 8, 2, 10, 20);   // 20 wird ignoriert
  assert.equal(d.opMarginPctUsed, 15);
});
