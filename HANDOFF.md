# HANDOFF — US-Aktienbewertungstool

## Update (Chat 2 Abschluss): DCF-Eigenkapitalbrücke

**Auftrag:** Ausschließlich den Übergang operativer Unternehmenswert →
Eigenkapitalwert im Haupt-DCF korrigieren.

### Befund am Code (vor der Änderung)
`forecastDcfCore()` diskontiert operative Cashflows vor Finanzierung
(NOPAT + D&A − CapEx) mit WACC → **operativer Unternehmenswert**. `modelDcf()`
übernahm `r.total` unverändert als Wert je Aktie. Nachverfolgt bis zur Anzeige
und Synthese: **an keiner Stelle** wurde ein Nettoschuldenabzug vorgenommen —
weder in `forecastDcfCore`, noch in `modelDcf`, noch in
`runFairValueSynthesizer` (der die Modellwerte nur gewichtet). Ein bereits
vorhandener oder doppelter Abzug ist damit ausgeschlossen.

Abgegrenzt (bewusst **nicht** geändert):
- **Legacy-Fallback** in `modelDcf` (`fcfStartOverride` / `f.fcf[0]` via
  `dcfCore`) und damit auch **DCF Mid-Cycle**: `f.fcf = cfo − capex` ist eine
  bereits nachfinanzierte Größe (CFO enthält gezahlte Zinsen). Ein zusätzlicher
  Nettoschuldenabzug wäre dort teilweises Double Counting. Andere Semantik,
  anderer Auftrag.
- `modelEpvFloor`, `_computeOwnerFcfDcf`, `calculateImpliedGrowth`,
  `computeRelativeMultiplesFV`: ziehen Nettoschulden bereits ab — unverändert.

### Änderungen
Produktdatei `us-aktienbewertungstool-v1036-sector-classification-patch.html`:
1. **`_resolveNetDebtForDcfBridge(f)` (neu):** Priorität `net_debt[0]` →
   `total_debt[0] − cash_and_equivalents[0]` → `total_debt[0] − cash[0]`
   (identisch zu `computeNetDebtToEbitda`). Fehlt eine Komponente, ist das
   Ergebnis `available: false` mit Namen der fehlenden Felder — **fehlende
   Daten gelten nicht als 0**. `cash: [0]` ist dagegen ein vorhandener Wert.
2. **`modelDcf()` Forecast-Zweig:** Eigenkapitalwert je Aktie
   = operativer Wert je Aktie − `netDebt / shares_diluted[0]`. **Genau ein
   Abzug.** Nettoliquidität (negative Nettoschulden) wird über dieselbe Formel
   addiert. Ist `available: false`, erfolgt **kein** Abzug und der Wert wird
   ausdrücklich als unbereinigt gekennzeichnet.
3. **Explizite Wertbrücke** in `warnings` (im Modell-Card sichtbar) und als
   maschinenlesbare Felder: `_operatingValueAbsBase`,
   `_operatingValuePerShareBase`, `_grossDebtM`, `_cashM`, `_netDebtM`,
   `_netDebtPerShare`, `_netDebtSource`, `_netDebtAvailable`,
   `_netDebtMissingFields`, `_equityValueAbsBase`, `_equityValuePerShareBase`,
   `_sharesUsedM`, `_sharesBasis`, `_sharesBasisIsSubstitute`.
4. **Aktienbasis:** `shares_diluted[0]` ist der Ø verwässerte Periodenwert und
   **nicht** die Stichtags-Aktienzahl. Basis unverändert (Konvention aller
   Modelle), aber als Ersatzbasis gekennzeichnet — im Text und über
   `_sharesBasisIsSubstitute: true`.
5. **Trennung Verwässerung vs. Wertbrücke:** Nettoschulden sind eine
   Stichtagsgröße und werden immer durch die **heutige** Aktienzahl geteilt —
   unabhängig davon, ob der operative Wert je Aktie über `shares0` oder (bei
   Dilution > 0,5 %/y) jahresweise verwässert ermittelt wurde. Bei aktiver
   Dilutionsprojektion weist eine zusätzliche Zeile die Trennung aus. Kein
   verdecktes Double Counting.
