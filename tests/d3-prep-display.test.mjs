// ─────────────────────────────────────────────────────────────────────────────
// D3-Vorbereitung (V1.0.73): zwei Anzeigeabweichungen aus den Realdaten-Replays
//
//  1. MCD: Die Engine berechnet das Diagnosemodell DDM (Router
//     `diagnosticModels`), die Bewertungsansicht ohne Intrinsic-Bewertung
//     (`buildValuationFallback`) liess es im Modell-Status ganz weg.
//  2. JNJ: Ohne EBITDA (kein OperatingIncomeLoss) nannte der Markt-Vergleich
//     keine Periode der verwendeten FY-Basis, obwohl der Ausweis der
//     Datenbasis sie kannte.
//
// Geprueft werden die ausgelieferten Funktionen (tests/audit-chat12.mjs), der
// Markt-Vergleich ueber den echten Renderer `renderMarket`.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp } from './audit-chat12.mjs';

const S = app();
const clone = (x) => JSON.parse(JSON.stringify(x));

// Minimales FY-Master-JSON. `ebitdaPeriods` null ⇒ kein EBITDA (wie JNJ).
function fyMj({ revPeriods = ['2025-12-28', '2024-12-29', '2023-12-31'], ebitdaPeriods = null } = {}) {
  const meta = {};
  if (revPeriods) meta.revenue = { periods: revPeriods.slice(), period_type: 'FY' };
  const f = { revenue: [94193, 88821, 85159], shares_diluted: [2420, 2420, 2420],
              eps_diluted: [5, 5, 5], _v4_meta: meta };
  if (ebitdaPeriods) {
    f.ebitda = [30000, 29000, 28000];
    meta.ebitda = { periods: ebitdaPeriods.slice() };
  }
  return { meta: { ticker: 'XFY', reporting_unit: 'millions' }, fundamentals: f,
           market: { price: 150, own_multiples_median: {} }, valuation: { data_basis: 'fy' } };
}

function renderMarketHtml(mj, v) {
  const st = evalInApp('state');
  const prevMj = st.masterJson, prevV = st.valuation, prevGet = S.document.getElementById;
  let html = '';
  st.masterJson = mj; st.valuation = v;
  S.document.getElementById = (id) => (id === 'market-output')
    ? { set innerHTML(x) { html = x; }, get innerHTML() { return html; } } : null;
  try { S.renderMarket(); }
  finally { S.document.getElementById = prevGet; st.masterJson = prevMj; st.valuation = prevV; }
  return html;
}

// ═════════════════════════════════════════════════════════════════════════════
// JNJ · Periode der verwendeten Basis im Markt-Vergleich
// ═════════════════════════════════════════════════════════════════════════════
test('JNJ-Fall: FY ohne EBITDA nennt die Periode der Basis (= Ausweis der Datenbasis)', () => {
  const mj = fyMj();
  const rel = S.computeRelativeMultiplesFV(mj, null);
  const rep = S.buildDataBasisReport(mj);
  assert.equal(rel.basis, 'fy');
  assert.equal(rep.period.end, '2025-12-28');
  assert.equal(rel.basisPeriod, '2025-12-28', 'bis V1.0.72: null');
  const html = renderMarketHtml(mj, null);
  assert.ok(html.includes('Letztes Geschäftsjahr (FY) · 2025-12-28'), html.slice(0, 400));
});

test('EBITDA-Periode behaelt Vorrang: eine abweichende (veraltete) Periode bleibt sichtbar', () => {
  const mj = fyMj({ ebitdaPeriods: ['2024-12-29', '2023-12-31'] });
  const rel = S.computeRelativeMultiplesFV(mj, null);
  assert.equal(rel.basisPeriod, '2024-12-29');
  // Der Ausweis der Datenbasis nennt 2025-12-28; das Auditwerkzeug erkennt
  // den Unterschied (tests/real-data/check-panels.test.mjs).
  assert.equal(S.buildDataBasisReport(mj).period.end, '2025-12-28');
  assert.notEqual(rel.basisPeriod, S.buildDataBasisReport(mj).period.end);
});

