# HANDOFF — Node-Testrunner für reine Rechentests

## Auftrag
Reproduzierbare Testgrundlage schaffen, ohne die Finanzlogik zu verändern.

## Änderungen
- `test/run-calc-tests.js` (neu): abhängigkeitsfreier Node-Runner. Lädt den
  `<script>`-Inhalt der Produkt-HTML per `vm.createContext`/`vm.runInContext`
  read-only, mit minimalen Stubs (`document`, `localStorage`, `fetch` etc.).
  Führt aus: alle `REGRESSION_FIXTURES` via `_runSingleFixture` sowie die
  eigenständigen reinen Testfunktionen `_testAuditShareFactsCases`,
  `_testCalculateImpliedGrowth`, `_testGrowthEngine`, `_testSbcDiagnostics`,
  `_testGoldenCases`, `_testSectorClassificationPatch`.
- `package.json` (neu): `npm test` → `node test/run-calc-tests.js`.
- `.github/workflows/tests.yml` (neu): CI-Workflow, führt denselben Befehl
  bei Push/PR aus (kostenfreier GitHub-Actions-Tier).
- Produktdatei (`us-aktienbewertungstool-*.html`) wurde **nicht verändert**.

## Bewusst ausgeschlossen (kein Fake-Pass!)
- `_testManualAssumptionOverride`, `_testMarketDataOverrides`: legen echte
  `<input>`-Elemente an und lesen `.value` — werden im Runner explizit als
  **SKIPPED** ausgewiesen, nicht mit unvollständigen DOM-Attrappen simuliert.
  Erfordern echten Browser (z. B. Playwright), das ist hier nicht eingerichtet.
- `_testPeriodAlignment`: im Quelltext (Zeile ~7809 des extrahierten Scripts)
  in `/* ... */` auskommentiert — existiert zur Laufzeit nicht, kein Test.

## Tatsächlich ausgeführt (Befehl: `npm test` bzw. `node test/run-calc-tests.js`)
Ergebnis dieses Laufs:
- Fixtures: 374 Assertions bestanden, **1 fehlgeschlagen** (T-BRL1), 0 Pipeline-Fehler
- 6 eigenständige Testfunktionen: 188 Assertions, alle bestanden
- Gesamt: **562 bestanden, 1 fehlgeschlagen, 0 Exceptions** — Exit-Code 1

## T-BRL1 — Root-Cause-Untersuchung (nur diagnostiziert, nicht gefixt)
Manuell nachvollzogen (gleiche Pipeline wie `_runSyn` im Quelltext): Für die
synthetische Fixture divergieren DCF- (~16.0) und RIM-Modell (~5.1) um Faktor
3.12x. Das bestehende Divergenz-Gate in `runFairValueSynthesizer` setzt
daraufhin `buyPrice = null` (Status bleibt `watchlist`, `blockReason:
"Modell-Divergenz >3x..."`). Base-Rate-Lite selbst liefert korrekt
`available: true, overallRating: "plausibel"`.
→ **Ursache: Test-Fixture-Defekt**, nicht Umgebungs-/Runner-Fehler und nicht
BRL-Logikfehler. Die dritte Assertion ("BRL kein Einfluss") geht implizit davon
aus, dass buyPrice existiert — das trifft für diese Kombination aus Fixture-
Zahlen wegen des unabhängigen Divergenz-Gates nicht zu. Fixture-Werte
(revenue/ebit/fcf) müssten angepasst werden, damit DCF/RIM näher beieinander
liegen. **Nicht geändert**, da fachliche Kalibrierung außerhalb des Auftrags
"Testinfrastruktur ohne Logikänderung" liegt.

## Offene Einschränkungen
- Zwei DOM-Formulartests bleiben ungetestet außerhalb des Browsers.
- T-BRL1 bleibt rot (bewusst, bekannt, dokumentiert) — nicht durch gelockerte
  Erwartung verborgen.
- Branch `test-infra/node-calc-runner` ist nicht gemerged, kein Deployment.

## Ausgangsstand für den nächsten Schritt
- Bei Bedarf: T-BRL1-Fixture-Zahlen fachlich neu kalibrieren (Revenue/EBIT/FCF
  so wählen, dass DCF/RIM-Divergenz < 3x) — separater, bewusster Schritt.
- Bei Bedarf: echte Browser-Testautomatisierung (z. B. Playwright) für die
  zwei DOM-Formulartests separat einrichten.
