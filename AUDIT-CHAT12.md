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

**Endstand nach Korrekturchat 12C (V1.0.63).** Die Spalte *Art* unterscheidet,
was tatsächlich geschehen ist — ein behobener Rechen- oder Logikfehler, eine
offengelegte Modellannahme oder ein abgesicherter Prüfpunkt. Die Bezeichnung
„behoben" wird **nur** für nachweislich falsches Verhalten verwendet.

| Befund | Status | Art | Erledigt in |
|---|---|---|---|
| A-1 | **behoben** | Fehler behoben | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-2 | **behoben** | Fehler behoben | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-3 | **behoben** | Fehler behoben | Korrekturchat 12A, V1.0.58, Branch `claude/chat12a-dcf-consistency` |
| A-4 | **behoben** | Fehler behoben | Korrekturchat 12B (V1.0.59), **berichtigt** in 12B.1 (V1.0.60, Branch `claude/chat12b1-debt-scope-fixes`) |
| A-5 | **offengelegt, NICHT wegkorrigiert** | Modellannahme offengelegt | Korrekturchat 12C, V1.0.63 (`R33`) |
| A-6 | **behoben** | Fehler behoben | Korrekturchat 12C, V1.0.63 (`R34`) |
| A-7 | **behoben** | Fehler behoben | Korrekturchat 12C, V1.0.63 (`R35`) |
| O-1 | **bestätigt und behoben** | Fehler behoben | Korrekturchat 12B (V1.0.59), **erweitert** in 12B.1 (V1.0.60) |
| O-2 | **bestätigt und behoben** | Fehler behoben | Korrekturchat 12B (V1.0.59), Nachweis in 12B.1 auf fachlich passende Daten umgestellt |
| O-3 (b) | **bestätigt und behoben** | Fehler behoben | Korrekturchat 12C, V1.0.63 (`R36`, Fall A/B) |
| O-3 (a) | **nicht mit Daten erreichbar, defensiv abgesichert** | Absicherung ohne belegten Fehlerfall | Korrekturchat 12C, V1.0.63 (`R36`, Fall D) |

**Was A-5 ausdrücklich NICHT ist.** A-5 wurde **nicht** numerisch beseitigt.
Die Rechnung ist bit-genau unverändert (in `R33` gegen die auf V1.0.62
gemessenen Referenzzahlen geprüft). Geändert wurde ausschließlich, dass die
zugrunde liegende Annahme benannt und mitgeführt wird. Ob eine dauerhaft
fortgesetzte Verwässerung für ein bestimmtes Unternehmen die richtige Annahme
wäre, ist damit **nicht** entschieden — bei anhaltend verwässernden
Geschäftsmodellen bleibt der Wert je Aktie tendenziell zu hoch. Das ist eine
offengelegte Modellvereinfachung, kein geschlossener Befund.

**Weiterhin offen.** Alle in Abschnitt 4 genannten Prüfgrenzen des Audits
bleiben bestehen; sie wurden in 12A–12C nicht geschlossen. Insbesondere: kein
Live-Abruf bei SEC/Yahoo, kein reales Filing, keine Prüfung der Nicht-DCF-
Modelle auf innere Konsistenz, keine Prüfung der Sektor-/
Klassifikationstabellen, keine Laufzeit- oder Sicherheitsprüfung. Die
Browser-Prüfungen in 12B.3 und 12C sind **punktuell** und decken nur die
jeweils geänderten Anzeigen ab — keine Prüfung der gesamten Oberfläche.

Die Nachweise `B1`–`B4` (A-1, A-2, A-3) wurden in Korrekturchat 12A in
**Regressionstests des richtigen Verhaltens** umgewandelt (`R1`–`R9` in
`tests/audit-chat12.test.mjs`). `B5` (A-4) wurde in Korrekturchat 12B ebenso
umgewandelt — in `R10`–`R15`, die zusätzlich O-1 und O-2 absichern. In
Korrekturchat 12C wurden `B6`, `B7` und `B8` ersetzt: `B6` → `R33` (Test der
erklärten Modellkonvention und ihres sichtbaren Hinweises), `B7` → `R34`,
`B8` → `R35` (über den echten Engine-/Synthesizer-Pfad statt einer
nachgebildeten Schlüsselauswahl). **Damit enthält `tests/audit-chat12.test.mjs`
keinen Charakterisierungstest mehr**; alle Tests dieser Datei prüfen richtiges
Verhalten. Einzige Einordnung: `R33` prüft eine offengelegte Annahme, keine
Wertkorrektur.

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
| `npm test` nach Korrekturchat 12B (A-4/O-1/O-2 behoben, B5 → R10–R15) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **172 Node-Tests** · **Exit 0** |
| `npm test` nach Korrekturchat 12B.1 (Schuldenumfang berichtigt, R12/R14/R15 korrigiert, R16–R20 neu) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **177 Node-Tests** · **Exit 0** |
| `npm test` nach Korrekturchat 12B.2 (Schuldenauflösung als Gleichungssystem, R21–R27 neu) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **184 Node-Tests** · **Exit 0** |
| `npm test` nach Korrekturchat 12B.3 (Nichtnegativität im Solver, R28–R32 neu) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **189 Node-Tests** · **Exit 0** |
| `npm test` nach Korrekturchat 12C (A-5 offengelegt, A-6/A-7 behoben, O-3 abgesichert; B6–B8 → R33–R36) | 1700 Rechen-Assertions · 434 Fixture-Assertions · **190 Node-Tests** · **Exit 0** |

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
* **R33–R36 (Regression, ergänzt in Korrekturchat 12C)** — sie ersetzen
  `B6`–`B8`: `R33` (A-5: erklärte Terminalannahme der Aktienprojektion samt
  sichtbarem Hinweis, Herkunfts- und Snapshotinformation; Rechnung
  unverändert), `R34` (A-6: direkte Werte, echte Null, zulässige Ableitung,
  gesetzte Annahme, widersprechende Perioden, Nichtverfügbarkeit),
  `R35` (A-7: echter Engine-/Synthesizer-Pfad, Schwellen unterhalb/auf/
  oberhalb, nicht anwendbares DCF-Modell, kein doppelter Zuschlag, Fair Value
  unverändert), `R36` (O-3: Nullstelle im Lückenintervall wird gefunden und
  nachgerechnet, unvollständige Suche wird als solche gemeldet,
  Bereichsgrenzen und Nichtverfügbarkeit, Robustheit gegen einen künstlich
  eingespeisten Funktionsfehler).
* **R28–R32 (Regression, ergänzt in Korrekturchat 12B.3)** — die
  Nichtnegativitätsprüfung des Solvers: `R28` (unmögliche Aufteilung ⇒
  Widerspruch, inkl. Engine-/Synthesizer-Pfad), `R29` (belegte Gesamtschuld 0),
  `R30` (Teilbetrag 0 belegt nur seine eigenen Bestandteile), `R31`
  (Mehrdeutigkeit, Bestimmtheit trotz offener Einzelzellen, Rundung),
  `R32` (dieselbe Korrektur in der TTM-Auflösung).
* **R21–R27 (Regression, ergänzt in Korrekturchat 12B.2)** — die fünf
  Restbefunde nach 12B.1: `R21` (zusammengefasste langfristige Beträge),
  `R22` (TTM umgeht die Sperre nicht), `R23` (noncurrent-Teilbeträge sind
  keine Gesamtschuld), `R24` (bekannte Überschneidungen werden aufgelöst),
  `R25` (widersprüchliche Aufschlüsselungen), `R26` (kein Gewicht und keine
  Einstiegszone für gesperrte DCF-Werte), `R27` (wiederholte Aufbereitung).
  `R12`–`R18` wurden dabei auf **vollständig dokumentierte** Datensätze
  umgestellt; die Ausnahme für noncurrent-Teilbeträge in `R16` ist
  **berichtigt**.
* **R16–R20 (Regression, ergänzt in Korrekturchat 12B.1)** — sichern die
  berichtigten Tag-Umfänge ab: `R16` (Restgröße zweier noncurrent-Tags ist
  langfristiges Leasing), `R17` (Leasing-Aufschlüsselung ändert nichts),
  `R18` (unklare Gesamtschuld ⇒ Nichtverfügbarkeitsstatus), `R19` (TTM-Herkunft
  bleibt erhalten), `R20` (eine gemeinsame Semantiktabelle). `R12`, `R14` und
  `R15` wurden dabei **inhaltlich berichtigt**: ihre bisherigen Erwartungen
  beruhten auf den falschen Umfangsannahmen.
* **R10–R15 (Regression, ergänzt in Korrekturchat 12B)** — ersetzen `B5`,
  nachdem A-4 behoben ist, und sichern zusätzlich die bestätigten und
  behobenen Prüfpunkte O-1 und O-2 ab. `R12`–`R15` laufen über den
  **produktiven Importweg** (`_extractWithFallback` → `_applySecDerivations`
  → `_buildSecMasterJson` → `applyDerivedFieldsV4`), also über dieselbe
  Kette wie der Live-Abruf, statt über von Hand gebaute `fundamentals`.
  `B6`–`B8` bleiben unverändert Befund-Nachweise der weiterhin offenen
  Befunde A-5 bis A-7.

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

