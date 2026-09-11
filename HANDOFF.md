# HANDOFF — US-Aktienbewertungstool

## Update (Chat 9 Reparatur): Abrufsperre, Bruttomarge, Bandherkunft (V1.0.51)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprüfter Branch
`claude/beautiful-carson-t5eqpi`, geprüfter Commit `cd1be7e` — der einzige
Branch, der ihn enthält; keine nachträglichen Korrekturen (`main` steht
weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`. Reparaturbranch: `claude/entry-gate-and-band-provenance`.
Testbefehl: `npm test`. Baseline auf `cd1be7e` (ausgeführt, bestätigt die
gemeldete Angabe): **1357 Rechen-Assertions · 78 Node-Tests · Exit-Code 0**.

Umfang: ausschliesslich die drei gemeldeten Fehler, ihre unmittelbaren Folgen,
Tests und dieses Dokument. **Keine Bewertungsformel, keine Abschlagsregel,
keine Quantilberechnung, keine Modellgewichte und keine Szenariowerte
geändert.**

### Fehler 1 — Abrufsperre und Statusmeldung widersprachen sich

**Am Code reproduziert** (Browser, Stand `cd1be7e`):

| Adresse | Abrufknopf | `entrySetupState` | |
|---|---|---|---|
| `httpINVALID` | **frei** | `invalid_proxy` | **Widerspruch** |
| `https://` (ohne Host) | frei | **`ready`** | Host fehlt, gilt als eingerichtet |
| `beispiel.dev/sec` | gesperrt | `invalid_proxy` | ok |

Zusätzlich reproduziert: Enter im Tickerfeld startete `secFetchAll()` auch bei
ungültiger Adresse (Meldung „die Datenverbindung ist nicht erreichbar" statt
„Adresse unvollständig"), und der `finally`-Block gab den Knopf nach Abrufende
bedingungslos wieder frei — auch wenn die Adresse inzwischen `kaputt` lautete.

**Ursache.** Drei unterschiedlich strenge Prüfungen: `secProxyConfigChanged()`
(`startsWith('http')`), `entrySetupState()` (Schema-Regex ohne Host) und
`_secProxyFetch()` (`startsWith('http')`).

**Korrektur.** Neu `isUsableProxyUrl(value)` als **einzige** Prüfung:
`http`/`https`-Schema **und** ein Hostname mit mindestens einem
alphanumerischen Zeichen (`new URL`-Parsing). Sie speist
`secProxyConfigChanged()`, `entrySetupState()`, den neuen synchronen
Wachposten `_requireUsableProxy()` (von `_secProxyFetch()` **und** vom
Einstieg in `secFetchAll()` genutzt) sowie `secSyncFetchButton()`, die einzige
Stelle, die den Knopf ausserhalb eines laufenden Abrufs freigibt. Der
`finally`-Block ruft jetzt `secSyncFetchButton()` statt `disabled = false`.
Ohne gültige Adresse wird **keine Netzwerkanfrage** gestartet, auch nicht über
Enter im Tickerfeld oder einen direkten Funktionsaufruf.
Der Status-Schlüssel heisst nicht mehr `ready`, sondern **`configured`**:
Die Texte sagen jetzt „Adresse ist vollständig — der Abruf lässt sich starten.
Ob die Zwischenstelle erreichbar ist und korrekt antwortet, zeigt erst der
Abruf." Die bestehenden Regeln gegen parallele/veraltete Abrufe
(`activeSecFetchId`, `_isCurrent()`, `'Lädt…'`) sind unverändert und im
Browser nachgemessen.

### Fehler 2 — fehlende jüngste Bruttomarge zeigte die Vorjahreszahl

**Am Code reproduziert** (`revenue [100,80,60]`), Stand `cd1be7e` → nachher:

| `gross_profit` | aktuell | Vorjahr | Δ | | aktuell | Vorjahr | Δ |
|---|---|---|---|---|---|---|---|
| `[null,40,24]` | **50 %** | 40 % | **+10** | → | **Datenlücke** | 50 % | **keiner** |
| `[60,null,24]` | 60 % | **40 %** | **+20** | → | 60 % | **keine** | **keiner** |
| `[60,40,24]` | 60 % | 50 % | +10 | → | 60 % | 50 % | +10 |

**Ursache.** `grossMargins.push(...)` übersprang Lücken und verkürzte die
Reihe; Index 0 zeigte dann eine ältere Periode, und der „Vorjahresvergleich"
übersprang bis zu zwei Jahre.

**Korrektur.** `grossMarginByIndex[i]` erhält die Periodenposition (`null` an
der Stelle der Lücke, statt die Reihe zu verkürzen). Der Vorjahresvergleich
entsteht nur, wenn Index 0 und 1 beide gültig sind **und**
`_grossMarginPeriodsAdjacent(mj)` das bestätigt: liegen Periodenangaben
(`_v4_meta.<feld>.periods`) vor, müssen Index 0 und 1 unmittelbar benachbarte
Geschäftsjahre sein und Zähler/Nenner je Index dieselbe Periode betreffen.
Ohne Periodenangaben wird nicht blockiert — es wird **keine** neue
Periodennormalisierung eingeführt. Geprüfte direkte Aufrufer: die Hauptansicht
(zeigt jetzt Datenlücke bzw. nennt den fehlenden Vergleich im Hinweistext),
der Wachstumsbereich (`Gross Margin`-Kachel), die interne
FCF-Breakeven-Schätzung (`fcfBreakevenYearEst`, entfällt jetzt bei
unbelastbarem Trend — gewollt) und `computeReverseDcfFull` (nutzt nur
`revCagr*`/`fcfDataSuspect`, unberührt).

### Fehler 3 — P25/P75 wurde als Simulationsergebnis beschrieben

**Am Code reproduziert.** `ovScenarioRows()` schrieb „ein Viertel der
simulierten Ergebnisse liegt darunter/darüber". Tatsächlich liefert die
Synthese `decisionRangeMethod: 'weighted_p25_p75'` aus `_weightedQuantile`
über die gewichteten Szenariowerte der Modelle (Fixture `T-01`: 6
Szenariowerte aus 2 Modellen, P25 `2.79415505393804`, P75 `7.262863118767878`).

**Korrektur.** Bezeichnung „Szenarioband, unteres/oberes Ende (P25/P75)",
Erklärung „gewichtetes 25-/75-%-Quantil der Szenariowerte der verwendeten
Bewertungsmodelle". Der Zusatz „gewichtet" wird nur behauptet, wenn
`decisionRangeMethod === 'weighted_p25_p75'` ausgewiesen ist (ältere Snapshots
ohne Methodenangabe erhalten die neutrale Formulierung). Der Hinweistext des
Bewertungsbereichs nennt Szenarioanzahl und Modellzahl und sagt ausdrücklich,
dass es **keine Wahrscheinlichkeitsaussage** ist. Detailkarte und
Kennzahlenübersicht sprechen vom „gewichteten Szenarioband P25–P75". Die
Monte-Carlo-Karte und ihre Erklärungen bleiben unverändert für die echte
Simulation. Quantilberechnung, Gewichte, Szenariowerte und Sicherheitsabschlag
sind unangetastet; die Bandgrenzen sind unverändert.

### Neue Regressionstests — `_testChat9Fixes()`, 76 Assertions

Registriert in `test/run-calc-tests.js`; rein, ohne DOM und ohne Zufall.
Ergänzt: `URL` im Sandkasten des Rechentest-Runners (Standard-Browserglobal,
das die neue Syntaxprüfung nutzt).

* **F1** 13 Adressfälle (leer, Leerzeichen, `httpINVALID`, `https://`,
  `http://`, `https://...`, ohne Schema, `ftp://`, `httpsx://`, gültige
  http/https-Adressen, IP mit Port, Adresse mit Randleerzeichen) je dreifach
  geprüft: `isUsableProxyUrl`, Schlüssel von `entrySetupState` und die
  **Übereinstimmung** von Freigabe und Statusmeldung. Dazu `null`, `undefined`,
  Zahl, Objekt; der Wachposten `_requireUsableProxy()` lehnt fünf ungültige
  Adressen ab und lässt eine gültige durch.
* **F2** die drei Pflichtfälle mit unabhängig nachgerechneten Werten
  (40/80 = 50 %, 60/100 = 60 %, Δ = +10 pp), ausdrücklich „nicht 24/60 = 40 %
  als Vorjahreswert"; dazu Periodenangaben passend / mit Sprung / zwischen
  Zähler und Nenner versetzt; und die erzeugte Zeile der Hauptansicht
  (Datenlücke statt `50,0 %`).
* **F3** echtes Syntheseergebnis aus Fixture `T-01` durch die Pipeline:
  Methode `weighted_p25_p75`, Bandgrenzen auf 1e-12 unverändert, angezeigte
  Werte exakt gleich den Bandgrenzen, Bezeichnung und Erklärung nennen
  gewichtete Modellszenarien, **keine** Treffer für „simuliert", „Monte" oder
  „wahrscheinlich"; ohne ausgewiesene Methode keine Gewichtungsbehauptung.

### Gegenproben (ausgeführt)

| Rückbau | Rot |
|---|---|
| GP-1 alte Prüfung `startsWith('http')` | 11 (u. a. `httpINVALID` → `configured`) |
| GP-2 alte Bruttomargen-Reihe ohne Positionserhalt | 7 (u. a. „aktuell 50", „Δ 20") |
| GP-3 alte Simulationsbehauptung | 6 |
| GP-4 Knopffreigabe ohne Adressprüfung | im Browser: Knopf nach Abrufende trotz Adresse `kaputt` wieder frei |

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1433 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1357 unverändert zur Baseline **+76 neue**),
  Node-Tests **78/78** unverändert, gemeinsamer **Exit-Code 0**. Alle 434
  Fixture-Assertions unverändert grün. Genau **eine** bestehende Erwartung
  angepasst und im Test begründet: `_testOverviewSimplification` erwartete den
  Status-Schlüssel `ready`, der jetzt `configured` heisst (fachliche
  Begründung: „eingetragen" ≠ „erreichbar"); die Aussage des Tests
  (Abruf freigeschaltet) blieb gleich.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 `pageerror`**:
  * **B1** sieben Adressen: **0 Widersprüche** zwischen Knopf,
    `entrySetupState` und Einstiegsmeldung; kein Erreichbarkeitsversprechen.
  * **B2** Enter im Tickerfeld bei `httpINVALID`, `https://`,
    `beispiel.dev/sec` und leer: **0 Netzwerkanfragen**, jeweils Meldung
    „Kein Abruf: …".
  * **B3** gültige Adresse: Abruf wird tatsächlich versucht (1 Netzanfrage),
    Knopf danach wieder frei.
  * **B4** Adresse während des Abrufs auf `kaputt` geändert: Knopf bleibt
    **gesperrt**, Beschriftung korrekt zurückgesetzt.
  * **B4b** zwei überlappende Abrufe: Knopf zeigt `Lädt…` und bleibt gesperrt,
    der neuere Ticker gewinnt (`activeSecFetchId` 2) — Regel gegen
    parallele/veraltete Abrufe unverändert wirksam.
  * **B5** die drei Bruttomargen-Pflichtfälle in der gerenderten Hauptansicht:
    Datenlücke · 60,0 % ohne Vorjahresvergleich · 60,0 % mit +10,0 Prozentpunkten.
  * **B6** Hauptansicht zeigt „Szenarioband … gewichtetes 25-/75-%-Quantil der
    Szenariowerte der verwendeten Bewertungsmodelle", Werte 2,79 / 7,26,
    Methode `weighted_p25_p75`, Bandgrenzen auf 1e-12 unverändert, kein
    „simuliert" ausserhalb des Monte-Carlo-Teils; die Monte-Carlo-Erklärung
    besteht weiter.
  * **B7** schmale Breite 390×844: 0 px waagerechter Überlauf, alle fünf
    Bereiche vorhanden.

### Verbleibende Grenzen

* Beim reinen Seitenaufruf ist der einzige Konsolenfehler eine blockierte
  Anfrage an `fonts.googleapis.com` (Netzwerksperre der Prüfumgebung) —
  gegen `cd1be7e` gemessen **identisch** (dort ebenfalls genau diese eine
  Anfrage, 0 `pageerror`). Die weiteren Konsolenmeldungen im Browserlauf
  stammen aus den absichtlich unerreichbaren Testadressen.
* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei und
  DOM-frei.
* `isUsableProxyUrl()` prüft ausschliesslich die **Syntax**. Ob die
  Zwischenstelle existiert, erreichbar ist oder korrekt antwortet, zeigt erst
  der Abruf — die Texte sagen das ausdrücklich. Eine Vorabprüfung der
  Erreichbarkeit wurde nicht eingebaut (wäre eine neue Netzwerkfunktion).
* Der Periodenabgleich der Bruttomarge nutzt nur vorhandene
  `_v4_meta.<feld>.periods`. Datensätze ohne Periodenangaben (reine
  JSON-Pastes) werden weiterhin rein positionsbasiert ausgewertet; eine
  umfassende Periodennormalisierung war ausdrücklich nicht beauftragt.
* `fcfBreakevenYearEst` entfällt jetzt, wenn kein belastbarer
  Bruttomargen-Trend vorliegt. Das ist die gewollte Folge der Korrektur; kein
  Fixture prüft diesen Wert.
* `ENGINE_VERSION` / `DISPLAY_VERSION` bleiben `1.0.35-base-rate-lite`
  (mehrere Fixtures pinnen den Wert exakt); V1.0.51 bezeichnet nur diesen
  Dokumentationsabschnitt.
* Weiter offen aus den Vorschritten: Fachansichten ausserhalb der Hauptansicht
  nicht vereinfacht; Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Größen nicht
  modelliert; `buildCoreValuationContext()` wandelt bei direktem Aufruf
  weiterhin `'15'` um.

### Ausgangsstand für Chat 10

Übergabebranch: `claude/entry-gate-and-band-provenance` (Basis `cd1be7e` auf
`claude/beautiful-carson-t5eqpi`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0
(1433 Rechen-Assertions · 78 Node-Tests).
Code-Commit dieses Schritts: `efe14c9`; Ergebniscommit ist die Spitze des
Reparaturbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/entry-gate-and-band-provenance
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/efe14c9

## Update (Chat 9): Einstieg und Hauptansicht vereinfacht (V1.0.50)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprüfter Branch
`claude/midcycle-margin-override-fix`, geprüfter Commit `a71b1f1` — die Spitze
dieses Branches und der jüngste Stand aller Branches (Prüfung: Commitdatum
aller Remote-Branches; `main` steht weiterhin auf `b023dc8`). Tool-Datei
unverändert `us-aktienbewertungstool-v1036-sector-classification-patch.html`
(einzige HTML-Datei des Repositories und Ziel von `test/run-calc-tests.js`),
Modul `src/dcf-core.js`. Übergabebranch: `claude/beautiful-carson-t5eqpi`.
Testbefehl: `npm test`. Baseline auf `a71b1f1` (ausgeführt):
1298 Rechen-Assertions · 78 Node-Tests · Exit-Code 0.

Umfang: ausschliesslich Einstieg und Hauptansicht (Overview) samt der dafür
nötigen Anzeigehilfen, Tests und dieses Dokument. **Keine Bewertungsformel,
keine Abschlagsregel, keine Modell- oder Routerlogik geändert.**

### 1. Ticker-Suche als primärer Einstieg

* Neue Karte **„Aktie suchen"** ganz oben: Ticker-Feld, Abrufknopf,
  Yahoo-Option, Statusmeldung und die Import-Bestätigungsleiste.
  Ticker-Feld, Abrufknopf und Yahoo-Option wurden aus dem SEC-Panel
  **verschoben** (nicht dupliziert) — geprüft: jede betroffene Element-ID
  kommt im Dokument genau einmal vor.
* Neue Karte **„Daten und Einstellungen"** (eingeklappt) mit zwei benannten
  Abschnitten: *1. Datenverbindung (Proxy-Adresse)* und *2. Daten als
  JSON-Datei importieren*. Die bisherige Karte „Master-JSON Import" und das
  Proxy-Feld aus dem SEC-Panel sind dorthin gewandert.
* Das SEC-Panel bleibt als Expertenansicht bestehen (Mapping-Diagnose,
  Evidenz-Hierarchie, Worker-Beispiel) und verweist auf Einstieg und
  Einstellungen.

### 2. Ehrliche Statusmeldung statt vorgetäuschter Verbindung

* Neu `entrySetupState(proxyUrl, hasData)` (rein) und `renderEntryStatus()`:
  ohne Adresse bzw. ohne `http(s)://` bleibt der Abrufknopf **gesperrt**, die
  Meldung nennt den Grund, sagt, dass **kein automatischer Abruf möglich** ist,
  nennt den JSON-Import als Alternative und führt per Knopf in die
  Einstellungen (`openDataSettings()`).
* Der Leerzustand der Hauptansicht nennt denselben Einrichtungsstand (die
  Ansicht wird beim Laden einmal gerendert, statt einen statischen Platzhalter
  stehen zu lassen).
* Fehlgeschlagener Abruf: deutsche Einordnung vor der technischen Meldung
  („Abruf fehlgeschlagen: … — die Datenverbindung ist nicht erreichbar.").

### 3. Hauptansicht in fünf Bereichen

Reihenfolge: Kopf · Einordnung auf einen Blick · **max. 3 Kernaussagen** ·
Warnhinweise · Legende · **Geschäftsmodell** · **Qualität und Wachstum** ·
**Finanzielle Risiken** · **Bewertung und Erwartungen** ·
**Datenverlässlichkeit** · „Details und Fachansichten".

### 4. Nur vorhandene Informationen

* `ovBusinessModelFacts(mj)` (rein) liefert ausschliesslich Angaben aus dem
  Datensatz (Branche, Einordnung, Börse, Währung, Umsatz, Dividende, dazu
  moat_rating/These, wenn gesetzt). Fehlt eine Angabe, steht dort
  „nicht im Datensatz enthalten" + Markierung **Datenlücke** — **kein**
  erfundener Beschreibungstext. Ein Hinweis sagt ausdrücklich, dass
  SEC-XBRL keine Geschäfts- oder Segmentbeschreibung enthält und hier nichts
  ergänzt wird.
* `_ovMetricRow()` zeigt eine nicht berechenbare Kennzahl als Datenlücke samt
  Grund — nie als `0`.

### 5. Höchstens drei Kernaussagen mit Kennzahlenbezug

`ovKeyStatements(mj, q, s, dq)` (rein, deterministisch, feste Prüfreihenfolge,
keine Zeit-/Zufallsabhängigkeit) prüft in dieser Reihenfolge: aktive
Ausschlusskriterien → gesperrte Bewertung → keine rechnerische Bewertung →
negativer Modellwert → Kurs vs. Einstiegszone (ersatzweise Basisszenario) →
Qualitätsurteil → eingeschränkte Datenlage → Modell-Divergenz. Jede Aussage
führt ihre Grundlage mit („Grundlage: Kurs: 45,00 · Einstiegszone: 3,84").
Ein Prozentabstand wird **nur** zu einem positiven Vergleichswert gebildet.

### 6. Kurs und Szenariowerte gegenübergestellt

`ovScenarioRows(mj, s)` (rein) liefert eine Tabelle
*Größe · Wert · Abstand zum Kurs · Herkunft* mit Kurs, Einstiegszone,
Basis-, vorsichtigem und günstigem Szenario sowie P25/P75. Fehlende Werte
bleiben `null` (Datenlücke), ohne Kurs wird **kein** Abstand behauptet.

### 7. Einheitliche Kennzeichnung, deutsche Beschriftung

* `ovMark(kind)` mit fünf Markierungen, jede mit **ausgeschriebenem Text**
  (nicht nur Farbe): **Historie · Prognose · manuelle Annahme · Datenlücke ·
  Marktdaten**; Legende oberhalb der Bereiche.
* Warnhinweise tragen das Wort „Blockierend"/„Warnung"/„Hinweis" statt eines
  reinen Farbsymbols; die Einordnung nennt neben der Ampelfarbe immer den
  Klartext (z. B. „KEIN SIGNAL — Bewertung gesperrt").
* Fachbegriffe werden erklärt (Piotroski, Kapitalrendite minus Kapitalkosten,
  Nettoverschuldung/EBITDA, Zinsdeckung, P25/P75, Sicherheitsabschlag).
* Navigation und Kopfzeile jetzt durchgehend deutsch (Übersicht, Qualität,
  Bewertung, Wachstum, Annahmen, Snapshots, SEC-Daten). Die Schlüssel in
  `switchTab(...)` sind unverändert.

### 8. Expertenfunktionen bleiben erreichbar

Alle bisherigen Tabs bestehen weiter. Die Diagnoseinhalte der alten Übersicht
(Kennzahlenübersicht, Range-Box, Verdict-/Buy-Price-Box, Schema-Prüfung,
Warnliste, Herkunft des risikofreien Zinses) liegen in der eingeklappten Karte
**„Details und Fachansichten"** mit Sprungknöpfen in alle Fachbereiche.

### Neue Regressionstests — `_testOverviewSimplification()`, 59 Assertions

In der Tool-Datei ergänzt und in `test/run-calc-tests.js` als reine
Testfunktion registriert (kein DOM, kein globaler Zustand).

* **OV-1** Einrichtungsstatus: leer/Leerzeichen/ohne Schema/`https`/`http`/`null`.
* **OV-2** Geschäftsmodell: leerer Datensatz ⇒ jeder Wert `null` und jede Zeile
  Datenlücke; Klartext der Einordnung; Umsatz „12.345 Mio. USD"; Dividende
  `0` ⇒ „nein" (keine Lücke); unbekannte Einordnung wird unverändert gezeigt;
  eigene Einschätzungen als manuelle Annahme.
* **OV-3** Szenariozeilen mit unabhängig nachgerechneten Abständen
  (80/100 ⇒ −20 %, 120 ⇒ +20 %, 90 ⇒ −10 %, 150 ⇒ +50 %, 95 ⇒ −5 %,
  140 ⇒ +40 %); fehlender Wert bleibt `null`, nicht `0`; ohne Kurs kein Abstand.
* **OV-4** Kernaussagen: höchstens drei; „Der Kurs liegt 25,0 % über der
  Einstiegszone." (100/80); Grundlage nennt Kurs 100,00 und Einstiegszone
  80,00; Sperre steht an erster Stelle; überschriebene Kriterien sperren nicht;
  Datenstufe D wird genannt; ohne Grundlage keine Aussage; wiederholte
  Ableitung identisch; ohne Einstiegszone Vergleich mit dem Basisszenario
  (100/120 ⇒ 16,7 % unter).
* **OV-5** Kennzeichnung trägt immer Text; unbekannte Markierung erzeugt keine
  leere Farbfläche; nicht berechenbare Kennzahl wird nicht zu `0` und nennt
  den Grund.

### Gegenproben (ausgeführt)

| Rückbau | Rot |
|---|---|
| GP-1 Proxy-Adresse ohne Schemaprüfung akzeptiert | 2 (`invalid_proxy` → `ready`) |
| GP-2 fehlender Szenariowert als `0` statt Datenlücke | 2 |
| GP-3 erfundene Branche („Mischkonzern") statt Datenlücke | 2 |

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1357 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1298 unverändert zur Baseline **+59 neue**),
  Node-Tests **78/78** unverändert, gemeinsamer **Exit-Code 0**.
  Keine bestehende Erwartung geändert oder gelockert; alle 434
  Fixture-Assertions unverändert grün — die Bewertungsergebnisse sind
  unberührt.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 JS-Fehler
  (`pageerror`)**. Geprüfte Zustände:
  1. **Leerer Zustand** (1280×900): Ticker-Suche sichtbar, Abrufknopf
     gesperrt, Statusmeldung „Einrichtung unvollständig — kein automatischer
     Abruf", Knopf öffnet die Einstellungen; unvollständige Adresse hält den
     Abruf gesperrt und nennt den Grund; vollständige Adresse schaltet frei.
  2. **Erfolgreicher Import** (Fixture `T-01` aus der Datei selbst): genau die
     fünf Bereiche in der beauftragten Reihenfolge, 3 Kernaussagen je mit
     Grundlage, 7 Szenariozeilen, Legende, Kennzeichnungen
     (Historie 15 · Prognose 8 · manuelle Annahme 1 · Datenlücke 7 ·
     Marktdaten 3), Details eingeklappt mit 7 Sprungknöpfen; Wechsel in die
     Fachansicht und zurück.
  3. **Fehlende Daten** (T-01 ohne EBITDA, Zinsaufwand, Schulden, Sektor,
     Börse): 9 Angaben als Datenlücke gekennzeichnet, Grund jeweils genannt,
     keine `0,00`-Ersatzwerte in der Szenariotabelle.
  4. **Blockierte Bewertung** (`auditor_opinion_status = going_concern_doubt`):
     Position `blocked`, erste Kernaussage „Die Bewertung ist gesperrt: Going
     Concern.", Risikobereich nennt das aktive Kriterium, Bewertungsbereich
     erklärt, warum keine belastbaren Szenariowerte vorliegen.
     Zusätzlich blockierter Import (Fixture `T-03`, kein Kurs): Import wird
     abgewiesen, Meldung nennt `B-08`, die Hauptansicht bleibt im Leerzustand
     und zeigt keine erfundene Bewertung.
  5. **Schmale Breite** (390×844): waagerechter Überlauf **0 px**, alle fünf
     Bereiche vorhanden, Szenariotabelle mit eigenem Scrollbereich.
  6. **Fehlgeschlagener Abruf** (nicht erreichbare Adresse): deutsche Meldung,
     Abrufknopf wieder bedienbar, keine vorgetäuschte Bewertung, 0 JS-Fehler.

### Verbleibende Grenzen

* Der einzige Konsolenfehler im Browsercheck ist eine blockierte Anfrage an
  `fonts.googleapis.com` (Netzwerksperre der Prüfumgebung). Gegen den
  Ausgangsstand `a71b1f1` gemessen: **identisch** (dort ebenfalls genau diese
  eine fehlgeschlagene Anfrage, 0 `pageerror`) — nicht durch diese Änderung
  verursacht.
* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei und
  DOM-frei. Node-Prüfungen sind ausdrücklich **kein** Browsernachweis.
* Die Fachansichten (Qualität, Bewertung, Markt-Vergleich, Annahmen, SEC-Daten,
  Snapshots) wurden **nicht** vereinfacht — der Auftrag betraf ausdrücklich nur
  Einstieg und Hauptansicht. Ihre Beschriftungen sind daher weiterhin
  teilweise englisch.
* Es gibt keine Geschäftsmodell- oder Segmentdaten im Schema; der Bereich
  „Geschäftsmodell" zeigt deshalb die vorhandenen Stammdaten und weist die
  Lücke aus. Eine Erweiterung des Schemas war nicht beauftragt.
* `ENGINE_VERSION` / `DISPLAY_VERSION` bleiben unverändert
  (`1.0.35-base-rate-lite`) — mehrere Fixtures pinnen den Wert exakt; die
  Bezeichnung V1.0.50 gilt nur für diesen Dokumentationsabschnitt.
* Weiter offen aus den Vorschritten: Einheitenverdacht in
  `_makeBaseValuation()`; index-basierte Ableitung von `eps_diluted`,
  `book_value`, `dps` in `applyDerivedFieldsV4`; Korrelationen der
  Monte-Carlo-Größen nicht modelliert; `buildCoreValuationContext()` wandelt
  bei direktem Aufruf weiterhin `'15'` um.

### Ausgangsstand für Chat 10

Übergabebranch: `claude/beautiful-carson-t5eqpi` (Basis `a71b1f1` auf
`claude/midcycle-margin-override-fix`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0
(1357 Rechen-Assertions · 78 Node-Tests).
Code-Commit dieses Schritts: `551fe6a`; Ergebniscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/beautiful-carson-t5eqpi
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/551fe6a

## Update (Chat 8 Restfehler): Mid-Cycle mit manuellem Margen-Override (V1.0.49)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprüfter Branch
`claude/dcf-core-interface-fixes`, geprüfter Commit `7d39020` — die Spitze
dieses Branches und der einzige Stand, der ihn enthält; keine nachfolgenden
Korrekturen (`main` steht weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`. Reparaturbranch: `claude/midcycle-margin-override-fix`.
Testbefehl: `npm test`. Baseline auf `7d39020` (ausgeführt):
1298 Rechen-Assertions · 68 Node-Tests · Exit-Code 0.

Umfang: ausschliesslich dieser Restfehler, das unmittelbar betroffene
Diagnosefeld samt Adapter-Beschriftung, Tests und dieses Dokument. Die bereits
behobene Szenarioübernahme, Modulabhängigkeit und Isolation wurden **nicht**
erneut umgebaut.

### Am Code reproduziert (Stand `7d39020`)

`mkMidMj()` mit `activeModels: ['dcf_midcycle']` und `opMarginOverridePct: 15`,
über beide beauftragten Wege (`analyzeDcfFromMasterJson()` im isolierten Modul
und `normalizeDcfCoreInput()` → `runDcfCoreAnalysis()`):

| Berechnung | wirksame Marge | vorher | nachher |
|---|---|---|---|
| DCF | 15 % | 22,5371752100 | 22,5371752100 |
| zentrale Matrixzelle | **18 %** statt 15 % | **26,9618428228** | **22,5371752100** |
| Reverse DCF (Zielkurs = DCF) | 15 % | 8 % ✓ | 8 % ✓ |

Abweichung vorher: 4,4246676128 USD/Aktie.

**Ursache.** `computeSensitivityMatrix()` leitete im Mid-Cycle-Zweig
**unabhängig vom Aufrufer** erneut den historischen Median ab
(`ctxOpts = { opMarginOverridePct: mc.opMarginMed, … }`) und überging damit die
an der Eingabegrenze bereits aufgelöste Marge. Der Einstiegspunkt reichte sie
zwar als `v._coreOpts` durch, die Matrix las das Feld aber nie. Da
`ctx.marginOverridePct` in `coreValuationDetail()` Vorrang vor der übergebenen
Szenariomarge hat, gewann der Median (18 %) gegen den Override (15 %).

### Korrektur

* **`computeSensitivityMatrix()` respektiert eine bereits aufgelöste
  Margenbasis.** Liegt `v._coreOpts.opMarginOverridePct` als echte endliche
  Zahl vor, wird sie unverändert als Kontextmarge verwendet — der historische
  Median wird dann **nicht erneut abgeleitet**. Die Vorrangregel:
  gültiger expliziter Override → Mid-Cycle-Median → Szenariomarge.
* **Bestehende direkte Aufrufer bleiben unverändert.** Ohne `_coreOpts`
  (alle heutigen Aufrufer, u. a. `buildSensitivityMatrix`, `renderValuation`)
  leitet der Mid-Cycle-Pfad den Median weiterhin selbst ab. Nachgemessen:
  identische Zellen und identischer Basiswert gegenüber `7d39020`.
* **Punkt 6 erfüllt.** Ein gültiger Override scheitert **nicht** mehr allein an
  fehlender Mid-Cycle-Historie: die Marge steht bereits fest, die übrigen
  DCF-Daten prüft der Kontext wie bisher. Ohne Override bleibt der erklärte
  Nichtverfügbarkeitsstatus erhalten.
* **Diagnose widerspruchsfrei (Punkt 5).** Neu `out.opMarginBasis`
  (`'override'` · `'midcycle_median'` · `'scenario'` · `'none'`).
  `out.midCycle` wird nur noch mitgeführt, **wenn der Median tatsächlich die
  Rechengrundlage ist** — sonst stünde dort ein Wert, mit dem gar nicht
  gerechnet wurde. Der HTML-Adapter beschriftet entsprechend: bei Override
  „Betriebsmarge manuell auf 15,0 % gesetzt (ersetzt den Mid-Cycle-Median)"
  statt weiterhin „normalisiert auf den Mid-Cycle-Median".
* **Gültigkeit des Overrides angezogen.** Die Eingabegrenze prüfte bisher nur
  `isFinite(...)`; damit wurden `'15'` (Text) und `true` still zu Zahlen
  gewandelt und hätten den Median ausgehebelt. Jetzt gilt nur eine echte
  endliche **Zahl** als gültiger Override — keine stille Umwandlung mit
  `Number()`/`parseFloat()`; ungültige Werte werden in `diagnostics.notes`
  vermerkt und fallen auf den Median zurück. `buildCoreValuationContext()`
  wurde bewusst **nicht** angetastet, damit direkte Aufrufer ihr bisheriges
  Verhalten behalten.

Keine Bewertungsformel, keine Abschlagsregel und keine historische
Mid-Cycle-Definition geändert; keine zweite Bewertungslogik.

### Neue Regressionstests — 10 in `tests/dcf-core.test.mjs`

* **F4-1/2** Gemeldeter Fall über beide Wege: DCF und zentrale Matrixzelle je
  22,5371752100 (Toleranz 1e-8), ausdrücklich **nicht** 26,9618428228; im
  isolierten Modul ohne `realm:'this'`.
* **F4-3** Reverse-DCF-Roundtrip: Zielkurs bei der **Normalisierung**
  übergeben (das eingefrorene Input wird nicht nachträglich verändert) ⇒ 8 %
  innerhalb `REVERSE_DCF_SEARCH.tolerancePp` (1e-4) bei ausgewiesener Marge 15 %.
* **F4-4** Alle drei Wege weisen Marge 15 und Herkunft `override` aus;
  `input.midCycle` und `sensitivity.midCycle` bleiben `null`, weil der Median
  nicht Grundlage ist.
* **F4-5** Ohne Override unverändert 26,9618428228 bei 18 %, Basis
  `midcycle_median`, Median als Diagnose vorhanden.
* **F4-6/7** Unzureichende Historie: ohne Override erklärter Status; mit
  gültigem Override rechnen alle drei Wege konsistent, inkl.
  Zielkurs-Roundtrip.
* **F4-8** Bestehende direkte Matrixaufrufer ohne `_coreOpts` unverändert
  (Mid-Cycle 18 % / 26,9618428228; Haupt-DCF 28,497784085663053).
* **F4-9** Ungültiger Override (`'15'`, `NaN`, `Infinity`, `true`, `null`)
  fällt auf den Median zurück.
* **F4-10** Original und normalisiertes Input bleiben durch die Berechnungen
  unverändert; Input weiterhin eingefroren.

### Gegenproben (ausgeführt)

| Rückbau | Rot |
|---|---|
| GP-1 aufgelöste Margenbasis wieder übergangen (Stand V1.0.48) | 4 — mit exakt der gemeldeten Abweichung: `erwartet ~22.53717521, erhalten 26.9618428228148` |
| GP-2 lasche Gültigkeitsprüfung (`isFinite` ohne Typprüfung) | 1 (`erwartet ~18, erhalten 15`) |
| GP-3 `midCycle` auch bei Override ausgewiesen | 2 (widersprüchliche Diagnose) |

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1298 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (unverändert zur Baseline), Node-Tests **78/78**
  (vorher 68; +10), gemeinsamer **Exit-Code 0**. Keine bestehende Erwartung
  geändert oder gelockert.
* **Produktionsäquivalenz.** Fingerabdruck über **alle 134**
  Regressions-Fixtures gegen `7d39020` (Forecast-Inputs, 72 Bewertungspunkte,
  Reverse-DCF-Status samt Nullstellen, vollständige Sensitivitätsmatrix):
  **byte-identisch** (1 256 993 Zeichen, 0 Abweichungen). Zusätzlich ein
  direkter Matrixaufruf im Mid-Cycle-Pfad **ohne** `_coreOpts` gegen beide
  Stände: identische Zellen und identischer Basiswert.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 JS-Fehler**:
  alleinstehender Start gelingt; gemeldeter Fall behoben (DCF = Zelle =
  22,5371752100, Marge 15, Basis `override`, keine Median-Diagnose);
  Reverse-DCF-Roundtrip 8,0000000000 bei Marge 15; ohne Override unverändert
  26,9618428228 bei 18 %; Adapter-Beschriftung folgt der Herkunft; bestehender
  UI-Bewertungsaufruf (`T-TXRH-DEBT2`) unverändert BP 7,4357081414 /
  FV Base 10,4360816.

### Verbleibende Grenzen

* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei und
  DOM-frei. Node-Prüfungen sind ausdrücklich **kein** Browsernachweis.
* Die angezogene Gültigkeitsprüfung gilt an der Eingabegrenze
  (`normalizeDcfCoreInput`) und für den aufgelösten Kontext der Matrix. Ein
  **direkter** Aufruf von `buildCoreValuationContext()` mit `'15'` würde den
  Wert weiterhin umwandeln — bewusst unverändert, um bestehende Aufrufer nicht
  zu berühren. Offener Punkt, nicht mitbehoben.
* `v._coreOpts` ist der Kanal für den aufgelösten Kontext. Der Unterstrich
  markiert ihn weiterhin als intern; eine Umbenennung wäre ein
  Schnittstellenwechsel und war nicht beauftragt.
* Nicht behoben, wie beauftragt: der Einheitenverdacht in
  `_makeBaseValuation()` (125 von 134 Fixtures setzen Sätze als Brüche,
  während der Produktionspfad in Prozentpunkten arbeitet).
* Weiter offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`;
  Korrelationen der Monte-Carlo-Größen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` nicht angehoben (mehrere Fixtures pinnen
  `1.0.35-base-rate-lite` exakt).

### Ausgangsstand für Chat 9

Reparaturbranch: `claude/midcycle-margin-override-fix` (Basis `7d39020` auf
`claude/dcf-core-interface-fixes`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `f93ffac`; Ergebniscommit ist die Spitze des
Reparaturbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/midcycle-margin-override-fix
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/f93ffac

## Update (Chat 8 Reparatur): Drei Fehler der DCF-Schnittstelle behoben (V1.0.48)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprüfter Branch
`claude/dcf-core-extraction`, geprüfter Commit `8a928d6` — die Spitze dieses
Branches und der einzige Stand, der ihn enthält; keine nachfolgenden
Korrekturen (`main` steht weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`. Reparaturbranch: `claude/dcf-core-interface-fixes`.
Testbefehl: `npm test`. Baseline auf `8a928d6` (ausgeführt):
1298 Rechen-Assertions · 51 Node-Tests · Exit-Code 0.

Umfang: ausschliesslich die drei gemeldeten Fehler, die unmittelbar
betroffenen Kernfunktionen, die Modulabhängigkeiten, Tests und dieses
Dokument. Keine Bewertungsformel, keine Abschlagsregel und keine fachliche
Mid-Cycle-Definition geändert.

---

### Fehler 1 — DCF, Reverse DCF und Sensitivität rechneten mit verschiedenen Annahmen

**Am Code reproduziert** (synthetisches `mkMj()`, Master-JSON 10 % WACC, über
`options.scenarios.base` 12 % übergeben):

| | vorher | nachher |
|---|---|---|
| DCF | 21,9830750630 | 21,9830750630 |
| zentrale Matrixzelle | **28,4977840857** | **21,9830750630** |
| Matrix `baseWaccPct` | 10 | 12 |
| Reverse DCF (Zielkurs = DCF) | **4,5581359863 %** bei WACC 10 | **8,0000000000 %** bei WACC 12 |

Ursache: `solveReverseDcfGrowth()` und `computeSensitivityMatrix()` lesen
ihren Base-Stand aus `valuation.wacc_derived` / `growth_stage1` /
`growth_terminal`. Der Einstiegspunkt reichte die übergebenen Szenarien nur an
`coreValuationDetail()` weiter — die beiden anderen sahen weiterhin die
Master-JSON-Werte.

**Korrektur.** `normalizeDcfCoreInput()` legt jetzt einen **wirksamen
Base-Stand** fest und schreibt ihn in die (nun eigenständige, siehe Fehler 3)
Datenbasis, aus der alle drei Berechnungen lesen:

* **Vorrangregel:** ausdrücklich übergebene Szenarioannahmen vor den
  Ausgangswerten des Master-JSON — **feldweise**, damit ein teilweise
  besetztes Szenario die übrigen Felder nicht verliert. `null`/`undefined`
  bedeuten „nicht angegeben".
* `conservative`/`optimistic` fallen feldweise auf den wirksamen Base-Stand
  zurück; sie wirken nur auf die Bewertung je Szenario.
* Ein expliziter `opMarginOverridePct` wird zusätzlich in
  `scenarios.base.op_margin_pct` mitgeführt — die Matrix liest ihre Marge von
  dort und übernahm den Override sonst nicht.
* Neu `input.effectiveBase` mit den wirksamen Werten **und** der Herkunft je
  Feld (`options.scenarios.base` / `master_json` / `options.opMarginOverridePct`
  / `midcycle_median` / `none`).

Reverse DCF variiert unverändert **ausschliesslich** das Umsatzwachstum; alle
übrigen Annahmen stehen jetzt auf dem wirksamen Base-Stand. Keine zusätzliche
Bewertungslogik — der Einstiegspunkt delegiert weiterhin an dieselben
Funktionen.

### Fehler 2 — Mid-Cycle-Pfad scheiterte im isolierten Modul

**Am Code reproduziert:**
`loadDcfCore().analyzeDcfFromMasterJson(mj, {activeModels:['dcf_midcycle']})`
⇒ `computeMidCycleFcf is not defined`.

Ursache: `computeSensitivityMatrix()` ruft `computeMidCycleFcf()` für den
Mid-Cycle-Pfad, die deklarierte Helferliste enthielt ihn aber nicht. Die
Abhängigkeit wurde nachgezogen: `computeMidCycleFcf` (41 Zeilen) benötigt
seinerseits nur `_median`, der bereits gelistet war — keine weiteren
indirekten Helfer.

**Korrektur.**
* `computeMidCycleFcf` in `DCF_CORE_REQUIRED_HELPERS` ergänzt. Der Pfad läuft
  damit in der **standardmäßig isolierten, leeren Sandbox** — ohne
  Browserobjekte, ohne globalen Anwendungszustand, ohne zweite Kopie der
  Rechenlogik.
* Die Margenbasis wird an der Grenze **einmal** aufgelöst (dieselbe
  `computeMidCycleFcf()`, die auch die Matrix verwendet) und als
  `opMarginOverridePct` in `ctx` gelegt. DCF, Reverse DCF und Matrix nutzen
  dadurch dieselbe Marge; im Testfall durchgängig 18,00 % (Median aus
  20/16/15/20/15/20).
* Bei unzureichenden Daten liefert die Grenze einen **erklärten
  Nichtverfügbarkeitsstatus** (`ok:false`, `reason`, `diagnostics.midCycle`)
  — kein `ReferenceError` und **kein stiller Wechsel zum Haupt-DCF**
  (`valuation` bleibt `null`).

Fachliche Mid-Cycle-Definition unverändert.

### Fehler 3 — normalisierte Inputs blieben mit dem Original verbunden

**Am Code reproduziert:** nach Änderung von `fundamentals.total_debt[0]` von
200 auf 1200 **nur im Original** blieb der DCF bei 28,4977840857, während die
zentrale Matrixzelle auf 18,4977840857 fiel. Ursache: `ctx` trug vorberechnete
Werte, `input.source` hielt weiterhin Referenzen auf das übergebene
Master-JSON (`input.source.fundamentals === orig.fundamentals` war `true`).

**Korrektur.**
* Neu `_dcfCoreCloneData()`: die Grenze erzeugt **eine** eigenständige Kopie
  der Master-JSON-Daten. `ctx` wird aus **dieser** Kopie abgeleitet, und
  `input.source` **ist** diese Kopie — vorberechnete und erneut abgeleitete
  Werte können nicht mehr auseinanderlaufen.
* Neu `_dcfCoreDeepFreeze()`: das normalisierte Inputobjekt ist eingefroren.
  `runDcfCoreAnalysis()` kann es nicht verändern; im Modul (strict mode)
  schlägt ein Schreibversuch sofort fehl statt still ein abweichendes Ergebnis
  zu erzeugen.
* Die Normalisierung schreibt nie in das übergebene Master-JSON; auch
  übergebene Optionsobjekte werden nur gelesen.

Bewusst schlank und **ohne** Bezug zur Snapshot-Logik — Master-JSON-Daten sind
reine JSON-Werte; Zyklen können darin nicht vorkommen, werden aber abgefangen
statt zu werfen.

### Neue Regressionstests — 17 in `tests/dcf-core.test.mjs`

* **F1 (7)** Der gemeldete Fall exakt: DCF 21,9830750630 = zentrale
  Matrixzelle, ausdrücklich **nicht** 28,4977840857, `baseWaccPct` 12;
  Reverse DCF gewinnt 8 % innerhalb der dokumentierten Solvertoleranz
  (`REVERSE_DCF_SEARCH.tolerancePp` = 1e-4) bei WACC 12 zurück; abweichendes
  Terminalwachstum (4 %) und explizite Marge (15 %) wirken in allen drei
  Berechnungen und in der jeweils erwarteten Richtung; `opMarginOverridePct`
  schlägt bis in die Matrix durch; die ausgewiesenen wirksamen Annahmen samt
  Herkunft je Feld werden geprüft, einschliesslich feldweisem Rückfall;
  **ohne Overrides bleibt das Verhalten unverändert** (28,497784085663053,
  `baseWaccPct` 10).
* **F2 (5)** Gültiger Mid-Cycle-Fall über `loadDcfCore()` mit der
  standardmäßig isolierten Sandbox (kein `realm:'this'`, keine Attrappe);
  gleiche Margenbasis in DCF, Matrix und Reverse DCF (18,00 %);
  Übereinstimmung mit dem vorhandenen Baustein (`computeMidCycleFcf` und
  `coreValuationDetail`); unzureichende Historie ⇒ erklärter Status
  `insufficient_data` ohne Rückfall; `computeMidCycleFcf` steht in der
  Helferliste.
* **F3 (5)** Änderung am Original erreicht ein bereits normalisiertes Input
  nicht (DCF, Matrixzelle und Reverse DCF unverändert, `source.fundamentals`
  ist eine eigene Kopie); erneute Normalisierung berücksichtigt die
  1000 Mio. Mehrschulden bei 100 Mio. Aktien korrekt — DCF und Matrixzelle
  sinken **je um exakt 10,00 USD** (`netDebtPerShare` 11); verschachtelte
  Änderungen an Fundamentaldaten und am übergebenen Optionsobjekt wirken nicht
  zurück; Normalisierung und Berechnung verändern weder Original noch Input
  (eingefroren, Schreibversuch wirft `TypeError`); `ctx` und `source` stammen
  nachweislich aus derselben Datenbasis.

### Gegenproben (ausgeführt)

| Rückbau | Rot |
|---|---|
| GP-1 wirksamer Base-Stand nicht in die Datenbasis geschrieben (Stand V1.0.47) | 4 (alle F1-Fälle mit Overrides) |
| GP-2 `computeMidCycleFcf` aus der Helferliste entfernt | 5 (alle F2) |
| GP-3 Datenbasis wieder als Referenz aufs Original, kein Einfrieren | 3 (F3 Unabhängigkeit, verschachtelte Änderungen, Unveränderlichkeit) |

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1298 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (unverändert zur Baseline), Node-Tests **68/68**
  (vorher 51; +17), gemeinsamer **Exit-Code 0**. Keine bestehende Erwartung
  geändert oder gelockert.
* **Produktionsäquivalenz.** Fingerabdruck über **alle 134**
  Regressions-Fixtures gegen `8a928d6` — je Fixture Forecast-Inputs,
  72 Bewertungspunkte, Reverse-DCF-Status samt Nullstellen und die
  vollständige Sensitivitätsmatrix: **byte-identisch** (1 256 993 Zeichen,
  0 Abweichungen). Bestehende Produktionsaufrufe ohne die fehlerhaften neuen
  Schnittstellenfälle liefern also unveränderte Ergebnisse.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 JS-Fehler**:
  alleinstehender Start gelingt; bestehender Import- und Bewertungsaufruf
  (`T-TXRH-DEBT2` über `runFullEvaluation`) unverändert BP 7,4357081414 /
  FV Base 10,4360816, Matrix-Adapter rendert; Fehler 1 im Browser behoben
  (DCF = Zelle = 21,9830750630, Reverse DCF WACC 12 → 8,0000000000);
  Fehler 2 behoben (`ok`, `mode: dcf_midcycle`, Marge 18, DCF = Zelle);
  Fehler 3 behoben (altes Input unverändert, neu normalisiert 18,4977840857).

### Verbleibende Grenzen

* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei und
  DOM-frei. Node-Prüfungen sind ausdrücklich **kein** Browsernachweis.
* Das Einfrieren wirkt hart nur im Modul (strict mode). Im Browser-`<script>`
  (nicht strict) würde ein Schreibversuch still verpuffen statt zu werfen — er
  bliebe aber wirkungslos, das Ergebnis also unverändert.
* Die Vorrangregel gilt für den **Base**-Stand. `conservative`/`optimistic`
  wirken weiterhin nur auf die Bewertung je Szenario; Matrix und Reverse DCF
  sind per Definition um den Base-Stand herum aufgebaut.
* `_dcfCoreCloneData` kopiert reine JSON-Werte. Nicht-JSON-Werte im
  Master-JSON (Funktionen, `Map`, `Set`) würden nicht sinnvoll übernommen —
  im Schema kommen sie nicht vor.
* Nicht behoben, wie beauftragt: der Einheitenverdacht in
  `_makeBaseValuation()` (125 von 134 Fixtures setzen Sätze als Brüche,
  während der Produktionspfad in Prozentpunkten arbeitet). Keine pauschale
  Umrechnung, keine Neukalibrierung.
* Weiter offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`;
  Korrelationen der Monte-Carlo-Größen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` nicht angehoben (mehrere Fixtures pinnen
  `1.0.35-base-rate-lite` exakt).

### Ausgangsstand für den nächsten Schritt

Reparaturbranch: `claude/dcf-core-interface-fixes` (Basis `8a928d6` auf
`claude/dcf-core-extraction`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `8de542e`; Ergebniscommit ist die Spitze des
Reparaturbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/dcf-core-interface-fixes
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/8de542e

## Update (Chat 8): DCF-Rechenkern von Oberfläche und globalem Zustand entkoppelt (V1.0.47)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/snapshot-numeric-field-validation`, Ausgangscommit `4c1fdc4` — die
Spitze dieses Branches und der einzige Stand, der ihn enthält; kein neuerer
Fortsetzungsstand (`main` steht weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Arbeitsbranch: `claude/dcf-core-extraction`. Testbefehl: `npm test`.
Baseline auf `4c1fdc4` (ausgeführt): 1298 Rechen-Assertions · 28 SEC-Tests ·
Exit-Code 0.

Umfang: Entkopplung des bereits korrigierten DCF-Rechenkerns. Keine
Architekturmigration, kein Framework, keine neue Build-Infrastruktur, keine
Neustrukturierung der Quality Engine.

### Befund vor der Änderung

Der Kern war fachlich bereits sauber, aber nicht als Einheit greifbar:

* Die Rechenfunktionen (`_resolveOwcForForecast`, `buildForecastInputs`,
  `forecastDcfCore`, `buildCoreValuationContext`, `coreValuationDetail`,
  `coreEquityValuePerShare`, `solveReverseDcfGrowth`,
  `computeSensitivityMatrix`) waren **bereits frei** von DOM, `localStorage`
  und globalem `state` — nachgemessen, nicht angenommen. Es fehlte aber jede
  Absicherung dagegen, und sie waren nicht ohne Browser ladbar.
* Es gab **keinen gemeinsamen Einstiegspunkt**: Aufrufer mussten vier
  Funktionen einzeln in der richtigen Reihenfolge bedienen.
* Es gab **keine Einheitengrenze**. Der Kern rechnet Zinssätze in
  Prozentpunkten, das war aber nirgends festgehalten.
* Drei Ersatzwerte waren **still**: Steuerquote 25 %, D&A-Quote 0 und
  Working-Capital-Quote 0.
* `dcfCore(fcf, g1, tg, wacc, fade)` war ein überholter, doppelter
  Rechenpfad ohne Working Capital, Nettoschuldenbrücke und Aktienprojektion.

### Umsetzung

**1. Gemeinsame Schnittstelle (Auftragspunkt 1).**
Zwei Einstiegspunkte im Kern:

```
normalizeDcfCoreInput(masterJson, options) → { ok, input, diagnostics }
runDcfCoreAnalysis(input, which)           → { ok, valuation, reverseDcf,
                                               sensitivity, diagnostics }
analyzeDcfFromMasterJson(mj, options, which)   // dünne Zusammensetzung
```

`runDcfCoreAnalysis` liest **ausschliesslich** aus seinem Argument. Das
Inputobjekt trägt alles: den abgeleiteten Kontext (`ctx`), Szenarien, Kurs,
Zielkurs, Margen-Override, aktive Modelle, Einheitenbeschreibung und die
Datenbasis. `which` steuert, ob Bewertung, Reverse DCF und/oder Matrix
gerechnet werden.

Der Einstiegspunkt **delegiert** an die vorhandenen, geprüften Funktionen und
rechnet nichts eigenständig nach — deshalb sind die Ergebnisse bitgleich.

**2. Kein DOM, kein localStorage, kein globaler Zustand (Auftragspunkt 2).**
Der Kern liegt in einem markierten Block:

```
// ╔═ DCF-CORE-BLOCK START ═╗   …   // ╔═ DCF-CORE-BLOCK ENDE ═╗
```

`tests/dcf-core-isolation.test.mjs` prüft dauerhaft, dass der ausführbare Code
des Blocks weder `document.`, `localStorage`, `window.`, `state.`, `alert(`,
`confirm(`, `fetch(`, `getElementById`, `innerHTML`, `Date.now(`, `new Date(`
noch `Math.random(` enthält, und dass er in einer **leeren** Sandbox (ohne
jede Browser-Attrappe) vollständig durchläuft.

Die stillen Ersatzwerte sind nicht mehr versteckt: sie stehen jetzt in
`diagnostics.appliedDefaults` mit Feld, Wert, Einheit und Begründung. Ihre
**Werte wurden nicht geändert** — das hätte Ergebnisse verschoben und den
Abnahmepunkt „vorher/nachher identisch" verletzt.

**3. Einheitengrenze (Auftragspunkt 3).** `DCF_CORE_UNITS` hält die
Konventionen fest und wird im Ergebnis mitgeführt:

| Grösse | Einheit |
|---|---|
| Geldbeträge | Millionen USD |
| Werte je Aktie | USD je Aktie |
| Aktienzahlen | Millionen Stück |
| Zinssätze, Wachstum, Steuerquote, Margen | **Prozentpunkte** (`wacc = 10` ⇒ 10 %) |
| Abgeleitete Quoten (`opMargin`, `capexIntensity`, `daRatio`, `owcRatio`) | **Brüche** (0,05 ⇒ 5 % vom Umsatz) |
| Prognose | 10 Jahre, danach Gordon-Terminalwert |

Die Grenze rechnet **nicht still um**. Ein Satz, der wie ein Bruch aussieht
(0 < |x| < 1), wird als `diagnostics.unitWarnings`-Eintrag gemeldet und
unverändert weitergereicht. Eine stille Umdeutung würde Ergebnisse
verschieben, ohne dass es jemand bemerkt.

**4. Bestehende Aufrufer über dünne Adapter (Auftragspunkt 4).**
Die vorhandenen Aufrufer sind bereits dünn und blieben **unverändert**; sie
sind jetzt unterhalb der Blockgrenze als Adapterschicht benannt:
`buildSensitivityMatrix` (nur HTML), `runValuationEngine`, `runMonteCarloDcf`,
`buildSnapshotForecastTargets`, `renderValuation`/`renderOverview`.

**5. Ungenutzter doppelter Rechenpfad entfernt (Auftragspunkt 5).**
`dcfCore()` entfernt. Nachweis **vor** dem Entfernen: genau ein Vorkommen im
gesamten Quelltext (die Deklaration selbst), kein Aufruf, keine Testreferenz.
Ein Regressionstest hält den Zustand fest. Sonst wurde nichts entfernt.

**6. Moduldatei und separate Tests (Auftragspunkt 6).**
Neu `src/dcf-core.js`: lädt den markierten Block samt der im Block
deklarierten Helfer (`DCF_CORE_REQUIRED_HELPERS`) und stellt ihn als
gewöhnliches CommonJS-Modul bereit — ohne Build-Schritt und ohne
Abhängigkeiten.

Bewusst **keine Kopie der Logik**: die HTML-Datei bleibt die einzige Quelle,
eine zweite Fassung desselben Codes würde auseinanderlaufen. Dieselbe
Entscheidung liegt dem vorhandenen `tests/extract-functions.mjs` zugrunde.
Die Anwendung startet damit weiterhin alleinstehend per `file://`.

**Bewusste Grenze:** acht reine Helfer bleiben bei ihrer Datenschicht statt in
den Bewertungskern zu wandern — insbesondere `_joinPeriodKeyed` (193 Zeilen)
gehört zur SEC-Datenaufbereitung und wäre im Kern fehl am Platz. Sie sind im
Block **ausdrücklich deklariert**; der Isolationstest prüft, dass die Liste
vollständig ist, keine unbenutzten Einträge trägt und alle Beteiligten selbst
browserfrei sind.

### Abnahme

**Vorher/nachher identische Ergebnisse.** Ein Fingerabdruck über **alle 134**
Regressions-Fixtures mit `mj` wurde auf `4c1fdc4` und auf diesem Stand
erzeugt und verglichen: je Fixture die Forecast-Inputs, 72 Bewertungspunkte
(g1 ∈ {−5, 0, 4, 8, 12, 20} × tg ∈ {0, 2, 3} × WACC ∈ {7, 9, 10, 12}) mit
operativem Wert, Eigenkapitalwert, TV-Anteil, Terminal-FCFF, Umsatz Jahr 10
und ΔOWC-Summe, dazu der Reverse-DCF-Status samt Nullstellen und die
vollständige Sensitivitätsmatrix. Ergebnis: **byte-identisch**
(1 256 993 Zeichen, 0 Abweichungen, 0 Fehler auf beiden Seiten).

**Kern direkt ohne Browser testbar.** `require('./src/dcf-core.js')` →
`loadDcfCore()` wertet in einem vm-Kontext **ohne** `document`, `window`,
`localStorage` oder `state` aus; die volle Analyse läuft dort durch.

**Bestehender Import und UI-Aufruf funktionieren weiterhin.** Im echten
Browser geprüft (siehe Tests).

**Änderungen begrenzt.** Kern (Blockmarken, Einheitengrenze,
Einstiegspunkt, Adapter-Notiz, Entfernen von `dcfCore`), die neue Moduldatei,
zwei Testdateien, `package.json` (ein zusätzliches Skript) und dieses Dokument.

### Neue Tests

* **`tests/dcf-core.test.mjs` (16 Tests)** — Modul-API ohne Browser:
  vollständiges Inputobjekt mit Einheiten; fehlende Inputs ⇒ `ok:false` mit
  benannten Feldern statt Ersatzwerten; Brüche werden gemeldet, **nicht**
  umgerechnet; `0` ist kein Einheitenverdacht; stille Ersatzwerte erscheinen
  als `appliedDefaults`; handgerechnete Prognosereihe (Jahr 1: Umsatz 1080,
  EBIT 216, FCFF 162 · Jahr 2: 1166,40 / 174,96); Nettoschuldenbrücke
  (1,00 USD/Aktie); fehlende Nettoschulden ⇒ kein Eigenkapitalwert;
  WACC ≤ tg ⇒ `null`; der Einstiegspunkt liefert **dieselben Zahlen** wie die
  Einzelbausteine (Bewertung, Reverse DCF, Matrixzellen); `which` steuert den
  Umfang; der Kern verändert sein Inputobjekt nicht; gleiche Eingabe ⇒
  bitgleiche Ausgabe; Mid-Cycle-Override wird durchgereicht.
* **`tests/dcf-core-isolation.test.mjs` (7 Tests)** — Blockmarken genau einmal
  vorhanden; keine Oberflächen-, Speicher- oder Zustandszugriffe im
  ausführbaren Code (Kommentare werden vorher entfernt, da die Prosa diese
  Begriffe absichtlich nennt); die deklarierten Helfer sind selbst frei davon;
  Lauf in leerer Sandbox; Helferliste vollständig und ohne Karteileichen;
  `dcfCore()` entfernt; Kernblock liegt inline in der HTML-Datei, damit der
  alleinstehende Start erhalten bleibt.

`npm run test:core` fährt beide gezielt; `npm test` enthält sie über
`tests/*.test.mjs`.

### Gegenproben (ausgeführt)

| Rückbau | Rot |
|---|---|
| GP-1 `document.getElementById` in den Kernblock eingeschleust | 2 (Codeprüfung + leere Sandbox) |
| GP-2 `state.lastCoreResult = out` im Kernblock | 2 (dieselben) |
| GP-3 `_resolveNetDebtForDcfBridge` aus der Helferliste entfernt | 1 (leere Sandbox) |
| GP-4 `dcfCore()` wieder eingefügt | 1 (Regressionstest) |

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1298 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (unverändert zur Baseline — der Kern rechnet
  identisch), Node-Tests **51/51** (vorher 28; +23 neu), gemeinsamer
  **Exit-Code 0**. Keine bestehende Erwartung geändert oder gelockert.
* **Fingerabdruck-Vergleich** über 134 Fixtures gegen `4c1fdc4`:
  byte-identisch (siehe Abnahme).
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 JS-Fehler**:
  alleinstehender Start gelingt; `runFullEvaluation()` liefert für
  `T-TXRH-DEBT2` unverändert BP 7,4357081414 und FV Base 10,4360816;
  `analyzeDcfFromMasterJson()` auf denselben Inputs stimmt mit dem
  Einzelbaustein `coreEquityValuePerShare()` überein; der dünne UI-Adapter
  `buildSensitivityMatrix()` rendert weiterhin.

### Verbleibende Grenzen und offene Punkte

* **Einheitenverdacht in den Fixtures.** Die neue Grenze meldet ihn bei
  **125 von 134** Fixtures: `_makeBaseValuation()` setzt `wacc_derived: 0.09`,
  `growth_terminal: 0.03`, `growth_stage1: 0.07`, `tax_rate: 0.21` — also
  Brüche, während der Kern Prozentpunkte erwartet. Der **Produktionspfad**
  arbeitet dagegen in Prozentpunkten (`WACC_FLOORS` = 8,5…9,5;
  `risk_free * 100 + 4.0`). Die Fixture-Erwartungen sind auf das heutige
  Verhalten kalibriert; eine Umstellung würde Ergebnisse verschieben und war
  hier ausdrücklich nicht beauftragt. **Nicht behoben, bewusst gemeldet.**
* Der Kern-Einstiegspunkt ist **additiv**. Die Oberfläche ruft weiterhin die
  Einzelbausteine; eine Umstellung der bestehenden Aufrufer war nicht Teil des
  Auftrags („bestehende UI-Aufrufer über dünne Adapter erhalten").
* `src/dcf-core.js` lädt den Block über Textmarken aus der HTML-Datei. Werden
  die Marken entfernt oder dupliziert, schlägt der Isolationstest fehl — das
  ist die Absicherung, ersetzt aber keinen echten Build.
* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei.
* Nicht angefasst (ausserhalb des Auftrags): Quality Engine, Synthese, DDM,
  RIM, Monte-Carlo-Korrelationen, `ENGINE_VERSION`/`DISPLAY_VERSION`
  (mehrere Fixtures pinnen `1.0.35-base-rate-lite` exakt), index-basierte
  Ableitung von `eps_diluted`/`book_value`/`dps` in `applyDerivedFieldsV4`.

### Ausgangsstand für den nächsten Schritt

Arbeitsbranch: `claude/dcf-core-extraction` (Basis `4c1fdc4` auf
`claude/snapshot-numeric-field-validation`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Neue Dateien: `src/dcf-core.js`, `tests/dcf-core.test.mjs`,
`tests/dcf-core-isolation.test.mjs`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `6f084a8`; Ergebniscommit ist die Spitze des
Arbeitsbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/dcf-core-extraction
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/6f084a8

## Update (Chat 7 Restfehler): Numerisch verwendete Snapshot-Felder validiert (V1.0.46)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/snapshot-repair-fixes`, Ausgangscommit `d345dea` — die Spitze dieses
Branches und der einzige Stand, der ihn enthaelt; keine nachfolgenden Commits
(`main` steht weiterhin auf `b023dc8`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Arbeitsbranch: `claude/snapshot-numeric-field-validation`. Testbefehl: `npm test`.
Baseline auf `d345dea` (ausgefuehrt): 1229 Rechen-Assertions · 28 SEC-Tests ·
Exit-Code 0.

Umfang: ausschliesslich diese Validierung, der unmittelbar betroffene
Journal-Aufrufer, Tests und dieses Dokument. Keine Bewertungsformel geaendert,
kein Refactoring, keine neuen Abhaengigkeiten, keine bestehende Erwartung
gelockert.

### Am Code reproduziert (Stand `d345dea`, ueber den echten Importweg)

Ein ansonsten gueltiger Snapshot mit `output_signals.buyPrice: "7.43"`:

```
parseSnapshotImportPayload  → ok: true · uebernommen: 1 · Fehler: 0
validateSnapshotRecordStructure → []            (keine Beanstandung)
importSnapshots()           → Bestand ["keeper"] → ["keeper","bad1"]
                              localStorage.setItem-Aufrufe: 1
                              Dialog: "Import fehlgeschlagen:
                              s.output_signals.buyPrice.toFixed is not a function"
renderSnapshots()           → CRASH, Journal-HTML-Laenge 0
```

Der Datensatz stand also bereits im Browser-Speicher, als die Fehlermeldung
erschien — und das Journal ging danach nicht mehr auf. Ursache: die Pruefung
aus V1.0.45 validierte die **aeusseren** Objekte (`output_signals` ist ein
Objekt — in Ordnung), aber nicht die darin **numerisch verwendeten** Felder.

### Ermittelte Felder (aus den tatsaechlichen Aufrufern)

`renderSnapshots()` und seine Anzeige-, Vergleichs- und Formatierungshelfer
verarbeiten diese Snapshot-Felder als Zahl — inklusive der tatsaechlich
verwendeten Fallbacks und des per Migration unterstuetzten Altschluessels:

| Aufrufer | Felder |
|---|---|
| `renderSnapshots` | `output_signals.buyPrice` (`toFixed`), Fallback `synthesis.buyPrice`, `output_signals.deepValuePrice`, `key_inputs.price` |
| `_snapDelta` + Delta-Tabelle, formatiert ueber `_fmtDiff` | `output_signals.range_conservative` / `range_base` / `range_optimistic`, `key_inputs.wacc_derived`, `key_inputs.growth_stage1` |
| `_postMortemLine` | `key_inputs.price`, `output_signals.buyPrice`, `output_signals.range_base` (Prozentrechnung + `toFixed`) |
| `_priceComparisonBlock` | `_fc.price`, `_fc.buyPrice`, `_fc.deepValuePrice`, `_fc.range_conservative`, `_fc.range_base`, `_fc.qceScore` |
| Altschluessel | `synthesisV3.buyPrice` — `migrateSnapshotRecord` bildet ihn auf `synthesis.buyPrice` ab, wo derselbe Fallback greift |

Nicht aufgenommen, weil in diesen Aufrufern **nicht** numerisch verarbeitet:
`output_signals.mos_total` (nur in `compareStoredVsRecomputed`, ohne
Formatierung), `_fc.dataQualityScore` (nur roh im CSV-Export),
`_fc.topWarnings` (bereits per `Array.isArray` geschuetzt).

### Korrektur

* Neue Tabelle `SNAPSHOT_NUMERIC_FIELDS` (16 Eintraege) mit Pfad und
  Verwendungszweck je Feld — die Fehlermeldung nennt den Zweck mit.
* `_readSnapshotPath(rec, path)` liest defensiv; fehlt ein Zwischenglied oder
  ist es kein Objekt, gibt es das Feld hier schlicht nicht.
* `validateSnapshotNumericFields(rec)`: ist der Wert `undefined` oder `null`,
  bleibt das **zulaessig** — die Anzeige prueft ueberall auf `!= null` und
  schreibt dann „–". Ist er **vorhanden**, muss `typeof v === 'number' &&
  isFinite(v)` gelten. `0`, `-0`, negative Werte und Extremwerte sind gueltige
  Zahlen und werden nicht abgelehnt. **Kein `Number()`/`parseFloat()`** — eine
  stille Umwandlung wuerde aus `"7.43"` eine Zahl machen und damit verdecken,
  dass die Datei kaputt ist; der Quellwert wird nicht angefasst.
* Eingehaengt in die **bestehende** `validateSnapshotRecordStructure`. Damit
  bedient **dieselbe** Pruefstelle den Import *und* den Journal-Schutz fuer
  bereits gespeicherte Datensaetze — es gibt keine zweite, abweichende Liste.
* `migrateSnapshotRecord` prueft jetzt den **Rohwert** statt der Tiefkopie:
  `_deepCopyForSnapshot` ueberfuehrt `NaN`/`Infinity` nach JSON-Semantik in
  `null`, was sonst als „Feld fehlt" durchginge.
* Meldung: `Eintrag 1 von 1 abgelehnt: Unbrauchbarer Datensatz — Feld
  "output_signals.buyPrice" muss eine endliche Zahl sein (fehlend oder null ist
  erlaubt), erhalten Text ("7.43") — verwendet fuer Journal: Einstiegspreis.`
  Der gesamte Import bricht **vor** jedem Schreibzugriff ab (Alles-oder-nichts
  aus V1.0.45 bleibt); bestehende Snapshots bleiben unveraendert.
* `renderSnapshots` kennzeichnet bereits gespeicherte Fehldatensaetze mit dem
  konkreten Grund und zeigt gueltige Eintraege samt Aktionsknoepfen weiter an.
  **Keine automatische Loeschung oder Umschreibung** — der Hinweistext sagt
  das jetzt ausdruecklich; die Versionsangabe darin wurde auf V1.0.46
  nachgezogen.

Nach der Korrektur, ueber denselben Weg gemessen: `ok: false`, Bestand
`["keeper"] → ["keeper"]`, **0** `setItem`-Aufrufe, keine Erfolgsmeldung,
`renderSnapshots()` in Ordnung (Journal-HTML 1300 Zeichen).

### Neue Regressionstests — 69 Assertions in `_testSnapshotPathConsistency`

* **PC-8 (8)** Der gemeldete Fall: derselbe Datensatz mit `7.43` als Zahl ist
  gueltig (damit der Test nicht an einer anderen Ursache haengt); mit `"7.43"`
  genau eine Beanstandung, die Feldpfad, erwarteten Datentyp und das Erhaltene
  nennt und darauf hinweist, dass fehlend/null erlaubt bleibt; Ablehnung mit
  Eintragsnummer; Gegenprobe, dass genau dieser Wert `.toFixed` werfen laesst.
* **PC-9 (7)** Ueber den **tatsaechlichen** `importSnapshots()`-Aufruf
  (FileReader-Attrappe, `localStorage.setItem` gezaehlt, `alert` abgefangen):
  wirft nicht · **0** `setItem` · Bestand vorher/nachher zeichengleich · genau
  ein Dialog, keine Erfolgsmeldung · Feldpfad und Eintragsnummer im Dialog ·
  nicht mehr die alte Meldung „Import fehlgeschlagen" · Restbestand
  journaltauglich.
* **PC-10 (41)** Tabellengesteuert ueber **alle** 16 Felder: je 10 falsche
  Typen (`"7.43"`, `"0"`, leerer Text, `true`, `false`, Array, leeres Array,
  Objekt, `NaN`, `Infinity`) — jeweils genau dieses Feld beanstandet **und**
  vom Import abgelehnt; je Feld `12,5` weiterhin gueltig; `fehlend`, `null`,
  `0`, `-0`, `negativ`, `1e12`, `1e-9` bleiben ueberall gueltig; fehlende oder
  `null`-Traegerobjekte sind kein Mangel; der Quellwert wird nicht umgewandelt.
  PC-10a prueft zusaetzlich, dass die Tabelle alle fuenf Traeger abdeckt
  (`output_signals`, `key_inputs`, `_fc`, `synthesis`, `synthesisV3`).
* **PC-11 (9)** Kein Teilimport (gueltig + ungueltig ⇒ vollstaendiger Abbruch
  mit Eintragsnummer und Feldpfad, Bestand unveraendert); bereits gespeicherter
  Fehldatensatz wird vom Journal-Schutz erkannt, der gueltige Eintrag bleibt
  erreichbar, Sortierung und Formatierung der gueltigen Eintraege werfen nicht,
  und nichts wird geloescht oder umgeschrieben.
* **PC-12 (7)** Gueltiger Format-1-Altsnapshot bleibt gruen (`growth_stage1: 0`
  und `deepValuePrice: null` stoeren nicht) und laedt weiter ueber den echten
  Ladepfad; der Altschluessel `synthesisV3.buyPrice` als Text wird erkannt;
  Format-2-Export/Import-Roundtrip bleibt gruen; `buildSnapshotRecord` erzeugt
  stets journaltaugliche Datensaetze.

### Gegenproben (ausgefuehrt)

| Rueckbau | Rot |
|---|---|
| GP-1 numerische Pruefung nicht eingehaengt | 35 — u. a. PC-9b mit **1** `setItem` und Bestand `["keeper","num2"]`, PC-9d mit Erfolgsmeldung, PC-11d „erkannt: 0 von 2" |
| GP-2 nur `output_signals.buyPrice` geprueft (Teilloesung) | 2 (PC-10a, PC-12d) |
| GP-3 stille Umwandlung via `Number(v)` | 35 (dieselben wie GP-1) |
| GP-4 `0`/negative faelschlich abgelehnt | 4 (PC-10e, PC-12a/b/c) |
| GP-5 Tiefkopie statt Rohwert geprueft | 17 (alle PC-10c mit „NaN → Import angenommen") |

Die Assertions wurden dafuer defensiv gemacht (`probs[0] || '(keine
Beanstandung)'` usw.), damit ein Rueckbau **sauber fehlschlaegt** statt eine
Ausnahme zu werfen.

### Tatsaechlich ausgefuehrte Tests

* `npm test` (**Node-Pruefung**, DOM-frei) → Rechentests **1298 bestanden ·
  0 fehlgeschlagen · 0 Fehler/Exceptions** (vorher 1229; +69), SEC-Tests
  **28/28**, gemeinsamer **Exit-Code 0**.
* **Echter Browser** (Chromium 1194 headless ueber `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhaengigkeitsfrei), Datei per `file://`, Import ueber das echte
  Dateifeld `#snap-import-file`, **0 JS-Fehler**:
  1. `output_signals.buyPrice: "7.43"` ⇒ Bestand `["keeper"]` unveraendert,
     **0** `setItem`-Aufrufe, Dialog „Import abgebrochen — nichts wurde
     gespeichert. Eintrag 1 von 1 abgelehnt: … Feld
     \"output_signals.buyPrice\" muss eine endliche Zahl sein …", keine
     Erfolgsmeldung, Journal weiter bedienbar.
  2. Am Import vorbei eingeschleuster Fehldatensatz ⇒ Journal rendert, gueltiger
     Eintrag samt BP 3,25 sichtbar und loeschbar, Hinweis mit Grund
     (`output_signals.buyPrice`), Bestand `["keeper","stored_bad"]` unveraendert.
  3. Gueltiger Format-2-Roundtrip ⇒ importiert, Journal gerendert, Dialog
     „1 neue Snapshot(s) importiert".

### Verbleibende Grenzen

* `npm test` ist eine **Node-Pruefung** ohne DOM; die Suite bleibt bewusst
  abhaengigkeitsfrei. Der Browsercheck ist ein einmalig ausgefuehrtes Skript im
  Arbeitsverzeichnis und **kein** Bestandteil von `npm test` — die
  DOM-Verdrahtung ist damit nicht dauerhaft regressionsgesichert.
* `_testSnapshotPathConsistency` betaeubt weiterhin die rein visuellen Helfer
  (`switchTab`, `updateTickerBadge`, `renderSnapshots`, …) und tauscht in PC-9
  zusaetzlich `localStorage.setItem`, `alert` und `FileReader`; alles wird im
  `finally` zurueckgesetzt. Das ist ausdruecklich kein Browsernachweis.
* Die Feldtabelle deckt `renderSnapshots` und dessen Helfer ab. Felder, die nur
  andere Ansichten (Overview, Valuation) numerisch verwenden, sind **nicht**
  Gegenstand dieser Reparatur.
* Nicht-numerische Typfehler ausserhalb der geprueften Felder (z. B.
  `_fc.date` als Objekt) fuehren weiterhin zu „–" statt zu einer Ablehnung —
  sie stuerzen nicht ab und waren nicht Teil des Auftrags.
* Der Bestand im Browser-Speicher wird **nicht** automatisch bereinigt;
  unbrauchbare Eintraege werden ausgewiesen, aber bewusst nicht geloescht.
* Unveraendert offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`; Korrelationen
  der Monte-Carlo-Groessen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` nicht angehoben (mehrere
  Fixtures pinnen `1.0.35-base-rate-lite` exakt).

### Ausgangsstand fuer Chat 8

Arbeitsbranch: `claude/snapshot-numeric-field-validation` (Basis `d345dea` auf
`claude/snapshot-repair-fixes`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test` — beide Suiten gruen, Exit-Code 0.
Code-Commit dieses Schritts: `b09d6be`; Ergebniscommit ist die Spitze des
Arbeitsbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/snapshot-numeric-field-validation
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/b09d6be

## Update (Chat 7 Reparatur): Drei Pruefbefunde behoben (V1.0.45)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprueftes Branch
`claude/awesome-johnson-j9c246`, geprueftes Commit `e71a4d5` — die Spitze dieses
Branches und der einzige Stand, der es enthaelt (`main` steht weiterhin auf
`b023dc8`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Reparaturbranch: `claude/snapshot-repair-fixes`. Testbefehl: `npm test`.
Baseline auf `e71a4d5` (ausgefuehrt): 1130 Rechen-Assertions · 28 SEC-Tests ·
Exit-Code 0.

Umfang: ausschliesslich die drei gemeldeten Fehler, unmittelbar noetige Helfer,
Tests und dieses Dokument. Keine Aenderung an Bewertungsformeln oder
Abschlagsregeln.

---

### Fehler 1 — Vergleich und Anzeige rechneten unterschiedlich

**Am Code reproduziert** (Fixture `T-TXRH-DEBT2`, Stand `e71a4d5`):

| | Einstiegspreis | Sicherheitsabschlag |
|---|---|---|
| Anzeigepfad (`runFullEvaluation`) | **7,4357081414** | **28,75 %** |
| Helfer (`recomputeSnapshotWithCurrentModel`) | 7,8270612014 | 25,00 % |

Ursache: der Helfer pflegte einen **eigenen, zweiten Bewertungsablauf**. Er rief
`runFairValueSynthesizer(mj, valuation, quality, SYNTHESIS_CONFIG)` direkt auf —
ohne `computeDataQualityScore` und ohne das daraus gebildete `_dqResult`, an dem
der Datenqualitaets-Abschlag haengt — und liess `checkPerShareSanity` ganz aus.
Zusaetzlich rechnete `loadSnapshotWithCurrentModel` **zweimal**: einmal in
`compareStoredVsRecomputed` (Meldung) und einmal ueber
`_applySnapshotToState` → `runFullEvaluation` (Anzeige). Die Meldung nannte
also einen anderen Wert als die Anzeige daneben.

**Korrektur — ein gemeinsamer Ablauf statt zweier gepflegter.**
* Neu `_runFullEvaluationCore(mj)`: der vollstaendige Ablauf, **Schritt fuer
  Schritt unveraendert** aus `runFullEvaluation` herausgeloest — Aufbereitung,
  `runQualityEngine`, `runValuationEngine`, `computeDataQualityScore`,
  `_applyValuationResult` (das `_dqResult` weiterreicht), `checkPerShareSanity`,
  `evaluateBaseRateWarnings`, Growth-Layer. `runFullEvaluation` ist jetzt ein
  Dreizeiler darum herum.
* Neu `evaluateMasterJsonDetached(mj)`: fuehrt denselben Ablauf aus und stellt
  den sichtbaren Zustand danach vollstaendig wieder her. Die Ergebnisfelder
  (`EVALUATION_STATE_KEYS`) werden vorher geleert, damit Einstellungen einer
  zuvor aktiven Aktie nicht einfliessen.
* `recomputeSnapshotWithCurrentModel` rechnet auf `_deepCopyForSnapshot(...)`
  der gespeicherten Inputs und laeuft ueber diese eine Stelle.
* `compareStoredVsRecomputed(snap, precomputed)` nimmt ein fertiges Ergebnis
  entgegen; `_applySnapshotToState(..., { recomputed })` **uebernimmt** es,
  statt ein zweites Mal zu rechnen. `loadSnapshotWithCurrentModel` rechnet damit
  genau einmal und speist Meldung und Anzeige aus demselben Ergebnis.
* Der Vergleich fuehrt jetzt auch `range_cons`, `range_opt` und `mos_total`.

### Fehler 2 — gespeicherte Datenqualitaet wurde beim Laden nicht wiederhergestellt

**Am Code reproduziert:** Zustand `{grade:'D',score:5}`, Snapshot mit
`{grade:'A',score:95}` geladen ⇒ `state.dataQuality` blieb **D**.
`_applySnapshotToState` fasste das Feld ueberhaupt nicht an.

**Korrektur.** `_applySnapshotToState` uebernimmt `s.dataQuality` als
**unabhaengige Kopie** (`_deepCopyForSnapshot`). Fehlt die Angabe
(Format-1-Altsnapshot), wird sie als **nicht vorhanden** gefuehrt (`null`) —
die Note der zuvor aktiven Aktie bleibt nicht stehen, und es wird auch nichts
heute Berechnetes als damals gespeichertes Ergebnis ausgegeben. Das Fehlen
steht in `state._snapshotDataQualityMissing`. Beim ausdruecklich gewaehlten
Neuberechnen gilt die mit dem aktuellen Modell ermittelte Datenqualitaet.

### Fehler 3 — Import akzeptierte unbrauchbare Datensaetze und ungueltige Versionen

**Am Code reproduziert:** `[{},{}]` wurde angenommen und gespeichert; die
anschliessende Journal-Sortierung warf
`Cannot read properties of undefined (reading 'localeCompare')`; der leere
Datensatz war nicht ladbar. `_snapshotFormat: "999"` galt auf Huellen- **und**
Datensatzebene als Format 1 statt als ungueltige Angabe.

**Korrektur.**
* Neu `validateSnapshotRecordStructure(rec)` — Anforderungen aus den
  **tatsaechlichen Aufrufern** abgeleitet: `renderSnapshots` braucht `ticker`
  (Gruppenschluessel), `timestamp` (`localeCompare`, `new Date`), `id`
  (Aktionsknoepfe, `find`) und `name`; `exportSnapshotsCSV` braucht
  `timestamp.slice`; `_applySnapshotToState` braucht normalisierte Inputs als
  Objekt; `_snapDelta` braucht `output_signals`/`key_inputs` als Objekte, falls
  vorhanden. Geprueft **vor** der Migration — eine Migration macht einen
  unbrauchbaren Datensatz nicht brauchbar.
* Neu `_resolveSnapshotFormatValue(value, wo)`: **fehlende** Angabe bleibt
  zulaessig (Altdaten, Format 1); eine **vorhandene** muss eine unterstuetzte
  positive Ganzzahl sein. Strings (`"999"`, `"1"`), `true`/`false`, `1.5`, `0`,
  negative Werte, `NaN`, `Infinity`, Objekte und Arrays werden abgewiesen.
  Neuere Formate weiterhin abgelehnt. Gilt fuer Huelle und Datensatz.
  Die Datensatzangabe wird am **Rohwert** geprueft, nicht an der Tiefkopie:
  diese ueberfuehrt `NaN`/`Infinity` nach JSON-Semantik in `null`, was sonst
  als "fehlt" durchginge.
* `parseSnapshotImportPayload` bricht bei **jedem** ungueltigen Eintrag den
  gesamten Import ab — mit Eintragsnummer (`Eintrag 2 von 3`) und konkretem
  Grund; `snapshots` bleibt leer. Kein Teilimport mehr.
  `importSnapshots` schrieb schon bisher erst nach dieser Pruefung.
* `renderSnapshots` weist bereits im Browser-Speicher liegende unbrauchbare
  Eintraege aus, statt an ihnen zu scheitern. Wer unter V1.0.44 `[{},{}]`
  importiert hat, konnte das Journal sonst nie wieder oeffnen — auch nicht,
  um zu loeschen.
* Gueltige Format-1-Altsnapshots bleiben gueltig: fehlende **neue**
  Zusatzfelder machen sie nicht unbrauchbar, Altschluessel werden weiter
  abgebildet, und sie sind danach anzeigbar und ladbar.

### Geaenderte Testerwartung (fachlich begruendet)

`SN-4n` sicherte bis hier das alte Verhalten "unbrauchbare Eintraege einzeln
ablehnen, brauchbare uebernehmen". Genau dieser Teilimport ist Gegenstand von
Auftragspunkt 3.4 ("Brich bei ungueltigen Eintraegen den gesamten Import vor dem
Speichern ab"). Die Erwartung wurde umgestellt und um `SN-4n2` ergaenzt, das
Eintragsnummer und die Aussage "NICHTS importiert" prueft. Keine andere
Erwartung wurde geaendert oder gelockert.

### Neue Regressionstests — `_testSnapshotPathConsistency` (98 Assertions)

Registriert in `PURE_TEST_FUNCTIONS` (`test/run-calc-tests.js`). Die Tests fahren
die **tatsaechlichen Aufrufwege** — `runFullEvaluation` ueber `state`,
`loadSnapshot(id)` und `loadSnapshotWithCurrentModel(id)` ueber den
Journalbestand in `localStorage` — nicht zweimal denselben isolierten Helfer.
Rein visuelle Helfer werden waehrend des Laufs betaeubt und danach
wiederhergestellt; `state` und der Snapshot-Bestand werden gesichert und
zurueckgesetzt.

* **PC-1 (13)** `T-TXRH-DEBT2`: Anzeigepfad liefert 7,4357081414 / 28,75 % und
  ausdruecklich **nicht** 7,8270612014 / 25 %; ueber
  `loadSnapshotWithCurrentModel` stimmen Vergleichsmeldung, Anzeige und
  frischer Anzeigepfad in Einstiegspreis, Abschlag, Position und allen drei
  Baendern ueberein; der gespeicherte Snapshot bleibt bei 1,11 und
  `1.0.30-alt`; der Vergleichsweg ruft den gemeinsamen Ablauf **genau einmal**.
* **PC-2 (5)** Nachgelagerte Sperre: Fixture mit 20.000 Aktien loest
  `checkPerShareSanity` aus. Anzeigepfad, Vergleichshelfer und Anzeige nach dem
  Vergleichsweg sperren gleich (`position: 'blocked'`, `buyPrice: null`,
  identische Begruendung).
* **PC-3 (3)** Kein Uebertrag: mit einer fremden aktiven Aktie
  (`dataQuality D`, `buyPrice 999`) ergibt die Neuberechnung exakt den Wert des
  frischen Anzeigepfads; der sichtbare Zustand bleibt danach unberuehrt.
* **PC-4 (9)** Datenqualitaet: D → Snapshot A laden → A; Aenderungen am
  geladenen Wert lassen den Snapshot unberuehrt (beide Richtungen);
  Altsnapshot ohne Angabe ⇒ `null` statt D, Fehlen gekennzeichnet, uebrige
  Altschluessel kommen an; nach ausdruecklichem Neuberechnen gilt die heutige
  Datenqualitaet, der gespeicherte A-Wert bleibt im Snapshot.
* **PC-5 (29)** Struktur: `[{},{}]` abgelehnt mit Eintragsnummer und Grund,
  bestehender Bestand unveraendert, Gegenprobe dass die Journal-Sortierung an
  solchen Eintraegen scheitert; 11 Typfehler in tatsaechlich benoetigten
  Feldern (`id`, `ticker`, `name`, `timestamp` unlesbar/als Zahl, nur
  Leerzeichen, fehlende/falsch getypte Inputs, `meta` als Text,
  `output_signals` als Array); gueltig + ungueltig ⇒ kein Teilimport.
* **PC-6 (29)** Versionsangaben: 11 ungueltige Werte je auf Datensatz- und
  Huellenebene abgelehnt (darunter der gemeldete Fall `"999"`), neueres Format
  weiterhin abgelehnt, fehlende Angabe bleibt zulaessig und wird zu Format 1.
* **PC-7 (9)** Gueltige Importe bleiben funktionsfaehig: Format-1-Import samt
  Altschluesseln wird angenommen, migriert, ist journaltauglich und laesst sich
  ueber `loadSnapshot` laden; Format-2-Export/Import-Roundtrip laedt samt
  gespeicherter Datenqualitaet.

### Gegenproben (ausgefuehrt)

| Rueckbau | Rot |
|---|---|
| GP-1 alter Helferablauf (kein `_dqResult`, keine Per-share-Pruefung) | 7 — u. a. PC-1e/f mit **exakt** 7,827061201422972 und 0,25, PC-2b/c ohne Sperre |
| GP-2 `dataQuality` beim Laden nicht uebernehmen | 4 (PC-4a/e/f, PC-7h) |
| GP-3 Strukturpruefung entfernt | 16 (PC-5a/b/c, alle PC-5h) |
| GP-4 alte, lasche Formatpruefung (`typeof number`) | 22 (alle PC-6a/b) |
| GP-5 Teilimport wieder zulassen | 2 (PC-5j/k) |
| GP-7 Wiederherstellung des sichtbaren Zustands entfernt | 2 (PC-3b/c) |
| GP-8 `loadSnapshotWithCurrentModel` rechnet wieder zweimal | 1 (PC-1l) |

**GP-6 griff nicht** und wird nicht als Erfolg ausgegeben: das Leeren der
Ergebnisfelder in `evaluateMasterJsonDetached` ist nach dem Zusammenlegen
**nicht mehr ergebniswirksam**, weil `_runFullEvaluationCore` jedes gelesene
Feld (insbesondere `state.dataQuality`) vor der Verwendung selbst setzt. Es
bleibt als Absicherung gegen kuenftige Leser stehen; ergebniswirksam und
geprueft ist die **Wiederherstellung** (GP-7).

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1229 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (vorher 1130; +98 neu, +1 in `_testSnapshotIntegrity`),
  SEC-Tests **28/28**, gemeinsamer **Exit-Code 0**.
* **Echter Browser** (Chromium 1194 headless ueber `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhaengigkeitsfrei), Datei per `file://`, Bedienung ueber die
  Oberflaeche, **0 JS-Fehler**:
  1. Anzeigepfad: 7,4357081414 · 28,75 % · `overvalued` · Band-Base 10,4360816.
  2. Journal gerendert, beide Knoepfe vorhanden.
  3. „Gespeichertes Ergebnis": Zustand vorher `D/5` ⇒ danach `{grade:'A',score:95}`,
     Einstiegspreis 1,11, Statuszeile „Original-Bewertung geladen."
  4. „Neu rechnen (aktuelles Modell)": Vergleichsmeldung und Anzeige beide
     7,4357081414 / 28,75 %, identisch zum frischen Anzeigepfad; gespeicherter
     Wert 1,11 steht daneben; Snapshot unveraendert; Datenqualitaet ist die
     heute berechnete (Grade C).
  5. Import ueber `#snap-import-file`: `[{},{}]` ⇒ Dialog „Import abgebrochen —
     nichts wurde gespeichert. Eintrag 1 von 2 abgelehnt: …", Bestand
     unveraendert, Journal weiter bedienbar; gueltiger Export ⇒ importiert und
     gerendert; `_snapshotFormat: "999"` ⇒ „Exporthuelle: Formatversion muss
     eine Zahl sein, erhalten string (\"999\")", Bestand unveraendert.

### Verbleibende Grenzen

* Der Browsercheck ist ein **einmalig ausgefuehrtes Skript** im
  Arbeitsverzeichnis, kein Bestandteil von `npm test`; die Suite bleibt
  abhaengigkeitsfrei und DOM-frei. Die DOM-Verdrahtung ist damit nicht dauerhaft
  regressionsgesichert.
* `_testSnapshotPathConsistency` betaeubt `switchTab`, `updateTickerBadge`,
  `renderSnapshots`, `initAssumptionLiveRecalc`, `syncPiotroskiCheckboxes` und
  `_updateGrowthTabVisibility`. Das ist ausdruecklich **kein** Browsernachweis —
  dafuer steht der Punkt darueber.
* `_applySnapshotToState` schreibt seine Statuszeile jetzt defensiv
  (`if (el)`), damit der Ladepfad ausserhalb der fertigen Seite pruefbar ist.
* Der Kompatibilitaetsdialog (`_showSnapshotWarningModal`, Legacy- und
  inkompatible Snapshots) braucht `document.createElement` und ist im
  Node-Runner nicht gefahren; die PC-Tests nutzen Snapshots mit kompatibler
  Breaking-Version, wie `saveSnapshot` sie erzeugt.
* Der Bestand im Browser-Speicher wird **nicht** automatisch bereinigt:
  unbrauchbare Eintraege aus einem Import vor V1.0.45 werden im Journal
  ausgewiesen, aber nicht geloescht.

### Weitere entdeckte Punkte (nicht behoben, ausserhalb des Auftrags)

* `_snapshotDataQualityMissing` wird gesetzt, aber noch nirgends angezeigt —
  der Nutzer sieht das Fehlen nur als leere Datenqualitaet.
* Unveraendert offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`; Korrelationen
  der Monte-Carlo-Groessen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` nicht angehoben (mehrere
  Fixtures pinnen `1.0.35-base-rate-lite` exakt).

### Ausgangsstand fuer Chat 8

Reparaturbranch: `claude/snapshot-repair-fixes` (Basis `e71a4d5` auf
`claude/awesome-johnson-j9c246`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test` — beide Suiten gruen, Exit-Code 0.
Code-Commit dieses Schritts: `d36674f`; Ergebniscommit ist die Spitze des
Reparaturbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/snapshot-repair-fixes
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/d36674f

## Update (Chat 12): Reproduzierbare Bewertungssnapshots, ehrliche Erfolgskontrolle (V1.0.44)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/mos-input-validation`, Ausgangscommit `75dd901` — die Spitze dieses
Branches und der einzige Stand, der die gesamte Historie enthaelt (`main` steht
weiterhin auf `b023dc8`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`
(einzige HTML-Datei, `DEFAULT_TARGET` in `test/run-calc-tests.js`).
Arbeitsbranch: `claude/awesome-johnson-j9c246`. Testbefehl: `npm test`.
Baseline auf `75dd901` (ausgefuehrt): 1008 Rechen-Assertions · 28 SEC-Tests ·
Exit-Code 0.

### Am Code reproduziert (vor der Aenderung)

| Punkt | Befund am Stand `75dd901` |
|---|---|
| 1 Snapshot als unabhaengige Kopie | `saveSnapshot` legte `masterJson: state.masterJson` als **lebende Referenz** ab. Dass in localStorage dennoch eine Kopie landete, war ein Nebeneffekt des sofortigen `JSON.stringify`, keine Zusicherung. Datenstand, Aktienbasis und Prognoseziele fehlten ganz. |
| 2 Isolation | Ueber den Serialisierungs-Nebeneffekt faktisch gegeben, aber ungesichert; ein einziger zirkulaerer Verweis im Master-JSON haette `JSON.stringify` werfen lassen — der Fehler wurde verschluckt (siehe 4) und der Snapshot war lautlos weg. |
| 3 Anzeige vs. Neuberechnung | Fuer kompatible Snapshots gab es **keine Wahl**: `loadSnapshot` lud still das Original, die erste Aenderung schaltete auf die aktuelle Engine um. Kein Weg, beide Sichten nebeneinander zu sehen. |
| 4 Speicherfehler | `storeSnapshots` = `try { … } catch (e) {}`, ohne Rueckgabewert. `saveSnapshot` rief danach `renderSnapshots()` — **stiller Totalverlust ohne jede Meldung**. Probe: `setItem` mit `QuotaExceededError` ⇒ `saveSnapshot` warf nicht, meldete nichts, Snapshot-Zahl unveraendert. |
| 5 Export/Import | `importSnapshots` pruefte **nichts** ausser `Array.isArray`: keine Formatversion, keine Engine-/Breaking-Pruefung, keine Migration. Export war ein blankes Array ohne Versionshuelle. |
| 6 Forward-Check | Ueberschrift „Forward-Check", Zeile „Rendite (Kurs)", und `_postMortemLine` zeigte bei Kurs ≥ 90 % des Base-FV ein **gruenes „✓ Kurs nahe/über Base FV"** — las sich als bestaetigte Prognose. |
| 7 Prognoseziele | `key_inputs` enthielt nur Ist-Werte. `forecastDcfCore` rechnete Umsatz/EBIT/FCFF je Jahr, gab die Reihen aber nicht zurueck. |

### Korrekturen

**Prognosekern (rein additiv, Bewertungsrechnung unveraendert).**
`forecastDcfCore` fuehrt `_revenuePerYearAbs`, `_ebitPerYearAbs`,
`_fcfPerYearAbs` und `_opMarginUsed` mit und gibt sie in beiden vollstaendigen
Rueckgabepfaden zurueck. Alle 1008 bestehenden Assertions bleiben unveraendert
gruen — kein Zahlenwert der Bewertung hat sich bewegt.

**Neuer Snapshot-Kern** (nach `SNAP_KEY`), zentrale Bausteine:
* `_deepCopyForSnapshot` — explizite Tiefkopie, die **nie wirft**: Zyklen werden
  markiert (`SNAPSHOT_CYCLE_MARKER`), `Set`/`Map`/`Date` werden JSON-faehig,
  nicht endliche Zahlen zu `null`, Funktionen/`undefined` entfallen.
  Mehrfachreferenzen ohne Zyklus werden normal kopiert.
* `buildSnapshotRecord(ctx)` — **rein**, ohne DOM und ohne globales `state`.
  Haelt fest: `data_vintage` (as-of, Cutoff, Kursdatum, Periodenende, Periodentyp,
  SEC-Formulare), `inputs_raw` (Rohimport, `null` wenn keiner vorliegt — **kein**
  Ersatz durch die normalisierten Inputs), `masterJson` (normalisierte Inputs),
  `assumptions`, `quality`/`valuation`/`synthesis`/`dataQuality`,
  `_engineVersion`/`_breakingVersion`/`_schemaVersion`/`_snapshotFormat`,
  `share_basis` (Aktienzahl, Quelle, Wachstum, Split-Verdacht),
  `random_seed`/`rng`/`mc_config`, `rule_version`/`synthesis_config`,
  `forecast_targets`.
* `SNAPSHOT_FORMAT_VERSION = 2` versioniert den **Datensatz**, nicht die Engine.
* `storeSnapshots` liefert `{ ok, code, message, count, bytes }` mit den Codes
  `stored` · `serialize_failed` · `quota_exceeded` · `write_failed` ·
  `verify_failed` (verifizierendes Zuruecklesen fuer Browser, die `setItem`
  annehmen und nichts behalten). `describeSnapshotStoreResult` erzeugt die
  Klartextmeldung (rein), `_renderSnapshotStoreStatus` zeigt sie in der neuen
  Zeile `#snap-store-status` **und** als Dialog. `saveSnapshot`, `deleteSnapshot`
  und `importSnapshots` melden Fehlschlaege; **nach einem Fehlschlag gibt es
  keine Erfolgsmeldung** (der Erfolgsdialog des Imports wird uebersprungen).
* `readSnapshotStoredResult` / `recomputeSnapshotWithCurrentModel` /
  `compareStoredVsRecomputed` — die Neuberechnung laeuft auf einer eigenen
  Kopie und **gibt zurueck**, statt zurueckzuschreiben. Neuer Knopf
  „Neu rechnen (aktuelles Modell)" neben „Gespeichertes Ergebnis".
* `buildSnapshotExportBundle` (Huelle `_kind`/`_snapshotFormat`/`_engineVersion`/
  `_breakingVersion`/`exported_at`/`count`) und `parseSnapshotImportPayload` +
  `migrateSnapshotRecord`: blankes Array wird als Format 1 gelesen und gewarnt,
  abweichende Engine-/Breaking-Version wird gewarnt, **neueres Format wird
  abgelehnt statt geraten**, fremdes `_kind` wird abgelehnt, unbrauchbare
  Einzeleintraege werden einzeln verworfen. Jeder Migrationsschritt wird
  protokolliert und dem Nutzer angezeigt.
* `buildSnapshotForecastTargets` — Umsatz, operative Marge und FCFF je
  Prognosejahr aus **demselben** Pfad wie der Haupt-DCF, mit Zielperiode
  (`target_period_end`, `target_fiscal_year`, `target_period_type`), abgeleitet
  aus dem letzten Ist-Periodenende. Ohne bekanntes Periodenende bleibt die
  Zielperiode `null` — **kein geratenes Datum**.
* `compareSnapshotForecastToActual` — liefert Abweichungen und `verdict: null`.
  Ohne passende Zielperiode, bei abweichendem Periodentyp, ohne Periodenende
  oder ohne Prognoseziele gibt es **gar keinen Vergleich**, weder positiv noch
  negativ.

**Kursvergleich statt Forward-Check.** `_forwardCheckBlock` →
`_priceComparisonBlock` (Altname bleibt als Alias, T-FWDCHECK1 unveraendert).
Ueberschrift „Kursvergleich", Zusatz „kein Backtest und keine Bestaetigung der
Geschaeftsprognose. Ein hoeherer Kurs sagt nicht, dass Umsatz, Marge oder FCFF
wie prognostiziert eingetreten sind."; „Rendite (Kurs)" → „Kursveraenderung",
„Verdict damals→jetzt" → „Einstufung damals→jetzt". In `_postMortemLine` ist der
gruene Erfolgshaken entfallen; die Einordnung ist neutral eingefaerbt und traegt
den Zusatz „reine Kursentwicklung, keine Bestaetigung der Prognose".
`_fc.kind = 'price_comparison'` (auch per Migration fuer Altdatensaetze).

**Ladepfad gehaertet.** `_applySnapshotToState` arbeitet auf
`_deepCopyForSnapshot(snapshotNormalizedInputs(s))` statt direkt auf dem
Datensatz (`migrateV3toV4`/`applyDerivedFieldsV4`/`runFullEvaluation` aendern
in place), kopiert auch die Ergebnisse in den State und liest den Rohimport
ueber `s.inputs_raw ?? s.importedSnapshot ?? null`.

### Bewusste Abwaegung: keine zweite Ablage der Inputs

Ein Zwischenstand fuehrte `inputs_normalized` **zusaetzlich** zu `masterJson`.
Gemessen am synthetischen Fixture waren das 864 von 7597 Zeichen (11 %); bei
einem echten SEC-Master-JSON, das den Datensatz dominiert, naehert sich das
einer Verdopplung — und arbeitet damit direkt gegen Punkt 4 (voller
localStorage). Die normalisierten Inputs liegen deshalb **genau einmal** unter
`masterJson`; Leser gehen ueber `snapshotNormalizedInputs(snap)`.
SN-2b2 sichert das mit einer Nutzlast-Marke ab.

### Neue Regressionstests — `_testSnapshotIntegrity` (122 Assertions)

Registriert in `PURE_TEST_FUNCTIONS` (`test/run-calc-tests.js`), DOM-frei.
Fixture bewusst glatt, damit die Erwartungswerte **unabhaengig** herleitbar sind:
Umsatz 1000, EBIT 200 (20 %), EBITDA 250 (D&A 5 %), CapEx 50 (5 %), Steuer 25 %,
g1 = 8 % ⇒ `FCFF_t = 0,15 · 1000 · 1,08^t` ⇒ Jahr 1: 1080,00 / 20,00 % / 162,00 ·
Jahr 2: 1166,40 / 174,96 · Jahr 10: 1000·1,08^10.

* **SN-1 (20)** Isolation: Kopie statt Referenz (auch verschachtelt); Aenderung
  an Ticker, Umsatz, Reihenlaenge, Kurs, Annahmen und Ergebnissen erreicht den
  Snapshot nicht; Gegenrichtung ebenfalls; zwei Snapshots derselben Aktie sind
  unabhaengig; Zyklus wirft nicht und bleibt serialisierbar (mit Gegenprobe,
  dass die rohe Referenz es **nicht** waere); Mehrfachreferenz ohne Zyklus;
  Set/Date/NaN/Infinity/Funktion/undefined.
* **SN-2 (13)** Vollstaendigkeit: Datenstand, getrennte Roh-/normalisierte
  Inputs, keine Doppelablage, Annahmen, Ergebnisse, drei Versionsangaben,
  Aktienbasis, Zufallsstartwert, Regelwerksversion, Zeitstempel, fehlender
  Rohimport bleibt `null`, Serialisierbarkeit.
* **SN-3 (10)** Speicherfehler: Erfolg meldet Erfolg; `quota_exceeded`,
  `serialize_failed`, `verify_failed` werden erkannt; `storeSnapshots` wirft
  nicht; die Meldung nennt Grund und „NICHTS gespeichert"; der zuvor
  gespeicherte Stand bleibt unversehrt; **kein** Fehlschlag liefert `ok === true`.
* **SN-4 (14)** Export/Import: Versionshuelle, Entkopplung, Roundtrip ueber
  echtes JSON inkl. Datenstand/Aktienbasis/Startwert/Prognoseziele; fremdes
  `_kind`, fehlende Liste, Textinhalt, leere Datei werden abgelehnt; ein
  unbrauchbarer Eintrag reisst die brauchbaren nicht mit.
* **SN-5 (20)** Aeltere Version: Format-1-Datensatz wird migriert, Altschluessel
  abgebildet, gespeicherte Ergebnisse **nicht** neu gerechnet, Datenstand und
  Aktienbasis nachgetragen, Startwert uebernommen, fehlende Prognoseziele
  markiert statt nachgerechnet, Quelldatensatz unangetastet, keine Doppelablage,
  blankes Array erkannt und gewarnt, Migrationsprotokoll durchgereicht,
  aeltere Engine-/Breaking-Version gewarnt, **neueres Format abgelehnt**.
* **SN-6 (16)** Trennung: beide Sichten gekennzeichnet; Neuberechnung auf eigener
  Kopie; der Snapshot ist danach **Byte fuer Byte** unveraendert (`JSON.stringify`
  vorher/nachher); die alte Sicht wird mitgefuehrt statt ersetzt;
  Gegenueberstellung nennt beide Seiten; Engine-Wechsel erkannt; ohne Inputs
  wird gemeldet statt geraten; Format-1-Altschluessel lesbar.
* **SN-7 (22)** Prognoseziele: die sechs handgerechneten Werte, Zielperioden
  2026-12-31 … 2035-12-31, Periodentyp, Szenario/Definition; ohne Periodenende
  kein geratenes Datum; WACC ≤ tg und fehlendes Base-Szenario liefern einen
  Grund statt Nullwerten; Soll-Ist: Umsatz −80,00 / −7,41 %, Marge −2,00 pp
  (kein Prozentwert), FCFF −22,00 — und **`verdict === null` auch bei
  vergleichbarer Periode**; vier Faelle ohne Vergleichbarkeit.
* **SN-8 (8)** Kursvergleich: Kennzeichnung, Kursdatum, Ueberschrift, kein
  „Forward-Check" mehr, ausdrueckliche Klarstellung, „Kursveraenderung" statt
  „Rendite", Alias, kein Block ohne Kurs.

### Gegenproben (alle ausgefuehrt)

Jede Korrektur wurde einzeln zurueckgebaut; die zugehoerigen Assertions wurden
rot. Ohne diese Proben waeren die Tests nicht aussagekraeftig.

| Rueckbau | Rot |
|---|---|
| GP-1 Tiefkopie entfernt (rohe Referenz wie bis V1.0.43) | 12 (SN-1b/c/e–j/l/n/p/q) |
| GP-2 `storeSnapshots` schluckt Fehler wieder | 6 (SN-3d/e/f/h/i/j) |
| GP-3 Import-Versionspruefung entfernt | 3 (SN-4j, SN-5r/s) |
| GP-4 Neuberechnung schreibt in den Snapshot zurueck | 6 (SN-6f–j, SN-6l) |
| GP-5 Zielperiode geraten + automatische Erfolgsnote | 3 (SN-7j/q/r) |
| GP-6 alte „Forward-Check"-Bezeichnung | 4 (SN-8c–f) |
| GP-7 zweite Ablage der normalisierten Inputs | 1 (SN-2b2) |

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1130 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (vorher 1008; +122), SEC-Tests **28/28**, gemeinsamer
  **Exit-Code 0**. **Keine bestehende Erwartung geaendert oder gelockert.**
* Zusaetzlich ein einmaliger End-to-End-Durchlauf im Node-Sandbox-Kontext
  (`saveSnapshot` → aktives Unternehmen aendern → Speichern bei vollem
  localStorage → Export/Import → Format-1-Import → gespeichert vs. neu
  berechnet). Ergebnis: Snapshot 6979 Zeichen; Prognose Jahr 1
  1080 / 20 % / 162 zur Zielperiode 2026-12-31; Startwert 20260101;
  Aktienbasis 100; nach Aenderung des aktiven Unternehmens weiterhin
  `AAA` / 1000 / BP 17,25; Quota-Fehlschlag liefert `ok:false`,
  `quota_exceeded` und einen sichtbaren Dialog bei unveraenderter
  Snapshot-Zahl; Roundtrip fehlerfrei; Format-1-Import migriert in 9 Schritten
  bei erhaltenem BP 12,50 und Engine `1.0.30-alt`; gespeichert BP 17,25 vs.
  neu berechnet BP 17,2909 bei unveraendertem Snapshot.

### Verbleibende Einschraenkungen

* **Kein echter Browser.** Die DOM-Verdrahtung (`#snap-store-status`, die beiden
  Knoepfe je Snapshot, `_applySnapshotToState`, `loadSnapshotWithCurrentModel`)
  ist **nicht** durch `npm test` abgedeckt — die Suite bleibt bewusst
  abhaengigkeitsfrei und DOM-frei. Getestet sind die reinen Kernfunktionen; der
  End-to-End-Durchlauf oben lief im Node-Sandbox-Kontext, nicht im Browser.
* Der Soll-Ist-Vergleich ist als Funktion vorhanden und getestet, hat aber
  **noch keine Bedienoberflaeche** — Auftragspunkt 7 verlangt die Grundlage im
  Snapshot, nicht die Auswertung. Ist-Werte muessen bislang vom Aufrufer
  kommen; es gibt keinen automatischen Abgleich gegen neue SEC-Daten.
* `forecast_targets` beruht auf dem **Base-Szenario**; Conservative/Optimistic
  werden nicht als eigene Zielpfade abgelegt.
* Prognoseziele fuer Format-1-Altsnapshots werden bewusst **nicht** nachgetragen
  — sie waeren keine damals prognostizierten Werte.
* Bestehende Snapshots im localStorage bleiben im Format 1 liegen, bis sie
  exportiert und wieder importiert werden; sie werden beim Lesen migriert, aber
  nicht automatisch zurueckgeschrieben.
* `_deepCopyForSnapshot` wirft, wenn eine Eigenschaft einen werfenden Getter
  hat. `saveSnapshot` faengt das ab und meldet `build_failed`; in der Praxis
  stammt das Master-JSON aus `JSON.parse` und hat keine Getter.
* Ein Snapshot in einem **neueren** Format wird abgelehnt, nicht teilweise
  gelesen — bewusst, um kein Feld zu raten.
* Unveraendert offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`; Korrelationen
  der Monte-Carlo-Groessen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` nicht angehoben (im Code als
  V1.0.44 kommentiert) — mehrere Fixtures pinnen `1.0.35-base-rate-lite` exakt,
  ein Versionsbump bleibt ein eigener Schritt.

### Ausgangsstand fuer den naechsten Schritt

Uebergabebranch: `claude/awesome-johnson-j9c246` (Basis `75dd901` auf
`claude/mos-input-validation`). Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test` — beide Suiten gruen, Exit-Code 0.
Code-Commit dieses Schritts: `a5272cf`; Ergebniscommit ist die Spitze des
Uebergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/awesome-johnson-j9c246
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/a5272cf

## Update (Chat 11): Zwei Fehler beim manuellen Sicherheitsabschlag behoben (V1.0.43)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/happy-hamilton-fytsq5`, Ausgangscommit `f7eaee9` — die Spitze dieses
Branches und der neueste auf GitHub gespeicherte Fortsetzungsstand (kein
neuerer Branch enthält ihn; `main` steht weiterhin auf `b023dc8`).
Tool-Datei unverändert `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Arbeitsbranch: `claude/mos-input-validation`. Testbefehl: `npm test`.
Baseline auf `f7eaee9` (ausgeführt): 965 Rechen-Assertions · 28 SEC-Tests · Exit-Code 0.

### Fehler 1 — ungültige Eingaben galten als bewusster Abschlag

**Am Code reproduziert** (Referenzfall DCF 16/20/24, RIM 24/30/36 ⇒ Modellwert
Base 23,00; Regelabschlag 25 % ⇒ Einstiegspreis 17,25):
`false` → 0 % „gewählt", Einstiegspreis **23,00**; `" "` → 0 %, **23,00**;
`true` → 1 %, 22,77; `{value:false}` → 0 %, **23,00**. Ursache: die Synthese
wandelte die Eingabe direkt mit `Number(...)` um, ohne den Datentyp zu prüfen.
Zusätzlich fielen `[]`, `[40]` und `{}` still auf den Regelabschlag zurück —
ohne Meldung.

**Korrektur.** Neue, gemeinsame Prüfstelle `parseManualSafetyDiscount(raw, max)`
(direkt nach `SYNTHESIS_CONFIG`), die Import, Formular und Synthese bedienen.
Sie prüft den Datentyp **vor** der Zahlenumwandlung und liefert
`{ status: 'unset' | 'valid' | 'rejected', pct, reason }`:
* `unset` (Regelabschlag, ohne Meldung): fehlend, `null`, leerer String, reine
  Leerzeichen — auch unter `.value`.
* `rejected` (Regelabschlag, **mit** Grund): boolesche Werte, Arrays, Objekte
  ohne `value`, Objekte/Arrays in `.value`, nichtnumerische Strings,
  nichtendliche Zahlen sowie Zahlen außerhalb 0–90.
* `valid`: Zahlen und eindeutig numerische, nichtleere Strings (jeweils direkt
  oder unter `.value`); **echte numerische 0 % bleiben eine gültige Wahl**.
`runFairValueSynthesizer()` nutzt nur noch diese Funktion; die frühere
`Number(...)`-Auswertung ist entfernt.

### Fehler 2 — direkte Zahlen gingen beim Neuberechnen verloren

**Im echten Browser reproduziert** (Stand `f7eaee9`, Import mit
`safety_discount_override_pct: 40`): nach dem Import stand im Feld `as-mos`
ein **leerer** Wert, im MasterJSON die rohe `40`; nach einmaligem
*unverändertem* „Neu berechnen" war die Wahl gelöscht
(`kind` zurück auf `chosen_rule_based`, Einstiegspreis 20,02 statt 18,68).
Ursache: `migrateV3toV4()` ließ die Zahl unangetastet, `renderAssumptions()`
liest aber nur `.value`, und `recalcFromAssumptions()` wertete das leere Feld
als „Wahl zurückgenommen".

**Korrektur an drei Stellen, jede für sich ausreichend:**
1. **Import-/Migrationsgrenze** (`migrateV3toV4`): eine bereits **gültige**
   Direkteingabe wird in `{ value, source_type: 'manual', notes }` normiert.
   Vorhandene Objektwerte samt Metadaten (`source_type`, `notes`) bleiben
   erhalten. **Ungültige Werte werden nicht normiert** — sie bleiben
   unverändert stehen und werden von der Synthese mit Grund zurückgewiesen.
2. **Anzeige** (`renderAssumptions`): der Feldwert wird über dieselbe
   Prüfstelle gelesen statt über den rohen `.value`-Pfad.
3. **Schreibweg** (`recalcFromAssumptions`): `as-mos` läuft nicht mehr über die
   generische `fields`-Liste (die auf einer rohen Zahl ins Leere geschrieben
   hätte), sondern über einen eigenen Pfad: leeres Feld ⇒ Wahl entfernen (kein
   0 %), gültige Eingabe ⇒ Objekt schreiben bzw. vorhandenes Objekt
   aktualisieren, ungültige Eingabe ⇒ unverändert hinterlegen, damit die
   Synthese sie mit Grund zurückweist.

Monte Carlo, Modellwerte, Szenarien, Gewichte, Kappungen und die Anzeige der
Synthese blieben unverändert.

### Neue Regressionstests (43 Assertions in `_testSynthesisPrecision`)

* **S-13 (28)** Datentyp-Prüfung: 10 zurückgewiesene Eingaben (`false`, `true`,
  `{value:false}`, `{value:true}`, `[]`, `[40]`, `{}`, `{value:{}}`, `"40%"`,
  `Infinity`) ⇒ jeweils Regelabschlag, Einstiegspreis 17,25, tiefer Prüfpreis
  13,80 und ein nichtleerer Grund · 6 „keine Wahl"-Fälle (fehlend, `null`,
  `""`, `"   "`, `{value:null}`, `{value:"  "}`) ⇒ Regelabschlag **ohne** Grund ·
  7 gültige Eingaben (`40`, `"40"`, `{value:40}`, `0`, `"0"`, `{value:0}`,
  `" 40 "`) ⇒ 13,80 bzw. 23,00, Modellwert und Gewichte unverändert ·
  `parseManualSafetyDiscount` direkt geprüft.
* **S-14 (15)** Formularweg: Import `40` wird normiert und ist im Feld sichtbar
  (13,80) · importierte `0 %` bleiben sichtbar und eine Wahl (23,00) ·
  vorhandene Objektmetadaten bleiben erhalten · `false`, `"abc"`, `95`, `[40]`
  werden durch die Normalisierung **nicht** gültig (Feld leer, 17,25) ·
  unverändertes Neuberechnen erhält 40 % und 0 % · Änderung 40 → 10 ergibt
  20,70 · bewusstes Leeren entfernt die Wahl und aktiviert 17,25.

**Gegenproben (ausgeführt).** Alte `Number(...)`-Auswertung wiederhergestellt ⇒
**10** Assertions rot (u. a. `false`/`true`/`" "` wieder als Wahl, Einstiegspreis
23,00 statt 17,25). Normalisierung an der Migrationsgrenze abgeschaltet ⇒
S-14a und S-14c rot.

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1008 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (vorher 965; +43), SEC-Tests **28/28**, gemeinsamer
  **Exit-Code 0**. Keine bestehende Erwartung geändert oder gelockert.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis außerhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://` geladen, Ablauf
  Import → Anzeige → unverändertes Neuberechnen → Ändern → Leeren:
  1. Import `safety_discount_override_pct: 40` ⇒ Feld `as-mos` zeigt **40**,
     MasterJSON enthält das normierte Objekt, `kind: 'chosen_manual'`.
  2. Unverändertes „Neu berechnen" ⇒ Feld weiterhin **40**, Wahl erhalten,
     Einstiegspreis 18,68 (Modellwert Base 31,13 × 0,60).
  3. Änderung auf **10** ⇒ übernommen, Einstiegspreis 28,02.
  4. Leeren ⇒ Wahl entfernt, Regelabschlag 35,7 %, Einstiegspreis 20,02.
  5. Ausdrückliche **0** ⇒ gültige Wahl, Einstiegspreis = Modellwert 31,13.
  6. Anzeige: „Manuell gewählt: 40.0% — ersetzt den Regelabschlag von 35.7%.
     Bisherige Einstiegszone (Regelabschlag): 20.02 → jetzt 18.68 (−6.7%)
     Modellwert unverändert: 31.13"; bei `95`: „Manuelle Eingabe verworfen —
     ausserhalb des zulaessigen Bereichs 0–90 %".
  Gegenprobe im selben Browser auf dem Stand `f7eaee9`: Feld nach Import leer,
  Wahl nach unverändertem Neuberechnen gelöscht (20,02 statt 18,68).

### Verbleibende Prüfgrenzen

* Der Browser-Ablauf wurde mit einem **synthetischen** Master-JSON gefahren
  (Fixture-Metadaten so ergänzt, dass Scope- und Data-Quality-Gates passieren);
  kein Test mit echten SEC-Daten.
* Der Browser-Check ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test` — die Suite bleibt abhängigkeitsfrei und
  ohne DOM. Die DOM-Verdrahtung ist damit nicht dauerhaft regressionsgesichert.
* Im Node-Test S-14 ist der Schreibweg von `recalcFromAssumptions()` ohne DOM
  nachgebildet; er gilt dort ausdrücklich nicht als Bedienungstest.
* Eine zurückgewiesene Eingabe (z. B. 95) verschwindet beim nächsten Rendern aus
  dem Feld; der Grund steht in der Einstiegszonen-Box und im Rechenweg.
* Unverändert offen aus den Vorschritten: index-basierte Ableitung von
  `eps_diluted`, `book_value` und `dps` in `applyDerivedFieldsV4`; Korrelationen
  der Monte-Carlo-Größen nicht modelliert; `ENGINE_VERSION` /
  `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` nicht angehoben (im Code als
  V1.0.43 kommentiert).

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/mos-input-validation` (Basis `f7eaee9` auf
`claude/happy-hamilton-fytsq5`). Tool-Datei unverändert.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `236b4f0`; Ergebniscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/mos-input-validation
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/236b4f0

## Update (Chat 10): Manuell gewählter Sicherheitsabschlag, Abnahme abgesichert (V1.0.42)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`. Ausgangsbranch
`claude/brl1-alignment-fixes`, Ausgangscommit `94ae23c` — der neueste auf
GitHub gespeicherte Stand; er enthält alle Vorgängercommits als Vorfahren
(`main` steht weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html` (einzige
HTML-Datei, `DEFAULT_TARGET` in `test/run-calc-tests.js`). Arbeitsbranch:
`claude/happy-hamilton-fytsq5`. Testbefehl: `npm test`.

**Baseline vor den Änderungen** (auf `94ae23c`, tatsächlich ausgeführt):
Rechentests 936 bestanden · 0 fehlgeschlagen · 0 Exceptions; SEC-Tests 28/28.

### Prüfung des Auftrags am Code (vor der Bearbeitung)

Die Punkte 1, 2, 3, 5, 6 und 7 waren bereits in Chat 8 (`87ce510`) umgesetzt
und sind am aktuellen Code verifiziert worden:

* Punkt 1 — `_modelComparisonNote()` je Modellkachel (sichtbare Inputs, Rolle
  bzw. Ausschlussgrund, bezifferte Abweichung, Modelleignung).
* Punkt 2 — `synthesisMethod` mit `kind: 'heuristic'`, Formel, Gewichten,
  Ausschlüssen, Kappungen und nummerierten Schritten; Anzeige als aufklappbarer
  „Rechenweg der heuristischen Synthese".
* Punkt 3 — `epvFloorApplied` dauerhaft `false`; `epvModel` wird nicht mehr in
  Range oder Entscheidungsrange verwendet; EPV nur noch als `epvComparison`.
* Punkt 5/6 — `buildMcDiagCard()` mit `class="card collapsed"`, „Anteil Läufe
  > Kurs" statt „P(FV > Kurs)", `_mulberry32` mit `MC_CONFIG.seed`, getrennte
  Zählung `runsValid`/`runsNegative`/`runsInvalid(Core|NonFinite)`.
* Punkt 7 — `judgements` mit `merged: false` und je eigener Quelle.

Offen war ausschließlich **Punkt 4 in seinem wörtlichen Teil**: einen *manuell
gewählten* Sicherheitsabschlag gab es nicht; Chat 8 hat nur den bestehenden
Regelabschlag getrennt ausgewiesen und das ausdrücklich als Einschränkung
notiert. Genau diese Lücke schließt dieser Schritt; alles Übrige wurde nicht
umgebaut, sondern durch zusätzliche Tests abgesichert.

### Änderungen (Produktdatei)

**1. Manuell gewählter Sicherheitsabschlag (Punkt 4).**
`runFairValueSynthesizer()` liest den Abschlag aus
`valuation.assumptions.safety_discount_override_pct` — ausschließlich aus dem
MasterJSON, kein DOM-Zugriff, damit die Synthese rein und testbar bleibt.
* Gültiger Bereich 0–`SYNTHESIS_CONFIG.mos.manual_max_pct` (= 90 %).
* Der gewählte Wert ersetzt den Regelabschlag **nur dort, wo ein Abschlag
  wirkt**: Einstiegspreis (`buyPrice`) und tiefer Prüfpreis
  (`deepValuePrice`). `range.conservative/base/optimistic`, Gewichte,
  Szenarien und Modellwerte bleiben unverändert.
* Der Regelabschlag bleibt vollständig erhalten und getrennt lesbar:
  `safetyDiscount.ruleTotal`, `mosComponents.ruleTotal`,
  `safetyDiscount.components` (Regelkomposition).
* Fehlende oder leere Eingabe = **keine Wahl** (Regelabschlag gilt), nicht 0 %.
  Ausdrücklich gewählte 0 % gelten dagegen als Wahl. Unplausible Eingaben
  (keine Zahl, < 0, > 90) werden verworfen, mit Grund gemeldet
  (`safetyDiscount.manual.rejectedReason`, Eintrag unter „Kappungen") und
  fallen auf den Regelabschlag zurück — kein stilles 0 %.
* Eine Wahl über der Regel-Obergrenze (50 %) wird **nicht still gekappt**,
  sondern angewendet und als `manual.aboveRuleCap` sowie als benannter Eintrag
  im Rechenweg ausgewiesen.
* Neuer Rechenschritt 6 „Manuell gewählter Sicherheitsabschlag"; der frühere
  Schritt 6 (Einstiegspreis) ist jetzt Schritt 7 und nennt bei aktiver Wahl die
  bisherige Einstiegszone samt Änderung.

**2. Änderung gegenüber der bisherigen Einstiegszone (Punkt 4, zweiter Satz).**
Neues `safetyDiscount.entryZoneChange` mit `entryPriceRule` (Zone mit
Regelabschlag), `entryPriceApplied`, `deepValuePriceRule`, `deltaAbsolute` und
`deltaPct`. Ohne Einstiegspreis (gesperrte Zone) bleiben die Felder `null` —
kein erfundener Vergleichswert. Gemessen am Testfall S-11
(DCF 16/20/24, RIM 24/30/36, Modellwert Base 23,00, Regelabschlag 25 %):
bisherige Zone **17,25**; bei manuell 40 % **13,80** (−20,0 %), bei manuell
10 % **20,70** (+20,0 %). Der Modellwert bleibt in beiden Fällen 23,00.

**3. Anzeige.** Die Einstiegszonen-Box zeigt bei aktiver Wahl „Manuell
gewählter Sicherheitsabschlag", die Zeile „Bisherige Einstiegszone
(Regelabschlag) … → jetzt … (±x %)" und ausdrücklich „Modellwert unverändert:
…". Eine verworfene Eingabe wird als solche gemeldet statt still als 0 %
dargestellt. Der Rechenweg in der Range-Box nennt zusätzlich „Regelabschlag x %
· angewendet y % (manual|rule)" und dieselbe Zonenänderung.

**4. Eingabefeld.** Neues Feld `as-mos` („Sicherheitsabschlag manuell (%)") im
Annahmen-Tab, eingelesen über die bestehende `fields`-Liste in
`recalcFromAssumptions()`. Ein **leeres** Feld nimmt die Wahl zurück (löscht
`safety_discount_override_pct`), setzt sie nicht auf 0. Bei gesetztem Wert
werden `source_type: 'manual'` und der Eintrag in
`state.manualAssumptionFields` gepflegt — dieselbe Mechanik wie bei den
bestehenden Overrides. Kein neues Framework, keine neue Abhängigkeit.

**5. Gespeicherter Zufallsstartwert (Punkt 6, Ergänzung).** `saveSnapshot()`
legt zusätzlich `mc_config` (Startwert, Generator, Laufzahl, Verteilungs-
parameter) neben dem bereits gespeicherten `synthesis_config` ab. Damit bleibt
nachvollziehbar, mit welchem Startwert eine gespeicherte Auswertung gerechnet
wurde, auch wenn `MC_CONFIG.seed` später geändert wird. Die Simulationslogik
selbst wurde nicht angefasst.

### Pflicht-Tests (neu, 29 Assertions in `_testSynthesisPrecision`)

Synthetische Daten, unabhängig nachgerechnete Erwartungswerte.

**S-11 (21) — manueller Sicherheitsabschlag.**
a Vorbedingung (Regelabschlag 25 %, Zone 17,25) · b Wahl wird angewendet und
als `chosen_manual` gekennzeichnet · c Modellwert unverändert (alle drei
Szenarien) · d 23,00 × (1 − 0,40) = 13,80 und 18,40 × (1 − 0,40) = 11,04 ·
e Regelabschlag bleibt getrennt erhalten · f Zonenänderung −3,45 = −20,0 % ·
g Gegenrichtung +20,0 % bei 10 % · h Wahl über der Obergrenze wird angewendet
und benannt · i0–i3 `'abc'`, `-5`, `95`, `NaN` fallen auf den Regelabschlag
zurück (**kein stilles 0 %**) · j leere Eingabe ist keine Wahl von 0 % ·
k gewählte 0 % gelten als Wahl · l Rechenweg nennt die Wahl als eigenen
Schritt · m/n Anzeige (Trennung bzw. Meldung der verworfenen Eingabe) ·
o Urteile bleiben unberührt · p Starter-Zone bleibt regelbasiert und nie unter
dem Einstiegspreis · q Rechenweg zeigt Regel- und angewendeten Abschlag.

**S-12 (8) — Abnahmekriterien direkt geprüft.**
a gleicher Startwert ⇒ bitgleiche Kennzahlen (Median, P10, P90, Zählungen,
Anteil) · b Startwert und Laufzahl stehen im Ergebnis · c EPV bei 200/250/300
— weit über der Synthese — hebt weder Range noch Einstiegszone · d EPV bleibt
sichtbar und als `diagnostic_only` benannt · e0/e1 angezeigter Basiswert aus
den offengelegten Gewichten reproduzierbar · f0/f1 angezeigter Einstiegspreis
aus Basiswert und Abschlag reproduzierbar · g Simulationskarte bleibt
eingeklappt, ohne „P(FV" und mit dem Hinweis „keine empirisch belegte
Wahrscheinlichkeit".

### Gegenprüfungen (tatsächlich ausgeführt, in Arbeitskopien)

* **Manuelle Wahl abgeschaltet** (`mosTotalFinal = _mosRuleTotal`) ⇒ **6**
  Assertions rot (S-11b/d/f/g/h/k).
* **Unplausible Eingabe still als 0 % gelesen** ⇒ **5** Assertions rot
  (S-11i0–i3, S-11n).
* **Alter EPV-Floor wieder eingeschaltet** (`cons = max(cons, EPV-cons)`,
  `base` bis +30 %) ⇒ S-12c rot (conservative 200 statt 18,40, base 29,90 statt
  23,00) und S-12e1 rot — der angezeigte Basiswert war dann nicht mehr aus den
  offengelegten Gewichten reproduzierbar. Damit prüft S-12e genau das dritte
  Abnahmekriterium.

### Tatsächlich ausgeführte Tests (nach den Änderungen)

`npm test` (= `node test/run-all.js`), beide Suiten:
* `node test/run-calc-tests.js` → **965 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (vorher 936; +29 durch S-11/S-12).
  Fixtures unverändert 434 Assertions, 0 fehlgeschlagen.
* `node --test tests/*.test.mjs` → **28/28** (unverändert).
* **Gemeinsamer Exit-Code 0.**

Keine bestehende Testerwartung wurde geändert. `_testSynthesisPrecision` wuchs
von 73 auf 102 Assertions; die 73 Assertions aus Chat 8 laufen unverändert.

### Offene Einschränkungen / bewusst nicht bearbeitet

* Das neue Eingabefeld `as-mos` selbst ist **nicht automatisiert getestet** —
  der Node-Runner stellt bewusst kein DOM bereit (wie schon
  `_testManualAssumptionOverride`). Getestet ist die vollständige Wirkungskette
  ab dem MasterJSON-Feld `safety_discount_override_pct`; die Feld-Verdrahtung
  ist manuell im Browser zu prüfen.
* Die Starter-Zone bleibt bewusst regelbasiert (strukturelle Komponenten,
  `safetyDiscount.starterZoneBasis = 'rule_structural'`) und wird nur nach
  unten auf den Einstiegspreis begrenzt. Ein manuell gewählter Abschlag wirkt
  dort nicht.
* `MC_CONFIG.seed` bleibt ein Programmwert; neu ist nur, dass er mit dem
  Snapshot gespeichert wird. Eine Startwert-Verwaltung je Titel gibt es nicht.
* Korrelationen der Monte-Carlo-Größen sind weiterhin nicht modelliert (nur
  benannt).
* `epvModel` in `runFairValueSynthesizer()` ist seit V1.0.40 unbenutzt (tote
  Zuweisung); nicht angefasst, um den Diff auf den Auftrag zu begrenzen.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` weiterhin
  nicht angehoben (durch Tests festgeschrieben); die Änderung ist im Code als
  V1.0.42 kommentiert.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/happy-hamilton-fytsq5` (Basis `94ae23c` auf
`claude/brl1-alignment-fixes`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `c1da760`; Ergebniscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/happy-hamilton-fytsq5
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/c1da760

**Der nächste Schritt setzt auf `origin/claude/happy-hamilton-fytsq5` auf,
nicht auf `main`.**

## Update (Chat 9): T-BRL1 und Mehrheitsjahr-Typfehler behoben (V1.0.41)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`. Basiscommit
`72d75c3` auf `claude/us-stock-tool-precision-og5azo` — der neueste
Fortsetzungsstand, der `ef9fce2` als Vorfahre enthält (per `git merge-base
--is-ancestor` bestätigt; `main` steht weiterhin auf `b023dc8`). Arbeitsbranch:
`claude/brl1-alignment-fixes`. Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test`.

**Baseline vor den Änderungen** (auf `72d75c3`, tatsächlich ausgeführt):
Rechentests 927 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Exceptions;
SEC-Tests 23/23. Die 73 Assertions aus Chat 8 (`_testSynthesisPrecision`)
sind vollständig erhalten.

### Punkt 1 — T-BRL1: Fixture-Fehler, kein Produktfehler

**Bestätigte Ursache (am aktuellen Code reproduziert, nicht übernommen).**
Der Synthese-Lauf auf dem T-BRL1-Datensatz ergab
`blockReason: "Modell-Divergenz >3x nach Outlier-Entfernung … Eingeschlossen:
[dcf, rim], Ratio: 3.05x"`, `_modelDivergenceSevere = true`,
`_diagnosticOnlyReason = 'model_divergence_severe'` ⇒ `buyPrice = null`.
DCF-Base 15,62 gegen RIM-Base 5,13 je Aktie.

Die Divergenz entstand im Fixture: Es überschrieb **nur** `revenue`, `ebit` und
`fcf` auf eine Firma der Größenordnung ~1.200 Mio Umsatz und ließ
`net_income`, `eps_diluted`, `total_equity`, `cfo`, `ebitda`, `capex`,
`shares_diluted`, `total_debt` und `cash_and_equivalents` auf den Werten des
5.000-Mio-Basisdatensatzes stehen. Daraus folgten unmögliche Relationen
(EBITDA 950 bei Umsatz 1.210 = 78 % Marge; CapEx 300 = 25 % vom Umsatz;
CFO 900 = 74 % vom Umsatz) und daraus der Modellabstand. Gegenprobe: derselbe
Basisdatensatz **ohne** die Teilüberschreibung ergibt Ratio 2,83 und einen
regulären Einstiegspreis.

**Bewertung.** Das Produktverhalten ist korrekt — das Divergenz-Gate verweigert
bei >3× Modellabstand bewusst eine Einstiegszone. Ungeeignet war der
Testaufbau. Geändert wurde daher **ausschließlich das Fixture**; am Produkt
wurde für Punkt 1 keine Zeile angefasst.

**Fachliche Prüfabsicht, geklärt.** T-BRL* prüft das Modul *Base-Rate-Lite*
(`computeBaseRateLite`, V1.0.35), dessen Modulkopf ausdrücklich sagt: „KEIN
Einfluss auf Fair Value, Buy Price, MoS oder Verdict". Nicht gemeint ist
`evaluateBaseRateWarnings()` aus Abschnitt 5 — dessen MoS-Zuschlag
(+5pp/+10pp) ist gewollt und bleibt unberührt. Die alte Assertion
(`buyPrice != null`) hat diese Absicht nicht geprüft, sondern nur die Existenz
eines Werts.

**Änderungen am Fixture (T-BRL1).**
* Datensatz jetzt in sich konsistent: 8 Jahre, Umsatz-CAGR(5J) = 9,99 %, alle
  Größen als fester Anteil vom Umsatz (EBIT 14,4 % · Net Income 12,0 % ·
  CFO 18,0 % · EBITDA 19,0 % · CapEx 6,0 % · FCF = CFO − CapEx = 12,0 % ·
  Eigenkapital 60 % · Fremdkapital 100 %). `g1 = 8` bleibt ≤ revCAGR ⇒
  Rating weiterhin konservativ/plausibel. Divergenz 2,72× ⇒ Gate inaktiv.
* Ein Datensatz-Builder `_brl1Mj()` für `mj:` **und** Assertions — die frühere
  Dopplung war der Weg, auf dem beide Kopien auseinanderlaufen konnten.
* Assertions (3 → 7):
  1. BRL `available = true`
  2. Rating konservativ/plausibel
  3. **Vorbedingung gegen „null gleich null":** `buyPrice` ist eine endliche
     Zahl > 0, `_modelDivergenceSevere !== true`, `_diagnosticOnlyReason ==
     null`, `position !== 'blocked'`
  4. Gegenprobe-Stub liefert wirklich ein abweichendes BRL-Urteil
  5. **Kernprüfung:** `computeBaseRateLite` wird vorübergehend durch einen Stub
     mit widersprechendem Urteil ('sehr ambitioniert') ersetzt; `buyPrice`,
     `deepValuePrice`, `position`, `_qualityVerdict`, alle drei
     `range`-Werte und `mosComponents.total` müssen **identisch** bleiben
  6. `computeBaseRateLite` nach der Gegenprobe wiederhergestellt
  7. `computeBaseRateLite` verändert das MasterJSON nicht (Mutation wäre der
     stille Weg zu einem Einfluss)
* **Neu: T-BRL1b** (4 Assertions) mit genau dem alten, widersprüchlichen
  Datensatz: Divergenz > 3×, `_modelDivergenceSevere = true`,
  `buyPrice === null`, Sperrgrund nennt die Modell-Divergenz. Damit ist
  belegt, dass der korrigierte T-BRL1 das Gate nicht umgeht, sondern eine
  geeignete Datenlage verwendet.

Divergenzgrenzen, Bewertungsgewichte und Sicherheitsprüfungen blieben
unverändert; kein Test wurde übersprungen.

### Punkt 2 — Typfehler im Mehrheitsjahr-Fallback (Produktkorrektur)

**Reproduktion am aktuellen Code.** `validatePeriodAlignment()` bildet
`yearCounts` über `p.year` (Zahl aus `parseInt`), liest das Mehrheitsjahr aber
über `Object.keys(yearCounts)` zurück — als **String**. Ohne bevorzugtes
Ankerfeld (`revenue`/`net_income`/`eps_diluted`) wird dieser String zu
`anchorYear`, und `populated.filter(p => p.year !== anchorYear)` vergleicht
dann `2024 !== "2024"`. Gemessen vor der Korrektur:
* genau ein Feld (`total_debt`, 2024): `ok: false`, Mismatch `total_debt@2024`
  — ein Widerspruch gegen sich selbst;
* drei Felder alle 2024: `ok: false`, alle drei als abweichend gemeldet;
* echte Abweichung (2× 2024, 1× 2021): Mismatch-Liste enthielt zusätzlich die
  beiden korrekt ausgerichteten 2024-Felder;
* mit Ankerfeld: `anchorYear` korrekt als Zahl, `majorityYear` aber weiterhin
  als String im Ergebnisobjekt.

**Korrektur (eine Stelle, eine Zeile).** Das Ergebnis des `reduce` wird mit
`Number(...)` zurück in eine Zahl gewandelt. Auswahllogik (häufigstes Jahr,
erstes bei Gleichstand), Ankerpriorität und die Erkennung echter
Periodenabweichungen bleiben unverändert. Kein lockerer Vergleich (`==`), keine
Neugestaltung der Periodenlogik.

**Pflichttests** — neu in `tests/sec-derivations.test.mjs` (dort war
`validatePeriodAlignment` bereits geladen), 5 Tests:
1. genau ein Feld mit Perioden-Meta ohne Ankerfeld ⇒ kein Mismatch gegen sich
   selbst (inkl. `typeof majorityYear === 'number'` als eigentlicher
   Regressionsschutz);
2. mehrere Felder desselben Jahres ohne Ankerfeld ⇒ kein Mismatch;
3. tatsächlich abweichende Jahre werden erkannt — und die Mismatch-Liste
   enthält **nur** das abweichende Feld;
4. bevorzugtes Ankerfeld behält Vorrang vor dem Mehrheitsjahr (`revenue`, und
   zweitrangig `net_income`);
5. fehlende/ungültige Perioden erzeugen keinen erfundenen Jahreswert
   (`missing` unverändert, `anchorYear === undefined`).

### Gegenprüfungen (tatsächlich ausgeführt)

* **Alignment-Tests gegen die alte Implementierung:** `Number(...)` temporär
  entfernt ⇒ **4 der 5** neuen Tests rot (Test 5 bleibt grün, weil er den
  Mehrheitsjahr-Fallback gar nicht erreicht — genau das ist seine Aussage);
  nach Wiedereinspielen 28/28.
* **T-BRL1 erkennt einen unerwünschten BRL-Einfluss:** In einer Arbeitskopie
  wurde `computeBaseRateLite` in den MoS-Pfad des Synthesizers eingehängt
  (+10pp bei 'sehr ambitioniert') ⇒ `__brl1_noeffect` rot
  (935 · 1 fehlgeschlagen).
* **Divergenz-Gate weiterhin wirksam:** In einer Arbeitskopie den
  `_modelDivergenceSevere`-Zweig abgeschaltet ⇒ T-BRL1b rot
  (`buyPrice` 9,35 statt `null`; Sperrgrund fehlt).

### Tatsächlich ausgeführte Tests (nach den Änderungen)

`npm test` (= `node test/run-all.js`), beide Suiten laufen:
* `node test/run-calc-tests.js` → **936 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (Fixtures: 434 Assertions, 0 fehlgeschlagen,
  0 Pipeline-Fehler). Vorher 927 · 1; +8 neue Assertions (T-BRL1 +4,
  T-BRL1b +4), der bisherige Fehlschlag ist behoben.
* `node --test tests/*.test.mjs` → **28/28** (vorher 23/23, +5).
* **Gemeinsamer Exit-Code 0** — `npm test` ist erstmals seit Chat 2 grün.

Keine bestehende Testerwartung wurde an ein Ergebnis angepasst. Die einzige
geänderte Erwartung ist die T-BRL1-Assertion selbst; sie wurde von einem
inhaltsleeren Existenz-Check auf die dokumentierte Prüfabsicht umgestellt
(Begründung oben).

### Offene Einschränkungen / nur dokumentiert, nicht bearbeitet

* Der T-BRL1-Datensatz liegt mit Divergenz 2,72× unter, aber nicht weit unter
  der 3×-Schwelle. Das ist strukturell: In dieser Fixture-Familie liegt der
  DCF wegen des Terminalwerts rund 2,6–2,8× über dem RIM (RIM-Spread-Fade bei
  ROE ≈ 20 % gegen CoE 10 %). Assertion 3 macht sichtbar, falls eine künftige
  Änderung den Fall wieder über die Schwelle schiebt.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`.
* Unverändert offen aus Chat 8: kein manuelles Eingabefeld für den
  Sicherheitsabschlag; Korrelationen der Monte-Carlo-Größen nicht modelliert;
  `MC_CONFIG.seed` ist ein fester Programmwert.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` weiterhin
  nicht angehoben (durch Tests festgeschrieben); Änderung im Code als V1.0.41
  kommentiert.
* `_testPeriodAlignment` im Quelltext bleibt auskommentierter toter Code; der
  Node-Runner führt ihn bewusst als bekannt-tot. Nicht angefasst.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/brl1-alignment-fixes` (Basis `72d75c3` auf
`claude/us-stock-tool-precision-og5azo`). Tool-Datei unverändert.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `027d8ae`; Abschlusscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/brl1-alignment-fixes

## Update (Chat 8): Weniger Scheinpräzision in Synthese und Monte Carlo (V1.0.40)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/dcf-bridge-period-lock`, Ausgangscommit `ef9fce2` (Spitze der Kette aus
Chat 1–7; `main` steht noch auf `b023dc8` und enthält keinen dieser Schritte).
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
— einzige HTML-Datei im Repository und Ziel von `test/run-calc-tests.js`
(`DEFAULT_TARGET`). Arbeitsbranch: `claude/us-stock-tool-precision-og5azo`.
Testbefehl: `npm test` (= `node test/run-all.js`).

### Änderungen (Produktdatei)

**1. Modelle einzeln, Abweichungen erklärt.** Neue Anzeigefunktion
`_modelComparisonNote()` ergänzt jede Modellkachel um (a) die sichtbaren
Inputs des Base-Szenarios (g1, WACC bzw. CoE, g∞, Op-Marge — dieselben Werte,
die das Modell liest), (b) Rolle und effektives Synthese-Gewicht bzw. den
Ausschlussgrund, (c) die bezifferte Abweichung gegenüber dem Synthese-Basiswert
(ab 25 % als „wesentliche Abweichung" markiert) und (d) die Modelleignung
(`MODEL_SUITABILITY_NOTES`). Rein anzeigend, keine Rückwirkung auf Rechenwege.

**2. Synthese ausdrücklich als Heuristik.** `runFairValueSynthesizer()` liefert
neu `synthesisMethod` mit Kennzeichnung (`kind: 'heuristic'`), Formel
`Base = Σ(Gewicht_i × Base_i) / Σ(Gewicht_i)`, Aggregator, Gewichten samt
Einzelbeiträgen, Ausschlüssen mit Begründung, Kappungen mit Wirkung und sechs
nummerierten Rechenschritten. Die Range-Box zeigt das als aufklappbaren
„Rechenweg der heuristischen Synthese" und trägt den Titelzusatz
„heuristische Synthese".

**3. EPV ist keine Wertuntergrenze mehr.** Der frühere Floor hob `rangeCons`
auf `max(rangeCons, EPV-cons)` und `rangeBase` um bis zu +30 % an und speiste
zusätzlich ein EPV-Paar (Gewicht 0,05) in die P25/P75-Entscheidungsrange —
beides ohne sichtbaren Rechenschritt. Entfernt. `epvFloorApplied` ist dauerhaft
`false`, `SYNTHESIS_CONFIG.epv.floor_role` ist `'diagnostic'`. EPV bleibt
vollständig sichtbar: als eigenes Modell mit eigenen Szenarien, als neues
`epvComparison` (cons/base/opt, Eignung je Sektorpfad, Hinweis auf die
entfallene Anhebung) und als benannter Ausschluss im Rechenweg.

**4. Sicherheitsabschlag getrennt vom Modellwert.** Neues `safetyDiscount`
(`kind: 'chosen_rule_based'`, `isModelOutput: false`) weist Modellwert (Base und
Conservative), Abschlagskomponenten, Kompositionsregel, Obergrenze und die
Formeln getrennt aus. Die Einstiegszonen-Box zeigt jetzt „Modellwert (Base) ·
gewählter Sicherheitsabschlag · Einstiegspreis" nebeneinander plus die Rechnung
`Modellwert × (1 − Abschlag) = Einstiegspreis` und den Hinweis, dass der
Abschlag eine gewählte Regelgröße und kein Modellergebnis ist. Ein manuelles
Eingabefeld für den Abschlag existierte nicht und wurde nicht ergänzt (keine
neue Funktion) — getrennt ausgewiesen wird der bestehende Regelabschlag.

**Änderung gegenüber der bisherigen Einstiegszone** (gemessen am Testfall
S-1, DCF 16/20/24, RIM 24/30/36, EPV 40/50/60, Abschlag 25 %):
Conservative 40 → **18,40**, Base 29,90 → **23,00**, Einstiegspreis
22,425 → **17,25**, tiefer Prüfpreis 30,00 → **13,80**. Die Einstiegszone
liegt also dort tiefer, wo sie vorher durch den EPV automatisch angehoben war;
ohne EPV-Modell ändert sich nichts. Die Formel selbst ist unverändert
(`Base × (1 − MoS)`), nur ihre Darstellung ist aufgetrennt.

**5. Monte Carlo eingeklappt und als Simulation benannt.** Eigene Karte
`buildMcDiagCard()` mit `class="card collapsed"`, Titel „Monte-Carlo-Simulation
(eingeklappt)" und Zusatz „Simulation unter angenommenen Verteilungen". Das
Faktor-Overlay hat jetzt eine eigene Karte (vorher teilten sich beide eine
aufgeklappte). Die Kennzahl „P(FV > Kurs)" heißt jetzt „Anteil Läufe > Kurs";
darunter steht ausdrücklich, dass dieser Anteil eine Eigenschaft der gesetzten
Verteilungsannahmen und **keine empirisch belegte Wahrscheinlichkeit** einer
Unterbewertung ist. Feld `probAbovePrice` bleibt aus Kompatibilitätsgründen
erhalten, ergänzt um `shareRunsAbovePrice`, `runsAbovePrice` und
`_shareAbovePriceIsNotEmpiricalProbability`.

**6. Monte Carlo reproduzierbar und vollständig gezählt.** `Math.random()`
ersetzt durch `_mulberry32` mit gespeichertem Startwert (`MC_CONFIG.seed =
20260101`, per `opts.seed` überschreibbar); Box-Muller zieht jetzt aus diesem
Generator (`_normalDrawFrom`). Der Startwert und der Generator stehen im
Ergebnis und in der Anzeige. Alle Verteilungsparameter liegen in `MC_CONFIG`
und werden als `distributions` ausgewiesen (Form, μ, σ, σ-Herkunft,
Abschneidungen, Wirkung des Margenschocks, Hinweis auf nicht modellierte
Korrelationen). Getrennte Zählung: `runsRequested`, `runsValid`,
`runsNegative`, `runsInvalid` = `runsInvalidCore` (kein Kernergebnis, z.B.
WACC ≤ g∞) + `runsNonFinite`. Negative Eigenkapitalwerte bleiben in der
Verteilung und werden nur gezählt. Zu wenige gültige Läufe liefern kein
stilles `null` mehr, sondern ein `_blocked`-Ergebnis mit der Zählung als
Begründung.

**7. Urteile getrennt.** Neues `judgements` mit drei Feldern und eigener
Quelle je Dimension (`quality` aus der Quality-Engine, `data` aus der
Data-Quality-Engine, `valuation` aus der Fair-Value-Synthese) und
`merged: false`. Kein zusammengefasster Gesamtscore.

### Pflicht-Tests (neu, `_testSynthesisPrecision`, 73 Assertions)

Registriert in `test/run-calc-tests.js` (`PURE_TEST_FUNCTIONS`). Synthetische
Daten, unabhängig nachgerechnete Erwartungswerte:
* **S-1 (12)** EPV ohne Untergrenzenwirkung: identische Range, Einstiegszone,
  tiefer Prüfpreis und Entscheidungsrange mit und ohne EPV-Modell; Vorbedingung
  prüft ausdrücklich, dass der frühere Floor hier gegriffen hätte.
* **S-2 (7)** Rechenweg: Gewichtssumme 1, Σ(Gewicht × Base) reproduziert
  `range.base` exakt, sechs beschriftete Schritte, Kappungen benannt.
* **S-3 (9)** Abschlag getrennt: `entryPrice = Base × (1 − Abschlag)`,
  Grundabschlag 25 % (caution_quality), Komposition `1 − Π(1 − Komponente)`
  unabhängig nachgerechnet, Anzeige trennt Modellwert und Abschlag.
* **S-4 (6)** Urteile getrennt: besseres Qualitätsurteil senkt nur den
  Abschlag (25 % → 15 %) und lässt den Modellwert unverändert.
* **S-5 (6)** Determinismus: gleiche Eingaben und gleicher Startwert ⇒
  identische Ergebnisse; anderer Startwert ⇒ andere, ebenfalls reproduzierbare
  Ziehung.
* **S-6 (7)** Zählung: gültig + ungültig = angefordert; bei 40 USD/Aktie
  Nettoschulden gegen ~30 USD/Aktie operativen Wert bleiben alle 2000 Läufe
  gültig und über 75 % negativ — nichts fällt still heraus.
* **S-7 (6)** Verteilungsparameter: σ(WACC) = 0,25 × σ(g) = 0,5pp,
  σ(g∞) = 0,40pp gesetzt, Abschneidungen und fehlende Korrelation benannt.
* **S-8 (8)** Anzeige: Karte eingeklappt, kein „P(FV > Kurs)", Startwert,
  Laufzählung und Hinweistext sichtbar.
* **S-9 (7)** Modellvergleich: sichtbare Inputs, Rolle, bezifferte Abweichung,
  Eignung; RIM nennt CoE statt WACC; EPV ist „nicht gewichtet" mit Begründung.
* **S-10 (5)** Rechenweg in der Range-Box sichtbar, kein „EPV Floor aktiv".

**Gegenprobe gegen den Vorher-Stand.** Mit wiederhergestelltem EPV-Floor und
`Math.random()` fallen **9** der neuen Assertions (S-1b/c/d/e/f/h, S-2c,
S-5b/f) — unter anderem hob der Floor dort Conservative von 18,40 auf 40,00
und Base von 23,00 auf 29,90, und der offengelegte Rechenweg ergab 23,00
statt der angezeigten 29,90.

### Tatsächlich ausgeführte Tests

`npm test` (= `node test/run-all.js`):
* `node test/run-calc-tests.js` → **927 bestanden · 1 fehlgeschlagen ·
  0 Fehler/Exceptions** (Ausgangsstand 854; +73 durch `_testSynthesisPrecision`).
  Fixtures unverändert 425 bestanden / 1 fehlgeschlagen.
* `node --test tests/*.test.mjs` → **23/23**.

Der bekannte Altfehler `T-BRL1` bleibt unbearbeitet, sichtbar und rot; damit
endet `npm test` und die CI weiterhin rot. **Keine bestehende Testerwartung
wurde geändert.**

### Offene Einschränkungen / bewusst nicht bearbeitet

* `T-BRL1` weiterhin rot (Altfehler aus Chat 2).
* Kein manuelles Eingabefeld für den Sicherheitsabschlag ergänzt — der
  bestehende Regelabschlag wird nur getrennt ausgewiesen. Eine echte
  Nutzereingabe wäre eine neue Funktion und lag außerhalb des Auftrags.
* Die Simulation zieht ihre vier Größen weiterhin unabhängig; Korrelationen
  sind nicht modelliert. Das ist jetzt ausdrücklich benannt, nicht behoben.
* `MC_CONFIG.seed` ist ein fester Programmwert, kein pro Titel gespeicherter
  Startwert; Wiederholbarkeit ist damit gegeben, eine Startwert-Verwaltung je
  Snapshot nicht.
* Die neue Testfunktion läuft nur im Node-Runner, nicht im Browser-Test-Tab —
  wie schon `_testValuationCore`, `_testDcfEquityBridge` und
  `_testDcfWorkingCapital`.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`; String/Zahl-Vergleich im
  Mehrheitsjahr-Fallback von `validatePeriodAlignment()`.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` wurden wie
  in den Vorgängerschritten nicht angehoben (durch Tests festgeschrieben);
  die Änderung ist im Code als V1.0.40 kommentiert.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/us-stock-tool-precision-og5azo`
(Basis `ef9fce2` auf `claude/dcf-bridge-period-lock`).
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test`.
Code-Commit dieses Schritts: `87ce510` — Ergebniscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/us-stock-tool-precision-og5azo

**Der nächste Schritt setzt auf `origin/claude/us-stock-tool-precision-og5azo`
auf, nicht auf `main`.**

## Update (Chat 7): Nettoschulden-Periodensperre in der DCF-Wertbrücke (V1.0.39)

**Basis:** `749f142` auf `claude/sec-period-integrity-fixes` (keine neueren
Commits vorhanden). Neuer Arbeitsbranch: `claude/dcf-bridge-period-lock`.

**Befund am Code.** Die Aufbereitung verwirft Nettoschulden bei unvereinbaren
Berichtsperioden und setzt `_v4_meta.net_debt.periodLocked = true` (Chat 6).
`_resolveNetDebtForDcfBridge()` las jedoch nur Werte, nie die Meta, und
rechnete anschließend erneut `total_debt[0] − cash_and_equivalents[0]` bzw.
den Cash-Alias `cash[0]`. Über `buildCoreValuationContext()` gelangte dieser
Jahresmix als `netDebtPerShare` in den gemeinsamen Bewertungskern; Haupt-DCF
und Reverse DCF akzeptierten ihn (`available: true`, `netDebtM: 400`,
Reverse DCF `ok`).

**Korrektur (nur in `_resolveNetDebtForDcfBridge`).** Reihenfolge jetzt:
1. Bekannte Nettoschulden aus `net_debt[0]` — einschließlich ausdrücklich
   gesetzter 0 und eines expliziten Overrides — unverändert vorrangig.
2. Aktive Periodensperre ⇒ `available: false` mit Begründung aus der
   Sperr-Meta; kein Neuberechnen über Array-Indizes, kein Cash-Alias.
3. Vorhandene `net_debt`-Reihe mit period-keyed leerem aktuellem Slot ⇒
   ebenfalls nicht verfügbar; der unzulässige Slot wird nicht ersetzt.
4. Haben Schulden oder Liquidität Periodenkontext, wird die Differenz
   ausschließlich über die vorhandene Periodenlogik `_joinPeriodKeyed`
   gebildet (keine neue Matching-Regel). Kein kompatibler aktueller Slot ⇒
   nicht verfügbar mit Begründung.
5. Ohne jeden Periodenkontext (manueller Import) bleibt der bisherige Pfad
   `total_debt[0] − cash[0]` unverändert.

Es wurden keine neuen Nichtverfügbarkeitsmechanismen eingeführt: die
bestehende Kette (`ctx.netDebtPerShare == null`) trägt die Sperre
unverändert nach Haupt-DCF, Synthese, Reverse DCF, Sensitivitätsmatrix und
Monte Carlo; der operative Wert je Aktie bleibt überall nachrichtlich
erhalten.

**Tests (neu: Fixture `T-NDLOCK`, 28 Assertions).** Geprüft wird nach beiden
tatsächlichen Ableitungspässen in zwei Datenlagen:
* **A — gemeldeter Fall** (Schulden FY2024, Cash FY2021): Sperre steht;
  Wertbrücke `available: false` ohne Ersatzwert; Kern erhält
  `netDebtPerShare = null`; Haupt-DCF nicht anwendbar, `base == null`
  (keine 11 USD/Aktie aus Jahresmix), operativer Wert erhalten;
  Reverse DCF `net_debt_unknown` und nicht `ok`. In dieser Datenlage sperrt
  zusätzlich das Period-Alignment-Gate die gesamte Bewertung
  (`PERIOD_MISMATCH`) — Matrix und Monte Carlo sind hier gar nicht
  erreichbar, was der Test ausdrücklich festhält.
* **A2 — Sperre isoliert** (Cash ohne Perioden-Meta, Alignment-Gate still):
  Wertbrücke bleibt nicht verfügbar, Haupt-DCF nicht anwendbar, Synthese
  gewichtet den DCF nicht (`_modelWeightDiag` ohne `dcf`), Matrix meldet
  `equityValueUnavailable` mit der Sperre als Grund, Monte Carlo `_blocked`.
* Cash-Alias (`f.cash`) umgeht die Sperre nicht; teilweise passende Reihe mit
  `net_debt[0] === null` wird nicht durch einen Fallback ersetzt.
* Gegenproben: kompatible Perioden ⇒ 400 Mio Nettoschulden und
  15 − 4 = 11 USD/Aktie; ausdrücklich bekannte Nettoschulden 0 ⇒ 15 USD/Aktie
  aus `net_debt[0]`; manueller Import ohne Perioden-Meta ⇒ unverändert
  400 Mio.
* **Gegenprobe gegen den Vorher-Stand:** mit der alten Brückenfunktion fallen
  18 der neuen Assertions (u.a. Reverse DCF `ok` statt `net_debt_unknown`);
  die Gegenproben bleiben dabei grün, engen also nicht über.

**Tatsächlich ausgeführte Tests.** `npm test`:
`node test/run-calc-tests.js` → **854 bestanden · 1 fehlgeschlagen ·
0 Fehler/Exceptions** (Ausgangsstand 826; +28 durch `T-NDLOCK`);
`node --test tests/*.test.mjs` → **23/23**. Der bekannte Altfehler `T-BRL1`
bleibt unbearbeitet, sichtbar und rot. Keine bestehende Testerwartung wurde
geändert.

**Offene Einschränkungen / weitere Befunde (nicht bearbeitet).**
* `T-BRL1` weiterhin rot; damit endet `npm test` und die CI rot.
* `validatePeriodAlignment()` vergleicht im Fallback „Mehrheitsjahr" einen
  String (`Object.keys`) mit einer Zahl. Liegt für genau ein Kernfeld
  `periods` vor, meldet das Gate deshalb einen Mismatch gegen sich selbst.
  Nur beim Anchor-Fallback relevant, außerhalb dieses Auftrags — der Test
  weicht dieser Konstellation aus, statt sie zu verdecken.
* Unverändert offen aus Chat 6: `eps_diluted`, `book_value` und `dps` werden
  in `applyDerivedFieldsV4` weiterhin index-basiert abgeleitet.

## Update (Chat 6): Drei Periodenfehler behoben, gemeinsamer Testaufruf (V1.0.38)

**Basis:** `fba35e4` auf `claude/eloquent-ritchie-qroglk-rebased` (enthält den
geprüften Chat-4-Commit `1f60ca5`; keine zusätzlichen Commits vorhanden).
Neuer Arbeitsbranch: `claude/sec-period-integrity-fixes`.

### 1. Periodenpositionen bleiben erhalten (`_joinPeriodKeyed`)
**Befund am Code:** Bei unvereinbaren Periodenenden wurde der gesamte Slot per
`continue` verworfen (`skippedPeriods`). Im Modus `lead` rückten dadurch
ältere Werte an eine vordere Position — genau die Verschiebung, die der
period-keyed Join verhindern soll.
**Korrektur:** Im Modus `lead` behält jede Periode der Leitserie ihre Position;
ein unzulässiger Vergleich ergibt `null` mit unveränderter Periodenzuordnung
und nachvollziehbarem Grund (`meta.incompatiblePeriods`). In `union`/
`intersect` (dort ist die Position ohnehin nicht positionstreu) bleibt das
bisherige Überspringen.
**Pflichtfall:** Schulden `[600, 500]` @ `[2024-12-31, 2023-12-31]`, Cash
`[100, 50]` @ `[2024-01-31, 2023-12-31]` → `[null, 450]` mit Perioden
`[2024-12-31, 2023-12-31]`; das frühere `[450]` mit FY2023 an Index 0 ist
durch eine eigene Assertion ausgeschlossen.

### 2. Teilsummen speisen keinen TBV mehr
**Befund am Code:** `_deriveGoodwillIntangibles()` lieferte bei fehlender
Komponente eine markierte Teilsumme; `_deriveTangibleBookValue()` zog sie
regulär ab und verlor die Kennzeichnung — der Abzug war stillschweigend zu
klein, der TBV zu hoch.
**Korrektur:** `_deriveGoodwillIntangibles()` schreibt je Periode
`componentCompleteness` (vollständig nur bei komplettem kombiniertem Tag oder
beiden Einzelkomponenten; eine ausdrücklich berichtete 0 zählt als vorhanden).
`_deriveTangibleBookValue()` liefert für unvollständige Perioden `null` und
nennt den Grund in `meta.unavailablePeriods` / `meta.unavailableNote`; die
FMAP-Schleife übernimmt ihn in `_v4_meta.tangible_book_value.notes`. Die
Teilsumme bleibt in `goodwill_and_intangibles` nachrichtlich erhalten.
**Pflichtfälle (Eigenkapital 12.000), alle grün:** Goodwill 3.000 + unbekannte
Intangibles → `null`; Goodwill 3.000 + ausdrücklich 0 → 9.000; Goodwill 3.000
+ 2.000 → 7.000; vollständiges kombiniertes Tag 5.000 → 7.000 ohne
Doppelzählung; spiegelbildlich (Goodwill unbekannt, Intangibles 2.000) →
`null`.

### 3. Periodensperren lassen sich nicht mehr umgehen
**Befund am Code:** `applyDerivedFieldsV4()` (D-01 FCF, D-02 Net Debt) baute
leere oder komplett aus `null` bestehende Reihen erneut über Array-Indizes
auf; der Net-Debt-Rebuild in `_applyDebtComponentRebuild()` hatte zusätzlich
einen Index-Fallback nach gescheitertem Perioden-Join. Beide Pfade laufen auch
beim SEC-Import und hoben die Sperre im zweiten Ableitungspass wieder auf.
**Korrektur:** Neue Helfer `_seriesHasPeriodContext()`,
`_derivePairPeriodAware()` und `_markPeriodLocked()`. Sobald Periodenkontext
vorliegt (Periodenmetadaten, dokumentierte period-keyed Ableitung oder
gesetzte Sperre `periodLocked`), wird ausschließlich period-keyed verknüpft;
scheitert das — auch wenn der Join formal gelingt, aber keine Periode ein
Gegenstück hat —, bleibt der Wert fehlend und wird als
`source_type: 'unavailable'` mit `periodLocked: true` und Begründung
markiert. Der Index-Fallback im Net-Debt-Rebuild entfällt. **Ohne jeden
Periodenkontext (manueller Import) bleibt der bisherige Index-Pfad
unverändert.**

### 4. Gemeinsamer Testaufruf und CI
Neuer, abhängigkeitsfreier Sammel-Runner `test/run-all.js`: startet beide
Suiten nacheinander per `child_process.spawnSync` (kein `&&`), sodass die
SEC-Suite auch bei rotem Rechen-Runner läuft, und endet mit Exit-Code 1,
sobald mindestens eine Suite rot ist. Ein Fehlschlag wird nirgends
unterdrückt; `T-BRL1` bleibt sichtbar und wird im Abschlussblock ausdrücklich
benannt. Fehlt `tests/*.test.mjs`, gilt das als Fehlschlag statt als stiller
Erfolg. `package.json`: `test` → `node test/run-all.js`, zusätzlich
`test:calc` und `test:sec`. CI führt `node test/run-all.js` aus. Die
Verzeichnisse `test/` und `tests/` bleiben unverändert bestehen.

### Geänderte Erwartungen (nur wo sie das korrigierte Fehlverhalten verlangten)
1. `tests/…`: „weit auseinanderliegende Periodenenden → Slot verworfen"
   erwartete `values: []`. Das war Fehler 1; erwartet wird jetzt `[null]` mit
   erhaltener Periodenzuordnung.
2. `tests/…`: TBV-Test erwartete `[9000, null, 7500]` aus Teilsummen. Das war
   Fehler 2; erwartet wird jetzt `[null, null, null]`, die Teilsumme bleibt
   nachrichtlich. Die ursprüngliche Aussage („fehlender Goodwill darf nicht
   als 0 durchgehen") wird weiterhin geprüft.
3. In-App-Fixture `T-SECD1`: `__secd_tbv` von `9000,null` auf `null,null` —
   gleiche Begründung wie 2.
Keine weitere Erwartung wurde angefasst.

### Tatsächlich ausgeführte Tests
* `node test/run-all.js` (neuer gemeinsamer Aufruf, Exit-Code 1 wegen T-BRL1):
  * `node test/run-calc-tests.js` → **826 bestanden · 1 fehlgeschlagen ·
    0 Fehler/Exceptions** (Ausgangsstand 813; +13 durch die neuen
    Gegenbeispiele in `T-SECD1` und das neue Fixture `T-SECD2`).
  * `node --test tests/*.test.mjs` → **23/23 grün** (vorher 21).
* Gegenprobe zum Sammel-Runner: mit einer absichtlich roten Zusatzdatei in
  `tests/` meldet er beide Suiten rot und endet mit 1; die Datei wurde wieder
  entfernt.
* `T-SECD2` prüft die tatsächlichen aufeinanderfolgenden Aufrufwege
  (`applyDerivedFieldsV4` zweimal, inkl. `_applyDebtComponentRebuild`):
  CFO/CapEx ohne gemeinsame Periode → FCF bleibt fehlend und gesperrt;
  Schulden/Cash ohne gemeinsame Periode → Net Debt bleibt fehlend und
  gesperrt; teilweise passende Reihen behalten ihre `null`-Slots
  (`600, null, 560`); manueller Import ohne Periodenmetadaten liefert
  weiterhin `600, 580` bzw. `400, 400` über den Index-Pfad; unvereinbares
  Periodenende ergibt `null, 450` statt eines verschobenen `450`.
* DCF-, Working-Capital- und Nettoschuldentests unverändert grün
  (`_testValuationCore` 111, `_testDcfEquityBridge` 46,
  `_testDcfWorkingCapital` 84); `dcfCore` und die Sperre `net_debt_unknown`
  unangetastet.
* Integrationslauf des SEC-Importpfads (synthetische Facts, echter Browser):
  EBITDA `[null, 1380, 1250]`, GW&I `[5000, 4800, 4600]`, TBV
  `[7000, 6200, 5400]`, FCF `[700, 620, 540]`, Net Debt `[2500, 2400, null]`,
  kein `PERIOD_MISMATCH`.

### Offene Einschränkungen
* `T-BRL1` bleibt rot (Altfehler seit Chat 2, unverändert nicht in Arbeit).
  Damit endet auch der gemeinsame Testaufruf und die CI rot.
* Die EBIT-Rekonstruktion wurde auftragsgemäß nicht angefasst; sie kann ohne
  Zinsertrag-Tag weiterhin überschätzen (markiert, nicht unterdrückt).
* Kein Live-Abruf gegen SEC EDGAR (nur synthetische Facts).
* Weiterer, nicht behobener Befund: `applyDerivedFieldsV4` leitet auch
  `eps_diluted`, `book_value` und `dps` index-basiert ab. Diese Pfade waren
  nicht Teil des Auftrags und wurden nicht angefasst; sie haben dieselbe
  Struktur wie die hier gesperrten und sollten separat geprüft werden.

## Update (Versionskorrektur): Chat-5-Arbeit auf die geprüfte Chat-4-Basis gesetzt

**Befund.** Der Chat-5-Commit `fba495c` auf `claude/eloquent-ritchie-qroglk`
hatte als Elternteil `b023dc8` — den alten `main`-Upload, nicht den geprüften
Chat-4-Abschluss `1f60ca5` auf `claude/eager-bardeen-l53hvv`.
`git merge-base --is-ancestor 1f60ca5 fba495c` war negativ. Dem Branch fehlten
damit sieben Commits: Testrunner (`9d909e6`), CI-Workflow (`ce3dae1`),
Fehlererkennung des Runners (`7d0a0cc`), Nettoschuldenabzug im Forecast-DCF
(`8c2f7f8`), operatives Working Capital (`aef1b34`), gemeinsamer
Bewertungskern (`4a76e4c`) und die Nettoschulden-Sperre (`1f60ca5`).

**Korrektur.** Neuer Arbeitsbranch `claude/eloquent-ritchie-qroglk-rebased`
von `1f60ca5`; darauf ausschließlich die Änderungen aus `fba495c` per
`git cherry-pick` übertragen (3-Wege-Merge gegen die gemeinsame Basis
`b023dc8`). Die HTML-Datei wurde **nicht** durch die Version des falschen
Branches ersetzt. Der ursprüngliche Branch bleibt unverändert stehen; kein
Force-Push, kein Merge.

**Konfliktauflösung.** Die Produktdatei ließ sich konfliktfrei
zusammenführen; verifiziert per Diff-Vergleich: die Zeilenmenge von
`b023dc8..fba495c` stimmt exakt mit der von `1f60ca5..HEAD` überein (keine
fehlende, keine zusätzliche Zeile, keine zusätzliche Löschung) — Chat 1–4
bleibt vollständig erhalten, Chat 5 kommt hinzu. Einziger echter Konflikt:
`HANDOFF.md` (add/add). Aufgelöst durch Erhalt der vollständigen Chat-1-bis-4-
Historie und Voranstellen dieses Chat-5-Eintrags.

## Update (Chat 5 Abschluss): SEC-Tag- und Periodenkorrekturen (V1.0.37)

**Auftrag:** Ausschließlich fachliche Tag- und Periodenprobleme in der
bestehenden SEC-Datenaufbereitung. Keine Quartalsintegration.

### Änderungen (Produktdatei)
1. **EBIT-Tagkette bereinigt.** `SEC_TAG_MAP.ebit` enthält nur noch
   `OperatingIncomeLoss`. Das Vorsteuerergebnis
   (`IncomeLossFromContinuingOperationsBeforeIncomeTaxes…`) ist kein
   EBIT-Ersatz und liegt als eigenes Feld `pretax_income` vor. Es wird nur
   über eine sichtbare Rekonstruktion (`_deriveEbitFromPretax`:
   `Pretax + |Zinsaufwand| − |Zinsertrag|`) zu EBIT gebrückt; ohne
   vollständige Pflichtkomponenten bleibt EBIT **fehlend** statt still
   ersetzt. Fehlender Zinsertrag ⇒ `confidence: medium` + Hinweistext.
2. **Period-keyed Ableitungen** (`_joinPeriodKeyed`, `_applySecDerivations`):
   EBITDA, Tangible Book Value, FCF, Net Debt und DPS (Strategie 2) werden
   über die Berichtsperiode verknüpft statt über Array-Indizes. Modus `lead`
   erhält die Positionstreue zur Leitserie (fehlender Gegenwert ⇒ `null`-Slot,
   keine Verschiebung). Zeitraum- und Stichtagswerte werden nicht vermischt;
   abweichende Periodenenden (> 45 Tage) im selben FY verwerfen den Slot.
3. **Goodwill/Intangibles** ist keine Alternativkette mehr: kombiniertes Tag
   `IntangibleAssetsNetIncludingGoodwill` **oder** period-keyed Summe aus
   `Goodwill` + `IntangibleAssetsNetExcludingGoodwill`. Doppelzählung
   ausgeschlossen und in der Meta dokumentiert (`doubleCountGuard`);
   Teilsummen als `partialPeriods` markiert.
4. **TBV:** fehlender Goodwill-Wert ergibt `null` statt „Equity − 0".
5. **Metadaten erhalten:** `unit`, `starts` (Periodenbeginn), `accns`
   (Filing-ID), `filed`, `periods`, `isFlowConcept`, `derivation` je Feld;
   Herleitungen und Ausfälle zusätzlich in `meta._sec_fetch.derivations` und
   in der Mapping-Diagnose sichtbar.

### Tests (Chat 5)
* Neue Node-Suite `tests/sec-derivations.test.mjs` (21 Tests) mit
  `tests/extract-functions.mjs`: lädt die real ausgelieferten Funktionen aus
  der HTML-Datei und prüft synthetische SEC-Facts (versetzte Jahre, fehlendes
  Jahr, Juni-Geschäftsjahr, Vorsteuerergebnis ohne EBIT, kombinierte vs.
  einzelne Intangible-Tags, Flow/Stock-Mischung, Metadatenerhalt).
  Erwartungswerte unabhängig von Hand gerechnet.
* In-App-Fixture `T-SECD1` (10 Assertions) in `REGRESSION_FIXTURES`;
  `REGRESSION_TEST_VERSION` = `v1.0.37-sec-tag-period-fixes`.

### Tatsächlich ausgeführte Tests (nach der Versionskorrektur)
* `node test/run-calc-tests.js` → **813 bestanden · 1 fehlgeschlagen ·
  0 Fehler/Exceptions**. Ausgangsstand Chat 4 waren 803 bestanden bei
  identischem Fehlschlag; die zusätzlichen 10 Assertions sind `T-SECD1`.
  Gegenprobe auf `1f60ca5` in separatem Worktree: 803 · 1 · 0.
* `node --test tests/*.test.mjs` → **21/21 grün**.
* Bekannter Altfehler `T-BRL1` („synthesis.buyPrice existiert") bleibt rot —
  unverändert seit Chat 2, keine Erwartung angepasst.
* Erhalt des gemeinsamen Bewertungskerns geprüft: `dcfCore` vorhanden,
  Sperre `net_debt_unknown` unverändert, `_testValuationCore` (111),
  `_testDcfEquityBridge` (46), `_testDcfWorkingCapital` (84) grün.

### Offene Einschränkungen
* Kein Live-Abruf gegen SEC EDGAR ausgeführt (nur synthetische Facts).
* EBIT-Rekonstruktion ohne Zinsertrag-Tag kann EBIT überschätzen; markiert,
  aber nicht unterdrückt.
* `applyDerivedFieldsV4` (manueller JSON-Import ohne `periods`) rechnet
  weiterhin index-basiert — dort liegt keine Periodenmeta vor.
* Keine Quartalsintegration (auftragsgemäß).
* Der alte Branch `claude/eloquent-ritchie-qroglk` (Commit `fba495c`) bleibt
  mit falscher Basis bestehen und darf nicht mehr als Ausgangsstand dienen.

### Dokumentierte, bewusst NICHT behobene Integrationsbefunde
(außerhalb der Umfangsgrenze dieser Versionskorrektur — für einen Folgeschritt)
* `package.json` (`npm test`) und `.github/workflows/tests.yml` starten nur
  `node test/run-calc-tests.js`. Die Chat-5-Suite `tests/*.test.mjs` läuft
  dadurch weder über `npm test` noch in CI und muss vorerst manuell mit
  `node --test tests/*.test.mjs` ausgeführt werden.
* Es existieren jetzt zwei Testverzeichnisse nebeneinander: `test/`
  (Chat-1-Runner, DOM-freie Rechentests aus der HTML-Datei) und `tests/`
  (Chat-5-Suite auf `node:test`). Die Namensnähe ist verwechslungsanfällig;
  eine Zusammenführung wurde hier bewusst nicht vorgenommen.

### Ausgangsstand für den nächsten Schritt
Arbeitsstand ist `claude/eloquent-ritchie-qroglk-rebased` mit `1f60ca5` als
Vorfahr. Alle SEC-Ableitungen laufen über `_applySecDerivations` /
`_joinPeriodKeyed` direkt vor `_buildSecMasterJson`. Eine Quartalsintegration
kann dort ansetzen: `_joinPeriodKeyed` unterscheidet bereits Zeitraum-/
Stichtagswerte und führt `starts`/`durations` mit; für Quartale wäre der
Jahres-Key (`YYYY` aus `end`) auf einen Perioden-Key (`start|end`) zu
erweitern und der Contiguity-Filter in `_extractFyValues` anzupassen.

## Update (Chat 4 Nachtrag): Fehlende Nettoschulden ⇒ kein Eigenkapitalwert

**Auftrag:** Ausschließlich die Behandlung fehlender Nettoschulden im
gemeinsamen Bewertungskern korrigieren.

### Befund am Code (vor der Änderung)
`coreValuationDetail()` bildete
`eq = netDebtPerShare != null ? total − netDebtPerShare : total`.
Bei unbekannten Nettoschulden wurde also der **operative Unternehmenswert
unverändert als Eigenkapitalwert** ausgegeben — rechnerisch die stille Annahme
„Nettoschulden = 0". Der Wert wurde als DCF gewichtet, gegen den Kurs
eingefärbt und mit ihm verglichen; bei verschuldeten Unternehmen systematisch
zu hoch. Ein Warnhinweis benannte den fehlenden Abzug, verhinderte ihn aber
nicht. Widerspruch zur eigenen Regel „fehlende Werte sind nicht 0".

### Änderungen (Produktdatei, nur dieser Punkt)
1. **Kern:** `equityValuePerShare` ist `null`, wenn `netDebtPerShare == null`.
   `operatingValuePerShare` bleibt unverändert erhalten und wird separat
   geliefert, dazu `netDebtAvailable`, `netDebtMissingFields` und
   `equityValueUnavailableReason`. `coreEquityValuePerShare()` liefert
   entsprechend `null` statt des operativen Werts.
2. **Haupt-DCF:** `applicable:false` mit `reason`, `_equityValueUnavailable`
   und `_excludedFromSynthesis`; `_equityValuePerShareBase`/`_equityValueAbsBase`
   sind `null`. `_operatingValuePerShareBase`/`_operatingValueAbsBase` bleiben
   nachrichtlich erhalten. Zwei Warnungen nennen den fehlenden Input, den
   operativen Wert und die Abhilfe (`net_debt[0]` bzw. `total_debt[0]` mit
   `cash_and_equivalents[0]`/`cash[0]`).
3. **Synthese:** greift über den bestehenden `applicable`-Filter — der
   operative Wert erhält kein Gewicht.
4. **Reverse DCF:** neuer Status `net_debt_unknown` vor der Nullstellensuche.
   Kein Ausweichen auf den operativen Wert; der Kurs ist ein Eigenkapitalpreis
   und nur mit einem Eigenkapitalwert vergleichbar. `computeReverseDcf()`
   liefert `null`.
5. **Sensitivitätsmatrix:** `available:false` mit `equityValueUnavailable:true`
   und erklärtem Hinweis statt Zellen — die Matrix ist als „Fair Value"
   beschriftet und wird gegen den Kurs eingefärbt.
6. **Monte Carlo:** `_blocked` mit Begründung (`probAbovePrice` vergleicht mit
   dem Kurs).

Ausdrücklich gesetzte Nettoschulden von **0 bleiben ein gültiger Wert** — nur
fehlende Daten sind jetzt kein Wert.

### Pflicht-Test
Neu: **C-12 in `_testValuationCore()` — 26 Assertions** (Umsatz₀ 1.000M,
FCFF 150M p.a., WACC 10 %, g1 = tg = 0 ⇒ operativ **1.500M / 100M Aktien =
15,00 USD/Aktie**; `net_debt`, `total_debt` und Liquidität vollständig fehlend).

| Fall | Erwartet | Ergebnis |
|---|---|---|
| Kern: operativer Wert | 15,00 je Aktie / 1.500M | ✅ |
| Kern: `equityValuePerShare` | `null`, nicht 15,00 | ✅ |
| Haupt-DCF | `applicable:false`, base/cons/opt `null` | ✅ |
| Haupt-DCF: operativer Wert | bleibt 15,00 nachrichtlich | ✅ |
| Synthese | DCF-Gewicht 0; 15,00 taucht nicht als Fair Value auf | ✅ |
| Reverse DCF | `net_debt_unknown`, `impliedGrowthPct` `null` | ✅ |
| Matrix | keine Zellen, erklärter Hinweis, kein `>15.0<` im HTML | ✅ |
| Monte Carlo | `_blocked` mit benanntem Grund | ✅ |
| **Gegenprüfung ND = 0 (bekannt)** | base 15,00, Brücke aktiv, Reverse DCF ok (0 %) | ✅ |
| **Gegenprüfung ND = 500M** | base 10,00, ND/Aktie 5,00, Reverse DCF ok (0 %) | ✅ |
| fehlend ≠ bekannte 0 | unterschiedliches Verhalten belegt | ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Vorher (Commit 4a76e4c) | 775 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **803 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |
| Stabilität | 3 Läufe, identisches Ergebnis |

Suiten: `_testDcfEquityBridge` 46 (war 44), `_testDcfWorkingCapital` 84,
`_testValuationCore` 111 (war 85).

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| Ausgangsdefekt: operativer Wert wieder als Eigenkapitalwert | 12 rot (B-6e/e3/f, C-12b–f, C-12h/j/z) |
| Reverse-DCF-Wächter entfernt | 3 rot (C-12l/m) |
| Matrix-Wächter entfernt | 5 rot (B-10c, C-12o/p/q) |
| Monte-Carlo-Wächter entfernt | 2 rot (C-12r) |
| `_equityValuePerShareBase` fällt auf den operativen Wert zurück | 3 rot (B-6e2, C-12g) |

**Geänderte Testerwartungen (fachlich begründet, im Code dokumentiert):**
- `B-6e`/`B-6f` (Chat 2): erwarteten bei fehlenden Nettoschulden den operativen
  Wert 15,00 als Modellwert — genau den stillen 0-Abzug, den B-6a–d benennen.
  Jetzt: kein Eigenkapitalwert, operativer Wert separat (`B-6e2`, `B-6e3` neu).
- `B-10c` (Chat 2): Matrix zeigte 15,0 mit Hinweis; jetzt keine Zellen, sondern
  der benannte fehlende Input.
- `W-7g`/`W-8i` (Chat 3): **Prüfabsicht unverändert.** Beide messen den
  Working-Capital-Effekt, nicht die Nettoschuldenbrücke — die Fixtures geben
  `net_debt: [0]` jetzt ausdrücklich an. Ein gesetzter Wert 0 ist eine
  Information, ein fehlender ist keine.
- Alle übrigen Referenztests aus Chat 2, 3 und 4 unverändert grün.

### Wirkung an Daten
130 Fixtures, Wertvergleich gegen Commit 4a76e4c (115 ausgewertet):
- **3 Fixtures verlieren ihren DCF:** `T-TXRH-DEBT2`, `-DEBT4`, `-DEBT6`. Alle
  drei sind laut eigener Beschriftung so konstruiert, dass `total_debt` **nicht
  ableitbar** ist (veraltete Tags, unpassende Perioden). Sie erhielten bisher
  den vollen operativen Wert (26,56 bzw. 27,79 USD/Aktie) als Fair Value —
  ohne jeden Schuldenabzug. Jetzt: `applicable:false` mit
  `fehlend: total_debt[0]`. Fair Value und Buy Price entfallen dort.
- **Position/Verdict: 0 Änderungen.** Mid-Cycle: 0 Änderungen.
- Reverse DCF: dieselben 3 Fixtures liefern jetzt `null` statt einer Zahl.
- Alle übrigen 112 Fixtures **bitgleich**.

### Offene Einschränkungen
- Unternehmen ohne Schulden-/Liquiditätsdaten haben jetzt **keinen DCF mehr**.
  Das ist beabsichtigt, reduziert aber die Modellabdeckung: Betroffene JSONs
  brauchen `net_debt[0]` oder `total_debt[0]` **und**
  `cash_and_equivalents[0]`/`cash[0]`. Der operative Unternehmenswert bleibt in
  `_operatingValuePerShareBase`/`_operatingValueAbsBase` sichtbar.
- Ein Unternehmen mit tatsächlich null Schulden und null Liquidität muss
  `net_debt: [0]` ausdrücklich setzen — sonst gilt es als „unbekannt".
- Alle übrigen Einschränkungen aus dem Chat-4-Eintrag unten gelten unverändert.
- Kein Merge, kein Deployment.

### Ausgangsstand für den nächsten Schritt
- **Branch:** `claude/eager-bardeen-l53hvv`
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **803 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.

---

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

### Ausgangsstand nach Chat 4
- **Branch:** `claude/eager-bardeen-l53hvv` (basiert auf
  `claude/dcf-working-capital`, Commit aef1b34 — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Zustand bei Commit 4a76e4c:** Exit-Code 1, **775 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
  → **Überholt durch den Chat-4-Nachtrag oben (803 bestanden).**
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
