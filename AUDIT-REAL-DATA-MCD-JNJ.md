# Realdaten-Audit MCD / JNJ — Folgechat D

> **Aktueller Stand: §13 (D3 abschließend, V1.0.74).** Die Abschnitte 1–12
> dokumentieren den Verlauf (Audit D, D1, D2, D3-Vorbereitung).

Geprüft wurde, wie das Tool echte SEC-Daten von McDonald's (MCD) und
Johnson & Johnson (JNJ) importiert und verarbeitet. Es ist keine
Anlageempfehlung. Kurse und Bewertungsannahmen stehen getrennt in Abschnitt 5.

## 1 · Stand, Stichtag, Quellen

| | |
|---|---|
| Codecommit | `main` = `8b42fea` (V1.0.70, Merge PR #1). Auf dem Auditbranch `claude/audit-real-data-mcd-jnj` ist die Produktdatei **unverändert**. |
| Datenstichtag | **2026-09-24**. Es wurden nur Fakten mit `filed` ≤ Stichtag verwendet (abgerufen am selben Tag, 0 Fakten entfernt). |
| Company Facts | `https://data.sec.gov/api/xbrl/companyfacts/CIK0000063908.json` (MCD, sha256 `0394e814d75510be…`) und `…/CIK0000200406.json` (JNJ, sha256 `7141c0c988fa1d30…`) |
| Submissions | `https://data.sec.gov/submissions/CIK….json` (SIC: MCD 5812, JNJ 2834; Geschäftsjahresende MCD 12-31, JNJ 52/53 Wochen) |
| Geprüfte Filings | **MCD 10-K FY2025** (Periode 2025-01-01…2025-12-31, eingereicht 2026-02-24, Akte `0000063908-26-000035`, `mcd-20251231.htm`) · **JNJ 10-K FY2025** (2024-12-30…2025-12-28, eingereicht 2026-02-11, Akte `0000200406-26-000016`, `jnj-20251228.htm`) |
| TTM-Fenster (jüngstes vollständiges) | MCD: Q3/2025 bis Q2/2026, Ende 2026-06-30 (10-Q Akte `0000063908-26-000073`, eingereicht 2026-08-07) · JNJ: Q3/2025 bis Q2/2026, Ende 2026-06-28 (10-Q Akte `0000200406-26-000153`, eingereicht 2026-07-23) |
| Einheiten | Tool-Werte in Mio. USD, Aktien in Mio. Stück, je-Aktie-Werte in USD. Die SEC-Rohwerte sind in USD bzw. Stück. |

Importweg: `tests/real-data/replay-import.mjs`. Er ruft im Browser die
produktiven Funktionen `secFetchAll` und `secConfirmImport` auf und bedient sie
mit den gespeicherten SEC-Dateien. Yahoo war abgeschaltet, ein Kurs wurde nicht
gesetzt.

> **Nachtrag D1 (Zuverlässigkeit des Werkzeugs).** Die für dieses Audit
> verwendete Fassung von `replay-import.mjs` hatte zwei Fehler. Beide sind in D1
> behoben und durch Regressionstests abgesichert (`npm run test:audit-tool`):
> (1) Die TTM-Sicht las die Felder aus `state.masterJson.fundamentals` und wies
> damit die Jahreswerte als TTM aus. (2) Die Ansichten wurden nach einem
> Basiswechsel ohne Neurendern gelesen. Auf die Befunde dieses Berichts wirkten
> sich die Fehler nach Aktenlage nicht aus: Für MCD und JNJ bildete das Tool kein
> TTM (§2, §3, F-3). Deshalb fand kein Basiswechsel statt, und die Ansichten
> stammten aus dem Rendern nach dem Import. Durch einen erneuten Lauf mit der
> reparierten Fassung ist das **nicht** bestätigt. Das ist Aufgabe von D3.

## 2 · Abgleich MCD (FY2025)

| Kennzahl | Originalquelle (10-K FY2025) | Toolwert | Periode/Einheit | Ergebnis |
|---|---|---|---|---|
| Umsatz | GuV „Total revenues“ 26,885 | 26,885 (`Revenues`) | 2025-12-31, Mio. USD | ✓ |
| Operating Income | GuV 12,393 | 12,393 (`OperatingIncomeLoss`) | ebenso | ✓ |
| D&A | KFR „Depreciation and amortization“ **2,199** (`DepreciationAndAmortization`) | **457** (`DepreciationDepletionAndAmortization` = nur die SG&A-Zeile der GuV) | ebenso | ✗ **F-1** |
| EBITDA (abgeleitet) | 12,393 + 2,199 = **14,592** | **12,850** | ebenso | ✗ Folge von F-1 |
| CFO · CapEx · FCF | 10,551 · 3,365 · 7,186 | 10,551 · 3,365 · 7,186 | ebenso | ✓ |
| Finanzschulden | Bilanz „Long-term debt“ 39,973. Laut Anhang sind darin 798 Commercial Paper und 725 laufende Fälligkeiten enthalten („classified as Long-term debt … supported by a long-term line of credit“). | `total_debt` 39,973 (`LongTermDebt`), Hinweis „rechnerisch unvereinbar (Abweichung 725)“, Umfang **unbestimmt** | Stichtag 2025-12-31 | Wert ✓, Sperre siehe §4 |
| Finance-Leasing | Anhang: Barwert 2,352 | 23 + 2,329 (`FinanceLeaseLiability*`) | ebenso | ✓ |
| Operating-Leasing | Anhang: Barwert 12,488 | 12,170.3 **zum 2023-12-31** (veraltet; seit dem 10-K FY2024 nicht mehr als `OperatingLeaseLiability` getaggt) | — | ✗ veraltet, siehe **F-5** |
| Liquidität | 774 | 774 | Stichtag | ✓ |
| Aktien (Ø verwässert) | 716.4 Mio. | 716.4 | FY2025 | ✓ für [0]; Reihe gemischt skaliert (**F-4**) |
| EPS verwässert · DPS | 11.95 · 7.17 (erklärt) | 11.95 · 7.17 (`…Declared`) | FY2025, USD | ✓ |
| Dividenden gezahlt | 5,115 | 5,115 | FY2025 | ✓ |
| Eigenkapital | Bilanz „Total shareholders' equity (deficit)“ **(1,791)** | −1,791 | Stichtag | ✓ |
| TTM | Quartale bis 2026-06-30 vollständig gemeldet | **nicht gebildet**: „kein Quartal endet am 2025-09-30“ | — | ✗ **F-3** |

## 3 · Abgleich JNJ (FY2025, Ende 2025-12-28)

| Kennzahl | Originalquelle (10-K FY2025) | Toolwert | Periode/Einheit | Ergebnis |
|---|---|---|---|---|
| Umsatz | „Sales to customers“ 94,193 | 94,193 | 2025-12-28, Mio. USD | ✓ |
| EBIT | Keine Operating-Income-Zeile. Vorsteuerergebnis 32,581; Zinsaufwand 971 (Tag `InterestExpenseNonoperating`); Zinsertrag 1,056; „Other (income) expense, net“ (7,209) | **fehlt** | — | Tag nicht erschlossen (I-1) |
| D&A | KFR 7,503 (`DepreciationDepletionAndAmortization`) | 7,503 in den Metadaten; EBITDA fehlt wegen EBIT | ebenso | ✓ D&A |
| CFO · CapEx · FCF | 24,530 · 4,832 · 19,698 | 24,530 · 4,832 · 19,698 | ebenso | ✓ |
| Finanzschulden | „Loans and notes payable“ 8,495 (enthält 2,000 laufenden Anteil der langfristigen Schulden, ca. 6.5 Mrd. Commercial Paper und lokale Kredite) + „Long-term debt“ 39,438 = **47,933** | `total_debt` **41,438** (`LongTermDebt` = 39,438 + 2,000); `debt_short_term` 8,495 (`ShortTermBorrowings`, überlappt mit dem laufenden Anteil); Umfang unbestimmt (Leasing offen) | Stichtag | Teilbetrag, korrekt als unbestimmt markiert (I-4) |
| Finance-Leasing | Anhang: „Commitments under finance leases are not significant“, kein Betrag | kein Tag → offen | — | berechtigt offen (B-2) |
| Operating-Leasing | 1,400 (`OperatingLeaseLiability`) | 1,400; Teilreihen kurz/lang nur bis 2019 | Stichtag | ✓ Summe |
| Liquidität | 19,709 (zusätzlich 393 marktgängige Wertpapiere) | 19,709 | Stichtag | ✓ (Wertpapiere nicht einbezogen) |
| Aktien (Ø verwässert) | 2,429.4 Mio. (FY2025 und FY2024 laut GuV identisch) | 2,429.4 | FY | ✓ |
| EPS verwässert · DPS | 11.03 · 5.14 (gezahlt) | 11.03 · 5.14 (`…CashPaid`) | FY, USD | ✓ |
| Dividenden gezahlt | 12,381 (`PaymentsOfOrdinaryDividends`) | fehlt | — | Tag nicht erschlossen (I-3) |
| Eigenkapital | 81,544 (Tag nur `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`) | `book_value` 81,544 (abgeleitet als Aktiva − Passiva), `total_equity` fehlt | Stichtag | Wert ✓ (I-2) |
| Jahreshistorie | FY2022 (2022-01-03…2023-01-01, 79,990) | **fehlt**; Reihe endet nach 5 Jahren | — | ✗ **F-2** |
| TTM | Q2/2026-10-Q: `ShortTermBorrowings` 11,692 + `LongTermDebtNoncurrent` 37,344; keine Q4-Aktienzahl | nicht gebildet (EBIT; Schuldenstichtag; Aktien Q4) | — | teils berechtigt (B-3), teils I-1/I-4 |

## 4 · Modelle und Sperrgründe

**MCD** (Router: `retail`; aktiv: DCF, RIM; DDM diagnostisch):

* **DCF gesperrt:** „Nettoschulden nicht ermittelbar (total_debt Umfang
  unvollständig)“.
  * *Ursache:* Die XBRL-Fakten widersprechen der Taxonomie.
    `LongTermDebtNoncurrent` = `LongTermDebt` = 39,973, obwohl darin laufende
    Fälligkeiten (725) und Commercial Paper (798) stecken.
  * *Bewertung:* Aus den Tags allein ist die Sperre gerechtfertigt. Die
    richtige Aufteilung steht nur im Anhangtext. Das ist vorhandene
    Information, die der Import nicht erschließt; kein Implementierungsfehler.
  * *Unabhängig nachgerechnet:* Finanzschulden 39,973 + Finance-Leasing 2,352
    − Liquidität 774 = **41,551**.
  * *Anzeige:* Der als „nachrichtlich“ ausgewiesene operative Unternehmenswert
    (141,973 / 716.4 = 198.18 je Aktie, arithmetisch ✓) ist durch F-1
    verfälscht. Die Prognose rechnet mit einer gemessenen D&A-Quote von 1.53 %
    statt rund 8.2 %.
* **RIM gesperrt:** „BVPS ≤ 0“. Das Eigenkapital ist −1,791 → **berechtigt**
  (B-1).
* **DDM** (diagnostisch): 108.90. Eingaben: DPS 7.17 (Quelle ✓); gemessenes
  Wachstum 7.30 %, auf 5 % gekappt.
* **Qualität:**
  * Net Debt/EBITDA 3.05 (39,199 / 12,850). Das EBITDA ist durch F-1 zu niedrig.
  * „Net Share Issuance 5y −100 % · 10/10“ ist falsch (F-4).
  * Der lease-bereinigte ROIC 21.5 % (fließt in den Score ein) paart Jahre
    falsch (F-5).
  * Interest Coverage 7.83 = 12,393 / 1,582 ✓.

**JNJ** (Router: `standard_nonfin`; aktiv: DCF, DDM, RIM):

* **DCF gesperrt:** „fehlend: ebit[0]“.
  * *Ursache:* Die EBIT-Rekonstruktion braucht den Zinsaufwand, den JNJ als
    `InterestExpenseNonoperating` taggt. Der Tag fehlt in der Liste (I-1).
  * *Bewertung:* Die Information ist im Abschluss vorhanden. **Vorsicht:**
    Eine reine Tag-Ergänzung liefert EBIT = 32,581 + 971 − 1,056 = 32,496.
    Darin steckt der nicht-operative Ertrag von 7,209 aus „Other (income)
    expense“. Das ist eine fachliche Entscheidung, keine reine Tag-Frage.
  * *Weitere Sperre:* Selbst mit EBIT bliebe die Wertbrücke gesperrt, weil der
    Umfang der Finance-Leasing-Verbindlichkeiten unbelegt ist. Der Resolver
    lehnt `net_debt` 21,729 korrekt ab (geprüft mit
    `_resolveNetDebtForDcfBridge`).
* **RIM:** 132.87. Buchwert 81,544 ✓, Aktien 2,429.4 ✓, BVPS 33.57. Der
  Jahresüberschuss 2025 enthält den Sonderertrag von 7,209
  (Modellvereinfachung M-3).
* **DDM** (Anker): 78.07. DPS 5.14 (gezahlt) ✓; Wachstum 7.05 %, auf 5 %
  gekappt. Die DPS-Historie ist durch F-2 lückenhaft (FY2022 fehlt).

## 5 · Kurse und Annahmen (getrennt)

Kein Kurs gesetzt (Yahoo aus). Der WACC ist heuristisch (Beta und Gewichte
fehlen). Die Modellwerte oben sind deshalb Rechenergebnisse unter
Standardannahmen, kein Fair-Value-Urteil.

## 6 · Befunde

### Bestätigte Implementierungsfehler

Reproduktion: `node tests/real-data/repro-findings.mjs` (nur Auszüge aus
`tests/real-data/excerpts/`). Stand beim Audit: 5 von 5 BESTEHT.
**Stand nach D2: alle fünf behoben, P-1 behoben (siehe §9).**

| # | Prio | Befund | Aufrufweg | Kleinstes Gegenbeispiel |
|---|---|---|---|---|
| **F-1** | hoch | D&A-Tag nach dem Prinzip „erster Treffer gewinnt“. `DepreciationDepletionAndAmortization` (457) wird genommen, obwohl der Filer die Gesamt-D&A (2,199) als `DepreciationAndAmortization` für dieselbe Periode meldet. Nach der Taxonomie ist DDA ⊇ D&A; DDA < D&A beweist, dass DDA hier nicht die Summe ist. Folgen: EBITDA −1,742 (−12 %), D&A-Quote im DCF 1.53 % statt ~8.2 %, Net Debt/EBITDA zu hoch. | `secFetchAll` → `_extractWithFallback(facts, SEC_TAG_MAP.da)` → `_applySecDerivations` (EBITDA) → `_resolveDaForForecast` | MCD FY2025: DDA 457 vs. D&A 2,199 |
| **F-2** | hoch | `_extractFyValues` schlüsselt Jahreswerte über `end.substring(0,4)`. Bei 52/53-Wochen-Jahren mit Ende Anfang Januar kollidieren zwei Geschäftsjahre (FY2022 endet 2023-01-01 → Schlüssel 2023 = FY2023). Ein anderes Jahr hat dann keinen Schlüssel („Lücke“ 2021-01-03 → 2019-12-29), `_takeLatestContiguousFiscalYears` schneidet ab. Folgen: FY2022 fehlt still, die Nachbarn gelten als aufeinanderfolgend, nur 5 statt 10 Jahre. | `_extractWithFallback` → `_extractFyValues` (alle FY-Felder) | JNJ Umsatz 10-K-Fakten FY2019…FY2025 |
| **F-3** | mittel | `normalizeSecQuarters` vergleicht gemeldetes Quartal und Kumulierungsdifferenz mit `VALUE_EPS_REL = 1e-9`, also ohne Rundungstoleranz. Millionengerundete Angaben erzeugen Schein-Widersprüche; das Quartal wird verworfen, und es entsteht kein TTM. | `buildTtmDatasetFromFacts` → `normalizeSecQuarters` → `ttmUsableQuarters` | MCD Q3/2025: 7,078 gemeldet vs. 19,876 − 12,799 = 7,077 |
| **F-4** | mittel | Die Aktienreihe bleibt gemischt skaliert. MCD meldet ab dem 10-K FY2023 „716.4 shares“ (Filer-Skalierungsfehler); ältere Jahre sind korrekt (750,100,000). `normalizeSharesInPlace` normalisiert nur [0]. Folge: „Net Share Issuance 5y −100 %“ mit Bestnote 10/10 im Quality-Score. | `normalizeSharesInPlace` → `computeNetShareIssuance` (und jeder weitere Verbraucher von `shares_diluted[i>0]`) | MCD `WeightedAverageNumberOfDilutedSharesOutstanding` FY2020…FY2025 |
| **F-5** | mittel | `computeRoicMinusWacc` paart `oll[i]` per Index mit `ebit[i]`, `book_value[i]` und `total_debt[i]`. Die Operating-Leasing-Reihe stammt aus älteren 10-Ks (letzter Wert 2023-12-31), also wird EBIT 2025 mit Leasing 2023 gepaart. Das Ergebnis fließt in den Quality-Score ein. | `computeRoicMinusWacc` | MCD `OperatingLeaseLiability` (Ende 2023) vs. `OperatingIncomeLoss` (Ende 2025) |

### Vorhandene Information, die der Import nicht erschließt

* **I-1 · JNJ `InterestExpenseNonoperating`:** Dadurch fehlen EBIT und der DCF.
  Die Korrektur braucht zuerst eine fachliche Entscheidung zum
  nicht-operativen Ergebnis (siehe §4).
* **I-2 · JNJ Eigenkapital:** nur als
  `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`
  getaggt. Der Buchwert ist über Aktiva − Passiva richtig; `total_equity`
  bleibt leer.
* **I-3 · JNJ Dividenden:** als `PaymentsOfOrdinaryDividends` getaggt.
* **I-4 · Schuldenaufteilung aus dem Anhang:**
  * MCD: Umklassifizierung nach „Long-term debt“ (39,973 enthält 725 + 798).
  * JNJ: `ShortTermBorrowings` 8,495 enthält den laufenden Anteil 2,000.
  * JNJ-10-Q: Nur Bilanzposten, kein `LongTermDebt`; der TTM-Schuldenstichtag
    fehlt deshalb.
* **I-5 · MCD Operating-Leasing 2024/2025:** Barwert 12,488 im Anhang, aber
  nicht mehr über die vom Tool genutzten Tags gemeldet.

### Fachlich berechtigte Nichtverfügbarkeit

* **B-1:** MCD RIM, weil das Eigenkapital negativ ist.
* **B-2:** JNJ Finance-Leasing „not significant“ ohne Betrag. Eine Textaussage
  ist kein belegter Nullwert, die Brückensperre folgt der Regel aus 12B.2.
* **B-3:** JNJ-TTM-Aktien. Für Q4 wird keine gewichtete Aktienzahl gemeldet;
  Durchschnitte werden nicht abgeleitet.
* **B-4:** MCD-TTM-Wertbrücke. Auch nach Behebung von F-3 enthält der 10-Q nur
  `LongTermDebtNoncurrent`. Die Umfangsprüfung bliebe damit offen.

### Offengelegte Modellvereinfachungen

* **M-1:** Die Aktienbasis ist der Ø verwässerte Wert, nicht der Stichtagswert
  (MCD 716.4 vs. 711 am Jahresende; JNJ 2,429.4 vs. rund 2,408).
* **M-2:** Operating-Leasing gehört nicht zu den Schulden (MCD 12,488).
  Marktgängige Wertpapiere zählen nicht zur Liquidität (JNJ 393).
* **M-3:** Der Jahresüberschuss wird unbereinigt verwendet. Betroffen sind
  JNJ 2025 (Sonderertrag 7,209) und JNJ 2023 (aufgegebener Bereich 21,827 in
  der EPS-Historie). Die JNJ-Historie mischt außerdem ab FY2021 restated Werte
  (ohne Kenvue) mit FY2020 in alter Abgrenzung.

### Ungeklärter Prüfpunkt (in D2 bestätigt und behoben, siehe §9)

* **P-1 · Net Debt/EBITDA:** `computeNetDebtToEbitda` liest das Feld
  `net_debt`, ohne die Umfangsprüfung des DCF-Resolvers. Bei JNJ enthält das
  Feld 21,729; der Resolver lehnt es als Teilbetrag ab, die Bilanz ergibt
  rund 28,224. Angezeigt wird das derzeit nicht, weil das EBITDA fehlt.
  Sobald I-1 behoben ist, würde der Teilbetrag sichtbar. Vor I-1 klären.

## 7 · Korrekturaufträge (priorisiert, jeweils eng)

1. **F-2:** Jahresschlüssel in `_extractFyValues` über das Geschäftsjahr
   bilden, mit derselben Toleranzlogik wie `normalizeSecQuarters`
   (`FY_ANCHOR_TOL_DAYS`). Prüfen mit dem JNJ-Auszug: FY2022 vorhanden, keine
   Schein-Lücke.
2. **F-1:** Beim D&A-Feld nicht blind den ersten Tag nehmen. Liegen für
   dieselbe Periode mehrere D&A-Tags vor und ist
   `DepreciationDepletionAndAmortization` kleiner als
   `DepreciationAndAmortization`, dann ist der kleinere Wert nachweislich keine
   Summe: den größeren verwenden oder sichtbar als Konflikt sperren (die Wahl
   ist Teil des Auftrags). Prüfen mit dem MCD-Auszug.
3. **F-4:** Jedes Element der Aktienreihe mit derselben Skalenprüfung
   normalisieren wie [0] (z. B. per EPS-Querprüfung je Periode). Ist die Reihe
   nicht einheitlich normalisierbar, gelten die Historien-Kennzahlen als nicht
   verfügbar.
4. **F-3:** Rundungstoleranz im Quartalsabgleich einführen, abgeleitet aus der
   erkennbaren Rundungseinheit der beteiligten Werte (z. B. alle Werte
   Vielfache von 1e6 → Toleranz 1.5e6). Kein pauschales Lockern.
5. **F-5:** Lease-bereinigten ROIC periodengleich paaren. Ohne Leasingwert der
   gleichen Periode gibt es keine Lease-Bereinigung für dieses Jahr.
6. Erst danach, als eigene fachliche Entscheidung: I-1 (Zinsaufwand-Tag und
   Umgang mit dem nicht-operativen Ergebnis) zusammen mit P-1.

Nicht empfohlen: Die Schuldensperren (MCD, JNJ) aufweichen. Sie folgen
korrekt den gemeldeten Tags.

## 8 · Grenzen

* Zwei Unternehmen, ein Geschäftsjahr in der Tiefe. Die Historie wurde nur
  dort geprüft, wo ein Befund es verlangte.
* Die TTM-Werte konnten nicht gegen die Quartalsberichte abgeglichen werden,
  weil das Tool für beide Unternehmen kein TTM bildet.
* Die Anzeigen wurden als Text ausgelesen (headless Chromium), nicht visuell
  geprüft.
* Das Werkzeug hatte beim Auditlauf die beiden in §1 (Nachtrag D1) genannten
  Fehler. Behoben ist das seit D1; der erneute Realdatenlauf steht aus (D3).
* Die Rohdaten sind nicht versioniert (`tests/real-data/cache/`, rund 8 MB).
  Versioniert sind nur die wortgetreuen Auszüge mit Quell-Hash.

## 9 · Nachtrag D2 — Korrekturen (Stand nach Commit `b699dbe` + Doku)

Die Befunde wurden am Produktcode korrigiert und durch Regressionstests
abgesichert (`tests/real-data-findings.test.mjs`, 41 Tests, Teil von
`npm test`). Die Tests verlangen das fachlich richtige Ergebnis und schlagen am
Stand vor D2 (`2f1058d`) fehl. Grundlage sind wortgetreue Auszüge derselben
Quelldateien (gleicher SHA-256 wie beim Audit, erneut abgerufen am 2026-09-28).
Die im Audit genannten Zahlen wurden an diesen Quellen bestätigt.

| # | Status | Korrektur | Wirkung MCD/JNJ (echter Import im Browser) |
|---|---|---|---|
| F-2 | behoben, abgesichert | Jahresschlüssel = Geschäftsjahr (`_secPeriodYear`: Ende 1.–7. Januar gehört zum Vorjahr, 52/53-Wochen-Jahr); Periodenidentität, Anschlussprüfung, `fy`-Gegenprüfung nur für Hauptperioden, ersetzte Werte nachvollziehbar | JNJ: 10 Jahre FY2016–FY2025 inkl. FY2022 (79,990, Stichtag 2023-01-01); Wachstumsheuristik jetzt 2.29 % statt 8 % (vorher EPS-CAGR über scheinbar 4 statt 5 Jahre), RIM 88.36 statt 132.87 |
| F-1 | behoben, abgesichert | D&A je Geschäftsjahr nach belegtem Tag-Umfang (DDA ⊇ D&A ⊇ Depreciation, Vergleich nur gleicher Bericht und gleiche Periode); widersprüchlich/nur Teilposten → kein Wert mit Grund; auch Quartals-D&A | MCD: D&A 2,199, EBITDA 14,592, D&A-Quote 7.90 %, DCF nachrichtlich 242.10/Aktie (vorher 198.18) |
| F-4 | behoben, abgesichert | Jede historische Aktienangabe gegen NI/EPS desselben Geschäftsjahres; Originalangabe früherer 10-K vor Umskalierung; ohne Beleg keine Korrektur, Reihe endet vor nicht belegbarer Angabe | MCD: Reihe einheitlich (716.4 … 750.1 … 861.2), Net Share Issuance −4.5 % (8/10) statt −100 % (10/10) |
| F-3 | behoben, abgesichert; TTM weiter unvollständig | Toleranz = Σ ½·10^−decimals der beteiligten Angaben, `decimals` aus der Original-XBRL-Instanz; ohne belegte Präzision exakt; gleiche Regel in der TTM-Gegenprobe | MCD Q3/2025 akzeptiert (Abweichung 1 ≤ 1.5 Mio.), Umsatz-TTM 27,703 bildbar. TTM bleibt unvollständig: EBIT Q2/2026 (−1 Mio. bei belegten decimals −5 → Grenze 0.6 Mio.), CFO/CapEx Q2/2026 (−3 Mio.), Q4-Aktien, Schuldenstichtag |
| F-5 | behoben, abgesichert | Periodengleiche Verknüpfung (Endbestände desselben Geschäftsjahres, Definition unverändert); kein Rückgriff, keine 0 | MCD: ROIC − WACC „nicht bewertbar“ (Leasing für FY2025 nicht gemeldet, letzte Angabe 2023-12-31, retail) statt 21.5 % |
| P-1 | bestätigt, behoben | Net Debt/EBITDA und MoS-Leverage-Zuschlag nutzen `_resolveNetDebtForDcfBridge` (gleiche Definition) plus Periodenabgleich mit EBITDA | MCD: „belastbare Nettoschulden fehlen — Schuldenangaben widersprechen sich (725)“ statt 2.69/3.05; JNJ: Teilbetrag 21,729 würde auch mit EBITDA nicht verwendet |

Nicht geändert (bewusst): DCF- und Multiple-Sperren, Schuldenauflösung, I-1
bis I-5, B-1 bis B-4, M-1 bis M-3.

### JNJ — fachliche Abgrenzung (Auftrag §8)

* Keine automatische Ergebnisnormalisierung, keine geschätzte Bereinigung des
  Sonderertrags 7,209 („Other (income) expense, net“).
* **I-1 bleibt offen (eigene Entscheidung).** `InterestExpenseNonoperating` wurde
  nicht ergänzt. Eine reine Tag-Ergänzung ergäbe EBIT 32,496 einschließlich des
  nicht-operativen Ertrags und würde zusammen mit P-1 ein DCF-Signal nicht
  freischalten: die Wertbrücke bliebe wegen des unbelegten
  Finance-Leasing-Umfangs gesperrt.
* **Schulden/Finance-Leasing offen:** „Commitments under finance leases are not
  significant“ ist ohne passende Regel und ohne Betrag keine belegte Null.
  Fehlende Tags sind kein Nullnachweis.

### Offen für D3 (erneuter Realdatenabgleich)

* Vollständiger Quellenabgleich aller Anzeigen mit dem reparierten Werkzeug.
  In D2 lief nur eine Importkontrolle (Replay MCD/JNJ, Werte oben).
* Replay-Abgleich meldet unverändert gegenüber dem Stand vor D2:
  MCD „Basiswert ddm“ (diagnostisches DDM 108.90 wird im Bewertungspanel nicht
  angezeigt, das Werkzeug erwartet es) und JNJ „Markt-Vergleich: Periode der
  verwendeten Basis 2025-12-28“. Beides bestand schon vor D2 (Gegenlauf gegen
  `2f1058d`); zu klären ist, ob Werkzeugregel oder Anzeige anzupassen ist.
* MCD meldet in 10-Qs `decimals="-5"` für Werte, die Vielfache von 1 Mio. sind.
  Nach belegter Präzision bleiben EBIT/CFO/CapEx Q2/2026 Widersprüche; eine
  größere Toleranz wäre nicht belegt.
* FY2018 von MCD wird mit dem ASC-842-Eröffnungswert des Operating-Leasings zum
  2019-01-01 verknüpft (1 Tag Abstand, Übergangswert). Das ist die bisherige
  45-Tage-Stichtagsregel; fachlich zu bestätigen.

## 10 · Nachtrag D2-Nachbesserung — drei Restlücken (V1.0.72)

Ausgangsstand `8fa2492` (unverändert, sauber). Nach D2 unabhängig reproduziert
und hier über die produktiven Funktionen bestätigt:

| # | Lücke am Stand `8fa2492` | Ursache | Korrektur | Status |
|---|---|---|---|---|
| N-1 | Leasing-ROIC, retail, Leasing nur für 4 (bzw. 1) von 6 Jahren: „ok“, 15 %, +7 pp, kein Hinweis (5 Jahre korrekt 10 % / +2 pp) | Die Sperre griff nur bei fehlendem jüngstem Leasingjahr; „erforderlich, aber zu wenige Jahre“ fiel auf den unbereinigten ROIC zurück | Erforderlichkeit (Leasing belegt, retail oder > 20 %) getrennt von der Mindesthistorie (5 periodengleiche Jahre inkl. jüngstem). Erforderlich, aber nicht erfüllt ⇒ `insufficient_data` mit konkretem Grund; unbereinigter Wert nur in `informational`, kein Score. Periodenfreie Altdaten unverändert | geschlossen |
| N-2 | Net Debt/EBITDA mit `net_debt [900]`, `ebitda [250]` und a) EBITDA `[null]`, b) EBITDA `["n/a"]`, c) Nettoschulden `[null]`: „ok“ 3.60; MoS-Zuschlag daraus | Vergleich nur, wenn beide Seiten ein Datum hatten | Jede Seite für sich (Regel der EV/EBITDA-Brücke): Führt sie Periodenangaben, braucht sie ein gültiges Kalenderdatum für den tatsächlich verwendeten Betrag (Quelle des Resolvers). Resolver, 45-Tage-Toleranz und Multiple-Sperren unverändert. MoS-Aufschlüsselung zeigt „nicht bewertbar … n/a“ statt „–“ | geschlossen |
| N-3 | MCD: EBIT FY2018 (Ende 2018-12-31) ↔ Operating-Leasing zum 2019-01-01 | Jahresschlüssel (1.–7. Januar → Vorjahr) + 45-Tage-Regel | Quelle geprüft: Im 10-K FY2019 (`0000063908-20-000022`) meldet MCD zum 2018-12-31 `OperatingLeaseLiabilityCurrent`/`Noncurrent` = 0 und zum 2019-01-01 `OperatingLeaseLiability` 12,500 (ASC-842-Einführung); FY2019 beginnt am 2019-01-01. Gleichwertigkeit ist damit widerlegt. Regel: Ein Stichtag, an dem eine EBIT-Geschäftsperiode beginnt und keine endet, ist Eröffnungsbestand und wird nicht verknüpft (`_openingBalanceExcluded`). In `_extractFyValues` entscheidet bei zwei Stichtagen unter einem Geschäftsjahr der Hauptstichtag eines 10-K | ausgeschlossen |