* **Status: BEHOBEN** in Korrekturchat 12B (V1.0.59). Der Befund wurde
  zunächst am unveränderten Code reproduziert und anschließend über den
  **produktiven Importweg** als echter Importfehler nachgewiesen — nicht nur
  als synthetisch inkonsistenter Datensatz (siehe „Ursache am Importpfad"
  unten). Neu ist `_resolveShortTermDebtHistory()` im `DCF-CORE-BLOCK`:
  die kurzfristigen Finanzschulden entstehen vorrangig aus den gemeldeten
  Komponenten (`debt_short_term` + laufende Fälligkeiten + laufendes
  Finanzierungsleasing), überschneidungsbewusst nach den tatsächlichen
  Tag-Definitionen. Die Restgröße `total_debt − long_term_debt` ist nur noch
  ein ausdrücklich als **abgeleitet** gekennzeichneter Rückfall und nur dort
  zulässig, wo Umfang **und** Stichtag zusammenpassen. Regressionstests
  `R10`–`R15`; im Browser geprüft.
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

#### Ursache am Importpfad (Korrekturchat 12B)

Der Auditfall wurde zunächst unverändert reproduziert (Restgröße 0 „gemessen",
OWC −20 %, Fair Value +28,7 %). Anschließend wurde geprüft, ob der Importweg
diese Konstellation überhaupt erzeugt. Dazu wurden synthetische SEC-Facts
durch die **produktive Kette** geschickt (`_extractWithFallback` →
`_applySecDerivations` → `_buildSecMasterJson` → `applyDerivedFieldsV4`).
Ergebnis:

| Fall | Filing-Tags | Verhalten vor der Korrektur |
|---|---|---|
| Rebuild greift | `LongTermDebt` 700 + `ShortTermBorrowings` 300 | `total_debt` wird auf 1.000 zurückgebaut — **kein** Fehler |
| **ST-Anteil < 5 %** | `LongTermDebt` 700 + `ShortTermBorrowings` 20 | Rebuild-Schwelle greift nicht ⇒ `total_debt = 700`, Restgröße 0 „gemessen", obwohl `debt_short_term[0] = 20` für **dieselbe** Periode vorliegt |
| **Komponente nur im aktuellen Jahr** | `ShortTermBorrowings` nur FY2025 | Jahr 0 richtig, Jahre 1–3 als 0 „gemessen"; der Median kippt ins Negative |
| **Komponente veraltet** | `ShortTermBorrowings` nur FY2024–FY2022 | Für den aktuellen Stichtag liegt nichts vor; Restgröße 0 galt trotzdem als Messung |

Damit ist A-4 ein **nachgewiesener Importfehler**, kein bloß synthetisch
inkonsistenter Datensatz.

> **BERICHTIGUNG (Korrekturchat 12B.1).** Der ursprünglich hier festgehaltene
> Satz „alle drei Tags der Kette `SEC_TAG_MAP.total_debt` sind *langfristige*
> Schuldkonzepte; keines enthält kurzfristige Bankschulden" ist **falsch**.
> `DebtAndCapitalLeaseObligations` umfasst kurz- **und** langfristige Schulden
> einschließlich Leasing. Ebenso falsch war, `LongTermDebtAndCapitalLeaseObligations`
> als Gesamtwert *einschließlich* laufender Fälligkeiten zu behandeln — es
> erfasst ausschließlich **noncurrent** klassifizierte Beträge. Die daraus
> gebildete Restgröße `LongTermDebtAndCapitalLeaseObligations −
> LongTermDebtNoncurrent` ist deshalb das **langfristige Leasing** und keine
> kurzfristige Finanzschuld. Die korrigierte Fassung steht in Abschnitt 3a.

Richtig bleibt: wenn `total_debt` und `long_term_debt` auf **dasselbe** Tag
fallen (`LongTermDebt` ist Kettenplatz 2 bzw. 1), ist die Restgröße
strukturell 0 und nie eine Messung.

#### Was geändert wurde

* **neu** `_resolveShortTermDebtHistory(f)` und `_secSourceTag(meta)` im
  `DCF-CORE-BLOCK` (nutzen nur bereits deklarierte Helfer aus
  `DCF_CORE_REQUIRED_HELPERS`; die Isolationsprüfung bleibt grün).
  Vorrang je Berichtsperiode:
  1. **gemeldete Komponenten** ⇒ `status: 'measured'`,
  2. **Restgröße** `total_debt − long_term_debt`, nur bei nachweislich
     passendem Umfang ⇒ `status: 'derived'`,
  3. **belegte Null** (`total_debt = 0`) ⇒ gemessene 0,
  4. sonst **unbekannt mit Begründung** — das Jahr gilt als unvollständig.
* **Überschneidungen nach Tag-Definition**, statt pauschaler Addition:
  `us-gaap:DebtCurrent` enthält die laufenden Fälligkeiten bereits, also wird
  `debt_long_term_current` dann *nicht* zusätzlich addiert;
  `ShortTermBorrowings`/`CommercialPaper` decken sie nicht ab, also schon;
  `FinanceLeaseLiabilityCurrent` ist ein eigenes Konzept und wird addiert —
  außer die als laufende Tranche verwendete Restgröße enthält es bereits
  (`LongTermDebtAndCapitalLeaseObligations`).
* **Belegte Null, fehlender Wert und Widerspruch bleiben getrennt.** Ein
  Widerspruch zwischen Komponenten und Restgröße erzeugt keinen scheinbar
  gemessenen Wert mehr: die gemeldeten Komponenten haben Vorrang, und die
  Abweichung wird als `shortTermDebtDiscrepancyM` geführt und im
  Bewertungsausweis genannt.
* **Gleiche Schuldenbasis für OWC und Nettoschulden.** Der
  Komponenten-Rebuild ersetzt den direkten `total_debt`-Wert jetzt auch
  unterhalb der 5-%-Schwelle, wenn das direkte Tag den Umfang der verwendeten
  Komponenten nachweislich nicht abdecken kann. Bleibt eine Lücke bestehen
  (Restgröße als laufende Tranche *und* separat gemeldete kurzfristige
  Bankschulden), wird ausdrücklich ausgewiesen, dass die Nettoschuldenbrücke
  insoweit mit einer zu niedrigen Gesamtverschuldung rechnet.
* **Altdaten ohne Periodenmetadaten** (manueller Import) behalten den
  Positionsbezug; er wird als `status: 'derived'` und `periodKeyed: false`
  kenntlich gemacht. Ohne Metadaten wird die Restgröße **nicht** zusätzlich
  zu einer gemeldeten Komponente addiert — sonst entstünde eine
  Doppelzählung.

### A-5 · Verwässerung endet im Terminalwert bei Jahr 10

> **Erledigt in Korrekturchat 12C (V1.0.63) — als OFFENGELEGTE
> MODELLVEREINFACHUNG, nicht als behobene Überbewertung.** Gewählt wurde die
> zweite der beiden unten empfohlenen Möglichkeiten. Die Rechnung bleibt
> unverändert (Aktienprojektion in der zehnjährigen Detailphase, ab dem
> Terminalzeitpunkt konstante Aktienzahl); die Annahme wird jetzt benannt,
> maschinenlesbar mitgeführt und in Herkunfts- und Snapshotinformationen
> festgehalten. Siehe Abschnitt 3d. **Der Fair Value ist dadurch nicht
> gesunken** — bei dauerhaft verwässernden Geschäftsmodellen bleibt er
> tendenziell zu hoch, das ist jetzt nur sichtbar.

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

> **Behoben in Korrekturchat 12C (V1.0.63).** Wie empfohlen über die zentrale
> Auflösung; ein unbelegter Wert liefert jetzt `status: 'insufficient_data'`
> mit Begründung statt einer Zahl. Siehe Abschnitt 3d.

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

> **Behoben in Korrekturchat 12C (V1.0.63).** Wie in der zweiten Empfehlung:
> der Zuschlag stammt aus dem tatsächlich aktiven, anwendbaren DCF-Modell des
> Routers, `dcf_midcycle` eingeschlossen. Schwellen und Zuschlagshöhen sind
> unverändert; der Fair Value bleibt unberührt. Siehe Abschnitt 3d.

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

## 3 · Prüfpunkte

### O-1 · Doppelzählung laufender Fälligkeiten im Debt-Komponenten-Rebuild

* **Status: BESTÄTIGT und BEHOBEN** in Korrekturchat 12B (V1.0.59).

**Ausgangsvermutung (Chat 12).** `SEC_TAG_MAP.debt_long_term_noncurrent`
enthält an dritter Stelle `LongTermDebt`. Dieses us-gaap-Konzept schließt die
laufenden Fälligkeiten ein. `debt_long_term_current` (`LongTermDebtCurrent`)
liegt in einer anderen Alias-Gruppe, sodass die Dedup-Logik in
`buildPeriodAlignedComponentSeries()` nicht greift.

**Reproduktion am echten Parser-/Rebuild-Pfad.** Ein synthetischer
SEC-Facts-Fall wurde durch die produktive Kette geschickt. Dieselbe
wirtschaftliche Lage — langfristige Schulden 1.000, davon 100 laufend —
in zwei zulässigen Tag-Darstellungen:

| Darstellung | `total_debt` vorher | `total_debt` nachher |
|---|---|---|
| `LongTermDebt` 1.000 + `LongTermDebtCurrent` 100 | **1.100** ❌ | 1.000 ✅ |
| `LongTermDebtNoncurrent` 900 + `LongTermDebtCurrent` 100 | 1.000 ✅ | 1.000 ✅ |

Die laufende Tranche wurde also doppelt gezählt, und die Nettoschulden
unterschieden sich um 100M, obwohl die Bilanz identisch ist. Mit zusätzlich
gemeldeten `ShortTermBorrowings` 50 ergaben beide Darstellungen vorher 1.100
bzw. 1.050 und jetzt übereinstimmend **1.050**. Regressionstest `R13`.

**Korrektur.** Ein `lt_noncurrent`-Wert, der aus `LongTermDebt` stammt, belegt
in `buildPeriodAlignedComponentSeries()` jetzt **beide** Alias-Gruppen
(`lt_noncurrent` *und* `lt_current`) für seine Perioden; solche Felder werden
zuerst verarbeitet. Das Gegenstück auf der kurzfristigen Seite ist ebenfalls
behandelt: `us-gaap:DebtCurrent` enthält die laufenden Fälligkeiten bereits
und belegt deshalb ebenfalls `lt_current`. Treffen `DebtCurrent` und
`LongTermDebt` aufeinander (beide enthalten die laufende Tranche) und ist
`LongTermDebtCurrent` **nicht** gemeldet, ist die Überschneidung nicht
auflösbar: die Periode wird verworfen und der direkte Wert bleibt stehen —
statt eine scheinpräzise Summe zu bilden.

**Nachtrag Korrekturchat 12B.1.** Die Auftragsvorgabe (FASB-Taxonomie 2025)
bestätigt die Trennung `LongTermDebtCurrent` / `LongTermDebtNoncurrent` und
damit die hier vorgenommene Korrektur. Sie berichtigt zugleich die in 12B
zusätzlich getroffene Annahme über
`LongTermDebtAndCapitalLeaseObligations` — siehe Abschnitt 3a. Der
Primärquellenabruf war auch in 12B.1 nicht möglich.

**Verbleibende Unsicherheit — ausdrücklich benannt.** Die Tag-Semantik
(`LongTermDebt` = gesamte langfristige Verschuldung **einschließlich** der
laufenden Fälligkeiten, `LongTermDebtCurrent` + `LongTermDebtNoncurrent` =
`LongTermDebt`) konnte in dieser Sitzung **nicht an der primären Quelle**
belegt werden: `xbrl.fasb.org`, `www.fasb.org`, `www.sec.gov` und
`data.sec.gov` sind vom Egress-Proxy dieser Umgebung gesperrt (HTTP 403 auf
CONNECT), ein Live-Abruf war nicht möglich. Die Definition stützt sich daher
auf **sekundäre Quellen** (übereinstimmende Wiedergaben der
FASB-Dokumentationsbeschriftung) sowie auf zwei Argumente aus dem Code
selbst, die unabhängig von der Taxonomie tragen:

1. Die Ketten `long_term_debt = ['LongTermDebt','LongTermDebtNoncurrent',…]`
   und `debt_long_term_noncurrent = ['LongTermDebtNoncurrent',…,'LongTermDebt']`
   behandeln `LongTermDebt` und `LongTermDebtNoncurrent` bereits als
   austauschbar; gleichzeitig steht `LongTermDebt` in der `total_debt`-Kette
   als Stellvertreter für die **Gesamt**verschuldung. Beides kann nicht
   zugleich gelten.
2. Unabhängig davon, welche Lesart richtig ist, lieferten zwei zulässige
   Tag-Darstellungen derselben Bilanz vorher **unterschiedliche**
   Gesamtschulden. Das ist für sich ein Fehler.

Ein realer Filing-Fall wurde **nicht** geprüft, weil kein Netzzugriff auf
SEC-Daten bestand. Was fehlt, ist damit die Bestätigung an echten Facts eines
Filers, der `LongTermDebt` und `LongTermDebtCurrent` ohne
`LongTermDebtNoncurrent` meldet. Sollte sich die Tag-Semantik entgegen allen
verfügbaren Quellen anders darstellen, wäre die Korrektur an genau einer
Stelle zurückzunehmen (`_coversCurrentMaturities()` in
`buildPeriodAlignedComponentSeries()` und `DEBT_TAG_SCOPE`).

### O-2 · Working-Capital-Historie ohne Periodenabgleich

* **Status: BESTÄTIGT und BEHOBEN** in Korrekturchat 12B (V1.0.59).

**Ausgangsvermutung (Chat 12).** `_computeOwcHistory()` glich `revenue`
(Zeitraumgröße) und `current_assets`/`current_liabilities`/`cash`/
`total_debt`/`long_term_debt` (Stichtagsgrößen) ausschließlich über den
Array-Index ab — ohne `_v4_meta.periods` und ohne `_joinPeriodKeyed()`.
Chat 12 konnte dafür keinen reproduzierenden Datensatz konstruieren.

**Reproduktion.** Ein Filer mit einer Lücke in `LongTermDebtNoncurrent`
(FY2024 fehlt) erzeugt über den echten Importweg Reihen unterschiedlicher
Länge an derselben Position:

```
total_debt      [FY2025, FY2024, FY2023, FY2022] = 1000, 900, 800, 700
long_term_debt  [FY2025,         FY2023, FY2022] =  700,      500, 400
```

Die Indexverknüpfung bildete für Position 1 `900 (FY2024) − 500 (FY2023) = 400`
und für Position 2 `800 (FY2023) − 400 (FY2022) = 400`. Beide Werte sehen
plausibel aus, mischen aber **zwei Geschäftsjahre** — ohne Warnung, obwohl
`_v4_meta.periods` beider Reihen den Widerspruch ausweist. Richtig wäre:
FY2025 = 300, FY2024 unbestimmbar. Regressionstest `R14`.

**Korrektur.** `_computeOwcHistory()` verknüpft jetzt periodengetreu:

* Die Stichtagsgrößen laufen über `_joinPeriodKeyed()` (dieselbe
  Periodenlogik wie Nettoschuldenbrücke und Bruttomarge), geführt von
  `current_liabilities`.
* Die **Zeitraumgröße Umsatz** wird über das Geschäftsjahr des Periodenendes
  zugeordnet und zusätzlich mit `_secPeriodDaysApart()` gegen den
  Bilanzstichtag geprüft (max. 45 Tage) — so werden Zeitraum- und
  Stichtagsgröße einander zugeordnet, ohne sie im Join zu vermischen.
* Jedes Jahr trägt sein `period`-Kennzeichen; `periodKeyed: true` weist den
  Modus aus.
* **Bestehende Regel für Altdaten bleibt:** ohne jeden Periodenkontext
  (manueller Import) gilt weiterhin der Positionsbezug. Er ist ausdrücklich
  kenntlich (`periodKeyed: false`, `status: 'derived'`). Trägt ein einzelnes
  Feld keine Periodenmetadaten, während die übrigen periodengetreu laufen,
  wird der erzwungene Rückfall auf die Position als Warnung ausgewiesen.

## 3a · Korrekturchat 12B.1 — Schuldenumfang, Leasing, unklare Nettoschulden

Nach Abschluss von 12B wurden drei Fehler festgestellt, die alle auf derselben
Ursache beruhen: **falsche Annahmen über den fachlichen Umfang der
us-gaap-Schulden-Tags**.

### Quellenlage (wahrheitsgemäß)

Grundlage sind die Dokumentationsdefinitionen der **FASB-Taxonomie 2025**
(`us-gaap-doc-2025.xml`). Der Abruf der Primärquelle war **in dieser Sitzung
nicht möglich**: `xbrl.fasb.org` (ebenso `www.fasb.org`, `www.sec.gov`,
`data.sec.gov`) wird vom Egress-Proxy dieser Umgebung gesperrt (HTTP 403 auf
CONNECT), sowohl über `curl` als auch über den Seitenabruf. Die Definitionen
stammen daher aus der **Auftragsvorgabe**; sie wurden hier **nicht selbst an
der Quelle geprüft**. Maßgeblich verwendet:

| Tag | Umfang laut Vorgabe |
|---|---|
| `LongTermDebtAndCapitalLeaseObligations` | noncurrent klassifizierte Schulden **und** Leasingverpflichtungen |
| `DebtCurrent` | current klassifizierte Schulden **einschließlich** Leasingverpflichtungen |
| `DebtAndCapitalLeaseObligations` | kurz- **und** langfristige Schulden einschließlich Leasing |
| `LongTermDebtNoncurrent` | noncurrent klassifizierte Schulden **ohne** Leasing |
| `LongTermDebtCurrent` | current klassifizierter Anteil langfristiger Schulden **ohne** Leasing |

### Das gemeinsame Umfangsmodell (V1.0.60)

Statt Merkmalsflags (`currentPortion`, `leases`) wird der Umfang als **Menge
von Bilanzzellen** geführt — `DEBT_TAG_CELLS`, die **einzige** Semantikquelle
für Komponenten-Rebuild *und* `_resolveShortTermDebtHistory()`:

