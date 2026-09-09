# HANDOFF — US-Aktienbewertungstool

## Update (Chat 4 Abschluss): Ein gemeinsamer Bewertungskern

**Auftrag:** Haupt-DCF, Reverse DCF und Sensitivitätsmatrix sollen dieselbe
Bewertungsfunktion verwenden.

### Befund am Code (vor der Änderung)
Drei Pfade, drei Definitionen — dieselbe Eingabe lieferte je nach Anzeige
verschiedene Werte:
| Pfad | Cashflow | Nettoschulden | ΔWC | Fade | Aktien |
|---|---|---|---|---|---|
| Haupt-DCF (`forecastDcfCore`) | FCFF aus EBIT | Brücke (3-stufige Priorität) | ja | ja | Projektion |
| Reverse DCF (`calculateImpliedGrowth`) | `f.fcf[0]` = CFO − CapEx | `net_debt[0]`, sonst **still 0** | nein | nein | `shares_diluted[0]` |
| Matrix, Zweig 2/3 (`dcfCore`) | Mid-Cycle-FCF bzw. `f.fcf[0]` | keine | nein | ja | konstant |
| DCF Mid-Cycle | Mid-Cycle-FCF via `dcfCore` | keine | nein | ja | konstant |
| Monte Carlo, Fallback | `f.fcf[0]` | keine | nein | ja | konstant |

Der Reverse DCF löste zudem das Wachstum des **FCF**, wurde aber als
„Stage-1-Wachstum" beschriftet — im Haupt-DCF ist g1 das **Umsatzwachstum**.

### Änderungen (Produktdatei)
1. **Kern (neu):** `DCF_CORE_MODEL_VERSION = 'dcf-core/1.1'`,
   `buildCoreValuationContext(mj, opts)` (löst Cashflow-Struktur, Working
   Capital, Nettoschulden, Aktienbasis, Fade einmalig auf) und
   `coreValuationDetail(ctx, g1, tg, wacc, opMarginPct)` → operativer Wert,
   Brücke, Eigenkapitalwert je Aktie. `null` = nicht bewertbar, nie 0 als Ersatz.
2. **Alle Pfade angeschlossen:** `modelDcf`, `modelDcfMidcycle`,
   `computeSensitivityMatrix` (neu, Zahlen von der Darstellung getrennt),
   `solveReverseDcfGrowth` (neu) und `runMonteCarloDcf`. **`dcfCore` hat jetzt
   null Aufrufer** und ist als überholt gekennzeichnet.
3. **Mid-Cycle korrigiert statt ausgeschlossen:** läuft über den Kern mit
   `opMarginOverridePct` = Median-Betriebsmarge. Einzige Abweichung vom
   Haupt-DCF ist die normalisierte Marge; ΔWC, Nettoschuldenbrücke und
   Aktienprojektion gelten jetzt auch hier.
4. **Legacy-Pfad ausgeschlossen:** ohne Umsatzpfad (revenue/ebit/capex) ist der
   Kern nicht anwendbar und `CFO − CapEx` nicht in ihn zerlegbar. `modelDcf`
   liefert `applicable:false` mit `_excludedFromSynthesis`, `_exclusionCode` und
   benannten fehlenden Feldern — der Wert geht damit weder in Bewertung noch in
   Synthese ein. Ebenso Matrix und Monte Carlo (erklärter Status statt Zahl).
5. **Reverse DCF:** löst **ausschließlich** `growth_stage1` (Umsatz); alles
   andere konstant und über `heldConstant`/`heldConstantNote` ausgewiesen.
   Suchbereich −20 % … +40 %, Raster 0,5 pp, Toleranz 1e-4 pp. Nullstellen
   werden **gezählt**: 0 → `no_solution_in_range`, ≥2 → `multiple_solutions`,
   sonst Intervallhalbierung. Weitere Status: `wacc_le_terminal_growth`,
   `inputs_missing`, `not_evaluable`, `not_applicable` (Financials). Nie ein
   geratener Grenzwert. `computeReverseDcf` und die Übersichtskarte nutzen den
   Kern; bei fehlender Lösung wird der Status gezeigt, **nicht** ersatzweise die
   FCF-Zahl. `reverseDcfReported`/`reverseDcfOwner` bleiben als SBC-Diagnosepaar
   auf REPORTED-FCF-Basis erhalten, jetzt mit
   `fcfBasisDiagnosticOnly`/`fcfBasisConsistentWithCore:false` gekennzeichnet.
6. **Matrix:** variiert nur WACC und g1; Terminalwachstum, Marge, Steuer-,
   CapEx-, D&A- und WC-Quote, Fade, Aktienprojektion und Nettoschulden sind in
   jeder Zelle identisch mit dem Haupt-DCF und werden im Fußtext genannt.
