#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit: produktiver SEC-Importweg mit GESPEICHERTEN SEC-Dateien
// ───────────────────────────────────────────────────────────────────────────
// Start:  node tests/real-data/replay-import.mjs <TICKER> [--data DIR]
//              [--price N] [--out FILE]
//         node tests/real-data/replay-import.mjs --selftest
//
// Die Produktdatei laeuft in headless Chromium (tests/browser/cdp.mjs). Der
// Abruf geht durch DIESELBEN Funktionen wie die Knoepfe „Daten abrufen“ und
// „Import bestaetigen“ (secFetchAll → secConfirmImport, inkl. Tag-Auswahl,
// Ableitungen, Share-Audit, Precheck, Import, Engine). Nur die Antworten der
// „Datenverbindung“ kommen aus Dateien: jede Anfrage an
// http://sec-replay.invalid/?url=<SEC-URL> wird per CDP aus DIR beantwortet:
//
//   DIR/company_tickers_exchange.json   ← www.sec.gov/files/company_tickers_exchange.json
//   DIR/CIK##########.companyfacts.json ← data.sec.gov/api/xbrl/companyfacts/CIK….json
//   DIR/CIK##########.submissions.json  ← data.sec.gov/submissions/CIK….json
//
// Diese Dateien laedt tests/real-data/fetch-sources.mjs (braucht Netz zu
// data.sec.gov / www.sec.gov). Jede andere Anfrage (Yahoo, Fonts) wird
// abgewiesen; Yahoo ist abgeschaltet. Ein Kurs ist KEIN Abschlussdatum und
// wird nur mit --price als ausdrueckliche Annahme gesetzt.
//
// --selftest prueft nur die Mechanik mit dem SYNTHETISCHEN Filer der
// Browser-Abnahme. Das ist KEINE Validierung mit echten Daten.
//
// Exit: 0 = Lauf vollstaendig · 1 = Import blockiert/Fehler · 2 = nicht
// ausfuehrbar (kein Browser, fehlende Dateien).
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { launch, findChrome } from '../browser/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const APP = join(ROOT, 'us-aktienbewertungstool-v1036-sector-classification-patch.html');
const PROXY = 'http://sec-replay.invalid/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Felder der Abgleichstabellen (Auftrag Folgechat D, Abschnitt 3).
const FIELDS = ['revenue', 'ebit', 'da', 'ebitda', 'cfo', 'capex', 'fcf',
  'total_debt', 'net_debt', 'debt_short_term', 'debt_long_term_current', 'debt_long_term_noncurrent',
  'finance_lease_current', 'finance_lease_noncurrent',
  'operating_lease_liability_current', 'operating_lease_liability_noncurrent', 'operating_lease_liabilities',
  'cash_and_equivalents', 'shares_diluted', 'shares_basic', 'eps_diluted', 'dps', 'dps_direct',
  'dividends_paid', 'net_income', 'book_value', 'total_equity'];

function args() {
  const a = process.argv.slice(2);
  const o = { ticker: null, data: join(HERE, 'cache'), price: null, out: null, selftest: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--data') o.data = a[++i];
    else if (a[i] === '--price') o.price = Number(a[++i]);
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--selftest') o.selftest = true;
    else if (!o.ticker) o.ticker = a[i].toUpperCase();
  }
  return o;
}

