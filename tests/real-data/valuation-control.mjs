#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Praxisabnahme: unabhaengige Kontrollrechnung der Bewertung (DCF, Szenarien,
// RIM, Synthese, Sicherheitsabschlag, Einstiegspreis, Reverse DCF, Altman Z″,
// Piotroski) — KEIN Produktcode.
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources/fetch-filings und replay-import mit --price):
//   node tests/real-data/valuation-control.mjs CRH [--md out.md]
//
// Zwei getrennte Seiten:
//   1. SOLL — computeControl(): eigene Formeln, nur aus Belegposten aus
//      evidence/<T>.json (zuvor von evidence.mjs gegen das unveraenderte
//      Original-iXBRL geprueft) und den dort unter valuationControl.assumptions
//      ausdruecklich ausgewiesenen Annahmen (WACC/CoE/g_T heuristisch, Kurs als
//      Annahme, Regelparameter). Keine produktive Bewertungsfunktion, kein
//      Engine-Wert fliesst in die Sollrechnung.
//   2. IST — compareCapture(): ausschliesslich die AKTUELLE Replay-Erfassung
//      (out/<T>-report.json, Schritt fy), auch fuer Z″, Piotroski, g1,
//      Sicherheitsabschlag, Einstiegs- und tiefen Pruefpreis (fy.valuationResults,
//      seit V1.0.85 vom Replay aus dem bewerteten Zustand erfasst).
//      valuationControl.engineObserved ist nur noch historischer Beleg einer
//      frueheren Beobachtung — er wird NIE als Ersatz verwendet. Fehlt ein
//      aktueller Wert, ist das ein fehlender Nachweis (Fehlschlag), keine 0 und
//      kein Rueckfall auf historische Zahlen.
//   Die Erfassung muss zum Fall passen: Ticker, Import erfolgt, Produkt-Commit
//   und Produktdatei-Hash vorhanden, Produktdatei ohne lokale Aenderung,
//   tatsaechlich verwendete Datenbasis = erwartete, Kurs/WACC/CoE/g_T der
//   Erfassung = ausgewiesene Annahmen. Sonst Fehlschlag.
// Exit: 0 = alle Vergleiche in Toleranz und Erfassung passend · 1 = Abweichung,
//       fehlender oder unpassender Nachweis · 2 = nicht ausfuehrbar.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Die sechs Ergebnisse, die bis V1.0.84 aus engineObserved kamen.
export const CURRENT_RESULT_KEYS = ['altmanZ', 'piotroski', 'g1', 'mosTotal', 'entryPrice', 'deepValuePrice'];

const median = (xs) => { const s = xs.slice().sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stdev = (xs) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };

