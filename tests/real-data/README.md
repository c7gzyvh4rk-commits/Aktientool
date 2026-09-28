# Realdaten-Audit (MCD, JNJ) — Wiederholung

Skripte, die nicht zu `npm test` gehören.

1. **Quellen laden.** Das braucht Netzzugriff auf `www.sec.gov` und `data.sec.gov`:

   ```sh
   SEC_USER_AGENT="Name kontakt@example.org" \
     node tests/real-data/fetch-sources.mjs MCD JNJ --cutoff JJJJ-MM-TT
   ```

   Die Dateien landen in `tests/real-data/cache/` (nicht versioniert), zusammen mit
   `manifest.json` (URL, Abrufzeit, SHA-256). `--cutoff` entfernt alle Fakten mit
   `filed` nach dem Datenstichtag. Das Original bleibt als `*.raw.json` erhalten.
   Exit 2 bedeutet: Quelle nicht erreichbar. Hinter einem HTTP-Proxy (z. B. in
   der Cloud-Umgebung) braucht Node zusätzlich
   `NODE_USE_ENV_PROXY=1` und gegebenenfalls `NODE_EXTRA_CA_CERTS=<CA-Datei>`.

2. **Produktiven Import nachspielen.** Das läuft ohne Netz, nur mit lokalem Chromium:

   ```sh
   node tests/real-data/replay-import.mjs MCD [--price 300] [--out datei.json]
   node tests/real-data/replay-import.mjs JNJ
   node tests/real-data/replay-import.mjs --selftest   # nur die Mechanik, synthetisch
   ```

   Die Produktdatei läuft im Browser über `secFetchAll()` → `secConfirmImport()`,
   also denselben Weg wie die Knöpfe „Daten abrufen“ und „Import bestätigen“.
   Die Antworten der Datenverbindung kommen per CDP aus `cache/`. Yahoo ist
   abgeschaltet, und jede andere Anfrage wird abgewiesen. Ein Kurs ist keine
   Abschlussangabe und wird nur mit `--price` als ausdrückliche Annahme gesetzt.

   Der Bericht wird nach `tests/real-data/out/<TICKER>-report.json` geschrieben
   (nicht versioniert). Er enthält:
   * das Master-JSON vor dem Import;
   * drei Erfassungen: `fy` (nach dem Import), `ttmView` (TTM angefordert) und
     `fyReturn` (zurück auf FY). Jede enthält:
     * `basis`: angeforderte und **tatsächlich verwendete** Datenbasis
       (`requested`, `selected`, `ttm_used`), TTM-Verfügbarkeit, Rückfall mit
       Gründen, Zeitraum, gesperrte Modelle;
     * `fields`: je Feld Wert, Einheit, Periode, bei TTM die
       Komponentenperioden (Quartale, Stichtag, Aktienquartale oder
       Bestandteile abgeleiteter Größen), Herkunft, Tag, `filed`, Ableitung und
       Größenart (Stromgröße, Stichtag, Aktien-Durchschnitt). Fehlende
       Metadaten stehen ausdrücklich in `metadataMissing`;
     * `shareConcepts`: gewichteter Durchschnitt getrennt von der aktuellen
       Aktienzahl am Stichtag;
     * Modellergebnisse, Router, Reverse DCF;
     * `panels`: die Texte der Ansichten Übersicht, Bewertung, Markt-Vergleich,
       Qualität und Annahmen, jeweils nach dem Neurendern in diesem Schritt;
     * `checks`: Abgleich der Ansichten mit dem Engine-Ausweis;
   * `integrity`: SHA-256 der Fundamentaldaten nach dem Import und am Ende;
   * die bedienten Quellen mit SHA-256.

   **Erfassungsweg (seit D1).** Die Feldwerte kommen aus der Bewertungssicht,
   mit der die Engine rechnet: `resolveValuationView()` (dieselbe Paarung
   `resolveDataBasis` + `buildValuationBasisView` wie in `runValuationEngine`).
   Bei FY ist das das Master-JSON, bei TTM die daraus erzeugte TTM-Sicht. Das
   Werkzeug rechnet nichts selbst nach und schreibt einer TTM-Größe keine
   Jahres-Metadaten zu; ein von der Engine nur geerbter Jahres-Tag steht
   getrennt in `engine_inherited_fy_tag`. Die Datenbasis wird über die Auswahl
   im Reiter „Annahmen“ umgestellt. Jede Ansicht wird über ihren Reiter
   geöffnet (echter Mausklick). Gelesen wird erst, wenn der Renderer den
   Ausgabebereich nachweislich ersetzt hat und die neue Berechnung vorliegt.

   Exit-Codes: 0 = vollständig und Abgleich bestanden · 1 = Import blockiert,
   Fehler oder Abweichung zwischen Anzeige und Engine (`ABWEICHUNG …` in der
   Ausgabe) · 2 = nicht ausführbar.

   **Regressionstests des Werkzeugs** (brauchen Chromium, deshalb nicht in
   `npm test`):

   ```sh
   npm run test:audit-tool
   # = node --test tests/real-data/replay-import.browser.test.mjs
   # gegen eine andere Fassung des Skripts:
   REPLAY_SCRIPT=pfad/zu/replay-import.mjs npm run test:audit-tool
   ```

   `check-panels.test.mjs` prüft die Abgleichsfunktion `checkPanels()` direkt
   (ohne Browser) an einer echten, gekürzten Erfassung
   (`fixtures/check-panels-captures.json`). Abgedeckt sind:
   * leeres, fehlendes oder fremdes Marktpanel;
   * berechtigte Leerzustände nur mit ihrem Grund;
   * der Sperrgrund beim richtigen Modell;
   * Diagnosemodelle (seit D3-Vorbereitung): Jedes Modell mit berechnetem
     Basiswert muss mit genau diesem Wert in der Bewertungsansicht stehen —
     auch ein Diagnosemodell des Routers (`router.diagnosticModels`, z. B. DDM
     auf dem Pfad retail). Es gibt **keine Ausnahme** für nicht angezeigte
     Diagnosemodelle: Das Produkt sieht sie sichtbar, aber ungewichtet vor
     (V1.0.6), in der regulären Ansicht und — seit V1.0.73 — in der Karte ohne
     Intrinsic-Bewertung. Zusätzlich muss ein Diagnosemodell, das nicht zugleich
     aktiv ist, **als diagnostisch gekennzeichnet** bei seinem Wert stehen
     (Modellname, dann „diagnostisch“, dann der Wert); als „aktiv“ dargestellt,
     fehlend oder mit anderem Wert schlägt die Prüfung fehl;
   * Periode der verwendeten Basis im Markt-Vergleich: Erwartet wird das
     Periodenende aus dem Ausweis der Datenbasis (`basis.period.end`), in der
     Engine-Erwartung (`computeRelativeMultiplesFV().basisPeriod`) **und** im
     Anzeigetext. Fehlende Periode, abweichende (veraltete) Periode oder eine
     Periode nur in der Engine-Erwartung schlagen fehl.

   Die Browser-Tests (`replay-import.browser.test.mjs`) starten das Skript als eigenen Prozess gegen zwei synthetische
   Filer in einem temporären Verzeichnis: SYNTR mit Quartalen (FY: Umsatz 1000,
   EBITDA 250, Ende 2024-12-31; TTM: 1375 / 343,75, Ende 2025-09-30) und SYNTN
   nur mit 10-K-Angaben (kein TTM). Sie prüfen Werte und Perioden, die
   Übereinstimmung der Ansichten mit der Basis, den Weg FY → TTM → FY, den
   ausgewiesenen Rückfall und die Unveränderlichkeit der FY-Daten.

