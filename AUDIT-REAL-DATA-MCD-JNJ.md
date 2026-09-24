# Realdaten-Audit MCD / JNJ — Folgechat D

**Status: Der Abgleich mit echten Daten wurde NICHT durchgeführt.** Diese
Umgebung erreicht keine Primärquelle. Dieser Bericht enthält deshalb keinen
Abgleich und keinen bestätigten Datenbefund. Er dokumentiert:

* die Blockade;
* den geprüften Codestand;
* das jetzt vorhandene Wiederholungswerkzeug für den produktiven Importweg;
* die Prüfpunkte, die mit den echten Dateien abzuarbeiten sind.

## 1 · Ausgangsstand

| | |
|---|---|
| Codecommit | `main` = **`8b42fea6e3550ccbc4e2b723b96138886786b994`**, der Merge von PR #1 (Folgechat C). Der Baum ist identisch mit dem freigegebenen Stand `cea8a5e`, der Produktdatei-Blob `ac0ae781…` ist gleich dem browsergeprüften `0397737` (V1.0.70). Der Merge ist also vorhanden; es fehlt kein Übergabeschritt. |
| Auditbranch | `claude/audit-real-data-mcd-jnj` (von `8b42fea`) |
| `AGENTS.md` | nicht vorhanden |
| Tests auf dem Auditbranch | `npm test`: 1700 Rechen-Assertions (434 Fixture), 206 Node-Tests, Exit 0. `npm run test:browser`: 158/158, Exit 0. |
| Vorgesehener Datenstichtag | 2026-09-24 (nur Fakten mit `filed` ≤ Stichtag). **Es wurden keine Daten abgerufen.** |

## 2 · Quellen: Zugriffsversuche

Alle Versuche liefen am 2026-09-24 aus dieser Sitzung. Die Netzrichtlinie der
Umgebung weist die Hosts ab (Proxy-CONNECT 403 bzw. `EGRESS_BLOCKED`):

| Quelle | Zweck | Ergebnis |
|---|---|---|
| `https://www.sec.gov/files/company_tickers_exchange.json` | Ticker → CIK (produktiver Weg) | gesperrt (403, auch über `fetch-sources.mjs`) |
| `https://data.sec.gov/api/xbrl/companyfacts/CIK0000063908.json` (MCD) | Company Facts | gesperrt |
| `https://data.sec.gov/api/xbrl/companyfacts/CIK….json` (JNJ; CIK über die Ticker-Map, hier nicht ermittelt) | Company Facts | nicht versucht; gleicher Host gesperrt |
| `https://data.sec.gov/submissions/CIK….json` | SIC, Geschäftsjahresende | gesperrt (gleicher Host) |
| `https://www.sec.gov/Archives/edgar/…` (10-K/10-Q) | Filings, Anhangangaben | gesperrt |
| `corporate.mcdonalds.com`, `investor.jnj.com` | Geschäfts-/Quartalsberichte | gesperrt |

Erreichbar war nur eine Websuche mit KI-zusammengefassten Treffern. Sie ist
keine Primärquelle und wurde **nicht** als Abgleichsbasis verwendet.

Zwei Filing-Kennungen gehen aus Such-URLs hervor. Sie sind **unbestätigte
Kandidaten** für Folgechat D:
* MCD 10-K FY2025, Akte `0000063908-26-000035` (`mcd-20251231.htm`);
* MCD 10-K FY2024, Akte `0000063908-25-000012`.

Für JNJ wurde keine Kennung ermittelt.

**Nötige Freigabe:** In den Netzwerkeinstellungen der Umgebung
`data.sec.gov` und `www.sec.gov` erlauben. Optional kommen die IR-Seiten für
die Anhangangaben dazu.

## 3 · Produktiver Importweg: Wiederholungswerkzeug

Die bestehende Hilfe `tests/audit-chat12.mjs → importSecFacts()` baut die
Aufbereitung in Node **nach**. Sie ruft die Tag-Extraktion ohne
`anchorYear/requireCurrent` auf und überspringt Share-Audit und Precheck.
Deshalb ist sie für einen Realdatenabgleich nicht ausreichend.

Neu ist `tests/real-data/replay-import.mjs` (Anleitung in
`tests/real-data/README.md`):

* Die Produktdatei läuft in Chromium über `secFetchAll()` → `secConfirmImport()`,
  also dieselben Funktionen wie die Knöpfe. Das umfasst Tag-Auswahl mit
  `CORE_REQUIRE_CURRENT`, `_applySecDerivations`, `_buildSecMasterJson` samt
  TTM-Aufbau, Share-Audit, Precheck, Import und Engine.
* Nur die Antworten der Datenverbindung kommen aus lokalen SEC-Dateien
  (per CDP). Deren SHA-256 wird protokolliert.
* Der Bericht enthält je Feld Wert, Periode, Formular, `filed`, Tag und
  Herkunft (FY und TTM), dazu Modellergebnisse, Router-Gründe und Anzeigetexte.
* `tests/real-data/fetch-sources.mjs` lädt die Dateien und schneidet sie auf
  den Datenstichtag (`filed` ≤ Stichtag).

**Nachweis der Mechanik (synthetisch, KEINE Realdatenprüfung):**
`replay-import.mjs --selftest` mit dem synthetischen Filer der
Browser-Abnahme. Alle drei SEC-Anfragen wurden aus Dateien bedient, der Import
war erfolgreich, FY → TTM wurde umgeschaltet, Exit 0. Die Werte stimmen mit
der Abnahme überein: FY-EBITDA 250 zum 2024-12-31, `total_debt` 500 aus dem
period-keyed Rebuild, Nettoschulden 400, DCF und RIM aktiv.

