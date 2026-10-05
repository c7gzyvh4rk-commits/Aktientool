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

// V1.0.84 · QCE-Score und Datennote mit den Feldern, die die Engine tatsaechlich
// liefert (qceScore.value, dataQuality.grade). Bis V1.0.83 lasen Uebersicht und
// Snapshot/CSV qceScore.total und dataQuality.label (nur in Alt-Fixtures) ⇒ leer;
// der Risikohinweis „Kapitaleffizienz schwach“ (≤ 4) wurde nie ausgeloest.
const snapCtx = (quality, dq) => ({
  masterJson: { schema_version: '4.0', meta: { ticker: 'X', company_name: 'X', as_of_date: '2026-10-05', currency: 'USD' },
    fundamentals: { revenue: [1000], shares_diluted: [100] }, valuation: { wacc_components: { tax_rate: 25 } }, market: { price: 20 } },
  quality, valuation: { modelResults: {}, router: {} }, synthesis: { buyPrice: 1, range: { base: 2 } },
  dataQuality: dq, qualityOverrides: [], importedSnapshot: null, masterJsonMode: 'full',
  manualAssumptionFields: [], baseRateWarnings: [], id: 't1', now: new Date('2026-10-05T00:00:00Z')
});

test('6 · Snapshot (Quelle der CSV): QCE aus qceScore.value, Datennote aus dataQuality.grade', () => {
  const rec = S.buildSnapshotRecord(snapCtx({ verdict: 'investable_mid', qceScore: { value: 8.9 }, hardStops: [] }, { grade: 'B' }));
  assert.equal(rec._fc.qceScore, 8.9);
  assert.equal(rec._fc.dataQuality, 'B');
});

test('7 · _qceValue: value vor total (Alt-Fixtures), sonst null — kein 0-Ersatz', () => {
  assert.equal(S._qceValue({ value: 3.5 }), 3.5);
  assert.equal(S._qceValue({ total: 7 }), 7);
  assert.equal(S._qceValue({ value: 0 }), 0);
  assert.equal(S._qceValue({}), null);
  assert.equal(S._qceValue(null), null);
  assert.doesNotMatch(S.buildSnapshotRecord.toString(), /qceScore\.total/);
});

test('8 · Uebersicht liest den QCE-Wert ueber _qceValue (Zeile und Risikohinweis)', () => {
  const all = Object.values(S).filter(f => typeof f === 'function').map(f => f.toString()).join('\n');
  assert.doesNotMatch(all, /q\.qceScore\.total/);
  assert.match(all, /_ovFactRow\('Qualität und Kapitaleffizienz', ovNum\(_qceValue\(q\.qceScore\)/);
  assert.match(all, /_qceValue\(q\.qceScore\) <= 4\)\s*\n\s*add\('Kapitaleffizienz schwach'/);
});