// ── SOLL: unabhaengige Rechnung. `v(id)` liefert den geprueften Belegwert. ──
export function computeControl(v, VC) {
  const A = VC.assumptions;
  const Y = VC.years;                       // juengstes zuerst, Prefixe der Belege (fy, fy1, …)
  const ser = (k) => Y.map(p => v(p + '.' + k));

  const rev = ser('revenue'), ebit = ser('ebit'), dda = ser('da_total'), capex = ser('capex');
  const taxPct = Math.round(v('fy.tax') / (v('fy.ni') + v('fy.tax')) * 100 * 100) / 100;   // TE/(NI+TE), 2 Dez.
  const margin = ebit[0] / rev[0];
  const capexInt = median(capex.map((c, i) => c / rev[i]));
  const daRatio = median(dda.map((d, i) => d / rev[i]));
  const owc = VC.owcYears.map(o => {        // je Jahr Beleg-IDs { ca, cash, cl, overdraft, ltd_cur, fl_cur, revenue }
    const st = v(o.overdraft) + v(o.ltd_cur) + v(o.fl_cur);                    // kurzfristige Finanzschulden in CL
    return ((v(o.ca) - v(o.cash)) - (v(o.cl) - st)) / v(o.revenue);
  });
  const owcRatio = median(owc);
  const grossDebt = v('note.ltd_total') + v('note.overdraft') + v('note.fl_cur') + v('note.fl_noncur');
  const netDebt = grossDebt - v('bs.cash');
  const shares = v('fy.sh_dil');
  const cagr = (x0, xn, n) => (Math.pow(x0 / xn, 1 / n) - 1) * 100;
  const n = Y.length - 1;
  const gCands = [cagr(rev[0], rev[n], n)];
  const fcf0 = v('fy.cfo') - v('fy.capex'), fcfN = v(Y[n] + '.cfo') - v(Y[n] + '.capex');
  if (cagr(fcf0, fcfN, n) > 0) gCands.push(cagr(fcf0, fcfN, n));
  if (cagr(v('fy.eps'), v(Y[n] + '.eps'), n) > 0) gCands.push(cagr(v('fy.eps'), v(Y[n] + '.eps'), n));
  gCands.sort((p, q) => p - q);
  const g1 = Math.round(Math.max(0, Math.min(gCands[Math.floor(gCands.length / 2)] * 0.75, A.g1Cap)) * 100) / 100;
  const sigG = stdev(rev.slice(0, -1).map((r, i) => (r / rev[i + 1] - 1) * 100));
  const sigM = stdev(ebit.map((e, i) => e / rev[i] * 100));

  // DCF (FCFF, 10 Jahre, Gordon)
  const dcf = ({ g, tg, wacc, m }) => {
    let R = rev[0], pv = 0, pre = 0;
    for (let t = 1; t <= 10; t++) {
      const prev = R; R *= 1 + g / 100;
      pre = R * m * (1 - taxPct / 100) + R * daRatio - R * capexInt;
      pv += (pre - owcRatio * (R - prev)) / (1 + wacc / 100) ** t;
    }
    const tvF = pre * (1 + tg / 100) - owcRatio * R * tg / 100;
    const pvTv = tvF / (wacc / 100 - tg / 100) / (1 + wacc / 100) ** 10;
    const ev_ = pv + pvTv;
    return { op: ev_ / shares, eq: (ev_ - netDebt) / shares, tvShare: pvTv / ev_ };
  };
  const sc = {
    conservative: { g: g1 - 0.75 * sigG, tg: Math.max(0, A.tg - 0.5), wacc: A.wacc + 1, m: margin - 0.75 * sigM / 100, coe: A.coe + 1 },
    base: { g: g1, tg: A.tg, wacc: A.wacc, m: margin, coe: A.coe },
    optimistic: { g: g1 + 0.75 * sigG, tg: A.tg + 0.3, wacc: A.wacc - 0.5, m: margin + 0.75 * sigM / 100, coe: A.coe - 0.5 }
  };
  const D = Object.fromEntries(Object.entries(sc).map(([k, s]) => [k, dcf(s)]));

  // RIM (Residualgewinn, konstante Ausschuettungsquote)
  const rim = ({ g, tg, coe }) => {
    const r = coe / 100, bv0 = v('bs.equity') / shares, eps0 = v('fy.eps'), payout = Math.min(v('fy.dps') / eps0, 1);
    let bv = bv0, e = eps0, pv = 0, last = 0;
    for (let t = 1; t <= 10; t++) { e *= 1 + g / 100; last = e - r * bv; pv += last / (1 + r) ** t; bv += e * (1 - payout); }
    return bv0 + pv + last * (1 + tg / 100) / (r - tg / 100) / (1 + r) ** 10;
  };
  const Rm = Object.fromEntries(Object.entries(sc).map(([k, s]) => [k, rim(s)]));
  const W = A.weights;
  const syn = Object.fromEntries(Object.keys(sc).map(k => [k, W.dcf * D[k].eq + W.rim * Rm[k]]));

  // Buyback-Diagnose (Aktien-CAGR 3 J., nur fuer den MoS-Baustein)
  const gSh = Math.pow(shares / v(Y[3] + '.sh_dil'), 1 / 3) - 1;
  let bb = 0; { let R = rev[0], pre = 0; const s0 = shares;
    for (let t = 1; t <= 10; t++) { const p = R; R *= 1 + g1 / 100; pre = R * margin * (1 - taxPct / 100) + R * daRatio - R * capexInt;
      bb += (pre - owcRatio * (R - p)) / (1 + A.wacc / 100) ** t / (s0 * (1 + gSh) ** t); }
    const tvF = pre * (1 + A.tg / 100) - owcRatio * R * A.tg / 100;
    bb += tvF / (A.wacc / 100 - A.tg / 100) / (1 + A.wacc / 100) ** 10 / (s0 * (1 + gSh) ** 10); }
  const bbUplift = (bb / D.base.op - 1) * 100;

  // Qualitaet: Altman Z″ und Piotroski-Kriterien
  const z = 6.56 * (v('bs.ca') - v('bs.cl')) / v('bs.assets') + 3.26 * v('bs.re') / v('bs.assets')
    + 6.72 * v('fy.ebit') / v('bs.assets') + 1.05 * v('bs.equity') / v('bs.liab');
  const pio = [
    v('fy.ni') > 0, v('fy.cfo') > 0, v('fy.ni') / v('bs.assets') > v('fy1.ni') / v('fy1.assets'), v('fy.cfo') > v('fy.ni'),
    v('bs.ltn') / v('bs.assets') < v('fy1.ltn') / v('fy1.assets'), v('bs.ca') / v('bs.cl') > v('fy1.ca') / v('fy1.cl'),
    v('fy.sh_dil') <= v('fy1.sh_dil'), v('fy.gp') / v('fy.revenue') > v('fy1.gp') / v('fy1.revenue'),
    v('fy.revenue') / v('bs.assets') > v('fy1.revenue') / v('fy1.assets')
  ].filter(Boolean).length;
  const ndEbitda = netDebt / (v('fy.ebit') + v('fy.da_total'));

  // Sicherheitsabschlag nach den produktiven Regeln (Regelparameter im Beleg)
  const verdict = (pio >= A.piotroskiPass ? 'pass' : pio > A.piotroskiFail ? 'nearPass' : 'fail') + '/' + (z >= A.altmanSafe ? 'pass' : 'other');
  const baseMos = verdict === 'pass/pass' ? A.mos.investable_high : (verdict.includes('fail') ? A.mos.caution_quality : A.mos.investable_mid);
  const comps = [baseMos, A.mos.heuristicAddon, bbUplift > 25 ? 0.10 : bbUplift > 10 ? 0.05 : 0,
    ndEbitda > 3 ? 0.05 : 0, (D.base.eq / Rm.base > 2 && D.base.eq / Rm.base <= 3) ? 0.05 : 0];
  const mos = Math.min(1 - comps.reduce((p, c) => p * (1 - c), 1), A.mos.cap);
  const entry = syn.base * (1 - mos), deep = syn.conservative * (1 - mos);

  // Reverse DCF: g1 so, dass Eigenkapitalwert = Kurs (Bisektion)
  let lo = -20, hi = 40;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; (dcf({ ...sc.base, g: mid }).eq < A.price ? (lo = mid) : (hi = mid)); }
  const revG = (lo + hi) / 2;

  return { taxPct, margin, capexInt, daRatio, owcRatio, netDebt, shares, g1, sigG, sigM, D, Rm, syn, bbUplift, z, pio, ndEbitda, mos, entry, deep, revG };
}

