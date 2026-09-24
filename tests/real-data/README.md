# Realdaten-Audit (MCD, JNJ) — Wiederholung

Zwei Skripte, die nicht zu `npm test` gehören.

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
   * der Sperrgrund beim richtigen Modell.

   Die Browser-Tests (`replay-import.browser.test.mjs`) starten das Skript als eigenen Prozess gegen zwei synthetische
   Filer in einem temporären Verzeichnis: SYNTR mit Quartalen (FY: Umsatz 1000,
   EBITDA 250, Ende 2024-12-31; TTM: 1375 / 343,75, Ende 2025-09-30) und SYNTN
   nur mit 10-K-Angaben (kein TTM). Sie prüfen Werte und Perioden, die
   Übereinstimmung der Ansichten mit der Basis, den Weg FY → TTM → FY, den
   ausgewiesenen Rückfall und die Unveränderlichkeit der FY-Daten.

3. **Bestätigte Befunde reproduzieren.** Das läuft ohne Netz und ohne Browser:

   ```sh
   node tests/real-data/repro-findings.mjs
   ```

   Das Skript nutzt nur die wortgetreuen SEC-Auszüge in `excerpts/` (mit
   Quell-URL, Abrufzeit und SHA-256 der Rohdatei) und die produktiven
   Funktionen. Je Befund meldet es `BESTEHT` oder `BEHOBEN`. Es gehört bewusst
   nicht zu `npm test`, weil es falsches Verhalten festhält.

`--selftest` belegt nur, dass die Mechanik funktioniert. Er ist **keine**
Prüfung mit echten Daten.
