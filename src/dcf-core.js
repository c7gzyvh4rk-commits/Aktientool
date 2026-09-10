/**
 * src/dcf-core.js — Bewertungskern als Node-Modul
 * ═══════════════════════════════════════════════════════════════════════════
 * Lädt den klar abgegrenzten DCF-CORE-BLOCK aus der ausgelieferten
 * HTML-Datei und stellt ihn als gewöhnliches Modul bereit. Damit ist der
 * Rechenkern (DCF, Reverse-DCF-Solver, Sensitivitätsmatrix) ohne Browser
 * testbar, während die Anwendung weiterhin als alleinstehende HTML-Datei
 * startet.
 *
 * Bewusst KEINE Kopie der Logik: die HTML-Datei bleibt die einzige Quelle.
 * Eine zweite Fassung desselben Codes würde auseinanderlaufen — genau das
 * Problem, das dieser Kern beheben soll. Dieselbe Entscheidung liegt
 * `tests/extract-functions.mjs` zugrunde.
 *
 * Kein Build-Schritt, keine Laufzeit-Abhängigkeiten.
 *
 * Öffentliche Schnittstelle
 * ─────────────────────────
 *   normalizeDcfCoreInput(masterJson, options) → { ok, input, diagnostics }
 *       Grenze: Master-JSON hinein, vollständiges flaches Inputobjekt heraus.
 *       Stellt Einheiten fest, meldet Einheitenverdacht und weist die
 *       bislang stillen Ersatzwerte als appliedDefaults aus.
 *
 *   runDcfCoreAnalysis(input, which) → { ok, valuation, reverseDcf,
 *                                        sensitivity, diagnostics }
 *       Kern: rechnet ausschliesslich aus `input`. Keine DOM-Zugriffe,
 *       kein localStorage, keine globalen Zustandsänderungen.
 *
 *   analyzeDcfFromMasterJson(masterJson, options, which)
 *       Dünne Zusammensetzung beider Schritte.
 *
 * Einheiten (siehe DCF_CORE_UNITS)
 * ────────────────────────────────
 *   Geldbeträge   Millionen USD · Werte je Aktie USD/Aktie
 *   Aktienzahlen  Millionen Stück
 *   Zinssätze,    Prozentpunkte (wacc = 10 → 10 %)
 *   Wachstum,
 *   Margen
 *   Abgeleitete   Brüche (owcRatio 0,05 → 5 % vom Umsatz)
 *   Quoten
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_FILE = path.join(
  __dirname, '..', 'us-aktienbewertungstool-v1036-sector-classification-patch.html'
);

const BLOCK_START = 'DCF-CORE-BLOCK START';
const BLOCK_END   = 'DCF-CORE-BLOCK ENDE';

/** Rohen <script>-Inhalt der Anwendung lesen. */
function readAppScript(appFile) {
  const html = fs.readFileSync(appFile || APP_FILE, 'utf8');
  const i = html.indexOf('<script>');
  const j = html.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('Kein <script>-Block in der Anwendung gefunden.');
  return html.slice(i + '<script>'.length, j);
}

/**
 * Den markierten Kernblock ausschneiden.
 * Rückgabe: { source, startLine, endLine } — Zeilennummern 1-basiert,
 * bezogen auf den <script>-Inhalt.
 */
function extractCoreBlock(appFile) {
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
 * Eine Top-Level-Deklaration aus dem Anwendungsskript ziehen.
 * Deklarationen beginnen in dieser Datei stets in Spalte 0 und enden mit
 * einer Zeile, die nur aus "}" bzw. "};" besteht.
 */
function grabDeclaration(lines, name) {
  const starts = [
    'function ' + name + '(',
    'const ' + name + ' = ',
    'const ' + name + '='
  ];
  for (let i = 0; i < lines.length; i++) {
    if (!starts.some(s => lines[i].startsWith(s))) continue;
    for (let k = i; k < lines.length; k++) {
      if (k > i && (lines[k] === '}' || lines[k] === '};')) {
        return lines.slice(i, k + 1).join('\n');
      }
    }
  }
  throw new Error('Deklaration nicht gefunden: ' + name);
}

/**
 * Die vom Kernblock ausdrücklich deklarierte Helferliste auslesen
 * (DCF_CORE_REQUIRED_HELPERS). Sie steht im Block selbst, damit Modul und
 * Anwendung nicht auseinanderlaufen können.
 */
function requiredHelperNames(blockSource) {
  const m = blockSource.match(
    /const\s+DCF_CORE_REQUIRED_HELPERS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('DCF_CORE_REQUIRED_HELPERS im Kernblock nicht gefunden.');
  return m[1].split('\n')
    .map(l => (l.match(/'([^']+)'/) || [])[1])
    .filter(Boolean);
}

/** Namen, die das Modul nach aussen gibt. */
const EXPORTED_NAMES = [
  // Schnittstelle
  'normalizeDcfCoreInput',
  'runDcfCoreAnalysis',
  'analyzeDcfFromMasterJson',
  // Bausteine (für gezielte Tests und bestehende dünne Adapter)
  'buildForecastInputs',
  'forecastDcfCore',
  'buildCoreValuationContext',
  'coreValuationDetail',
  'coreEquityValuePerShare',
  'solveReverseDcfGrowth',
  'computeSensitivityMatrix',
  // Konstanten
  'DCF_CORE_UNITS',
  'DCF_CORE_MODEL_VERSION',
  'DCF_CORE_DEFINITION_LABEL',
  'DCF_CORE_REQUIRED_HELPERS',
  'REVERSE_DCF_SEARCH',
  'REVERSE_DCF_HELD_CONSTANT'
];

/**
 * Kernblock samt deklarierten Helfern in einem eigenen Kontext auswerten.
 *
 * `sandbox` ist absichtlich LEER bis auf die JavaScript-Standardobjekte:
 * kein `document`, kein `localStorage`, kein `window`, kein `state`. Greift
 * der Kern doch auf so etwas zu, schlägt das hier sofort fehl statt still
 * ein falsches Ergebnis zu liefern.
 *
 * options.appFile  abweichender Pfad zur Anwendung (für Tests)
 * options.realm    'this'  — im Realm des Aufrufers auswerten, damit
 *                            Arrays/Objekte deepStrictEqual-kompatibel sind
 *                  'isolated' (Vorgabe) — eigener vm-Kontext
 */
function loadDcfCore(options) {
  const opts = options || {};
  const block = extractCoreBlock(opts.appFile);
  const appLines = readAppScript(opts.appFile).split('\n');
  const helpers = requiredHelperNames(block.source);
  const helperSrc = helpers.map(n => grabDeclaration(appLines, n)).join('\n\n');

  const factory =
    '(function(){\n"use strict";\n' +
    '/* --- deklarierte Helfer aus der Datenschicht --- */\n' + helperSrc + '\n' +
    '/* --- DCF-CORE-BLOCK --- */\n' + block.source + '\n' +
    '; return {' + EXPORTED_NAMES.join(', ') + '};})';

  let api;
  if (opts.realm === 'this') {
    api = vm.runInThisContext(factory, { filename: 'dcf-core-block.js' })();
  } else {
    const sandbox = Object.create(null);
    vm.createContext(sandbox);
    api = vm.runInContext(factory, sandbox, { filename: 'dcf-core-block.js' })();
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

module.exports = {
  APP_FILE,
  BLOCK_START,
  BLOCK_END,
  readAppScript,
  extractCoreBlock,
  grabDeclaration,
  requiredHelperNames,
  loadDcfCore,
  EXPORTED_NAMES
};