// ── Erfassung pruefen: passt sie zum Fall und zu den Annahmen? ─────────────
export function checkCapture(report, VC, ticker) {
  const issues = [];
  const A = VC.assumptions, E = VC.expectedCapture || {};
  if (!report) { issues.push('kein Replay-Bericht'); return issues; }
  const fy = report.fy;
  const vr = fy && fy.valuationResults;
  const inp = (vr && vr.inputs) || {};
  const same = (x, y) => typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= 1e-9;
  if (report.ticker !== ticker) issues.push('Ticker der Erfassung ' + report.ticker + ' ≠ ' + ticker);
  if (report.imported !== true) issues.push('Import nicht erfolgt');
  if (report.selftest) issues.push('Selbsttest-Lauf (synthetisch) ist keine Realdatenerfassung');
  if (!/^[0-9a-f]{40}$/.test(String(report.commit || ''))) issues.push('Produkt-Commit fehlt (' + report.commit + ')');
  if (!/^[0-9a-f]{64}$/.test(String(report.productSha256 || ''))) issues.push('SHA-256 der Produktdatei fehlt (Erfassung vor V1.0.85?)');
  if (report.productFileChanged !== 'nein') issues.push('Produktdatei weicht vom Commit ab oder unbekannt (' + report.productFileChanged + ')');
  if (!fy) { issues.push('Schritt fy fehlt'); return issues; }
  if (!vr) issues.push('fy.valuationResults fehlt (aktuelle Ergebniserfassung nicht vorhanden)');
  const basis = fy.basis || {};
  const want = E.dataBasis || 'fy';
  if (basis.selected !== want || basis.requested !== want) issues.push('Datenbasis der Erfassung ' + basis.requested + '/' + basis.selected + ' ≠ ' + want);
  if (vr && inp.dataBasisSelected !== want) issues.push('Datenbasis in valuationResults ' + inp.dataBasisSelected + ' ≠ ' + want);
  if (!same(report.priceAssumption, A.price)) issues.push('Kurs-Annahme des Replays ' + report.priceAssumption + ' ≠ ' + A.price);
  if (vr) {
    if (!same(inp.price, A.price)) issues.push('Kurs im bewerteten Zustand ' + inp.price + ' ≠ ' + A.price);
    if (!same(inp.wacc, A.wacc)) issues.push('WACC der Erfassung ' + inp.wacc + ' ≠ Annahme ' + A.wacc);
    if (!same(inp.coe, A.coe)) issues.push('CoE der Erfassung ' + inp.coe + ' ≠ Annahme ' + A.coe);
    if (!same(inp.growthTerminal, A.tg)) issues.push('g_T der Erfassung ' + inp.growthTerminal + ' ≠ Annahme ' + A.tg);
  }
  return issues;
}

