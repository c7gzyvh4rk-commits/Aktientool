#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit MCD/JNJ — Reproduktion der bestätigten Befunde
// ───────────────────────────────────────────────────────────────────────────
// Start:  node tests/real-data/repro-findings.mjs
//
// Nutzt nur die wortgetreuen SEC-Auszüge in tests/real-data/excerpts/ und die
// PRODUKTIVEN Funktionen der Tool-Datei (geladen wie in tests/audit-chat12.mjs).
// Je Befund: BESTEHT = das falsche Verhalten ist noch reproduzierbar,
// BEHOBEN = nicht mehr. Das Skript ist bewusst NICHT Teil von `npm test`:
// es hält falsches Verhalten fest, nicht erwartetes Verhalten.
// Exit 0 immer (Diagnose, keine Abnahme); 2 = nicht ausführbar.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, evalInApp } from '../audit-chat12.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(readFileSync(join(HERE, 'excerpts', n), 'utf8'));
const S = app();
const TAGS = evalInApp('SEC_TAG_MAP');
const MCD = load('mcd-companyfacts-excerpt.json').facts;
const JNJ = load('jnj-companyfacts-excerpt.json').facts;
const out = [];
const report = (id, besteht, text) => { out.push([id, besteht]); console.log(`${besteht ? 'BESTEHT' : 'BEHOBEN'}  ${id}  ${text}`); };

// F-1 · MCD: D&A-Tag-Auswahl nimmt die SG&A-Teilzeile statt der Gesamt-D&A.
{
  const da = S._extractWithFallback(MCD, TAGS.da, 10);
  const used = da.usedTag || (da.meta && da.meta.source_reference) || '';
  const v0 = da.values[0];
  report('F-1', v0 === 457, `MCD FY2025 D&A = ${v0} (${used}); 10-K Kapitalflussrechnung: 2,199 (DepreciationAndAmortization)`);
}

// F-2 · JNJ: Jahres-Schlüssel = Kalenderjahr des Periodenendes → FY2022 (Ende 2023-01-01) fällt weg.
{
  const r = S._extractFyValues(JNJ, 'RevenueFromContractWithCustomerExcludingAssessedTax', 10);
  const per = (r.meta && r.meta.periods) || [];
  report('F-2', !per.includes('2023-01-01'),
    `JNJ Umsatzperioden: ${per.join(', ')} · FY2022 (2022-01-03…2023-01-01, 79,990M) ${per.includes('2023-01-01') ? 'enthalten' : 'fehlt'}`);
}

// F-3 · MCD: Quartalsabgleich ohne Rundungstoleranz → Q3/2025 verworfen, kein TTM.
{
  const n = S.normalizeSecQuarters(MCD, {});
  const q3 = ((n.fields.revenue || {}).quarters || []).find(q => q.periodKey === 'FY2025-Q3');
  const c = q3 && q3.conflict;
  report('F-3', !!c,
    `MCD Q3/2025 Umsatz gemeldet ${q3 && q3.value} · aus Kumulierungen ${c ? c.derivedValue : '—'} · Differenz ${c ? c.reportedMinusDerived : 0} USD → ${c ? 'als Widerspruch verworfen' : 'akzeptiert'}`);
}

// F-4 · MCD: gemischt skalierte Aktienreihe (Filer-XBRL meldet ab 10-K FY2023 „716.4 shares")
//        → Net Share Issuance 5y = −100 %.
{
  const sh = S._extractWithFallback(MCD, TAGS.shares_diluted, 10);
  const mj = { meta: {}, market: {}, fundamentals: {
    shares_diluted: sh.values.slice(), _v4_meta: { shares_diluted: sh.meta },
    net_income: [8563, 8223, 8469, 6177, 7545.2, 4730.5], eps_diluted: [11.95, 11.39, 11.56, 8.33, 10.04, 6.31] } };
  try { S.normalizeSharesInPlace(mj); } catch { /* Diagnose */ }
  const series = mj.fundamentals.shares_diluted;
  const m = S.computeNetShareIssuance(mj);
  const mixed = series.some(v => v > 1e6) && series.some(v => v < 1e4);
  report('F-4', mixed, `MCD shares_diluted nach normalizeSharesInPlace: [${series.join(', ')}] · Net Share Issuance 5y: ${m && m.detail}`);
}

// F-5 · MCD: lease-bereinigter ROIC paart Reihen über den Index, nicht über die Periode.
{
  const oll = S._extractFyValues(MCD, 'OperatingLeaseLiability', 10);
  const ebit = S._extractFyValues(MCD, 'OperatingIncomeLoss', 10);
  const p0o = oll.meta && oll.meta.periods[0], p0e = ebit.meta && ebit.meta.periods[0];
  const src = String(S.computeRoicMinusWacc);
  const indexJoin = /const ollI = oll\[i\]/.test(src);
  report('F-5', indexJoin && p0o !== p0e,
    `EBIT[0] Periode ${p0e} ↔ operating_lease_liabilities[0] Periode ${p0o} · computeRoicMinusWacc paart per Index: ${indexJoin}`);
}

console.log(`\n${out.filter(x => x[1]).length} von ${out.length} Befunden bestehen.`);
