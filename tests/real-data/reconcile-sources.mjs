#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit D3: Quellenabgleich der Replay-Erfassung (FY, ganze Historie)
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources.mjs, fetch-filings.mjs und replay-import.mjs):
//   node tests/real-data/reconcile-sources.mjs MCD JNJ [--data DIR] [--reports DIR] [--evidence DIR] [--years N] [--md out.md]
//
// Liest je Ticker die Erfassung `fy` aus out/<TICKER>-report.json und prueft
// UNABHAENGIG vom Produktcode (keine Produktfunktion) JEDEN erfassten Wert der
// Reihe (Standard: ganze Historie, --years begrenzt):
//
//   gemeldete Felder  — (a) Company Facts: zuletzt eingereichter 10-K-Fakt
//                       desselben Tags und derselben Periode, Akte des Tools
//                       gehoert dazu; (b) ORIGINAL: derselbe Fakt steht im
//                       zitierten Originaldokument (iXBRL bzw. Instanz) mit
//                       diesem Wert; Fundstelle = Tabellenzeile.
//   EBITDA            — EBITDA − EBIT muss die GESAMT-D&A derselben Periode sein:
//                       belegt durch den Auditbeleg (evidence/<T>.json,
//                       daTotals) oder, ohne Beleg, durch den groessten
//                       D&A-Posten des Originalberichts (DDA ⊇ D&A ⊇
//                       Depreciation; ein Gesamtbetrag ist nie kleiner als ein
//                       Teilposten). Passt die Differenz nur zu einem kleineren
//                       Posten (Teilposten, z. B. SG&A-D&A), ist das eine
//                       ABWEICHUNG — auch wenn der Betrag „zu einem D&A-Tag passt“.
//   Schulden          — Rechenidentitaet und fachlicher Umfang getrennt. Ein
//                       rechnerisch richtiger Teilbetrag bekommt „Rechnung ✓“,
//                       aber nicht „Umfang belegt“. Umfang laut Auditbeleg
//                       (debtScope). Kennzeichnet die Engine einen Teilbetrag
//                       als unvollstaendig (scope.complete = false), ist das
//                       eine berechtigte Einschraenkung; als vollstaendig
//                       ausgewiesen ⇒ ABWEICHUNG.
//   sonstige Ableitungen — FCF, Nettoschulden, Buchwert, Goodwill+Intangibles,
//                       Tangible Book Value, cash-Alias ueber ihren Rechenweg.
//
// Status je Zeile: korrekt · berechtigte Einschraenkung · offen (nicht
// belegbar, z. B. Original nicht geladen) · ABWEICHUNG.
// Exit: 0 = keine Abweichung · 1 = mindestens eine Abweichung · 2 = nicht
// ausfuehrbar. Offene Zeilen werden gezaehlt und ausgegeben.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEvidence, filingIndex, factsOfAccn, verifyEvidence } from './evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PER_SHARE = new Set(['eps_diluted', 'dps', 'dps_direct']);
// D&A-Familie (Taxonomie: DDA ⊇ D&A ⊇ Depreciation).
export const DA_TAGS = ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization',
  'DepreciationAmortizationAndAccretionNet', 'Depreciation', 'DepreciationNonproduction',
  'DepreciationAndAmortizationExcludingDiscontinuedOperations'];
const DEBT_FIELDS = new Set(['total_debt', 'long_term_debt', 'net_debt']);
const days = (s, e) => Math.round((Date.parse(e) - Date.parse(s)) / 864e5);
export const fmt = (x) => x == null ? '—' : (typeof x === 'number' ? (Math.round(x * 1000) / 1000).toLocaleString('en-US') : String(x));

function cfFacts(cf, tag) {
  const root = cf.facts && cf.facts['us-gaap'] ? cf.facts['us-gaap'] : (cf.facts || {});
  const t = root[tag];
  if (!t) return [];
  return Object.entries(t.units).flatMap(([unit, arr]) => arr.map(x => Object.assign({ unit }, x)));
}
function annual(cf, tag, end, flow, start) {
  return cfFacts(cf, tag).filter(x => x.end === end && /^10-K/.test(x.form || '') &&
    (flow ? (x.start && (start ? x.start === start : (days(x.start, x.end) >= 350 && days(x.start, x.end) <= 380))) : !x.start));
}
const scale = (field, v) => PER_SHARE.has(field) ? v : v / 1e6;
const tol = (field) => PER_SHARE.has(field) ? 0.005 : 0.05;
const latest = (arr) => arr.slice().sort((p, q) => (p.filed < q.filed ? 1 : p.filed > q.filed ? -1 : 0))[0];