6. **Unmittelbar betroffene Anzeigen mitgezogen** (sonst wichen sie um exakt
   `netDebt/Aktie` vom Hauptmodell ab):
   - `buildSensitivityMatrix()` — als „Fair Value" beschriftet, nutzt jetzt
     dieselbe Brücke (nur im Forecast-Zweig; Mid-Cycle/Legacy unverändert),
     inkl. Hinweiszeile zu Abzug bzw. fehlendem Abzug.
   - `runMonteCarloDcf()` — die Simulationswerte werden über `probAbovePrice`
     mit dem Aktienkurs verglichen, also Eigenkapitalwerte. Zusätzlich: ein
     negativer Eigenkapitalwert wird nicht mehr still aus der Verteilung
     gefiltert (sonst optimistischer Bias).
7. Wording: „Hauptwert" in der Buyback-Diagnose → „operativer Wert … beide vor
   Nettoschuldenabzug" (der Hauptwert ist jetzt der Eigenkapitalwert).

Testinfrastruktur:
- `_testDcfEquityBridge()` (neu, in der Produktdatei) — 44 Assertions.
- `test/run-calc-tests.js`: neue Funktion in `PURE_TEST_FUNCTIONS`; zusätzlich
  gibt der Runner bei Fehlschlägen jetzt das Freitext-Feld `extra` aus, wenn
  `expected`/`actual` fehlen (bisher „erwartet: undefined"). Die in Chat 1
  ergänzte Fehlererkennung ist unverändert erhalten.

### Pflicht-Test (unabhängig nachgerechnet)
Umsatz 1.000M, EBIT 200M, D&A 50M, CapEx 50M, Steuer 25 %, g1 = tg = 0 %,
WACC 10 %, 100M konstante Aktien → FCF = 150M p.a. → EV = 150/0,10 = **1.500M**
= 15,00 USD/Aktie operativ.

| Fall | Erwartet | Ergebnis |
|---|---|---|
| Nettoschulden 0 | 15,00 | 15,00 ✅ |
| Nettoschulden 500M | 10,00 | 10,00 ✅ |
| Nettoliquidität 200M | 17,00 | 17,00 ✅ |
| Nettoschulden 2.000M (negatives EK) | −5,00, ausgewiesen | −5,00, `applicable: true` ✅ |
| Keine Schulden-/Liquiditätsdaten | kein stiller 0-Abzug | 15,00 + `_netDebtAvailable: false`, `_netDebtM: null`, Warnung ✅ |
| `total_debt` ohne Liquiditätsangabe | nicht ableitbar | kein Abzug, Feld benannt ✅ |

Der WACC bleibt in allen Varianten fix 10 % — Finanzierungsänderungen ändern
ihn im Testpfad nicht (B-8 prüft: operativer Wert je Aktie in allen drei
Varianten identisch 15,00; Differenzen entsprechen exakt `netDebt/Aktien`).

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (vor Änderung, Commit 7d0a0cc) | 562 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Korrektur | **606 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |

**Keine bestehende Testerwartung wurde geändert** — die Korrektur erzwang keine
Anpassung (kein Fixture prüft DCF-Beträge in einer Genauigkeit, die der Abzug
verletzt). Neue Assertions: 44 (`_testDcfEquityBridge`), alle grün.

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
- Brücke in `modelDcf` entfernt → 9 der neuen Assertions schlagen fehl
  (B-3a/d, B-4a, B-5a/d/e, B-7a/b, B-8b). Der Test erkennt den Originalfehler.
- Brücke in `buildSensitivityMatrix` entfernt → B-10a schlägt fehl.

**Wirkungsnachweis an realistischen Daten** (synthetischer AVGO-artiger Fall,
Nettoschulden 26.000M / 450M Aktien): base 275,44 → **217,66** USD/Aktie;
Differenz 57,78 = exakt `netDebt/Aktien`, also genau ein Abzug.

**Monte Carlo** (stochastisch, daher bewusst ohne Assertion, einmalig manuell
geprüft): Median 14,90 / 10,00 / 17,15 bei Nettoschulden 0 / 500M / −200M.

### T-BRL1 (bekannter Altfehler, weiterhin rot)
Nicht Gegenstand dieses Auftrags und **nicht** durch sachfremde Anpassungen
grün gemacht. Wirkung der Korrektur gemessen: DCF base 16,02 → 15,62
(Nettoschulden 400M / 1.000M Aktien = 0,40/Aktie), RIM unverändert 5,13,
Divergenz **3,12x → 3,05x** — weiterhin über dem 3x-Gate, `buyPrice` bleibt
`null`, identische Fehlermeldung. Diagnose aus Chat 1 bleibt gültig:
Fixture-Kalibrierung, kein Logik- oder Runnerfehler.

### Offene Einschränkungen
- Legacy-FCF-Zweig und DCF Mid-Cycle sind bewusst ohne Wertbrücke (Begründung
  oben). Ob `cfo − capex` fachlich als FCFE gelten soll, ist eine offene
  Grundsatzfrage — nicht in diesem Auftrag entschieden.
- Bei `net_debt[0]` als Quelle sind Bruttoschulden und Liquidität einzeln nicht
  bekannt; die Anzeige weist das als „n/a (in net_debt enthalten)" aus.
- Aktienbasis bleibt `shares_diluted[0]` (Ø verwässert). Eine echte
  Stichtags-Aktienzahl wird nicht verwendet, nur gekennzeichnet — eine
  Umstellung beträfe alle Modelle und ist ein eigener Auftrag.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet.
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand für Chat 3
- **Branch:** `claude/dcf-net-debt-bridge` (basiert auf
  `test-infra/node-calc-runner`, Commit 7d0a0cc — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **606 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
- **Nächster Auftrag laut Plan:** Working Capital und Wachstumsmodell.
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); Playwright für die zwei DOM-Formulartests.

---

## Update (Chat 1 Abschluss): Fehlererkennung des Testrunners
**Behobene Schwachstelle:** `run-calc-tests.js` zählte fehlende/nicht
aufrufbare Pflicht-Testfunktionen (`PURE_TEST_FUNCTIONS`) bisher NICHT als
Fehler, sondern übersprang sie stillschweigend ("nicht gefunden") — ein
kaputter/entfernter Test hätte so unbemerkt einen grünen Lauf erlaubt.
Ebenso zählten 0 zurückgegebene Assertions einer Pflichtfunktion als
"0 fehlgeschlagen" statt als Fehler, und eine leere `REGRESSION_FIXTURES`-
Liste hätte (in Kombination mit fehlenden Funktionen) zu einem 0/0/0-Lauf
mit Exit-Code 0 führen können.

Korrektur (nur `test/run-calc-tests.js`, keine Produktdatei betroffen):
- Pflicht-Testfunktion fehlt/ist keine Funktion → `totalError++`, Name wird
  in der Fehlerliste genannt.
- Pflicht-Testfunktion liefert 0 Assertions → `totalError++`, Name genannt.
- `REGRESSION_FIXTURES.length === 0` → `totalError++`, explizite Meldung.
- Sicherheitsnetz: 0 Pass + 0 Fail + 0 Error am Ende → wird zu 1 Error
  ("leerer Lauf gilt nicht als Erfolg").
- Bewusst übersprungene DOM-Tests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben unverändert als SKIPPED ausgewiesen.

**Verifiziert mit temporären, nicht committeten Kopien** der Produkt-HTML:
| Szenario | Ergebnis |
|---|---|
| Pflicht-Testfunktion umbenannt/fehlt (`_testGoldenCases`) | Exit 1, `⛔ [_testGoldenCases] Pflicht-Testfunktion fehlt...` |
| Pflicht-Testfunktion liefert `[]` (`_testSbcDiagnostics`) | Exit 1, `⛔ [_testSbcDiagnostics] 0 Assertions zurückgegeben...` |
| `REGRESSION_FIXTURES.length = 0` | Exit 1, `⛔ [REGRESSION_FIXTURES] ... leer (0 Einträge)...` |

**Regulärer Lauf nach der Korrektur** (`npm test`):
562 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler/Exceptions, Exit-Code 1.

**CI-Workflow geprüft:** `.github/workflows/tests.yml` ruft exakt
`node test/run-calc-tests.js` auf, ohne `continue-on-error`.

### Auftrag Chat 1
Reproduzierbare Testgrundlage schaffen, ohne die Finanzlogik zu verändern.

### Änderungen Chat 1
- `test/run-calc-tests.js` (neu): abhängigkeitsfreier Node-Runner. Lädt den
  `<script>`-Inhalt der Produkt-HTML per `vm.createContext`/`vm.runInContext`
  read-only, mit minimalen Stubs (`document`, `localStorage`, `fetch` etc.).
- `package.json` (neu): `npm test` → `node test/run-calc-tests.js`.
- `.github/workflows/tests.yml` (neu): CI-Workflow.
- Produktdatei wurde in Chat 1 **nicht verändert**.

### Bewusst ausgeschlossen (kein Fake-Pass!)
- `_testManualAssumptionOverride`, `_testMarketDataOverrides`: legen echte
  `<input>`-Elemente an und lesen `.value` — als **SKIPPED** ausgewiesen.
- `_testPeriodAlignment`: im Quelltext auskommentiert, existiert zur Laufzeit
  nicht.
