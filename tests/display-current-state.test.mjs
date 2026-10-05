// ─────────────────────────────────────────────────────────────────────────────
// V1.0.84 · Anzeige folgt dem aktuellen Stand (Schema-Befunde, Kurs-Herkunft).
//
// Befund der Praxisabnahme (CRH, SEC-Import ohne Yahoo): state.v4criticals
// wurde nur beim Import gesetzt. Nach Kurseingabe und „Neu berechnen“ zeigte
// die Uebersicht neben Kurs 81.96 und Einstiegszone 51.08 weiter
// „C-MKT: market.price fehlt — … Valuation blockiert bis Kurs gesetzt ist“.
// Der Browser-Ablauf steht in tests/browser/acceptance.mjs §16.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();
const mj = (price) => ({
  schema_version: '4.0',
  meta: { ticker: 'X', reporting_unit: 'millions', currency: 'USD', _sec_fetch: { price_missing: true } },
  market: { price },
  fundamentals: { revenue: [1000], shares_diluted: [100], ebit: [100] },
  valuation: { wacc_components: { tax_rate: 25 } }
});
const cmkt = (r) => r.criticals.some(c => /^C-MKT/.test(c));

test('1 · SEC-Import ohne Kurs: C-MKT ist ein kritischer Befund (unveraendert)', () => {
  assert.equal(cmkt(S.validateMasterJsonV4(mj(null))), true);
});

test('2 · mit gesetztem Kurs entfaellt C-MKT', () => {
  assert.equal(cmkt(S.validateMasterJsonV4(mj(81.96))), false);
});

test('3 · recalcFromAssumptions erneuert state.v4criticals aus validateMasterJsonV4(mj)', () => {
  const src = S.recalcFromAssumptions.toString();
  assert.match(src, /state\.v4criticals\s*=\s*validateMasterJsonV4\(mj\)\.criticals/);
  // nach der Bewertung, vor dem Rendern
  const iVal = src.indexOf('runValuationEngine(mj)');
  const iCrit = src.indexOf('state.v4criticals');
  const iRender = src.indexOf('renderAssumptions(true)');
  assert.ok(iVal >= 0 && iCrit > iVal && iRender > iCrit, [iVal, iCrit, iRender].join(','));
});

// V1.0.84 · Herkunft des Kurses: SEC-Import ohne Yahoo-Kurs ⇒ von Hand gesetzt.
const diagMj = (secPriceMissing, source) => ({
  meta: secPriceMissing == null ? {} : { _sec_fetch: { price_missing: secPriceMissing } },
  market: Object.assign({ price: 81.96 }, source ? { source } : {}),
  fundamentals: { shares_diluted: [677] },
  valuation: { wacc_components: { risk_free: 0.043, equity_risk_premium: 0.055 }, _derivationFlags: {} }
});

test('4 · SEC-Import ohne Kurs, Kurs danach gesetzt: Herkunft „manuell“, nicht „Yahoo Finance“', () => {
  const d = S.computeMarketDataDiagnostics(diagMj(true));
  assert.equal(d.price.confidence, 'manual');
  assert.match(d.price.source, /manuell eingegeben/);
  assert.doesNotMatch(d.price.source, /Yahoo/);
});

test('5 · Gegenproben: Yahoo-Kurs beim Import bzw. angegebene Quelle bleiben unveraendert', () => {
  assert.equal(S.computeMarketDataDiagnostics(diagMj(false)).price.source, 'Yahoo Finance');
  assert.equal(S.computeMarketDataDiagnostics(diagMj(null)).price.source, 'Yahoo Finance');
  assert.equal(S.computeMarketDataDiagnostics(diagMj(true, 'market_data_unofficial')).price.source, 'market_data_unofficial');
  const d = S.computeMarketDataDiagnostics(Object.assign(diagMj(true), { market: { price: 81.96, manual_overrides: { price: 80 } } }));
  assert.equal(d.price.source, 'manual override');
});