7. **Working Capital gekennzeichnet:** `OWC_STOCK_SIMPLIFICATION_NOTE` — der
   Anfangsbestand wird bereits mit der Prognosequote angesetzt (OWC₀ = Quote ×
   Umsatz₀), eine Anpassung vom Ist-Bestand auf die Zielquote wird **nicht**
   modelliert (`_owcOpeningStockBasis`, `_owcStockAdjustmentModelled:false`,
   `_owcActualOpeningStockM`). Der automatisch gesetzte Wert heißt jetzt
   **„Vorläufige Modellannahme: 0; Nutzereingabe erforderlich"**
   (`_owcSetBy:'model_provisional_default'`) — nicht mehr „NUTZERANNAHME".
8. **Modellversion und Annahmen** konsistent an Modell, Matrix und Reverse DCF
   (`_modelVersion`, `_coreDefinitionLabel`, `_coreTaxRatePct`,
   `_coreCapexIntensityPct`, `_coreDaRatioPct`, `_coreFadeEnabled`, …).

### Pflicht-Tests
Neu: **`_testValuationCore()` — 85 Assertions**, im Runner als Pflichtfunktion
registriert. Dokumentierte Toleranzen: `1e-9` USD/Aktie für Wertvergleiche,
`1e-4` pp für Wachstum (= `REVERSE_DCF_SEARCH.tolerancePp`).

| Pflichtfall | Ergebnis |
|---|---|
| Roundtrip DCF → Kurs → Reverse DCF (g = 8 %, Rasterpunkt) | 8,0000 % ✅ |
| Roundtrip mit Zwischenwert g = 7,3 % (echte Halbierung) | 7,3000 % ✅ |
| Roundtrip mit Nettoschulden 500M (−5,00/Aktie) | 8 % zurückgewonnen ✅ |
| Roundtrip mit Nettoliquidität 200M (+2,00/Aktie) | 8 % zurückgewonnen ✅ |
| Roundtrip mit ΔWC 20 % und fallender Wertkurve (WC 500 %) | ✅ |
| Zentrale Matrixzelle = Haupt-DCF base | exakt, alle 25 Zellen aus dem Kern ✅ |
| WACC ≤ tg (Kern, Reverse DCF, Modell, Matrix) | abgefangen, kein 0-Ersatz ✅ |
| Nicht lösbar (Kurs 1e7 / 1e-6) | `no_solution_in_range`, `null` — kein Grenzwert ✅ |
| Referenzfall Chat 2 (ND 0/500/−200 → 15,00/10,00/17,00) | unverändert ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (`claude/dcf-working-capital`, aef1b34) | 688 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **775 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |
| Stabilität | 5 Läufe, identisches Ergebnis (Monte Carlo unauffällig) |

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| `computeReverseDcf` zurück auf den alten FCF-Pfad | 4 rot (C-11b/d/h) |
| Nettoschuldenbrücke im Kern entfernt | 18 rot (C-3a/d/f u.a.) |
| Suchbereichsgrenze als Ergebnis geraten | 5 rot (C-6a/b/d/e) |
| Matrix variiert zusätzlich tg (+0,1 pp) | 7 rot (C-4b/c/j) |
| Mid-Cycle zurück auf `dcfCore` | 12 rot (C-8b–f) |
| WACC ≤ tg nicht abgefangen | 5 rot (C-5a/b/f/g) |
| Reverse DCF ignoriert die WC-Quote | 3 rot (C-3g/i) |

