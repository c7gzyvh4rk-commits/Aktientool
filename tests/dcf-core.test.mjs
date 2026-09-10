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

// ═══════════════════════════════════════════════════════════════════════════
// V1.0.48 — Reparatur der drei gemeldeten Schnittstellenfehler
// ═══════════════════════════════════════════════════════════════════════════

// Zentrale Zelle der Sensitivitätsmatrix (Base-WACC × Base-g1).
const mittelzelle = (m) => {
  const wi = m.waccStepsPct.findIndex(w => Math.abs(w - m.baseWaccPct) < 1e-9);
  const gi = m.g1StepsPct.findIndex(g => Math.abs(g - m.baseG1Pct) < 1e-9);
  return (wi >= 0 && gi >= 0) ? m.cells[wi][gi] : null;
};

// ── Fehler 1: unterschiedliche Szenarioannahmen ────────────────────────────
// Gemeldet: Master-JSON trägt 10 % WACC, über options.scenarios.base werden
// 12 % übergeben. DCF ergab 21,9830750630, die zentrale Matrixzelle dagegen
// 28,4977840857 (der Master-JSON-Wert), und der Reverse DCF rechnete weiter
// mit 10 % und lieferte 4,5581359863 % statt 8 %.

test('F1: DCF und zentrale Matrixzelle verwenden denselben Base-WACC', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {
    scenarios: { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: null } } });
  const r = core.runDcfCoreAnalysis(n.input);
  const zelle = mittelzelle(r.sensitivity);
  // Der DCF-Wert bei 12 % WACC ist unabhängig nachgerechnet der gemeldete.
  near(r.valuation.equityValuePerShare, 21.983075063, 1e-9);
  assert.equal(zelle, r.valuation.equityValuePerShare);
  // Und ausdrücklich NICHT der Master-JSON-Wert aus dem Fehlerbericht.
  assert.notEqual(Number(zelle.toFixed(10)), 28.4977840857);
  assert.equal(r.sensitivity.baseWaccPct, 12);
  assert.equal(r.sensitivity.baseG1Pct, 8);
});

test('F1: Reverse DCF gewinnt 8 % innerhalb der Solvertoleranz zurück', () => {
  const scen = { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: null } };
  const nA = core.normalizeDcfCoreInput(mkMj(), { scenarios: scen });
  const dcf = core.runDcfCoreAnalysis(nA.input).valuation.equityValuePerShare;
  const nB = core.normalizeDcfCoreInput(mkMj(), { scenarios: scen, targetPricePerShare: dcf });
  const r = core.runDcfCoreAnalysis(nB.input);
  assert.equal(r.reverseDcf.status, 'ok');
  assert.equal(r.reverseDcf.wacc, 12);                     // nicht mehr 10
  const tol = core.REVERSE_DCF_SEARCH.tolerancePp;
  assert.ok(Math.abs(r.reverseDcf.impliedGrowthPct - 8) <= tol,
    `erwartet 8 ± ${tol}, erhalten ${r.reverseDcf.impliedGrowthPct}`);
});

test('F1: abweichendes Terminalwachstum wirkt in allen drei Berechnungen', () => {
  const scen = { base: { growth_stage1: 8, terminal_growth: 4, wacc: 12, op_margin_pct: null } };
  const nA = core.normalizeDcfCoreInput(mkMj(), { scenarios: scen });
  const rA = core.runDcfCoreAnalysis(nA.input);
  assert.equal(rA.sensitivity.terminalGrowthPct, 4);
  assert.equal(mittelzelle(rA.sensitivity), rA.valuation.equityValuePerShare);
  // Höheres Terminalwachstum ⇒ höherer Wert als mit tg = 2 bei sonst gleichen Annahmen.
  const rRef = core.runDcfCoreAnalysis(core.normalizeDcfCoreInput(mkMj(), {
    scenarios: { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: null } } }).input);
  assert.ok(rA.valuation.equityValuePerShare > rRef.valuation.equityValuePerShare);
  const nB = core.normalizeDcfCoreInput(mkMj(), {
    scenarios: scen, targetPricePerShare: rA.valuation.equityValuePerShare });
  const rB = core.runDcfCoreAnalysis(nB.input);
  assert.equal(rB.reverseDcf.terminalGrowth, 4);
  assert.ok(Math.abs(rB.reverseDcf.impliedGrowthPct - 8) <= core.REVERSE_DCF_SEARCH.tolerancePp);
});

