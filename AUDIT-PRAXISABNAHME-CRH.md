# Praxisabnahme mit einem vollständigen Realdatenfall — CRH plc (FY2025)

**Urteil** (Stand nach dem Nachreview, V1.0.85; Produktstand `545427e9105db7e748a2f2eaa2986cf9a19ff265`, Produktdatei SHA-256 `a49d96b793d6cb35aba36b46107a429720a2c50f106c3b3f0d11aa7c81792bed`). Die Bereiche sind getrennt zu lesen:

| Bereich | Status | Umfang und Vorbehalt |
|---|---|---|
| **FY** (CRH plc, Geschäftsjahr 2025, Ende 2025-12-31) | **Ablauf und Rechenkonsistenz geprüft — unter den ausgewiesenen Annahmen und Vereinfachungen** | Produktiver SEC-Import → FY-Daten → DCF (Base/Konservativ/Optimistisch) → RIM → Synthese → Sicherheitsabschlag → Einstiegspreis → Anzeige → Export → Wiederimport. Werte unabhängig nachgerechnet (§6) gegen die **aktuelle** Erfassung des Endstands. WACC, CoE, g₁ und g_T sind heuristisch (§6); das ist eine Konsistenz-, keine Richtigkeitsaussage über die Annahmen. |
| **TTM** | **nicht abgenommen** | Fenster 2025-07-01 – 2026-06-30 richtig erkannt, Flussgrößen exakt; bewertet wurde zu Recht mit FY (ausgewiesener Rückfall, §5). Ein FY-Rückfall ist keine TTM-Abnahme. |
| **Nutzertest im tatsächlich verwendeten Browser** | **offen** | Geprüft wurde nur Chromium 141.0.7390.37 (headless) in dieser Umgebung (§8). |
| **Kursabhängige Ergebnisse** (Reverse DCF, Abstand zum Kurs, Einordnung „Beobachten/expensive“) | **nur unter der Kursannahme 81.96 USD geprüft** | Der Kurs ist nicht primär verifiziert (§3). Rechenweg geprüft, nicht der Kurs. |
| **Minderheiten, Equity-Beteiligungen, Operating-Leasing, Aktienbasis, SBC** | **abgegrenzt, nicht abgenommen** | Vereinfachungen der Brücke und des FCFF (§9.5), ausgewiesen und unverändert. |

Zusätzlich offen sind die Grenzen in §9 (u. a. Steuerquote-Altzustände und WACC-Ableitung, §9.9–9.10). Ein erfolgreicher Fall belegt diesen Ablauf für diese Daten. Er belegt weder die Zuverlässigkeit für andere Unternehmen noch allgemeine Modellgültigkeit oder Fehlerfreiheit; eine vollständige Produktfreigabe ist damit nicht verbunden. Kein Deployment.

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

**Unabhängige Kontrollrechnung.** `tests/real-data/valuation-control.mjs CRH`, ohne Produktcode, nur geprüfte Belege und die obigen Annahmen: **26/26 innerhalb der Toleranz, Erfassung passend** (Endstand `545427e`).
* **Sollseite:** eigene Formeln aus den gegen das Original-iXBRL geprüften Belegen und den Annahmen; kein Produktcode, kein Engine-Wert.
* **Istseite:** ausschließlich die **aktuelle** Replay-Erfassung desselben Laufs (`out/CRH-report.json`). Seit V1.0.85 gilt das auch für Altman Z″, Piotroski, g₁, Sicherheitsabschlag, Einstiegs- und tiefen Prüfpreis (`fy.valuationResults`, aus dem bewerteten Zustand erfasst). Bis V1.0.84 standen dort historische Werte (§7.4).
* **Erfassung dokumentiert und geprüft:** Produkt-Commit `545427e9105db7e748a2f2eaa2986cf9a19ff265`, Produktdatei SHA-256 `a49d96b7…2bed` ohne lokale Änderung, Unternehmen CRH, Datenbasis fy (angefordert und verwendet), Kurs 81.96, Steuer 21.71 %, WACC 9, CoE 10, g_T 2.5, Urteil investable_mid, Position expensive.
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
   * Nachweis: `tests/tax-rate-unit.test.mjs` 8/8 und Browser §17 (0 %, 0,5 %, 1 %, 21,71 %, 35 %; zweimal „Neu berechnen“ stabil; nur Kurs geändert ⇒ Steuer und kursunabhängige Werte stabil; bewusste Änderung auf 12.5 übernommen; −1, 150 und leer nicht übernommen; Export „JSON herunterladen“ und Wiederimport erhalten 0.5 %). Gegenlauf auf `beb041f`: Node 4 rot (Tests 2, 3, 3b, 3c), Gegenproben 1, 4, 5, 6 grün; Browser 267/281, 14 rot: 15.5 (0.3 ⇒ 30 %); 0 %, 0,5 % und 1 % (Anzeige bzw. Stabilität); Beschriftung bei 21,71 % und 35 % (alte Bezeichnung „Tax Rate (dez. oder %)“); 17.K, 17.E und 17.X (Ausgangswert 0,5 % wird zu 50 %). Gegenproben grün: Stabilität bei 21,71 % und 35 %, 15.4 (30 ⇒ 30 %), unzulässige Eingaben 17.U.
