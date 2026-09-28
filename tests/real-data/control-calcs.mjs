#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit D3: unabhaengige Kontrollrechnungen FY und TTM (4 Prueffaelle)
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources.mjs, fetch-filings.mjs und replay-import.mjs):
//   node tests/real-data/control-calcs.mjs MCD JNJ [--data DIR] [--md out.md]
//
// Die Kontrollwerte entstehen NUR aus den Auditbelegen (evidence/<T>.json),
// deren Posten zuvor gegen das unveraenderte Originaldokument geprueft werden
// (evidence.mjs: Konzept, Kontext, angezeigter Wert). TTM wird eigenstaendig
// als FY + YTD(laufend) − YTD(Vorjahr) aus den Originalberichten gebildet —
// ein anderer Rechenweg als die Quartalssumme der Engine. Stichtagswerte
// werden nicht summiert; gewichtete Aktienzahlen und EPS gelten als nicht
// bestimmbar, wenn das Quartal fehlt (keine Differenz von Durchschnitten).
// Diese Rechnung ist KEINE Produktlogik und wird nicht in replay-import.mjs
// eingebaut; sie wird mit den tatsaechlich erfassten Engine-Werten verglichen:
//   fy:<feld>            Erfassung `fy`, Wert [0] (Periode muss passen)
//   ttm:flow|inst:<k>    Engine-TTM-Datensatz (fundamentals._ttm), auch wenn
//                        er unvollstaendig ist und NICHT verwendet wird
//   ttm:shares|eps|none  Aktien-/EPS-Fenster bzw. keine TTM-Groesse der Engine
//   model:<m>.<k> · quality:<metrik> · da:ratio   Modelleingaben/Kennzahlen
// Je Posten ist die Erwartung (gleich, rundung, fehlt, teilbetrag, abweichend,
// vorhanden) und der Auditstatus im Beleg festgehalten; das Skript prueft, ob
// die Engine sie tatsaechlich erfuellt. Fehlende Engine-Werte werden mit
// Zielwert UND konkretem Engine-Grund ausgewiesen.
// Exit: 0 = alle Erwartungen erfuellt · 1 = Abweichung · 2 = nicht ausfuehrbar.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvidence, filingIndex, verifyEvidence } from './evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2);
let dir = join(HERE, 'cache'), md = null;
const tickers = [];
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--data') dir = a[++i];
  else if (a[i] === '--md') md = a[++i];
  else tickers.push(a[i].toUpperCase());
}
if (!tickers.length) { console.error('Ticker fehlt'); process.exit(2); }
const fmt = (x, d = 2) => x == null ? '—' : (typeof x === 'number' ? (Math.abs(x) < 10 && x % 1 ? x.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : (Math.round(x * 100) / 100).toLocaleString('en-US')) : String(x));
const median = (xs) => { const s = xs.slice().sort((p, q) => p - q); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

function evalFormula(formula, val, report) {
  if (!formula) return { value: null, used: [] };
  const F = report.fy.fields;
  if (formula === 'MEDIAN_DA_RATIO') {
    const P = F.ebitda.period.periods, rs = [];
    for (let i = 0; i < P.length; i++) {
      const j = F.ebit.period.periods.indexOf(P[i]), k = F.revenue.period.periods.indexOf(P[i]);
      if (j >= 0 && k >= 0 && F.ebitda.values[i] != null && F.ebit.values[j] != null && F.revenue.values[k]) rs.push((F.ebitda.values[i] - F.ebit.values[j]) / F.revenue.values[k]);
    }
    return { value: median(rs), used: ['R.ebitda/ebit/revenue (' + rs.length + ' Jahre)'] };
  }
  const used = [];
  let bad = null;
  const expr = formula.replace(/[A-Za-z_][\w.]*/g, (tok) => {
    let v;
    const m = tok.match(/^R\.(\w+)\.(\d+)$/);
    if (m) v = F[m[1]] && F[m[1]].values[Number(m[2])];
    else v = val(tok);
    if (v == null) { bad = tok; return 'NaN'; }
    used.push(tok);
    return '(' + v + ')';
  });
  if (bad) return { value: null, used, missing: bad };
  // eslint-disable-next-line no-new-func
  return { value: Function('"use strict"; return (' + expr + ');')(), used };
}

function engineValue(ref, c, report) {
  const cap = report.fy, F = cap.fields, ds = cap.ttmEngineDataset || {};
  const endOf = (p) => p ? String(p).split('…').pop() : null;
  const want = endOf(c.period);
  const fyVal = (k) => {
    const f = F[k]; if (!f) return { v: null, why: 'Feld ' + k + ' nicht erfasst' };
    const v = Array.isArray(f.values) ? f.values[0] : f.value;
    if (v == null) return { v: null, why: 'Engine: ' + k + ' leer (kein Wert importiert)' };
    if (want && f.period && f.period.end && f.period.end !== want) return { v: null, why: 'Periode ' + f.period.end + ' statt ' + want, stale: v };
    return { v, per: f.period && f.period.end };
  };
  let m;
  if (ref === 'fy:none' || ref === 'ttm:none') return { v: null, why: ref === 'ttm:none' ? 'keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: ' + ((ds.reasons || []).length ? 'unvollstaendig' : 'kein Datensatz') + ')' : 'kein Engine-Feld' };
  if ((m = ref.match(/^fy:(\w+)-(\w+)$/))) { const x = fyVal(m[1]), y = fyVal(m[2]); return x.v != null && y.v != null ? { v: x.v - y.v, per: x.per } : { v: null, why: x.why || y.why }; }
  if ((m = ref.match(/^fy:([\w+]+)$/))) {
    const parts = m[1].split('+').map(fyVal);
    if (parts.some(p => p.v == null)) return { v: null, why: parts.map(p => p.why).filter(Boolean).join('; '), stale: parts.length === 1 ? parts[0].stale : undefined };
    return { v: parts.reduce((s, p) => s + p.v, 0), per: parts[0].per };
  }
  if ((m = ref.match(/^ttm:flow:(\w+)$/))) {
    const s = (ds.flows || {})[m[1]];
    if (!s) return { v: null, why: 'Fluss ' + m[1] + ' nicht im Engine-Datensatz' };
    const w = (s.windows || [])[0];
    if (!w || (want && w.end !== want)) return { v: null, why: 'Engine: ' + (s.reason || 'kein Fenster bis ' + want) };
    return { v: w.value, per: w.start + '…' + w.end, extra: 'Quartale ' + (w.quarters || []).join(',') + ' · ' + JSON.stringify(w.basisCounts || {}) };
  }
  if ((m = ref.match(/^ttm:inst:(\w+)$/))) {
    const s = (ds.instants || {})[m[1]];
    if (!s) return { v: null, why: 'Stichtag ' + m[1] + ' nicht im Engine-Datensatz' };
    if (!s.values || !s.values.length || (want && s.dates[0] !== want)) return { v: null, why: 'Engine: ' + (s.reason || 'kein Stichtag ' + want) };
    return { v: s.values[0], per: s.dates[0], extra: 'Tag ' + s.used_tag };
  }
  if (ref === 'ttm:shares' || ref === 'ttm:eps') {
    const s = ds[ref.slice(4)];
    return s && s.ok && s.values && s.values.length ? { v: s.values[0], per: (s.ends || [])[0] } : { v: null, why: 'Engine: ' + ((s && s.reason) || 'nicht gebildet') };
  }
  if ((m = ref.match(/^model:(\w+)\.(\w+)$/))) {
    const r = (cap.modelInputs || {})[m[1]] || {};
    const v = r[m[2]];
    return v == null || v === false ? { v: null, why: 'Engine: ' + (r.reason || r._equityValueUnavailableReason || m[2] + ' leer') } : { v };
  }
  if ((m = ref.match(/^quality:(\w+)$/))) {
    const q = ((cap.quality || {}).descriptive || {})[m[1]] || {};
    return q.value == null ? { v: null, why: 'Engine: ' + (q.status || '') + ' — ' + String(q.detail || q.reason || '').slice(0, 220) } : { v: q.value, extra: q.detail };
  }
  if (ref === 'da:ratio') { const d = (cap.modelInputs || {})._daForecast; return d && d.ratio != null ? { v: d.ratio, extra: d.sourceLabel } : { v: null, why: 'Engine: ' + ((d && d.sourceLabel) || 'keine Quote') }; }
  return { v: null, why: 'unbekannte Referenz ' + ref };
}

function run(ticker) {
  const ev = loadEvidence(ticker);
  if (!ev) throw new Error('Auditbeleg evidence/' + ticker + '.json fehlt');
  const repFile = join(HERE, 'out', ticker + '-report.json');
  if (!existsSync(repFile)) throw new Error('Bericht fehlt: ' + repFile);
  const report = JSON.parse(readFileSync(repFile, 'utf8'));
  const idx = filingIndex(dir);
  if (!idx.manifest) throw new Error('Originaldokumente fehlen (fetch-filings.mjs)');
  const res = verifyEvidence(ev, idx);
  const val = (id) => (res[id] && res[id].ok) ? res[id].expected : null;
  const problems = [];
  for (const r of Object.values(res)) if (!r.ok) problems.push('Beleg ' + r.id + ': ' + r.error);
  const rows = [];
  for (const c of ev.controls) {
    const f = evalFormula(c.formula, val, report);
    if (c.formula && f.value == null) problems.push(c.case + ' ' + c.id + ': Kontrollwert nicht berechenbar (' + (f.missing || '?') + ')');
    const e = engineValue(c.engine, c, report);
    const tolD = c.tol != null ? c.tol : (/USD$/.test(c.unit) && c.unit === 'USD' ? 0.005 : 0.05);
    let ok, diff = (f.value != null && e.v != null) ? e.v - f.value : null;
    switch (c.expect) {
      case 'gleich': case 'rundung': ok = diff != null && Math.abs(diff) <= tolD; break;
      case 'fehlt': ok = e.v == null; break;
      case 'vorhanden': ok = e.v != null; break;
      case 'abweichend': ok = (e.v != null || e.stale != null) && (f.value == null || Math.abs((e.v != null ? e.v : e.stale) - f.value) > tolD); break;
      case 'teilbetrag': {
        const p = evalFormula(c.partial, val, report).value;
        ok = e.v != null && p != null && Math.abs(e.v - p) <= tolD && f.value != null && Math.abs(e.v - f.value) > tolD;
        break;
      }
      default: ok = false;
    }
    if (!ok) problems.push(c.case + ' ' + c.id + ': Erwartung „' + c.expect + '“ nicht erfuellt (Kontrolle ' + fmt(f.value) + ', Engine ' + fmt(e.v != null ? e.v : e.stale) + (e.why ? ', ' + e.why : '') + ')');
    const fundstellen = f.used.filter(u => res[u]).map(u => u + ': ' + res[u].where + ' [' + (res[u].file || '').split('/').pop() + (res[u].decimals ? ', decimals ' + res[u].decimals.join('/') : '') + ']');
    rows.push({ c, target: f.value, used: f.used, fundstellen, engine: e.v != null ? e.v : null, stale: e.stale, why: e.why || null, extra: e.extra || null, diff, ok });
  }
  // Fallverpruefung TTM: angefordert, nicht verwendet, Rueckfall ausgewiesen.
  const tv = report.ttmView || {}, b = tv.basis || {};
  const caseChecks = [
    ['FY: verwendete Basis = FY', report.fy.basis && report.fy.basis.selected === 'fy'],
    ['TTM: angefordert', b.requested === 'ttm'],
    ['TTM: tatsaechlich verwendet = FY (Rueckfall), nicht als TTM ausgewiesen', b.selected === 'fy' && b.ttm_used === false],
    ['TTM: Rueckfall aktiv mit Gruenden', !!(b.fallback && b.fallback.active && b.fallback.reasons && b.fallback.reasons.length)],
    ['TTM-Ansicht: Feldwerte als Jahreswerte gekennzeichnet (kein FY-Wert als TTM)', !!(tv.fields && Object.values(tv.fields).every(x => x.status !== 'TTM-Groesse der Engine'))],
    ['Engine-TTM-Datensatz erfasst und als nicht verwendet gekennzeichnet', !!(report.fy.ttmEngineDataset && report.fy.ttmEngineDataset.usedForValuation === false)],
    ['Rueckweg FY = Ausgangs-FY (Fundamentaldaten unveraendert)', !!(report.integrity && report.integrity.fundamentalsUnchanged)],
  ];
  for (const [n, ok] of caseChecks) if (!ok) problems.push('Fallpruefung: ' + n);
  return { ticker, ev, res, rows, problems, caseChecks, fallbackReasons: (b.fallback && b.fallback.reasons) || [], report };
}

let bad = 0; const out = [];
for (const t of tickers) {
  let r;
  try { r = run(t); } catch (e) { console.error('NICHT AUSFUEHRBAR: ' + e.message); process.exit(2); }
  bad += r.problems.length;
  const nOk = Object.values(r.res).filter(x => x.ok).length;
  console.log(`${t}: ${nOk}/${Object.keys(r.res).length} Belege im Original bestaetigt · ${r.rows.filter(x => x.ok).length}/${r.rows.length} Kontrollposten wie erwartet · Fallpruefungen ${r.caseChecks.filter(x => x[1]).length}/${r.caseChecks.length}`);
  for (const p of r.problems) console.log('  ABWEICHUNG ' + p);
  for (const cs of ['FY', 'TTM']) {
    const rows = r.rows.filter(x => x.c.case === cs);
    out.push(`### ${t} ${cs}\n`);
    if (cs === 'TTM') out.push('Angefordert TTM, verwendet: **' + (r.report.ttmView.basis.selected) + '** (Rueckfall). Engine-Gruende: ' + r.fallbackReasons.join(' | ') + '\n');
    out.push('| Posten | Einheit · Periode | Kontrollwert (Original) | Rechenweg | Engine | Abw. | Status | Erklaerung / Engine-Grund |', '|---|---|---|---|---|---|---|---|');
    for (const x of rows) {
      out.push(`| ${x.c.label} | ${x.c.unit}${x.c.period ? ' · ' + x.c.period : ''} | ${x.target == null ? (x.c.formula ? '—' : 'nicht bestimmbar') : fmt(x.target)} | ${x.c.formula || '—'} | ${x.engine == null ? (x.stale != null ? fmt(x.stale) + ' (andere Periode)' : 'fehlt') : fmt(x.engine)} | ${x.diff == null ? '—' : fmt(x.diff)} | ${x.ok ? '' : '✗ '}${x.c.status} | ${x.c.why}${x.why ? ' — ' + x.why : ''} |`);
    }
    out.push('');
  }
  out.push(`#### ${t} Fundstellen der Belege\n`, '| Beleg | Wert | Dokument | Fundstelle | decimals | ✓ |', '|---|---|---|---|---|---|');
  for (const x of Object.values(r.res)) out.push(`| ${x.id} | ${fmt(x.expected)}${x.unit ? ' ' + x.unit : ''} | ${x.doc.form} ${x.doc.accn} (${(x.file || '').split('/').pop()}, eingereicht ${x.filed || '—'}, sha256 ${String(x.sha256 || '').slice(0, 12)}…) | ${x.where}${x.row && !/^Text/.test(x.row) ? ' — Zeile „' + x.row.slice(0, 60) + '“' : ''} | ${(x.decimals || []).join('/') || '—'} | ${x.ok ? '✓' : '✗ ' + x.error} |`);
  out.push('');
}
// Quellenkette: Company Facts (fetch-sources.mjs) und Originaldokumente
// (fetch-filings.mjs) mit URL, Akte, Einreichung, Periode, Abruf und SHA-256.
{
  const src = ['### Quellenkette (Stichtag ' + ((filingIndex(dir).manifest || {}).cutoff || '—') + ')\n',
    '| Datei | Form · Akte | Periode | eingereicht | abgerufen | SHA-256 | URL |', '|---|---|---|---|---|---|---|'];
  const mf = join(dir, 'manifest.json');
  if (existsSync(mf)) {
    const m = JSON.parse(readFileSync(mf, 'utf8'));
    for (const [f, x] of Object.entries(m.files)) if (/companyfacts|submissions/.test(f))
      src.push(`| ${f} | ${x.derivedFrom ? 'Ableitung von ' + x.derivedFrom + ' (Stichtag ' + x.cutoff + ', entfernt ' + x.factsDroppedAfterCutoff + ')' : 'Original'} | — | — | ${x.retrievedAt || '—'} | ${String(x.sha256).slice(0, 16)}… | ${x.url || '—'} |`);
  }
  const fi = filingIndex(dir).manifest;
  if (fi) for (const [f, x] of Object.entries(fi.files)) if (!/index\.json$/.test(f) && tickers.includes(x.ticker))
    src.push(`| ${f.split('/').pop()} | ${x.ticker} ${x.form} ${x.accn} | ${x.reportDate} | ${x.filed} | ${x.retrievedAt} | ${String(x.sha256).slice(0, 16)}… | ${x.url} |`);
  out.push(src.join('\n'), '');
}
if (md) writeFileSync(md, out.join('\n'));
process.exit(bad ? 1 : 0);