test('F1: explizite Marge wirkt in DCF, Matrix und Reverse DCF gleich', () => {
  const scen = { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: 15 } };
  const nA = core.normalizeDcfCoreInput(mkMj(), { scenarios: scen });
  const rA = core.runDcfCoreAnalysis(nA.input);
  assert.equal(rA.sensitivity.opMarginPctUsed, 15);
  assert.equal(mittelzelle(rA.sensitivity), rA.valuation.equityValuePerShare);
  // Niedrigere Marge ⇒ niedrigerer Wert als mit der Ist-Marge von 20 %.
  const rRef = core.runDcfCoreAnalysis(core.normalizeDcfCoreInput(mkMj(), {
    scenarios: { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: 20 } } }).input);
  assert.ok(rA.valuation.equityValuePerShare < rRef.valuation.equityValuePerShare);
  const nB = core.normalizeDcfCoreInput(mkMj(), {
    scenarios: scen, targetPricePerShare: rA.valuation.equityValuePerShare });
  const rB = core.runDcfCoreAnalysis(nB.input);
  assert.equal(rB.reverseDcf.opMarginPctUsed, 15);
  assert.ok(Math.abs(rB.reverseDcf.impliedGrowthPct - 8) <= core.REVERSE_DCF_SEARCH.tolerancePp);
});

test('F1: opMarginOverridePct schlägt bis in die Matrix durch', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), { opMarginOverridePct: 15, marginBasis: 'override' });
  const r = core.runDcfCoreAnalysis(n.input);
  assert.equal(n.input.effectiveBase.op_margin_pct, 15);
  assert.equal(n.input.effectiveBase.source.op_margin_pct, 'options.opMarginOverridePct');
  assert.equal(r.sensitivity.opMarginPctUsed, 15);
  assert.equal(mittelzelle(r.sensitivity), r.valuation.equityValuePerShare);
});

test('F1: die wirksamen Annahmen werden ausdrücklich ausgewiesen', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {
    scenarios: { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: null } } });
  assert.deepEqual(
    { g: n.input.effectiveBase.growth_stage1, tg: n.input.effectiveBase.terminal_growth,
      w: n.input.effectiveBase.wacc, m: n.input.effectiveBase.op_margin_pct },
    { g: 8, tg: 2, w: 12, m: null });
  // Herkunft je Feld: WACC aus den Optionen, alles Übrige ebenfalls übergeben.
  assert.equal(n.input.effectiveBase.source.wacc, 'options.scenarios.base');
  assert.equal(n.input.effectiveBase.marginBasis, 'scenario');
  // Feldweiser Rückfall: nur WACC übergeben ⇒ Rest aus dem Master-JSON.
  const nTeil = core.normalizeDcfCoreInput(mkMj(), { scenarios: { base: { wacc: 12 } } });
  assert.equal(nTeil.input.effectiveBase.wacc, 12);
  assert.equal(nTeil.input.effectiveBase.growth_stage1, 8);
  assert.equal(nTeil.input.effectiveBase.terminal_growth, 2);
  assert.equal(nTeil.input.effectiveBase.source.growth_stage1, 'master_json');
});

test('F1: ohne Overrides bleibt das bisherige Verhalten unverändert', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  const r = core.runDcfCoreAnalysis(n.input);
  near(r.valuation.equityValuePerShare, 28.497784085663053, 1e-12);
  assert.equal(mittelzelle(r.sensitivity), r.valuation.equityValuePerShare);
  assert.equal(r.sensitivity.baseWaccPct, 10);
  assert.equal(n.input.effectiveBase.source.wacc, 'master_json');
});

// ── Fehler 2: Mid-Cycle-Pfad im isolierten Modul ───────────────────────────
// Gemeldet: loadDcfCore().analyzeDcfFromMasterJson(mj, {activeModels:
// ['dcf_midcycle']}) scheiterte mit "computeMidCycleFcf is not defined".

// 6 Jahre Historie; Margen 20/16/15/20/15/20 % ⇒ Median 18 %, CapEx konstant 5 %.
const mkMidMj = () => ({
  schema_version: '4.0',
  meta: { ticker: 'MID', sub_classification: 'standard_nonfin' },
  fundamentals: {
    revenue: [1000, 950, 900, 850, 800, 750],
    ebit:    [200, 152, 135, 170, 120, 150],
    ebitda:  [250, 202, 185, 220, 170, 200],
    capex:   [50, 47.5, 45, 42.5, 40, 37.5],
    shares_diluted: [100, 100, 100, 100, 100, 100],
    total_debt: [200, 200, 200, 200, 200, 200],
    cash_and_equivalents: [100, 100, 100, 100, 100, 100]
  },
  valuation: { growth_stage1: 8, growth_terminal: 2, wacc_derived: 10,
               wacc_components: { tax_rate: 25 }, fade: { enabled: false } },
  market: { price: 20 }
});

