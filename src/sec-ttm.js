'use strict';
/**
 * src/sec-ttm.js — TTM-Datenbasis als Node-Modul
 * ═══════════════════════════════════════════════════════════════════════════
 * Laedt den DATENBASIS-BLOCK aus der ausgelieferten HTML-Datei und stellt ihn
 * als gewoehnliches Modul bereit. Damit ist die TTM-Rechnung ohne Browser
 * pruefbar, waehrend die Anwendung weiterhin als alleinstehende HTML-Datei
 * startet und DENSELBEN Code verwendet.
 *
 * Bewusst KEINE Kopie der Logik — dieselbe Entscheidung wie in
 * src/dcf-core.js und tests/extract-functions.mjs.
 *
 * Zusaetzlich (Erzeugerseite, nur hier — der Block selbst bleibt rein):
 *   quarterlyPayloadFromFacts(facts, options)
 *       SEC-companyfacts → normalisierte Quartalsdaten (src/sec-quarterly.js)
 *       zuzueglich des gesondert erhobenen Aktien-Teils.
 *   datasetFromFacts(facts, options)
 *       Dieselbe Eingabe → fertige TTM-Datenbasis (fundamentals._ttm).
 *
 * Kein Build-Schritt, keine Laufzeit-Abhaengigkeiten.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const secQuarterly = require('./sec-quarterly.js');

const APP_FILE = path.join(
  __dirname, '..', 'us-aktienbewertungstool-v1036-sector-classification-patch.html'
);

const BLOCK_START = 'DATENBASIS-BLOCK START';
const BLOCK_END   = 'DATENBASIS-BLOCK ENDE';

/** Rohen <script>-Inhalt der Anwendung lesen. */
function readAppScript(appFile) {
  const html = fs.readFileSync(appFile || APP_FILE, 'utf8');
  const i = html.indexOf('<script>');
  const j = html.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('Kein <script>-Block in der Anwendung gefunden.');
  return html.slice(i + '<script>'.length, j);
}

/** Den markierten Block ausschneiden (Zeilennummern 1-basiert). */
function extractBasisBlock(appFile) {
  const lines = readAppScript(appFile).split('\n');
  const start = lines.findIndex(l => l.includes(BLOCK_START));
  const end   = lines.findIndex(l => l.includes(BLOCK_END));
  if (start < 0) throw new Error('Blockmarke "' + BLOCK_START + '" nicht gefunden.');
  if (end < 0)   throw new Error('Blockmarke "' + BLOCK_END + '" nicht gefunden.');
  if (end <= start) throw new Error('Blockmarken stehen in falscher Reihenfolge.');
  return {
    source: lines.slice(start, end + 1).join('\n'),
    startLine: start + 1,
    endLine: end + 1
  };
}

/**
 * Die vom Block ausdruecklich deklarierte Helferliste auslesen. Sie steht im
 * Block selbst, damit Modul und Anwendung nicht auseinanderlaufen koennen.
 * Der Block kommt ohne Helfer aus — die leere Liste wird hier trotzdem
 * ausgewertet, damit eine spaetere Erweiterung nicht unbemerkt bleibt.
 */