| Zelle | Bedeutung |
|---|---|
| `stBorrow` | originär kurzfristige Bankschulden / Commercial Paper |
| `ltCurMat` | laufende Fälligkeiten langfristiger Schulden |
| `debtNC` | langfristige Schulden (ohne Leasing) |
| `leaseCur` | kurzfristige Leasingverpflichtungen |
| `leaseNC` | langfristige Leasingverpflichtungen |

Damit sind beide Rechenschritte entscheidbar:

* **Addition** ist zulässig, wenn die Zellmengen **disjunkt** sind.
* **Subtraktion** A − B ist zulässig, wenn cells(B) eine **echte Teilmenge**
  von cells(A) ist; das Ergebnis belegt genau cells(A) \ cells(B).

Gleicher Stichtag allein genügt also nicht mehr — der Umfang muss die gesuchte
Größe tatsächlich bestimmen. Die kurzfristigen Finanzschulden des Working
Capital sind genau `{stBorrow, ltCurMat, leaseCur}`.

### Befund 1 · Restgröße aus zwei noncurrent-Tags

`LongTermDebtAndCapitalLeaseObligations` 1.000 − `LongTermDebtNoncurrent` 700
ergab 300 „kurzfristige Finanzschulden" und daraus eine als **gemessen**
ausgewiesene OWC-Quote von +10 %. Beide Tags belegen aber **keinen**
kurzfristigen Betrag; die Differenz ist das **langfristige Leasing**.

**Korrigiert:** Die Subtraktion liefert `{leaseNC}` — keine Zelle der
kurzfristigen Finanzschulden. Da weder die laufende Tranche noch das
kurzfristige Leasing gemeldet oder ableitbar sind, bleibt der Betrag
**unbekannt**; die OWC-Historie bricht ab und die bestehende ausdrückliche
Kennzeichnung fehlender OWC-Daten greift (`assumptionRequired`,
`model_provisional_default`) — **keine** neue stille Nullannahme.
Regressionstest `R16`.

### Befund 2 · Leasingdoppelzählung

Dieselbe Bilanz, einmal ohne und einmal mit zusätzlicher Aufschlüsselung:

| | ohne `FinanceLeaseLiabilityCurrent` | mit (50, in `DebtCurrent` enthalten) |
|---|---|---|
| Gesamtschulden | 1.000 | **1.050** ❌ |
| kurzfristige Finanzschulden | 300 | **350** ❌ |
| Nettoschulden | 900 | **950** ❌ |
| OWC-Quote | 10 % | **15 %** ❌ |
| Fair Value (`scOf(8, 2, 10, 20)`) | 19,61913 | **18,67980** ❌ |

**Korrigiert:** `DebtCurrent` deckt `{stBorrow, ltCurMat, leaseCur}` ab;
`FinanceLeaseLiabilityCurrent` `{leaseCur}` ist eine **Teilmenge** und wird
weder im Rebuild noch im Resolver erneut addiert. Alle fünf Größen sind jetzt
in beiden Darstellungen identisch. Tatsächlich **disjunkte** Komponenten
werden weiterhin addiert (`ShortTermBorrowings` + `LongTermDebtCurrent` +
`FinanceLeaseLiabilityCurrent` = 450). Regressionstest `R17`.

### Befund 3 · Unklare Gesamtschulden ergaben eine verfügbare Brücke

`LongTermDebt` 1.000 (`{ltCurMat, debtNC}`) und `DebtCurrent` 150
(`{stBorrow, ltCurMat, leaseCur}`) überschneiden sich in der laufenden
Tranche; deren Höhe ist nicht gemeldet. Die wahre Gesamtschuld liegt zwischen
1.000 und 1.150. Der Rebuild erkannte die Überschneidung und verwarf die
Periode — ließ aber `total_debt = 1.000` **ungekennzeichnet** stehen. Die
Brücke meldete `available: true`, `netDebtM: 900`, der DCF einen konkreten
Eigenkapitalwert.

**Korrigiert:**

* Der Rebuild kennzeichnet den Wert als **Teilbetrag**
  (`_v4_meta.total_debt.scopeIndeterminate` mit Begründung).
* `_resolveNetDebtForDcfBridge()` liefert dann einen begründeten
  **Nichtverfügbarkeitsstatus**. Ein bereits **abgeleitetes** `net_debt`
  umgeht die Sperre nicht.
* **Eigenständig belegte oder manuell gesetzte** Nettoschulden
  (`source_type: 'reported'`) bleiben unverändert zulässig.
* Der **operative Unternehmenswert** bleibt getrennt ausgewiesen
  (29,94/Aktie); der Eigenkapitalwert entfällt. Da `applicable: false` und
  `base: null`, übergeht der Synthesizer das Modell (Filter auf
  `applicable && base != null`) — es wird **nicht** gewichtet und geht **nicht**
  in die Einstiegszone ein. Haupt-DCF, Mid-Cycle, Reverse DCF,
  Sensitivitätsmatrix und Monte Carlo tragen denselben Status.

Regressionstest `R18`.

### Verwandte Vollständigkeitslücke

Eine bekannte kurzfristige Bankschuld bei **unbekannten** laufenden
Fälligkeiten war bis V1.0.59 eine vollständig „gemessene" kurzfristige Schuld
mit bloßem Warntext. Jetzt gilt: eine nicht belegte Zelle der kurzfristigen
Finanzschulden macht den Betrag **unbekannt**, sofern sie nicht nachweisbar
leer ist. Nachweisbar leer ist

* jede Zelle, die von einer gemeldeten Angabe mit Wert 0 umfasst wird;
* `ltCurMat`, wenn **keine** langfristigen Schulden > 0 gemeldet sind;
* `leaseCur`, wenn im Abschluss **überhaupt keine** Leasingverpflichtung
  auftaucht;
* `stBorrow`, wenn kein solcher Posten gemeldet ist (unveränderte Lesart: ein
  originär kurzfristiger Posten folgt aus keinem langfristigen Bestand).

Regressionstest `R12`.

### FY und TTM

Die TTM-Sicht schreibt `source_reference` auf „TTM aus normalisierten
Quartalsdaten (…)" um. Damit sah eine TTM-Schuldenreihe aus wie eine Reihe
**ganz ohne Herkunft** und wäre wie ein manueller Altdatensatz behandelt
worden — mit wieder zulässiger Restgröße. Korrigiert:

* `buildValuationBasisView()` führt den ursprünglichen us-gaap-Tag als
  `source_tag` mit (als `source_tag_inherited` gekennzeichnet);
  `_secSourceTag()` liest ihn vorrangig. `_secSourceTag` steht dafür jetzt in
  `DATA_BASIS_REQUIRED_HELPERS`.
* Die **Altdatenregel** gilt nur noch ohne **jeden** Periodenkontext. Eine
  Reihe mit Perioden, deren Umfang unbestimmt ist, ist ausdrücklich **kein**
  Altdatenfall: dort wird nicht ersatzweise subtrahiert.

Regressionstest `R19`.

### Verbleibende Grenzen dieses Schrittes

* **Keine eigene Prüfung der Primärquelle.** Siehe „Quellenlage" oben.
* **Kein realer Filing-Fall.** Alle Nachweise laufen über synthetische
  SEC-Facts durch den produktiven Importweg. Ein Live-Abruf war nicht möglich.
* ~~**Ein noncurrent-only Tag bleibt als Gesamtschuld in Gebrauch.**~~
  **BERICHTIGT in Korrekturchat 12B.2.** Diese Ausnahme war nicht zulässig:
  eine Warnung ersetzt keinen Nichtverfügbarkeitsstatus, und „sonst wäre der
  Fall nicht bewertbar" ist keine tragfähige Begründung. Seit V1.0.61 gilt ein
  nachweislicher Teilbetrag nicht mehr als Gesamtschuld; die
  Nettoschuldenbrücke liefert einen begründeten Nichtverfügbarkeitsstatus.
  Siehe Abschnitt 3b.
* Für `LongTermDebt` selbst enthält die Auftragsvorgabe keine Definition;
  verwendet wird `{ltCurMat, debtNC}` (langfristige Schulden einschließlich
  laufender Tranche, ohne Leasing) — die Lesart, auf der bereits O-1 beruht.

---

## 3b · Korrekturchat 12B.2 — Schuldenauflösung und TTM-Sperren

Nach 12B.1 blieben fünf Restbefunde. Alle fünf haben dieselbe Ursache: der
Umfang wurde zwar je Tag richtig beschrieben, die **Zusammenführung** der
Angaben war aber ein Nacheinander von „belegt oder übersprungen" statt einer
Auflösung.

### Quellenlage (wahrheitsgemäß)

Maßgeblich bleibt die Taxonomiebasis aus 12B.1 (FASB-Taxonomie 2025). Der
Abruf der Primärquelle `https://xbrl.fasb.org/us-gaap/2025/elts/us-gaap-doc-2025.xml`
war **auch in diesem Schritt nicht möglich** (Egress-Proxy: HTTP 403 auf
CONNECT). Die Definitionen stammen aus der Auftragsvorgabe und sind hier
**nicht selbst an der Quelle geprüft**. Alle Nachweise sind **synthetische
Importtests** über den produktiven Pfad — **keine Live-Validierung** und kein
reales Filing.

### Die Auflösung als Gleichungssystem