## 4 · Abgleichstabellen

Sie sind **nicht ausgefüllt**, weil keine Originalquelle vorliegt. Die
Vorlage je Unternehmen und Sicht (FY, TTM):

| Kennzahl | Originalquelle (Filing, Seite/Tag) | Toolwert | Periode/Einheit | Ergebnis |
|---|---|---|---|---|
| Umsatz · Operating Income | | | | nicht geprüft |
| D&A · EBITDA (abgeleitet) | | | | nicht geprüft |
| CFO · CapEx · FCF | | | | nicht geprüft |
| Gesamtschulden je Zelle (kurzfr. Bankschulden, lauf. Fälligkeiten, langfr. Schulden, Finance-Leasing kurz/lang) · Operating-Leasing · Liquidität | | | | nicht geprüft |
| Aktienanzahl (gewichtet verwässert vs. ausstehend, Einheit) | | | | nicht geprüft |
| EPS verwässert · DPS | | | | nicht geprüft |
| Eigenkapital/Buchwert | | | | nicht geprüft |

Die Toolwerte liefert `replay-import.mjs` direkt (`fy.fields`, `ttmView.fields`).

## 5 · Sperrgründe

Nicht beurteilbar ohne Import der echten Daten. Welche Modelle aktiv oder
gesperrt sind, hängt vom Router (Subklassifikation aus SIC) und von den
importierten Reihen ab. Der Bericht des Replays enthält `router.activeModels`,
`router.disabledModels` samt Grund, `_equityValueUnavailableReason` und den
Reverse-DCF-Status.

## 6 · Befunde

**Bestätigte Implementierungsfehler: keine.** Es gibt aber auch keinen
Realdatenbeleg für Fehlerfreiheit. Eine synthetische Auffälligkeit wurde
geprüft und verworfen: `dividendMateriality.price = null` trotz gesetztem Kurs
ist der vorgesehene frühe Ausstieg `no_dps`.

**Ungeklärte Prüfpunkte für Folgechat D**, abgeleitet aus dem Code. Sie sind
keine Befunde:

| # | Prüfpunkt | Warum relevant (Codebeleg) |
|---|---|---|
| P-1 | Umfang der Gesamtschulden | `_debtScopeTables()` verlangt je Stichtag alle fünf Zellen (kurzfr. Bankschulden, laufende Fälligkeiten, langfr. Schulden, Finance-Leasing kurz/lang). Ein nicht erwähnter Bestandteil gilt als unbelegt, nicht als 0 (12B.2). Meldet ein Filer z. B. keine `FinanceLeaseLiability*`- oder `ShortTermBorrowings`-Tags, bleibt `total_debt` unbestimmt und die Wertbrücke gesperrt. Mit dem Anhang ist dann zu klären: gibt es den Bestand nicht (berechtigte Sperre, aber vorhandene Information, die der Import nicht erschließt) oder steckt er in einer Sammelposition? |
| P-2 | Operating-Leasing | Es ist nicht Teil der Schuldenzellen, nur `operating_lease_*` für lease-adjusted ROIC. Das ist eine offengelegte Modellvereinfachung; bei MCD betragsmäßig bedeutsam und deshalb getrennt auszuweisen. |
| P-3 | Aktienbasis | `shares_diluted` kommt aus der gewichteten verwässerten Anzahl (Periodenwert), `dei:EntityCommonStockSharesOutstanding` ist ein Stichtagswert. Zu prüfen sind Einheit, Normalisierung (`normalizeSharesInPlace`) und die Basis je Aktie in der Wertbrücke. |
| P-4 | Eigenkapital-Vorzeichen (MCD) | Das Vorzeichen von `StockholdersEquity` ist an der Quelle zu bestätigen. Zu prüfen ist, wie RIM/Buchwertmodelle bei nicht positivem Buchwert sperren oder rechnen. |
| P-5 | JNJ Segmentabspaltung | Bei den Reihen um die Abspaltung des Consumer-Health-Geschäfts sind fortgeführte und aufgegebene Bereiche zu trennen: `NetCashProvidedByUsedInOperatingActivities` vs. `…ContinuingOperations`, Umsatzreihe, Lückenerkennung (`gapDetected`). |
| P-6 | D&A-Tag | `DepreciationDepletionAndAmortization` vs. `DepreciationAndAmortization`: Deckungsgleichheit mit der Kapitalflussrechnung und keine Vermischung mit Abschreibungen auf Franchise-Assets o. ä. |
| P-7 | DPS | `CommonStockDividendsPerShareDeclared` vs. `…CashPaid`: Periodenzuordnung (erklärt vs. gezahlt) im FY- und TTM-Fenster. |

## 7 · Korrekturaufträge

Keine, denn es gibt keinen bestätigten Fehler. Der nächste Auftrag ist der
eigentliche Abgleich, sobald die Netzfreigabe besteht:

1. `fetch-sources.mjs MCD JNJ --cutoff <Stichtag>` ausführen und das Manifest sichern.
2. `replay-import.mjs MCD` und `JNJ` ausführen, danach die Tabellen aus Abschnitt 4
   gegen die 10-K-/10-Q-Tabellen und Anhänge füllen.
3. P-1 bis P-7 abarbeiten und die Befunde nach den fünf Kategorien des Auftrags
   einordnen.

## 8 · Grenzen

* Es wurde kein echtes Filing gelesen und kein realer Wert geprüft. Aussagen
  über MCD oder JNJ in diesem Bericht sind Prüfhypothesen.
* Der Selbsttest belegt nur die Mechanik des Replays.
* Kurse und Bewertungsannahmen wurden nicht betrachtet.
