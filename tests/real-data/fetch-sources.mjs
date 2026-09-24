#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit: SEC-Quelldateien fuer replay-import.mjs laden
// ───────────────────────────────────────────────────────────────────────────
// Start:  SEC_USER_AGENT="Name kontakt@example.org" \
//           node tests/real-data/fetch-sources.mjs MCD JNJ --cutoff 2026-09-24 [--data DIR]
//
// Laedt je Ticker von den OFFIZIELLEN SEC-Endpunkten (Netz zu www.sec.gov
// und data.sec.gov noetig; die SEC verlangt einen User-Agent mit Kontakt):
//   https://www.sec.gov/files/company_tickers_exchange.json
//   https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
//   https://data.sec.gov/submissions/CIK##########.json
//
// --cutoff JJJJ-MM-TT (Datenstichtag): companyfacts wird zusaetzlich als
// Kopie gespeichert, die nur Fakten mit `filed` <= Stichtag enthaelt. Der
// Replay nutzt diese Kopie; das Original bleibt daneben erhalten
// (*.companyfacts.raw.json). Geschaeftsjahr, Periodenende (`end`) und
// Veroeffentlichung (`filed`) bleiben in jedem Fakt getrennt erhalten.
//
// Ergebnis: DIR (Standard tests/real-data/cache/, nicht versioniert) und
// DIR/manifest.json mit URL, Abrufzeit, Groesse und SHA-256 je Datei.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
let dir = join(HERE, 'cache'), cutoff = null;
const tickers = [];
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--data') dir = a[++i];
  else if (a[i] === '--cutoff') cutoff = a[++i];
  else tickers.push(a[i].toUpperCase());
}
const UA = process.env.SEC_USER_AGENT;
if (!UA || !tickers.length || (cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(cutoff))) {
  console.error('Aufruf: SEC_USER_AGENT="Name kontakt@…" fetch-sources.mjs TICKER… [--cutoff JJJJ-MM-TT] [--data DIR]');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });
const manifestPath = join(dir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} };
manifest.cutoff = cutoff;

async function get(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} fuer ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(join(dir, file), buf);
  manifest.files[file] = { url, retrievedAt: new Date().toISOString(), bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex') };
  console.log(`  ${file} · ${buf.length} B · sha256 ${manifest.files[file].sha256.slice(0, 16)}`);
  return JSON.parse(buf.toString('utf8'));
}

function applyCutoff(facts) {
  let kept = 0, dropped = 0;
  for (const ns of Object.values(facts.facts || {})) for (const concept of Object.values(ns))
    for (const [u, arr] of Object.entries(concept.units || {})) {
      concept.units[u] = arr.filter(f => { const ok = typeof f.filed === 'string' && f.filed <= cutoff; ok ? kept++ : dropped++; return ok; });
    }
  return { kept, dropped };
}

let map;
try { map = await get('https://www.sec.gov/files/company_tickers_exchange.json', 'company_tickers_exchange.json'); }
catch (e) { console.error('QUELLE NICHT ERREICHBAR: ' + e.message + ' — Netzfreigabe fuer www.sec.gov/data.sec.gov pruefen.'); process.exit(2); }
const ti = map.fields.indexOf('ticker'), ci = map.fields.indexOf('cik');
for (const t of tickers) {
  const row = map.data.find(r => String(r[ti]).toUpperCase() === t);
  if (!row) { console.error(`${t}: nicht in company_tickers_exchange.json`); process.exitCode = 1; continue; }
  const cik = 'CIK' + String(row[ci]).padStart(10, '0');
  console.log(`${t} → ${cik}`);
  const facts = await get(`https://data.sec.gov/api/xbrl/companyfacts/${cik}.json`, `${cik}.companyfacts.raw.json`);
  await get(`https://data.sec.gov/submissions/${cik}.json`, `${cik}.submissions.json`);
  const c = cutoff ? applyCutoff(facts) : { kept: null, dropped: 0 };
  const out = Buffer.from(JSON.stringify(facts));
  writeFileSync(join(dir, `${cik}.companyfacts.json`), out);
  manifest.files[`${cik}.companyfacts.json`] = { derivedFrom: `${cik}.companyfacts.raw.json`, cutoff,
    factsKept: c.kept, factsDroppedAfterCutoff: c.dropped, sha256: createHash('sha256').update(out).digest('hex') };
  console.log(`  Stichtag ${cutoff || '—'}: ${c.dropped} spaeter veroeffentlichte Fakten entfernt`);
  await new Promise(r => setTimeout(r, 300)); // SEC-Fairness (< 10 Anfragen/s)
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest: ' + manifestPath);