JNJs FY2022 (Ende 2023-01-01), die wiederhergestellte Historie und normale
Kalenderjahresenden bleiben unverändert (Tests N-3, F-2).

Nachweise: 14 neue Tests in `tests/real-data-findings.test.mjs` (N-1 bis N-3);
am Stand `8fa2492` scheitern die 10 Fehlerfall-Tests am falschen Ergebnis
(„ok“, Verhältnis 4.0, Paar 2019-01-01), die 4 Erhaltungstests bestehen vorher
und nachher. Browser-Abnahme Abschnitt 9 (29 Prüfungen, UI-Import und Rendern):
am Stand `8fa2492` 18 Fehlschläge, danach 0. `repro-findings.mjs` prüft die
Leasingpaare jetzt unabhängig (gleicher Stichtag, kein EBIT-Periodenbeginn aus
den Rohfakten): am Stand `8fa2492` BESTEHT F-5, danach BEHOBEN.

Offen für D3 (unverändert): Replay-Abweichungen MCD „Basiswert ddm“ und JNJ
„market: Periode der verwendeten Basis 2025-12-28“ — Voraussetzung für den
abschließenden Abgleich.

## 11 · Nachtrag D3-Vorbereitung — Replay-Abweichungen geklärt (V1.0.73)

Beide Abweichungen lagen an der **Anzeige**, nicht an der Werkzeugregel:

| Abweichung | Ursache | Korrektur | Replay danach |
|---|---|---|---|
| MCD „valuation: Basiswert ddm“ (108.90) | DDM ist Diagnosemodell (retail, sichtbar, nicht gewichtet, V1.0.6). Ohne Intrinsic-Bewertung rendert `buildValuationFallback`; dessen Modell-Status ließ Diagnosemodelle weg | Diagnosemodelle dort mit Wert/Grund und Kennzeichen „DDM diagnostisch — nicht gewichtet, kein Fair Value“. Werkzeug prüft zusätzlich die Kennzeichnung | 49/49, Exit 0 |
| JNJ „market: Periode der verwendeten Basis 2025-12-28“ | Periode im Markt-Vergleich nur aus EBITDA; JNJ hat kein EBIT/EBITDA ⇒ keine Periode | Rückfall auf `_dataBasisPeriodEnd` (dieselbe Regel wie der Ausweis der Datenbasis); EBITDA-Periode behält Vorrang | 49/49, Exit 0 |

Gegenlauf mit der Produktdatei von `12a30ac`: MCD 43/49, JNJ 46/49 (Exit 1).
Engine-Werte unverändert.

## 12 · D3 — erneuter Realdatenabgleich mit dem reparierten Werkzeug

> **Ersetzt durch §13** (abschließender D3-Lauf gegen die Originalberichte).

Stand: Produkt/Werkzeug `05fefc6` (V1.0.73), Datenstichtag 2026-09-24,
Quellen neu geladen am 2026-09-28 (SHA-256 unverändert: MCD `0394e814…`,
JNJ `7141c0c9…`). Kein Kurs gesetzt (Yahoo aus).

### 12.1 · Importwerte gegen die Quelle

`tests/real-data/reconcile-sources.mjs` (neu, unabhängig vom Produktcode):
**MCD 76/76, JNJ 56/56** geprüfte Werte stimmen (je Feld die drei erfassten
Jahre; vollständige Tabelle: `AUDIT-D3-RECONCILIATION.md`). Bestätigt u. a.:

* Jeder gemeldete Wert ist der **jüngste** 10-K-Fakt seines Tags und seiner
  Periode; spätere Neufassungen (z. B. MCD 2023: 25,493.7 → 25,494) sind
  übernommen, die Akte des Tools gehört jeweils dazu.
* MCD-EBITDA = EBIT + `DepreciationAndAmortization` (2,199 / 2,097 / 1,978),
  nicht mehr der Teilposten `DepreciationDepletionAndAmortization` (457) — F-1
  im echten Import bestätigt.
* MCD-Aktien 716.4 / 721.9 / 732.3: der Filer meldet in Mio.; NI/EPS derselben
  Periode bestätigt (716.6 / 721.9 / 732.6) — F-4 bestätigt.
* JNJ: 52/53-Wochen-Stichtage (2025-12-28, 2024-12-29) je richtig zugeordnet
  (F-2); Buchwert 81,544 = Aktiva − Passiva.
* Qualitätskennzahlen unabhängig nachgerechnet: MCD Interest Coverage
  12,393 / 1,582 = 7.83; Net Share Issuance 5y MCD 716.4 / 750.1 − 1 = −4.5 %,
  JNJ 2,429.4 / 2,670.7 − 1 = −9.0 %.
* Ohne Toolwert (nicht abgeglichen, bekannt): JNJ `ebit`/`ebitda` (I-1),
  Finance-Leasing (B-2), `dividends_paid` (I-3), `total_equity` (I-2). MCD
  Operating-Leasing endet 2023-12-31 bzw. 2022-12-31 (I-5; im ROIC seit D2
  gesperrt).

### 12.2 · Anzeigen gegen die Engine

`replay-import.mjs`: **MCD 49/49, JNJ 49/49** (Exit 0) über FY → TTM → FY.
TTM wird bei beiden angefordert, nicht verwendet, Rückfall mit Gründen
ausgewiesen; Fundamentaldaten-Hash nach Import = am Ende; keine Ausnahme im
Browser; einzige abgewiesene Anfrage: Google Fonts. Damit ist der Vorbehalt aus
dem Nachtrag D1 (§1) mit der reparierten Fassung ausgeräumt.

