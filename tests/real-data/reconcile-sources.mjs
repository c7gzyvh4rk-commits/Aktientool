#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit D3: Quellenabgleich der Replay-Erfassung gegen Company Facts
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources.mjs und replay-import.mjs <TICKER>):
//   node tests/real-data/reconcile-sources.mjs MCD JNJ [--data DIR] [--years 3] [--md out.md]
//
// Liest je Ticker
//   * tests/real-data/out/<TICKER>-report.json  (Erfassung `fy` des Replays:
//     Werte, Perioden, Tag, Akten wie die Engine sie verwendet) und
//   * DIR/<CIK>.companyfacts.json (Stichtagskopie aus fetch-sources.mjs)
// und prueft UNABHAENGIG vom Produktcode (keine Produktfunktion, nur JSON):
//   gemeldete Felder  — Wert = 10-K-Fakt desselben Tags und derselben Periode
//                       (Strom: Jahreszeitraum 350–380 Tage; Stichtag: instant),
//                       und zwar der zuletzt eingereichte; Akte des Tools
//                       gehoert zu einem 10-K-Fakt dieser Periode;
//   abgeleitete Felder — Rechenweg aus den erfassten Bestandteilen
//                       (EBITDA − EBIT = D&A-Fakt derselben Periode,
//                       FCF = CFO − CapEx, Nettoschulden = Schulden − Liquiditaet,
//                       Buchwert = Aktiva − Passiva aus den Fakten).
// Einheiten: USD und Aktien in Mio. (Tool-Einheit), USD je Aktie unveraendert.
// Toleranz: 0,05 Mio. bzw. 0,005 USD je Aktie (Darstellungsrundung der
// Rohwerte auf Mio.), sonst exakt. --years begrenzt die Tiefe; mehr als die
// Erfassung enthaelt (derzeit 3 Werte je Feld) wird nicht geprueft.
// Aktien, die der Filer schon in Mio. meldet (MCD, F-4), gelten nur mit
// unabhaengiger Bestaetigung durch NI/EPS derselben Periode (±1 %).
//
// Exit: 0 = alle geprueften Werte stimmen · 1 = mindestens eine Abweichung
//       · 2 = nicht ausfuehrbar (Bericht oder Quelle fehlt).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
let dir = join(HERE, 'cache'), years = 3, md = null;
const tickers = [];
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--data') dir = a[++i];
  else if (a[i] === '--years') years = Number(a[++i]);
  else if (a[i] === '--md') md = a[++i];
  else tickers.push(a[i].toUpperCase());
}
if (!tickers.length) { console.error('Ticker fehlt'); process.exit(2); }

const PER_SHARE = new Set(['eps_diluted', 'dps', 'dps_direct']);
const DA_TAGS = ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization',
  'DepreciationAmortizationAndAccretionNet', 'Depreciation'];
const days = (s, e) => Math.round((Date.parse(e) - Date.parse(s)) / 864e5);

function factsFor(cf, tag) {
  const t = (cf.facts['us-gaap'] || {})[tag];
  if (!t) return [];
  return Object.entries(t.units).flatMap(([unit, arr]) => arr.map(x => Object.assign({ unit }, x)));
}
// 10-K-Fakten eines Tags fuer eine Periode (Strom: Jahreszeitraum; Stichtag: instant).
function annual(cf, tag, end, flow) {
  return factsFor(cf, tag).filter(x => x.end === end && /^10-K/.test(x.form || '') &&
    (flow ? (x.start && days(x.start, x.end) >= 350 && days(x.start, x.end) <= 380) : !x.start));
}
const scale = (field, x) => PER_SHARE.has(field) ? x.val : x.val / 1e6;
const tol = (field) => PER_SHARE.has(field) ? 0.005 : 0.05;
const latest = (arr) => arr.slice().sort((p, q) => (p.filed < q.filed ? 1 : p.filed > q.filed ? -1 : 0))[0];
const fmt = (x) => x == null ? '—' : (Math.round(x * 1000) / 1000).toLocaleString('en-US');

