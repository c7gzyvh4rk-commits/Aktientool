# D3 · Quellenabgleich MCD / JNJ (Anhang zu AUDIT-REAL-DATA-MCD-JNJ.md §12)

Erzeugt mit `node tests/real-data/reconcile-sources.mjs MCD JNJ --md …` aus der
Replay-Erfassung `fy` (Commit `05fefc6`, Datenstichtag 2026-09-24) und den
Company-Facts-Stichtagskopien. Geprüft sind die ersten drei Werte je Feld, so
wie die Erfassung sie enthält. „Quelle“ ist der zuletzt eingereichte 10-K-Fakt
desselben Tags und derselben Periode (bzw. der Rechenweg bei abgeleiteten
Feldern). `·` = im Tool kein Wert/keine Periode, nicht abgeglichen.

### MCD — CIK0000063908.companyfacts.json (Rohdatei sha256 0394e814d75510be…)

| Feld | i | Periode | Tool | Quelle | ✓ | Hinweis |
|---|---|---|---|---|---|---|
| revenue | 0 | 2025-12-31 | 26,885 | 26,885 | ✓ | Revenues |
| revenue | 1 | 2024-12-31 | 25,920 | 25,920 | ✓ | Revenues |
| revenue | 2 | 2023-12-31 | 25,494 | 25,494 | ✓ | Revenues · Fassungen: 25,493.7 / 25,494 (juengste 0000063908-26-000035) |
| ebit | 0 | 2025-12-31 | 12,393 | 12,393 | ✓ | OperatingIncomeLoss |
| ebit | 1 | 2024-12-31 | 11,712 | 11,712 | ✓ | OperatingIncomeLoss |
| ebit | 2 | 2023-12-31 | 11,647 | 11,647 | ✓ | OperatingIncomeLoss · Fassungen: 11,646.7 / 11,647 (juengste 0000063908-26-000035) |
| ebitda | 0 | 2025-12-31 | 14,592 | 14,592 | ✓ | EBIT 12,393 + D&A 2,199 (= DepreciationAndAmortization) · gemeldet: DepreciationDepletionAndAmortization 457, DepreciationAndAmortization 2,199, Depreciation 1,600 |
| ebitda | 1 | 2024-12-31 | 13,809 | 13,809 | ✓ | EBIT 11,712 + D&A 2,097 (= DepreciationAndAmortization) · gemeldet: DepreciationDepletionAndAmortization 447, DepreciationAndAmortization 2,097, Depreciation 1,500 |
| ebitda | 2 | 2023-12-31 | 13,625 | 13,625 | ✓ | EBIT 11,647 + D&A 1,978 (= DepreciationAndAmortization) · gemeldet: DepreciationDepletionAndAmortization 382, DepreciationAndAmortization 1,978, Depreciation 1,501.5 |
| cfo | 0 | 2025-12-31 | 10,551 | 10,551 | ✓ | NetCashProvidedByUsedInOperatingActivities |
| cfo | 1 | 2024-12-31 | 9,447 | 9,447 | ✓ | NetCashProvidedByUsedInOperatingActivities |
| cfo | 2 | 2023-12-31 | 9,612 | 9,612 | ✓ | NetCashProvidedByUsedInOperatingActivities · Fassungen: 9,611.9 / 9,612 (juengste 0000063908-26-000035) |
| capex | 0 | 2025-12-31 | 3,365 | 3,365 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment |
| capex | 1 | 2024-12-31 | 2,775 | 2,775 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment |
| capex | 2 | 2023-12-31 | 2,357 | 2,357 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment · Fassungen: 2,357.4 / 2,357 (juengste 0000063908-26-000035) |
| fcf | 0 | 2025-12-31 | 7,186 | 7,186 | ✓ | CFO 10,551 − CapEx 3,365 |
| fcf | 1 | 2024-12-31 | 6,672 | 6,672 | ✓ | CFO 9,447 − CapEx 2,775 |
| fcf | 2 | 2023-12-31 | 7,255 | 7,255 | ✓ | CFO 9,612 − CapEx 2,357 |
| total_debt | 0 | 2025-12-31 | 39,973 | 39,973 | ✓ | LongTermDebt |
| total_debt | 1 | 2024-12-31 | 38,424 | 38,424 | ✓ | LongTermDebt |
| total_debt | 2 | 2023-12-31 | 39,345 | 39,345 | ✓ | LongTermDebt · Fassungen: 39,345.3 / 39,345 (juengste 0000063908-25-000012) |
| net_debt | 0 | 2025-12-31 | 39,199 | 39,199 | ✓ | Schulden 39,973 − Liquiditaet 774 |
| net_debt | 1 | 2024-12-31 | 37,339 | 37,339 | ✓ | Schulden 38,424 − Liquiditaet 1,085 |
| net_debt | 2 | 2023-12-31 | 34,766 | 34,766 | ✓ | Schulden 39,345 − Liquiditaet 4,579 |
| debt_short_term | 0 | 2025-12-31 | 798 | 798 | ✓ | CommercialPaper |
| debt_short_term | 1 | 2024-12-31 | 790 | 790 | ✓ | CommercialPaper |
| debt_short_term | 2 | 2023-12-31 | 348 | 348 | ✓ | CommercialPaper · Fassungen: 347.6 / 348 (juengste 0000063908-25-000012) |
| debt_long_term_current | 0 | 2025-12-31 | 725 | 725 | ✓ | LongTermDebtCurrent |
| debt_long_term_current | 1 | 2021-12-31 | 0 | 0 | ✓ | LongTermDebtCurrent |
| debt_long_term_current | 2 | 2020-12-31 | 2,243.6 | 2,243.6 | ✓ | LongTermDebtCurrent |
| debt_long_term_noncurrent | 0 | 2025-12-31 | 39,973 | 39,973 | ✓ | LongTermDebtNoncurrent |
| debt_long_term_noncurrent | 1 | 2024-12-31 | 38,424 | 38,424 | ✓ | LongTermDebtNoncurrent |
| debt_long_term_noncurrent | 2 | 2023-12-31 | 37,153 | 37,153 | ✓ | LongTermDebtNoncurrent · Fassungen: 37,152.9 / 37,153 (juengste 0000063908-25-000012) |
| finance_lease_current | 0 | 2025-12-31 | 23 | 23 | ✓ | FinanceLeaseLiabilityCurrent |
| finance_lease_current | 1 | 2024-12-31 | 11 | 11 | ✓ | FinanceLeaseLiabilityCurrent |
| finance_lease_noncurrent | 0 | 2025-12-31 | 2,329 | 2,329 | ✓ | FinanceLeaseLiabilityNoncurrent |
| finance_lease_noncurrent | 1 | 2024-12-31 | 1,770 | 1,770 | ✓ | FinanceLeaseLiabilityNoncurrent |
| operating_lease_liability_current | 0 | 2022-12-31 | 661.1 | 661.1 | ✓ | OperatingLeaseLiabilityCurrent |
| operating_lease_liability_current | 1 | 2021-12-31 | 705.5 | 705.5 | ✓ | OperatingLeaseLiabilityCurrent |
| operating_lease_liability_current | 2 | 2020-12-31 | 701.5 | 701.5 | ✓ | OperatingLeaseLiabilityCurrent |
| operating_lease_liability_noncurrent | 0 | 2022-12-31 | 12,134.4 | 12,134.4 | ✓ | OperatingLeaseLiabilityNoncurrent |
| operating_lease_liability_noncurrent | 1 | 2021-12-31 | 13,020.9 | 13,020.9 | ✓ | OperatingLeaseLiabilityNoncurrent |
| operating_lease_liability_noncurrent | 2 | 2020-12-31 | 13,321.3 | 13,321.3 | ✓ | OperatingLeaseLiabilityNoncurrent |
| operating_lease_liabilities | 0 | 2023-12-31 | 12,170.3 | 12,170.3 | ✓ | OperatingLeaseLiability |
| operating_lease_liabilities | 1 | 2022-12-31 | 12,795.5 | 12,795.5 | ✓ | OperatingLeaseLiability |
| operating_lease_liabilities | 2 | 2021-12-31 | 13,726.4 | 13,726.4 | ✓ | OperatingLeaseLiability |
| cash_and_equivalents | 0 | 2025-12-31 | 774 | 774 | ✓ | CashAndCashEquivalentsAtCarryingValue |
| cash_and_equivalents | 1 | 2024-12-31 | 1,085 | 1,085 | ✓ | CashAndCashEquivalentsAtCarryingValue |
| cash_and_equivalents | 2 | 2023-12-31 | 4,579 | 4,579 | ✓ | CashAndCashEquivalentsAtCarryingValue · Fassungen: 4,579.3 / 4,579 (juengste 0000063908-25-000012) |
| shares_diluted | 0 | 2025-12-31 | 716.4 | 716.4 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding · Filer meldet in Mio. (716.4 „shares“, F-4); NI/EPS = 716.569 bestaetigt |
| shares_diluted | 1 | 2024-12-31 | 721.9 | 721.9 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding · Filer meldet in Mio. (721.9 „shares“, F-4); NI/EPS = 721.949 bestaetigt |
| shares_diluted | 2 | 2023-12-31 | 732.3 | 732.3 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding · Filer meldet in Mio. (732.3 „shares“, F-4); NI/EPS = 732.612 bestaetigt |
| shares_basic | 0 | 2025-12-31 | 713.4 | 713.4 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic · Filer meldet in Mio. (713.4 „shares“, F-4); NI/EPS = 713.583 bestaetigt |
| shares_basic | 1 | 2024-12-31 | 718.3 | 718.3 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic · Filer meldet in Mio. (718.3 „shares“, F-4); NI/EPS = 718.166 bestaetigt |
| shares_basic | 2 | 2023-12-31 | 727.9 | 727.9 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic · Filer meldet in Mio. (727.9 „shares“, F-4); NI/EPS = 728.203 bestaetigt |
| eps_diluted | 0 | 2025-12-31 | 11.95 | 11.95 | ✓ | EarningsPerShareDiluted |
| eps_diluted | 1 | 2024-12-31 | 11.39 | 11.39 | ✓ | EarningsPerShareDiluted |
| eps_diluted | 2 | 2023-12-31 | 11.56 | 11.56 | ✓ | EarningsPerShareDiluted |
| dps | 0 | 2025-12-31 | 7.17 | 7.17 | ✓ | CommonStockDividendsPerShareDeclared |
| dps | 1 | 2024-12-31 | 6.78 | 6.78 | ✓ | CommonStockDividendsPerShareDeclared |
| dps | 2 | 2023-12-31 | 6.23 | 6.23 | ✓ | CommonStockDividendsPerShareDeclared |
| dps_direct | 0 | 2025-12-31 | 7.17 | 7.17 | ✓ | CommonStockDividendsPerShareDeclared |
| dps_direct | 1 | 2024-12-31 | 6.78 | 6.78 | ✓ | CommonStockDividendsPerShareDeclared |
| dps_direct | 2 | 2023-12-31 | 6.23 | 6.23 | ✓ | CommonStockDividendsPerShareDeclared |
| dividends_paid | 0 | 2025-12-31 | 5,115 | 5,115 | ✓ | PaymentsOfDividendsCommonStock |
| dividends_paid | 1 | 2024-12-31 | 4,870 | 4,870 | ✓ | PaymentsOfDividendsCommonStock |
| dividends_paid | 2 | 2023-12-31 | 4,533 | 4,533 | ✓ | PaymentsOfDividendsCommonStock · Fassungen: 4,532.8 / 4,533 (juengste 0000063908-26-000035) |
| net_income | 0 | 2025-12-31 | 8,563 | 8,563 | ✓ | NetIncomeLoss |
| net_income | 1 | 2024-12-31 | 8,223 | 8,223 | ✓ | NetIncomeLoss |
| net_income | 2 | 2023-12-31 | 8,469 | 8,469 | ✓ | NetIncomeLoss · Fassungen: 8,468.8 / 8,469 (juengste 0000063908-26-000035) |
| book_value | 0 | 2025-12-31 | -1,791 | -1,791 | ✓ | StockholdersEquity |
| book_value | 1 | 2024-12-31 | -3,797 | -3,797 | ✓ | StockholdersEquity |
| book_value | 2 | 2023-12-31 | -4,707 | -4,707 | ✓ | StockholdersEquity · Fassungen: -4,706.7 / -4,707 (juengste 0000063908-26-000035) |
| total_equity | 0 | 2025-12-31 | -1,791 | -1,791 | ✓ | StockholdersEquity |
| total_equity | 1 | 2024-12-31 | -3,797 | -3,797 | ✓ | StockholdersEquity |
| total_equity | 2 | 2023-12-31 | -4,707 | -4,707 | ✓ | StockholdersEquity · Fassungen: -4,706.7 / -4,707 (juengste 0000063908-26-000035) |