4. **Kontrollwerkzeug verglich sechs Werte mit historischen Zahlen** (Ursache im Auditwerkzeug, keine Produktwirkung).
   * `valuation-control.mjs` nahm für Altman Z″, Piotroski, g₁, Sicherheitsabschlag, Einstiegs- und tiefen Prüfpreis die Istwerte aus `evidence/CRH.json` (`engineObserved`, beobachtet auf `b3f0c1e`). Eine Änderung der Engine konnte diese Zeilen nicht rot machen.
   * Korrektur: `replay-import.mjs` erfasst die sechs Werte jetzt aus dem bewerteten Zustand (`fy.valuationResults`, mit Kurs, Steuer, WACC, CoE, g_T, Datenbasis, Urteil und Position) und schreibt Produktdatei-SHA-256 und Änderungsstatus in den Bericht. `valuation-control.mjs` vergleicht nur noch dagegen und prüft, ob die Erfassung passt (Ticker, Import, kein Selbsttest, Commit und Hash vorhanden, Produktdatei unverändert, Datenbasis, Kurs, WACC, CoE, g_T). Ein fehlender Wert ist ein fehlender Nachweis (keine 0, kein Rückfall). `engineObserved` bleibt nur als historischer Beleg und wird ausdrücklich nicht verglichen. Toleranzen unverändert.
   * Nachweis: `tests/real-data/valuation-control.test.mjs` 9/9 auf einer Teilmenge des echten Endstand-Laufs (`fixtures/valuation-control-capture.json`): jeder der sechs Werte knapp außerhalb der Toleranz in beide Richtungen ⇒ genau diese Zeile rot; innerhalb ⇒ grün; fehlend, `null`, `NaN` oder Text ⇒ fehlender Nachweis; 18 unpassende Metadaten ⇒ rot; historische Werte verdecken weder einen fehlenden noch einen abweichenden Wert. Gegenlauf mit dem Werkzeug von `beb041f` auf demselben Bericht: sechs Werte verfälscht ⇒ **26/26, Exit 0**; Erfassung entfernt ⇒ **26/26, Exit 0**. Neues Werkzeug: 20/26 mit sechs „ABWEICHUNG“ bzw. sechs „FEHLENDER NACHWEIS“, Exit 1.

## 8 · Anzeige, Export, Browser

**Browser.** Chromium **141.0.7390.37**, headless (`/opt/pw-browsers/chromium`), 1400×1000. Es lief ohne Netz außer den lokal bedienten SEC-Antworten; die Web-Fonts wurden abgewiesen.

**Abläufe auf `b3f0c1e`, auf dem Endstand `545427e` wiederholt** (echte Klicks und Tastatureingaben):
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

**Steuerquote und kursunabhängige Werte vor und nach unverändertem „Neu berechnen“ (Endstand `545427e`, CRH).** Das Feld zeigt „21.71“ unter „Steuerquote (%)“.

| Zustand | Steuer | DCF Base / kons. / opt. | RIM | Spanne | Einstieg / Tiefpreis | MoS | Z″ / Piotroski | Reverse DCF |
|---|---|---|---|---|---|---|---|---|
| nach Import (ohne Kurs) | 21.71 | 91.680457 / 48.707964 / 152.105017 | 48.837720 | 43.2074 / 78.8276 / 128.7843 | — / 27.998398 | 0.352 | 3.555377 / 6 | — |
| Kurs 81.96, „Neu berechnen“ | 21.71 | gleich | gleich | gleich | 51.080308 / 27.998398 | 0.352 | gleich | 3.564850 |
| erneut „Neu berechnen“ (2×) | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |
| TTM angefordert / zurück FY | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |
| Wiederimport des Exports, dann „Neu berechnen“ | 21.71 | gleich | gleich | gleich | gleich | gleich | gleich | gleich |

„gleich“ heißt bitgleich zur Zeile darüber. Export `CRH_master.json`: `tax_rate` 21.71, Kurs 81.96. Die Werte sind identisch mit denen auf `b3f0c1e`.

**Nutzertest im tatsächlich verwendeten Browser: offen.** Browser und Version des Nutzers sind hier nicht belastbar bekannt; ein Chromium-Test gilt nicht als Test eines anderen Browsers. Es gibt zwei verschiedene Tests; nur der erste hat feste Erwartungswerte.

