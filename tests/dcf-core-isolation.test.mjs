// Sichert die Entkopplung des Bewertungskerns dauerhaft ab:
// der markierte DCF-CORE-BLOCK darf weder DOM noch localStorage noch den
// globalen `state` berühren und muss in einer LEEREN Sandbox laufen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const mod = require(join(HERE, '..', 'src', 'dcf-core.js'));

const block = mod.extractCoreBlock();
const appScript = mod.readAppScript();
const appLines = appScript.split('\n');

// Kommentare entfernen — die Prosa im Block erwähnt DOM und localStorage
// absichtlich, geprüft wird der ausführbare Code.
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(l => {
      const i = l.indexOf('//');
      if (i < 0) return l;
      // Nur echte Zeilenkommentare kappen, keine Vorkommen in Zeichenketten.
      const vor = l.slice(0, i);
      const apo = (vor.match(/'/g) || []).length;
      const anf = (vor.match(/"/g) || []).length;
      const bt  = (vor.match(/`/g) || []).length;
      return (apo % 2 || anf % 2 || bt % 2) ? l : vor;
    })
    .join('\n');
}

const VERBOTEN = [
  ['document.',    /\bdocument\s*\./],
  ['localStorage', /\blocalStorage\b/],
  ['window.',      /\bwindow\s*\./],
  ['state.',       /\bstate\s*\./],
  ['alert(',       /\balert\s*\(/],
  ['confirm(',     /\bconfirm\s*\(/],
  ['fetch(',       /\bfetch\s*\(/],
  ['getElementById', /\bgetElementById\b/],
  ['innerHTML',    /\binnerHTML\b/],
  ['Date.now(',    /\bDate\s*\.\s*now\s*\(/],
  ['new Date(',    /\bnew\s+Date\s*\(/],
  ['Math.random(', /\bMath\s*\.\s*random\s*\(/]
];

test('Blockmarken vorhanden und in der richtigen Reihenfolge', () => {
  assert.ok(block.startLine > 0);
  assert.ok(block.endLine > block.startLine);
  assert.ok(block.source.includes(mod.BLOCK_START));
  assert.ok(block.source.includes(mod.BLOCK_END));
  // Genau ein Blockpaar in der Anwendung.
  assert.equal(appScript.split(mod.BLOCK_START).length - 1, 1);
  assert.equal(appScript.split(mod.BLOCK_END).length - 1, 1);
});

test('Kernblock enthält keine Oberflächen-, Speicher- oder Zustandszugriffe', () => {
  const code = codeOnly(block.source);
  for (const [name, re] of VERBOTEN) {
    assert.equal(re.test(code), false, `Kernblock verwendet "${name}"`);
  }
});

test('die deklarierten Helfer sind selbst frei von Oberfläche und Zustand', () => {
  const namen = mod.requiredHelperNames(block.source);
  assert.ok(namen.length > 0);
  for (const n of namen) {
    const code = codeOnly(mod.grabDeclaration(appLines, n));
    for (const [label, re] of VERBOTEN) {
      // Zeitabhängigkeit ist nur im Kern selbst verboten; die Datenschicht
      // darf Datumsangaben verarbeiten (Periodenlogik).
      if (label === 'new Date(' || label === 'Date.now(') continue;
      assert.equal(re.test(code), false, `Helfer ${n} verwendet "${label}"`);
    }
  }
});

test('Kernblock läuft in einer leeren Sandbox (kein document, kein window)', () => {
  // loadDcfCore() ohne realm:'this' wertet in einem vm-Kontext ohne jede
  // Browser-Attrappe aus. Ein verdeckter Zugriff schlägt hier sofort fehl.
  const api = mod.loadDcfCore();
  assert.equal(typeof api.runDcfCoreAnalysis, 'function');
  assert.equal(typeof api.normalizeDcfCoreInput, 'function');
  const mj = {
    schema_version: '4.0',
    meta: { ticker: 'ISO', sub_classification: 'standard_nonfin' },
    fundamentals: { revenue: [1000, 900, 800, 700], ebit: [200, 180, 160, 140],
                    ebitda: [250, 225, 200, 175], capex: [50, 45, 40, 35],
                    shares_diluted: [100, 100, 100, 100],
                    total_debt: [200, 200, 200, 200], cash_and_equivalents: [100, 100, 100, 100] },
    valuation: { growth_stage1: 8, growth_terminal: 2, wacc_derived: 10,
                 wacc_components: { tax_rate: 25 }, fade: { enabled: false } },
    market: { price: 20 }
  };
  const r = api.analyzeDcfFromMasterJson(mj, {});
  assert.equal(r.ok, true);
  assert.ok(Number.isFinite(r.valuation.equityValuePerShare));
  assert.equal(r.sensitivity.available, true);
});

test('die Helferliste ist vollständig — nichts Weiteres wird benötigt', () => {
  // Wäre ein Bezeichner nicht abgedeckt, würfe die Auswertung in der leeren
  // Sandbox eine ReferenceError beim ersten Aufruf. Zusätzlich wird geprüft,
  // dass die Liste keine unbenutzten Einträge mitschleppt.
  const namen = mod.requiredHelperNames(block.source);
  const blockCode = codeOnly(block.source);
  for (const n of namen) {
    const genutzt = new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b');
    const anderswo = namen.filter(x => x !== n)
      .some(x => genutzt.test(codeOnly(mod.grabDeclaration(appLines, x))));
    assert.ok(genutzt.test(blockCode) || anderswo,
      `Helfer ${n} steht in der Liste, wird aber nirgends verwendet`);
  }
});

test('der überholte doppelte Rechenpfad dcfCore() ist entfernt', () => {
  assert.equal(/\bfunction\s+dcfCore\s*\(/.test(appScript), false);
  assert.equal(/\bdcfCore\s*\(/.test(codeOnly(appScript)), false);
});

test('die Anwendung startet weiterhin alleinstehend (Kernblock inline)', () => {
  // Der Block liegt im ausgelieferten <script> der HTML-Datei, nicht in einem
  // externen Modul — sonst wäre der Datei-Start ohne Server nicht möglich.
  assert.ok(appScript.includes('function runDcfCoreAnalysis('));
  assert.ok(appScript.includes('function normalizeDcfCoreInput('));
  assert.ok(appScript.includes('const DCF_CORE_UNITS'));
});
