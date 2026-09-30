#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit (D3): Original-10-K/10-Q-Dokumente laden
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources.mjs, braucht dessen submissions-Dateien):
//   SEC_USER_AGENT="Name kontakt@example.org" \
//     node tests/real-data/fetch-filings.mjs MCD JNJ --cutoff 2026-09-24 \
//       [--since 2025-07-01] [--forms 10-K,10-Q] [--accn ACCN,…] [--data DIR]
//
// Laedt je Ticker das Hauptdokument (primaryDocument) aller 10-K/10-Q, die
// laut Submissions-Datei am oder vor dem Stichtag eingereicht wurden
// (filingDate <= cutoff) und ab --since eingereicht sind. Spaetere Filings
// werden nicht geladen, auch keine Berichtigungen (10-K/A, 10-Q/A) nach dem
// Stichtag. Die Dokumente sind unveraenderte Originale; sie liegen unter
// DIR/filings/<cik>/<accn>/<primaryDocument> (nicht versioniert). Enthaelt das
// Hauptdokument kein Inline-XBRL (aeltere Filings), wird zusaetzlich die
// XBRL-Instanz des Filings geladen (Dateiliste aus index.json).
//
// --accn: zusaetzlich einzelne aeltere Filings, die nicht mehr in der
// Submissions-Liste stehen (z. B. von der Engine zitierte 10-K vor 2016).
// Geladen wird nur die XBRL-Instanz; Form, Einreichungsdatum und Periode
// stammen aus den Company-Facts-Eintraegen dieser Akte. Auch hier gilt:
// eingereicht nach dem Stichtag ⇒ nicht geladen.
//
// Manifest DIR/filings/manifest.json je Datei: URL, Form, Accession Number,
// Einreichungsdatum, Berichtsperiode (reportDate), acceptanceDateTime,
// Abrufzeit, Groesse, SHA-256. Das Manifest ist die Quellenkette, auf die
// sich die Kontrollrechnungen (control-calcs.mjs) beziehen.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
let dir = join(HERE, 'cache'), cutoff = null, since = '2025-07-01', forms = ['10-K', '10-Q'], extra = [];
const tickers = [];
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--data') dir = a[++i];
  else if (a[i] === '--cutoff') cutoff = a[++i];
  else if (a[i] === '--since') since = a[++i];
  else if (a[i] === '--forms') forms = a[++i].split(',');
  else if (a[i] === '--accn') extra = a[++i].split(',');
  else tickers.push(a[i].toUpperCase());
}
const UA = process.env.SEC_USER_AGENT;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
if (!UA || !tickers.length || !cutoff || !ISO.test(cutoff) || !ISO.test(since)) {
  console.error('Aufruf: SEC_USER_AGENT="Name kontakt@…" fetch-filings.mjs TICKER… --cutoff JJJJ-MM-TT [--since JJJJ-MM-TT] [--data DIR]');
  process.exit(2);
}
const mapFile = join(dir, 'company_tickers_exchange.json');
if (!existsSync(mapFile)) { console.error('Zuerst fetch-sources.mjs ausfuehren (' + mapFile + ' fehlt).'); process.exit(2); }
const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const ti = map.fields.indexOf('ticker'), ci = map.fields.indexOf('cik');
const manifestPath = join(dir, 'filings', 'manifest.json');
mkdirSync(join(dir, 'filings'), { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} };
manifest.cutoff = cutoff;

// XBRL-Instanz aus der Dateiliste: Inline-Ableitung (*_htm.xml), sonst die
// klassische Instanz <praefix>-<JJJJMMTT>.xml; nie Linkbases oder defnref.
function pickInstance(items) {
  return items.find(n => /_htm\.xml$/.test(n)) || items.find(n => /^[a-z]+-\d{8}\.xml$/i.test(n))
    || items.find(n => /\.xml$/.test(n) && !/(_cal|_def|_lab|_pre|FilingSummary|defnref)\.xml$/i.test(n) && !/^R\d+/.test(n)) || null;
}