Jede gemeldete Angabe ist eine Gleichung „Summe ihrer Zellen = Wert"
(`_solveDebtEvidence`). Die gesuchte Größe — kurzfristige Finanzschulden oder
Gesamtverschuldung — ist genau dann bestimmt, wenn ihr Zellvektor im
**Zeilenraum** des Systems liegt. Damit entscheidet die nachgewiesene
**Abdeckung**, nicht das Vorhandensein irgendeines Zahlenwerts; Reihenfolge,
„größerer Wert", Prozentabweichung und die Anzahl vorhandener Komponenten
spielen keine Rolle mehr. Bilanzbestandteile sind nicht negativ — daraus
folgen zwei prüfbare Widersprüche (ein enthaltener Teilbetrag größer als die
Gesamtheit; ein rechnerisch negativer Zellwert). Toleranz: 0,01 % der größten
Angabe, mindestens 1e-6.

Rebuild, kurzfristige Finanzschulden und Nettoschuldenbrücke verwenden
**dieselbe** Evidenz (`_resolveDebtHistory` mit unterschiedlichem Ziel).

### Die fünf Befunde

| # | Datensatz | vorher | nachher |
|---|---|---|---|
| **1** | `LTD&Cap` 1.000 + `DebtCurrent` 300 vs. `Noncurrent` 700 + `FLNoncurrent` 300 + `DebtCurrent` 300 | 1.000 / ND 900 / FV ~19,61913 **gegen** 1.300 / ND 1.200 / FV ~16,61913 | **beide 1.300 / ND 1.200 / FV 16,61913** |
| **2** | `LongTermDebt` 1.000 + `DebtCurrent` 150, TTM-Weg | FY gesperrt, **TTM wieder verfügbar** (ND 900) | TTM ebenfalls gesperrt; mit zusätzlicher Quartalsangabe `LongTermDebtCurrent` **aufgelöst** (1.050 / ND 950) |
| **3** | nur `LTD&Cap` 1.000 | ND 900 verfügbar, DCF anwendbar | **ND nicht verfügbar**, kein Eigenkapitalwert, operativer Wert bleibt |
| **4** | `LongTermDebt` 1.000 + `DebtCurrent` 150 + `LongTermDebtCurrent` 100 | „Überschneidung nicht auflösbar" ⇒ gesperrt | **1.050** (1.000 + 150 − 100), ND 950 |
| **5** | `Noncurrent` 700 + `DebtCurrent` 300 + `FLCurrent` **350** | Leasingwert nur übersprungen, alles verfügbar | **Widerspruch erkannt**, Schuldenbasis und Bewertung gesperrt |

**Zu 1.** Der direkte, zusammengefasste Betrag zählt jetzt als Evidenz mit
seinem tatsächlichen Umfang. Disjunkte current-/noncurrent-Angaben werden
vollständig zusammengeführt; eine unvollständige Komponentensumme ersetzt
einen vollständigeren Betrag nicht und verdeckt die fehlende Ergänzung nicht.
Ein direkt gemeldeter vollständiger Gesamtbetrag mit ergänzenden
Aufschlüsselungen zählt nicht doppelt. Test `R21`.

**Zu 2.** Die TTM-Sicht bestimmt den Umfang **für ihren Stichtag selbst**:
* Der us-gaap-Tag stammt aus den **Quartalsdaten** (`used_tag`), nicht blind
  aus der Jahresreihe (in Fall (b) trägt die Jahresreihe nach dem Rebuild gar
  keinen Tag mehr).
* Die FY-Sperre wird **nicht** kopiert — neue Quartalsangaben lösen die
  Unklarheit tatsächlich auf.
* Bleibt sie offen, bleibt die Brücke gesperrt; ein neu abgeleitetes
  `net_debt` entsteht dann gar nicht erst.
* Die Prüfung läuft **nach** dem Leeren der nicht gedeckten Reihen — sonst
  flössen Jahreswerte mit Jahresstichtagen als Evidenz ein.
* Dafür sind die Schuldenkomponenten **optionale** TTM-Stichtagsgrößen
  geworden (`TTM_OPTIONAL_INSTANT_FIELDS`). Fehlen sie, bleibt die TTM-Basis
  wählbar, die Gesamtschuld gilt aber als nicht belegt. Es kommen **keine
  neuen Tags** hinzu. Test `R22`.

**Zu 3.** Die in 12B.1 bewusst belassene Ausnahme ist entfallen. Ergänzt wird
ein Teilbetrag nur, wenn periodengleiche Angaben den fehlenden Umfang
bestimmen; sonst begründete Nichtverfügbarkeit. Die heuristischen
`assumedEmpty`-Regeln aus V1.0.60 sind **ersatzlos entfernt**: eine fehlende
Angabe ist nicht deshalb Null, weil kein Tag gefunden wurde. Ausdrücklich
belegte Nullwerte und eigenständig belegte Gesamtbeträge funktionieren
weiterhin; manuell gesetzte Nettoschulden bleiben nach den bestehenden
Vorrangregeln zulässig. Eine manuelle OWC-Annahme löst eine unklare
Gesamtschuld **nicht** auf. Test `R23`, berichtigt in `R16`.

**Zu 4.** Separat belegte Überschneidungsbeträge werden **vor** der
Entscheidung „nicht auflösbar" verwendet. Reihenfolge und redundante
Aufschlüsselungen ändern das Ergebnis nicht. Fehlt eine **andere** Angabe
(im Beispiel das langfristige Leasing), wird genau das benannt — nicht
fälschlich eine unbekannte Überschneidung. Test `R24`.

**Zu 5.** Vor dem Überspringen einer Aufschlüsselung wird ihre Vereinbarkeit
mit dem übergeordneten Betrag geprüft. Ein ungeklärter materieller
Widerspruch läuft nicht als gemessene Schuldenbasis weiter; die
beeinträchtigten Größen und ihre Bewertungsverbraucher erhalten den
begründeten Status. Konsistente Aufschlüsselungen und ausdrückliche Nullwerte
ändern nichts. Test `R25`.

### Wirkung auf die Bewertung

Ein gesperrter DCF ist `applicable: false` / `base: null` und trägt
`_excludedFromSynthesis`. Der Synthesizer übergeht ihn damit in Gewichtung
und Einstiegszone; Mid-Cycle, Reverse DCF, Sensitivitätsmatrix und Monte
Carlo tragen denselben Status. Der **operative Unternehmenswert** bleibt
getrennt verfügbar. Test `R26`. Wiederholte Aufbereitung ist stabil: keine
vervielfachten Warnungen, keine veraltete Sperre nach behobener Datenlücke
(`R27`).

### Berichtigte Testerwartungen

Mehrere Datensätze beschrieben Filer, die ihre **Gesamtverschuldung** meinten,
sie aber mit einem rein langfristigen Tag auswiesen. Das ist fachlich falsch
und wurde berichtigt, nicht durch gelockerte Toleranzen:

* Die synthetischen Filer in `_testTtmIntegrationFixes`, `_testDataBasis`,
  `_testTtmSharePeriodFixes` und `tests/sec-ttm.test.mjs` verwenden jetzt
  `DebtAndCapitalLeaseObligations` statt
  `LongTermDebtAndCapitalLeaseObligations`. Alle Erwartungswerte bleiben
  unverändert.
* Die Platzhalter-Tags `'test'` / `'Test'` (T-NDLOCK, `_testDataBasis`) haben
  keinen belegbaren Umfang; die Schuldenreihen tragen jetzt das Konzept, das
  sie meinen.
* Die Fixtures `T-DEBT-DEDUP1`–`3` dokumentierten nur die langfristige Seite.
  Sie melden jetzt ausdrückliche Nullwerte für die übrigen Bestandteile — die
  Dedup-Aussage (kein Doppelzählen auf 800) bleibt prüfbar.
* `SEC_QUARTERLY_FIELDS` und `DATA_BASIS_REQUIRED_HELPERS` sind gewachsen;
  beide Listen werden von Tests festgeschrieben und wurden mit Begründung
  aktualisiert.

### Verbleibende Grenzen

* **Keine eigene Prüfung der Primärquelle**, siehe oben.
* **Kein reales Filing.** Alle Nachweise sind synthetische Importtests über
  den produktiven Pfad.
* Eine Bilanz, die einen Bestandteil gar nicht erwähnt, gilt als **nicht
  belegt** — auch dann, wenn der Filer schlicht nichts davon hat. Solche
  Abschlüsse sind ohne ausdrückliche Nullangabe oder ein Gesamt-Tag nicht mehr
  über die Eigenkapitalbrücke bewertbar. Das ist die beabsichtigte Folge von
  Befund 3; der operative Unternehmenswert bleibt verfügbar.
* Für `LongTermDebt` enthält die Auftragsvorgabe die Lesart „einschließlich
  laufender Fälligkeiten, ohne Leasing"; darauf beruht die Auflösung.
* Der `source_tag` der TTM-Sicht stammt jetzt aus den Quartalsdaten. Nennt
  eine TTM-Reihe keinen Tag, wird ersatzweise der Jahres-Tag übernommen und
  ausdrücklich als `source_tag_inherited` gekennzeichnet.

---

## 3c · Korrekturchat 12B.3 — Nichtnegativität im gemeinsamen Schuldensolver