function reconcile(ticker) {
  const repFile = join(HERE, 'out', ticker + '-report.json');
  const man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const repJ = existsSync(repFile) ? JSON.parse(readFileSync(repFile, 'utf8')) : null;
  if (!repJ) throw new Error('Bericht fehlt: ' + repFile + ' (zuerst replay-import.mjs ' + ticker + ')');
  // Company-Facts-Datei ueber die Ticker-Zuordnung der SEC (wie fetch-sources.mjs).
  const tick = JSON.parse(readFileSync(join(dir, 'company_tickers_exchange.json'), 'utf8'));
  const row = tick.data.find(d => String(d[2]).toUpperCase() === ticker);
  if (!row) throw new Error('Ticker nicht in company_tickers_exchange.json: ' + ticker);
  const cfName = 'CIK' + String(row[0]).padStart(10, '0') + '.companyfacts.json';
  if (!existsSync(join(dir, cfName))) throw new Error('Company Facts fehlen: ' + cfName);
  const rawName = cfName.replace('.json', '.raw.json');
  const sha = (man.files[rawName] && man.files[rawName].sha256) || null;
  const cf = JSON.parse(readFileSync(join(dir, cfName), 'utf8'));
  const F = repJ.fy.fields;
  const rows = [];
  const add = (field, i, period, tool, source, ok, note) => rows.push({ field, i, period, tool, source, ok, note });
  const tagOf = (k) => (F[k] && F[k].provenance && F[k].provenance.tag) || null;
  const flowOf = (k) => (F[k] && /Strom|Durchschnitt/.test(F[k].concept || ''));

  for (const [k, f] of Object.entries(F)) {
    const vals = Array.isArray(f.values) ? f.values : [];
    const pers = (f.period && f.period.periods) || [];
    const accns = (f.provenance && f.provenance.accns) || [];
    const tag = tagOf(k) || (k === 'dps' ? tagOf('dps_direct') : null);
    for (let i = 0; i < Math.min(years, vals.length); i++) {
      const v = vals[i], end = pers[i];
      if (v == null || !end) { add(k, i, end || null, v, null, null, 'kein Wert/keine Periode im Tool'); continue; }
      if (tag && (f.provenance.source_type === 'reported')) {
        const c = annual(cf, tag, end, flowOf(k));
        if (!c.length) { add(k, i, end, v, null, false, tag + ': kein 10-K-Fakt dieser Periode'); continue; }
        const L = latest(c);
        // Aktien: Meldet der Filer die Stueckzahl bereits in Mio. (MCD ab dem
        // 10-K FY2023: „716.4“ statt 716,400,000, Befund F-4), gilt der Rohwert
        // nur dann als Beleg, wenn NI/EPS derselben Periode ihn unabhaengig
        // bestaetigt (±1 %).
        if (/^shares_/.test(k) && Math.abs(scale(k, L) - v) > tol(k) && Math.abs(L.val - v) <= tol(k)) {
          const ni = annual(cf, 'NetIncomeLoss', end, true), eps = annual(cf,
            k === 'shares_basic' ? 'EarningsPerShareBasic' : 'EarningsPerShareDiluted', end, true);
          const implied = (ni.length && eps.length) ? (latest(ni).val / 1e6) / latest(eps).val : null;
          const okI = implied != null && Math.abs(implied - v) / v <= 0.01;
          add(k, i, end, v, L.val, okI && (!accns[i] || c.some(x => x.accn === accns[i])),
            tag + ' · Filer meldet in Mio. (' + fmt(L.val) + ' „shares“, F-4); NI/EPS = ' + fmt(implied) +
            (okI ? ' bestaetigt' : ' bestaetigt NICHT'));
          continue;
        }
        const okLatest = Math.abs(scale(k, L) - v) <= tol(k);
        const other = c.find(x => Math.abs(scale(k, x) - v) <= tol(k));
        const accnOk = !accns[i] || c.some(x => x.accn === accns[i]);
        const distinct = [...new Set(c.map(x => scale(k, x)))];
        add(k, i, end, v, scale(k, L), okLatest && accnOk,
          tag + (okLatest ? '' : other ? ' · Toolwert = aeltere Fassung ' + other.accn : ' · kein passender Fakt') +
          (accnOk ? '' : ' · Akte ' + accns[i] + ' nicht unter den Fakten') +
          (distinct.length > 1 ? ' · Fassungen: ' + distinct.map(fmt).join(' / ') + ' (juengste ' + L.accn + ')' : ''));
        continue;
      }
      // Abgeleitete Felder: Rechenweg aus Bestandteilen derselben Periode.
      const at = (kk) => {
        const g = F[kk]; if (!g || !g.period || !g.period.periods) return null;
        const j = g.period.periods.indexOf(end); return j >= 0 ? g.values[j] : null;
      };
      if (k === 'ebitda') {
        const e = at('ebit'); const da = e == null ? null : v - e;
        const hits = DA_TAGS.map(t => ({ t, c: annual(cf, t, end, true) })).filter(h => h.c.length)
          .map(h => ({ t: h.t, v: scale(k, latest(h.c)) }));
        const hit = hits.find(h => da != null && Math.abs(h.v - da) <= tol(k));
        add(k, i, end, v, e != null && hit ? e + hit.v : null, !!hit,
          'EBIT ' + fmt(e) + ' + D&A ' + fmt(da) + (hit ? ' (= ' + hit.t + ')' : ' · kein D&A-Fakt mit diesem Betrag') +
          (hits.length > 1 ? ' · gemeldet: ' + hits.map(h => h.t + ' ' + fmt(h.v)).join(', ') : ''));
      } else if (k === 'fcf') {
        const c = at('cfo'), x = at('capex');
        const s = (c != null && x != null) ? c - x : null;
        add(k, i, end, v, s, s != null && Math.abs(s - v) <= tol(k), 'CFO ' + fmt(c) + ' − CapEx ' + fmt(x));
      } else if (k === 'net_debt') {
        const d = at('total_debt'), c = at('cash_and_equivalents');
        const s = (d != null && c != null) ? d - c : null;
        add(k, i, end, v, s, s != null && Math.abs(s - v) <= tol(k), 'Schulden ' + fmt(d) + ' − Liquiditaet ' + fmt(c));
      } else if (k === 'book_value') {
        const A = annual(cf, 'Assets', end, false), Lb = annual(cf, 'Liabilities', end, false);
        const s = (A.length && Lb.length) ? (latest(A).val - latest(Lb).val) / 1e6 : null;
        add(k, i, end, v, s, s != null && Math.abs(s - v) <= tol(k), 'Assets − Liabilities (10-K-Fakten)');
      } else {
        add(k, i, end, v, null, null, 'nicht einzeln abgleichbar: ' + String(f.provenance && f.provenance.source_reference).slice(0, 80));
      }
    }
  }
  const empty = Object.entries(F).filter(([, f]) => !(Array.isArray(f.values) && f.values.some(x => x != null)))
    .map(([k]) => k);
  return { ticker, cfName, rows, sha, empty };
}