// Fakten eines Originaldokuments zu einem Tag und einer Periode (ohne Dimensionen).
function origFacts(idx, accn, tag, end, flow, start) {
  const F = idx && accn ? factsOfAccn(idx, accn) : null;
  if (!F) return null;
  const list = F.facts.filter(x => x.dims.length === 0 && x.name.split(':')[1] === tag &&
    (flow ? (x.end === end && x.start && (start ? x.start === start : (days(x.start, x.end) >= 350 && days(x.start, x.end) <= 380)))
          : x.instant === end));
  return { doc: F.doc, list };
}

export function reconcileReport({ report, cf, idx = null, evidence = null, evRes = null, years = Infinity }) {
  const F = report.fy.fields;
  const rows = [];
  const add = (r) => rows.push(Object.assign({ calc: null, orig: null, scope: null, status: null }, r));
  const tagOf = (k) => (F[k] && F[k].provenance && F[k].provenance.tag) || null;
  const flowOf = (k) => (F[k] && /Strom|Durchschnitt/.test(F[k].concept || ''));
  const at = (kk, end) => {
    const g = F[kk]; if (!g || !g.period || !g.period.periods) return null;
    const j = g.period.periods.indexOf(end); return j >= 0 ? g.values[j] : null;
  };
  const evVal = (id) => (evRes && evRes[id] && evRes[id].ok) ? evRes[id].expected : null;
  const evSum = (ids) => { if (!ids) return null; const a = [].concat(ids).map(evVal); return a.some(x => x == null) ? null : a.reduce((s, x) => s + x, 0); };
  const daEv = {}; for (const d of ((evidence && evidence.daTotals) || [])) daEv[d.period] = d;
  const debtEv = {}; for (const d of ((evidence && evidence.debtScope) || [])) debtEv[d.period] = d;

  for (const [k, f] of Object.entries(F)) {
    const vals = Array.isArray(f.values) ? f.values : [];
    const pers = (f.period && f.period.periods) || [];
    const starts = (f.period && f.period.starts) || [];
    const accns = (f.provenance && f.provenance.accns) || [];
    const tag = tagOf(k) || (k === 'dps' ? tagOf('dps_direct') : null);
    const reported = !!(tag && f.provenance && f.provenance.source_type === 'reported');
    for (let i = 0; i < Math.min(years, vals.length); i++) {
      const v = vals[i], end = pers[i], start = starts[i] || null;
      const base = { field: k, i, period: end || null, tool: v, accn: accns[i] || null };
      if (k === 'cash' && v != null && !end && F.cash_and_equivalents) {
        const s0 = F.cash_and_equivalents.values[i];
        add(Object.assign(base, { period: (F.cash_and_equivalents.period.periods || [])[i] || null, source: s0, calc: s0 != null && Math.abs(s0 - v) <= 0.05,
          status: s0 != null && Math.abs(s0 - v) <= 0.05 ? 'korrekt' : 'ABWEICHUNG', note: 'Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position)' }));
        continue;
      }
      if (v == null || !end) { add(Object.assign(base, { status: 'offen', note: 'kein Wert/keine Periode im Tool (nicht verwendet)' })); continue; }
      const notes = [];
      let source = null, calc = null, orig = null, scope = null;
      if (reported) {
        const flow = flowOf(k);
        const c = annual(cf, tag, end, flow, flow ? start : null);
        if (!c.length) { calc = false; notes.push(tag + ': kein 10-K-Fakt dieser Periode in Company Facts'); }
        else {
          const L = latest(c);
          const accnOk = !accns[i] || c.some(x => x.accn === accns[i]);
          let okCf;
          if (/^shares_/.test(k) && Math.abs(scale(k, L.val) - v) > tol(k) && Math.abs(L.val - v) <= tol(k)) {
            // Filer meldet bereits in Mio. (F-4): nur mit NI/EPS derselben Periode.
            const ni = annual(cf, 'NetIncomeLoss', end, true), eps = annual(cf,
              k === 'shares_basic' ? 'EarningsPerShareBasic' : 'EarningsPerShareDiluted', end, true);
            const implied = (ni.length && eps.length) ? (latest(ni).val / 1e6) / latest(eps).val : null;
            okCf = implied != null && Math.abs(implied - v) / v <= 0.01;
            if (!okCf && implied != null && Math.abs(implied * 1e6 - v) / v <= 0.01) notes.push('Toolwert ist eine ROHSTUECKZAHL in der Mio.-Reihe (gemischte Skalierung, vgl. F-4)');
            else notes.push('Filer meldet in Mio. (' + fmt(L.val) + ' „shares“, F-4); NI/EPS = ' + fmt(implied) + (okCf ? ' bestaetigt' : ' bestaetigt NICHT'));
            source = L.val;
          } else {
            okCf = Math.abs(scale(k, L.val) - v) <= tol(k);
            source = scale(k, L.val);
            const distinct = [...new Set(c.map(x => scale(k, x.val)))];
            if (distinct.length > 1) notes.push('Fassungen ' + distinct.map(fmt).join(' / ') + ' (juengste ' + L.accn + ')');
            if (!okCf) notes.push('Company Facts: juengster Fakt ' + fmt(scale(k, L.val)));
          }
          if (!accnOk) notes.push('Akte ' + accns[i] + ' nicht unter den Fakten');
          calc = okCf && accnOk;
        }
        // Original des zitierten Berichts. Ohne Aktenangabe im Tool (z. B.
        // Aktien, DPS) die Akte des passenden Company-Facts-Fakts.
        let accnO = accns[i] || null, accnNote = '';
        if (!accnO && c.length) { const m = c.filter(x => Math.abs(scale(k, x.val) - v) <= tol(k) || Math.abs(x.val - v) <= tol(k)); const L2 = latest(m.length ? m : c); accnO = L2.accn; accnNote = ' (Akte laut Company Facts)'; }
        const o = origFacts(idx, accnO, tag, end, flowOf(k), flowOf(k) ? start : null);
        if (!o) { orig = null; notes.push('Original ' + (accnO || '—') + accnNote + ' nicht geladen'); }
        else if (!o.list.length) { orig = false; notes.push('Original ' + o.doc.rel.split('/').pop() + ': Fakt fehlt'); }
        else {
          const hit = o.list.find(x => Math.abs(scale(k, x.value) - v) <= tol(k) || (/^shares_/.test(k) && Math.abs(x.value - v) <= tol(k) && calc));
          orig = !!hit;
          notes.push('Original ' + o.doc.rel.split('/').pop() + accnNote + ': ' + (hit ? '„' + String(hit.row || '').slice(0, 70) + '“' : 'Wert ' + o.list.map(x => fmt(scale(k, x.value))).join('/')));
        }
      } else if (k === 'ebitda') {
        const e = at('ebit', end); const da = e == null ? null : v - e;
        const ev = daEv[end];
        let expected = null, how = null;
        if (ev && evVal(ev.item) != null) { expected = evVal(ev.item); how = 'Auditbeleg ' + ev.item + ' (Original, Gesamt-D&A)'; }
        // Alle D&A-Posten der Periode (Company Facts und Original des EBIT-Berichts).
        const cands = [];
        for (const t of DA_TAGS) {
          for (const x of annual(cf, t, end, true, starts[i] || null)) cands.push({ t, v: x.val / 1e6, src: 'CF' });
          const o = origFacts(idx, (F.ebit && F.ebit.provenance && F.ebit.provenance.accns || [])[F.ebit ? F.ebit.period.periods.indexOf(end) : -1], t, end, true, starts[i] || null);
          if (o) for (const x of o.list) cands.push({ t, v: x.value / 1e6, src: 'Original', row: x.row });
        }
        const max = cands.length ? Math.max(...cands.map(c => c.v)) : null;
        if (expected == null && max != null) { expected = max; how = 'groesster gemeldeter D&A-Posten (' + cands.filter(c => c.v === max).map(c => c.t + (c.row ? ' „' + c.row.slice(0, 40) + '“' : '')).filter((x, j, a) => a.indexOf(x) === j).join(', ') + ')'; }
        source = (e != null && expected != null) ? e + expected : null;
        calc = da != null && expected != null && Math.abs(da - expected) <= tol(k);
        const partial = cands.filter(c => da != null && Math.abs(c.v - da) <= tol(k) && expected != null && c.v < expected - tol(k));
        notes.push('EBIT ' + fmt(e) + ' + D&A ' + fmt(da) + ' · erwartet Gesamt-D&A ' + fmt(expected) + (how ? ' [' + how + ']' : ''));
        if (partial.length) notes.push('D&A = TEILPOSTEN ' + [...new Set(partial.map(p => p.t))].join('/') + ' — nicht die Gesamt-D&A');
        if (expected == null) { calc = null; notes.push('kein D&A-Posten belegbar'); }
        scope = ev ? 'belegt' : (cands.some(c => c.src === 'Original') ? 'belegt (Original, Groessenregel)' : 'offen (nur Company Facts)');
      } else if (k === 'fcf') {
        const c = at('cfo', end), x = at('capex', end);
        source = (c != null && x != null) ? c - x : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('CFO ' + fmt(c) + ' − CapEx ' + fmt(x));
      } else if (k === 'net_debt') {
        const d = at('total_debt', end), c = at('cash_and_equivalents', end);
        source = (d != null && c != null) ? d - c : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('Rechnung: Schulden ' + fmt(d) + ' − Liquiditaet ' + fmt(c));
      } else if (k === 'book_value' || k === 'total_equity') {
        const A = annual(cf, 'Assets', end, false), Lb = annual(cf, 'Liabilities', end, false);
        source = (A.length && Lb.length) ? (latest(A).val - latest(Lb).val) / 1e6 : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('Assets − Liabilities (10-K-Fakten)');
      } else if (k === 'cash') {
        source = F.cash_and_equivalents ? F.cash_and_equivalents.values[i] : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('Alias von cash_and_equivalents');
      } else if (k === 'goodwill_and_intangibles') {
        const g = annual(cf, 'Goodwill', end, false), ia = annual(cf, 'IntangibleAssetsNetExcludingGoodwill', end, false);
        source = g.length ? (latest(g).val + (ia.length ? latest(ia).val : 0)) / 1e6 : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('Goodwill ' + (g.length ? fmt(latest(g).val / 1e6) : '—') + ' + Intangibles ' + (ia.length ? fmt(latest(ia).val / 1e6) : 'nicht gemeldet'));
      } else if (k === 'tangible_book_value') {
        const b = at('total_equity', end) != null ? at('total_equity', end) : at('book_value', end), g = at('goodwill_and_intangibles', end);
        source = (b != null && g != null) ? b - g : null;
        calc = source != null && Math.abs(source - v) <= tol(k);
        notes.push('Eigenkapital ' + fmt(b) + ' − Goodwill/Intangibles ' + fmt(g));
      } else {
        notes.push('nicht einzeln abgleichbar: ' + String(f.provenance && (f.provenance.source_reference || f.provenance.source_type)).slice(0, 80));
      }
      // Fachlicher Umfang der Schulden (getrennt von der Rechnung).
      if (DEBT_FIELDS.has(k)) {
        const ev = debtEv[end];
        const flag = (F.total_debt && F.total_debt.provenance && F.total_debt.provenance.scope) || null;
        const flaggedIncomplete = !!(flag && flag.complete === false);
        if (!ev) scope = 'offen (kein Umfangsbeleg)';
        else {
          const debt = evSum(ev.financialDebt), fl = ev.financeLeases ? evSum(ev.financeLeases) : null, cash = evVal(ev.cash);
          const full = k === 'net_debt' ? (debt != null && cash != null ? debt + (fl || 0) - cash : null) : debt;
          const flOpen = ev.financeLeases === null;
          const complete = full != null && Math.abs(full - v) <= tol(k) && !flOpen && !(k === 'net_debt' && fl == null && ev.financeLeases);
          if (complete) scope = 'belegt (' + fmt(full) + ')';
          else scope = 'Teilbetrag: vollstaendig ' + (flOpen && k === 'net_debt' ? '≥ ' : '') + fmt(full) + (flOpen ? ' (Finance-Leasing ohne Betrag)' : fl != null && k === 'net_debt' ? ' (inkl. Finance-Leasing ' + fmt(fl) + ')' : '')
            + ' · Engine: ' + (flaggedIncomplete ? 'Umfang als unvollstaendig gekennzeichnet' + (flag.contradiction ? ' (' + flag.contradiction + ')' : '') : 'als vollstaendig ausgewiesen');
          if (i === 0 && !complete && !flaggedIncomplete) notes.push('Teilbetrag ohne Kennzeichnung');
          notes.push(ev.note || '');
          base.scopeFlagged = flaggedIncomplete;
        }
      }
      let status;
      if (calc === false || orig === false || notes.some(n => /TEILPOSTEN|ohne Kennzeichnung/.test(n))) status = 'ABWEICHUNG';
      else if (scope && /^Teilbetrag/.test(scope)) status = base.scopeFlagged ? 'berechtigte Einschraenkung' : 'ABWEICHUNG';
      else if (calc == null || (reported && orig == null) || (scope && /^offen/.test(scope))) status = 'offen';
      else status = 'korrekt';
      add(Object.assign(base, { source, calc, orig, scope, status, note: notes.filter(Boolean).join(' · ') }));
    }
  }
  const empty = Object.entries(F).filter(([, f]) => !(Array.isArray(f.values) && f.values.some(x => x != null))).map(([k]) => k);
  return { rows, empty };
}