test('F2: Mid-Cycle läuft in der standardmäßig isolierten, leeren Sandbox', () => {
  // Kein realm:'this', keine Browser-Attrappe, kein state — bewusst so.
  const iso = loadDcfCore();
  const r = iso.analyzeDcfFromMasterJson(mkMidMj(), { activeModels: ['dcf_midcycle'] });
  assert.equal(r.ok, true);
  assert.equal(r.sensitivity.available, true);
  assert.equal(r.sensitivity.mode, 'dcf_midcycle');
  assert.ok(Number.isFinite(r.valuation.equityValuePerShare));
});

test('F2: DCF, Matrix und Reverse DCF nutzen dieselbe Mid-Cycle-Margenbasis', () => {
  const n = core.normalizeDcfCoreInput(mkMidMj(), { activeModels: ['dcf_midcycle'] });
  const r = core.runDcfCoreAnalysis(n.input);
  near(n.input.effectiveBase.op_margin_pct, 18, 1e-12);      // Median von 20/16/15/20/15/20
  assert.equal(n.input.effectiveBase.marginBasis, 'midcycle_median');
  assert.equal(n.input.ctx.marginOverridePct, n.input.effectiveBase.op_margin_pct);
  near(r.sensitivity.opMarginPctUsed, 18, 1e-12);
  near(r.reverseDcf.opMarginPctUsed, 18, 1e-12);
  assert.equal(mittelzelle(r.sensitivity), r.valuation.equityValuePerShare);
});

test('F2: Übereinstimmung mit dem vorhandenen Mid-Cycle-Baustein', () => {
  const n = core.normalizeDcfCoreInput(mkMidMj(), { activeModels: ['dcf_midcycle'] });
  // Die Grenze löst die Marge über computeMidCycleFcf() auf — dieselbe
  // Funktion, die auch die Sensitivitätsmatrix verwendet. Fachliche
  // Definition unverändert.
  assert.equal(n.input.midCycle.status, 'ok');
  assert.equal(n.input.effectiveBase.op_margin_pct, n.input.midCycle.opMarginMed);
  const direkt = core.coreValuationDetail(n.input.ctx, 8, 2, 10, null);
  assert.equal(core.runDcfCoreAnalysis(n.input).valuation.equityValuePerShare,
               direkt.equityValuePerShare);
  assert.equal(direkt.opMarginPctUsed, n.input.midCycle.opMarginMed);
});

test('F2: unzureichende Historie ⇒ erklärter Status, kein Rückfall auf den Haupt-DCF', () => {
  const kurz = mkMidMj();
  for (const k of Object.keys(kurz.fundamentals)) kurz.fundamentals[k] = kurz.fundamentals[k].slice(0, 4);
  const r = loadDcfCore().analyzeDcfFromMasterJson(kurz, { activeModels: ['dcf_midcycle'] });
  assert.equal(r.ok, false);
  assert.equal(r.valuation, null);                      // kein stiller Haupt-DCF
  assert.ok(r.diagnostics.errors.some(e => /Mid-Cycle-Marge nicht ableitbar/.test(e)),
    JSON.stringify(r.diagnostics.errors));
  assert.equal(r.diagnostics.midCycle.status, 'insufficient_data');
  assert.match(r.diagnostics.midCycle.reason, /5 Jahren/);
});

test('F2: computeMidCycleFcf steht in der deklarierten Helferliste', () => {
  assert.ok(core.DCF_CORE_REQUIRED_HELPERS.includes('computeMidCycleFcf'),
    core.DCF_CORE_REQUIRED_HELPERS.join(', '));
});

// ── Fehler 3: normalisierte Inputs hingen am Original ──────────────────────
// Gemeldet: nach Änderung von fundamentals.total_debt[0] im ORIGINAL blieb der
// DCF bei 28,4977840857, die zentrale Matrixzelle fiel auf 18,4977840857.

test('F3: Änderung am Original erreicht ein bereits normalisiertes Input nicht', () => {
  const orig = mkMj();
  const n = core.normalizeDcfCoreInput(orig, {});
  const vorher = core.runDcfCoreAnalysis(n.input);
  near(vorher.valuation.equityValuePerShare, 28.497784085663053, 1e-12);
  near(mittelzelle(vorher.sensitivity), 28.497784085663053, 1e-12);

  orig.fundamentals.total_debt[0] = 1200;               // nur das Original ändern
  const nachher = core.runDcfCoreAnalysis(n.input);
  assert.equal(nachher.valuation.equityValuePerShare, vorher.valuation.equityValuePerShare);
  assert.equal(mittelzelle(nachher.sensitivity), mittelzelle(vorher.sensitivity));
  assert.equal(nachher.reverseDcf.impliedGrowthPct, vorher.reverseDcf.impliedGrowthPct);
  // Die Datenbasis ist eine eigene Kopie, keine Referenz.
  assert.notEqual(n.input.source.fundamentals, orig.fundamentals);
  assert.equal(n.input.source.fundamentals.total_debt[0], 200);
});

