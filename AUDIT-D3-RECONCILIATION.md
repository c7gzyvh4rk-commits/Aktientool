# D3 · Quellenbelege und Abgleichstabellen MCD / JNJ (Anhang zu AUDIT-REAL-DATA-MCD-JNJ.md §13)

Erzeugt am Produktstand V1.0.74 (Arbeitsbaum auf `04d8c83` + D3-Korrekturen, Produktdatei
SHA-256 `997ad2dc7d395cb9…`), Datenstichtag 2026-09-24, mit

```sh
node tests/real-data/control-calcs.mjs MCD JNJ --md …      # Quellenkette, Belege, Kontrollrechnungen
node tests/real-data/reconcile-sources.mjs MCD JNJ --md …  # ganze FY-Historie gegen Company Facts und Original
```

Inhalt: (1) Quellenkette, (2) Fundstellen aller Belege — jeder Posten im
unveraenderten Originaldokument gefunden (Konzept, Kontext, angezeigter Wert;
`decimals` wie im iXBRL deklariert), (3) Abgleich JEDES erfassten Jahreswerts
(nicht nur der ersten drei) der Erfassung `fy`. Die Falltabellen FY/TTM stehen im
Auditbericht §13.3.

Spalten im Historienabgleich: *Rechnung* = Company Facts (juengster 10-K-Fakt,
Akte des Tools) bzw. Rechenweg; *Original* = derselbe Fakt im zitierten
Originalbericht (Zeile = Fundstelle); *Umfang* = fachliche Vollstaendigkeit
(D&A: Gesamt-D&A; Schulden: laut Anhang), getrennt von der Rechnung. `·` = nicht
anwendbar/nicht belegbar.

## 1 · Quellenkette


| Datei | Form · Akte | Periode | eingereicht | abgerufen | SHA-256 | URL |
|---|---|---|---|---|---|---|
| CIK0000063908.companyfacts.raw.json | Original | — | — | 2026-09-28T19:51:54.197Z | 0394e814d75510be… | https://data.sec.gov/api/xbrl/companyfacts/CIK0000063908.json |
| CIK0000063908.submissions.json | Original | — | — | 2026-09-28T19:51:54.309Z | 49c70ef3dbb1e9b7… | https://data.sec.gov/submissions/CIK0000063908.json |
| CIK0000063908.companyfacts.json | Ableitung von CIK0000063908.companyfacts.raw.json (Stichtag 2026-09-24, entfernt 0) | — | — | — | 0394e814d75510be… | — |
| CIK0000200406.companyfacts.raw.json | Original | — | — | 2026-09-28T19:51:57.527Z | 7141c0c988fa1d30… | https://data.sec.gov/api/xbrl/companyfacts/CIK0000200406.json |
| CIK0000200406.submissions.json | Original | — | — | 2026-09-28T19:51:57.813Z | 93b22128a43b4f39… | https://data.sec.gov/submissions/CIK0000200406.json |
| CIK0000200406.companyfacts.json | Ableitung von CIK0000200406.companyfacts.raw.json (Stichtag 2026-09-24, entfernt 0) | — | — | — | 7141c0c988fa1d30… | — |
| mcd-20260630.htm | MCD 10-Q 0000063908-26-000073 | 2026-06-30 | 2026-08-07 | 2026-09-28T19:52:39.497Z | d57304388a7d7007… | https://www.sec.gov/Archives/edgar/data/63908/000006390826000073/mcd-20260630.htm |
| mcd-20260331.htm | MCD 10-Q 0000063908-26-000051 | 2026-03-31 | 2026-05-07 | 2026-09-28T19:52:39.892Z | f26c173bbcf32993… | https://www.sec.gov/Archives/edgar/data/63908/000006390826000051/mcd-20260331.htm |
| mcd-20251231.htm | MCD 10-K 0000063908-26-000035 | 2025-12-31 | 2026-02-24 | 2026-09-28T20:00:24.235Z | 8cd064cb2e8c79a5… | https://www.sec.gov/Archives/edgar/data/63908/000006390826000035/mcd-20251231.htm |
| mcd-20250930.htm | MCD 10-Q 0000063908-25-000059 | 2025-09-30 | 2025-11-05 | 2026-09-28T19:52:40.799Z | 8c570d8ac5c99243… | https://www.sec.gov/Archives/edgar/data/63908/000006390825000059/mcd-20250930.htm |
| mcd-20250630.htm | MCD 10-Q 0000063908-25-000039 | 2025-06-30 | 2025-08-06 | 2026-09-28T19:52:41.195Z | bff739211444807b… | https://www.sec.gov/Archives/edgar/data/63908/000006390825000039/mcd-20250630.htm |
| jnj-20260628.htm | JNJ 10-Q 0000200406-26-000153 | 2026-06-28 | 2026-07-23 | 2026-09-28T19:52:41.658Z | e346422fb440cb4e… | https://www.sec.gov/Archives/edgar/data/200406/000020040626000153/jnj-20260628.htm |
| jnj-20260329.htm | JNJ 10-Q 0000200406-26-000087 | 2026-03-29 | 2026-04-22 | 2026-09-28T19:52:42.073Z | 905626dd273a3d24… | https://www.sec.gov/Archives/edgar/data/200406/000020040626000087/jnj-20260329.htm |
| jnj-20251228.htm | JNJ 10-K 0000200406-26-000016 | 2025-12-28 | 2026-02-11 | 2026-09-28T20:00:29.849Z | 40d880bd65db3392… | https://www.sec.gov/Archives/edgar/data/200406/000020040626000016/jnj-20251228.htm |
| jnj-20250928.htm | JNJ 10-Q 0000200406-25-000209 | 2025-09-28 | 2025-10-22 | 2026-09-28T19:52:42.967Z | 90b1ec9649d704e2… | https://www.sec.gov/Archives/edgar/data/200406/000020040625000209/jnj-20250928.htm |
| jnj-20250629.htm | JNJ 10-Q 0000200406-25-000178 | 2025-06-29 | 2025-07-24 | 2026-09-28T19:52:43.391Z | ab381b176c320009… | https://www.sec.gov/Archives/edgar/data/200406/000020040625000178/jnj-20250629.htm |
| mcd-20241231.htm | MCD 10-K 0000063908-25-000012 | 2024-12-31 | 2025-02-25 | 2026-09-28T20:00:24.907Z | b0e91e24d6c8ada1… | https://www.sec.gov/Archives/edgar/data/63908/000006390825000012/mcd-20241231.htm |
| mcd-20231231.htm | MCD 10-K 0000063908-24-000072 | 2023-12-31 | 2024-02-22 | 2026-09-28T20:00:25.335Z | b2eebf3084ce0354… | https://www.sec.gov/Archives/edgar/data/63908/000006390824000072/mcd-20231231.htm |
| mcd-20221231.htm | MCD 10-K 0000063908-23-000012 | 2022-12-31 | 2023-02-24 | 2026-09-28T20:00:25.799Z | b8b8b3d137701056… | https://www.sec.gov/Archives/edgar/data/63908/000006390823000012/mcd-20221231.htm |
| mcd-20211231.htm | MCD 10-K 0000063908-22-000011 | 2021-12-31 | 2022-02-24 | 2026-09-28T20:00:26.223Z | 2c9188edbf8dd15a… | https://www.sec.gov/Archives/edgar/data/63908/000006390822000011/mcd-20211231.htm |
| mcd-20201231.htm | MCD 10-K 0000063908-21-000013 | 2020-12-31 | 2021-02-23 | 2026-09-28T20:00:26.782Z | 18aea1f97594ccea… | https://www.sec.gov/Archives/edgar/data/63908/000006390821000013/mcd-20201231.htm |
| mcd-12312019x10k.htm | MCD 10-K 0000063908-20-000022 | 2019-12-31 | 2020-02-26 | 2026-09-28T20:00:27.250Z | 42e790619c5b6f1e… | https://www.sec.gov/Archives/edgar/data/63908/000006390820000022/mcd-12312019x10k.htm |
| mcd-12312018x10k.htm | MCD 10-K 0000063908-19-000010 | 2018-12-31 | 2019-02-22 | 2026-09-28T20:00:27.711Z | 3bd1cf78e2a0c776… | https://www.sec.gov/Archives/edgar/data/63908/000006390819000010/mcd-12312018x10k.htm |
| mcd-12312017x10k.htm | MCD 10-K 0000063908-18-000010 | 2017-12-31 | 2018-02-23 | 2026-09-28T20:00:28.175Z | 4130fd93ec420178… | https://www.sec.gov/Archives/edgar/data/63908/000006390818000010/mcd-12312017x10k.htm |
| mcd-12312016x10k.htm | MCD 10-K 0000063908-17-000017 | 2016-12-31 | 2017-03-01 | 2026-09-28T20:00:28.612Z | f999ea6d014641b7… | https://www.sec.gov/Archives/edgar/data/63908/000006390817000017/mcd-12312016x10k.htm |
| mcd-20161231.xml | MCD 10-K 0000063908-17-000017 | 2016-12-31 | 2017-03-01 | 2026-09-28T20:00:29.402Z | d111f2e3f6f61427… | https://www.sec.gov/Archives/edgar/data/63908/000006390817000017/mcd-20161231.xml |
| jnj-20241229.htm | JNJ 10-K 0000200406-25-000038 | 2024-12-29 | 2025-02-13 | 2026-09-28T20:00:30.337Z | 2f3b110d6210f7b3… | https://www.sec.gov/Archives/edgar/data/200406/000020040625000038/jnj-20241229.htm |
| jnj-20231231.htm | JNJ 10-K 0000200406-24-000013 | 2023-12-31 | 2024-02-16 | 2026-09-28T20:00:30.809Z | 5f18ceee236cf563… | https://www.sec.gov/Archives/edgar/data/200406/000020040624000013/jnj-20231231.htm |
| jnj-20230101.htm | JNJ 10-K 0000200406-23-000016 | 2023-01-01 | 2023-02-16 | 2026-09-28T20:00:31.317Z | ff5fbbe3b4a3b9a2… | https://www.sec.gov/Archives/edgar/data/200406/000020040623000016/jnj-20230101.htm |
| jnj-20220102.htm | JNJ 10-K 0000200406-22-000022 | 2022-01-02 | 2022-02-17 | 2026-09-28T20:00:31.869Z | 632d8ec69c8c4cd2… | https://www.sec.gov/Archives/edgar/data/200406/000020040622000022/jnj-20220102.htm |
| jnj-20210103.htm | JNJ 10-K 0000200406-21-000008 | 2021-01-03 | 2021-02-22 | 2026-09-28T20:00:32.439Z | 8f96ef70c5413b33… | https://www.sec.gov/Archives/edgar/data/200406/000020040621000008/jnj-20210103.htm |
| form10-k20191229.htm | JNJ 10-K 0000200406-20-000010 | 2019-12-29 | 2020-02-18 | 2026-09-28T20:00:32.967Z | c253242520f2254a… | https://www.sec.gov/Archives/edgar/data/200406/000020040620000010/form10-k20191229.htm |
| form10-k20181230.htm | JNJ 10-K 0000200406-19-000009 | 2018-12-30 | 2019-02-20 | 2026-09-28T20:00:33.518Z | 1df8c8fa85b13b76… | https://www.sec.gov/Archives/edgar/data/200406/000020040619000009/form10-k20181230.htm |
| jnj-20181230.xml | JNJ 10-K 0000200406-19-000009 | 2018-12-30 | 2019-02-20 | 2026-09-28T20:00:34.389Z | 974509dacc9c44f1… | https://www.sec.gov/Archives/edgar/data/200406/000020040619000009/jnj-20181230.xml |
| mcd-20111231.xml | MCD 10-K 0001193125-12-077317 | 2012-01-31 (juengstes Periodenende der Akte in Company Facts) | 2012-02-24 | 2026-09-28T20:03:12.049Z | f742804de17b8c88… | https://www.sec.gov/Archives/edgar/data/63908/000119312512077317/mcd-20111231.xml |
| jnj-20171231.xml | JNJ 10-K 0000200406-18-000005 | 2018-02-16 (juengstes Periodenende der Akte in Company Facts) | 2018-02-21 | 2026-09-28T20:03:30.755Z | d76f1fef48694d45… | https://www.sec.gov/Archives/edgar/data/200406/000020040618000005/jnj-20171231.xml |
| jnj-20110102.xml | JNJ 10-K 0000950123-11-018128 | 2011-02-15 (juengstes Periodenende der Akte in Company Facts) | 2011-02-25 | 2026-09-28T20:03:52.226Z | 34b3ed1a8750a3e4… | https://www.sec.gov/Archives/edgar/data/200406/000095012311018128/jnj-20110102.xml |
| mcd-20121231.xml | MCD 10-K 0000063908-13-000010 | 2013-01-31 (juengstes Periodenende der Akte in Company Facts) | 2013-02-25 | 2026-09-28T20:12:55.960Z | 4c034c12e13fb1b4… | https://www.sec.gov/Archives/edgar/data/63908/000006390813000010/mcd-20121231.xml |

## 2 · Fundstellen der Belege

### MCD Fundstellen der Belege