function tickerFiles(ticker, dir) {
  const tick = JSON.parse(readFileSync(join(dir, 'company_tickers_exchange.json'), 'utf8'));
  const row = tick.data.find(d => String(d[2]).toUpperCase() === ticker);
  if (!row) throw new Error('Ticker nicht in company_tickers_exchange.json: ' + ticker);
  return 'CIK' + String(row[0]).padStart(10, '0') + '.companyfacts.json';
}

export function renderMarkdown(ticker, r, meta) {
  const out = ['### ' + ticker + ' — ' + meta + '\n',
    '| Feld | i | Periode | Tool | Quelle | Rechnung | Original | Umfang | Status | Hinweis |', '|---|---|---|---|---|---|---|---|---|---|'];
  const m = (x) => x === null ? '·' : x ? '✓' : '✗';
  for (const x of r.rows) out.push(`| ${x.field} | ${x.i} | ${x.period || '—'} | ${fmt(x.tool)} | ${fmt(x.source)} | ${m(x.calc)} | ${m(x.orig)} | ${x.scope || '—'} | ${x.status} | ${String(x.note || '').replace(/\|/g, '/')} |`);
  out.push('', 'Ohne Wert im Tool (nicht abgeglichen): ' + (r.empty.length ? r.empty.join(', ') : '—'), '');
  return out.join('\n');
}

