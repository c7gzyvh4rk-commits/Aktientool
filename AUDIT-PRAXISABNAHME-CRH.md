# Praxisabnahme mit einem vollständigen Realdatenfall — CRH plc (FY2025)

**Urteil** (Stand nach der Korrektur V1.0.87, CoE/WACC bei „Neu berechnen“; Produktdatei SHA-256 `0c56cef948b23d9317ede5b0b4246b0cf4704a5a8a65c4bd41aa11ad23648501`, eingeführt und erfasst mit `a6bb5d79aabeedccfeb017af96c73377527c547e`; Zuordnung per Git verifiziert, §6). Alle CRH-Kennwerte sind bitgleich zu V1.0.86 (`6b6d865e…3ccf`, Erfassung `5159e8c`). Die Bereiche sind getrennt zu lesen:

| Bereich | Status | Umfang und Vorbehalt |
|---|---|---|
| **FY** (CRH plc, Geschäftsjahr 2025, Ende 2025-12-31) | **Ablauf und Rechenkonsistenz geprüft — unter den ausgewiesenen Annahmen und Vereinfachungen** | Produktiver SEC-Import → FY-Daten → DCF (Base/Konservativ/Optimistisch) → RIM → Synthese → Sicherheitsabschlag → Einstiegspreis → Anzeige → Export → Wiederimport. Werte unabhängig nachgerechnet (§6) gegen die **aktuelle** Erfassung, die per Git dem ausdrücklich gewählten Produktstand zugeordnet ist. WACC, CoE, g₁ und g_T sind heuristisch (§6); das ist eine Konsistenz-, keine Richtigkeitsaussage über die Annahmen. |
| **TTM** | **nicht abgenommen** | Fenster 2025-07-01 – 2026-06-30 richtig erkannt, Flussgrößen exakt; bewertet wurde zu Recht mit FY (ausgewiesener Rückfall, §5). Ein FY-Rückfall ist keine TTM-Abnahme. |
| **Nutzertest im tatsächlich verwendeten Browser** | **offen** | Geprüft wurde nur Chromium 141.0.7390.37 (headless) in dieser Umgebung (§8). |
| **Kursabhängige Ergebnisse** (Reverse DCF, Abstand zum Kurs, Einordnung „Beobachten/expensive“) | **nur unter der Kursannahme 81.96 USD geprüft** | Der Kurs ist nicht primär verifiziert (§3). Rechenweg geprüft, nicht der Kurs. |
| **Minderheiten, Equity-Beteiligungen, Operating-Leasing, Aktienbasis, SBC** | **abgegrenzt, nicht abgenommen** | Vereinfachungen der Brücke und des FCFF (§9.5), ausgewiesen und unverändert. |

Zusätzlich offen sind die Grenzen in §9 (u. a. Steuerquote-Altzustände, §9.9; unterschiedliche Voraussetzungen der beiden WACC-Ableitungen, §9.11). Die WACC-Steuereinheit ist seit V1.0.86 behoben (§7.5), der WACC aus manueller CoE beim ersten „Neu berechnen“ seit V1.0.87 (§7.7, vorher §9.10). Ein erfolgreicher Fall belegt diesen Ablauf für diese Daten. Er belegt weder die Zuverlässigkeit für andere Unternehmen noch allgemeine Modellgültigkeit oder Fehlerfreiheit; eine vollständige Produktfreigabe ist damit nicht verbunden. Kein Deployment.

---

## 1 · Ausgangsstand

