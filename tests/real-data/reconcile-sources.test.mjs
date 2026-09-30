// ─────────────────────────────────────────────────────────────────────────────
// Regressionstests fuer den Quellenabgleich (reconcile-sources.mjs, D3).
// Laeuft ohne Netz und ohne Browser: Company Facts aus dem wortgetreuen
// Auszug tests/real-data/excerpts/mcd-d2-regression.json, Erfassung als
// kleine Attrappe im Format von replay-import.mjs.
//
// Gegenfall (unabhaengig reproduziert): Die fruehere Fassung akzeptierte
// MCD-EBITDA 12,850 = EBIT 12,393 + 457 mit „2/2 Werte stimmen“ und Exit 0,
// weil 457 zufaellig ein gemeldeter D&A-Tag ist (DepreciationDepletionAndAmortization,
// nur der SG&A-Teilposten). Richtig ist Gesamt-D&A 2,199 ⇒ EBITDA 14,592.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reconcileReport } from './reconcile-sources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CF = JSON.parse(readFileSync(join(HERE, 'excerpts', 'mcd-d2-regression.json'), 'utf8'));
const ACCN = '0000063908-26-000035';

const field = (concept, values, periods, extra = {}) => ({
  concept, values, value: values[0], period: { end: periods[0], periods, starts: periods.map(p => p.slice(0, 4) + '-01-01') },
  provenance: Object.assign({ source_type: 'reported', tag: null, accns: periods.map(() => ACCN) }, extra) });

function report({ ebitda = 12850, debtScope = { complete: false, contradiction: 'rechnerisch unvereinbar (Abweichung 725.0M)' } } = {}) {
  const P = ['2025-12-31'];
  return { fy: { fields: {
    ebit: field('Stromgroesse', [12393], P, { tag: 'OperatingIncomeLoss' }),
    ebitda: field('Stromgroesse', [ebitda], P, { source_type: 'derived', tag: null }),
    total_debt: field('Stichtag', [39973], P, { tag: 'LongTermDebt', scope: debtScope }),
    cash_and_equivalents: field('Stichtag', [774], P, { tag: 'CashAndCashEquivalentsAtCarryingValue' }),
    net_debt: field('Stichtag', [39199], P, { source_type: 'derived', tag: null }),
  } } };
}
const row = (r, f) => r.rows.find(x => x.field === f && x.i === 0);

// Auditbeleg wie evidence/MCD.json (hier ohne Originaldokumente vorgegeben).
const EVIDENCE = {
  daTotals: [{ period: '2025-12-31', item: 'fy.da_total', partials: ['fy.da_sga'] }],
  debtScope: [{ period: '2025-12-31', financialDebt: 'note.debt_total', financeLeases: ['note.fl_cur', 'note.fl_noncur'], cash: 'bs.cash' }]
};
const EVRES = { 'fy.da_total': { ok: true, expected: 2199 }, 'fy.da_sga': { ok: true, expected: 457 },
  'note.debt_total': { ok: true, expected: 39973 }, 'note.fl_cur': { ok: true, expected: 23 },
  'note.fl_noncur': { ok: true, expected: 2329 }, 'bs.cash': { ok: true, expected: 774 } };

test('Gegenfall: EBITDA 12,850 (EBIT + Teilposten 457) wird abgelehnt — ohne Auditbeleg (Groessenregel)', () => {
  const r = reconcileReport({ report: report(), cf: CF });
  const e = row(r, 'ebitda');
  assert.equal(e.status, 'ABWEICHUNG');
  assert.equal(e.calc, false);
  assert.equal(e.source, 12393 + 2199);
  assert.match(e.note, /TEILPOSTEN DepreciationDepletionAndAmortization/);
});

test('Gegenfall: EBITDA 12,850 wird auch mit Auditbeleg (Gesamt-D&A 2,199) abgelehnt', () => {
  const r = reconcileReport({ report: report(), cf: CF, evidence: EVIDENCE, evRes: EVRES });
  const e = row(r, 'ebitda');
  assert.equal(e.status, 'ABWEICHUNG');
  assert.match(e.note, /erwartet Gesamt-D&A 2,199 \[Auditbeleg fy\.da_total/);
});

test('Richtiger Gesamtwert: EBITDA 14,592 = 12,393 + 2,199 besteht', () => {
  const withEv = reconcileReport({ report: report({ ebitda: 14592 }), cf: CF, evidence: EVIDENCE, evRes: EVRES });
  assert.equal(row(withEv, 'ebitda').status, 'korrekt');
  assert.equal(row(withEv, 'ebitda').calc, true);
  // Ohne Beleg und ohne Original: rechnerisch richtig, Umfang nur aus Company Facts ⇒ offen, nie ABWEICHUNG.
  const noEv = reconcileReport({ report: report({ ebitda: 14592 }), cf: CF });
  assert.equal(row(noEv, 'ebitda').calc, true);
  assert.notEqual(row(noEv, 'ebitda').status, 'ABWEICHUNG');
});

test('Schulden: rechnerisch richtiger Teilbetrag ist nicht „vollstaendig bestaetigt“', () => {
  // Nettoschulden 39,199 = 39,973 − 774 (Rechnung ✓), vollstaendig inkl. Finance-Leasing 41,551.
  const r = reconcileReport({ report: report({ ebitda: 14592 }), cf: CF, evidence: EVIDENCE, evRes: EVRES });
  const nd = row(r, 'net_debt');
  assert.equal(nd.calc, true);
  assert.match(nd.scope, /^Teilbetrag: vollstaendig 41,551/);
  assert.equal(nd.status, 'berechtigte Einschraenkung', 'Engine kennzeichnet den Umfang als unvollstaendig');
  // Die Finanzschulden selbst sind laut Anhang vollstaendig (39,973 inkl. CP und laufender Faelligkeiten).
  assert.match(row(r, 'total_debt').scope, /^belegt/);
});

test('Schulden: Teilbetrag, den die Engine als vollstaendig ausweist, ist eine ABWEICHUNG', () => {
  const r = reconcileReport({ report: report({ ebitda: 14592, debtScope: { complete: true } }), cf: CF, evidence: EVIDENCE, evRes: EVRES });
  assert.equal(row(r, 'net_debt').status, 'ABWEICHUNG');
});

test('CLI: Gegenfall endet mit Exit 1, richtiger Wert mit Exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reconcile-test-'));
  try {
    const data = join(dir, 'data'), reps = join(dir, 'out'), ev = join(dir, 'evidence');
    for (const d of [data, reps, ev]) mkdirSync(d);
    writeFileSync(join(data, 'company_tickers_exchange.json'), JSON.stringify({ fields: ['cik', 'name', 'ticker', 'exchange'], data: [[63908, 'MCD', 'MCD', 'NYSE']] }));
    writeFileSync(join(data, 'CIK0000063908.companyfacts.json'), JSON.stringify(CF));
    const run = (ebitda) => {
      writeFileSync(join(reps, 'MCD-report.json'), JSON.stringify(report({ ebitda })));
      return spawnSync(process.execPath, [join(HERE, 'reconcile-sources.mjs'), 'MCD', '--data', data, '--reports', reps, '--evidence', ev], { encoding: 'utf8' });
    };
    const bad = run(12850);
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /ABWEICHUNG ebitda\[0\]/);
    const good = run(14592);
    assert.equal(good.status, 0, good.stdout + good.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
