# HANDOFF — US-Aktienbewertungstool

## Update (Chat 10): Manuell gewählter Sicherheitsabschlag, Abnahme abgesichert (V1.0.42)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`. Ausgangsbranch
`claude/brl1-alignment-fixes`, Ausgangscommit `94ae23c` — der neueste auf
GitHub gespeicherte Stand; er enthält alle Vorgängercommits als Vorfahren
(`main` steht weiterhin auf `b023dc8`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html` (einzige
HTML-Datei, `DEFAULT_TARGET` in `test/run-calc-tests.js`). Arbeitsbranch:
`claude/happy-hamilton-fytsq5`. Testbefehl: `npm test`.

**Baseline vor den Änderungen** (auf `94ae23c`, tatsächlich ausgeführt):
Rechentests 936 bestanden · 0 fehlgeschlagen · 0 Exceptions; SEC-Tests 28/28.

### Prüfung des Auftrags am Code (vor der Bearbeitung)

Die Punkte 1, 2, 3, 5, 6 und 7 waren bereits in Chat 8 (`87ce510`) umgesetzt
und sind am aktuellen Code verifiziert worden:

* Punkt 1 — `_modelComparisonNote()` je Modellkachel (sichtbare Inputs, Rolle
  bzw. Ausschlussgrund, bezifferte Abweichung, Modelleignung).
* Punkt 2 — `synthesisMethod` mit `kind: 'heuristic'`, Formel, Gewichten,
  Ausschlüssen, Kappungen und nummerierten Schritten; Anzeige als aufklappbarer
  „Rechenweg der heuristischen Synthese".
* Punkt 3 — `epvFloorApplied` dauerhaft `false`; `epvModel` wird nicht mehr in
  Range oder Entscheidungsrange verwendet; EPV nur noch als `epvComparison`.
* Punkt 5/6 — `buildMcDiagCard()` mit `class="card collapsed"`, „Anteil Läufe
  > Kurs" statt „P(FV > Kurs)", `_mulberry32` mit `MC_CONFIG.seed`, getrennte
  Zählung `runsValid`/`runsNegative`/`runsInvalid(Core|NonFinite)`.
* Punkt 7 — `judgements` mit `merged: false` und je eigener Quelle.

Offen war ausschließlich **Punkt 4 in seinem wörtlichen Teil**: einen *manuell
gewählten* Sicherheitsabschlag gab es nicht; Chat 8 hat nur den bestehenden
Regelabschlag getrennt ausgewiesen und das ausdrücklich als Einschränkung
notiert. Genau diese Lücke schließt dieser Schritt; alles Übrige wurde nicht
umgebaut, sondern durch zusätzliche Tests abgesichert.

### Änderungen (Produktdatei)

**1. Manuell gewählter Sicherheitsabschlag (Punkt 4).**
`runFairValueSynthesizer()` liest den Abschlag aus
`valuation.assumptions.safety_discount_override_pct` — ausschließlich aus dem
MasterJSON, kein DOM-Zugriff, damit die Synthese rein und testbar bleibt.
* Gültiger Bereich 0–`SYNTHESIS_CONFIG.mos.manual_max_pct` (= 90 %).
* Der gewählte Wert ersetzt den Regelabschlag **nur dort, wo ein Abschlag
  wirkt**: Einstiegspreis (`buyPrice`) und tiefer Prüfpreis
  (`deepValuePrice`). `range.conservative/base/optimistic`, Gewichte,
  Szenarien und Modellwerte bleiben unverändert.
* Der Regelabschlag bleibt vollständig erhalten und getrennt lesbar:
  `safetyDiscount.ruleTotal`, `mosComponents.ruleTotal`,
  `safetyDiscount.components` (Regelkomposition).
* Fehlende oder leere Eingabe = **keine Wahl** (Regelabschlag gilt), nicht 0 %.
  Ausdrücklich gewählte 0 % gelten dagegen als Wahl. Unplausible Eingaben
  (keine Zahl, < 0, > 90) werden verworfen, mit Grund gemeldet
  (`safetyDiscount.manual.rejectedReason`, Eintrag unter „Kappungen") und
  fallen auf den Regelabschlag zurück — kein stilles 0 %.
* Eine Wahl über der Regel-Obergrenze (50 %) wird **nicht still gekappt**,
  sondern angewendet und als `manual.aboveRuleCap` sowie als benannter Eintrag
  im Rechenweg ausgewiesen.
* Neuer Rechenschritt 6 „Manuell gewählter Sicherheitsabschlag"; der frühere
  Schritt 6 (Einstiegspreis) ist jetzt Schritt 7 und nennt bei aktiver Wahl die
  bisherige Einstiegszone samt Änderung.

**2. Änderung gegenüber der bisherigen Einstiegszone (Punkt 4, zweiter Satz).**
Neues `safetyDiscount.entryZoneChange` mit `entryPriceRule` (Zone mit
Regelabschlag), `entryPriceApplied`, `deepValuePriceRule`, `deltaAbsolute` und
`deltaPct`. Ohne Einstiegspreis (gesperrte Zone) bleiben die Felder `null` —
kein erfundener Vergleichswert. Gemessen am Testfall S-11
(DCF 16/20/24, RIM 24/30/36, Modellwert Base 23,00, Regelabschlag 25 %):
bisherige Zone **17,25**; bei manuell 40 % **13,80** (−20,0 %), bei manuell
10 % **20,70** (+20,0 %). Der Modellwert bleibt in beiden Fällen 23,00.

**3. Anzeige.** Die Einstiegszonen-Box zeigt bei aktiver Wahl „Manuell
gewählter Sicherheitsabschlag", die Zeile „Bisherige Einstiegszone
(Regelabschlag) … → jetzt … (±x %)" und ausdrücklich „Modellwert unverändert:
…". Eine verworfene Eingabe wird als solche gemeldet statt still als 0 %
dargestellt. Der Rechenweg in der Range-Box nennt zusätzlich „Regelabschlag x %
· angewendet y % (manual|rule)" und dieselbe Zonenänderung.

**4. Eingabefeld.** Neues Feld `as-mos` („Sicherheitsabschlag manuell (%)") im
Annahmen-Tab, eingelesen über die bestehende `fields`-Liste in
`recalcFromAssumptions()`. Ein **leeres** Feld nimmt die Wahl zurück (löscht
`safety_discount_override_pct`), setzt sie nicht auf 0. Bei gesetztem Wert
werden `source_type: 'manual'` und der Eintrag in
`state.manualAssumptionFields` gepflegt — dieselbe Mechanik wie bei den
bestehenden Overrides. Kein neues Framework, keine neue Abhängigkeit.

**5. Gespeicherter Zufallsstartwert (Punkt 6, Ergänzung).** `saveSnapshot()`
legt zusätzlich `mc_config` (Startwert, Generator, Laufzahl, Verteilungs-
parameter) neben dem bereits gespeicherten `synthesis_config` ab. Damit bleibt
nachvollziehbar, mit welchem Startwert eine gespeicherte Auswertung gerechnet
wurde, auch wenn `MC_CONFIG.seed` später geändert wird. Die Simulationslogik
selbst wurde nicht angefasst.

### Pflicht-Tests (neu, 29 Assertions in `_testSynthesisPrecision`)

Synthetische Daten, unabhängig nachgerechnete Erwartungswerte.

**S-11 (21) — manueller Sicherheitsabschlag.**
a Vorbedingung (Regelabschlag 25 %, Zone 17,25) · b Wahl wird angewendet und
als `chosen_manual` gekennzeichnet · c Modellwert unverändert (alle drei
Szenarien) · d 23,00 × (1 − 0,40) = 13,80 und 18,40 × (1 − 0,40) = 11,04 ·
e Regelabschlag bleibt getrennt erhalten · f Zonenänderung −3,45 = −20,0 % ·
g Gegenrichtung +20,0 % bei 10 % · h Wahl über der Obergrenze wird angewendet
und benannt · i0–i3 `'abc'`, `-5`, `95`, `NaN` fallen auf den Regelabschlag
zurück (**kein stilles 0 %**) · j leere Eingabe ist keine Wahl von 0 % ·
k gewählte 0 % gelten als Wahl · l Rechenweg nennt die Wahl als eigenen
Schritt · m/n Anzeige (Trennung bzw. Meldung der verworfenen Eingabe) ·
o Urteile bleiben unberührt · p Starter-Zone bleibt regelbasiert und nie unter
dem Einstiegspreis · q Rechenweg zeigt Regel- und angewendeten Abschlag.

**S-12 (8) — Abnahmekriterien direkt geprüft.**
a gleicher Startwert ⇒ bitgleiche Kennzahlen (Median, P10, P90, Zählungen,
Anteil) · b Startwert und Laufzahl stehen im Ergebnis · c EPV bei 200/250/300
— weit über der Synthese — hebt weder Range noch Einstiegszone · d EPV bleibt
sichtbar und als `diagnostic_only` benannt · e0/e1 angezeigter Basiswert aus
den offengelegten Gewichten reproduzierbar · f0/f1 angezeigter Einstiegspreis
aus Basiswert und Abschlag reproduzierbar · g Simulationskarte bleibt
eingeklappt, ohne „P(FV" und mit dem Hinweis „keine empirisch belegte
Wahrscheinlichkeit".

### Gegenprüfungen (tatsächlich ausgeführt, in Arbeitskopien)

* **Manuelle Wahl abgeschaltet** (`mosTotalFinal = _mosRuleTotal`) ⇒ **6**
  Assertions rot (S-11b/d/f/g/h/k).
* **Unplausible Eingabe still als 0 % gelesen** ⇒ **5** Assertions rot
  (S-11i0–i3, S-11n).
* **Alter EPV-Floor wieder eingeschaltet** (`cons = max(cons, EPV-cons)`,
  `base` bis +30 %) ⇒ S-12c rot (conservative 200 statt 18,40, base 29,90 statt
  23,00) und S-12e1 rot — der angezeigte Basiswert war dann nicht mehr aus den
  offengelegten Gewichten reproduzierbar. Damit prüft S-12e genau das dritte
  Abnahmekriterium.

### Tatsächlich ausgeführte Tests (nach den Änderungen)

`npm test` (= `node test/run-all.js`), beide Suiten:
* `node test/run-calc-tests.js` → **965 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (vorher 936; +29 durch S-11/S-12).
  Fixtures unverändert 434 Assertions, 0 fehlgeschlagen.
* `node --test tests/*.test.mjs` → **28/28** (unverändert).
* **Gemeinsamer Exit-Code 0.**

Keine bestehende Testerwartung wurde geändert. `_testSynthesisPrecision` wuchs
von 73 auf 102 Assertions; die 73 Assertions aus Chat 8 laufen unverändert.

### Offene Einschränkungen / bewusst nicht bearbeitet

* Das neue Eingabefeld `as-mos` selbst ist **nicht automatisiert getestet** —
  der Node-Runner stellt bewusst kein DOM bereit (wie schon
  `_testManualAssumptionOverride`). Getestet ist die vollständige Wirkungskette
  ab dem MasterJSON-Feld `safety_discount_override_pct`; die Feld-Verdrahtung
  ist manuell im Browser zu prüfen.
* Die Starter-Zone bleibt bewusst regelbasiert (strukturelle Komponenten,
  `safetyDiscount.starterZoneBasis = 'rule_structural'`) und wird nur nach
  unten auf den Einstiegspreis begrenzt. Ein manuell gewählter Abschlag wirkt
  dort nicht.
* `MC_CONFIG.seed` bleibt ein Programmwert; neu ist nur, dass er mit dem
  Snapshot gespeichert wird. Eine Startwert-Verwaltung je Titel gibt es nicht.
* Korrelationen der Monte-Carlo-Größen sind weiterhin nicht modelliert (nur
  benannt).
* `epvModel` in `runFairValueSynthesizer()` ist seit V1.0.40 unbenutzt (tote
  Zuweisung); nicht angefasst, um den Diff auf den Auftrag zu begrenzen.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` weiterhin
  nicht angehoben (durch Tests festgeschrieben); die Änderung ist im Code als
  V1.0.42 kommentiert.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/happy-hamilton-fytsq5` (Basis `94ae23c` auf
`claude/brl1-alignment-fixes`). Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Ergebniscommit: siehe Spitze des Übergabebranches.
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/happy-hamilton-fytsq5

**Der nächste Schritt setzt auf `origin/claude/happy-hamilton-fytsq5` auf,
nicht auf `main`.**

## Update (Chat 9): T-BRL1 und Mehrheitsjahr-Typfehler behoben (V1.0.41)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`. Basiscommit
`72d75c3` auf `claude/us-stock-tool-precision-og5azo` — der neueste
Fortsetzungsstand, der `ef9fce2` als Vorfahre enthält (per `git merge-base
--is-ancestor` bestätigt; `main` steht weiterhin auf `b023dc8`). Arbeitsbranch:
`claude/brl1-alignment-fixes`. Tool-Datei unverändert
`us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test`.

**Baseline vor den Änderungen** (auf `72d75c3`, tatsächlich ausgeführt):
Rechentests 927 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Exceptions;
SEC-Tests 23/23. Die 73 Assertions aus Chat 8 (`_testSynthesisPrecision`)
sind vollständig erhalten.

### Punkt 1 — T-BRL1: Fixture-Fehler, kein Produktfehler

**Bestätigte Ursache (am aktuellen Code reproduziert, nicht übernommen).**
Der Synthese-Lauf auf dem T-BRL1-Datensatz ergab
`blockReason: "Modell-Divergenz >3x nach Outlier-Entfernung … Eingeschlossen:
[dcf, rim], Ratio: 3.05x"`, `_modelDivergenceSevere = true`,
`_diagnosticOnlyReason = 'model_divergence_severe'` ⇒ `buyPrice = null`.
DCF-Base 15,62 gegen RIM-Base 5,13 je Aktie.

Die Divergenz entstand im Fixture: Es überschrieb **nur** `revenue`, `ebit` und
`fcf` auf eine Firma der Größenordnung ~1.200 Mio Umsatz und ließ
`net_income`, `eps_diluted`, `total_equity`, `cfo`, `ebitda`, `capex`,
`shares_diluted`, `total_debt` und `cash_and_equivalents` auf den Werten des
5.000-Mio-Basisdatensatzes stehen. Daraus folgten unmögliche Relationen
(EBITDA 950 bei Umsatz 1.210 = 78 % Marge; CapEx 300 = 25 % vom Umsatz;
CFO 900 = 74 % vom Umsatz) und daraus der Modellabstand. Gegenprobe: derselbe
Basisdatensatz **ohne** die Teilüberschreibung ergibt Ratio 2,83 und einen
regulären Einstiegspreis.

**Bewertung.** Das Produktverhalten ist korrekt — das Divergenz-Gate verweigert
bei >3× Modellabstand bewusst eine Einstiegszone. Ungeeignet war der
Testaufbau. Geändert wurde daher **ausschließlich das Fixture**; am Produkt
wurde für Punkt 1 keine Zeile angefasst.

**Fachliche Prüfabsicht, geklärt.** T-BRL* prüft das Modul *Base-Rate-Lite*
(`computeBaseRateLite`, V1.0.35), dessen Modulkopf ausdrücklich sagt: „KEIN
Einfluss auf Fair Value, Buy Price, MoS oder Verdict". Nicht gemeint ist
`evaluateBaseRateWarnings()` aus Abschnitt 5 — dessen MoS-Zuschlag
(+5pp/+10pp) ist gewollt und bleibt unberührt. Die alte Assertion
(`buyPrice != null`) hat diese Absicht nicht geprüft, sondern nur die Existenz
eines Werts.

**Änderungen am Fixture (T-BRL1).**
* Datensatz jetzt in sich konsistent: 8 Jahre, Umsatz-CAGR(5J) = 9,99 %, alle
  Größen als fester Anteil vom Umsatz (EBIT 14,4 % · Net Income 12,0 % ·
  CFO 18,0 % · EBITDA 19,0 % · CapEx 6,0 % · FCF = CFO − CapEx = 12,0 % ·
  Eigenkapital 60 % · Fremdkapital 100 %). `g1 = 8` bleibt ≤ revCAGR ⇒
  Rating weiterhin konservativ/plausibel. Divergenz 2,72× ⇒ Gate inaktiv.
* Ein Datensatz-Builder `_brl1Mj()` für `mj:` **und** Assertions — die frühere
  Dopplung war der Weg, auf dem beide Kopien auseinanderlaufen konnten.
* Assertions (3 → 7):
  1. BRL `available = true`
  2. Rating konservativ/plausibel
  3. **Vorbedingung gegen „null gleich null":** `buyPrice` ist eine endliche
     Zahl > 0, `_modelDivergenceSevere !== true`, `_diagnosticOnlyReason ==
     null`, `position !== 'blocked'`
  4. Gegenprobe-Stub liefert wirklich ein abweichendes BRL-Urteil
  5. **Kernprüfung:** `computeBaseRateLite` wird vorübergehend durch einen Stub
     mit widersprechendem Urteil ('sehr ambitioniert') ersetzt; `buyPrice`,
     `deepValuePrice`, `position`, `_qualityVerdict`, alle drei
     `range`-Werte und `mosComponents.total` müssen **identisch** bleiben
  6. `computeBaseRateLite` nach der Gegenprobe wiederhergestellt
  7. `computeBaseRateLite` verändert das MasterJSON nicht (Mutation wäre der
     stille Weg zu einem Einfluss)
* **Neu: T-BRL1b** (4 Assertions) mit genau dem alten, widersprüchlichen
  Datensatz: Divergenz > 3×, `_modelDivergenceSevere = true`,
  `buyPrice === null`, Sperrgrund nennt die Modell-Divergenz. Damit ist
  belegt, dass der korrigierte T-BRL1 das Gate nicht umgeht, sondern eine
  geeignete Datenlage verwendet.

Divergenzgrenzen, Bewertungsgewichte und Sicherheitsprüfungen blieben
unverändert; kein Test wurde übersprungen.

### Punkt 2 — Typfehler im Mehrheitsjahr-Fallback (Produktkorrektur)

**Reproduktion am aktuellen Code.** `validatePeriodAlignment()` bildet
`yearCounts` über `p.year` (Zahl aus `parseInt`), liest das Mehrheitsjahr aber
über `Object.keys(yearCounts)` zurück — als **String**. Ohne bevorzugtes
Ankerfeld (`revenue`/`net_income`/`eps_diluted`) wird dieser String zu
`anchorYear`, und `populated.filter(p => p.year !== anchorYear)` vergleicht
dann `2024 !== "2024"`. Gemessen vor der Korrektur:
* genau ein Feld (`total_debt`, 2024): `ok: false`, Mismatch `total_debt@2024`
  — ein Widerspruch gegen sich selbst;
* drei Felder alle 2024: `ok: false`, alle drei als abweichend gemeldet;
* echte Abweichung (2× 2024, 1× 2021): Mismatch-Liste enthielt zusätzlich die
  beiden korrekt ausgerichteten 2024-Felder;
* mit Ankerfeld: `anchorYear` korrekt als Zahl, `majorityYear` aber weiterhin
  als String im Ergebnisobjekt.

**Korrektur (eine Stelle, eine Zeile).** Das Ergebnis des `reduce` wird mit
`Number(...)` zurück in eine Zahl gewandelt. Auswahllogik (häufigstes Jahr,
erstes bei Gleichstand), Ankerpriorität und die Erkennung echter
Periodenabweichungen bleiben unverändert. Kein lockerer Vergleich (`==`), keine
Neugestaltung der Periodenlogik.

**Pflichttests** — neu in `tests/sec-derivations.test.mjs` (dort war
`validatePeriodAlignment` bereits geladen), 5 Tests:
1. genau ein Feld mit Perioden-Meta ohne Ankerfeld ⇒ kein Mismatch gegen sich
   selbst (inkl. `typeof majorityYear === 'number'` als eigentlicher
   Regressionsschutz);
2. mehrere Felder desselben Jahres ohne Ankerfeld ⇒ kein Mismatch;
3. tatsächlich abweichende Jahre werden erkannt — und die Mismatch-Liste
   enthält **nur** das abweichende Feld;
4. bevorzugtes Ankerfeld behält Vorrang vor dem Mehrheitsjahr (`revenue`, und
   zweitrangig `net_income`);
5. fehlende/ungültige Perioden erzeugen keinen erfundenen Jahreswert
   (`missing` unverändert, `anchorYear === undefined`).

### Gegenprüfungen (tatsächlich ausgeführt)

* **Alignment-Tests gegen die alte Implementierung:** `Number(...)` temporär
  entfernt ⇒ **4 der 5** neuen Tests rot (Test 5 bleibt grün, weil er den
  Mehrheitsjahr-Fallback gar nicht erreicht — genau das ist seine Aussage);
  nach Wiedereinspielen 28/28.
* **T-BRL1 erkennt einen unerwünschten BRL-Einfluss:** In einer Arbeitskopie
  wurde `computeBaseRateLite` in den MoS-Pfad des Synthesizers eingehängt
  (+10pp bei 'sehr ambitioniert') ⇒ `__brl1_noeffect` rot
  (935 · 1 fehlgeschlagen).
* **Divergenz-Gate weiterhin wirksam:** In einer Arbeitskopie den
  `_modelDivergenceSevere`-Zweig abgeschaltet ⇒ T-BRL1b rot
  (`buyPrice` 9,35 statt `null`; Sperrgrund fehlt).

### Tatsächlich ausgeführte Tests (nach den Änderungen)

`npm test` (= `node test/run-all.js`), beide Suiten laufen:
* `node test/run-calc-tests.js` → **936 bestanden · 0 fehlgeschlagen ·
  0 Fehler/Exceptions** (Fixtures: 434 Assertions, 0 fehlgeschlagen,
  0 Pipeline-Fehler). Vorher 927 · 1; +8 neue Assertions (T-BRL1 +4,
  T-BRL1b +4), der bisherige Fehlschlag ist behoben.
* `node --test tests/*.test.mjs` → **28/28** (vorher 23/23, +5).
* **Gemeinsamer Exit-Code 0** — `npm test` ist erstmals seit Chat 2 grün.

Keine bestehende Testerwartung wurde an ein Ergebnis angepasst. Die einzige
geänderte Erwartung ist die T-BRL1-Assertion selbst; sie wurde von einem
inhaltsleeren Existenz-Check auf die dokumentierte Prüfabsicht umgestellt
(Begründung oben).

### Offene Einschränkungen / nur dokumentiert, nicht bearbeitet

* Der T-BRL1-Datensatz liegt mit Divergenz 2,72× unter, aber nicht weit unter
  der 3×-Schwelle. Das ist strukturell: In dieser Fixture-Familie liegt der
  DCF wegen des Terminalwerts rund 2,6–2,8× über dem RIM (RIM-Spread-Fade bei
  ROE ≈ 20 % gegen CoE 10 %). Assertion 3 macht sichtbar, falls eine künftige
  Änderung den Fall wieder über die Schwelle schiebt.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`.
* Unverändert offen aus Chat 8: kein manuelles Eingabefeld für den
  Sicherheitsabschlag; Korrelationen der Monte-Carlo-Größen nicht modelliert;
  `MC_CONFIG.seed` ist ein fester Programmwert.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` weiterhin
  nicht angehoben (durch Tests festgeschrieben); Änderung im Code als V1.0.41
  kommentiert.
* `_testPeriodAlignment` im Quelltext bleibt auskommentierter toter Code; der
  Node-Runner führt ihn bewusst als bekannt-tot. Nicht angefasst.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/brl1-alignment-fixes` (Basis `72d75c3` auf
`claude/us-stock-tool-precision-og5azo`). Tool-Datei unverändert.
Testbefehl: `npm test` — beide Suiten grün, Exit-Code 0.
Code-Commit dieses Schritts: `027d8ae`; Abschlusscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/brl1-alignment-fixes

## Update (Chat 8): Weniger Scheinpräzision in Synthese und Monte Carlo (V1.0.40)

**Ausgangsstand.** Repository `c7gzyvh4rk-commits/Aktientool`, Ausgangsbranch
`claude/dcf-bridge-period-lock`, Ausgangscommit `ef9fce2` (Spitze der Kette aus
Chat 1–7; `main` steht noch auf `b023dc8` und enthält keinen dieser Schritte).
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`
— einzige HTML-Datei im Repository und Ziel von `test/run-calc-tests.js`
(`DEFAULT_TARGET`). Arbeitsbranch: `claude/us-stock-tool-precision-og5azo`.
Testbefehl: `npm test` (= `node test/run-all.js`).

### Änderungen (Produktdatei)

**1. Modelle einzeln, Abweichungen erklärt.** Neue Anzeigefunktion
`_modelComparisonNote()` ergänzt jede Modellkachel um (a) die sichtbaren
Inputs des Base-Szenarios (g1, WACC bzw. CoE, g∞, Op-Marge — dieselben Werte,
die das Modell liest), (b) Rolle und effektives Synthese-Gewicht bzw. den
Ausschlussgrund, (c) die bezifferte Abweichung gegenüber dem Synthese-Basiswert
(ab 25 % als „wesentliche Abweichung" markiert) und (d) die Modelleignung
(`MODEL_SUITABILITY_NOTES`). Rein anzeigend, keine Rückwirkung auf Rechenwege.

**2. Synthese ausdrücklich als Heuristik.** `runFairValueSynthesizer()` liefert
neu `synthesisMethod` mit Kennzeichnung (`kind: 'heuristic'`), Formel
`Base = Σ(Gewicht_i × Base_i) / Σ(Gewicht_i)`, Aggregator, Gewichten samt
Einzelbeiträgen, Ausschlüssen mit Begründung, Kappungen mit Wirkung und sechs
nummerierten Rechenschritten. Die Range-Box zeigt das als aufklappbaren
„Rechenweg der heuristischen Synthese" und trägt den Titelzusatz
„heuristische Synthese".

**3. EPV ist keine Wertuntergrenze mehr.** Der frühere Floor hob `rangeCons`
auf `max(rangeCons, EPV-cons)` und `rangeBase` um bis zu +30 % an und speiste
zusätzlich ein EPV-Paar (Gewicht 0,05) in die P25/P75-Entscheidungsrange —
beides ohne sichtbaren Rechenschritt. Entfernt. `epvFloorApplied` ist dauerhaft
`false`, `SYNTHESIS_CONFIG.epv.floor_role` ist `'diagnostic'`. EPV bleibt
vollständig sichtbar: als eigenes Modell mit eigenen Szenarien, als neues
`epvComparison` (cons/base/opt, Eignung je Sektorpfad, Hinweis auf die
entfallene Anhebung) und als benannter Ausschluss im Rechenweg.

**4. Sicherheitsabschlag getrennt vom Modellwert.** Neues `safetyDiscount`
(`kind: 'chosen_rule_based'`, `isModelOutput: false`) weist Modellwert (Base und
Conservative), Abschlagskomponenten, Kompositionsregel, Obergrenze und die
Formeln getrennt aus. Die Einstiegszonen-Box zeigt jetzt „Modellwert (Base) ·
gewählter Sicherheitsabschlag · Einstiegspreis" nebeneinander plus die Rechnung
`Modellwert × (1 − Abschlag) = Einstiegspreis` und den Hinweis, dass der
Abschlag eine gewählte Regelgröße und kein Modellergebnis ist. Ein manuelles
Eingabefeld für den Abschlag existierte nicht und wurde nicht ergänzt (keine
neue Funktion) — getrennt ausgewiesen wird der bestehende Regelabschlag.

**Änderung gegenüber der bisherigen Einstiegszone** (gemessen am Testfall
S-1, DCF 16/20/24, RIM 24/30/36, EPV 40/50/60, Abschlag 25 %):
Conservative 40 → **18,40**, Base 29,90 → **23,00**, Einstiegspreis
22,425 → **17,25**, tiefer Prüfpreis 30,00 → **13,80**. Die Einstiegszone
liegt also dort tiefer, wo sie vorher durch den EPV automatisch angehoben war;
ohne EPV-Modell ändert sich nichts. Die Formel selbst ist unverändert
(`Base × (1 − MoS)`), nur ihre Darstellung ist aufgetrennt.

**5. Monte Carlo eingeklappt und als Simulation benannt.** Eigene Karte
`buildMcDiagCard()` mit `class="card collapsed"`, Titel „Monte-Carlo-Simulation
(eingeklappt)" und Zusatz „Simulation unter angenommenen Verteilungen". Das
Faktor-Overlay hat jetzt eine eigene Karte (vorher teilten sich beide eine
aufgeklappte). Die Kennzahl „P(FV > Kurs)" heißt jetzt „Anteil Läufe > Kurs";
darunter steht ausdrücklich, dass dieser Anteil eine Eigenschaft der gesetzten
Verteilungsannahmen und **keine empirisch belegte Wahrscheinlichkeit** einer
Unterbewertung ist. Feld `probAbovePrice` bleibt aus Kompatibilitätsgründen
erhalten, ergänzt um `shareRunsAbovePrice`, `runsAbovePrice` und
`_shareAbovePriceIsNotEmpiricalProbability`.

**6. Monte Carlo reproduzierbar und vollständig gezählt.** `Math.random()`
ersetzt durch `_mulberry32` mit gespeichertem Startwert (`MC_CONFIG.seed =
20260101`, per `opts.seed` überschreibbar); Box-Muller zieht jetzt aus diesem
Generator (`_normalDrawFrom`). Der Startwert und der Generator stehen im
Ergebnis und in der Anzeige. Alle Verteilungsparameter liegen in `MC_CONFIG`
und werden als `distributions` ausgewiesen (Form, μ, σ, σ-Herkunft,
Abschneidungen, Wirkung des Margenschocks, Hinweis auf nicht modellierte
Korrelationen). Getrennte Zählung: `runsRequested`, `runsValid`,
`runsNegative`, `runsInvalid` = `runsInvalidCore` (kein Kernergebnis, z.B.
WACC ≤ g∞) + `runsNonFinite`. Negative Eigenkapitalwerte bleiben in der
Verteilung und werden nur gezählt. Zu wenige gültige Läufe liefern kein
stilles `null` mehr, sondern ein `_blocked`-Ergebnis mit der Zählung als
Begründung.

**7. Urteile getrennt.** Neues `judgements` mit drei Feldern und eigener
Quelle je Dimension (`quality` aus der Quality-Engine, `data` aus der
Data-Quality-Engine, `valuation` aus der Fair-Value-Synthese) und
`merged: false`. Kein zusammengefasster Gesamtscore.

### Pflicht-Tests (neu, `_testSynthesisPrecision`, 73 Assertions)

Registriert in `test/run-calc-tests.js` (`PURE_TEST_FUNCTIONS`). Synthetische
Daten, unabhängig nachgerechnete Erwartungswerte:
* **S-1 (12)** EPV ohne Untergrenzenwirkung: identische Range, Einstiegszone,
  tiefer Prüfpreis und Entscheidungsrange mit und ohne EPV-Modell; Vorbedingung
  prüft ausdrücklich, dass der frühere Floor hier gegriffen hätte.
* **S-2 (7)** Rechenweg: Gewichtssumme 1, Σ(Gewicht × Base) reproduziert
  `range.base` exakt, sechs beschriftete Schritte, Kappungen benannt.
* **S-3 (9)** Abschlag getrennt: `entryPrice = Base × (1 − Abschlag)`,
  Grundabschlag 25 % (caution_quality), Komposition `1 − Π(1 − Komponente)`
  unabhängig nachgerechnet, Anzeige trennt Modellwert und Abschlag.
* **S-4 (6)** Urteile getrennt: besseres Qualitätsurteil senkt nur den
  Abschlag (25 % → 15 %) und lässt den Modellwert unverändert.
* **S-5 (6)** Determinismus: gleiche Eingaben und gleicher Startwert ⇒
  identische Ergebnisse; anderer Startwert ⇒ andere, ebenfalls reproduzierbare
  Ziehung.
* **S-6 (7)** Zählung: gültig + ungültig = angefordert; bei 40 USD/Aktie
  Nettoschulden gegen ~30 USD/Aktie operativen Wert bleiben alle 2000 Läufe
  gültig und über 75 % negativ — nichts fällt still heraus.
* **S-7 (6)** Verteilungsparameter: σ(WACC) = 0,25 × σ(g) = 0,5pp,
  σ(g∞) = 0,40pp gesetzt, Abschneidungen und fehlende Korrelation benannt.
* **S-8 (8)** Anzeige: Karte eingeklappt, kein „P(FV > Kurs)", Startwert,
  Laufzählung und Hinweistext sichtbar.
* **S-9 (7)** Modellvergleich: sichtbare Inputs, Rolle, bezifferte Abweichung,
  Eignung; RIM nennt CoE statt WACC; EPV ist „nicht gewichtet" mit Begründung.
* **S-10 (5)** Rechenweg in der Range-Box sichtbar, kein „EPV Floor aktiv".

**Gegenprobe gegen den Vorher-Stand.** Mit wiederhergestelltem EPV-Floor und
`Math.random()` fallen **9** der neuen Assertions (S-1b/c/d/e/f/h, S-2c,
S-5b/f) — unter anderem hob der Floor dort Conservative von 18,40 auf 40,00
und Base von 23,00 auf 29,90, und der offengelegte Rechenweg ergab 23,00
statt der angezeigten 29,90.

### Tatsächlich ausgeführte Tests

`npm test` (= `node test/run-all.js`):
* `node test/run-calc-tests.js` → **927 bestanden · 1 fehlgeschlagen ·
  0 Fehler/Exceptions** (Ausgangsstand 854; +73 durch `_testSynthesisPrecision`).
  Fixtures unverändert 425 bestanden / 1 fehlgeschlagen.
* `node --test tests/*.test.mjs` → **23/23**.

Der bekannte Altfehler `T-BRL1` bleibt unbearbeitet, sichtbar und rot; damit
endet `npm test` und die CI weiterhin rot. **Keine bestehende Testerwartung
wurde geändert.**

### Offene Einschränkungen / bewusst nicht bearbeitet

* `T-BRL1` weiterhin rot (Altfehler aus Chat 2).
* Kein manuelles Eingabefeld für den Sicherheitsabschlag ergänzt — der
  bestehende Regelabschlag wird nur getrennt ausgewiesen. Eine echte
  Nutzereingabe wäre eine neue Funktion und lag außerhalb des Auftrags.
* Die Simulation zieht ihre vier Größen weiterhin unabhängig; Korrelationen
  sind nicht modelliert. Das ist jetzt ausdrücklich benannt, nicht behoben.
* `MC_CONFIG.seed` ist ein fester Programmwert, kein pro Titel gespeicherter
  Startwert; Wiederholbarkeit ist damit gegeben, eine Startwert-Verwaltung je
  Snapshot nicht.
* Die neue Testfunktion läuft nur im Node-Runner, nicht im Browser-Test-Tab —
  wie schon `_testValuationCore`, `_testDcfEquityBridge` und
  `_testDcfWorkingCapital`.
* Unverändert offen aus Chat 6/7: index-basierte Ableitung von `eps_diluted`,
  `book_value` und `dps` in `applyDerivedFieldsV4`; String/Zahl-Vergleich im
  Mehrheitsjahr-Fallback von `validatePeriodAlignment()`.
* `ENGINE_VERSION` / `DISPLAY_VERSION` / `REGRESSION_TEST_VERSION` wurden wie
  in den Vorgängerschritten nicht angehoben (durch Tests festgeschrieben);
  die Änderung ist im Code als V1.0.40 kommentiert.

### Ausgangsstand für den nächsten Schritt

Übergabebranch: `claude/us-stock-tool-precision-og5azo`
(Basis `ef9fce2` auf `claude/dcf-bridge-period-lock`).
Tool-Datei: `us-aktienbewertungstool-v1036-sector-classification-patch.html`.
Testbefehl: `npm test`.
Code-Commit dieses Schritts: `87ce510` — Ergebniscommit ist die Spitze des
Übergabebranches (dieser Nachtrag).
Branch-Link: https://github.com/c7gzyvh4rk-commits/Aktientool/tree/claude/us-stock-tool-precision-og5azo

**Der nächste Schritt setzt auf `origin/claude/us-stock-tool-precision-og5azo`
auf, nicht auf `main`.**

## Update (Chat 7): Nettoschulden-Periodensperre in der DCF-Wertbrücke (V1.0.39)

**Basis:** `749f142` auf `claude/sec-period-integrity-fixes` (keine neueren
Commits vorhanden). Neuer Arbeitsbranch: `claude/dcf-bridge-period-lock`.

**Befund am Code.** Die Aufbereitung verwirft Nettoschulden bei unvereinbaren
Berichtsperioden und setzt `_v4_meta.net_debt.periodLocked = true` (Chat 6).
`_resolveNetDebtForDcfBridge()` las jedoch nur Werte, nie die Meta, und
rechnete anschließend erneut `total_debt[0] − cash_and_equivalents[0]` bzw.
den Cash-Alias `cash[0]`. Über `buildCoreValuationContext()` gelangte dieser
Jahresmix als `netDebtPerShare` in den gemeinsamen Bewertungskern; Haupt-DCF
und Reverse DCF akzeptierten ihn (`available: true`, `netDebtM: 400`,
Reverse DCF `ok`).

**Korrektur (nur in `_resolveNetDebtForDcfBridge`).** Reihenfolge jetzt:
1. Bekannte Nettoschulden aus `net_debt[0]` — einschließlich ausdrücklich
   gesetzter 0 und eines expliziten Overrides — unverändert vorrangig.
2. Aktive Periodensperre ⇒ `available: false` mit Begründung aus der
   Sperr-Meta; kein Neuberechnen über Array-Indizes, kein Cash-Alias.
3. Vorhandene `net_debt`-Reihe mit period-keyed leerem aktuellem Slot ⇒
   ebenfalls nicht verfügbar; der unzulässige Slot wird nicht ersetzt.
4. Haben Schulden oder Liquidität Periodenkontext, wird die Differenz
   ausschließlich über die vorhandene Periodenlogik `_joinPeriodKeyed`
   gebildet (keine neue Matching-Regel). Kein kompatibler aktueller Slot ⇒
   nicht verfügbar mit Begründung.
5. Ohne jeden Periodenkontext (manueller Import) bleibt der bisherige Pfad
   `total_debt[0] − cash[0]` unverändert.

Es wurden keine neuen Nichtverfügbarkeitsmechanismen eingeführt: die
bestehende Kette (`ctx.netDebtPerShare == null`) trägt die Sperre
unverändert nach Haupt-DCF, Synthese, Reverse DCF, Sensitivitätsmatrix und
Monte Carlo; der operative Wert je Aktie bleibt überall nachrichtlich
erhalten.

**Tests (neu: Fixture `T-NDLOCK`, 28 Assertions).** Geprüft wird nach beiden
tatsächlichen Ableitungspässen in zwei Datenlagen:
* **A — gemeldeter Fall** (Schulden FY2024, Cash FY2021): Sperre steht;
  Wertbrücke `available: false` ohne Ersatzwert; Kern erhält
  `netDebtPerShare = null`; Haupt-DCF nicht anwendbar, `base == null`
  (keine 11 USD/Aktie aus Jahresmix), operativer Wert erhalten;
  Reverse DCF `net_debt_unknown` und nicht `ok`. In dieser Datenlage sperrt
  zusätzlich das Period-Alignment-Gate die gesamte Bewertung
  (`PERIOD_MISMATCH`) — Matrix und Monte Carlo sind hier gar nicht
  erreichbar, was der Test ausdrücklich festhält.
* **A2 — Sperre isoliert** (Cash ohne Perioden-Meta, Alignment-Gate still):
  Wertbrücke bleibt nicht verfügbar, Haupt-DCF nicht anwendbar, Synthese
  gewichtet den DCF nicht (`_modelWeightDiag` ohne `dcf`), Matrix meldet
  `equityValueUnavailable` mit der Sperre als Grund, Monte Carlo `_blocked`.
* Cash-Alias (`f.cash`) umgeht die Sperre nicht; teilweise passende Reihe mit
  `net_debt[0] === null` wird nicht durch einen Fallback ersetzt.
* Gegenproben: kompatible Perioden ⇒ 400 Mio Nettoschulden und
  15 − 4 = 11 USD/Aktie; ausdrücklich bekannte Nettoschulden 0 ⇒ 15 USD/Aktie
  aus `net_debt[0]`; manueller Import ohne Perioden-Meta ⇒ unverändert
  400 Mio.
* **Gegenprobe gegen den Vorher-Stand:** mit der alten Brückenfunktion fallen
  18 der neuen Assertions (u.a. Reverse DCF `ok` statt `net_debt_unknown`);
  die Gegenproben bleiben dabei grün, engen also nicht über.

**Tatsächlich ausgeführte Tests.** `npm test`:
`node test/run-calc-tests.js` → **854 bestanden · 1 fehlgeschlagen ·
0 Fehler/Exceptions** (Ausgangsstand 826; +28 durch `T-NDLOCK`);
`node --test tests/*.test.mjs` → **23/23**. Der bekannte Altfehler `T-BRL1`
bleibt unbearbeitet, sichtbar und rot. Keine bestehende Testerwartung wurde
geändert.

**Offene Einschränkungen / weitere Befunde (nicht bearbeitet).**
* `T-BRL1` weiterhin rot; damit endet `npm test` und die CI rot.
* `validatePeriodAlignment()` vergleicht im Fallback „Mehrheitsjahr" einen
  String (`Object.keys`) mit einer Zahl. Liegt für genau ein Kernfeld
  `periods` vor, meldet das Gate deshalb einen Mismatch gegen sich selbst.
  Nur beim Anchor-Fallback relevant, außerhalb dieses Auftrags — der Test
  weicht dieser Konstellation aus, statt sie zu verdecken.
* Unverändert offen aus Chat 6: `eps_diluted`, `book_value` und `dps` werden
  in `applyDerivedFieldsV4` weiterhin index-basiert abgeleitet.

## Update (Chat 6): Drei Periodenfehler behoben, gemeinsamer Testaufruf (V1.0.38)

**Basis:** `fba35e4` auf `claude/eloquent-ritchie-qroglk-rebased` (enthält den
geprüften Chat-4-Commit `1f60ca5`; keine zusätzlichen Commits vorhanden).
Neuer Arbeitsbranch: `claude/sec-period-integrity-fixes`.

### 1. Periodenpositionen bleiben erhalten (`_joinPeriodKeyed`)
**Befund am Code:** Bei unvereinbaren Periodenenden wurde der gesamte Slot per
`continue` verworfen (`skippedPeriods`). Im Modus `lead` rückten dadurch
ältere Werte an eine vordere Position — genau die Verschiebung, die der
period-keyed Join verhindern soll.
**Korrektur:** Im Modus `lead` behält jede Periode der Leitserie ihre Position;
ein unzulässiger Vergleich ergibt `null` mit unveränderter Periodenzuordnung
und nachvollziehbarem Grund (`meta.incompatiblePeriods`). In `union`/
`intersect` (dort ist die Position ohnehin nicht positionstreu) bleibt das
bisherige Überspringen.
**Pflichtfall:** Schulden `[600, 500]` @ `[2024-12-31, 2023-12-31]`, Cash
`[100, 50]` @ `[2024-01-31, 2023-12-31]` → `[null, 450]` mit Perioden
`[2024-12-31, 2023-12-31]`; das frühere `[450]` mit FY2023 an Index 0 ist
durch eine eigene Assertion ausgeschlossen.

### 2. Teilsummen speisen keinen TBV mehr
**Befund am Code:** `_deriveGoodwillIntangibles()` lieferte bei fehlender
Komponente eine markierte Teilsumme; `_deriveTangibleBookValue()` zog sie
regulär ab und verlor die Kennzeichnung — der Abzug war stillschweigend zu
klein, der TBV zu hoch.
**Korrektur:** `_deriveGoodwillIntangibles()` schreibt je Periode
`componentCompleteness` (vollständig nur bei komplettem kombiniertem Tag oder
beiden Einzelkomponenten; eine ausdrücklich berichtete 0 zählt als vorhanden).
`_deriveTangibleBookValue()` liefert für unvollständige Perioden `null` und
nennt den Grund in `meta.unavailablePeriods` / `meta.unavailableNote`; die
FMAP-Schleife übernimmt ihn in `_v4_meta.tangible_book_value.notes`. Die
Teilsumme bleibt in `goodwill_and_intangibles` nachrichtlich erhalten.
**Pflichtfälle (Eigenkapital 12.000), alle grün:** Goodwill 3.000 + unbekannte
Intangibles → `null`; Goodwill 3.000 + ausdrücklich 0 → 9.000; Goodwill 3.000
+ 2.000 → 7.000; vollständiges kombiniertes Tag 5.000 → 7.000 ohne
Doppelzählung; spiegelbildlich (Goodwill unbekannt, Intangibles 2.000) →
`null`.

### 3. Periodensperren lassen sich nicht mehr umgehen
**Befund am Code:** `applyDerivedFieldsV4()` (D-01 FCF, D-02 Net Debt) baute
leere oder komplett aus `null` bestehende Reihen erneut über Array-Indizes
auf; der Net-Debt-Rebuild in `_applyDebtComponentRebuild()` hatte zusätzlich
einen Index-Fallback nach gescheitertem Perioden-Join. Beide Pfade laufen auch
beim SEC-Import und hoben die Sperre im zweiten Ableitungspass wieder auf.
**Korrektur:** Neue Helfer `_seriesHasPeriodContext()`,
`_derivePairPeriodAware()` und `_markPeriodLocked()`. Sobald Periodenkontext
vorliegt (Periodenmetadaten, dokumentierte period-keyed Ableitung oder
gesetzte Sperre `periodLocked`), wird ausschließlich period-keyed verknüpft;
scheitert das — auch wenn der Join formal gelingt, aber keine Periode ein
Gegenstück hat —, bleibt der Wert fehlend und wird als
`source_type: 'unavailable'` mit `periodLocked: true` und Begründung
markiert. Der Index-Fallback im Net-Debt-Rebuild entfällt. **Ohne jeden
Periodenkontext (manueller Import) bleibt der bisherige Index-Pfad
unverändert.**

### 4. Gemeinsamer Testaufruf und CI
Neuer, abhängigkeitsfreier Sammel-Runner `test/run-all.js`: startet beide
Suiten nacheinander per `child_process.spawnSync` (kein `&&`), sodass die
SEC-Suite auch bei rotem Rechen-Runner läuft, und endet mit Exit-Code 1,
sobald mindestens eine Suite rot ist. Ein Fehlschlag wird nirgends
unterdrückt; `T-BRL1` bleibt sichtbar und wird im Abschlussblock ausdrücklich
benannt. Fehlt `tests/*.test.mjs`, gilt das als Fehlschlag statt als stiller
Erfolg. `package.json`: `test` → `node test/run-all.js`, zusätzlich
`test:calc` und `test:sec`. CI führt `node test/run-all.js` aus. Die
Verzeichnisse `test/` und `tests/` bleiben unverändert bestehen.

### Geänderte Erwartungen (nur wo sie das korrigierte Fehlverhalten verlangten)
1. `tests/…`: „weit auseinanderliegende Periodenenden → Slot verworfen"
   erwartete `values: []`. Das war Fehler 1; erwartet wird jetzt `[null]` mit
   erhaltener Periodenzuordnung.
2. `tests/…`: TBV-Test erwartete `[9000, null, 7500]` aus Teilsummen. Das war
   Fehler 2; erwartet wird jetzt `[null, null, null]`, die Teilsumme bleibt
   nachrichtlich. Die ursprüngliche Aussage („fehlender Goodwill darf nicht
   als 0 durchgehen") wird weiterhin geprüft.
3. In-App-Fixture `T-SECD1`: `__secd_tbv` von `9000,null` auf `null,null` —
   gleiche Begründung wie 2.
Keine weitere Erwartung wurde angefasst.

### Tatsächlich ausgeführte Tests
* `node test/run-all.js` (neuer gemeinsamer Aufruf, Exit-Code 1 wegen T-BRL1):
  * `node test/run-calc-tests.js` → **826 bestanden · 1 fehlgeschlagen ·
    0 Fehler/Exceptions** (Ausgangsstand 813; +13 durch die neuen
    Gegenbeispiele in `T-SECD1` und das neue Fixture `T-SECD2`).
  * `node --test tests/*.test.mjs` → **23/23 grün** (vorher 21).
* Gegenprobe zum Sammel-Runner: mit einer absichtlich roten Zusatzdatei in
  `tests/` meldet er beide Suiten rot und endet mit 1; die Datei wurde wieder
  entfernt.
* `T-SECD2` prüft die tatsächlichen aufeinanderfolgenden Aufrufwege
  (`applyDerivedFieldsV4` zweimal, inkl. `_applyDebtComponentRebuild`):
  CFO/CapEx ohne gemeinsame Periode → FCF bleibt fehlend und gesperrt;
  Schulden/Cash ohne gemeinsame Periode → Net Debt bleibt fehlend und
  gesperrt; teilweise passende Reihen behalten ihre `null`-Slots
  (`600, null, 560`); manueller Import ohne Periodenmetadaten liefert
  weiterhin `600, 580` bzw. `400, 400` über den Index-Pfad; unvereinbares
  Periodenende ergibt `null, 450` statt eines verschobenen `450`.
* DCF-, Working-Capital- und Nettoschuldentests unverändert grün
  (`_testValuationCore` 111, `_testDcfEquityBridge` 46,
  `_testDcfWorkingCapital` 84); `dcfCore` und die Sperre `net_debt_unknown`
  unangetastet.
* Integrationslauf des SEC-Importpfads (synthetische Facts, echter Browser):
  EBITDA `[null, 1380, 1250]`, GW&I `[5000, 4800, 4600]`, TBV
  `[7000, 6200, 5400]`, FCF `[700, 620, 540]`, Net Debt `[2500, 2400, null]`,
  kein `PERIOD_MISMATCH`.

### Offene Einschränkungen
* `T-BRL1` bleibt rot (Altfehler seit Chat 2, unverändert nicht in Arbeit).
  Damit endet auch der gemeinsame Testaufruf und die CI rot.
* Die EBIT-Rekonstruktion wurde auftragsgemäß nicht angefasst; sie kann ohne
  Zinsertrag-Tag weiterhin überschätzen (markiert, nicht unterdrückt).
* Kein Live-Abruf gegen SEC EDGAR (nur synthetische Facts).
* Weiterer, nicht behobener Befund: `applyDerivedFieldsV4` leitet auch
  `eps_diluted`, `book_value` und `dps` index-basiert ab. Diese Pfade waren
  nicht Teil des Auftrags und wurden nicht angefasst; sie haben dieselbe
  Struktur wie die hier gesperrten und sollten separat geprüft werden.

## Update (Versionskorrektur): Chat-5-Arbeit auf die geprüfte Chat-4-Basis gesetzt

**Befund.** Der Chat-5-Commit `fba495c` auf `claude/eloquent-ritchie-qroglk`
hatte als Elternteil `b023dc8` — den alten `main`-Upload, nicht den geprüften
Chat-4-Abschluss `1f60ca5` auf `claude/eager-bardeen-l53hvv`.
`git merge-base --is-ancestor 1f60ca5 fba495c` war negativ. Dem Branch fehlten
damit sieben Commits: Testrunner (`9d909e6`), CI-Workflow (`ce3dae1`),
Fehlererkennung des Runners (`7d0a0cc`), Nettoschuldenabzug im Forecast-DCF
(`8c2f7f8`), operatives Working Capital (`aef1b34`), gemeinsamer
Bewertungskern (`4a76e4c`) und die Nettoschulden-Sperre (`1f60ca5`).

**Korrektur.** Neuer Arbeitsbranch `claude/eloquent-ritchie-qroglk-rebased`
von `1f60ca5`; darauf ausschließlich die Änderungen aus `fba495c` per
`git cherry-pick` übertragen (3-Wege-Merge gegen die gemeinsame Basis
`b023dc8`). Die HTML-Datei wurde **nicht** durch die Version des falschen
Branches ersetzt. Der ursprüngliche Branch bleibt unverändert stehen; kein
Force-Push, kein Merge.

**Konfliktauflösung.** Die Produktdatei ließ sich konfliktfrei
zusammenführen; verifiziert per Diff-Vergleich: die Zeilenmenge von
`b023dc8..fba495c` stimmt exakt mit der von `1f60ca5..HEAD` überein (keine
fehlende, keine zusätzliche Zeile, keine zusätzliche Löschung) — Chat 1–4
bleibt vollständig erhalten, Chat 5 kommt hinzu. Einziger echter Konflikt:
`HANDOFF.md` (add/add). Aufgelöst durch Erhalt der vollständigen Chat-1-bis-4-
Historie und Voranstellen dieses Chat-5-Eintrags.

## Update (Chat 5 Abschluss): SEC-Tag- und Periodenkorrekturen (V1.0.37)

**Auftrag:** Ausschließlich fachliche Tag- und Periodenprobleme in der
bestehenden SEC-Datenaufbereitung. Keine Quartalsintegration.

### Änderungen (Produktdatei)
1. **EBIT-Tagkette bereinigt.** `SEC_TAG_MAP.ebit` enthält nur noch
   `OperatingIncomeLoss`. Das Vorsteuerergebnis
   (`IncomeLossFromContinuingOperationsBeforeIncomeTaxes…`) ist kein
   EBIT-Ersatz und liegt als eigenes Feld `pretax_income` vor. Es wird nur
   über eine sichtbare Rekonstruktion (`_deriveEbitFromPretax`:
   `Pretax + |Zinsaufwand| − |Zinsertrag|`) zu EBIT gebrückt; ohne
   vollständige Pflichtkomponenten bleibt EBIT **fehlend** statt still
   ersetzt. Fehlender Zinsertrag ⇒ `confidence: medium` + Hinweistext.
2. **Period-keyed Ableitungen** (`_joinPeriodKeyed`, `_applySecDerivations`):
   EBITDA, Tangible Book Value, FCF, Net Debt und DPS (Strategie 2) werden
   über die Berichtsperiode verknüpft statt über Array-Indizes. Modus `lead`
   erhält die Positionstreue zur Leitserie (fehlender Gegenwert ⇒ `null`-Slot,
   keine Verschiebung). Zeitraum- und Stichtagswerte werden nicht vermischt;
   abweichende Periodenenden (> 45 Tage) im selben FY verwerfen den Slot.
3. **Goodwill/Intangibles** ist keine Alternativkette mehr: kombiniertes Tag
   `IntangibleAssetsNetIncludingGoodwill` **oder** period-keyed Summe aus
   `Goodwill` + `IntangibleAssetsNetExcludingGoodwill`. Doppelzählung
   ausgeschlossen und in der Meta dokumentiert (`doubleCountGuard`);
   Teilsummen als `partialPeriods` markiert.
4. **TBV:** fehlender Goodwill-Wert ergibt `null` statt „Equity − 0".
5. **Metadaten erhalten:** `unit`, `starts` (Periodenbeginn), `accns`
   (Filing-ID), `filed`, `periods`, `isFlowConcept`, `derivation` je Feld;
   Herleitungen und Ausfälle zusätzlich in `meta._sec_fetch.derivations` und
   in der Mapping-Diagnose sichtbar.

### Tests (Chat 5)
* Neue Node-Suite `tests/sec-derivations.test.mjs` (21 Tests) mit
  `tests/extract-functions.mjs`: lädt die real ausgelieferten Funktionen aus
  der HTML-Datei und prüft synthetische SEC-Facts (versetzte Jahre, fehlendes
  Jahr, Juni-Geschäftsjahr, Vorsteuerergebnis ohne EBIT, kombinierte vs.
  einzelne Intangible-Tags, Flow/Stock-Mischung, Metadatenerhalt).
  Erwartungswerte unabhängig von Hand gerechnet.
* In-App-Fixture `T-SECD1` (10 Assertions) in `REGRESSION_FIXTURES`;
  `REGRESSION_TEST_VERSION` = `v1.0.37-sec-tag-period-fixes`.

### Tatsächlich ausgeführte Tests (nach der Versionskorrektur)
* `node test/run-calc-tests.js` → **813 bestanden · 1 fehlgeschlagen ·
  0 Fehler/Exceptions**. Ausgangsstand Chat 4 waren 803 bestanden bei
  identischem Fehlschlag; die zusätzlichen 10 Assertions sind `T-SECD1`.
  Gegenprobe auf `1f60ca5` in separatem Worktree: 803 · 1 · 0.
* `node --test tests/*.test.mjs` → **21/21 grün**.
* Bekannter Altfehler `T-BRL1` („synthesis.buyPrice existiert") bleibt rot —
  unverändert seit Chat 2, keine Erwartung angepasst.
* Erhalt des gemeinsamen Bewertungskerns geprüft: `dcfCore` vorhanden,
  Sperre `net_debt_unknown` unverändert, `_testValuationCore` (111),
  `_testDcfEquityBridge` (46), `_testDcfWorkingCapital` (84) grün.

### Offene Einschränkungen
* Kein Live-Abruf gegen SEC EDGAR ausgeführt (nur synthetische Facts).
* EBIT-Rekonstruktion ohne Zinsertrag-Tag kann EBIT überschätzen; markiert,
  aber nicht unterdrückt.
* `applyDerivedFieldsV4` (manueller JSON-Import ohne `periods`) rechnet
  weiterhin index-basiert — dort liegt keine Periodenmeta vor.
* Keine Quartalsintegration (auftragsgemäß).
* Der alte Branch `claude/eloquent-ritchie-qroglk` (Commit `fba495c`) bleibt
  mit falscher Basis bestehen und darf nicht mehr als Ausgangsstand dienen.

### Dokumentierte, bewusst NICHT behobene Integrationsbefunde
(außerhalb der Umfangsgrenze dieser Versionskorrektur — für einen Folgeschritt)
* `package.json` (`npm test`) und `.github/workflows/tests.yml` starten nur
  `node test/run-calc-tests.js`. Die Chat-5-Suite `tests/*.test.mjs` läuft
  dadurch weder über `npm test` noch in CI und muss vorerst manuell mit
  `node --test tests/*.test.mjs` ausgeführt werden.
* Es existieren jetzt zwei Testverzeichnisse nebeneinander: `test/`
  (Chat-1-Runner, DOM-freie Rechentests aus der HTML-Datei) und `tests/`
  (Chat-5-Suite auf `node:test`). Die Namensnähe ist verwechslungsanfällig;
  eine Zusammenführung wurde hier bewusst nicht vorgenommen.

### Ausgangsstand für den nächsten Schritt
Arbeitsstand ist `claude/eloquent-ritchie-qroglk-rebased` mit `1f60ca5` als
Vorfahr. Alle SEC-Ableitungen laufen über `_applySecDerivations` /
`_joinPeriodKeyed` direkt vor `_buildSecMasterJson`. Eine Quartalsintegration
kann dort ansetzen: `_joinPeriodKeyed` unterscheidet bereits Zeitraum-/
Stichtagswerte und führt `starts`/`durations` mit; für Quartale wäre der
Jahres-Key (`YYYY` aus `end`) auf einen Perioden-Key (`start|end`) zu
erweitern und der Contiguity-Filter in `_extractFyValues` anzupassen.

## Update (Chat 4 Nachtrag): Fehlende Nettoschulden ⇒ kein Eigenkapitalwert

**Auftrag:** Ausschließlich die Behandlung fehlender Nettoschulden im
gemeinsamen Bewertungskern korrigieren.

### Befund am Code (vor der Änderung)
`coreValuationDetail()` bildete
`eq = netDebtPerShare != null ? total − netDebtPerShare : total`.
Bei unbekannten Nettoschulden wurde also der **operative Unternehmenswert
unverändert als Eigenkapitalwert** ausgegeben — rechnerisch die stille Annahme
„Nettoschulden = 0". Der Wert wurde als DCF gewichtet, gegen den Kurs
eingefärbt und mit ihm verglichen; bei verschuldeten Unternehmen systematisch
zu hoch. Ein Warnhinweis benannte den fehlenden Abzug, verhinderte ihn aber
nicht. Widerspruch zur eigenen Regel „fehlende Werte sind nicht 0".

### Änderungen (Produktdatei, nur dieser Punkt)
1. **Kern:** `equityValuePerShare` ist `null`, wenn `netDebtPerShare == null`.
   `operatingValuePerShare` bleibt unverändert erhalten und wird separat
   geliefert, dazu `netDebtAvailable`, `netDebtMissingFields` und
   `equityValueUnavailableReason`. `coreEquityValuePerShare()` liefert
   entsprechend `null` statt des operativen Werts.
2. **Haupt-DCF:** `applicable:false` mit `reason`, `_equityValueUnavailable`
   und `_excludedFromSynthesis`; `_equityValuePerShareBase`/`_equityValueAbsBase`
   sind `null`. `_operatingValuePerShareBase`/`_operatingValueAbsBase` bleiben
   nachrichtlich erhalten. Zwei Warnungen nennen den fehlenden Input, den
   operativen Wert und die Abhilfe (`net_debt[0]` bzw. `total_debt[0]` mit
   `cash_and_equivalents[0]`/`cash[0]`).
3. **Synthese:** greift über den bestehenden `applicable`-Filter — der
   operative Wert erhält kein Gewicht.
4. **Reverse DCF:** neuer Status `net_debt_unknown` vor der Nullstellensuche.
   Kein Ausweichen auf den operativen Wert; der Kurs ist ein Eigenkapitalpreis
   und nur mit einem Eigenkapitalwert vergleichbar. `computeReverseDcf()`
   liefert `null`.
5. **Sensitivitätsmatrix:** `available:false` mit `equityValueUnavailable:true`
   und erklärtem Hinweis statt Zellen — die Matrix ist als „Fair Value"
   beschriftet und wird gegen den Kurs eingefärbt.
6. **Monte Carlo:** `_blocked` mit Begründung (`probAbovePrice` vergleicht mit
   dem Kurs).

Ausdrücklich gesetzte Nettoschulden von **0 bleiben ein gültiger Wert** — nur
fehlende Daten sind jetzt kein Wert.

### Pflicht-Test
Neu: **C-12 in `_testValuationCore()` — 26 Assertions** (Umsatz₀ 1.000M,
FCFF 150M p.a., WACC 10 %, g1 = tg = 0 ⇒ operativ **1.500M / 100M Aktien =
15,00 USD/Aktie**; `net_debt`, `total_debt` und Liquidität vollständig fehlend).

| Fall | Erwartet | Ergebnis |
|---|---|---|
| Kern: operativer Wert | 15,00 je Aktie / 1.500M | ✅ |
| Kern: `equityValuePerShare` | `null`, nicht 15,00 | ✅ |
| Haupt-DCF | `applicable:false`, base/cons/opt `null` | ✅ |
| Haupt-DCF: operativer Wert | bleibt 15,00 nachrichtlich | ✅ |
| Synthese | DCF-Gewicht 0; 15,00 taucht nicht als Fair Value auf | ✅ |
| Reverse DCF | `net_debt_unknown`, `impliedGrowthPct` `null` | ✅ |
| Matrix | keine Zellen, erklärter Hinweis, kein `>15.0<` im HTML | ✅ |
| Monte Carlo | `_blocked` mit benanntem Grund | ✅ |
| **Gegenprüfung ND = 0 (bekannt)** | base 15,00, Brücke aktiv, Reverse DCF ok (0 %) | ✅ |
| **Gegenprüfung ND = 500M** | base 10,00, ND/Aktie 5,00, Reverse DCF ok (0 %) | ✅ |
| fehlend ≠ bekannte 0 | unterschiedliches Verhalten belegt | ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Vorher (Commit 4a76e4c) | 775 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **803 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |
| Stabilität | 3 Läufe, identisches Ergebnis |

Suiten: `_testDcfEquityBridge` 46 (war 44), `_testDcfWorkingCapital` 84,
`_testValuationCore` 111 (war 85).

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| Ausgangsdefekt: operativer Wert wieder als Eigenkapitalwert | 12 rot (B-6e/e3/f, C-12b–f, C-12h/j/z) |
| Reverse-DCF-Wächter entfernt | 3 rot (C-12l/m) |
| Matrix-Wächter entfernt | 5 rot (B-10c, C-12o/p/q) |
| Monte-Carlo-Wächter entfernt | 2 rot (C-12r) |
| `_equityValuePerShareBase` fällt auf den operativen Wert zurück | 3 rot (B-6e2, C-12g) |

**Geänderte Testerwartungen (fachlich begründet, im Code dokumentiert):**
- `B-6e`/`B-6f` (Chat 2): erwarteten bei fehlenden Nettoschulden den operativen
  Wert 15,00 als Modellwert — genau den stillen 0-Abzug, den B-6a–d benennen.
  Jetzt: kein Eigenkapitalwert, operativer Wert separat (`B-6e2`, `B-6e3` neu).
- `B-10c` (Chat 2): Matrix zeigte 15,0 mit Hinweis; jetzt keine Zellen, sondern
  der benannte fehlende Input.
- `W-7g`/`W-8i` (Chat 3): **Prüfabsicht unverändert.** Beide messen den
  Working-Capital-Effekt, nicht die Nettoschuldenbrücke — die Fixtures geben
  `net_debt: [0]` jetzt ausdrücklich an. Ein gesetzter Wert 0 ist eine
  Information, ein fehlender ist keine.
- Alle übrigen Referenztests aus Chat 2, 3 und 4 unverändert grün.

### Wirkung an Daten
130 Fixtures, Wertvergleich gegen Commit 4a76e4c (115 ausgewertet):
- **3 Fixtures verlieren ihren DCF:** `T-TXRH-DEBT2`, `-DEBT4`, `-DEBT6`. Alle
  drei sind laut eigener Beschriftung so konstruiert, dass `total_debt` **nicht
  ableitbar** ist (veraltete Tags, unpassende Perioden). Sie erhielten bisher
  den vollen operativen Wert (26,56 bzw. 27,79 USD/Aktie) als Fair Value —
  ohne jeden Schuldenabzug. Jetzt: `applicable:false` mit
  `fehlend: total_debt[0]`. Fair Value und Buy Price entfallen dort.
- **Position/Verdict: 0 Änderungen.** Mid-Cycle: 0 Änderungen.
- Reverse DCF: dieselben 3 Fixtures liefern jetzt `null` statt einer Zahl.
- Alle übrigen 112 Fixtures **bitgleich**.

### Offene Einschränkungen
- Unternehmen ohne Schulden-/Liquiditätsdaten haben jetzt **keinen DCF mehr**.
  Das ist beabsichtigt, reduziert aber die Modellabdeckung: Betroffene JSONs
  brauchen `net_debt[0]` oder `total_debt[0]` **und**
  `cash_and_equivalents[0]`/`cash[0]`. Der operative Unternehmenswert bleibt in
  `_operatingValuePerShareBase`/`_operatingValueAbsBase` sichtbar.
- Ein Unternehmen mit tatsächlich null Schulden und null Liquidität muss
  `net_debt: [0]` ausdrücklich setzen — sonst gilt es als „unbekannt".
- Alle übrigen Einschränkungen aus dem Chat-4-Eintrag unten gelten unverändert.
- Kein Merge, kein Deployment.

### Ausgangsstand für den nächsten Schritt
- **Branch:** `claude/eager-bardeen-l53hvv`
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **803 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.

---

## Update (Chat 4 Abschluss): Ein gemeinsamer Bewertungskern

**Auftrag:** Haupt-DCF, Reverse DCF und Sensitivitätsmatrix sollen dieselbe
Bewertungsfunktion verwenden.

### Befund am Code (vor der Änderung)
Drei Pfade, drei Definitionen — dieselbe Eingabe lieferte je nach Anzeige
verschiedene Werte:
| Pfad | Cashflow | Nettoschulden | ΔWC | Fade | Aktien |
|---|---|---|---|---|---|
| Haupt-DCF (`forecastDcfCore`) | FCFF aus EBIT | Brücke (3-stufige Priorität) | ja | ja | Projektion |
| Reverse DCF (`calculateImpliedGrowth`) | `f.fcf[0]` = CFO − CapEx | `net_debt[0]`, sonst **still 0** | nein | nein | `shares_diluted[0]` |
| Matrix, Zweig 2/3 (`dcfCore`) | Mid-Cycle-FCF bzw. `f.fcf[0]` | keine | nein | ja | konstant |
| DCF Mid-Cycle | Mid-Cycle-FCF via `dcfCore` | keine | nein | ja | konstant |
| Monte Carlo, Fallback | `f.fcf[0]` | keine | nein | ja | konstant |

Der Reverse DCF löste zudem das Wachstum des **FCF**, wurde aber als
„Stage-1-Wachstum" beschriftet — im Haupt-DCF ist g1 das **Umsatzwachstum**.

### Änderungen (Produktdatei)
1. **Kern (neu):** `DCF_CORE_MODEL_VERSION = 'dcf-core/1.1'`,
   `buildCoreValuationContext(mj, opts)` (löst Cashflow-Struktur, Working
   Capital, Nettoschulden, Aktienbasis, Fade einmalig auf) und
   `coreValuationDetail(ctx, g1, tg, wacc, opMarginPct)` → operativer Wert,
   Brücke, Eigenkapitalwert je Aktie. `null` = nicht bewertbar, nie 0 als Ersatz.
2. **Alle Pfade angeschlossen:** `modelDcf`, `modelDcfMidcycle`,
   `computeSensitivityMatrix` (neu, Zahlen von der Darstellung getrennt),
   `solveReverseDcfGrowth` (neu) und `runMonteCarloDcf`. **`dcfCore` hat jetzt
   null Aufrufer** und ist als überholt gekennzeichnet.
3. **Mid-Cycle korrigiert statt ausgeschlossen:** läuft über den Kern mit
   `opMarginOverridePct` = Median-Betriebsmarge. Einzige Abweichung vom
   Haupt-DCF ist die normalisierte Marge; ΔWC, Nettoschuldenbrücke und
   Aktienprojektion gelten jetzt auch hier.
4. **Legacy-Pfad ausgeschlossen:** ohne Umsatzpfad (revenue/ebit/capex) ist der
   Kern nicht anwendbar und `CFO − CapEx` nicht in ihn zerlegbar. `modelDcf`
   liefert `applicable:false` mit `_excludedFromSynthesis`, `_exclusionCode` und
   benannten fehlenden Feldern — der Wert geht damit weder in Bewertung noch in
   Synthese ein. Ebenso Matrix und Monte Carlo (erklärter Status statt Zahl).
5. **Reverse DCF:** löst **ausschließlich** `growth_stage1` (Umsatz); alles
   andere konstant und über `heldConstant`/`heldConstantNote` ausgewiesen.
   Suchbereich −20 % … +40 %, Raster 0,5 pp, Toleranz 1e-4 pp. Nullstellen
   werden **gezählt**: 0 → `no_solution_in_range`, ≥2 → `multiple_solutions`,
   sonst Intervallhalbierung. Weitere Status: `wacc_le_terminal_growth`,
   `inputs_missing`, `not_evaluable`, `not_applicable` (Financials). Nie ein
   geratener Grenzwert. `computeReverseDcf` und die Übersichtskarte nutzen den
   Kern; bei fehlender Lösung wird der Status gezeigt, **nicht** ersatzweise die
   FCF-Zahl. `reverseDcfReported`/`reverseDcfOwner` bleiben als SBC-Diagnosepaar
   auf REPORTED-FCF-Basis erhalten, jetzt mit
   `fcfBasisDiagnosticOnly`/`fcfBasisConsistentWithCore:false` gekennzeichnet.
6. **Matrix:** variiert nur WACC und g1; Terminalwachstum, Marge, Steuer-,
   CapEx-, D&A- und WC-Quote, Fade, Aktienprojektion und Nettoschulden sind in
   jeder Zelle identisch mit dem Haupt-DCF und werden im Fußtext genannt.
7. **Working Capital gekennzeichnet:** `OWC_STOCK_SIMPLIFICATION_NOTE` — der
   Anfangsbestand wird bereits mit der Prognosequote angesetzt (OWC₀ = Quote ×
   Umsatz₀), eine Anpassung vom Ist-Bestand auf die Zielquote wird **nicht**
   modelliert (`_owcOpeningStockBasis`, `_owcStockAdjustmentModelled:false`,
   `_owcActualOpeningStockM`). Der automatisch gesetzte Wert heißt jetzt
   **„Vorläufige Modellannahme: 0; Nutzereingabe erforderlich"**
   (`_owcSetBy:'model_provisional_default'`) — nicht mehr „NUTZERANNAHME".
8. **Modellversion und Annahmen** konsistent an Modell, Matrix und Reverse DCF
   (`_modelVersion`, `_coreDefinitionLabel`, `_coreTaxRatePct`,
   `_coreCapexIntensityPct`, `_coreDaRatioPct`, `_coreFadeEnabled`, …).

### Pflicht-Tests
Neu: **`_testValuationCore()` — 85 Assertions**, im Runner als Pflichtfunktion
registriert. Dokumentierte Toleranzen: `1e-9` USD/Aktie für Wertvergleiche,
`1e-4` pp für Wachstum (= `REVERSE_DCF_SEARCH.tolerancePp`).

| Pflichtfall | Ergebnis |
|---|---|
| Roundtrip DCF → Kurs → Reverse DCF (g = 8 %, Rasterpunkt) | 8,0000 % ✅ |
| Roundtrip mit Zwischenwert g = 7,3 % (echte Halbierung) | 7,3000 % ✅ |
| Roundtrip mit Nettoschulden 500M (−5,00/Aktie) | 8 % zurückgewonnen ✅ |
| Roundtrip mit Nettoliquidität 200M (+2,00/Aktie) | 8 % zurückgewonnen ✅ |
| Roundtrip mit ΔWC 20 % und fallender Wertkurve (WC 500 %) | ✅ |
| Zentrale Matrixzelle = Haupt-DCF base | exakt, alle 25 Zellen aus dem Kern ✅ |
| WACC ≤ tg (Kern, Reverse DCF, Modell, Matrix) | abgefangen, kein 0-Ersatz ✅ |
| Nicht lösbar (Kurs 1e7 / 1e-6) | `no_solution_in_range`, `null` — kein Grenzwert ✅ |
| Referenzfall Chat 2 (ND 0/500/−200 → 15,00/10,00/17,00) | unverändert ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (`claude/dcf-working-capital`, aef1b34) | 688 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **775 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |
| Stabilität | 5 Läufe, identisches Ergebnis (Monte Carlo unauffällig) |

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| `computeReverseDcf` zurück auf den alten FCF-Pfad | 4 rot (C-11b/d/h) |
| Nettoschuldenbrücke im Kern entfernt | 18 rot (C-3a/d/f u.a.) |
| Suchbereichsgrenze als Ergebnis geraten | 5 rot (C-6a/b/d/e) |
| Matrix variiert zusätzlich tg (+0,1 pp) | 7 rot (C-4b/c/j) |
| Mid-Cycle zurück auf `dcfCore` | 12 rot (C-8b–f) |
| WACC ≤ tg nicht abgefangen | 5 rot (C-5a/b/f/g) |
| Reverse DCF ignoriert die WC-Quote | 3 rot (C-3g/i) |

**Geänderte Testerwartungen (fachlich begründet, im Code dokumentiert):**
- `W-9e`: Legacy-Pfad wird ausgeschlossen statt mit Warnhinweis weitergerechnet
  (Abnahmekriterium: „Ein Warnhinweis allein reicht nicht"). Die ursprüngliche
  Prüfabsicht — abweichende Definition muss benannt sein — bleibt erste Bedingung.
- `W-7d`, `W-11c`: Wortlaut „NUTZERANNAHME" / „angenommen, nicht gemessen" →
  „Vorläufige Modellannahme: 0; Nutzereingabe erforderlich". Prüfabsicht
  unverändert. `W-7d2/d3` neu ergänzt.
- Alle übrigen Referenztests aus Chat 2 (`_testDcfEquityBridge`, 44) und Chat 3
  (`_testDcfWorkingCapital`, jetzt 84) unverändert grün.

### Wirkung an Daten
**130 Fixtures, Wertvergleich vorher/nachher** (115 ausgewertet, 15 durch
Scope/Migration blockiert):
- **Haupt-DCF: 0 Wertänderungen** (T-QCE3 nur `undefined` → `null` bei
  weiterhin `applicable:false`).
- **DCF-Anwendbarkeit: 0 Änderungen** — kein Fixture verliert seinen DCF durch
  den Legacy-Ausschluss.
- **Mid-Cycle: 4 Änderungen.** T-MOS-COMPOSE2/3: 6,8367 → 4,2506 (Nettoschulden
  3.000M / 1.000M Aktien = **3,00/Aktie**, jetzt korrekt abgezogen; der
  operative Wert steigt zugleich um 0,4139 durch die einheitliche D&A-Quote
  statt des eingefrorenen TTM-Betrags). T-05/T-DIV1: 6,8367 → 6,8506
  (Brücke 0,40 minus derselbe D&A-Effekt).
- **Fair Value / Buy Price: je 4** — genau die Mid-Cycle-Fixtures.
  **Position/Verdict: 0 Änderungen.**
- **Reverse DCF: 96 Änderungen** — erwartet, andere Größe (Umsatz- statt
  FCF-Wachstum, Brücke statt `net_debt[0]`-Fallback).

**Synthetischer Realfall** (Umsatz 12.000M, +9 %/y, EBIT 22 %, WC 8,94 %,
Nettoschulden 8.000M / 500M Aktien = 16,00/Aktie, Kurs 95):
Haupt-DCF **88,9162 unverändert**; Reverse DCF 7,74 % → **9,75 %**
(1 Nullstelle; Gegenprobe: Wert bei gelöstem g = 94,999784 vs. Kurs 95).

### Offene Einschränkungen
- **`multiple_solutions` ist eine Absicherung ohne erreichbaren Fall.** Ein
  Raster-Scan über WC-Quoten 0–300 % und tg 0/2/3/5 % fand keine nicht-monotone
  Wertkurve: das Gate `r.total > 0` schneidet den Bereich ab, in dem der Wert
  wieder steigen könnte. Der Zweig ist implementiert und durch Inspektion
  belegt, aber nicht durch einen Live-Fall getestet.
- **Reverse DCF löst nur `growth_stage1`** (auftragsgemäß). Marge, WACC oder
  Terminalwachstum zu lösen wäre ein eigener Auftrag.
- **`reverseDcfReported`/`reverseDcfOwner`** bleiben auf REPORTED-FCF-Basis:
  Der SBC-Vergleich verlangt zwei FCF-Größen; im FCFF-Kern steckt SBC bereits im
  EBIT, ein „Owner"-Abschlag wäre dort nicht definierbar. Beide sind als
  Diagnose gekennzeichnet und speisen weder Headline noch Synthese.
- **Mid-Cycle normalisiert nur die Marge**, nicht CapEx/D&A separat: die
  CapEx-Quote ist im Kern ohnehin derselbe 10-Jahres-Median wie in
  `computeMidCycleFcf`; D&A folgt jetzt der Kern-Definition (Median-Quote) statt
  des TTM-Betrags. Das ist die Ursache des +0,4139-Effekts oben.
- `dcfCore` bleibt als toter, gekennzeichneter Code stehen (nicht entfernt, um
  den Diff klein zu halten).
- WC-Vereinfachung des Anfangsbestands unverändert (jetzt ausgewiesen);
  `short_term_debt` weiterhin ohne eigenes Schemafeld.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet.
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand nach Chat 4
- **Branch:** `claude/eager-bardeen-l53hvv` (basiert auf
  `claude/dcf-working-capital`, Commit aef1b34 — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Zustand bei Commit 4a76e4c:** Exit-Code 1, **775 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
  → **Überholt durch den Chat-4-Nachtrag oben (803 bestanden).**
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); `short_term_debt` als eigenes Schemafeld;
  Reverse DCF für weitere Parameter; Playwright für die zwei DOM-Formulartests.

---

## Update (Chat 3 Abschluss): Operatives Working Capital im Haupt-DCF

**Auftrag:** Den Haupt-DCF um operatives Working Capital ergänzen und die
Cashflow-Definition eindeutig machen.

### Befund am Code (vor der Änderung)
`forecastDcfCore()` bildete `FCF = NOPAT + D&A − CapEx`. Die Veränderung des
operativen Working Capital fehlte vollständig — im Prognosepfad wie im
Terminalübergang (`lastFcf × (1+tg)`). Ein Feld `short_term_debt` existiert im
Schema nicht; verfügbar sind `current_assets`, `current_liabilities`,
`cash_and_equivalents`/`cash`, `total_debt`, `long_term_debt`.

### Änderungen (Produktdatei)
1. **`_computeOwcHistory(f)` / `_resolveOwcForForecast(mj)` (neu):**
   `OWC = (current_assets − cash) − (current_liabilities − short_term_debt)`,
   `short_term_debt = total_debt − long_term_debt`. Zahlungsmittel und
   verzinsliche Finanzschulden sind ausgeschlossen — sie stehen in der
   Nettoschuldenbrücke aus Chat 2 und wären sonst doppelt erfasst.
   Verwendet werden nur **lückenlose Jahre ab Index 0** (Abbruch beim ersten
   unvollständigen Jahr), Median ab `OWC_MIN_YEARS = 3`.
2. **Prognoseparameter `valuation.assumptions.owc_pct_of_revenue`** (% vom
   Umsatz), manuell überschreibbar. Priorität: Override → historischer Median
   → Nutzerannahme erforderlich. Eingabefeld `#as-owc` im Assumptions-Tab
   inkl. Hinweistext (`_owcAssumptionHint`), Schema-Default, `ASS_FIELDS`,
   Formular-Binding und `source_type: manual`-Synchronisation.
3. **`forecastDcfCore()`:** `FCFF = EBIT × (1−t) + D&A − CapEx − ΔOWC` mit
   `ΔOWC_t = owcRatio × (Umsatz_t − Umsatz_{t−1})`. Bestand `OWC_0 =
   owcRatio × Umsatz_0`, damit kein einmaliger Aufholeffekt in Jahr 1 entsteht.
4. **Terminaljahr konsistent:** `ΔOWC_T = owcRatio × Umsatz_10 × tg`, der
   Terminal-FCFF wird aus dem *WC-freien* Teil (`lastPreWcFcf × (1+tg)`) minus
   `ΔOWC_T` gebildet. Ein bloßes `FCFF_10 × (1+tg)` schriebe die WC-Bindung bei
   g10 in die Ewigkeit fort. Bei `owcRatio = 0` rechnerisch identisch zum
   bisherigen Ausdruck — kein Verhaltensbruch.
5. **Fehlende Daten ≠ 0:** ohne belastbare Basis `available:false`,
   `measured:false`, `assumptionRequired:true`, Warnung „NUTZERANNAHME, KEIN
   gemessener Nullbedarf" und Nennung der fehlenden Felder. Der Forecast rechnet
   dann mit ΔOWC = 0, aber nie als Messwert ausgewiesen.
6. **Cashflow-Definition vs. Diskontsatz (`_classifyLegacyDcfCashflow`, neu):**
   `modelDcf` deklariert jetzt `_cashflowDefinition`, `_cashflowIsUnlevered`,
   `_discountRateBasis`, `_netDebtBridgeApplied`,
   `_cashflowDefinitionConsistent`. Der Legacy-Pfad (`f.fcf` = CFO − CapEx,
   nachfinanziert) und der Mid-Cycle-Pfad (unlevered, ohne Wertbrücke und ohne
   ΔWC) werden als **nicht definitionskonsistent** markiert und mit Warnung
   versehen, statt still denselben WACC zu teilen. `modelDcfMidcycle` übergibt
   dazu `{ definition: 'unlevered_midcycle' }` (neuer 4. Parameter
   `fcfStartMeta`, rückwärtskompatibel).
7. **SBC vs. Verwässerung:** am Code geprüft — SBC steckt bereits im GAAP-EBIT
   und wird im FCFF nicht erneut abgezogen; die Verwässerung wirkt
   ausschließlich über die Aktienprojektion im Nenner; `_computeOwnerFcfDcf`
   bleibt Diagnose ohne Einfluss auf Fair Value/Buy Price; es gibt keinen
   SBC-MoS-Zuschlag. **Bereits korrekt — durch Tests abgesichert** (W-10) und
   über `_sbcDeductedFromFcff` / `_dilutionTreatment` explizit gemacht.
8. **Nachgelagerte Anzeigen:** `buildSensitivityMatrix` und `runMonteCarloDcf`
   speisen sich aus `buildForecastInputs` und übernehmen ΔOWC automatisch; die
   Matrix nennt die verwendete Quote bzw. kennzeichnet die 0-Annahme.

### Pflicht-Tests (unabhängig nachgerechnet)
Referenz: Umsatz0 1.000M, EBIT-Marge 20 %, Steuer 25 %, D&A 5 %, CapEx 5 %
(⇒ FCFF vor ΔWC = 15 % vom Umsatz), g1 = 10 %, WACC 10 %, 100M Aktien.

| Pflichtfall | Erwartet | Ergebnis |
|---|---|---|
| Umsatz 1.000 → 1.100, WC/Umsatz 20 % | ΔWC = 20,0M | 20,0M ✅ |
| ⤷ Wert je Aktie | 28,1818 (statt 30,00) | 28,1818 ✅ |
| Negative Quote (−20 %) bei Wachstum | setzt Geld frei, 31,8182 | 31,8182 ✅ |
| Nullwachstum, konstante Quote | ΔWC = 0 in allen 10 Jahren + Terminal | exakt 0 ✅ |
| Referenzfall Chat 2 mit WC = 0 (ND 0 / 500 / −200) | 15,00 / 10,00 / 17,00 | identisch ✅ |
| Terminaljahr tg = 3 % | ΔWC_T = 15,5625M, EV 3.439,6104M | identisch ✅ |

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (Commit 8c2f7f8) | 606 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Änderung | **688 bestanden · 1 (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |

Neu: `_testDcfWorkingCapital()` — **82 Assertions**, alle grün, im Runner als
Pflichtfunktion registriert. Stabilität der beiden stochastischen
Monte-Carlo-Assertions über 8 Läufe geprüft (Abweichung ≤ 0,015 bei Toleranz
0,60).

**Keine bestehende Testerwartung wurde geändert.** Gegenprobe: alle 130
Fixtures liefern vor und nach der Änderung **bitgleiche** DCF- und
Synthesis-Werte (Vergleichsskript über `_runSingleFixture`). Grund: kein
Fixture enthält die für die OWC-Ableitung nötigen Bilanzdaten (119 ohne
`current_assets`/`current_liabilities`, 8 zusätzlich ohne `revenue`, 3 ohne
`long_term_debt`) — sie laufen in den ausgewiesenen Annahmefall ΔWC = 0. T-BRL1
ist unverändert (identische Assertion-Ergebnisse).

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
| Mutation | Ergebnis |
|---|---|
| ΔWC im Forecast entfernt (Ausgangsdefekt) | 9 Assertions rot (W-2d/e/g/h, W-3c, W-6d, W-8d/d2, W-8i) |
| Naiver Terminalübergang `FCFF_10 × (1+tg)` | 10 Assertions rot (u.a. W-6c/e/f) |
| Fehlende Daten als „gemessene 0" ausgewiesen | 2 Assertions rot (W-7b/c) |
| Cash nicht aus dem OWC ausgeschlossen | 9 Assertions rot (W-1b/c/e/f/i, W-8a/g) |

**Wirkungsnachweis an realistischen Daten** (synthetischer Wachstumsfall,
Umsatz 12.000M, +9 %/y): abgeleitete Quote 11,46 % aus 4 lückenlosen Jahren
(unabhängig nachgerechnet: Median aus 11,67/12,38/10,87/11,25 %), ΔWC Jahr 1
123,8M, Terminal 81,4M; Fair Value 91,01 → **87,69** USD/Aktie (−3,33).

### Offene Einschränkungen
- **Kurzfristige Finanzschulden** werden aus `total_debt − long_term_debt`
  abgeleitet; ein eigenes Feld existiert im Schema nicht. Fehlt
  `long_term_debt` bei `total_debt > 0`, gilt das Jahr als unvollständig.
  Ein eigenes `short_term_debt`-Feld inkl. SEC-Mapping wäre ein eigener Auftrag.
- **`OWC_0 = owcRatio × Umsatz_0`** statt Ist-Bestand: bewusst, um einen
  einmaligen Aufholeffekt zu vermeiden. Wer den Ist-Bestand als Startpunkt will,
  bekommt in Jahr 1 eine zusätzliche Anpassung — fachlich diskutabel, hier
  nicht umgesetzt.
- **Legacy-/Mid-Cycle-Pfad:** Cashflow-Definition wird jetzt ausgewiesen und
  als inkonsistent markiert, aber **nicht korrigiert**. `CFO − CapEx` mit CoE
  statt WACC zu diskontieren bzw. den Mid-Cycle-Pfad um Wertbrücke und ΔWC zu
  erweitern, wäre eine eigene Verhaltensänderung — nicht Gegenstand dieses
  Auftrags.
- Kein Fixture deckt die OWC-Ableitung ab; die Absicherung erfolgt
  ausschließlich über `_testDcfWorkingCapital` mit synthetischen Daten.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet; das neue
  Feld `#as-owc` ist in `_syntheticIds`/`_ensureInput` ergänzt, aber wie die
  übrigen Felder nur im Browser real prüfbar.
- Keine automatische Quartalsbeschaffung (auftragsgemäß).
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand für Chat 4
- **Branch:** `claude/dcf-working-capital` (basiert auf
  `claude/dcf-net-debt-bridge`, Commit 8c2f7f8 — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **688 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); `short_term_debt` als eigenes Schemafeld;
  Diskontsatz-Konsistenz des Legacy-/Mid-Cycle-Pfades; Playwright für die zwei
  DOM-Formulartests.

---

## Update (Chat 2 Abschluss): DCF-Eigenkapitalbrücke

**Auftrag:** Ausschließlich den Übergang operativer Unternehmenswert →
Eigenkapitalwert im Haupt-DCF korrigieren.

### Befund am Code (vor der Änderung)
`forecastDcfCore()` diskontiert operative Cashflows vor Finanzierung
(NOPAT + D&A − CapEx) mit WACC → **operativer Unternehmenswert**. `modelDcf()`
übernahm `r.total` unverändert als Wert je Aktie. Nachverfolgt bis zur Anzeige
und Synthese: **an keiner Stelle** wurde ein Nettoschuldenabzug vorgenommen —
weder in `forecastDcfCore`, noch in `modelDcf`, noch in
`runFairValueSynthesizer` (der die Modellwerte nur gewichtet). Ein bereits
vorhandener oder doppelter Abzug ist damit ausgeschlossen.

Abgegrenzt (bewusst **nicht** geändert):
- **Legacy-Fallback** in `modelDcf` (`fcfStartOverride` / `f.fcf[0]` via
  `dcfCore`) und damit auch **DCF Mid-Cycle**: `f.fcf = cfo − capex` ist eine
  bereits nachfinanzierte Größe (CFO enthält gezahlte Zinsen). Ein zusätzlicher
  Nettoschuldenabzug wäre dort teilweises Double Counting. Andere Semantik,
  anderer Auftrag.
- `modelEpvFloor`, `_computeOwnerFcfDcf`, `calculateImpliedGrowth`,
  `computeRelativeMultiplesFV`: ziehen Nettoschulden bereits ab — unverändert.

### Änderungen
Produktdatei `us-aktienbewertungstool-v1036-sector-classification-patch.html`:
1. **`_resolveNetDebtForDcfBridge(f)` (neu):** Priorität `net_debt[0]` →
   `total_debt[0] − cash_and_equivalents[0]` → `total_debt[0] − cash[0]`
   (identisch zu `computeNetDebtToEbitda`). Fehlt eine Komponente, ist das
   Ergebnis `available: false` mit Namen der fehlenden Felder — **fehlende
   Daten gelten nicht als 0**. `cash: [0]` ist dagegen ein vorhandener Wert.
2. **`modelDcf()` Forecast-Zweig:** Eigenkapitalwert je Aktie
   = operativer Wert je Aktie − `netDebt / shares_diluted[0]`. **Genau ein
   Abzug.** Nettoliquidität (negative Nettoschulden) wird über dieselbe Formel
   addiert. Ist `available: false`, erfolgt **kein** Abzug und der Wert wird
   ausdrücklich als unbereinigt gekennzeichnet.
3. **Explizite Wertbrücke** in `warnings` (im Modell-Card sichtbar) und als
   maschinenlesbare Felder: `_operatingValueAbsBase`,
   `_operatingValuePerShareBase`, `_grossDebtM`, `_cashM`, `_netDebtM`,
   `_netDebtPerShare`, `_netDebtSource`, `_netDebtAvailable`,
   `_netDebtMissingFields`, `_equityValueAbsBase`, `_equityValuePerShareBase`,
   `_sharesUsedM`, `_sharesBasis`, `_sharesBasisIsSubstitute`.
4. **Aktienbasis:** `shares_diluted[0]` ist der Ø verwässerte Periodenwert und
   **nicht** die Stichtags-Aktienzahl. Basis unverändert (Konvention aller
   Modelle), aber als Ersatzbasis gekennzeichnet — im Text und über
   `_sharesBasisIsSubstitute: true`.
5. **Trennung Verwässerung vs. Wertbrücke:** Nettoschulden sind eine
   Stichtagsgröße und werden immer durch die **heutige** Aktienzahl geteilt —
   unabhängig davon, ob der operative Wert je Aktie über `shares0` oder (bei
   Dilution > 0,5 %/y) jahresweise verwässert ermittelt wurde. Bei aktiver
   Dilutionsprojektion weist eine zusätzliche Zeile die Trennung aus. Kein
   verdecktes Double Counting.
6. **Unmittelbar betroffene Anzeigen mitgezogen** (sonst wichen sie um exakt
   `netDebt/Aktie` vom Hauptmodell ab):
   - `buildSensitivityMatrix()` — als „Fair Value" beschriftet, nutzt jetzt
     dieselbe Brücke (nur im Forecast-Zweig; Mid-Cycle/Legacy unverändert),
     inkl. Hinweiszeile zu Abzug bzw. fehlendem Abzug.
   - `runMonteCarloDcf()` — die Simulationswerte werden über `probAbovePrice`
     mit dem Aktienkurs verglichen, also Eigenkapitalwerte. Zusätzlich: ein
     negativer Eigenkapitalwert wird nicht mehr still aus der Verteilung
     gefiltert (sonst optimistischer Bias).
7. Wording: „Hauptwert" in der Buyback-Diagnose → „operativer Wert … beide vor
   Nettoschuldenabzug" (der Hauptwert ist jetzt der Eigenkapitalwert).

Testinfrastruktur:
- `_testDcfEquityBridge()` (neu, in der Produktdatei) — 44 Assertions.
- `test/run-calc-tests.js`: neue Funktion in `PURE_TEST_FUNCTIONS`; zusätzlich
  gibt der Runner bei Fehlschlägen jetzt das Freitext-Feld `extra` aus, wenn
  `expected`/`actual` fehlen (bisher „erwartet: undefined"). Die in Chat 1
  ergänzte Fehlererkennung ist unverändert erhalten.

### Pflicht-Test (unabhängig nachgerechnet)
Umsatz 1.000M, EBIT 200M, D&A 50M, CapEx 50M, Steuer 25 %, g1 = tg = 0 %,
WACC 10 %, 100M konstante Aktien → FCF = 150M p.a. → EV = 150/0,10 = **1.500M**
= 15,00 USD/Aktie operativ.

| Fall | Erwartet | Ergebnis |
|---|---|---|
| Nettoschulden 0 | 15,00 | 15,00 ✅ |
| Nettoschulden 500M | 10,00 | 10,00 ✅ |
| Nettoliquidität 200M | 17,00 | 17,00 ✅ |
| Nettoschulden 2.000M (negatives EK) | −5,00, ausgewiesen | −5,00, `applicable: true` ✅ |
| Keine Schulden-/Liquiditätsdaten | kein stiller 0-Abzug | 15,00 + `_netDebtAvailable: false`, `_netDebtM: null`, Warnung ✅ |
| `total_debt` ohne Liquiditätsangabe | nicht ableitbar | kein Abzug, Feld benannt ✅ |

Der WACC bleibt in allen Varianten fix 10 % — Finanzierungsänderungen ändern
ihn im Testpfad nicht (B-8 prüft: operativer Wert je Aktie in allen drei
Varianten identisch 15,00; Differenzen entsprechen exakt `netDebt/Aktien`).

### Tatsächlich ausgeführte Tests
Befehl: `node test/run-calc-tests.js` (= `npm test`)

| Lauf | Ergebnis |
|---|---|
| Ausgangsstand (vor Änderung, Commit 7d0a0cc) | 562 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler · Exit 1 |
| Nach der Korrektur | **606 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler · Exit 1** |
| Fixture-Ebene beide Läufe | 374 Assertions bestanden, 1 fehlgeschlagen, 0 Pipeline-Fehler |

**Keine bestehende Testerwartung wurde geändert** — die Korrektur erzwang keine
Anpassung (kein Fixture prüft DCF-Beträge in einer Genauigkeit, die der Abzug
verletzt). Neue Assertions: 44 (`_testDcfEquityBridge`), alle grün.

**Negativprüfung (temporäre, nicht committete Kopien im Scratch-Verzeichnis):**
- Brücke in `modelDcf` entfernt → 9 der neuen Assertions schlagen fehl
  (B-3a/d, B-4a, B-5a/d/e, B-7a/b, B-8b). Der Test erkennt den Originalfehler.
- Brücke in `buildSensitivityMatrix` entfernt → B-10a schlägt fehl.

**Wirkungsnachweis an realistischen Daten** (synthetischer AVGO-artiger Fall,
Nettoschulden 26.000M / 450M Aktien): base 275,44 → **217,66** USD/Aktie;
Differenz 57,78 = exakt `netDebt/Aktien`, also genau ein Abzug.

**Monte Carlo** (stochastisch, daher bewusst ohne Assertion, einmalig manuell
geprüft): Median 14,90 / 10,00 / 17,15 bei Nettoschulden 0 / 500M / −200M.

### T-BRL1 (bekannter Altfehler, weiterhin rot)
Nicht Gegenstand dieses Auftrags und **nicht** durch sachfremde Anpassungen
grün gemacht. Wirkung der Korrektur gemessen: DCF base 16,02 → 15,62
(Nettoschulden 400M / 1.000M Aktien = 0,40/Aktie), RIM unverändert 5,13,
Divergenz **3,12x → 3,05x** — weiterhin über dem 3x-Gate, `buyPrice` bleibt
`null`, identische Fehlermeldung. Diagnose aus Chat 1 bleibt gültig:
Fixture-Kalibrierung, kein Logik- oder Runnerfehler.

### Offene Einschränkungen
- Legacy-FCF-Zweig und DCF Mid-Cycle sind bewusst ohne Wertbrücke (Begründung
  oben). Ob `cfo − capex` fachlich als FCFE gelten soll, ist eine offene
  Grundsatzfrage — nicht in diesem Auftrag entschieden.
- Bei `net_debt[0]` als Quelle sind Bruttoschulden und Liquidität einzeln nicht
  bekannt; die Anzeige weist das als „n/a (in net_debt enthalten)" aus.
- Aktienbasis bleibt `shares_diluted[0]` (Ø verwässert). Eine echte
  Stichtags-Aktienzahl wird nicht verwendet, nur gekennzeichnet — eine
  Umstellung beträfe alle Modelle und ist ein eigener Auftrag.
- Zwei DOM-Formulartests bleiben außerhalb eines Browsers ungetestet.
- CI-Lauf-Status auf GitHub in dieser Sitzung nicht abgerufen. Ein roter
  Actions-Lauf wegen T-BRL1 ist zu erwarten und kein neuer Defekt.
- Kein Merge, kein Deployment.

### Ausgangsstand für Chat 3
- **Branch:** `claude/dcf-net-debt-bridge` (basiert auf
  `test-infra/node-calc-runner`, Commit 7d0a0cc — nicht auf `main`).
- **Startbefehl:** `npm test` bzw. `node test/run-calc-tests.js`
- **Erwarteter Ausgangszustand:** Exit-Code 1, **606 bestanden**, 1 bekannter
  Fehlschlag (T-BRL1), 0 Fehler/Exceptions.
- **Nächster Auftrag laut Plan:** Working Capital und Wachstumsmodell.
- Optional weiterhin offen: T-BRL1-Fixture fachlich neu kalibrieren
  (DCF/RIM-Divergenz < 3x); Playwright für die zwei DOM-Formulartests.

---

## Update (Chat 1 Abschluss): Fehlererkennung des Testrunners
**Behobene Schwachstelle:** `run-calc-tests.js` zählte fehlende/nicht
aufrufbare Pflicht-Testfunktionen (`PURE_TEST_FUNCTIONS`) bisher NICHT als
Fehler, sondern übersprang sie stillschweigend ("nicht gefunden") — ein
kaputter/entfernter Test hätte so unbemerkt einen grünen Lauf erlaubt.
Ebenso zählten 0 zurückgegebene Assertions einer Pflichtfunktion als
"0 fehlgeschlagen" statt als Fehler, und eine leere `REGRESSION_FIXTURES`-
Liste hätte (in Kombination mit fehlenden Funktionen) zu einem 0/0/0-Lauf
mit Exit-Code 0 führen können.

Korrektur (nur `test/run-calc-tests.js`, keine Produktdatei betroffen):
- Pflicht-Testfunktion fehlt/ist keine Funktion → `totalError++`, Name wird
  in der Fehlerliste genannt.
- Pflicht-Testfunktion liefert 0 Assertions → `totalError++`, Name genannt.
- `REGRESSION_FIXTURES.length === 0` → `totalError++`, explizite Meldung.
- Sicherheitsnetz: 0 Pass + 0 Fail + 0 Error am Ende → wird zu 1 Error
  ("leerer Lauf gilt nicht als Erfolg").
- Bewusst übersprungene DOM-Tests (`_testManualAssumptionOverride`,
  `_testMarketDataOverrides`) bleiben unverändert als SKIPPED ausgewiesen.

**Verifiziert mit temporären, nicht committeten Kopien** der Produkt-HTML:
| Szenario | Ergebnis |
|---|---|
| Pflicht-Testfunktion umbenannt/fehlt (`_testGoldenCases`) | Exit 1, `⛔ [_testGoldenCases] Pflicht-Testfunktion fehlt...` |
| Pflicht-Testfunktion liefert `[]` (`_testSbcDiagnostics`) | Exit 1, `⛔ [_testSbcDiagnostics] 0 Assertions zurückgegeben...` |
| `REGRESSION_FIXTURES.length = 0` | Exit 1, `⛔ [REGRESSION_FIXTURES] ... leer (0 Einträge)...` |

**Regulärer Lauf nach der Korrektur** (`npm test`):
562 bestanden · 1 fehlgeschlagen (T-BRL1) · 0 Fehler/Exceptions, Exit-Code 1.

**CI-Workflow geprüft:** `.github/workflows/tests.yml` ruft exakt
`node test/run-calc-tests.js` auf, ohne `continue-on-error`.

### Auftrag Chat 1
Reproduzierbare Testgrundlage schaffen, ohne die Finanzlogik zu verändern.

### Änderungen Chat 1
- `test/run-calc-tests.js` (neu): abhängigkeitsfreier Node-Runner. Lädt den
  `<script>`-Inhalt der Produkt-HTML per `vm.createContext`/`vm.runInContext`
  read-only, mit minimalen Stubs (`document`, `localStorage`, `fetch` etc.).
- `package.json` (neu): `npm test` → `node test/run-calc-tests.js`.
- `.github/workflows/tests.yml` (neu): CI-Workflow.
- Produktdatei wurde in Chat 1 **nicht verändert**.

### Bewusst ausgeschlossen (kein Fake-Pass!)
- `_testManualAssumptionOverride`, `_testMarketDataOverrides`: legen echte
  `<input>`-Elemente an und lesen `.value` — als **SKIPPED** ausgewiesen.
- `_testPeriodAlignment`: im Quelltext auskommentiert, existiert zur Laufzeit
  nicht.
