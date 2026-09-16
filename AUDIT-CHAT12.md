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
| A-4 | **behoben** | Korrekturchat 12B, V1.0.59, Branch `claude/chat12b-debt-periods` |
| A-5 | **offen** | — (Nachweis `B6` bleibt als Fehlernachweis grün) |
| A-6 | **offen** | — (Nachweis `B7` bleibt als Fehlernachweis grün) |
| A-7 | **offen** | — (Nachweis `B8` bleibt als Fehlernachweis grün) |
| O-1 | **bestätigt und behoben** | Korrekturchat 12B, V1.0.59 (Reproduktion am echten Importweg) |
| O-2 | **bestätigt und behoben** | Korrekturchat 12B, V1.0.59 (Reproduktion am echten Importweg) |
| O-3 | **unverändert offen** | nicht bestätigt, nicht angefasst |

Die Nachweise `B1`–`B4` (A-1, A-2, A-3) wurden in Korrekturchat 12A in
**Regressionstests des richtigen Verhaltens** umgewandelt (`R1`–`R9` in
`tests/audit-chat12.test.mjs`). `B5` (A-4) wurde in Korrekturchat 12B ebenso
umgewandelt — in `R10`–`R15`, die zusätzlich O-1 und O-2 absichern. `B6`–`B8`
bleiben ausdrücklich Befund-Nachweise: A-5 bis A-7 sind offen.

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
inkonsistenter Datensatz. Die eigentliche Ursache liegt tiefer als im Audit
vermutet: **alle drei Tags der Kette `SEC_TAG_MAP.total_debt`**
(`LongTermDebtAndCapitalLeaseObligations`, `LongTermDebt`,
`DebtAndCapitalLeaseObligations`) sind *langfristige* Schuldkonzepte; keines
enthält kurzfristige Bankschulden oder Commercial Paper. Die Restgröße misst
deshalb bestenfalls die **laufende Tranche** langfristiger Schulden — und
wenn `total_debt` und `long_term_debt` auf **dasselbe** Tag fallen
(`LongTermDebt` ist Kettenplatz 2 bzw. 1), ist sie strukturell 0 und nie eine
Messung.

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

### O-3 · Randfälle der Nullstellensuche im Reverse DCF

* **Status: unverändert offen**, in Korrekturchat 12B nicht angefasst.


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
