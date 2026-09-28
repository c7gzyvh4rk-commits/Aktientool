#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit MCD/JNJ — wortgetreue Regressionsauszuege erzeugen (D2)
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources.mjs):  node tests/real-data/make-excerpts.mjs
//
// Liest tests/real-data/cache/<CIK>.companyfacts.json (Stichtag-gefiltert) und
// schreibt je Unternehmen ALLE Fakten der unten genannten Tags unveraendert nach
// tests/real-data/excerpts/<ticker>-d2-regression.json. Anders als die
// Befund-Auszuege aus dem Audit ist hier nichts nach Zeitraum gekuerzt: die
// Regressionstests (tests/real-data-findings.test.mjs) pruefen die Auswahl
// unter allen Angaben (Vergleichswerte, Berichtigungen, Teilposten).
// Quelle, Abrufzeit und SHA-256 der Rohdatei stehen in `_meta`.
// Exit 0 = geschrieben, 2 = Cache fehlt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'cache');
const SETS = {
  mcd: { cik: 'CIK0000063908', tags: [
    'DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'Depreciation',
    'OperatingIncomeLoss', 'Revenues',
    'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic',
    'EarningsPerShareDiluted', 'EarningsPerShareBasic', 'NetIncomeLoss',
    'OperatingLeaseLiability', 'StockholdersEquity', 'LongTermDebt'] },
  jnj: { cik: 'CIK0000200406', tags: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'Depreciation',
    'CommonStockDividendsPerShareCashPaid', 'CommonStockDividendsPerShareDeclared',
    'CashAndCashEquivalentsAtCarryingValue',
    'EarningsPerShareDiluted', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'NetIncomeLoss'] }
};

const manifestPath = join(CACHE, 'manifest.json');
if (!existsSync(manifestPath)) { console.error('Cache fehlt — zuerst fetch-sources.mjs ausfuehren.'); process.exit(2); }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const [name, set] of Object.entries(SETS)) {
  const file = join(CACHE, set.cik + '.companyfacts.json');
  if (!existsSync(file)) { console.error('fehlt: ' + file); process.exit(2); }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const raw = manifest.files[set.cik + '.companyfacts.raw.json'] || {};
  const derived = manifest.files[set.cik + '.companyfacts.json'] || {};
  const facts = { 'us-gaap': {} };
  for (const t of set.tags) {
    const c = data.facts['us-gaap'][t];
    if (c) facts['us-gaap'][t] = c;
  }
  const out = {
    _meta: { source: raw.url, retrievedAt: raw.retrievedAt, sha256_raw: raw.sha256,
             cutoff: derived.cutoff || manifest.cutoff || null,
             note: 'Wortgetreuer Auszug: alle Fakten der genannten Tags, unveraendert.' },
    cik: data.cik, entityName: data.entityName, facts
  };
  const target = join(HERE, 'excerpts', name + '-d2-regression.json');
  writeFileSync(target, JSON.stringify(out));
  console.log(target, JSON.stringify(out).length, 'B', Object.keys(facts['us-gaap']).join(','));
}