Modelle: MCD DCF gesperrt (Nettoschulden, operativer Wert 242.10/Aktie
nachrichtlich), RIM gesperrt (BVPS ≤ 0), DDM 108.90 diagnostisch (seit V1.0.73
sichtbar). JNJ DCF ausgeschlossen (ebit[0] fehlt), DDM 78.07, RIM 88.36,
Synthese-Basis 81.81.

### 12.3 · TTM-Gründe gegen die Quelle

JNJ: EBIT (I-1), Schuldenstichtag 2026-06-28 (I-4), Aktien Q4 (B-3) — wie
beschrieben. MCD: EBIT/CFO/CapEx Q2/2026 und zusätzlich **Net Income
Q3/2024** (im Vorjahresfenster) scheitern an Differenzen von 1–3 Mio. bei
deklarierten `decimals="-5"` (offener Punkt aus §9). Bei Net Income steht
derselbe Fakt im 10-Q `0000063908-25-000059` zweimal: in der GuV mit
`decimals="-6"`, an anderer Stelle mit `-5`; die Produktregel nimmt die
genauere Angabe (XBRL-Regel für konsistente Duplikate). Das ist dieselbe
offene Frage, kein neuer Rechenfehler.

### 12.4 · Neue Befunde

| # | Prio | Befund | Nachweis |
|---|---|---|---|
| **D3-1** | mittel | **Übersicht nennt einen falschen Sperrgrund.** Ohne Kurs setzt `_applyValuationResult` die Synthese auf `blocked` mit dem Grund „Kein Kurs verfügbar — …“. Die Übersicht zeigt diesen Grund nur im Kasten „Konservative Einstiegszone“; Kurzbegründung (`_ovMiniWhy`) und Kernaussage 1 (`ovKeyStatements`) sagen dagegen „Bewertung blockiert: **Hard Stop** aktiv — siehe Quality-Tab“ und „es liegt **kein belastbarer Eigenkapitalwert** vor“, obwohl dieselbe Seite „Ausschlusskriterien: keine“ zeigt und JNJ eine Synthese-Basis von 81.81 hat. Bei MCD (keine anwendbaren Modelle, `no_models_applicable`) ist „kein belastbarer Eigenkapitalwert“ zutreffend, „Hard Stop aktiv“ aber ebenfalls falsch. | Replay JNJ und MCD ohne Kurs; mit `--price 150` (nur Diagnose, keine Quelle) verschwinden beide Aussagen (JNJ: „Kurs liegt 185,9 % über der Einstiegszone“). Werte und Einordnung sind nicht betroffen, nur die Begründung. |
| **D3-2** | niedrig | **Irreführender TTM-Grund.** MCD Net Income: „kein Quartal endet am 2024-09-30“, obwohl das Quartal gemeldet ist (2,255) und nur wegen Widerspruchs verworfen wurde (−1 Mio. bei Toleranz 0.15 Mio.). Der Grund sollte den Widerspruch nennen. | `normalizeSecQuarters` mit den Original-Instanzen: `conflict` bei FY2024-Q3. |
| **D3-3** | niedrig (Werkzeug) | `checkPanels` prüft Übersichts-Begründungen nicht gegen `synthesis.blockReason`; D3-1 wurde deshalb nicht automatisch erkannt. | — |

D3-1 bis D3-3 sind **nicht** korrigiert (Abgleichsauftrag). Weiter offen wie
bisher: I-1 bis I-5, B-1 bis B-4, M-1 bis M-3, MCD-`decimals`-Frage.

### 12.5 · Grenzen

Geprüft sind je Feld drei Jahre (so viel enthält die Erfassung); ältere Jahre
sind durch die D2-Regressionstests abgedeckt, nicht durch diesen Lauf. Die
10-K-Dokumentwerte aus §2/§3 (Anhangangaben ohne XBRL-Tag) wurden nicht erneut
aus den HTML-Dokumenten gelesen; die XBRL-Werte stimmen mit ihnen überein.
Anzeigen wurden als Text geprüft, nicht visuell.

## 13 · D3 abschließend — Realdaten erneut gegen Originalberichte geprüft (V1.0.74)

> §12 (vorheriger D3-Lauf) ist hierdurch **ersetzt**: Er prüfte nur die ersten
> drei Werte je Feld gegen Company Facts, nicht gegen die Originalberichte, und
> nicht TTM. Sein grüner `reconcile-sources`-Lauf war kein TTM-Nachweis und hätte
> den EBITDA-Teilpostenfall (12,850) akzeptiert (§13.2).

### 13.0 · Ausgangsstand und Voraussetzungen

| | |
|---|---|
| Branch | `claude/audit-real-data-mcd-jnj`, Ausgangscommit `04d8c83` (= Remote-Spitze, Arbeitsbaum sauber, keine `AGENTS.md`) |
| Baseline (selbst ausgeführt, `04d8c83`) | `npm test` Exit 0 (1700 Rechenprüfungen, 269/269 Node-Tests) · `npm run test:audit-tool` Exit 0 (29/29) · `replay-import.mjs --selftest` 52/52 · Replay MCD 49/49, JNJ 49/49 (Exit 0) |
| D1 (Code gelesen, Tests) | Die Erfassung liest die Bewertungssicht der Engine (`resolveValuationView`), TTM-Felder nur aus der TTM-Sicht, Jahres-Tags nicht als TTM-Tag; jede Ansicht wird per Mausklick geöffnet und erst nach nachgewiesenem Neurendern gelesen (Markierung im Ausgabebereich). Bestätigt durch `replay-import.browser.test.mjs` (FY → TTM → FY, synthetischer TTM-Filer) und die Realläufe. **Lücke in D1 gefunden und behoben:** Werte, Perioden und Akten wurden nur für die ersten drei Jahre erfasst (§13.2). |
| D2 (Code, Tests, Reallauf) | F-1 … F-5 und P-1 im echten Import nachgeprüft (§13.9). **Restlücke gefunden:** F-4 galt nur für `shares_diluted`, nicht für `shares_basic` (D3-4, behoben). |
| Offene fachliche Fragen | I-1 … I-5, B-1 … B-4, M-1 … M-3 (§6) bleiben dokumentiert; §13.7 grenzt die JNJ-Fragen neu ab. |

### 13.1 · Quellen, Stichtag, Berichtsgrenzen

* **Quellen.** Company Facts und Submissions über `fetch-sources.mjs` (SHA-256
  unverändert: MCD `0394e814d75510be…`, JNJ `7141c0c988fa1d30…`), dazu **neu**
  die Originalberichte über `fetch-filings.mjs`: alle 10-K seit 2016 sowie die
  10-Q Q2/2025 … Q2/2026 beider Unternehmen (iXBRL-Hauptdokument, bei älteren
  Filings die XBRL-Instanz) und vier ältere, von der Engine zitierte 10-K
  (2011–2018). Manifest je Datei: URL, Form, Accession Number,
  Einreichungsdatum, Berichtsperiode, Abrufzeit, SHA-256 (Tabelle:
  `AUDIT-D3-RECONCILIATION.md` §1). Originale liegen unverändert in
  `tests/real-data/cache/filings/` (nicht versioniert), Ableitungen
  (Stichtagskopie, Belege, Tabellen) getrennt davon.
* **Stichtag 2026-09-24.** Letzte Filings vor dem Stichtag: MCD 10-Q Q2/2026
  (`0000063908-26-000073`, eingereicht 2026-08-07), JNJ 10-Q Q2/2026
  (`0000200406-26-000153`, 2026-07-23); danach bis zum Abruf (2026-09-28) keine
  10-K/10-Q. `fetch-sources.mjs` filtert Company Facts nach `filed` ≤ Stichtag
  (hier 0 Fakten entfernt); Gegenprobe mit Stichtag 2026-06-30: 369 spätere
  Fakten entfernt, jüngstes `filed` 2026-05-07, das 10-Q vom 2026-08-07 und
  seine Instanz nicht geladen. Die Submissions-Datei wird nicht gefiltert; das
  Produkt liest daraus nur SIC, Geschäftsjahresende und Börse (statisch).
  `fetch-filings.mjs` lädt nur Filings mit Einreichung ≤ Stichtag. Die
  Originaldokumente sind je Accession unveränderlich; ihr Abrufzeitpunkt liegt
  nach dem Stichtag, ihr Einreichungsdatum nicht.
* **Berichtsgrenzen.** MCD: Kalenderjahr, FY2025 = 2025-01-01…2025-12-31, TTM
  = 2025-07-01…2026-06-30 (365 Tage). JNJ (10-K Anhang 1: Geschäftsjahr endet
  am Sonntag nahe Ende Dezember, 52 Wochen, alle fünf bis sechs Jahre 53):
  FY2025 = 2024-12-30…2025-12-28 (52 Wochen), 6M 2026 = 2025-12-29…2026-06-28,
  6M 2025 = 2024-12-30…2025-06-29, TTM = **2025-06-30…2026-06-28 (364 Tage)**.
  FY2026 hat 53 Wochen; die Zusatzwoche liegt in Q4/2026, außerhalb des Fensters.
  Das bisher genannte Fenster „Q3/2025 bis Q2/2026“ ist damit bestätigt.

### 13.2 · Werkzeug: Anpassungen und Absicherung

| Werkzeug | Änderung | Nachweis |
|---|---|---|
| `replay-import.mjs` | Erfassung der **ganzen** Reihe (Werte, Perioden inkl. Beginn, Formen, `filed`, Akten; bisher je drei) und weiterer Modellreihen (Zins, Steuer, SBC, Bilanzsummen, Rückkäufe …); Engine-TTM-Datensatz `fundamentals._ttm` auch wenn unvollständig und **nicht verwendet** (`usedForValuation`); Modelleingaben (`modelInputs`, D&A-Quote), Qualitätskennzahlen, Umfangskennzeichen der Schulden, Sperre der Synthese; neue Prüfung „Übersicht nennt den Sperrgrund, kein ‚Hard Stop aktiv‘ ohne aktiven Hard Stop“ (D3-3). Kein eigener Rechenweg. | `check-panels.test.mjs` +3 (25), Selbsttest 58/58 |
| `reconcile-sources.mjs` | Neu gefasst: jeder erfasste Jahreswert gegen Company Facts **und** gegen den zitierten Originalbericht (Fundstelle = Tabellenzeile); EBITDA − EBIT muss die **Gesamt-D&A** sein (Auditbeleg, sonst größter D&A-Posten des Originals); ein Teilposten ist ABWEICHUNG, auch wenn sein Betrag „zu einem D&A-Tag passt“; Schulden: Rechenidentität und fachlicher Umfang getrennt. | `reconcile-sources.test.mjs` (6): Gegenfall 12,850 = 12,393 + 457 → ABWEICHUNG, Exit 1; 14,592 → besteht. Die frühere Fassung meldet für denselben Fall „2/2 Werte stimmen“, Exit 0 (reproduziert) |
| `fetch-filings.mjs`, `ixbrl.mjs`, `evidence.mjs` | Originalberichte laden; iXBRL/Instanz lesen (Konzept, Kontext, angezeigter Wert, `decimals`, Zeile); Auditbelege gegen das Original prüfen | 137 Belege (MCD 72, JNJ 65), alle im Original bestätigt |
| `control-calcs.mjs` + `evidence/<T>.json` | Unabhängige Kontrollrechnung FY und TTM (TTM = FY + YTD − Vorjahres-YTD aus den Originalen; anderer Weg als die Quartalssumme der Engine), Vergleich mit den erfassten Engine-Werten, Zielwert und Engine-Grund getrennt; Fallprüfungen (TTM angefordert, FY verwendet, Rückfall ausgewiesen). Kontrollwerte stehen nur in den Auditbelegen, nicht im Produkt. | Gegenprobe mit verfälschter Erfassung (EBITDA 12,850, TTM-Umsatz, TTM als verwendet): 5 Abweichungen, Exit 1 |

### 13.3 · Vier Prüffälle

Kontrollwerte aus den Originalberichten (Belege mit Fundstelle:
`AUDIT-D3-RECONCILIATION.md` §2, Kürzel `fy.*` = 10-K FY2025, `h126/h125.*` =
10-Q Q2/2026 Sechsmonatsspalten, `bs26.*` = 10-Q-Bilanz, `q*` = Quartalsspalten,
`note.*` = Anhang). „Engine“ = tatsächlich erfasster Wert: FY aus der Erfassung
`fy`; TTM aus dem Engine-TTM-Datensatz (gebildet, aber **nicht verwendet**).
Status: korrekt · berechtigte Einschränkung · bestätigter Fehler · ungeklärt.

**Angeforderte und verwendete Basis:** In beiden TTM-Fällen angefordert TTM,
verwendet **FY** (Rückfall mit Gründen in Bewertungs- und Annahmenansicht; die
TTM-Ansicht weist die Felder als Jahreswerte aus, nicht als TTM). Es gibt für
MCD und JNJ **keine automatische TTM-Bewertung**.

#### MCD FY

