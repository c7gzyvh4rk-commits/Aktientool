# Übergabe — SEC-Tag- und Periodenkorrekturen (V1.0.37)

Stand: 2026-09-09 · Branch `claude/eloquent-ritchie-qroglk` · Datei
`us-aktienbewertungstool-v1036-sector-classification-patch.html`

## Änderungen

1. **EBIT-Tagkette bereinigt.** `SEC_TAG_MAP.ebit` enthält nur noch
   `OperatingIncomeLoss`. Das Vorsteuerergebnis liegt als eigenes Feld
   `pretax_income` vor und wird nur über eine sichtbare Rekonstruktion
   (`Pretax + |Zinsaufwand| − |Zinsertrag|`, `_deriveEbitFromPretax`) zu EBIT
   gebrückt; ohne Zinsaufwand bleibt EBIT **fehlend** statt still ersetzt.
   Fehlender Zinsertrag ⇒ `confidence: medium` + Hinweistext.
2. **Period-keyed Ableitungen** (`_joinPeriodKeyed`): EBITDA, Tangible Book
   Value, FCF, Net Debt und DPS (Strategie 2) werden über die Berichtsperiode
   verknüpft statt über Array-Indizes. Modus `lead` erhält die Positionstreue
   zur Leitserie (fehlender Gegenwert ⇒ `null`-Slot, keine Verschiebung).
   Zeitraum- und Stichtagswerte werden nie vermischt; abweichende Periodenenden
   (> 45 Tage) im selben FY verwerfen den Slot.
3. **Goodwill/Intangibles** ist keine Alternativkette mehr:
   `IntangibleAssetsNetIncludingGoodwill` (kombiniert) **oder** period-keyed
   Summe aus `Goodwill` + `IntangibleAssetsNetExcludingGoodwill`. Doppelzählung
   ausgeschlossen und in der Meta dokumentiert (`doubleCountGuard`).
   Teilsummen werden als `partialPeriods` markiert.
4. **Metadaten erhalten**: `unit`, `starts` (Periodenbeginn), `accns`
   (Filing-ID), `filed`, `periods`, `isFlowConcept`, `derivation` je Feld;
   Herleitungen und Ausfälle zusätzlich in `meta._sec_fetch.derivations` und in
   der Mapping-Diagnose sichtbar.
5. TBV: fehlender Goodwill-Wert ergibt `null` statt „Equity − 0".

## Ausgeführte Tests

* `node --test tests/*.test.mjs` → **21/21 grün**. Die Tests laden die real
  ausgelieferten Funktionen aus der HTML-Datei (`tests/extract-functions.mjs`)
  und prüfen synthetische SEC-Facts: versetzte Jahre, fehlendes Jahr,
  Juni-Geschäftsjahr, Vorsteuerergebnis ohne EBIT, kombinierte vs. einzelne
  Intangible-Tags, Flow/Stock-Mischung, Metadatenerhalt. Erwartungswerte sind
  unabhängig von Hand gerechnet und stehen als Kommentar an der Assertion.
* In-App-Suite (Tab „Tests", headless Chromium): **384 passed / 1 failed**.
  Der Fehlschlag `T-BRL1` (Base-Rate-Lite) besteht unverändert auch auf dem
  Ausgangsstand (`git show HEAD`) — vorbestehend, nicht Teil dieses Auftrags.
  Neu: Fixture `T-SECD1` mit 10 Assertions.
* Integrationslauf `_extractWithFallback → _applySecDerivations →
  _buildSecMasterJson → runValuationEngine` mit synthetischen Facts:
  EBITDA `[null, 1380, 1250]`, GW&I `[5000, 4800, 4600]`, TBV
  `[7000, 6200, 5400]`, FCF `[700, 620, 540]`, Net Debt `[2500, 2400, null]`
  (Cash fehlt FY2022) — kein `PERIOD_MISMATCH`.

## Offene Einschränkungen

* Kein Live-Abruf gegen SEC EDGAR ausgeführt (nur synthetische Facts).
* EBIT-Rekonstruktion ohne Zinsertrag-Tag kann EBIT überschätzen; sie ist
  markiert, aber nicht unterdrückt.
* `applyDerivedFieldsV4` (manueller JSON-Import ohne `periods`) rechnet
  weiterhin index-basiert — bewusst unverändert, da dort keine Periodenmeta
  vorliegt. Nur der Net-Debt-Rebuild nutzt dort period-keyed, wenn Meta da ist.
* Keine Quartalsintegration (auftragsgemäß).
* `T-BRL1` bleibt rot (vorbestehend).

## Ausgangsstand für den nächsten Schritt

Alle Ableitungen laufen über `_applySecDerivations` / `_joinPeriodKeyed`
(direkt vor `_buildSecMasterJson`). Eine Quartalsintegration kann dort
ansetzen: `_joinPeriodKeyed` unterscheidet bereits Zeitraum-/Stichtagswerte und
führt `starts`/`durations` mit; für Quartale wäre der Jahres-Key (`YYYY` aus
`end`) auf einen Perioden-Key (`start|end`) zu erweitern und der
Contiguity-Filter in `_extractFyValues` anzupassen.