**Geänderte Testerwartungen (fachlich begründet, im Code dokumentiert):**
- `W-9e`: Legacy-Pfad wird ausgeschlossen statt mit Warnhinweis weitergerechnet
  (Abnahmekriterium: „Ein Warnhinweis allein reicht nicht"). Die ursprüngliche
  Prüfabsicht — abweichende Definition muss benannt sein — bleibt erste Bedingung.
- `W-7d`, `W-11c`: Wortlaut „NUTZERANNAHME" / „angenommen, nicht gemessen" →
  „Vorläufige Modellannahme: 0; Nutzereingabe erforderlich". Prüfabsicht
  unverändert. `W-7d2/d3` neu ergänzt.
- Alle übrigen Referenztests aus Chat 2 (`_testDcfEquityBridge`, 44) und Chat 3
  (`_testDcfWorkingCapital`, jetzt 84) unverändert grün.

### Wirkung an Daten
**130 Fixtures, Wertvergleich vorher/nachher** (115 ausgewertet, 15 durch
Scope/Migration blockiert):
- **Haupt-DCF: 0 Wertänderungen** (T-QCE3 nur `undefined` → `null` bei
  weiterhin `applicable:false`).
- **DCF-Anwendbarkeit: 0 Änderungen** — kein Fixture verliert seinen DCF durch
  den Legacy-Ausschluss.
- **Mid-Cycle: 4 Änderungen.** T-MOS-COMPOSE2/3: 6,8367 → 4,2506 (Nettoschulden
  3.000M / 1.000M Aktien = **3,00/Aktie**, jetzt korrekt abgezogen; der
  operative Wert steigt zugleich um 0,4139 durch die einheitliche D&A-Quote
  statt des eingefrorenen TTM-Betrags). T-05/T-DIV1: 6,8367 → 6,8506
  (Brücke 0,40 minus derselbe D&A-Effekt).
- **Fair Value / Buy Price: je 4** — genau die Mid-Cycle-Fixtures.
  **Position/Verdict: 0 Änderungen.**
- **Reverse DCF: 96 Änderungen** — erwartet, andere Größe (Umsatz- statt
  FCF-Wachstum, Brücke statt `net_debt[0]`-Fallback).

**Synthetischer Realfall** (Umsatz 12.000M, +9 %/y, EBIT 22 %, WC 8,94 %,
Nettoschulden 8.000M / 500M Aktien = 16,00/Aktie, Kurs 95):
Haupt-DCF **88,9162 unverändert**; Reverse DCF 7,74 % → **9,75 %**
(1 Nullstelle; Gegenprobe: Wert bei gelöstem g = 94,999784 vs. Kurs 95).

### Offene Einschränkungen
- **`multiple_solutions` ist eine Absicherung ohne erreichbaren Fall.** Ein
  Raster-Scan über WC-Quoten 0–300 % und tg 0/2/3/5 % fand keine nicht-monotone
  Wertkurve: das Gate `r.total > 0` schneidet den Bereich ab, in dem der Wert
  wieder steigen könnte. Der Zweig ist implementiert und durch Inspektion
  belegt, aber nicht durch einen Live-Fall getestet.
- **Reverse DCF löst nur `growth_stage1`** (auftragsgemäß). Marge, WACC oder
  Terminalwachstum zu lösen wäre ein eigener Auftrag.
- **`reverseDcfReported`/`reverseDcfOwner`** bleiben auf REPORTED-FCF-Basis:
  Der SBC-Vergleich verlangt zwei FCF-Größen; im FCFF-Kern steckt SBC bereits im
  EBIT, ein „Owner"-Abschlag wäre dort nicht definierbar. Beide sind als
  Diagnose gekennzeichnet und speisen weder Headline noch Synthese.
- **Mid-Cycle normalisiert nur die Marge**, nicht CapEx/D&A separat: die
  CapEx-Quote ist im Kern ohnehin derselbe 10-Jahres-Median wie in
  `computeMidCycleFcf`; D&A folgt jetzt der Kern-Definition (Median-Quote) statt
  des TTM-Betrags. Das ist die Ursache des +0,4139-Effekts oben.
- `dcfCore` bleibt als toter, gekennzeichneter Code stehen (nicht entfernt, um
  den Diff klein zu halten).
- WC-Vereinfachung des Anfangsbestands unverändert (jetzt ausgewiesen);
  `short_term_debt` weiterhin ohne eigenes Schemafeld.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet.
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand für Chat 5
- **Branch:** `claude/eager-bardeen-l53hvv` (basiert auf
  `claude/dcf-working-capital`, Commit aef1b34 — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **775 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); `short_term_debt` als eigenes Schemafeld;
  Reverse DCF für weitere Parameter; Playwright für die zwei DOM-Formulartests.

---

## Update (Chat 3 Abschluss): Operatives Working Capital im Haupt-DCF

**Auftrag:** Den Haupt-DCF um operatives Working Capital ergänzen und die
Cashflow-Definition eindeutig machen.

### Befund am Code (vor der Änderung)
`forecastDcfCore()` bildete `FCF = NOPAT + D&A − CapEx`. Die Veränderung des
operativen Working Capital fehlte vollständig — im Prognosepfad wie im
Terminalübergang (`lastFcf × (1+tg)`). Ein Feld `short_term_debt` existiert im
Schema nicht; verfügbar sind `current_assets`, `current_liabilities`,
`cash_and_equivalents`/`cash`, `total_debt`, `long_term_debt`.

### Änderungen (Produktdatei)
1. **`_computeOwcHistory(f)` / `_resolveOwcForForecast(mj)` (neu):**
   `OWC = (current_assets − cash) − (current_liabilities − short_term_debt)`,
   `short_term_debt = total_debt − long_term_debt`. Zahlungsmittel und
   verzinsliche Finanzschulden sind ausgeschlossen — sie stehen in der
   Nettoschuldenbrücke aus Chat 2 und wären sonst doppelt erfasst.
   Verwendet werden nur **lückenlose Jahre ab Index 0** (Abbruch beim ersten
   unvollständigen Jahr), Median ab `OWC_MIN_YEARS = 3`.
2. **Prognoseparameter `valuation.assumptions.owc_pct_of_revenue`** (% vom
   Umsatz), manuell überschreibbar. Priorität: Override → historischer Median
   → Nutzerannahme erforderlich. Eingabefeld `#as-owc` im Assumptions-Tab
   inkl. Hinweistext (`_owcAssumptionHint`), Schema-Default, `ASS_FIELDS`,
   Formular-Binding und `source_type: manual`-Synchronisation.
3. **`forecastDcfCore()`:** `FCFF = EBIT × (1−t) + D&A − CapEx − ΔOWC` mit
   `ΔOWC_t = owcRatio × (Umsatz_t − Umsatz_{t−1})`. Bestand `OWC_0 =
   owcRatio × Umsatz_0`, damit kein einmaliger Aufholeffekt in Jahr 1 entsteht.
4. **Terminaljahr konsistent:** `ΔOWC_T = owcRatio × Umsatz_10 × tg`, der
   Terminal-FCFF wird aus dem *WC-freien* Teil (`lastPreWcFcf × (1+tg)`) minus
   `ΔOWC_T` gebildet. Ein bloßes `FCFF_10 × (1+tg)` schriebe die WC-Bindung bei
   g10 in die Ewigkeit fort. Bei `owcRatio = 0` rechnerisch identisch zum
   bisherigen Ausdruck — kein Verhaltensbruch.
5. **Fehlende Daten ≠ 0:** ohne belastbare Basis `available:false`,
   `measured:false`, `assumptionRequired:true`, Warnung „NUTZERANNAHME, KEIN
   gemessener Nullbedarf" und Nennung der fehlenden Felder. Der Forecast rechnet
   dann mit ΔOWC = 0, aber nie als Messwert ausgewiesen.
6. **Cashflow-Definition vs. Diskontsatz (`_classifyLegacyDcfCashflow`, neu):**
   `modelDcf` deklariert jetzt `_cashflowDefinition`, `_cashflowIsUnlevered`,
   `_discountRateBasis`, `_netDebtBridgeApplied`,
   `_cashflowDefinitionConsistent`. Der Legacy-Pfad (`f.fcf` = CFO − CapEx,
   nachfinanziert) und der Mid-Cycle-Pfad (unlevered, ohne Wertbrücke und ohne
   ΔWC) werden als **nicht definitionskonsistent** markiert und mit Warnung
   versehen, statt still denselben WACC zu teilen. `modelDcfMidcycle` übergibt
   dazu `{ definition: 'unlevered_midcycle' }` (neuer 4. Parameter
   `fcfStartMeta`, rückwärtskompatibel).
7. **SBC vs. Verwässerung:** am Code geprüft — SBC steckt bereits im GAAP-EBIT
   und wird im FCFF nicht erneut abgezogen; die Verwässerung wirkt
   ausschließlich über die Aktienprojektion im Nenner; `_computeOwnerFcfDcf`
   bleibt Diagnose ohne Einfluss auf Fair Value/Buy Price; es gibt keinen
   SBC-MoS-Zuschlag. **Bereits korrekt — durch Tests abgesichert** (W-10) und
   über `_sbcDeductedFromFcff` / `_dilutionTreatment` explizit gemacht.
8. **Nachgelagerte Anzeigen:** `buildSensitivityMatrix` und `runMonteCarloDcf`
   speisen sich aus `buildForecastInputs` und übernehmen ΔOWC automatisch; die
   Matrix nennt die verwendete Quote bzw. kennzeichnet die 0-Annahme.

### Pflicht-Tests (unabhängig nachgerechnet)
Referenz: Umsatz0 1.000M, EBIT-Marge 20 %, Steuer 25 %, D&A 5 %, CapEx 5 %
(⇒ FCFF vor ΔWC = 15 % vom Umsatz), g1 = 10 %, WACC 10 %, 100M Aktien.

| Pflichtfall | Erwartet | Ergebnis |
|---|---|---|
| Umsatz 1.000 → 1.100, WC/Umsatz 20 % | ΔWC = 20,0M | 20,0M ✅ |
| ⤷ Wert je Aktie | 28,1818 (statt 30,00) | 28,1818 ✅ |
| Negative Quote (−20 %) bei Wachstum | setzt Geld frei, 31,8182 | 31,8182 ✅ |
| Nullwachstum, konstante Quote | ΔWC = 0 in allen 10 Jahren + Terminal | exakt 0 ✅ |
| Referenzfall Chat 2 mit WC = 0 (ND 0 / 500 / −200) | 15,00 / 10,00 / 17,00 | identisch ✅ |
| Terminaljahr tg = 3 % | ΔWC_T = 15,5625M, EV 3.439,6104M | identisch ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (Commit 8c2f7f8) | 606 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **688 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |

Neu: `_testDcfWorkingCapital()` — **82 Assertions**, alle grün, im Runner als
Pflichtfunktion registriert. Stabilität der beiden stochastischen
Monte-Carlo-Assertions über 8 Läufe geprüft (Abweichung ≤ 0,015 bei Toleranz
0,60).

**Keine bestehende Testerwartung wurde geändert.** Gegenprobe: alle 130
Fixtures liefern vor und nach der Änderung **bitgleiche** DCF- und
Synthesis-Werte (Vergleichsskript über `_runSingleFixture`). Grund: kein
Fixture enthält die für die OWC-Ableitung nötigen Bilanzdaten (119 ohne
`current_assets`/`current_liabilities`, 8 zusätzlich ohne `revenue`, 3 ohne
`long_term_debt`) — sie laufen in den ausgewiesenen Annahmefall ΔWC = 0. T-BRL1
ist unverändert (identische Assertion-Ergebnisse).

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| ΔWC im Forecast entfernt (Ausgangsdefekt) | 9 Assertions rot (W-2d/e/g/h, W-3c, W-6d, W-8d/d2, W-8i) |
| Naiver Terminalübergang `FCFF_10 × (1+tg)` | 10 Assertions rot (u.a. W-6c/e/f) |
| Fehlende Daten als „gemessene 0" ausgewiesen | 2 Assertions rot (W-7b/c) |
| Cash nicht aus dem OWC ausgeschlossen | 9 Assertions rot (W-1b/c/e/f/i, W-8a/g) |

**Wirkungsnachweis an realistischen Daten** (synthetischer Wachstumsfall,
Umsatz 12.000M, +9 %/y): abgeleitete Quote 11,46 % aus 4 lückenlosen Jahren
(unabhängig nachgerechnet: Median aus 11,67/12,38/10,87/11,25 %), ΔWC Jahr 1
123,8M, Terminal 81,4M; Fair Value 91,01 → **87,69** USD/Aktie (−3,33).

### Offene Einschränkungen
- **Kurzfristige Finanzschulden** werden aus `total_debt − long_term_debt`
  abgeleitet; ein eigenes Feld existiert im Schema nicht. Fehlt
  `long_term_debt` bei `total_debt > 0`, gilt das Jahr als unvollständig.
  Ein eigenes `short_term_debt`-Feld inkl. SEC-Mapping wäre ein eigener Auftrag.
- **`OWC_0 = owcRatio × Umsatz_0`** statt Ist-Bestand: bewusst, um einen
  einmaligen Aufholeffekt zu vermeiden. Wer den Ist-Bestand als Startpunkt will,
  bekommt in Jahr 1 eine zusätzliche Anpassung — fachlich diskutabel, hier
  nicht umgesetzt.
- **Legacy-/Mid-Cycle-Pfad:** Cashflow-Definition wird jetzt ausgewiesen und
  als inkonsistent markiert, aber **nicht korrigiert**. `CFO − CapEx` mit CoE
  statt WACC zu diskontieren bzw. den Mid-Cycle-Pfad um Wertbrücke und ΔWC zu
  erweitern, wäre eine eigene Verhaltensänderung — nicht Gegenstand dieses
  Auftrags.
- Kein Fixture deckt die OWC-Ableitung ab; die Absicherung erfolgt
  ausschließlich über `_testDcfWorkingCapital` mit synthetischen Daten.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet; das neue
  Feld `#as-owc` ist in `_syntheticIds`/`_ensureInput` ergänzt, aber wie die
  übrigen Felder nur im Browser real prüfbar.
- Keine automatische Quartalsbeschaffung (auftragsgemäß).
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand für Chat 4
- **Branch:** `claude/dcf-working-capital` (basiert auf
  `claude/dcf-net-debt-bridge`, Commit 8c2f7f8 — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **688 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); `short_term_debt` als eigenes Schemafeld;
  Diskontsatz-Konsistenz des Legacy-/Mid-Cycle-Pfades; Playwright für die zwei
  DOM-Formulartests.

---

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