| Posten | Einheit · Periode | Kontrollwert (Original) | Rechenweg | Engine | Abw. | Status | Erklaerung / Engine-Grund |
|---|---|---|---|---|---|---|---|
| Umsatz | Mio. USD · 2025-01-01…2025-12-31 | 26,885 | fy.revenue | 26,885 | 0 | korrekt | GuV-Gesamtumsatz |
| EBIT (Operating income) | Mio. USD · 2025-01-01…2025-12-31 | 12,393 | fy.ebit | 12,393 | 0 | korrekt | GuV-Zeile Operating income |
| D&A (gesamt) | Mio. USD · 2025-01-01…2025-12-31 | 2,199 | fy.da_total | 2,199 | 0 | korrekt | KFR-Gesamtbetrag; GuV-SG&A-Zeile 457 ist nur Teilposten (F-1 behoben) |
| EBITDA | Mio. USD · 2025-01-01…2025-12-31 | 14,592 | fy.ebit + fy.da_total | 14,592 | 0 | korrekt | EBIT + Gesamt-D&A; Teilpostenrechnung 12,850 waere falsch |
| Operativer Cashflow | Mio. USD · 2025-01-01…2025-12-31 | 10,551 | fy.cfo | 10,551 | 0 | korrekt | KFR |
| Investitionen (CapEx) | Mio. USD · 2025-01-01…2025-12-31 | 3,365 | fy.capex | 3,365 | 0 | korrekt | KFR Capital expenditures |
| FCF = CFO − CapEx | Mio. USD · 2025-01-01…2025-12-31 | 7,186 | fy.cfo - fy.capex | 7,186 | 0 | korrekt | Definition des Tools |
| Liquide Mittel | Mio. USD · 2025-12-31 | 774 | bs.cash | 774 | 0 | korrekt | Bilanz |
| Finanzschulden (vollstaendig) | Mio. USD · 2025-12-31 | 39,973 | note.debt_total | 39,973 | 0 | korrekt | Anhang: 39,973 enthaelt CP 798 und laufende Faelligkeiten 725 (umklassifiziert); Wert stimmt, Engine kennzeichnet Umfang dennoch als unvereinbar (Tags widersprechen sich) ⇒ Bruecke gesperrt |
| Ausgewiesene Teil-Tags CP + laufend (in 39,973 enthalten) | Mio. USD · 2025-12-31 | 1,523 | note.cp + note.ltd_cur | 1,523 | 0 | korrekt | Teilbetraege erfasst; nicht zusaetzlich zu addieren |
| Finance-Leasing | Mio. USD · 2025-12-31 | 2,352 | note.fl_cur + note.fl_noncur | 2,352 | 0 | korrekt | Anhang Leasing |
| Operating-Leasing | Mio. USD · 2025-12-31 | 12,488 | note.ol_cur + note.ol_noncur | 12,170.3 (andere Periode) | — | berechtigte Einschraenkung | Seit 10-K FY2024 nur mit Dimension getaggt (I-5); Engine hat nur 12,170.3 zum 2023-12-31 und verknuepft ihn NICHT mit 2025 (ROIC-Leasing gesperrt, F-5/N-1) — Periode 2023-12-31 statt 2025-12-31 |
| Nettoschulden ohne Leasing (Rechenidentitaet) | Mio. USD · 2025-12-31 | 39,199 | note.debt_total - bs.cash | 39,199 | 0 | korrekt | Rechnung stimmt; das ist NICHT die vollstaendige Nettoverschuldung der DCF-Bruecke (siehe naechste Zeile) |
| Nettoschulden inkl. Finance-Leasing (Brueckendefinition) | Mio. USD · 2025-12-31 | 41,551 | note.debt_total + note.fl_cur + note.fl_noncur - bs.cash | fehlt | — | berechtigte Einschraenkung | Aus dem Anhang bestimmbar (41,551), aus den Tags nicht (LongTermDebt = LongTermDebtNoncurrent trotz LongTermDebtCurrent 725). DCF-Bruecke gesperrt, kein Eigenkapitalwert; operativer Wert nur nachrichtlich (I-4) — Engine: Nettoschulden nicht ermittelbar (fehlend: total_debt (Umfang unvollstaendig)) — ohne sie ist kein Eigenkapitalwert je Aktie bestimmbar; der operative Unternehmenswert 242.10/Aktie wird nur nachrichtlich ausgewiesen. Fehlende Daten gelten NICHT als 0. |
| Eigenkapital | Mio. USD · 2025-12-31 | -1,791 | bs.equity | -1,791 | 0 | korrekt | Bilanz (negativ) ⇒ RIM gesperrt (B-1) |
| Aktien Ø verwaessert (FY) | Mio. Aktien · 2025-01-01…2025-12-31 | 716.4 | fy.sh_dil | 716.4 | 0 | korrekt | GuV; Periode FY2025, gewichteter Durchschnitt |
| EPS verwaessert | USD · 2025-01-01…2025-12-31 | 11.95 | fy.eps | 11.95 | 0 | korrekt | GuV |
| DPS (erklaert) | USD · 2025-01-01…2025-12-31 | 7.17 | fy.dps | 7.17 | 0 | korrekt | GuV „Dividends declared per common share“ |
| Gezahlte Dividenden | Mio. USD · 2025-01-01…2025-12-31 | 5,115 | fy.div | 5,115 | 0 | korrekt | KFR |
| Jahresueberschuss | Mio. USD · 2025-01-01…2025-12-31 | 8,563 | fy.ni | 8,563 | 0 | korrekt | GuV |
| Zinsaufwand | Mio. USD · 2025-01-01…2025-12-31 | 1,582 | fy.interest | 1,582 | 0 | korrekt | GuV |
| Steueraufwand | Mio. USD · 2025-01-01…2025-12-31 | 2,334 | fy.tax | 2,334 | 0 | korrekt | GuV |
| Aktienbasierte Verguetung | Mio. USD · 2025-01-01…2025-12-31 | 165 | fy.sbc | 165 | 0 | korrekt | KFR |
| Aktienrueckkaeufe | Mio. USD · 2025-01-01…2025-12-31 | 2,056 | fy.buyback | 2,056 | 0 | korrekt | KFR |
| Interest Coverage | x | 7.8338 | fy.ebit / fy.interest | 7.8338 | 0 | korrekt | EBIT / Zinsaufwand |
| Net Share Issuance 5y | Anteil | -0.0449 | fy.sh_dil / R.shares_diluted.5 - 1 | -0.0449 | 0 | korrekt | 716.4 / 750.1 (FY2020, Historie im Quellenabgleich geprueft) − 1; keine Bestnote aus Skalierungsfehler (F-4) |
| D&A-Quote DCF (Median 10 J.) | Anteil | 0.079 | MEDIAN_DA_RATIO | 0.079 | 0 | korrekt | Median der verifizierten Jahreswerte (EBITDA − EBIT)/Umsatz 2016–2025 |
| Net Debt/EBITDA | x | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | Nettoschulden der Bruecke nicht belegbar (s. o.) ⇒ Kennzahl gesperrt statt 2.69 aus Teilbetrag (P-1) — Engine: insufficient_data — Daten unzureichend (0 von 1 Jahren, fehlt: belastbare Nettoschulden — Die gemeldeten Schuldenangaben widersprechen sich: die gemeldeten Schuldenangaben sind rechnerisch unvereinbar (Abweichung 725.0M) — Umfang des vorhan |
| DCF operativer Wert je Aktie (nachrichtlich) | USD | nicht bestimmbar | — | 242.1 | — | berechtigte Einschraenkung | Operativer Unternehmenswert ohne Schuldenabzug, nicht mit Kurs vergleichbar; kein freigegebener Eigenkapitalwert |


#### MCD TTM

Angefordert TTM, verwendet: **fy** (Rueckfall). Engine-Gruende: unvollstaendig: ebit (Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar); net_income (Fenster bis 2025-06-30 nicht bildbar: Quartalsreihe bricht vor FY2024-Q4 ab — kein verwertbares Quartal mit Ende 2024-09-30 — FY2024-Q3 (Ende 2024-09-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar); cfo (Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar); capex (Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar); total_debt (Bilanzstichtag zum 2026-06-30 fehlt: juengster Bilanzstichtag 2025-12-31 liegt 181 Tage vor dem Fensterende 2026-06-30 — kein passender Stichtag); long_term_debt (Bilanzstichtag zum 2026-06-30 fehlt: juengster Bilanzstichtag 2025-12-31 liegt 181 Tage vor dem Fensterende 2026-06-30 — kein passender Stichtag); shares_diluted (gewichtete Aktienzahl fuer das Quartal 2025-10-01…2025-12-31 fehlt); eps_diluted (TTM-Ergebnis oder gewichtete TTM-Aktienzahl fehlt)

| Posten | Einheit · Periode | Kontrollwert (Original) | Rechenweg | Engine | Abw. | Status | Erklaerung / Engine-Grund |
|---|---|---|---|---|---|---|---|
| Umsatz TTM | Mio. USD · 2025-07-01…2026-06-30 | 27,702 | fy.revenue + h126.revenue - h125.revenue | 27,703 | 1 | korrekt | FY2025 + 6M 2026 − 6M 2025 = 27,702; Engine summiert Quartale mit gemeldetem Q3/2025 7,078 (Differenz 9M − 6M = 7,077): 1 Mio. Rundung innerhalb der Darstellungsgenauigkeit |
| EBIT TTM | Mio. USD · 2025-07-01…2026-06-30 | 12,805 | fy.ebit + h126.ebit - h125.ebit | fehlt | — | berechtigte Einschraenkung | Engine verwirft Q2/2026: gemeldet 3,338 vs. 6,292 − 2,953 = 3,339; iXBRL deklariert decimals −5 (GuV) bei Darstellung in Mio. ⇒ Toleranz 0.6 Mio. < 1 Mio. Kein falscher Wert, Rueckfall ausgewiesen — Engine: Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar |
| D&A TTM | Mio. USD · 2025-07-01…2026-06-30 | 2,266 | fy.da_total + h126.da - h125.da | 2,266 | 0 | korrekt | Gesamt-D&A (DepreciationAndAmortization) |
| EBITDA TTM | Mio. USD · 2025-07-01…2026-06-30 | 15,071 | fy.ebit + h126.ebit - h125.ebit + fy.da_total + h126.da - h125.da | fehlt | — | berechtigte Einschraenkung | folgt aus EBIT TTM — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| CFO TTM | Mio. USD · 2025-07-01…2026-06-30 | 11,347 | fy.cfo + h126.cfo - h125.cfo | fehlt | — | berechtigte Einschraenkung | Q2/2026 direkt 2,807, aus 6M − Q1: 5,222 − 2,412 = 2,810 (3 Mio.; ueber jeder Rundungsgrenze): Q1 im 6M-Wert offenbar angepasst. Quartalssumme 11,344 vs. FY+YTD 11,347; Engine bildet keinen Wert — Engine: Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar |
| CapEx TTM | Mio. USD · 2025-07-01…2026-06-30 | 3,586 | fy.capex + h126.capex - h125.capex | fehlt | — | berechtigte Einschraenkung | Q2/2026 direkt 831 vs. 1,516 − 682 = 834 (3 Mio.) — Engine: Fenster bis 2026-06-30 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-30 — FY2026-Q2 (Ende 2026-06-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar |
| FCF TTM | Mio. USD · 2025-07-01…2026-06-30 | 7,761 | fy.cfo + h126.cfo - h125.cfo - (fy.capex + h126.capex - h125.capex) | fehlt | — | berechtigte Einschraenkung | folgt aus CFO/CapEx — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Jahresueberschuss TTM | Mio. USD · 2025-07-01…2026-06-30 | 8,787 | fy.ni + h126.ni - h125.ni | fehlt | — | berechtigte Einschraenkung | Vorjahresfenster (Q3/2024: 2,255 gemeldet vs. Differenz 1 Mio. bei decimals −5) scheitert; Grund im Tool irrefuehrend formuliert („kein Quartal endet“, D3-2) — Engine: Fenster bis 2025-06-30 nicht bildbar: Quartalsreihe bricht vor FY2024-Q4 ab — kein verwertbares Quartal mit Ende 2024-09-30 — FY2024-Q3 (Ende 2024-09-30) ist gemeldet, aber verworfen: Quartal steht im Widerspruch zur Differenz der Kumulierungen — als TTM-Bestandteil nicht belastbar |
| Gezahlte Dividenden TTM | Mio. USD · 2025-07-01…2026-06-30 | 5,225 | fy.div + h126.div - h125.div | fehlt | — | berechtigte Einschraenkung | keine TTM-Groesse der Engine — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| DPS erklaert TTM | USD · 2025-07-01…2026-06-30 | 7.35 | fy.dps + h126.dps - h125.dps | fehlt | — | berechtigte Einschraenkung | je Aktie erklaerte Betraege sind zeitlich additiv; keine TTM-Groesse der Engine — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Liquide Mittel 30.06.2026 | Mio. USD · 2026-06-30 | 822 | bs26.cash | 822 | 0 | korrekt | 10-Q Bilanz |
| Finanzschulden 30.06.2026 | Mio. USD · 2026-06-30 | 39,863 | bs26.ltd | 39,863 | 0 | korrekt | einzige Schuldenzeile; im 10-Q kein LongTermDebt-Tag ⇒ total_debt der Engine fehlt, Umfang (CP-Umklassifizierung) im 10-Q nicht beschrieben |
| total_debt TTM (Engine-Feld) | Mio. USD · 2026-06-30 | 39,863 | bs26.ltd | fehlt | — | berechtigte Einschraenkung | Importluecke: Tag LongTermDebt nur im 10-K; Stichtag 2026-06-30 fehlt (B-4) — Engine: Bilanzstichtag zum 2026-06-30 fehlt: juengster Bilanzstichtag 2025-12-31 liegt 181 Tage vor dem Fensterende 2026-06-30 — kein passender Stichtag |
| Finance-Leasing 30.06.2026 | Mio. USD · 2026-06-30 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | nicht bestimmbar: 10-Q zeigt nur Leasing gesamt (690 + 14,039), getaggt als OperatingLeaseLiability* — Engine: Bilanzstichtag zum 2026-06-30 fehlt: juengster Bilanzstichtag 2025-12-31 liegt 181 Tage vor dem Fensterende 2026-06-30 — kein passender Stichtag |
| Aktien Ø verwaessert TTM | Mio. Aktien · 2025-07-01…2026-06-30 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | nicht bestimmbar: Q4/2025 nicht gemeldet; FY- und YTD-Durchschnitte sind nicht subtrahierbar — Engine: gewichtete Aktienzahl fuer das Quartal 2025-10-01…2025-12-31 fehlt |
| EPS TTM | USD · 2025-07-01…2026-06-30 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | nicht exakt bestimmbar (11.95 + 6.10 − 5.74 = 12.31 ist nur Naeherung) — Engine: TTM-Ergebnis oder gewichtete TTM-Aktienzahl fehlt |
| Eigenkapital 30.06.2026 | Mio. USD · 2026-06-30 | -1,023 | bs26.equity | fehlt | — | berechtigte Einschraenkung | keine TTM-Groesse der Engine; RIM ohnehin gesperrt — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Umlaufvermoegen 30.06.2026 | Mio. USD · 2026-06-30 | 4,345 | bs26.ca | 4,345 | 0 | korrekt | 10-Q Bilanz |
| Kurzfristige Verbindlichkeiten 30.06.2026 | Mio. USD · 2026-06-30 | 4,018 | bs26.cl | 4,018 | 0 | korrekt | 10-Q Bilanz |


#### JNJ FY

| Posten | Einheit · Periode | Kontrollwert (Original) | Rechenweg | Engine | Abw. | Status | Erklaerung / Engine-Grund |
|---|---|---|---|---|---|---|---|
| Umsatz | Mio. USD · 2024-12-30…2025-12-28 | 94,193 | fy.revenue | 94,193 | 0 | korrekt | GuV Sales to customers |
| EBIT rekonstruiert (Vorsteuer + Zinsaufwand − Zinsertrag) | Mio. USD · 2024-12-30…2025-12-28 | 32,496 | fy.pretax + fy.int_exp - fy.int_inc | fehlt | — | berechtigte Einschraenkung | Keine Operating-Income-Zeile; Zinsaufwand als InterestExpenseNonoperating getaggt (nicht in der Tag-Liste, I-1). Enthaelt den Sonderertrag „Other (income) expense“ 7,209 — Definitionsfrage, keine automatische Bereinigung — Engine: ebit leer (kein Wert importiert) |
| EBIT ohne „Other (income) expense“ (nur Information) | Mio. USD · 2024-12-30…2025-12-28 | 25,287 | fy.pretax + fy.int_exp - fy.int_inc - fy.other | fehlt | — | berechtigte Einschraenkung | Variante ohne saemtliche sonstigen Ertraege/Aufwendungen (enthaelt auch wiederkehrende Posten); erfordert fachliche Entscheidung — Engine: ebit leer (kein Wert importiert) |
| D&A | Mio. USD · 2024-12-30…2025-12-28 | 7,503 | fy.da | fehlt | — | berechtigte Einschraenkung | 7,503 belegt; ohne EBIT kein EBITDA, D&A-Quote nicht messbar (DCF ohnehin gesperrt) — kein Engine-Feld |
| Operativer Cashflow | Mio. USD · 2024-12-30…2025-12-28 | 24,530 | fy.cfo | 24,530 | 0 | korrekt | KFR |
| CapEx | Mio. USD · 2024-12-30…2025-12-28 | 4,832 | fy.capex | 4,832 | 0 | korrekt | KFR |
| FCF | Mio. USD · 2024-12-30…2025-12-28 | 19,698 | fy.cfo - fy.capex | 19,698 | 0 | korrekt |  |
| Liquide Mittel | Mio. USD · 2025-12-28 | 19,709 | bs.cash | 19,709 | 0 | korrekt | ohne marktgaengige Wertpapiere 393 (M-2) |
| Finanzschulden (vollstaendig, ohne Leasing) | Mio. USD · 2025-12-28 | 47,933 | bs.stb + bs.ltd | 41,438 | -6,495 | berechtigte Einschraenkung | Engine 41,438 (LongTermDebt inkl. laufendem Anteil) = Teilbetrag; es fehlen CP 6.5 Mrd. und lokale Kredite (in 8,495). Engine kennzeichnet Umfang als unbestimmt ⇒ keine Bruecke |
| Nettoschulden (ohne Finance-Leasing) | Mio. USD · 2025-12-28 | 28,224 | bs.stb + bs.ltd - bs.cash | 21,729 | -6,495 | berechtigte Einschraenkung | Engine-Feld 21,729 = 41,438 − 19,709 rechnerisch richtig, fachlich Teilbetrag; Resolver lehnt ab. Vollstaendig ≥ 28,224 (Finance-Leasing ohne Betrag) |
| Nettoschulden der DCF-Bruecke | Mio. USD · 2025-12-28 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | Finance-Leasing „not significant“ ohne Betrag ⇒ kein belegter Nullwert (B-2). Der DCF wird schon wegen ebit[0] nicht berechnet; unabhaengig davon lehnt der Resolver das Feld net_debt 21,729 als Teilbetrag ab (Engine-Kennzeichen „Umfang unvollstaendig“, siehe Quellenabgleich) — die Bruecke bliebe auch mit EBIT gesperrt — Engine: DCF ausgeschlossen — abweichende Cashflow-Definition: dieser Pfad rechnet mit FCF = CFO − CapEx (nachfinanziert, enthält gezahlte Zinsen) und ist damit nicht definitionskonsistent zum gemeinsamen Bewertungskern (FCFF = EBIT × (1 − t) + D&A − CapEx − ΔWC(operativ), mit WACC diskontiert, Gordon-Terminalwert, abzüglich Nettoschulden (Stichtag) je Aktie). Der Kern ist hier nicht anwendbar, weil ein Umsatzpfad fehlt (fehlend: ebit[0]). Ein DCF auf abweichender Cashflow-Definition geht deshalb weder in die Bewertung noch in die Synthese ein — er würde dort mit dem FCFF-Wert vermischt. |
| Eigenkapital | Mio. USD · 2025-12-28 | 81,544 | bs.equity | 81,544 | 0 | korrekt | Engine: Aktiva − Passiva (Tag nur StockholdersEquityIncludingPortion…, I-2) |
| Aktien Ø verwaessert | Mio. Aktien · 2024-12-30…2025-12-28 | 2,429.4 | fy.sh_dil | 2,429.4 | 0 | korrekt | GuV |
| EPS verwaessert | USD · 2024-12-30…2025-12-28 | 11.03 | fy.eps | 11.03 | 0 | korrekt |  |
| DPS (gezahlt) | USD · 2024-12-30…2025-12-28 | 5.14 | fy.dps | 5.14 | 0 | korrekt |  |
| Gezahlte Dividenden | Mio. USD · 2024-12-30…2025-12-28 | 12,381 | fy.div | fehlt | — | berechtigte Einschraenkung | als PaymentsOfOrdinaryDividends getaggt (I-3); DDM nutzt DPS, nicht die Summe — Engine: dividends_paid leer (kein Wert importiert) |
| Jahresueberschuss | Mio. USD · 2024-12-30…2025-12-28 | 26,804 | fy.ni | 26,804 | 0 | korrekt | enthaelt Sonderertrag (M-3); RIM rechnet damit |
| Zinsaufwand | Mio. USD · 2024-12-30…2025-12-28 | 971 | fy.int_exp | fehlt | — | berechtigte Einschraenkung | I-1 (Tag InterestExpenseNonoperating nicht erschlossen) ⇒ Interest Coverage nicht verfuegbar — Engine: interest_expense leer (kein Wert importiert) |
| Steueraufwand | Mio. USD · 2024-12-30…2025-12-28 | 5,777 | fy.tax | 5,777 | 0 | korrekt |  |
| SBC | Mio. USD · 2024-12-30…2025-12-28 | 1,354 | fy.sbc | 1,354 | 0 | korrekt |  |
| Rueckkaeufe | Mio. USD · 2024-12-30…2025-12-28 | 5,953 | fy.buyback | 5,953 | 0 | korrekt |  |
| Bruttoergebnis | Mio. USD · 2024-12-30…2025-12-28 | 63,937 | fy.gross | 63,937 | 0 | korrekt |  |
| Net Share Issuance 5y | Anteil | -0.0904 | fy.sh_dil / R.shares_diluted.5 - 1 | -0.0904 | -0 | korrekt | 2,429.4 / FY2020 (Historie geprueft) − 1 |
| Net Debt/EBITDA | x | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | kein EBITDA (I-1) und Nettoschulden nur Teilbetrag (P-1) — Engine: insufficient_data — Daten unzureichend (0 von 1 Jahren, fehlt: ebitda) |


#### JNJ TTM

Angefordert TTM, verwendet: **fy** (Rueckfall). Engine-Gruende: unvollstaendig: ebit (Fenster bis 2026-06-28 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-28); total_debt (Bilanzstichtag zum 2026-06-28 fehlt: juengster Bilanzstichtag 2025-12-28 liegt 182 Tage vor dem Fensterende 2026-06-28 — kein passender Stichtag); long_term_debt (Bilanzstichtag zum 2026-06-28 fehlt: juengster Bilanzstichtag 2025-12-28 liegt 182 Tage vor dem Fensterende 2026-06-28 — kein passender Stichtag); shares_diluted (gewichtete Aktienzahl fuer das Quartal 2025-09-29…2025-12-28 fehlt); eps_diluted (TTM-Ergebnis oder gewichtete TTM-Aktienzahl fehlt)

| Posten | Einheit · Periode | Kontrollwert (Original) | Rechenweg | Engine | Abw. | Status | Erklaerung / Engine-Grund |
|---|---|---|---|---|---|---|---|
| Umsatz TTM | Mio. USD · 2025-06-30…2026-06-28 | 97,929 | fy.revenue + h126.revenue - h125.revenue | 97,929 | 0 | korrekt | 52 Wochen 2025-06-30…2026-06-28 (die 53. Woche von FY2026 liegt in Q4/2026, ausserhalb) |
| EBIT TTM rekonstruiert | Mio. USD · 2025-06-30…2026-06-28 | 25,296 | fy.pretax + h126.pretax - h125.pretax + fy.int_exp + h126.int_exp - h125.int_exp - (fy.int_inc + h126.int_inc - h125.int_inc) | fehlt | — | berechtigte Einschraenkung | 25,296; „Other (income) expense“ TTM = −7,209 + 625 + 7,214 = 630 Aufwand (Talk-Aufloesung Q1/2025 faellt aus dem Fenster). Engine: kein OperatingIncomeLoss (I-1) — Engine: Fenster bis 2026-06-28 nicht bildbar: kein verwertbares Quartal mit Ende 2026-06-28 |
| D&A TTM | Mio. USD · 2025-06-30…2026-06-28 | 7,751 | fy.da + h126.da - h125.da | 7,751 | 0 | korrekt |  |
| CFO TTM | Mio. USD · 2025-06-30…2026-06-28 | 27,608 | fy.cfo + h126.cfo - h125.cfo | 27,608 | 0 | korrekt |  |
| CapEx TTM | Mio. USD · 2025-06-30…2026-06-28 | 5,364 | fy.capex + h126.capex - h125.capex | 5,364 | 0 | korrekt |  |
| FCF TTM | Mio. USD · 2025-06-30…2026-06-28 | 22,244 | fy.cfo + h126.cfo - h125.cfo - (fy.capex + h126.capex - h125.capex) | fehlt | — | berechtigte Einschraenkung | Bestandteile in der Engine vorhanden, TTM-Sicht wegen fehlender Pflichtfelder nicht gebildet — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Jahresueberschuss TTM | Mio. USD · 2025-06-30…2026-06-28 | 21,037 | fy.ni + h126.ni - h125.ni | 21,037 | 0 | korrekt |  |
| Gezahlte Dividenden TTM | Mio. USD · 2025-06-30…2026-06-28 | 12,621 | fy.div + h126.div - h125.div | fehlt | — | berechtigte Einschraenkung |  — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| DPS gezahlt TTM | USD · 2025-06-30…2026-06-28 | 5.24 | fy.dps + h126.dps - h125.dps | fehlt | — | berechtigte Einschraenkung |  — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Liquide Mittel 28.06.2026 | Mio. USD · 2026-06-28 | 20,422 | bs26.cash | 20,422 | 0 | korrekt |  |
| Loans and notes payable | Mio. USD · 2026-06-28 | 11,692 | bs26.stb | 11,692 | 0 | korrekt | enthaelt 9.9 Mrd. CP und laufenden Anteil |
| Long-term debt | Mio. USD · 2026-06-28 | 37,344 | bs26.ltd | 37,344 | 0 | korrekt |  |
| Finanzschulden TTM (vollstaendig ohne Leasing) | Mio. USD · 2026-06-28 | 49,036 | bs26.stb + bs26.ltd | fehlt | — | berechtigte Einschraenkung | 49,036 aus Bilanz bestimmbar (Unternehmensangabe ~49.0 Mrd.); Engine: LongTermDebt-Tag im 10-Q nicht vorhanden (I-4), Finance-Leasing ohne Betrag — Engine: Bilanzstichtag zum 2026-06-28 fehlt: juengster Bilanzstichtag 2025-12-28 liegt 182 Tage vor dem Fensterende 2026-06-28 — kein passender Stichtag |
| Nettoschulden TTM (ohne Leasing, ohne Wertpapiere) | Mio. USD · 2026-06-28 | 28,614 | bs26.stb + bs26.ltd - bs26.cash | fehlt | — | berechtigte Einschraenkung | 28,614; Unternehmensangabe 28.2 Mrd. rechnet marktgaengige Wertpapiere (336) mit ein — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |
| Aktien Ø verwaessert TTM | Mio. Aktien · 2025-06-30…2026-06-28 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | nicht bestimmbar: Q4/2025 nicht gemeldet (B-3) — Engine: gewichtete Aktienzahl fuer das Quartal 2025-09-29…2025-12-28 fehlt |
| EPS TTM | USD · 2025-06-30…2026-06-28 | nicht bestimmbar | — | fehlt | — | berechtigte Einschraenkung | nicht exakt bestimmbar (11.03 + 4.41 − 6.82 = 8.62 nur Naeherung) — Engine: TTM-Ergebnis oder gewichtete TTM-Aktienzahl fehlt |
| Eigenkapital 28.06.2026 | Mio. USD · 2026-06-28 | 84,971 | bs26.equity | fehlt | — | berechtigte Einschraenkung | keine TTM-Groesse — keine TTM-Groesse der Engine (TTM-Sicht nicht gebildet: unvollstaendig) |


### 13.4 · TTM: unabhängige Kontrollrechnung und Eingrenzung der Blocker

Rechenweg der Kontrolle: TTM-Strom = FY2025 (10-K) + 6M 2026 − 6M 2025 (beide
aus dem 10-Q Q2/2026, derselbe Bericht, dieselbe Abgrenzung); Stichtagswerte =
Bilanz 10-Q zum Fensterende (nicht summiert); DPS (erklärt bzw. gezahlt) ist je
Aktie zeitlich additiv; gewichtete Aktienzahlen und EPS werden **nicht**
aus Differenzen von Durchschnitten gebildet. Die Engine summiert dagegen vier
Quartale (gemeldet bzw. aus Kumulierungen abgeleitet). Wo beide Wege einen Wert
liefern, stimmen sie überein (MCD-Umsatz: 1 Mio. Rundung, siehe Tabelle).

**MCD — Zielwerte bestimmbar, Engine bildet sie nicht:**

| Größe | Ursache in der Engine | Art |
|---|---|---|
| EBIT | Q2/2026 gemeldet 3,338 vs. 6M − Q1 = 6,292 − 2,953 = 3,339. Die iXBRL-GuV deklariert `decimals=-5`, dieselben Werte stehen in der Segmenttabelle mit `-6`; die Engine nimmt die genauere Angabe (XBRL-Regel für konsistente Duplikate) ⇒ Toleranz 0.6 Mio. < 1 Mio. | Importgrenze (Methodenfrage Präzision, D2 bewusst konservativ) |
| Jahresüberschuss | Vorjahresfenster: Q3/2024 gemeldet 2,255 vs. 9M − 6M = 6,207 − 3,951 = 2,256 (gleiche Präzisionsfrage) | Importgrenze; Grund seit V1.0.74 korrekt benannt (D3-2) |
| CFO, CapEx | Q2/2026 direkt gemeldet 2,807 / 831, aus 6M − Q1 2,810 / 834: **3 Mio.**, jenseits jeder Rundung; der Q1-Anteil im 6M-Wert weicht vom Q1-Bericht ab | Originaldaten widersprüchlich (Quartal nicht belastbar) |
| `total_debt` 30.06.2026 | Im 10-Q nur `LongTermDebtNoncurrent` 39,863 (erfasst), kein `LongTermDebt`; Umklassifizierung von CP im 10-Q nicht beschrieben | Importlücke + Umfang aus 10-Q nicht belegbar (B-4) |
| Finance-Leasing 30.06.2026 | 10-Q zeigt nur Leasing gesamt (690 + 14,039), getaggt als `OperatingLeaseLiability*` | Originaldaten fehlen |
| Aktien Ø verwässert, EPS | Q4/2025 wird nicht gemeldet | Originaldaten fehlen (nicht bestimmbar) |

**JNJ — Engine bildet Umsatz, Jahresüberschuss, CFO, CapEx, D&A, Liquidität
und Schuldenzeilen exakt wie die Kontrolle** (97,929 · 21,037 · 27,608 ·
5,364 · 7,751 · 20,422 · 11,692 · 37,344). Blocker:

| Größe | Ursache | Art |
|---|---|---|
| EBIT | keine Operating-Income-Zeile; rekonstruiert 25,296 (Vorsteuer 25,196 + Zinsaufwand 1,012 − Zinsertrag 912), braucht `InterestExpenseNonoperating` und eine Definitionsentscheidung (§13.7) | Importlücke I-1 + fachliche Entscheidung |
| `total_debt` 28.06.2026 | 49,036 = 11,692 + 37,344 aus der Bilanz bestimmbar; im 10-Q kein `LongTermDebt`-Tag; Finance-Leasing ohne Betrag | Importlücke I-4 + B-2 |
| Aktien Ø verwässert, EPS | Q4/2025 wird nicht gemeldet | Originaldaten fehlen (B-3) |

**Ergebnis TTM:** Der Rückfall auf FY ist in beiden Fällen korrekt ausgewiesen
(angefordert TTM, verwendet FY, Gründe sichtbar), es wird kein TTM-Wert als
FY-Wert und kein FY-Wert als TTM-Wert ausgegeben, und kein Modell rechnet mit
gemischten Perioden. Selbst mit einer gelockerten Präzisionsregel bliebe TTM
wegen der Q4-Aktienzahl und des Schuldenstichtags unvollständig. **Eine
automatische TTM-Bewertung ist für MCD und JNJ nicht verfügbar**; das ist eine
begründete Einschränkung, kein offener Fehler.

### 13.5 · Historie: Quellenabgleich aller verwendeten Jahreswerte

`reconcile-sources.mjs` prüft jeden erfassten Wert (MCD 343, JNJ 293, bis zu
zehn Geschäftsjahre) gegen Company Facts und das zitierte Original:

| | korrekt | berechtigte Einschränkung | offen | Abweichung |
|---|---|---|---|---|
| MCD | 307 | 2 (Nettoschulden 2025/2024: Rechnung ✓, Teilbetrag ohne Finance-Leasing, Engine kennzeichnet unvollständig) | 34 | 0 |
| JNJ | 269 | 6 (`total_debt`/`long_term_debt`/`net_debt` 2025/2024: Teilbeträge, gekennzeichnet) | 18 | 0 |

„Offen“ sind ausschließlich historische Schuldenwerte (`total_debt`,
`long_term_debt`, `net_debt`) ohne Umfangsbeleg im Anhang — MCD 2016–2023 (24),
JNJ FY2020–FY2023 sowie FY2009/FY2010 aus einer nicht lückenlosen
Stichtagsreihe (18) — und bei MCD zehn Einträge ohne Toolwert (Tangible Book
Value, wegen negativen Eigenkapitals leer). Rechnung (bei gemeldeten Werten
auch das Original) stimmt überall; offen ist nur der fachliche Umfang. Keine davon speist ein
freigegebenes Ergebnis: Kapitalkosten nutzen `total_debt[0..1]` (belegt), ROIC
und ROIC-Trend sind für MCD gesperrt und für JNJ mangels EBIT nicht berechnet.
Diese Werte sind als **Abdeckungslücke** ausgewiesen, nicht als geprüft.

Beobachtung: Stichtagsreihen werden bewusst nicht auf lückenlose Jahre gekürzt
(JNJ `total_debt`: 2025 … 2020, dann 2010/2009; MCD `debt_long_term_current`
mit Sprüngen). Kein Verbraucher liest diese Reihen positionsweise über [1]
hinaus; ROIC paart seit D2 periodengleich, der ROIC-Trend seit D3-6 ebenso.

### 13.6 · Modelle: rechnet oder gesperrt (Engine = frisch gerenderte Oberfläche, 55/55 je Unternehmen)

| | MCD (retail) | JNJ (standard_nonfin) |
|---|---|---|
| DCF | **gesperrt**: Nettoschulden der Brücke nicht belegbar (Tags widersprüchlich; laut Anhang wären es 41,551). Operativer Wert 242.10/Aktie nur nachrichtlich, kein Eigenkapitalwert. Eingaben geprüft: D&A-Quote 7.90 % = Median der zehn verifizierten Jahre | **ausgeschlossen**: `ebit[0]` fehlt (I-1); unabhängig davon wäre die Brücke gesperrt (Teilbetrag, Finance-Leasing ohne Betrag) |
| RIM | gesperrt: BVPS ≤ 0 (Eigenkapital −1,791), berechtigt (B-1) | 88.36; Buchwert 81,544 ✓, Aktien 2,429.4 ✓; Jahresüberschuss enthält den Sonderertrag (M-3) |
| DDM | 108.90 **diagnostisch** (nicht gewichtet); DPS 7.17 ✓, CAGR 5 J. 7.30 % (auf 5 % gekappt), DPS-Historie geprüft | 78.07 (Anker); DPS 5.14 ✓, CAGR 5.25 % (gekappt 5 %) |
| Synthese | keine Intrinsic-Bewertung (`no_models_applicable`); Übersicht nennt jetzt diesen Grund | Basis 81.81 (DDM/RIM, keine Nettoschulden nötig); Einordnung gesperrt: kein Kurs |
| Markt-Vergleich | keine eigenen Multiples im Master-JSON ⇒ keine EV-Kennzahl, keine Umgehung der Brücke | ebenso |
| Reverse DCF | nicht berechnet (kein Kurs) | nicht berechnet (Kern-Inputs fehlen) |
| Net Debt/EBITDA | gesperrt (P-1), Grund benannt | gesperrt (kein EBITDA, Teilbetrag) |
| Interest Coverage | 7.83 = 12,393 / 1,582 ✓ | nicht verfügbar (I-1) |
| Net Share Issuance 5y | −4.5 % (716.4 / 750.1), Score 8 ✓ | −9.0 %, Score 10 ✓ |
| ROIC − WACC / ROIC-Trend | beide nicht bewertbar (Leasing 2025 fehlt, retail); QCE 8.55 ohne ROIC-Anteile | nicht berechnet (EBIT fehlt) |

Operativer Unternehmenswert und Eigenkapitalwert sind getrennt: Der MCD-DCF
liefert nur den operativen Wert (nachrichtlich, ausdrücklich nicht mit dem Kurs
vergleichbar); kein anderer Pfad (Markt-Vergleich, Net Debt/EBITDA,
MoS-Zuschlag, Kern des Reverse DCF) rechnet mit einer unbelegten Nettoschuldenbrücke.
**Berichtigt im Review zu PR #2 (§13.13):** Diese Aussage war zu weit gefasst.
Das Growth-Modul las bis V1.0.75 `net_debt[0]` bzw. 0 (seit V1.0.76 behoben).
Das Reverse-DCF-Diagnosepaar auf Reported-/Owner-FCF-Basis tut das weiterhin
(nicht gewichtet, offen).

### 13.7 · JNJ: getrennte Fragen und berechtigte Grenzen

1. **Zinsaufwand-Tag (I-1).** Belegt: 971 als `InterestExpenseNonoperating`
   (GuV „Interest expense, net of portion capitalized“), Zinsertrag 1,056 als
   `InvestmentIncomeInterest`. Nicht erschlossen ⇒ kein EBIT, kein Interest
   Coverage. Eine reine Tag-Ergänzung ist technisch klein.
2. **Definition eines rekonstruierten EBIT.** Vorsteuer + Zinsaufwand −
   Zinsertrag = 32,496 (FY2025) bzw. 25,296 (TTM). Darin steckt „Other (income)
   expense, net“: FY2025 **Ertrag 7,209** (Lagebericht: Auflösung der
   Talk-Rückstellung rund 7.0 Mrd., Auris-Vergleich 0.8 Mrd. Aufwand), TTM
   dagegen **Aufwand 630** (die Auflösung aus Q1/2025 fällt aus dem Fenster).
   Ohne diesen Posten: 25,287 (FY2025) — dann fehlen aber auch wiederkehrende
   Posten (Lizenzerträge, Pensionskomponenten). Welche Definition gilt, ist eine
   **Modellentscheidung**, keine Datenfrage.
3. **Sondererträge.** Keine automatische Bereinigung (unverändert). Betroffen
   sind RIM (ROE-Spread 22.9 % mit dem Sonderertrag) und die EPS-Historie (M-3).
4. **Schulden/Finance-Leasing.** Finanzschulden 47,933 (FY) bzw. 49,036 (TTM)
   sind aus der Bilanz belegt; die Engine hat nur den Teilbetrag 41,438 und
   kennzeichnet ihn korrekt. Finance-Leasing „not significant“ ohne Betrag ist
   kein belegter Nullwert (B-2) — die Brücke bliebe auch mit EBIT gesperrt.

**Bis zu einer Entscheidung nicht belastbar freigebbar:** JNJ-DCF, Reverse DCF,
EBITDA-basierte Kennzahlen, Interest Coverage. Freigegeben und korrekt belegt
sind DDM und RIM (mit der offengelegten Vereinfachung M-3).

### 13.8 · Neue Befunde und Korrekturen (V1.0.74)

| # | Prio | Befund (am Stand `04d8c83`) | Korrektur | Regressionstest |
|---|---|---|---|---|
| D3-1 | mittel | Übersicht ohne Kurs: „Bewertung blockiert: **Hard Stop** aktiv“ und „kein belastbarer Eigenkapitalwert“, obwohl kein Hard Stop aktiv ist (JNJ: Grund „Kein Kurs verfügbar“; MCD: keine anwendbaren Modelle) | `_ovMiniWhy`/`ovKeyStatements` nennen den Sperrgrund der Synthese; „Hard Stop“ nur bei aktivem Hard Stop | `d3-findings.test.mjs` (3), `check-panels` (3); Reallauf zeigt jetzt „Kein Kurs verfügbar …“ bzw. „Keine Bewertungsmodelle aktiv …“ |
| D3-2 | niedrig | TTM-Grund „kein Quartal endet am …“, obwohl das Quartal gemeldet und wegen Widerspruchs verworfen ist | Grund nennt das verworfene Quartal und den Widerspruch | `d3-findings` (3) |
| D3-3 | niedrig (Werkzeug) | `checkPanels` prüfte die Übersichtsbegründung nicht | neue Prüfung (s. §13.2) | `check-panels` (3) |
| D3-4 | mittel | **F-4 unvollständig:** `shares_basic` bei MCD gemischt skaliert (713.4 … 746.3, dann 744,600,000 … 854,400,000 in derselben Mio.-Reihe); der Fallback „keine verwässerten Aktien ⇒ unverwässerte“ hätte F-4 wieder erzeugt | dieselbe Einzelprüfung je Periode wie `shares_diluted` (`_checkShareHistory`, NI/EPS nur für die Größenordnung, Originalangaben, sonst Reihe beenden) | `d3-findings` (3); Reallauf: 713.4 … 854.4 |
| D3-5 | niedrig | Bei **widersprüchlichen** Schuldenangaben behauptete der Grund „Der vorliegende Wert ist ein Teilbetrag“ (MCD: 39,973 ist laut Anhang vollständig) | Wortlaut: Umfang nicht belegt, Teilbetrag nicht ausgeschlossen; Sperre unverändert; JNJ (nachweislich Teilbetrag) unverändert | `d3-findings` (2) |
| D3-6 | mittel | QCE-Komponente ROIC-Trend: unbereinigter ROIC, positionsweise gepaart, 7 Punkte für MCD — obwohl ROIC − WACC nach der N-1-Regel „nicht bewertbar“ ist | gleiche Regel wie ROIC − WACC (Leasing erforderlich, aber nicht erfüllbar ⇒ kein Score); Paarung nur bei gleichem Periodenende (Altdaten unverändert) | `d3-findings` (3); Reallauf: MCD ROIC-Trend n/a, QCE 8.55 |
| D3-7 | hoch (Werkzeug) | `reconcile-sources.mjs` akzeptierte EBITDA 12,850 = EBIT + Teilposten 457 („2/2 stimmen“, Exit 0) und prüfte nur drei Jahre | Neufassung (§13.2) | `reconcile-sources.test.mjs` (6) |

Gegenlauf mit der Produktdatei von `04d8c83`: 9 Fehlerfalltests scheitern am
falschen Ergebnis, 5 Erhaltungstests bestehen vorher und nachher. Keine Sperre
gelockert, keine unternehmensspezifischen Werte im Produkt.

**Offene Beobachtungen (kein Fehler im geprüften Ergebnis, Folgeauftrag möglich):**

* **O-1** Wachstumsprofil (Annahmen-Hinweis): „ROIC akt./ROIC-Trend (2J)“ als
  vereinfachter, unbereinigter ROIC mit fehlenden Schulden = 0 — nur Anzeige,
  kein Score, keine Modellwirkung. **Geschlossen in V1.0.77 (§13.14).**
* **O-2** Präzisionsregel bei MCD (`decimals=-5` in der GuV, `-6` für dieselben
  Werte an anderer Stelle): konservativ, per XBRL-Duplikatregel begründet;
  entscheidet nicht über die TTM-Verfügbarkeit (§13.4).
* **O-3** MCD-10-Q taggt die gesamten Leasingverbindlichkeiten (inkl. Finance)
  als `OperatingLeaseLiability*`; das Produkt nutzt diese 10-Q-Werte nicht (FY nur
  aus 10-K) — bei einer künftigen Nutzung wäre Doppelzählung möglich.
* **O-4** JNJ taggt „Retained earnings and Additional-paid-in-capital“ als
  `RetainedEarningsAccumulatedDeficit` (168,978); betrifft nur diagnostische
  Kennzahlen (Altman). **Geschlossen in V1.0.77 (§13.14);** Altman ist nicht
  rein diagnostisch, sondern wirkt über das Qualitätsurteil auf die Basis-MoS.

### 13.9 · Status der fünf Produktbefunde und Net Debt/EBITDA

| # | Status im echten Import (V1.0.74) |
|---|---|
| F-1 | **behoben, bestätigt**: EBITDA = EBIT + Gesamt-D&A in allen zehn MCD-Jahren (2025–2023 per Anhangbeleg, 2022–2016 größter D&A-Posten des Originals); D&A-Quote 7.90 % aus verifizierter Historie |
| F-2 | **behoben, bestätigt**: JNJ zehn Geschäftsjahre FY2016–FY2025 inkl. FY2022 (Ende 2023-01-01), jeder Wert gegen das Original geprüft |
| F-3 | **behoben, bestätigt** (Rundung nach belegter Präzision: MCD Q3/2025-Umsatz akzeptiert, TTM-Umsatz 27,703 ≙ Kontrolle 27,702); TTM bleibt aus anderen, belegten Gründen unvollständig (§13.4) |
| F-4 | **behoben** für `shares_diluted` (bestätigt: 716.4 … 861.2, NSI −4.5 %, Score 8); **Restlücke `shares_basic` in D3 behoben** (D3-4) |
| F-5 | **behoben, bestätigt**: MCD ROIC − WACC nicht bewertbar (Leasing 2025 nicht periodengleich); Trend seit D3-6 ebenso |
| P-1 | **behoben, bestätigt**: Net Debt/EBITDA MCD und JNJ gesperrt mit Grund; Wortlaut MCD seit D3-5 zutreffend |

### 13.10 · Ausgeführte Prüfungen (fertiger Stand, Produktdatei SHA-256 `997ad2dc…`)

| Befehl | Ergebnis | Exit |
|---|---|---|
| `npm test` | 1700 Rechenprüfungen; 283/283 Node-Tests | 0 |
| `npm run test` | identisch (1700; 283/283) | 0 |
| `npm run test:audit-tool` (D1-Werkzeugtests + Abgleich) | 38/38 (25 checkPanels, 6 reconcile, 7 Browser) | 0 |
| `npm run test:browser` | 187/187 | 0 |
| `replay-import.mjs --selftest` | 58/58 | 0 |
| `repro-findings.mjs` | 0 von 6 bestehen | 0 |
| `replay-import.mjs MCD` / `JNJ` (FY → TTM → FY, Originaldaten) | 55/55 bzw. 55/55; Fundamentaldaten unverändert; einzige abgewiesene Anfrage Google Fonts | 0 / 0 |
| `reconcile-sources.mjs MCD JNJ` | 0 Abweichungen (MCD 307/2/34, JNJ 269/6/18) | 0 |
| `control-calcs.mjs MCD JNJ` | Belege 72/72 und 65/65 im Original; Kontrollposten 48/48 und 41/41; Fallprüfungen 7/7 je Unternehmen | 0 |

### 13.11 · Abschluss Chat D

* D1 und D2 sind verifiziert; je eine Restlücke (Erfassungstiefe, `shares_basic`)
  wurde gefunden und behoben.
* MCD FY, MCD TTM, JNJ FY und JNJ TTM sind gegen die Originalberichte untersucht;
  jede wesentliche Abweichung ist erklärt und sicher behandelt.
* Es verbleibt **kein wesentlicher ungeklärter Fehler**. Verbleibende Grenzen
  sind begründet und sichtbar: keine automatische TTM-Bewertung (MCD, JNJ);
  MCD-DCF ohne Eigenkapitalwert (Brücke aus Tags nicht belegbar); JNJ-DCF bis zur
  Entscheidung über I-1/EBIT-Definition/Finance-Leasing gesperrt.
* **Chat D ist abgeschlossen.** Folgeaufträge (optional, fachliche
  Entscheidung): I-1 samt EBIT-Definition für Filer ohne Operating-Income-Zeile;
  Präzisionsregel O-2; Umfangsbelege aus Anhängen (I-4/I-5) für die Brücke.

### 13.12 · D3-Nachbesserung: ungültige Perioden im ROIC-Trend (V1.0.75)

**Ursache.** D3-6 paarte im ROIC-Trend (`_qceRoicTrend`) nur bei gleicher
Periodenangabe — geprüft wurde **Stringgleichheit**. Identische ungültige
Angaben galten damit als passende Perioden. Reproduziert am Referenzstand
`367848a`: EBIT `[130, 125, 120, 100, 100, 100, 100, 100]`, Buchwert 8 × 500,
Schulden 8 × 600, Liquidität 8 × 100, Steuer 25 %, WACC 8 %, alle vier Reihen
`source_type: "reported"` mit achtmal `"n/a"` als `periods` ⇒ über
`runQualityEngine()`: ROIC − WACC `insufficient_data`, ROIC-Trend
`available: true`, `delta_pp 1.875`, Score 7. Der Datensatz passiert den
Import über die Oberfläche („Import OK“, Browser-Abnahme Abschnitt 10).

**Korrektur (eng).** Periodenmodus gilt, sobald eine der vier Reihen ein
`periods`-Feld führt (auch null, leer oder unbrauchbar). Ein Jahr zählt dann nur,
wenn alle vier Angaben gültige Kalenderdaten `YYYY-MM-DD` sind — geprüft mit dem
vorhandenen strikten `parseIsoDate` (unverändert; z. B. `2025-02-30`,
`2025-13-31`, `2025-12-31T00:00:00Z`, `2025/12/31` ungültig) — und dasselbe
Datum nennen. Ungültige oder fehlende Angaben ergeben keine Beobachtung; reichen
die bestehenden Mindestbeobachtungen (je zwei in den Fenstern 0–2 und 3–5) nicht,
bekommt die QCE-Komponente keinen Score. Unverändert: Positionsbezug nur bei
vollständig periodenfreien Altdaten, Januar-Geschäftsjahresenden, Leasingsperre
(D3-6), Formel, Zeitfenster, Mindestbeobachtungen, Gewicht und Scoregrenzen.
Keine anderen ROIC-Verbraucher, Modelle oder Importvalidierung geändert.

**Nachweise.**

| Test | `367848a` | V1.0.75 |
|---|---|---|
| `d3-findings`: „n/a“-Perioden (inkl. `runQualityEngine`) | rot | grün |
| `d3-findings`: unmögliche Kalenderdaten, zu wenige gültige jüngste Jahre, Zeitstempel/Schrägstriche | rot | grün |
| `d3-findings`: leere Arrays, `periods: null`, leere Strings, eine Reihe ohne `periods`, kürzere Periodenreihe | rot | grün |
| `d3-findings`: gültige Perioden inkl. Januar-Enden (1.875 pp, Score 7) — Erhalt | grün | grün |
| `d3-findings`: periodenfreie Altdaten — Erhalt | grün | grün |
| `d3-findings`: Leasingsperre — Erhalt | grün | grün |
| Browser-Abnahme §10 (Import über die Oberfläche, Reiter „Qualität“ gerendert): „n/a“ und `YYYY-02-30` ⇒ „ROIC-Trend (3y vs 3y) n/a“, kein Score | 4 FAIL (192/196, Exit 1) | 196/196 |
| Browser-Abnahme §10 Gegenprobe gültige Perioden „+1.9pp · 7/10“ | PASS | PASS |

**Ausgeführt auf dem fertigen Stand** (Produktdatei SHA-256 `80921c0d…`):
`npm test` Exit 0 (1700 Rechenprüfungen; 289/289 Node-Tests) ·
`npm run test:browser` Exit 0 (196/196) · `npm run test:audit-tool` Exit 0
(38/38). Kein erneuter Quellen-/Realdatenabgleich (nicht erforderlich; MCD ist
im ROIC-Trend bereits durch die Leasingsperre gesperrt, JNJ hat kein EBIT). Die
TTM- und Bewertungsgrenzen aus §13.4–§13.7 gelten unverändert.

### 13.13 · Review-Nachbesserung PR #2 (V1.0.76): ROIC ohne periodengleiche Liquidität, Nettoschulden im Growth-Modul

**Anlass.** Das Review
(https://github.com/c7gzyvh4rk-commits/Aktientool/pull/2#issuecomment-5904559512)
auf `7236c73` fand zwei Fehler. Das Growth-Modul hat der Auftraggeber als
Mergeblocker eingestuft.

**R-1 · ROIC − WACC: fehlende periodengleiche Liquidität als 0 (neu durch F-5).**
`computeRoicMinusWacc` setzte im Periodenmodus eine fehlende Liquidität per
`const cashI = … : 0` auf 0. Das gilt für eine fehlende Periodenzuordnung ebenso
wie für einen fehlenden Wert. Das investierte Kapital stieg dadurch, und der
ROIC sank. Gemessen am Grenzfall: EBIT 100, Steuer 25 %, Buchwert 500,
Schulden 600, Liquidität 400, aber für 2025–2022 nur zum 30.06. gemeldet;
WACC 9 %.

| | ROIC | Spread | Qualitätsurteil | Basis-MoS |
|---|---|---|---|---|
| V1.0.75 | 6.8 % (Median mit Liquidität 0) | −2.18 pp ⇒ `value_destroyer` | `caution_quality` | 25 % |
| V1.0.76 | nicht bewertbar (2 von 5 Jahren; Grund nennt 2025-12-31 … 2022-12-31) | — | `investable_high` | 15 % |

„Konservativ“ traf also nicht zu: Die Nullannahme erzeugte eine
Qualitätsschwäche und einen höheren Sicherheitsabschlag. Korrektur: Im
Periodenmodus zählt ein Jahr ohne periodengleiche Liquidität nicht. Bei
genügend übrigen Jahren wird nur aus diesen gerechnet, und der Detailtext nennt
die ausgelassenen Jahre. Sonst gilt `insufficient_data` mit Grund. Eine belegte
Liquidität von 0 bleibt gültig. Periodenfreie Altdaten, Leasing- und
Periodenregeln sind unverändert. Für MCD und JNJ ändert sich nichts (MCD:
Leasingsperre; JNJ: kein EBIT).

**R-2 · Growth-Modul: ungeprüfte Nettoschulden (vorbestehend, auf main
`8b42fea` identisch).** `runGrowthCaseEngine` las nur `net_debt[0]`, sonst 0.
Der Wert ging in jedes Szenario ein (Exit-Equity = Exit-EV − Nettoschulden).
Davon abhängig waren Szenario-Fair-Values, gewichteter Fair Value, E[IRR],
`GROWTH_BUY` und Upside im Growth-Tab. Welcher Wert verwendet wurde, zeigte der
Tab nicht an. Synthetischer Nachweis (Umsatz 1,000, FCF 180, 100 Mio. Aktien,
Kurs 40, WACC 9 %):

| Fall | Brücke | Growth V1.0.75 | Growth V1.0.76 |
|---|---|---|---|
| keine Schuldenangaben | gesperrt | Nettoschulden 0: WFV 77.06, E[IRR] 13.8 %, **GROWTH_BUY** | gesperrt mit Grund, kein FV/IRR, GROWTH_WATCH |
| Teilbetrag 4,000, Umfang offen | gesperrt | ungeprüfte 4,000: WFV 60.16 | gesperrt mit Grund |
| belegt 4,500 − 500 (kein `net_debt`-Feld) | 4,000 | Nettoschulden 0: WFV 77.06, **GROWTH_BUY** | 4,000: WFV 60.16, E[IRR] 6.8 %, GROWTH_WATCH |

Realauszüge mit angenommenem Kurs (MCD 300, JNJ 160; im Audit lag kein Kurs vor):
Vorher rechnete das Modul mit den Teilbeträgen 39,199 bzw. 21,729 (WFV 3.72
bzw. 41.84), jetzt ist es gesperrt und nennt den Grund.

*Beobachtet ohne Wirkung auf die Synthese.* Buy Price, Position,
Annahmen- und Gesamtkonfidenz sind mit und ohne `state.growth` identisch. Die
einzige Kopplung ist `growthModuleFairValueActive === false`, die die
Annahmenkonfidenz auf 65 deckelt. Nettoschulden konnten sie nicht auslösen
(Exit-Equity ≤ 0 ergibt FV 0, nicht null).

Korrektur: Das Growth-Modul prüft wie die DCF-Brücke
(`_resolveNetDebtForDcfBridge`). Nicht belegt ⇒ kein Szenario-Fair-Value, keine
IRR, kein `GROWTH_BUY`; der Grund steht im Diagnosetext, im
Fair-Value-Feld und bei Upside. `growthModuleFairValueActive` ist dann
`null` (nicht bestimmbar) und nicht `false` (ungültige Margenkalibrierung). Die
Synthese bleibt dadurch nachweislich unverändert.

**Offen (nicht in diesem Schritt).** Das Reverse-DCF-Diagnosepaar auf
Reported-/Owner-FCF-Basis (`computeReverseDcfFull`, `_computeOwnerFcfDcf`)
liest weiterhin `net_debt[0]` bzw. 0. Es ist nicht gewichtet, als Diagnose
gekennzeichnet und auf main identisch. **Geschlossen in V1.0.77 (§13.14).**

**Tests.** `tests/roic-cash-period.test.mjs` (8) und
`tests/growth-net-debt.test.mjs` (4). Gegen den Stand `7236c73` scheitern
4 bzw. 3 Fehlerfalltests; die Erhaltungstests bestehen vorher und nachher.
Die Sollwerte sind unabhängig hergeleitet (ROIC 75/700, 75/1100, 75/1000;
Growth-FV-Differenz 4,000/100/1.09^N je Szenario).

### 13.14 · Restpunkte aus PR #2 geschlossen (V1.0.77): FCF-Diagnostik, O-1, O-4

> **Berichtigt in §13.15 (V1.0.78).** O-1 und O-4 waren mit V1.0.77 nicht
> vollständig geschlossen: Der vereinfachte ROIC paarte bei gemischten
> Periodenangaben weiter per Arrayposition, und die O-4-Regel behauptete aus
> einem bloßen Indiz eine Kombination (JNJ FY2018–FY2022 nach Primärquelle rein).
> Die unten markierten Aussagen gelten nicht mehr. Punkt 1 (FCF-Diagnostik) bleibt.

**Anlass.** Abschlussreview PR #2
(https://github.com/c7gzyvh4rk-commits/Aktientool/pull/2#issuecomment-5914037854):
drei nicht blockierende Restpunkte. Ausgangsstand main `1ee2e92` (V1.0.76,
Produktdatei SHA-256 `7d60f54b…`).

**1 · Reported-/Owner-FCF-Diagnostik: ungeprüfte Nettoschulden.**
*Ursache.* `computeReverseDcfFull` setzte für das Diagnosepaar
(`reverseDcfReported`, `reverseDcfOwner`, `scenarioResults`)
`netDebtM = net_debt[0] ?? 0`; `_computeOwnerFcfDcf` rechnete
`net_debt[0]` → `total_debt[0] − Liquidität` mit fehlender Liquidität = 0 →
sonst 0 („EV = Equity Value“). Keiner der Pfade prüfte Umfang, Herkunft oder
Stichtag. Der Hinweis „keine Nettoschuldenbrücke“ war zudem ungenau: Das Paar
setzt Nettoschulden sehr wohl ins Ziel-EV (Kurs · Aktien + Nettoschulden) ein.
Das Growth-Verdict (BUBBLE_RISK … GROWTH_WATCH) leitete sich aus diesem
Wachstum ab.

| Fall (synthetisch, FCF 180, SBC 20, 100 Mio. Aktien, Kurs 40, WACC 9 %, TG 3 %) | V1.0.76 | V1.0.77 |
|---|---|---|
| keine Schuldenangaben | Paar mit 0; Owner-FV mit 0 | nicht bestimmbar, Grund „Nettoschulden nicht belegt … NICHT als 0“ |
| Schulden 4,500 ohne Liquidität | Paar mit 0; Owner-FV mit 4,500 (Liquidität = 0) | nicht bestimmbar |
| Teilbetrag, Umfang offen (abgeleitetes net_debt 4,000) | beide mit ungeprüften 4,000 | nicht bestimmbar |
| Liquidität nur zum Halbjahresstichtag | Paar mit 0; Owner-FV mit 4,000 | nicht bestimmbar (Periodenprüfung) |
| belegt 4,500 − 500, kein `net_debt`-Feld | Paar mit **0** (!); Owner-FV mit 4,000 | beide mit 4,000 |
| belegt 0 / belegt −500 / manuelles `net_debt` 4,000 | 0 / Paar 0 statt −500 / 4,000 | 0 / −500 / 4,000 |

*Korrektur.* Beide Pfade nutzen `_resolveNetDebtForDcfBridge` (dieselbe
Prüfung wie Bewertungskern, DCF-Brücke, Growth-Modul; keine zweite
Definition). Nicht belegt ⇒ kein Reported-/Owner-Wachstum, keine
Kursszenarien, keine Klassifikation, kein Owner-/Reported-FV und kein
SBC-Abschlag (FV); der Grund steht in Bewertungs- und Growth-Reiter.
Unabhängig berechenbar und erhalten: Kernstatus (`coreStatus`, getrennt
geführt), SBC-Diagnose (Owner-FCF 160), historischer Umsatz-Benchmark.
Folge im Growth-Modul: Ohne belegte Nettoschulden gibt es auch kein aus dem
impliziten Wachstum abgeleitetes Verdict mehr (`MODEL_UNSUITABLE` mit Grund
statt z. B. `GROWTH_WATCH`); Synthese unverändert (Growth ist isoliert, §13.13).
Diagnosen bleiben ungewichtet.

**2 · O-1: vereinfachter ROIC im Wachstumsprofil.** *Ursache.*
`computeBaseRateLite._roicAt` paarte je Arrayposition, setzte fehlende Schulden
und Liquidität auf 0, einen fehlenden Steuersatz auf 25 % und ignorierte die
Leasingsperre von ROIC − WACC. Einziger Verbraucher: Anzeige „Historisches
Profil“ (kein Score, kein Qualitätsurteil, keine Bewertung). MCD zeigte dort
z. B. 24.8 %, während ROIC − WACC „nicht bewertbar“ war.
*Korrektur.* Die Periodenzuordnung von ROIC − WACC ist als `_roicStockMatchers`
herausgelöst (Inhalt unverändert) und wird mitbenutzt: Bestände zum Ende
desselben Geschäftsjahres (≤ 45 Tage, keine Eröffnungsstichtage),
Positionsbezug nur bei periodenfreien Altdaten [**unzutreffend, §13.15:** im
Standardmodus wurden Bestände ohne Perioden auch neben datiertem EBIT per
Position gepaart]. Eigenkapital, Finanzschulden
und Liquidität müssen belegt sein (belegte 0 gültig), Steuersatz aus
`wacc_components.tax_rate`, Leasingsperre wie ROIC − WACC/ROIC-Trend; der
2-Jahres-Trend verlangt zwei Geschäftsjahre Abstand. Die Kennzahl ist bewusst
eine andere als ROIC − WACC (Einzeljahr statt Median, unbereinigt) und wird
so benannt („ROIC akt. (vereinfacht, Stichtag)“ mit Definitionszeile); sonst
„nicht bewertbar“ mit Grund. Auf den MCD-Auszügen (Steuer 21 %, WACC 8 %
angenommen) jetzt „nicht bewertbar: Leasingbereinigung erforderlich …“.

**3 · O-4: kombinierter RE+APIC-Wert als Gewinnrücklagen.** *Beleg.*
Primärquelle jnj-20251228.htm, Bilanzzeile „Retained earnings and
Additional-paid-in-capital“ = 168,978, getaggt als
`us-gaap:RetainedEarningsAccumulatedDeficit` (Auditbeleg `bs.re_apic`,
AUDIT-D3 Tabelle JNJ Zeilen 837–840). Nach Taxonomie umfasst der Tag nur
Gewinnrücklagen. In den Company Facts (Abruf 2026-09-30, SHA-256 `7141c0c9…`)
meldet JNJ für jedes Geschäftsjahr FY2018–FY2025
`AdjustmentsToAdditionalPaidInCapitalSharebasedCompensation…` (Bewegungen der
Kapitalrücklage [**§13.15:** in der RE-Spalte als Belastung, Gutschrift bei den
eigenen Aktien — kein Nachweis einer Kapitalrücklage im RE-Wert]), aber keinen APIC-Bestand; die Eigenkapitalidentität
3,120 + 168,978 − 14,930 − 75,624 = 81,544 (Eigenkapital inkl. Minderheiten zum 2025-12-28) schließt
nur mit dem RE-Tag als einziger Rücklagenzeile. MCD meldet
`AdditionalPaidInCapital` eigens (SHA-256 `0394e814…`).
*Korrektur [**ersetzt in §13.15**].* `_checkRetainedEarningsScope` im Importweg
(`_extractSecFundamentals`): Gibt es für ein Geschäftsjahr APIC-Bewegungen,
aber zum Stichtag (gleiches Geschäftsjahr, ≤ 45 Tage) keinen Bestand
(`AdditionalPaidInCapital`, `AdditionalPaidInCapitalCommonStock`,
`CommonStocksIncludingAdditionalPaidInCapital`), wird der RE-Wert dieser
Periode verworfen (null, Grund in `unavailablePeriods`). Eine Zerlegung ist
ohne gemeldeten APIC-Bestand nicht möglich. Keine JNJ-spezifische Zahl oder
Regel; Altman nennt den Grund. EBIT für JNJ wurde nicht erschlossen.
*Folgepfad (synthetisch mit EBIT, TA 10,000, WC 500, EBIT 400, BV 4,000,
TL 6,000, kombinierter Wert 5,000):* vorher Z'' = 2.9268 (safe) ⇒
`investable_high` ⇒ Basis-MoS 15 %; jetzt Altman `insufficient_data` ⇒ Urteil
und MoS identisch mit „RE nicht gemeldet“ (`caution_data`, 25 %). Gegenprobe
mit gemeldetem APIC-Bestand und reinem RE 500: Z'' = 1.4598 ⇒
`caution_quality`.
*Realdaten:* JNJ RE 2018-12-30 … 2025-12-28 verworfen, 2017-12-31/2017-01-01
bleiben (keine APIC-Bewegung gemeldet); MCD unverändert (70,282 …).
[**§13.15:** Seit V1.0.78 sind alle JNJ-Stichtage „Umfang ungeklärt“ (auch
2017), MCD „rein“ über die Eigenkapitalidentität.]

**Tests (Sollwerte aus Definition/Kontrollrechnung).**
`tests/diagnostic-net-debt.test.mjs` (18), `tests/base-rate-roic.test.mjs` (12),
`tests/retained-earnings-scope.test.mjs` (8, inkl. Realauszug
`tests/real-data/excerpts/re-apic-excerpt.json`), Browser-Abnahme §11 (+9).
Gegenlauf mit der Produktdatei von `1ee2e92`: 16/18, 9/12, 4/8 rot, Browser §11
6 FAIL; alle gültigen Gegenproben (belegte 0, Nettoliquidität, manuelles
`net_debt`, belegte Liquidität 0, Altdaten, APIC-Bestand, keine APIC-Angaben,
MCD) bestehen vorher und nachher. Angepasst: `audit-chat12` R7 verlangte
> 10 pp Abstand zwischen Diagnosepaar und Kern — der Abstand war der Fehler
selbst (Paar mit 0 statt belegter 2,000: −4.66 % statt 9.12 %). Jetzt: gleiche
geprüfte Nettoschulden, Kontrollrechnung EV(g) = 3,200, Abstand > 1 pp.

**Verbleibende Grenzen.** (a) O-4-Regel konservativ: Ein Emittent, der
APIC-Bewegungen meldet, die Kapitalrücklage aber im Stammkapital
(`CommonStockValue`) führt, verliert den RE-Wert ebenfalls (nicht belegt,
nicht falsch). JNJ FY2018–FY2021 sind im Original als „Retained earnings“
beschriftet, werden aber verworfen, weil APIC-Bewegungen ohne APIC-Bestand
gemeldet sind (die Zeile nimmt diese Buchungen auf) [**unzutreffend, §13.15:**
die Buchungen in der RE-Spalte sind Belastungen, keine Kapitalgutschriften;
FY2018–FY2022 sind nach Primärquelle reine Gewinnrücklagen]. (b) ROIC − WACC und
ROIC-Trend behalten für periodenfreie Altdaten die bestehende Regel
„fehlende Liquidität = 0“ (bewusst nicht geändert; scorewirksam, nicht Teil
dieses Auftrags) [**geschlossen in V1.0.80, §13.17**]. (c) Die Diagnostik prüft
Nettoschulden wie die DCF-Brücke, aber nicht zusätzlich den Stichtag gegen die
FCF-Periode [**geschlossen in V1.0.80, §13.17**]. (d) Für MCD/JNJ
bleibt die Brücke gesperrt ⇒ Diagnosepaar/Owner-FV dort „nicht bestimmbar“,
sobald FCF und Kurs vorliegen. Modellsperren aus §13.4–§13.7 unverändert.

### 13.15 · Nachreview PR #3 (V1.0.78): O-4 und O-1 berichtigt

**Anlass.** Nachreview von PR #3
(https://github.com/c7gzyvh4rk-commits/Aktientool/pull/3, Abnahme
https://github.com/c7gzyvh4rk-commits/Aktientool/pull/3#issuecomment-5916338234):
zwei Lücken in V1.0.77. Ausgangsstand main `18f146c` (Produktdatei SHA-256
`196c3185…`). Die Abschlussaussage „alle drei Restpunkte geschlossen“ ist
damit berichtigt: Geschlossen war nur die FCF-Diagnostik.

**O-4 · Befund.** `_checkRetainedEarningsScope` verwarf RE-Werte, sobald
APIC-Bewegungen ohne APIC-Bestand gemeldet waren, und behauptete „der Wert
umfasst damit auch die Kapitalrücklage“. Das Indiz trägt nicht:

| Stichtag JNJ | RE-Wert | Bilanzzeile im 10-K derselben Periode | Buchungen der RE-Spalte im Geschäftsjahr (XBRL `RetainedEarningsMember`) | Einstufung nach Primärquelle |
|---|---|---|---|---|
| 2018-12-30 | 106,216 | „Retained earnings“ (10-K FY2019) | Ergebnis 15,297; Dividenden −9,494; Mitarbeiterpläne **−1,111**; Anpassung −254; Other 15 | rein |
| 2019-12-29 | 110,659 | „Retained earnings“ (10-K FY2019) | 15,119; −9,917; **−758**; Other 1 | rein |
| 2021-01-03 | 113,890 | „Retained earnings“ (10-K FY2020) | 14,714; −10,481; **−931**; Other 71 | rein |
| 2022-01-02 | 123,060 | „Retained earnings“ (10-K FY2021) | 20,878; −11,032; **−676** | rein |
| 2023-01-01 | 128,345 | „Retained earnings“ (10-K FY2022); im 10-K FY2023 betragsgleich unter der Sammelbezeichnung | 17,941; −11,682; **−974** | rein |
| 2023-12-31 | 153,843 | „Retained earnings and Additional-paid-in-capital“ (10-K FY2023) | 35,153; −11,770; −336; **Kenvue Separation/IPO +2,451** | kombiniert |
| 2024-12-29 | 155,791 | Sammelbezeichnung (10-K FY2025) | 14,066; −11,823; −295 | kombiniert |
| 2025-12-28 | 168,978 | Sammelbezeichnung (10-K FY2025) | 26,804; −12,381; −1,236 | kombiniert |

Die Buchung `AdjustmentsToAdditionalPaidInCapitalSharebasedCompensation…`
(„Employee compensation and stock option plans“) steht in der RE-Spalte stets
als **Belastung**; die Gutschrift liegt in der Spalte der eigenen Aktien
(z. B. FY2021: gesamt 2,171 = −676 RE + 2,847 Treasury). Eine Kapitalgutschrift
in die Zeile gibt es erst mit der Kenvue-Transaktion FY2023, zeitgleich mit der
neuen Bezeichnung. Quellen: 10-K-Hauptdokumente (Inline-XBRL) 0000200406-20-000010
(`form10-k20191229.htm`, SHA-256 `c70fc703…`), -21-000008 (`jnj-20210103.htm`,
`6e2d7dfb…`), -22-000022 (`jnj-20220102.htm`, `c4e3c13f…`), -23-000016
(`jnj-20230101.htm`, `9efb7472…`), -24-000013 (`jnj-20231231.htm`, `5e4fa5ea…`),
-26-000016 (`jnj-20251228.htm`, `b2b020e8…`), abgerufen 2026-09-30; Auszug je
Periode mit Wert, Zeile, Spaltenbuchungen und SHA-256 in
`tests/real-data/excerpts/jnj-re-primary-sources.json`. Alle Beträge stimmen
mit den Company Facts desselben Stichtags überein.

**O-4 · Korrektur.** Einstufung je Stichtag aus den gemeldeten Bilanzwerten
desselben Stichtags (Company Facts, je Tag die zuletzt eingereichte 10-K-Angabe):
* *rein*: eigener Kapitalrücklagen-Bestand (`AdditionalPaidInCapital`,
  `AdditionalPaidInCapitalCommonStock` oder
  `CommonStocksIncludingAdditionalPaidInCapital`) **und** die Identität
  Stammkapital + Kapitalrücklage + RE + OCI + Vorzugskapital − eigene Aktien
  = Eigenkapital (bzw. inkl. Minderheiten − `MinorityInterest`) schließt
  (Toleranz 0.05 % der Beträge). Die Kapitalrücklage ist dann außerhalb des
  RE-Werts erfasst. MCD: 17 + 9,641 + 70,282 − 2,414 − 79,316 = −1,790 ≈ −1,791.
* *kombiniert (belegt)*: Kapitalrücklage eigens gemeldet, Identität schließt
  nur ohne sie, und Stammkapital = Nennwert × ausgegebene Aktien
  (`CommonStockParOrStatedValuePerShare`, `CommonStockSharesIssued`). Keine
  Zerlegung (es wird nichts subtrahiert), der Wert bleibt gesperrt.
* *Umfang ungeklärt*: alles andere — kein eigener Kapitalrücklagen-Bestand
  (die Identität schließt dann mit dem RE-Wert als Sammelposten, ob mit oder
  ohne Kapitalrücklage), Identität schließt nicht, Eigenkapital fehlt,
  Kapitalrücklage doppelt gezählt ohne Nennwertnachweis. Der Grund ist als
  Unsicherheit formuliert, APIC-Bewegungen werden nur als Indiz genannt; die
  Behauptung „umfasst damit auch die Kapitalrücklage“ entfällt.

Nur „rein“ geht in Altman ein; Altman nennt „belegt kombiniert“ bzw.
„Umfang ungeklärt“. Keine unternehmensspezifische Regel.

**JNJ im Import.** Die Company Facts enthalten weder Zeilenbezeichnung noch
Spalten der Eigenkapitalveränderung; die Identität schließt in allen Jahren
nur mit dem RE-Wert als Sammelposten (z. B. 3,120 + 123,060 − 13,058 − 39,099
= 74,023 zum 2022-01-02). Der Import kann FY2018–FY2022 (rein) daher nicht von
FY2023–FY2025 (kombiniert) unterscheiden: **alle JNJ-Stichtage sind „Umfang
ungeklärt“** und gesperrt, ohne eine Kombination zu behaupten. Das ist eine
offen benannte Grenze der Datenbasis, keine Aussage über die Primärquelle.
Eine Nutzung der Primärquellen-Einstufung im Produkt wäre eine
Importerweiterung (nicht Teil dieses Auftrags).

**O-4 · Folgepfad (synthetisch mit EBIT; TA 10,000, WC 500, EBIT 400,
BV 4,000, TL 6,000; Piotroski fest bestanden).**

| Fall | V1.0.77 | V1.0.78 |
|---|---|---|
| belegt kombiniert (CS 100 = 1 USD × 100 Mio., APIC 3,400, RE-Tag 3,900) | RE 3,900 übernommen ⇒ Z″ 2.5682 ⇒ `investable_mid`, Basis-MoS 20 % | gesperrt ⇒ wie „RE fehlt“: `caution_data`, 25 % |
| rein (APIC 3,400 bzw. CommonStocksIncluding… 3,500, RE 500) | 500 ⇒ Z″ 1.4598 ⇒ `caution_quality` | unverändert |
| ungeklärt (kein APIC-Bestand, mit/ohne APIC-Bewegung) | mit Bewegung verworfen „umfasst damit …“; ohne Bewegung übernommen | gesperrt, Grund „Umfang ungeklärt“ |
| APIC-Bestand, Identität schließt nicht | übernommen | gesperrt, ungeklärt |

**O-1 · Befund.** `_roicStockMatchers` (Standardmodus, unverändert aus
ROIC − WACC) paart Bestände ohne Perioden neben datiertem EBIT per
Arrayposition; ohne EBIT-Perioden gilt für alle Reihen Positionsbezug, auch bei
datierten Beständen. Der vereinfachte ROIC zeigte so 10.7 % ohne belegte
Zuordnung (beide Mischrichtungen, Bestandsperioden `null`, unmögliche Daten).
**Korrektur.** Option `strictPeriods` nur für `computeBaseRateLite`:
Positionsbezug nur, wenn keine der vier Reihen ein `periods`-Feld führt
(Kriterium wie ROIC-Trend V1.0.75); sonst müssen alle vier gültige
Kalenderdaten (`parseIsoDate`) tragen und nach Geschäftsjahr/≤ 45 Tage ohne
Eröffnungsstichtag zuordenbar sein, sonst „nicht bewertbar“ mit Grund.
ROIC − WACC, ROIC-Trend, QCE, Urteil und Sicherheitsabschlag nutzen weiter den
Standardmodus. Alt/Neu-Vergleich (13 Datensätze: beide Mischrichtungen,
`null`-Perioden, unmögliche Daten, voll datiert, periodenfrei, Browser-Fixtures
Leasing/Trend/Mischfälle): ROIC − WACC, Trend-Score, QCE, Urteil, Kaufpreis und
Basis-MoS identisch; geändert nur der angezeigte vereinfachte ROIC.

**Tests.** `tests/retained-earnings-scope.test.mjs` neu gefasst (11 statt 8;
ersetzt die V1.0.77-Erwartungen „keine APIC-Angaben ⇒ RE bleibt“ und
„Bewegung ohne Bestand ⇒ kombiniert“, die auf dem unzulässigen Schluss
beruhten; Fixtures mit schließender bzw. nicht schließender Identität),
Realauszug `re-apic-excerpt.json` um die Eigenkapitalbestandteile erweitert,
`jnj-re-primary-sources.json` neu; `tests/base-rate-roic-periods.test.mjs`
(10); Browser-Abnahme §12 (+7: Import über die Oberfläche, gerenderter
Bewertungsreiter, Bewertungsgrößen Mischfall = Altdaten). Gegenlauf mit der
Produktdatei von `18f146c`: O-4 8/11 rot (MCD nur wegen des neuen Felds
`reScope`, Werte gleich), O-1 5/10 rot, Browser §12 2 FAIL; gültige
Gegenproben (rein mit APIC bzw. im Stammkapital, voll datiert, 52/53-Wochen,
periodenfrei, belegte 0, keine Bewertungswirkung, Primärquellenabgleich)
bestehen vorher und nachher.

**Verbleibende Grenzen.** (a) Unterscheidung rein/kombiniert nur, soweit die
Company Facts die Eigenkapitalbestandteile tragen; wo sie nur aus der
Primärquelle hervorgeht (JNJ), bleibt der Umfang ungeklärt und Altman gesperrt.
Emittenten ohne eigenen Kapitalrücklagen-Bestand oder mit nicht schließender
Identität verlieren Altman ebenfalls (vorher teils ungeprüft übernommen).
(b) Manuelle Importe (ohne Company Facts) werden nicht geprüft. (c) Offen und
unverändert: Abgleich Nettoschuldenstichtag ↔ FCF-Periode in der Diagnostik;
Altdatenregel „fehlende Liquidität = 0“ in ROIC − WACC/ROIC-Trend; MCD-/JNJ-
Modellsperren; JNJ ohne EBIT.

### 13.16 · O-4: Doppelzählung und Ersatznullen in der Eigenkapitalprüfung (V1.0.79)

**Befunde (nach PR #4 reproduziert, Stand `b90ca50`).** `_checkRetainedEarningsScope`
1. addierte `CommonStockValue`, `AdditionalPaidInCapital` **und** den
   Summenposten `CommonStocksIncludingAdditionalPaidInCapital`: Stammkapital
   100 + APIC 3,400 + RE 500 = Eigenkapital 4,000 ist „rein“; mit zusätzlichem,
   passendem Summenposten 3,500 ergab sich 7,500 ⇒ „ungeklärt“, die reinen
   Gewinnrücklagen gingen verloren;
2. setzte fehlende Bestandteile (Vorzugskapital, OCI, eigene Aktien,
   Minderheiten) per `|| 0` auf 0: Eigenkapital 7,400 = 100 + APIC 3,400 +
   RE-Tag 3,900 (davon rein 500) + Vorzugskapital 3,400; ohne
   Vorzugskapital-Angabe schloss 100 + 3,400 + 3,900 = 7,400 zufällig ⇒ „rein“,
   Altman erhielt 3,900 (Z″ 3.1632 ⇒ `investable_high`, Basis-MoS 15 %).

**Korrektur (nur diese Funktion).** (1) Bestandteile und Summenposten des
eingezahlten Kapitals sind alternative Darstellungen: genau eine geht in die
Summe ein; liegen beide vor, müssen CommonStockValue + Kapitalrücklage und
Summenposten übereinstimmen (Toleranz 0.05 %), sonst „Umfang ungeklärt: … widersprechen
sich“ ohne Auswahl. (2) OCI, eigene Aktien (`TreasuryStockValue` bzw.
`…CommonValue`), Vorzugskapital und — wenn nur Eigenkapital inkl. Minderheiten
gemeldet ist — `MinorityInterest` müssen gemeldet sein; eine belegte 0 zählt,
eine fehlende Angabe nicht. Fehlt ein Bestandteil, wird weder „rein“ noch
„belegt kombiniert“ abgeleitet, sondern „Umfang ungeklärt: Eigenkapitalbestandteile
nicht gemeldet: …“. Kein Bestandteil wird aus der Differenz zurückgerechnet.
Gleiche Einheit (USD), gleicher Stichtag, 10-K, wie bisher.

**Nachweise.** `tests/retained-earnings-components.test.mjs` (11; Folgepfad
Import → Altman → Urteil → Basis-MoS mit EBIT): Gegenlauf auf `b90ca50` 7 rot
(beide Darstellungen, Redundanz, Widerspruch, fehlendes Vorzugskapital, OCI,
eigene Aktien, Minderheiten), 4 Gegenproben grün vorher und nachher
(Einzelbestandteile, nur Summenposten, vervollständigter kombinierter Fall,
vollständig mit belegten Werten). Redundanter Summenposten: Wert, Einstufung,
Altman, Urteil und MoS identisch. `tests/retained-earnings-scope.test.mjs`:
sechs Fixtures meldeten OCI/eigene Aktien/Vorzugskapital nicht und waren nur
über die Ersatznullen einstufbar; ergänzt um belegte Nullwerte, Erwartungen
unverändert (alt und neu 11/11). MCD bleibt rein (alle Bestandteile gemeldet,
Vorzugskapital 0), JNJ unverändert ungeklärt.

**Grenze.** Emittenten, die OCI, eigene Aktien oder Vorzugskapital nicht
ausdrücklich (auch nicht als 0) melden, erhalten keine Einstufung „rein“ mehr.


### 13.17 · Offene Punkte geschlossen (V1.0.80): Nettoschulden ↔ FCF-Zeitraum in der Diagnostik, fehlende Liquidität in Altdaten-ROIC

**Ausgangsstand.** main `b523867c9b2725e0bd2b920181d3423e48ac24c7` (Merge PR #5,
V1.0.79) = Referenzstand, ohne Abweichung; keine `AGENTS.md`. Gearbeitet in
eigenem Worktree auf `claude/netdebt-fcf-roic-cash`; Hauptcheckout unverändert.
Beide Befunde vor der Reparatur auf `b523867` reproduziert (Werte unten).

#### 1 · Nettoschulden-Stichtag ↔ FCF-Zeitraum (Reported-/Owner-FCF-Diagnostik)

**Ursache.** `computeReverseDcfFull` (Diagnosepaar, Kursszenarien) und
`_computeOwnerFcfDcf` nutzten seit V1.0.77 `_resolveNetDebtForDcfBridge`. Diese
Prüfung belegt Umfang, Herkunft und die periodengleiche Verknüpfung von Schulden
und Liquidität — sie kennt den FCF nicht. Ein belegter, aber zu einem anderen
Stichtag gehörender Bestand ging ungeprüft in Ziel-EV bzw. Eigenkapital ein,
ebenso ein vorhandenes `net_debt[0]` ohne Stichtag neben datiertem FCF.

| Fall (FCF 180 FY2025 bis 2025-12-31, SBC 20, 100 Mio. Aktien, Kurs 40, WACC 9 %, TG 3 %, g1 15 %) | `b523867` | V1.0.80 |
|---|---|---|
| Bilanz 4,500 − 500 zum **2024-12-31** | Reported 15.46 %, Owner 17.02 %, FV 37.26/28.68, `GROWTH_WATCH` | gesperrt: „FCF-Zeitraum endet 2025-12-31 … 2024-12-31 — 365 Tage Abstand, zulässig sind 45“; `MODEL_UNSUITABLE` mit Grund |
| Bilanz zum 2026-03-31 (juengeres Quartal) | wie oben | gesperrt (90 Tage) |
| `net_debt[0]` 4,000 ohne Metadaten neben datiertem FCF | wie oben | gesperrt (gemischt, Stichtag nicht belegt) |
| Bilanz zum 2025-12-31 (gültig) | 15.46 % / 17.02 % / 37.26 / 28.68 | identisch, „Stichtag … geprüft (≤ 45 Tage)“ |
| vollständig periodenfrei, `net_debt` 4,000 | wie gültig | identisch, als **Annahme** ausgewiesen („… NICHT geprueft“) |

**Fachliche Regel.**
* *Verwendeter FCF:* Diagnosepaar `fcf[0]`; Owner-FCF-DCF der FCF der
  SBC-Diagnose (`fcf[0]`, sonst `cfo[0] − capex[0]`; `computeSbcFcfDiagnostics`
  meldet jetzt `reported_fcf_source`). Periode = `_v4_meta.<Feld>.periods[0]`;
  beim Rückfall müssen CFO und CapEx gültige, ≤ 45 Tage auseinanderliegende
  Periodenenden belegen.
* *Zulässiger Stichtag:* das Ende des FCF-Zeitraums. FY: Geschäftsjahresende;
  TTM: Ende des TTM-Fensters (die TTM-Sicht liefert Fluss- und Bilanzwerte aus
  demselben Fenster); FY-Rückfall (TTM angefordert, unvollständig): FY-Regel,
  weil dann auch der FCF der Jahreswert ist. Toleranz 45 Tage
  (`MULTIPLES_PERIOD_TOLERANCE_DAYS`, dieselbe wie `_joinPeriodKeyed` und die
  EV/EBITDA-Brücke): abweichende Geschäftsjahresenden (52/53 Wochen, z. B.
  2025-12-28 ↔ 2025-12-31) sind zulässig; ein Quartals- oder Jahresversatz nicht
  — in beide Richtungen. Ein älterer Bestand enthält die Zu-/Abflüsse des
  FCF-Zeitraums nicht, ein jüngerer bereits die des Folgezeitraums; eine
  jüngere Bilanz gehört zur TTM-Sicht.
* *Nachweis:* Stichtag des **tatsächlich verwendeten** Betrags nach derselben
  Regel wie die EV/EBITDA-Brücke (`net_debt[0]` ⇒ nur dessen Periode;
  period-keyed `total_debt − cash` ⇒ Periode der Verknüpfung; kein Datum eines
  unbenutzten Feldes). Diese Zuordnung ist jetzt als `_dcfBridgePeriodEvidence`
  / `_seriesClaimPeriodContext` aus `_resolveMultiplesEvBridge` herausgelöst
  (Inhalt unverändert) und wird von beiden genutzt. Führt eine Seite
  Periodenangaben, muss sie ein gültiges Datum JJJJ-MM-TT (`parseIsoDate`) belegen.
* *Manuelle Daten:* Nur wenn **beide** Seiten vollständig periodenfrei sind,
  gilt der Positionsbezug — ausgewiesen als „Annahme … NICHT geprueft“
  (`netDebtPeriodCheck: 'unverified_manual'`), nie als geprüfte
  Periodengleichheit. Gemischte Angaben (eine Seite datiert, die andere ohne
  Beleg) sperren. Ersatzreihen (`derived.fcf/net_debt.override_series`)
  tragen keinen eigenen Stichtag; die Periodenangabe der ersetzten Reihe wird
  ihnen nicht zugeschrieben.

**Reparatur.** `_resolveFcfDiagnosticNetDebt(f, fcfBasis)` ruft zuerst die
zentrale Prüfung `_resolveNetDebtForDcfBridge` auf (keine zweite Definition für
Umfang/Herkunft), danach nur die Zuordnung zum FCF. Beide Diagnosepfade
verwenden sie; Sperrgründe getrennt: „Nettoschulden nicht belegt (…)“ bzw.
„Nettoschulden nicht dem FCF-Zeitraum zuordenbar (…)“. Gesperrt ⇒ kein
Reported-/Owner-Wachstum, keine Kursszenarien, keine Klassifikation, kein
Reported-/Owner-FV, kein SBC-Abschlag (FV). Erhalten: Kernstatus
(`coreReverseDcf`, eigener Status), SBC-Diagnose, Umsatz-Benchmark, belegte 0
und Nettoliquidität. Neue Ergebnisfelder: `netDebtPeriodCheck`,
`netDebtPeriodBlocked`, `netDebtPeriod`, `fcfPeriod`, `netDebtPeriodNote`,
`netDebtAssumption`.

**Verbraucher.** Bewertungsreiter (Diagnosepaar auf der FY-/TTM-Sicht, neue
Zeile „Nettoschulden ↔ FCF₀“), Wachstumsreiter (Reverse-DCF-Block, Hinweis
geprüft/Annahme; Growth-Verdict ⇒ `MODEL_UNSUITABLE` mit Grund, weil es aus
`rdcf.applicable` folgt), Owner-FCF-DCF-Karte (Bewertungs- und
Wachstumsreiter). Exporte: Snapshot und Master-JSON enthalten keine Felder des
Diagnosepaars; das gespeicherte `state.growth` trägt das neue Verdict. Einzige
Kopplung des Growth-Moduls an die Synthese (`growthModuleFairValueActive`,
aus den Szenarien) bleibt unverändert. Alt/Neu-Vergleich (Tabelle unten):
Kern-Reverse-DCF, Growth-Szenarien, gewichtete Bewertung, Urteil, MoS und
Einstiegspreis identisch.

#### 2 · Fehlende Liquidität als 0 in ROIC − WACC und ROIC-Trend (Altdaten)

**Ursache (lokalisiert).** `computeRoicMinusWacc`: im Positionsbezug
(vollständig periodenfreie Altdaten) `cashI = c && c.value != null ? c.value : 0`.
`_qceRoicTrend`: `cash[i] != null ? cash[i] : 0` — in **beiden** Modi (auch
datiert bei gültiger Periode und leerem Wert). Auftreten: bei einzelnen
null-Werten und bei einer Reihe, die nur aus null besteht. Eine **fehlende**
Reihe (kein Array bzw. leeres Array) war schon vorher „nicht bewertbar“
(Längenprüfung `yearsAvail`). Alias: Gewählt wird je Kennzahl eine Reihe als
Ganzes (`cash_and_equivalents`, sonst `cash`); einen jahresweisen Rückgriff auf
das andere Feld gibt es nicht — die Nullannahme entstand allein durch `: 0`
(unverändert kein neuer Rückgriff).

**Regel/Reparatur.** Nur eine ausdrücklich vorhandene Liquidität (auch 0) zählt.
Jahre ohne Angabe werden ausgelassen und benannt („ohne Liquiditätsangabe
ausgelassen (Altdaten, Position 0 = jüngstes Jahr): …“). Mindestjahre (5 für
ROIC − WACC; je 2 in den Fenstern 0–2/3–5 für den Trend), Definition, Median,
Leasing- und Periodenregeln, Positionsbezug der Altdaten unverändert. Reichen
die Jahre nicht: `insufficient_data` mit Grund; der Trend liefert dann
`{ status: 'insufficient_data', reason }` (Grund als Tooltip der QCE-Kachel).
Vereinfachter ROIC (O-1, `computeBaseRateLite`) nicht berührt.

**Wirkung (EBIT 100, t 25 %, Buchwert 500, Schulden 600, WACC 9 %; Piotroski/Altman bestanden):**

| Datensatz | ROIC − WACC | ROIC-Trend | QCE | Urteil | Basis-MoS | Einstiegspreis |
|---|---|---|---|---|---|---|
| Liquidität 6 × null, vorher | 6.82 % ⇒ −2.18 pp (`value_destroyer`) | 0.0 pp (Score 7) | 6.67 | `caution_quality` | 25 % | 5.1147 |
| … V1.0.80 | nicht bewertbar (0 von 5) | nicht bewertbar | – (zu wenige Komponenten) | `investable_high` | 15 % | 5.7967 |
| 2 × null + 4 × 400, vorher | +1.71 pp (6 Jahre, 2 mit 0) | −3.9 pp (Score 1) | 6.67 | `investable_high` | 15 % | unverändert |
| … V1.0.80 | nicht bewertbar (4 von 5) | nicht bewertbar | – | `investable_high` | 15 % | unverändert |
| 7 Jahre, 2 × null, vorher / V1.0.80 | +1.71 pp (7y) / +1.71 pp (5y, Grund) | −3.9 pp / nicht bewertbar | 6.67 / 7.8 | unverändert | unverändert | unverändert |
| belegte Liquidität 0 bzw. 100 | −2.18 / −1.50 pp, `value_destroyer` | unverändert | unverändert | `caution_quality` | 25 % | unverändert |
| Liquidität 400 (vollständig) | +1.71 pp | 0.0 pp | unverändert | `investable_high` | 15 % | unverändert |

Fachlich notwendige Änderung: Der Einstiegspreis steigt im ersten Fall, weil
die Basis-MoS nicht mehr aus einem unbelegten Qualitätsmangel folgt
(5.1147 ⇒ 5.7967, identisch mit „Liquiditätsfeld fehlt“). Ein tatsächlich
negativer Spread mit belegter Liquidität wirkt unverändert.

#### Alt/Neu-Vergleich (beide Produktdateien, dieselben 15 Datensätze)

Verglichen: Diagnosepaar, Owner-FV, Growth-Verdict, Kern-Reverse-DCF,
Growth-Szenario-FV, `growthModuleFairValueActive`, ROIC − WACC, ROIC-Trend, QCE,
Urteil, Basis-MoS, Einstiegspreis. Abweichungen nur dort, wo beabsichtigt:
FCF „stale“, „newer“, „mixedNd“ (Diagnosepaar/Owner-FV gesperrt,
`GROWTH_WATCH ⇒ MODEL_UNSUITABLE`) und die drei ROIC-Fälle mit null-Liquidität
(oben). Identisch: FCF gültig, belegte 0, Nettoliquidität, periodenfreier
manueller Fall, ROIC belegt 0/100/400, MCD- und JNJ-Realauszug (FY; Brücke
gesperrt bzw. ohne EBIT wie bisher).

#### Tests

`tests/fcf-net-debt-period.test.mjs` (14): FY gültig mit Kontrollrechnung
EV(g*) = Kurs · Aktien + ND und FV = (EV(g1) − ND)/Aktien; 52/53-Wochen und
Toleranzgrenze 45/46 Tage; belegte 0, −500; FY über den produktiven Import und
FY-Rückfall; TTM über den produktiven Quartalsweg (FCF 206.25 = 275 − 68.75,
ND 400, beide zum 2025-09-30) mit FY-Gegenprobe; TTM mit eingemischter
FY-Brücke (273 Tage); veraltete und jüngere Brücke inkl. Growth-Verdict;
`net_debt[0]` mit eigenem älterem/unlesbarem/fehlendem Stichtag; FCF ohne bzw.
mit ungültiger Periode; Ersatzreihen; CFO−CapEx-Rückfall; vollständig
periodenfreie Daten; Anzeigen. `tests/roic-legacy-cash.test.mjs` (10).
Browser §13 (+15, Import über die Oberfläche, gerenderte Reiter).
Gegenlauf mit `b523867`: 20 von 24 neuen Node-Tests rot (die 4 grünen sind
Erhaltungstests: fehlendes Feld, belegte 0, vollständige Altdaten, vereinfachter
ROIC); Browser §13 9 FAIL (13.1–13.4, 13.6, 13.7, 13.9, 13.11, 13.12),
Gegenproben 13.5/13.8/13.13/13.14 grün.

*Angepasste Fixtures (Erwartungen unverändert).* `diagnostic-net-debt`,
`growth-net-debt` und Browser `diagNetDebtMj`: Die Fixtures datierten Umsatz und
Brücke, nicht aber `fcf`/`cfo`/`capex` — nach der neuen Regel ein gemischter,
nicht nachweisbarer Fall. Die Cashflow-Reihen tragen jetzt ihre
Geschäftsjahresenden; der Fall „manuelles net_debt“ ist jetzt vollständig
periodenfrei (sonst wäre er gemischt; der gemischte Fall steht gesperrt im neuen
Test). Alle angepassten Tests bestehen auch auf `b523867`.

#### Verbleibende Grenzen und Beobachtungen (nicht Teil dieses Auftrags, unverändert)

* **Kern-DCF und Growth-Szenarien** nutzen `_resolveNetDebtForDcfBridge` ohne
  Abgleich mit dem Zeitraum ihrer Flussgrößen. Im synthetischen Fall „Bilanz
  2024-12-31, Flüsse FY2025“ rechnen Kern-Reverse-DCF (18.07 %), gewichtete
  Bewertung und Growth-Szenarien (FV 2.11/48.28/141.98) weiter mit 4,000. Das
  betrifft die gewichtete Bewertung und war ausdrücklich nicht zu ändern;
  Empfehlung: eigener Auftrag mit derselben Regel. In SEC-Importen entsteht der
  Versatz nur, wenn die jüngste gemeinsame Bilanzperiode hinter der jüngsten
  Flussperiode zurückbleibt (bei MCD/JNJ nicht der Fall; Brücke dort ohnehin
  gesperrt).
* EV/EBITDA-Brücke: lässt eine Seite ganz ohne Periodenangaben weiterhin zu
  (bestehende Regel, unverändert); die FCF-Diagnostik ist hier strenger.
* SBC-Periode gegen FCF-Periode wird nicht geprüft (SBC-Diagnose unverändert).
* MCD-/JNJ-Modellsperren, JNJ ohne EBIT, TTM-Grenzen aus §13.4–§13.7 und die
  O-4-Grenzen aus §13.15/§13.16 unverändert.
