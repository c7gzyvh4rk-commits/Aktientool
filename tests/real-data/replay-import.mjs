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
// Erfassung (seit D1): drei Schritte `fy` → `ttmView` (TTM angefordert) →
// `fyReturn`. Die Datenbasis wird ueber die Auswahl im Reiter „Annahmen“
// umgestellt, jede Ansicht ueber ihren Reiter geoeffnet und erst nach
// nachgewiesenem Neurendern gelesen. Die Feldwerte stammen aus der
// Bewertungssicht, mit der die Engine rechnet (resolveValuationView), nicht aus
// state.masterJson.fundamentals. Ist TTM nicht verfuegbar, weist `ttmView` den
// tatsaechlichen Rueckfall aus (basis.requested 'ttm', basis.selected 'fy',
// fallback.reasons). `checks` gleicht die Ansichten mit dem Engine-Ausweis ab.
// Regressionstests: tests/real-data/replay-import.browser.test.mjs.
//
// Exit: 0 = Lauf vollstaendig, Abgleich bestanden · 1 = Import blockiert,
// Fehler oder Abweichung zwischen Anzeige und Engine · 2 = nicht ausfuehrbar
// (kein Browser, fehlende Dateien).
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
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

// Groessenart je Feld. Sie bestimmt, wie Wert und Periode zu lesen sind:
// Stromgroesse = Summe ueber einen Zeitraum, Stichtag = Bilanzwert an einem
// Tag, Aktien = gewichteter Durchschnitt eines Zeitraums (nicht die aktuelle
// Aktienzahl am Stichtag, die getrennt unter shareConcepts steht).
const KIND = {
  revenue: 'Stromgroesse', ebit: 'Stromgroesse', da: 'Stromgroesse', ebitda: 'Stromgroesse',
  cfo: 'Stromgroesse', capex: 'Stromgroesse', fcf: 'Stromgroesse', dividends_paid: 'Stromgroesse',
  net_income: 'Stromgroesse', eps_diluted: 'Stromgroesse je Aktie', dps: 'Stromgroesse je Aktie',
  dps_direct: 'Stromgroesse je Aktie',
  total_debt: 'Stichtag', net_debt: 'Stichtag', debt_short_term: 'Stichtag', debt_long_term_current: 'Stichtag',
  debt_long_term_noncurrent: 'Stichtag', finance_lease_current: 'Stichtag', finance_lease_noncurrent: 'Stichtag',
  operating_lease_liability_current: 'Stichtag', operating_lease_liability_noncurrent: 'Stichtag',
  operating_lease_liabilities: 'Stichtag', cash_and_equivalents: 'Stichtag', book_value: 'Stichtag',
  total_equity: 'Stichtag',
  shares_diluted: 'Aktien: gewichteter Durchschnitt, verwaessert',
  shares_basic: 'Aktien: gewichteter Durchschnitt, unverwaessert'
};

// Bestandteile der in buildValuationBasisView abgeleiteten TTM-Groessen
// (nur zur Zuordnung der Bestandteil-Metadaten; es wird nichts berechnet).
const DERIVED = { ebitda: ['ebit', 'da'], fcf: ['cfo', 'capex'], net_debt: ['total_debt', 'cash_and_equivalents'] };

// Ausgelesene Ansichten und der Bereich, den ihr Renderer jeweils ersetzt.
const PANELS = ['overview', 'valuation', 'market', 'quality', 'assumptions'];
const PANEL_OUTPUT = { overview: 'overview-content', valuation: 'valuation-output', market: 'market-output',
  quality: 'quality-output', assumptions: 'assumptions-output' };