// ── Vergleich SOLL ↔ IST (nur aktuelle Erfassung) ──────────────────────────
export function compareCapture(C, report, VC, ticker) {
  const TOL = VC.tolerances;
  const fy = (report && report.fy) || {}, mi = fy.modelInputs || {}, d = mi.dcf || {}, q = fy.quality || {};
  const vr = fy.valuationResults || {};
  const rows = [];
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const cmp = (label, ctrl, eng, tol, unit, key) => {
    const missing = !isNum(eng);
    const diff = (!missing && isNum(ctrl)) ? eng - ctrl : null;
    const ok = !missing && diff != null && Math.abs(diff) <= tol;
    rows.push({ label, key: key || null, ctrl, eng: missing ? null : eng, diff, tol, unit, ok, missing });
  };
  const relTol = (x) => Math.abs(x) * TOL.relPerShare;
  cmp('Steuerquote TE/(NI+TE) (%)', C.taxPct, d._coreTaxRatePct, 1e-9, '%');
  cmp('Operative Marge (%)', C.margin * 100, d._coreOpMarginPctUsed, 1e-9, '%');
  cmp('CapEx-Quote Median (%)', C.capexInt * 100, d._coreCapexIntensityPct, 1e-9, '%');
  cmp('D&A-Quote Median (%)', C.daRatio * 100, d._coreDaRatioPct, 1e-9, '%');
  cmp('OWC-Quote Median (%)', C.owcRatio * 100, d._owcPctOfRevenue, 1e-9, '%');
  cmp('Nettoschulden (Mio. USD)', C.netDebt, d._netDebtM, 0, 'Mio. USD');
  cmp('Aktienbasis (Mio.)', C.shares, d._sharesUsedM, 0, 'Mio.');
  cmp('DCF operativer Wert je Aktie (Base)', C.D.base.op, d._operatingValuePerShareBase, relTol(C.D.base.op), 'USD');
  for (const k of ['conservative', 'base', 'optimistic']) cmp('DCF Eigenkapitalwert je Aktie (' + k + ')', C.D[k].eq, d[k], relTol(C.D[k].eq), 'USD');
  for (const k of ['conservative', 'base', 'optimistic']) cmp('RIM je Aktie (' + k + ')', C.Rm[k], (mi.rim || {})[k], relTol(C.Rm[k]), 'USD');
  for (const k of ['conservative', 'base', 'optimistic']) cmp('Synthese (' + k + ')', C.syn[k], (fy.range || {})[k], relTol(C.syn[k]), 'USD');
  cmp('Buyback-Uplift (%)', C.bbUplift, d._buybackUpliftPct, 1e-6, '%');
  cmp('Reverse DCF implizites g1 (%)', C.revG, (fy.reverseDcf || {}).impliedGrowth, TOL.reverseGrowthPp, 'pp');
  cmp('Net Debt/EBITDA', C.ndEbitda, ((q.descriptive || {}).netDebtToEbitda || {}).value, 1e-9, 'x');
  // Die sechs Ergebnisse — ausschliesslich aus der aktuellen Erfassung.
  cmp('Altman Z″', C.z, vr.altmanZ, 1e-9, '', 'altmanZ');
  cmp('Piotroski F-Score', C.pio, vr.piotroski, 0, '/9', 'piotroski');
  cmp('g1-Heuristik (%)', C.g1, vr.g1, 0.005, '%', 'g1');
  cmp('Sicherheitsabschlag gesamt', C.mos, vr.mosTotal, 1e-12, '', 'mosTotal');
  cmp('Einstiegspreis (USD)', C.entry, vr.entryPrice, TOL.entryPrice, 'USD', 'entryPrice');
  cmp('Tiefer Pruefpreis (USD)', C.deep, vr.deepValuePrice, TOL.entryPrice, 'USD', 'deepValuePrice');
  const captureIssues = checkCapture(report, VC, ticker);
  const failed = rows.filter(r => !r.ok);
  return { rows, captureIssues, ok: failed.length === 0 && captureIssues.length === 0, failed };
}

