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
//
// Zusaetzlich (D2/F-3) aus den Original-XBRL-Instanzen in cache/archives/:
// excerpts/mcd-xbrl-precision.json — je Bericht die Fakt-Elemente der Tags in
// XBRL_TAGS und die von ihnen referenzierten Kontexte, jeweils als
// unveraenderter Textausschnitt (mit URL und SHA-256 der Instanz).
// Exit 0 = geschrieben, 2 = Cache fehlt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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

// ── Original-XBRL (Praezision) ────────────────────────────────────────────────
const XBRL_TAGS = ['Revenues', 'OperatingIncomeLoss', 'NetCashProvidedByUsedInOperatingActivities'];
const archDir = join(CACHE, 'archives', '63908');
if (existsSync(archDir)) {
  const out = { _meta: { note: 'Wortgetreue Ausschnitte der XBRL-Instanzen (Fakt-Elemente und ihre Kontexte).',
                         tags: XBRL_TAGS }, filings: {} };
  for (const folder of readdirSync(archDir).sort()) {
    const files = readdirSync(join(archDir, folder)).filter(f => /_htm\.xml$/.test(f));
    if (files.length !== 1) continue;
    const rel = join('archives', '63908', folder, files[0]);
    const xml = readFileSync(join(CACHE, rel), 'utf8');
    const facts = [];
    const reFact = /<us-gaap:([\w-]+)\b[^>]*\bcontextRef="([^"]+)"[^>]*>[^<]*<\/us-gaap:\1>/g;
    let m;
    while ((m = reFact.exec(xml)) !== null) if (XBRL_TAGS.includes(m[1])) facts.push({ text: m[0], ctx: m[2] });
    const ids = new Set(facts.map(f => f.ctx));
    const contexts = [];
    const reCtx = /<((?:[\w-]+:)?)context\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/\1context>/g;
    while ((m = reCtx.exec(xml)) !== null) if (ids.has(m[2])) contexts.push(m[0]);
    const accn = folder.slice(0, 10) + '-' + folder.slice(10, 12) + '-' + folder.slice(12);
    const mf = manifest.files[rel] || {};
    out.filings[accn] = { source: mf.url || null, retrievedAt: mf.retrievedAt || null, sha256: mf.sha256 || null,
                          xml: '<xbrl>\n' + contexts.join('\n') + '\n' + facts.map(f => f.text).join('\n') + '\n</xbrl>' };
  }
  const target = join(HERE, 'excerpts', 'mcd-xbrl-precision.json');
  writeFileSync(target, JSON.stringify(out, null, 1));
  console.log(target, JSON.stringify(out).length, 'B', Object.keys(out.filings).join(','));
}