**A · Reproduzierter Auditdatenstand (feste Erwartungswerte).** Nur so sind die Zahlen unten verbindlich, denn nur dann sind Daten und Stichtag dieselben wie in der Abnahme.
* Voraussetzung: der Datenstand 2026-10-05 (Quell-Hashes §3), erzeugt mit `fetch-sources.mjs CRH --cutoff 2026-10-05` und `fetch-filings.mjs … --cutoff 2026-10-05`, im Browser über dieselbe lokale Bereitstellung wie im Replay. Wer das nicht einrichten kann, macht Test B.
1. main ab `545427e` (oder dem Merge dieses Stands) auschecken und `us-aktienbewertungstool-v1036-sector-classification-patch.html` im eigenen Browser öffnen. „Yahoo“ aus.
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
9. **Steuerquote-Altzustände.** Seit V1.0.85 wird ein gespeichertes `tax_rate` unter 1 nicht mehr umgedeutet: Ein vor V1.0.83 durch „Neu berechnen“ entstandener Bruch (z. B. 0.2171) oder ein Master-JSON mit `tax_rate: 0.21` wird als 0,2171 % bzw. 0,21 % angezeigt **und gerechnet**, auch nach „Neu berechnen“. Der Kern meldet solche Werte weiter als `unitWarnings` („sieht nach einem Bruch aus … bewusst NICHT still umgerechnet“). Abhilfe: Steuerquote im Feld in Prozent eintragen. Das ist die Folge der Vorgabe, die Einheit nicht aus der Größenordnung abzuleiten (AUDIT §13.22).
10. **WACC-Komponentenableitung deutet `tax_rate` ≤ 1 weiter als Bruch.** `applyDerivedFieldsV4`, `deriveCostOfCapital` und `validateMasterJson` rechnen für den abgeleiteten WACC `tr > 1 ? tr : tr × 100`. Bei einer echten Steuerquote von 0–1 % weicht der abgeleitete WACC daher vom Kern ab (der Kern rechnet mit dem Prozentwert). Nicht geändert, weil die In-File-Fixtures `tax_rate` dort als Bruch führen (eine Umstellung brach 6 Rechenprüfungen: T-BRL1b, GT-3, Chat9 P75) und weil der Auftrag die übrigen WACC-Einheiten ausschließt. Bei CRH ohne Wirkung (WACC heuristisch, Steuer 21.71 %). Folgeauftrag: Einheit der WACC-Ableitung und der Fixtures vereinheitlichen.

## 10 · Ausgeführte Prüfungen

**Endstand nach dem Nachreview** (Produktstand `545427e9105db7e748a2f2eaa2986cf9a19ff265`, Produktdatei ohne lokale Änderung; die Testläufe der Testsuiten auf dem finalen PR-Head, siehe PR):

| Befehl | Ergebnis |
|---|---|
| `npm test` | 1700 Rechenprüfungen · Node 432/432 · Exit 0 |
| `npm run test:audit-tool` | 47/47 · Exit 0 (neu: `valuation-control.test.mjs` 9) |
| `TMPDIR=/tmp/cb npm run test:browser` | 281/281 · Exit 0 (neu: §17, 24 Prüfungen) |
| `replay-import.mjs CRH --price 81.96` | Import ok · Anzeige ↔ Engine 58/58 · `valuationResults` erfasst · Exit 0 |
| `replay-import.mjs CL --price 84.26` / `LMT --price 505.41` | Sperrfälle unverändert (DCF: „Nettoschulden nicht ermittelbar … Umfang unvollständig“) · 49/49 · Exit 0 |
| `control-calcs.mjs CRH` | 100/100 Belege · 39/39 · Fallprüfungen 7/7 · Exit 0 |
| `valuation-control.mjs CRH` | 26/26 gegen die aktuelle Erfassung · Erfassung passend · Exit 0 |
| `reconcile-sources.mjs CRH` | 162 korrekt · 4 offen · 4 Werkzeuggrenze (§9.4) · Exit 1 (unverändert) |
| Sichtprüfung, Steuer-Rundlauf, Export und Wiederimport (Chromium 141) | siehe §8 |

**Vorheriger Stand** `b3f0c1e` (zum Vergleich): 1700 · 430/430 · 38/38 · 257/257; übrige Zeilen wie oben, `valuation-control` damals 26/26 mit sechs historischen Istwerten (§7.4).

**Reproduktion** (Cache nicht versioniert):

```sh
SEC_USER_AGENT="…" NODE_USE_ENV_PROXY=1 node tests/real-data/fetch-sources.mjs CRH --cutoff 2026-10-05
SEC_USER_AGENT="…" NODE_USE_ENV_PROXY=1 node tests/real-data/fetch-filings.mjs CRH --cutoff 2026-10-05 --since 2023-01-01
node tests/real-data/replay-import.mjs CRH --price 81.96
node tests/real-data/control-calcs.mjs CRH && node tests/real-data/valuation-control.mjs CRH
node tests/real-data/fixtures/make-valuation-control-capture.mjs CRH   # nur zum Erneuern der Testfixture
```

Die SHA-256 der Quelldateien stehen in §3. Spätere Filings werden durch `--cutoff` ausgeschlossen.