Die fünf Korrekturen aus 12B.2 bleiben unverändert. Hier wurden ausschließlich
zwei Restfehler in `_solveDebtEvidence()` behoben; Import, Taxonomietabelle,
TTM-Aufbereitung und Bewertungsmodelle wurden nicht angefasst.

### Quellenlage (wahrheitsgemäß)

Unverändert die Taxonomiebasis aus 12B.1 (FASB-Taxonomie 2025, aus der
Auftragsvorgabe, **nicht selbst an der Quelle geprüft** — der Egress-Proxy
sperrt `xbrl.fasb.org`). Dieser Schritt ändert keine Tag-Definition; er
betrifft allein die Rechenregel. Alle Nachweise sind **synthetische
Importtests** über den produktiven Pfad, **keine Live-Validierung**.

### Die Ursache

V1.0.61 prüfte nur, ob der Zielvektor im **Zeilenraum** von `A` liegt. Unter
der Nebenbedingung `x ≥ 0` ist das in **beide** Richtungen unzureichend:

| | vorher | fachlich richtig |
|---|---|---|
| **Befund 1** | Ein System ohne zulässige nichtnegative Lösung wurde akzeptiert, solange keine *einzelne* Teilangabe größer als ihre Gesamtangabe war | Widerspruch |
| **Befund 2** | Eine durch die Nichtnegativität eindeutig festgelegte Zielsumme galt als unbekannt | bestimmt |

### Reproduktion am unveränderten Code

**Befund 1** — `DebtAndCapitalLeaseObligations` 100, `LongTermDebtNoncurrent` 70,
`FinanceLeaseLiabilityNoncurrent` 50, periodengleich über vier Jahre. Die
beiden **disjunkten** langfristigen Bestandteile ergeben 120 und übersteigen
die Gesamtschulden von 100; es existiert keine nichtnegative Aufteilung.

| | vorher | nachher |
|---|---|---|
| Gesamtschuld | gilt als vollständig | **nicht vollständig** |
| Nettoschuldenbrücke | verfügbar (0M) | **nicht verfügbar**, mit Begründung |
| kurzfristige Finanzschulden | **−20, Status „measured"** | unbekannt |
| OWC-Quote der Referenzbilanz | **−22 %** | nicht ermittelbar (ausdrücklich gekennzeichnet) |
| `modelDcf(mj, scOf(8, 2, 10, 20))` | anwendbar, **≈ 31,43082** | nicht anwendbar, kein Eigenkapitalwert |
| Widerspruchswarnung | **keine** | nennt beide Bestandteile und die Gesamtangabe |

**Befund 2** — `DebtAndCapitalLeaseObligations` = 0, keine Aufschlüsselung.
Da alle enthaltenen Bestandteile nichtnegativ sind, müssen bei einer belegten
Gesamtsumme von null auch alle Bestandteile null sein.

| | vorher | nachher |
|---|---|---|
| Gesamtschulden | 0 (richtig) | 0 |
| kurzfristige Finanzschulden | **unbekannt** | **belegte 0** |
| `_resolveOwcForForecast()` | `available: false`, `measured: false`, `assumptionRequired: true`, Platzhalter 0 % | `available: true`, `measured: true`, `assumptionRequired: false` |
| OWC-Quote | — | **−20 %** (= ((400 − 100) − (500 − 0)) / 1000) |
| verwertbare Jahre | 0 | **4** |

### Die Korrektur

Die zulässige Menge ist `P = { x ∈ R⁵ : A x = b, x ≥ 0 }`. Für diese feste
kleine Dimension wird sie **vollständig und exakt** beschrieben, statt sie zu
approximieren:

* `P` ist spitz (`x ≥ 0` enthält keine Gerade) ⇒ `P ≠ ∅` genau dann, wenn `P`
  eine **Ecke** besitzt. Ecken sind Basislösungen: Träger `S` mit linear
  unabhängigen Spalten, `x_S` eindeutig und `≥ 0`, `x` außerhalb `S` gleich 0.
* Nach Minkowski/Weyl ist `P = conv(Ecken) + cone(Extremstrahlen)`;
  Extremstrahlen sind Träger mit eindimensionalem Nullraum und
  vorzeichengleichem Erzeuger.
* Beide Mengen entstehen durch Aufzählung **aller 32 Träger** — keine
  Optimierungsbibliothek, keine neue Laufzeitabhängigkeit, kein
  Näherungsverfahren.

Daraus folgt die geforderte Dreiteilung:

1. **keine Ecke** ⇒ keine zulässige Aufteilung ⇒ **Widerspruch**;
2. **Spannweite der Zielsumme über `P` größer als die Toleranz** ⇒ unbekannt;
3. **Spannweite null** ⇒ bestimmt — auch dann, wenn einzelne Zellen offen
   bleiben und der Zeilenraumtest allein nicht ausreicht (Befund 2).