Ohne Wert im Tool (nicht abgeglichen): da

### JNJ — CIK0000200406.companyfacts.json (Rohdatei sha256 7141c0c988fa1d30…)

| Feld | i | Periode | Tool | Quelle | ✓ | Hinweis |
|---|---|---|---|---|---|---|
| revenue | 0 | 2025-12-28 | 94,193 | 94,193 | ✓ | RevenueFromContractWithCustomerExcludingAssessedTax |
| revenue | 1 | 2024-12-29 | 88,821 | 88,821 | ✓ | RevenueFromContractWithCustomerExcludingAssessedTax |
| revenue | 2 | 2023-12-31 | 85,159 | 85,159 | ✓ | RevenueFromContractWithCustomerExcludingAssessedTax |
| cfo | 0 | 2025-12-28 | 24,530 | 24,530 | ✓ | NetCashProvidedByUsedInOperatingActivities |
| cfo | 1 | 2024-12-29 | 24,266 | 24,266 | ✓ | NetCashProvidedByUsedInOperatingActivities |
| cfo | 2 | 2023-12-31 | 22,791 | 22,791 | ✓ | NetCashProvidedByUsedInOperatingActivities |
| capex | 0 | 2025-12-28 | 4,832 | 4,832 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment |
| capex | 1 | 2024-12-29 | 4,424 | 4,424 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment |
| capex | 2 | 2023-12-31 | 4,543 | 4,543 | ✓ | PaymentsToAcquirePropertyPlantAndEquipment |
| fcf | 0 | 2025-12-28 | 19,698 | 19,698 | ✓ | CFO 24,530 − CapEx 4,832 |
| fcf | 1 | 2024-12-29 | 19,842 | 19,842 | ✓ | CFO 24,266 − CapEx 4,424 |
| fcf | 2 | 2023-12-31 | 18,248 | 18,248 | ✓ | CFO 22,791 − CapEx 4,543 |
| total_debt | 0 | 2025-12-28 | 41,438 | 41,438 | ✓ | LongTermDebt |
| total_debt | 1 | 2024-12-29 | 32,400 | 32,400 | ✓ | LongTermDebt |
| total_debt | 2 | 2023-12-31 | 27,350 | 27,350 | ✓ | LongTermDebt |
| net_debt | 0 | 2025-12-28 | 21,729 | 21,729 | ✓ | Schulden 41,438 − Liquiditaet 19,709 |
| net_debt | 1 | 2024-12-29 | 8,295 | 8,295 | ✓ | Schulden 32,400 − Liquiditaet 24,105 |
| net_debt | 2 | 2023-12-31 | 5,491 | 5,491 | ✓ | Schulden 27,350 − Liquiditaet 21,859 |
| debt_short_term | 0 | 2025-12-28 | 8,495 | 8,495 | ✓ | ShortTermBorrowings |
| debt_short_term | 1 | 2024-12-29 | 5,983 | 5,983 | ✓ | ShortTermBorrowings |
| debt_short_term | 2 | 2023-12-31 | 3,451 | 3,451 | ✓ | ShortTermBorrowings |
| debt_long_term_current | 0 | 2025-12-28 | 2,000 | 2,000 | ✓ | LongTermDebtCurrent |
| debt_long_term_current | 1 | 2024-12-29 | 1,749 | 1,749 | ✓ | LongTermDebtCurrent |
| debt_long_term_current | 2 | 2023-12-31 | 1,469 | 1,469 | ✓ | LongTermDebtCurrent |
| debt_long_term_noncurrent | 0 | 2025-12-28 | 39,438 | 39,438 | ✓ | LongTermDebtNoncurrent |
| debt_long_term_noncurrent | 1 | 2024-12-29 | 30,651 | 30,651 | ✓ | LongTermDebtNoncurrent |
| debt_long_term_noncurrent | 2 | 2023-12-31 | 25,881 | 25,881 | ✓ | LongTermDebtNoncurrent |
| operating_lease_liability_current | 0 | 2019-12-29 | 269 | 269 | ✓ | OperatingLeaseLiabilityCurrent |
| operating_lease_liability_noncurrent | 0 | 2019-12-29 | 716 | 716 | ✓ | OperatingLeaseLiabilityNoncurrent |
| operating_lease_liabilities | 0 | 2025-12-28 | 1,400 | 1,400 | ✓ | OperatingLeaseLiability |
| operating_lease_liabilities | 1 | 2024-12-29 | 1,200 | 1,200 | ✓ | OperatingLeaseLiability |
| operating_lease_liabilities | 2 | 2023-12-31 | 1,100 | 1,100 | ✓ | OperatingLeaseLiability |
| cash_and_equivalents | 0 | 2025-12-28 | 19,709 | 19,709 | ✓ | CashAndCashEquivalentsAtCarryingValue |
| cash_and_equivalents | 1 | 2024-12-29 | 24,105 | 24,105 | ✓ | CashAndCashEquivalentsAtCarryingValue |
| cash_and_equivalents | 2 | 2023-12-31 | 21,859 | 21,859 | ✓ | CashAndCashEquivalentsAtCarryingValue |
| shares_diluted | 0 | 2025-12-28 | 2,429.4 | 2,429.4 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding |
| shares_diluted | 1 | 2024-12-29 | 2,429.4 | 2,429.4 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding |
| shares_diluted | 2 | 2023-12-31 | 2,560.4 | 2,560.4 | ✓ | WeightedAverageNumberOfDilutedSharesOutstanding |
| shares_basic | 0 | 2025-12-28 | 2,407.4 | 2,407.4 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic |
| shares_basic | 1 | 2024-12-29 | 2,407.3 | 2,407.3 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic |
| shares_basic | 2 | 2023-12-31 | 2,533.5 | 2,533.5 | ✓ | WeightedAverageNumberOfSharesOutstandingBasic |
| eps_diluted | 0 | 2025-12-28 | 11.03 | 11.03 | ✓ | EarningsPerShareDiluted |
| eps_diluted | 1 | 2024-12-29 | 5.79 | 5.79 | ✓ | EarningsPerShareDiluted |
| eps_diluted | 2 | 2023-12-31 | 13.72 | 13.72 | ✓ | EarningsPerShareDiluted |
| dps | 0 | 2025-12-28 | 5.14 | 5.14 | ✓ | CommonStockDividendsPerShareCashPaid |
| dps | 1 | 2024-12-29 | 4.91 | 4.91 | ✓ | CommonStockDividendsPerShareCashPaid |
| dps | 2 | 2023-12-31 | 4.7 | 4.7 | ✓ | CommonStockDividendsPerShareCashPaid |
| dps_direct | 0 | 2025-12-28 | 5.14 | 5.14 | ✓ | CommonStockDividendsPerShareCashPaid |
| dps_direct | 1 | 2024-12-29 | 4.91 | 4.91 | ✓ | CommonStockDividendsPerShareCashPaid |
| dps_direct | 2 | 2023-12-31 | 4.7 | 4.7 | ✓ | CommonStockDividendsPerShareCashPaid |
| net_income | 0 | 2025-12-28 | 26,804 | 26,804 | ✓ | NetIncomeLoss |
| net_income | 1 | 2024-12-29 | 14,066 | 14,066 | ✓ | NetIncomeLoss |
| net_income | 2 | 2023-12-31 | 35,153 | 35,153 | ✓ | NetIncomeLoss |
| book_value | 0 | 2025-12-28 | 81,544 | 81,544 | ✓ | Assets − Liabilities (10-K-Fakten) |
| book_value | 1 | 2024-12-29 | 71,490 | 71,490 | ✓ | Assets − Liabilities (10-K-Fakten) |
| book_value | 2 | 2023-12-31 | 68,774 | 68,774 | ✓ | Assets − Liabilities (10-K-Fakten) |

Ohne Wert im Tool (nicht abgeglichen): ebit, da, ebitda, finance_lease_current, finance_lease_noncurrent, dividends_paid, total_equity
