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

// ═══════════════════════════════════════════════════════════════════════════
// V1.0.59 (Korrekturchat 12B) — synthetische SEC-Facts durch den ECHTEN
// Importweg. Genutzt werden ausschliesslich die ausgelieferten Funktionen
// (_extractWithFallback → _applySecDerivations → _buildSecMasterJson →
// applyDerivedFieldsV4/normalizeSharesInPlace/applyConservativeHeuristics),
// also derselbe Pfad wie beim Live-Abruf in secFetchAll(). Damit werden
// Tag-Auswahl, Komponenten-Rebuild und Periodenmetadaten mitgeprueft und
// nicht durch von Hand gebaute fundamentals umgangen.
// ═══════════════════════════════════════════════════════════════════════════

// Top-Level-`const` (z.B. SEC_TAG_MAP) liegen nicht auf dem Sandbox-Objekt;
// sie werden im selben Kontext ausgewertet.
export function evalInApp(code) { return vm.runInContext(code, app()); }

const _M = 1e6;
const _YEARS_DESC = [2025, 2024, 2023, 2022];
const _entries = (perYear, make) => _YEARS_DESC.slice().reverse()
  .filter(y => perYear[y] != null).map(y => make(y, perYear[y]));

// Jahresabschlusswerte (10-K). `flow` = Zeitraum-, `inst` = Stichtagsgroesse.
export const secFlow = (perYear) => ({ units: { USD: _entries(perYear, (y, v) => ({
  start: y + '-01-01', end: y + '-12-31', val: v * _M,
  form: '10-K', filed: (y + 1) + '-02-15', accn: 'f' + y })) } });
export const secInst = (perYear) => ({ units: { USD: _entries(perYear, (y, v) => ({
  end: y + '-12-31', val: v * _M,
  form: '10-K', filed: (y + 1) + '-02-15', accn: 'i' + y })) } });
export const secShares = (perYear) => ({ units: { shares: _entries(perYear, (y, v) => ({
  start: y + '-01-01', end: y + '-12-31', val: v * _M,
  form: '10-K', filed: (y + 1) + '-02-15', accn: 's' + y })) } });

export const allYears = (v) => ({ 2025: v, 2024: v, 2023: v, 2022: v });

