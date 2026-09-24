# HANDOFF — US-Aktienbewertungstool

## Folgechat D1: Auditwerkzeug repariert (Vorbereitung für D2/D3)

**Ausgangsstand.** Auditbranch `claude/audit-real-data-mcd-jnj` an der Spitze
`11c32fa` (= bekannter Referenzvorfahr, keine Nachfolgeänderungen auf dem
Remote). Der Arbeitsbaum war sauber. Keine `AGENTS.md`. Die Produktdatei ist
**unverändert**. Geändert wurden nur das Werkzeug, seine Tests und die Dokumentation.

**Baseline vor der Änderung** (selbst ausgeführt): `npm test` Exit 0 (1700
Rechen-Assertions, davon 434 Fixture-Assertions; 206/206 Node-Tests),
`npm run test:browser` Exit 0 (158/158).

**Befund 1: falsche TTM-Felder.** `replay-import.mjs` las für FY und TTM aus
`state.masterJson.fundamentals`. Die Engine rechnet bei TTM aber auf einer
eigenen Sicht (`buildValuationBasisView`). Reproduziert mit dem synthetischen
Filer (`--selftest --price 25`): `basis.selected = ttm`, Periode bis
2025-09-30, aber `ttmView.fields.revenue` = 1000 und `ebitda` = 250, jeweils
mit FY-Perioden 2024-12-31.
**Korrektur:** Die Felder werden aus `resolveValuationView(state.masterJson,
state.valuation)` gelesen. Das ist dieselbe Paarung `resolveDataBasis` +
`buildValuationBasisView` wie in `runValuationEngine` und `renderMarket`. Das
Werkzeug rechnet nichts selbst.
Je Feld werden erfasst:
* Wert und Einheit (Berichtseinheit, Quelleinheit, Reiheneinheit);
* Periode; bei TTM die Komponentenperioden, also Quartale mit Beginn und Ende,
  der Bilanzstichtag, die Aktienquartale oder die Bestandteile von
  EBITDA/FCF/Nettoschulden;
* Herkunft, Tag, `filed`, Ableitung und Größenart;
* fehlende Metadaten ausdrücklich in `metadataMissing`.

Für TTM-Werte werden keine Jahres-Metadaten übernommen. Einen von der Engine
nur geerbten Jahres-Tag weist das Werkzeug getrennt aus
(`engine_inherited_fy_tag`). Felder außerhalb der TTM-Sicht erscheinen ohne
Metadaten.
Die Aktienbegriffe stehen getrennt in `shareConcepts`: gewichteter Durchschnitt
gegenüber der aktuellen Aktienzahl am Stichtag.
Ist TTM nicht verfügbar, wird TTM trotzdem über die Oberfläche angefordert. Der
Bericht zeigt dann den tatsächlichen Rückfall: `requested ttm`, `selected fy`,
`ttm_used false`, `fallback.reasons`.

**Befund 2: veraltete Paneltexte.** Nach dem Basiswechsel rendert das Produkt
nur die aktive Ansicht neu (`_handleDataBasisChange`). Das Skript las die
übrigen Panels trotzdem. Reproduziert: In der TTM-Erfassung zeigten
Bewertungs- und Marktansicht weiterhin „Letztes Geschäftsjahr (FY) ·
2024-12-31“.
**Korrektur:**
* Die Basis wird über die Auswahl im Reiter „Annahmen“ umgestellt.
  Abgeschlossen ist der Wechsel erst, wenn `data_basis` und
  `dataBasis.requested` den neuen Wert tragen und ein neues
  `state.valuation`-Objekt vorliegt.
* Jede Ansicht wird per echtem Mausklick auf ihren Reiter geöffnet
  (`switchTab` → `render…`). Gelesen wird erst, wenn eine vor dem Klick gesetzte
  unsichtbare Markierung durch das Neurendern verschwunden ist. Das Skript
  wartet dabei nicht auf feste Zeiten.
* Die Texte werden je Schritt gespeichert (`fy`, `ttmView`, `fyReturn`) und
  mit dem Engine-Ausweis abgeglichen (`checks`). Verglichen werden die Basis
  und der Zeitraum in den Ansichten „Bewertung“ und „Annahmen“, die
  DCF/RIM-Basiswerte, sichtbare Modellsperren sowie Basisangabe, Periode und
  Reverse-DCF-Wert im Markt-Vergleich.
* Eine Abweichung ergibt Exit 1.
* Die SHA-256 der Fundamentaldaten wird nach dem Import und am Ende verglichen.

**Neu:**
* `tests/real-data/replay-import.browser.test.mjs` mit 7 Tests;
* npm-Skript `test:audit-tool`.

Die Tests starten das echte Skript als Prozess gegen zwei synthetische Filer in
einem Temp-Verzeichnis. Das Browserprofil ist frisch, es gibt keine externen
Abrufe.
* SYNTR hat Quartalsdaten: FY 1000/250 bis 2024-12-31, TTM 1375/343,75 bis
  2025-09-30.
* SYNTN hat nur 10-K-Angaben und damit kein TTM.

Die Tests gehören nicht zu `npm test`, weil sie Chromium brauchen.

**Nachweis, dass die Tests die Fehler erkennen.** Die Tests liefen mit
`REPLAY_SCRIPT=…` gegen:
* die Fassung von `11c32fa`: Exit 1, 6 von 7 Tests rot. Die Meldungen lauten
  u. a. „Umsatz TTM: 1000“ und „TTM-Marktansicht nennt TTM: Markt-Vergleich …
  Letztes Geschäftsjahr (FY) · 2024-12-31“;
* eine Mutante mit Feldern wieder aus `state.masterJson`: Exit 1, nur der
  TTM-Erfassungstest rot („Umsatz TTM: 1000“);
* eine Mutante, die ohne Neurendern liest: Exit 1, der Ansichtentest rot. Auch
  der Selbstabgleich des Skripts meldet `ABWEICHUNG` für die TTM-Bewertungs-
  und Marktansicht.

Die Kopien lagen nur vorübergehend im Arbeitsbaum und sind nicht committet.

**Nach der Reparatur ausgeführt:**

| Befehl | Ergebnis | Exit |
|---|---|---|
| `npm run test:audit-tool` | 7/7 | 0 |
| `npm test` | 1700 Assertions (434 Fixture), 206/206 Node-Tests | 0 |
| `npm run test:browser` | 158/158 | 0 |
| `node tests/real-data/replay-import.mjs --selftest` | Abgleich 40/40 | 0 |
| `node tests/real-data/repro-findings.mjs` | 5 von 5 Befunden bestehen (unverändert) | 0 |

**Einschränkungen:**
* **Kein erneuter Realdatenabgleich.** Die SEC-Rohdaten (`cache/`) sind nicht
  versioniert und in dieser Sitzung nicht vorhanden. Nach Aktenlage hat das
  Tool für MCD und JNJ kein TTM gebildet. Dann lief der fehlerhafte TTM-Zweig
  nicht, und die Ansichten stammten aus dem Rendern nach dem Import. Die
  Befunde F-1 bis F-5 sind davon also voraussichtlich nicht betroffen.
  Bestätigt ist das erst mit D3.
* Die Einheit einer TTM-Größe ist die Berichtseinheit der TTM-Datenbasis. Eine
  Quelleinheit je Feld hat die TTM-Sicht nicht. Das Werkzeug weist das als
  fehlend aus und ergänzt nichts.
* Abgeleitete TTM-Größen (EBITDA, FCF, Nettoschulden) tragen selbst weder Tag
  noch `filed`. Beides steht nur bei ihren Bestandteilen
  (`components.derivedFrom`).
* FY-`eps_diluted` hat im synthetischen Fall keine Periodenmetadaten. Das wird
  als fehlend ausgewiesen.
* Der Abgleich prüft Textinhalte, keine visuelle Darstellung. Die Übersicht wird
  erfasst, aber nicht auf die Basis geprüft. Sie nennt keine Datenbasis.
* Die Einordnung der Übersicht wechselt im synthetischen Fall zwischen FY und
  TTM („Prüfzone“ bzw. „gesperrt“). Das wurde nicht untersucht, weil es nicht
  zum Auftrag gehört.

**Übergabe an D2 (Produktkorrekturen).** Die Reihenfolge bleibt wie im Bericht
§7: F-2, F-1, F-4, F-3, F-5, danach I-1 mit P-1. Keine dieser Korrekturen ist
vorgezogen. Vor und nach jeder Korrektur laufen:
* `node tests/real-data/repro-findings.mjs`;
* `npm test`;
* `npm run test:browser`;
* `npm run test:audit-tool`.

Nach F-3 kann bei MCD erstmals TTM entstehen. Dann greift der reparierte
TTM-Zweig des Werkzeugs. D3 wiederholt danach den Realdatenlauf mit dem
reparierten Werkzeug. Chat D bleibt bis D3 offen.

---

## Folgechat D: Realdaten-Audit MCD / JNJ (Stichtag 2026-09-24)

**Ausgangsstand.** `main` = `8b42fea` (V1.0.70). Auditbranch
`claude/audit-real-data-mcd-jnj`. Die Produktdatei ist **unverändert**. Keine
`AGENTS.md`. Der erste Lauf war am Netz gescheitert; nach Freigabe von
`data.sec.gov` und `www.sec.gov` wurde das Audit vollständig durchgeführt.

**Geprüft.** MCD 10-K FY2025 (`0000063908-26-000035`) und JNJ 10-K FY2025
(`0000200406-26-000016`), jeweils über den produktiven Importweg
(`secFetchAll` → `secConfirmImport`, im Browser mit gespeicherten SEC-Dateien)
und abgeglichen gegen GuV, Bilanz, Kapitalflussrechnung und Anhang. Details:
`AUDIT-REAL-DATA-MCD-JNJ.md`.

**Korrekt übernommen:**
* MCD und JNJ: Umsatz, CFO, CapEx, FCF, Liquidität, EPS, DPS, Ø verwässerte
  Aktien [0], Eigenkapital bzw. Buchwert;
* MCD: Operating Income, Finance-Leasing;
* JNJ: D&A.

**Bestätigte Fehler** (Reproduktion: `node tests/real-data/repro-findings.mjs`,
5 von 5 bestehen):
* **F-1:** MCD-D&A aus falschem Tag (457 statt 2,199), dadurch EBITDA −12 %.
* **F-2:** Der Jahresschlüssel nach Kalenderjahr verliert bei 52/53-Wochen-Jahren
  ein Geschäftsjahr (JNJ FY2022) und kürzt die Historie.
* **F-3:** Quartalsabgleich ohne Rundungstoleranz, dadurch kein MCD-TTM.
* **F-4:** Gemischt skalierte MCD-Aktienreihe, dadurch „Net Share Issuance
  −100 %“.
* **F-5:** Lease-bereinigter ROIC paart per Index statt per Periode.

**Berechtigte Sperren:**
* MCD DCF-Brücke: Die Schulden-Tags widersprechen sich. Die richtige
  Aufteilung steht nur im Anhang.
* MCD RIM: negatives Eigenkapital.
* JNJ: Finance-Leasing ohne Betrag.

Der JNJ-DCF fehlt, weil der Zinsaufwand als `InterestExpenseNonoperating`
getaggt ist und diesen Tag der Import nicht kennt (I-1). Die Behebung braucht
eine fachliche Entscheidung, siehe Bericht §4.

**Neu:**
* `tests/real-data/fetch-sources.mjs`, `replay-import.mjs`, `repro-findings.mjs`;
* `tests/real-data/excerpts/` (wortgetreue Auszüge, zusammen rund 64 KB);
* README.

Tests: `npm test` mit 1700 Assertions (434) und 206 Tests, Exit 0.
`npm run test:browser` 158/158.

**Nächster Schritt.** Korrekturaufträge in der Reihenfolge von Bericht §7:
F-2, F-1, F-4, F-3, F-5, danach I-1 mit P-1. Bei jedem Auftrag vorher und
nachher `repro-findings.mjs` ausführen.

---


## Folgechat C: Freigabe nach `main` (V1.0.70)

**Freigegebene Version: V1.0.70** (Entwicklungszaehlung dieses HANDOFF).
Das sichtbare UI-Badge zeigt weiterhin `V1.0.35-base-rate-lite`
(`ENGINE_VERSION`/`DISPLAY_VERSION` bewusst nicht gebumpt, da Fixtures die
Kennung exakt pinnen) — das ist kein abweichender Stand.

**Art des Stands: Analyseprototyp.** Alle Pruefungen beruhen auf
synthetischen Daten. **Reale Abschlussdaten wurden noch nicht systematisch
abgeglichen**; das ist Aufgabe von „Folgechat D — reale Unternehmensdaten
pruefen" und keine Zusicherung der Richtigkeit fuer reale Unternehmen.

| | |
|---|---|
| Starten | `us-aktienbewertungstool-v1036-sector-classification-patch.html` direkt im Browser oeffnen (einzelne Datei, kein Build) |
| Automatisierte Tests | `npm test` (Node ≥ 20; beide Suiten: Rechen-/Regressionstests und `node --test tests/*.test.mjs`) |
| Browser-Smoke-Test | `npm run test:browser` (Node ≥ 22, lokales Chromium/Chrome, ggf. `CHROME_PATH`; Details `tests/browser/README.md`) |
| CI | GitHub Actions „Rechentests" (`.github/workflows/tests.yml`) fuehrt `npm test` aus, nicht die Browser-Abnahme |

**Freigabepruefung** auf `claude/loving-newton-hcpo71` =
`f19f81d017fe3503842d941413f2433d16b9f4b6` (Produktdatei-Blob
`ac0ae781…` identisch mit dem browsergeprueften Commit `0397737`; danach
nur HANDOFF geaendert). `main` (`b023dc8`) ist Vorfahr, ohne eigene
Aenderungen. Selbst ausgefuehrt: `npm test` — 1700 Rechen-Assertions (434
Fixture), 206 Node-Tests, beide Exit 0; `npm run test:browser` — 158/158
bestanden, Exit 0 (Chromium 141, Node v22.22.2, sauberer Arbeitsbaum).
GitHub Actions auf `f19f81d`: erfolgreich. Kein dokumentierter offener
Blocker; die bekannten Grenzen (Abschnitte B.1 §6, B §7) bestehen fort.

---


## Folgechat B.1: Datumsvalidierung der EV/EBITDA-Bruecke (V1.0.70)

**Ausgangsstand.** Branch `claude/loving-newton-hcpo71`, nach `git fetch`
HEAD = `origin/claude/loving-newton-hcpo71` =
**`e5e8b0267a4dd04936ef3ea55193208a787894b3`** (keine Nachfolgecommits),
Arbeitsbaum sauber, keine `AGENTS.md`. `main` (`b023dc8`) unberuehrt.

**Baseline selbst ausgefuehrt auf `e5e8b02`:** `npm test` — 1700
Rechen-Assertions (darin 434 Fixture-Assertions), Exit 0; 205 Node-Tests,
Exit 0. `npm run test:browser` — 148/148 bestanden, Exit 0.

### 1 · Fehler und Reproduktion

`_resolveMultiplesEvBridge()` hielt eine Periode fuer lesbar, sobald
`new Date(p)` ein Datum lieferte. JavaScript normalisiert unmoegliche Tage
(`"2025-02-30"` → 2. Maerz). Gemessen auf `e5e8b02` ueber
`computeRelativeMultiplesFV()` (EBITDA 250, Multiple 10, 100 Aktien,
`net_debt[0] = 900`):

| EBITDA-Periode | Bruecke (`net_debt`) | `e5e8b02` | V1.0.70 |
|---|---|---|---|
| `2025-02-30` | `2025-03-02` | **frei, 16 USD** | gesperrt |
| `2025-04-30` | `2025-04-31` | **frei, 16 USD** | gesperrt |
| `2023-02-28` | `2023-02-29` | **frei, 16 USD** | gesperrt |
| `2100-02-28` | `2100-02-29` | **frei, 16 USD** | gesperrt |
| ohne Metadaten | `2025-02-30` | **frei, 16 USD** | gesperrt |
| `2025-12-31` | `2025-12-32` / `-00` / `2025-13-31` / `31.12.2025` | gesperrt | gesperrt (jetzt mit Kalendergrund) |
| `2025-12-31` | `2025-6-30` / `2025` | gesperrt (nur wegen Abstand) | gesperrt (Kalendergrund) |
| `2024-02-29` | `2024-02-29` | frei, 16 USD | frei, 16 USD |

Im Browser auf `e5e8b02`: Markt-Vergleich zeigte fuer den 30. Februar
„16.00" ohne Sperrgrund.

### 2 · Unterstuetzte Periodenformate (vor der Aenderung geprueft)

* Produktiver SEC-Import: `meta.periods = sorted.map(e => e.end)` — das
  SEC-`end`-Feld, stets `JJJJ-MM-TT`. TTM-Sichten ebenso (`2025-09-30`).
* Manuelle/Altdaten im Repository: `periods: null` (gilt als metadatenfrei),
  `"n/a"`, und die Jahreszahl `'2024'`/`'2023'` nur in den In-Page-Tests
  GT-6a/b (Schulden-Fallback; sie beruehren die EV-Bruecke nicht und bestehen
  unveraendert). Kein anderes Format im Produkt, in Fixtures oder Tests.

### 3 · Korrektur (eng)

In `_resolveMultiplesEvBridge()` gilt eine Periode nur noch als Stichtags-
nachweis, wenn sie ein **gueltiges Kalenderdatum im Format `JJJJ-MM-TT`**
ist. Dafuer wird die vorhandene, unveraenderte Funktion `parseIsoDate()`
(UTC, Rueckrechnungspruefung, bisher im SEC-Quartalsnormalisierer) benutzt;
**keine gemeinsame Datumsfunktion wurde geaendert** (`_secPeriodDaysApart`,
`_ttmParseIso` unberuehrt; R52 sichert `_secPeriodDaysApart` = 45 Tage und
`parseIsoDate` fest). Sperrgruende nennen den gemeldeten Wert und „kein
gueltiges Kalenderdatum im Format JJJJ-MM-TT". Unveraendert: 45-Tage-
Toleranz, Ausnahme fuer vollstaendig metadatenfreie Altdaten, keine
Uebernahme fremder Stichtage, kein Ersatzbetrag, DCF-Formeln, gemeinsame
Nettoschuldenaufloesung, P/E- und P/FCF-Regeln. Der operative EV bleibt
sichtbar.

**Bewusste Verhaltensaenderung:** Eine reine Jahreszahl (`'2024'`) oder ein
Datum mit Uhrzeit ist kein Stichtag im unterstuetzten Format und sperrt die
Bruecke jetzt auch dann, wenn beide Seiten dasselbe Jahr tragen (bisher
Abstand 0 Tage ⇒ frei). Kein produktiver Weg liefert solche Angaben.

In der Zulaessigkeitsmatrix von Folgechat B bedeutet „datiert (lesbar)" ab
V1.0.70 „gueltiges Kalenderdatum `JJJJ-MM-TT`".

### 4 · Tests

