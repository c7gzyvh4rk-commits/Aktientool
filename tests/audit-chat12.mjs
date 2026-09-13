// ═══════════════════════════════════════════════════════════════════════════
// Audit-Hilfe: laedt den ausgelieferten <script>-Block der Tool-Datei
// vollstaendig in einen vm-Kontext (read-only, ohne DOM, ohne Netz).
//
// Warum nicht tests/extract-functions.mjs? Der Audit prueft ENDE-ZU-ENDE-Wege
// (modelDcf, solveReverseDcfGrowth, computeSensitivityMatrix, runMonteCarloDcf,
// buildReverseDcfOverviewCard, buildSnapshotForecastTargets). Diese Funktionen
// rufen einander auf; einzelne Deklarationen auszuschneiden wuerde genau den
// Zusammenhang zerstoeren, der geprueft werden soll.
//
// Es wird ausschliesslich der ausgelieferte Quelltext geladen — keine Kopie
// der Logik, keine Veraenderung der Produktdatei.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP_FILE = join(HERE, '..', 'us-aktienbewertungstool-v1036-sector-classification-patch.html');

let _app = null;

export function app() {
  if (_app) return _app;
  const html = readFileSync(APP_FILE, 'utf8');
  const i = html.indexOf('<script>');
  const j = html.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('Kein <script>-Block gefunden');
  const src = html.slice(i + '<script>'.length, j);

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
  // Bewusst minimale Attrappe: getElementById liefert null, createElement
  // wirft. Ein unerwarteter DOM-Zugriff faellt damit sofort auf, statt still
  // ein falsches Ergebnis zu erzeugen.
  const document = {
    addEventListener: () => {},
    getElementById: () => null,
    createElement: () => { throw new Error('document.createElement: kein DOM im Testrunner'); },
    body: { appendChild: () => { throw new Error('document.body.appendChild: kein DOM im Testrunner'); } },
    querySelector: () => null
  };
  const sandbox = {
    console, localStorage, document,
    location: { search: '' },
    navigator: { userAgent: 'audit-test-runner' },
    URLSearchParams, URL,
    fetch: () => Promise.reject(new Error('Netzwerkzugriff ist im Audit-Test nicht vorgesehen.')),
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: APP_FILE, timeout: 30000 });
  _app = sandbox;
  return _app;
}

// ── Synthetische Referenzfirma ────────────────────────────────────────────
// Umsatz 1.000M, EBIT 200M (20 %), EBITDA 250M ⇒ D&A 50M (5 %),
// CapEx 50M (5 %), Steuerquote 25 %, 100M konstante Aktien.
// FCFF (ohne Wachstum) = 200·0,75 + 50 − 50 = 150M p.a.
export function refMj(fundOverrides, valOverrides, marketOverrides) {
  return {
    meta: { ticker: 'AUDIT', sub_classification: 'standard_nonfin' },
    fundamentals: Object.assign({
      revenue:        [1000, 1000, 1000, 1000],
      ebit:           [200, 200, 200, 200],
      ebitda:         [250, 250, 250, 250],
      capex:          [50, 50, 50, 50],
      shares_diluted: [100, 100, 100, 100]
    }, fundOverrides || {}),
    valuation: Object.assign({
      wacc_components: { tax_rate: 25 },
      fade: { enabled: false }
    }, valOverrides || {}),
    market: Object.assign({}, marketOverrides || {})
  };
}

export const scOf = (g1, tg, wacc, marginPct) => {
  const sc = { growth_stage1: g1, terminal_growth: tg, wacc, op_margin_pct: marginPct, coe: wacc + 1 };
  return { conservative: sc, base: sc, optimistic: sc };
};

// ── Unabhaengige Nachrechnung des Bewertungskerns ─────────────────────────
// Bewusst als eigenstaendige, kurze Formel geschrieben (nicht aus der
// Tool-Datei uebernommen), damit die Erwartungswerte unabhaengig entstehen.
//   FCFF_i = rev_i·(m·(1−t) + da − capex) − owc·(rev_i − rev_{i−1})
//   TV     = [rev_10·(m·(1−t) + da − capex)·(1+tg) − owc·rev_10·tg] / (wacc − tg)
export function refValuePerShare({ rev0, marginPct, taxPct, daRatio, capexRatio,
                                   owcRatio, g1Pct, tgPct, waccPct, sharesM, netDebtM }) {
  const m = marginPct / 100, t = taxPct / 100, g = g1Pct / 100, tg = tgPct / 100, w = waccPct / 100;
  const unit = m * (1 - t) + daRatio - capexRatio;   // FCFF vor ΔOWC je Umsatzeinheit
  let rev = rev0, pv = 0;
  for (let i = 1; i <= 10; i++) {
    const prev = rev;
    rev = rev * (1 + g);
    const fcff = rev * unit - owcRatio * (rev - prev);
    pv += fcff / Math.pow(1 + w, i);
  }
  const terminalFcff = rev * unit * (1 + tg) - owcRatio * rev * tg;
  const pvTv = (terminalFcff / (w - tg)) / Math.pow(1 + w, 10);
  const evAbs = pv + pvTv;
  return {
    evAbs, pvAbs: pv, pvTvAbs: pvTv,
    operatingPerShare: evAbs / sharesM,
    equityPerShare: (evAbs - netDebtM) / sharesM
  };
}

export const nearly = (a, b, tol = 1e-9) =>
  a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;
