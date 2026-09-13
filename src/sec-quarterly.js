'use strict';
/**
 * src/sec-quarterly.js — Normalisierung von SEC-Quartalsdaten als Node-Modul
 * ═══════════════════════════════════════════════════════════════════════════
 * Die Logik selbst steht seit V1.0.56 im SEC-QUARTALS-BLOCK der
 * ausgelieferten HTML-Datei — derselben einzigen Quelle wie DCF-CORE-BLOCK und
 * DATENBASIS-BLOCK. Dieses Modul schneidet den Block aus und stellt ihn
 * unveraendert als gewoehnliches Modul bereit.
 *
 * Grund fuer den Umzug: der produktive SEC-Abruf laeuft im Browser. Nur wenn
 * Normalisierung und TTM-Rechnung dort verfuegbar sind, kann die Anwendung
 * `fundamentals._ttm` selbst erzeugen. Eine zweite, unabhaengig gepflegte
 * Browserkopie waere die Alternative gewesen — genau das Problem, das die
 * Blockextraktion vermeidet. Kein Build-Schritt, keine Laufzeit-Abhaengigkeiten.
 *
 * Die oeffentliche Schnittstelle ist unveraendert (normalizeSecQuarters,
 * appTagMap, die Hilfsfunktionen und die Konstanten).
 */

const path = require('node:path');
const vm = require('node:vm');
const core = require('./dcf-core.js');

const APP_FILE = path.join(
  __dirname, '..', 'us-aktienbewertungstool-v1036-sector-classification-patch.html'
);

const BLOCK_START = 'SEC-QUARTALS-BLOCK START';
const BLOCK_END   = 'SEC-QUARTALS-BLOCK ENDE';

/** Den markierten Block ausschneiden (Zeilennummern 1-basiert). */
function extractQuarterlyBlock(appFile) {
  const lines = core.readAppScript(appFile || APP_FILE).split('\n');
  const start = lines.findIndex(l => l.includes(BLOCK_START));
  const end   = lines.findIndex(l => l.includes(BLOCK_END));
  if (start < 0) throw new Error('Blockmarke "' + BLOCK_START + '" nicht gefunden.');
  if (end < 0)   throw new Error('Blockmarke "' + BLOCK_END + '" nicht gefunden.');
  if (end <= start) throw new Error('Blockmarken stehen in falscher Reihenfolge.');
  return { source: lines.slice(start, end + 1).join('\n'), startLine: start + 1, endLine: end + 1 };
}

/**
 * Die vom Block ausdruecklich deklarierte Helferliste auslesen. Sie steht im
 * Block selbst, damit Modul und Anwendung nicht auseinanderlaufen koennen.
 */
function requiredHelperNames(blockSource) {
  const m = blockSource.match(
    /const\s+SEC_QUARTERLY_REQUIRED_HELPERS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('SEC_QUARTERLY_REQUIRED_HELPERS im Block nicht gefunden.');
  return m[1].split('\n').map(l => (l.match(/'([^']+)'/) || [])[1]).filter(Boolean);
}

const EXPORTED_NAMES = [
  'SEC_QUARTERLY_FIELDS', 'APP_TAG_FIELD', 'ACCEPTED_FORMS', 'PERIOD_WINDOWS',
  'SEC_QUARTERLY_REQUIRED_HELPERS',
  'parseIsoDate', 'isoOf', 'inclusiveDays', 'classifyPeriodDuration',
  'fiscalYearOf', 'fiscalPeriodOf', 'detectFiscalYearEnd',
  'classifyFlowFact', 'checkCumulativeDerivation', 'selectByRestatementRule',
  'appTagMap', 'normalizeSecQuarters'
];

/**
 * Block samt der deklarierten Helfer (SEC_TAG_MAP) auswerten.
 * options.appFile  abweichender Pfad zur Anwendung (fuer Tests)
 * options.realm    'this' (Vorgabe) — im Realm des Aufrufers, damit
 *                  Arrays/Objekte deepStrictEqual-kompatibel sind;
 *                  'isolated' — eigener vm-Kontext.
 */
function loadQuarterlyBlock(options) {
  const opts = options || {};
  const block = extractQuarterlyBlock(opts.appFile);
  const appLines = core.readAppScript(opts.appFile).split('\n');
  const helpers = requiredHelperNames(block.source);
  const helperSrc = helpers.map(n => core.grabDeclaration(appLines, n)).join('\n\n');

  const factory =
    '(function(){\n"use strict";\n' +
    '/* --- deklarierte Helfer aus der Datenschicht --- */\n' + helperSrc + '\n' +
    '/* --- SEC-QUARTALS-BLOCK --- */\n' + block.source + '\n' +
    '; return {' + EXPORTED_NAMES.join(', ') + '};})';

  let api;
  if (opts.realm === 'isolated') {
    const sandbox = Object.create(null);
    vm.createContext(sandbox);
    api = vm.runInContext(factory, sandbox, { filename: 'sec-quartals-block.js' })();
  } else {
    api = vm.runInThisContext(factory, { filename: 'sec-quartals-block.js' })();
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

// Standardinstanz: die ausgelieferte Anwendung. Ein abweichender Pfad ist
// ueber loadQuarterlyBlock({ appFile }) moeglich.
const _default = loadQuarterlyBlock({});

module.exports = Object.assign({}, _default, {
  APP_FILE,
  BLOCK_START,
  BLOCK_END,
  EXPORTED_NAMES,
  extractQuarterlyBlock,
  requiredHelperNames,
  loadQuarterlyBlock
});
