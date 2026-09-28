#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit MCD/JNJ — Kontrolle der bestaetigten Befunde (seit D2)
// ───────────────────────────────────────────────────────────────────────────
// Start:  node tests/real-data/repro-findings.mjs
//
// Nutzt nur die wortgetreuen SEC-Auszuege in tests/real-data/excerpts/ und die
// PRODUKTIVEN Funktionen der Tool-Datei (geladen wie in tests/audit-chat12.mjs),
// jeweils auf dem Weg, den der Import tatsaechlich geht
// (_extractSecFundamentals → _buildSecMasterJson → normalizeSharesInPlace bzw.
// normalizeSecQuarters mit belegter Berichtspraezision).
//
// Bis D1 hielt das Skript das falsche Verhalten fest (Exit immer 0). Seit D2
// sind die Befunde behoben; der erwartete Zustand ist BEHOBEN. Tritt ein
// Befund wieder auf (BESTEHT), endet das Skript mit Exit 1.
// Die verbindlichen Regressionstests stehen in tests/real-data-findings.test.mjs
// (Teil von `npm test`); dieses Skript ist die knappe Uebersicht dazu.
// Exit 0 = alle behoben · 1 = mindestens ein Befund besteht · 2 = nicht ausfuehrbar.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../audit-chat12.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(readFileSync(join(HERE, 'excerpts', n), 'utf8'));
let S, MCD, JNJ, XBRL;
try {
  S = app();
  MCD = load('mcd-d2-regression.json').facts;
  JNJ = load('jnj-d2-regression.json').facts;
  XBRL = load('mcd-xbrl-precision.json').filings;
  for (const fn of ['_extractSecFundamentals', '_buildSecMasterJson', 'parseXbrlInstancePrecision']) {
    if (typeof S[fn] !== 'function') throw new Error(fn + ' fehlt (Produktstand vor D2?)');
  }
} catch (e) {
  console.error('NICHT AUSFUEHRBAR: ' + e.message);
  process.exit(2);
}

const out = [];
const report = (id, besteht, text) => { out.push([id, besteht]); console.log(`${besteht ? 'BESTEHT' : 'BEHOBEN'}  ${id}  ${text}`); };
const importFacts = (facts) => {
  const { extracted, derivationNotes } = S._extractSecFundamentals(facts);
  return S._buildSecMasterJson({ ticker: 'X', cik: '0', companyName: 'X', sic: null, fiscalYearEnd: '1231',
    exchange: 'NYSE', sicMapping: null, extracted, yahooData: null, secFacts: facts, derivationNotes });
};
const mcd = importFacts(MCD);
const jnj = importFacts(JNJ);

// F-1 · MCD: D&A-Gesamtwert (2,199) statt Teilposten DDA (457).
{
  const f = mcd.fundamentals;
  const e0 = f.ebitda && f.ebitda[0];
  report('F-1', e0 !== 12393 + 2199,
    `MCD FY2025 EBITDA = ${e0} (${f._v4_meta.ebitda && f._v4_meta.ebitda.derivation}); Soll 12,393 + 2,199 = 14,592`);
}

// F-2 · JNJ: FY2022 (Ende 2023-01-01) als eigenes Geschaeftsjahr.
{
  const per = (jnj.fundamentals._v4_meta.revenue || {}).periods || [];
  const i = per.indexOf('2023-01-01');
  report('F-2', i < 0 || jnj.fundamentals.revenue[i] !== 79990,
    `JNJ Umsatzperioden: ${per.join(', ')} · FY2022 ${i < 0 ? 'fehlt' : '= ' + jnj.fundamentals.revenue[i]}`);
}

// F-3 · MCD Q3/2025: 1 Mio. Abweichung innerhalb der belegten Rundung (decimals=-6).
{
  const by = {};
  for (const [accn, f] of Object.entries(XBRL)) by[accn] = S.parseXbrlInstancePrecision(f.xml);
  const n = S.normalizeSecQuarters(MCD, { fields: ['revenue'], precision: S.secPrecisionLookup(by) });
  const q3 = n.fields.revenue.quarters.find(q => q.periodKey === 'FY2025-Q3');
  const rc = q3 && q3.roundingCheck;
  report('F-3', !q3 || !!q3.conflict,
    `MCD Q3/2025 Umsatz ${q3 && q3.value} · ${rc ? rc.note : (q3 && q3.conflict ? 'Widerspruch: ' + JSON.stringify(q3.conflict.precisionCheck || {}) : '—')}`);
}

// F-4 · MCD: jede historische Aktienangabe geprueft; keine gemischte Skalierung.
{
  S.normalizeSharesInPlace(mcd);
  const series = mcd.fundamentals.shares_diluted;
  const mixed = series.some(v => v > 1e6) && series.some(v => v < 1e4);
  const m = S.computeNetShareIssuance(mcd);
  report('F-4', mixed || (m.status === 'ok' && m.value < -0.5),
    `MCD shares_diluted: [${series.join(', ')}] · Net Share Issuance 5y: ${m.detail}`);
}

// F-5 · MCD: EBIT 2025 nicht mit Leasing zum 2023-12-31 verknuepft.
{
  mcd.meta.sub_classification = 'retail';
  mcd.valuation = Object.assign(mcd.valuation || {}, { wacc_derived: 7, wacc_components: { tax_rate: 21 } });
  const m = S.computeRoicMinusWacc(mcd);
  const pairs = m._leasePairs || [];
  const cross = pairs.some(p => S._secPeriodYear(p.leasePeriod) !== S._secPeriodYear(p.ebitPeriod));
  report('F-5', cross || m._leaseAdjusted === true,
    `ROIC: ${m.status} · ${m.detail} · Leasingpaare ${pairs.map(p => p.ebitPeriod + '↔' + p.leasePeriod).join(', ') || '—'}`);
}

// P-1 · MCD: Net Debt/EBITDA nicht aus einem Schulden-Teilbetrag.
{
  const m = S.computeNetDebtToEbitda(mcd);
  const bridge = S._resolveNetDebtForDcfBridge(mcd.fundamentals);
  report('P-1', m.status === 'ok' && !bridge.available,
    `Net Debt/EBITDA: ${m.status} · ${m.detail} · DCF-Bruecke verfuegbar: ${bridge.available}`);
}

const open = out.filter(x => x[1]).length;
console.log(`\n${open} von ${out.length} Befunden bestehen.`);
process.exit(open > 0 ? 1 : 0);