3. **Bestätigte Befunde kontrollieren.** Das läuft ohne Netz und ohne Browser:

   ```sh
   node tests/real-data/repro-findings.mjs
   ```

   Das Skript nutzt nur die wortgetreuen Auszüge in `excerpts/` und die
   produktiven Funktionen auf dem tatsächlichen Importweg
   (`_extractSecFundamentals` → `_buildSecMasterJson` → `normalizeSharesInPlace`,
   Quartale mit belegter Berichtspräzision). Je Befund meldet es `BEHOBEN` oder
   `BESTEHT`. **Seit D2 ist `BEHOBEN` der erwartete Zustand:** Besteht ein
   Befund wieder, endet das Skript mit Exit 1 (2 = nicht ausführbar, z. B.
   Produktstand vor D2). Verbindlich sind die Regressionstests in
   `tests/real-data-findings.test.mjs`; sie laufen in `npm test` mit.

4. **Regressionsauszüge erzeugen** (nach Schritt 1, ohne Netz):

   ```sh
   node tests/real-data/make-excerpts.mjs
   ```

   Schreibt `excerpts/mcd-d2-regression.json` und `excerpts/jnj-d2-regression.json`
   (alle Fakten der dort genannten Tags, unverändert, mit Quell-URL und SHA-256
   der Rohdatei) sowie `excerpts/mcd-xbrl-precision.json` (wortgetreue
   Ausschnitte der Original-XBRL-Instanzen: Fakt-Elemente mit `decimals` und ihre
   Kontexte). Der Zeitstempel `retrievedAt` ändert sich bei jedem Abruf; die
   Fakten selbst sind bei gleichem Quell-Hash identisch.