test('ohne jede Periodenangabe wird keine Periode erfunden', () => {
  const mj = fyMj({ revPeriods: null });
  const rel = S.computeRelativeMultiplesFV(mj, null);
  assert.equal(rel.basisPeriod, null);
  assert.equal(S.buildDataBasisReport(mj).period.end, null);
  const html = renderMarketHtml(mj, null);
  assert.ok(html.includes('Letztes Geschäftsjahr (FY)</span>'), 'Basis ohne Periode');
});

test('Sperre bei anderer Datenbasis unveraendert: keine Periode, Grund sichtbar', () => {
  const mj = fyMj();
  const rel = S.computeRelativeMultiplesFV(mj, { dataBasis: { selected: 'ttm' } });
  assert.equal(rel.basisBlocked, true);
  assert.equal(rel.basisPeriod, null);
  assert.ok(/neu berechnen/i.test(rel.basisReason));
});

// ═════════════════════════════════════════════════════════════════════════════
// MCD · Diagnosemodell DDM in der Ansicht ohne Intrinsic-Bewertung
// ═════════════════════════════════════════════════════════════════════════════
const router = (over = {}) => Object.assign({
  subClassification: 'retail', activeModels: ['dcf', 'rim'], diagnosticModels: ['ddm'],
  disabledModels: { epv_floor: 'diagnostischer Floor — nicht in Kerngewichtung' }, ddmMode: 'diagnostic'
}, over);
const results = (ddm) => Object.assign({
  dcf: { applicable: false, reason: 'Nettoschulden nicht ermittelbar' },
  rim: { applicable: false, reason: 'BVPS ≤ 0' }
}, ddm === undefined ? {} : { ddm });
const fallback = (r, mr) => S.buildValuationFallback(fyMj(), null,
  { router: r, modelResults: mr, valuationMode: 'minimal', scenariosError: null });
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('MCD-Fall: berechnetes Diagnosemodell erscheint mit Wert und Rolle, nicht gewichtet', () => {
  const html = fallback(router(), results({ applicable: true, base: 108.90190445495523 }));
  const t = text(html);
  assert.ok(/ddm DDM diagnostisch Base 108\.90/.test(t), t.slice(t.indexOf('Modell-Status'), t.indexOf('Modell-Status') + 500));
  assert.ok(t.includes('nicht gewichtet, kein Fair Value'), 'Rolle ausgewiesen');
  // Die Karte bleibt ohne Intrinsic-Bewertung; kein Fair Value.
  assert.ok(t.includes('Fair Value (intrinsisch) möglich: Nein'));
  // Die aktiven Modelle bleiben mit ihrem Grund deaktiviert.
  assert.ok(/dcf deaktiviert Nettoschulden nicht ermittelbar/.test(t));
});

test('nicht berechenbares Diagnosemodell: Grund statt Wert', () => {
  const t = text(fallback(router(), results({ applicable: false, reason: 'Szenario-Inputs fehlen: x' })));
  assert.ok(/ddm diagnostisch · nicht berechenbar Szenario-Inputs fehlen: x/.test(t), t);
  assert.ok(!/Base \d/.test(t));
});

test('Diagnosemodell ohne Ergebnis: Grund aus der Modelltabelle, keine Zahl', () => {
  const t = text(fallback(router(), results(undefined)));
  assert.ok(/ddm diagnostisch · nicht berechenbar dps\[0\] fehlt oder = 0/.test(t), t);
});

test('kein Diagnosemodell im Router ⇒ keine DDM-Zeile; aktives DDM nicht doppelt', () => {
  const t0 = text(fallback(router({ diagnosticModels: [] }), results({ applicable: true, base: 50 })));
  assert.ok(!t0.includes('50.00') && !/\bddm\b/.test(t0), t0);
  const t1 = text(fallback(router({ activeModels: ['dcf', 'ddm'] }), results({ applicable: false, reason: 'Inputs fehlen' })));
  assert.equal((t1.match(/\bddm\b/g) || []).length, 1, t1);
  assert.ok(!t1.includes('DDM diagnostisch'));
});