let bad = 0, out = [];
for (const t of tickers) {
  let r;
  try { r = reconcile(t); } catch (e) { console.error('NICHT AUSFUEHRBAR: ' + e.message); process.exit(2); }
  const checked = r.rows.filter(x => x.ok !== null);
  const fails = checked.filter(x => !x.ok);
  bad += fails.length;
  out.push('### ' + t + ' — ' + r.cfName + ' (Rohdatei sha256 ' + String(r.sha).slice(0, 16) + '…)\n');
  out.push('| Feld | i | Periode | Tool | Quelle | ✓ | Hinweis |');
  out.push('|---|---|---|---|---|---|---|');
  for (const x of r.rows) out.push(`| ${x.field} | ${x.i} | ${x.period || '—'} | ${fmt(x.tool)} | ${fmt(x.source)} | ${x.ok === null ? '·' : x.ok ? '✓' : '✗'} | ${x.note || ''} |`);
  out.push('', 'Ohne Wert im Tool (nicht abgeglichen): ' + (r.empty.length ? r.empty.join(', ') : '—'), '');
  console.log(`${t}: ${checked.length - fails.length}/${checked.length} Werte stimmen mit der Quelle` +
    (fails.length ? ' — ABWEICHUNG: ' + fails.map(x => x.field + '[' + x.i + ']').join(', ') : ''));
  for (const x of fails) console.log('  ABWEICHUNG ' + x.field + '[' + x.i + '] ' + x.period + ': Tool ' + fmt(x.tool) + ' · Quelle ' + fmt(x.source) + ' · ' + x.note);
}
if (md) writeFileSync(md, out.join('\n'));
process.exit(bad ? 1 : 0);