Ergänzt wurde außerdem eine **verallgemeinerte Teilmengenprüfung**: mehrere
*paarweise disjunkte* Teilangaben dürfen zusammen die Gesamtangabe nicht
übersteigen. Die bisherige Prüfung war davon der Sonderfall mit einer einzigen
Teilangabe; genau diese Lücke war Befund 1. Sie liefert die konkrete
Begründung („70,0M + 50,0M = 120,0M übersteigen zusammen … (100,0M)").

Bewusst **nicht** getan: negative Zielwerte lediglich abfangen; negative
Ergebnisse pauschal auf null klemmen; einen beliebigen zulässigen
Lösungspunkt als eindeutige Aufteilung ausgeben. Unbeschränkte oder
mehrdeutige Zielgrößen bleiben unbekannt.

**Toleranz.** Unverändert 0,01 % der größten Angabe, mindestens `1e-6` —
gemeldete Beträge sind auf Millionen gerundet. Sie ist so eng, dass eine
materiell unmögliche Aufteilung nicht durchrutscht: Befund 1 verfehlt die
Zulässigkeit um 20 von 100, also um das 200-fache der Toleranz. Eine
rundungsbedingt leicht negative Zielsumme wird **nicht** geklemmt, sondern aus
der zulässigen Menge genommen, deren Ecken `x ≥ 0` erfüllen.

**Unverändert:** Schnittstelle und Statuskonventionen von
`_solveDebtEvidence()`; die Regeln für eigenständig belegte oder ausdrücklich
manuell gesetzte Nettoschulden; die Altdatenregel; alle fünf Korrekturen aus
12B.2.

### Berichtigte Testerwartung

`R25` prüfte für den Fall „DebtCurrent 300 gegen laufende Fälligkeiten 100 +
kurzfristiges Leasing 250" auf den Wortlaut `unvereinbar` — die generische
Meldung über einen negativen Zellwert. Derselbe Fall wird jetzt von der
**präziseren** Prüfung auf disjunkte Teilangaben gefangen, die beide
Bestandteile und die Gesamtangabe benennt. Der Befund ist unverändert; die
Erwartung akzeptiert nun beide Formulierungen. Die inhaltlichen Zusicherungen
von `R25` (`scopeComplete === false`, Brücke gesperrt, `totalDebt === null`)
sind unverändert.

### Verbleibende Prüfgrenzen

* **Keine eigene Prüfung der Primärquelle**, siehe oben.
* **Kein reales Filing**; synthetische Importtests sind keine Live-Validierung.
* Die Aufzählung ist auf die feste Dimension `n = 5` zugeschnitten. Käme eine
  sechste Bilanzzelle hinzu, bliebe das Verfahren richtig (2⁶ Träger), die
  Laufzeitannahme „vernachlässigbar" wäre aber neu zu prüfen.
* Die Feststellung „`P` ist nichtleer ⇔ `P` hat eine Ecke" gilt, weil alle
  Variablen nach unten durch 0 beschränkt sind. Diese Voraussetzung ist an das
  Zellmodell gebunden und wäre bei vorzeichenfreien Größen nicht gegeben.
* Die Grenzen aus 12B.2 bleiben bestehen — insbesondere gilt eine Bilanz, die
  einen Bestandteil gar nicht erwähnt, weiterhin als **nicht belegt**.

---

## 3d · Korrekturchat 12C — A-5, A-6, A-7 und O-3 (V1.0.63)

**Ausgangsstand.** Branch `claude/chat12b3-debt-nonnegative`, Commit
`d39209493b91265363cdd54ff7c3add63529fa4b` (V1.0.62). Ergebnisbranch
`claude/chat12c-audit-completion`. Testbaseline vor der Änderung selbst
ausgeführt: 1700 Rechen-Assertions · 434 Fixture-Assertions · 189 Node-Tests ·
Exit 0.

### Quellenlage (wahrheitsgemäß)

Alle Nachweise sind **synthetische Datensätze über die produktiven
Aufrufwege** — keine Live-Validierung, kein reales Filing. Zusätzlich wurden
die geänderten **sichtbaren Hinweise im Browser** geprüft (vorinstalliertes
Chromium, Import über `importMasterJsonFromTextarea()`). Diese Browserprüfung
ist **punktuell**: sie deckt die vier geprüften Datensätze und die dort
sichtbaren Texte ab, nicht die Oberfläche insgesamt.

### Reproduktion am unveränderten Ausgangsstand

Alle vier Punkte wurden zuerst auf `d392094` reproduziert.

| # | gemessen auf V1.0.62 |
|---|---|
| A-5 | `modelDcf` weist „Dilution (Aktienanzahl steigt) — im Hauptwert berücksichtigt" **ohne jeden Zeitbezug** aus; kein Hinweis auf die Begrenzung; keine maschinenlesbare Angabe (`_dilutionHorizonYears` u. a. `undefined`) |
| A-6 | `computeMidCycleFcf`: mit D&A 150M; `ebitda[0] = null` → **100M, `status: 'ok'`**; ohne EBITDA → **100M, `status: 'ok'`**; echte Null (EBITDA = EBIT) → 100M — die drei Fälle sind **nicht unterscheidbar** |
| A-7 | zyklischer Titel, Uplift **94,4 %**: `runValuationEngine` → `modelResults` enthält nur `dcf_midcycle`; `runFairValueSynthesizer` liefert `buybackAddon: 0`, `_buybackUpliftPct: 0` |
| O-3 (b) | Datensatz mit Rasterlücke ab 17,0 %, Kurs 20,02: `no_solution_in_range` mit der Begründung „der Markt preist ein Wachstum unter −20 % ein" — **falsch**, die Lösung liegt bei 16,65 % |
| O-3 (a) | mit eingespeister Lücke im eingeschachtelten Intervall: `status: 'ok'`, `impliedGrowthPct: 0,375 %`, Residuum **0,0366** je Aktie (echte Nullstelle 0,3446 %) — ein Wert ohne Nachweis |

### A-5 · Terminalannahme ausdrücklich gemacht (keine Wertkorrektur)

Die Rechnung ist unverändert: Aktienprojektion in den Detailjahren 1–10,
Terminalwert geteilt durch die Aktienzahl des Jahres 10, ab dem
Terminalzeitpunkt konstante Aktienzahl. `R33` prüft die Referenzzahlen auf
1e-12 gegen V1.0.62.

Neu ist allein die Offenlegung:

* **Eine** Deklaration `TERMINAL_DILUTION` (Horizont, Basis des Terminalwerts,
  Flags, erklärender Text) — Zahl und Text können nicht auseinanderlaufen.
* Der sichtbare Hinweis nennt den **zeitlichen Umfang**: „Dilution
  (Aktienanzahl steigt) — im Hauptwert berücksichtigt für die Detailjahre
  1–10; ab dem Terminalzeitpunkt konstante Aktienzahl". Zusätzlich eine
  ausdrückliche ⚠-Vereinfachungsnotiz, analog zu
  `OWC_STOCK_SIMPLIFICATION_NOTE`.
* Maschinenlesbar am Modellergebnis: `_dilutionHorizonYears`,
  `_dilutionAppliedInDetailYears`, `_dilutionAppliedInTerminalValue`,
  `_terminalShareCountBasis`, `_terminalShareCountM`,
  `_sharesGrowthPaProjected`, `_terminalSharesGrowthPa`,
  `_historicalDilutionExtrapolatedToPerpetuity`,
  `_terminalDilutionSimplification`.
* Herkunft und Snapshot führen die Annahme mit: `buildDataBasisReport().dilution`
  (samt Warnung) und `buildSnapshotForecastTargets().dilution` /
  `.terminal.share_count_basis`.
* Auch die Buyback-Diagnose nennt dieselbe Grenze („Aktienreduktion nur bis
  Jahr 10").

Bewusst **nicht** getan: keine automatische ewige Fortschreibung historischer
Verwässerungs- oder Rückkaufraten (`_terminalSharesGrowthPa` ist immer 0),
keine neue Einstellungsoberfläche (`R33` prüft, dass eine erfundene Annahme
wirkungslos bleibt), keine Änderung des Terminalwerts.

Die **alternative Rechnung** bleibt als **klar bedingte Sensitivität**
dokumentiert: unter der zusätzlichen Annahme dauerhaft fortgesetzter
Verwässerung wüchse der Wert je Aktie in der ewigen Rente mit
(1+tg)/(1+d) − 1; im geprüften Fall ergibt das einen um den **Faktor > 2**
niedrigeren Terminalwert je Aktie. Das ist eine Annahme über das einzelne
Unternehmen — sie wird nachgerechnet, aber **nicht** als Sollwert gesetzt.

### A-6 · Fehlende D&A nicht still auf null

`computeMidCycleFcf()` löst D&A jetzt über `_resolveMidCycleDa(mj, revTtm)`
auf — periodengleich zur bewerteten Periode (`revenue[0]`, derselbe Umsatz,
auf den die Funktion auch Margen- und CapEx-Median anwendet), in der
**bestehenden** Vorrangfolge:

1. ausdrückliche Nutzerannahme `da_pct_of_revenue` (auch 0) — derselbe Vorrang
   wie im Bewertungskern (`_resolveDaForForecast`);
2. direkt gemeldeter Wert der bewerteten Periode `EBITDA[0] − EBIT[0]`
   (unverändert; eine gemeldete 0 ist eine **Messung** und bleibt eine);
3. zulässige Ableitung: gemessener Median der D&A-Quote aus anderen Perioden
   derselben Sicht × `revenue[0]`, ausdrücklich als **abgeleitet**
   gekennzeichnet;
4. sonst `status: 'insufficient_data'` mit Begründung — **keine** Zahl.

| Fall | vorher | nachher |
|---|---|---|
| D&A gemeldet | 150M, `ok` | 150M, `ok`, `daBasis: 'reported_period'` |
| **echte Null** (EBITDA = EBIT) | 100M, `ok` | 100M, `ok`, `daM: 0` — als Messung gekennzeichnet |
| `ebitda[0] = null`, andere Perioden vorhanden | **100M**, `ok` | **150M**, `ok`, `daBasis: 'measured_ratio'`, `daDerived: true` |
| ohne EBITDA | **100M**, `ok` | **`insufficient_data`**, `value: null`, Begründung |
| ohne EBITDA, `fcf[0] = 150` | **Abweichungswarnung >30 % gegen eine unbelegte Zahl** | **keine** Warnung |
| gesetzte Annahme 10 % | ignoriert | 100M D&A, FCF 200M, `daBasis: 'manual_override'` |
| widersprechende Perioden (EBITDA TTM, Umsatz FY) | stillschweigend verwendet | `insufficient_data`, `daBasis: 'period_conflict'` |

Der Bewertungspfad war bei gar nicht messbarer D&A schon vorher gesperrt
(`_resolveDaForForecast` → kein Ergebnis). Neu ist, dass **auch die Anzeige
und die Abweichungswarnung** keine unbelegte Zahl mehr führen und dass der
Mid-Cycle-Hinweis die D&A-Herkunft nennt.

### A-7 · Buyback-MoS-Zuschlag auch im Mid-Cycle-Pfad

Neu ist `_resolveActiveDcfModelResult(valuationResult)`: es liefert **genau
ein** Modellergebnis — die Reihenfolge von `router.activeModels` entscheidet,
ergänzt um die feste Ersatzreihenfolge `['dcf', 'DCF', 'dcf_midcycle']`; nicht
anwendbare Modelle werden übersprungen. Weil nur ein Ergebnis zurückkommt, ist
eine Doppelzählung ausgeschlossen.

| Fall (echter Engine-/Synthesizer-Pfad) | Uplift | Zuschlag vorher | nachher |
|---|---|---|---|
| zyklisch, −1 %/y Rückkäufe | 7,98 % | 0 | **0** (unter der Schwelle) |
| zyklisch, −2 %/y | 16,80 % | 0 | **+5 pp** |
| zyklisch, −3 %/y | 26,57 % | 0 | **+10 pp** |
| zyklisch, −8 %/y | 94,38 % | **0** | **+10 pp** |
| Uplift genau 25,0 / 25,0001 | — | — | **+5 pp / +10 pp** (Schwellen unverändert strikt) |
| Uplift genau 10,0 / 10,0001 | — | — | **0 / +5 pp** |
| DCF nicht anwendbar (Nettoschulden unbekannt), RIM anwendbar | 94,38 % | 0 | **0** |
| gar kein Modell anwendbar | — | — | keine Sicherheitsmarge, kein Zuschlag, kein Fehler |
| beide Schlüssel `dcf` und `dcf_midcycle` vorhanden | 94,38 % | — | **genau ein** Zuschlag (+10 pp) |

**Der Fair Value ändert sich nicht.** In allen drei Bändern ist
`synthesis.range.base` identisch (12,796287825470817); nur die
Sicherheitsmarge und damit der Buy Price werden konservativer. Der
buyback-adjustierte Wert bleibt Diagnose und wird kein Anker.

### O-3 · Reverse-DCF-Nullstellen gezielt abgesichert

Drei Festlegungen; Raster, Schrittweite, Abbruchtoleranz und Einschachtelung
selbst bleiben unverändert — der Solver wurde nicht neu entwickelt.

1. **Nachrechnung mit der echten Bewertungsfunktion.** Jede Nullstelle muss
   im Suchbereich auswertbar sein **und** eine Residualtoleranz erfüllen
   (`REVERSE_DCF_SEARCH.residualRelTol = 1e-3`, also 0,1 % des Zielkurses,
   Untergrenze `1e-9`). Die Einschachtelung liefert nur dann einen Wert, wenn
   sie mit einem **bestätigten** Vorzeichenwechsel über einem Intervall
   innerhalb der Abbruchtoleranz endet; der Abbruch bei nicht auswertbarem
   Intervallmittel und das Erreichen der Iterationsgrenze liefern **keinen**
   Wert mehr. Gemessene Residuen echter Nullstellen liegen bei 4·10⁻⁷ bis
   3·10⁻⁵ je Aktie, die Toleranzen bei 0,005 bis 0,5 — die Toleranz ist also
   eng genug, um das unbelegte Intervallmittel (Residuum 0,0366 bei Toleranz
   0,017) zu verwerfen.
2. **Lücken im Suchraster werden eingegrenzt, nicht übersprungen.** Ist genau
   ein Rand eines Rasterintervalls auswertbar, wird die
   Auswertbarkeitsgrenze eingeschachtelt; liegt zwischen dem auswertbaren
   Rand und ihr ein Vorzeichenwechsel, wird die Nullstelle regulär gesucht.
3. **Unvollständige Suche ist keine bewiesene Nichtexistenz.** Bleibt ein
   Rasterintervall unaufgelöst, entsteht der neue Status
   `search_incomplete` statt `no_solution_in_range`; das Ergebnis führt
   `searchComplete`, `uniquenessProven`, `unresolvedIntervalsPct`,
   `evaluableRangePct` und die Residualtoleranz mit. Wird eine Nullstelle
   gefunden, während Lücken offen sind, steht die fehlende Eindeutigkeit als
   `caveat` am Ergebnis. Die Begründungen benennen jetzt die **tatsächlich
   auswertbaren** Ränder statt die Rasterränder.

| Fall (Datensatz mit Lücke ab 17,0 %) | vorher | nachher |
|---|---|---|
| Kurs 20,02 | `no_solution_in_range`, Begründung „Wachstum unter −20 %" | **`ok`, 16,654 %**, Residuum 4,1·10⁻⁶, nachgerechnet |
| Kurs 20,034 | `no_solution_in_range` | **`ok`, 16,510 %** |
| Kurs 20,00 / 19,50 / 5,00 / 25,00 | `no_solution_in_range` mit falscher Begründung | **`search_incomplete`**, unaufgelöst: 16,50–17,00 %, auswertbar: −20 bis 16,50 % |
| lückenloser Referenzfall, Kurse 12 / 14,8 / 17 | `ok` | **unverändert `ok`** (−4,66 % / −1,62 % / +0,34 %), `searchComplete: true` |
| lückenlos, Kurs 500 bzw. 0,50 | `no_solution_in_range` | **unverändert** `no_solution_in_range`, `searchComplete: true` |
| Nettoschulden unbekannt | `net_debt_unknown` | unverändert |
| Kern im ganzen Bereich ohne Wert | `not_evaluable` | unverändert |
| **eingespeiste** Lücke im eingeschachtelten Intervall | `ok`, 0,375 %, Residuum 0,0366 | **`search_incomplete`**, kein Wert |

Die letzte Zeile ist eine **Robustheitsprüfung**, kein Beleg für einen real
auftretenden Bewertungsfehler — siehe die Einordnung von O-3 (a) unten.

### Berichtigte Testerwartungen

Die festgeschriebene Liste `DATA_BASIS_REQUIRED_HELPERS` in
`tests/sec-ttm.test.mjs` wurde um `TERMINAL_DILUTION` ergänzt, weil der Ausweis
der Datenbasis die Terminalannahme jetzt als Modellkonvention nennt. Sonst
wurde **keine** fachlich korrekte Testerwartung angepasst; `R1`–`R32` bestehen
unverändert.

### Verbleibende Prüfgrenzen dieses Schrittes

* **A-5 ist nicht behoben, sondern offengelegt.** Ob eine dauerhaft
  fortgesetzte Verwässerung für ein bestimmtes Unternehmen zutrifft, bleibt
  ungeprüft und wird vom Werkzeug nicht geschätzt.
* Die Aussage zu **O-3 (a)** beruht auf einem Parameter-Scan
  (72.000 Parametersätze, dichtes Raster). Er zeigt, dass **in diesem Umfang**
  kein Fehlerfall konstruierbar ist — er ist **kein Beweis**, dass die Menge
  der auswertbaren Wachstumsraten für jede denkbare Eingabe zusammenhängend
  ist.
* Die **Residualtoleranz** ist auf den Zielkurs bezogen. Bei einem extrem
  steilen Wertverlauf könnte eine regulär eingeschachtelte Nullstelle sie
  verfehlen; das Ergebnis wäre dann `search_incomplete` statt `ok` — also
  konservativ, aber nicht ideal. In den geprüften Fällen liegt der Abstand bei
  mehr als drei Größenordnungen.
* Die **Browserprüfung** deckt vier Datensätze und die dort sichtbaren Texte
  ab, nicht die Oberfläche insgesamt.
* Kein Live-Abruf, kein reales Filing. Die Grenzen aus 12A, 12B und 12B.1–12B.3
  bleiben bestehen.
* Dies ist **keine Bestätigung**, dass der Rest des Werkzeugs fehlerfrei ist,
  und keine Aussage über die Qualität der erzeugten Bewertungen.

---

### O-3 · Randfälle der Nullstellensuche im Reverse DCF

* **Bearbeitet in Korrekturchat 12C (V1.0.63) — mit unterschiedlichem
  Ergebnis für die beiden Teilbefunde:**
  * **(b) bestätigt und behoben.** Der übersprungene Vorzeichenwechsel an
    einer Rasterlücke ist mit Daten erreichbar und führte zu
    `no_solution_in_range` samt einer sachlich falschen Begründung, obwohl
    eine Lösung im Suchbereich existiert. Reproduktion und Korrektur siehe
    Abschnitt 3d.
  * **(a) nicht mit Daten erreichbar.** Über 72.000 Parametersätze (dichtes
    Raster, Schritt 0,05 pp) war die Menge der auswertbaren Wachstumsraten
    stets ein ZUSAMMENHÄNGENDES Intervall. Ein eingeschachtelter
    Vorzeichenwechsel kann deshalb keine Lücke enthalten, und der Abbruch bei
    nicht auswertbarem Intervallmittel wird nicht erreicht. Der Pfad ist
    trotzdem defensiv abgesichert und mit einem **künstlich eingespeisten
    Funktionsfehler** geprüft (`R36`, Fall D). Das ist ausdrücklich **kein**
    Nachweis eines real auftretenden Bewertungsfehlers.


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
  **Nachtrag Korrekturchat 12B:** Die synthetischen Fälle laufen seitdem
  durch den *produktiven Importweg* (Tag-Auswahl, Komponenten-Rebuild,
  Periodenmetadaten) statt über von Hand gebaute `fundamentals`. Ein
  **Live-Abruf** bei SEC war weiterhin nicht möglich — `data.sec.gov`,
  `www.sec.gov` und `xbrl.fasb.org` sind vom Egress-Proxy dieser Umgebung
  gesperrt. Die verbleibende Unsicherheit ist bei O-1 genau benannt.
* Keine Browser-/DOM-Prüfung. Die beiden DOM-Tests
  (`_testManualAssumptionOverride`, `_testMarketDataOverrides`) bleiben
  ausgewiesen übersprungen; die Anzeigepfade wurden über die
  HTML-erzeugenden Funktionen geprüft, nicht im gerenderten Zustand.
  **Nachtrag Korrekturchat 12B.3 und 12C:** In diesen Schritten wurden die
  jeweils GEÄNDERTEN Anzeigen im vorinstallierten Chromium geprüft (Import
  über `importMasterJsonFromTextarea()`). Das schließt diese Auditgrenze
  **nicht**: geprüft wurden einzelne Datensätze und die dort sichtbaren Texte,
  nicht die Oberfläche insgesamt und nicht die beiden übersprungenen
  DOM-Tests.
* Die Nicht-DCF-Modelle (RIM, RIM-Buyback, DDM, EPV-Floor, P/TBV-Gordon,
  Excess Return) wurden nicht auf innere Konsistenz geprüft.
* Die Gewichtung im Synthesizer, die Einstiegszonen-Logik und die
  Datenqualitäts-Gates wurden nur dort berührt, wo Befund A-7 sie betrifft.
  **Nachtrag Korrekturchat 12C:** A-7 ist behoben; geprüft wurde dabei die
  Auswahl des aktiven DCF-Modells, die bestehenden Buyback-Schwellen und die
  Unberührtheit des Fair Values. Gewichtung, Einstiegszonen-Logik und
  Datenqualitäts-Gates selbst bleiben darüber hinaus **ungeprüft**.
* Bestehende Tests und HANDOFF-Erfolgsmeldungen wurden als Behauptungen
  behandelt: die Baseline (1700/148, Exit 0) habe ich auf `3544bcf` selbst
  ausgeführt und bestätigt. Die Aussage „Haupt-DCF, Reverse DCF und
  Sensitivitätsmatrix nutzen denselben Kern" trifft für `modelDcf`,
  `computeSensitivityMatrix` und `solveReverseDcfGrowth` zu (Tests A4/A5),
  **nicht** für die beiden Reverse-DCF-Anzeigen (A-1, A-3), die Simulation
  und die Snapshot-Prognose im Mid-Cycle-Pfad (A-2).