// Erfassung im Browser. Gelesen wird die Bewertungssicht, die die Engine
// tatsaechlich verwendet: resolveValuationView() — dieselbe Paarung
// resolveDataBasis + buildValuationBasisView wie in runValuationEngine und im
// Markt-Vergleich. Bei FY ist das das Master-JSON selbst, bei TTM die daraus
// erzeugte TTM-Sicht. Das Werkzeug rechnet NICHTS selbst nach und uebernimmt
// fuer TTM-Werte keine Jahres-Metadaten.
const CAPTURE_JS = `(() => {
  const FIELDS = ${JSON.stringify(FIELDS)};
  const KIND = ${JSON.stringify(KIND)};
  const DERIVED = ${JSON.stringify(DERIVED)};
  const mj = state.masterJson, v = state.valuation || {};
  const rep = v.dataBasis || null;
  const w = resolveValuationView(mj, state.valuation);
  const out = {
    requestedInMasterJson: (mj.valuation && mj.valuation.data_basis) || null,
    engineView: { ok: w.ok, basis: w.basis, mismatch: w.mismatch, reason: w.reason },
    basis: rep ? { requested: rep.requested, selected: rep.selected, label: rep.label,
      ttm_available: rep.ttm_available, ttm_used: rep.selected === 'ttm', fallback: rep.fallback,
      period: rep.period, publication: rep.publication, blocked_models: rep.blocked_models,
      covered_fields: rep.covered_fields, missing_fields: rep.missing_fields, warnings: rep.warnings } : null,
    basisLabels: DATA_BASIS_LABELS
  };
  if (!w.ok || !w.mj) { out.fields = null; out.fieldsUnavailableReason = w.reason || 'Bewertungssicht nicht aufloesbar'; }
  else {
    const view = w.mj, f = view.fundamentals || {}, meta = f._v4_meta || {};
    const isTtm = w.basis === 'ttm';
    const ds = isTtm ? w.resolved.dataset : null;
    const dv = view._data_basis_view || null;
    const covered = (dv && dv.covered_fields) || [], cleared = (dv && dv.cleared_fields) || [];
    out.reportingUnit = isTtm ? ((ds && ds.reporting_unit) || null) : ((mj.meta && mj.meta.reporting_unit) || null);
    const seriesFor = (k) => {
      if (!ds) return null;
      for (const grp of ['flows', 'instants']) {
        const G = ds[grp] || {};
        for (const key of Object.keys(G)) if (G[key] && G[key].app_field === k) return { grp, s: G[key] };
      }
      if (k === 'shares_diluted' && ds.shares) return { grp: 'shares', s: ds.shares };
      if (k === 'eps_diluted' && ds.eps) return { grp: 'eps', s: ds.eps };
      return null;
    };
    const first = (a) => Array.isArray(a) ? (a.length ? a[0] : null) : (a == null ? null : a);
    out.fields = {};
    for (const k of FIELDS) {
      const raw = f[k];
      let m = meta[k] || null;
      let status;
      if (isTtm) {
        if (covered.indexOf(k) >= 0) status = 'TTM-Groesse der Engine';
        else if (cleared.indexOf(k) >= 0) status = 'in der TTM-Sicht geleert (kein TTM-Wert, Jahreswert nicht eingemischt)';
        else { status = 'nicht Teil der TTM-Sicht'; m = null; }
      } else status = raw == null ? 'nicht vorhanden' : 'Jahreswert';
      const vals = Array.isArray(raw) ? raw : (raw === undefined ? null : raw);
      const rec = {
        concept: KIND[k] || 'unbekannt', basis: w.basis, status,
        value: first(vals), values: Array.isArray(vals) ? vals.slice(0, 3) : vals,
        unit: { reporting: out.reportingUnit, source: (m && m.unit) || null },
        period: { type: (m && m.period_type) || null, end: m && Array.isArray(m.periods) ? (m.periods[0] || null) : null,
          periods: m && Array.isArray(m.periods) ? m.periods.slice(0, 3) : null },
        provenance: m ? { source_type: m.source_type || null, source_reference: m.source_reference || null,
          // FY: Tag wie ihn die Produktdatei selbst liest (_secSourceTag). TTM:
          // nur der Tag der verwendeten Quartalsdaten; einen von der
          // Jahresreihe geerbten Tag weist das Werkzeug NICHT als TTM-Tag aus.
          tag: isTtm ? (m.ttm_used_tag || (m.source_tag_inherited === true ? null : (m.source_tag || null))) : _secSourceTag(m),
          engine_inherited_fy_tag: (isTtm && m.source_tag_inherited === true) ? (m.source_tag || null) : null,
          method: m.ttm_method || null, cross_check: m.ttm_cross_check || null,
          forms: m.forms ? m.forms.slice(0, 3) : null, filed: m.filed ? m.filed.slice(0, 3) : null,
          accns: m.accns ? m.accns.slice(0, 3) : null,
          derivation: m.notes ? String(m.notes).slice(0, 600) : null,
          unavailablePeriods: m.unavailablePeriods || null, derivationWarnings: m.derivationWarnings || null } : null
      };
      const sr = seriesFor(k);
      if (sr && covered.indexOf(k) >= 0) {
        const s = sr.s;
        rec.unit.series = s.unit || null;
        if (sr.grp === 'flows') {
          const w0 = (s.windows || [])[0] || null;
          const dw = (ds.windows || []).find(x => w0 && x.start === w0.start && x.end === w0.end) || null;
          rec.components = w0 ? { start: w0.start, end: w0.end, days: w0.durationDays, quarters: w0.quarters,
            quarterStarts: dw ? dw.quarterStarts : null, quarterEnds: dw ? dw.quarterEnds : null,
            filed: w0.filed || null, basisCounts: w0.basisCounts || null } : null;
          rec.provenance.tag = s.used_tag || rec.provenance.tag;
          rec.provenance.filed = s.filed ? [s.filed] : null;
        } else if (sr.grp === 'instants') {
          rec.components = { asOf: (s.dates || [])[0] || null };
          rec.provenance.tag = s.used_tag || rec.provenance.tag;
          rec.provenance.filed = s.filed ? [s.filed] : null;
        } else if (sr.grp === 'shares') {
          rec.components = { end: (s.ends || [])[0] || null,
            quarters: ((s.quarters_used || [])[0] || []).map(q => ({ start: q.start, end: q.end, days: q.days, value: q.value, filed: q.filed, form: q.form })) };
          rec.provenance.filed = s.latest_filed ? [s.latest_filed] : null;
        } else {
          rec.components = { end: (s.ends || [])[0] || null, cross_check: s.cross_check || null };
        }
      }
      const missing = [];
      if (rec.value != null) {
        if (!rec.unit.reporting && !rec.unit.source && !rec.unit.series) missing.push('Einheit');
        if (!rec.period.end) missing.push('Periode');
        if (!rec.provenance) missing.push('Herkunft');
        else {
          if (!rec.provenance.tag && !/us-gaap:|dei:/.test(rec.provenance.source_reference || '')) missing.push('Tag');
          if (!rec.provenance.filed) missing.push('filed');
        }
      }
      rec.metadataMissing = missing;
      out.fields[k] = rec;
    }
    for (const k of FIELDS) {
      const rec = out.fields[k];
      // Abgeleitete TTM-Groessen (ebitda, fcf, net_debt): Die Engine bildet sie
      // in buildValuationBasisView aus zwei TTM-Reihen; welche, steht in ihrer
      // Notiz. Hier werden nur die Angaben der erfassten Bestandteile daneben
      // gestellt — nicht nachgerechnet.
      if (isTtm && covered.indexOf(k) >= 0 && !rec.components && DERIVED[k]) {
        rec.components = { derivedFrom: DERIVED[k].map(x => ({ field: x,
          end: out.fields[x] ? out.fields[x].period.end : null,
          tag: out.fields[x] && out.fields[x].provenance ? out.fields[x].provenance.tag : null,
          filed: out.fields[x] && out.fields[x].provenance ? out.fields[x].provenance.filed : null })) };
      }
    }
    out.viewCoverage = dv ? { covered_fields: covered, cleared_fields: cleared, period: dv.period } : null;
  }
  const sb = (rep && rep.share_basis) || {};
  out.shareConcepts = {
    weightedAverage: { value: sb.weighted_average_ttm != null ? sb.weighted_average_ttm : (sb.weighted_average_fy != null ? sb.weighted_average_fy : null),
      method: sb.weighted_average_method || null, unit: sb.unit || null, filed: sb.weighted_average_filed || null },
    currentOutstanding: { value: sb.current_shares != null ? sb.current_shares : null, asOf: sb.current_shares_as_of || null,
      source: sb.current_shares_source || null },
    marketSharesOutstandingDerived: (mj.market && mj.market.shares_outstanding_derived != null) ? mj.market.shares_outstanding_derived : null,
    note: sb.note || null
  };
  const models = {};
  for (const [k, r] of Object.entries(v.modelResults || {})) {
    if (!r || typeof r !== 'object') continue;
    const pick = {};
    for (const [kk, vv] of Object.entries(r)) {
      if (/^(base|bear|bull|available|status)$|reason|warn|block|unavail|netDebt|shares|bridge|equity|period|basis/i.test(kk)
          && (vv == null || typeof vv !== 'object' || Array.isArray(vv))) pick[kk] = Array.isArray(vv) ? vv.slice(0, 12) : vv;
    }
    models[k] = pick;
  }
  // Erwartung an den Markt-Vergleich aus derselben Produktfunktion, mit der
  // renderMarket rechnet: Basis, Sperre der Basis mit Grund, darstellbare Zeilen.
  try {
    const rel = computeRelativeMultiplesFV(mj, state.valuation);
    out.market = { basis: rel.basis || null, basisLabel: rel.basisLabel || null, basisPeriod: rel.basisPeriod || null,
      basisBlocked: !!rel.basisBlocked, basisReason: rel.basisReason || null,
      rows: (rel.models || []).filter(m => m.available || m.bridgeBlocked || m.multiplePresent === true)
        .map(m => ({ id: m.id, available: !!m.available, base: m.available ? m.base : null })) };
  } catch (e) { out.market = { error: String((e && e.message) || e) }; }
  const gates = {};
  for (const [kk, vv] of Object.entries(v)) if (/gate|block|excluded|inactive|skipped|unavailable|status|warn/i.test(kk)) gates[kk] = vv;
  const rm = state.synthesis && state.synthesis.relativeMultiples;
  Object.assign(out, { router: v.router || null, reverseDcf: { status: v._reverseDcfStatus, reason: v._reverseDcfStatusReason,
      impliedGrowth: v.reverseDcfImpliedGrowth != null ? v.reverseDcfImpliedGrowth : null },
    gates, models, multiples: rm ? rm.models : null, range: state.synthesis && state.synthesis.range,
    price: mj.market && mj.market.price,
    shares_meta: mj.meta && { shares_source: mj.meta.shares_source, shares_normalization: mj.meta.shares_normalization },
    secFetch: mj._sec_fetch || (mj.meta && mj.meta._sec_fetch) || null });
  return out;
})()`;

