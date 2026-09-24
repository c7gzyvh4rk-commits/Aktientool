# Browser-Abnahme (synthetisch)

Reproduzierbarer Browser-Smoke-Test des Aktienbewertungstools. Er laedt die
Produktdatei `us-aktienbewertungstool-v1036-sector-classification-patch.html`
als `file://`-Dokument in einem headless Chromium und bedient sie ueber echte
Eingabeereignisse (Mausklicks auf sichtbare Knoepfe, Tastatureingabe,
Datei-Uploads ueber die echten `<input type=file>`-Felder, echte Downloads).

**Die Daten sind synthetisch** (`fixtures.mjs`). Eine bestandene Abnahme ist
keine Pruefung echter Unternehmensdaten.

## Voraussetzungen

* Node.js **≥ 22** (eingebautes `WebSocket`; keine npm-Abhaengigkeit).
* Ein lokales **Chromium oder Chrome**. Gesucht wird in dieser Reihenfolge:
  `$CHROME_PATH`, `/opt/pw-browsers/chromium`, `/usr/bin/chromium`,
  `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`,
  `/usr/bin/google-chrome-stable`, macOS-Standardpfad.
* Kein Netz noetig — und keines erlaubt (siehe Isolation).

## Start

```sh
npm run test:browser
# gleichbedeutend:
node tests/browser/acceptance.mjs
# anderer Browser:
CHROME_PATH=/pfad/zu/chrome npm run test:browser
```

`npm test` startet **keinen** Browser; die Browser-Abnahme ist ein getrennter
Befehl.

## Ergebnis

Jede Pruefung erscheint als `PASS`/`FAIL`-Zeile, am Ende:

```
══ Browser-Abnahme: N Pruefungen · N bestanden · 0 fehlgeschlagen
   Produktstand: <git-Commit> [(+ lokale Aenderungen)]
ERGEBNIS: BESTANDEN
```

| Exit-Code | Bedeutung |
|---|---|
| 0 | alle Pruefungen bestanden |
| 1 | mindestens eine Pruefung fehlgeschlagen |
| 2 | Abnahme konnte nicht laufen (kein Browser, Startfehler) |

Der Kopf der Ausgabe nennt Browserversion, Produktdatei und den geprueften
Git-Commit (mit Hinweis, falls der Arbeitsbaum lokale Aenderungen hat).

## Isolation

* Frisches temporaeres Browserprofil (`$TMPDIR/aktientool-browser-profile-*`)
  und temporaeres Arbeits-/Download-Verzeichnis; beides wird am Ende
  geloescht. Vorhandene Profile, `localStorage`-Bestaende und Snapshots
  werden nicht beruehrt.
* Netz: `--host-resolver-rules=MAP * ~NOTFOUND` und `--no-proxy-server`;
  zusaetzlich faengt CDP `Fetch` jede Anfrage ab. Erlaubt sind nur `file:`,
  `data:`, `blob:`, `about:`. Die Google-Fonts-Einbindung der Seite
  erscheint deshalb als *abgewiesen*; jede andere externe Anfrage — und
  insbesondere jede SEC-/Yahoo-Anfrage — laesst die Abnahme scheitern.
* Snapshot-ID-Angriffe verwenden nur harmlose lokale Marker
  (`window.__pwned`, `window.__accMarker`).

## Was geprueft wird

1. EV/EBITDA-Bruecke: Periodenpruefung je Seite (V1.0.69) inkl. der
   Gegenbeispiele aus 12F und zwei Gegenproben (16,00 freigegeben).
2. Multiples vorhanden, Berechnungsgrundlage fehlt; Gegenfall ohne Multiples.
3. Nichtpositiver Aktienwert mit Ausschlussgrund.
4. DDM: undatierte Null-Dividende und Ersatzquelle ohne belastbare Historie.
5. Financials: eine Modellfamilie, kein Uebereinstimmungssignal.
6. Snapshot-ID-Angriffe (Import und Altbestand).
7. Zusammenhaengender Ablauf: Import ueber die Oberflaeche → Annahme aendern
   und neu berechnen → FY/TTM vergleichen → Snapshot speichern → Seite neu
   laden → gespeichertes Ergebnis oeffnen → veraltetes Ergebnis →
   Basiswechsel auf geladenem Ergebnis → „Neu rechnen" → Export (Snapshots
   und Master-JSON als Datei) → ungueltige Importe → Loeschen und
   Re-Import → Override rund um einen geloeschten Snapshot.

Ausdruecklich markierte **Zustandseingriffe** (statt Bedienung): Schritt 6b
(Altbestand mit Angriffs-ID direkt in `localStorage`, weil der Import solche
IDs abweist) und 7.7 (Datenbasis ohne Neuberechnung umstellen, weil die
Oberflaeche beim Umschalten sofort neu rechnet). Das Auswahlfeld der
Datenbasis wird ueber ein echtes `change`-Ereignis bedient, nicht ueber die
native Auswahlliste.