function requiredHelperNames(blockSource) {
  const m = blockSource.match(
    /const\s+DATA_BASIS_REQUIRED_HELPERS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('DATA_BASIS_REQUIRED_HELPERS im Block nicht gefunden.');
  return m[1].split('\n')
    .map(l => (l.match(/'([^']+)'/) || [])[1])
    .filter(Boolean);
}

/** Namen, die das Modul nach aussen gibt. */
const EXPORTED_NAMES = [
  // Konstanten
  'DATA_BASIS_BLOCK_VERSION', 'DATA_BASIS_OPTIONS', 'DATA_BASIS_LABELS',
  'DATA_BASIS_REQUIRED_HELPERS',
  'TTM_FLOW_FIELDS', 'TTM_INSTANT_FIELDS', 'TTM_MIN_WINDOWS', 'TTM_MAX_WINDOWS',
  'TTM_MODEL_REQUIRED_FIELDS',
  // Rechenwege
  'ttmUsableQuarters', 'computeTtmFromQuarters', 'computeTtmFromFyYtdBridge',
  'ttmWindowEndsFrom', 'buildTtmFlowSeries',
  'selectBalanceAsOf', 'buildTtmInstantSeries',
  'buildTtmShareBasis', 'buildTtmEpsSeries', 'buildTtmDataset',
  // Datenbasis
  'resolveDataBasis', 'buildValuationBasisView', 'buildDataBasisReport'
];

/**
 * Block in einem eigenen Kontext auswerten. Die Sandbox ist absichtlich LEER
 * bis auf die JavaScript-Standardobjekte: kein document, kein localStorage,
 * kein window, kein state.
 *
 * options.appFile  abweichender Pfad zur Anwendung (fuer Tests)
 * options.realm    'this' — im Realm des Aufrufers (deepStrictEqual-faehig)
 *                  'isolated' (Vorgabe) — eigener vm-Kontext
 */
function loadDataBasisBlock(options) {
  const opts = options || {};
  const block = extractBasisBlock(opts.appFile);
  const helpers = requiredHelperNames(block.source);
  if (helpers.length > 0) {
    // Der Block soll ohne Datenschicht auskommen. Wird das spaeter geaendert,
    // faellt es hier auf, statt still einen ReferenceError zu erzeugen.
    throw new Error('DATA_BASIS_REQUIRED_HELPERS ist nicht leer: ' + helpers.join(', ')
      + ' — Helferaufloesung ist in diesem Modul nicht vorgesehen.');
  }
  const factory =
    '(function(){\n"use strict";\n' + block.source + '\n' +
    '; return {' + EXPORTED_NAMES.join(', ') + '};})';

  let api;
  if (opts.realm === 'this') {
    api = vm.runInThisContext(factory, { filename: 'datenbasis-block.js' })();
  } else {
    const sandbox = Object.create(null);
    vm.createContext(sandbox);
    api = vm.runInContext(factory, sandbox, { filename: 'datenbasis-block.js' })();
  }
  api._meta = {
    appFile: opts.appFile || APP_FILE,
    blockStartLine: block.startLine,
    blockEndLine: block.endLine,
    blockSource: block.source,
    helperNames: helpers
  };
  return api;
}

// ═════════════════════════════════════════════════════════════════════════════
// Erzeugerseite: aus SEC-companyfacts die Eingabe des Blocks herstellen
// ═════════════════════════════════════════════════════════════════════════════
// Aktienzahlen stehen bewusst NICHT im Umfang der Quartalsnormalisierung
// (src/sec-quarterly.js): sie sind Durchschnittsgroessen und werden nie
// summiert oder differenziert. Sie werden deshalb hier gesondert erhoben —
// je Quartal der gemeldete gewichtete Durchschnitt, ohne Ableitung aus
// kumulierten Angaben.
const SHARE_TAGS_DILUTED = Object.freeze([
  'WeightedAverageNumberOfDilutedSharesOutstanding',
  'WeightedAverageNumberOfDilutedSharesOutstandingBasicAndDiluted'
]);
const EPS_TAGS_DILUTED = Object.freeze([
  'EarningsPerShareDiluted',
  'EarningsPerShareBasicAndDiluted'
]);
const CURRENT_SHARES_TAGS = Object.freeze(['EntityCommonStockSharesOutstanding']);
const ACCEPTED_FORMS = secQuarterly.ACCEPTED_FORMS;

function _factsOf(facts, namespace, tag) {
  const ns = facts && facts[namespace];
  const concept = ns && ns[tag];
  const units = concept && concept.units;
  if (!units) return [];
  const key = Object.keys(units)[0];
  return Array.isArray(units[key]) ? units[key] : [];
}

/** Gewichtete Quartalsaktienzahlen (genau ein Quartal lang, keine Ableitung). */
function collectWeightedShareQuarters(facts, options) {
  const o = options || {};
  const asOf = o.asOfDate ? secQuarterly.parseIsoDate(o.asOfDate) : null;
  const tags = o.shareTags || SHARE_TAGS_DILUTED;
  const out = new Map();   // Ende → Angabe (spaeter veroeffentlichte gewinnt)
  for (const tag of tags) {
    for (const f of _factsOf(facts, 'us-gaap', tag)) {
      if (!f || ACCEPTED_FORMS.indexOf(f.form) < 0) continue;
      const s = secQuarterly.parseIsoDate(f.start), e = secQuarterly.parseIsoDate(f.end);
      if (s == null || e == null) continue;
      if (typeof f.val !== 'number' || !isFinite(f.val)) continue;
      const filedMs = f.filed ? secQuarterly.parseIsoDate(f.filed) : null;
      if (asOf != null && (filedMs == null || filedMs > asOf)) continue;
      const cls = secQuarterly.classifyPeriodDuration(secQuarterly.inclusiveDays(s, e));
      if (!cls || cls.type !== 'quarter') continue;
      const end = secQuarterly.isoOf(e);
      const prev = out.get(end);
      if (prev && prev.filed != null && f.filed != null && prev.filed >= f.filed) continue;
      out.set(end, { end, start: secQuarterly.isoOf(s), value: f.val,
                     filed: f.filed || null, form: f.form, tag,
                     source: { form: f.form, accn: f.accn || null, filed: f.filed || null, tag } });
    }
    if (out.size > 0) break;   // eine Tag-Kette je Groesse, kein Bridging
  }
  return [...out.values()].sort((a, b) => b.end.localeCompare(a.end));
}

/** Gemeldete Quartals-EPS, ausschliesslich als Gegenprobe. */
function collectQuarterlyEps(facts, options) {
  const o = options || {};
  const asOf = o.asOfDate ? secQuarterly.parseIsoDate(o.asOfDate) : null;
  const tags = o.epsTags || EPS_TAGS_DILUTED;
  const out = {};
  for (const tag of tags) {
    let found = false;
    for (const f of _factsOf(facts, 'us-gaap', tag)) {
      if (!f || ACCEPTED_FORMS.indexOf(f.form) < 0) continue;
      const s = secQuarterly.parseIsoDate(f.start), e = secQuarterly.parseIsoDate(f.end);
      if (s == null || e == null) continue;
      if (typeof f.val !== 'number' || !isFinite(f.val)) continue;
      const filedMs = f.filed ? secQuarterly.parseIsoDate(f.filed) : null;
      if (asOf != null && (filedMs == null || filedMs > asOf)) continue;
      const cls = secQuarterly.classifyPeriodDuration(secQuarterly.inclusiveDays(s, e));
      if (!cls || cls.type !== 'quarter') continue;
      out[secQuarterly.isoOf(e)] = f.val;
      found = true;
    }
    if (found) break;
  }
  return out;
}

/** Aktuelle Aktienzahl am Stichtag (Bewertungsbasis, kein Durchschnitt). */
function collectCurrentShares(facts, options) {
  const o = options || {};
  const asOf = o.asOfDate ? secQuarterly.parseIsoDate(o.asOfDate) : null;
  let best = null;
  for (const tag of (o.currentSharesTags || CURRENT_SHARES_TAGS)) {
    for (const f of _factsOf(facts, 'dei', tag)) {
      if (!f || typeof f.val !== 'number' || !isFinite(f.val)) continue;
      const e = secQuarterly.parseIsoDate(f.end);
      if (e == null) continue;
      const filedMs = f.filed ? secQuarterly.parseIsoDate(f.filed) : null;
      if (asOf != null && (filedMs == null || filedMs > asOf)) continue;
      if (best == null || f.end > best.as_of) {
        best = { value: f.val, as_of: f.end,
                 source: { form: f.form || null, accn: f.accn || null, filed: f.filed || null, tag } };
      }
    }
    if (best) break;
  }
  return best || { value: null, as_of: null, source: null };
}

/**
 * SEC-companyfacts → Eingabe des DATENBASIS-BLOCKS.
 * options wird unveraendert an normalizeSecQuarters durchgereicht
 * (asOfDate, tags, appFile, fields).
 */
function quarterlyPayloadFromFacts(facts, options) {
  const o = options || {};
  const normalized = secQuarterly.normalizeSecQuarters(facts, o);
  const payload = Object.assign({}, normalized);
  payload.shares = {
    weighted_diluted_quarters: collectWeightedShareQuarters(facts, o),
    eps_diluted_quarters: collectQuarterlyEps(facts, o),
    current: collectCurrentShares(facts, o),
    unit: o.shareUnit || 'Stueck (wie gemeldet)'
  };
  return payload;
}

/** SEC-companyfacts → fertige TTM-Datenbasis (fundamentals._ttm). */
function datasetFromFacts(facts, options) {
  const api = loadDataBasisBlock(options);
  return api.buildTtmDataset(quarterlyPayloadFromFacts(facts, options), options);
}

module.exports = {
  APP_FILE,
  BLOCK_START,
  BLOCK_END,
  EXPORTED_NAMES,
  readAppScript,
  extractBasisBlock,
  requiredHelperNames,
  loadDataBasisBlock,
  SHARE_TAGS_DILUTED,
  EPS_TAGS_DILUTED,
  CURRENT_SHARES_TAGS,
  collectWeightedShareQuarters,
  collectQuarterlyEps,
  collectCurrentShares,
  quarterlyPayloadFromFacts,
  datasetFromFacts
};
