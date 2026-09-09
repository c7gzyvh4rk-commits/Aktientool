#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Gemeinsamer Testaufruf (V1.0.38)
//
// Fuehrt BEIDE Suiten aus:
//   1. node test/run-calc-tests.js      — Rechen-/Regressionstests aus der HTML-Datei
//   2. node --test tests/*.test.mjs     — SEC-Normalisierungs-/Ableitungstests
//
// Bewusst keine Verkettung mit "&&": die zweite Suite laeuft auch dann, wenn
// die erste fehlschlaegt (aktuell durch den bekannten Altfehler T-BRL1). Der
// gemeinsame Aufruf endet mit Exit-Code 1, sobald mindestens eine Suite
// fehlschlaegt — ein Fehlschlag wird nirgends unterdrueckt oder umgedeutet.
//
// Keine Abhaengigkeiten, kein Test-Framework: nur node:child_process/fs/path.
// ─────────────────────────────────────────────────────────────────────────────
const { spawnSync } = require('node:child_process');
const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// tests/*.test.mjs selbst aufloesen (kein Shell-Glob noetig, gleiche Dateiliste)
function secTestFiles() {
  const dir = path.join(ROOT, 'tests');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(n => n.endsWith('.test.mjs'))
    .sort()
    .map(n => path.join('tests', n));
}

const suites = [];
suites.push({ name: 'Rechen-/Regressionstests (test/run-calc-tests.js)',
              args: [path.join('test', 'run-calc-tests.js')] });

const secFiles = secTestFiles();
if (secFiles.length > 0) {
  suites.push({ name: 'SEC-Ableitungstests (node --test tests/*.test.mjs)',
                args: ['--test', ...secFiles] });
} else {
  // Fehlende SEC-Suite ist ein Fehler, kein stiller Erfolg.
  suites.push({ name: 'SEC-Ableitungstests', missing: true });
}

const results = [];
for (const suite of suites) {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`▶ ${suite.name}`);
  console.log('════════════════════════════════════════════════════════════');
  if (suite.missing) {
    console.error('⛔ Keine Dateien tests/*.test.mjs gefunden — Suite gilt als fehlgeschlagen.');
    results.push({ name: suite.name, code: 1 });
    continue;
  }
  const r = spawnSync(process.execPath, suite.args, { cwd: ROOT, stdio: 'inherit' });
  const code = (r.status == null) ? 1 : r.status;
  if (r.error) console.error('⛔ Suite konnte nicht gestartet werden: ' + r.error.message);
  results.push({ name: suite.name, code });
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('GESAMTERGEBNIS BEIDER SUITEN');
console.log('════════════════════════════════════════════════════════════');
for (const r of results) {
  console.log(`${r.code === 0 ? '✅' : '❌'} ${r.name} — Exit-Code ${r.code}`);
}
const failed = results.filter(r => r.code !== 0);
if (failed.length > 0) {
  console.log(`\n❌ ${failed.length} von ${results.length} Suite(n) fehlgeschlagen.`);
  console.log('   Hinweis: Der bekannte Altfehler T-BRL1 in den Rechentests ist noch offen');
  console.log('   und wird bewusst NICHT unterdrueckt — er bleibt sichtbar und rot.');
  process.exit(1);
}
console.log('\n✅ Beide Suiten bestanden.');
process.exit(0);