async function selftestData() {
  const { ttmFacts } = await import('../browser/fixtures.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'aktientool-replay-selftest-'));
  const cik = '0000000999';
  writeFileSync(join(dir, 'company_tickers_exchange.json'), JSON.stringify({
    fields: ['cik', 'name', 'ticker', 'exchange'], data: [[999, 'Synthetik Replay AG', 'SYNTR', 'NYSE']] }));
  writeFileSync(join(dir, `CIK${cik}.companyfacts.json`), JSON.stringify({ cik: 999, entityName: 'Synthetik Replay AG', facts: ttmFacts() }));
  writeFileSync(join(dir, `CIK${cik}.submissions.json`), JSON.stringify({ sic: '3674', fiscalYearEnd: '1231', exchanges: ['NYSE'] }));
  return dir;
}

function fileFor(dir, url) {
  if (/\/files\/company_tickers_exchange\.json$/.test(url)) return join(dir, 'company_tickers_exchange.json');
  let m = url.match(/\/api\/xbrl\/companyfacts\/(CIK\d{10})\.json$/);
  if (m) return join(dir, m[1] + '.companyfacts.json');
  m = url.match(/\/submissions\/(CIK\d{10})\.json$/);
  if (m) return join(dir, m[1] + '.submissions.json');
  return null;
}

async function main() {
  const o = args();
  if (!o.ticker && !o.selftest) { console.error('Aufruf: replay-import.mjs <TICKER> [--data DIR] [--price N] [--out FILE] | --selftest'); process.exit(2); }
  if (!findChrome()) { console.error('NICHT AUSGEFUEHRT: kein Chromium/Chrome (CHROME_PATH setzen).'); process.exit(2); }
  let dataDir = o.data, cleanup = null;
  if (o.selftest) { dataDir = await selftestData(); cleanup = dataDir; o.ticker = 'SYNTR'; }
  if (!existsSync(join(dataDir, 'company_tickers_exchange.json'))) {
    console.error('NICHT AUSGEFUEHRT: ' + join(dataDir, 'company_tickers_exchange.json') + ' fehlt (zuerst fetch-sources.mjs).');
    process.exit(2);
  }

  const served = [], rejected = [], exceptions = [];
  const b = await launch({});
  const P = b.page;
  P.on('Fetch.requestPaused', async (e) => {
    const u = e.request.url;
    try {
      if (/^(file|data|blob|about):/.test(u)) return void await P.send('Fetch.continueRequest', { requestId: e.requestId });
      if (u.startsWith(PROXY)) {
        const target = new URL(u).searchParams.get('url') || '';
        const f = fileFor(dataDir, target);
        if (f && existsSync(f)) {
          const body = readFileSync(f);
          served.push({ url: target, file: f, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
          return void await P.send('Fetch.fulfillRequest', { requestId: e.requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
            body: body.toString('base64') });
        }
        served.push({ url: target, file: f, missing: true });
        return void await P.send('Fetch.fulfillRequest', { requestId: e.requestId, responseCode: 404,
          responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: '' });
      }
      rejected.push(u);
      await P.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' });
    } catch { /* Seite gewechselt */ }
  });
  P.on('Page.javascriptDialogOpening', (e) => P.send('Page.handleJavaScriptDialog', { accept: true }));
  P.on('Runtime.exceptionThrown', (e) => { const d = e.exceptionDetails || {}; exceptions.push((d.exception && d.exception.description) || d.text); });
  await P.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await P.send('Page.enable'); await P.send('Runtime.enable');

  const ev = async (expr) => {
    const r = await P.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('evaluate: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch { } await sleep(100); } return false; };

  let commit = 'unbekannt', dirty = 'unbekannt';
  try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim() ? 'ja' : 'nein'; } catch { }
  const report = { ticker: o.ticker, commit, localChanges: dirty, browser: b.version.product, dataDir, selftest: o.selftest,
    priceAssumption: o.price, runAt: new Date().toISOString() };
  let exit = 0;
  try {
    await P.send('Page.navigate', { url: pathToFileURL(APP).href });
    await waitFor("document.readyState === 'complete' && typeof secFetchAll === 'function' && !!document.getElementById('sec-ticker')", 15000);
    // Einrichtung (kein Pruefgegenstand): Datenverbindung, Yahoo aus, Ticker.
    await ev(`(() => { const p = document.getElementById('sec-proxy-url'); p.value = ${JSON.stringify(PROXY)}; secProxyConfigChanged(); secSaveProxyUrl();
      document.getElementById('sec-yahoo-enabled').checked = false; document.getElementById('sec-ticker').value = ${JSON.stringify(o.ticker)}; })()`);
    // Produktiver Abruf (= Knopf „Daten abrufen“).
    await ev('secFetchAll()');
    await waitFor("!!_secState.pendingMasterJson || /Abruf fehlgeschlagen|nicht in SEC/.test(document.getElementById('sec-status')?.innerText || '')", 60000);
    report.fetchStatus = await ev("(document.getElementById('sec-status') || {}).innerText || ''");
    report.pendingMasterJson = await ev('_secState.pendingMasterJson');
    if (!report.pendingMasterJson) throw new Error('Kein Master-JSON erzeugt: ' + report.fetchStatus);
    report.mappingDiag = await ev("(document.getElementById('sec-mapping-diag') || {}).innerText || ''");
    // Produktiver Import (= Knopf „Import bestaetigen“).
    await ev('secConfirmImport()');
    await sleep(500);
    report.importStatus = await ev("(document.getElementById('sec-status') || {}).innerText || ''");
    report.imported = await ev('!!(state.masterJson && state.masterJson.meta && state.masterJson.meta.ticker === ' + JSON.stringify(o.ticker) + ')');
    if (!report.imported) { exit = 1; throw new Error('Import blockiert: ' + report.importStatus); }
    if (o.price != null) {
      // Kurs = ausdrueckliche Annahme, getrennt von Abschlussdaten.
      await ev(`(() => { if (typeof renderAssumptions === 'function') renderAssumptions(true); const el = document.getElementById('as-price'); el.value = ${JSON.stringify(String(o.price))}; recalcFromAssumptions(); })()`);
      await sleep(300);
    }
    const snap = async () => ev(`(() => {
      const mj = state.masterJson, f = mj.fundamentals || {}, meta = f._v4_meta || {};
      const fields = {};
      for (const k of ${JSON.stringify(FIELDS)}) {
        const m = meta[k] || null;
        fields[k] = { values: Array.isArray(f[k]) ? f[k].slice(0, 3) : (f[k] ?? null),
          periods: m && m.periods ? m.periods.slice(0, 3) : null, forms: m && m.forms ? m.forms.slice(0, 3) : null,
          filed: m && m.filed ? m.filed.slice(0, 3) : null, accns: m && m.accns ? m.accns.slice(0, 3) : null,
          source_reference: m && m.source_reference || null, unit: m && m.unit || null,
          source_type: m && m.source_type || null, notes: m && m.notes ? String(m.notes).slice(0, 600) : null,
          unavailablePeriods: m && m.unavailablePeriods || null, derivationWarnings: m && m.derivationWarnings || null };
      }
      const models = {};
      for (const [k, r] of Object.entries((state.valuation && state.valuation.modelResults) || {})) {
        if (!r || typeof r !== 'object') continue;
        const pick = {};
        for (const [kk, vv] of Object.entries(r)) {
          if (/^(base|bear|bull|available|status)$|reason|warn|block|unavail|netDebt|shares|bridge|equity|period|basis/i.test(kk)
              && (vv == null || typeof vv !== 'object' || Array.isArray(vv))) pick[kk] = Array.isArray(vv) ? vv.slice(0, 12) : vv;
        }
        models[k] = pick;
      }
      const rm = state.synthesis && state.synthesis.relativeMultiples;
      const v = state.valuation || {};
      const gates = {};
      for (const [kk, vv] of Object.entries(v)) if (/gate|block|excluded|inactive|skipped|unavailable|status|warn/i.test(kk)) gates[kk] = vv;
      return { basis: v.dataBasis, router: v.router || null, reverseDcf: { status: v._reverseDcfStatus, reason: v._reverseDcfStatusReason }, valuationKeys: Object.keys(v), synthesisKeys: Object.keys(state.synthesis || {}), gates, fields, ttm: f._ttm || null, models,
        multiples: rm ? rm.models : null, range: state.synthesis && state.synthesis.range,
        price: mj.market && mj.market.price, shares_meta: mj.meta && { shares_source: mj.meta.shares_source, shares_normalization: mj.meta.shares_normalization },
        secFetch: mj._sec_fetch || mj.meta && mj.meta._sec_fetch || null };
    })()`);
    report.fy = await snap();
    const hasTtm = await ev("!!(state.valuation && state.valuation.dataBasis && state.valuation.dataBasis.ttm_available)");
    if (hasTtm) {
      await ev(`(() => { const s = document.getElementById('as-data-basis'); if (!s) { renderAssumptions(true); } const t = document.getElementById('as-data-basis'); t.value = 'ttm'; t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await sleep(400);
      report.ttmView = await snap();
    } else report.ttmView = { unavailable: true, dataBasis: report.fy.basis };
    report.panels = {};
    for (const p of ['overview', 'valuation', 'market', 'quality']) report.panels[p] = await ev(`(document.getElementById('panel-${p}') || {}).innerText || ''`);
  } catch (e) {
    report.error = String(e && e.message || e); if (!exit) exit = 1;
  } finally {
    report.served = served; report.rejected = rejected; report.exceptions = exceptions;
    await b.close();
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  }
  const out = o.out || join(HERE, 'out', o.ticker + '-report.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(`Ticker ${o.ticker} · Commit ${commit} (lokale Aenderungen: ${dirty}) · ${o.selftest ? 'SELBSTTEST, synthetisch' : 'Daten: ' + dataDir}`);
  for (const s of served) console.log('  Quelle ' + (s.missing ? 'FEHLT ' : '') + s.url + (s.sha256 ? ' · sha256 ' + s.sha256.slice(0, 16) + ' · ' + s.bytes + ' B' : ''));
  if (report.error) console.log('FEHLER: ' + report.error);
  if (report.fy) {
    console.log('\nFeld | Wert[0] (FY) | Periode[0] | Tag | Quelle');
    for (const [k, v] of Object.entries(report.fy.fields)) {
      const val = Array.isArray(v.values) ? v.values[0] : v.values;
      console.log(`${k} | ${val ?? '—'} | ${v.periods ? v.periods[0] : '—'} | ${(v.source_reference || '—').slice(0, 90)} | ${v.source_type || '—'}`);
    }
    console.log('\nModell | base | verfuegbar | Grund');
    for (const [k, m] of Object.entries(report.fy.models)) console.log(`${k} | ${m.base ?? '—'} | ${m.available ?? '—'} | ${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([x]) => /reason|block|unavail/i.test(x)))).slice(0, 200)}`);
  }
  console.log('\nBericht: ' + out + (rejected.length ? ' · abgewiesene Anfragen: ' + rejected.length : '') + (exceptions.length ? ' · Ausnahmen: ' + exceptions.length : ''));
  process.exit(exit);
}

main().catch(e => { console.error('NICHT AUSGEFUEHRT: ' + (e && e.stack || e)); process.exit(2); });