* Stand nach `git fetch origin`, 2026-10-05: main war `a52897b6e40189500e7cbd733a1bdb9354ef5188` (Merge PR #8, V1.0.82).
  * Der Head von PR #8 (`1e93e32`) ist enthalten.
  * Abnahmekommentar: PR #8 #issuecomment-5970042541.
  * Keine formalen Reviews.
  * CI „Rechentests“ auf `a52897b`: success (Lauf 37129351632).
* Auftrag 1 ist damit abgeschlossen, einschließlich der Korrekturen bis PR #8 (Periodenzuordnung, Ersatzreihen).
* Es gibt keine `AGENTS.md`.
* Gearbeitet wurde in eigenen Worktrees: `claude/practice-acceptance-realcase` (Abnahme) sowie die Fix-Branches `claude/tax-rate-unit-recalc` und `claude/schema-criticals-recalc`. Der Hauptcheckout blieb unverändert.
* Während der Abnahme wurden zwei Korrektur-PRs integriert (§7). Endgültiger Produktstand: `b3f0c1e`.
  * Produktdatei SHA-256 `3618c750e21f68e9a4ccf83912c5ba5089363a7e6f68f7a8acc04adca6b437cc`.
  * Alle Realdaten-, Anzeige- und Exportprüfungen in diesem Bericht wurden **auf `b3f0c1e` wiederholt**.
* **Nachreview (V1.0.85).** Referenz main `beb041f0d57e89b95ae0ce3ec71a4def2f851ca2` (Merge PR #11, dieser Bericht). Das Nachreview fand zwei konkrete Befunde (§7.3, §7.4). Behoben auf Branch `claude/tax-pct-and-current-capture` (eigener Worktree, Hauptcheckout unverändert); Produktstand danach `545427e`, Produktdatei SHA-256 `a49d96b7…2bed`. **Alle CRH-Prüfungen wurden auf diesem Stand wiederholt** (§10), mit demselben Datenstichtag 2026-10-05, demselben Cache (Quell-Hashes §3) und denselben Annahmen. Abweichungen gegenüber `b3f0c1e`: keine in den Bewertungswerten (alle Kennwerte bitgleich, §8); die Zählung der Testläufe ändert sich (§10).
* **Zweites Nachreview (V1.0.86).** Referenz main `29a5a21d6025fc7f73d09828132ceffc19a7e198` (Merge PR #12), am 2026-10-12 per `git fetch` als aktueller Remote-Stand bestätigt. Zwei Befunde (§7.5, §7.6), behoben auf Branch `claude/wacc-tax-pct-product-binding` (eigener Worktree). Produktdatei danach SHA-256 `6b6d865e…3ccf` (Commit `0e9286a`); Erfassung auf `5159e8c` (Produktdatei bytegleich). **Alle CRH-Prüfungen wurden auf diesem Stand wiederholt** (§10): gleicher Datenstichtag 2026-10-05, gleicher Cache, gleiche Annahmen. Alle Bewertungswerte bitgleich zu `545427e` und `b3f0c1e` (CRH-Steuer 21.71 % > 1, der WACC ist bei CRH heuristisch 9 %).
* **Korrektur CoE/WACC bei „Neu berechnen“ (V1.0.87).** Referenz main `1bc4cec7e462156c2b012905fcf8aeac198455aa` (Merge PR #13), am 2026-10-12 per `git fetch` als aktueller Remote-Stand bestätigt. Befund §9.10 behoben (§7.7) auf Branch `claude/happy-bohr-pqf8sn` (eigener Worktree, Hauptcheckout unverändert). Produktdatei danach SHA-256 `0c56cef9…8501` (Commit `a6bb5d7`, zugleich Erfassungscommit). **Alle CRH-Prüfungen wurden auf diesem Stand wiederholt** (§8, §10): gleicher Datenstichtag 2026-10-05, Company Facts und Submissions bytegleich zu §3, gleiche Annahmen. Alle Bewertungswerte bitgleich zu V1.0.86; der gesamte Ablauf (Import, Kurs, 3× „Neu berechnen“, TTM ↔ FY, Export, Wiederimport, 2× „Neu berechnen“) ergibt auf `1bc4cec` und `a6bb5d7` bitgleiche Werte. CRH ist dafür ein Erhaltungstest (WACC heuristisch, kein Beta); den Fehler selbst weist der Komponentenfall in §7.7 nach.

## 2 · Fallauswahl (vor der Ergebnisprüfung)

**Kriterien, vorab aus Auftrag und `SEC_TAG_MAP` festgelegt:**
* nichtfinanziell (SIC nicht 6xxx), Geschäftsjahresende Dezember;
* `OperatingIncomeLoss` > 0;
* Gesamt-D&A-Tag (kein Teilposten), CFO, CapEx-Tag der Produktkette, positiver FCF;
* verwässerte Aktien sowie Cash- und Schulden-Tags für FY2025 und die 10-Qs 2026;
* bevorzugt eine **vollständige Nettoschuldenbrücke**.

Ausgewählt wurde nur nach Datenvoraussetzungen. Bewertungsergebnisse spielten keine Rolle.

| Kandidat (feste Reihenfolge) | Ergebnis | Grund |
|---|---|---|
| Colgate-Palmolive (CL) | geprüft, **DCF korrekt gesperrt** | `LongTermDebt` 7,839 ist die Summe der Tilgungstabelle. Sie enthält kein Commercial Paper (147), während Current 1,115 + Noncurrent 6,871 = 7,986 beträgt; die Tags sind rechnerisch unvereinbar. Die Engine sperrt die Brücke mit Grund. TTM fällt zurück auf FY (Q4-Aktien fehlen; CapEx-Kette nutzt einen veralteten ersten Tag). Auf `b3f0c1e` Anzeige ↔ Engine 49/49. |
| Hershey (HSY) | verworfen | Verwässerte Aktien seit 2015 und Cash-Tag seit 2019 nicht gemeldet. |
| Texas Instruments (TXN) | verworfen | D&A nur als `Depreciation` (1,918). Abschreibungen auf immaterielle Werte (~41–42 je Halbjahr) fehlen; der Wert ist also nur ein Teilposten (Konvention `reconcile-sources`). Finance-Lease-Tags fehlen ebenfalls. |
| Lockheed Martin (LMT) | geprüft, **DCF korrekt gesperrt** | Keine Tags für kurzfristige Bankschulden und Finance-Leasing; die Gesamtschuld bleibt unbestimmt. Laut Regel gelten fehlende Daten nicht als 0. TTM-Rückfall wegen des Umsatz-Tags der Quartalsreihe (endet 2018). Auf `b3f0c1e` 49/49. |

Danach wurde das Kriterium „vollständige Schuldenbrücke“ ausdrücklich gefasst: Alle fünf Bilanzzellen der produktiven Umfangsregel müssen belegt sein. Mit diesem Kriterium wurde systematisch gesucht:
* SEC-Frames API, FY2025-Stichtag;
* Schnittmenge aller Datenkriterien: 39 Unternehmen;
* Reihenfolge nach Umsatz;
* Vorbedingung über den produktiven Importpfad geprüft (`_extractSecFundamentals` → `_buildSecMasterJson`, ohne Bewertung).

Ergebnis der Prüfung:
* AMZN, UBER, LIN: Schuldenangaben rechnerisch unvereinbar (440/79/152).
* GD: Die Angaben ergeben rechnerisch negative kurzfristige Bankschulden.
* CBRE: vollständig, aber SIC 6500 und damit nach Vorabkriterium ausgeschlossen.
* **CRH plc (CIK 0000849395, SIC 3241 Zement, NYSE)**: erster Treffer mit vollständig belegtem Umfang.

Die CL- und LMT-Sperren sind berechtigt und bleiben als Sperrfälle dokumentiert (§9). Der Unternehmenswechsel verdeckt keinen Fehler: Die beiden in CRH gefundenen Produktfehler (§7) betrafen alle Unternehmen und sind behoben.

**Stichtag und Fenster:**
* Datenstichtag 2026-10-05.
* Jüngstes Geschäftsjahr: FY2025, 2025-01-01 – 2025-12-31 (10-K, eingereicht 2026-02-18).
* Erwartetes TTM: 2025-07-01 – 2026-06-30 (Q3/25, Q4/25, Q1/26, Q2/26; jüngstes 10-Q eingereicht 2026-07-30).

## 3 · Quellen und Eingaben

**Abruf.** Abgerufen am 2026-10-05 mit `fetch-sources.mjs CRH --cutoff 2026-10-05` (0 Fakten nach dem Stichtag entfernt) und `fetch-filings.mjs` (10-K/10-Q ab 2023). Einheit: Mio. USD, Aktien in Mio.; iXBRL `decimals` −6 bzw. −5 (Aktien).

| Quelle | URL | SHA-256 |
|---|---|---|
| Company Facts | data.sec.gov/api/xbrl/companyfacts/CIK0000849395.json | `bafbd0d6ae151e56e2849147c783ff7bdab7fe825b41be69c1bc559b27ec3daa` |
| Submissions | data.sec.gov/submissions/CIK0000849395.json | `7a90c4862889afb71b072fc2fe8646cb3af0e425c54817a3864316529ba8abeb` |
| 10-K FY2025 0001628280-26-009043 | …/849395/000162828026009043/crh-20251231.htm | `3ddb018e845dc92746b5d2faa5b26aa67e096808f59b2d47ed24146eaffe7a27` |
| 10-K FY2024 0001628280-25-008179 | …/000162828025008179/crh-20241231.htm | `db9d4ff5cc58877de8d5a91a5c98fd0f246f11ed96cfb90ce3a80ded8e45b9c8` |
| 10-K FY2023 0001628280-24-007773 | …/000162828024007773/crh-20231231.htm | `afb75937986cdcb5b21f37aeed40e9d6925fef7140fd1702247f9c371b5b258e` |
| 10-Q Q3/2025 0001628280-25-049574 | …/000162828025049574/crh-20250930.htm | `10e807f8675fcdfdcadb29e409d730e0891af93dca8f02a036c829f8b0c2cd49` |
| 10-Q Q1/2026 0001628280-26-028556 | …/000162828026028556/crh-20260331.htm | `4b28f65357a08e334b1f5833a3a792c3375649f10c8d9541d3451516e9925b34` |
| 10-Q Q2/2026 0001628280-26-050755 | …/000162828026050755/crh-20260630.htm | `1317d9a58dc1c4ab8e2d508f749c3ac1712afa1c2805af0d43d54699a05e78b1` |

**Import.** Der Import lief über den produktiven Weg: `replay-import.mjs CRH --price 81.96`, also `secFetchAll` → `secConfirmImport` mit Cache-Antworten. Yahoo war aus. Kein Wert wurde hinter dem Import eingeschleust.

**Manuelle Eingabe.** Einzige manuelle Eingabe ist der **Kurs 81.96 USD**: NYSE-Schlusskurs vom 2026-10-02 laut Websuche, ohne Split im Betrachtungszeitraum.
* Die Primär-Kursquellen waren in dieser Umgebung per Netzrichtlinie gesperrt.
* Die Sekundärangaben widersprechen sich teilweise (97.66 USD am 2026-08-06; undatierte LSE-Notiz).
* Der Kurs ist deshalb eine **nicht verifizierte Annahme**. Er wirkt nur auf Reverse DCF, Abstand zum Kurs und Einordnung. Modellwerte, MoS und Einstiegspreis hängen nicht davon ab (auf dem Endstand nachgeprüft: nur Kurs geändert ⇒ Steuerquote, DCF, RIM und Spanne unverändert, Browser §17.K). Kursabhängige Ergebnisse gelten **nur unter dieser Annahme**.

**Belege.** Die Auditbelege stehen in `tests/real-data/evidence/CRH.json`: 100 Posten, jeder mit Akte, Konzept, Periode und Fundstelle. Jeder Posten wird gegen das unveränderte iXBRL geprüft.

## 4 · Datenabgleich (FY2025)

**Prüfung.** Kontrollwerte aus dem Original-iXBRL wurden gegen den Import (Replay-Erfassung `fy`), die Engine, die Anzeige (Panels im Replay und Sichtprüfung) und den Export (Master-JSON und Snapshot) verglichen.
* `control-calcs.mjs CRH`: **100/100 Belege, 39/39 Kontrollposten, Fallprüfungen 7/7**.
* `reconcile-sources.mjs CRH` (Historie, 170 Werte): 162 korrekt, `net_debt` 4/4 korrekt mit belegtem Umfang. 8 Zeilen sind Werkzeuggrenzen (§9.4).

| Größe | Quelle / Kontrolle | Import = Engine | Anzeige | Export |
|---|---|---|---|---|
| Umsatz | 37,447 (GuV „Total revenues“) | 37,447 · FY 2025-12-31 · `RevenueFromContract…` | 37.447 Mio. USD | 37447 |
| EBIT | 5,440 („Operating income“) | 5,440 | Marge 14,5 % | 5440 |
| D&A gesamt | 2,156 (KFR) = 1,964 Sachanlagen + 192 Immaterielle | EBITDA − EBIT = 2,156 | D&A-Quote 5,05 % | 7596 (EBITDA) |
| CFO / CapEx | 5,625 / 2,713 („Purchases of PP&E, and intangibles“) | 5,625 / 2,713 | — | — |
| FCF (Tool-Definition CFO − CapEx) | 2,912 | 2,912 | FCF₀ 2912M (Wachstum) | 2912 |
| SBC | 143, gleiche Periode wie FCF | 143 | SBC/Umsatz 0,4 % | — |
| Aktien Ø verwässert FY | 677.0 | 677 (Aktienbasis, als Ersatz für ausstehende ausgewiesen) | 677,0 | 677 |
| Finanzschulden | 17,533 Total LTD (inkl. laufender Fälligkeiten 1,055) + Kontokorrent 120 (in Bilanzzeile 1,175) + Finance-Leasing 116 + 418 (Other liabilities) = **18,187** | 18,187, Umfang vollständig (5 Zellen), Stichtag 2025-12-31 | Nettoverschuldung/EBITDA 1,86 | — |
| Liquidität | 4,096 (ohne Restricted cash 51) | 4,096 | — | — |
| Nettoschulden | **14,091** | 14,091; Stichtag = Ende Umsatzbasis geprüft | 14091M | 14091 |
| Operating-Leasing | 286 + 1,232 | 1,518, **nicht** in der Brücke (Produktdefinition) | — | — |
| EK (CRH-Aktionäre) | 24,004 (ohne Minderheiten 1,044 + rückkaufbar 430) | 24,004 | — | — |

**Periodenkonsistenz.** Alle Flussgrößen (Umsatz, EBIT, D&A, CFO, CapEx, FCF, SBC, NI, Steuer) beziehen sich auf 2025-01-01 – 2025-12-31 (je `periods[0]` = 2025-12-31). Die Bilanzgrößen sind Stichtagswerte zum 2025-12-31. Die SBC-Angabe stammt aus derselben KFR-Periode wie der FCF.

**Revisionen.** Zwischen den 10-K FY2023/24/25 gibt es keine abweichenden Werte für dieselbe Periode. Rundung: Alle Werte sind ganzzahlige Mio. und stimmen exakt.

## 5 · TTM

* **Fenster.** Die Engine erkennt das Fenster 2025-07-01 – 2026-06-30 (365 Tage, Quartale FY2025-Q3 bis FY2026-Q2).
* **Kontrolle als FY + 6M/26 − 6M/25** (anderer Rechenweg als die Quartalssumme der Engine): Umsatz 38,632, EBIT 5,528, Jahresüberschuss 3,838, CFO 5,419 — **Engine jeweils exakt gleich**.
* **Rückfall auf FY, berechtigt.** Die Basis ist `requested ttm`, `selected fy`; der Rückfall ist mit Gründen ausgewiesen:
  * *CapEx:* Dieselbe KFR-Zeile ist im 10-K als `PaymentsToAcquirePropertyPlantAndEquipment`, in den 10-Qs als `PaymentsToAcquireProductiveAssets` getaggt. Die Quartalsnormalisierung verwendet bewusst genau einen Tag je Feld (kein Tag-Bridging), daher gibt es kein Q2/2026. Eine Änderung wäre eine Definitionsentscheidung (§9.2).
  * *D&A:* Das 10-Q Q3/2025 meldet nur `crh:DepreciationDepletionAmortizationAndImpairment` (inkl. Wertminderungen, 9M 1,606). Q4 ist damit nicht ableitbar, eine Quellenlücke.
  * *Aktien und EPS:* Q4/2025 ist nicht gemeldet. FY- und YTD-Durchschnitte sind nicht subtrahierbar.
  * *Finance-Leasing:* Die Stichtagsreihe braucht Werte zu allen drei Fensterenden. Zum 2024-06-30 gibt es keinen Wert; der Grund nennt korrekt dieses Fenster.
* **Anzeige.** Die Basis-Karte zeigt weiterhin „Letztes Geschäftsjahr (FY)“ mit Warnkasten und den drei Gründen. Kein FY-Wert wird als TTM ausgegeben.
* **Ergebnis.** Die Werte sind auf FY und TTM identisch; der Rückweg FY → TTM → FY lässt die Fundamentaldaten unverändert (Hash).

## 6 · Bewertung (FY), unabhängig nachgerechnet

**Annahmen**, getrennt nach Herkunft:

| Annahme | Wert | Herkunft |
|---|---|---|
| Steuerquote | 21.71 % | **abgeleitet** aus gemeldeten Daten: TE/(NI+TE) = 1,041/(3,753+1,041) |
| WACC / CoE | 9 % / 10 % | **heuristisch**: Sektor-Fallback ohne Beta (kein Yahoo), WACC vollständig heuristisch |
| g₁ (Stufe 1, 10 J.) | 4.81 % | **heuristisch**: Median der positiven 4-J.-Trends 2021→2025 (FCF 4.68, Umsatz 6.41, EPS 13.50 %) = 6.41 × 0.75 = 4.808, Cap 8 % |
| g_T | 2.5 % | **heuristisch**: Mitte des Sektor-Korridors [2; 3] |
| Marge / CapEx-, D&A-, OWC-Quote | 14.527 % / 5.321 % / 5.055 % / 8.024 % | **abgeleitet**: FY2025 bzw. Mediane 2021–2025 (OWC 2022–2025 mit kurzfristigen Finanzschulden = Kontokorrent + laufende Fälligkeiten + kurzfristiges Leasing) |
| Szenarien | konservativ g₁ − 0.75σ_g, Marge − 0.75σ_m, WACC + 1, g_T − 0.5, CoE + 1; optimistisch g₁ + 0.75σ_g, Marge + 0.75σ_m, WACC − 0.5, g_T + 0.3, CoE − 0.5 | **Regel** (σ_g 4.2649, σ_m 1.4146 aus den Jahreswerten) |
| Gewichte, MoS-Bausteine | DCF 70 % / RIM 30 %; investable_mid 20 %, Heuristik +10 pp, Buyback +10 pp, Cap 50 % | **Regeln** des Produkts |
| Kurs | 81.96 USD | **manuell** (§3) |

**Unabhängige Kontrollrechnung.** `tests/real-data/valuation-control.mjs CRH --product-commit <Zielstand>`, ohne Produktcode, nur geprüfte Belege und die obigen Annahmen: **26/26 innerhalb der Toleranz, Erfassung passend, Zuordnung zum Zielstand belegt** (Erfassung `a6bb5d7`, §10).
* **Sollseite:** eigene Formeln aus den gegen das Original-iXBRL geprüften Belegen und den Annahmen; kein Produktcode, kein Engine-Wert.
* **Istseite:** ausschließlich die **aktuelle** Replay-Erfassung desselben Laufs (`out/CRH-report.json`). Seit V1.0.85 gilt das auch für Altman Z″, Piotroski, g₁, Sicherheitsabschlag, Einstiegs- und tiefen Prüfpreis (`fy.valuationResults`, aus dem bewerteten Zustand erfasst). Bis V1.0.84 standen dort historische Werte (§7.4).
* **Verbindliche Produktzuordnung (seit V1.0.86):** Der Zielstand wird mit `--product-commit` unabhängig vom Bericht angegeben, per Git auf einen vorhandenen Commit aufgelöst, und der erwartete SHA-256 entsteht aus den Bytes der Produktdatei in diesem Commit. Der Erfassungscommit des Berichts muss existieren, seine Produktdatei muss den gemeldeten Hash haben, und dieser muss dem Zielstand entsprechen. Ein anderer Commit mit bytegleicher Produktdatei (Merge, Doku-Commits) gilt als „inhaltsgleich“ und wird so ausgewiesen. Umfang: die Produktdatei; sie enthält das gesamte ausführbare Produkt (ein Inline-Skript, keine weiteren Skripte; extern nur ein Web-Font-Stylesheet, das der Replay abweist).
* **Erfassung dokumentiert und geprüft:** Erfassungscommit `a6bb5d79aabeedccfeb017af96c73377527c547e`, Produktdatei SHA-256 `0c56cef948b23d9317ede5b0b4246b0cf4704a5a8a65c4bd41aa11ad23648501` ohne lokale Änderung, gegen Zielstand `a6bb5d7` „gleicher Commit“, gegen `1bc4cec` (V1.0.86) „nicht belegt“ (andere Produktdatei, Gegenprobe); bis V1.0.86 Erfassung `5159e8c` mit `6b6d865e…3ccf`; Unternehmen CRH, Datenbasis fy (angefordert und verwendet), Kurs 81.96, Steuer 21.71 %, WACC 9, CoE 10, g_T 2.5, Urteil investable_mid, Position expensive.
* **DCF:**
  * FCFF₁ = 4,214.8 Mio.; Umsatzbasis 37,447 × 1.0481ᵗ.
  * NOPAT = U·14.527 %·(1 − 21.71 %), + D&A-Quote, − CapEx-Quote, − OWC-Quote·ΔU.
  * Gordon-Terminalwert aus FCFF₁₀ vor ΔOWC·(1+g_T) − OWC·U₁₀·g_T; TV-Anteil 57.2 %.
  * Operativer Wert 76,158.7 Mio. = **112.494341 USD/Aktie**, − Nettoschulden 14,091/677 = 20.8139 ⇒ **91.680457** (Engine 91.68045670).
  * Konservativ / optimistisch: 48.707964 / 152.105017 (gleich).
* **RIM** (EPS 5.51, BVPS 24,004/677, DPS 1.48, CoE 10/11/9.5): 30.3728 / 48.8377 / 74.3694 (gleich).
* **Synthese** 0.7·DCF + 0.3·RIM: 43.2074 / **78.8276** / 128.7843 (gleich).
* **Reverse DCF** bei 81.96: Bisektion 3.56487 % gegen Engine 3.56485 % (Δ 0.00002 pp).
* **Qualität:**
  * Piotroski 6/9 (ROA 6.43 % < 6.90 %, Verschuldung 0.283 > 0.217 und Asset Turnover 0.642 < 0.703 nicht erfüllt) ⇒ knapp bestanden.
  * Altman Z″ = **3.55537742** ⇒ sicher.
  * Urteil **investable_mid** ⇒ Basis-MoS 20 %.
* **Sicherheitsabschlag:**
  * Bausteine: Heuristik +10 pp (WACC ohne Beta); Buyback +10 pp (Uplift 38.71 % > 25 %; Aktien-CAGR −3.95 %); Divergenz 91.68/48.84 = 1.88 < 2 ⇒ 0; Leverage 1.855 < 3 ⇒ 0.
  * MoS = 1 − 0.8·0.9·0.9 = **35.2 %** (Cap 50 % greift nicht).
  * **Einstiegspreis 78.8276 × 0.648 = 51.08**; tiefer Prüfpreis 43.2074 × 0.648 = 28.00. Einordnung „Beobachten/expensive“ (Kurs 60.5 % über der Einstiegszone).

**Modellrolle.** DCF und RIM sind gewichtete Modelle. **Nur Diagnose**, nicht nachgerechnet: DDM 22.48 (ungewichtet), Growth-Diagnose (Reported-FCF-Reverse 8.0 %, Owner-FCF 8.7 %; Nettoschulden-Stichtag zum FCF-Zeitraum geprüft) und das Szenarioband P25/P75 48.73/117.58. Geprüft wurden dort nur die Eingangsgrößen (Umsatz-CAGR 3 J. 4.6 %, FCF-Marge 7.8 %, Aktien-CAGR −4.0 %).

**Toleranzen** (vorab festgelegt, unverändert):
* gemeldete Werte und Summen: exakt (Mio.);
* Aktien: 0.1 Mio.;
* TTM-Summen: ±2 Mio.;
* Werte je Aktie: 0.01 % relativ;
* Reverse DCF: ±0.05 pp;
* MoS: exakt;
* Einstiegspreis: ±0.01 USD.

## 7 · Befunde mit Reparatur

Alle Befunde wurden minimal reproduziert, getestet (Gegenlauf rot), reviewt und per eigenem PR integriert. Die Pflichtprüfungen auf dem Endstand stehen in §10.

1. **Steuerquote wurde bei „Neu berechnen“ zum Bruch** (PR #9, V1.0.83; Ursache in der Berechnung).
   * `recalcFromAssumptions` normalisierte `as-tax` wie RF/ERP/CoD (21.71 ⇒ 0.2171), während Kern und Kennzahlen Prozentpunkte erwarten.
   * Folge: Jede Übernahme der Annahmen, auch nur des Kurses, rechnete mit 0.2 % Steuern. Bei CRH stieg der DCF dadurch von **91.68 auf 124.09**.
   * Der erste Replay dieser Abnahme hatte so bereits einen verfälschten Wert erfasst; die unabhängige Nachrechnung deckte das auf.
   * Korrektur: `normalizeTaxRatePctInput`.
2. **Anzeige und Export folgen dem aktuellen Stand** (PR #10, V1.0.84; Ursache in Anzeige und Export, ohne Wertwirkung):
   * veralteter Sperrhinweis „market.price fehlt … Valuation blockiert“ nach der Kurseingabe;
   * „Cap aktiv“ ohne greifende Obergrenze;
   * von Hand eingegebener Kurs als „Yahoo Finance“ ausgewiesen;
   * RF/ERP als „0.04 %/0.06 %“ angezeigt;
   * „undefined%“ im Heuristik-Kasten;
   * „(D&amp;A)“ doppelt maskiert;
   * QCE-Score aus einem nicht existierenden Feld gelesen: Die Übersichtszeile fehlte immer, der Hinweis „Kapitaleffizienz schwach“ wurde nie ausgelöst, die CSV-Spalten waren leer.

**Nachreview (V1.0.85, ein PR).**

3. **Steuerquote: Anzeige und Übernahme in verschiedenen Einheiten** (Ursache in der Eingabeverarbeitung von V1.0.83).
   * Das Feld `as-tax` zeigte den gespeicherten Wert in Prozent. `normalizeTaxRatePctInput` deutete Werte ≤ 1 aber als Bruch (× 100).
   * Reproduziert auf `beb041f` über den echten Ablauf (Import über die Oberfläche → Annahmen → „Neu berechnen“ ohne Änderung):

     | gespeichert | Feld zeigt | nach „Neu berechnen“ | DCF je Aktie |
     |---|---|---|---|
     | 0 % | leer | 0 | 37.334 ⇒ 37.334 |
     | 0.5 % | 0.5 | **50** | 36.943 ⇒ **−1.758** |
     | 1 % | 1 | **100** | 36.552 ⇒ **nicht bestimmbar** |
     | 21.71 % / 35 % | 21.71 / 35 | unverändert | stabil |

   * Korrektur: Die Eingabe ist ausdrücklich **Prozent** (Beschriftung „Steuerquote (%)“, Hinweis „0.5 = 0,5 %, 21.71 = 21,71 %“). Die Größenordnung entscheidet nicht mehr über die Einheit; gespeicherte Werte unter 1 werden nicht umgedeutet. Wertebereich 0–100 wie bisher (negativ, > 100, leer, nicht numerisch ⇒ nicht übernommen; Warnung > 30 %). Der Wert 0 wird jetzt angezeigt statt eines leeren Felds. RF, ERP und CoD bleiben Brüche.
   * Die bisherige Node-Erwartung „0.2171 ⇒ 21.71“ schrieb das Fehlverhalten fest und wurde bewusst ersetzt; Browser §15.4/§15.5 prüfen jetzt Eingabe 30 ⇒ 30 % und 0.3 ⇒ 0.3 %.
   * Nachweis: `tests/tax-rate-unit.test.mjs` 8/8 und Browser §17 (0 %, 0,5 %, 1 %, 21,71 %, 35 %; zweimal „Neu berechnen“ stabil; nur Kurs geändert ⇒ Steuer und kursunabhängige Werte stabil; bewusste Änderung auf 12.5 übernommen; −1, 150 und leer nicht übernommen; Export „JSON herunterladen“ und Wiederimport erhalten 0.5 %). Gegenlauf auf `beb041f`: Node 3 rot (Tests 2, 3b, 3c), Gegenproben 1, 3 (bestehende Bereichsregeln), 4, 5, 6 grün; Browser 267/281, 14 rot: 15.5 (0.3 ⇒ 30 %); 0 %, 0,5 % und 1 % (Anzeige bzw. Stabilität); Beschriftung bei 21,71 % und 35 % (alte Bezeichnung „Tax Rate (dez. oder %)“); 17.K, 17.E und 17.X (Ausgangswert 0,5 % wird zu 50 %). Gegenproben grün: Stabilität bei 21,71 % und 35 %, 15.4 (30 ⇒ 30 %), unzulässige Eingaben 17.U.
4. **Kontrollwerkzeug verglich sechs Werte mit historischen Zahlen** (Ursache im Auditwerkzeug, keine Produktwirkung).
   * `valuation-control.mjs` nahm für Altman Z″, Piotroski, g₁, Sicherheitsabschlag, Einstiegs- und tiefen Prüfpreis die Istwerte aus `evidence/CRH.json` (`engineObserved`, beobachtet auf `b3f0c1e`). Eine Änderung der Engine konnte diese Zeilen nicht rot machen.
   * Korrektur: `replay-import.mjs` erfasst die sechs Werte jetzt aus dem bewerteten Zustand (`fy.valuationResults`, mit Kurs, Steuer, WACC, CoE, g_T, Datenbasis, Urteil und Position) und schreibt Produktdatei-SHA-256 und Änderungsstatus in den Bericht. `valuation-control.mjs` vergleicht nur noch dagegen und prüft, ob die Erfassung passt (Ticker, Import, kein Selbsttest, Commit und Hash vorhanden, Produktdatei unverändert, Datenbasis, Kurs, WACC, CoE, g_T). Ein fehlender Wert ist ein fehlender Nachweis (keine 0, kein Rückfall). `engineObserved` bleibt nur als historischer Beleg und wird ausdrücklich nicht verglichen. Toleranzen unverändert.
   * Nachweis: `tests/real-data/valuation-control.test.mjs` 9/9 auf einer Teilmenge des echten Endstand-Laufs (`fixtures/valuation-control-capture.json`): jeder der sechs Werte knapp außerhalb der Toleranz in beide Richtungen ⇒ genau diese Zeile rot; innerhalb ⇒ grün; fehlend, `null`, `NaN` oder Text ⇒ fehlender Nachweis; 18 unpassende Metadaten ⇒ rot; historische Werte verdecken weder einen fehlenden noch einen abweichenden Wert. Gegenlauf mit dem Werkzeug von `beb041f` auf demselben Bericht: sechs Werte verfälscht ⇒ **26/26, Exit 0**; Erfassung entfernt ⇒ **26/26, Exit 0**. Neues Werkzeug: 20/26 mit sechs „ABWEICHUNG“ bzw. sechs „FEHLENDER NACHWEIS“, Exit 1.

**Zweites Nachreview (V1.0.86, ein PR).**

5. **WACC rechnete die Steuerquote nach Größenordnung** (Ursache in der WACC-Ableitung).
   * Seit V1.0.85 ist `tax_rate` in Speicherung, Anzeige und Eingabe Prozent. `applyDerivedFieldsV4`, `deriveCostOfCapital` und die Komponentenprüfung in `validateMasterJson` rechneten aber `tr > 1 ? tr : tr × 100`.
   * Unabhängiges Beispiel (RF 4 %, ERP 6 %, Beta 1 ⇒ CoE 10 %; Kd 5 %; Gewichte 50/50): **korrekt 7.4875 % bei 0,5 % und 7.475 % bei 1 %**; bisher 6.25 % bzw. 5 %. In `applyDerivedFieldsV4` greift danach die unveränderte Untergrenze (hier 8 %); der abgeleitete Rohwert ist geprüft.
   * Korrektur: Steuerfaktor überall `1 − tax_rate / 100`. RF, ERP, Kd, Gewichte, Untergrenze und manuelle Overrides unverändert; keine Umdeutung gespeicherter Werte. `validateMasterJson` ist eine Legacy-Hilfe außerhalb des aktiven Importpfads; korrigiert, damit keine Stelle die alte Regel weiterführt.
   * **Fixture-Anpassungen** (einzeln untersucht; alle meinten 21 %):
     * `tax_rate: 0.21` ⇒ `21` in `_makeBaseValuation`, `_makeMj` der Growth-Suite, der G-10-Fixture und `_mkGoldenMj`. Keine echten niedrigen Prozentwerte betroffen, keine anderen Felder geändert.
     * **GT-3** (Reverse DCF 12–22 %): mit 0.21 als 0,21 % im WACC 22.083 (rot); mit 21 wieder **21.6539**, identisch zum bisherigen Wert. Erwartung unverändert.
     * **T-BRL1b** (Divergenz-Gate > 3×): lag bisher nur durch die gemischte Einheit (WACC 21 %, Kern 0,21 %) bei 3.05; konsistent 2.83. Die CapEx-Reihe steht jetzt auf derselben ~1.200-Mio-Basis wie der Umsatz (6 %); der Fall bleibt über EBITDA/D&A, CFO und Bilanz auf 5.000-Mio-Basis widersprüchlich. Ergebnis **3.98×** mit durchgängig 21 % und über 3× in allen vier Kombinationen aus Steuereinheit und Produktstand (3.98–4.19); Gate sperrt, Erwartungen unverändert.
     * **F3 P75** (gemessene Bandgrenze auf T-01, kein unabhängig hergeleiteter Wert): 7.262863118767878 enthielt die Mischung (Kern 0,21 %). Neu gemessen **5.563015589041687**; auf `29a5a21` ergibt sich mit `tax_rate` 21 exakt derselbe Wert (WACC dort wie hier 9.23). P25 unverändert.
   * Nachweis: `tests/wacc-tax-unit.test.mjs` (10: 0 / 0,5 / 1 / 1,01 / 21,71 %, beide Ableitungspfade, Komponentenprüfung, Kontrollrechnung, Overrides) und Browser §18 (24: Import mit vollständigen Komponenten und **abgeleitetem** WACC oberhalb der Untergrenze, zweimal „Neu berechnen“, nur Kurs, bewusste Steueränderung 0,5 % ⇒ 21,71 % mit DCF wie beim Import, manueller WACC, manuelle CoE, Export/Wiederimport bei 0,5 %). **Rot auf `29a5a21`:** Node 7 (Gegenproben Overrides und Schwelle grün), Browser 300/305 (5 rot, u. a. 18.0.5 WACC 10.0 statt 10.891, 18.1); Rechenprüfungen mit Korrektur, aber alten Fixtures 1694/1700 (die sechs oben).
6. **Prüfbericht war keinem Produktstand verbindlich zugeordnet** (Ursache im Auditwerkzeug).
   * `checkCapture` prüfte Commit und Produkt-Hash nur auf das Format. Reproduziert auf `29a5a21`: echter Bericht mit Commit `a`×40 und Hash `b`×64 ⇒ `ok=true`, keine Befunde.
   * Korrektur: `--product-commit` (Pflicht), Git-Auflösung, Hash aus den Commit-Bytes, Prüfung des Erfassungscommits, Inhaltsgleichheit ausgewiesen (§6). Ohne bestandene Zuordnung ist der Vergleich nie erfolgreich.
   * Nachweis: `tests/real-data/valuation-control.binding.test.mjs` (10, isolierte temporäre Git-Repositories): passender Commit ⇒ ok; nicht vorhandener Commit, Commit mit anderer Produktdatei, falscher Hash, Ziel-Hash mit widersprüchlichem Erfassungscommit, fehlende Metadaten, lokal geänderte Datei, frühere Erfassung für neuen Zielstand ⇒ Fehlschlag; zwei Commits mit bytegleicher Produktdatei ⇒ ok, „inhaltsgleich“. Dazu `valuation-control.test.mjs` Test 8 (ohne Zuordnung kein Erfolg). Auf `29a5a21`: Test 8 rot, die Binding-Datei ist nicht ladbar (Export fehlt), die übrigen neun Wertetests grün.
   * Am echten Fall: Die CRH-Erfassung auf `5159e8c` besteht gegen `5159e8c` (gleicher Commit) und `0e9286a` (inhaltsgleich) und scheitert gegen `29a5a21` und `545427e` („erfasste Produktdatei 6b6d865e617a… ≠ Zielstand … (a49d96b793d6…)“). Die frühere Erfassung aus PR #12 (`545427e`) scheitert gegen den neuen Zielstand. Ohne `--product-commit` bricht das Werkzeug ab (Exit 2).

**Korrektur CoE/WACC bei „Neu berechnen“ (V1.0.87, ein PR; vorher §9.10).**

7. **WACC folgte einer manuellen CoE erst beim zweiten „Neu berechnen“** (Ursache in der Aufrufreihenfolge von `recalcFromAssumptions`).
   * `recalcFromAssumptions` erkannte die geänderte CoE, setzte die Herkunft `cost_of_equity_derived = 'manual'` aber erst **nach** `deriveCostOfCapital`. Die Ableitung überschrieb die CoE mit dem Komponentenwert, bildete daraus den WACC und markierte ihn „derived“; danach wurde nur die CoE zurückgeschrieben. Erst der nächste Klick (Flag jetzt „manual“) bildete den WACC aus der manuellen CoE. Zusätzlich blieb `wacc_components.derived.wacc` (gelesen u. a. von der Synthese, ROIC − WACC) auf dem Importwert stehen.
   * **Unabhängiger Kontrollfall** (vollständige Komponenten, WACC tatsächlich abgeleitet, oberhalb der Untergrenze 8 % = max(standard_nonfin 8 %, RF 4 % + 4 pp)): RF 4 %, ERP 6 %, Beta 1,5 ⇒ CoE 13 %; Kd vor Steuern 5 %; Gewichte 50/50; `tax_rate: 0.5` (0,5 %). Ausgangs-WACC 0,5 · 13 + 0,5 · 5 · (1 − 0,5/100) = **8.9875 %**; CoE von Hand 15 ⇒ Soll **9.9875 %** nach dem ersten Klick.
   * **Reproduziert auf `1bc4cec`** über den produktiven Ablauf (Import über die Oberfläche → Reiter Annahmen → nur CoE 15 → ein Klick; Node mit DOM-Attrappe und Chromium): CoE 15 „manual“, **WACC 8.9875 % „derived“**, von der DCF verwendeter Satz 8.9875 %, DCF-Basis 44.6894 (wie vor der Änderung); zweiter Klick ohne Änderung ⇒ WACC 9.9875 %, DCF-Basis 30.6615 (verzögerte Korrektur); `derived.wacc` blieb 8.9875. Browser §18.C protokollierte denselben Effekt (WACC 10.891 statt 11.591 aus CoE 14).
   * **Zweiter, im selben Ableitungsschritt gefundener Befund.** `deriveCostOfCapital` kennt die WACC-Untergrenze nicht. Bei einem beim Import angehobenen WACC (Beta 1 ⇒ Rohwert 7.4875 %, verwendet 8 %) fiel der WACC beim **unveränderten** „Neu berechnen“ auf 7.4875 % (DCF 64.24 ⇒ 77.86); beim nächsten Klick las die Erkennung den weiter angezeigten Wert 8 als Direkteingabe und machte ihn zum manuellen Override. Die Untergrenze selbst ist unverändert.
   * **Korrektur** (nur `recalcFromAssumptions` und eine Auslagerung):
     * Herkunft „manual“ für CoE bzw. WACC wird **vor** `deriveCostOfCapital` gesetzt; die bestehende Vorrangregel der Ableitung („manuelle CoE fließt in den WACC ein, manueller WACC bleibt stehen“) greift damit schon beim ersten Klick. Das Zurückschreiben danach bleibt als Absicherung.
     * Nach der Ableitung werden `wacc_components.derived.cost_of_equity` bzw. `.wacc` nachgeführt.
     * Ein in der Neuberechnung **abgeleiteter** WACC unterliegt derselben Untergrenze wie beim Import. Dazu ist die unveränderte Regel aus `applyDerivedFieldsV4` in `computeWaccFloorV4` ausgelagert und wird an beiden Stellen verwendet (keine Kopie, keine neue Formel). Rohwert und Untergrenze stehen wie beim Import in `_heuristicDetails.wacc_floor`; liegt der neue WACC darüber, entfällt das Kennzeichen. Manueller WACC: weiterhin keine Anhebung.
     * Keine neue WACC-Formel, keine Änderung an Bewertungsmodellen, Steuer-Einheit, TTM, Schuldenumfang oder Untergrenzen.
   * **Ergebnis auf `a6bb5d7`:** WACC vor der CoE-Änderung **8.9875 %**, nach dem ersten Klick **9.9875 %** („derived“, von DCF und Szenarien verwendet, `derived.wacc` gleich, Feld zeigt 9.9875), DCF-Basis 30.6615 — bitgleich (DCF, RIM, Spanne, Szenario-WACC) mit einem **unabhängig aufgebauten Referenzzustand**: frischer Import derselben Daten mit CoE 15 als „manual“. Weitere Klicks ändern nichts.
   * **Nachweis:** `tests/coe-wacc-recalc.test.mjs` (17, über `tests/recalc-harness.mjs`: produktiver Import, das von `renderAssumptions` geschriebene Formular, `recalcFromAssumptions`) und Browser §19 (18, echte Klicks und Tastatureingaben) sowie §18.C mit sachlicher Erwartung (bisher nur protokolliert). Abgedeckt: Fehlerfall erster Klick; zweiter und dritter Klick stabil; weitere CoE-Änderung 15 ⇒ 17 (10.9875 %) und 11 ⇒ Rohwert 7.9875 %, verwendet 8 % wie beim Import; bereits manuelle CoE + Kd 5 ⇒ 6 % (11.485 % bei CoE 17); ausdrücklich manueller WACC 11.25 bleibt bei CoE-, Kd- und Beta-Änderung; CoE 15 und WACC 12 im selben Klick (beide manuell, Bewertung mit 12/15); reine Kursänderung; Untergrenze beim Import bleibt bei unveränderten Klicks; Export „JSON herunterladen“ und Wiederimport mit Herkunft, danach zweimal „Neu berechnen“ ohne Wirkung; ohne Beta (heuristischer WACC) kein verzögerter Wechsel mehr.
   * **Rot/Grün:** auf `1bc4cec` Node 10 von 17 rot (Gegenproben 0, 1, 5, 6, 7, 8, 11b grün), Browser **315/324** (9 rot: 18.C, 19.1 ×2, 19.2, 19.3, 19.4, 19.F, 19.X ×2; Gegenproben 19.R, 19.0, 19.5, 19.6, 19.7 grün). Auf `a6bb5d7` 17/17 und 324/324. Bestehende Erwartungen unverändert.

## 8 · Anzeige, Export, Browser

**Browser.** Chromium **141.0.7390.37**, headless (`/opt/pw-browsers/chromium`), 1400×1000. Es lief ohne Netz außer den lokal bedienten SEC-Antworten; die Web-Fonts wurden abgewiesen.

**Abläufe auf `b3f0c1e`, auf `545427e`, auf dem Stand V1.0.86 (`5159e8c`) und auf V1.0.87 (`a6bb5d7`) wiederholt** (echte Klicks und Tastatureingaben):
* „Daten abrufen“ → „Daten übernehmen & berechnen“;
* Kurs im Reiter Annahmen eingegeben, „Neu berechnen“;
* alle Reiter (Übersicht, Qualität, Bewertung, Wachstum, Markt-Vergleich, Annahmen, SEC-Daten);
* Datenbasis FY → TTM → FY;
* „JSON herunterladen“, „Aktuelle Bewertung speichern“, Snapshots JSON und CSV;
* Wiederimport des Master-JSON in eine frische Seite.

**Ergebnisse:**
* Konsole: 0 Ausnahmen, keine Fehler außer der blockierten Web-Font. Diagnostische `console.warn` sind vorhanden.
* Kein „undefined“, „NaN“ oder „Infinity“.
* Keine veralteten Sperrgründe; das Sperrgrund-Paar vor der Kurseingabe („Kein Kurs verfügbar …“) ist korrekt.
* Replay „Anzeige ↔ Engine“ 58/58.
* Export: Unternehmen, Periode 2025-12-31, Einheiten (Mio. USD/Mio. Aktien), Annahmen (g₁, g_T, WACC, Steuer, RF/ERP), Ergebnisse (DCF, Spanne, Einstieg, MoS, Position, Urteil), Datenbasis mit Rückfallgründen und CSV mit Datennote B und QCE 8.89 stimmen mit der Anzeige überein.
* Wiederimport: alle Kennwerte identisch (DCF, RIM, DDM, Spanne, Einstieg, Tiefpreis, MoS, Reverse DCF, Z″, Piotroski).

**Steuerquote und kursunabhängige Werte vor und nach unverändertem „Neu berechnen“ (CRH; auf `545427e`, `5159e8c`, `1bc4cec` und `a6bb5d7` identisch).** Das Feld zeigt „21.71“ unter „Steuerquote (%)“. CRH ist hier ein Erhaltungstest: Der WACC ist heuristisch (9 %, kein Beta), die Steuerquote 21,71 % > 1. Niedrige Steuerquoten mit tatsächlich abgeleitetem WACC weist §7.5 nach (Browser §18).

| Zustand | Steuer | DCF Base / kons. / opt. | RIM | Spanne | Einstieg / Tiefpreis | MoS | Z″ / Piotroski | Reverse DCF |
|---|---|---|---|---|---|---|---|---|
| nach Import (ohne Kurs) | 21.71 | 91.680457 / 48.707964 / 152.105017 | 48.837720 | 43.2074 / 78.8276 / 128.7843 | — / 27.998398 | 0.352 | 3.555377 / 6 | — |
| Kurs 81.96, „Neu berechnen“ | 21.71 | gleich | gleich | gleich | 51.080308 / 27.998398 | 0.352 | gleich | 3.564850 |
| erneut „Neu berechnen“ (2×) | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |
| TTM angefordert / zurück FY | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |
| Wiederimport des Exports, dann „Neu berechnen“ | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |

„gleich“ heißt bitgleich zur Zeile darüber. Export `CRH_master.json`: `tax_rate` 21.71, Kurs 81.96, WACC 9 und CoE 10 „heuristic“, `derived.wacc` 9. Die Werte sind identisch mit denen auf `b3f0c1e`. Auf V1.0.87 (`a6bb5d7`) per Skript in Chromium 141 wiederholt (produktiver SEC-Weg mit Cache-Antworten, Kurs, 3× „Neu berechnen“, TTM ↔ FY, Inhalt von „JSON herunterladen“, Wiederimport in frische Seite, 2× „Neu berechnen“): alle Werte bitgleich, ebenso derselbe Lauf auf `1bc4cec`; 0 Ausnahmen. Nach dem Wiederimport ist die Liste der als manuell geführten Felder leer (Import setzt sie zurück, vorher g₁, g_T, Kurs, §9.1); Werte und Herkunftsflags unverändert.

**Nutzertest im tatsächlich verwendeten Browser: offen.** Browser und Version des Nutzers sind hier nicht belastbar bekannt; ein Chromium-Test gilt nicht als Test eines anderen Browsers. Es gibt zwei verschiedene Tests; nur der erste hat feste Erwartungswerte.

**A · Reproduzierter Auditdatenstand (feste Erwartungswerte).** Nur so sind die Zahlen unten verbindlich, denn nur dann sind Daten und Stichtag dieselben wie in der Abnahme.
* Voraussetzung: der Datenstand 2026-10-05 (Quell-Hashes §3), erzeugt mit `fetch-sources.mjs CRH --cutoff 2026-10-05` und `fetch-filings.mjs … --cutoff 2026-10-05`, im Browser über dieselbe lokale Bereitstellung wie im Replay. Wer das nicht einrichten kann, macht Test B.
1. main ab dem Merge von V1.0.87 auschecken (Produktdatei SHA-256 `0c56cef9…8501`; prüfbar mit `sha256sum`) und `us-aktienbewertungstool-v1036-sector-classification-patch.html` im eigenen Browser öffnen. „Yahoo“ aus.
2. Ticker `CRH`, „Daten abrufen“, „Daten übernehmen & berechnen“. Erwartet: „CRH PUBLIC LTD CO importiert und berechnet“, Übersicht mit „Kein Kurs verfügbar“.
3. Reiter **Annahmen**: Feld „Steuerquote (%)“ zeigt **21.71**. Kurs 81.96 eintragen, „Neu berechnen“. Erwartet in der Übersicht: Einstiegszone **51,08**, Basis **78,83**, Sicherheitsabschlag **35 %**, „Beobachten“; **kein** „market.price fehlt“.
4. Ohne Änderung noch zweimal „Neu berechnen“: Steuerquote bleibt **21.71**, DCF-Basiswert (Reiter **Bewertung**) bleibt **91.68**, Einstiegszone **51,08**.
5. Reiter **Bewertung**: MoS-Aufschlüsselung mit „Komposition (additiv wäre 40%)“. Reiter **Annahmen**: Kurs „manuell eingegeben“, Risk-free 4.30 %, ERP 5.50 %.
6. Datenbasis **TTM**: Warnkasten „TTM war angefordert, gerechnet wurde mit dem letzten Geschäftsjahr“ mit drei Gründen, Werte unverändert. Zurück auf FY.
7. „JSON herunterladen“ und Snapshot-Export; Dateien öffnen (`tax_rate` 21.71) und mit der Anzeige vergleichen. Master-JSON wieder importieren, „Neu berechnen“: Werte wie in Schritt 3.
8. Konsole (F12) auf Fehler prüfen; Umbrüche und abgeschnittene Texte bei der eigenen Fensterbreite ansehen.

**B · Aktueller Live-Import (keine festen Erwartungswerte).** Mit der normalen Datenverbindung liefert die SEC den Datenstand des Testtags. Spätere Filings (z. B. ein 10-Q Q3/2026 oder das 10-K FY2026) ändern Umsatz, Schulden, Fenster und damit alle Zahlen; die Werte aus A gelten dann **nicht**. Geprüft wird nur Verhalten:
* Import ohne Fehler, Datenbasis und Stichtag werden angezeigt;
* die angezeigte Steuerquote bleibt über zwei unveränderte „Neu berechnen“ gleich, der DCF-Basiswert ebenso;
* nur der Kurs geändert ⇒ Steuerquote, DCF, RIM und Spanne unverändert;
* Export und Wiederimport ergeben dieselben Werte wie die Anzeige;
* keine „undefined“, „NaN“ oder veralteten Sperrhinweise, Konsole ohne Fehler.

Browser, Version, Test (A oder B), Datum und Abweichungen bitte notieren. Erst danach gilt der Nutzertest als bestanden.

## 9 · Verbleibende Grenzen und Folgeaufträge (nicht behoben)

1. **Abgeleitete g₁/g_T werden nach „Neu berechnen“ als „manuell“ geführt.**
   * Ursache: Der Import-Schnappschuss wird vor der Heuristik genommen.
   * Bei CRH ohne Wertwirkung (Heuristik-Zuschlag bleibt +10 pp wegen des WACC). Bei abgeleitetem WACC könnte der Zuschlag von 3 pp entfallen.
   * Folgeauftrag: Semantik des Schnappschusses klären.
2. **TTM-Abdeckung.**
   * Ein Tagwechsel derselben Zeile zwischen 10-K und 10-Q (CRH CapEx) sowie ein veralteter erster Tag der Kette (CL CapEx, LMT Umsatz) verhindern TTM.
   * Kein falscher Wert, aber eine Designregel („kein Tag-Bridging“). Folgeauftrag mit Definitionsentscheidung.
   * Q4-Aktien und Q4-D&A fehlen bei vielen Filern; eine Lockerung ist nicht vorgesehen.
3. **Schuldenumfang.** Die produktive Regel verlangt Belege für alle fünf Zellen; mehrere Großunternehmen scheitern daran (CL, LMT, AMZN, UBER, LIN, GD). Die Sperren sind berechtigt; die Importabdeckung ist eine Folgefrage. Nicht gelockert.
4. **Auditwerkzeug `reconcile-sources`.**
   * Es vergleicht alle Schuldenfelder mit **einem** Umfangsbeleg. Bei CRH stehen daher die korrekten Bestandteile `long_term_debt` (4 Zeilen, Werte = Original) als „ABWEICHUNG“ und `total_debt` (Rebuild) als „offen“, obwohl der Umfang belegt ist.
   * Die Brücke ist durch `control-calcs` und `valuation-control` vollständig abgedeckt. Folgeauftrag: Werkzeug für Bestandteil gegen Brücke erweitern.
5. **Modellvereinfachungen** (ausgewiesen, unverändert):
   * Minderheiten (1,044 + 430 rückkaufbar ≈ 2.18 USD/Aktie) und Equity-Beteiligungen (502) bleiben in der Brücke unberücksichtigt.
   * Operating-Leasing ist nicht Teil der Nettoschulden.
   * Die Aktienbasis ist der gewichtete FY-Durchschnitt 677 statt der ausstehenden 665.3 Mio. (dei, 2026-07-20).
   * SBC ist im EBIT enthalten; es gibt keinen weiteren FCFF-Abzug.
6. **Kurs-Datum.** Für einen von Hand gesetzten Kurs setzt das Tool `price_as_of_date` = Datenstichtag (2026-10-05 statt 2026-10-02); ein Eingabefeld fehlt. Der Kurs selbst ist nicht primär verifiziert.
7. **Importlücken ohne Bewertungswirkung.** Zinsaufwand ist nur als `InterestExpenseNonoperating` getaggt (Zinsdeckung „nicht verfügbar“); gezahlte Dividenden fehlen unter einem Ketten-Tag.
8. **Kosmetik** (notiert, nicht behoben):
   * Versionsanzeige „V1.0.35-base-rate-lite“ (gepinnte Kennung);
   * abgeschnittene Auswahlfelder;
   * Piotroski-Überschrift „TTM vs. Vorjahr“ und Wachstums-Beschriftung „TTM“ bei FY-Werten;
   * ungerundete Growth-Szenariofelder;
   * veralteter Text `_owcDefinition` (Rechnung korrekt);
   * Snapshot-Felder `*_ttm` mit FY-Werten (daneben korrekt `latest_fy_*`, `data_basis`).
9. **Steuerquote-Altzustände.** Seit V1.0.85 wird ein gespeichertes `tax_rate` unter 1 nicht mehr umgedeutet: Ein vor V1.0.83 durch „Neu berechnen“ entstandener Bruch (z. B. 0.2171) oder ein Master-JSON mit `tax_rate: 0.21` wird als 0,2171 % bzw. 0,21 % angezeigt **und gerechnet**, auch nach „Neu berechnen“. Der Kern meldet solche Werte weiter als `unitWarnings` („sieht nach einem Bruch aus … bewusst NICHT still umgerechnet“). Abhilfe: Steuerquote im Feld in Prozent eintragen. Das ist die Folge der Vorgabe, die Einheit nicht aus der Größenordnung abzuleiten (AUDIT §13.22). Seit V1.0.86 gilt dasselbe für den WACC aus Komponenten.
10. ~~**WACC aus manueller CoE bei „Neu berechnen“.**~~ **Geschlossen mit V1.0.87 (§7.7)**, geprüft über den produktiven Neuberechnungspfad einschließlich des ersten Klicks (Node und Chromium). Bis V1.0.86 bildete `recalcFromAssumptions` den WACC beim ersten Klick aus der zuvor abgeleiteten CoE (Aufrufreihenfolge). Die frühere Grenze „WACC deutet `tax_rate` ≤ 1 als Bruch“ ist mit V1.0.86 behoben (§7.5).
11. **Zwei WACC-Ableitungen mit unterschiedlichen Voraussetzungen** (beobachtet bei §7.7, nicht geändert). `applyDerivedFieldsV4` (Import) bildet CoE und WACC nur mit RF, ERP **und Beta**, rechnet Größen- und Firmenaufschlag ein und normiert die Gewichte. `deriveCostOfCapital` (Neuberechnung) bildet den WACC auch ohne Beta, wenn die CoE manuell ist, ohne Aufschläge und ohne Normierung. Folge: Ohne Beta, aber mit Kd, Steuer und Gewichten wird bei manueller CoE in der Neuberechnung ein WACC abgeleitet, den ein Import desselben Stands nicht ableitet (dort heuristisch). Seit V1.0.87 geschieht das ab dem ersten Klick ohne spätere Änderung (Node-Test 11); bei CRH ohne Wirkung (kein Beta, kein Kd ⇒ WACC bleibt heuristisch, Test 11b). Folgeauftrag: Ableitungsregeln vereinheitlichen (fachliche Entscheidung).

## 10 · Ausgeführte Prüfungen

**Stand V1.0.87 (Korrektur CoE/WACC bei „Neu berechnen“).** Produktcommit `a6bb5d79aabeedccfeb017af96c73377527c547e`, Produktdatei SHA-256 `0c56cef948b23d9317ede5b0b4246b0cf4704a5a8a65c4bd41aa11ad23648501`, ohne lokale Änderung; Chromium 141.0.7390.37, `TMPDIR=/tmp/cb`. Quellen am 2026-10-12 mit `--cutoff 2026-10-05` neu geladen: Company Facts `bafbd0d6…3daa` und Submissions `7a90c486…abeb` **bytegleich zu §3** (0 Fakten nach dem Stichtag); die zehn iXBRL-Hauptdokumente haben bei diesem Abruf andere SHA-256 als in §3 (z. B. 10-K FY2025 `74cbbd63…5319`), alle 100 Belege sind darin unverändert bestätigt (`control-calcs`). Der Replay liest nur Company Facts und Submissions.

| Befehl | Ergebnis |
|---|---|
| `npm test` | 1700 Rechenprüfungen · Node 459/459 · Exit 0 (neu: `coe-wacc-recalc` 17) |
| `npm run test:audit-tool` | 58/58 · Exit 0 (unverändert) |
| `TMPDIR=/tmp/cb npm run test:browser` | 324/324 · Exit 0 (neu: §19 mit 18 Prüfungen, §18.C +1) |
| dieselben Suiten mit der Produktdatei von `1bc4cec` | Node-Datei `coe-wacc-recalc` 7/17 (10 rot, Gegenproben grün) · Browser 315/324 (9 rot) |
| `replay-import.mjs CRH --price 81.96` | Erfassung auf `a6bb5d7` (lokal geändert: nein) · Anzeige ↔ Engine 58/58 · Fundamentaldaten unverändert · Exit 0 |
| `control-calcs.mjs CRH` | 100/100 Belege · 39/39 · Fallprüfungen 7/7 · Exit 0 |
| `valuation-control.mjs CRH --product-commit a6bb5d7` | 26/26 · Erfassung passend · Zuordnung „gleicher Commit“ · Steuer 21.71 %, WACC 9, CoE 10, MoS 35.2 %, Einstieg 51.08 · Exit 0 |
| `valuation-control.mjs CRH --product-commit 1bc4cec` | Zuordnung nicht belegt (Produktdatei `6b6d865e…` ≠ erfasste `0c56cef9…`) · Exit 1 (Gegenprobe) |
| CRH-Ablauf in Chromium (Import, Kurs, 3× „Neu berechnen“, TTM ↔ FY, Export, Wiederimport, 2× „Neu berechnen“) | DCF 91.680457 / 48.707964 / 152.105017, RIM 48.837720, Spanne 43.2074 / 78.8276 / 128.7843, Einstieg 51.080308, Tiefpreis 27.998398, MoS 0.352 · alle Schritte bitgleich · auf `1bc4cec` bitgleich; Reverse DCF 3.56485 % aus dem Replay |

Die Kontrollrechnungen und Toleranzen sind unverändert. Nach dem Merge ist die Zuordnung gegen main zu bestätigen: `valuation-control.mjs CRH --product-commit origin/main` muss „inhaltsgleich“ melden (siehe PR).

**Stand nach dem zweiten Nachreview (V1.0.86)** (zum Vergleich). Produktdatei SHA-256 `6b6d865e617acb570f61cc65cec793743bb96303b022fe140f539d7aff283ccf` (Commit `0e9286a`), ohne lokale Änderung; Testsuiten auf dem finalen PR-Head (siehe PR):

| Befehl | Ergebnis |
|---|---|
| `npm test` | 1700 Rechenprüfungen · Node 442/442 · Exit 0 (neu: `wacc-tax-unit` 10) |
| `npm run test:audit-tool` | 58/58 · Exit 0 (neu: `valuation-control.binding` 10, `valuation-control` Test 8) |
| `TMPDIR=/tmp/cb npm run test:browser` | 305/305 · Exit 0 (neu: §18, 24 Prüfungen) |
| `replay-import.mjs CRH --price 81.96` | Erfassung auf `5159e8c` · Anzeige ↔ Engine 58/58 · Exit 0 |
| `replay-import.mjs CL --price 84.26` / `LMT --price 505.41` | Sperrfälle unverändert (DCF: „Nettoschulden nicht ermittelbar … Umfang unvollständig“) · 49/49 · Exit 0 |
| `control-calcs.mjs CRH` | 100/100 Belege · 39/39 · Fallprüfungen 7/7 · Exit 0 |
| `valuation-control.mjs CRH --product-commit 5159e8c` | 26/26 · Erfassung passend · Zuordnung „gleicher Commit“ · Exit 0 |
| `valuation-control.mjs CRH --product-commit 0e9286a` | 26/26 · Zuordnung „inhaltsgleich (anderer Commit, Produktdatei bytegleich)“ · Exit 0 |
| `valuation-control.mjs CRH --product-commit 29a5a21` / `545427e` | Zuordnung nicht belegt (Produktdatei `a49d96b7…` ≠ erfasste `6b6d865e…`) · Exit 1 (Gegenprobe) |
| `reconcile-sources.mjs CRH` | 162 korrekt · 4 offen · 4 Werkzeuggrenze (§9.4) · Exit 1 (unverändert) |
| Sichtprüfung, 3× „Neu berechnen“, TTM ↔ FY, Export und Wiederimport (Chromium 141) | alle Kennwerte bitgleich (§8) |

Nach dem Merge ist die Zuordnung gegen main zu bestätigen: `valuation-control.mjs CRH --product-commit origin/main` muss „inhaltsgleich“ melden (siehe PR).

**Stand V1.0.85** `545427e` (zum Vergleich): 1700 · 432/432 · 47/47 · 281/281; `valuation-control` 26/26 ohne Git-Zuordnung (§7.6).

**Vorheriger Stand** `b3f0c1e` (zum Vergleich): 1700 · 430/430 · 38/38 · 257/257; übrige Zeilen wie oben, `valuation-control` damals 26/26 mit sechs historischen Istwerten (§7.4).

**Reproduktion** (Cache nicht versioniert):

```sh
SEC_USER_AGENT="…" NODE_USE_ENV_PROXY=1 node tests/real-data/fetch-sources.mjs CRH --cutoff 2026-10-05
SEC_USER_AGENT="…" NODE_USE_ENV_PROXY=1 node tests/real-data/fetch-filings.mjs CRH --cutoff 2026-10-05 --since 2023-01-01
node tests/real-data/replay-import.mjs CRH --price 81.96
node tests/real-data/control-calcs.mjs CRH && node tests/real-data/valuation-control.mjs CRH --product-commit <abzunehmender Stand>
node tests/real-data/fixtures/make-valuation-control-capture.mjs CRH   # nur zum Erneuern der Testfixture
```

Die SHA-256 der Quelldateien stehen in §3. Spätere Filings werden durch `--cutoff` ausgeschlossen.