// Referenzbilanz: Umsatz 1.000, EBIT 200, D&A 50, CapEx 50, 100M Aktien,
// Umlaufvermoegen 400, Zahlungsmittel 100, kurzfristige Verbindlichkeiten 500.
// `debtTags` ergaenzt ausschliesslich die Schulden-Tags des jeweiligen Falls.
export function secFactsWithDebt(debtTags) {
  const g = { 'us-gaap': {
    Revenues:                                       secFlow(allYears(1000)),
    OperatingIncomeLoss:                            secFlow(allYears(200)),
    NetIncomeLoss:                                  secFlow(allYears(150)),
    NetCashProvidedByUsedInOperatingActivities:     secFlow(allYears(200)),
    PaymentsToAcquirePropertyPlantAndEquipment:     secFlow(allYears(50)),
    DepreciationDepletionAndAmortization:           secFlow(allYears(50)),
    CashAndCashEquivalentsAtCarryingValue:          secInst(allYears(100)),
    AssetsCurrent:                                  secInst(allYears(400)),
    LiabilitiesCurrent:                             secInst(allYears(500)),
    StockholdersEquity:                             secInst(allYears(3000)),
    Assets:                                         secInst(allYears(7000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: secShares(allYears(100))
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2025-12-31', val: 100 * _M, form: '10-K', filed: '2026-02-15' } ] } } } };
  Object.assign(g['us-gaap'], debtTags || {});
  return g;
}

const _IMPORT_FIELDS = [
  'revenue', 'ebit', 'net_income', 'cfo', 'capex', 'da', 'total_debt', 'long_term_debt',
  'debt_short_term', 'debt_long_term_current', 'debt_long_term_noncurrent',
  'finance_lease_current', 'finance_lease_noncurrent',
  'cash_and_equivalents', 'current_assets', 'current_liabilities', 'total_equity',
  'total_assets', 'shares_diluted', 'eps_diluted'
];

// Fuehrt den produktiven Importweg aus und liefert das fertige Master-JSON.
export function importSecFacts(facts, opts) {
  const S = app();
  const o = opts || {};
  const TAGS = evalInApp('SEC_TAG_MAP');
  const extracted = {};
  _IMPORT_FIELDS.forEach(k => { if (TAGS[k]) extracted[k] = S._extractWithFallback(facts, TAGS[k], 10); });
  S._applySecDerivations(extracted);
  const mj = S._buildSecMasterJson({
    ticker: o.ticker || 'SYNT', cik: '0000001', companyName: 'Synthetik AG',
    sic: '3674', fiscalYearEnd: '1231', exchange: 'NASDAQ',
    sicMapping: S._sicToSector('3674'), extracted, yahooData: null,
    secFacts: facts, derivationNotes: []
  });
  mj.market = { price: o.price != null ? o.price : 20, price_currency: 'USD' };
  S.applyDerivedFieldsV4(mj);
  S.normalizeSharesInPlace(mj);
  S.applyDerivedFieldsV4(mj);
  S.applyConservativeHeuristics(mj);
  return mj;
}

// ── V1.0.61 (Korrekturchat 12B.2) ──────────────────────────────────────────
// Seit der Umfangsprüfung ist die Gesamtverschuldung nur dann bestimmt, wenn
// die gemeldeten Angaben ALLE Bestandteile belegen (kurzfristige Bankschulden,
// laufende Fälligkeiten, langfristige Schulden, kurz- und langfristiges
// Leasing). Ein Abschluss, der einen Bestandteil gar nicht erwähnt, belegt ihn
// nicht — auch nicht als Null.
//
// `fullyDocumented()` beschreibt deshalb einen Filer, der die Bestandteile
// ohne Bestand AUSDRÜCKLICH mit 0 meldet. Übergebene Tags haben Vorrang.
export function fullyDocumented(debtTags) {
  return Object.assign({
    ShortTermBorrowings:             secInst(allYears(0)),
    FinanceLeaseLiabilityCurrent:    secInst(allYears(0)),
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0))
  }, debtTags || {});
}

// Variante für Abschlüsse, deren KURZFRISTIGE Seite bereits durch
// `DebtCurrent` vollständig belegt ist (es umfasst Bankschulden, laufende
// Fälligkeiten und kurzfristiges Leasing). Dort fehlt nur noch die Aussage
// zum langfristigen Leasing; zusätzliche Nullwerte auf der kurzfristigen
// Seite würden die Aufteilung überbestimmen.
export function noNoncurrentLeases(debtTags) {
  return Object.assign({
    FinanceLeaseLiabilityNoncurrent: secInst(allYears(0))
  }, debtTags || {});
}

// ── Quartalsfacts für den ECHTEN TTM-Weg (Korrekturchat 12B.2) ─────────────
// `buildTtmDatasetFromFacts()` braucht Quartalsdaten. Diese Helfer erzeugen
// dieselbe Struktur wie ein SEC-companyfacts-Abruf: kumulierte YTD-Beträge für
// Zeitraumgrößen, Stichtagswerte je Quartalsende für Bilanzgrößen.
const _QE = { 1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31' };
const _QTHROUGH = { 2022: 4, 2023: 4, 2024: 4, 2025: 4 };
const _qForm  = (n) => (n === 4 ? '10-K' : '10-Q');
const _qFiled = (y, n) => (n === 4 ? (y + 1) + '-02-15' : y + '-' + String(n * 3 + 2).padStart(2, '0') + '-01');

// Zeitraumgröße: gleichmäßig auf vier Quartale verteilt, kumuliert gemeldet.
export function secQFlow(perYearTotal) {
  const u = [];
  Object.keys(perYearTotal).forEach(y => {
    const q = perYearTotal[y] / 4;
    for (let n = 1; n <= _QTHROUGH[y]; n++) {
      u.push({ start: y + '-01-01', end: y + _QE[n], val: q * n * _M,
               form: _qForm(n), filed: _qFiled(+y, n), accn: 'qf' + y + n });
    }
  });
  return { units: { USD: u } };
}

// Stichtagsgröße: derselbe Wert zu jedem Quartalsende. `perYear` darf je Jahr
// eine Zahl oder ein Array der vier Quartalswerte sein.
export function secQInst(perYear) {
  const u = [];
  Object.keys(perYear).forEach(y => {
    const v = perYear[y];
    for (let n = 1; n <= _QTHROUGH[y]; n++) {
      const val = Array.isArray(v) ? v[n - 1] : v;
      if (val == null) continue;
      u.push({ end: y + _QE[n], val: val * _M,
               form: _qForm(n), filed: _qFiled(+y, n), accn: 'qi' + y + n });
    }
  });
  return { units: { USD: u } };
}

export function secQShares(perYear) {
  const u = [];
  Object.keys(perYear).forEach(y => {
    for (let n = 1; n <= _QTHROUGH[y]; n++) {
      u.push({ start: y + '-' + String((n - 1) * 3 + 1).padStart(2, '0') + '-01',
               end: y + _QE[n], val: perYear[y] * _M,
               form: _qForm(n), filed: _qFiled(+y, n), accn: 'qs' + y + n });
    }
  });
  return { units: { shares: u } };
}

const _qAll = (v) => ({ 2022: v, 2023: v, 2024: v, 2025: v });

// Referenzfirma wie `secFactsWithDebt()`, aber mit Quartalsdaten, sodass der
// produktive TTM-Weg sie tatsächlich bilden kann.
export function secQuarterlyFactsWithDebt(debtTags) {
  const g = { 'us-gaap': {
    Revenues:                                        secQFlow(_qAll(1000)),
    OperatingIncomeLoss:                             secQFlow(_qAll(200)),
    NetIncomeLoss:                                   secQFlow(_qAll(150)),
    NetCashProvidedByUsedInOperatingActivities:      secQFlow(_qAll(200)),
    PaymentsToAcquirePropertyPlantAndEquipment:      secQFlow(_qAll(50)),
    DepreciationDepletionAndAmortization:            secQFlow(_qAll(50)),
    CashAndCashEquivalentsAtCarryingValue:           secQInst(_qAll(100)),
    AssetsCurrent:                                   secQInst(_qAll(400)),
    LiabilitiesCurrent:                              secQInst(_qAll(500)),
    StockholdersEquity:                              secQInst(_qAll(3000)),
    Assets:                                          secQInst(_qAll(7000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: secQShares(_qAll(100))
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2025-12-31', val: 100 * _M, form: '10-K', filed: '2026-02-15' } ] } } } };
  Object.assign(g['us-gaap'], debtTags || {});
  return g;
}

// Produktiver TTM-Weg: Datensatz bilden, Basis auflösen, Sicht erzeugen.
export function ttmViewOf(mj) {
  const S = app();
  const resolved = S.resolveDataBasis(mj, 'ttm');
  return { resolved, view: S.buildValuationBasisView(mj, resolved) };
}