5. **Quellenabgleich (seit D3)** — nach Schritt 1 und dem Replay, ohne Netz
   und ohne Browser:

   ```sh
   node tests/real-data/reconcile-sources.mjs MCD JNJ [--md tabelle.md]
   ```

   Vergleicht die Erfassung `fy` aus `out/<TICKER>-report.json` mit den
   Company-Facts-Stichtagskopien, **ohne Produktfunktionen**: gemeldete Felder
   gegen den zuletzt eingereichten 10-K-Fakt desselben Tags und derselben
   Periode (Strom: Jahreszeitraum; Stichtag: instant; Akte des Tools muss dazu
   gehören), abgeleitete Felder über ihren Rechenweg (EBITDA − EBIT = ein
   gemeldeter D&A-Fakt derselben Periode, FCF, Nettoschulden, Buchwert aus
   Aktiva − Passiva). Aktien, die ein Filer bereits in Mio. meldet (MCD, F-4),
   gelten nur, wenn NI/EPS derselben Periode sie auf ±1 % bestätigt. Felder
   ohne Toolwert werden aufgelistet, nicht abgeglichen (D&A ist kein eigenes
   Feld; es wird über EBITDA geprüft). Exit 0 = alle Werte stimmen, 1 =
   Abweichung (`ABWEICHUNG …`), 2 = nicht ausführbar. Gegenlauf mit
   verfälschter Erfassung (Wert, Ableitung, Periode, Skalierung) → Exit 1.

**Original-XBRL (seit D2).** Company Facts enthält keine Berichtspräzision. Der
Import lädt deshalb für Berichte, die an einem Quartalswiderspruch der jüngsten
acht Quartale beteiligt sind, die XBRL-Instanz über den Proxy
(`www.sec.gov/Archives/edgar/data/<cik>/<accn>/`). `fetch-sources.mjs` bestimmt
diese Berichte mit derselben Produktfunktion (`secPrecisionRequests`) und legt
`index.json` und Instanz unter `cache/archives/<cik>/<accn>/` ab; der Replay
bedient sie von dort. Die Instanzen sind unveränderliche Originaldokumente; ihr
Abrufzeitpunkt kann nach dem Datenstichtag liegen, ihr Einreichungsdatum nicht.

`--selftest` belegt nur, dass die Mechanik funktioniert. Er ist **keine**
Prüfung mit echten Daten.
