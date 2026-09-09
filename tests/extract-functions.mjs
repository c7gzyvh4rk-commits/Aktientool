// Testhilfe: zieht einzelne Top-Level-Deklarationen aus der Single-File-App
// heraus, damit sie in Node (node:test) ohne DOM ausgeführt werden können.
// Es wird bewusst der ausgelieferte Quelltext geladen — keine Kopie der Logik.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP_FILE = join(HERE, '..', 'us-aktienbewertungstool-v1036-sector-classification-patch.html');

function scriptSource() {
  const html = readFileSync(APP_FILE, 'utf8');
  const i = html.indexOf('<script>');
  const j = html.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('Kein <script>-Block gefunden');
  return html.slice(i + '<script>'.length, j);
}

// Top-Level-Deklarationen beginnen in dieser Datei immer in Spalte 0 und enden
// mit einer Zeile, die nur aus "}" bzw. "};" besteht.
function grabDeclaration(lines, name) {
  const starts = [
    `function ${name}(`,
    `const ${name} = `,
    `const ${name}=`,
    `async function ${name}(`
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!starts.some(s => line.startsWith(s))) continue;
    for (let k = i; k < lines.length; k++) {
      if (k > i && (lines[k] === '}' || lines[k] === '};')) {
        return lines.slice(i, k + 1).join('\n');
      }
    }
  }
  throw new Error(`Deklaration nicht gefunden: ${name}`);
}

export function loadFunctions(names) {
  const lines = scriptSource().split('\n');
  const src = names.map(n => grabDeclaration(lines, n)).join('\n\n');
  // Gleiches Realm wie der Test (sonst sind Arrays nicht deepStrictEqual-kompatibel);
  // IIFE-Wrapper, damit die Deklarationen nicht in den globalen Scope lecken.
  const factory = vm.runInThisContext(
    '(function(){\n' + src + '\n; return {' + names.join(', ') + '};})',
    { filename: 'app-extract.js' }
  );
  return factory();
}