| Beleg | Wert | Dokument | Fundstelle | decimals | ✓ |
|---|---|---|---|---|---|
| fy.revenue | 26,885 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV (Consolidated Statement of Income), „Total revenues“ — Zeile „Total revenues“ | -6 | ✓ |
| fy.ebit | 12,393 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Operating income“ — Zeile „Operating income“ | -6 | ✓ |
| fy.da_total | 2,199 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Kapitalflussrechnung, „Depreciation and amortization“ (Gesamtbetrag) — Zeile „Depreciation and amortization“ | -5/-6 | ✓ |
| fy.da_sga | 457 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, unter „Selling, general & administrative expenses“: „Depreciation and amortization“ (nur SG&A-Teilposten; Restaurant-D&A steckt in den Restaurantkosten, Lagebericht: „Total restaurant margins included depreciation and amortization expense of $1.7 billion“) — Zeile „Depreciation and amortization“ | -6 | ✓ |
| fy1.da_total | 2,097 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Kapitalflussrechnung, Vorjahresspalte 2024 — Zeile „Depreciation and amortization“ | -5/-6 | ✓ |
| fy2.da_total | 1,978 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Kapitalflussrechnung, Spalte 2023 — Zeile „Depreciation and amortization“ | -5/-6 | ✓ |
| fy.interest | 1,582 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Interest expense-net of capitalized interest“ — Zeile „Interest expense-net of capitalized interest of $ 29 , $ 22 “ | -6 | ✓ |
| fy.tax | 2,334 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Provision for income taxes“ — Zeile „Provision for income taxes“ | -6/-5 | ✓ |
| fy.ni | 8,563 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Net income“ — Zeile „Net income“ | -6/-5 | ✓ |
| fy.eps | 11.95 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Earnings per common share–diluted“ — Zeile „Earnings per common share–diluted“ | 2 | ✓ |
| fy.dps | 7.17 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Dividends declared per common share“ — Zeile „Dividends declared per common share“ | 2 | ✓ |
| fy.sh_dil | 716.4 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Weighted-average shares outstanding–diluted“ (Tabelle „In millions“; XBRL-Fakt mit scale 0 = 716.4 Stueck, Filer-Skalierungsfehler F-4) — Zeile „Weighted-average shares outstanding–diluted“ | 1 | ✓ |
| fy.sh_basic | 713.4 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | GuV, „Weighted-average shares outstanding–basic“ — Zeile „Weighted-average shares outstanding–basic“ | 1 | ✓ |
| fy.cfo | 10,551 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | KFR, „Cash provided by operations“ — Zeile „Cash provided by operations“ | -5 | ✓ |
| fy.capex | 3,365 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | KFR, „Capital expenditures“ — Zeile „Capital expenditures“ | -5/-6 | ✓ |
| fy.div | 5,115 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | KFR, „Common stock dividends“ — Zeile „Common stock dividends“ | -5 | ✓ |
| fy.buyback | 2,056 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | KFR, „Treasury stock purchases“ — Zeile „Treasury stock purchases“ | -5 | ✓ |
| fy.sbc | 165 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | KFR, „Share-based compensation“ — Zeile „Share-based compensation“ | -5 | ✓ |
| bs.cash | 774 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Bilanz, „Cash and equivalents“ — Zeile „Cash and equivalents“ | -6 | ✓ |
| bs.ltd | 39,973 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Bilanz, „Long-term debt“ (einzige Finanzschuldenzeile der Bilanz) — Zeile „Long-term debt“ | -6 | ✓ |
| note.debt_total | 39,973 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Debt Financing“, Tabelle „Total debt obligations“ — Zeile „Total debt obligations“ | -8/-6 | ✓ |
| note.cp | 798 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Debt Financing“: „$798 million of short-term borrowings and $725 million of current maturities of other debt obligations, were classified as Long-term debt … supported by a long-term line of credit agreement expiring in June 2028“ (in 39,973 enthalten) | -6 | ✓ |
| note.ltd_cur | 725 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Debt Financing“, gleicher Satz (in 39,973 enthalten) | -6 | ✓ |
| note.fl_cur | 23 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Leasing Arrangements“, Tabelle Finance „Current lease liability“ — Zeile „Current lease liability“ | -5 | ✓ |
| note.fl_noncur | 2,329 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Leasing Arrangements“, Finance „Long-term lease liability“ — Zeile „Long-term lease liability“ | -5 | ✓ |
| note.ol_cur | 671 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Leasing Arrangements“, Operating „Current lease liability“ (nur mit Dimension getaggt) — Zeile „Current lease liability“ | -6 | ✓ |
| note.ol_noncur | 11,817 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Anhang „Leasing Arrangements“, Operating „Long-term lease liability“ (nur mit Dimension getaggt) — Zeile „Long-term lease liability“ | -6 | ✓ |
| bs.equity | -1,791 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Bilanz, „Total shareholders’ equity (deficit)“ (1,791) — Zeile „Total shareholders’ equity (deficit)“ | -6/-5 | ✓ |
| bs.assets | 59,515 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | Bilanz, „Total assets“ — Zeile „Total assets“ | -6 | ✓ |
| h126.revenue | 13,616 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, Six Months Ended 2026, „Total revenues“ — Zeile „Total revenues“ | -6 | ✓ |
| h125.revenue | 12,799 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, Six Months Ended 2025 — Zeile „Total revenues“ | -6 | ✓ |
| h126.ebit | 6,292 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, „Operating income“, 6M 2026 — Zeile „Operating income“ | -6 | ✓ |
| h125.ebit | 5,880 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2025 — Zeile „Operating income“ | -6 | ✓ |
| h126.da | 1,131 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, „Depreciation and amortization“, 6M 2026 — Zeile „Depreciation and amortization“ | -5/-6 | ✓ |
| h125.da | 1,064 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, 6M 2025 — Zeile „Depreciation and amortization“ | -5/-6 | ✓ |
| h126.cfo | 5,222 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, „Cash provided by operations“, 6M 2026 — Zeile „Cash provided by operations“ | -5 | ✓ |
| h125.cfo | 4,426 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, 6M 2025 — Zeile „Cash provided by operations“ | -5 | ✓ |
| h126.capex | 1,516 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, „Capital expenditures“, 6M 2026 — Zeile „Capital expenditures“ | -5/-6 | ✓ |
| h125.capex | 1,295 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, 6M 2025 — Zeile „Capital expenditures“ | -5/-6 | ✓ |
| h126.ni | 4,345 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, „Net income“, 6M 2026 — Zeile „Net income“ | -5 | ✓ |
| h125.ni | 4,121 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2025 — Zeile „Net income“ | -6/-5 | ✓ |
| h126.div | 2,640 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, „Common stock dividends“, 6M 2026 — Zeile „Common stock dividends“ | -5 | ✓ |
| h125.div | 2,530 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, 6M 2025 — Zeile „Common stock dividends“ | -5 | ✓ |
| h126.dps | 3.72 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, „Dividends declared per common share“, 6M 2026 — Zeile „Dividends declared per common share“ | 2 | ✓ |
| h125.dps | 3.54 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2025 — Zeile „Dividends declared per common share“ | 2 | ✓ |
| h126.interest | 809 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, „Interest expense“, 6M 2026 — Zeile „Interest expense“ | -6 | ✓ |
| h125.interest | 766 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2025 — Zeile „Interest expense“ | -6 | ✓ |
| h126.eps | 6.1 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2026 — Zeile „Earnings per common share-diluted“ | 2 | ✓ |
| h125.eps | 5.74 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2025 — Zeile „Earnings per common share-diluted“ | 2 | ✓ |
| h126.sh_dil | 712.3 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, 6M 2026 — Zeile „Weighted-average shares outstanding-diluted“ | 1 | ✓ |
| q226.revenue | 7,099 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, Quarter Ended 2026 — Zeile „Total revenues“ | -6 | ✓ |
| q226.ebit | 3,338 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 GuV, Quarter 2026 (iXBRL decimals −5 in der GuV, −6 in der Segmenttabelle) — Zeile „Operating income“ | -5/-6 | ✓ |
| q226.cfo | 2,807 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, Quarter 2026 (direkt gemeldet) — Zeile „Cash provided by operations“ | -5 | ✓ |
| q226.capex | 831 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 KFR, Quarter 2026 — Zeile „Capital expenditures“ | -5/-6 | ✓ |
| q126.ebit | 2,953 | 10-Q 0000063908-26-000051 (mcd-20260331.htm, eingereicht 2026-05-07, sha256 f26c173bbcf3…) | 10-Q Q1/2026 GuV, „Operating income“ — Zeile „Operating income“ | -5/-6 | ✓ |
| q126.cfo | 2,412 | 10-Q 0000063908-26-000051 (mcd-20260331.htm, eingereicht 2026-05-07, sha256 f26c173bbcf3…) | 10-Q Q1/2026 KFR — Zeile „Cash provided by operations“ | -5 | ✓ |
| q126.capex | 682 | 10-Q 0000063908-26-000051 (mcd-20260331.htm, eingereicht 2026-05-07, sha256 f26c173bbcf3…) | 10-Q Q1/2026 KFR — Zeile „Capital expenditures“ | -5/-6 | ✓ |
| q126.revenue | 6,517 | 10-Q 0000063908-26-000051 (mcd-20260331.htm, eingereicht 2026-05-07, sha256 f26c173bbcf3…) | 10-Q Q1/2026 GuV — Zeile „Total revenues“ | -5/-6 | ✓ |
| q325.revenue | 7,078 | 10-Q 0000063908-25-000059 (mcd-20250930.htm, eingereicht 2025-11-05, sha256 8c570d8ac5c9…) | 10-Q Q3/2025 GuV, Quarter 2025 — Zeile „Total revenues“ | -6 | ✓ |
| m925.revenue | 19,876 | 10-Q 0000063908-25-000059 (mcd-20250930.htm, eingereicht 2025-11-05, sha256 8c570d8ac5c9…) | 10-Q Q3/2025 GuV, Nine Months 2025 — Zeile „Total revenues“ | -6 | ✓ |
| bs26.cash | 822 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz, „Cash and equivalents“ — Zeile „Cash and equivalents“ | -6 | ✓ |
| bs26.ltd | 39,863 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz, „Long-term debt“ (einzige Finanzschuldenzeile; kein LongTermDebt-Tag, kein Anhangssatz zur Umklassifizierung) — Zeile „Long-term debt“ | -6 | ✓ |
| bs26.lease_cur | 690 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz, „Lease liability“ — Gesamtbetrag Operating + Finance, aber als OperatingLeaseLiabilityCurrent getaggt; keine Aufteilung im 10-Q — Zeile „Lease liability“ | -6 | ✓ |
| bs26.lease_noncur | 14,039 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz, „Long-term lease liability“ — ebenso Gesamtbetrag — Zeile „Long-term lease liability“ | -6 | ✓ |
| bs26.equity | -1,023 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz, „Total shareholders’ equity (deficit)“ — Zeile „Total shareholders’ equity (deficit)“ | -6/-5 | ✓ |
| bs26.ca | 4,345 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz — Zeile „Total current assets“ | -6 | ✓ |
| bs26.cl | 4,018 | 10-Q 0000063908-26-000073 (mcd-20260630.htm, eingereicht 2026-08-07, sha256 d57304388a7d…) | 10-Q Q2/2026 Bilanz — Zeile „Total current liabilities“ | -6 | ✓ |
| fy1.debt_total | 38,424 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | 10-K FY2025 Anhang „Debt Financing“, Vorjahresspalte „Total debt obligations“ — Zeile „Total debt obligations“ | -6 | ✓ |
| fy1.cash | 1,085 | 10-K 0000063908-26-000035 (mcd-20251231.htm, eingereicht 2026-02-24, sha256 8cd064cb2e8c…) | 10-K FY2025 Bilanz, Vorjahresspalte — Zeile „Cash and equivalents“ | -6 | ✓ |
| fy1.fl_cur | 11 | 10-K 0000063908-25-000012 (mcd-20241231.htm, eingereicht 2025-02-25, sha256 b0e91e24d6c8…) | 10-K FY2024 Anhang „Leasing Arrangements“, Finance „Current lease liability“ — Zeile „Current lease liability“ | -5 | ✓ |
| fy1.fl_noncur | 1,770 | 10-K 0000063908-25-000012 (mcd-20241231.htm, eingereicht 2025-02-25, sha256 b0e91e24d6c8…) | 10-K FY2024 Anhang „Leasing Arrangements“, Finance „Long-term lease liability“ — Zeile „Long-term lease liability“ | -5 | ✓ |
| fy1.reclass | — | 10-K 0000063908-25-000012 (mcd-20241231.htm, eingereicht 2025-02-25, sha256 b0e91e24d6c8…) | 10-K FY2024 Anhang „Debt Financing“ (in 38,424 enthalten) | — | ✓ |


### JNJ Fundstellen der Belege

