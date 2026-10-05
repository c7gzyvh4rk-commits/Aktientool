#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Praxisabnahme: unabhaengige Kontrollrechnung der Bewertung (DCF, Szenarien,
// RIM, Synthese, Sicherheitsabschlag, Einstiegspreis, Reverse DCF, Altman Z″,
// Piotroski) — KEIN Produktcode.
// ───────────────────────────────────────────────────────────────────────────
// Start (nach fetch-sources/fetch-filings und replay-import mit --price):
//   node tests/real-data/valuation-control.mjs CRH [--md out.md]
//
// Eingaben:
//   * Belegposten aus evidence/<T>.json, die evidence.mjs zuvor gegen das
//     unveraenderte Original-iXBRL prueft (Konzept, Kontext, angezeigter Wert);
//   * Bewertungsannahmen aus evidence/<T>.json → valuationControl.assumptions.
//     Sie sind KEINE Unternehmensdaten: WACC/CoE (Sektor-Fallback ohne Beta),
//     Terminalwachstum (Sektor-Korridor), Kurs (Annahme), Regelparameter
//     (Gewichte, MoS-Bausteine). Sie werden ausdruecklich ausgewiesen.
// Abgeleitet wird hier selbst: Steuerquote, Margen, Medianquoten (CapEx, D&A,
// operatives Working Capital), g1-Heuristik, Szenario-Streuungen, Netto-
// schulden, FCFF-Prognose, Gordon-Terminalwert, Bruecke, RIM, Synthese, MoS,
// Einstiegspreis, Reverse DCF (Bisektion), Altman Z″, Piotroski-Kriterien.
// Verglichen wird mit der Replay-Erfassung (out/<T>-report.json, Schritt fy)
// gegen die im Beleg festgelegten Toleranzen.
// Exit: 0 = alle Vergleiche innerhalb der Toleranz · 1 = Abweichung ·
//       2 = nicht ausfuehrbar.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvidence, filingIndex, verifyEvidence } from './evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
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
const VC = ev.valuationControl, A = VC.assumptions, TOL = VC.tolerances;

