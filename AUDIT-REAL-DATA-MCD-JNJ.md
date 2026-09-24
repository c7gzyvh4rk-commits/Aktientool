# Realdaten-Audit MCD / JNJ — Folgechat D

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
`tests/real-data/excerpts/`). Aktueller Stand: 5 von 5 BESTEHT.

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

### Ungeklärter Prüfpunkt

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