test('F3: erneute Normalisierung berücksichtigt die 1000 Mio. Mehrschulden', () => {
  const orig = mkMj();
  const alt = core.runDcfCoreAnalysis(core.normalizeDcfCoreInput(orig, {}).input);
  orig.fundamentals.total_debt[0] = 1200;
  const n2 = core.normalizeDcfCoreInput(orig, {});
  const neu = core.runDcfCoreAnalysis(n2.input);
  // +1000 Mio. Schulden bei 100 Mio. Aktien ⇒ 10,00 USD je Aktie weniger.
  near(n2.input.ctx.netDebtPerShare, 11, 1e-12);
  near(alt.valuation.equityValuePerShare - neu.valuation.equityValuePerShare, 10, 1e-9);
  near(mittelzelle(alt.sensitivity) - mittelzelle(neu.sensitivity), 10, 1e-9);
  near(neu.valuation.equityValuePerShare, 18.497784085663053, 1e-9);
  assert.equal(mittelzelle(neu.sensitivity), neu.valuation.equityValuePerShare);
});

test('F3: verschachtelte Änderungen an Fundamentaldaten und Optionen wirken nicht zurück', () => {
  const orig = mkMj();
  const optScen = { base: { growth_stage1: 8, terminal_growth: 2, wacc: 12, op_margin_pct: null } };
  const n = core.normalizeDcfCoreInput(orig, { scenarios: optScen });
  const vorher = core.runDcfCoreAnalysis(n.input);

  orig.fundamentals.revenue[0] = 5000;                  // verschachtelt im Original
  orig.valuation.wacc_components.tax_rate = 40;
  optScen.base.wacc = 99;                               // übergebenes Optionsobjekt
  optScen.base.terminal_growth = 7;

  const nachher = core.runDcfCoreAnalysis(n.input);
  assert.equal(nachher.valuation.equityValuePerShare, vorher.valuation.equityValuePerShare);
  assert.equal(mittelzelle(nachher.sensitivity), mittelzelle(vorher.sensitivity));
  assert.equal(n.input.effectiveBase.wacc, 12);
  assert.equal(n.input.effectiveBase.terminal_growth, 2);
  assert.equal(n.input.source.fundamentals.revenue[0], 1000);
  assert.equal(n.input.source.valuation.wacc_components.tax_rate, 25);
});

test('F3: Normalisierung und Berechnung verändern weder Original noch Input', () => {
  const orig = mkMj();
  const origVorher = JSON.stringify(orig);
  const n = core.normalizeDcfCoreInput(orig, {});
  assert.equal(JSON.stringify(orig), origVorher, 'Normalisierung hat das Original verändert');
  const inputVorher = JSON.stringify(n.input.source);
  core.runDcfCoreAnalysis(n.input);
  core.runDcfCoreAnalysis(n.input, { valuation: true, reverseDcf: false, sensitivity: false });
  assert.equal(JSON.stringify(orig), origVorher);
  assert.equal(JSON.stringify(n.input.source), inputVorher);
  // Eingefroren: ein Schreibversuch schlägt im Modul (strict mode) fehl.
  assert.equal(Object.isFrozen(n.input), true);
  assert.equal(Object.isFrozen(n.input.source.fundamentals), true);
  assert.throws(() => { n.input.source.fundamentals.total_debt[0] = 9999; }, TypeError);
});

test('F3: ctx und source stammen aus derselben Datenbasis', () => {
  const n = core.normalizeDcfCoreInput(mkMj(), {});
  // Nettoschulden aus source neu abgeleitet == der in ctx vorberechnete Wert.
  const nd = (n.input.source.fundamentals.total_debt[0] - n.input.source.fundamentals.cash_and_equivalents[0])
             / n.input.source.fundamentals.shares_diluted[0];
  near(n.input.ctx.netDebtPerShare, nd, 1e-12);
  // Umsatzbasis des Forecasts == Umsatz in source.
  near(n.input.ctx.fi.revenue0, n.input.source.fundamentals.revenue[0], 1e-12);
});
