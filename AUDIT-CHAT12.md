# Audit (Chat 12) — US-Aktienbewertungstool

**Geprüfter Stand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/ttm-share-period-fixes`, geprüfter Commit
`3544bcfbd78d739805c778065bf2b3f48996876d` (Codecommit `b5559df`, V1.0.57) —
der neueste auf GitHub gespeicherte Stand dieses Branches; `main` steht
weiterhin auf `b023dc8` und enthält keinen der Vorschritte.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Auditbranch: `claude/dreamy-cray-kc8x6o`. Testbefehl: `npm test`.

**Produktcode wurde in diesem Auftrag nicht geändert.** Ergänzt wurden
ausschließlich Tests (`tests/audit-chat12.test.mjs`, `tests/audit-chat12.mjs`)
und diese Auswertung.

---

## 0 · Bearbeitungsstand der Befunde

| Befund | Status | Erledigt in |
|---|---|---|
| A-1 | **behoben** | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-2 | **behoben** | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-3 | **behoben** | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-4 | **offen** | — (Nachweis `B5` bleibt als Fehlernachweis grün) |
| A-5 | **offen** | — (Nachweis `B6` bleibt als Fehlernachweis grün) |
| A-6 | **offen** | — (Nachweis `B7` bleibt als Fehlernachweis grün) |
| A-7 | **offen** | — (Nachweis `B8` bleibt als Fehlernachweis grün) |
| O-1 bis O-3 | **unverändert offen** | nicht bestätigt, nicht angefasst |

Die Nachweise `B1`–`B4` (A-1, A-2, A-3) wurden in Korrekturchat 12A in
**Regressionstests des richtigen Verhaltens** umgewandelt (`R1`–`R9` in
`tests/audit-chat12.test.mjs`). `B5`–`B8` bleiben ausdrücklich
Befund-Nachweise: die zugehörigen Befunde sind offen.

---

## 1 · Tatsächlich geprüfter Umfang

Geprüft wurden die **End-zu-Ende-Aufrufwege** der Bewertung, nicht nur
einzelne Hilfsfunktionen:

| Weg | geprüfte Einstiegspunkte |
|---|---|
| Haupt-DCF | `modelDcf` → `buildCoreValuationContext` → `forecastDcfCore` → `coreValuationDetail` |
| DCF Mid-Cycle | `modelDcfMidcycle` → `computeMidCycleFcf` → `modelDcf` |
| Sensitivitätsmatrix | `computeSensitivityMatrix` / `buildSensitivityMatrix` |
| Reverse DCF | `solveReverseDcfGrowth`, `computeReverseDcf`, `computeReverseDcfFull`, `buildReverseDcfOverviewCard`, `buildReverseDcfDiagnosticBlock` |
| Simulation | `runMonteCarloDcf` / `buildMcDiagBlock` |
| Anzeigeweg | `buildValuationDiagnosticBlocks` (eine Sicht für Matrix, Simulation, Reverse-DCF-Karte) |
| Datenbasis | `buildValuationBasisView`, `buildTtmDataset`, `buildTtmFlowSeries`, `buildTtmInstantSeries`, `buildTtmShareBasis` |
| Bilanz/Brücke | `_resolveNetDebtForDcfBridge`, `_computeOwcHistory`, `_resolveOwcForForecast`, `_resolveDaForForecast`, Debt-Komponenten-Rebuild |
| Snapshot | `buildSnapshotForecastTargets`, `compareSnapshotForecastToActual` |
| Engine | `runValuationEngine`, `buildScenarios`, Synthesizer-Zuschläge (MoS) |

**Nicht geprüft** (Grenzen dieses Audits, siehe Abschnitt 4): kein Live-Abruf
bei SEC/Yahoo, keine Browser-/DOM-Prüfung, keine Prüfung der
Nicht-DCF-Modelle (RIM, DDM, EPV, P/TBV-Gordon, Excess Return) über die
Nettoschuldenfrage hinaus, keine Prüfung der Sektor-/Klassifikationstabellen
und keine Laufzeit- oder Sicherheitsprüfung.

### Ausgeführte Tests

| Lauf | Ergebnis |
|---|---|
| `npm test` auf `3544bcf` (Baseline, selbst ausgeführt) | 1700 Rechen-Assertions · 434 Fixture-Assertions · 148 Node-Tests · **Exit 0** |
| `npm test` nach Ergänzung der Audittests | 1700 Rechen-Assertions · **162 Node-Tests** (148 + 14 neu) · **Exit 0** |
| `npm test` nach Korrekturchat 12A (A-1/A-2/A-3 behoben, B1–B4 → R1–R9) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **167 Node-Tests** · **Exit 0** |

Keine bestehende Testerwartung wurde geändert. Die neuen Tests sind in zwei
Gruppen getrennt:

* **A1–A5 (Referenz)** — Erwartungswerte unabhängig nachgerechnet, sichern
  richtiges Verhalten ab.
* **B1–B8 (Befund-Nachweis)** — halten eine bestätigte Abweichung als Messwert
  fest. Sie behaupten **nicht**, dass das Verhalten richtig ist; jeder Test
  nennt im Kommentar den Befund und die Erwartung, die nach der Korrektur
  gelten muss.
* **R1–R9 (Regression, ergänzt in Korrekturchat 12A)** — ersetzen `B1`–`B4`,
  nachdem A-1, A-2 und A-3 behoben sind, und sichern das richtige Verhalten ab.
  `B5`–`B8` bleiben unverändert Befund-Nachweise der weiterhin offenen
  Befunde A-4 bis A-7.

---

## 2 · Bestätigte Befunde

### A-1 · Reverse-DCF-Karte der Bewertungsansicht: andere Cashflow-Definition und stiller Nettoschulden-Nullwert

* **Status: BEHOBEN** in Korrekturchat 12A (V1.0.58).
  `buildReverseDcfDiagnosticBlock()` rechnet jetzt auf `coreReverseDcf` —
  demselben FCFF-Kern, derselben wirksamen Margenbasis und derselben
  Nettoschuldenbrücke (`_resolveNetDebtForDcfBridge()`) wie Haupt-DCF und
  Übersichtskarte. Die eigenständige `calculateImpliedGrowth()`-Rechnung auf
  `f.fcf[0]` und die Zeile „0 (angenommen)" sind entfallen; unbekannte
  Nettoschulden ergeben einen erklärten Nichtverfügbarkeitsstatus statt einer
  Zahl. Die Reported-/Owner-FCF-Diagnosen bleiben erhalten, aber unter der
  eigenen Überschrift „Getrennte Diagnose auf REPORTED-FCF-Basis (CFO − CapEx)"
  mit dem Basis-Hinweis. Regressionstests `R7`, `R8`; im Browser geprüft.
* **Schweregrad:** hoch (Prioritäten 2, 3)
* **Funktion:** `buildReverseDcfDiagnosticBlock()` (Z. 17415 ff.), aufgerufen
  aus `buildValuationDiagnosticBlocks()` (Z. 21510) und gerendert in
  `renderValuation()` (Z. 21902).
* **Nachweis:** Test `B3`. Datensatz: `total_debt[0] = 2.000`,
  `cash_and_equivalents[0] = 0`, `net_debt` nicht besetzt, Kurs 12.
  `_resolveNetDebtForDcfBridge()` leitet 2.000M (= 20 USD/Aktie) ab.
  * Reverse-DCF-**Übersichtskarte** (Kern): **+10,80 %**
  * Reverse-DCF-**Karte der Bewertungsansicht**: **−4,66 %**, Zeile
    „Netto-Schulden (Mio.): 0 (angenommen)"
* **Auswirkung:** Zwei widersprüchliche „Market-Implied Growth"-Zahlen in
  derselben Anwendung (15,5 pp Unterschied). Die Karte rechnet auf
  `f.fcf[0]` (CFO − CapEx, nachfinanziert) statt auf FCFF, ohne ΔWC, ohne
  Fade, ohne Aktienprojektion — und unterstellt Nettoschulden 0, obwohl sie
  ableitbar sind. Genau die Regel „fehlende Daten gelten NICHT als 0", die
  `computeReverseDcf()` seit V1.0.36 einhält, ist hier verletzt. Der
  vorhandene Warntext `fcfBasisNote` erreicht diese Karte nie, weil sie
  `computeReverseDcfFull()` gar nicht aufruft.
* **Empfehlung:** Die Karte auf `computeReverseDcfFull(mj).coreReverseDcf`
  umstellen (wie die Übersichtskarte). Nettoschulden ausschließlich über
  `_resolveNetDebtForDcfBridge()` beziehen und bei `available: false` den
  Block sperren statt 0 zu unterstellen. Die FCF-Zahl höchstens noch als
  ausdrücklich beschriftetes SBC-Diagnosepaar mit `fcfBasisNote` zeigen.

### A-2 · Mid-Cycle-Marge erreicht Simulation, Snapshot und gespeicherten Reverse DCF nicht

* **Status: BEHOBEN** in Korrekturchat 12A (V1.0.58). Neue gemeinsame
  Auflösung `resolveEffectiveMarginBasis(mj, v)` + `coreOptsFromMarginBasis()`
  im Kernblock, mit derselben Vorrangregel wie `normalizeDcfCoreInput()`:
  aufgelöster Stand (`v._coreOpts`, trägt den manuellen Override) → tatsächlich
  gerechnetes DCF-Modell → Mid-Cycle-Median bei reinem `dcf_midcycle`-Router →
  Szenariomarge. `runValuationEngine()` löst EINMAL auf der bewerteten
  FY-/TTM-Sicht auf und führt den Stand als `_coreOpts` mit;
  `computeSensitivityMatrix()`, `runMonteCarloDcf()` und
  `buildSnapshotForecastTargets()` lesen ihn, statt je eigene Logik zu
  verwenden. Der gespeicherte `reverseDcfImpliedGrowth` entsteht aus demselben
  Stand. Ein gewählter Mid-Cycle-Pfad ohne ableitbaren Median ergibt überall
  denselben erklärten Status — kein stiller Rückfall auf die Ist-Marge.
  Der Snapshot speichert zusätzlich die Herkunft (`op_margin_basis`,
  `op_margin_basis_source`, `op_margin_override_pct`,
  `op_margin_pct_scenario`), damit der spätere Soll-Ist-Vergleich gegen den
  wirklich bewerteten Pfad messen kann. Regressionstests `R1`–`R6`;
  im Browser geprüft.
* **Schweregrad:** hoch (Prioritäten 3, 5)
* **Funktionen:** `runMonteCarloDcf()` (Z. 17124: `buildCoreValuationContext(mj, {})`),
  `buildSnapshotForecastTargets()` (liest `scenarios.base.op_margin_pct`),
  `runValuationEngine()` (Z. 15252: `computeReverseDcf(_basisView)` ohne Opts).
* **Nachweis:** Tests `B1`, `B2`. Zyklischer Datensatz, Ist-Marge 30 %,
  Mid-Cycle-Median 15 %, `sub_classification: 'cyclical'`:

  | Größe | Wert | Margenbasis |
  |---|---|---|
  | Haupt-DCF (`modelDcfMidcycle`) | **12,27** | 15 % (Median) |
  | Sensitivitätsmatrix, zentrale Zelle | 12,27 | 15 % ✅ |
  | Monte-Carlo-Median (Seed 4242, 2.000 Läufe) | **30,18** | 30 % ❌ |
  | Snapshot-Prognose FCFF Jahr 1 | **236,25** | 30 % ❌ (konsistent wären 118,125) |
  | `valuation.reverseDcfImpliedGrowth` | 0,12 % | 30 % ❌ |

* **Auswirkung:** In der Bewertungsansicht stehen ein Fair Value von 12,27 und
  ein Simulationsmedian von 30,18 nebeneinander — die Simulation trägt dabei
  ausdrücklich den Hinweis „dieselbe Cashflow-Definition … wie im Haupt-DCF".
  Diese Zusage trifft für die Margenbasis nicht zu. Der Snapshot speichert
  Prognoseziele, die der gespeicherten Bewertung nicht entsprechen; der spätere
  Soll-Ist-Vergleich (`compareSnapshotForecastToActual`) misst damit gegen
  einen Pfad, der nie bewertet wurde. Betroffen ist der gesamte
  `cyclical`-Pfad (einziger Mid-Cycle-Zweig, Z. 3107).
* **Empfehlung:** Die wirksame Margenbasis einmal auflösen — wie
  `normalizeDcfCoreInput()` es an der Modulgrenze bereits tut — und als
  `_coreOpts` (`opMarginOverridePct`, `marginBasis`) an `runMonteCarloDcf`,
  `buildSnapshotForecastTargets` und `solveReverseDcfGrowth` durchreichen.
  `modelDcfMidcycle()` erzeugt den Wert bereits in `fcfStartMeta`; er muss nur
  in `valuationResult` mitgeführt werden.

### A-3 · Reverse-DCF-Übersichtskarte sperrt anhand einer fremden Cashflow-Größe

* **Status: BEHOBEN** in Korrekturchat 12A (V1.0.58).
  `coreReverseDcf = solveReverseDcfGrowth(mj, opts)` entsteht jetzt als Erstes
  in `computeReverseDcfFull()` — vor allen FCF-Gates — und wird in JEDEM
  Rückgabepfad mitgeführt, auch im Stub `_notApplicableReverseDcf()` und im
  Financials-Zweig. Neue Felder: `coreAvailable`, `reportedFcfGateBlocked`,
  `reportedFcfGateReason`; der Basis-Hinweis liegt als
  `REVERSE_DCF_FCF_BASIS_NOTE` an einer Stelle und erreicht damit auch die
  gesperrten Pfade. Die Gates (`fcf0M` fehlend/≤ 0/`fcfDataSuspect`) wirken nur
  noch auf `applicable`/`reverseDcfReported`/`reverseDcfOwner` — die eigene
  Voraussetzung dieser Diagnose. Beide Anzeigen scheitern nur noch am
  Kernstatus und zeigen einen Kernwert ausschliesslich bei `core.ok`.
  Regressionstest `R9` (fehlendes FCF, negatives FCF, `fcfDataSuspect`,
  Financials), `R8` (unbekannte Nettoschulden); im Browser geprüft.
* **Schweregrad:** hoch (Prioritäten 3, 6)
* **Funktion:** `computeReverseDcfFull()` (Z. 42415 ff.) bricht bei
  `fcf0M == null || fcf0M <= 0` (ebenso bei fehlendem Kurs/WACC/tg und bei
  `fcfDataSuspect`) über `_notApplicableReverseDcf()` ab — **bevor**
  `coreReverseDcf = solveReverseDcfGrowth(mj)` (Z. 42525) gebildet wird.
  `buildReverseDcfOverviewCard()` liest ausschließlich `rdcf.coreReverseDcf`.
* **Nachweis:** Test `B4`. Referenzfirma ohne `f.fcf`:
  `solveReverseDcfGrowth()` liefert `status: 'ok'`, +5,00 %; der Haupt-DCF ist
  anwendbar. Die Übersichtskarte zeigt trotzdem
  „nicht berechenbar · FCF₀ fehlt — Reverse DCF nicht berechenbar".
* **Auswirkung:** Eine funktionierende Kernrechnung wird durch eine Sperre
  verdeckt, die zu einer anderen Cashflow-Definition gehört. Praktisch
  relevant für jede TTM-Sicht, in der `cfo` nicht als TTM-Größe gedeckt ist
  (dann entsteht `fcf` in `buildValuationBasisView()` gar nicht), und für jeden
  manuellen Import ohne `fcf`. Die Sperrbegründung ist zudem irreführend, weil
  die angezeigte Zahl `f.fcf` nie benutzt.
* **Empfehlung:** `coreReverseDcf` vor den FCF-Gates berechnen und in **allen**
  Rückgabepfaden (auch `_notApplicableReverseDcf`) mitführen. Die Gates auf
  `reverseDcfReported`/`reverseDcfOwner` beschränken; die Übersichtskarte darf
  nur am Kernstatus scheitern.

### A-4 · Kurzfristige Finanzschulden nur als Restgröße — kippt Working Capital und Fair Value

* **Schweregrad:** hoch (Prioritäten 1, 4)
* **Funktion:** `_computeOwcHistory()` (Z. 3943–3955, Bestand in Z. 3961):
  `std = total_debt[i] − long_term_debt[i]`. Das separat extrahierte Feld
  `debt_short_term` (und `debt_long_term_current`, `finance_lease_current`)
  wird nicht gelesen. Auslöser ist die Tag-Kette
  `SEC_TAG_MAP.total_debt = ['LongTermDebtAndCapitalLeaseObligations','LongTermDebt','DebtAndCapitalLeaseObligations']`
  (Z. 24663): fällt sie auf `LongTermDebt`, ist `total_debt` mit
  `long_term_debt` identisch und die Restgröße 0.
* **Nachweis:** Test `B5`. Identische Bilanz (UV 400, Zahlungsmittel 100,
  kurzfristige Verbindlichkeiten 500 davon 300 Finanzschulden, LTD 700,
  `debt_short_term[0] = 300`), einziger Unterschied `total_debt`:

  | `total_debt` | kurzfr. Finanzschulden | OWC | Quote | Nettoschulden | **Fair Value** |
  |---|---|---|---|---|---|
  | 700 (= `LongTermDebt`) | 0 („gemessen") | −200 | **−20 %** | 600 | **25,26** |
  | 1.000 (vollständig) | 300 | 100 | **+10 %** | 900 | **19,62** |

* **Auswirkung:** Zwei Fehler in dieselbe Richtung: die Nettoschulden sind um
  die kurzfristigen Schulden zu niedrig, **und** die Working-Capital-Quote
  kippt ins Negative, sodass Wachstum im Modell Mittel *freisetzt* statt
  bindet. Ergebnis +28,7 % Fair Value, ausgewiesen als „historischer Median
  … gemessen aus Bilanzdaten" — ohne jede Warnung und ohne Hinweis auf den
  Widerspruch zu `debt_short_term[0] = 300`.
* **Empfehlung:** Kurzfristige Finanzschulden vorrangig aus
  `debt_short_term` + `debt_long_term_current` (+ `finance_lease_current`)
  period-keyed bilden; die Restgröße nur als Rückfall und dann ausdrücklich
  als abgeleitet kennzeichnen. Zusätzlich eine Plausibilitätssperre:
  `total_debt ≤ long_term_debt` bei gleichzeitig vorhandenem
  `debt_short_term > 0` ist ein Datenwiderspruch und keine gemessene Null.

### A-5 · Verwässerung endet im Terminalwert bei Jahr 10

* **Schweregrad:** mittel (Prioritäten 2, 5)
* **Funktion:** `forecastDcfCore()` (Z. 4380):
  `buybackAdjPvTvPerShare = pvTvAbs / sharesYear[10]`. Bei
  `sharesGrowthPa > 0` ist das der Hauptwert.
* **Nachweis:** Test `B6`. Verwässerung 8 %/y (die Clamp-Obergrenze aus
  `buildForecastInputs`), g1 = 0 %, tg = 2 %, WACC 10 %:
  * Terminalwert je Aktie im Modell: **2,7112**
  * bei fortlaufender Verwässerung (effektives Wachstum je Aktie
    (1+tg)/(1+d) − 1): **1,2911** → Faktor **2,10**
  * Gesamtwert je Aktie 7,91 statt 6,49 (**+22 %**); Terminalwertanteil 34 %.
* **Auswirkung:** Bei dauerhaft verwässernden Geschäftsmodellen (SBC-lastig)
  ist der Fair Value systematisch zu hoch. Die Anzeige weist die Verwässerung
  als „im Hauptwert berücksichtigt" aus und nennt die Begrenzung auf Jahr 10
  nicht — der bestehende Warntext trennt nur Verwässerung und
  Nettoschuldenbrücke.
* **Empfehlung:** Entweder den Terminalwert je Aktie mit der effektiven Rate
  (1+tg)/(1+d) − 1 rechnen (lokale, reversible Änderung in `forecastDcfCore`,
  wirkt auf alle vier Pfade gleichzeitig, weil sie denselben Kern nutzen),
  oder die Begrenzung ausdrücklich als Vereinfachung ausweisen — analog zu
  `OWC_STOCK_SIMPLIFICATION_NOTE`.

### A-6 · `computeMidCycleFcf()` setzt fehlende Abschreibungen still auf 0

* **Schweregrad:** niedrig (Priorität 5)
* **Funktion:** `computeMidCycleFcf()` (Z. 11285):
  `daTtm = (ebitda[0] != null && ebit[0] != null) ? ebitda[0] − ebit[0] : 0`.
* **Nachweis:** Test `B7`. Gleicher Datensatz, nur `ebitda[0] = null`:
  Referenz-FCF **100** statt 150, `status: 'ok'`.
* **Auswirkung:** Nur Anzeige und die 30-%-Abweichungswarnung — der
  Bewertungspfad selbst ist über `_resolveDaForForecast()` gesperrt, wenn D&A
  gar nicht messbar ist. Der Widerspruch zur erklärten V1.0.56-Regel
  („ein unbelegter Nullwert ist keine Messung") bleibt aber und kann eine
  falsche Abweichungswarnung auslösen.
* **Empfehlung:** `_resolveDaForForecast(mj)` verwenden; bei
  `assumptionRequired` `status: 'insufficient_data'` mit Begründung liefern.

### A-7 · Buyback-Sicherheitszuschlag greift im Mid-Cycle-Pfad nie

* **Schweregrad:** niedrig (Priorität 2)
* **Funktion:** Synthesizer Z. 16285:
  `valuationResult.modelResults['dcf'] || valuationResult.modelResults['DCF']`.
  Für `cyclical` läuft der DCF unter dem Schlüssel `dcf_midcycle`
  (`router.activeModels`, Z. 3107; `_runModel` schreibt `results[key]`).
* **Nachweis:** Test `B8`. Zyklischer Datensatz mit −8 %/y Rückkäufen:
  `_buybackUpliftPct = 94,4 %` (Schwelle für +10 pp MoS ist 25 %), der
  Zuschlag bleibt aus, weil `modelResults['dcf']` nicht existiert.
* **Auswirkung:** Bei zyklischen Titeln mit starker Rückkaufabhängigkeit
  entfällt der Sicherheitszuschlag stillschweigend — die Einstiegszone ist
  weniger konservativ als vorgesehen.
* **Empfehlung:** Den Schlüssel `dcf_midcycle` in die Suche aufnehmen (eine
  Zeile), oder den Uplift generisch aus dem aktiven DCF-Modell des Routers
  beziehen.

---

## 3 · Offene Prüfpunkte (nicht bestätigt)

### O-1 · Mögliche Doppelzählung laufender Fälligkeiten im Debt-Komponenten-Rebuild

`SEC_TAG_MAP.debt_long_term_noncurrent` (Z. 24668) enthält an dritter Stelle
`LongTermDebt`. Dieses us-gaap-Konzept schließt die laufenden Fälligkeiten
ein. `debt_long_term_current` (`LongTermDebtCurrent`) liegt in einer anderen
Alias-Gruppe, sodass die Dedup-Logik in
`buildPeriodAlignedComponentSeries()` (Z. 6991 ff.) nicht greift. Bei einem
Filer, der `LongTermDebt` und `LongTermDebtCurrent` meldet, aber kein
`LongTermDebtNoncurrent`, würde der Rebuild die laufenden Fälligkeiten doppelt
zählen und (bei Abweichung > 5 %) den direkten Wert ersetzen.
**Nicht bestätigt** — dafür wären echte SEC-Facts eines solchen Filers nötig;
in dieser Sitzung wurde kein Live-Abruf ausgeführt.

### O-2 · Working-Capital-Historie ohne Periodenabgleich

`_computeOwcHistory()` gleicht `revenue` (Zeitraumgröße) und
`current_assets`/`current_liabilities`/`cash`/`total_debt`/`long_term_debt`
(Stichtagsgrößen) ausschließlich über den Array-Index ab — ohne
`_v4_meta.periods` und ohne `_joinPeriodKeyed()`, anders als die
Nettoschuldenbrücke (V1.0.39) und die Bruttomarge (V1.0.52). In der
TTM-Sicht ist die Ausrichtung konstruktionsbedingt gegeben (Fluss- und
Stichtagsreihen entstehen alles-oder-nichts auf demselben Fensterraster).
Für die FY-Sicht nach einem Komponenten-Rebuild mit abweichender
Jahresabdeckung wurde **kein** reproduzierender Datensatz konstruiert.

### O-3 · Randfälle der Nullstellensuche im Reverse DCF

In `solveReverseDcfGrowth()` (Z. 4757–4771):
(a) Die Intervallhalbierung legt auch nach `if (vm == null) break` über
`pushRoot((lo + hi) / 2)` eine Nullstelle ab — der zurückgegebene Wert wäre
dann das Intervallmittel ohne Nachweis, obwohl der Kommentar „kein
belastbarer Wert" lautet.
(b) Vorzeichenwechsel zwischen einem auswertbaren und einem nicht
auswertbaren Rasterpunkt werden übersprungen (`a == null || b == null`
→ `continue`), was zu `no_solution_in_range` trotz existierender Lösung
führen könnte.
**Nicht bestätigt:** Ich konnte keinen Datensatz konstruieren, der einen der
beiden Pfade auslöst — der Gordon-Terminalwert dominiert und hält den
Wertverlauf über dem gesamten Suchbereich monoton, auch bei hoher
Working-Capital-Quote und niedriger Marge (geprüft mit owcRatio 15 %,
Marge 0,8–10 %, Kursen 1–12).

---

## 4 · Was dieses Audit *nicht* belegt

* Es ist **keine Bestätigung**, dass der Rest des Tools fehlerfrei ist. Der
  geprüfte Umfang steht in Abschnitt 1; alles darüber hinaus ist ungeprüft.
* Keine Prüfung an echten SEC- oder Marktdaten: alle Nachweise beruhen auf
  synthetischen Datensätzen mit von Hand nachgerechneten Erwartungswerten.
  Damit sind Tag-Auswahl, Einheiten und Periodenzuordnung realer Filings
  (Priorität 4) nur so weit geprüft, wie sie sich aus dem Code ergeben —
  siehe O-1.
* Keine Browser-/DOM-Prüfung. Die beiden DOM-Tests
  (`_testManualAssumptionOverride`, `_testMarketDataOverrides`) bleiben
  ausgewiesen übersprungen; die Anzeigepfade wurden über die
  HTML-erzeugenden Funktionen geprüft, nicht im gerenderten Zustand.
* Die Nicht-DCF-Modelle (RIM, RIM-Buyback, DDM, EPV-Floor, P/TBV-Gordon,
  Excess Return) wurden nicht auf innere Konsistenz geprüft.
* Die Gewichtung im Synthesizer, die Einstiegszonen-Logik und die
  Datenqualitäts-Gates wurden nur dort berührt, wo Befund A-7 sie betrifft.
* Bestehende Tests und HANDOFF-Erfolgsmeldungen wurden als Behauptungen
  behandelt: die Baseline (1700/148, Exit 0) habe ich auf `3544bcf` selbst
  ausgeführt und bestätigt. Die Aussage „Haupt-DCF, Reverse DCF und
  Sensitivitätsmatrix nutzen denselben Kern" trifft für `modelDcf`,
  `computeSensitivityMatrix` und `solveReverseDcfGrowth` zu (Tests A4/A5),
  **nicht** für die beiden Reverse-DCF-Anzeigen (A-1, A-3), die Simulation
  und die Snapshot-Prognose im Mid-Cycle-Pfad (A-2).
