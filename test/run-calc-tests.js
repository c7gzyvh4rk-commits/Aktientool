#!/usr/bin/env node
'use strict';

/**
 * run-calc-tests.js
 * ────────────────────────────────────────────────────────────────
 * Schlanker, abhängigkeitsfreier Node-Runner für die reinen
 * Rechen-/Regressionstests des Aktienbewertungstools.
 *
 * Zweck (siehe Auftrag "reproduzierbare Testgrundlage"):
 *  - Führt ausschließlich Tests aus, die KEINE echten DOM-Elemente
 *    lesen/schreiben (reine Funktionen auf Master-JSON-Objekten).
 *  - Simuliert KEINE Bedienoberfläche mit unvollständigen Attrappen.
 *    Tests, die echte Formularfelder anlegen und auslesen
 *    (_testManualAssumptionOverride, _testMarketDataOverrides),
 *    werden bewusst NICHT ausgeführt, sondern als "SKIPPED (Browser
 *    erforderlich)" ausgewiesen. Das verhindert falsch-positive
 *    Ergebnisse durch lückenhafte DOM-Mocks.
 *  - Verändert die Produktdatei nicht. Lädt sie nur read-only ein.
 *
 * Verwendung:
 *   node test/run-calc-tests.js [pfad-zur-html-datei]
 *
 * Exit-Code:
 *   0  = alle ausgeführten Rechentests bestanden
 *   1  = mindestens ein Fehlschlag/Fehler in den Rechentests
 *   2  = Datei konnte nicht geladen/ausgeführt werden (Ladefehler)
 *
 * Hinweis: Dieser Runner ist bewusst ohne externe Abhängigkeiten
 * (kein jsdom, kein Test-Framework) gehalten, da das Projekt selbst
 * keine solchen Abhängigkeiten nutzt ("möglichst vorhandene
 * Abhängigkeiten verwenden", "kein unnötiger Frameworkwechsel").
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_TARGET = path.join(
  __dirname,
  '..',
  'us-aktienbewertungstool-v1036-sector-classification-patch.html'
);

// Reine, Browser-freie Testfunktionen, die dieser Runner ausführt.
// Jede wurde vorab geprüft: keine document./getElementById/innerHTML-Zugriffe
// im Funktionskörper (Stand: siehe HANDOFF.md).
const PURE_TEST_FUNCTIONS = [
  '_testAuditShareFactsCases',
  '_testCalculateImpliedGrowth',
  '_testGrowthEngine',
  '_testSbcDiagnostics',
  '_testGoldenCases',
  '_testSectorClassificationPatch',
  '_testDcfEquityBridge',
  '_testDcfWorkingCapital',
  '_testValuationCore',
  '_testSynthesisPrecision',
  '_testSnapshotIntegrity',
  '_testSnapshotPathConsistency',
];

// Test-Helper, die echte DOM-Formularfelder anlegen/auslesen
// (document.createElement, document.getElementById(...).value, ...).
// Werden absichtlich NICHT ausgeführt — siehe Kommentar oben.
const SKIPPED_DOM_TESTS = [
  { name: '_testManualAssumptionOverride', reason: 'erzeugt echte <input>-Elemente und liest .value aus (Assumptions-Formular) — nicht ohne echten Browser/DOM sinnvoll simulierbar' },
  { name: '_testMarketDataOverrides', reason: 'liest reale Formularfelder (#as-beta-override u.a.) aus — nicht ohne echten Browser/DOM sinnvoll simulierbar' },
];

// Bekannter toter Code: im Quelltext auskommentiert, existiert zur Laufzeit nicht.
const KNOWN_DEAD_TEST_FUNCTIONS = ['_testPeriodAlignment'];

function loadScriptSource(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) {
    throw new Error('Kein <script>-Block in der Datei gefunden.');
  }
  return match[1];
}

function buildSandbox() {
  // In-Memory localStorage-Attrappe (kein Dateisystem-/Browserzugriff).
  const lsStore = new Map();
  const localStorage = {
    getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
    setItem: (k, v) => { lsStore.set(k, String(v)); },
    removeItem: (k) => { lsStore.delete(k); },
    clear: () => { lsStore.clear(); },
  };

  // Absichtlich MINIMALE document-Attrappe: deckt nur das ab, was beim
  // Laden des Skripts top-level ausgeführt wird (Registrierung eines
  // DOMContentLoaded-Listeners). getElementById liefert bewusst `null`
  // zurück statt eines Fake-Elements, damit ein unerwarteter DOM-Zugriff
  // aus einer als "rein" eingestuften Funktion sofort sichtbar auffällt
  // (TypeError), statt still ein falsches Ergebnis zu erzeugen.
  const document = {
    addEventListener: () => {},
    getElementById: () => null,
    createElement: () => { throw new Error('document.createElement: DOM nicht verfügbar (Node-Testrunner)'); },
    body: { appendChild: () => { throw new Error('document.body.appendChild: DOM nicht verfügbar (Node-Testrunner)'); } },
    querySelector: () => null,
  };

  const sandbox = {
    console,
    localStorage,
    document,
    location: { search: '' },
    navigator: { userAgent: 'node-calc-test-runner' },
    URLSearchParams,
    fetch: () => Promise.reject(new Error('Netzwerkzugriff ist im Rechentest-Runner nicht vorgesehen.')),
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function normalizeResult(name, raw) {
  // Vereinheitlicht die unterschiedlichen Rückgabeformen der Testfunktionen
  // auf { pass, fail, entries[] }.
  if (Array.isArray(raw)) {
    const entries = raw.map(r => ({
      label: r.label || '(ohne Label)',
      pass: !!r.pass,
      expected: r.expected,
      actual: r.actual,
      // Testfunktionen im Stil von _testGoldenCases/_testDcfEquityBridge liefern
      // statt expected/actual ein Freitext-Feld "extra" — sonst wäre die
      // Fehlermeldung inhaltsleer ("erwartet: undefined").
      extra: r.extra,
    }));
    return {
      pass: entries.filter(e => e.pass).length,
      fail: entries.filter(e => !e.pass).length,
      entries,
    };
  }
  if (raw && typeof raw === 'object' && ('passed' in raw) && ('failed' in raw)) {
    return { pass: raw.passed, fail: raw.failed, entries: [] };
  }
  // Unbekanntes/leeres Format: als Fehler werten, nicht stillschweigend als "bestanden".
  return {
    pass: 0,
    fail: 1,
    entries: [{ label: `Unerwartetes Rückgabeformat von ${name}`, pass: false, actual: raw }],
  };
}

// Formatiert eine Fehlschlag-Zeile: expected/actual wenn vorhanden,
// sonst das Freitext-Feld "extra" der Testfunktion.
function formatFailure(prefix, entry) {
  if (entry.expected !== undefined || entry.actual !== undefined) {
    return `✗ ${prefix} ${entry.label} — erwartet: ${JSON.stringify(entry.expected)}, erhalten: ${JSON.stringify(entry.actual)}`;
  }
  if (entry.extra !== undefined) {
    return `✗ ${prefix} ${entry.label} — ${entry.extra}`;
  }
  return `✗ ${prefix} ${entry.label} — fehlgeschlagen (keine Detailangabe der Testfunktion)`;
}

function main() {
  const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TARGET;
  console.log(`Lade: ${targetPath}`);

  let scriptSource;
  try {
    scriptSource = loadScriptSource(targetPath);
  } catch (e) {
    console.error(`⛔ Ladefehler: ${e.message}`);
    process.exit(2);
  }

  const sandbox = buildSandbox();
  vm.createContext(sandbox);

  try {
    vm.runInContext(scriptSource, sandbox, { filename: targetPath, timeout: 30000 });
  } catch (e) {
    console.error(`⛔ Ausführungsfehler beim Laden des Skripts: ${e.message}`);
    console.error(e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : '');
    process.exit(2);
  }

  let totalPass = 0, totalFail = 0, totalError = 0;
  const failureDetails = [];

  // ── 1) Fixture-Pipeline (REGRESSION_FIXTURES + _runSingleFixture) ──
  vm.runInContext(
    'globalThis.__fixtures = (typeof REGRESSION_FIXTURES !== "undefined") ? REGRESSION_FIXTURES : null;' +
    'globalThis.__runSingleFixture = (typeof _runSingleFixture !== "undefined") ? _runSingleFixture : null;',
    sandbox
  );

  if (!sandbox.__fixtures || !sandbox.__runSingleFixture) {
    console.error('⛔ REGRESSION_FIXTURES oder _runSingleFixture nicht gefunden — Datei-Struktur hat sich vermutlich geändert.');
    process.exit(2);
  }

  // Eine leere Fixture-Liste ist kein bestandener Lauf, sondern ein Defekt
  // (Datei-Struktur geändert, Registrierung fehlgeschlagen o.ä.) — muss
  // sichtbar als Fehler zählen statt stillschweigend 0/0 zu melden.
  if (sandbox.__fixtures.length === 0) {
    totalError++;
    const msg = 'REGRESSION_FIXTURES ist leer (0 Einträge) — das zählt als Fehler, nicht als bestandener Lauf.';
    console.error(`⛔ ${msg}`);
    failureDetails.push(`⛔ [REGRESSION_FIXTURES] ${msg}`);
  }

  console.log(`\n== Fixture-Pipeline: ${sandbox.__fixtures.length} Fixtures ==`);
  for (const fixture of sandbox.__fixtures) {
    let result;
    try {
      vm.createContext; // no-op, keeps linter quiet about unused import removal risk
      sandbox.__currentFixture = fixture;
      vm.runInContext('globalThis.__fixtureResult = __runSingleFixture(__currentFixture);', sandbox);
      result = sandbox.__fixtureResult;
    } catch (e) {
      result = { id: fixture.id, label: fixture.label, error: 'Exception: ' + e.message, results: [] };
    }
    if (result.error) {
      totalError++;
      failureDetails.push(`⛔ [${result.id}] ${result.label}: Pipeline-Fehler: ${result.error}`);
      continue;
    }
    const norm = normalizeResult(result.id, result.results);
    totalPass += norm.pass;
    totalFail += norm.fail;
    if (norm.fail > 0) {
      for (const entry of norm.entries.filter(e => !e.pass)) {
        failureDetails.push(formatFailure(`[${result.id}]`, entry));
      }
    }
  }
  console.log(`Fixtures: ${totalPass} Assertions bestanden, ${totalFail} fehlgeschlagen, ${totalError} Pipeline-Fehler.`);

  // ── 2) Eigenständige reine Testfunktionen ──
  console.log(`\n== Eigenständige Rechentests ==`);
  for (const name of PURE_TEST_FUNCTIONS) {
    // Pflicht-Testfunktion: muss existieren UND eine Funktion sein.
    // "typeof x !== 'undefined'" allein wäre unzureichend (z.B. wenn der
    // Name aus Versehen zu einer Nicht-Funktion umdeklariert wird).
    vm.runInContext(`globalThis.__fnExists = (typeof ${name} === "function");`, sandbox);
    if (!sandbox.__fnExists) {
      totalError++;
      console.log(`⛔ ${name}: FEHLT oder ist keine Funktion (Pflicht-Testfunktion)`);
      failureDetails.push(`⛔ [${name}] Pflicht-Testfunktion fehlt oder ist nicht aufrufbar — zählt als Fehler, nicht als übersprungen.`);
      continue;
    }
    let raw, threw = null;
    try {
      vm.runInContext(`globalThis.__fnResult = ${name}();`, sandbox);
      raw = sandbox.__fnResult;
    } catch (e) {
      threw = e;
    }
    if (threw) {
      totalError++;
      console.log(`⛔ ${name}: Exception — ${threw.message}`);
      failureDetails.push(`⛔ [${name}] Exception: ${threw.message}`);
      continue;
    }
    const norm = normalizeResult(name, raw);
    // Eine Pflicht-Testfunktion, die 0 Assertions liefert, hat nichts
    // geprüft — das darf nicht stillschweigend als "bestanden" (0 fail)
    // durchgehen, sondern zählt als Fehler.
    if (norm.pass + norm.fail === 0) {
      totalError++;
      console.log(`⛔ ${name}: lieferte 0 Assertions — leeres Ergebnis zählt als Fehler`);
      failureDetails.push(`⛔ [${name}] 0 Assertions zurückgegeben — Pflicht-Test hat nichts geprüft.`);
      continue;
    }
    totalPass += norm.pass;
    totalFail += norm.fail;
    const status = norm.fail === 0 ? '✅' : '❌';
    console.log(`${status} ${name}: ${norm.pass} bestanden, ${norm.fail} fehlgeschlagen`);
    if (norm.fail > 0) {
      for (const entry of norm.entries.filter(e => !e.pass)) {
        failureDetails.push(formatFailure(`[${name}]`, entry));
      }
    }
  }

  // ── 3) Bekannte DOM-/Browser-Tests: bewusst übersprungen ──
  console.log(`\n== Übersprungen (echtes DOM erforderlich) ==`);
  for (const t of SKIPPED_DOM_TESTS) {
    console.log(`—  ${t.name}: SKIPPED — ${t.reason}`);
  }

  // ── 4) Bekannter toter Code (auskommentiert im Quelltext) ──
  for (const name of KNOWN_DEAD_TEST_FUNCTIONS) {
    vm.runInContext(`globalThis.__fnExists = (typeof ${name} !== "undefined");`, sandbox);
    console.log(`—  ${name}: ${sandbox.__fnExists ? 'unerwartet vorhanden (bitte Liste in run-calc-tests.js prüfen)' : 'nicht vorhanden (im Quelltext auskommentiert, kein Widerspruch)'}`);
  }

  // Sicherheitsnetz: Wurde trotz allem keine einzige Assertion ausgeführt
  // und auch kein Fehler gezählt (z.B. durch einen hier nicht bedachten
  // Fall), gilt der Lauf als Fehler — ein leeres Ergebnis ist niemals ein
  // bestandener Testlauf.
  if (totalPass + totalFail === 0 && totalError === 0) {
    totalError++;
    const msg = 'Keine einzige Assertion wurde ausgeführt (0 Checks) — ein leerer Lauf gilt nicht als Erfolg.';
    console.error(`⛔ ${msg}`);
    failureDetails.push(`⛔ [Runner] ${msg}`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`GESAMT: ${totalPass} bestanden · ${totalFail} fehlgeschlagen · ${totalError} Fehler/Exceptions`);
  if (failureDetails.length > 0) {
    console.log(`\nDetails zu Fehlschlägen:`);
    for (const line of failureDetails) console.log('  ' + line);
  }
  console.log(`════════════════════════════════════════`);

  process.exit((totalFail > 0 || totalError > 0) ? 1 : 0);
}

main();