const median = (xs) => { const s = xs.slice().sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stdev = (xs) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
const Y = VC.years;                       // juengstes zuerst, Prefixe der Belege (fy, fy1, …)
const ser = (k) => Y.map(p => v(p + '.' + k));

// ── Ableitungen aus den Originalbelegen ───────────────────────────────────
const rev = ser('revenue'), ebit = ser('ebit'), dda = ser('da_total'), capex = ser('capex');
const taxPct = Math.round(v('fy.tax') / (v('fy.ni') + v('fy.tax')) * 100 * 100) / 100;   // TE/(NI+TE), 2 Dez.
const margin = ebit[0] / rev[0];
const capexInt = median(capex.map((c, i) => c / rev[i]));
const daRatio = median(dda.map((d, i) => d / rev[i]));
const owcYears = VC.owcYears;            // Prefixe mit vollstaendiger Bilanz
const owc = owcYears.map(o => {            // je Jahr Beleg-IDs { ca, cash, cl, overdraft, ltd_cur, fl_cur, revenue }
  const st = v(o.overdraft) + v(o.ltd_cur) + v(o.fl_cur);                      // kurzfristige Finanzschulden in CL
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

// ── DCF (FCFF, 10 Jahre, Gordon) ──────────────────────────────────────────
function dcf({ g, tg, wacc, m }) {
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
}
const sc = {
  conservative: { g: g1 - 0.75 * sigG, tg: Math.max(0, A.tg - 0.5), wacc: A.wacc + 1, m: margin - 0.75 * sigM / 100, coe: A.coe + 1 },
  base: { g: g1, tg: A.tg, wacc: A.wacc, m: margin, coe: A.coe },
  optimistic: { g: g1 + 0.75 * sigG, tg: A.tg + 0.3, wacc: A.wacc - 0.5, m: margin + 0.75 * sigM / 100, coe: A.coe - 0.5 }
};
const D = Object.fromEntries(Object.entries(sc).map(([k, s]) => [k, dcf(s)]));

// ── RIM (Residualgewinn, konstante Ausschuettungsquote) ───────────────────
function rim({ g, tg, coe }) {
  const r = coe / 100, bv0 = v('bs.equity') / shares, eps0 = v('fy.eps'), payout = Math.min(v('fy.dps') / eps0, 1);
  let bv = bv0, e = eps0, pv = 0, last = 0;
  for (let t = 1; t <= 10; t++) { e *= 1 + g / 100; last = e - r * bv; pv += last / (1 + r) ** t; bv += e * (1 - payout); }
  return bv0 + pv + last * (1 + tg / 100) / (r - tg / 100) / (1 + r) ** 10;
}
const Rm = Object.fromEntries(Object.entries(sc).map(([k, s]) => [k, rim(s)]));
const W = A.weights;
const syn = Object.fromEntries(Object.keys(sc).map(k => [k, W.dcf * D[k].eq + W.rim * Rm[k]]));

// ── Buyback-Diagnose (Aktien-CAGR 3 J., nur fuer den MoS-Baustein) ────────
const gSh = Math.pow(shares / v(Y[3] + '.sh_dil'), 1 / 3) - 1;
let bb = 0; { let R = rev[0], pre = 0; const s0 = shares;
  for (let t = 1; t <= 10; t++) { const p = R; R *= 1 + g1 / 100; pre = R * margin * (1 - taxPct / 100) + R * daRatio - R * capexInt;
    bb += (pre - owcRatio * (R - p)) / (1 + A.wacc / 100) ** t / (s0 * (1 + gSh) ** t); }
  const tvF = pre * (1 + A.tg / 100) - owcRatio * R * A.tg / 100;
  bb += tvF / (A.wacc / 100 - A.tg / 100) / (1 + A.wacc / 100) ** 10 / (s0 * (1 + gSh) ** 10); }
const bbUplift = (bb / D.base.op - 1) * 100;

// ── Qualitaet: Altman Z″ und Piotroski-Kriterien ──────────────────────────
const z = 6.56 * (v('bs.ca') - v('bs.cl')) / v('bs.assets') + 3.26 * v('bs.re') / v('bs.assets')
  + 6.72 * v('fy.ebit') / v('bs.assets') + 1.05 * v('bs.equity') / v('bs.liab');
const pio = [
  v('fy.ni') > 0, v('fy.cfo') > 0, v('fy.ni') / v('bs.assets') > v('fy1.ni') / v('fy1.assets'), v('fy.cfo') > v('fy.ni'),
  v('bs.ltn') / v('bs.assets') < v('fy1.ltn') / v('fy1.assets'), v('bs.ca') / v('bs.cl') > v('fy1.ca') / v('fy1.cl'),
  v('fy.sh_dil') <= v('fy1.sh_dil'), v('fy.gp') / v('fy.revenue') > v('fy1.gp') / v('fy1.revenue'),
  v('fy.revenue') / v('bs.assets') > v('fy1.revenue') / v('fy1.assets')
].filter(Boolean).length;
const ndEbitda = netDebt / (v('fy.ebit') + v('fy.da_total'));

// ── Sicherheitsabschlag nach den produktiven Regeln (Regelparameter im Beleg) ─
const verdict = (pio >= A.piotroskiPass ? 'pass' : pio > A.piotroskiFail ? 'nearPass' : 'fail') + '/' + (z >= A.altmanSafe ? 'pass' : 'other');
const baseMos = verdict === 'pass/pass' ? A.mos.investable_high : (verdict.includes('fail') ? A.mos.caution_quality : A.mos.investable_mid);
const comps = [baseMos, A.mos.heuristicAddon, bbUplift > 25 ? 0.10 : bbUplift > 10 ? 0.05 : 0,
  ndEbitda > 3 ? 0.05 : 0, (D.base.eq / Rm.base > 2 && D.base.eq / Rm.base <= 3) ? 0.05 : 0];
const mos = Math.min(1 - comps.reduce((p, c) => p * (1 - c), 1), A.mos.cap);
const entry = syn.base * (1 - mos), deep = syn.conservative * (1 - mos);

// ── Reverse DCF: g1 so, dass Eigenkapitalwert = Kurs (Bisektion) ─────────
let lo = -20, hi = 40;
for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; (dcf({ ...sc.base, g: mid }).eq < A.price ? (lo = mid) : (hi = mid)); }
const revG = (lo + hi) / 2;

// ── Vergleich mit der Replay-Erfassung (Engine) ──────────────────────────
const fy = report.fy, mi = fy.modelInputs || {}, d = mi.dcf || {}, q = fy.quality || {};
const rows = [];
const cmp = (label, ctrl, eng, tol, unit) => {
  const diff = (ctrl != null && eng != null) ? eng - ctrl : null;
  const ok = diff != null && Math.abs(diff) <= tol;
  rows.push({ label, ctrl, eng, diff, tol, unit, ok });
};
const relTol = (x) => Math.abs(x) * TOL.relPerShare;
cmp('Steuerquote TE/(NI+TE) (%)', taxPct, d._coreTaxRatePct, 1e-9, '%');
cmp('Operative Marge (%)', margin * 100, d._coreOpMarginPctUsed, 1e-9, '%');
cmp('CapEx-Quote Median (%)', capexInt * 100, d._coreCapexIntensityPct, 1e-9, '%');
cmp('D&A-Quote Median (%)', daRatio * 100, d._coreDaRatioPct, 1e-9, '%');
cmp('OWC-Quote Median (%)', owcRatio * 100, d._owcPctOfRevenue, 1e-9, '%');
cmp('Nettoschulden (Mio. USD)', netDebt, d._netDebtM, 0, 'Mio. USD');
cmp('Aktienbasis (Mio.)', shares, d._sharesUsedM, 0, 'Mio.');
cmp('DCF operativer Wert je Aktie (Base)', D.base.op, d._operatingValuePerShareBase, relTol(D.base.op), 'USD');
for (const k of ['conservative', 'base', 'optimistic']) cmp('DCF Eigenkapitalwert je Aktie (' + k + ')', D[k].eq, d[k], relTol(D[k].eq), 'USD');
for (const k of ['conservative', 'base', 'optimistic']) cmp('RIM je Aktie (' + k + ')', Rm[k], (mi.rim || {})[k], relTol(Rm[k]), 'USD');
for (const k of ['conservative', 'base', 'optimistic']) cmp('Synthese (' + k + ')', syn[k], (fy.range || {})[k], relTol(syn[k]), 'USD');
cmp('Buyback-Uplift (%)', bbUplift, d._buybackUpliftPct, 1e-6, '%');
cmp('Reverse DCF implizites g1 (%)', revG, (fy.reverseDcf || {}).impliedGrowth, TOL.reverseGrowthPp, 'pp');
const O = VC.engineObserved || {};      // nicht im Replay-Bericht erfasste Engine-Werte (Herkunft im Beleg)
cmp('Altman Z″', z, O.altmanZ ?? null, 1e-9, '');
cmp('Net Debt/EBITDA', ndEbitda, ((q.descriptive || {}).netDebtToEbitda || {}).value ?? null, 1e-9, 'x');
cmp('Piotroski F-Score', pio, O.piotroski ?? null, 0, '/9');
cmp('g1-Heuristik (%)', g1, O.g1 ?? null, 0.005, '%');
cmp('Sicherheitsabschlag gesamt', mos, O.mosTotal ?? null, 1e-12, '');
cmp('Einstiegspreis (USD)', entry, O.entryPrice ?? null, TOL.entryPrice, 'USD');
cmp('Tiefer Pruefpreis (USD)', deep, O.deepValuePrice ?? null, TOL.entryPrice, 'USD');

const fails = rows.filter(r => !r.ok);
const f = (x, dd = 6) => x == null ? '—' : (typeof x === 'number' ? x.toFixed(dd) : String(x));
console.log(`${T}: ${rows.length - fails.length}/${rows.length} Kontrollvergleiche innerhalb der Toleranz · Kurs ${A.price} (Annahme) · Produkt ${report.commit}`);
for (const r of fails) console.log('  ABWEICHUNG ' + r.label + ': Kontrolle ' + f(r.ctrl) + ' · Engine ' + f(r.eng) + ' · Toleranz ' + r.tol);
console.log(`  Kontrolle: Steuer ${taxPct} % · g1 ${g1} % · σg ${sigG.toFixed(4)} · σm ${sigM.toFixed(4)} · Piotroski ${pio}/9 · Z″ ${z.toFixed(4)} · MoS ${(mos * 100).toFixed(1)} % · Einstieg ${entry.toFixed(2)} · Tiefpreis ${deep.toFixed(2)} · TV-Anteil ${(D.base.tvShare * 100).toFixed(1)} %`);
if (md) {
  const out = ['| Groesse | Kontrolle (Original + Annahmen) | Engine (Replay) | Abw. | Toleranz | ✓ |', '|---|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.label} | ${f(r.ctrl)} | ${f(r.eng)} | ${r.diff == null ? '—' : r.diff.toExponential(2)} | ${r.tol == null ? 'Info' : r.tol} | ${r.ok ? '✓' : '✗'} |`);
  writeFileSync(md, out.join('\n') + '\n');
}
process.exit(fails.length ? 1 : 0);
