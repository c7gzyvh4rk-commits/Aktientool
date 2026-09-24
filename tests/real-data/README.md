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
   Exit 2 bedeutet: Quelle nicht erreichbar.

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
   * je Feld Werte, Perioden, Formulare, `filed`, Tag und Herkunft;
   * FY- und TTM-Sicht;
   * Modellergebnisse, Router mit aktiven und deaktivierten Modellen und Gründen;
   * den Text der Anzeigen;
   * die bedienten Quellen mit SHA-256.

`--selftest` belegt nur, dass die Mechanik funktioniert. Er ist **keine**
Prüfung mit echten Daten.