| Beleg | Wert | Dokument | Fundstelle | decimals | ✓ |
|---|---|---|---|---|---|
| fy.revenue | 94,193 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV (Consolidated statements of earnings), „Sales to customers“ — Zeile „Sales to customers“ | -6 | ✓ |
| fy.gross | 63,937 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Gross profit“ — Zeile „Gross profit“ | -6 | ✓ |
| fy.pretax | 32,581 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Earnings before provision for taxes on income“ (keine Operating-Income-Zeile) — Zeile „Earnings before provision for taxes on income“ | -6 | ✓ |
| fy.int_exp | 971 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Interest expense, net of portion capitalized“ — Zeile „Interest expense, net of portion capitalized (Note 4)“ | -6 | ✓ |
| fy.int_inc | 1,056 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Interest income“ (1,056) — Zeile „Interest income“ | -6 | ✓ |
| fy.other | 7,209 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Other (income) expense, net“ (7,209) = Ertrag; Lagebericht: darin Rueckstellungsaufloesung Talk ca. 7.0 Mrd., Auris-Vergleich 0.8 Mrd. Aufwand — Zeile „Other (income) expense, net“ | -6 | ✓ |
| fy.restr | 228 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Restructuring“ — Zeile „Restructuring (Note 20)“ | -6 | ✓ |
| fy.tax | 5,777 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Provision for taxes on income“ — Zeile „Provision for taxes on income (Note 8)“ | -6 | ✓ |
| fy.ni | 26,804 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Net earnings“ — Zeile „Net earnings“ | -6 | ✓ |
| fy.eps | 11.03 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Total net earnings per share - diluted“ — Zeile „Total net earnings per share - diluted“ | 2 | ✓ |
| fy.sh_dil | 2,429.4 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | GuV, „Average shares outstanding – Diluted“ — Zeile „Diluted“ | -5 | ✓ |
| fy.dps | 5.14 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Eigenkapitalveraenderungsrechnung, „Cash dividends paid ($5.14 per share)“ — Zeile „Cash dividends paid ($ 5.14 per share)“ | INF/2 | ✓ |
| fy.da | 7,503 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Depreciation and amortization of property and intangibles“ (einziger D&A-Posten der KFR) — Zeile „Depreciation and amortization of property and intangibles“ | -6 | ✓ |
| fy.cfo | 24,530 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Net cash flows from operating activities“ — Zeile „Net cash flows from operating activities“ | -6 | ✓ |
| fy.capex | 4,832 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Additions to property, plant and equipment“ — Zeile „Additions to property, plant and equipment“ | -6 | ✓ |
| fy.div | 12,381 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Dividends to shareholders“ — Zeile „Dividends to shareholders“ | -6 | ✓ |
| fy.buyback | 5,953 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Repurchase of common stock“ — Zeile „Repurchase of common stock“ | -6 | ✓ |
| fy.sbc | 1,354 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | KFR, „Stock based compensation“ — Zeile „Stock based compensation“ | -6 | ✓ |
| bs.cash | 19,709 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Cash and cash equivalents“ — Zeile „Cash and cash equivalents (Notes 1 and 2)“ | -6 | ✓ |
| bs.mktsec | 393 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Marketable securities“ — Zeile „Marketable securities (Notes 1 and 2)“ | -6 | ✓ |
| bs.stb | 8,495 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Loans and notes payable“ (Anhang 7: enthaelt laufenden Anteil der langfristigen Schulden 2.0 Mrd., Commercial Paper 6.5 Mrd. und lokale Kredite) — Zeile „Loans and notes payable (Note 7)“ | -6 | ✓ |
| bs.ltd | 39,438 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Long-term debt“ — Zeile „Long-term debt (Note 7)“ | -6 | ✓ |
| note.ltd_sub | 41,438 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Anhang 7 Borrowings, „Subtotal“ (langfristige Schulden einschl. laufendem Anteil) — Zeile „Subtotal“ | -6 | ✓ |
| note.ltd_cur | 2,000 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Anhang 7, „Less current portion“ (in „Loans and notes payable“ enthalten) — Zeile „Less current portion“ | -6 | ✓ |
| note.cp | 6.5 Mrd. USD | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Anhang 7, Fliesstext (kein XBRL-Tag) | — | ✓ |
| note.fl | — | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Anhang 1, Leasing: kein Betrag angegeben | — | ✓ |
| note.ol | 1.4 Mrd. USD | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Anhang, Leasing (Fliesstext, Mrd.) | -8 | ✓ |
| bs.assets | 199,210 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Total assets“ — Zeile „Total assets“ | -6 | ✓ |
| bs.liab | 117,666 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Total liabilities“ — Zeile „Total liabilities“ | -6 | ✓ |
| bs.equity | 81,544 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Total shareholders’ equity“ — Zeile „Total shareholders’ equity“ | -6 | ✓ |
| bs.re_apic | 168,978 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | Bilanz, „Retained earnings and Additional-paid-in-capital“ (eine Zeile, als RetainedEarnings getaggt) — Zeile „Retained earnings and Additional-paid-in-capital“ | -6 | ✓ |
| h126.revenue | 49,372 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Q2/2026 GuV Fiscal Six Months 2026, „Sales to customers“ — Zeile „Sales to customers (Note 9)“ | -6 | ✓ |
| h125.revenue | 45,636 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Q2/2026 GuV Six Months 2025 — Zeile „Sales to customers (Note 9)“ | -6 | ✓ |
| h126.pretax | 12,737 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, „Earnings before provision for taxes on income“ — Zeile „Earnings before provision for taxes on income“ | -6 | ✓ |
| h125.pretax | 20,122 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025 — Zeile „Earnings before provision for taxes on income“ | -6 | ✓ |
| h126.int_exp | 553 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, „Interest expense, net of portion capitalized“ — Zeile „Interest expense, net of portion capitalized“ | -6 | ✓ |
| h125.int_exp | 512 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025 — Zeile „Interest expense, net of portion capitalized“ | -6 | ✓ |
| h126.int_inc | 448 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, „Interest income“ — Zeile „Interest income“ | -6 | ✓ |
| h125.int_inc | 592 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025 — Zeile „Interest income“ | -6 | ✓ |
| h126.other | -625 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, „Other (income) expense, net“ 625 (Aufwand) — Zeile „Other (income) expense, net“ | -6 | ✓ |
| h125.other | 7,214 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025, (7,214) (Ertrag, enthaelt die Talk-Aufloesung aus Q1/2025) — Zeile „Other (income) expense, net“ | -6 | ✓ |
| h126.ni | 10,769 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, „Net earnings“ — Zeile „Net earnings“ | -6 | ✓ |
| h125.ni | 16,536 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025 — Zeile „Net earnings“ | -6 | ✓ |
| h126.eps | 4.41 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, diluted — Zeile „Diluted“ | 2 | ✓ |
| h125.eps | 6.82 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2025, diluted — Zeile „Diluted“ | 2 | ✓ |
| h126.sh_dil | 2,443.9 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q GuV 6M 2026, Avg. shares diluted — Zeile „Diluted“ | -5 | ✓ |
| h126.da | 3,963 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2026, „Depreciation and amortization of property and intangibles“ — Zeile „Depreciation and amortization of property and intangibles“ | -6 | ✓ |
| h125.da | 3,715 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2025 — Zeile „Depreciation and amortization of property and intangibles“ | -6 | ✓ |
| h126.cfo | 11,130 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2026 — Zeile „Net cash flows from operating activities“ | -6 | ✓ |
| h125.cfo | 8,052 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2025 — Zeile „Net cash flows from operating activities“ | -6 | ✓ |
| h126.capex | 2,370 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2026 — Zeile „Additions to property, plant and equipment“ | -6 | ✓ |
| h125.capex | 1,838 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2025 — Zeile „Additions to property, plant and equipment“ | -6 | ✓ |
| h126.div | 6,358 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2026, „Dividends to shareholders“ — Zeile „Dividends to shareholders“ | -6 | ✓ |
| h125.div | 6,118 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q KFR 6M 2025 — Zeile „Dividends to shareholders“ | -6 | ✓ |
| h126.dps | 2.64 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Eigenkapitalrechnung 6M 2026, „Cash dividends paid ($2.64 per share)“ — Zeile „Cash dividends paid ($ 2.64 per share)“ | 2 | ✓ |
| h125.dps | 2.54 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Eigenkapitalrechnung 6M 2025 — Zeile „Cash dividends paid ($ 2.54 per share)“ | 2 | ✓ |
| bs26.cash | 20,422 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Bilanz, „Cash and cash equivalents“ — Zeile „Cash and cash equivalents (Note 4)“ | -6 | ✓ |
| bs26.mktsec | 336 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Bilanz, „Marketable securities“ — Zeile „Marketable securities“ | -6 | ✓ |
| bs26.stb | 11,692 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Bilanz, „Loans and notes payable“ (Anhang: enthaelt 9.9 Mrd. Commercial Paper) — Zeile „Loans and notes payable“ | -6 | ✓ |
| bs26.ltd | 37,344 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Bilanz, „Long-term debt“ (Anhang: „Total Non-Current Debt“ 37,344) — Zeile „Long-term debt (Note 4)“ | -6 | ✓ |
| bs26.equity | 84,971 | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Bilanz, „Total shareholders’ equity“ — Zeile „Total shareholders’ equity“ | -6 | ✓ |
| note26.netdebt | 28.2 Mrd. USD | 10-Q 0000200406-26-000153 (jnj-20260628.htm, eingereicht 2026-07-23, sha256 e346422fb440…) | 10-Q Lagebericht (Liquidity): ~49.0 Mrd. notes payable und long-term debt, Nettoschulden 28.2 Mrd. (Unternehmensangabe inkl. marktgaengiger Wertpapiere) | — | ✓ |
| fy1.stb | 5,983 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | 10-K FY2025 Bilanz, Vorjahresspalte „Loans and notes payable“ — Zeile „Loans and notes payable (Note 7)“ | -6 | ✓ |
| fy1.ltd | 30,651 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | 10-K FY2025 Bilanz, Vorjahresspalte „Long-term debt“ — Zeile „Long-term debt (Note 7)“ | -6 | ✓ |
| fy1.cash | 24,105 | 10-K 0000200406-26-000016 (jnj-20251228.htm, eingereicht 2026-02-11, sha256 40d880bd65db…) | 10-K FY2025 Bilanz, Vorjahresspalte — Zeile „Cash and cash equivalents (Notes 1 and 2)“ | -6 | ✓ |


## 3 · Historienabgleich (Erfassung `fy`, alle Werte)

### MCD — CIK0000063908.companyfacts.json (Rohdatei sha256 0394e814d75510be…)