// ── CLI ───────────────────────────────────────────────────────────────────
async function main() {
  const { loadEvidence, filingIndex, verifyEvidence } = await import('./evidence.mjs');
  const a = process.argv.slice(2);
  let md = null; const tickers = [];
  for (let i = 0; i < a.length; i++) { if (a[i] === '--md') md = a[++i]; else tickers.push(a[i].toUpperCase()); }
  if (tickers.length !== 1) { console.error('Aufruf: valuation-control.mjs TICKER [--md datei]'); process.exit(2); }
  const T = tickers[0];
  const ev = loadEvidence(T);
  if (!ev || !ev.valuationControl) { console.error('NICHT AUSFUEHRBAR: evidence/' + T + '.json ohne valuationControl'); process.exit(2); }
  const repFile = join(HERE, 'out', T + '-report.json');
  if (!existsSync(repFile)) { console.error('NICHT AUSFUEHRBAR: ' + repFile + ' fehlt (replay-import.mjs mit --price)'); process.exit(2); }
  const report = JSON.parse(readFileSync(repFile, 'utf8'));
  const res = verifyEvidence(ev, filingIndex());
  const bad = Object.values(res).filter(r => !r.ok);
  if (bad.length) { console.error('NICHT AUSFUEHRBAR: Belege nicht im Original bestaetigt: ' + bad.map(r => r.id + ' (' + r.error + ')').join('; ')); process.exit(2); }
  const v = (id) => { if (!res[id]) throw new Error('Beleg ' + id + ' fehlt'); return res[id].expected; };
  const VC = ev.valuationControl;
  const C = computeControl(v, VC);
  const R = compareCapture(C, report, VC, T);
  const f = (x, dd = 6) => x == null ? '—' : (typeof x === 'number' ? x.toFixed(dd) : String(x));
  const vr = (report.fy && report.fy.valuationResults) || {}, inp = vr.inputs || {};
  console.log(`${T}: ${R.rows.length - R.failed.length}/${R.rows.length} Kontrollvergleiche in Toleranz (gegen aktuelle Erfassung) · Erfassung ${R.captureIssues.length ? 'UNPASSEND' : 'passend'}`);
  console.log(`  Erfassung: Produkt ${report.commit} · Produktdatei sha256 ${report.productSha256} (lokal geaendert: ${report.productFileChanged}) · Lauf ${report.runAt}`);
  console.log(`  Datenbasis ${inp.dataBasisRequested}/${inp.dataBasisSelected} · Kurs ${inp.price} (Annahme ${VC.assumptions.price}) · Steuer ${inp.taxRatePct} % · WACC ${inp.wacc} · CoE ${inp.coe} · g_T ${inp.growthTerminal} · Urteil ${inp.verdict} · Position ${inp.synthesisPosition}`);
  for (const i of R.captureIssues) console.log('  UNPASSENDE ERFASSUNG ' + i);
  for (const r of R.failed) console.log('  ' + (r.missing ? 'FEHLENDER NACHWEIS ' : 'ABWEICHUNG ') + r.label + ': Kontrolle ' + f(r.ctrl) + ' · aktuelle Erfassung ' + f(r.eng) + ' · Toleranz ' + r.tol);
  console.log(`  Kontrolle: Steuer ${C.taxPct} % · g1 ${C.g1} % · σg ${C.sigG.toFixed(4)} · σm ${C.sigM.toFixed(4)} · Piotroski ${C.pio}/9 · Z″ ${C.z.toFixed(4)} · MoS ${(C.mos * 100).toFixed(1)} % · Einstieg ${C.entry.toFixed(2)} · Tiefpreis ${C.deep.toFixed(2)} · TV-Anteil ${(C.D.base.tvShare * 100).toFixed(1)} %`);
  const H = VC.engineObserved;
  if (H) console.log('  info  historische Beobachtung (engineObserved, NICHT verglichen): ' + CURRENT_RESULT_KEYS.map(k => k + '=' + H[k]).join(' · '));
  if (md) {
    const out = ['| Groesse | Kontrolle (Original + Annahmen) | aktuelle Erfassung (Replay) | Abw. | Toleranz | ✓ |', '|---|---|---|---|---|---|'];
    for (const r of R.rows) out.push(`| ${r.label} | ${f(r.ctrl)} | ${r.missing ? 'fehlt' : f(r.eng)} | ${r.diff == null ? '—' : r.diff.toExponential(2)} | ${r.tol} | ${r.ok ? '✓' : '✗'} |`);
    out.push('', 'Erfassung: Produkt `' + report.commit + '`, Produktdatei SHA-256 `' + report.productSha256 + '`, Datenbasis ' + inp.dataBasisSelected + ', Kurs ' + inp.price + '. ' + (R.captureIssues.length ? 'UNPASSEND: ' + R.captureIssues.join('; ') : 'passend.'));
    writeFileSync(md, out.join('\n') + '\n');
  }
  process.exit(R.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('NICHT AUSFUEHRBAR: ' + (e && e.stack || e)); process.exit(2); });
}