| Test | Inhalt |
|---|---|
| `R52` (neu) | 30.02./02.03. inkl. echtem Pfad Engine → State → `renderValuation`/`renderMarket` (kein 16.00, Sperrgrund mit `2025-02-30`, EV 2500.0M); ungueltige Tage (31.04., 29.02.2023/2100, Tag 0/32), Monate 0/13, Fremdformate, Jahreszahl; ungueltiges Datum bei metadatenfreier Gegenseite (beide Richtungen); gueltige Daten inkl. Schalttag 2024-02-29 und 2000-02-29, Schalttag gegen 31.03., abweichendes GJ-Ende; 45 Tage frei / 46 gesperrt; `null`/`"n/a"` gesperrt; metadatenfreie Altdaten 16 USD; P/E 30 und P/FCF 60 unberuehrt |
| Browser | zwei neue Faelle in Abschnitt 1: `2025-02-30`/`2025-03-02` (Import, Markt-Vergleich „nicht ableitbar" mit Sperrgrund und EV 2500.0M, Fallback-Karte, Zustand) und Gegenprobe Schalttag `2024-02-29` (16.00 frei) |

**Bestehende Erwartungen: keine angepasst.** R1–R51 unveraendert gruen.

**Gegenprobe** (temporaerer `git worktree` auf `e5e8b02` mit den neuen
Testdateien, danach entfernt): `R52` scheitert („2025-02-30 / 2025-03-02:
freigegeben (16)"), 57 uebrige Audit-Tests bestehen; Browser-Abnahme
**153/158, 5 fehlgeschlagen** — genau der neue Fall (16.00 freigegeben).

**Nach der Korrektur** (je ein Lauf): `npm test` — **1700
Rechen-Assertions (darin 434 Fixture), Exit 0; 206 Node-Tests, Exit 0**
(205 → 206 durch R52). Browser-Abnahme: siehe Abschnitt 5.

### 5 · Gepruefter Produktstand

Produktdatei-Blob **`ac0ae781bd4d2de9478143dda4735075b8d9a7e9`**.
**Abnahmelauf auf dem sauberen Commit `0397737b45a2b611e3d1fe88ccb1b965ccb23311`**
(`npm run test:browser`, Chromium 141.0.7390.37 headless, Node v22.22.2,
Arbeitsbaum ohne lokale Aenderungen): **158 Pruefungen · 158 bestanden · 0
fehlgeschlagen, `ERGEBNIS: BESTANDEN`, Exit 0.** Der Folgecommit aendert nur
diese Dokumentation (Produktdatei-Blob unveraendert).

### 6 · Verbleibende Grenzen

* Nur synthetische Daten; kein Abgleich mit echten Filings.
* Die Kalenderpruefung gilt fuer die EV/EBITDA-Bruecke. Andere Verbraucher
  von `new Date(...)`-Perioden (u. a. `_secPeriodDaysApart` in
  `_joinPeriodKeyed`) wurden nicht umgestellt; sie verarbeiten SEC-Daten, die
  nur gueltige `end`-Daten enthalten.
* Uebrige Grenzen aus Folgechat B bestehen unveraendert.

### 7 · Uebergabe an „Folgechat C — main aktualisieren"

Grundlage ist die Spitze von `claude/loving-newton-hcpo71` (Produktstand `0397737`).
Vor dem Aktualisieren von `main` erwartet: `npm test` 1700 (434) + 206,
`npm run test:browser` 158/158, jeweils Exit 0. Die Angabe „148/148" in
Folgechat B ist damit ueberholt.

---

## Folgechat B: Browser-Abnahme und Periodenrestluecke der EV-Bruecke (V1.0.69)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Arbeits- und
Ergebnisbranch **`claude/loving-newton-hcpo71`**. Nach `git fetch` stand die
Branch-Spitze auf **`5fdd27ccc74091cfe27aff8408cf6bd99c81a7ee`** (V1.0.68,
Folgechat A = Korrekturchat 12F); Referenzvorfahr `60fc159` ist Vorfahr,
Arbeitsbaum sauber. Folgechat A ist abgeschlossen (drei Befunde, `R49`–`R51`,
eigener HANDOFF-Abschnitt). Die Sitzung startete auf dem Hilfsbranch
`claude/stock-tool-browser-acceptance-ykejsj` (= alter `main` `b023dc8`); er
wurde nicht als Arbeitsgrundlage verwendet. Eine `AGENTS.md` existiert
weiterhin nicht. `main` wurde nicht angefasst, kein Merge, kein Deployment.

**Testbaseline vor der Aenderung** (`5fdd27c`, laut 12F und hier fuer
`tests/audit-chat12.test.mjs` nachvollzogen): 1700 Rechen-Assertions (darin
434 Fixture-Assertions), 205 Node-Tests.

---

### 1 · Restluecke in `_resolveMultiplesEvBridge()` (vor der Abnahme behoben)

**Reproduktion auf `5fdd27c`** (synthetisch, produktiver Aufrufweg
`computeRelativeMultiplesFV`; im Browser zusaetzlich ueber Import und
Markt-Vergleich): EBITDA 250 ohne Periodenmetadaten, `net_debt[0] = 900` mit
`_v4_meta.net_debt.periods: ["n/a"]`, Multiple 10, 100 Aktien ⇒ **verfuegbar,
16,00 USD**, Markt-Vergleich „16.00" ohne Periodenwarnung. Ebenso mit
`periods: [null]` und umgekehrt (EBITDA `periods: [null]` bzw. `["n/a"]`,
Bruecke ganz ohne Periodenmetadaten) — alle vier Faelle 16,00 USD.

**Ursache.** V1.0.68 sperrte eine Seite mit Periodenangaben ohne lesbares
Datum nur, wenn die GEGENSEITE ebenfalls Periodenangaben fuehrte; `"n/a"`
galt zudem als „vorhandene Periode" und umging die Pruefung ganz.

**Korrektur (eng).** Jede Seite wird unabhaengig geprueft: Fuehrt sie
Periodenangaben (`_v4_meta.<feld>.periods` oder sonstigen Periodenkontext),
muss sie einen **lesbaren** Stichtag fuer den tatsaechlich verwendeten Betrag
liefern — sonst Sperre mit Begruendung, die die betroffene Seite und den
gemeldeten Wert nennt. Unveraendert: 45-Tage-Toleranz, gemeinsamer
DCF-Resolver `_resolveNetDebtForDcfBridge`, Ausnahme fuer vollstaendig
metadatenfreie Altdaten, kein Ersatzbetrag aus anderen Feldern, kein fremder
Stichtag. Der operative EV bleibt bestimmbar; P/E und P/FCF sind unberuehrt.

**Gueltige Zulaessigkeitsmatrix (V1.0.69):**

| EBITDA \ Bruecke | datiert (lesbar) | Angaben, aber nicht lesbar (`null`, `"n/a"` …) | ohne Angaben (Altdaten) |
|---|---|---|---|
| datiert (lesbar) | Abstand ≤ 45 Tage, sonst Sperre | Sperre | zulaessig |
| Angaben, aber nicht lesbar | Sperre | Sperre | **Sperre** (V1.0.68: zulaessig) |
| ohne Angaben (Altdaten) | zulaessig | **Sperre** (V1.0.68: zulaessig) | zulaessig |

Die Matrix im 12F-Abschnitt ist entsprechend berichtigt und gekennzeichnet.

**Nachweise.** `R49` erweitert: beide Richtungen, jeweils `null` und `"n/a"`
bei vollstaendig metadatenfreier Gegenseite (Zustand, Sperrgrund, EV 2500,
echter `renderMarket()` ohne „16.00" mit Sperrgrund und EV); leeres bzw.
fachfremdes `_v4_meta` bleibt Altdaten (16 USD); datiertes EBITDA mit
`net_debt` `"n/a"` gesperrt; P/E 30 und P/FCF 60 unberuehrt. Gegenprobe in
einem temporaeren `git worktree` auf `5fdd27c`: **`R49` scheitert**
(„net_debt periods [null]: 16 USD freigegeben"), R42–R48, R50, R51 bestehen;
nach der Korrektur bestehen R42–R51. Die Browser-Abnahme auf `5fdd27c`:
**22 von 146 Pruefungen scheitern** (Skriptstand vor Aufnahme von 7.7b; alle vier neuen Brueckenfaelle zeigen
„16.00", dazu die EV-Anzeige, siehe B-1).

### 2 · Reproduzierbare Browser-Abnahme (neu im Repository)

| | |
|---|---|
| Befehl | **`npm run test:browser`** (= `node tests/browser/acceptance.mjs`) |
| Laufzeit | Node ≥ 22 (eingebautes WebSocket), keine npm-Abhaengigkeit |
| Browser | lokales Chromium/Chrome; `CHROME_PATH` oder Standardpfade (`/opt/pw-browsers/chromium`, `/usr/bin/chromium`, `google-chrome` …) |
| Dateien | `tests/browser/cdp.mjs` (CDP-Treiber), `tests/browser/acceptance.mjs` (Abnahme), `tests/browser/fixtures.mjs` (synthetische Daten), `tests/browser/README.md` |
| Status | `PASS`/`FAIL` je Pruefung; Exit 0 bestanden · 1 fehlgeschlagen · 2 nicht ausfuehrbar |
| Produktstand | im Kopf und am Ende ausgegeben (Git-Commit, Hinweis auf lokale Aenderungen) |
| Isolation | frisches temporaeres Profil und Download-Verzeichnis (danach geloescht); Namensaufloesung gesperrt, Proxy aus, jede nicht-lokale Anfrage per CDP `Fetch` abgewiesen und protokolliert |

`npm test` erhaelt **keine** Browserpflicht (`test/run-all.js` sammelt nur
`tests/*.test.mjs` der obersten Ebene).

### 3 · Was tatsaechlich im Browser ausgefuehrt wurde

Headless **Chromium 141.0.7390.37** (`/opt/pw-browsers/chromium`), Node
v22.22.2, Produktdatei als `file://`-Dokument. Bedienung ueber echte
CDP-Eingabeereignisse (Mausklick auf sichtbare, nicht verdeckte Elemente;
Tastatureingabe; `DOM.setFileInputFiles` auf die echten Datei-Felder; echte
Downloads). Das Auswahlfeld der Datenbasis wird per echtem `change`-Ereignis
bedient (nicht ueber die native Auswahlliste). Zwei ausdruecklich markierte
Zustandseingriffe: Altbestand mit Angriffs-ID direkt im `localStorage` (der
Import weist solche IDs ab) und „Datenbasis ohne Neuberechnung" (die
Oberflaeche rechnet beim Umschalten sofort neu).

1. **EV/EBITDA-Bruecke** (8 Datensaetze ueber die Oberflaeche importiert): die
   vier V1.0.69-Faelle und die 12F-Faelle 1a/1b zeigen im Markt-Vergleich
   „nicht ableitbar" mit Sperrgrund und operativem EV 2500.0M, in der
   Fallback-Karte „gesperrt" mit Grund und EV — kein 16.00/21.00. Gegenproben
   (korrekt datiert; metadatenfreie Altdaten): 16.00 freigegeben.
2. **Multiples vorhanden, Input fehlt** (EV/EBITDA, P/E, P/FCF): Multiple und
   fehlender Input sichtbar, Marke „Input fehlt", keine Aussage „kein eigener
   Multiple-Median"; Gegenfall ohne Multiples behaelt die Aussage.
3. **Nichtpositiver Aktienwert**: −5.00 mit „Ergebnis, kein fehlender Wert",
   kein Median-Referenzwert.
4. **DDM**: undatierte Null ⇒ `dps_median_annualized` mit Hinweis „ohne
   lesbare Berichtsperiode"; ohne belegbare Spanne ⇒ `scenario_capped` mit
   „kein gemessenes Wachstum: Gemeldete Dividende 0 ohne lesbare
   Berichtsperiode …".
5. **Financials**: 2 Darstellungen, 1 unabhaengige Familie, Agreement `n/a`,
   Hinweis „derselben Modellfamilie"; kein Uebereinstimmungssignal.
6. **Snapshot-ID-Angriffe** (drei IDs mit `<img onerror>`, Quote-Ausbruch und
   Attribut-Ausbruch; nur Marker `window.__pwned`/`__accMarker`): Datei-Import
   abgelehnt, Bestand leer; Altbestand als „unbrauchbar" ausgewiesen, weder
   ausgefuehrt noch umgeschrieben; nach Klicks kein Marker, kein `<img>`, kein
   Ereignisattribut.
7. **Zusammenhaengender Ablauf** mit synthetischem TTM-Filer `SYNTB`
   (Quartalsdaten, ueber den produktiven SEC-Aufbereitungsweg in Node
   erzeugt, dann ueber die Textarea importiert): FY 21.00 (2024-12-31) →
   g1 auf 7 % und „Neu berechnen" (DCF steigt, Feld als manuell gefuehrt) →
   TTM 30.38 (2025-09-30), g1 bleibt 7, DCF weicht ab → Snapshot speichern →
   Seite neu laden → „Gespeichertes Ergebnis": Eingaben (g1, Kurs,
   Datenbasis), alle Modellwerte und Synthese (Range, Buy Price, Position,
   Agreement, Gewichte) identisch, Status „Original-Bewertung geladen" →
   veraltetes Ergebnis (Zustandseingriff): keine Zahlen, Hinweis „neu
   berechnen" → Basiswechsel auf dem geladenen Ergebnis: als Neuberechnung
   gekennzeichnet (B-2) → „Neu rechnen (aktuelles Modell)": gekennzeichnet,
   Snapshot unveraendert, gleiche Modellwerte → Snapshot-Export und
   Master-JSON-Export als echte Downloads → ungueltige Importe (`null`,
   Array, kaputtes JSON, ohne Bloecke; Snapshot-Datei mit falscher Struktur,
   unlesbare Datei): abgewiesen, aktiver Datensatz und Bestand unveraendert →
   Loeschen (Abbruch, dann Bestaetigung) → Re-Import der Exportdatei:
   inhaltlich identisch, gleiche Werte → Master-JSON-Export ueber das
   Datei-Feld re-importiert: g1 7, TTM, gleiche Modellwerte → Hard Stop
   „Going Concern": Override mit zu kurzer Begruendung abgewiesen, dann
   aktiv, zweiter Snapshot gespeichert, geladen und geloescht; der andere
   Snapshot bleibt byte-gleich; „Override entfernen" wirkt danach ohne
   Ausnahme und ohne Bestandsaenderung; Dialog erneut oeffnen/abbrechen.
8. **Abschluss**: keine unbehandelte Ausnahme; einzige externe Anfrage war die
   Google-Fonts-Einbindung der Seite (abgewiesen); keine SEC-/Yahoo-Anfrage.

**Ergebnis auf dem Ergebnisstand: 148 Pruefungen, 148 bestanden — Browser-
Abnahme (synthetisch) BESTANDEN.** Exakter Lauf und Commit: Abschnitt 6.

### 4 · Befunde und Behebungen

| # | Befund (reproduziert) | Behebung |
|---|---|---|
| **1a** | Restluecke der Periodenpruefung (Abschnitt 1) | `_resolveMultiplesEvBridge()`: jede Seite unabhaengig; `R49` erweitert |
| **B-1** | Bei gesperrter EV/EBITDA-Bruecke zeigte der **Markt-Vergleich** nur den Sperrgrund, **nicht den operativen EV**. Der EV stand allein in der Fallback-Karte, die bei vorhandenen Intrinsic-Modellen nicht erscheint — dort war er dann nirgends sichtbar. | `renderMarket()`: Hinweis „Operativer Unternehmenswert (EV) bleibt bestimmbar: …M — nur der Wert JE AKTIE ist … nicht ableitbar" (Wortlaut der Fallback-Karte). Nur Anzeige; `R49` und Browser pruefen ihn. |
| **B-2** | Nach „Gespeichertes Ergebnis" rechnete ein **Basiswechsel** (ebenso ein Wechsel der Geschaeftsmodell-Klassifikation) neu, die Oberflaeche behauptete aber weiter „**Original-Bewertung geladen**" und zeigte keinen Neubewertungs-Hinweis. Auf `5fdd27c` gemessen: nach Wechsel auf TTM `_usingCurrentEngine = false`, Status unveraendert. `recalcFromAssumptions()` markierte das schon, setzte das Flag aber erst nach dem Rendern der Uebersicht. | Gemeinsamer Helfer `_markSnapshotRecomputed()` in allen drei Neuberechnungswegen: Flag, Statuszeile („Nach einer Änderung mit dem aktuellen Modell neu berechnet — der Snapshot selbst bleibt unverändert.") und Uebersichts-Hinweis. Snapshot-Bestand unberuehrt (Browser 7.7b). |

Keine Bewertungsmethode umgebaut, keine Rechenformel geaendert.

**Beobachtungen, bewusst NICHT geaendert:**

* **Market-Data-Tabelle (Annahmen-Tab):** Risk-free Rate und ERP werden im
  gespeicherten Rohformat mit „%" angezeigt (synthetischer Datensatz:
  „0.04 %" neben „WACC 9.00 %"). Das Eingabefeld akzeptiert ausdruecklich
  „dez. oder %"; eine Korrektur verlangt eine fachliche Festlegung der
  Einheit und ist kein eindeutiger Kleinfehler.
* **Veraltetes Ergebnis:** Ueber die Oberflaeche entsteht kein gemischter
  Stand, weil das Umschalten sofort neu rechnet. Der Hinweis „neu berechnen"
  wurde deshalb per markiertem Zustandseingriff geprueft.
* **Externe Fonts:** Die Seite bindet Google Fonts ein. Im Test abgewiesen;
  im normalen Betrieb ist das eine externe Anfrage (kein SEC-/Yahoo-Abruf).

### 5 · Tests

* `npm test` (ein Lauf nach allen Produktaenderungen): **1700
  Rechen-Assertions (darin 434 Fixture-Assertions), Exit 0**, und **205
  Node-Tests, Exit 0**. Anzahl unveraendert, weil `R49` erweitert und kein
  neuer Test angelegt wurde.
* `npm run test:browser`: siehe Abschnitt 6.
* Bestehende Erwartungen: keine angepasst.

### 6 · Gepruefter Produktstand und Wiederholung

* Produktdatei `us-aktienbewertungstool-v1036-sector-classification-patch.html`,
  Git-Blob **`0e2439323f2de37fb4d3e078719c7596dee35ac9`** (identisch in allen
  Ergebniscommits dieses Chats).
* **Abnahmelauf auf dem sauberen Commit `ba807fbf204bf86eef2fa222bfcc43cc293af608`**
  (Arbeitsbaum ohne lokale Aenderungen, `npm run test:browser`, Chromium
  141.0.7390.37 headless, Node v22.22.2): **148 Pruefungen · 148 bestanden ·
  0 fehlgeschlagen, `ERGEBNIS: BESTANDEN`, Exit 0.** Abgewiesen wurde nur die
  Google-Fonts-Anfrage; 7 Dialoge (alert/confirm) wurden bedient. Der
  nachfolgende Commit aendert nur diese Dokumentation (Produktdatei-Blob
  unveraendert).
* Wiederholung: **`npm run test:browser`** (Exit 0 = bestanden).

### 7 · Verbleibende Grenzen

* **Nur synthetische Daten.** Kein echtes Filing, kein SEC-/Yahoo-Abruf, kein
  Abgleich mit veroeffentlichten Abschluessen — die Abnahme belegt die
  Bedienpfade und Anzeigen, nicht die Richtigkeit fuer reale Unternehmen.
* Headless Chromium auf Linux, eine Fenstergroesse (1400×1000). Kein Firefox/
  Safari, keine mobile Darstellung, keine visuelle Pruefung (Layout, Farben).
* Native Auswahllisten und Datei-Dialoge werden ueber CDP bedient
  (`change`-Ereignis, `setFileInputFiles`), nicht per Maus.
* Der SEC-Abrufweg (`secFetchAll`, Proxy) ist bewusst nicht Teil der Abnahme.
* Die offenen Punkte aus 12E/12F (EPV deaktiviert, 45-Tage-Toleranz als
  Werkzeugkonvention, DCF-Resolver ohne EBITDA-Stichtag, Verwaesserung usw.)
  bestehen unveraendert.

### 8 · Uebergabe an „Folgechat C — main aktualisieren"

* Grundlage: Branch `claude/loving-newton-hcpo71`, Ergebniscommit dieses
  Chats (Spitze von `claude/loving-newton-hcpo71`; Produktstand `ba807fb`). `main` steht weiterhin auf `b023dc8`.
* Vor dem Aktualisieren von `main` auf dem Zielstand ausfuehren:
  `npm test` (erwartet 1700 + 205, Exit 0) und `npm run test:browser`
  (erwartet 148/148, Exit 0).
* Die Browser-Abnahme ist **synthetisch bestanden**; sie ersetzt keinen
  Abgleich mit echten Unternehmensdaten.

---

## Korrekturchat 12F: drei Restfehler nach V1.0.67 behoben (V1.0.68)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Arbeits- und
Ergebnisbranch **`claude/loving-newton-hcpo71`**. Nach `git fetch` stand die
Branch-Spitze exakt auf dem Referenzcommit
**`60fc1591331057430ca3fb16c3c825ababfec648`** (V1.0.67); es gab KEINE
Nachfolgecommits, der Arbeitsbaum war sauber. Die Sitzung startete auf dem
Hilfsbranch `claude/loving-newton-hcpo71-j1nnmg`, der nur den alten `main`
(`b023dc8`) enthaelt — er wurde nicht verwendet und nicht veraendert; gearbeitet
wurde auf `claude/loving-newton-hcpo71`. `main` wurde nicht angefasst. Eine
`AGENTS.md` existiert in diesem Repository weiterhin nicht. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `60fc159`, ein Lauf
`npm test`): **1700 Rechen-Assertions — darin 434 Fixture-Assertions — und
202 Node-Tests, beide Suiten Exit 0.**

**Auftrag.** Drei unabhaengig bestaetigte Restfehler nach V1.0.67. Kein
Refactoring, keine neue Abhaengigkeit, keine neue Bewertungsmethode.
Importabsicherung, Financials-Modellfamilie und FY-/TTM-Korrekturen bleiben
erhalten; DCF-Formeln und der gemeinsame DCF-Nettoschuldenresolver
(`_resolveNetDebtForDcfBridge`) sind unveraendert; EPV bleibt deaktiviert.

---

### 1 · Reproduktion am unveraenderten Ausgangsstand `60fc159`

Alle Nachweise sind **synthetische Datensaetze ueber die produktiven
Aufrufwege** — keine Live-Validierung, kein reales Filing.

| # | gemessen auf `60fc159` |
|---|---|
| **1a** Bruecke, fremdes Datum | EBITDA 250 (31.12.2025), Multiplikator 10, 100 Aktien; `net_debt[0] = 900` mit `_v4_meta.net_debt = { periods: [null], source_type: 'reported' }`; `total_debt[0] = 500`, `cash[0] = 100` je 31.12.2025 ⇒ **verfuegbar, 16 USD/Aktie, Quelle `net_debt[0]`, `netDebtPeriod` 2025-12-31** — das Datum stammte aus `total_debt`, das zur Rechnung nichts beitrug. |
| **1b** Bruecke, EBITDA undatiert | EBITDA mit `periods: [null]`, `net_debt[0] = 900` zum 31.12.2025 ⇒ **verfuegbar, 16 USD/Aktie** — die Kompatibilitaetspruefung wurde uebersprungen, weil `ebitdaPeriod` null war. |
| **2** DDM, undatierte Null | DPS `[1.12, 1.10, 0, 1.06, 1.04, 1.02, 1.00]`, Perioden 2026…2020 (je 31.12.). Mit datierter Null: `dps_median_annualized` 1,9419306184 %. Nur das Datum der Null entfernt ⇒ **`dps_cagr_6y` 1,9067623061 %** — der Datenpunkt wurde verworfen und das CAGR lief ueber die Unterbrechung. |
| **3** Multiples | `ev_ebitda_10y = 10` ohne EBITDA; `pe_10y = 15` ohne EPS; `p_fcf_10y = 20` ohne Aktienanzahl ⇒ Modelleintrag **ohne `multiple`**, `buildValuationFallback()` zeigte jeweils **„Es ist kein eigener Multiple-Median … hinterlegt."** |

### 2 · Was geaendert wurde

**Befund 1 — `_resolveMultiplesEvBridge()`: Betrag, Quelle und Periode aus
derselben Angabe.** Die Zeile
`res.period || _period0('net_debt') || _period0('total_debt')` ist entfallen.
Der Periodennachweis beschreibt jetzt ausschliesslich die Angabe, deren
Betrag verwendet wird:

* Quelle `net_debt[0]` ⇒ nur `_v4_meta.net_debt.periods[0]`;
* period-keyed `total_debt − cash` ⇒ die Periode der Verknuepfung
  (`res.period` aus `_joinPeriodKeyed`);
* Indexpfad ohne Periodenkontext (manuelle Altdaten) ⇒ keine Periode.

Die Pruefung ist **symmetrisch**. Jede Seite (EBITDA; Bruecke) ist entweder
datiert, fuehrt Periodenangaben ohne lesbares Ende (`periods` vorhanden, auch
`[null]`, oder sonstiger Periodenkontext der Datenaufbereitung) oder fuehrt gar
keine Periodenangaben (Altdaten):

| EBITDA \ Bruecke | datiert | Angaben, aber undatiert | ohne Angaben |
|---|---|---|---|
| datiert | Abstand ≤ 45 Tage, sonst Sperre (unveraendert) | **Sperre** | zulaessig (unveraendert) |
| Angaben, aber undatiert | **Sperre (neu)** | **Sperre (neu)** | ~~zulaessig~~ → **Sperre (V1.0.69)** |
| ohne Angaben | zulaessig (unveraendert) | ~~zulaessig~~ → **Sperre (V1.0.69)** | zulaessig (unveraendert) |

> **Berichtigt in Folgechat B (V1.0.69).** Die beiden durchgestrichenen
> Felder waren in V1.0.68 als „zulaessig" umgesetzt und hier so beschrieben.
> Das war falsch: Eine Seite, die Periodenangaben fuehrt, aber kein lesbares
> Datum belegt, wurde nur gesperrt, wenn auch die Gegenseite
> Periodenangaben fuehrte. Gemessen auf `5fdd27c`: EBITDA ohne Metadaten,
> `net_debt[0] = 900` mit `periods: ["n/a"]` bzw. `[null]` ⇒ **16,00 USD
> freigegeben**, im Markt-Vergleich ohne Periodenwarnung; ebenso umgekehrt.
> Seit V1.0.69 wird jede Seite unabhaengig geprueft. Die gueltige Matrix
> steht im Abschnitt „Folgechat B" oben.

Es wird kein Datum eines unbenutzten Feldes uebernommen und **kein Betrag
ersatzweise aus anderen Feldern gebildet** (im Fall 1a entsteht also NICHT
stillschweigend 21 USD aus 500 − 100). Das Ergebnis traegt zusaetzlich
`periodField` (am Modell `netDebtPeriodField`). Der DCF-Resolver
`_resolveNetDebtForDcfBridge` wurde **nicht** geaendert — seine Rueckgabe fuer
alle bestehenden Verbraucher ist identisch (in `R49` festgehalten).

**Befund 2 — DDM: undatierte Null-Dividenden bleiben Information.**
`_ddmDpsObservations()` verwirft eine gemeldete `0` ohne lesbare Periode nicht
mehr stillschweigend, sondern fuehrt sie in `undatedZeros` (Platz in der
gemeldeten Reihe, **keine Jahreszahl**). `_deriveDdmGrowthInputs()` schliesst
jede Wachstumsspanne — CAGR-Horizont wie Einzelintervall des annualisierten
Medians — aus, deren beide Endpunkte den Platz der undatierten Null
einschliessen; die Zulaessigkeit einer solchen Spanne ist nicht belegbar.
Spannen, die den Platz nicht einschliessen, bleiben nutzbar. Grundlage ist
allein die gemeldete Reihenfolge, deren datierte Werte bereits nachweislich
rueckwaerts laufen muessen; der Null wird kein Jahr zugeordnet.

* Jede Ausschliessung steht als Klartext in `g1Note`/`g1DpsNotes`,
  maschinenlesbar in `g1DpsUndatedZeros` und `g1DpsUndatedExcludedSpans`
  (am Modell `_debug_g1DpsUndatedZeros`, `_debug_g1DpsUndatedExcludedSpans`).
* Bleibt keine Spanne uebrig, nennt `g1HistoryUnavailable` die undatierte
  Null als Grund; die Ersatzkette (Szenario/Default) behaelt Quelle und
  Grund bis zur Modellwarnung „g1 ist KEIN gemessenes Wachstum …" und zur
  DDM-Anzeige („kein gemessenes Wachstum: …").
* Eine echte fehlende Zahl (`null`) ist weiterhin kein Datenpunkt und keine
  Unterbrechung. Manuelle Wachstumsannahmen, Kappungen und die bestehende
  Annualisierung sind unveraendert.

Gemessen: Das Gegenbeispiel mit undatierter Null liefert jetzt dasselbe wie
mit datierter Null — `dps_median_annualized`, **1,9419306184 %**, im
Engine-Pfad bit-gleicher DDM-Basiswert.

**Befund 3 — Multiple vorhanden ≠ Vergleichswert berechenbar.**
`computeRelativeMultiplesFV()` fuehrt beides getrennt: `multiplePresent` und
`multiple` bleiben auch am nicht verfuegbaren Eintrag erhalten, `missingInputs`
nennt den tatsaechlich fehlenden Input (`ebitda[0]`, `eps_diluted[0]`,
`fcf[0]`, `shares_diluted[0]` — einzeln statt „A oder B fehlt"). Neu am
Ergebnis: `presentCount`, `inputMissingCount` (bei Basis-Mismatch `null`).

* `buildValuationFallback()`: die Aussage „kein eigener Multiple-Median …
  hinterlegt" erscheint nur noch, wenn tatsaechlich kein Multiple vorliegt;
  sonst zeigt die Karte das Modell mit Marke „Input fehlt", dem Multiple und
  dem fehlenden Input.
* `renderMarket()`: dieselbe Unterscheidung — die Zeile erscheint mit
  „nicht ableitbar" und dem fehlenden Input statt „Keine eigenen
  Multiples-Mediane … eingetragen". Multiples werden dort sicher formatiert.
* **Median, `hasAny`, `availableCount`, Synthesegewichtung und der Ausschluss
  nichtpositiver Werte sind unveraendert.**

### 3 · Tests

| Test | sichert ab |
|---|---|
| `R49` (neu) | Befund 1: beide Gegenbeispiele; beide Seiten undatiert; korrekt datierte direkt gemeldete Nettoschulden (16 USD, Periode und Quelle passend); Datum des verwendeten Betrags entscheidet; korrekt abgeleitete period-keyed Nettoschulden (21 USD); Altdaten ohne Periodenangaben (beide Richtungen); Null- und Nettoliquiditaetsfaelle; echter `renderMarket()`; DCF-Resolver unveraendert |
| `R50` (neu) | Befund 2: datierte Null, undatierte Null (`null` und unlesbar), echte fehlende Zahl, Null ausserhalb der verwendeten Spanne, keine belegbare Spanne ⇒ Ersatzkette mit Grund, manuelle Annahme, Kappung; **echter DDM-Engine-Pfad** (`runValuationEngine` → `_applyValuationResult` → `renderValuation`) in zwei Varianten |
| `R51` (neu) | Befund 3: sechs Faelle „Multiple vorhanden, Input fehlt" (EV/EBITDA, P/E, P/FCF) ueber Engine → State → Fallback-Karte und `renderMarket()`; Gegenfall ohne Multiples; gemischte verfuegbare/nicht verfuegbare Modelle mit unveraendertem Median; nichtpositiver Wert bleibt ausgeschlossen |

**Bestehende Erwartungen: keine angepasst.** Eine Zwischenfassung der neuen
Sperrbegruendung hatte den in `R47` geprueften Wortlaut „nicht bestimmbar"
geaendert; statt die Erwartung anzupassen, wurde der etablierte Wortlaut im
Produktcode beibehalten. `R1`–`R48` und alle Fixture-Pruefungen bestehen
unveraendert.

**Gegenprobe (ausserhalb des Arbeitsstands, nicht committet).** Die neue
Testdatei wurde in einem temporaeren `git worktree` auf `60fc159` ausgefuehrt
(`R42`–`R51`): **`R49`, `R50`, `R51` schlagen dort fehl, `R42`–`R48`
bestehen** (`# tests 10 · # pass 7 · # fail 3`). Zusaetzlich wurden dort per
Einmalskript alle Gegenbeispiele aus Abschnitt 1 nachgemessen (16 USD mit
Datum 2025-12-31 in 1a und 1b; `dps_cagr_6y` 1,9067623061 %; Fallback-Text in
allen drei Multiple-Faellen). Worktree und Skripte wurden danach entfernt.

**Testergebnis nach der Aenderung** (ein Lauf `npm test`): **1700
Rechen-Assertions (darin 434 Fixture-Assertions), Exit 0** und **205
Node-Tests, Exit 0**. Node-Tests 202 → 205 (+3).

### 4 · Verbleibende Grenzen

* **Browserpruefung in diesem Chat NICHT durchgefuehrt.** Geprueft wurde der
  echte Renderer-Code in Node (HTML-Strings aus `renderValuation`,
  `buildValuationFallback`, `renderMarket`), nicht die Darstellung im Browser.
* Die Zuordnung einer undatierten Null zu Spannen stuetzt sich auf die
  **gemeldete Reihenfolge** der DPS-Reihe (bei datierten Werten ist sie
  nachweislich rueckwaerts laufend). Eine undatierte Null, deren Platz in der
  Reihe selbst falsch waere, kann das Werkzeug nicht erkennen.
* Nettoschulden, die direkt gemeldet, aber undatiert sind, sperren die
  EV/EBITDA-Bruecke jetzt auch dann, wenn daneben datierte Schulden- und
  Liquiditaetswerte vorliegen — bewusst, weil kein Ersatzbetrag gebildet wird.
  Ob dieser Fall im SEC-Importpfad auftreten kann, wurde nicht untersucht.
* Der DCF-Resolver prueft weiterhin keinen EBITDA-/Bilanzstichtag (er kennt
  keinen EBITDA-Zeitraum); das war nicht Gegenstand dieses Auftrags.
* **Abgleich mit echten veroeffentlichten Abschluessen steht weiterhin aus.**
* **EPV bleibt deaktiviert**; seine Altprobleme (`|| 0`-Rueckfaelle in
  `modelEpvFloor()`, Maintenance-CapEx ohne D&A-Gegenbuchung) sind vor einer
  Reaktivierung zu beheben und wurden nicht angefasst.
* Die uebrigen offenen Punkte aus 12E (45-Tage-Toleranz als
  Werkzeugkonvention, interpoliertes Inline-Ereignisattribut, Verwaesserung,
  Synthese-Heuristik, RIM-Periodenkompatibilitaet usw.) bestehen unveraendert.
* `main` (`b023dc8`) fuehrt weiterhin den urspruenglichen Stand.

### 5 · Uebergabe an „Folgechat B — Browser-Abnahme"

Stand fuer die Abnahme: Branch `claude/loving-newton-hcpo71`, Ergebniscommit
dieses Chats (V1.0.68). Vorgeschlagene Pruefungen im vorinstallierten Chromium
(`file://`-Dokument, Import ueber `importMasterJsonFromTextarea()`, keine
externen Requests), jeweils gegen `60fc159` und V1.0.68:

1. **Bruecke 1a/1b** (Datensaetze wie in `R49`): Markt-Vergleich und
   Fallback-Karte zeigen fuer EV/EBITDA „nicht ableitbar"/„gesperrt" mit Grund
   und operativem EV — **kein 16,00 und kein 21,00**. Gegenprobe korrekt
   datierter Nettoschulden: 16,00 mit Quelle `net_debt[0]`.
2. **DDM undatierte Null** (Datensatz wie in `R50`, Engine-Teil): DDM-Karte
   zeigt `dps_median_annualized`, 1,94 %, und den Hinweis „ohne lesbare
   Berichtsperiode"; Variante ohne belegbare Spanne zeigt „kein gemessenes
   Wachstum: Gemeldete Dividende 0 ohne lesbare Berichtsperiode …".
3. **Multiples** (Datensaetze wie in `R51`): Fallback-Karte mit Marke „Input
   fehlt", Multiple und fehlendem Input; kein „kein eigener Multiple-Median";
   Gegenfall ohne Multiples zeigt diese Aussage weiterhin.
4. Stichprobe, dass FY/TTM-Anzeige, Import-Absicherung und Financials-Familie
   unveraendert wirken.

**Keine Zusicherung der Fehlerfreiheit.** Die Auditgrenzen der vorherigen
Korrekturchats bleiben bestehen.

---

## Korrekturchat 12E: drei Restluecken nach V1.0.66 geschlossen (V1.0.67)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Arbeits- und
Ergebnisbranch **`claude/loving-newton-hcpo71`**, Ausgangscommit
**`f44abc03d1c67394c6f58979162d42ec4c157848`** (V1.0.66) — zugleich die
Branch-Spitze; nach `git fetch` gab es KEINE Nachfolgecommits
(`git log f44abc0..origin/claude/loving-newton-hcpo71` war leer), der
Arbeitsbaum war sauber. `main` (`b023dc8`) wurde nicht angefasst. Eine
`AGENTS.md` existiert in diesem Repository nicht. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
`npm test` (= `node test/run-all.js`) fuehrt beide Suiten aus; es wurde
deshalb je Abnahme nur EIN Gesamtlauf gestartet.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `f44abc0`
ausgefuehrt): **1700 Rechen-Assertions — darin 434 Fixture-Assertions — und
200 Node-Tests, beide Suiten Exit 0.**

**Auftrag.** Drei unabhaengig reproduzierte Restluecken nach V1.0.66. Kein
Refactoring, keine neue Abhaengigkeit, keine Funktionserweiterung. Die
Korrekturen aus V1.0.66 (Importabsicherung, Financials-Modellfamilie,
Schuldenfaelle der EV-Bruecke) bleiben erhalten; DCF-Formeln und nicht
betroffene Modelle unveraendert; EPV bleibt deaktiviert.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Alle Rechennachweise sind **synthetische Datensaetze ueber die produktiven
Aufrufwege** (`importSecFacts` → `resolveDataBasis` →
`buildValuationBasisView` → `runValuationEngine` → `renderMarket` /
`buildValuationFallback`, sowie `_deriveDdmGrowthInputs` und `modelDdm`) —
**keine Live-Validierung, kein reales Filing, kein SEC-/Yahoo-Abruf.**
Ergaenzend wurde im vorinstallierten Chromium geprueft (Abschnitt 5). Der
**Abgleich mit echten veroeffentlichten Abschluessen steht weiterhin aus** und
ist der naechste, eigene Auftrag.

### 2 · Reproduktion am unveraenderten Ausgangsstand `f44abc0`

| # | gemessen auf `f44abc0` |
|---|---|
| **1a** DDM ohne Perioden | DPS `[1.12, 1.10, 1.08, 1.06, 1.04, 1.00]` OHNE Periodenangaben ⇒ `dps_cagr_5y`, **2,2924556626 %**, ohne jeden Hinweis auf einen unbelegten Zeitabstand. `_elapsedYears()` lieferte den Array-Index als Jahresabstand. |
| **1b** Ersatzweg trotz Sperre | Dieselbe Reihe mit ausschliesslich `"n/a"` als Perioden ⇒ CAGR gesperrt, danach trotzdem `dps_median_yoy` mit **1,8867924528 %**. |
| **1c** Median-YoY ohne Periodenabstand | DPS `[1.04, 1.02, 1.00]` zu 2026‑12‑31 / 2024‑12‑31 / 2022‑12‑31 ⇒ **1,9803921568 %** (`cur/prev − 1` ueber benachbarte Array-Plaetze). Annualisiert ergeben dieselben beiden Intervalle **0,9853411216 %**. |
| **1d** Engine-Pfad | DPS `[1.04, 1.02, 1.00, 0, 0.96, 0.94, 0.92]` zu 2026/2024/2022/2020/2018/2016/2014 (je 31.12.) ⇒ Ersatzweg **2,0638297872 %**; der Median der annualisierten gueltigen positiven Intervalle betraegt **1,0266399558 %**. |
| **2a** FY/TTM | Synthetischer Filer mit Quartalsdaten: FY-EBITDA **250M zum 31.12.2024**, TTM-EBITDA **343,75M zum 30.09.2025**, Multiplikator 10, Nettoschulden 400M, 100M Aktien. Engine-Datenbasis **`ttm`**; `renderMarket()` uebergab weiterhin `state.masterJson` ⇒ angezeigt **21,00 USD** (FY) statt **30,375 USD** (TTM), **ohne FY-Kennzeichnung**. Ein Basiswechsel ohne Neuberechnung zeigte Zahlen statt eines Hinweises. |
| **2b** Periodenenden | `_resolveMultiplesEvBridge()` verglich nur `_secPeriodYear`. EBITDA 31.12.2025 gegen Bilanz **31.03.2025** bzw. **30.09.2025** ⇒ jeweils **21,00 USD ohne Warnung**. Umgekehrt wurde ein abweichendes **Geschaeftsjahresende 31.01.2026** faelschlich gesperrt — die Jahreszahl war in BEIDE Richtungen untauglich. |
| **3** Fallback-Anzeige | `buildValuationFallback()` zeigte die Modellanzeige nur bei `fallbackMode === 'relative_multiples' && rel.hasAny`. Mit nur einem gesperrten EV/EBITDA-Modell bzw. nur einem berechneten Wert von **−5,00 USD** erschien stattdessen „Weder Intrinsic-Valuation-Inputs noch historische Multiples verfuegbar." — ohne Grund, ohne den bestimmbaren Unternehmenswert und ohne den berechneten Wert. |

### 3 · Was geaendert wurde

**Restluecke 1 — DDM: Periodenpruefung auf ALLE historischen Wachstumspfade.**
Neu ist `_ddmDpsObservations(f)`. Sie ist die einzige Quelle der Datenpunkte
fuer BEIDE historischen Wege und liefert nur dann eine Zeitreihe, wenn die
Berichtsperioden sie belegen. Sie weist ab: fehlende Perioden, durchgehend
unlesbare Perioden, **doppelte Berichtsjahre** und **nicht durchgehend
rueckwaerts laufende** Reihen — jeweils mit Klartextbegruendung. Teilweise
unlesbare Perioden lassen die uebrigen Punkte gelten und werden als Hinweis
mitgefuehrt.

* Die unbelegte Gleichsetzung „ein Array-Platz = ein Jahr" ist im
  DDM-Wachstumspfad **entfallen**. Ohne belegte Zeit entsteht kein
  historischer Wert.
* Der CAGR-Weg annualisiert unveraendert ueber den TATSAECHLICHEN
  Jahresabstand der beiden verwendeten Berichtsperioden.
* Der frueher „Median-YoY" genannte Ersatzweg heisst jetzt
  **`dps_median_annualized`** und annualisiert **jedes Intervall ueber seine
  wirkliche Laenge**. Das Feld `g1DpsMedianYoy` traegt nur noch dann einen
  Wert, wenn saemtliche verwendeten Intervalle tatsaechlich ein Jahr lang
  sind — sonst waere die Bezeichnung „YoY" schlicht falsch.
* **Die Anzahl der Intervalle wird nicht mehr als Jahreszahl ausgegeben:**
  `g1DpsGrowthYears` ist auf diesem Weg `null`, die Zahl steht getrennt in
  `g1DpsIntervalCount` (mit `g1DpsIntervalSpans`).
* Greift die Ersatzkette (Szenario, Default), bleiben **Quelle UND Grund**
  erhalten: `g1HistoryUnavailable` steht maschinenlesbar am Ergebnis und als
  erster Teil von `g1Note`. Alle spaeteren Zuweisungen an `g1Note` haengen
  ueber `_appendG1Note()` an, statt zu ueberschreiben. Das Modell traegt
  zusaetzlich die Warnung „g1 ist KEIN gemessenes Wachstum (Quelle: …)".
* Gemeldete Null-Dividenden bleiben wirtschaftliche Angaben: sie sperren nur
  die Spannen, die ueber sie hinweg rechnen wuerden, und gelten nicht als
  Datenluecke.
* **Manuelle Wachstumsannahmen und alle Kappungen sind unveraendert**; die
  Kappung wirkt ausdruecklich NACH der Annualisierung.

Gemessen: 1a/1b liefern jetzt `scenario_capped` bzw. `fallback_default` mit
Begruendung statt eines gemessenen CAGR; 1c ergibt **0,9853411215 %**; 1d
ergibt **1,0266399558 %**. Das Sechsjahresbeispiel mit ausdruecklich belegten
Perioden liefert unveraendert **1,9067623060 %** und im Engine-Pfad
**14,223656551734546** USD/Aktie.

**Restluecke 2a — EV/EBITDA folgt der gewaehlten Datenbasis.**
`computeRelativeMultiplesFV(mj, valuation)` nimmt jetzt das Bewertungsergebnis
entgegen und loest die Sicht ueber **`resolveValuationView()`** auf — dieselbe
Funktion, die Haupt-DCF, Sensitivitaetsmatrix, Simulation und Reverse-DCF
verwenden. Es entsteht **keine zweite, parallele Auflosungslogik**, und die
dort bestehenden Regeln gelten unveraendert: eine unvollstaendige TTM-Basis
faellt auf das Geschaeftsjahr zurueck, und eine gespeicherte Bewertung auf
einer ANDEREN Basis (`mismatch`) liefert **gar keine Zahlen**, sondern den
Hinweis, neu zu rechnen (`basisBlocked`, `basisReason`). EBITDA,
Brueckenkomponenten und Aktienbasis stammen damit aus derselben aufgeloesten
Sicht. Alle sechs Aufrufstellen reichen ihren Bewertungszustand durch
(Synthesizer, beide Fehlerzustaende der Engine, `shares_scale_invalid`,
Fallback-Karte, `renderMarket`). Das Ergebnis traegt `basis`, `basisLabel` und
`basisPeriod`; beide Anzeigen nennen sie sichtbar.

**Restluecke 2b — kompatible Periodenenden statt gleicher Jahreszahl.**
`_resolveMultiplesEvBridge()` vergleicht jetzt die tatsaechlichen
Periodenenden mit `_secPeriodDaysApart()` gegen
`MULTIPLES_PERIOD_TOLERANCE_DAYS = 45` — derselbe Wert, den
`_joinPeriodKeyed()` als `maxEndDateSpreadDays` fuer Geschaeftsjahresenden
verwendet; es wurde keine neue Regel erfunden. Zusaetzlich:

* Eine Bilanzangabe, die ausdruecklich als **Zeitraumgroesze**
  (`isFlowConcept: true`) gemeldet ist, traegt keine Stichtagsbruecke.
* **Bekannte Widersprueche verschwinden nicht an fehlenden Metadaten:** wer
  eine `periods`-Angabe fuehrt, muss einen Stichtag belegen. Ist der
  EBITDA-Zeitraum datiert und der Bilanzstichtag trotz vorhandener
  Periodenangabe nicht bestimmbar, wird gesperrt.
* Gueltige ausdrueckliche Nullwerte, Nettoliquiditaet und der
  Altdatenpfad ohne jede Periodenangabe bleiben unveraendert zulaessig.

**Restluecke 3 — Fallback-Anzeige.** Die Modellanzeige haengt nicht mehr an
einem positiven Median, sondern daran, **ob es ueberhaupt etwas zu zeigen
gibt** (`computedCount`, `bridgeBlockedCount` oder ein vorhandenes Multiple).
Gesperrte Modelle nennen ihren Grund und den weiterhin bestimmbaren
operativen Unternehmenswert; ein berechneter nichtpositiver Wert erscheint
mit Betrag und Ausschlussgrund. Die Karte unterscheidet jetzt drei Lagen:
fehlende Multiples (nur hier steht noch „Weder … verfuegbar", jetzt mit dem
konkreten Hinweis auf `market.own_multiples_median`), fehlende
Brueckenkomponenten und berechnete nichtpositive Ergebnisse. **Median,
`hasAny`, Gewichtung und Synthese sind unveraendert** — es wird kein `hasAny`
erzwungen und kein Ersatzwert gebildet.

### 4 · Tests

| Test | sichert ab |
|---|---|
| `R46` (**berichtigt**) | Restluecke 1: belegte Perioden entscheiden; fehlende, unlesbare, doppelte und rueckwaerts laufende Perioden erzeugen kein gemessenes Wachstum; Ersatzkette mit erhaltener Quelle und Begruendung; Median annualisierter Intervallraten samt Intervallanzahl (keine Jahreszahl); „YoY" nur bei echten Jahresintervallen; gemeldete Null; manuelle Annahme; Kappung; echter DDM-Engine-Pfad in drei Varianten |
| `R47` (neu) | Restluecke 2: FY/TTM ueber Importweg, `resolveDataBasis`, Engine UND echten `renderMarket()`; Gegenprobe FY; Basiswechsel ohne Neuberechnung; Periodenenden (passend, Quartalsversatz, Geschaeftsjahres-Toleranz, verschiedene Jahre, unlesbare und teilweise fehlende Stichtage, Zeitraumgroesze); die Schuldenfaelle aus V1.0.66 bleiben erhalten |
| `R48` (neu) | Restluecke 3: nur gesperrtes Modell, nur nichtpositives Modell, gemischt, gar keine Multiples — jeweils ueber `computeRelativeMultiplesFV()` und die echte Fallback-Karte; Median und `hasAny` bleiben unveraendert |

**Begruendete Anpassung einer bestehenden Erwartung.** `R46` schrieb in der
Fassung von V1.0.66 ausdruecklich fest, dass eine DPS-Reihe OHNE
Periodenangaben nach der Altdatenregel „ein Array-Platz = ein Jahr"
ausgewertet werden darf, und erwartete dafuer `dps_cagr_5y` mit
2,2924556626 %. Diese Erwartung war fachlich falsch — sie liess ein als
GEMESSEN ausgewiesenes Fuenfjahres-CAGR entstehen, ohne dass ein Zeitabstand
belegt war. Die Faelle, die einen echten Jahresabstand voraussetzen, tragen
jetzt Periodenmetadaten; der Fall ganz ohne Perioden prueft die berichtigte
Regel. **Die Zahlen der belegten Faelle sind unveraendert** (1,9067623061 %,
14,223656551734546, 14,212416883291723). Sonst wurde **keine** Erwartung
angepasst; `R1`–`R45` und alle Fixture-Pruefungen bestehen unveraendert.

**Gegenprobe (ausserhalb des Arbeitsstands, nicht committet).** `R46`, `R47`
und `R48` wurden in einem separaten Arbeitsbaum auf `f44abc0` ausgefuehrt und
schlagen dort **alle drei** fehl (`# tests 54 · # pass 51 · # fail 3`);
`R42`–`R45` bestehen dort weiterhin — die Korrekturen aus V1.0.66 wurden also
nicht aufgeweicht.

**Testergebnis nach der Aenderung** (ein Lauf ueber den gemeinsamen Runner,
`npm test`): **1700 Rechen-Assertions (darin 434 Fixture-Assertions), Exit 0**
und **202 Node-Tests, Exit 0**. Node-Tests 200 → 202 (+2).

### 5 · Browserpruefung (durchgefuehrt)

Im vorinstallierten Chromium (`/opt/pw-browsers/chromium-1194`), angesteuert
ueber das DevTools-Protokoll mit dem in Node 22 eingebauten WebSocket —
**keine neue Projektabhaengigkeit**, die Treiberskripte liegen ausserhalb des
Repositories. Die Datei wurde als `file://`-Dokument geladen, der Import lief
ueber `importMasterJsonFromTextarea()`; es gab **keine externen Requests**.
Jede Pruefung wurde auf BEIDEN Staenden ausgefuehrt.

| Pruefung | `f44abc0` | V1.0.67 |
|---|---|---|
| TTM ausgewaehlt, Markt-Vergleich | **21,00**, keine Basisangabe | **30,38**, „TTM (letzte vier Quartale) · 2025-09-30" |
| FY ausgewaehlt, Markt-Vergleich | 21,00, keine Basisangabe | **21,00**, „Letztes Geschaeftsjahr (FY) · 2024-12-31" |
| Basiswechsel ohne Neuberechnung | Zahlen, kein Hinweis | **Hinweis „neu berechnen", keine Zahlen** |
| DDM mit belegten Perioden | `dps_cagr_6y` + Hinweis | **unveraendert** `dps_cagr_6y` + Hinweis |
| DDM ohne Perioden | `dps_cagr_6y` als gemessen | **`scenario_capped`**, „kein gemessenes Wachstum" + Grund |
| Fallback, EV gesperrt | „Weder … verfuegbar", kein Grund, kein EV | **Grund und operativer EV sichtbar** |
| Fallback, Wert −5,00 | „Weder … verfuegbar", Wert unsichtbar | **−5,00 mit Ausschlussgrund sichtbar** |

**Technische Einschraenkung:** geprueft wurden ausschliesslich die geaenderten
Anzeigen ueber den Import- und Renderpfad. Ein vollstaendiger
Bedienungsdurchlauf (Tickerabruf, Speichern, Neuladen, Export) und jede
Live-Abfrage gegen SEC oder Yahoo fanden **nicht** statt.

### 6 · Verbleibende Grenzen

* **Abgleich mit echten veroeffentlichten Abschluessen steht weiterhin aus**
  (Einheiten, Perioden, Schuldenumfang, Aktienbasis, FY/TTM). Kein Testlauf
  ersetzt ihn; er ist der naechste eigene Auftrag.
* **EPV bleibt deaktiviert** (`epv_floor` steht in jeder Sektorklasse unter
  `disabledModels`). Seine Altprobleme — die `|| 0`-Rueckfaelle bei Schulden
  und Liquiditaet in `modelEpvFloor()` und der Maintenance-CapEx-Abzug ohne
  korrespondierende Abschreibungszurechnung — sind weiterhin **vor einer
  Reaktivierung** zu beheben und wurden auch hier nicht angefasst.
* Ein interpoliertes Inline-Ereignisattribut verbleibt
  (`_handleGrowthAssumptionChange`); der interpolierte Wert ist eine vom
  Werkzeug selbst vergebene Feldkennung, kein importierter Inhalt.
* Die 45-Tage-Toleranz der Periodenenden ist aus `_joinPeriodKeyed()`
  uebernommen und damit eine **Konvention des Werkzeugs**, kein an realen
  Abschluessen geprueftes Mass.
* Dauerhafte Verwaesserung, heuristische Synthese, RIM-Periodenkompatibilitaet,
  automatische Peers, externe Basisraten und EUR-Renditeszenarien bleiben
  offen wie bisher dokumentiert.
* `main` (`b023dc8`) fuehrt weiterhin den urspruenglichen Stand.

**Keine Zusicherung der Fehlerfreiheit.** Die Auditgrenzen der vorherigen
Korrekturchats bleiben bestehen.

---

## Korrekturchat 12D: fuenf Auditbefunde nach V1.0.65 behoben (V1.0.66)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, gepruefter
Ausgangsbranch **`claude/chat12c2-final-edge-fixes`**, Ausgangscommit
**`7b1fd106f17be0ed1d467a30e82573238b654903`** (V1.0.65). Arbeits- und
Ergebnisbranch: **`claude/loving-newton-hcpo71`**. Dieser Branch stand vor
Beginn auf `b023dc8` (dem Stand von `main`); `b023dc8` ist ein VORFAHR von
`7b1fd10`, der Wechsel auf den geprueften Ausgangsstand war daher ein reiner
Fast-Forward — es wurde nichts zurueckgesetzt und keine fremde Aenderung
ueberschrieben (`git log 7b1fd10..origin/claude/loving-newton-hcpo71` war
leer). `main` (`b023dc8`) wurde nicht angefasst. Eine `AGENTS.md` existiert in
diesem Repository nicht. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehle: `npm test` und `node --test tests/*.test.mjs`.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `7b1fd10`
ausgefuehrt): **1700 Rechen-Assertions — darin enthalten 434
Fixture-Assertions — und 195 Node-Tests, Exit 0.** Die Fixture-Assertions sind
Teil der 1700 und werden nicht zusaetzlich gezaehlt.

**Auftrag.** Die fuenf Befunde eines unabhaengigen Auditberichts zu V1.0.65
samt ihrer unmittelbaren Randfaelle. Kein Refactoring, keine neue
Abhaengigkeit, keine Funktionserweiterung. Der DCF-Kern und alle nicht
betroffenen Bewertungsformeln bleiben unveraendert.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Alle Rechennachweise sind **synthetische Datensaetze ueber die produktiven
Aufrufwege** (`runValuationEngine`, `runFairValueSynthesizer`,
`computeRelativeMultiplesFV`, `_deriveDdmGrowthInputs`,
`parseSnapshotImportPayload`, `renderSnapshots`,
`importMasterJsonFromTextarea`) — **keine Live-Validierung, kein reales
Filing, kein SEC-/Yahoo-Abruf.** Ergaenzend wurde im vorinstallierten
Chromium geprueft (siehe Abschnitt 5). Ein gruener Testlauf ersetzt weiterhin
**keinen Abgleich mit echten veroeffentlichten Abschluessen**; dieser Abgleich
steht weiterhin aus.

### 2 · Reproduktion am unveraenderten Ausgangsstand

Alle fuenf Befunde wurden zuerst auf `7b1fd10` reproduziert. Die fuenf neuen
Tests `R42`–`R46` wurden gegen den unveraenderten Ausgangsstand ausgefuehrt und
**schlagen dort alle fuenf fehl** (`# tests 52 · # pass 47 · # fail 5`).

| # | gemessen auf `7b1fd10` |
|---|---|
| Befund 2 (EV/EBITDA) | EBITDA 250M, Multiplikator 10, 100M Aktien: **fehlende** Schulden und Liquiditaet ergaben **25,00 USD/Aktie** mit `available: true`. Ursache: `(f.total_debt && f.total_debt[0]) \|\| 0` bzw. `(f.cash && f.cash[0]) \|\| 0` — eine fehlende Angabe galt als ausdrueckliche Null. |
| Befund 4 (Financials) | `financial` fuehrt `activeModels: ['p_tbv_gordon','excess_return']`. Beide lieferten **13,75 USD Basisszenario** (identisch bis 1e-9 in allen drei Szenarien). Die Synthese meldete `activeModelsCount: 2`, **`modelAgreement: 'high'`**, `_confidenceLevel: 'high'`, `modelFitConfidence: 72`. |
| Befund 1 (Snapshot-ID) | `validateSnapshotRecordStructure()` akzeptierte jede nichtleere ID. Im Browser gemessen: der regulaere Importparser nahm einen Snapshot mit der ID `"><img src=x onerror="window.__pwned_img=1">` an (`ok: true`, 1 uebernommen); `renderSnapshots()` erzeugte daraus **3 echte `<img>`-Elemente und 6 fremde Ereignisattribute**, und **der eingeschleuste Code wurde tatsaechlich ausgefuehrt** (`window.__pwned_img === 1`). Damit ist die im Auditbericht offen gelassene Frage der tatsaechlichen Ausfuehrung beantwortet: sie fand statt. |
| Befund 5 (Importe) | Master-JSON `null` → ungefangene `TypeError: Cannot read properties of null (reading 'meta')` (der Feldzugriff stand ausserhalb des try-Blocks). Snapshot mit Ticker `constructor` → `TypeError: byTicker[s.ticker].push is not a function`; `__proto__` verhielt sich gleich. |
| Befund 3 (DDM) | DPS-Reihe `[1.12, 1.10, null, 1.06, 1.04, 1.02, 1.00]` (Anstieg 1,00 → 1,12 ueber SECHS Jahresintervalle mit einer Luecke): **2,2924556626 %**, ausgewiesen als **Fuenfjahreswachstum**. Richtig sind **1,9067623061 %**. Im echten DDM-Engine-Pfad: **14,457970968495326** statt **14,223656551734546** USD/Aktie. |

### 3 · Was geaendert wurde

**Befund 2 — die Vergleichsmultiples nutzen die gepruefte
Nettoschuldenaufloesung.** `computeRelativeMultiplesFV()` bildet seine
Eigenkapitalbruecke nicht mehr selbst. Neu ist `_resolveMultiplesEvBridge(f)`;
sie ruft **`_resolveNetDebtForDcfBridge(f)`** — dieselbe Funktion wie die
DCF-Wertbruecke, einschliesslich Umfangspruefung (`scopeComplete`),
Periodensperre und period-keyed Verknuepfung von Schulden und Liquiditaet. Es
gibt keine zweite, abweichende Schuldenlogik.

Zum Datenkontext: `computeRelativeMultiplesFV()` wird an allen sechs
Aufrufstellen mit demselben `mj` aufgerufen, aus dem auch `f.ebitda[0]`
stammt — die Bruecke wird also aus genau derselben Fundamentaldatenbasis
gebildet wie der Unternehmenswert, nicht aus einer anderen Periodenart.
Zusaetzlich prueft `_resolveMultiplesEvBridge()`, was die DCF-Bruecke fuer sich
allein nicht pruefen kann: **stimmt das Berichtsjahr des EBITDA mit dem
Bilanzstichtag der Bruecke ueberein?** Weichen beide ab, gilt der Aktienwert
als nicht ableitbar. Der operative Unternehmenswert (EV) bleibt in jedem
Sperrfall getrennt ausgewiesen; nur der Wert JE AKTIE entfaellt. P/E und P/FCF
bleiben unberuehrt verfuegbar.

Gemessene Pflichtfaelle (EBITDA 250M · Multiplikator 10 · 100M Aktien):

| Schulden-/Liquiditaetslage | V1.0.65 | V1.0.66 |
|---|---|---|
| beide fehlen | 25,00 „verfuegbar" | **gesperrt**, Grund genannt |
| Schulden unbekannt, Cash ausdruecklich 0 | 25,00 | **gesperrt** |
| beide ausdruecklich 0 | 25,00 | **25,00** (unveraendert) |
| Schulden 500M, Cash 0 | 20,00 | **20,00** (unveraendert) |
| Schulden 0, Cash 200M | 27,00 | **27,00** (Nettoliquiditaet, richtiges Vorzeichen) |
| unvereinbare Bilanzperioden | 20,00 | **gesperrt**, Grund genannt |
| EBITDA FY2025 gegen Bilanz FY2023 | 20,00 | **gesperrt**, Grund genannt |

**Randfall `base <= 0` — Status und Ergebnis widersprechen sich nicht mehr.**
Bis V1.0.65 filterte `r.base > 0` nichtpositive Werte wortlos aus Median UND
Zaehlung, liess das Modell aber `available: true`. Ein nichtpositiver
impliziter Wert je Aktie ist jedoch ein **Rechenergebnis** (Nettoschulden
erreichen oder uebersteigen den Unternehmenswert), kein Datenmangel. Er wird
jetzt als berechnet ausgewiesen (`available: true`, `nonPositive: true`) und
**mit Begruendung** (`excludedFromMedian`) aus dem Median genommen; der
wirtschaftliche Wert wird nicht geloescht und nicht als Datenluecke
ausgegeben. Ein nicht darstellbares Ergebnis (`null`/`NaN`/`Infinity`) ist
dagegen kein Wert und wird als nicht verfuegbar gekennzeichnet. Neu am
Ergebnis: `computedCount`, `nonPositiveCount`, `bridgeBlockedCount`.

Nachgezogene Anzeigen: die Fallback-Karte im Valuation-Block (gesperrte
Modelle tragen jetzt die Marke „gesperrt" statt „fehlt", nennen den Grund und
den weiterhin bestimmbaren EV; nichtpositive Werte tragen ihre Erklaerung), die
Median-Zeile (zaehlt gesperrte und nichtpositive Modelle getrennt aus) und
`renderMarket()` (gesperrte Modelle verschwinden nicht mehr wortlos aus der
Tabelle, sondern stehen mit „nicht ableitbar" und Grund darin). Der
Bewertungs-Fallback haengt unveraendert an `hasAny` und faellt damit korrekt
auf `market_only` statt `relative_multiples`.

**Befund 4 — Modellfamilien.** `modelPTbvGordon` und `modelExcessReturn` sind
unter den hier implementierten Annahmen nicht zwei Bewertungen, sondern zwei
Darstellungen derselben Rechnung. Die Umformung ist exakt, nicht
naeherungsweise: weil der Buchwert mit genau `terminal_growth` fortgeschrieben
wird und die Ueberrendite ein fester Anteil davon ist, teleskopiert die
10-Jahres-Zerlegung mit Terminalwert zur geschlossenen Gordon-Form

```
B0 + Σ B0·(ROE−r)·(1+g)^(i−1)/(1+r)^i + TV  =  B0 + B0·(ROE−r)/(r−g)  =  B0·(ROE−g)/(r−g)
```

Neu deklariert sind `MODEL_FAMILIES`, `MODEL_FAMILY_INFO`,
`_modelFamilyKey()`, `_independentFamilyCount()` und
`_activeModelFamilyNotes()`. Ihre Wirkung beschraenkt sich auf **Zaehlung,
Uebereinstimmung und daraus abgeleitete Vertrauenssignale**:

* `modelAgreement` vergleicht nur noch **Vertreter unabhaengiger Familien**
  (Median der Familienwerte). Bleibt nur eine Familie uebrig, ist das Ergebnis
  `'n/a'` mit einer ausdruecklichen Begruendung in `modelAgreementReason` statt
  `'high'`.
* Neu in der Synthese: `independentModelCount` und `modelFamilyNotes`;
  `activeModelsCount` bleibt die Zahl der gerechneten Darstellungen.
* `modelFitConfidence` bewertet die **Familienzahl** statt der Modellzahl.

**Keine doppelte Gewichtung entsteht neu und es bestand auch keine:** beide
Modelle teilen sich bereits seit V1.0.x einen Slot (`_mfw.rim * 0.5` je
Modell). Das wurde geprueft und unveraendert gelassen — der gewichtete
Fair Value bleibt 13,75. Beide Berechnungen bleiben als alternative
Darstellungen sichtbar; der Familienhinweis steht jetzt zusaetzlich **am
Modellergebnis selbst** (`warnings`, `modelFamily`, `modelFamilyNote`), in der
Fair-Value-Box, an der Konvergenzzeile, in der MoS-Zerlegung und im Snapshot
(`output_signals.independent_models`, `output_signals.model_family_note`). Es
wurde **keine neue Bewertungsmethode** eingefuehrt und **keine Annahme
kuenstlich verschoben**, nur um abweichende Zahlen zu erzeugen.

Gemessene Wirkung (`financial`, synthetische Referenzfirma):

| Groesze | V1.0.65 | V1.0.66 |
|---|---|---|
| Einzelwerte Gordon / Excess Return (Basis) | 13,75 / 13,75 | **13,75 / 13,75** (unveraendert) |
| `activeModelsCount` | 2 | 2 |
| `independentModelCount` | — | **1** |
| `modelAgreement` | `high` | **`n/a`** + Begruendung |
| `_confidenceLevel` | `high` | **`medium`** |
| `modelFitConfidence` | 72 | **55** |
| Fair Value `range.base` | 13,75 | **13,75** (unveraendert) |

Gegenprobe `standard_nonfin` (DCF + RIM, wirklich unabhaengig): zwei Familien,
`modelAgreement` unveraendert berechnet, `modelFitConfidence` unveraendert 70,
kein Familienhinweis.

**Befund 1 und 5 — Importabsicherung.** Beide zusammen bearbeitet.

*Snapshot-IDs und Aktionsknoepfe.* Zwei Massnahmen greifen gemeinsam, weil
HTML-Escaping allein fuer Werte INNERHALB eines JavaScript-Ereignisattributs
nicht genuegt:
1. `SNAPSHOT_ID_PATTERN` (`/^[A-Za-z0-9._:-]{1,128}$/`) wird in
   `validateSnapshotRecordStructure()` geprueft — **derselben Stelle**, die
   Import UND Journal-Schutz bedient, es gibt keine zweite Liste. Die vom
   Werkzeug erzeugten IDs (Base36 aus Zeitstempel und Zufall) und frueher
   exportierte Kennungen erfuellen das Muster unveraendert; geprueft sind
   `ok123`, `m5k2j9x1ab`, `AAPL-2026-01-02T03:04:05.000Z`, `snap_1.2`.
   Ungueltige Datensaetze werden mit verstaendlicher Meldung zurueckgewiesen und
   bleiben **unangetastet gespeichert** (kein automatisches Loeschen oder
   Umschreiben — die bestehende Regel aus V1.0.46 gilt weiter).
2. Die Aktionsknoepfe tragen **keine Inline-Ereignisattribute** mehr, sondern
   `data-action` / `data-action-value`. `_installDomActionDelegation()`
   verbindet EINEN `addEventListener('click', …)` und reicht den Attributwert
   als **Zeichenkette** an `DOM_ACTION_HANDLERS` weiter; er wird nie
   ausgewertet. Betroffen sind Laden, Neu-Rechnen und Loeschen im Journal sowie
   — im gleichen begrenzten Umfang — `openOverrideModal` und `removeOverride`.

*Importstruktur und Gruppierung.*
* `importMasterJsonFromTextarea()` prueft jetzt den **Top-Level-Typ vor jedem
  Feldzugriff**: `null`, Arrays, Zahlen und Zeichenketten werden kontrolliert
  mit der Zusage abgewiesen, dass nichts importiert wurde und der vorhandene
  Stand unveraendert bleibt. Kaputtes JSON bleibt wie bisher eine gemeldete
  Parse-Meldung.
* Die Journal-Gruppierung verwendet eine **`Map`** statt eines Objektliterals.
  Damit gibt es keine geerbten Schluessel mehr; es wird **kein einzelner
  Tickername verboten**. Geprueft: `constructor`, `__proto__`, `toString`,
  `hasOwnProperty` und `AAPL`, einzeln und gemischt in einem Bestand.
* `parseSnapshotImportPayload()` behandelte Top-Level-`null` und Nicht-Objekte
  bereits korrekt; das wurde geprueft und nicht erneut implementiert. Die
  Alles-oder-nichts-Regel bleibt: ein fehlgeschlagener Import uebernimmt nichts
  und laesst den gespeicherten Bestand unveraendert.

**Befund 3 — DDM-Annualisierung ueber die tatsaechlich vergangene Zeit.**
`tryCagr()` in `_deriveDdmGrowthInputs()` zaehlte die VORHANDENEN Werte und
annualisierte mit der gezaehlten Anzahl. Fehlte ein Zwischenjahr, lag der
Stuetzwert weiter zurueck als angenommen — die Zeitspanne wurde verkuerzt und
das Wachstum ueberschaetzt. Die **Auswahl** des Stuetzwerts ist unveraendert
(der `years+1`-te positive Eintrag); annualisiert wird jetzt mit dem
**tatsaechlichen Abstand**:

* Liegen belastbare Berichtsperioden vor (`f._v4_meta.dps.periods`),
  entscheidet deren Jahresabstand — damit wird auch eine Luecke erkannt, die
  nur in den PERIODENLABELS steht, waehrend die Wertereihe lueckenlos ist.
* Sonst gilt die dokumentierte Altdatenregel „ein Array-Platz = ein
  Geschaeftsjahr". Eine Luecke im Array verkuerzt die Zeitspanne dabei nicht,
  weil der Platzabstand sie mitzaehlt.
* Sind Perioden vorhanden, aber nicht lesbar, wird **kein Zeitabstand
  erfunden**: der Horizont gilt als nicht bestimmbar, der Grund wird in
  `g1DpsNotes` und `g1Note` mitgefuehrt, und die bestehende Ersatzkette
  (3y → 10y → Median-YoY → gedeckeltes Szenariowachstum) greift mit ihrer
  eigenen Quellenangabe.
* Eine **gemeldete Null** innerhalb der Zeitspanne ist eine wirtschaftliche
  Angabe (Dividende ausgesetzt), keine Datenluecke. Ein durchgehender CAGR
  beschreibt einen solchen Verlauf nicht — er bleibt mit Begruendung ohne Wert,
  statt die Null zu uebergehen. Eine Null ausserhalb der verwendeten Spanne
  aendert nichts.
* **Quelle und Jahreszahl nennen die tatsaechlich gerechnete Zeitspanne**
  (`dps_cagr_6y` statt `dps_cagr_5y`, `g1DpsGrowthYears: 6`).
* Die Kappungen (0–5 % bzw. 0–3 % bei schwacher Datenbasis) sind **unveraendert
  und wirken weiterhin ERST NACH** der Annualisierung.

Gemessen: 1,00 → 1,12 ueber sechs Jahresintervalle mit Luecke ergibt
**1,9067623061 %** statt der falsch annualisierten 2,2924556626 %;
im echten DDM-Engine-Pfad **14,223656551734546** statt 14,457970968495326
USD/Aktie. Die vollstaendige Reihe liefert **bit-genau** das bisherige Ergebnis
(14,212416883291723).

### 4 · Tests

| Test | sichert ab |
|---|---|
| `R42` | Befund 2: alle sechs Pflichtfaelle der EV-Bruecke, Nettoliquiditaet mit richtigem Vorzeichen, EBITDA-/Bilanzjahr-Kompatibilitaet, dieselbe Sperre wie die DCF-Bruecke bei unvollstaendigem Schuldenumfang, unabhaengige Verfuegbarkeit von P/E und P/FCF, Randfall `base <= 0` (berechnet, begruendet aus dem Median, kein Datenmangel), Fallback bleibt `market_only` |
| `R43` | Befund 4: echter Engine-/Synthese-Pfad; identische Einzelwerte bleiben erhalten, eine Familie statt zwei Modelle, `modelAgreement: 'n/a'` mit Begruendung, `_confidenceLevel` und `modelFitConfidence` korrigiert, Fair Value unveraendert, Familienhinweis am Modell, Gegenprobe mit wirklich unabhaengigen Modellen |
| `R44` | Befund 1: Abweisung praeparierter IDs an der gemeinsamen Pruefstelle, Erhalt gueltiger bestehender IDs, Abweisung durch den regulaeren Importparser, ECHTER Renderer ohne Inline-Ereignisattribute, gespeicherter Schrott wird ausgewiesen statt ausgefuehrt und nicht veraendert, Ereignispfad ueber `_installDomActionDelegation()` (Wert bleibt Zeichenkette), Quelltextpruefung auf interpolierte `onclick`-Attribute |
| `R45` | Befund 5: Master-JSON `null`/Array/String/Zahl ohne Ausnahme und ohne Erfolgsmeldung, Parse-Fehler unveraendert gemeldet, Ticker `constructor`/`__proto__`/`toString`/`hasOwnProperty` einzeln und gemischt, fehlgeschlagener Snapshot-Import laesst den Bestand unberuehrt, gueltiger Import geht weiterhin durch |
| `R46` | Befund 3: alle sechs Pflichtfaelle der Annualisierung einschliesslich Luecke in den Periodenlabels, unlesbarer Perioden, gemeldeter Null und des echten DDM-Engine-Pfads (1,91 % liegt unter der Kappungsgrenze, der Fehler wird also nicht verdeckt); bestehende Kappung unveraendert |

**Keine bestehende Testerwartung musste angepasst werden.** `R1`–`R41` und
alle Fixture-Pruefungen bestehen unveraendert.

**Gegenprobe:** `R42`–`R46` wurden gegen den unveraenderten Ausgangsstand
`7b1fd10` ausgefuehrt und schlagen dort **alle fuenf** fehl
(`# tests 52 · # pass 47 · # fail 5`).

**Testergebnis nach der Aenderung:** `npm test` → **1700 Rechen-Assertions
(darin 434 Fixture-Assertions), Exit 0**; `node --test tests/*.test.mjs` →
**200 Node-Tests, Exit 0**. Node-Tests 195 → 200 (+5).

### 5 · Browserpruefung (durchgefuehrt)

Im vorinstallierten Chromium (`/opt/pw-browsers/chromium-1194`), angesteuert
ueber das DevTools-Protokoll mit dem in Node 22 eingebauten WebSocket —
**keine neue Projektabhaengigkeit**, die Treiberskripte liegen ausserhalb des
Repositories. Die Datei wurde als `file://`-Dokument geladen; es gab **keine
externen Requests**.

* **Ausfuehrungsmarker, Ausgangsstand `7b1fd10`:** Snapshot mit der ID
  `"><img src=x onerror="window.__pwned_img=1">` → Importparser `ok: true`,
  **3 eingeschleuste `<img>`-Elemente, 6 fremde Ereignisattribute,
  `window.__pwned_img === 1`** — der Code wurde ausgefuehrt. Master-JSON
  `null` → `AUSNAHME: Cannot read properties of null (reading 'meta')`.
  Ticker `constructor` → `AUSNAHME: byTicker[s.ticker].push is not a function`.
* **Derselbe Marker, V1.0.66:** `window.__pwned_img` und `__pwned_quote`
  bleiben `undefined`, **0** eingeschleuste `<img>`, **0** fremde
  Ereignisattribute, **0** `onclick`-Attribute im Journal; der Eintrag wird als
  unbrauchbar ausgewiesen und der gueltige Nachbareintrag bleibt bedienbar.
* **Bedienung nach der Umstellung:** „Neu rechnen" und „Loeschen" erreichen
  `loadSnapshotWithCurrentModel('ok123')` bzw. `deleteSnapshot('ok123')` ueber
  die Delegation; `override-open` und `override-remove` erreichen
  `openOverrideModal('hs-leverage')` bzw. `removeOverride('hs-leverage')`.
* **Master-JSON ueber die echte Oberflaeche:** `null` und `[1,2,3]` erzeugen
  keine Ausnahme, keine Erfolgsmeldung und die Meldung „Kein gueltiges
  Master-JSON … Es wurde nichts importiert; der vorhandene Stand bleibt
  unveraendert."
* **Prototyp-Ticker:** `constructor`, `__proto__` und `AAPL` in einem Bestand
  rendern fehlerfrei (9 Aktionsknoepfe).
* **Geaenderte Anzeigen:** Markt-Vergleich ohne belegte Schulden zeigt „nicht
  ableitbar" mit Grund, waehrend die P/E-Zeile 22,50 weiter ausweist; mit
  ausdruecklichen Nullwerten erscheint 25,00. Die Fair-Value-Box eines
  `financial`-Falls zeigt „Core-Modelle aktiv · 1 unabhaengige(s)", den
  Familienhinweis („algebraisch identisch") und „Modell-Konvergenz: n/a —
  Keine modelluebergreifende Uebereinstimmung bestimmbar …". Die DDM-Karte
  zeigt „tatsaechlich 6 Jahre zwischen den verwendeten DPS-Werten" und die
  Quelle `dps_cagr_6y`.

**Nicht geprueft:** ein vollstaendiger Bedienungsdurchlauf (Tickerabruf,
Speichern, Neuladen, Export) und jede Live-Abfrage gegen SEC oder Yahoo.

### 6 · Offene Punkte (unveraendert bzw. neu benannt)

* **Abgleich mit echten veroeffentlichten Abschluessen steht weiterhin aus** —
  Einheiten, Perioden, Schuldenumfang, Aktienbasis, FY/TTM. Das ist der
  naechste fachliche Pruefschritt und wird durch keinen Testlauf ersetzt.
* **EPV bleibt deaktiviert.** `epv_floor` steht in JEDER Sektorklasse unter
  `disabledModels` und taucht weder in `activeModels` noch in
  `diagnosticModels` auf. Seine bekannten fachlichen Altprobleme bleiben
  bestehen und sind **vor einer Reaktivierung** zu beheben: die
  Null-Rueckfaelle bei Schulden und Liquiditaet in `modelEpvFloor()`
  (dieselbe `|| 0`-Stelle wie in Befund 2) und der Maintenance-CapEx-Abzug
  ohne korrespondierende Abschreibungszurechnung. In diesem Auftrag
  ausdruecklich **nicht** angefasst.
* **Ein interpoliertes Inline-Ereignisattribut verbleibt** im Tool:
  `onchange="_handleGrowthAssumptionChange('${id.replace(...)}', this.value)"`
  in der Assumptions-Eingabe. Der interpolierte Wert ist dort eine vom
  Werkzeug selbst vergebene Feldkennung (`as-gr-…`), kein importierter Inhalt;
  er lag ausserhalb des Auftragsumfangs. Eine Umstellung auf dieselbe
  Delegation waere die konsequente Fortsetzung.
* **Dauerhafte Verwaesserung** (`TERMINAL_DILUTION`), heuristische Synthese,
  fehlende automatische Peers, externe Basisraten und EUR-Renditeszenarien
  bleiben offen wie bisher dokumentiert.
* **Andere Bewertungsmodelle** (insbesondere RIM) sind weiterhin nicht auf
  demselben Pruefstand wie der DCF; Periodenkompatibilitaet und fachliche
  Konsistenz sind dort systematisch nachzuziehen.
* `main` (`b023dc8`) fuehrt weiterhin den urspruenglichen Stand. Ein
  kontrollierter Merge eines geprueften Standes ist ein eigener Schritt und war
  nicht Teil dieses Auftrags.

**Keine Zusicherung der Fehlerfreiheit.** Die Auditgrenzen der vorherigen
Korrekturchats bleiben bestehen.

---

## Korrekturchat 12C.2: zwei Restfehler nach 12C.1 behoben (V1.0.65)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12c1-targeted-fixes`**, Ausgangscommit
**`d55dfbdeb40fa9b799f3d6851adc7ddb0543371b`** (V1.0.64) — zugleich die
Branch-Spitze; nach `git fetch --prune` gab es KEINE Nachfolgecommits
(`git branch -r --contains d55dfbd` nennt nur diesen Branch). `main`
(`b023dc8`) wurde nicht angefasst. Eine `AGENTS.md` existiert in diesem
Repository nicht. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12c2-final-edge-fixes`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Testbefehl: `npm test`.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `d55dfbd`
ausgefuehrt): 1700 Rechen-Assertions · 434 Fixture-Assertions · 193
Node-Tests · Exit 0 — wie im Auftrag angegeben.

**Auftrag.** Ausschliesslich zwei Restfehler: der D&A-Index-Rueckfall bei
TEILWEISE fehlenden Periodenmetadaten (A-6) und der falsche Erklaerungstext
bei geringer positiver Verwaesserung (A-5). Keine weiteren Auditbaustellen,
keine Solver- oder Toleranzaenderungen, kein Refactoring. Die in 12C.1
akzeptierte Darstellung BEIDER Terminalzweige in `buildDataBasisReport()`
bleibt bestehen.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Alle Nachweise sind **synthetische Master-JSON-Datensaetze ueber die
produktiven Aufrufwege** — keine Live-Validierung, kein reales Filing. Der
A-6-Nachweis ist ausdruecklich **kein Beleg fuer einen Fehler des echten
SEC-Live-Imports**. Ergaenzend wurden die geaenderten sichtbaren Texte im
vorinstallierten Chromium geprueft (punktuell, sechs Datensaetze).

### 2 · Reproduktion am unveraenderten Ausgangsstand

Beide Befunde wurden zuerst auf `d55dfbd` reproduziert.

| # | gemessen auf `d55dfbd` |
|---|---|
| A-6 | Verschobener Datensatz aus `R37` (Umsatz und EBIT FY2025–FY2020, EBITDA ab FY2024), **nur die EBIT-Periodenmetadaten entfernt**: **D&A −150M**, **Referenz-FCF −50M**, Herkunft **`reported_period`**, >30-%-Abweichungswarnung gegen den berichteten FCF 150 — der echte Engine-Pfad akzeptierte den Fall (`applicable: true`). Ursache: `_daPairPeriodKeyed()` verlangte Perioden von EBITDA UND EBIT und fiel sonst auf Array-Indizes zurueck; der bekannte Widerspruch zwischen Umsatz@FY2025 und EBITDA@FY2024 blieb ungenutzt. |
| A-5 | Referenzfirma mit `shares_diluted = [100, 100/1,0025, 100/1,0025², 100/1,0025³]` (**+0,25 %/y**): Terminalteiler **102,528313 Mio.**, Basis `shares_year_10_constant`, Projektion im Hauptwert angewendet — sichtbarer Text aber **„neutral (≈konstante Aktienanzahl) — der Hauptwert rechnet durchgehend mit der heutigen Aktienzahl"**. |

### 3 · Was geaendert wurde

**A-6 — EINE Entscheidung ueber alle drei beteiligten Reihen.**
`_daPairPeriodKeyed()` ist durch `_daPairingDecision(f)` ersetzt. Sie
betrachtet die Periodenangaben von Umsatz, EBIT UND EBITDA und liefert genau
einen Modus, den BEIDE Verbraucher verwenden — die historische Quotenbildung
(`_daPeriodKeyedRatios`) und die D&A der bewerteten Periode
(`_resolveMidCycleDa`). Damit kann der Fehler nicht ueber den jeweils anderen
Pfad erneut entstehen.
* `period` — alle drei melden Perioden ⇒ Zuordnung ueber das Berichtsende,
  kein Index-Rueckfall.
* `index` — keine der drei meldet Perioden (dokumentierte Altdatenregel) ODER
  die meldenden Reihen widersprechen der Positionszuordnung an keiner der
  verwendeten Stellen ⇒ Positionszuordnung wie bisher, ausdruecklich als
  solche gekennzeichnet (`periodMatched: false`, „nach Position zugeordnet").
* `blocked` — mindestens ZWEI Reihen melden Perioden und widersprechen sich
  an einer dieser Stellen ⇒ KEIN Wert: `status: 'insufficient_data'`,
  `daBasis: 'period_unresolved'`, Begruendung mit den konkreten Konflikten,
  KEINE Abweichungswarnung, Modell gesperrt.
Keine erfundenen Perioden, keine Klemmung negativer Werte, keine neue
Schaetzmethode. Die Priorität einer gueltigen manuellen D&A-Annahme (auch 0)
bleibt vor allem anderen.

**A-5 — Erklaerungstext folgt dem Kernergebnis.** Bis V1.0.64 entschied die
0,5-%-Schwelle BEIDES: die Einordnung der Groessenordnung und die Aussage
ueber den Rechenweg. Der Hauptwert beruecksichtigt aber JEDE positive
Aktienzunahme (`g > 0`). Getrennt wird jetzt: die Schwelle ordnet nur noch die
GROESSENORDNUNG ein (Buybacks / Dilution / geringe Dilution / geringer
Rueckkauf / neutral); der RECHENWEG kommt aus
`_sharesChangeAppliedInMainValue` des Kerns. Aus demselben Feld haengen jetzt
auch die „Trennung der Effekte" und der ⚠-Vereinfachungshinweis, die vorher
ebenfalls erst ab 0,5 % erschienen.
**Unveraendert:** Bewertungsformel, Aktienprojektion, Clamp- und Split-Regeln,
Fair Value, Buyback-Uplift und Sicherheitsmarge (in `R41` gegen `d55dfbd`
gemessen: +0,25 % → 16,300651655509; −4 % → 16,590366068896806 bei Uplift
34,67567333289907; +8 % → 7,913941025347281; Synthesizer-Fair-Value
12,796287825471, `buybackAddon` 0,10, `mosTotal` 0,390812500). Keine neue
Einstellung, keine Aenderung der Terminalkonvention.

### 4 · Tests

| Test | sichert ab |
|---|---|
| `R40` | A-6: teilweise fehlende Metadaten heben bekannte Widersprueche nicht auf — EBIT-Meta entfernt ⇒ gesperrt, Umsatz-Meta entfernt ⇒ gesperrt, verschobene aber vollstaendig belegte Perioden ⇒ richtig zugeordnet (150), vollstaendiger `R37`-Fall unveraendert, Altdaten ohne Metadaten unveraendert nutzbar, nur eine meldende Reihe ⇒ Positionszuordnung (gekennzeichnet), manuelle Annahmen (auch 0) behalten Vorrang, keine Klemmung; echter Engine-Pfad |
| `R41` | A-5: Erklaerung und tatsaechliche Aktienbasis stimmen ueberein — geprueft bei +0,25 %, +0,50 %, +2,00 %, konstanter Aktienzahl, −4 % und Split-Verdacht; Rekonstruktion `pvTv === _pvTvAbs / _terminalShareCount`; Fair Value, Uplift und Terminalkonvention unveraendert; keine neue Einstellung |

**Berichtigte Erwartung.** `DATA_BASIS_REQUIRED_HELPERS` in
`tests/sec-ttm.test.mjs` fuehrt statt `_daPairPeriodKeyed` jetzt
`_daPairingDecision` (mit Begruendung im Test). Sonst wurde **keine**
Erwartung angepasst; `R1`–`R39` bestehen unveraendert, insbesondere `R35`
(A-7) und `R39` (Vorbehalt in beiden Reverse-DCF-Karten).

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 195 Node-Tests · Exit 0.** Node-Tests 193 → 195 (+2).

### 5 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium ueber `importMasterJsonFromTextarea()`:

* **A-5, fuenf Aktienverlaeufe.** Erklaerung und gemessene Basis stimmen in
  allen Faellen ueberein:
  * +0,25 %/y → Teiler 102,528313, `shares_year_10_constant`, Text „geringe
    Dilution (Aktienanzahl steigt leicht) — im Hauptwert beruecksichtigt fuer
    die Detailjahre 1–10; ab dem Terminalzeitpunkt konstante Aktienzahl";
  * +0,50 %/y → Teiler 105,114013, gleicher Rechenweg;
  * +2,00 %/y → Teiler 121,899442, „Dilution … Detailjahre 1–10";
  * konstant → Teiler 100, „neutral … NICHT im Hauptwert: … heutige
    Aktienzahl";
  * −4,00 %/y → Teiler 100, „Buybacks … NICHT im Hauptwert …".
* **A-6 (DABLK, EBIT-Metadaten fehlen):** sichtbar „Mid-Cycle-Marge nicht
  ableitbar: Abschreibungen (D&A) der bewerteten Periode nicht belegt
  (Zuordnung von Umsatz, EBIT und EBITDA nicht belegt: die gemeldeten
  Berichtsperioden widersprechen …)". Gemessen: `applicable: false`,
  `status: 'insufficient_data'`, `value: null`,
  `daBasis: 'period_unresolved'`, `warning: null`, `pairing: 'blocked'`.

Keine JavaScript-Fehler; die einzigen Konsolenmeldungen sind fehlgeschlagene
externe Ressourcenabrufe (kein Netz) ohne Bezug zur Aenderung.

### 6 · Verbleibende Pruefgrenzen

* **Meldet nur EINE der drei Reihen Perioden, bleibt es bei der
  Positionszuordnung.** Ein Versatz der unbeschrifteten Reihen ist dann aus
  den Daten nicht erkennbar; ihn zu unterstellen hiesse, Perioden zu
  erfinden. Im verschobenen Testdatensatz liefert dieser Fall weiterhin −50M
  — sichtbar als „nach Position zugeordnet" und mit `periodMatched: false`,
  aber ohne Sperre. Bewusste Grenze, keine vollstaendige Aufloesung.
* **A-5 bleibt eine offengelegte Modellvereinfachung.** Behoben ist hier nur
  der falsche Erklaerungstext.
* Die in 12C.1 dokumentierte Grenze zu `buildDataBasisReport()` (beide Zweige
  statt des konkreten) bleibt unveraendert bestehen.
* **A-6 ist an synthetischen Master-JSON-Datensaetzen geprueft**, nicht an
  einem Live-SEC-Import.
* Die Toleranzen der Periodenpaarung sind unveraendert und **nicht an realen
  Filings kalibriert**.
* Die **Browserpruefung** deckt sechs Datensaetze ab, nicht die Oberflaeche
  insgesamt.
* Alle Grenzen aus 12A, 12B.1–12B.3, 12C und 12C.1 bleiben bestehen. Dies ist
  **keine Bestaetigung**, dass das Werkzeug fehlerfrei ist, und **keine
  Aussage** ueber die Qualitaet der erzeugten Bewertungen.

### 7 · Bearbeitungsstand nach diesem Schritt

**In diesem Schritt behoben**
* **A-6** Index-Rueckfall bei teilweise fehlenden Periodenmetadaten — `R40`
* **A-5** falscher Erklaerungstext bei geringer positiver Verwaesserung — `R41`
  (die Modellvereinfachung selbst bleibt offengelegt, nicht behoben)

**Unveraendert abgesichert**
* **A-1 bis A-4, O-1, O-2** (12A/12B) — `R1`–`R20`
* **12B.1–12B.3** Schuldenumfang, -aufloesung und Nichtnegativitaet — `R21`–`R32`
* **A-5** offengelegte Modellannahme und Terminal-Aktienbasis — `R33`, `R38`
* **A-6** zentrale D&A-Aufloesung und Periodenzuordnung — `R34`, `R37`
* **A-7** Buyback-Zuschlag im aktiven DCF-Modell — `R35`
* **O-3** Nullstellensuche und Vorbehalt in beiden Karten — `R36`, `R39`

**Weiterhin offene Pruefpunkte** (unveraendert)
* Keine Live-Validierung bei SEC/Yahoo, kein reales Filing.
* Keine vollstaendige Browser-/DOM-Pruefung.
* Nicht-DCF-Modelle nicht auf innere Konsistenz geprueft.
* Sektor-/Klassifikationstabellen, Gewichtung, Einstiegszonen-Logik und
  Datenqualitaets-Gates ueber A-7 hinaus ungeprueft.
* Keine Laufzeit- oder Sicherheitspruefung.

---

## Korrekturchat 12C.1: drei Restfehler nach 12C behoben (V1.0.64)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12c-audit-completion`**, Ausgangscommit
**`3a215eca8e3277a7ee0ab61ae4c56398c69d2b78`** (V1.0.63) — zugleich die
Branch-Spitze; nach `git fetch --prune` gab es KEINE Nachfolgecommits
(`git branch -r --contains 3a215ec` nennt nur diesen Branch). `main`
(`b023dc8`) wurde nicht angefasst. Eine `AGENTS.md` existiert in diesem
Repository nicht. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12c1-targeted-fixes`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Testbefehl: `npm test`.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `3a215ec`
ausgefuehrt): 1700 Rechen-Assertions · 434 Fixture-Assertions · 190
Node-Tests · Exit 0 — wie im Auftrag angegeben.

**Auftrag.** Ausschliesslich die drei nach 12C unabhaengig reproduzierten
Restfehler: D&A-Periodenzuordnung (A-6), Terminal-Aktienbasis in Herkunft und
Snapshot (A-5), fehlende Reverse-DCF-Vorbehalte in der Oberflaeche (O-3).
Keine weiteren Auditbaustellen, kein Refactoring, keine erneuten
Parameterscans.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Alle Nachweise sind **synthetische Master-JSON-Datensaetze ueber die
produktiven Aufrufwege** — keine Live-Validierung, kein reales Filing. Der
A-6-Nachweis ist ausdruecklich **kein Beleg fuer einen Fehler des echten
SEC-Live-Imports**: ob eine reale Filing-Kette diese Reihenlage erzeugt, wurde
hier nicht geprueft. Ergaenzend wurden die geaenderten sichtbaren Hinweise im
vorinstallierten Chromium geprueft (punktuell, drei Datensaetze).

### 2 · Reproduktion am unveraenderten Ausgangsstand

Alle drei Befunde wurden zuerst auf `3a215ec` reproduziert.

| # | gemessen auf `3a215ec` |
|---|---|
| A-6 | Zyklischer Filer, EBIT FY2025–FY2020, **EBITDA erst ab FY2024**, Periodenmetadaten vollstaendig: **Referenz-FCF −50**, **D&A −150**, Herkunft **`reported_period`**, dazu eine >30-%-Abweichungswarnung gegen den berichteten FCF 150. Der echte Engine-Pfad akzeptiert das. Ursache: `ebitda[0]` (FY2024, 250) gegen `ebit[0]` (FY2025, 400). |
| A-5 | Referenzfirma mit −4 %/y Rueckkaeufen: Der Hauptwert teilt durchgehend durch **100 Mio.** Aktien (Terminalwert je Aktie **7,373515**). `_terminalShareCount`, `_terminalShareCountM` und `snapshot.terminal.share_count` nennen **66,483264 Mio.** — damit ergaeben sich **11,090784**. |
| O-3 | Lueckendatensatz aus `R36` mit Kurs **20,50**: Solver liefert **10,589752 %** UND `searchComplete: false`, `uniquenessProven: false`, `caveat` gesetzt. Beide Karten zeigen die Zahl **ohne** Vorbehalt. |

### 3 · Was geaendert wurde

**A-6 — D&A ueber die Berichtsperioden.** Neu ist eine gemeinsame Paarung
ueber das **Berichtsende** (`_daPeriodsMatch`, `_daMatchingIndex`,
`_daPeriodKeyedRatios`), verwendet von `_resolveDaForForecast()` (historische
Quote) UND `_resolveMidCycleDa()` (bewertete Periode) — eine Regel, zwei
Verbraucher.
Der Jahresschluessel von `_joinPeriodKeyed()` wird bewusst NICHT uebernommen:
zwei TTM-Fenster koennen im selben Kalenderjahr enden. Die enge Regel (Enden
≤ 15 Tage auseinander) gilt fuer jede Periodenart; die bestehende
FY-Toleranz (gleiches Fiskaljahr UND ≤ 45 Tage) greift nur fuer FY gegen FY.
Gemeldete Periodenbeginne und -dauern duerfen sich nicht widersprechen — ein
Quartalswert faellt damit gegen ein Jahresfenster durch, auch bei identischem
Ende; widerspruechliche Einheiten verhindern die Ableitung.
Die Vorrangfolge bleibt: gueltige manuelle Annahme → belegte D&A der
bewerteten Periode → zulaessige historische Ableitung → begruendete
Nichtverfuegbarkeit. Die **Altdatenregel** bleibt erhalten: meldet das
tatsaechlich verrechnete Paar (EBITDA, EBIT) keine Berichtsperioden, gilt
unveraendert die Positionszuordnung des manuellen Imports — dieselbe
Abgrenzung wie in `_derivePairPeriodAware()`. Melden **beide** Perioden, gibt
es **keinen** Index-Rueckfall; ein nicht zuordenbarer Wert entsteht gar nicht
erst und wird nicht auf 0 geklemmt.
Wirkung: der Testfall liefert jetzt **Referenz-FCF 150**, D&A **50**,
Herkunft **`measured_ratio`** (ausdruecklich abgeleitet) und **keine**
Abweichungswarnung. Der Haupt-Fair-Value ist in beiden Darstellungen derselbe.

**A-5 — Terminal-Aktienbasis beschreibt die tatsaechliche Rechnung.**
Die Bewertungsrechnung ist bit-genau unveraendert (Fair Value, Buyback-Uplift
und Sicherheitsmarge in `R38` gegen `3a215ec` gemessen). Korrigiert ist die
Beschreibung: der konservative Hauptwert hat zwei Zweige.
* Verwaesserung (g > 0): Terminalwert durch die Aktienzahl des Jahres 10 →
  `shares_year_10_constant`.
* Rueckkaeufe oder konstante Aktienzahl (g ≤ 0): der Hauptwert teilt
  **durchgehend** durch die heutige Aktienzahl → `shares_year_0_constant`.
  Die projizierte Aktienzahl des Jahres 10 ist dort **Buyback-Diagnose** und
  wird getrennt ausgewiesen (`_buybackDiagnosticTerminalShareCount`).
Neu sind `_sharesChangeAppliedInMainValue` und `_sharesChangeTreatment`. Die
Zusicherung, die `R38` in allen drei Faellen prueft:
`pvTv === _pvTvAbs / _terminalShareCount`. Mitgefuehrt wird das bis in
`buildSnapshotForecastTargets()`; der sichtbare Hinweis nennt den
Rueckkaufzweig jetzt richtig. `buildDataBasisReport()` nennt **beide Zweige**
samt `resolved_in` statt einen zu behaupten (siehe Pruefgrenzen).

**O-3 — Vorbehalt in beiden Karten.** Reine Anzeigekorrektur: Solver,
Suchgrenzen, Toleranzen und Bewertungsfunktion sind unveraendert (in `R39`
festgeschrieben). Liefert der Kern eine Loesung UND `searchComplete: false`
bzw. `uniquenessProven: false` bzw. einen `caveat`, zeigen jetzt **beide**
HTML-Erzeuger unmittelbar bei der Zahl „⚠ Eindeutigkeit nicht gesichert —
gefundene Loesung, unvollstaendige Suche" samt dem Text des Solvers, durch
`escapeHtml()` gefuehrt. Regulaere vollstaendige Loesungen und
`search_incomplete` ohne Zahlenwert bleiben unveraendert.

### 4 · Tests

| Test | sichert ab |
|---|---|
| `R37` | A-6: Periodenzuordnung ueber das Berichtsende; fehlende Perioden, abweichende Reihenfolge, echte Null, manuelle Overrides (auch 0), fremde Perioden ohne Index-Rueckfall, Quartal gegen Jahresfenster, Altdatenregel; echter Engine-Pfad |
| `R38` | A-5: der ausgewiesene Teiler rekonstruiert den tatsaechlichen Haupt-Terminalwert in allen drei Faellen (Verwaesserung, konstant, Rueckkaeufe); Fair Value und Uplift unveraendert; Snapshot; keine neue Einstellung |
| `R39` | O-3: Vorbehalt in BEIDEN HTML-Erzeugern, Escaping, vollstaendige Loesung ohne Vorbehalt, `search_incomplete` ohne Zahl unveraendert, Solverparameter festgeschrieben |

**Berichtigte Erwartungen** (fachlich falsch, keine Toleranzlockerung):
* `R33` prueferte `TERMINAL_DILUTION.appliedInDetailYears === true`,
  `rep.dilution.terminal_share_count_basis === 'shares_year_10_constant'` und
  `rep.dilution.applied_in_detail_years === true`. Alle drei waren pauschale
  Behauptungen, die nur im Verwaesserungsfall gelten; sie sind durch die
  Pruefung beider Zweige ersetzt. Die inhaltlichen Zusicherungen von `R33`
  bleiben unveraendert.
* `DATA_BASIS_REQUIRED_HELPERS` in `tests/sec-ttm.test.mjs` wurde um die
  sieben Helfer der Periodenpaarung ergaenzt (mit Begruendung im Test).
* Sonst wurde **keine** fachlich korrekte Erwartung angepasst; `R1`–`R32`,
  `R34`–`R36` und insbesondere `R35` (A-7) bestehen unveraendert.

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 193 Node-Tests · Exit 0.** Node-Tests 190 → 193 (+3).

### 5 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium ueber `importMasterJsonFromTextarea()`:

* **A-6 (DAPER):** sichtbar „Referenz-FCF 150M inkl. D&A 50M · abgeleitet:
  gemessener Median 5.00% des Umsatzes ueber 5 Periode(n) (FY) —
  periodengleich zugeordnet …". Gemessen: `_midCycleDaBasis: 'measured_ratio'`,
  `_midCycleDaM: 50`, `_midCycleReferenceFcfM: 150`.
* **A-5 (BUYB, −4 %/y):** sichtbar „Shares-Projektion: 100.0M (Jahr 0) →
  66.5M (Jahr 10) bei -4.00%/y · Buybacks (Aktienanzahl sinkt) — NICHT im
  Hauptwert: der konservative Wert rechnet durchgehend mit der heutigen
  Aktienzahl; die Projektion wirkt nur in der Diagnose und endet mit Jahr 10".
  Gemessen: Basis `shares_year_0_constant`, Teiler 100, Diagnose-J10
  66,483264, Fair Value 16,590366 und Uplift 34,6757 **unveraendert**.
* **O-3 (O3GAP, Kurs 20,50):** beide Karten zeigen „⚠ Eindeutigkeit nicht
  gesichert — gefundene Loesung, unvollstaendige Suche" samt Solvertext; die
  Zahl (10,59 %) bleibt sichtbar. Solver: `status: 'ok'`,
  `searchComplete: false`, Residuum 8,5·10⁻⁷.

Keine JavaScript-Fehler; die einzigen Konsolenmeldungen sind fehlgeschlagene
externe Ressourcenabrufe (kein Netz) ohne Bezug zur Aenderung.

### 6 · Verbleibende Pruefgrenzen

* **A-5 bleibt eine offengelegte Modellvereinfachung.** Behoben ist hier nur
  die falsche Beschreibung der verwendeten Aktienbasis, nicht die Annahme
  selbst.
* **`buildDataBasisReport()` nennt beide Zweige, nicht den konkreten.** Der
  Ausweis liegt im DATENBASIS-Block; fuer den konkreten Fall muesste er
  `buildForecastInputs()` mitziehen und damit die gesamte Prognose-Kette an
  den Datenbasis-Block haengen. Der konkrete Fall steht am Modellergebnis und
  im Snapshot; der Ausweis verweist darauf (`resolved_in`). Bewusste Grenze.
* **A-6 ist an synthetischen Master-JSON-Datensaetzen geprueft**, nicht an
  einem Live-SEC-Import.
* Die Toleranzen der Periodenpaarung (15 Tage allgemein, 45 Tage FY gegen FY,
  45 Tage Dauerabweichung) folgen der bestehenden `_joinPeriodKeyed`-Regel,
  sind aber **nicht an realen Filings kalibriert**.
* Die **Browserpruefung** deckt drei Datensaetze ab, nicht die Oberflaeche
  insgesamt.
* Alle Grenzen aus 12A, 12B.1–12B.3 und 12C bleiben bestehen. Dies ist
  **keine Bestaetigung**, dass das Werkzeug fehlerfrei ist, und **keine
  Aussage** ueber die Qualitaet der erzeugten Bewertungen.

### 7 · Bearbeitungsstand nach diesem Schritt

**In diesem Schritt behoben**
* **A-6** D&A-Periodenzuordnung — `R37`
* **A-5** falsche Beschreibung der Terminal-Aktienbasis — `R38`
  (die Modellvereinfachung selbst bleibt offengelegt, nicht behoben)
* **O-3** fehlender Vorbehalt in beiden Reverse-DCF-Karten — `R39`

**Unveraendert abgesichert**
* **A-1 bis A-4, O-1, O-2** (12A/12B) — `R1`–`R20`
* **12B.1–12B.3** Schuldenumfang, -aufloesung und Nichtnegativitaet — `R21`–`R32`
* **A-5** offengelegte Modellannahme — `R33`
* **A-6** zentrale D&A-Aufloesung (12C) — `R34`
* **A-7** Buyback-Zuschlag im aktiven DCF-Modell — `R35`
* **O-3** Nullstellensuche, Residualtoleranz, `search_incomplete` — `R36`

**Weiterhin offene Pruefpunkte** (unveraendert gegenueber 12C)
* Keine Live-Validierung bei SEC/Yahoo, kein reales Filing.
* Keine vollstaendige Browser-/DOM-Pruefung.
* Nicht-DCF-Modelle nicht auf innere Konsistenz geprueft.
* Sektor-/Klassifikationstabellen, Gewichtung, Einstiegszonen-Logik und
  Datenqualitaets-Gates ueber A-7 hinaus ungeprueft.
* Keine Laufzeit- oder Sicherheitspruefung.

---

## Korrekturchat 12C: A-5, A-6, A-7 und O-3 abgeschlossen (V1.0.63)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`.

Der Auftrag nannte `claude/chat12b-debt-periods` als erwarteten
Ausgangsbranch. Dieser Branch traegt nur V1.0.59 (A-4, O-1, O-2). Der
Korrekturchat 12B wurde danach in drei dokumentierten Teilschritten
fortgesetzt — 12B.1 (`claude/chat12b1-debt-scope-fixes`, V1.0.60), 12B.2
(`claude/chat12b2-debt-completeness`, V1.0.61) und 12B.3
(`claude/chat12b3-debt-nonnegative`, V1.0.62). Die Kette ist LINEAR
(`git merge-base --is-ancestor` geprueft: `claude/chat12b-debt-periods` ist
Vorfahr von `claude/chat12b3-debt-nonnegative`), es geht also nichts
verloren. Der Abschluss von 12B ist damit eindeutig **`claude/chat12b3-debt-nonnegative`**;
dessen HANDOFF-Abschnitt sagt das ausdruecklich („**Ausgangsbasis fuer
Korrekturchat 12C: `claude/chat12b3-debt-nonnegative`.** Dieser Branch
**ersetzt** dafuer `claude/chat12b2-debt-completeness`.") und haelt fest,
dass A-5, A-6, A-7 und O-3 fuer 12C unangetastet bleiben. Die Auswahl erfolgte
also NICHT nach Zeitstempel; `main` (`b023dc8`) wurde nicht angefasst und
enthaelt keinen der Vorschritte. `claude/sleepy-cori-m8lv12` zeigt auf
denselben Commit (leerer Diff) und ist kein eigener Stand.

**Ausgangscommit:** `d39209493b91265363cdd54ff7c3add63529fa4b` (V1.0.62) —
zugleich die Branch-Spitze, nach `git fetch --prune` geprueft.
**Ergebnisbranch: `claude/chat12c-audit-completion`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Eine `AGENTS.md` existiert in diesem Repository nicht.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test`.

**Bestaetigte Testbaseline vor der Aenderung** (selbst auf `d392094`
ausgefuehrt): 1700 Rechen-Assertions · 434 Fixture-Assertions · 189 Node-Tests
· Exit 0 — wie im HANDOFF von 12B.3 angegeben.

**Auftrag.** Die verbliebenen Auditpunkte A-5, A-6, A-7 und O-3 aus
`AUDIT-CHAT12.md`. Die Korrekturen aus 12A und 12B.1–12B.3 bleiben unberuehrt.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Alle Nachweise sind **synthetische Datensaetze ueber die produktiven
Aufrufwege** — keine Live-Validierung, kein reales Filing. Ergaenzend wurden
die geaenderten sichtbaren Hinweise im **vorinstallierten Chromium**
(Playwright, Import ueber `importMasterJsonFromTextarea()`) geprueft. Diese
Browserpruefung ist **punktuell**: vier Datensaetze und die dort sichtbaren
Texte, nicht die Oberflaeche insgesamt.

### 2 · Reproduktion am unveraenderten Ausgangsstand

Alle vier Punkte wurden zuerst auf `d392094` reproduziert:

| # | gemessen auf V1.0.62 |
|---|---|
| A-5 | „Dilution (Aktienanzahl steigt) — im Hauptwert beruecksichtigt" **ohne jeden Zeitbezug**; kein Hinweis auf die Begrenzung; `_dilutionHorizonYears` u. a. `undefined` |
| A-6 | `computeMidCycleFcf`: mit D&A 150M · `ebitda[0]=null` → **100M / `ok`** · ohne EBITDA → **100M / `ok`** · echte Null → 100M. Die drei Faelle sind **nicht unterscheidbar** |
| A-7 | zyklischer Titel, Uplift **94,4 %**: `runValuationEngine` liefert nur `dcf_midcycle`; `runFairValueSynthesizer` → `buybackAddon: 0`, `_buybackUpliftPct: 0` |
| O-3 (b) | Datensatz mit Rasterluecke ab 17,0 %, Kurs 20,02: `no_solution_in_range` mit der Begruendung „der Markt preist ein Wachstum unter −20 % ein" — **falsch**, die Loesung liegt bei 16,65 % |
| O-3 (a) | nur mit **eingespeister** Luecke erreichbar: `ok`, 0,375 %, Residuum 0,0366 je Aktie (echte Nullstelle 0,3446 %) |

### 3 · Was geaendert wurde

**A-5 — Terminalannahme ausdruecklich gemacht, Rechnung UNVERAENDERT.**
Gewaehlt wurde die im Audit vorgeschlagene minimale Loesung. `R33` prueft die
Referenzzahlen auf 1e-12 gegen V1.0.62 (Wert je Aktie 7,913941025347281,
Terminalwert je Aktie 2,711244966909631). Neu ist allein die Offenlegung:
eine einzige Deklaration `TERMINAL_DILUTION` (Horizont, Basis, Flags, Text);
der sichtbare Hinweis nennt den Zeitraum („… im Hauptwert beruecksichtigt fuer
die Detailjahre 1–10; ab dem Terminalzeitpunkt konstante Aktienzahl") samt
ausdruecklicher ⚠-Vereinfachungsnotiz analog zu
`OWC_STOCK_SIMPLIFICATION_NOTE`; maschinenlesbare Felder am Modellergebnis;
Mitfuehrung in `buildDataBasisReport().dilution` und
`buildSnapshotForecastTargets().dilution` / `.terminal`. Auch die
Buyback-Diagnose nennt dieselbe Grenze.
Bewusst NICHT getan: keine automatische ewige Fortschreibung historischer
Verwaesserungs- oder Rueckkaufraten (`_terminalSharesGrowthPa` ist immer 0),
keine neue Einstellungsoberflaeche (`R33` prueft, dass eine erfundene Annahme
wirkungslos bleibt), keine Aenderung des Terminalwerts. Die alternative
Rechnung bleibt als **klar bedingte Sensitivitaet** dokumentiert (Faktor > 2
im geprueften Fall) — sie ist eine Annahme ueber das einzelne Unternehmen,
kein Sollwert.

**A-6 — fehlende D&A nicht still auf null.** `computeMidCycleFcf()` loest D&A
jetzt ueber `_resolveMidCycleDa(mj, revTtm)` auf, periodengleich zu
`revenue[0]`, in der bestehenden Vorrangfolge: ausdrueckliche Nutzerannahme →
direkt gemeldeter Wert der bewerteten Periode (`EBITDA[0] − EBIT[0]`, eine
gemeldete 0 bleibt eine Messung) → zulaessige Ableitung aus anderen Perioden
derselben Sicht (als `daDerived` gekennzeichnet) → sonst
`status: 'insufficient_data'` mit Begruendung. Widersprechende Periodenarten
von D&A-Quelle und bewerteter Periode gelten als nicht periodengleich
(`daBasis: 'period_conflict'`). Wirkung: `ebitda[0]=null` ergibt jetzt 150M
statt 100M; ohne EBITDA gibt es **keine** Referenz-FCF-Zahl und **keine**
Abweichungswarnung mehr; der Mid-Cycle-Hinweis nennt die D&A-Herkunft.

**A-7 — Buyback-Zuschlag auch im Mid-Cycle-Pfad.** Neu:
`_resolveActiveDcfModelResult(valuationResult)` liefert **genau ein**
Modellergebnis (Reihenfolge des Routers, ergaenzt um
`['dcf','DCF','dcf_midcycle']`; nicht anwendbare Modelle uebersprungen) —
damit ist eine Doppelzaehlung ausgeschlossen. Schwellen (>25 % / >10 %) und
Zuschlagshoehen (+10 pp / +5 pp) sind unveraendert. Der Zuschlag wirkt wie
bisher ausschliesslich auf die Sicherheitsmarge: der Fair Value ist in allen
Baendern identisch (12,796287825470817), nur der Buy Price wird konservativer.

**O-3 — Nullstellensuche abgesichert.** Drei Festlegungen; Raster,
Schrittweite, Abbruchtoleranz und Einschachtelung bleiben unveraendert:
(1) jede Nullstelle wird mit der echten Bewertungsfunktion nachgerechnet und
muss die Residualtoleranz erfuellen (`residualRelTol = 1e-3` des Zielkurses,
Untergrenze `1e-9`); die Einschachtelung liefert nur bei bestaetigtem
Vorzeichenwechsel einen Wert. (2) Ist genau ein Rand eines Rasterintervalls
auswertbar, wird die Auswertbarkeitsgrenze eingeschachtelt und dort regulaer
nach der Nullstelle gesucht. (3) Bleibt ein Intervall unaufgeloest, entsteht
der neue Status `search_incomplete` statt `no_solution_in_range`, mit
`searchComplete`, `uniquenessProven`, `unresolvedIntervalsPct` und
`evaluableRangePct` am Ergebnis. Die Begruendungen benennen die tatsaechlich
auswertbaren Raender statt die Rasterraender.

### 4 · Einordnung der beiden O-3-Teilbefunde

* **(b) bestaetigt und behoben.** Mit Daten erreichbar (cash-reicher, knapp
  profitabler Titel mit hoher Working-Capital-Quote): Kurs 20,02 wird jetzt
  mit 16,654 % erklaert, Residuum 4,1·10⁻⁶ je Aktie.
* **(a) NICHT mit Daten erreichbar.** Ueber 72.000 Parametersaetze (dichtes
  Raster, Schritt 0,05 pp; Marge, OWC-Quote, CapEx, D&A, tg/WACC, Fade,
  Steuerquote) war die Menge der auswertbaren Wachstumsraten stets ein
  ZUSAMMENHAENGENDES Intervall — ein eingeschachtelter Vorzeichenwechsel kann
  deshalb keine Luecke enthalten. Der Pfad ist trotzdem abgesichert und mit
  einem **kuenstlich eingespeisten Funktionsfehler** geprueft (`R36`, Fall D).
  Das ist ausdruecklich **kein** Nachweis eines real auftretenden
  Bewertungsfehlers. Der Scan ist auch **kein Beweis** fuer alle denkbaren
  Eingaben.

### 5 · Tests

`B6`, `B7` und `B8` sind **ersetzt**, nicht nur ergaenzt:

| Test | ersetzt | sichert ab |
|---|---|---|
| `R33` | `B6` | A-5 als erklaerte Modellkonvention: Rechnung bit-genau unveraendert, maschinenlesbare Felder, sichtbarer Hinweis mit Zeitraum, Herkunft und Snapshot, keine ewige Fortschreibung, keine neue Einstellung, alternative Rechnung als bedingte Sensitivitaet |
| `R34` | `B7` | A-6: direkter Wert, echte Null als Messung, zulaessige Ableitung, gesetzte Annahme (auch 0), widersprechende Perioden, Nichtverfuegbarkeit ohne Zahl und ohne Abweichungswarnung, Wirkung auf `modelDcfMidcycle` |
| `R35` | `B8` | A-7 ueber den ECHTEN Weg `runValuationEngine` → `runFairValueSynthesizer` (keine nachgebildete Schluesselauswahl): Schwellen unterhalb/auf/oberhalb, nicht anwendbares DCF-Modell, gar kein Modell, kein doppelter Zuschlag, Fair Value unveraendert |
| `R36` | — (neu) | O-3: Nullstelle im Lueckenintervall wird gefunden UND nachgerechnet, unvollstaendige Suche als solche gemeldet, negative und positive Wachstumswerte, Bereichsgrenzen, Nichtverfuegbarkeit, Robustheit gegen eingespeisten Funktionsfehler |

**In `tests/audit-chat12.test.mjs` steht damit kein Charakterisierungstest
mehr** — alle Tests dieser Datei pruefen richtiges Verhalten. Einzige
Einordnung: `R33` prueft eine offengelegte Annahme, keine Wertkorrektur.

**Berichtigte Erwartung.** Die festgeschriebene Liste
`DATA_BASIS_REQUIRED_HELPERS` in `tests/sec-ttm.test.mjs` wurde um
`TERMINAL_DILUTION` ergaenzt (mit Begruendung im Test): der Ausweis der
Datenbasis nennt die Terminalannahme jetzt als Modellkonvention und zieht die
Deklaration mit, statt den Text zu kopieren. Sonst wurde **keine** fachlich
korrekte Testerwartung angepasst; `R1`–`R32` bestehen unveraendert.

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 190 Node-Tests · Exit 0.** Node-Tests 189 → 190
(−3 entfernte Befund-Nachweise, +4 neue Regressionstests).

### 6 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium wurden vier Datensaetze ueber
`importMasterJsonFromTextarea()` eingelesen:

* **A-5 (DILU, +8 %/y Verwaesserung):** sichtbar „Shares-Projektion: 126.0M
  (Jahr 0) → 272.0M (Jahr 10) bei +8.00%/y · Dilution (Aktienanzahl steigt) —
  im Hauptwert beruecksichtigt fuer die Detailjahre 1–10; ab dem
  Terminalzeitpunkt konstante Aktienzahl", die ⚠-Vereinfachungsnotiz und die
  Trennung der Effekte mit Zeitraum.
* **A-6/A-7 (CYCB, −8 %/y Rueckkaeufe):** „Referenz-FCF 113M inkl. D&A 50M ·
  direkt gemeldet: EBITDA − EBIT der bewerteten Periode"; „Auch die Diagnose
  rechnet die Aktienreduktion nur bis Jahr 10"; „Buyback-Dependency Add-on
  (Uplift 94.4%, Kapitalallokationsrisiko)". Gemessen: `buybackAddon: 0.1`,
  Fair Value 12,7963, `_midCycleDaBasis: 'reported_period'`,
  `_dilutionAppliedInTerminalValue: false`.
* **A-6 (CYCN, ohne EBITDA):** „Mid-Cycle-Marge nicht ableitbar:
  Abschreibungen (D&A) der bewerteten Periode nicht belegt …"; Modell nicht
  anwendbar, Synthesizer `no_models_applicable`, kein Ersatzwert.
* **O-3 (O3GAP):** bei Kurs 20,02 `ok` mit 16,654 % und Residuum 4,1·10⁻⁶;
  bei Kurs 19,50 zeigen beide Reverse-DCF-Anzeigen „Suche unvollstaendig —
  Nichtexistenz nicht bewiesen" samt Begruendung mit dem auswertbaren Bereich
  (−20,00 % bis 16,50 %) und dem unaufgeloesten Intervall (16,50–17,00 %).

Keine JavaScript-Fehler; die einzigen Konsolenmeldungen sind fehlgeschlagene
externe Ressourcenabrufe (kein Netz) ohne Bezug zur Aenderung.

### 7 · Verbleibende Pruefgrenzen

* **A-5 ist offengelegt, nicht behoben.** Bei dauerhaft verwaessernden
  Geschaeftsmodellen bleibt der Wert je Aktie tendenziell zu hoch; das ist
  jetzt sichtbar, aber nicht korrigiert. Ob die Annahme fuer ein bestimmtes
  Unternehmen zutrifft, wird vom Werkzeug nicht geschaetzt.
* **O-3 (a):** kein produktiv erreichbarer Fehlerfall konstruierbar (siehe
  Abschnitt 4). Der Parameter-Scan ist kein Beweis fuer alle denkbaren
  Eingaben.
* Die **Residualtoleranz** ist auf den Zielkurs bezogen. Bei extrem steilem
  Wertverlauf koennte eine regulaere Nullstelle sie verfehlen; das Ergebnis
  waere dann `search_incomplete` statt `ok` — konservativ, aber nicht ideal.
  In den geprueften Faellen liegt der Abstand bei mehr als drei
  Groessenordnungen.
* **Keine Live-Validierung, kein reales Filing.** Die Browserpruefung ist
  punktuell (Abschnitt 6) und schliesst die Auditgrenze „keine Browser-/
  DOM-Pruefung" nicht.
* Gewichtung im Synthesizer, Einstiegszonen-Logik und Datenqualitaets-Gates
  bleiben ueber A-7 hinaus **ungeprueft**; die Nicht-DCF-Modelle wurden nicht
  auf innere Konsistenz geprueft.
* Alle Grenzen aus 12A und 12B.1–12B.3 bleiben bestehen.
* Dies ist **keine Bestaetigung**, dass das Werkzeug fehlerfrei ist, und
  **keine Aussage** ueber die Qualitaet der erzeugten Bewertungen.

### 8 · Bearbeitungsstand nach diesem Schritt

**Fehler behoben und abgesichert**

* **A-1, A-2, A-3** (12A) — `R1`–`R9`
* **A-4** (12B, in 12B.1 berichtigt) — `R10`–`R12`, `R16`
* **O-1** (12B, in 12B.1 erweitert) — `R13`, `R17`
* **O-2** (12B; Nachweis in 12B.1 umgestellt) — `R14`
* **12B.1** Schuldenumfang, Leasing, unklare Nettoschulden — `R16`–`R20`
* **12B.2** Schuldenaufloesung und TTM-Sperren — `R21`–`R27`
* **12B.3** Nichtnegativitaet im Schuldensolver — `R28`–`R32`
* **A-6** (12C) fehlende D&A nicht still auf null — `R34`
* **A-7** (12C) Buyback-Zuschlag im aktiven DCF-Modell — `R35`
* **O-3 (b)** (12C) uebersprungener Vorzeichenwechsel an einer Rasterluecke — `R36`

**Offengelegte Modellannahme (KEIN behobener Fehler)**

* **A-5** Verwaesserung wirkt in den Detailjahren 1–10, danach konstante
  Aktienzahl — benannt, mitgefuehrt und sichtbar gemacht; Rechnung
  unveraendert — `R33`

**Defensiv abgesichert ohne belegten Fehlerfall**

* **O-3 (a)** Abbruch bei nicht auswertbarem Intervallmittel — nicht mit Daten
  erreichbar; Absicherung mit eingespeistem Funktionsfehler geprueft — `R36`

**Weiterhin offene Pruefpunkte**

* Keine Live-Validierung bei SEC/Yahoo, kein reales Filing.
* Keine vollstaendige Browser-/DOM-Pruefung.
* Nicht-DCF-Modelle (RIM, RIM-Buyback, DDM, EPV-Floor, P/TBV-Gordon, Excess
  Return) nicht auf innere Konsistenz geprueft.
* Sektor-/Klassifikationstabellen, Gewichtung, Einstiegszonen-Logik und
  Datenqualitaets-Gates ueber A-7 hinaus ungeprueft.
* Keine Laufzeit- oder Sicherheitspruefung.

Damit sind alle im Audit von Chat 12 erhobenen Punkte A-1 bis A-7 und O-1 bis
O-3 bearbeitet. Das ist **keine** Zusicherung der Fehlerfreiheit und keine
Bewertung der Ergebnisqualitaet.

---

## Korrekturchat 12B.3: Nichtnegativitaet im Schuldensolver (V1.0.62)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12b2-debt-completeness`**, Ausgangscommit
**`26568a974f83b2a6fc4a9c31135c9ba61c8b1e01`** — zugleich die Branch-Spitze;
Abstammung geprueft (`git merge-base --is-ancestor`), nachfolgende Aenderungen
gab es nicht. `main` wurde nicht angefasst. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12b3-debt-nonnegative`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Eine `AGENTS.md` existiert in diesem Repository nicht.
Testbefehl: `npm test`.

**Bestaetigter Teststand vor der Aenderung** (selbst ausgefuehrt auf `26568a9`):
1700 Rechen-Assertions · 434 Fixture-Assertions · 184 Node-Tests · Exit 0 —
wie im Auftrag erwartet.

**Auftrag.** Ausschliesslich zwei Restfehler in der Nichtnegativitaetspruefung
von `_solveDebtEvidence()`. Die fuenf Korrekturen aus 12B.2 bleiben erhalten;
Import, Taxonomietabelle, TTM-Aufbereitung und Bewertungsmodelle wurden nicht
umgestaltet. A-5, A-6, A-7 und O-3 bleiben fuer 12C unangetastet.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Unveraendert die Taxonomiebasis aus 12B.1 (FASB-Taxonomie 2025, aus der
Auftragsvorgabe, **nicht selbst an der Quelle geprueft** — der Egress-Proxy
dieser Umgebung sperrt `xbrl.fasb.org`). Dieser Schritt aendert keine
Tag-Definition, sondern allein die Rechenregel. Alle Nachweise sind
**synthetische Importtests** ueber den produktiven Pfad — **keine
Live-Validierung**, kein reales Filing.

### 2 · Reproduktion am unveraenderten Ausgangsstand

Beide Befunde wurden zuerst auf `26568a9` ueber
`importSecFacts(secFactsWithDebt(...))` reproduziert, jeweils periodengleich
ueber vier Jahre.

**Befund 1 — unmoegliche Schuldenaufteilung wird akzeptiert.**
`DebtAndCapitalLeaseObligations` 100, `LongTermDebtNoncurrent` 70,
`FinanceLeaseLiabilityNoncurrent` 50. Die beiden DISJUNKTEN langfristigen
Bestandteile ergeben 120 und uebersteigen die Gesamtschulden von 100; eine
nichtnegative Aufteilung existiert nicht.

| | vorher | nachher |
|---|---|---|
| Gesamtschuld | gilt als vollstaendig | **nicht vollstaendig** |
| Nettoschuldenbruecke | verfuegbar (0M) | **nicht verfuegbar**, mit Begruendung |
| kurzfr. Finanzschulden | **−20, Status „measured"** | unbekannt |
| OWC-Quote | **−22 %** | nicht ermittelbar (ausdruecklich gekennzeichnet) |
| `modelDcf(mj, scOf(8, 2, 10, 20))` | anwendbar, **≈ 31,43082** | nicht anwendbar |
| Widerspruchswarnung | **keine** | nennt beide Bestandteile und die Gesamtangabe |

**Befund 2 — belegte Gesamtschuld 0 wird nicht ausgewertet.**
`DebtAndCapitalLeaseObligations` = 0, keine Aufschluesselung.

| | vorher | nachher |
|---|---|---|
| Gesamtschulden | 0 (richtig) | 0 |
| kurzfr. Finanzschulden | **unbekannt** | **belegte 0** |
| `_resolveOwcForForecast()` | `available:false`, `measured:false`, `assumptionRequired:true`, Platzhalter 0 % | `available:true`, `measured:true`, `assumptionRequired:false` |
| OWC-Quote | — | **−20 %** (= ((400 − 100) − (500 − 0)) / 1000) |
| verwertbare Jahre | 0 | **4** |

### 3 · Die Korrektur (eng begrenzt auf `_solveDebtEvidence()`)

V1.0.61 prueferte nur, ob der Zielvektor im **Zeilenraum** von `A` liegt. Unter
`x ≥ 0` ist das in beide Richtungen unzureichend: es akzeptierte Systeme ohne
zulaessige Loesung (Befund 1) und hielt durch die Nichtnegativitaet eindeutig
festgelegte Zielsummen fuer unbekannt (Befund 2).

Die zulaessige Menge `P = { x ∈ R⁵ : A x = b, x ≥ 0 }` wird jetzt
**vollstaendig und exakt** beschrieben:

* `P` ist spitz (`x ≥ 0` enthaelt keine Gerade) ⇒ `P ≠ ∅` genau dann, wenn `P`
  eine **Ecke** hat. Ecken sind Basisloesungen: Traeger mit linear
  unabhaengigen Spalten, eindeutigem und nichtnegativem `x_S`.
* Nach Minkowski/Weyl ist `P = conv(Ecken) + cone(Extremstrahlen)`;
  Extremstrahlen sind Traeger mit eindimensionalem Nullraum und
  vorzeichengleichem Erzeuger.
* Beides entsteht durch Aufzaehlung **aller 32 Traeger** — keine
  Optimierungsbibliothek, keine neue Laufzeitabhaengigkeit, kein
  Naeherungsverfahren.

Daraus die geforderte Dreiteilung:
1. keine Ecke ⇒ **Widerspruch**;
2. Spannweite der Zielsumme ueber `P` groesser als die Toleranz ⇒ **unbekannt**;
3. Spannweite null ⇒ **bestimmt** — auch bei offenen Einzelzellen und dort, wo
   der Zeilenraumtest allein nicht reicht (Befund 2).

Ergaenzt wurde eine **verallgemeinerte Teilmengenpruefung**: mehrere paarweise
DISJUNKTE Teilangaben duerfen zusammen die Gesamtangabe nicht uebersteigen.
Die bisherige Pruefung war davon der Sonderfall mit einer Teilangabe — genau
diese Luecke war Befund 1. Sie liefert die konkrete Begruendung
(„70,0M + 50,0M = 120,0M uebersteigen zusammen … (100,0M)").

Bewusst NICHT getan: negative Zielwerte lediglich abfangen; negative Ergebnisse
pauschal auf null klemmen; einen beliebigen zulaessigen Loesungspunkt als
eindeutige Aufteilung ausgeben. Unbeschraenkte oder mehrdeutige Zielgroeszen
bleiben unbekannt.

**Toleranz.** Unveraendert 0,01 % der groeszten Angabe, mindestens `1e-6`.
Sie ist so eng, dass eine materiell unmoegliche Aufteilung nicht durchrutscht:
Befund 1 verfehlt die Zulaessigkeit um 20 von 100, also um das 200-fache der
Toleranz. Eine rundungsbedingt leicht negative Zielsumme wird **nicht**
geklemmt, sondern aus der zulaessigen Menge genommen (deren Ecken `x ≥ 0`
erfuellen).

**Unveraendert:** Schnittstelle und Statuskonventionen von
`_solveDebtEvidence()`, die Helferlisten der Modul-Lader (die neuen
Hilfsfunktionen liegen bewusst innerhalb der Funktion), die Regeln fuer
eigenstaendig belegte oder manuell gesetzte Nettoschulden, die Altdatenregel
und alle fuenf Korrekturen aus 12B.2.

### 4 · Gemessene Wirkung weiterer Faelle

| Fall | Ergebnis |
|---|---|
| `DebtCurrent` 0 + `Noncurrent` 70 (Teilbetrag 0) | kurzfr. Schulden **belegte 0**, Gesamtschuld **bleibt offen** (langfr. Leasing) ⇒ Bruecke gesperrt |
| … zusaetzlich `FLNoncurrent` 0 | Gesamt **70**, ND **−30**, kurzfr. 0 |
| Gesamt 1.000 + `Noncurrent` 700 | Gesamt belegt (ND 900), kurzfr. Summe in [0, 300] ⇒ **unbekannt** |
| `DebtCurrent` 300 + `Noncurrent` 700 + `FLNoncurrent` 0 | kurzfr. **300 bestimmt**, obwohl die Einzelzellen offen sind; OWC +10 % |
| Gesamt 1.000 vs. 700 + 300,05 (0,005 %) | zulaessige Rundung, kurzfr. **0** (nicht negativ, nicht geklemmt) |
| Gesamt 1.000 vs. 700 + 350 | **Widerspruch**, Bruecke gesperrt |

### 5 · Tests

**Neue Regressionstests**

| Test | sichert ab |
|---|---|
| `R28` | unmoegliche Aufteilung ⇒ Widerspruch; keine gemessene negative Schuld, keine OWC-Quote; operativer Wert bleibt; manuelles `net_debt` weiterhin zulaessig; echter Engine-/Synthesizer-Pfad ohne Gewicht und Einstiegszone |
| `R29` | belegte Gesamtschuld 0 ⇒ kurzfr. Schulden belegte 0, OWC −200 bzw. −20 %, vier verwertbare Jahre, keine Nutzereingabe noetig |
| `R30` | Abgrenzung: ein Teilbetrag 0 belegt nur seine eigenen Bestandteile, nicht die uebrigen Schulden |
| `R31` | Mehrdeutigkeit bleibt unbekannt; Zielsumme bestimmt trotz offener Einzelzellen; zulaessige Rundung; materieller Widerspruch; konsistente Daten unveraendert |
| `R32` | dieselbe Korrektur erreicht die **TTM-Aufloesung** ueber die vorhandenen TTM-Testhilfen (beide Hauptfaelle), kein separater Solver |

**Berichtigte Erwartung.** `R25` prueferte fuer den Fall „DebtCurrent 300 gegen
laufende Faelligkeiten 100 + kurzfristiges Leasing 250" auf den Wortlaut
`unvereinbar` — die generische Meldung ueber einen negativen Zellwert. Derselbe
Fall wird jetzt von der **praeziseren** Pruefung auf disjunkte Teilangaben
gefangen, die beide Bestandteile und die Gesamtangabe benennt. Der Befund ist
unveraendert; die Erwartung akzeptiert nun beide Formulierungen. Die
inhaltlichen Zusicherungen von `R25` sind unveraendert. Sonst wurde **kein**
fachlich korrekter Fixture angepasst.

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 189 Node-Tests · Exit 0.** `R21`–`R27` bestehen
unveraendert. Node-Tests 184 → 189 (+5). Laufzeit unveraendert im
Sekundenbereich.

### 6 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium (Playwright) wurden beide Faelle ueber
`importMasterJsonFromTextarea()` eingelesen:

* **Befund 1:** `scopeComplete: false`, Bruecke nicht verfuegbar, DCF nicht
  anwendbar; sichtbar „⚠ Nettoschulden nicht ermittelbar (fehlend: total_debt
  (Umfang unvollstaendig)) — der DCF liefert deshalb KEINEN Eigenkapitalwert je
  Aktie …" und die Begruendung „die gemeldeten Bestandteile … (70.0M) + …
  (50.0M) = 120.0M uebersteigen zusammen … (100.0M)".
* **Befund 2:** Bruecke verfuegbar (−100), OWC sichtbar als „historischer
  Median -20.00% des Umsatzes ueber 4 lueckenlose Jahre — gemessen aus
  Bilanzdaten".
* Keine JavaScript-Fehler; die einzige Konsolenmeldung ist ein
  fehlgeschlagener externer Ressourcenabruf (kein Netz) ohne Bezug zur
  Aenderung.

### 7 · Verbleibende Pruefgrenzen

* **Keine eigene Pruefung der Primaerquelle** (Abschnitt 1).
* **Kein reales Filing.** Synthetische Importtests sind keine Live-Validierung.
* Die Aufzaehlung ist auf die feste Dimension `n = 5` zugeschnitten. Bei einer
  sechsten Bilanzzelle bliebe das Verfahren richtig (2⁶ Traeger), die
  Laufzeitannahme waere aber neu zu pruefen.
* „`P` nichtleer ⇔ `P` hat eine Ecke" gilt, weil alle Variablen nach unten
  durch 0 beschraenkt sind; bei vorzeichenfreien Groeszen waere das nicht so.
* Die Grenzen aus 12B.2 bleiben bestehen — insbesondere gilt eine Bilanz, die
  einen Bestandteil gar nicht erwaehnt, weiterhin als nicht belegt.
* Beobachtung ohne Aenderung (auszerhalb des Auftrags): `long_term_debt` ist
  eine PFLICHT-Reihe der TTM-Basis. Meldet ein Filer nur ein Gesamt-Tag, bleibt
  die TTM-Basis unvollstaendig und die Jahressicht gilt — unabhaengig von
  dieser Korrektur. In `R32` wird die Reihe deshalb ausdruecklich mit 0
  gemeldet.
* Dies ist **keine Bestaetigung**, dass der Rest des Werkzeugs fehlerfrei ist.

### 8 · Bearbeitungsstand nach diesem Schritt

**Behoben und abgesichert**

* **A-1, A-2, A-3** (12A) — `R1`–`R9`
* **A-4** (12B, in 12B.1 berichtigt) — `R10`–`R12`, `R16`
* **O-1** (12B, in 12B.1 erweitert) — `R13`, `R17`
* **O-2** (12B; Nachweis in 12B.1 auf passende Daten umgestellt) — `R14`
* **12B.1** Schuldenumfang, Leasing, unklare Nettoschulden — `R16`–`R20`
* **12B.2** Schuldenaufloesung und TTM-Sperren — `R21`–`R27`
* **12B.3** Nichtnegativitaet im Schuldensolver — `R28`–`R32`

**Weiterhin offen (nicht angefasst, Korrekturchat 12C vorbehalten)**

* **A-5** Verwaesserung endet im Terminalwert bei Jahr 10 (`B6` gruen)
* **A-6** `computeMidCycleFcf()` setzt fehlende D&A still auf 0 (`B7` gruen)
* **A-7** Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie (`B8` gruen)
* **O-3** Randfaelle der Nullstellensuche im Reverse DCF — unbestaetigt

Die Einschraenkungen der Vorschritte bleiben offen.

**Ausgangsbasis fuer Korrekturchat 12C: `claude/chat12b3-debt-nonnegative`.**
Dieser Branch **ersetzt** dafuer `claude/chat12b2-debt-completeness`.

---

## Korrekturchat 12B.2: Schuldenaufloesung und TTM-Sperren (V1.0.61)

> **ERGAENZT durch Korrekturchat 12B.3 (V1.0.62).** Der hier eingefuehrte
> Solver pruefte nur den ZEILENRAUM. Unter der Nebenbedingung `x >= 0` reicht
> das nicht: er akzeptierte Systeme ohne zulaessige nichtnegative Loesung
> (gemeldete Gesamtschuld 100 gegen disjunkte Bestandteile 70 + 50) und hielt
> Zielsummen fuer unbekannt, die durch die Nichtnegativitaet eindeutig
> festliegen (belegte Gesamtschuld 0). Beides ist in 12B.3 behoben; die fuenf
> Korrekturen dieses Schrittes bleiben unveraendert.

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12b1-debt-scope-fixes`**, Ausgangscommit
**`215108f3743bf11dddec97efc8ea940d015cbf84`** — zugleich die Branch-Spitze;
nachfolgende Aenderungen gab es nicht (geprueft nach `git fetch --prune`).
`main` wurde nicht angefasst. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12b2-debt-completeness`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Eine `AGENTS.md` existiert in diesem Repository nicht.
Testbefehl: `npm test`.

**Bestaetigter Teststand vor der Aenderung** (selbst ausgefuehrt auf `215108f`):
1700 Rechen-Assertions · 434 Fixture-Assertions · 177 Node-Tests · Exit 0 —
wie im Auftrag erwartet.

**Auftrag.** Ausschliesslich die fuenf Restbefunde nach 12B.1 samt
notwendigen Verbrauchern und Regressionstests. A-5, A-6, A-7 und O-3 bleiben
fuer 12C unangetastet.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Der Abruf von
`https://xbrl.fasb.org/us-gaap/2025/elts/us-gaap-doc-2025.xml` war **auch in
diesem Schritt nicht moeglich** (Egress-Proxy dieser Umgebung: HTTP 403 auf
CONNECT). Die Definitionen stammen aus der Auftragsvorgabe und sind hier
**nicht selbst an der Quelle geprueft**. Alle Nachweise sind **synthetische
Importtests** ueber den produktiven Pfad — **keine Live-Validierung**, kein
reales Filing.

### 2 · Reproduktion am unveraenderten Ausgangsstand

Alle fuenf Befunde wurden zuerst auf `215108f` reproduziert, ueber
`importSecFacts(secFactsWithDebt(...))` bzw. den echten TTM-Weg
(`buildTtmDatasetFromFacts` → `resolveDataBasis` → `buildValuationBasisView`):

| # | Datensatz | vorher |
|---|---|---|
| 1 | `LTD&Cap` 1.000 + `DebtCurrent` 300 **gegen** `Noncurrent` 700 + `FLNoncurrent` 300 + `DebtCurrent` 300 | 1.000 / ND 900 / FV 19,61913 **gegen** 1.300 / ND 1.200 / FV 16,61913 |
| 2 | `LongTermDebt` 1.000 + `DebtCurrent` 150, TTM-Weg | FY gesperrt, TTM wieder verfuegbar (ND 900, FV 20,49778) |
| 3 | nur `LTD&Cap` 1.000 | trotz `scopeNoncurrentOnly` ND 900 und anwendbarer DCF (20,49778) |
| 4 | `LongTermDebt` 1.000 + `DebtCurrent` 150 + `LongTermDebtCurrent` 100 | „Ueberschneidung nicht aufloesbar" ⇒ gesperrt, obwohl 1.000 + 150 − 100 = 1.050 bestimmt ist |
| 5 | `Noncurrent` 700 + `DebtCurrent` 300 + `FLCurrent` **350** | Leasingwert nur uebersprungen; OWC und Bewertung verfuegbar, keine Widerspruchsmeldung |

### 3 · Aenderungen am Produktcode

**Die Aufloesung ist ein Gleichungssystem.** Jede gemeldete Angabe ist eine
Gleichung „Summe ihrer Zellen = Wert" (`_solveDebtEvidence`). Die gesuchte
Groesze ist genau dann bestimmt, wenn ihr Zellvektor im **Zeilenraum** liegt.
Damit entscheidet die nachgewiesene **Abdeckung** — nicht das Vorhandensein
eines Zahlenwerts, nicht die Reihenfolge, nicht „groeszerer Wert", nicht die
Prozentabweichung und nicht die Anzahl vorhandener Komponenten. Aus der
Nichtnegativitaet folgen zwei prueferbare Widersprueche: ein enthaltener
Teilbetrag groeszer als die Gesamtheit, und ein rechnerisch negativer
Zellwert. Toleranz: 0,01 % der groeszten Angabe, mindestens 1e-6.

`_resolveDebtHistory(f, zielzellen, label)` ist die gemeinsame Auflosung;
`_resolveShortTermDebtHistory` und das neue `_resolveTotalDebtHistory` sind
nur zwei Ziele darauf. **Rebuild, kurzfristige Finanzschulden und
Nettoschuldenbruecke verwenden dieselbe Evidenz.**

**Befund 1 — zusammengefasste Betraege.** `buildDebtScopeSeries` ersetzt
`buildPeriodAlignedComponentSeries`: es zaehlt jetzt **jede** Schuldenreihe als
Evidenz, auch der direkte `total_debt`-Wert mit seinem tatsaechlichen Umfang.
Die frueheren Entscheidungsregeln (5-%-Schwelle, „groeszerer Wert",
Komponentenzahl) sind entfallen. Ein nachgewiesen vollstaendiger Umfang wird
als `scopeCells` + `scopeComplete: true` mitgefuehrt und ist damit selbst
Evidenz.

**Befund 2 — TTM.** `buildValuationBasisView()` bestimmt den Umfang **fuer
ihren Stichtag selbst**:
* Der us-gaap-Tag stammt aus den **Quartalsdaten** (`used_tag` der TTM-Reihe),
  nicht blind aus der Jahresreihe; nur wenn die TTM-Reihe keinen Tag nennt,
  wird der Jahres-Tag uebernommen und als `source_tag_inherited` markiert.
* Die FY-Sperre wird **nicht** kopiert — neue Quartalsangaben loesen die
  Unklarheit tatsaechlich auf.
* Bleibt sie offen, entsteht gar kein abgeleitetes `net_debt` mehr; die
  Bruecke bleibt gesperrt.
* Die Pruefung laeuft **nach** dem Leeren der nicht gedeckten Reihen — sonst
  floessen Jahreswerte mit Jahresstichtagen als Evidenz ein.
* Dafuer sind die Schuldenkomponenten **optionale** TTM-Stichtagsgroeszen
  geworden (`SEC_QUARTERLY_FIELDS`, `TTM_INSTANT_FIELDS`,
  `TTM_OPTIONAL_INSTANT_FIELDS`). Fehlen sie, bleibt die TTM-Basis waehlbar,
  die Gesamtschuld gilt aber als nicht belegt. **Keine neuen Tags** — es
  werden die vorhandenen Listen der `SEC_TAG_MAP` verwendet.

**Befund 3 — Teilbetraege.** Die in 12B.1 bewusst belassene Ausnahme ist
entfallen. `_resolveNetDebtForDcfBridge()` sperrt jetzt bei
`scopeComplete !== true` (statt nur bei `scopeIndeterminate`). Die
heuristischen `assumedEmpty`-Regeln sind **ersatzlos entfernt**: eine fehlende
Angabe ist nicht deshalb Null, weil kein Tag gefunden wurde. Ausdrueckliche
Nullwerte und eigenstaendig belegte Gesamtbetraege funktionieren weiter;
manuell gesetzte Nettoschulden bleiben nach den bestehenden Vorrangregeln
zulaessig; eine manuelle OWC-Annahme loest eine unklare Gesamtschuld nicht auf.

**Befund 4 — bekannte Ueberschneidungen.** Sie werden durch das
Gleichungssystem aufgeloest, bevor „nicht aufloesbar" entschieden wird. Eine
anderweitige Datenluecke wird getrennt benannt (die Begruendung nennt die
tatsaechlich offenen Bestandteile, nicht die rechnerische Kopplung).

**Befund 5 — Widersprueche.** Vor dem Ueberspringen einer Aufschluesselung
wird ihre Vereinbarkeit geprueft. Ein ungeklaerter materieller Widerspruch
sperrt Schuldenbasis und Bewertung mit Begruendung; konsistente
Aufschluesselungen und ausdrueckliche Nullwerte aendern nichts.

**Altdatenregel.** Unveraendert: ohne **jeden** Periodenkontext gilt der
dokumentierte Positionsbezug, und es werden keine Umfangsmarker gesetzt —
die Bruecke verhaelt sich dort wie bisher. Bekannte Umfangsinformationen
werden aber genutzt: liegt ein Quell-Tag vor, gilt der regulaere Weg. Reihen
**mit** Perioden, deren Umfang unbekannt ist, sind ausdruecklich kein
Altdatenfall.

**Stabilitaet.** Wiederholte Aufbereitung erzeugt keine vervielfachten
Warnungen und keine veraltete Sperre nach behobener Datenluecke. Ein
unveraenderter Rebuild meldet `totalDebtTouched` nicht mehr faelschlich, damit
ein ausdruecklich gesetztes `net_debt` nicht ueberschrieben wird.

**Modul-Lader.** Die Tabellen stehen jetzt in einer einzigen Funktion
`_debtScopeTables()`; die Konstanten leiten sich daraus ab. So kann der Lader
der Datenschicht sie als Deklaration mitziehen — es bleibt bei genau **einer**
Semantikquelle.

### 4 · Gemessene Wirkung

| Fall | vorher | nachher |
|---|---|---|
| 1 A / 1 B | 1.000 / ND 900 / FV 19,61913 **gegen** 1.300 / ND 1.200 / FV 16,61913 | **beide 1.300 / ND 1.200 / FV 16,61913** |
| 1 + redundante Aufschluesselungen | — | 1.300 (kein Doppelzaehlen) |
| 2 (a) TTM unklar | ND 900 verfuegbar | **gesperrt**, kein abgeleitetes `net_debt` |
| 2 (b) TTM mit `LongTermDebtCurrent` | 1.000 / ND 900 | **1.050 / ND 950**, Tag `LongTermDebt` aus den Quartalsdaten |
| 3 nur `LTD&Cap` | ND 900, FV 20,49778 | **ND nicht verfuegbar**, kein Eigenkapitalwert, operativer Wert 29,50/Aktie bleibt |
| 3 + `DebtCurrent` 300 | — | 1.300 / ND 1.200 |
| 3 + `DebtCurrent` **0** (ausdrueckliche Null) | — | 1.000 / ND 900 / kurzfr. 0 |
| 4 mit `LongTermDebtCurrent` | gesperrt | **1.050 / ND 950 / FV 20,43711** |
| 4 ohne `LongTermDebtCurrent` | gesperrt | gesperrt (unveraendert richtig) |
| 5 Widerspruch 350 > 300 | 1.000 / ND 900 / FV 19,61913 | **gesperrt** mit Begruendung |
| 5 konsistent (50) bzw. ausdrueckliche Null | — | identisch zur Referenz ohne Aufschluesselung |

### 5 · Tests

**Neue Regressionstests**

| Test | sichert ab |
|---|---|
| `R21` | zusammengefasste langfristige Betraege; zwei Darstellungen identisch; redundante Aufschluesselung zaehlt nicht doppelt; unvollstaendige Summe verdeckt nichts |
| `R22` | TTM ueber den **echten** Weg: (a) Unklarheit bleibt ⇒ gesperrt, (b) Quartalsangabe loest auf ⇒ verfuegbar, (c) Herkunft aus den Quartalsdaten statt blinder Uebernahme; keine stille Ergaenzung aus Jahresdaten |
| `R23` | Teilbetraege sind keine Gesamtschuld; Ergaenzung nur periodengleich; ausdrueckliche Null und eigenstaendiger Gesamtbetrag funktionieren; manuelle OWC-Annahme loest nichts; manuelles `net_debt` bleibt zulaessig |
| `R24` | bekannte Ueberschneidung wird aufgeloest (1.050); Reihenfolge und Redundanz aendern nichts; Gegenprobe ohne die Angabe sperrt; andere Datenluecke wird getrennt benannt |
| `R25` | Widerspruch Teilbetrag > Gesamtheit; Widerspruch ueber die Nichtnegativitaet; konsistente Aufschluesselung und Null aendern nichts; Rundung bleibt zulaessig |
| `R26` | echter Engine-/Synthesizer-Pfad: gesperrter DCF ohne Gewichtung und Einstiegszone; Statusweitergabe an Mid-Cycle, Reverse DCF, Matrix und Monte Carlo |
| `R27` | wiederholte Aufbereitung stabil; keine veraltete Sperre nach behobener Datenluecke |

**Berichtigte Erwartungen** (fachlich falsch, keine Toleranzlockerung):

* Die synthetischen Filer in `_testTtmIntegrationFixes`, `_testDataBasis`,
  `_testTtmSharePeriodFixes` und `tests/sec-ttm.test.mjs` wiesen ihre
  **Gesamtverschuldung** mit `LongTermDebtAndCapitalLeaseObligations` aus —
  einem rein noncurrent-Konzept. Sie verwenden jetzt
  `DebtAndCapitalLeaseObligations`; alle Erwartungswerte bleiben unveraendert.
* Die Platzhalter-Tags `'test'` / `'Test'` (T-NDLOCK, `_testDataBasis`) haben
  keinen belegbaren Umfang; die Schuldenreihen tragen jetzt das gemeinte
  Konzept.
* `T-DEBT-DEDUP1`–`3` dokumentierten nur die langfristige Seite; sie melden
  jetzt ausdrueckliche Nullwerte fuer die uebrigen Bestandteile. Die
  Dedup-Aussage (kein Doppelzaehlen auf 800) bleibt prueferbar.
* `R12`–`R18` laufen auf **vollstaendig dokumentierten** Datensaetzen
  (`fullyDocumented()` / `noNoncurrentLeases()`); die Ausnahme fuer
  noncurrent-Teilbetraege in `R16` ist **berichtigt**.
* Die festgeschriebenen Listen `SEC_QUARTERLY_FIELDS` und
  `DATA_BASIS_REQUIRED_HELPERS` wurden mit Begruendung aktualisiert.

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 184 Node-Tests · Exit 0.** Die 1700 Rechen-Assertions und
alle 434 Fixture-Assertions sind gruen; Node-Tests 177 → 184 (+7).

### 6 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium (Playwright) wurden beide Sperrfaelle ueber
`importMasterJsonFromTextarea()` eingelesen:

* **Befund 3:** `scopeComplete: false`, Bruecke nicht verfuegbar, DCF nicht
  anwendbar; sichtbar „⚠ Nettoschulden nicht ermittelbar (fehlend: total_debt
  (Umfang unvollstaendig)) — der DCF liefert deshalb KEINEN Eigenkapitalwert
  je Aktie. Der operative Unternehmenswert betraegt 29.50/Aktie …".
* **Befund 5:** Begruendung „… (350.0M) ist in debt_short_term (DebtCurrent)
  (300.0M) enthalten, kann als nichtnegativer Teilbetrag aber nicht groeszer
  sein".
* Keine JavaScript-Fehler; die einzige Konsolenmeldung ist ein
  fehlgeschlagener externer Ressourcenabruf (kein Netz) ohne Bezug zur
  Aenderung.

### 7 · Grenzen dieses Schrittes

* **Keine eigene Pruefung der Primaerquelle** (Abschnitt 1).
* **Kein reales Filing.** Synthetische Importtests ueber den produktiven Pfad
  sind keine Live-Validierung.
* Eine Bilanz, die einen Bestandteil gar nicht erwaehnt, gilt als **nicht
  belegt** — auch wenn der Filer schlicht nichts davon hat. Solche Abschluesse
  sind ohne ausdrueckliche Nullangabe oder ein Gesamt-Tag nicht mehr ueber die
  Eigenkapitalbruecke bewertbar. Das ist die beabsichtigte Folge von Befund 3;
  der operative Unternehmenswert bleibt verfuegbar. Fuer Datensaetze ohne
  jeden Periodenkontext gilt unveraendert die Altdatenregel.
* Fuer `LongTermDebt` gilt die Lesart der Auftragsvorgabe (einschliesslich
  laufender Faelligkeiten, ohne Leasing).
* Nennt eine TTM-Reihe keinen Tag, wird ersatzweise der Jahres-Tag uebernommen
  und als `source_tag_inherited` gekennzeichnet.
* Die beiden DOM-Formulartests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben wie bisher ausgewiesen uebersprungen.
* Dies ist **keine Bestaetigung**, dass der Rest des Werkzeugs fehlerfrei ist.

### 8 · Bearbeitungsstand nach diesem Schritt

**Behoben und abgesichert**

* **A-1, A-2, A-3** (12A) — `R1`–`R9`
* **A-4** (12B, in 12B.1 berichtigt) — `R10`–`R12`, `R16`
* **O-1** (12B, in 12B.1 erweitert) — `R13`, `R17`
* **O-2** (12B; Nachweis in 12B.1 auf passende Daten umgestellt) — `R14`
* **12B.1** Schuldenumfang, Leasing, unklare Nettoschulden — `R16`–`R20`
* **12B.2** Schuldenaufloesung und TTM-Sperren — `R21`–`R27`

**Weiterhin offen (nicht angefasst, Korrekturchat 12C vorbehalten)**

* **A-5** Verwaesserung endet im Terminalwert bei Jahr 10 (`B6` gruen)
* **A-6** `computeMidCycleFcf()` setzt fehlende D&A still auf 0 (`B7` gruen)
* **A-7** Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie (`B8` gruen)
* **O-3** Randfaelle der Nullstellensuche im Reverse DCF — unbestaetigt

Die Einschraenkungen der Vorschritte bleiben offen.

**Ausgangsbasis fuer Korrekturchat 12C: `claude/chat12b2-debt-completeness`.**
Dieser Branch **ersetzt** dafuer `claude/chat12b1-debt-scope-fixes`.

---

## Korrekturchat 12B.1: Schuldenumfang, Leasing, unklare Nettoschulden (V1.0.60)

> **TEILWEISE BERICHTIGT durch Korrekturchat 12B.2 (V1.0.61).** Die dort
> bewusst belassene Ausnahme — ein rein langfristiger Teilbetrag bleibt als
> Gesamtschuld in Gebrauch, weil der Fall „sonst nicht bewertbar" waere — ist
> **nicht zulaessig**: eine Warnung ersetzt keinen Nichtverfuegbarkeitsstatus.
> Ebenso entfernt sind die heuristischen `assumedEmpty`-Regeln (eine fehlende
> Angabe ist nicht deshalb Null, weil kein Tag gefunden wurde) und die
> Entscheidung nach Prozentschwelle/„groeszerem Wert" im Rebuild.

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12b-debt-periods`**, Ausgangscommit
**`f4d65183fc5e5f4853015b43333eaf2cae6c5dcf`** — zugleich die Branch-Spitze;
nachfolgende Aenderungen gab es nicht (geprueft nach `git fetch --prune`).
`main` steht weiterhin auf `b023dc8` und wurde nicht angefasst.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12b1-debt-scope-fixes`** — der vom Auftrag
gewuenschte Name; kein technisch erzwungener Abweichname noetig.
Eine `AGENTS.md` existiert in diesem Repository nicht (im gesamten Arbeitsbaum
gesucht).
Testbefehl: `npm test`.

**Bestaetigter Teststand vor der Aenderung** (selbst ausgefuehrt auf `f4d6518`):
1700 Rechen-Assertions · 434 Fixture-Assertions · 172 Node-Tests · Exit 0 —
wie im Auftrag erwartet.

**Auftrag.** Die nach Korrekturchat 12B festgestellten Fehler bei
Schuldenumfang, Leasingueberschneidungen und unklaren Nettoschulden.
A-5, A-6, A-7 und O-3 blieben unangetastet.

---

### 1 · Quellenlage (wahrheitsgemaesz)

Der Abruf der Primaerquelle
`https://xbrl.fasb.org/us-gaap/2025/elts/us-gaap-doc-2025.xml` war in dieser
Umgebung **nicht moeglich**: der Egress-Proxy sperrt `xbrl.fasb.org` (HTTP 403
auf CONNECT), ebenso `www.fasb.org`, `www.sec.gov` und `data.sec.gov`.
Geprueft ueber `curl` und ueber den Seitenabruf.

**Ich habe die Definitionen daher NICHT selbst an der Quelle geprueft.**
Verwendet wurde die Auftragsvorgabe:

| Tag | Umfang laut Vorgabe |
|---|---|
| `LongTermDebtAndCapitalLeaseObligations` | noncurrent Schulden **und** Leasing |
| `DebtCurrent` | current Schulden **einschliesslich** Leasing |
| `DebtAndCapitalLeaseObligations` | kurz- **und** langfristig, einschliesslich Leasing |
| `LongTermDebtNoncurrent` | noncurrent Schulden **ohne** Leasing |
| `LongTermDebtCurrent` | current Anteil langfristiger Schulden **ohne** Leasing |

**Berichtigte Aussagen aus 12B.** Die dort festgehaltene Behauptung, *alle*
drei Tags der `total_debt`-Kette seien langfristige Konzepte ohne kurzfristige
Schulden, ist **falsch** (`DebtAndCapitalLeaseObligations` umfasst beides).
Ebenso falsch war, `LongTermDebtAndCapitalLeaseObligations` mit
`currentPortion: true` als Gesamtwert einschliesslich laufender Faelligkeiten
zu fuehren. Beide Stellen sind in `AUDIT-CHAT12.md` ausdruecklich berichtigt.

### 2 · Reproduktion am unveraenderten Ausgangsstand

Alle drei Befunde wurden zuerst auf `f4d6518` ueber
`importSecFacts(secFactsWithDebt(...))` reproduziert — dem produktiven
Importweg, ohne im Test nachgebildete Ersatzlogik:

| Befund | Datensatz | Verhalten vor der Korrektur |
|---|---|---|
| 1 | `LongTermDebtAndCapitalLeaseObligations` 1.000, `LongTermDebtNoncurrent` 700 | 300 als kurzfristige Finanzschuld, OWC-Quote +10 % als **gemessen** |
| 2 | `LongTermDebtNoncurrent` 700 + `DebtCurrent` 300, einmal mit zusaetzlichem `FinanceLeaseLiabilityCurrent` 50 | Schulden 1.000 → 1.050, kurzfr. 300 → 350, Nettoschulden 900 → 950, OWC 10 % → 15 %, Fair Value **19,61913 → 18,67980** |
| 3 | `LongTermDebt` 1.000 + `DebtCurrent` 150 | Rebuild erkennt die Ueberschneidung, `total_debt = 1.000` bleibt ungekennzeichnet; Bruecke `available: true`, `netDebtM: 900`, konkreter Eigenkapitalwert |
| Vollstaendigkeit | `LongTermDebtNoncurrent` 700 + `ShortTermBorrowings` 300 | kurzfr. Schuld 300 „gemessen", obwohl die laufenden Faelligkeiten der 700 unbekannt sind |

### 3 · Aenderungen am Produktcode

**EINE gemeinsame Semantiktabelle.** Der Umfang wird nicht mehr ueber
Merkmalsflags (`currentPortion`, `leases`) beschrieben, sondern als **Menge von
Bilanzzellen** — `DEBT_TAG_CELLS`. Sie ist die einzige Semantikquelle;
Komponenten-Rebuild und `_resolveShortTermDebtHistory()` lesen beide aus ihr.
Die frueheren Tabellen `DEBT_TAG_SCOPE`, `STD_TAGS_INCLUDING_CURRENT_LTD` und
`_TD_DIRECT_TAG_SCOPE` sind entfallen (durch `R20` abgesichert).

Zellen: `stBorrow` (originaer kurzfristige Bankschulden), `ltCurMat` (laufende
Faelligkeiten), `debtNC` (langfristige Schulden), `leaseCur`, `leaseNC`.
Daraus folgen beide Rechenregeln:

* **Addition** nur bei **disjunkten** Zellmengen.
* **Subtraktion** A − B nur, wenn cells(B) **echte Teilmenge** von cells(A)
  ist; das Ergebnis belegt genau cells(A) \ cells(B).

Gleicher Stichtag allein genuegt damit nicht mehr. Die kurzfristigen
Finanzschulden des Working Capital sind genau `{stBorrow, ltCurMat, leaseCur}`.

**Befund 1 — Restgroessenaufloesung.**
`LongTermDebtAndCapitalLeaseObligations` `{debtNC, leaseNC}` minus
`LongTermDebtNoncurrent` `{debtNC}` ergibt `{leaseNC}` — **langfristiges
Leasing**, keine Zelle der kurzfristigen Finanzschulden. Es geht damit nicht
mehr ins OWC ein. Da weder die laufende Tranche noch das kurzfristige Leasing
gemeldet oder ableitbar sind, bleibt der Betrag **unbekannt**; die Historie
bricht ab und die bestehende ausdrueckliche Kennzeichnung greift
(`assumptionRequired`, `setBy: 'model_provisional_default'`) — keine neue
stille Nullannahme.

**Befund 2 — Leasingdoppelzaehlung.** Im Rebuild wie im Resolver gilt jetzt
dieselbe Teilmengenregel: `FinanceLeaseLiabilityCurrent` `{leaseCur}` ist in
`DebtCurrent` `{stBorrow, ltCurMat, leaseCur}` enthalten und wird nicht erneut
addiert. Tatsaechlich disjunkte Komponenten werden weiterhin addiert. Auch die
Ueberschneidung `DebtCurrent` × `LongTermDebt` wird ueber die Zellmengen
erkannt — ein Abzug der laufenden langfristigen Schulden entfernt dort nicht
automatisch das bereits enthaltene kurzfristige Leasing.

**Befund 3 — unklare Gesamtschulden.**
* Der Rebuild kennzeichnet einen nicht ueberschneidungsfrei zusammensetzbaren
  Wert als **Teilbetrag** (`_v4_meta.total_debt.scopeIndeterminate` mit Grund).
* `_resolveNetDebtForDcfBridge()` liefert dann einen begruendeten
  **Nichtverfuegbarkeitsstatus**. Ein bereits **abgeleitetes** `net_debt`
  umgeht die Sperre nicht (die Pruefung steht vor dem `net_debt[0]`-Vorrang).
* **Eigenstaendig belegte oder manuell gesetzte** Nettoschulden
  (`source_type: 'reported'`) bleiben unveraendert zulaessig.
* Der **operative Unternehmenswert** bleibt getrennt ausgewiesen; der
  Eigenkapitalwert entfaellt (`applicable: false`, `base: null`). Der
  Synthesizer filtert auf `applicable && base != null` und uebergeht das Modell
  damit in Gewichtung und Einstiegszone. Haupt-DCF, Mid-Cycle, Reverse DCF,
  Sensitivitaetsmatrix und Monte Carlo tragen denselben Status (in `R18` fuer
  alle fuenf Wege geprueft).

**Vollstaendigkeitsluecke.** Eine nicht belegte Zelle macht den kurzfristigen
Betrag **unbekannt**, sofern sie nicht nachweisbar leer ist — nachweisbar leer
ist eine Zelle, die von einer Angabe mit Wert 0 umfasst wird; `ltCurMat` ohne
langfristige Schulden > 0; `leaseCur` ohne jede Leasingverpflichtung im
Abschluss; `stBorrow`, wenn kein solcher Posten gemeldet ist (unveraenderte
Lesart: ein originaer kurzfristiger Posten folgt aus keinem langfristigen
Bestand). Ein blosser Warntext genuegt nicht mehr.

**FY und TTM.** Die TTM-Sicht schreibt `source_reference` um; eine
TTM-Schuldenreihe saehe dadurch aus wie eine Reihe ganz ohne Herkunft und
waere faelschlich als unproblematischer Altdatensatz behandelt worden.
`buildValuationBasisView()` fuehrt den urspruenglichen us-gaap-Tag jetzt als
`source_tag` mit (`source_tag_inherited: true`); `_secSourceTag()` liest ihn
vorrangig und steht dafuer in `DATA_BASIS_REQUIRED_HELPERS`. Die
**Altdatenregel** gilt nur noch ohne **jeden** Periodenkontext — eine Reihe mit
Perioden, deren Umfang unbestimmt ist, ist ausdruecklich kein Altdatenfall.

### 4 · Gemessene Wirkung

| Fall | vorher | nachher |
|---|---|---|
| Befund 1: LTD&Cap 1.000 / Noncurrent 700 | kurzfr. 300 „gemessen", OWC +10 % | kurzfr. **unbekannt**, OWC nicht ermittelbar (ausdruecklich gekennzeichnet) |
| Befund 2 ohne Aufschluesselung | Schulden 1.000, kurzfr. 300, ND 900, OWC 10 %, FV 19,61913 | unveraendert |
| Befund 2 mit `FinanceLeaseLiabilityCurrent` 50 | Schulden 1.050, kurzfr. 350, ND 950, OWC 15 %, **FV 18,67980** | **identisch zu ohne**: 1.000 / 300 / 900 / 10 % / **19,61913** |
| Befund 2, disjunkte Komponenten (300+100+50) | — | kurzfr. **450**, Schulden 1.150, ND 1.050 (Addition bleibt erhalten) |
| Befund 3: LongTermDebt 1.000 / DebtCurrent 150 | ND **900 verfuegbar**, FV 20,93711 | ND **nicht verfuegbar** mit Begruendung, kein Eigenkapitalwert, operativer Wert 29,94/Aktie bleibt |
| Befund 3 mit manuell gesetztem `net_debt` 850 | — | **weiterhin verfuegbar** (850) |
| Vollstaendigkeit: Noncurrent 700 + ShortTermBorrowings 300 | kurzfr. 300 „gemessen" | **unbekannt**; mit gemeldeter laufender Tranche (600/100/300) wieder **450 gemessen** |
| drei zulaessige Darstellungen derselben Bilanz (`R15`) | — | identisch: Schulden 1.000, kurzfr. 300, OWC +10 %, ND 900, gleicher Fair Value |

### 5 · Tests

**Berichtigte Erwartungen** (fachlich falsch, nicht bloss toleranzbedingt):

* **`R12`** erwartete, dass `LongTermDebt` 700 + `ShortTermBorrowings` 300 eine
  **gemessene** kurzfristige Schuld von 300 ergibt. `LongTermDebt` enthaelt die
  laufenden Faelligkeiten, weist sie aber nicht getrennt aus — die 300 sind nur
  ein Bestandteil. Der Test prueft jetzt die Vollstaendigkeitsregel.
* **`R14`** fuehrte seinen Periodennachweis ueber
  `LongTermDebtAndCapitalLeaseObligations − LongTermDebtNoncurrent` und setzte
  damit voraus, 1.000 − 700 sei die kurzfristige Schuld. Der Nachweis laeuft
  jetzt ueber `DebtCurrent` (deckt die kurzfristige Schuld als Ganzes ab) mit
  einer Periodenluecke — der Jahresmix wird weiterhin erkannt, und der frueher
  still erzeugte Mischwert darf nicht auftreten.
* **`R15`** verwendete als dritte Darstellung `LongTermDebt` 700 +
  `ShortTermBorrowings` 300 und beschrieb damit eine **andere** Bilanz;
  ersetzt durch `DebtCurrent` 300.
* **`tests/sec-ttm.test.mjs`**: die festgeschriebene Helferliste des
  DATENBASIS-BLOCKs enthaelt jetzt zusaetzlich `_secSourceTag` — eine echte
  neue Abhaengigkeit, keine gelockerte Erwartung.

**Neue Regressionstests**

| Test | sichert ab |
|---|---|
| `R16` | Restgroesse zweier noncurrent-Tags ist **langfristiges Leasing**, keine kurzfristige Schuld; Gegenprobe mit ausgewiesenem kurz-/langfristigem Leasing |
| `R17` | Leasing-Aufschluesselung aendert Schulden, OWC und Bewertung nicht; disjunkte Komponenten werden weiterhin addiert; explizite Null; fehlende Aufschluesselung; widerspruechliche Komponenten |
| `R18` | unklare Gesamtschuld ⇒ Nichtverfuegbarkeitsstatus in Bruecke und Bewertung, abgeleitetes `net_debt` umgeht sie nicht, manuelles bleibt zulaessig, operativer Wert bleibt, alle fuenf DCF-Wege |
| `R19` | TTM-Herkunft bleibt erhalten; Perioden ohne bestimmbaren Umfang sind kein Altdatenfall |
| `R20` | genau EINE Semantiktabelle; die Zellmengen entsprechen der Auftragsvorgabe; die alten Tabellen existieren nicht mehr |

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 177 Node-Tests · Exit 0.** Die 1700 Rechen-Assertions und
alle 434 Fixture-Assertions sind unveraendert gruen. Node-Tests 172 → 177
(+5 neue; `R12`/`R14`/`R15` berichtigt statt ergaenzt).

### 6 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium (Playwright) wurde die ausgelieferte Datei
geladen und beide Faelle ueber `importMasterJsonFromTextarea()` eingelesen:

* **Befund 1:** OWC-Historie 0 Jahre; sichtbarer Text
  „⚠ Operatives Working Capital NICHT ermittelbar (… kurzfristige
  Finanzschulden unvollstaendig — laufende Faelligkeiten langfristiger Schulden
  und kurzfristige Leasingverpflichtungen sind weder gemeldet noch aus den
  vorhandenen Tags bestimmbar. Eine vorhandene Teilkomponente macht die Summe
  nicht vollstaendig.)"; `measured: false`, `assumptionRequired: true`.
* **Befund 3:** `available: false`; sichtbarer Text „⚠ Nettoschulden nicht
  ermittelbar (fehlend: total_debt (Umfang unbestimmt)) — der DCF liefert
  deshalb KEINEN Eigenkapitalwert je Aktie. Der operative Unternehmenswert
  betraegt 29.94/Aktie …"; `applicable: false`, `base: null`.
* Keine JavaScript-Fehler; die einzige Konsolenmeldung ist ein
  fehlgeschlagener externer Ressourcenabruf (kein Netz) ohne Bezug zur
  Aenderung.

### 7 · Grenzen dieses Schrittes

* **Keine eigene Pruefung der Primaerquelle** — siehe Abschnitt 1.
* **Kein realer Filing-Fall.** Alle Nachweise sind synthetische SEC-Facts durch
  den produktiven Importweg. Ein Live-Abruf bei SEC war nicht moeglich. Der
  Unterschied ist damit klar: synthetischer Importtest, kein reales Filing.
* **Ein noncurrent-only Tag bleibt als Gesamtschuld in Gebrauch.** Meldet ein
  Filer nur `LongTermDebtAndCapitalLeaseObligations` und keine kurzfristige
  Komponente, ist der Wert streng genommen ein Teilbetrag. Er wird weiterhin
  als `total_debt` verwendet — sonst waere die haeufigste zulaessige
  Darstellung ueberhaupt nicht bewertbar —, ist aber nicht mehr
  ungekennzeichnet (`scopeNoncurrentOnly` + ausdrueckliche Warnung). Die Sperre
  greift nur bei einer **erkannten, nicht aufloesbaren Ueberschneidung**.
* Fuer `LongTermDebt` selbst enthaelt die Auftragsvorgabe keine Definition;
  verwendet wird `{ltCurMat, debtNC}` — die Lesart, auf der bereits O-1 beruht.
* Der `source_tag` der TTM-Sicht wird aus der Jahresreihe **desselben Feldes**
  uebernommen (`source_tag_inherited`). Sollte der Quartalsnormalisierer fuer
  ein Feld ein anderes Tag gewaehlt haben als die Jahresreihe, waere die
  Herkunft insoweit uebernommen und nicht gemessen.
* Die beiden DOM-Formulartests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben wie bisher ausgewiesen uebersprungen.

### 8 · Bearbeitungsstand nach diesem Schritt

**Behoben und abgesichert**

* **A-1, A-2, A-3** (12A, V1.0.58) — `R1`–`R9`, unveraendert gruen
* **A-4** kurzfristige Finanzschulden nur als Restgroesse (12B, in 12B.1
  fachlich berichtigt) — `R10`–`R12`, `R16`
* **O-1** Doppelzaehlung laufender Faelligkeiten (12B, in 12B.1 um die
  Leasing- und Kurzfristueberschneidung erweitert) — `R13`, `R17`
* **O-2** Working-Capital-Historie ohne Periodenabgleich (12B; Nachweis in
  12B.1 auf fachlich passende Daten umgestellt) — `R14`
* **12B.1** Schuldenumfang, Leasingdoppelzaehlung, unklare Nettoschulden —
  `R16`–`R20`

**Weiterhin offen (nicht angefasst, Korrekturchat 12C vorbehalten)**

* **A-5** Verwaesserung endet im Terminalwert bei Jahr 10 (`B6` gruen)
* **A-6** `computeMidCycleFcf()` setzt fehlende D&A still auf 0 (`B7` gruen)
* **A-7** Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie (`B8` gruen)
* **O-3** Randfaelle der Nullstellensuche im Reverse DCF — unbestaetigt

Die Einschraenkungen der Vorschritte bleiben offen.

**Ausgangsbasis fuer Korrekturchat 12C: `claude/chat12b1-debt-scope-fixes`.**
Dieser Branch **ersetzt** dafuer den bisherigen Ausgangsbranch
`claude/chat12b-debt-periods`.

---

## Korrekturchat 12B: Schuldenkomponenten und Periodenzuordnung (V1.0.59)

> **BERICHTIGT durch Korrekturchat 12B.1 (V1.0.60).** Zwei Aussagen dieses
> Eintrags sind fachlich falsch und wurden dort korrigiert:
> (1) „alle drei Tags der Kette `SEC_TAG_MAP.total_debt` sind *langfristige*
> Schuldkonzepte" — `DebtAndCapitalLeaseObligations` umfasst kurz- **und**
> langfristige Schulden einschliesslich Leasing;
> (2) `LongTermDebtAndCapitalLeaseObligations` wurde als Gesamtwert
> *einschliesslich* laufender Faelligkeiten gefuehrt — es erfasst
> ausschliesslich **noncurrent** klassifizierte Betraege, weshalb die
> Restgroesse gegen `LongTermDebtNoncurrent` das **langfristige Leasing** ist
> und keine kurzfristige Finanzschuld. Die daraus abgeleiteten Erwartungen in
> `R12`, `R14` und `R15` sind in 12B.1 berichtigt.

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
**`claude/chat12a-dcf-consistency`** — der in Korrekturchat 12A ausdrücklich
dokumentierte Ergebnisbranch. Ausgangscommit **`380e1cf`** (Branch-Spitze);
er enthält den geforderten Mindeststand `6b2793a` und die abgeschlossenen
Korrekturen A-1/A-2/A-3 aus Codecommit `153c143` (V1.0.58). Gegenprobe:
`git branch -a --contains 6b2793a` nennt `claude/chat12a-dcf-consistency`,
`claude/dreamy-cray-kc8x6o` und `claude/quirky-franklin-fzbcn9`; maszgeblich
ist laut HANDOFF 12A ausdruecklich `claude/chat12a-dcf-consistency` (die
beiden anderen sind Auditbranch bzw. der technische Sitzungsname von 12A).
`main` steht weiterhin auf `b023dc8` und wurde nicht angefasst.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12b-debt-periods`** — der vom Auftrag
gewuenschte Name. Die Sitzungsumgebung hatte zusaetzlich den technischen
Branchnamen `claude/sleepy-cori-m8lv12` vorgegeben; **derselbe Ergebniscommit
wurde deshalb auch dorthin gepusht**, damit beide Namen auf denselben Stand
zeigen. Maszgeblich und fuer **Korrekturchat 12C** zu verwenden ist
`claude/chat12b-debt-periods`.
Eine `AGENTS.md` existiert in diesem Repository nicht (gesucht im gesamten
Arbeitsbaum).
Testbefehl: `npm test`.

**Bestaetigter Teststand vor der Aenderung** (selbst ausgefuehrt auf `380e1cf`):
1700 Rechen-Assertions · 434 Fixture-Assertions · 167 Node-Tests · Exit 0.

**Auftrag.** Auditbefund **A-4** beheben und die unmittelbar zusammenhaengenden
offenen Pruefpunkte **O-1** und **O-2** untersuchen. A-5, A-6, A-7 und O-3
wurden bewusst NICHT angefasst.

---

### 1 · Reproduktion und Ursache am Importpfad

**A-4 am unveraenderten Ausgangscode reproduziert.** Identische Bilanz
(UV 400, Zahlungsmittel 100, kurzfristige Verbindlichkeiten 500 davon 300
Finanzschulden, LTD 700, `debt_short_term[0] = 300`), einziger Unterschied
`total_debt`:

| `total_debt` | kurzfr. Finanzschulden | OWC-Quote | Nettoschulden | Fair Value |
|---|---|---|---|---|
| 700 (= `LongTermDebt`) | 0 („gemessen") | −20 % | 600 | 25,26 |
| 1.000 (vollstaendig) | 300 | +10 % | 900 | 19,62 |

**Danach geprueft, ob der Importweg das ueberhaupt erzeugt.** Synthetische
SEC-Facts wurden durch die **produktive Kette** geschickt
(`_extractWithFallback` → `_applySecDerivations` → `_buildSecMasterJson` →
`applyDerivedFieldsV4` / `normalizeSharesInPlace` /
`applyConservativeHeuristics`) — also genau den Weg, den `secFetchAll()`
beim Live-Abruf nimmt. Ergebnis:

| Fall | Filing-Tags | vorher |
|---|---|---|
| Rebuild greift | `LongTermDebt` 700 + `ShortTermBorrowings` 300 | `total_debt` wird auf 1.000 zurueckgebaut — **kein** Fehler |
| **ST-Anteil < 5 %** | `LongTermDebt` 700 + `ShortTermBorrowings` 20 | Rebuild-Schwelle greift nicht ⇒ `total_debt = 700`; Restgroesse 0 „gemessen", obwohl `debt_short_term[0] = 20` fuer **dieselbe** Periode vorliegt |
| **Komponente nur im aktuellen Jahr** | `ShortTermBorrowings` nur FY2025 | Jahr 0 richtig, Jahre 1–3 als 0 „gemessen"; der Median kippt ins Negative |
| **Komponente veraltet** | `ShortTermBorrowings` nur FY2024–FY2022 | fuer den aktuellen Stichtag liegt nichts vor; Restgroesse 0 galt trotzdem als Messung |

A-4 ist damit ein **nachgewiesener Importfehler**, nicht nur ein synthetisch
inkonsistenter Datensatz.

**Die Ursache liegt tiefer als im Audit vermutet.** Alle drei Tags der Kette
`SEC_TAG_MAP.total_debt` (`LongTermDebtAndCapitalLeaseObligations`,
`LongTermDebt`, `DebtAndCapitalLeaseObligations`) sind *langfristige*
Schuldkonzepte; keines enthaelt kurzfristige Bankschulden oder Commercial
Paper. Die Restgroesse `total_debt − long_term_debt` misst deshalb
bestenfalls die **laufende Tranche** langfristiger Schulden — und wenn beide
Reihen auf **dasselbe** Tag fallen (`LongTermDebt` ist Kettenplatz 2 in
`total_debt` und Kettenplatz 1 in `long_term_debt`), ist sie strukturell 0
und nie eine Messung.

---

### 2 · Aenderungen am Produktcode

Alle Aenderungen liegen in der ausgelieferten HTML-Datei; `src/dcf-core.js`
laedt den `DCF-CORE-BLOCK` unveraendert weiter (Isolationspruefung gruen).

**A-4 — kurzfristige Finanzschulden semantisch aufloesen (Kernursache):**

* **neu** `_resolveShortTermDebtHistory(f)` und `_secSourceTag(meta)` im
  markierten `DCF-CORE-BLOCK`. Sie nutzen ausschliesslich Helfer, die bereits
  in `DCF_CORE_REQUIRED_HELPERS` stehen (`_joinPeriodKeyed`,
  `_seriesHasPeriodContext`, `_secPeriodYear`, `_secPeriodDaysApart`).
  Vorrang **je Berichtsperiode**:
  1. **gemeldete Komponenten** ⇒ `status: 'measured'`,
  2. **Restgroesse** `total_debt − long_term_debt`, nur bei nachweislich
     passendem Umfang ⇒ `status: 'derived'`,
  3. **belegte Null** (`total_debt = 0`) ⇒ gemessene 0,
  4. sonst **unbekannt mit Begruendung** — das Jahr gilt als unvollstaendig.
* **Ueberschneidungen nach den tatsaechlichen Tag-Definitionen**, statt
  pauschaler Addition (neue Tabellen `STD_TAGS_INCLUDING_CURRENT_LTD` und
  `DEBT_TAG_SCOPE`):
  * `us-gaap:DebtCurrent` ist „debt classified as current" und enthaelt die
    laufenden Faelligkeiten **bereits** ⇒ `debt_long_term_current` wird dann
    NICHT zusaetzlich addiert;
  * `ShortTermBorrowings` / `CommercialPaper` decken sie nicht ab ⇒ die
    laufende Tranche wird addiert;
  * `FinanceLeaseLiabilityCurrent` ist kein `Debt*`-Konzept und wird addiert
    — ausser die als laufende Tranche verwendete Restgroesse enthaelt es
    bereits (`LongTermDebtAndCapitalLeaseObligations`).
* **Restgroesse nur bei passendem Umfang UND Stichtag**, ausdruecklich als
  `derived` gekennzeichnet. Blockiert, wenn `total_debt` und
  `long_term_debt` aus demselben us-gaap-Konzept stammen (strukturell 0), und
  wenn `total_debt` aus dem period-keyed Komponenten-Rebuild stammt (dort
  sind die Komponenten die Quelle; eine fehlende Komponente ist *nicht
  gemeldet*, nicht *null*).
* **Belegte Null, fehlender Wert und Widerspruch bleiben getrennt.** Ein
  ungeklaerter Widerspruch erzeugt keinen scheinbar gemessenen Wert mehr:
  die gemeldeten Komponenten haben Vorrang, die Abweichung wird als
  `shortTermDebtDiscrepancyM` gefuehrt und im Bewertungsausweis genannt.
* **Eine konsistente Schuldenbasis fuer OWC und Nettoschulden.** Der
  Komponenten-Rebuild ersetzt den direkten `total_debt`-Wert jetzt auch
  unterhalb der 5-%-Schwelle, wenn das direkte Tag den Umfang der verwendeten
  Komponenten nachweislich nicht abdecken kann (`_tdScopeTooNarrow`, mit
  Begruendung in `meta._debt_warnings`). Bleibt danach noch eine Luecke
  (Restgroesse als laufende Tranche *und* separat gemeldete kurzfristige
  Bankschulden), wird ausdruecklich ausgewiesen, dass die
  Nettoschuldenbruecke insoweit mit einer zu niedrigen Gesamtverschuldung
  rechnet.
* `_resolveOwcForForecast()` fuehrt Herkunft und Widersprueche mit
  (`shortTermDebtSources`, `shortTermDebtDerived`, `periodKeyed`,
  `debtWarnings`); `modelDcf()` weist sie in den Warnungen aus.

**O-1 — laufende Faelligkeiten nicht doppelt zaehlen:**

* In `buildPeriodAlignedComponentSeries()` belegt ein `lt_noncurrent`-Wert,
  der aus `LongTermDebt` stammt, jetzt **beide** Alias-Gruppen
  (`lt_noncurrent` *und* `lt_current`) fuer seine Perioden; solche Felder
  werden zuerst verarbeitet (`_orderedFields`).
* Gegenstueck auf der kurzfristigen Seite: ein `debt_short_term` aus
  `DebtCurrent` belegt ebenfalls `lt_current`.
* Treffen `DebtCurrent` und `LongTermDebt` aufeinander (beide enthalten die
  laufende Tranche) und ist `LongTermDebtCurrent` gemeldet, wird der Betrag
  genau einmal abgezogen. Ist er **nicht** gemeldet, ist die Ueberschneidung
  nicht aufloesbar: die Periode wird verworfen und der direkte Wert bleibt
  stehen — statt eine scheinpraezise Summe zu bilden.

**O-2 — periodengetreue Working-Capital-Historie:**

* `_computeOwcHistory()` verknuepft die Stichtagsgroessen ueber
  `_joinPeriodKeyed()` (dieselbe Periodenlogik wie Nettoschuldenbruecke
  V1.0.39 und Bruttomarge V1.0.52), gefuehrt von `current_liabilities`.
* Die **Zeitraumgroesse Umsatz** wird ueber das Geschaeftsjahr des
  Periodenendes zugeordnet und zusaetzlich mit `_secPeriodDaysApart()` gegen
  den Bilanzstichtag geprueft (max. 45 Tage). Damit werden Zeitraum- und
  Stichtagsgroesse einander zugeordnet, ohne sie im Join zu vermischen (den
  `_joinPeriodKeyed` zu Recht verweigert).
* Jedes Jahr traegt sein `period`-Kennzeichen; `periodKeyed` weist den Modus
  aus.
* **Bestehende Regel fuer Altdaten bleibt:** ohne jeden Periodenkontext
  (manueller Import) gilt weiterhin der Positionsbezug. Er ist ausdruecklich
  kenntlich (`periodKeyed: false`, `status: 'derived'`). Traegt ein einzelnes
  Feld keine Periodenmetadaten, waehrend die uebrigen periodengetreu laufen,
  wird der erzwungene Rueckfall auf die Position als Warnung ausgewiesen.

---

### 3 · Gemessene Wirkung

Alle Zahlen unabhaengig nachgerechnet; die Handrechnung steht jeweils im Test.

| Fall | vorher | nachher |
|---|---|---|
| A-4, `total_debt = LongTermDebt` (700), `debt_short_term = 300` | OWC −20 % „gemessen", Fair Value 25,26 | OWC **+10 %**, Fair Value 22,62, Widerspruch ausgewiesen |
| A-4, dieselbe Bilanz vollstaendig (`total_debt = 1.000`) | OWC +10 %, Fair Value 19,62 | OWC +10 %, Fair Value 19,62 (unveraendert) |
| ⇒ operativer Unternehmenswert je Aktie beider Darstellungen | 31,26 vs. 28,62 | **28,62 = 28,62** |
| A-4 am Importweg, ST-Anteil 20 von 720 | `total_debt` 700, OWC −20 % | `total_debt` **720**, OWC −18 % aus `debt_short_term` |
| A-4 am Importweg, Komponente nur FY2025 | 4 Jahre, Median kippt negativ | **1 Jahr**, keine belastbare Quote ⇒ Nutzereingabe noetig |
| A-4 am Importweg, Komponente veraltet | 4 Jahre, 0 „gemessen" | **0 Jahre**, Begruendung genannt |
| O-1, `LongTermDebt` 1.000 + `LongTermDebtCurrent` 100 | `total_debt` **1.100**, Nettoschulden 1.000 | `total_debt` **1.000**, Nettoschulden **900** |
| O-1, Gegenprobe `Noncurrent` 900 + `Current` 100 | 1.000 / 900 | 1.000 / 900 (unveraendert) |
| O-1, mit zusaetzlich `ShortTermBorrowings` 50 | 1.100 bzw. 1.050 (uneinheitlich) | **1.050 = 1.050** |
| O-2, Luecke in `LongTermDebtNoncurrent` (FY2024 fehlt) | 3 Jahre; Position 1 = 900 (FY2024) − 500 (FY2023) = **400** | **1 Jahr** (FY2025 = 300); FY2024 als unbestimmbar benannt |

---

### 4 · Tests

`B5` (der Nachweis zu A-4) ist in **Regressionstests des richtigen
Verhaltens** umgewandelt worden — `R10`–`R15` in
`tests/audit-chat12.test.mjs`. `B6`–`B8` bleiben **ausdruecklich
Befund-Nachweise**: A-5 bis A-7 sind offen und wurden nicht angefasst.
`A1`–`A5` und `R1`–`R9` sind unveraendert.

| Test | sichert ab |
|---|---|
| `R10` | A-4: gemeldete Komponenten schlagen die Restgroesse; dieselbe Bilanz ergibt unabhaengig von der Tag-Darstellung dieselbe Working-Capital-Quote und denselben operativen Wert; der Widerspruch wird benannt |
| `R11` | belegte Null, ausdrueckliche 0 als Komponente, fehlender Wert, abgeleitete Restgroesse und Inkonsistenz bleiben **getrennt** |
| `R12` | A-4 am **echten Importweg**: Rebuild greift / 5-%-Schwelle / Komponente nur im aktuellen Jahr / veraltete Komponente |
| `R13` | O-1: kein Doppelzaehlen der laufenden Faelligkeiten; Gegenprobe mit `DebtCurrent`; nicht aufloesbare Ueberschneidung erzeugt keinen Summenwert |
| `R14` | O-2: periodengetreue Verknuepfung, kein stiller Jahresmix; Gegenprobe mit lueckenlosen Perioden; Altdatenpfad bleibt zulaessig und gekennzeichnet |
| `R15` | drei zulaessige Tag-Darstellungen derselben Bilanz ⇒ identische `total_debt`, Nettoschulden, OWC-Quote und Bewertung |

Neu in `tests/audit-chat12.mjs`: `importSecFacts()`, `secFactsWithDebt()`,
`secFlow()`/`secInst()`/`secShares()` und `evalInApp()`. Sie bauen
synthetische SEC-Facts und schicken sie durch den **ausgelieferten**
Importweg — keine Kopie der Logik, keine von Hand gebauten `fundamentals`.

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 172 Node-Tests · Exit 0.** Keine bestehende
Testerwartung wurde gelockert oder geaendert; die 1700 Rechen-Assertions und
alle 434 Fixture-Assertions sind unveraendert gruen (darunter die
Working-Capital-Faelle `W-1a`–`W-1j` und die Debt-Rebuild-Fixtures
`T-DEBT-DEDUP1`–`3`, `T-TXRH-DEBT4`). Die Node-Testzahl geht von 167 auf 172
(−1 umgewandelter B-Test, +6 Regressionstests). Die Korrekturen aus 12A sind
ueber `R1`–`R9` unveraendert abgesichert.

### 5 · Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium (Playwright) wurde die ausgelieferte
HTML-Datei geladen und der A-4-Datensatz in beiden Tag-Darstellungen ueber
den regulaeren Importweg (`importMasterJsonFromTextarea()`) eingelesen:

* beide Darstellungen: kurzfristige Finanzschulden **300**,
  `status: 'measured'`, Quelle `debt_short_term`, OWC-Quote **+10 %**,
  operativer Wert je Aktie **28,6191** — identisch.
* `LongTermDebt`-Darstellung zusaetzlich: „gemeldete Schuldenkomponenten
  (300.0M) und die Restgroesse total_debt − long_term_debt (0.0M)
  widersprechen sich; die gemeldeten Komponenten haben Vorrang."
* Keine JavaScript-Fehler; die einzige Konsolenmeldung ist ein
  fehlgeschlagener externer Ressourcenabruf (kein Netz in der Umgebung) und
  steht in keinem Zusammenhang mit der Aenderung.

### 6 · Grenzen dieses Schrittes

* **Kein Live-Abruf bei SEC oder Yahoo.** `data.sec.gov`, `www.sec.gov`,
  `xbrl.fasb.org` und `www.fasb.org` sind vom Egress-Proxy dieser Umgebung
  gesperrt (HTTP 403 auf CONNECT). Die synthetischen Faelle laufen deshalb
  durch den produktiven Importweg, aber nicht gegen echte Filings.
* **O-1: die Tag-Semantik ist nicht an der primaeren Quelle belegt.**
  `us-gaap:LongTermDebt` schliesst nach allen verfuegbaren (sekundaeren)
  Quellen die laufenden Faelligkeiten ein; die FASB-Taxonomiedatei war nicht
  erreichbar. Zwei code-interne Argumente tragen unabhaengig davon (siehe
  AUDIT-CHAT12.md, Abschnitt O-1). Ein realer Filing-Fall wurde **nicht**
  geprueft. Waere die Lesart entgegen allen Quellen anders, betraefe die
  Ruecknahme genau `_coversCurrentMaturities()` und `DEBT_TAG_SCOPE`.
* `DebtAndCapitalLeaseObligations` steht bewusst **nicht** in
  `DEBT_TAG_SCOPE` / `_TD_DIRECT_TAG_SCOPE`: sein Umfang war hier nicht
  zweifelsfrei belegbar, deshalb bleibt fuer dieses Tag das bisherige
  Verhalten.
* Die Browserpruefung deckt den FY-Pfad mit manuellem Import ab. Der
  SEC-Importweg ist ueber die Node-Tests (`R12`–`R15`) gedeckt, nicht
  zusaetzlich im Browser (kein Netz).
* Bleibt eine Schuldenkomponente ausserhalb des Umfangs des direkten
  `total_debt`-Tags und laesst sich der Rebuild nicht anwenden, rechnet die
  Nettoschuldenbruecke weiterhin mit dem gemeldeten `total_debt`. Das
  Werkzeug erfindet dort keinen Ersatzwert, weist die Luecke aber aus.
* Die beiden DOM-Formulartests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben wie bisher ausgewiesen uebersprungen.

### 7 · Bearbeitungsstand nach diesem Schritt

**Behoben und abgesichert**

* **A-1, A-2, A-3** (Korrekturchat 12A, V1.0.58) — `R1`–`R9`, unveraendert gruen
* **A-4** kurzfristige Finanzschulden nur als Restgroesse — `R10`–`R15`

**Bestaetigt und behoben**

* **O-1** Doppelzaehlung laufender Faelligkeiten im Komponenten-Rebuild —
  bestaetigt am echten Parser-/Rebuild-Pfad, behoben, `R13`
  (verbleibende Unsicherheit siehe Abschnitt 6)
* **O-2** Working-Capital-Historie ohne Periodenabgleich — bestaetigt mit
  reproduzierendem Datensatz, behoben, `R14`

**Weiterhin offen (nicht angefasst)**

* **A-5** Verwaesserung endet im Terminalwert bei Jahr 10 (`B6` gruen)
* **A-6** `computeMidCycleFcf()` setzt fehlende D&A still auf 0 (`B7` gruen)
* **A-7** Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie (`B8` gruen)
* **O-3** Randfaelle der Nullstellensuche im Reverse DCF — unbestaetigt

Die Einschraenkungen der Vorschritte bleiben offen.

**Ausgangsbasis fuer Korrekturchat 12C: `claude/chat12b-debt-periods`.**

---

## Korrekturchat 12A: Konsistenz von DCF-Kern, Margenbasis und Reverse DCF (V1.0.58)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/dreamy-cray-kc8x6o`, Ausgangscommit `6b2793a` (die Branch-Spitze; sie
enthaelt den geforderten Mindeststand und die nachfolgenden HANDOFF-Ergaenzungen).
Gearbeitet wurde ausschliesslich auf dem Repository-Code, nicht auf `main`
(`main` steht weiterhin auf `b023dc8`) und ohne Chat-Anhaenge.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Ergebnisbranch: **`claude/chat12a-dcf-consistency`** — der vom Auftrag
gewuenschte Name; er traegt das Ergebnis. Die Sitzungsumgebung hatte zusaetzlich
den technischen Branchnamen `claude/quirky-franklin-fzbcn9` vorgegeben; **derselbe
Ergebniscommit wurde deshalb auch dorthin gepusht**, damit beide Namen auf
denselben Stand zeigen. Maszgeblich und fuer Korrekturchat 12B zu verwenden ist
`claude/chat12a-dcf-consistency`.
Eine `AGENTS.md` existiert in diesem Repository nicht.
Testbefehl: `npm test`.

**Bestaetigter Teststand vor der Aenderung** (selbst ausgefuehrt auf `6b2793a`):
1700 Rechen-Assertions · 434 Fixture-Assertions · 162 Node-Tests · Exit 0.

**Auftrag.** Ausschliesslich die Auditbefunde **A-1, A-2 und A-3** aus
`AUDIT-CHAT12.md`. Keine weiteren Features, keine Refactorings.
A-4 bis A-7 und O-1 bis O-3 wurden bewusst NICHT angefasst.

### Reproduktion am unveraenderten Ausgangscode

Zuerst am Ausgangsstand gemessen (zyklischer Datensatz, Ist-Marge 30 %,
Mid-Cycle-Median 15 %, `net_debt[0] = 500`, Kurs 20; A-1 mit ableitbaren
Nettoschulden 2.000M, Kurs 12):

| Groesse | vorher | nachher |
|---|---|---|
| Haupt-DCF (Mid-Cycle) | 12,80 (Marge 15 %) | 12,80 (unveraendert) |
| Sensitivitaetsmatrix, zentrale Zelle | 12,80 (Marge 15 %) | 12,80 (unveraendert) |
| Monte-Carlo-Median (Seed 4242, 2.000 Laeufe) | **30,69** (Marge 30 %) | **12,92** (Marge 15 %) |
| Snapshot-Prognose FCFF Jahr 1 | **236,25** (Marge 30 %) | **118,125** (Marge 15 %) |
| `valuation.reverseDcfImpliedGrowth` (echter Engine-Pfad) | **0,0649 %** (Marge 30 %) | **9,678 %** (Marge 15 %) |
| Reverse-DCF-Karte der Bewertungsansicht (A-1-Datensatz) | **−4,66 %**, „Netto-Schulden: 0 (angenommen)" | **+10,80 %**, Nettoschulden 2.000M mit Quelle |
| Reverse-DCF-Uebersichtskarte (A-1-Datensatz) | +10,80 % | +10,80 % (unveraendert) |
| Uebersichtskarte ohne `f.fcf` (A-3) | „nicht berechenbar · FCF₀ fehlt" | **+5,00 %** (Kernwert) |

Im zyklischen Pfad zeigten **beide** Reverse-DCF-Anzeigen vorher keinen Wert
(kein `f.fcf` vorhanden — A-1 und A-3 wirkten dort zusammen); jetzt zeigen
beide denselben Kernwert +9,68 % bzw. +9,7 %.

### Aenderungen am Produktcode

**A-2 — eine gemeinsame Aufloesung der wirksamen Margenbasis (Kernursache):**

* **neu** `resolveEffectiveMarginBasis(mj, v)` und
  `coreOptsFromMarginBasis(res)` im markierten `DCF-CORE-BLOCK` (nutzen nur
  `computeMidCycleFcf`, das bereits in `DCF_CORE_REQUIRED_HELPERS` steht; die
  Isolationspruefung bleibt gruen). Vorrangregel identisch zu
  `normalizeDcfCoreInput()` an der Modulgrenze:
  1. bereits aufgeloester Stand `v._coreOpts` — traegt einen ausdruecklichen
     (manuellen) Override und hat deshalb Vorrang,
  2. die Marge, mit der das DCF-Modell dieser Bewertung wirklich gerechnet hat
     (`_coreMarginBasis`/`_coreOpMarginPctUsed`),
  3. Mid-Cycle-Median, wenn der Router ausschliesslich `dcf_midcycle` fuehrt,
  4. sonst Szenariomarge, kein Override.
  Ein gewaehlter Mid-Cycle-Pfad ohne ableitbaren Median ergibt
  `available: false` mit Begruendung — kein stiller Rueckfall auf die Ist-Marge.
  Ein Textwert (`'22'`) ist kein gueltiger Override (keine stille Umwandlung).
  Die fachliche Mid-Cycle-Definition (`computeMidCycleFcf`) ist unveraendert.
* `computeSensitivityMatrix()`: eigene Inline-Ableitung entfernt, benutzt jetzt
  die gemeinsame Aufloesung. Verhalten und Werte unveraendert (Gegenprobe:
  alle bestehenden Erwartungen gruen), zusaetzlich `opMarginBasisSource`.
* `runValuationEngine()`: loest EINMAL auf der tatsaechlich bewerteten Sicht
  (`_basisView`, FY oder TTM) und aus dem Modell auf, das wirklich gerechnet
  hat. Fuehrt `_coreOpts`, `_marginBasis`, `_marginBasisSource`,
  `_marginBasisAvailable`, `_marginBasisReason`, `_opMarginPctUsed`,
  `_reverseDcfStatus`, `_reverseDcfStatusReason`, `_reverseDcfMarginBasis` mit.
  Der gespeicherte `reverseDcfImpliedGrowth` entsteht aus demselben
  Solver-Lauf wie sein Status (kein zweiter Durchlauf der Nullstellensuche).
* `runMonteCarloDcf()`: `buildCoreValuationContext(mj, {})` →
  `buildCoreValuationContext(mj, _coreOpts)`. Nicht aufloesbare Margenbasis
  sperrt die Simulation mit Begruendung. Neu am Ergebnis:
  `_opMarginPctUsed`, `_marginBasis`, `_marginBasisSource`,
  `_midCycleOpMarginPct`, sowie `margin_basis*` in
  `distributions.op_margin_shock`.
* `buildSnapshotForecastTargets()`: rechnet mit der bewerteten Marge statt mit
  `scenarios.base.op_margin_pct`. Nicht aufloesbare Margenbasis ⇒ keine
  Prognoseziele, mit Grund. Der gespeicherte Szenarioblock traegt jetzt
  `op_margin_basis`, `op_margin_basis_source`, `op_margin_override_pct` und
  `op_margin_pct_scenario` — damit misst der spaetere Soll-Ist-Vergleich
  (`compareSnapshotForecastToActual`) gegen den wirklich bewerteten Pfad.
* `computeReverseDcf(mj, opts)`: reicht Optionen durch (ohne Optionen
  unveraendert).

**A-1 — Reverse-DCF-Karte der Bewertungsansicht auf den FCFF-Kern:**

* `buildReverseDcfDiagnosticBlock()` rechnet nicht mehr selbst mit
  `calculateImpliedGrowth()` auf `f.fcf[0]` und `netDebtM ?? 0`, sondern zeigt
  `coreReverseDcf` aus `computeReverseDcfFull(mj, _coreOpts)` — derselbe Kern,
  dieselbe wirksame Margenbasis, dieselbe Nettoschuldenbruecke wie Haupt-DCF
  und Uebersichtskarte.
* Nettoschulden ausschliesslich ueber `_resolveNetDebtForDcfBridge()`; die
  Zeile „0 (angenommen)" ist entfallen. Unbekannte Nettoschulden ⇒ Status
  `net_debt_unknown` mit Begruendung und ausdruecklich KEINE Hauptzahl.
* Neue Zeile „Betriebsmarge (wirksam)" (Wert + Herkunft) und eine
  Kontrollrechnung (Eigenkapitalwert je Aktie, Rest zum Kurs) aus dem
  Solver-Ergebnis — keine zweite Rechnung in der Karte.
* Die Reported-/Owner-FCF-Diagnosen bleiben erhalten, aber unter eigener
  Ueberschrift „Getrennte Diagnose auf REPORTED-FCF-Basis (CFO − CapEx)" mit
  dem Basis-Hinweis, der die Karte bis V1.0.57 nie erreichte.
* `buildReverseDcfOverviewCard(mj, v)`: nimmt die gespeicherte Bewertung an und
  rechnet damit auf derselben Margenbasis; Aufrufstelle in der Uebersicht gibt
  `state.valuation` mit. Nicht aufloesbare Margenbasis ⇒ Status statt Zahl.

**A-3 — unabhaengige Verfuegbarkeitspruefung:**

* `computeReverseDcfFull(mj, opts)`: `coreReverseDcf` entsteht als Erstes —
  **vor** den FCF-Gates — und wird in JEDEM Rueckgabepfad mitgefuehrt, auch im
  Stub `_notApplicableReverseDcf()` und im Financials-Zweig. Neu:
  `coreAvailable`, `reportedFcfGateBlocked`, `reportedFcfGateReason`.
* Der Basis-Hinweis liegt als Konstante `REVERSE_DCF_FCF_BASIS_NOTE` an einer
  Stelle und erreicht damit auch die gesperrten Pfade.
* Die Gates (`fcf0M` fehlend / ≤ 0 / `fcfDataSuspect`) wirken nur noch auf
  `applicable`, `reverseDcfReported` und `reverseDcfOwner` — die eigene
  Voraussetzung dieser Diagnose. `runGrowthCaseEngine()` liest weiterhin
  `applicable`/`impliedGrowthPct` und ist damit unveraendert.
* Beide Anzeigen scheitern nur noch am Kernstatus und zeigen einen Kernwert
  ausschliesslich, wenn dessen eigene Voraussetzungen erfuellt sind
  (`core.ok`: eindeutige Loesung, bekannte Nettoschulden, Kurs, WACC, tg).

### Tests

`B1`–`B4` (die Nachweise zu A-1, A-2, A-3) sind in **Regressionstests des
richtigen Verhaltens** umgewandelt worden — `R1`–`R9` in
`tests/audit-chat12.test.mjs`. `B5`–`B8` bleiben **ausdruecklich
Befund-Nachweise**: A-4 bis A-7 sind offen und wurden nicht angefasst.
`A1`–`A5` (Referenz) sind unveraendert.

| Test | sichert ab |
|---|---|
| `R1` | Monte Carlo rechnet auf der bewerteten Mid-Cycle-Marge; Margenbasis am Ergebnis und in den Verteilungsannahmen; Gegenprobe Ist-Margen-Pfad; Determinismus bei festem Seed |
| `R2` | Snapshot-Prognoseziele auf der bewerteten Marge (FCFF J1 = 118,125 von Hand), gespeicherte Herkunft, Soll-Ist-Vergleich gegen den bewerteten Pfad |
| `R3` | **echter Engine-Pfad**: `runValuationEngine` → eine Margenbasis fuer DCF, Matrix, MC, Snapshot, gespeicherten Reverse DCF und BEIDE Reverse-DCF-Anzeigen; zusaetzlich der eine Anzeigeweg `buildValuationDiagnosticBlocks` |
| `R4` | Standard-DCF bleibt auf der Szenariomarge (kein erzwungener Override) |
| `R5` | manueller Margen-Override hat Vorrang vor dem Mid-Cycle-Median; Textwert ist kein gueltiger Override |
| `R6` | Mid-Cycle-Pfad ohne ableitbaren Median: erklaerter Status in Matrix, MC, Snapshot und Karte — kein stiller Rueckfall |
| `R7` | A-1: Karte rechnet auf dem FCFF-Kern, ableitbare Nettoschulden werden mit Quelle gezeigt, beide Anzeigen stimmen ueberein, Reported-Diagnose getrennt beschriftet |
| `R8` | unbekannte Nettoschulden: Nichtverfuegbarkeitsstatus statt Null, in beiden Anzeigen; Kernergebnis wird trotzdem mitgefuehrt |
| `R9` | A-3: fehlendes FCF, nichtpositives FCF, `fcfDataSuspect` und Financials — Kernrechnung bleibt verfuegbar bzw. traegt ihren eigenen Status |

**`npm test` nach der Aenderung: 1700 Rechen-Assertions · 434
Fixture-Assertions · 167 Node-Tests · Exit 0.** Keine bestehende
Testerwartung wurde gelockert oder geaendert; die 1700 Rechen-Assertions und
alle 434 Fixture-Assertions sind unveraendert gruen. Die Node-Testzahl geht
von 162 auf 167 (−4 umgewandelte B-Tests, +9 Regressionstests).

### Browserpruefung (durchgefuehrt)

Mit dem vorinstallierten Chromium (Playwright) wurde die ausgelieferte
HTML-Datei geladen, ein zyklischer Datensatz ueber den regulaeren Importweg
(`importMasterJsonFromTextarea()`) eingelesen und **beide Anzeigen im
gerenderten Zustand** gelesen:

* Bewertungsansicht, Reverse-DCF-Karte: `+9.68%`, keine Zeile
  „0 (angenommen)", wirksame Margenbasis `midcycle_median` sichtbar,
  Reported-FCF-Diagnose getrennt beschriftet.
* Uebersicht, Reverse-DCF-Karte: `+9.7%`, **nicht** gesperrt (vorher haette der
  A-3-Gate hier „FCF₀ fehlt" gezeigt — der Datensatz hat kein `f.fcf`).
* Haupt-DCF 12,80 · Monte-Carlo-Median 13,13 (vorher ~30,7) · gespeicherter
  Reverse DCF 9,678 · `_marginBasis = midcycle_median`, `_opMarginPctUsed = 15`.
* Keine JavaScript-Fehler; die einzige Konsolenmeldung ist ein
  fehlgeschlagener externer Ressourcenabruf (kein Netz in der Umgebung) und
  steht in keinem Zusammenhang mit der Aenderung.

### Grenzen dieses Schrittes

* Kein Live-Abruf bei SEC oder Yahoo. Alle Nachweise beruhen auf synthetischen
  Datensaetzen mit von Hand nachgerechneten Erwartungswerten.
* Die Browserpruefung deckt den zyklischen Mid-Cycle-Fall auf FY-Basis ab. Der
  TTM-Pfad ist ueber die bestehenden Node-/Rechentests gedeckt
  (`_testTtmIntegrationFixes`, `_testDataBasis`), nicht zusaetzlich im Browser.
* Der Monte-Carlo-Median muss bei einer nichtlinearen Bewertung nicht exakt dem
  Base-Wert entsprechen; belegt ist die Annahmenweitergabe deterministisch ueber
  `_opMarginPctUsed`/`_marginBasis` und die Gegenprobe, die Groessenordnung
  zusaetzlich mit festem Seed.
* Die beiden DOM-Formulartests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben wie bisher ausgewiesen uebersprungen.
* Beobachtung ohne Aenderung (ausserhalb des Auftrags, kein Befund dieses
  Audits): die manuellen Annahmen `valuation.assumptions.midcycle_margin_pct`
  und `target_op_margin_pct` werden in der Oberflaeche erfasst, aber von
  `computeMidCycleFcf()`/`modelDcfMidcycle()` nicht gelesen — ein Override
  wirkt derzeit nur ueber `opts.opMarginOverridePct` bzw. `v._coreOpts`.
  Bewusst nicht angefasst, weil das Bewertungsergebnisse veraendern wuerde.

### Weiterhin offene Befunde (nicht angefasst)

* **A-4** kurzfristige Finanzschulden nur als Restgroesse (`B5` gruen)
* **A-5** Verwaesserung endet im Terminalwert bei Jahr 10 (`B6` gruen)
* **A-6** `computeMidCycleFcf()` setzt fehlende D&A still auf 0 (`B7` gruen)
* **A-7** Buyback-MoS-Zuschlag greift im Mid-Cycle-Pfad nie (`B8` gruen)
* **O-1** bis **O-3** unveraendert offen und unbestaetigt

Die Einschraenkungen der Vorschritte bleiben offen (D&A-Sperre wirkt auch auf
Jahresbasis; auf TTM sind `book_value`, `tangible_book_value`, `dps` u. a.
ungedeckt; Synthesizer bewertet Datenverfuegbarkeit an der Jahreshistorie;
Einheitenverdacht in `_makeBaseValuation()`; indexbasierte Ableitung in
`applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen).

### Anschlussstand — Ausgangsbasis fuer Korrekturchat 12B

**Dieser Ergebnisbranch ist die Ausgangsbasis fuer Korrekturchat 12B.**

* **Ausgangsbasis fuer 12B (Branch): `claude/chat12a-dcf-consistency`**
* Ausgangscommit dieses Schrittes: `6b2793a`
* Ergebniscommit: `153c143`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/153c143
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/chat12a-dcf-consistency
* Auditstatus: `AUDIT-CHAT12.md`, Abschnitt 0 (Bearbeitungsstand der Befunde)
  — https://github.com/c7gzyvh4rk-commits/Aktientool/blob/claude/chat12a-dcf-consistency/AUDIT-CHAT12.md
* Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
* Testbefehl: `npm test` · erwartet **1700 Rechen-Assertions · 434
  Fixture-Assertions · 167 Node-Tests · Exit 0**
* Empfohlene Reihenfolge fuer 12B: **A-4** (hoch, Bilanz- und
  Working-Capital-Wirkung), dann **A-5** (mittel, lokale Aenderung in
  `forecastDcfCore`, wirkt auf alle vier Pfade), dann **A-6** und **A-7**
  (Einzeiler). `B5`–`B8` sind dabei jeweils in Regressionstests umzukehren.

## Audit (Chat 12): Unabhaengige Pruefung des Stands V1.0.57

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/ttm-share-period-fixes`, geprueft wurde der Commit
`3544bcfbd78d739805c778065bf2b3f48996876d` (Codecommit `b5559df`, V1.0.57) —
der neueste auf GitHub gespeicherte Stand dieses Branches einschliesslich der
nachtraeglichen Korrekturen; `main` steht weiterhin auf `b023dc8` und enthaelt
keinen der Vorschritte. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Auditbranch: `claude/dreamy-cray-kc8x6o`. Testbefehl: `npm test`.

**Auftragsart: Audit, keine Erweiterungsrunde.** Produktcode wurde NICHT
geaendert. Ergaenzt wurden ausschliesslich die Auswertung `AUDIT-CHAT12.md`
und die Tests `tests/audit-chat12.test.mjs` / `tests/audit-chat12.mjs`.

### Vollstaendige Befunde: `AUDIT-CHAT12.md`

Sieben bestaetigte Befunde (je mit Schweregrad, betroffener Funktion,
reproduzierbarem Nachweis, Auswirkung und Korrekturempfehlung) und drei
offene Pruefpunkte. Kurzfassung:

| # | Schwere | Funktion | Kern des Befunds |
|---|---|---|---|
| A-1 | hoch | `buildReverseDcfDiagnosticBlock` | Reverse-DCF-Karte der Bewertungsansicht rechnet auf `f.fcf[0]` und setzt Nettoschulden still auf 0 — **−4,66 %** gegen **+10,80 %** der Uebersichtskarte (Nettoschulden 2.000M ableitbar) |
| A-2 | hoch | `runMonteCarloDcf`, `buildSnapshotForecastTargets`, `runValuationEngine` | Mid-Cycle-Marge erreicht Simulation, Snapshot und `reverseDcfImpliedGrowth` nicht: MC-Median **30,18** gegen Fair Value **12,27**; Snapshot-FCFF J1 **236,25** statt 118,125 |
| A-3 | hoch | `computeReverseDcfFull` | Uebersichtskarte sperrt auf `f.fcf[0]`, bevor `coreReverseDcf` ueberhaupt gebildet wird → „nicht berechenbar" trotz eindeutigem Kernergebnis +5,00 % |
| A-4 | hoch | `_computeOwcHistory` + `SEC_TAG_MAP.total_debt` | Kurzfristige Finanzschulden nur als Restgroesse `total_debt − long_term_debt`; `debt_short_term` wird ignoriert. Gleiche Bilanz, Fair Value **25,26 statt 19,62** (+28,7 %), WC-Quote kippt von +10 % auf −20 % |
| A-5 | mittel | `forecastDcfCore` | Verwaesserung endet im Terminalwert bei Jahr 10 (`pvTvAbs / sharesYear[10]`): bei 8 %/y ist der TV je Aktie **2,10x** zu hoch, Gesamtwert +22 % |
| A-6 | niedrig | `computeMidCycleFcf` | Fehlende D&A still als 0 → Referenz-FCF 100 statt 150 (nur Anzeige/Warnung) |
| A-7 | niedrig | Synthesizer (MoS) | Buyback-Zuschlag liest nur `modelResults['dcf']`; im Mid-Cycle-Pfad heisst der Schluessel `dcf_midcycle` → Zuschlag entfaellt trotz 94 % Uplift |

Offene Pruefpunkte: O-1 moegliche Doppelzaehlung laufender Faelligkeiten im
Debt-Komponenten-Rebuild (ohne echte SEC-Facts nicht belegbar) · O-2
Working-Capital-Historie ohne Periodenabgleich (`_joinPeriodKeyed` fehlt) ·
O-3 zwei Randfaelle der Nullstellensuche im Reverse DCF (kein reproduzierender
Datensatz konstruierbar).

### Tatsaechlich ausgefuehrte Tests

* Baseline auf `3544bcf` selbst ausgefuehrt: **1700 Rechen-Assertions ·
  434 Fixture-Assertions · 148 Node-Tests · Exit-Code 0**.
* Nach Ergaenzung der Audittests: **1700 Rechen-Assertions · 162 Node-Tests
  (148 + 14 neu) · Exit-Code 0**.
* Keine bestehende Testerwartung wurde geaendert.

Die 14 neuen Tests in `tests/audit-chat12.test.mjs` sind ausdruecklich
getrennt:

* **A1–A5 Referenz** (Erwartungswerte unabhaengig nachgerechnet, sichern
  richtiges Verhalten ab): konstanter FCFF-Fall (EV = 150/0,10 = 1.500M =
  15,00/Aktie, inkl. Aufteilung Phase 1 / Terminalwert gegen die Annuitaet) ·
  Nettoschuldeneffekt (0 / 500 / −200 / 2.000 / fehlend) ·
  Working-Capital-Bindung gegen eine eigene Formel, mit drei Gegenbeispielen
  (Quote 0, g = 0 wirkungslos, negative Quote) · Reverse-DCF-Roundtrip in vier
  Varianten inkl. Gegenprobe `checkValuePerShare` · Matrix-Mittelzelle = DCF-Base.
* **B1–B8 Befund-Nachweis** (characterization): halten die bestaetigten
  Abweichungen als Messwert fest. Sie behaupten NICHT, dass das Verhalten
  richtig ist; jeder nennt im Kommentar den Befund und die Erwartung, die nach
  der Korrektur gelten muss. **Wer einen Befund behebt, muss den zugehoerigen
  B-Test umkehren** — das ist beabsichtigt und dokumentiert.

Geprueft wurden die End-zu-Ende-Aufrufwege (`modelDcf`, `modelDcfMidcycle`,
`computeSensitivityMatrix`/`buildSensitivityMatrix`, `solveReverseDcfGrowth`,
`computeReverseDcfFull`, `buildReverseDcfOverviewCard`,
`buildReverseDcfDiagnosticBlock`, `runMonteCarloDcf`,
`buildSnapshotForecastTargets`, `runValuationEngine`, `buildScenarios`,
Datenbasis- und Bilanzschicht), nicht nur isolierte Hilfsfunktionen. Die
Audittests laden dafuer den ausgelieferten `<script>`-Block vollstaendig in
einen vm-Kontext (`tests/audit-chat12.mjs`), read-only, ohne DOM und ohne Netz.

### Verbleibende Einschraenkungen dieses Audits

Ausdruecklich **keine** pauschale Zertifizierung. Nicht geprueft: kein
Live-Abruf bei SEC/Yahoo (alle Nachweise beruhen auf synthetischen Daten mit
von Hand nachgerechneten Erwartungswerten) · keine Browser-/DOM-Pruefung
(die zwei DOM-Tests bleiben ausgewiesen uebersprungen) · die Nicht-DCF-Modelle
(RIM, RIM-Buyback, DDM, EPV-Floor, P/TBV-Gordon, Excess Return) wurden nicht
auf innere Konsistenz geprueft · Gewichtung im Synthesizer, Einstiegszone und
Datenqualitaets-Gates nur so weit, wie A-7 sie beruehrt · Sektor- und
Klassifikationstabellen, Laufzeit und Sicherheit ungeprueft. Abschnitt 4 von
`AUDIT-CHAT12.md` fuehrt das aus.

Die Einschraenkungen der Vorschritte bleiben unveraendert offen (D&A-Sperre
wirkt auch auf Jahresbasis; auf TTM sind `book_value`, `tangible_book_value`,
`dps` u. a. ungedeckt; Synthesizer bewertet Datenverfuegbarkeit an der
Jahreshistorie; Einheitenverdacht in `_makeBaseValuation()`; indexbasierte
Ableitung in `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen).

### Anschlussstand fuer den naechsten Schritt

* Uebergabebranch: `claude/dreamy-cray-kc8x6o`
* Ausgangscommit dieses Schrittes: `3544bcf` (Code `b5559df`, V1.0.57)
* Ergebniscommit: `82a2f82`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/82a2f82
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/dreamy-cray-kc8x6o
* Auditbefunde: `AUDIT-CHAT12.md`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/blob/claude/dreamy-cray-kc8x6o/AUDIT-CHAT12.md
* Tool-Datei (unveraendert):
  `us-aktienbewertungstool-v1036-sector-classification-patch.html`
* Testbefehl: `npm test` · erwartet **1700 Rechen-Assertions · 162 Node-Tests
  · Exit-Code 0**
* Empfohlene Reihenfolge fuer die Reparatur: A-2 und A-3 zuerst (eine
  gemeinsame Ursache je Weg, rein mechanisch), dann A-1, dann A-4, dann A-5.
  A-6 und A-7 sind Einzeiler.

## Reparatur: Zwei Restfehler bei den TTM-Aktienangaben (V1.0.57)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/ttm-integration-fixes`, Ausgangscommit
`4da5082161098a7f288bddf5c8a29cc6465f7928` (Codecommit `7087944`) — der
neueste Stand auf GitHub, der diese Reparaturen enthaelt; kein anderer Branch
enthaelt ihn, `main` steht weiterhin auf `b023dc8`. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Reparaturbranch: `claude/ttm-share-period-fixes`. Testbefehl: `npm test`.
Baseline auf `4da5082` selbst ausgefuehrt: **1645 Rechen-Assertions ·
142 Node-Tests · Exit-Code 0**.

### Befunde vor der Aenderung reproduziert

Am unveraenderten Stand, mit den synthetischen SEC-Facts aus
`_testTtmIntegrationFixes()` und ueber den produktiven Importweg:

| Befund | vorher | erwartet |
|---|---|---|
| 1: Aktienangabe 11.04.–30.06.2025 (81 Tage) gegen Umsatzquartal 01.04.–30.06.2025 (91 Tage) | mit **91** Tagen gewichtet, TTM-Aktienzahl **1.247,331506849315 Mio.**, `complete: true`, keine Warnung, DCF anwendbar | Angabe verwerfen, Diagnose, FY-Rueckfall |
| 2: verwendete Aktienangabe (Ende 30.06.2025) veroeffentlicht am 01.09.2025, Datenstichtag 10.09.2025 | `publication.latest_filed` = **2025-08-01** | 2025-09-01 |

Beide Werte wurden vor der Aenderung einzeln ausgegeben und stimmen mit dem
Befund ueberein. Nachgerechnet: (92·1002 + 92·1000 + 90·998 + 91·**1992**)/365
= 455276/365 = 1.247,3315068493151.

### 1 · Aktienperioden vollstaendig abgleichen

* `buildTtmDataset` fuehrt in jedem TTM-Fenster jetzt auch die
  **Quartalsbeginne** mit (`quarterStarts`) — bis V1.0.56 nur Enden und Dauern.
* `buildTtmShareBasis` ordnet eine Quartalsangabe nur noch zu, wenn **Beginn
  UND Ende** exakt zum zugehoerigen Flussquartal passen. Ein gleiches
  Enddatum oder eine aehnliche Dauer genuegt nicht. Fehlen die
  Quartalsbeginne, wird **nicht** ersatzweise ueber das Enddatum zugeordnet,
  sondern mit Grund abgebrochen.
* Gewichtet wird mit der **tatsaechlichen Periodendauer der Angabe**
  (aus deren eigenem Beginn und Ende), nicht mit der Dauer des Umsatzquartals.
* `collectWeightedShareQuarters` schluesselt Angaben jetzt nach der
  **vollstaendigen Periode** (`Beginn|Ende`) statt nach dem Enddatum. Dadurch
  kann eine zeitlich unpassende Angabe eine passende nicht mehr verdraengen,
  bevor die Vereinbarkeit ueberhaupt geprueft ist. Die Berichtigungsregel
  („zuletzt veroeffentlichte Angabe gewinnt") gilt weiterhin, aber nur
  innerhalb **derselben** Periode — sonst waere sie ein Periodenwechsel.
  Dieselbe Regel wendet `buildTtmShareBasis` auf die kompatiblen Angaben an;
  eine Angabe ohne Datum verdraengt keine datierte.
* Fehlt danach eine passende Angabe, nennt die Diagnose den erwarteten
  Zeitraum **und** die vorhandene abweichende Angabe. Es wird nichts gekuerzt,
  hochgerechnet oder ersetzt; es greift der bestehende sichtbare FY-Rueckfall
  (bzw. die bestehende Sperre). Der Jahresimport bleibt unberuehrt.

### 2 · Veroeffentlichungsstand der verwendeten Aktienangaben

* `buildTtmShareBasis` fuehrt die Herkunft der **tatsaechlich verwendeten**
  Angaben mit (`quarters_used[*].filed/form/source`) und weist daraus
  `latest_filed`, `filed_complete` und `forms_used` fuer das juengste Fenster
  aus.
* `buildTtmDataset` bezieht diesen Stand in `publication.latest_filed` ein.
  Verworfene oder nicht verwendete Angaben gehen ausdruecklich **nicht** ein.
* Getrennt ausgewiesen: die **aktuelle Stichtagsaktienzahl** ist eine
  Zusatzangabe (`publication.current_shares_filed`, gekennzeichnet als „nur
  nachrichtlich — nicht Bestandteil des Bewertungsdatenstands"); die
  **historischen gewichteten Durchschnitte** gehoeren zum Datenstand der
  Bewertung.
* Fehlt an einer verwendeten Angabe das Veroeffentlichungsdatum, bleibt
  `latest_filed` null, `latest_filed_complete` ist false und eine Warnung
  benennt die Luecke — es wird kein Datum erfunden.
* Die Datenstichtagsregel bleibt unveraendert: nach dem Stichtag
  veroeffentlichte Angaben werden nicht verwendet (eine zuvor verfuegbare
  kompatible Angabe tritt an ihre Stelle, sonst greift die Fehlend-Behandlung).
* `buildDataBasisReport` reicht den korrigierten Stand samt
  `share_basis.weighted_average_filed` durch; Anzeige (`buildDataBasisCard`)
  und Snapshot (`data_basis`) uebernehmen denselben Stand aus dieser einen
  Quelle.

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1700 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1645 der Baseline **+ 55** neu aus
  `_testTtmSharePeriodFixes`; alle 434 Fixture-Assertions unveraendert gruen),
  Node-Tests **148/148** (142 **+ 6** neu in `tests/sec-ttm.test.mjs`),
  gemeinsamer **Exit-Code 0**.
* **Pflichttests des Auftrags**, jeweils mit von Hand nachgerechneten Werten:
  * Exakter Periodenabgleich weiterhin richtig: (92·1002 + 92·1000 + 90·998 +
    91·996)/365 = 364640/365 = **999,013698630137 Mio.**, Gewichte 92/92/90/91.
  * Gleiches Ende, abweichender Beginn → kein Wert, Diagnose nennt beide
    Zeitraeume, `complete: false`, sichtbarer FY-Rueckfall; 1.247,33… entsteht
    nicht mehr. Geprueft ueber den Weg SEC-Facts → TTM → Bewertung.
  * Passende und unpassende Angabe mit gleichem Ende: nur die passende wird
    verwendet — in **beiden** Eingabereihenfolgen und auch dann, wenn die
    unpassende spaeter veroeffentlicht wurde. Eine Berichtigung **derselben**
    Periode wird weiterhin uebernommen.
  * Gewichtungsquelle: mit absichtlich falschen `quarterDays` bleiben die
    Gewichte 92/92/90/91 (aus den Angaben selbst).
  * Veroeffentlichungsstand 01.09.2025 wird uebernommen — in Datensatz,
    Bericht, Anzeige und Snapshot.
  * Frueherer Datenstichtag (15.08.2025) schliesst die Angabe aus: ohne
    Alternative greift die Fehlend-Behandlung, mit einer zuvor
    veroeffentlichten kompatiblen Angabe wird diese verwendet und der Stand
    bleibt der 01.08.2025.
  * Eine spaetere, unpassende Angabe veraendert weder Aktienbasis noch
    Veroeffentlichungsstand.
* **Gegenproben (ausgefuehrt)**, jede Korrektur einzeln entfernt, danach
  wiederhergestellt (0 rot): Zuordnung wieder nur ueber das Enddatum
  (15 Rechen-/2 Node-Tests) · Gewichtung wieder mit der Umsatzquartalsdauer
  (1 Node-Test) · Erhebung wieder nach Enddatum geschluesselt (1/1) ·
  fehlende Quartalsbeginne wieder toleriert (1/0) · Aktienangaben wieder ohne
  Wirkung auf den Stand (7/2) · unvollstaendiger Stand nicht mehr
  gekennzeichnet (1/1).
* Diff kontrolliert: `git diff -U0` beruehrt ausschliesslich
  `buildTtmShareBasis`, `buildTtmDataset` (Fensterbeginne und
  Veroeffentlichungsstand), `collectWeightedShareQuarters`, das
  Durchreichen in `buildDataBasisReport`, zwei Zeilen der Anzeige sowie die
  Testdateien. Die Korrekturen aus V1.0.55/V1.0.56 (FY/TTM-Sicht, D&A,
  Matrix, Monte Carlo, Snapshot) sind unveraendert.
* **Keine Browser- und keine Live-SEC-Pruefung** in diesem Schritt
  ausgefuehrt.

### Verbleibende Einschraenkungen

* Der Periodenabgleich ist **exakt**: ein Filer, der denselben Zeitraum in
  Aktien- und Ergebnisangaben unterschiedlich datiert, erhaelt keine
  TTM-Aktienbasis, sondern eine Diagnose und den FY-Rueckfall.
* Ohne Datenstichtag bleiben Angaben ohne Veroeffentlichungsdatum verwendbar;
  der Stand gilt dann als unvollstaendig bekannt (`latest_filed` null). Mit
  Datenstichtag schliesst die bestehende Stichtagsregel sie aus.
* Der Veroeffentlichungsstand bleibt das spaeteste Datum der verwendeten
  Angaben des **juengsten** Fensters; aeltere Fenster fuehren ihren Stand
  nicht gesondert.
* Unveraendert offen aus den Vorschritten: D&A-Sperre wirkt auch auf
  Jahresbasis; auf TTM sind `book_value`, `tangible_book_value`, `dps` und
  weitere Reihen ungedeckt (RIM, DDM, P/TBV-Gordon, Excess Return gesperrt);
  der Synthesizer bewertet Datenverfuegbarkeit an der Jahreshistorie;
  Einheitenverdacht in `_makeBaseValuation()`; index-basierte Ableitung von
  `eps_diluted`, `book_value`, `dps` in `applyDerivedFieldsV4`; Korrelationen
  der Monte-Carlo-Groessen; Fachansichten ausserhalb der Hauptansicht nicht
  vereinfacht.

### Anschlussstand fuer den naechsten Schritt

* Uebergabebranch: `claude/ttm-share-period-fixes`
* Ausgangscommit dieses Schrittes: `4da5082` (Code `7087944`)
* Ergebniscommit: `b5559df`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/b5559df
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/ttm-share-period-fixes
* Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
  · Bloecke darin: `SEC-QUARTALS-BLOCK`, `DATENBASIS-BLOCK`, `DCF-CORE-BLOCK`
  · Modulzugaenge: `src/sec-quarterly.js`, `src/sec-ttm.js`, `src/dcf-core.js`
  · Tests: `tests/sec-ttm.test.mjs`, `tests/sec-quarterly.test.mjs`,
    `_testDataBasis`, `_testTtmIntegrationFixes` und
    `_testTtmSharePeriodFixes` in der Tool-Datei
  · Testbefehl: `npm test`

## Reparatur (nach Chat 11): Vier Integrationsbefunde der TTM-Datenbasis (V1.0.56)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/loving-hypatia-dw0omk`, Ausgangscommit
`dd35f7e824853c747c4004e4fd4a32f65459f22f` (Codecommit `55462b1`) — der
neueste Stand auf GitHub, der Chat 11 enthaelt; kein anderer Branch enthaelt
ihn, `main` steht weiterhin auf `b023dc8`. Tool-Datei:
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Reparaturbranch: `claude/ttm-integration-fixes`. Testbefehl: `npm test`.
Baseline auf `dd35f7e` selbst ausgefuehrt: **1541 Rechen-Assertions ·
136 Node-Tests · Exit-Code 0**.

### Befunde vor der Aenderung reproduziert

Am Testdatensatz aus `_testDataBasis()`, mit dem unveraenderten Stand:

| Groesse | vorher | mit korrekter Bewertungssicht |
|---|---|---|
| Haupt-DCF (TTM) | 4,5278430548507655 | — |
| zentrale Matrixzelle (bestehender Anzeigeweg) | 6,840667572136707 | 4,5278430548507655 |
| Monte Carlo, Seed 4242, 500 Laeufe (Median) | 6,668302970122216 | 4,503155606297324 |
| erster Prognoseumsatz im Snapshot | 5.003,50 | 5.253,675 |
| Ausgangsperiode der Prognose | 2024-12-31 | 2025-06-30 |
| Aktienbasis im Snapshot | 1000 (FY) | 999,0136986301369 (TTM) |
| D&A-Quote im TTM-DCF | 0 (unbelegt) | gemessen |

`fundamentals._ttm` entstand im SEC-Abruf gar nicht — `datasetFromFacts()` war
nur ueber `src/sec-ttm.js` erreichbar.

### 1 · Eine gemeinsame Bewertungssicht

* Neu `resolveValuationView(mj, valuation)`: loest die Datenbasis **einmal**
  auf und liefert die Sicht, auf der die gespeicherte Bewertung beruht.
  Weichen gespeicherte Bewertung und aktuelle Auswahl voneinander ab, gibt es
  **keine** Sicht, sondern einen benannten Hinweis — Zahlen aus zwei
  Datenbasen werden nicht nebeneinander gezeigt.
* `buildValuationBasisView()` ist jetzt **idempotent**: eine bereits
  aufgeloeste Sicht wird unveraendert zurueckgegeben (keine doppelte
  Umwandlung).
* Neu `buildValuationDiagnosticBlocks(mj, v, baseRateWarnings)` — die
  Diagnosebloecke der Bewertungsansicht (Sensitivitaetsmatrix, Simulation,
  Reverse-DCF-Diagnose) entstehen dort auf **einer** Sicht. `renderValuation`
  reicht sie nur noch durch; damit ist genau der Anzeigeweg pruefbar und nicht
  nur die Helfer darunter. Die Uebersicht ruft
  `buildReverseDcfOverviewCard` ebenfalls auf der Sicht auf.
* Unveraendert bleiben: alle FY-Direktaufrufe der Helfer (`computeSensitivity
  Matrix(mj, v)` usw.), der Faktor-Overlay (rechnet nur auf Kurs, Synthese und
  Qualitaet — datenbasisunabhaengig) und der Synthesizer, der Modellergebnisse
  sowie Datenverfuegbarkeits-Urteile aus der **Jahreshistorie** bewertet
  (ausdruecklich gewollt, siehe „Qualitaetsdiagnostik").

### 2 · Konsistente TTM-Snapshots

* `buildSnapshotRecord` loest die Sicht der gespeicherten Bewertung auf und
  verwendet sie fuer `buildForecastInputs`, `buildSnapshotShareBasis` und
  `buildSnapshotForecastTargets`. Gespeichert wird weiterhin das
  **unveraenderte** Master-JSON samt Jahreshistorie als reproduzierbarer Input.
* `_snapshotTargetPeriod` kennt die Periodenart: ein fortgeschriebenes
  TTM-Fenster wird **nicht** als Geschaeftsjahr ausgegeben
  (`target_fiscal_year: null`, Beschriftung „TTM-Periode bis …, kein
  Geschaeftsjahr"). Die Ausgangsperiode stammt aus den Periodenangaben der
  tatsaechlich verwendeten Reihen.
* `buildSnapshotShareBasis` unterscheidet jetzt ausdruecklich drei Groessen:
  historischer gewichteter Durchschnitt (`shares_diluted_*`, mit
  `average_kind`), Aktienzahl am Stichtag (`current_shares_*`) und der
  tatsaechlich verwendete Bewertungsnenner (`valuation_denominator*` aus dem
  DCF-Ergebnis).
* `key_inputs` behaelt die FY-Kennzahlen unveraendert und ausdruecklich als
  `latest_fy_*` benannt; daneben steht neu `key_inputs.valuation_basis` mit
  den Groessen, auf denen die gespeicherte Bewertung wirklich beruht.
* Ist die Basis nicht eindeutig (Bewertung auf FY, Auswahl auf TTM), entstehen
  **keine** halb gerechneten Prognoseziele, sondern ein benannter Grund.
  Vorhandene Snapshots werden nicht neu berechnet oder ueberschrieben.

### 3 · Fehlende Abschreibungen sind nicht 0

* Der Quartalsumfang ist um `depreciation_amortization` erweitert — **ohne
  neuen Tag**: verwendet wird die vorhandene Liste `SEC_TAG_MAP.da`. Die
  TTM-Datenbasis deckt D&A damit periodengleich ab und bildet daraus
  `EBITDA = EBIT + D&A` desselben Fensters (gleiche Definition wie in der
  Jahressicht, keine Doppelzaehlung). D&A ist ein **optionales** Feld: sein
  Fehlen macht die TTM-Basis nicht unbrauchbar.
* Neu `_resolveDaForForecast(mj)` nach dem Vorbild von
  `_resolveOwcForForecast`: `measured` · `manual_override` ·
  `assumption_required`. `buildForecastInputs` gibt `daRatio` **null** statt 0,
  wenn nichts belegt ist.
* Neu `_explicitNumber()`: nur eine echte Zahl (auch als numerischer Text)
  gilt als gesetzte Annahme. **Fehlend, Leerstring, `false` und Text ohne Zahl
  gelten nicht als ausdrueckliche 0.**
* Die Entscheidung faellt **einmal** in `buildCoreValuationContext` und gilt
  damit fuer Haupt-DCF, Mid-Cycle, Reverse DCF, Sensitivitaetsmatrix und Monte
  Carlo; `buildSnapshotForecastTargets` verwendet dieselbe Entscheidung. Jeder
  Weg nennt denselben Grund (`_daBlockReason`), der DCF zusaetzlich
  `_exclusionCode: 'da_assumption_required'`.
* Neues Annahmenfeld „Abschreibungen (D&A) / Umsatz (%)" (`as-da`,
  `valuation.assumptions.da_pct_of_revenue`). Herkunft und Status stehen im
  Ausweis der Datenbasis (`report.da`) und damit in Anzeige **und** Snapshot.
* **Folge, die ueber TTM hinausgeht:** fehlen D&A-Daten vollstaendig, fehlt
  auch die Jahres-EBITDA-Reihe — dann gilt dieselbe Sperre auf FY. Das ist
  gewollt: eine unbelegte Null ist auf Jahresbasis genauso falsch. Alle
  vorhandenen Fixtures liefern messbare D&A; keine bestehende Erwartung
  musste dafuer geaendert werden.

### 4 · Quartals-/TTM-Erzeugung am produktiven Importpfad

* Der Quartalsnormalisierer steht jetzt als **SEC-QUARTALS-BLOCK** in der
  ausgelieferten HTML-Datei — derselben einzigen Quelle wie DCF-CORE-BLOCK und
  DATENBASIS-BLOCK. `src/sec-quarterly.js` schneidet ihn aus und behaelt seine
  Schnittstelle unveraendert. Kein Build-Schritt, keine Browserkopie; fachlich
  ist der Code unveraendert uebernommen (einziger Unterschied: `appTagMap()`
  liest `SEC_TAG_MAP` direkt statt aus der Datei).
* Die Erzeugerseite (gewichtete Quartalsaktienzahlen, Quartals-EPS als
  Gegenprobe, aktuelle Aktienzahl, `quarterlyPayloadFromFacts`,
  `buildTtmDatasetFromFacts`) liegt jetzt ebenfalls im DATENBASIS-BLOCK;
  `src/sec-ttm.js` leitet nur noch weiter.
* **Einheitengrenze** `convertQuarterlyPayloadUnits()`: Geldbetraege ÷ Teiler
  der Berichtseinheit, Aktienzahlen ÷ 1e6 (Mio. Stueck), Werte je Aktie mit
  dem Verhaeltnis beider Teiler skaliert. Die Werte werden **umgerechnet**,
  nicht umbenannt; die Umrechnung ist ausgewiesen (`unit_conversion`).
* `_buildSecMasterJson` legt `fundamentals._ttm` aus denselben companyfacts an
  und protokolliert das Ergebnis unter `meta._sec_fetch.ttm`. FY bleibt
  Vorgabe (`valuation.data_basis` wird nicht gesetzt); ein Fehler in der
  TTM-Erzeugung wirft nicht und laesst den Jahresimport unberuehrt.
  Veroeffentlichungsstand, Berichtigungen, Perioden und Quellen bleiben
  erhalten. Eine manuelle `_ttm`-Vorbereitung ist nicht mehr noetig.

### Geaenderte Testerwartungen (mit Begruendung)

1. `tests/sec-quarterly.test.mjs`, Abschnitt 10: die frueheren Erwartungen
   („die Zeichenketten kommen in der HTML-Datei nicht vor") beschreiben den
   Aufbau nach dem Umzug nicht mehr. Geprueft wird jetzt die dahinterliegende
   Eigenschaft: **genau eine** Implementierung, und zwar in der Anwendung;
   keine Teilkopie im Modul; keine zweite Fassung der Tag-Listen.
2. Derselbe Test: Umfang um `depreciation_amortization` erweitert — mit
   Begruendung und der Pruefung, dass kein neuer Tag entsteht.
3. `_testDataBasis`: „ungedecktes Feld bleibt leer" verwendete `ebitda` als
   Beispiel; EBITDA ist jetzt gedeckt (EBIT + D&A). Das Beispiel ist auf ein
   weiterhin ungedecktes Feld umgestellt, EBITDA wird positiv geprueft.
4. `tests/sec-ttm.test.mjs`: die Fixtures erklaeren ihre Berichtseinheit
   (`'units'`), weil die Erzeugung sie jetzt ausweist.

Keine weitere bestehende Erwartung wurde geaendert oder gelockert.

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1645 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1541 der Baseline + **84** aus `_testDataBasis`
  erweitert + **102** neu aus `_testTtmIntegrationFixes`; alle 434
  Fixture-Assertions unveraendert gruen), Node-Tests **142/142**
  (136 + 6 neu), gemeinsamer **Exit-Code 0**.
* **Echter Browser** (vorinstalliertes Chromium, `headless_shell`, reales DOM,
  **synthetische SEC-Antworten, kein Netzzugriff**): 20 Pruefungen gruen —
  Import erzeugt `_ttm`; FY-Ansicht rendert; Auswahlfeld vorhanden; Wechsel
  FY → TTM → FY; Matrix rechnet mit den Nettoschulden der jeweiligen Sicht
  (400M gegen 360M); Simulation gerendert; RIM auf TTM gesperrt; Snapshot mit
  TTM-Basis, Zielperiode 2026-06-30 und TTM-Aktienbasis; FY-Ergebnis nach der
  Rueckkehr bitgleich reproduziert (8,97098352412715); ohne D&A ist der DCF
  gesperrt und der Grund sichtbar.
* **Gegenproben (ausgefuehrt)**, jede Korrektur einzeln entfernt, danach
  wiederhergestellt (0 rot): Matrix auf Jahresdaten (2 rot) · Simulation auf
  Jahresdaten (2) · Reverse-DCF-Block auf Jahresdaten (2) · Schutz vor
  gemischten Basen entfernt (3) · doppelte Umwandlung wieder moeglich (1) ·
  Snapshot-Forecast-Inputs aus dem Master-JSON (2) · Aktienbasis aus dem
  Master-JSON (2) · Prognoseziele aus dem Master-JSON (3) · Zielperioden
  wieder als Geschaeftsjahr (2) · gemischte Basis im Snapshot zugelassen (1) ·
  D&A wieder still 0 (1) · Sperre im Kern entfernt (5) · gemessene D&A
  ignoriert (123) · Leerstring gilt wieder als 0 (1) · Erzeugung im
  Importpfad entfernt (1) · Einheitenumrechnung entfaellt (16 Rechen-/1
  Node-Test).
* Diff kontrolliert: `git diff -U0` zeigt ausser den genannten Stellen keine
  Aenderung; die Loeschungen beschraenken sich auf die ersetzten Zeilen.

### Verbleibende Einschraenkungen

* Ohne belegte D&A sind DCF, Mid-Cycle, Matrix, Simulation und Reverse DCF
  gesperrt — **auch auf Jahresbasis**. Abhilfe ist sichtbar benannt
  (Annahmenfeld setzen, auch 0 ist zulaessig).
* Auf TTM-Basis bleiben `book_value`, `tangible_book_value`, `dps`,
  `gross_profit`, `sbc` und weitere Reihen ungedeckt; RIM, RIM-Buyback, DDM,
  P/TBV-Gordon und Excess Return sind dort gesperrt.
* Der Synthesizer bewertet Datenverfuegbarkeit weiterhin an der
  Jahreshistorie (Leverage-Add-on aus `net_debt/ebitda`, SBC-Deckel). Das ist
  gewollt, heisst aber: diese Zuschlaege beziehen sich auf die Jahresreihe,
  nicht auf das TTM-Fenster.
* Fuer die Umstellung sind weiterhin mindestens zwei ueberschneidungsfreie
  Fenster noetig; der Quartalsanschluss wird exakt verlangt.
* Masseinheiten werden an der Grenze umgerechnet, aber nicht geraten: passt
  `ds.reporting_unit` nicht zu `meta.reporting_unit`, bleibt es sichtbar bei FY.
* Die Browserpruefung deckt den Ablauf mit **synthetischen** SEC-Antworten ab;
  ein Abruf gegen echte SEC-Daten (Proxy) ist damit nicht geprueft.
* Offen aus den Vorschritten: Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen;
  Fachansichten ausserhalb der Hauptansicht nicht vereinfacht.

### Anschlussstand fuer Chat 13

* Uebergabebranch: `claude/ttm-integration-fixes`
* Ausgangscommit dieses Schrittes: `dd35f7e` (Code `55462b1`)
* Ergebniscommit: `7087944`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/7087944
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/ttm-integration-fixes
* Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
  · Bloecke darin: `SEC-QUARTALS-BLOCK`, `DATENBASIS-BLOCK`, `DCF-CORE-BLOCK`
  · Modulzugaenge: `src/sec-quarterly.js`, `src/sec-ttm.js`, `src/dcf-core.js`
  · Tests: `tests/sec-ttm.test.mjs`, `tests/sec-quarterly.test.mjs`,
    `_testDataBasis` und `_testTtmIntegrationFixes` in der Tool-Datei
  · Testbefehl: `npm test`

## Chat 11: TTM-Werte aus Quartalsdaten und ausgewiesene Datenbasis (V1.0.55)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/sec-quarterly-period-fixes`, Ausgangscommit
`6410d52273868d48f9beb53535ad03337fc121a2` — der neueste Stand auf GitHub, der
Chat 10 **einschliesslich** der anschliessenden Korrektur (V1.0.54) enthaelt;
kein anderer Branch enthaelt ihn, `main` steht weiterhin auf `b023dc8`.
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
(einzige Produktdatei; Start durch Oeffnen im Browser, Testeinstieg ueber
`test/run-calc-tests.js`, das genau diese Datei laedt). Arbeitsbranch dieses
Schrittes: `claude/loving-hypatia-dw0omk`. Testbefehl: `npm test`.
Baseline auf `6410d52` (ausgefuehrt): **1459 Rechen-Assertions · 111 Node-Tests
· Exit-Code 0**.

### Was umgesetzt wurde

**Neuer, markierter Baustein in der Tool-Datei: `DATENBASIS-BLOCK`.**
Nach dem Vorbild des `DCF-CORE-BLOCK` steht die Rechnung in der
ausgelieferten HTML-Datei (einzige Quelle) und wird von `src/sec-ttm.js`
zum Testen als Modul ausgeschnitten — **keine zweite Fassung der Logik**.
Der Block ist rein: kein DOM, kein `localStorage`, kein `state`, kein Zufall,
keine Uhrzeit (durch einen Test abgesichert), und er laeuft in einer leeren
Sandbox.

1. **TTM aus vier vollstaendigen Quartalen** (`computeTtmFromQuarters`).
   Die vier Quartale muessen unmittelbar aneinander anschliessen
   (Ende + 1 Tag = Beginn) — damit sind Luecken **und** Ueberlappungen
   ausgeschlossen; zusaetzlich werden die Quartalspositionen als
   aufeinanderfolgend geprueft und der Gesamtzeitraum auf das Jahresfenster
   (340–385 Tage) begrenzt. Unbrauchbare Quartale (fehlender Wert, Dauer
   ausserhalb 80–100 Tagen, offener Widerspruch zur Differenz der
   Kumulierungen) zaehlen nicht als vollstaendig und werden mit Grund
   ausgewiesen.
2. **Kontrollierter zweiter Weg** (`computeTtmFromFyYtdBridge`): letztes
   Geschaeftsjahr + laufendes YTD − vergleichbares Vorjahres-YTD. Geprueft
   werden einzeln: gleiche YTD-Stufe, Vorjahres-YTD beginnt zum
   Geschaeftsjahr, laufendes YTD schliesst an das Geschaeftsjahr an,
   Geschaeftsjahr ist ein volles Jahr, hergeleiteter Zeitraum liegt im
   Jahresfenster. Faellt eine Pruefung durch, entsteht kein Wert, sondern
   ein benannter Grund. Der zweite Weg laeuft als **Gegenprobe** zum ersten;
   weichen Wert oder Zeitraum ab, gilt das Feld als nicht belastbar
   (kein stiller Vorrang eines Weges).
3. **Bilanzwerte** (`selectBalanceAsOf`): verwendet wird der Stichtag am
   Ende des jeweiligen TTM-Fensters. Kein additiver Codepfad, keine
   Fortschreibung, keine Mischung mit Jahreswerten; fehlt der passende
   Stichtag, entsteht kein Wert.
4. **Aktienzahlen und EPS gesondert.** Die gewichtete TTM-Aktienzahl ist der
   **nach Quartalslaenge gewichtete Mittelwert** der vier
   Quartalsdurchschnitte — ausdruecklich keine Summe. EPS entsteht aus
   TTM-Ergebnis / gewichteter TTM-Aktienzahl; die Summe der Quartals-EPS
   wird nur als Gegenprobe ausgewiesen (`used: false`) und bei Abweichung
   > 1 % gewarnt. Die **aktuelle** Aktienzahl am Stichtag bleibt davon
   getrennt gefuehrt und wird getrennt angezeigt.
5. **Nur zueinander passende Zeitraeume.** Die TTM-Sicht besteht
   ausschliesslich aus **ueberschneidungsfreien Zwoelfmonatsfenstern**,
   jeweils um vier Quartale versetzt (`ttmWindowEndsFrom`). Dadurch bleiben
   Quoten (z. B. CapEx/Umsatz) und Vorjahresvergleiche innerhalb derselben
   Periodenart. Die **Jahresreihen des Master-JSON bleiben unveraendert** —
   `buildValuationBasisView` erzeugt eine Kopie; Qualitaets- und
   Datenqualitaetsdiagnostik rechnen weiterhin auf den Jahresreihen (durch
   Test abgesichert: gleicher `fundamentalsHash`, gleiche Scores).
6. **Auswahl in der Oberflaeche**: „Letztes Geschäftsjahr (FY)" gegen
   „TTM (letzte vier Quartale)" im Annahmen-Reiter
   (`_handleDataBasisChange`, gespeichert in `valuation.data_basis`).
   Vorgabe bleibt FY. Umgestellt wird **nur bei vollstaendigen Daten**:
   mindestens zwei ueberschneidungsfreie Fenster, alle gedeckten Feldarten
   vorhanden, Aktienbasis vorhanden — und die **Masseinheit** des
   Datensatzes muss zur `meta.reporting_unit` des Master-JSON passen
   (es wird nicht umgerechnet und keine Einheit unterstellt).
7. **Ausweis je Bewertung** (`buildDataBasisReport`, Anzeige
   `buildDataBasisCard`): Zeitraum, verwendete Quartale,
   Veroeffentlichungsstand (spaetestes Filing der verwendeten Angaben,
   Formulare, Datenstichtag, Quelle), Aktienbasis (Durchschnitt **und**
   aktuelle Aktienzahl getrennt), Warnungen, Rueckfall und Modellsperren.
   Sichtbar im Annahmen-Reiter (mit Auswahl), im Bewertungs-Reiter und in
   der Ersatzansicht bei gesperrter Bewertung. Im Snapshot gespeichert als
   `data_basis` — genau der Ausweis, der in **dieser** Bewertung galt
   (`valuation.dataBasis`), nicht mit heutigen Annahmen nachgerechnet;
   Format-1-Snapshots erhalten ihn bei der Migration aus dem gespeicherten
   Master-JSON.
8. **Kein stilles Vermischen.** Unvollstaendige TTM-Daten fuehren zum
   **sichtbaren Rueckfall** auf das Geschaeftsjahr samt Begruendung. Wird auf
   TTM gerechnet, bleiben Felder ohne TTM-Deckung in der Bewertungssicht
   **leer** (statt den Jahreswert einzumischen), vorgegebene Jahres-
   Ersatzreihen (`fundamentals.derived.*.override_series`) sind ausgesetzt,
   und Modelle mit ungedeckten Pflichtfeldern werden **gesperrt**
   (`_blockedByDataBasis`, mit Nennung des fehlenden Feldes). Gedeckt sind
   derzeit Umsatz, EBIT, Nettoergebnis, CFO, CapEx, die fuenf Bilanzposten,
   Aktienzahl und EPS — DCF, Mid-Cycle-DCF und EPV laufen auf TTM, RIM,
   RIM-Buyback, DDM, P/TBV-Gordon und Excess Return werden gesperrt
   (`book_value`, `tangible_book_value`, `dps` liegen nicht als TTM-Groesse vor).

**Erzeugerseite** in `src/sec-ttm.js` (Node, ausserhalb der Tool-Datei):
`quarterlyPayloadFromFacts` verbindet `normalizeSecQuarters`
(`src/sec-quarterly.js`) mit der **gesondert** erhobenen Aktienseite
(gewichtete Quartalsdurchschnitte, Quartals-EPS als Gegenprobe, aktuelle
Aktienzahl aus `dei:EntityCommonStockSharesOutstanding`); `datasetFromFacts`
liefert daraus den fertigen Datensatz fuer `fundamentals._ttm`.

### Geaenderte und neue Dateien

* `us-aktienbewertungstool-v1036-sector-classification-patch.html` —
  neuer `DATENBASIS-BLOCK`; `runValuationEngine` rechnet auf der
  aufgeloesten Datenbasis und gibt `dataBasis` zurueck; Anzeige und Auswahl;
  `buildSnapshotRecord`/`migrateSnapshotRecord`; neuer Test `_testDataBasis`.
* `src/sec-ttm.js` (neu) — Blockauszug + Erzeugerseite.
* `tests/sec-ttm.test.mjs` (neu) — 25 Tests.
* `tests/sec-quarterly.test.mjs` — **eine** Erwartung geaendert (siehe unten).
* `test/run-calc-tests.js` — `_testDataBasis` registriert.

### Geaenderte Testerwartung (mit Begruendung)

`tests/sec-quarterly.test.mjs`, Abschnitt 10: Der Test verlangte bisher, dass
die Zeichenketten `sec-quarterly` und `normalizeSecQuarters` in der Tool-Datei
**gar nicht** vorkommen. Das war die Abgrenzung „Normalisierer noch nicht
angeschlossen". Durch diesen Auftrag verwendet die Anwendung normalisierte
Quartalsdaten und nennt deren Herkunft ausdruecklich — die alte Erwartung
beschreibt den gewollten Zustand nicht mehr. Der Test prueft jetzt schaerfer,
was weiterhin gelten muss: **keine Kopie** der Normalisierungsfunktion in der
Anwendung, **kein** Modulimport, **keine** zweite Fassung des Feldumfangs
(`SEC_QUARTERLY_FIELDS`) — und zusaetzlich, dass die Herkunft benannt wird.
Keine andere bestehende Erwartung wurde geaendert oder gelockert.

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1541 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1459 unveraendert **+ 82 neu** aus `_testDataBasis`;
  alle 434 Fixture-Assertions unveraendert gruen), Node-Tests **136/136**
  (111 unveraendert, **+ 25** aus `tests/sec-ttm.test.mjs`, ein umformulierter
  Abgrenzungstest), gemeinsamer **Exit-Code 0**.
* **Pflichttests des Auftrags** — jeweils mit von Hand nachgerechneten
  Erwartungswerten:
  * *Beide Rechenwege stimmen ueberein*: Summe der vier Quartale
    (200+210+220+230 = 860) gegen FY2024 (780) + YTD2/2025 (450) −
    YTD2/2024 (370) = 860, gleicher Zeitraum 01.07.2024–30.06.2025
    (`tests/sec-ttm.test.mjs`); in der Anwendung zusaetzlich fuer alle fuenf
    Zeitraumgroessen als `cross_check.status === 'uebereinstimmend'`.
  * *Fehlendes Quartal wird erkannt*: „Quartalsreihe bricht vor FY2025-Q1 ab",
    kein Wert, kein ersatzweise aelteres Fenster; in den Rohdaten ebenso
    (`window_count === 0`), mit sichtbarem Rueckfall auf FY.
  * *Stichtagsdaten bleiben unveraendert*: Schuldenreihe 1180/1120/1010 bzw.
    560/540/520 exakt wie gemeldet, Stichtage = Fensterenden, keine Summe
    (2195 entsteht nicht), Wert zum Geschaeftsjahresende identisch mit dem
    Jahresabschlusswert.
  * *FY-Ergebnisse bleiben bei FY-Auswahl reproduzierbar*: gleiche
    Modellergebnisse ohne Auswahl, mit `data_basis: 'fy'`, bei zweitem
    Aufruf, bei angefordertem aber fehlendem TTM, bei luecken- bzw.
    aktienlosem TTM-Datensatz und bei abweichender Masseinheit —
    jeweils `JSON.stringify(modelResults)` identisch.
* **Gegenproben (ausgefuehrt).** Jede Regel einzeln entfernt, jeweils rote
  Tests, danach wiederhergestellt (0 rot): Anschlusspruefung der Quartale
  (3 Node-Tests) · Gegenprobe der beiden Rechenwege (1) · Bilanzwerte
  fortgeschrieben statt ausgewaehlt (2 Rechen-/2 Node-Tests) · EPS verfaelscht
  (1/1) · Aktienzahl addiert statt gemittelt (4/3) · Umschaltung trotz
  unvollstaendiger Daten (2/2) · ungedeckte Reihen nicht geleert (1/1) ·
  Modellsperre abgeschaltet (3/2) · Einheitenabgleich entfernt (2/1).
* Diff kontrolliert: ausser dem neuen Block, dem neuen Test und den oben
  genannten Stellen keine Aenderung an der Tool-Datei; `git diff -U0` zeigt
  als Loeschungen ausschliesslich den Umbau in `runValuationEngine`.

### Verbleibende Einschraenkungen

* **Der Datensatz `fundamentals._ttm` entsteht noch nicht im SEC-Abruf der
  Anwendung.** Die Rechnung selbst liegt in der Tool-Datei und laeuft im
  Browser, sobald normalisierte Quartalsdaten vorliegen (z. B. aus einem
  Master-JSON, das `_ttm` mitbringt, oder erzeugt mit
  `src/sec-ttm.js → datasetFromFacts`). Der Weg „SEC-Abruf → `_quarterly` →
  `_ttm`" innerhalb von `secFetchAll` ist **nicht** Teil dieses Schrittes;
  ohne Datensatz bleibt alles unveraendert auf Jahresbasis (sichtbar
  begruendet). Das ist der naheliegende naechste Schritt.
* Auf TTM-Basis sind `book_value`, `tangible_book_value`, `dps`, `ebitda`,
  `gross_profit`, `sbc` und weitere Reihen nicht gedeckt; die davon
  abhaengigen Modelle sind gesperrt, und im DCF entfaellt die D&A-Quote
  (keine EBITDA-TTM-Reihe) — statt sie aus Jahreswerten zu ergaenzen.
* Fuer die Umstellung werden **mindestens zwei** ueberschneidungsfreie
  Fenster verlangt. Mit nur einem Fenster gaebe es keinen zulaessigen
  Vorjahreswert; die Bewertung bliebe sonst ohne Vergleichsperiode.
* Die gewichtete TTM-Aktienzahl ist der nach Quartalslaenge gewichtete
  Mittelwert der vier Quartalsdurchschnitte. Das ist exakt, solange sich die
  Aktienzahl innerhalb eines Quartals nicht sprunghaft aendert; eine
  taggenaue Gewichtung ist aus Quartalsangaben nicht herstellbar.
* Der Anschluss der Quartale wird **exakt** verlangt (Ende + 1 Tag = Beginn).
  Ein Filer, der Quartalsgrenzen in zwei Filings unterschiedlich datiert,
  erhaelt dadurch keinen TTM-Wert, sondern eine Diagnose — bewusst streng.
* Masseinheiten werden nicht umgerechnet: passt `ds.reporting_unit` nicht zu
  `meta.reporting_unit`, bleibt es sichtbar bei FY.
* Offen aus den Vorschritten: Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen;
  Fachansichten ausserhalb der Hauptansicht nicht vereinfacht.

### Anschlussstand fuer Chat 12

* Uebergabebranch: `claude/loving-hypatia-dw0omk`
* Ausgangscommit dieses Schrittes: `6410d52`
* Ergebniscommit: `55462b1`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/55462b1
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/loving-hypatia-dw0omk
* Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
  · TTM/Datenbasis: `DATENBASIS-BLOCK` darin, Modulzugang `src/sec-ttm.js`
  · Normalisierer: `src/sec-quarterly.js`
  · Tests: `tests/sec-ttm.test.mjs`, `_testDataBasis` in der Tool-Datei
  · Testbefehl: `npm test`

## Reparatur (nach Chat 10): Drei Fehler im SEC-Quartalsnormalisierer (V1.0.54)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/tender-galileo-wc31j5`, Ausgangscommit
`59eef478c01ee5cd9f295b3bf69578b93e78ed10` — der neueste Stand, der den
Chat-10-Commit enthaelt; keine nachtraeglichen Korrekturen (kein weiterer Branch
enthaelt ihn, `main` steht weiterhin auf `b023dc8`). Geaenderte Dateien:
`src/sec-quarterly.js`, `tests/sec-quarterly.test.mjs`, dieses Dokument.
Produktdatei `us-aktienbewertungstool-v1036-sector-classification-patch.html`
**unveraendert** (per `git diff` gegen `59eef47` belegt), keine Einbindung des
Normalisierers, keine TTM-Integration. Reparaturbranch:
`claude/sec-quarterly-period-fixes`. Testbefehl: `npm test`. Baseline auf
`59eef47` (ausgefuehrt): **1459 Rechen-Assertions · 102 Node-Tests ·
Exit-Code 0**.

### Am Code reproduziert (Stand `59eef47`, vor der Aenderung)

| Fall | vorher | erwartet |
|---|---|---|
| 1A: kumuliert 01.01.–31.03. = 100 und **08.01.**–30.06. = 220 | Q2 01.04.–30.06. = 120, `derived`, keine Warnung | kein Q2, Diagnose |
| 1B: kumuliert 01.01.–**15.06.** = 200 und 01.01.–**10.10.** = 330 | Q3 16.06.–10.10. = 130 mit **117 Tagen**, keine Warnung | kein Q3, Diagnose |
| 2: nur Q4/2022 und Q1/2024 | `gaps` und `warnings` **leer** | vier Luecken FY2023-Q1…Q4 |
| 3: `asOfDate` 2024-06-01, Preferred (filed 2025-05-01) vor Fallback (filed 2024-05-01) | `usedTag` = Preferred, **kein** Quartalswert | Fallback, Q1 = 100 |

Die vier Ausgaben wurden vor der Korrektur einzeln ausgegeben und stimmen mit
dem Befund ueberein.

### Ursachen und Korrekturen

**1. Kompatibilitaet kumulierter Perioden und Dauer der Ableitung.**
Ursache: `normalizeFlowField()` subtrahierte allein aufgrund der Behaelter-
Schluessel (gleiches Geschaeftsjahr, aufeinanderfolgende YTD-Stufe). Die
Toleranz, mit der ein Periodenende in den Geschaeftsjahreskalender einsortiert
wird (20 Tage), setzte dadurch unterschiedlich lange Kumulierungszeitraeume
rechnerisch gleich. Korrektur: neue Funktion `checkCumulativeDerivation(prev,
cur)` prueft vor **jeder** Differenzbildung die tatsaechlichen Daten —
(a) identischer Beginn beider Kumulierungen, (b) richtige zeitliche Reihenfolge,
(c) Dauer der abgeleiteten Einzelperiode im Quartalsfenster (80–100 Tage).
Faellt eine Pruefung durch, entsteht **kein** Quartalswert; der Fall erscheint
strukturiert unter `fields.<feld>.rejectedDerivations` (Grund, beide
Kumulierungen mit Herkunft, gegebenenfalls die berechnete Dauer), als
Lueckengrund und als `warnings`-Eintrag. Zusaetzlich wird ein gemeldetes
Quartal nur noch dann gegen die Differenz geprueft, wenn beide **denselben
tatsaechlichen Zeitraum** abdecken; sonst bleibt der gemeldete Wert stehen und
die Abweichung wird als abgelehnte Ableitung ausgewiesen (kein Schein-
Widerspruch aus verschiedenen Perioden). Zulaessige abweichende und
52/53-Wochen-Geschaeftsjahre bleiben unberuehrt (gleicher YTD-Beginn, 91/92
Tage je Quartal).

**2. Luecken ueber vollstaendig fehlende Geschaeftsjahre.**
Ursache: Die Lueckenliste entstand innerhalb der Schleife ueber die
**belegten** Geschaeftsjahre; ein Jahr ohne jede Angabe wurde nie betrachtet,
und der anschliessende Spannenfilter konnte nur bereits erzeugte Eintraege
durchlassen. Korrektur: Die Spanne wird jetzt ueber eine fortlaufende
Quartalsnummer (`quarterOrdinal` = Geschaeftsjahr × 4 + Quartal) gebildet und
zwischen fruehestem und spaetestem **ausgegebenen** Quartal vollstaendig
durchlaufen; jede nicht belegte Position wird genau einmal gemeldet, absteigend
sortiert, mit Grund (aufgezeichneter Grund des Geschaeftsjahres bzw. „keine
Angaben in diesem Geschaeftsjahr"). Ausserhalb der Spanne entsteht weiterhin
keine Luecke, und es wird kein Wert ergaenzt.

**3. Tag-Auswahl unter dem Datenstichtag.**
Ursache: `pickTag()` entschied vor jeder Filterung allein anhand „Formular
zulaessig und Enddatum vorhanden". Eine erst spaeter veroeffentlichte Angabe
eines bevorzugten Tags verdraengte damit eine historisch zulaessige Quelle.
Korrektur: Die Filterung (Formular, Datumsangaben, fachliche Verwertbarkeit je
Feldart, Datenstichtag) laeuft jetzt in `collectFlowCandidates()` bzw.
`collectInstantCandidates()` **vor** der Tag-Auswahl;
`pickTagWithCandidates()` nimmt den ersten Tag mit tatsaechlich verwertbaren
Angaben. Die Tag-Priorität und „genau ein Tag je Feld" bleiben unveraendert
(kein Tag-Wechsel-Bridging). Widersprueche werden weiterhin **nach** der
Tag-Auswahl aufgeloest — ein ansonsten zulaessiger bevorzugter Tag wird also
nicht still uebersprungen, sein Widerspruch bleibt sichtbar. Uebersprungene
Tags werden in `notes` benannt. Gilt fuer Zeitraumwerte und Bilanzstichtage
gleichermassen; die doppelte Filterlogik beider Feldarten ist dabei
zusammengefallen.

### Neue Tests — `tests/sec-quarterly.test.mjs`, Abschnitt 12 (9 Tests)

Befund 1A · Befund 1B (inkl. `derivedDurationDays` = 117) · gemeldetes vs.
abgeleitetes Quartal mit verschiedenen Zeitraeumen · Befund 2 (vier Luecken,
keine Doppelmeldung, nichts ausserhalb der Spanne) · Luecken ueber fehlende
Geschaeftsjahre bei Geschaeftsjahresende 31.01. (sechs Luecken ueber zwei
Jahresgrenzen) · Befund 3 fuer Zeitraumwerte (mit und ohne Stichtag) · Befund 3
fuer Bilanzstichtage · fachliche Verwertbarkeit statt blossem Enddatum · kein
stiller Tag-Wechsel bei echtem Widerspruch. Erwartungen unabhaengig von Hand
gerechnet, rein synthetische Facts. **Keine bestehende Erwartung geaendert oder
gelockert.**

### Gegenproben (ausgefuehrt)

Jede Korrektur einzeln entfernt, jeweils rote Tests: Pruefung des kumulierten
Beginns → 1 Fehlschlag · Dauerpruefung der Ableitung → 1 · Luecken nur in
belegten Geschaeftsjahren → 2 · Tag-Auswahl ohne Stichtagsfilter → 1 ·
Wertvergleich ohne Zeitraumgleichheit → 1. Danach wiederhergestellt: 0.

### Tatsaechlich ausgefuehrte Tests

* Vor der Aenderung: die neuen Regressionstests auf `59eef47` → **8 von 33
  rot** (die drei Befunde; der Test „kein stiller Tag-Wechsel" war bereits
  gruen und sichert die Korrektur ab).
* Nach der Aenderung: `npm test` → Rechentests **1459 bestanden ·
  0 fehlgeschlagen · 0 Fehler/Exceptions** (unveraendert zur Baseline, die
  HTML-Datei wurde nicht angefasst), Node-Tests **111/111** (102 unveraendert
  **+9 neue**), gemeinsamer **Exit-Code 0**. Alle 434 Fixture-Assertions
  unveraendert gruen.
* Weiterhin gruen und damit belegt: gueltige kumulierte Quartale (Test 4),
  Q4-Ableitung aus 10-K und 10-Q (Test 5), keine Verrechnung ueber
  Geschaeftsjahresgrenzen (Test 6), abweichendes Geschaeftsjahr (Test 8),
  Berichtigungen und Datenstichtag (Tests 10, 11, 15), Bilanzstichtage ohne
  Summierung (Test 14) und 52/53-Wochen-Geschaeftsjahr (Test 24).
* Diff kontrolliert: nur `src/sec-quarterly.js`, `tests/sec-quarterly.test.mjs`
  und `HANDOFF.md`; `git diff` gegen `59eef47` zeigt keine Aenderung an der
  HTML-Datei, und weder HTML noch `package.json`, `test/run-all.js`,
  `test/run-calc-tests.js` oder `src/dcf-core.js` nennen den Normalisierer.

### Verbleibende Einschraenkungen

* Der Normalisierer bleibt **nicht angeschlossen**: die produktive Bewertung
  rechnet weiterhin ausschliesslich auf Jahresbasis (10-K/FY). Keine
  TTM-Integration — ausdruecklich noch nicht beauftragt.
* Die Gleichheit der Kumulierungsbeginne wird **exakt** gefordert. Ein Filer,
  der denselben Geschaeftsjahresbeginn in zwei Filings unterschiedlich datiert,
  erhaelt dadurch keine Ableitung, sondern eine Diagnose — bewusst streng, da
  die Differenz sonst einen anderen Zeitraum abbildet.
* Ebenso exakt ist der Zeitraumvergleich zwischen gemeldetem und abgeleitetem
  Quartal; abweichende Zeitraeume werden nicht verglichen, sondern gemeldet.
* Das Quartalsfenster bleibt bei 80–100 Tagen (einschliesslich gezaehlt).
  Ungewoehnlich lange oder kurze Einzelquartale (z. B. Rumpfperioden nach einer
  Geschaeftsjahresumstellung) erzeugen daher keine Ableitung.
* Weiterhin gilt: eine Tag-Kette je Feld ohne Bridging; Geschaeftsjahr benannt
  nach dem Kalenderjahr seines Endes; nur `us-gaap`; Werte in gemeldeter
  Einheit und Vorzeichen.
* Offen aus den Vorschritten: Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen; Fachansichten
  ausserhalb der Hauptansicht nicht vereinfacht.

### Anschlussstand fuer Chat 11

* Uebergabebranch: `claude/sec-quarterly-period-fixes`
* Ausgangscommit dieses Schrittes: `59eef47`
* Ergebniscommit: `1d48e90`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/1d48e90
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/sec-quarterly-period-fixes
* Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
  (unveraendert) · Normalisierer: `src/sec-quarterly.js` · Tests:
  `tests/sec-quarterly.test.mjs` · Testbefehl: `npm test`

## Schritt: Isolierte Normalisierung von SEC-Quartalsdaten (V1.0.53)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/gross-margin-period-match`, Ausgangscommit `e15b05a` — der neueste auf
GitHub gespeicherte Stand (Chat 9 `efe14c9` **einschliesslich** der
anschliessenden Korrektur `8a955b3`; `main` steht weiterhin auf `b023dc8`).
Aktuelle Tool-Datei unveraendert
`us-aktienbewertungstool-v1036-sector-classification-patch.html` (einzige
HTML-Datei des Repositories, von `tests/extract-functions.mjs`, `src/dcf-core.js`
und `test/run-calc-tests.js` geladen — damit als tatsaechlich verwendete Datei
belegt). Uebergabebranch: `claude/tender-galileo-wc31j5`. Testbefehl: `npm test`.
Baseline auf `e15b05a` (ausgefuehrt): **1459 Rechen-Assertions · 78 Node-Tests ·
Exit-Code 0**.

**Abgrenzung.** Die produktive Bewertung bleibt in diesem Schritt vollstaendig
auf der bisherigen Jahresbasis (10-K/FY). Die HTML-Datei ist **unveraendert**
(`git diff` gegen `e15b05a` zeigt keinerlei Aenderung an ihr), es gibt keine
Oberflaechenaenderung, keinen neuen Anbieter und keinen Aufruf des neuen Moduls
aus der Anwendung. Ein Test sichert diese Abgrenzung ausdruecklich ab.

### Neu: `src/sec-quarterly.js` — isolierter Normalisierer

Reines Node-Modul (CommonJS), ohne DOM, ohne globalen Zustand, ohne
Abhaengigkeiten, deterministisch. Eingabe ist eine companyfacts-artige Struktur
(`{ "us-gaap": { <Tag>: { units: { USD: [ facts ] } } } }`).

**Umfang.** Zeitraumgroessen: `revenue`, `operating_income`, `net_income`,
`cfo`, `capex`. Stichtagsgroessen: `total_debt`, `long_term_debt`,
`cash_and_equivalents`, `current_assets`, `current_liabilities` (Schulden,
Liquiditaet und die Bestandteile des operativen Working Capital gemaess der
bestehenden Definition `(CA − Cash) − (CL − kurzfr. Finanzschulden)`; berechnet
wird das OWC hier bewusst **nicht**).

**Umsetzung der Anforderungen**

1. Ausgewertet werden `10-K`, `10-Q` sowie die Berichtigungen `10-K/A` und
   `10-Q/A`. Der Jahreswert aus dem 10-K ist fuer die Q4-Ableitung zwingend;
   andere Formulare (z. B. 8-K) werden verworfen.
2. Einzelquartal oder kumulierter Geschaeftsjahreswert wird an **Start, Ende und
   Periodendauer** entschieden (einschliesslich gezaehlte Tage: Quartal 80–100,
   Halbjahr 160–200, Neunmonatswert 250–290, Jahr 340–385) — nicht am
   Formulartyp und nicht am `frame`-Feld. Rollierende Zwoelfmonatswerte und
   Mehrquartalsbloecke ohne Bezug zum Geschaeftsjahresbeginn werden verworfen
   und in `notes` begruendet.
3. Abgeleitet wird nur aus zwei kompatiblen Kumulierungen **desselben**
   Geschaeftsjahres: Q2 = YTD6 − YTD3, Q3 = YTD9 − YTD6, **Q4 = Jahreswert −
   Neunmonatswert** (`method: fiscal_year_minus_nine_months`). Ein ausdruecklich
   gemeldetes Einzelquartal geht einer Ableitung vor; weicht es von der Differenz
   ab, bleibt der gemeldete Wert stehen und die Abweichung wird als `conflict`
   ausgewiesen (keine stille Aufloesung).
4. Stichtagsgroessen laufen ueber einen eigenen Pfad ohne jede Addition oder
   Differenzbildung — je Bilanzstichtag wird ausgewaehlt, nie gerechnet.
   Zeitraum- und Stichtagsangaben werden nicht vermischt (beide Richtungen
   werden verworfen und protokolliert).
5. Periodenschluessel ist das **Geschaeftsjahr** (`FY2025-Q1`), bestimmt aus dem
   beobachteten Geschaeftsjahresende (gestuft: Jahresperiode aus 10-K, sonst
   10-K-Stichtag, sonst Jahresperiode aus 10-Q). Vom Kalenderjahr abweichende
   Geschaeftsjahre und 52/53-Wochen-Jahre werden unterstuetzt; ohne bestimmbares
   Geschaeftsjahresende liefert das Modul `ok:false` statt einer Vermutung.
   `options.fiscalYearEnd` erlaubt eine ausdrueckliche Vorgabe.
6. An jedem Wert bleiben Formular, Filing-ID (`accn`), Veroeffentlichungsdatum
   (`filed`) und `frame` erhalten; abgeleitete Werte fuehren den vollstaendigen
   Ableitungsweg (Minuend, Subtrahend mit je eigener Herkunft, Formel) und als
   `filed` die **spaetere** der beiden Veroffentlichungen — vorher war der Wert
   nicht bekannt.
7. Berichtigungsregel: je Periode gewinnt die zuletzt veroeffentlichte Angabe;
   verdraengte abweichende Angaben bleiben unter `restatement.supersedes`
   sichtbar. Mit `options.asOfDate` werden spaeter veroeffentlichte Angaben —
   und Angaben ohne `filed`, die sich dem Stichtag nicht zuordnen lassen — nicht
   uebernommen; der Stichtag gilt auch fuer die Bestimmung des
   Geschaeftsjahresendes. Zwei abweichende Werte mit **demselben** `filed` sind
   ein Widerspruch: dann wird kein Wert gewaehlt.
8. Luecken und Widersprueche werden benannt (`gaps`, `conflicts`, `warnings`),
   nie gefuellt. `gaps` meldet nur fehlende Quartale **innerhalb** der belegten
   Spanne; es entsteht keine vollstaendige Reihe.

Die Tag-Listen werden nicht kopiert, sondern ueber `appTagMap()` aus der
`SEC_TAG_MAP` der ausgelieferten HTML-Datei gelesen (gleiche Entscheidung wie
`src/dcf-core.js` und `tests/extract-functions.mjs`).

### Neue Tests — `tests/sec-quarterly.test.mjs`, 24 Tests

Rein synthetische Facts, Erwartungswerte unabhaengig von Hand gerechnet und als
Kommentar an der Assertion, kein Netzwerk, kein DOM, kein Zufall. Vom
gemeinsamen Lauf (`test/run-all.js` sammelt `tests/*.test.mjs`) automatisch
erfasst — keine Konfigurationsaenderung noetig.

Abgedeckt: Periodendauer-Klassifikation · Periodenschluessel bei Kalender-,
abweichendem (31.01.) und 52/53-Wochen-Geschaeftsjahr · **gemeldete
Einzelquartale** · **kumulierter CFO** (50/120/200/300 ⇒ 50/70/80/100) ·
**Q4-Ableitung** (460 − 330 = 130, auch je Feld einzeln nachgerechnet) ·
**abweichendes Geschaeftsjahr** (drei Quartalsenden im Kalenderjahr 2024, alle
FY2025) · **fehlendes Quartal** (Luecke statt Ersatzwert) · **berichtigter
Abschluss** (10-Q/A gewinnt; mit `asOfDate` gewinnt der Vorwert und der spaetere
Wert taucht nirgends auf) · Widerspruch bei gleichem `filed` · Abweichung
gemeldet/abgeleitet · keine Ableitung ueber Geschaeftsjahresgrenzen · TTM-
und Mehrquartalsperioden · Stichtage ohne Summierung (doppelt gemeldeter
Stichtag bleibt einfach) · Stichtagsberichtigung · Formularfilter ·
Eingabepruefungen · Nichteinbindung in die Anwendung.

### Gegenproben (ausgefuehrt)

Jede Regel einzeln entfernt, jeweils rote Tests: Stichtagsregel ausgeschaltet
→ 2 Fehlschlaege · Ableitung ueber Jahresgrenzen erlaubt → 1 · Kalenderjahr als
Periodenschluessel → 2 · Mehrquartalsperiode als Quartal akzeptiert → 2 ·
Stichtage nicht je Datum zusammengefuehrt → 2 · Widerspruch gemeldet/abgeleitet
verschwiegen → 1.

### Tatsaechlich ausgefuehrte Tests

* `npm test` → Rechentests **1459 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (unveraendert zur Baseline, die HTML-Datei wurde nicht
  angefasst), Node-Tests **102/102** (78 unveraendert **+24 neue**), gemeinsamer
  **Exit-Code 0**. Alle 434 Fixture-Assertions unveraendert gruen.
* Keine bestehende Testerwartung geaendert oder gelockert.

### Verbleibende Grenzen

* Der Normalisierer ist **nicht** angeschlossen: keine Quartalsdaten in der
  Bewertung, in der Oberflaeche oder im Master-JSON. Das ist der beauftragte
  Zustand dieses Schrittes.
* Werte bleiben in der gemeldeten Einheit (USD, nicht Millionen) und mit dem
  gemeldeten Vorzeichen (CapEx ist ein positiver Abfluss). Die Skalierung auf
  die Einheiten des Bewertungskerns ist Sache eines spaeteren Schrittes.
* Je Feld wird genau eine Tag-Kette verwendet (erste Kette mit verwertbaren
  Angaben); innerhalb eines Feldes werden Tags **nicht** gemischt. Wechselt ein
  Unternehmen den Tag, entstehen Luecken — sie werden gemeldet, nicht
  ueberbrueckt.
* Das Geschaeftsjahr wird mit dem Kalenderjahr seines **Endes** benannt
  (FY2025 endet am 31.01.2025); die abweichende Eigenbezeichnung mancher
  Unternehmen wird nicht uebernommen.
* Nur `us-gaap`; unternehmenseigene Namensraeume bleiben aussen vor.
* Die Konsistenzbedingung „abgedeckte Quartale passen zur Endposition" ist bei
  in sich stimmigen Datumsangaben rechnerisch redundant (nicht ueberlappende
  Dauerfenster) und bleibt als Absicherung stehen — die Gegenprobe dazu bleibt
  gruen.
* Weiter offen aus den Vorschritten: Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Groessen; Fachansichten
  ausserhalb der Hauptansicht nicht vereinfacht.

### Ergebnis dieses Schrittes

* Uebergabebranch: `claude/tender-galileo-wc31j5`
* Ergebniscommit: `46e3404`
  — https://github.com/c7gzyvh4rk-commits/Aktientool/commit/46e3404
* Branchstand: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/tender-galileo-wc31j5
* Anschluss fuer den naechsten Schritt: Branch `claude/tender-galileo-wc31j5`,
  Commit wie unten nachgetragen (HANDOFF-Nachtrag), Tool-Datei
  `us-aktienbewertungstool-v1036-sector-classification-patch.html`,
  Normalisierer `src/sec-quarterly.js`, Testbefehl `npm test`.

## Update (Restfehler): Bruttomarge nur aus passenden Perioden (V1.0.52)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, geprüfter Branch
`claude/entry-gate-and-band-provenance`, geprüfter Commit `376c276` — der
einzige Branch, der ihn enthält; keine nachträglichen Korrekturen (`main` steht
weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`. Reparaturbranch: `claude/gross-margin-period-match`.
Testbefehl: `npm test`. Baseline auf `376c276` (ausgeführt, bestätigt die
gemeldete Angabe): **1433 Rechen-Assertions · 78 Node-Tests · Exit-Code 0**.

Umfang: ausschliesslich dieser Restfehler und seine unmittelbaren Folgen,
Tests und dieses Dokument. Bewertungsformeln, Abrufsperre, P25/P75-Berechnung
und alle übrigen Kennzahlen sind **unberührt**.

### Am Code reproduziert (Stand `376c276`)

`revenue [100,80,60]`, `gross_profit [60,40,24]`:

| Periodenangaben | vorher | nachher | erwartet |
|---|---|---|---|
| rev 2024/23/22 · gp **2023/22/21** | 60 / 50 / – | **– / – / –** | – / – / – |
| nur Index 0 widersprüchlich | 60 / 50 / – | **– / 50 / –** | – / 50 / – |
| nur Index 1 widersprüchlich | 60 / 50 / – | **60 / – / –** | 60 / – / – |
| passend 2024/23/22 | 60 / 50 / +10 | 60 / 50 / +10 | unverändert |
| passend mit Jahressprung 2024/2022 | 60 / 50 / – | 60 / 50 / – | unverändert |

**Ursache.** Die Einzelmargen entstanden weiterhin rein über gleiche
Array-Indizes. `_grossMarginPeriodsAdjacent()` wertete die Periodenangaben erst
für `grossMarginTrend` aus; eine bereits falsch gerechnete
`grossMarginCurrent` (Bruttogewinn 2023 geteilt durch Umsatz 2024) blieb stehen
und wurde als „Bruttomarge letztes Jahr" angezeigt.

### Korrektur (klein gehalten)

* Neu `_grossMarginPeriodsMatchAt(mj, i)`: beziehen sich `gross_profit` und
  `revenue` an **dieser** Indexposition auf dieselbe Periode? Nur ein
  ausdrücklicher Widerspruch (beide Angaben vorhanden und verschieden) ergibt
  `false`.
* `computeGrowthProfile()` prüft das **bei jeder Einzelmarge**: bei einem
  Widerspruch am Index bleibt die Marge `null`. **Keine** Suche über andere
  Indizes, **keine** Periodennormalisierung.
* `_grossMarginPeriodsAdjacent()` nutzt dieselbe Funktion (statt eigener
  Vergleichsschleife) und prüft zusätzlich wie bisher, ob Index 0 und 1
  unmittelbar aufeinanderfolgende Geschäftsjahre sind. `grossMarginTrend`
  entsteht weiterhin nur bei zwei gültigen Margen **und** bestätigter
  Nachbarschaft.
* Fehlen Periodenangaben ganz oder an der geprüften Position, bleibt es beim
  bisherigen positionsbasierten Verhalten. Ein **erkennbarer** Widerspruch wird
  auch bei nur teilweise vorhandenen Metadaten nicht ignoriert.
* Anzeige unverändert im Aufbau: eine nicht berechenbare aktuelle Marge
  erscheint als **Datenlücke** („nicht verfügbar" + Markierung), nicht als
  ältere Ersatzmarge.

**Geprüfte direkte Aufrufer:** Hauptansicht (Bruttomargenzeile),
Reverse-DCF-Karte und `computeReverseDcfFull()` (lesen nur `revCagr*` /
`fcfDataSuspect` — unberührt), Wachstumsbereich `runGrowthCaseEngine()` (zeigt
jetzt korrekt „–" statt einer periodenfremden Marge) sowie die interne
FCF-Breakeven-Schätzung `fcfBreakevenYearEst` (entfällt ohne belastbaren
Trend — gewollte Folge, kein Fixture prüft den Wert).

### Neue Regressionstests — `_testGrossMarginPeriodMatch()`, 26 Assertions

Registriert in `test/run-calc-tests.js`; rein, ohne DOM und ohne Zufall.
GMP-1 vollständig versetzte Perioden · GMP-2 nur aktuelle Periode
widersprüchlich · GMP-3 nur Vorjahresperiode widersprüchlich · GMP-4 passende
Perioden (60 % / 50 % / +10 pp) · GMP-5 passende Einzelperioden mit
Jahressprung · GMP-6 die drei Fälle ohne Metadaten
(`[null,40,24]` → –/50/– · `[60,null,24]` → 60/–/– · `[60,40,24]` → 60/50/+10)
· GMP-7 teilweise vorhandene Metadaten (einseitig, Lücke an einem Index,
erkennbarer Widerspruch trotz Lücke) · GMP-8 die Hilfsfunktion direkt.
**Keine bestehende Erwartung geändert oder gelockert.**

### Gegenprobe (ausgeführt)

Periodenprüfung an der Einzelmarge wieder entfernt → **5 Fehlschläge**, jeweils
mit dem gemeldeten Istwert `{"cur":60,"prior":50,"trend":null}`.

### Tatsächlich ausgeführte Tests

* `npm test` → Rechentests **1459 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (1433 unverändert zur Baseline **+26 neue**),
  Node-Tests **78/78** unverändert, gemeinsamer **Exit-Code 0**. Alle 434
  Fixture-Assertions unverändert grün.
* **Echter Browser** (Chromium 1194 headless über `playwright-core`, nur im
  Arbeitsverzeichnis ausserhalb des Repositories installiert — das Projekt
  bleibt abhängigkeitsfrei), Datei per `file://`, **0 `pageerror`**. Geprüft
  wurde die **tatsächlich gerenderte Hauptansicht** (keine DOM-Attrappe), je
  nach Import über `importMasterJsonFromTextarea()`:

  | Fall | Profilwerte | Zeile „Bruttomarge letztes Jahr" |
  |---|---|---|
  | vollständig versetzt | `[null,null,null]` | **Datenlücke** („nicht verfügbar") |
  | nur Index 0 widersprüchlich | `[null,50,null]` | **Datenlücke** — kein 60 % |
  | nur Index 1 widersprüchlich | `[60,null,null]` | 60,0 % · Historie, Hinweis „Kein Vorjahresvergleich" |
  | passende Perioden | `[60,50,10]` | 60,0 % · „Veränderung zum Vorjahr: +10,0 Prozentpunkte" |

### Verbleibende Grenzen

* Geprüft wird ausschliesslich `_v4_meta.<feld>.periods` von `revenue` und
  `gross_profit` an den Indizes 0 und 1. Datensätze ohne Periodenangaben (reine
  JSON-Pastes) werden weiterhin rein positionsbasiert ausgewertet — eine
  umfassende Periodennormalisierung war ausdrücklich nicht beauftragt.
* Es wird **nicht** nach einem passenden Bruttogewinn an einem anderen Index
  gesucht. Fehlt zur jüngsten Umsatzperiode ein passender Bruttogewinn, bleibt
  es bei der Datenlücke.
* Der Browsercheck ist ein einmalig ausgeführtes Skript im Arbeitsverzeichnis,
  **kein** Bestandteil von `npm test`; die Suiten bleiben abhängigkeitsfrei und
  DOM-frei. Einziger Konsolenfehler beim Seitenaufruf: die blockierte Anfrage
  an `fonts.googleapis.com` (Netzwerksperre der Prüfumgebung), wie im
  Ausgangsstand.
* `ENGINE_VERSION` / `DISPLAY_VERSION` bleiben `1.0.35-base-rate-lite`
  (mehrere Fixtures pinnen den Wert exakt); V1.0.52 bezeichnet nur diesen
  Dokumentationsabschnitt.
* Weiter offen aus den Vorschritten: Fachansichten ausserhalb der Hauptansicht
  nicht vereinfacht; Einheitenverdacht in `_makeBaseValuation()`;
  index-basierte Ableitung von `eps_diluted`, `book_value`, `dps` in
  `applyDerivedFieldsV4`; Korrelationen der Monte-Carlo-Größen nicht
  modelliert; `buildCoreValuationContext()` wandelt bei direktem Aufruf
  weiterhin `'15'` um.

### Ausgangsstand für Chat 10

Übergabebranch: `claude/gross-margin-period-match` (Basis `376c276` auf
`claude/entry-gate-and-band-provenance`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`, Modul
`src/dcf-core.js`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0
(1459 Rechen-Assertions · 78 Node-Tests).
Code-Commit dieses Schritts: `8a955b3`; Ergebniscommit ist die Spitze des
Reparaturbranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/gross-margin-period-match
Commit-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/commit/8a955b3

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