| Feld | i | Periode | Tool | Quelle | Rechnung | Original | Umfang | Status | Hinweis |
|---|---|---|---|---|---|---|---|---|---|
| revenue | 0 | 2025-12-31 | 26,885 | 26,885 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total revenues“ |
| revenue | 1 | 2024-12-31 | 25,920 | 25,920 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total revenues“ |
| revenue | 2 | 2023-12-31 | 25,494 | 25,494 | ✓ | ✓ | — | korrekt | Fassungen 25,493.7 / 25,494 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Total revenues“ |
| revenue | 3 | 2022-12-31 | 23,183 | 23,183 | ✓ | ✓ | — | korrekt | Fassungen 23,182.6 / 23,183 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Total revenues“ |
| revenue | 4 | 2021-12-31 | 23,222.9 | 23,222.9 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Total revenues“ |
| revenue | 5 | 2020-12-31 | 19,207.8 | 19,207.8 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Total revenues“ |
| revenue | 6 | 2019-12-31 | 21,364.4 | 21,364.4 | ✓ | ✓ | — | korrekt | Fassungen 21,076.5 / 21,364.4 (juengste 0000063908-22-000011) · Original mcd-20211231.htm: „Total revenues“ |
| revenue | 7 | 2018-12-31 | 21,257.9 | 21,257.9 | ✓ | ✓ | — | korrekt | Fassungen 21,025.2 / 21,257.9 (juengste 0000063908-21-000013) · Original mcd-20201231.htm: „Total revenues“ |
| revenue | 8 | 2017-12-31 | 22,820.4 | 22,820.4 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Total revenues“ |
| revenue | 9 | 2016-12-31 | 24,621.9 | 24,621.9 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Total revenues“ |
| ebit | 0 | 2025-12-31 | 12,393 | 12,393 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Operating income“ |
| ebit | 1 | 2024-12-31 | 11,712 | 11,712 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Operating income“ |
| ebit | 2 | 2023-12-31 | 11,647 | 11,647 | ✓ | ✓ | — | korrekt | Fassungen 11,646.7 / 11,647 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Operating income“ |
| ebit | 3 | 2022-12-31 | 9,371 | 9,371 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Operating income“ |
| ebit | 4 | 2021-12-31 | 10,356 | 10,356 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Operating income“ |
| ebit | 5 | 2020-12-31 | 7,324 | 7,324 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Operating income“ |
| ebit | 6 | 2019-12-31 | 9,069.8 | 9,069.8 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Operating income“ |
| ebit | 7 | 2018-12-31 | 8,822.6 | 8,822.6 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Operating income“ |
| ebit | 8 | 2017-12-31 | 9,552.7 | 9,552.7 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Operating income“ |
| ebit | 9 | 2016-12-31 | 7,744.5 | 7,744.5 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Operating income“ |
| ebitda | 0 | 2025-12-31 | 14,592 | 14,592 | ✓ | · | belegt | korrekt | EBIT 12,393 + D&A 2,199 · erwartet Gesamt-D&A 2,199 [Auditbeleg fy.da_total (Original, Gesamt-D&A)] |
| ebitda | 1 | 2024-12-31 | 13,809 | 13,809 | ✓ | · | belegt | korrekt | EBIT 11,712 + D&A 2,097 · erwartet Gesamt-D&A 2,097 [Auditbeleg fy1.da_total (Original, Gesamt-D&A)] |
| ebitda | 2 | 2023-12-31 | 13,625 | 13,625 | ✓ | · | belegt | korrekt | EBIT 11,647 + D&A 1,978 · erwartet Gesamt-D&A 1,978 [Auditbeleg fy2.da_total (Original, Gesamt-D&A)] |
| ebitda | 3 | 2022-12-31 | 11,242 | 11,242 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 9,371 + D&A 1,871 · erwartet Gesamt-D&A 1,871 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total Depreciation & amortization**“)] |
| ebitda | 4 | 2021-12-31 | 12,224.1 | 12,224.1 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 10,356 + D&A 1,868.1 · erwartet Gesamt-D&A 1,868.1 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| ebitda | 5 | 2020-12-31 | 9,075.4 | 9,075.4 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 7,324 + D&A 1,751.4 · erwartet Gesamt-D&A 1,751.4 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| ebitda | 6 | 2019-12-31 | 10,687.7 | 10,687.7 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 9,069.8 + D&A 1,617.9 · erwartet Gesamt-D&A 1,617.9 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| ebitda | 7 | 2018-12-31 | 10,304.6 | 10,304.6 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 8,822.6 + D&A 1,482 · erwartet Gesamt-D&A 1,482 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| ebitda | 8 | 2017-12-31 | 10,916.1 | 10,916.1 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 9,552.7 + D&A 1,363.4 · erwartet Gesamt-D&A 1,363.4 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| ebitda | 9 | 2016-12-31 | 9,261 | 9,261 | ✓ | · | belegt (Original, Groessenregel) | korrekt | EBIT 7,744.5 + D&A 1,516.5 · erwartet Gesamt-D&A 1,516.5 [groesster gemeldeter D&A-Posten (DepreciationAndAmortization, DepreciationAndAmortization „Depreciation and amortization“, DepreciationAndAmortization „Total depreciation and amortization“)] |
| cfo | 0 | 2025-12-31 | 10,551 | 10,551 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Cash provided by operations“ |
| cfo | 1 | 2024-12-31 | 9,447 | 9,447 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Cash provided by operations“ |
| cfo | 2 | 2023-12-31 | 9,612 | 9,612 | ✓ | ✓ | — | korrekt | Fassungen 9,611.9 / 9,612 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Cash provided by operations“ |
| cfo | 3 | 2022-12-31 | 7,387 | 7,387 | ✓ | ✓ | — | korrekt | Fassungen 7,386.7 / 7,387 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Cash provided by operations“ |
| cfo | 4 | 2021-12-31 | 9,141.5 | 9,141.5 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Cash provided by operations“ |
| cfo | 5 | 2020-12-31 | 6,265.2 | 6,265.2 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Cash provided by operations“ |
| cfo | 6 | 2019-12-31 | 8,122.1 | 8,122.1 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Cash provided by operations“ |
| cfo | 7 | 2018-12-31 | 6,966.7 | 6,966.7 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Cash provided by operations“ |
| cfo | 8 | 2017-12-31 | 5,551.2 | 5,551.2 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Cash provided by operations“ |
| cfo | 9 | 2016-12-31 | 6,059.6 | 6,059.6 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Cash provided by operations“ |
| capex | 0 | 2025-12-31 | 3,365 | 3,365 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Capital expenditures“ |
| capex | 1 | 2024-12-31 | 2,775 | 2,775 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Capital expenditures“ |
| capex | 2 | 2023-12-31 | 2,357 | 2,357 | ✓ | ✓ | — | korrekt | Fassungen 2,357.4 / 2,357 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Capital expenditures“ |
| capex | 3 | 2022-12-31 | 1,899 | 1,899 | ✓ | ✓ | — | korrekt | Fassungen 1,899.2 / 1,899 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Capital expenditures“ |
| capex | 4 | 2021-12-31 | 2,040 | 2,040 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Capital expenditures“ |
| capex | 5 | 2020-12-31 | 1,640.8 | 1,640.8 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Capital expenditures“ |
| capex | 6 | 2019-12-31 | 2,393.7 | 2,393.7 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Capital expenditures“ |
| capex | 7 | 2018-12-31 | 2,741.7 | 2,741.7 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Capital expenditures“ |
| capex | 8 | 2017-12-31 | 1,853.7 | 1,853.7 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Capital expenditures“ |
| capex | 9 | 2016-12-31 | 1,821.1 | 1,821.1 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Capital expenditures“ |
| fcf | 0 | 2025-12-31 | 7,186 | 7,186 | ✓ | · | — | korrekt | CFO 10,551 − CapEx 3,365 |
| fcf | 1 | 2024-12-31 | 6,672 | 6,672 | ✓ | · | — | korrekt | CFO 9,447 − CapEx 2,775 |
| fcf | 2 | 2023-12-31 | 7,255 | 7,255 | ✓ | · | — | korrekt | CFO 9,612 − CapEx 2,357 |
| fcf | 3 | 2022-12-31 | 5,488 | 5,488 | ✓ | · | — | korrekt | CFO 7,387 − CapEx 1,899 |
| fcf | 4 | 2021-12-31 | 7,101.5 | 7,101.5 | ✓ | · | — | korrekt | CFO 9,141.5 − CapEx 2,040 |
| fcf | 5 | 2020-12-31 | 4,624.4 | 4,624.4 | ✓ | · | — | korrekt | CFO 6,265.2 − CapEx 1,640.8 |
| fcf | 6 | 2019-12-31 | 5,728.4 | 5,728.4 | ✓ | · | — | korrekt | CFO 8,122.1 − CapEx 2,393.7 |
| fcf | 7 | 2018-12-31 | 4,225 | 4,225 | ✓ | · | — | korrekt | CFO 6,966.7 − CapEx 2,741.7 |
| fcf | 8 | 2017-12-31 | 3,697.5 | 3,697.5 | ✓ | · | — | korrekt | CFO 5,551.2 − CapEx 1,853.7 |
| fcf | 9 | 2016-12-31 | 4,238.5 | 4,238.5 | ✓ | · | — | korrekt | CFO 6,059.6 − CapEx 1,821.1 |
| total_debt | 0 | 2025-12-31 | 39,973 | 39,973 | ✓ | ✓ | belegt (39,973) | korrekt | Original mcd-20251231.htm: „Total debt obligations“ · Vollstaendige Finanzschulden laut Anhang = 39,973 (enthaelt Commercial Paper 798 und laufende Faelligkeiten 725). Finance-Leasing 2,352 separat. |
| total_debt | 1 | 2024-12-31 | 38,424 | 38,424 | ✓ | ✓ | belegt (38,424) | korrekt | Original mcd-20251231.htm: „Total debt obligations“ · Vollstaendige Finanzschulden laut Anhang 38,424 (enthaelt umklassifizierte kurzfristige Schulden 795 und laufende Faelligkeiten 3.0 Mrd.). Finance-Leasing 1,781 separat. |
| total_debt | 2 | 2023-12-31 | 39,345 | 39,345 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Fassungen 39,345.3 / 39,345 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Total debt obligations“ |
| total_debt | 3 | 2022-12-31 | 35,903.5 | 35,903.5 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20231231.htm: „Total debt obligations“ |
| total_debt | 4 | 2021-12-31 | 35,622.7 | 35,622.7 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20221231.htm: „Total debt obligations“ |
| total_debt | 5 | 2020-12-31 | 37,440.4 | 37,440.4 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20211231.htm: „Total debt obligations“ |
| total_debt | 6 | 2019-12-31 | 34,177.2 | 34,177.2 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20201231.htm: „Total debt obligations“ |
| total_debt | 7 | 2018-12-31 | 31,075.3 | 31,075.3 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312019x10k.htm: „Total debt obligations“ |
| total_debt | 8 | 2017-12-31 | 29,536.4 | 29,536.4 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312018x10k.htm: „Total debt obligations“ |
| total_debt | 9 | 2016-12-31 | 25,955.7 | 25,955.7 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312017x10k.htm: „Total debt obligations“ |
| net_debt | 0 | 2025-12-31 | 39,199 | 39,199 | ✓ | · | Teilbetrag: vollstaendig 41,551 (inkl. Finance-Leasing 2,352) · Engine: Umfang als unvollstaendig gekennzeichnet (die gemeldeten Schuldenangaben sind rechnerisch unvereinbar (Abweichung 725.0M)) | berechtigte Einschraenkung | Rechnung: Schulden 39,973 − Liquiditaet 774 · Vollstaendige Finanzschulden laut Anhang = 39,973 (enthaelt Commercial Paper 798 und laufende Faelligkeiten 725). Finance-Leasing 2,352 separat. |
| net_debt | 1 | 2024-12-31 | 37,339 | 37,339 | ✓ | · | Teilbetrag: vollstaendig 39,120 (inkl. Finance-Leasing 1,781) · Engine: Umfang als unvollstaendig gekennzeichnet (die gemeldeten Schuldenangaben sind rechnerisch unvereinbar (Abweichung 725.0M)) | berechtigte Einschraenkung | Rechnung: Schulden 38,424 − Liquiditaet 1,085 · Vollstaendige Finanzschulden laut Anhang 38,424 (enthaelt umklassifizierte kurzfristige Schulden 795 und laufende Faelligkeiten 3.0 Mrd.). Finance-Leasing 1,781 separat. |
| net_debt | 2 | 2023-12-31 | 34,766 | 34,766 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 39,345 − Liquiditaet 4,579 |
| net_debt | 3 | 2022-12-31 | 33,319.7 | 33,319.7 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 35,903.5 − Liquiditaet 2,583.8 |
| net_debt | 4 | 2021-12-31 | 30,913.5 | 30,913.5 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 35,622.7 − Liquiditaet 4,709.2 |
| net_debt | 5 | 2020-12-31 | 33,991.3 | 33,991.3 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 37,440.4 − Liquiditaet 3,449.1 |
| net_debt | 6 | 2019-12-31 | 33,278.7 | 33,278.7 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 34,177.2 − Liquiditaet 898.5 |
| net_debt | 7 | 2018-12-31 | 30,209.3 | 30,209.3 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 31,075.3 − Liquiditaet 866 |
| net_debt | 8 | 2017-12-31 | 27,072.6 | 27,072.6 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 29,536.4 − Liquiditaet 2,463.8 |
| net_debt | 9 | 2016-12-31 | 24,732.3 | 24,732.3 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 25,955.7 − Liquiditaet 1,223.4 |
| debt_short_term | 0 | 2025-12-31 | 798 | 798 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Text: …borrowings was 4.2 % at December 31, 2025 (based on $ 4 million“ |
| debt_short_term | 1 | 2024-12-31 | 790 | 790 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Text: …tstanding) and 4.6 % at December 31, 2024 (based on $ 5 million“ |
| debt_short_term | 2 | 2023-12-31 | 348 | 348 | ✓ | ✓ | — | korrekt | Fassungen 347.6 / 348 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Text: …tanding) and 5.4 % at December 31, 2023 (based on $ 120 million“ |
| debt_long_term_current | 0 | 2025-12-31 | 725 | 725 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Text: …0 million of commercial paper outstanding). At December 31, 202“ |
| debt_long_term_current | 1 | 2021-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 2 | 2020-12-31 | 2,243.6 | 2,243.6 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 3 | 2019-12-31 | 59.1 | 59.1 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 4 | 2018-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 5 | 2017-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 6 | 2016-12-31 | 77.2 | 77.2 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Current maturities of long-term debt“ |
| debt_long_term_current | 7 | 2015-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-20161231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 8 | 2011-12-31 | 366.6 | 366.6 | ✓ | ✓ | — | korrekt | Original mcd-20121231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 9 | 2010-12-31 | 8.3 | 8.3 | ✓ | ✓ | — | korrekt | Original mcd-20111231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_noncurrent | 0 | 2025-12-31 | 39,973 | 39,973 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 1 | 2024-12-31 | 38,424 | 38,424 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 2 | 2023-12-31 | 37,153 | 37,153 | ✓ | ✓ | — | korrekt | Fassungen 37,152.9 / 37,153 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 3 | 2022-12-31 | 35,903.5 | 35,903.5 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 4 | 2021-12-31 | 35,622.7 | 35,622.7 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 5 | 2020-12-31 | 35,196.8 | 35,196.8 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 6 | 2019-12-31 | 34,118.1 | 34,118.1 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 7 | 2018-12-31 | 31,075.3 | 31,075.3 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 8 | 2017-12-31 | 29,536.4 | 29,536.4 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Long-term debt“ |
| debt_long_term_noncurrent | 9 | 2016-12-31 | 25,878.5 | 25,878.5 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Long-term debt“ |
| finance_lease_current | 0 | 2025-12-31 | 23 | 23 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Current lease liability“ |
| finance_lease_current | 1 | 2024-12-31 | 11 | 11 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Current lease liability“ |
| finance_lease_noncurrent | 0 | 2025-12-31 | 2,329 | 2,329 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Long-term lease liability“ |
| finance_lease_noncurrent | 1 | 2024-12-31 | 1,770 | 1,770 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Long-term lease liability“ |
| operating_lease_liability_current | 0 | 2022-12-31 | 661.1 | 661.1 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Lease liability“ |
| operating_lease_liability_current | 1 | 2021-12-31 | 705.5 | 705.5 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Lease liability“ |
| operating_lease_liability_current | 2 | 2020-12-31 | 701.5 | 701.5 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Lease liability“ |
| operating_lease_liability_current | 3 | 2019-12-31 | 621 | 621 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Lease liability“ |
| operating_lease_liability_current | 4 | 2018-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Lease liability“ |
| operating_lease_liability_noncurrent | 0 | 2022-12-31 | 12,134.4 | 12,134.4 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Long-term lease liability“ |
| operating_lease_liability_noncurrent | 1 | 2021-12-31 | 13,020.9 | 13,020.9 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Long-term lease liability“ |
| operating_lease_liability_noncurrent | 2 | 2020-12-31 | 13,321.3 | 13,321.3 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Long-term lease liability“ |
| operating_lease_liability_noncurrent | 3 | 2019-12-31 | 12,757.8 | 12,757.8 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Long-term lease liability“ |
| operating_lease_liability_noncurrent | 4 | 2018-12-31 | 0 | 0 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Long-term lease liability“ |
| operating_lease_liabilities | 0 | 2023-12-31 | 12,170.3 | 12,170.3 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Present value of lease liability“ |
| operating_lease_liabilities | 1 | 2022-12-31 | 12,795.5 | 12,795.5 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Present value of lease liability“ |
| operating_lease_liabilities | 2 | 2021-12-31 | 13,726.4 | 13,726.4 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Present value of lease liability“ |
| operating_lease_liabilities | 3 | 2020-12-31 | 14,022.8 | 14,022.8 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Present value of lease liability“ |
| operating_lease_liabilities | 4 | 2019-12-31 | 13,378.8 | 13,378.8 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Present value of lease liability“ |
| operating_lease_liabilities | 5 | 2019-01-01 | 12,500 | 12,500 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Text: …-wk-Fact-6AACD3EFBFEA5F9AA745DDFE6AF089C7">3500000000 350000000“ |
| cash_and_equivalents | 0 | 2025-12-31 | 774 | 774 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 1 | 2024-12-31 | 1,085 | 1,085 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 2 | 2023-12-31 | 4,579 | 4,579 | ✓ | ✓ | — | korrekt | Fassungen 4,579.3 / 4,579 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 3 | 2022-12-31 | 2,583.8 | 2,583.8 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 4 | 2021-12-31 | 4,709.2 | 4,709.2 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 5 | 2020-12-31 | 3,449.1 | 3,449.1 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Cash and equivalents“ |
| cash_and_equivalents | 6 | 2019-12-31 | 898.5 | 898.5 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Cash and equivalents at beginning of year“ |
| cash_and_equivalents | 7 | 2018-12-31 | 866 | 866 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Cash and equivalents at beginning of year“ |
| cash_and_equivalents | 8 | 2017-12-31 | 2,463.8 | 2,463.8 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Cash and equivalents at beginning of year“ |
| cash_and_equivalents | 9 | 2016-12-31 | 1,223.4 | 1,223.4 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Cash and equivalents at beginning of year“ |
| shares_diluted | 0 | 2025-12-31 | 716.4 | 716.4 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (716.4 „shares“, F-4); NI/EPS = 716.569 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 1 | 2024-12-31 | 721.9 | 721.9 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (721.9 „shares“, F-4); NI/EPS = 721.949 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 2 | 2023-12-31 | 732.3 | 732.3 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (732.3 „shares“, F-4); NI/EPS = 732.612 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 3 | 2022-12-31 | 741.3 | 741.3 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (741.3 „shares“, F-4); NI/EPS = 741.537 bestaetigt · Original mcd-20241231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 4 | 2021-12-31 | 751.8 | 751.8 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (751.8 „shares“, F-4); NI/EPS = 751.514 bestaetigt · Original mcd-20231231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 5 | 2020-12-31 | 750.1 | 750.1 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 6 | 2019-12-31 | 764.9 | 764.9 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 7 | 2018-12-31 | 785.6 | 785.6 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 8 | 2017-12-31 | 815.5 | 815.5 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_diluted | 9 | 2016-12-31 | 861.2 | 861.2 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm (Akte laut Company Facts): „Weighted-average shares outstanding–diluted“ |
| shares_basic | 0 | 2025-12-31 | 713.4 | 713.4 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (713.4 „shares“, F-4); NI/EPS = 713.583 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 1 | 2024-12-31 | 718.3 | 718.3 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (718.3 „shares“, F-4); NI/EPS = 718.166 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 2 | 2023-12-31 | 727.9 | 727.9 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (727.9 „shares“, F-4); NI/EPS = 728.203 bestaetigt · Original mcd-20251231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 3 | 2022-12-31 | 736.5 | 736.5 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (736.5 „shares“, F-4); NI/EPS = 736.234 bestaetigt · Original mcd-20241231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 4 | 2021-12-31 | 746.3 | 746.3 | ✓ | ✓ | — | korrekt | Filer meldet in Mio. (746.3 „shares“, F-4); NI/EPS = 746.311 bestaetigt · Original mcd-20231231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 5 | 2020-12-31 | 744.6 | 744.6 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 6 | 2019-12-31 | 758.1 | 758.1 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 7 | 2018-12-31 | 778.2 | 778.2 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 8 | 2017-12-31 | 807.4 | 807.4 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| shares_basic | 9 | 2016-12-31 | 854.4 | 854.4 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm (Akte laut Company Facts): „Weighted-average shares outstanding–basic“ |
| eps_diluted | 0 | 2025-12-31 | 11.95 | 11.95 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 1 | 2024-12-31 | 11.39 | 11.39 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 2 | 2023-12-31 | 11.56 | 11.56 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 3 | 2022-12-31 | 8.33 | 8.33 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 4 | 2021-12-31 | 10.04 | 10.04 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 5 | 2020-12-31 | 6.31 | 6.31 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 6 | 2019-12-31 | 7.88 | 7.88 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 7 | 2018-12-31 | 7.54 | 7.54 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Earnings per common share–diluted“ |
| eps_diluted | 8 | 2017-12-31 | 6.37 | 6.37 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Earnings per common share–diluted“ |
| eps_diluted | 9 | 2016-12-31 | 5.44 | 5.44 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Earnings per common share–diluted“ |
| dps | 0 | 2025-12-31 | 7.17 | 7.17 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 1 | 2024-12-31 | 6.78 | 6.78 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 2 | 2023-12-31 | 6.23 | 6.23 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 3 | 2022-12-31 | 5.66 | 5.66 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 4 | 2021-12-31 | 5.25 | 5.25 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 5 | 2020-12-31 | 5.04 | 5.04 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 6 | 2019-12-31 | 4.73 | 4.73 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 7 | 2018-12-31 | 4.19 | 4.19 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm (Akte laut Company Facts): „Text: …MTRiMGI4MGRhMmNkNGJmYzgxYWJhNWI4ZTQzYTYxMzJfOC0zLTEtMS0w_aea3af“ |
| dps | 8 | 2017-12-31 | 3.83 | 3.83 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps | 9 | 2016-12-31 | 3.61 | 3.61 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm (Akte laut Company Facts): „Dividends declared per common share“ |
| dps_direct | 0 | 2025-12-31 | 7.17 | 7.17 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Dividends declared per common share“ |
| dps_direct | 1 | 2024-12-31 | 6.78 | 6.78 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Dividends declared per common share“ |
| dps_direct | 2 | 2023-12-31 | 6.23 | 6.23 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Dividends declared per common share“ |
| dps_direct | 3 | 2022-12-31 | 5.66 | 5.66 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Dividends declared per common share“ |
| dps_direct | 4 | 2021-12-31 | 5.25 | 5.25 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Dividends declared per common share“ |
| dps_direct | 5 | 2020-12-31 | 5.04 | 5.04 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Dividends declared per common share“ |
| dps_direct | 6 | 2019-12-31 | 4.73 | 4.73 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Dividends declared per common share“ |
| dps_direct | 7 | 2018-12-31 | 4.19 | 4.19 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Text: …MTRiMGI4MGRhMmNkNGJmYzgxYWJhNWI4ZTQzYTYxMzJfOC0zLTEtMS0w_aea3af“ |
| dps_direct | 8 | 2017-12-31 | 3.83 | 3.83 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Dividends declared per common share“ |
| dps_direct | 9 | 2016-12-31 | 3.61 | 3.61 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Dividends declared per common share“ |
| dividends_paid | 0 | 2025-12-31 | 5,115 | 5,115 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Common stock dividends“ |
| dividends_paid | 1 | 2024-12-31 | 4,870 | 4,870 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Common stock dividends“ |
| dividends_paid | 2 | 2023-12-31 | 4,533 | 4,533 | ✓ | ✓ | — | korrekt | Fassungen 4,532.8 / 4,533 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Common stock dividends“ |
| dividends_paid | 3 | 2022-12-31 | 4,168 | 4,168 | ✓ | ✓ | — | korrekt | Fassungen 4,168.2 / 4,168 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Common stock dividends“ |
| dividends_paid | 4 | 2021-12-31 | 3,918.6 | 3,918.6 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Common stock dividends“ |
| dividends_paid | 5 | 2020-12-31 | 3,752.9 | 3,752.9 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Common stock dividends“ |
| dividends_paid | 6 | 2019-12-31 | 3,581.9 | 3,581.9 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Common stock dividends“ |
| dividends_paid | 7 | 2018-12-31 | 3,255.9 | 3,255.9 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Common stock dividends“ |
| dividends_paid | 8 | 2017-12-31 | 3,089.2 | 3,089.2 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Common stock dividends“ |
| dividends_paid | 9 | 2016-12-31 | 3,058.2 | 3,058.2 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Common stock dividends“ |
| net_income | 0 | 2025-12-31 | 8,563 | 8,563 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Net income“ |
| net_income | 1 | 2024-12-31 | 8,223 | 8,223 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Net income“ |
| net_income | 2 | 2023-12-31 | 8,469 | 8,469 | ✓ | ✓ | — | korrekt | Fassungen 8,468.8 / 8,469 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Net income“ |
| net_income | 3 | 2022-12-31 | 6,177 | 6,177 | ✓ | ✓ | — | korrekt | Fassungen 6,177.4 / 6,177 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Net income“ |
| net_income | 4 | 2021-12-31 | 7,545.2 | 7,545.2 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Net income“ |
| net_income | 5 | 2020-12-31 | 4,730.5 | 4,730.5 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Net income“ |
| net_income | 6 | 2019-12-31 | 6,025.4 | 6,025.4 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Net income“ |
| net_income | 7 | 2018-12-31 | 5,924.3 | 5,924.3 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Net income“ |
| net_income | 8 | 2017-12-31 | 5,192.3 | 5,192.3 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Net income“ |
| net_income | 9 | 2016-12-31 | 4,686.5 | 4,686.5 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Net income“ |
| book_value | 0 | 2025-12-31 | -1,791 | -1,791 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total shareholders’ equity (deficit)“ |
| book_value | 1 | 2024-12-31 | -3,797 | -3,797 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total shareholders’ equity (deficit)“ |
| book_value | 2 | 2023-12-31 | -4,707 | -4,707 | ✓ | ✓ | — | korrekt | Fassungen -4,706.7 / -4,707 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Balance at December 31, 2023“ |
| book_value | 3 | 2022-12-31 | -6,003 | -6,003 | ✓ | ✓ | — | korrekt | Fassungen -6,003.4 / -6,003 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Balance at December 31, 2022“ |
| book_value | 4 | 2021-12-31 | -4,601 | -4,601 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Balance at December 31, 2021“ |
| book_value | 5 | 2020-12-31 | -7,824.9 | -7,824.9 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Balance at December 31, 2020“ |
| book_value | 6 | 2019-12-31 | -8,210.3 | -8,210.3 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Balance at December 31, 2019“ |
| book_value | 7 | 2018-12-31 | -6,258.4 | -6,258.4 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Balance at December 31, 2018“ |
| book_value | 8 | 2017-12-31 | -3,268 | -3,268 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Balance at December 31, 2017“ |
| book_value | 9 | 2016-12-31 | -2,204.3 | -2,204.3 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Balance at December 31, 2016“ |
| total_equity | 0 | 2025-12-31 | -1,791 | -1,791 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total shareholders’ equity (deficit)“ |
| total_equity | 1 | 2024-12-31 | -3,797 | -3,797 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total shareholders’ equity (deficit)“ |
| total_equity | 2 | 2023-12-31 | -4,707 | -4,707 | ✓ | ✓ | — | korrekt | Fassungen -4,706.7 / -4,707 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Balance at December 31, 2023“ |
| total_equity | 3 | 2022-12-31 | -6,003 | -6,003 | ✓ | ✓ | — | korrekt | Fassungen -6,003.4 / -6,003 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Balance at December 31, 2022“ |
| total_equity | 4 | 2021-12-31 | -4,601 | -4,601 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Balance at December 31, 2021“ |
| total_equity | 5 | 2020-12-31 | -7,824.9 | -7,824.9 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Balance at December 31, 2020“ |
| total_equity | 6 | 2019-12-31 | -8,210.3 | -8,210.3 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Balance at December 31, 2019“ |
| total_equity | 7 | 2018-12-31 | -6,258.4 | -6,258.4 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Balance at December 31, 2018“ |
| total_equity | 8 | 2017-12-31 | -3,268 | -3,268 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Balance at December 31, 2017“ |
| total_equity | 9 | 2016-12-31 | -2,204.3 | -2,204.3 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Balance at December 31, 2016“ |
| long_term_debt | 0 | 2025-12-31 | 39,973 | 39,973 | ✓ | ✓ | belegt (39,973) | korrekt | Original mcd-20251231.htm: „Total debt obligations“ · Vollstaendige Finanzschulden laut Anhang = 39,973 (enthaelt Commercial Paper 798 und laufende Faelligkeiten 725). Finance-Leasing 2,352 separat. |
| long_term_debt | 1 | 2024-12-31 | 38,424 | 38,424 | ✓ | ✓ | belegt (38,424) | korrekt | Original mcd-20251231.htm: „Total debt obligations“ · Vollstaendige Finanzschulden laut Anhang 38,424 (enthaelt umklassifizierte kurzfristige Schulden 795 und laufende Faelligkeiten 3.0 Mrd.). Finance-Leasing 1,781 separat. |
| long_term_debt | 2 | 2023-12-31 | 39,345 | 39,345 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Fassungen 39,345.3 / 39,345 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Total debt obligations“ |
| long_term_debt | 3 | 2022-12-31 | 35,903.5 | 35,903.5 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20231231.htm: „Total debt obligations“ |
| long_term_debt | 4 | 2021-12-31 | 35,622.7 | 35,622.7 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20221231.htm: „Total debt obligations“ |
| long_term_debt | 5 | 2020-12-31 | 37,440.4 | 37,440.4 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20211231.htm: „Total debt obligations“ |
| long_term_debt | 6 | 2019-12-31 | 34,177.2 | 34,177.2 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-20201231.htm: „Total debt obligations“ |
| long_term_debt | 7 | 2018-12-31 | 31,075.3 | 31,075.3 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312019x10k.htm: „Total debt obligations“ |
| long_term_debt | 8 | 2017-12-31 | 29,536.4 | 29,536.4 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312018x10k.htm: „Total debt obligations“ |
| long_term_debt | 9 | 2016-12-31 | 25,955.7 | 25,955.7 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original mcd-12312017x10k.htm: „Total debt obligations“ |
| cash | 0 | 2025-12-31 | 774 | 774 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 1 | 2024-12-31 | 1,085 | 1,085 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 2 | 2023-12-31 | 4,579 | 4,579 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 3 | 2022-12-31 | 2,583.8 | 2,583.8 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 4 | 2021-12-31 | 4,709.2 | 4,709.2 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 5 | 2020-12-31 | 3,449.1 | 3,449.1 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 6 | 2019-12-31 | 898.5 | 898.5 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 7 | 2018-12-31 | 866 | 866 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 8 | 2017-12-31 | 2,463.8 | 2,463.8 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 9 | 2016-12-31 | 1,223.4 | 1,223.4 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| total_assets | 0 | 2025-12-31 | 59,515 | 59,515 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total assets“ |
| total_assets | 1 | 2024-12-31 | 55,182 | 55,182 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total assets“ |
| total_assets | 2 | 2023-12-31 | 56,147 | 56,147 | ✓ | ✓ | — | korrekt | Fassungen 56,146.8 / 56,147 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Total Assets“ |
| total_assets | 3 | 2022-12-31 | 50,436 | 50,436 | ✓ | ✓ | — | korrekt | Fassungen 50,435.6 / 50,436 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Total Assets“ |
| total_assets | 4 | 2021-12-31 | 53,854.3 | 53,854.3 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Total assets“ |
| total_assets | 5 | 2020-12-31 | 52,626.8 | 52,626.8 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Total assets“ |
| total_assets | 6 | 2019-12-31 | 47,510.8 | 47,510.8 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Total assets“ |
| total_assets | 7 | 2018-12-31 | 32,811.2 | 32,811.2 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Total assets *“ |
| total_assets | 8 | 2017-12-31 | 33,803.7 | 33,803.7 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Total assets *“ |
| total_assets | 9 | 2016-12-31 | 31,023.9 | 31,023.9 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Total assets“ |
| current_assets | 0 | 2025-12-31 | 4,163 | 4,163 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total current assets“ |
| current_assets | 1 | 2024-12-31 | 4,599 | 4,599 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total current assets“ |
| current_assets | 2 | 2023-12-31 | 7,986 | 7,986 | ✓ | ✓ | — | korrekt | Fassungen 7,986.4 / 7,986 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Total current assets“ |
| current_assets | 3 | 2022-12-31 | 5,424.2 | 5,424.2 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Total current assets“ |
| current_assets | 4 | 2021-12-31 | 7,148.5 | 7,148.5 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Total current assets“ |
| current_assets | 5 | 2020-12-31 | 6,243.2 | 6,243.2 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Total current assets“ |
| current_assets | 6 | 2019-12-31 | 3,557.9 | 3,557.9 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Total current assets“ |
| current_assets | 7 | 2018-12-31 | 4,053.2 | 4,053.2 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Total current assets“ |
| current_assets | 8 | 2017-12-31 | 5,327.2 | 5,327.2 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Total current assets“ |
| current_assets | 9 | 2016-12-31 | 4,848.6 | 4,848.6 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Total current assets“ |
| current_liabilities | 0 | 2025-12-31 | 4,361 | 4,361 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total current liabilities“ |
| current_liabilities | 1 | 2024-12-31 | 3,861 | 3,861 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Total current liabilities“ |
| current_liabilities | 2 | 2023-12-31 | 6,859 | 6,859 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Total current liabilities“ |
| current_liabilities | 3 | 2022-12-31 | 3,802.1 | 3,802.1 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Total current liabilities“ |
| current_liabilities | 4 | 2021-12-31 | 4,020 | 4,020 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Total current liabilities“ |
| current_liabilities | 5 | 2020-12-31 | 6,181.2 | 6,181.2 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Total current liabilities“ |
| current_liabilities | 6 | 2019-12-31 | 3,621 | 3,621 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Total current liabilities“ |
| current_liabilities | 7 | 2018-12-31 | 2,973.5 | 2,973.5 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Total current liabilities“ |
| current_liabilities | 8 | 2017-12-31 | 2,890.6 | 2,890.6 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Total current liabilities“ |
| current_liabilities | 9 | 2016-12-31 | 3,468.3 | 3,468.3 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Total current liabilities“ |
| interest_expense | 0 | 2025-12-31 | 1,582 | 1,582 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Interest expense-net of capitalized interest of $ 29 , $ 22 and $ 14“ |
| interest_expense | 1 | 2024-12-31 | 1,506 | 1,506 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Interest expense-net of capitalized interest of $ 29 , $ 22 and $ 14“ |
| interest_expense | 2 | 2023-12-31 | 1,361 | 1,361 | ✓ | ✓ | — | korrekt | Fassungen 1,360.8 / 1,361 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Interest expense-net of capitalized interest of $ 29 , $ 22 and $ 14“ |
| interest_expense | 3 | 2022-12-31 | 1,207 | 1,207 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Interest expense-net of capitalized interest of $ 22 , $ 14 and $ 9“ |
| interest_expense | 4 | 2021-12-31 | 1,185.8 | 1,185.8 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Interest expense-net of capitalized interest of $ 14.5 , $ 9.5 and $ 6“ |
| interest_expense | 5 | 2020-12-31 | 1,218.1 | 1,218.1 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Interest expense-net of capitalized interest of $ 9.5 , $ 6.8 and $ 6.“ |
| interest_expense | 6 | 2019-12-31 | 1,121.9 | 1,121.9 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Interest expense-net of capitalized interest of $6.8, $6.0 and $7.4“ |
| interest_expense | 7 | 2018-12-31 | 981.2 | 981.2 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Interest expense-net of capitalized interest of $6.0, $7.4 and $5.6“ |
| interest_expense | 8 | 2017-12-31 | 921.3 | 921.3 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Interest expense-net of capitalized interest of $7.4, $5.6 and $5.3“ |
| interest_expense | 9 | 2016-12-31 | 884.8 | 884.8 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Interest expense-net of capitalized interest of $5.6, $5.3 and $7.1“ |
| tax_expense | 0 | 2025-12-31 | 2,334 | 2,334 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Provision for income taxes“ |
| tax_expense | 1 | 2024-12-31 | 2,121 | 2,121 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Provision for income taxes“ |
| tax_expense | 2 | 2023-12-31 | 2,053 | 2,053 | ✓ | ✓ | — | korrekt | Fassungen 2,053.4 / 2,053 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Provision for income taxes“ |
| tax_expense | 3 | 2022-12-31 | 1,648 | 1,648 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Provision for income taxes“ |
| tax_expense | 4 | 2021-12-31 | 1,582.7 | 1,582.7 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Provision for income taxes“ |
| tax_expense | 5 | 2020-12-31 | 1,410.2 | 1,410.2 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Provision for income taxes“ |
| tax_expense | 6 | 2019-12-31 | 1,992.7 | 1,992.7 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Provision for income taxes“ |
| tax_expense | 7 | 2018-12-31 | 1,891.8 | 1,891.8 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Provision for income taxes“ |
| tax_expense | 8 | 2017-12-31 | 3,381.2 | 3,381.2 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Provision for income taxes“ |
| tax_expense | 9 | 2016-12-31 | 2,179.5 | 2,179.5 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Provision for income taxes“ |
| sbc | 0 | 2025-12-31 | 165 | 165 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Share-based compensation“ |
| sbc | 1 | 2024-12-31 | 172 | 172 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Share-based compensation“ |
| sbc | 2 | 2023-12-31 | 175 | 175 | ✓ | ✓ | — | korrekt | Fassungen 175.2 / 175 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Share-based compensation“ |
| sbc | 3 | 2022-12-31 | 167 | 167 | ✓ | ✓ | — | korrekt | Fassungen 166.7 / 167 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Share-based compensation“ |
| sbc | 4 | 2021-12-31 | 139.2 | 139.2 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Share-based compensation“ |
| sbc | 5 | 2020-12-31 | 92.4 | 92.4 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Share-based compensation“ |
| sbc | 6 | 2019-12-31 | 109.6 | 109.6 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Share-based compensation“ |
| sbc | 7 | 2018-12-31 | 125.1 | 125.1 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Share-based compensation“ |
| sbc | 8 | 2017-12-31 | 117.5 | 117.5 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Share-based compensation“ |
| sbc | 9 | 2016-12-31 | 131.3 | 131.3 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Share-based compensation“ |
| buybacks_dollar | 0 | 2025-12-31 | 2,056 | 2,056 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 1 | 2024-12-31 | 2,824 | 2,824 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 2 | 2023-12-31 | 3,054 | 3,054 | ✓ | ✓ | — | korrekt | Fassungen 3,054.3 / 3,054 (juengste 0000063908-26-000035) · Original mcd-20251231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 3 | 2022-12-31 | 3,896 | 3,896 | ✓ | ✓ | — | korrekt | Original mcd-20241231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 4 | 2021-12-31 | 845.5 | 845.5 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 5 | 2020-12-31 | 907.8 | 907.8 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 6 | 2019-12-31 | 4,976.2 | 4,976.2 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 7 | 2018-12-31 | 5,207.7 | 5,207.7 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Treasury stock purchases“ |
| buybacks_dollar | 8 | 2017-12-31 | 4,685.7 | 4,685.7 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Treasury stock purchases“ |
| buybacks_dollar | 9 | 2016-12-31 | 11,171 | 11,171 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Treasury stock purchases“ |
| retained_earnings | 0 | 2025-12-31 | 70,282 | 70,282 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Retained earnings“ |
| retained_earnings | 1 | 2024-12-31 | 66,834 | 66,834 | ✓ | ✓ | — | korrekt | Original mcd-20251231.htm: „Retained earnings“ |
| retained_earnings | 2 | 2023-12-31 | 63,480 | 63,480 | ✓ | ✓ | — | korrekt | Fassungen 63,479.9 / 63,480 (juengste 0000063908-25-000012) · Original mcd-20241231.htm: „Retained earnings“ |
| retained_earnings | 3 | 2022-12-31 | 59,543.9 | 59,543.9 | ✓ | ✓ | — | korrekt | Original mcd-20231231.htm: „Retained earnings“ |
| retained_earnings | 4 | 2021-12-31 | 57,534.7 | 57,534.7 | ✓ | ✓ | — | korrekt | Original mcd-20221231.htm: „Retained earnings“ |
| retained_earnings | 5 | 2020-12-31 | 53,908.1 | 53,908.1 | ✓ | ✓ | — | korrekt | Original mcd-20211231.htm: „Retained earnings“ |
| retained_earnings | 6 | 2019-12-31 | 52,930.5 | 52,930.5 | ✓ | ✓ | — | korrekt | Original mcd-20201231.htm: „Retained earnings“ |
| retained_earnings | 7 | 2018-12-31 | 50,487 | 50,487 | ✓ | ✓ | — | korrekt | Original mcd-12312019x10k.htm: „Retained earnings“ |
| retained_earnings | 8 | 2017-12-31 | 48,325.8 | 48,325.8 | ✓ | ✓ | — | korrekt | Original mcd-12312018x10k.htm: „Retained earnings“ |
| retained_earnings | 9 | 2016-12-31 | 46,222.7 | 46,222.7 | ✓ | ✓ | — | korrekt | Original mcd-12312017x10k.htm: „Retained earnings“ |
| goodwill_and_intangibles | 0 | 2025-12-31 | 3,354 | 3,354 | ✓ | · | — | korrekt | Goodwill 3,354 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 1 | 2024-12-31 | 3,145 | 3,145 | ✓ | · | — | korrekt | Goodwill 3,145 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 2 | 2023-12-31 | 3,040 | 3,040 | ✓ | · | — | korrekt | Goodwill 3,040 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 3 | 2022-12-31 | 2,900.4 | 2,900.4 | ✓ | · | — | korrekt | Goodwill 2,900.4 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 4 | 2021-12-31 | 2,782.5 | 2,782.5 | ✓ | · | — | korrekt | Goodwill 2,782.5 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 5 | 2020-12-31 | 2,773.1 | 2,773.1 | ✓ | · | — | korrekt | Goodwill 2,773.1 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 6 | 2019-12-31 | 2,677.4 | 2,677.4 | ✓ | · | — | korrekt | Goodwill 2,677.4 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 7 | 2018-12-31 | 2,331.5 | 2,331.5 | ✓ | · | — | korrekt | Goodwill 2,331.5 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 8 | 2017-12-31 | 2,379.7 | 2,379.7 | ✓ | · | — | korrekt | Goodwill 2,379.7 + Intangibles nicht gemeldet |
| goodwill_and_intangibles | 9 | 2016-12-31 | 2,336.5 | 2,336.5 | ✓ | · | — | korrekt | Goodwill 2,336.5 + Intangibles nicht gemeldet |
| tangible_book_value | 0 | 2025-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 1 | 2024-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 2 | 2023-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 3 | 2022-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 4 | 2021-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 5 | 2020-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 6 | 2019-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 7 | 2018-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 8 | 2017-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| tangible_book_value | 9 | 2016-12-31 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |

Ohne Wert im Tool (nicht abgeglichen): da, total_liabilities, buybacks, gross_profit, maintenance_capex, tangible_book_value

### JNJ — CIK0000200406.companyfacts.json (Rohdatei sha256 7141c0c988fa1d30…)

| Feld | i | Periode | Tool | Quelle | Rechnung | Original | Umfang | Status | Hinweis |
|---|---|---|---|---|---|---|---|---|---|
| revenue | 0 | 2025-12-28 | 94,193 | 94,193 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Sales to customers“ |
| revenue | 1 | 2024-12-29 | 88,821 | 88,821 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Sales to customers“ |
| revenue | 2 | 2023-12-31 | 85,159 | 85,159 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Sales to customers“ |
| revenue | 3 | 2023-01-01 | 79,990 | 79,990 | ✓ | ✓ | — | korrekt | Fassungen 94,943 / 79,990 (juengste 0000200406-25-000038) · Original jnj-20241229.htm: „Sales to customers“ |
| revenue | 4 | 2022-01-02 | 78,740 | 78,740 | ✓ | ✓ | — | korrekt | Fassungen 93,775 / 78,740 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Sales to customers“ |
| revenue | 5 | 2021-01-03 | 82,584 | 82,584 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Sales to customers“ |
| revenue | 6 | 2019-12-29 | 82,059 | 82,059 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Sales to customers“ |
| revenue | 7 | 2018-12-30 | 81,581 | 81,581 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Sales to customers“ |
| revenue | 8 | 2017-12-31 | 76,450 | 76,450 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Sales to customers“ |
| revenue | 9 | 2017-01-01 | 71,890 | 71,890 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| cfo | 0 | 2025-12-28 | 24,530 | 24,530 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net cash flows from operating activities“ |
| cfo | 1 | 2024-12-29 | 24,266 | 24,266 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net cash flows from operating activities“ |
| cfo | 2 | 2023-12-31 | 22,791 | 22,791 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net cash flows from operating activities“ |
| cfo | 3 | 2023-01-01 | 21,194 | 21,194 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Net cash flows from operating activities“ |
| cfo | 4 | 2022-01-02 | 23,410 | 23,410 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Net cash flows from operating activities“ |
| cfo | 5 | 2021-01-03 | 23,536 | 23,536 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Net cash flows from operating activities“ |
| cfo | 6 | 2019-12-29 | 23,416 | 23,416 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Net cash flows from operating activities“ |
| cfo | 7 | 2018-12-30 | 22,201 | 22,201 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Net cash flows from operating activities“ |
| cfo | 8 | 2017-12-31 | 21,056 | 21,056 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Net cash flows from operating activities“ |
| cfo | 9 | 2017-01-01 | 18,767 | 18,767 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| capex | 0 | 2025-12-28 | 4,832 | 4,832 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Additions to property, plant and equipment“ |
| capex | 1 | 2024-12-29 | 4,424 | 4,424 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Additions to property, plant and equipment“ |
| capex | 2 | 2023-12-31 | 4,543 | 4,543 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Additions to property, plant and equipment“ |
| capex | 3 | 2023-01-01 | 4,009 | 4,009 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Additions to property, plant and equipment“ |
| capex | 4 | 2022-01-02 | 3,652 | 3,652 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Additions to property, plant and equipment“ |
| capex | 5 | 2021-01-03 | 3,347 | 3,347 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Additions to property, plant and equipment“ |
| capex | 6 | 2019-12-29 | 3,498 | 3,498 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Additions to property, plant and equipment“ |
| capex | 7 | 2018-12-30 | 3,670 | 3,670 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Additions to property, plant and equipment“ |
| capex | 8 | 2017-12-31 | 3,279 | 3,279 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Additions to property, plant and equipment“ |
| capex | 9 | 2017-01-01 | 3,226 | 3,226 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| fcf | 0 | 2025-12-28 | 19,698 | 19,698 | ✓ | · | — | korrekt | CFO 24,530 − CapEx 4,832 |
| fcf | 1 | 2024-12-29 | 19,842 | 19,842 | ✓ | · | — | korrekt | CFO 24,266 − CapEx 4,424 |
| fcf | 2 | 2023-12-31 | 18,248 | 18,248 | ✓ | · | — | korrekt | CFO 22,791 − CapEx 4,543 |
| fcf | 3 | 2023-01-01 | 17,185 | 17,185 | ✓ | · | — | korrekt | CFO 21,194 − CapEx 4,009 |
| fcf | 4 | 2022-01-02 | 19,758 | 19,758 | ✓ | · | — | korrekt | CFO 23,410 − CapEx 3,652 |
| fcf | 5 | 2021-01-03 | 20,189 | 20,189 | ✓ | · | — | korrekt | CFO 23,536 − CapEx 3,347 |
| fcf | 6 | 2019-12-29 | 19,918 | 19,918 | ✓ | · | — | korrekt | CFO 23,416 − CapEx 3,498 |
| fcf | 7 | 2018-12-30 | 18,531 | 18,531 | ✓ | · | — | korrekt | CFO 22,201 − CapEx 3,670 |
| fcf | 8 | 2017-12-31 | 17,777 | 17,777 | ✓ | · | — | korrekt | CFO 21,056 − CapEx 3,279 |
| fcf | 9 | 2017-01-01 | 15,541 | 15,541 | ✓ | · | — | korrekt | CFO 18,767 − CapEx 3,226 |
| total_debt | 0 | 2025-12-28 | 41,438 | 41,438 | ✓ | ✓ | Teilbetrag: vollstaendig 47,933 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Original jnj-20251228.htm: „Subtotal“ · Finanzschulden = „Loans and notes payable“ 8,495 + „Long-term debt“ 39,438 = 47,933 (laufender Anteil 2,000 steckt in 8,495). Finance-Leasing: „not significant“ ohne Betrag. |
| total_debt | 1 | 2024-12-29 | 32,400 | 32,400 | ✓ | ✓ | Teilbetrag: vollstaendig 36,634 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Original jnj-20251228.htm: „Subtotal“ · Finanzschulden 5,983 + 30,651 = 36,634 (Anhang 7: laufender Anteil 1.7 Mrd. in 5,983). Finance-Leasing ohne Betrag. |
| total_debt | 2 | 2023-12-31 | 27,350 | 27,350 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20241229.htm: „Subtotal“ |
| total_debt | 3 | 2023-01-01 | 28,437 | 28,437 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Fassungen 28,439 / 28,437 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Subtotal“ |
| total_debt | 4 | 2022-01-02 | 32,116 | 32,116 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20230101.htm: „Subtotal“ |
| total_debt | 5 | 2021-01-03 | 34,434 | 34,434 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20220102.htm: „Subtotal“ |
| total_debt | 6 | 2011-01-02 | 9,169 | 9,169 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20110102.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| total_debt | 7 | 2010-01-03 | 8,257 | 8,257 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20110102.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| net_debt | 0 | 2025-12-28 | 21,729 | 21,729 | ✓ | · | Teilbetrag: vollstaendig ≥ 28,224 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Rechnung: Schulden 41,438 − Liquiditaet 19,709 · Finanzschulden = „Loans and notes payable“ 8,495 + „Long-term debt“ 39,438 = 47,933 (laufender Anteil 2,000 steckt in 8,495). Finance-Leasing: „not significant“ ohne Betrag. |
| net_debt | 1 | 2024-12-29 | 8,295 | 8,295 | ✓ | · | Teilbetrag: vollstaendig ≥ 12,529 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Rechnung: Schulden 32,400 − Liquiditaet 24,105 · Finanzschulden 5,983 + 30,651 = 36,634 (Anhang 7: laufender Anteil 1.7 Mrd. in 5,983). Finance-Leasing ohne Betrag. |
| net_debt | 2 | 2023-12-31 | 5,491 | 5,491 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 27,350 − Liquiditaet 21,859 |
| net_debt | 3 | 2023-01-01 | 15,548 | 15,548 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 28,437 − Liquiditaet 12,889 |
| net_debt | 4 | 2022-01-02 | 17,629 | 17,629 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 32,116 − Liquiditaet 14,487 |
| net_debt | 5 | 2021-01-03 | 20,449 | 20,449 | ✓ | · | offen (kein Umfangsbeleg) | offen | Rechnung: Schulden 34,434 − Liquiditaet 13,985 |
| net_debt | 6 | 2011-01-02 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| net_debt | 7 | 2010-01-03 | — | — | · | · | — | offen | kein Wert/keine Periode im Tool (nicht verwendet) |
| debt_short_term | 0 | 2025-12-28 | 8,495 | 8,495 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 1 | 2024-12-29 | 5,983 | 5,983 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 2 | 2023-12-31 | 3,451 | 3,451 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 3 | 2023-01-01 | 12,756 | 12,756 | ✓ | ✓ | — | korrekt | Fassungen 12,771 / 12,756 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 4 | 2022-01-02 | 3,766 | 3,766 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 5 | 2021-01-03 | 2,631 | 2,631 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 6 | 2019-12-29 | 1,202 | 1,202 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 7 | 2018-12-30 | 2,796 | 2,796 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Loans and notes payable (Note 7)“ |
| debt_short_term | 8 | 2017-12-31 | 3,906 | 3,906 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_short_term | 9 | 2017-01-01 | 4,684 | 4,684 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 0 | 2025-12-28 | 2,000 | 2,000 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Less current portion“ |
| debt_long_term_current | 1 | 2024-12-29 | 1,749 | 1,749 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Less current portion“ |
| debt_long_term_current | 2 | 2023-12-31 | 1,469 | 1,469 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Less current portion“ |
| debt_long_term_current | 3 | 2023-01-01 | 1,551 | 1,551 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Less current portion“ |
| debt_long_term_current | 4 | 2022-01-02 | 2,131 | 2,131 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Less current portion“ |
| debt_long_term_current | 5 | 2021-01-03 | 1,799 | 1,799 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Less current portion“ |
| debt_long_term_current | 6 | 2018-12-30 | 2,600 | 2,600 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 7 | 2017-12-31 | 1,500 | 1,500 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 8 | 2017-01-01 | 1,700 | 1,700 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_current | 9 | 2011-01-02 | 13 | 13 | ✓ | ✓ | — | korrekt | Original jnj-20110102.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_noncurrent | 0 | 2025-12-28 | 39,438 | 39,438 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 1 | 2024-12-29 | 30,651 | 30,651 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 2 | 2023-12-31 | 25,881 | 25,881 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 3 | 2023-01-01 | 26,886 | 26,886 | ✓ | ✓ | — | korrekt | Fassungen 26,888 / 26,886 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 4 | 2022-01-02 | 29,985 | 29,985 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 5 | 2021-01-03 | 32,635 | 32,635 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 6 | 2019-12-29 | 26,494 | 26,494 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 7 | 2018-12-30 | 27,684 | 27,684 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Long-term debt (Note 7)“ |
| debt_long_term_noncurrent | 8 | 2017-12-31 | 30,675 | 30,675 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| debt_long_term_noncurrent | 9 | 2017-01-01 | 22,442 | 22,442 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| operating_lease_liability_current | 0 | 2019-12-29 | 269 | 269 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Current operating lease liabilities“ |
| operating_lease_liability_noncurrent | 0 | 2019-12-29 | 716 | 716 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Non-current Operating lease liabilities“ |
| operating_lease_liabilities | 0 | 2025-12-28 | 1,400 | 1,400 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Text: …ses was $ 1.3 billion and $ 1.1 billion in fiscal years 2025 an“ |
| operating_lease_liabilities | 1 | 2024-12-29 | 1,200 | 1,200 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Text: …ion and $ 1.1 billion in fiscal years 2025 and 2024, respective“ |
| operating_lease_liabilities | 2 | 2023-12-31 | 1,100 | 1,100 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Text: …scal years 2024 and 2023, respectively. The lease liability fro“ |
| operating_lease_liabilities | 3 | 2023-01-01 | 1,300 | 1,300 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Text: …ses was $ 1.1 billion and $ 0.9 billion in fiscal years 2022 an“ |
| operating_lease_liabilities | 4 | 2022-01-02 | 1,000 | 1,000 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Text: …ion and $ 0.9 billion in fiscal years 2022 and 2021, respective“ |
| operating_lease_liabilities | 5 | 2021-01-03 | 1,100 | 1,100 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Text: …21a">0.9 billion and $ 1.0 billion in 2021 and 2020, respective“ |
| operating_lease_liabilities | 6 | 2019-12-29 | 1,000 | 1,000 | ✓ | ✓ | — | korrekt | Fassungen 985 / 1,000 (juengste 0000200406-21-000008) · Original jnj-20210103.htm: „Text: …ec4">1.0 billion and $ 1.0 billion in 2020 and 2019, respective“ |
| cash_and_equivalents | 0 | 2025-12-28 | 19,709 | 19,709 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 1 | 2024-12-29 | 24,105 | 24,105 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 2 | 2023-12-31 | 21,859 | 21,859 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 3 | 2023-01-01 | 12,889 | 12,889 | ✓ | ✓ | — | korrekt | Fassungen 14,127 / 12,889 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 4 | 2022-01-02 | 14,487 | 14,487 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 5 | 2021-01-03 | 13,985 | 13,985 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 6 | 2019-12-29 | 17,305 | 17,305 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 7 | 2018-12-30 | 18,107 | 18,107 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Cash and cash equivalents (Notes 1 and 2)“ |
| cash_and_equivalents | 8 | 2017-12-31 | 17,824 | 17,824 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| cash_and_equivalents | 9 | 2017-01-01 | 18,972 | 18,972 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| shares_diluted | 0 | 2025-12-28 | 2,429.4 | 2,429.4 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 1 | 2024-12-29 | 2,429.4 | 2,429.4 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 2 | 2023-12-31 | 2,560.4 | 2,560.4 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 3 | 2023-01-01 | 2,663.9 | 2,663.9 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 4 | 2022-01-02 | 2,674 | 2,674 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 5 | 2021-01-03 | 2,670.7 | 2,670.7 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 6 | 2019-12-29 | 2,684.3 | 2,684.3 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 7 | 2018-12-30 | 2,728.7 | 2,728.7 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 8 | 2017-12-31 | 2,745.3 | 2,745.3 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm (Akte laut Company Facts): „Diluted“ |
| shares_diluted | 9 | 2017-01-01 | 2,788.9 | 2,788.9 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml (Akte laut Company Facts): „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| shares_basic | 0 | 2025-12-28 | 2,407.4 | 2,407.4 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 1 | 2024-12-29 | 2,407.3 | 2,407.3 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 2 | 2023-12-31 | 2,533.5 | 2,533.5 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 3 | 2023-01-01 | 2,625.2 | 2,625.2 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 4 | 2022-01-02 | 2,632.1 | 2,632.1 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 5 | 2021-01-03 | 2,632.8 | 2,632.8 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 6 | 2019-12-29 | 2,645.1 | 2,645.1 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 7 | 2018-12-30 | 2,681.5 | 2,681.5 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 8 | 2017-12-31 | 2,692 | 2,692 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm (Akte laut Company Facts): „Basic“ |
| shares_basic | 9 | 2017-01-01 | 2,737.3 | 2,737.3 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml (Akte laut Company Facts): „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| eps_diluted | 0 | 2025-12-28 | 11.03 | 11.03 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total net earnings per share - diluted“ |
| eps_diluted | 1 | 2024-12-29 | 5.79 | 5.79 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total net earnings per share - diluted“ |
| eps_diluted | 2 | 2023-12-31 | 13.72 | 13.72 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total net earnings per share - diluted“ |
| eps_diluted | 3 | 2023-01-01 | 6.73 | 6.73 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Total net earnings per share - diluted“ |
| eps_diluted | 4 | 2022-01-02 | 7.81 | 7.81 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Total net earnings per share - diluted“ |
| eps_diluted | 5 | 2021-01-03 | 5.51 | 5.51 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Diluted“ |
| eps_diluted | 6 | 2019-12-29 | 5.63 | 5.63 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Diluted“ |
| eps_diluted | 7 | 2018-12-30 | 5.61 | 5.61 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Diluted“ |
| eps_diluted | 8 | 2017-12-31 | 0.47 | 0.47 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Diluted“ |
| eps_diluted | 9 | 2017-01-01 | 5.93 | 5.93 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| dps | 0 | 2025-12-28 | 5.14 | 5.14 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Cash dividends paid ($ 5.14 per share)“ |
| dps | 1 | 2024-12-29 | 4.91 | 4.91 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Cash dividends paid ($ 4.91 per share)“ |
| dps | 2 | 2023-12-31 | 4.7 | 4.7 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm (Akte laut Company Facts): „Cash dividends paid ($ 4.70 per share)“ |
| dps | 3 | 2023-01-01 | 4.45 | 4.45 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm (Akte laut Company Facts): „Cash dividends paid ($ 4.45 per share)“ |
| dps | 4 | 2022-01-02 | 4.19 | 4.19 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm (Akte laut Company Facts): „Cash dividends paid ($ 4.19 per share)“ |
| dps | 5 | 2021-01-03 | 3.98 | 3.98 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm (Akte laut Company Facts): „Cash dividends paid ($ 3.98 per share)“ |
| dps | 6 | 2019-12-29 | 3.75 | 3.75 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm (Akte laut Company Facts): „Cash dividends paid ($ 3.75 per share)“ |
| dps | 7 | 2018-12-30 | 3.54 | 3.54 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm (Akte laut Company Facts): „Cash dividends paid ($ 3.54 per share)“ |
| dps | 8 | 2017-12-31 | 3.32 | 3.32 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm (Akte laut Company Facts): „Text: …9F2F339665953790BFB5-wk-Fact-FDBBA4F5A9DB9F2F339665953790BFB5">“ |
| dps | 9 | 2017-01-01 | 3.15 | 3.15 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml (Akte laut Company Facts): „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| dps_direct | 0 | 2025-12-28 | 5.14 | 5.14 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Cash dividends paid ($ 5.14 per share)“ |
| dps_direct | 1 | 2024-12-29 | 4.91 | 4.91 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Cash dividends paid ($ 4.91 per share)“ |
| dps_direct | 2 | 2023-12-31 | 4.7 | 4.7 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Cash dividends paid ($ 4.70 per share)“ |
| dps_direct | 3 | 2023-01-01 | 4.45 | 4.45 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Cash dividends paid ($ 4.45 per share)“ |
| dps_direct | 4 | 2022-01-02 | 4.19 | 4.19 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Cash dividends paid ($ 4.19 per share)“ |
| dps_direct | 5 | 2021-01-03 | 3.98 | 3.98 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Cash dividends paid ($ 3.98 per share)“ |
| dps_direct | 6 | 2019-12-29 | 3.75 | 3.75 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Cash dividends paid ($ 3.75 per share)“ |
| dps_direct | 7 | 2018-12-30 | 3.54 | 3.54 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Cash dividends paid ($ 3.54 per share)“ |
| dps_direct | 8 | 2017-12-31 | 3.32 | 3.32 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Text: …9F2F339665953790BFB5-wk-Fact-FDBBA4F5A9DB9F2F339665953790BFB5">“ |
| dps_direct | 9 | 2017-01-01 | 3.15 | 3.15 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| net_income | 0 | 2025-12-28 | 26,804 | 26,804 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net earnings“ |
| net_income | 1 | 2024-12-29 | 14,066 | 14,066 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net earnings“ |
| net_income | 2 | 2023-12-31 | 35,153 | 35,153 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Net earnings“ |
| net_income | 3 | 2023-01-01 | 17,941 | 17,941 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Net earnings“ |
| net_income | 4 | 2022-01-02 | 20,878 | 20,878 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Net earnings“ |
| net_income | 5 | 2021-01-03 | 14,714 | 14,714 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Net earnings“ |
| net_income | 6 | 2019-12-29 | 15,119 | 15,119 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Net earnings“ |
| net_income | 7 | 2018-12-30 | 15,297 | 15,297 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Net earnings“ |
| net_income | 8 | 2017-12-31 | 1,300 | 1,300 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Net earnings“ |
| net_income | 9 | 2017-01-01 | 16,540 | 16,540 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| book_value | 0 | 2025-12-28 | 81,544 | 81,544 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 1 | 2024-12-29 | 71,490 | 71,490 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 2 | 2023-12-31 | 68,774 | 68,774 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 3 | 2023-01-01 | 76,804 | 76,804 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 4 | 2022-01-02 | 74,023 | 74,023 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 5 | 2021-01-03 | 63,278 | 63,278 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 6 | 2019-12-29 | 59,471 | 59,471 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 7 | 2018-12-30 | 59,752 | 59,752 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 8 | 2017-12-31 | 60,160 | 60,160 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| book_value | 9 | 2017-01-01 | 70,418 | 70,418 | ✓ | · | — | korrekt | Assets − Liabilities (10-K-Fakten) |
| long_term_debt | 0 | 2025-12-28 | 41,438 | 41,438 | ✓ | ✓ | Teilbetrag: vollstaendig 47,933 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Original jnj-20251228.htm: „Subtotal“ · Finanzschulden = „Loans and notes payable“ 8,495 + „Long-term debt“ 39,438 = 47,933 (laufender Anteil 2,000 steckt in 8,495). Finance-Leasing: „not significant“ ohne Betrag. |
| long_term_debt | 1 | 2024-12-29 | 32,400 | 32,400 | ✓ | ✓ | Teilbetrag: vollstaendig 36,634 (Finance-Leasing ohne Betrag) · Engine: Umfang als unvollstaendig gekennzeichnet | berechtigte Einschraenkung | Original jnj-20251228.htm: „Subtotal“ · Finanzschulden 5,983 + 30,651 = 36,634 (Anhang 7: laufender Anteil 1.7 Mrd. in 5,983). Finance-Leasing ohne Betrag. |
| long_term_debt | 2 | 2023-12-31 | 27,350 | 27,350 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20241229.htm: „Subtotal“ |
| long_term_debt | 3 | 2023-01-01 | 28,437 | 28,437 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Fassungen 28,439 / 28,437 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Subtotal“ |
| long_term_debt | 4 | 2022-01-02 | 32,116 | 32,116 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20230101.htm: „Subtotal“ |
| long_term_debt | 5 | 2021-01-03 | 34,434 | 34,434 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20220102.htm: „Subtotal“ |
| long_term_debt | 6 | 2011-01-02 | 9,169 | 9,169 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20110102.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| long_term_debt | 7 | 2010-01-03 | 8,257 | 8,257 | ✓ | ✓ | offen (kein Umfangsbeleg) | offen | Original jnj-20110102.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| cash | 0 | 2025-12-28 | 19,709 | 19,709 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 1 | 2024-12-29 | 24,105 | 24,105 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 2 | 2023-12-31 | 21,859 | 21,859 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 3 | 2023-01-01 | 12,889 | 12,889 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 4 | 2022-01-02 | 14,487 | 14,487 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 5 | 2021-01-03 | 13,985 | 13,985 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 6 | 2019-12-29 | 17,305 | 17,305 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 7 | 2018-12-30 | 18,107 | 18,107 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 8 | 2017-12-31 | 17,824 | 17,824 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| cash | 9 | 2017-01-01 | 18,972 | 18,972 | ✓ | · | — | korrekt | Alias von cash_and_equivalents (ohne eigene Periodenangabe, gleiche Position) |
| total_assets | 0 | 2025-12-28 | 199,210 | 199,210 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total assets“ |
| total_assets | 1 | 2024-12-29 | 180,104 | 180,104 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total assets“ |
| total_assets | 2 | 2023-12-31 | 167,558 | 167,558 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Total assets“ |
| total_assets | 3 | 2023-01-01 | 187,378 | 187,378 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Total assets“ |
| total_assets | 4 | 2022-01-02 | 182,018 | 182,018 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Total assets“ |
| total_assets | 5 | 2021-01-03 | 174,894 | 174,894 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Total assets“ |
| total_assets | 6 | 2019-12-29 | 157,728 | 157,728 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Total assets“ |
| total_assets | 7 | 2018-12-30 | 152,954 | 152,954 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Total assets“ |
| total_assets | 8 | 2017-12-31 | 157,303 | 157,303 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| total_assets | 9 | 2017-01-01 | 141,208 | 141,208 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| total_liabilities | 0 | 2025-12-28 | 117,666 | 117,666 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total liabilities“ |
| total_liabilities | 1 | 2024-12-29 | 108,614 | 108,614 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total liabilities“ |
| total_liabilities | 2 | 2023-12-31 | 98,784 | 98,784 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Total liabilities“ |
| total_liabilities | 3 | 2023-01-01 | 110,574 | 110,574 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Total liabilities“ |
| total_liabilities | 4 | 2022-01-02 | 107,995 | 107,995 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Total liabilities“ |
| total_liabilities | 5 | 2021-01-03 | 111,616 | 111,616 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Total liabilities“ |
| total_liabilities | 6 | 2019-12-29 | 98,257 | 98,257 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Total liabilities“ |
| total_liabilities | 7 | 2018-12-30 | 93,202 | 93,202 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Total liabilities“ |
| total_liabilities | 8 | 2017-12-31 | 97,143 | 97,143 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| total_liabilities | 9 | 2017-01-01 | 70,790 | 70,790 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| current_assets | 0 | 2025-12-28 | 55,624 | 55,624 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total current assets“ |
| current_assets | 1 | 2024-12-29 | 55,893 | 55,893 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total current assets“ |
| current_assets | 2 | 2023-12-31 | 53,495 | 53,495 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Total current assets“ |
| current_assets | 3 | 2023-01-01 | 55,294 | 55,294 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Total current assets“ |
| current_assets | 4 | 2022-01-02 | 60,979 | 60,979 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Total current assets“ |
| current_assets | 5 | 2021-01-03 | 51,237 | 51,237 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Total current assets“ |
| current_assets | 6 | 2019-12-29 | 45,274 | 45,274 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Total current assets“ |
| current_assets | 7 | 2018-12-30 | 46,033 | 46,033 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Total current assets“ |
| current_assets | 8 | 2017-12-31 | 43,088 | 43,088 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| current_assets | 9 | 2017-01-01 | 65,032 | 65,032 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| current_liabilities | 0 | 2025-12-28 | 54,126 | 54,126 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total current liabilities“ |
| current_liabilities | 1 | 2024-12-29 | 50,321 | 50,321 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Total current liabilities“ |
| current_liabilities | 2 | 2023-12-31 | 46,282 | 46,282 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Total current liabilities“ |
| current_liabilities | 3 | 2023-01-01 | 55,802 | 55,802 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Total current liabilities“ |
| current_liabilities | 4 | 2022-01-02 | 45,226 | 45,226 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Total current liabilities“ |
| current_liabilities | 5 | 2021-01-03 | 42,493 | 42,493 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Total current liabilities“ |
| current_liabilities | 6 | 2019-12-29 | 35,964 | 35,964 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Total current liabilities“ |
| current_liabilities | 7 | 2018-12-30 | 31,230 | 31,230 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Total current liabilities“ |
| current_liabilities | 8 | 2017-12-31 | 30,537 | 30,537 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| current_liabilities | 9 | 2017-01-01 | 26,287 | 26,287 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| tax_expense | 0 | 2025-12-28 | 5,777 | 5,777 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 1 | 2024-12-29 | 2,621 | 2,621 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 2 | 2023-12-31 | 1,736 | 1,736 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 3 | 2023-01-01 | 2,989 | 2,989 | ✓ | ✓ | — | korrekt | Fassungen 3,784 / 2,989 (juengste 0000200406-25-000038) · Original jnj-20241229.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 4 | 2022-01-02 | 1,377 | 1,377 | ✓ | ✓ | — | korrekt | Fassungen 1,898 / 1,377 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 5 | 2021-01-03 | 1,783 | 1,783 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 6 | 2019-12-29 | 2,209 | 2,209 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 7 | 2018-12-30 | 2,702 | 2,702 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 8 | 2017-12-31 | 16,373 | 16,373 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Provision for taxes on income (Note 8)“ |
| tax_expense | 9 | 2017-01-01 | 3,263 | 3,263 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| sbc | 0 | 2025-12-28 | 1,354 | 1,354 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Stock based compensation“ |
| sbc | 1 | 2024-12-29 | 1,176 | 1,176 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Stock based compensation“ |
| sbc | 2 | 2023-12-31 | 1,162 | 1,162 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Stock based compensation“ |
| sbc | 3 | 2023-01-01 | 1,138 | 1,138 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Stock based compensation“ |
| sbc | 4 | 2022-01-02 | 1,135 | 1,135 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Stock based compensation“ |
| sbc | 5 | 2021-01-03 | 1,005 | 1,005 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Stock based compensation“ |
| sbc | 6 | 2019-12-29 | 977 | 977 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Stock based compensation“ |
| sbc | 7 | 2018-12-30 | 978 | 978 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Stock based compensation“ |
| sbc | 8 | 2017-12-31 | 962 | 962 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Stock based compensation“ |
| sbc | 9 | 2017-01-01 | 878 | 878 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| buybacks_dollar | 0 | 2025-12-28 | 5,953 | 5,953 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Repurchase of common stock“ |
| buybacks_dollar | 1 | 2024-12-29 | 2,432 | 2,432 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Repurchase of common stock“ |
| buybacks_dollar | 2 | 2023-12-31 | 5,054 | 5,054 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Repurchase of common stock“ |
| buybacks_dollar | 3 | 2023-01-01 | 6,035 | 6,035 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Repurchase of common stock“ |
| buybacks_dollar | 4 | 2022-01-02 | 3,456 | 3,456 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Repurchase of common stock“ |
| buybacks_dollar | 5 | 2021-01-03 | 3,221 | 3,221 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Repurchase of common stock“ |
| buybacks_dollar | 6 | 2019-12-29 | 6,746 | 6,746 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Repurchase of common stock“ |
| buybacks_dollar | 7 | 2018-12-30 | 5,868 | 5,868 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Repurchase of common stock“ |
| buybacks_dollar | 8 | 2017-12-31 | 6,358 | 6,358 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Repurchase of common stock“ |
| buybacks_dollar | 9 | 2017-01-01 | 8,979 | 8,979 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| retained_earnings | 0 | 2025-12-28 | 168,978 | 168,978 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Retained earnings and Additional-paid-in-capital“ |
| retained_earnings | 1 | 2024-12-29 | 155,791 | 155,791 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Retained earnings and Additional-paid-in-capital“ |
| retained_earnings | 2 | 2023-12-31 | 153,843 | 153,843 | ✓ | ✓ | — | korrekt | Original jnj-20241229.htm: „Retained earnings and Additional-paid-in-capital“ |
| retained_earnings | 3 | 2023-01-01 | 128,345 | 128,345 | ✓ | ✓ | — | korrekt | Original jnj-20231231.htm: „Retained earnings and Additional-paid-in-capital“ |
| retained_earnings | 4 | 2022-01-02 | 123,060 | 123,060 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Retained earnings“ |
| retained_earnings | 5 | 2021-01-03 | 113,890 | 113,890 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Retained earnings“ |
| retained_earnings | 6 | 2019-12-29 | 110,659 | 110,659 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Retained earnings“ |
| retained_earnings | 7 | 2018-12-30 | 106,216 | 106,216 | ✓ | ✓ | — | korrekt | Original form10-k20191229.htm: „Retained earnings“ |
| retained_earnings | 8 | 2017-12-31 | 101,793 | 101,793 | ✓ | ✓ | — | korrekt | Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| retained_earnings | 9 | 2017-01-01 | 110,551 | 110,551 | ✓ | ✓ | — | korrekt | Original jnj-20171231.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| gross_profit | 0 | 2025-12-28 | 63,937 | 63,937 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Gross profit“ |
| gross_profit | 1 | 2024-12-29 | 61,350 | 61,350 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Gross profit“ |
| gross_profit | 2 | 2023-12-31 | 58,606 | 58,606 | ✓ | ✓ | — | korrekt | Original jnj-20251228.htm: „Gross profit“ |
| gross_profit | 3 | 2023-01-01 | 55,394 | 55,394 | ✓ | ✓ | — | korrekt | Fassungen 63,854 / 55,394 (juengste 0000200406-25-000038) · Original jnj-20241229.htm: „Gross profit“ |
| gross_profit | 4 | 2022-01-02 | 55,338 | 55,338 | ✓ | ✓ | — | korrekt | Fassungen 63,920 / 55,338 (juengste 0000200406-24-000013) · Original jnj-20231231.htm: „Gross profit“ |
| gross_profit | 5 | 2021-01-03 | 54,157 | 54,157 | ✓ | ✓ | — | korrekt | Original jnj-20230101.htm: „Gross profit“ |
| gross_profit | 6 | 2019-12-29 | 54,503 | 54,503 | ✓ | ✓ | — | korrekt | Original jnj-20220102.htm: „Gross profit“ |
| gross_profit | 7 | 2018-12-30 | 54,490 | 54,490 | ✓ | ✓ | — | korrekt | Original jnj-20210103.htm: „Gross profit“ |
| gross_profit | 8 | 2017-12-31 | 51,011 | 51,011 | ✓ | ✓ | — | korrekt | Fassungen 51,096 / 51,011 (juengste 0000200406-20-000010) · Original form10-k20191229.htm: „Gross profit“ |
| gross_profit | 9 | 2017-01-01 | 50,101 | 50,101 | ✓ | ✓ | — | korrekt | Fassungen 50,205 / 50,101 (juengste 0000200406-19-000009) · Original jnj-20181230.xml: „XBRL-Instanz (Filing ohne Inline-XBRL)“ |
| goodwill_and_intangibles | 0 | 2025-12-28 | 99,175 | 99,175 | ✓ | · | — | korrekt | Goodwill 48,772 + Intangibles 50,403 |
| goodwill_and_intangibles | 1 | 2024-12-29 | 81,818 | 81,818 | ✓ | · | — | korrekt | Goodwill 44,200 + Intangibles 37,618 |
| goodwill_and_intangibles | 2 | 2023-12-31 | 70,733 | 70,733 | ✓ | · | — | korrekt | Goodwill 36,558 + Intangibles 34,175 |
| goodwill_and_intangibles | 3 | 2023-01-01 | 74,536 | 74,536 | ✓ | · | — | korrekt | Goodwill 36,047 + Intangibles 38,489 |
| goodwill_and_intangibles | 4 | 2022-01-02 | 71,828 | 71,828 | ✓ | · | — | korrekt | Goodwill 25,436 + Intangibles 46,392 |
| goodwill_and_intangibles | 5 | 2021-01-03 | 89,795 | 89,795 | ✓ | · | — | korrekt | Goodwill 36,393 + Intangibles 53,402 |
| goodwill_and_intangibles | 6 | 2019-12-29 | 81,282 | 81,282 | ✓ | · | — | korrekt | Goodwill 33,639 + Intangibles 47,643 |
| goodwill_and_intangibles | 7 | 2018-12-30 | 78,064 | 78,064 | ✓ | · | — | korrekt | Goodwill 30,453 + Intangibles 47,611 |
| goodwill_and_intangibles | 8 | 2017-12-31 | 85,134 | 85,134 | ✓ | · | — | korrekt | Goodwill 31,906 + Intangibles 53,228 |
| goodwill_and_intangibles | 9 | 2017-01-01 | 49,681 | 49,681 | ✓ | · | — | korrekt | Goodwill 22,805 + Intangibles 26,876 |

Ohne Wert im Tool (nicht abgeglichen): ebit, da, ebitda, finance_lease_current, finance_lease_noncurrent, dividends_paid, total_equity, interest_expense, buybacks, maintenance_capex, tangible_book_value
