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
const dcfCore = require('./dcf-core.js');

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

/** Die vom Block ausdruecklich benoetigten WEITEREN Bloecke (V1.0.56). */
function requiredBlockNames(blockSource) {
  const m = blockSource.match(
    /const\s+DATA_BASIS_REQUIRED_BLOCKS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!m) return [];
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
  'DATA_BASIS_REQUIRED_BLOCKS',
  // Erzeugerseite (SEC-companyfacts → fundamentals._ttm)
  'collectWeightedShareQuarters', 'collectQuarterlyEps', 'collectCurrentShares',
  'quarterlyPayloadFromFacts', 'convertQuarterlyPayloadUnits', 'buildTtmDatasetFromFacts',
  'TTM_UNIT_DIVISORS', 'TTM_SHARE_DIVISOR',
  // Rechenwege
  'ttmUsableQuarters', 'computeTtmFromQuarters', 'computeTtmFromFyYtdBridge',
  'ttmWindowEndsFrom', 'buildTtmFlowSeries',
  'selectBalanceAsOf', 'buildTtmInstantSeries',
  'buildTtmShareBasis', 'buildTtmEpsSeries', 'buildTtmDataset',
  // Datenbasis
  'resolveDataBasis', 'buildValuationBasisView', 'resolveValuationView', 'buildDataBasisReport'
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
  const appLinesForHelpers = dcfCore.readAppScript(opts.appFile).split('\n');
  const helperSrc = helpers.map(n => dcfCore.grabDeclaration(appLinesForHelpers, n)).join('\n\n');
  // Benoetigte weitere Bloecke (derzeit der Quartalsnormalisierer) samt deren
  // eigenen Helfern voranstellen — wieder als Auszug, nicht als Kopie.
  const blockNames = requiredBlockNames(block.source);
  let vorspann = '';
  for (const name of blockNames) {
    if (name === 'SEC-QUARTALS-BLOCK') {
      const q = secQuarterly.extractQuarterlyBlock(opts.appFile);
      const appLines = dcfCore.readAppScript(opts.appFile).split('\n');
      const qHelpers = secQuarterly.requiredHelperNames(q.source);
      vorspann += qHelpers.map(n => dcfCore.grabDeclaration(appLines, n)).join('\n\n')
        + '\n' + q.source + '\n';
    } else {
      throw new Error('Unbekannter benoetigter Block: ' + name);
    }
  }

  const factory =
    '(function(){\n"use strict";\n' + vorspann +
    '/* --- deklarierte Helfer aus der Datenschicht --- */\n' + helperSrc + '\n' +
    block.source + '\n' +
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
    helperNames: helpers,
    helperSource: helperSrc
  };
  return api;
}

// ═════════════════════════════════════════════════════════════════════════════
// Erzeugerseite: aus SEC-companyfacts die TTM-Datenbasis herstellen
// ═════════════════════════════════════════════════════════════════════════════
// Seit V1.0.56 steht dieser Weg vollstaendig im DATENBASIS-BLOCK der
// Anwendung (quarterlyPayloadFromFacts, convertQuarterlyPayloadUnits,
// buildTtmDatasetFromFacts) — damit der produktive SEC-Abruf im Browser
// dieselbe Logik verwendet. Hier bleiben nur duenne Weiterleitungen, damit
// die bisherige Modulschnittstelle erhalten bleibt. KEINE zweite Fassung.
let _defaultApi = null;
function _api(options) {
  if (options && options.appFile) return loadDataBasisBlock(options);
  if (!_defaultApi) _defaultApi = loadDataBasisBlock({ realm: 'this' });
  return _defaultApi;
}

const collectWeightedShareQuarters = (facts, options) => _api(options).collectWeightedShareQuarters(facts, options);
const collectQuarterlyEps          = (facts, options) => _api(options).collectQuarterlyEps(facts, options);
const collectCurrentShares         = (facts, options) => _api(options).collectCurrentShares(facts, options);
const quarterlyPayloadFromFacts    = (facts, options) => _api(options).quarterlyPayloadFromFacts(facts, options);
const convertQuarterlyPayloadUnits = (payload, options) => _api(options).convertQuarterlyPayloadUnits(payload, options);

/** SEC-companyfacts → fertige TTM-Datenbasis (fundamentals._ttm). */
function datasetFromFacts(facts, options) {
  return _api(options).buildTtmDatasetFromFacts(facts, options);
}

module.exports = {
  APP_FILE,
  BLOCK_START,
  BLOCK_END,
  EXPORTED_NAMES,
  readAppScript,
  extractBasisBlock,
  requiredHelperNames,
  requiredBlockNames,
  loadDataBasisBlock,
  collectWeightedShareQuarters,
  collectQuarterlyEps,
  collectCurrentShares,
  quarterlyPayloadFromFacts,
  convertQuarterlyPayloadUnits,
  datasetFromFacts
};