async function load(url, rel, meta) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) { console.error(`  HTTP ${res.status} fuer ${url}`); process.exit(2); }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(dir, rel), buf);
  manifest.files[rel] = Object.assign({}, meta, { url, retrievedAt: new Date().toISOString(),
    bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  console.log(`  ${meta.ticker} ${meta.form} ${meta.accn} Periode ${meta.reportDate} eingereicht ${meta.filed} · ${rel.split('/').pop()} · ${buf.length} B · sha256 ${manifest.files[rel].sha256.slice(0, 16)}`);
  await new Promise(r2 => setTimeout(r2, 300)); // SEC-Fairness (< 10 Anfragen/s)
  return buf;
}

for (const t of tickers) {
  const row = map.data.find(r => String(r[ti]).toUpperCase() === t);
  if (!row) { console.error(`${t}: unbekannt`); process.exitCode = 1; continue; }
  const cik = String(row[ci]);
  const subFile = join(dir, `CIK${cik.padStart(10, '0')}.submissions.json`);
  if (!existsSync(subFile)) { console.error(`${t}: ${subFile} fehlt`); process.exit(2); }
  const r = JSON.parse(readFileSync(subFile, 'utf8')).filings.recent;
  for (let i = 0; i < r.form.length; i++) {
    if (!forms.includes(r.form[i])) continue;
    const filed = r.filingDate[i];
    if (filed > cutoff) { console.log(`  ${t} ${r.form[i]} ${r.accessionNumber[i]} eingereicht ${filed} > Stichtag — nicht geladen`); continue; }
    if (filed < since) continue;
    const accn = r.accessionNumber[i], folder = accn.replace(/-/g, ''), doc = r.primaryDocument[i];
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/${doc}`;
    const rel = join('filings', cik, folder, doc);
    mkdirSync(join(dir, 'filings', cik, folder), { recursive: true });
    const meta = { ticker: t, form: r.form[i], accn, filed, reportDate: r.reportDate[i],
      acceptanceDateTime: r.acceptanceDateTime[i] };
    const buf = await load(url, rel, meta);
    if (!buf.toString('utf8').includes('<ix:nonFraction')) {
      // Kein Inline-XBRL: Instanz des Filings (EX-101.INS) zusaetzlich laden.
      const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/`;
      const idx = JSON.parse((await load(base + 'index.json', join('filings', cik, folder, 'index.json'), meta)).toString('utf8'));
      const items = ((idx.directory || {}).item || []).map(x => x.name);
      const inst = pickInstance(items);
      if (!inst) { console.error(`  ${accn}: keine XBRL-Instanz gefunden`); process.exitCode = 1; }
      else await load(base + inst, join('filings', cik, folder, inst), meta);
    }
  }
}
// Einzelne aeltere Akten (--accn): Instanz ueber index.json.
async function loadInstance(cik, accn, meta) {
  const folder = accn.replace(/-/g, '');
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/`;
  mkdirSync(join(dir, 'filings', cik, folder), { recursive: true });
  const idx = JSON.parse((await load(base + 'index.json', join('filings', cik, folder, 'index.json'), meta)).toString('utf8'));
  const items = ((idx.directory || {}).item || []).map(x => x.name);
  const inst = pickInstance(items);
  if (!inst) { console.error(`  ${accn}: keine XBRL-Instanz gefunden`); process.exitCode = 1; return; }
  await load(base + inst, join('filings', cik, folder, inst), meta);
}
for (const accn of extra) {
  let found = null;
  for (const t of tickers) {
    const row = map.data.find(r => String(r[ti]).toUpperCase() === t);
    const cf = JSON.parse(readFileSync(join(dir, `CIK${String(row[ci]).padStart(10, '0')}.companyfacts.json`), 'utf8'));
    for (const ns of Object.values(cf.facts || {})) for (const c of Object.values(ns)) for (const arr of Object.values(c.units || {}))
      for (const f of arr) if (f.accn === accn && (!found || f.end > found.reportDate)) found = { ticker: t, cik: String(row[ci]), form: f.form, accn, filed: f.filed, reportDate: f.end };
  }
  if (!found) { console.error(`  ${accn}: in keinem Company-Facts-Eintrag gefunden`); process.exitCode = 1; continue; }
  if (found.filed > cutoff) { console.log(`  ${accn} eingereicht ${found.filed} > Stichtag — nicht geladen`); continue; }
  await loadInstance(found.cik, accn, { ticker: found.ticker, form: found.form, accn, filed: found.filed,
    reportDate: found.reportDate + ' (juengstes Periodenende der Akte in Company Facts)', acceptanceDateTime: null });
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest: ' + manifestPath);