// Abgleich der Ansichten mit dem Ausweis der Engine fuer DIESEN Schritt. Es
// wird nur gelesen und verglichen; Ersatztexte erzeugt das Werkzeug nicht.
export function checkPanels(c) {
  const res = [];
  const add = (name, ok, detail) => res.push({ name, ok: !!ok, detail: detail || null });
  const b = c.basis;
  add('Engine-Ausweis der Datenbasis vorhanden', !!b);
  add('Bewertungssicht aufloesbar (keine Mischung zweier Basen)', c.engineView && c.engineView.ok, c.engineView && c.engineView.reason);
  if (!b) return res;
  add('Engine-Sicht und Bewertungsergebnis auf derselben Basis', c.engineView.basis === b.selected, c.engineView.basis + ' / ' + b.selected);
  if (c.requested_by_replay) add('angeforderte Basis in der Engine angekommen', b.requested === c.requested_by_replay, b.requested);
  if (b.requested === 'ttm' && b.selected !== 'ttm') add('TTM angefordert, aber nicht verwendet: Rueckfall mit Grund ausgewiesen',
    b.fallback && b.fallback.active && b.fallback.reasons.length > 0, JSON.stringify(b.fallback));
  // innerText gibt die per CSS erzwungene Grossschreibung und den Zeilenumbruch
  // der Darstellung wieder; verglichen wird deshalb ohne Beachtung von Gross-/
  // Kleinschreibung und mit zusammengefasstem Leerraum.
  const U = (x) => String(x == null ? '' : x).toLocaleUpperCase('de-DE').replace(/\s+/g, ' ').trim();
  const has = (t, x) => U(t).includes(U(x));
  const snip = (t) => U(t).slice(0, 120);
  const own = c.basisLabels[b.selected], other = c.basisLabels[b.selected === 'ttm' ? 'fy' : 'ttm'];
  const p = b.period || {};
  const periodText = b.selected === 'ttm' ? (p.start + ' – ' + p.end) : p.end;
  for (const panel of ['valuation', 'assumptions']) {
    const t = c.panels[panel] || '';
    add(panel + ': Datenbasis-Karte nennt die verwendete Basis', has(t, 'Datenbasis der Bewertung') && has(t, own), own);
    add(panel + ': Zeitraum der verwendeten Basis sichtbar', !!periodText && has(t, periodText), periodText);
  }
  // Modellwerte der Bewertungsansicht = Ergebnisse DIESER Berechnung.
  const vt = c.panels.valuation || '';
  for (const [k, m] of Object.entries(c.models || {})) {
    if (typeof m.base === 'number' && isFinite(m.base)) {
      add('valuation: Basiswert ' + k + ' = Engine-Ergebnis', vt.includes(m.base.toFixed(2)), m.base.toFixed(2));
    }
  }
  // Modellsperre: Der Grund der AKTUELLEN Engine-Sperre muss beim richtigen
  // Modell stehen („<modell>: <grund>“). Der Modellname allein genuegt nicht,
  // und ein laengerer Name (rim_buyback) zaehlt nicht fuer rim.
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const bm of (b.blocked_models || [])) {
    const re = new RegExp('(^|[^A-Z0-9_])' + esc(U(bm.model + ': ' + bm.reason)));
    add('valuation: Sperre von ' + bm.model + ' mit dem Engine-Grund sichtbar', re.test(U(vt)), bm.reason);
  }
  // Markt-Vergleich: Die Ansicht muss vorhanden sein. Leer, fehlend oder mit
  // anderem Inhalt ist ein Fehlschlag. Erwartet wird, was die Produktfunktion
  // des Renderers (computeRelativeMultiplesFV, erfasst als c.market) liefert;
  // produktive Leerzustaende bestehen nur mit ihrem konkreten Grund.
  const mk = (c.panels || {}).market;
  const M = c.market;
  add('market: Ansicht erfasst und nicht leer', typeof mk === 'string' && mk.trim().length > 0,
    typeof mk === 'string' ? 'leer' : 'nicht erfasst');
  add('market: Engine-Erwartung erfasst', !!M && !M.error, M ? M.error : 'c.market fehlt');
  if (typeof mk === 'string' && mk.trim() && M && !M.error) {
    const isView = has(mk, 'Markt-Vergleich') && has(mk, 'kein Fair Value') && !has(mk, 'Noch kein Markt-Vergleich');
    add('market: erwartete Ansicht „Markt-Vergleich“ gerendert', isView, snip(mk));
    if (M.basisBlocked) {
      add('market: Sperre der Datenbasis mit dem Engine-Grund', !!M.basisReason && has(mk, M.basisReason), M.basisReason);
    } else {
      const tag = M.basisLabel + (M.basisPeriod ? ' · ' + M.basisPeriod : '');
      add('market: Basisangabe = verwendete Basis', M.basisLabel === own && has(mk, tag) && !has(mk, other), tag);
      add('market: Periode der verwendeten Basis', !!p.end && M.basisPeriod === p.end && mk.includes(p.end), p.end);
      const EMPTY = 'Keine eigenen Multiples-Mediane im Master-JSON';
      if (M.rows.length === 0) {
        add('market: Leerzustand „keine Multiples“ mit Grund (Engine: keine darstellbare Zeile)', has(mk, EMPTY), EMPTY);
      } else {
        add('market: Zeilen vorhanden, kein Leerzustand', !has(mk, EMPTY), M.rows.map(r => r.id).join(', '));
        for (const r of M.rows) {
          const want = r.available ? r.base.toFixed(2) : 'nicht ableitbar';
          add('market: Zeile ' + r.id + ' = Engine-Ergebnis', has(mk, want), want);
        }
      }
      if (c.reverseDcf && c.reverseDcf.impliedGrowth != null) {
        const g = c.reverseDcf.impliedGrowth.toFixed(1) + '%';
        add('market: Reverse-DCF-Wert = Engine-Ergebnis', mk.includes(g), g);
      }
    }
  }
  return res;
}

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
    // secConfirmImport arbeitet synchron; gewartet wird trotzdem auf den
    // sichtbaren Abschluss (importiert oder ausdruecklich blockiert).
    await ev('secConfirmImport()');
    await waitFor('(!!state.masterJson && !!state.masterJson.meta && state.masterJson.meta.ticker === ' + JSON.stringify(o.ticker)
      + ' && !!state.valuation) || /blockiert/.test((document.getElementById(\'sec-status\') || {}).innerText || \'\')', 15000);
    report.importStatus = await ev("(document.getElementById('sec-status') || {}).innerText || ''");
    report.imported = await ev('!!(state.masterJson && state.masterJson.meta && state.masterJson.meta.ticker === ' + JSON.stringify(o.ticker) + ')');
    if (!report.imported) { exit = 1; throw new Error('Import blockiert: ' + report.importStatus); }
    // Oberflaechenhelfer. Jede Ansicht wird ueber ihren Reiter geoeffnet
    // (echter Mausklick → switchTab → render…), jede Datenbasis ueber die
    // Auswahl im Reiter „Annahmen“ (change → _handleDataBasisChange). Gewartet
    // wird auf nachgewiesene Zustandsaenderungen, nicht auf feste Zeiten.
    let seq = 0;
    const click = async (findJs, what) => {
      const id = 'replay' + (++seq);
      const box = await ev(`(() => { const el = (${findJs}); if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' }); el.setAttribute('data-replay', '${id}');
        const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
      if (!box || box.w === 0 || box.h === 0) throw new Error('Nicht klickbar/sichtbar: ' + what);
      const top = await ev(`(() => { const e = document.elementFromPoint(${box.x}, ${box.y}); const t = document.querySelector('[data-replay="${id}"]'); return !!(e && t && (e === t || t.contains(e))); })()`);
      if (!top) throw new Error('Element verdeckt: ' + what);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await P.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
    };
    // Reiter oeffnen und das Neurendern NACHWEISEN: Vor dem Klick bekommt der
    // Ausgabebereich eine unsichtbare Markierung. Erst wenn der Renderer den
    // Bereich ersetzt hat (Markierung weg) und das Panel aktiv ist, wird gelesen.
    const openPanel = async (name) => {
      const token = 'stale-' + (++seq);
      const placed = await ev(`(() => { const c = document.getElementById(${JSON.stringify(PANEL_OUTPUT[name])}); if (!c) return false;
        const s = document.createElement('span'); s.hidden = true; s.setAttribute('data-replay-stale', '${token}'); c.appendChild(s); return true; })()`);
      if (!placed) throw new Error('Ausgabebereich fehlt: ' + PANEL_OUTPUT[name]);
      await click(`document.querySelector('#tabs button[onclick="switchTab(\\'${name}\\')"]')`, 'Reiter ' + name);
      const ok = await waitFor(`document.getElementById('panel-${name}').classList.contains('active') && !document.querySelector('[data-replay-stale="${token}"]')`, 15000);
      if (!ok) throw new Error('Ansicht ' + name + ' wurde nach dem Oeffnen nicht neu gerendert.');
      return ev(`document.getElementById('panel-${name}').innerText`);
    };
    const selectBasis = async (target) => {
      await openPanel('assumptions');
      await ev('window.__replayPrevValuation = state.valuation; true');
      const T = JSON.stringify(target);
      await ev(`(() => { const s = document.getElementById('as-data-basis'); if (!s) throw new Error('Auswahl as-data-basis fehlt');
        s.focus(); s.value = ${T}; if (s.value !== ${T}) throw new Error('Option ' + ${T} + ' fehlt');
        s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      const ok = await waitFor(`!!state.masterJson.valuation && state.masterJson.valuation.data_basis === ${T} && !!state.valuation
        && state.valuation !== window.__replayPrevValuation && !!state.valuation.dataBasis && state.valuation.dataBasis.requested === ${T}`, 15000);
      if (!ok) throw new Error('Datenbasis ' + target + ' wurde nicht neu berechnet.');
    };
    const fundamentalsHash = async () => createHash('sha256')
      .update(await ev('JSON.stringify(state.masterJson.fundamentals)')).digest('hex');
    report.integrity = { fundamentalsSha256AfterImport: await fundamentalsHash() };

    if (o.price != null) {
      // Kurs = ausdrueckliche Annahme, getrennt von Abschlussdaten.
      await openPanel('assumptions');
      await ev('window.__replayPrevValuation = state.valuation; true');
      await ev(`(() => { const el = document.getElementById('as-price'); el.value = ${JSON.stringify(String(o.price))}; recalcFromAssumptions(); })()`);
      if (!await waitFor('state.valuation !== window.__replayPrevValuation', 15000)) throw new Error('Kurs-Annahme ohne Neuberechnung.');
    }

    // Erfassung: FY → TTM (angefordert) → zurueck auf FY. Je Schritt die
    // Eingaben, mit denen die Engine TATSAECHLICH rechnet, und die Texte der
    // danach neu gerenderten Ansichten.
    const capture = async (step, requested) => {
      if (requested) await selectBasis(requested);
      const c = await ev(CAPTURE_JS);
      c.step = step;
      c.requested_by_replay = requested || null;
      c.panels = {};
      for (const p of PANELS) c.panels[p] = await openPanel(p);
      c.checks = checkPanels(c);
      return c;
    };
    report.fy = await capture('fy', null);
    report.ttmView = await capture('ttm', 'ttm');
    report.fyReturn = await capture('fy-return', 'fy');
    report.integrity.fundamentalsSha256AtEnd = await fundamentalsHash();
    report.integrity.fundamentalsUnchanged = report.integrity.fundamentalsSha256AtEnd === report.integrity.fundamentalsSha256AfterImport;
    report.checks = [
      ...['fy', 'ttmView', 'fyReturn'].flatMap(k => report[k].checks.map(x => Object.assign({ capture: k }, x))),
      { capture: '-', name: 'Master-JSON-Fundamentaldaten durch die Erfassung unveraendert', ok: report.integrity.fundamentalsUnchanged }
    ];
    if (report.checks.some(x => !x.ok)) exit = 1;
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
  const fmt = (x) => x == null ? '—' : (typeof x === 'number' ? String(+x.toFixed(4)) : String(x));
  for (const [key, title] of [['fy', 'FY'], ['ttmView', 'TTM angefordert'], ['fyReturn', 'zurueck auf FY']]) {
    const c = report[key];
    if (!c) continue;
    const b = c.basis || {};
    console.log(`\n== ${title}: verwendet ${b.selected || '?'} (angefordert ${b.requested || '?'}; TTM verfuegbar: ${b.ttm_available}; Rueckfall: ${b.fallback && b.fallback.active ? b.fallback.reasons.join(' | ') : 'nein'})`);
    if (!c.fields) { console.log('  keine Felder: ' + c.fieldsUnavailableReason); continue; }
    console.log('Feld | Art | Wert[0] | Periode | Komponenten | Tag | fehlende Metadaten');
    for (const [k, f] of Object.entries(c.fields)) {
      if (f.value == null && f.status !== 'TTM-Groesse der Engine') continue;
      const comp = f.components ? (f.components.quarters ? (Array.isArray(f.components.quarters) ? f.components.quarters.map(q => typeof q === 'string' ? q : q.end).join(',') : '') : (f.components.asOf || f.components.end || '')) : '';
      console.log(`${k} | ${f.concept} | ${fmt(f.value)} | ${f.period.end || '—'} | ${comp || '—'} | ${(f.provenance && f.provenance.tag) || '—'} | ${f.metadataMissing.join(',') || '—'}`);
    }
    console.log('Modell | base | verfuegbar | Grund');
    for (const [k, m] of Object.entries(c.models || {})) console.log(`${k} | ${m.base ?? '—'} | ${m.available ?? '—'} | ${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([x]) => /reason|block|unavail/i.test(x)))).slice(0, 200)}`);
  }
  if (report.checks) {
    const bad = report.checks.filter(x => !x.ok);
    console.log(`\nAbgleich Anzeige ↔ Engine: ${report.checks.length - bad.length}/${report.checks.length} bestanden`);
    for (const x of bad) console.log(`  ABWEICHUNG [${x.capture}] ${x.name}${x.detail ? ' — ' + x.detail : ''}`);
  }
  console.log('\nBericht: ' + out + (rejected.length ? ' · abgewiesene Anfragen: ' + rejected.length : '') + (exceptions.length ? ' · Ausnahmen: ' + exceptions.length : ''));
  process.exit(exit);
}

// Nur als Programm starten; beim Import (Regressionstests von checkPanels)
// laeuft nichts.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error('NICHT AUSGEFUEHRT: ' + (e && e.stack || e)); process.exit(2); });
}