async function main() {
  const a = process.argv.slice(2);
  let dir = join(HERE, 'cache'), years = Infinity, md = null, reports = join(HERE, 'out'), evDir = join(HERE, 'evidence');
  const tickers = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--data') dir = a[++i];
    else if (a[i] === '--years') years = Number(a[++i]);
    else if (a[i] === '--md') md = a[++i];
    else if (a[i] === '--reports') reports = a[++i];
    else if (a[i] === '--evidence') evDir = a[++i];
    else tickers.push(a[i].toUpperCase());
  }
  if (!tickers.length) { console.error('Ticker fehlt'); process.exit(2); }
  const idx = filingIndex(dir);
  if (!idx.manifest) console.log('Hinweis: keine Originaldokumente (fetch-filings.mjs) — Spalte „Original“ bleibt offen.');
  let bad = 0; const out = [];
  for (const t of tickers) {
    let r, cfName, sha;
    try {
      const repFile = join(reports, t + '-report.json');
      if (!existsSync(repFile)) throw new Error('Bericht fehlt: ' + repFile + ' (zuerst replay-import.mjs ' + t + ')');
      cfName = tickerFiles(t, dir);
      if (!existsSync(join(dir, cfName))) throw new Error('Company Facts fehlen: ' + cfName);
      const man = existsSync(join(dir, 'manifest.json')) ? JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) : { files: {} };
      sha = (man.files[cfName.replace('.json', '.raw.json')] || {}).sha256 || null;
      const evidence = loadEvidence(t, evDir);
      const evRes = evidence ? verifyEvidence(evidence, idx) : null;
      if (evRes) { const eb = Object.values(evRes).filter(x => !x.ok); if (eb.length) console.log(`${t}: ${eb.length} Auditbeleg(e) nicht im Original bestaetigt: ${eb.map(x => x.id).join(', ')}`); }
      r = reconcileReport({ report: JSON.parse(readFileSync(repFile, 'utf8')), cf: JSON.parse(readFileSync(join(dir, cfName), 'utf8')), idx, evidence, evRes, years });
    } catch (e) { console.error('NICHT AUSFUEHRBAR: ' + e.message); process.exit(2); }
    const by = (s) => r.rows.filter(x => x.status === s);
    const fails = by('ABWEICHUNG');
    bad += fails.length;
    out.push(renderMarkdown(t, r, cfName + ' (Rohdatei sha256 ' + String(sha).slice(0, 16) + '…)'));
    console.log(`${t}: ${r.rows.length} Werte · korrekt ${by('korrekt').length} · berechtigte Einschraenkung ${by('berechtigte Einschraenkung').length} · offen ${by('offen').length} · ABWEICHUNG ${fails.length}`);
    for (const x of fails) console.log('  ABWEICHUNG ' + x.field + '[' + x.i + '] ' + x.period + ': Tool ' + fmt(x.tool) + ' · Quelle ' + fmt(x.source) + ' · ' + x.note);
    for (const x of by('offen').filter(x => x.tool != null)) console.log('  offen ' + x.field + '[' + x.i + '] ' + x.period + ': ' + x.note.slice(0, 160));
  }
  if (md) writeFileSync(md, out.join('\n'));
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
