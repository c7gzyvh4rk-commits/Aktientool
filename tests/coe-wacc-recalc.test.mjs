// ─────────────────────────────────────────────────────────────────────────────
// V1.0.87 · Manuelle CoE wirkt beim ERSTEN „Neu berechnen“ auf den abgeleiteten WACC.
//
// Befund (AUDIT-PRAXISABNAHME-CRH.md §9.10, bis V1.0.86): recalcFromAssumptions
// erkannte die direkt geaenderte CoE, setzte das Flag „manual“ aber erst NACH
// deriveCostOfCapital. Die Ableitung ueberschrieb die CoE, bildete den WACC aus
// der alten CoE, und danach wurde nur die CoE zurueckgeschrieben. Der WACC
// folgte erst beim zweiten Klick (verzoegerte Korrektur); Anzeige der CoE und
// verwendeter Diskontsatz passten nach dem ersten Klick nicht zusammen.
// Daneben fiel ein beim Import durch die Untergrenze angehobener WACC bei
// unveraendertem „Neu berechnen“ auf den Rohwert zurueck (deriveCostOfCapital
// kennt die Untergrenze nicht); der naechste Klick las den weiter angezeigten
// Wert als manuellen Override.
//
// Ablauf wie in der Oberflaeche (tests/recalc-harness.mjs): Import → Reiter
// Annahmen → Feld aendern → recalcFromAssumptions. Browser: acceptance.mjs §19.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './recalc-harness.mjs';
import * as FX from './browser/fixtures.mjs';

// Unabhaengige Kontrollrechnung (kein Produktcode): RF 4 %, ERP 6 %, Beta 1.5
// ⇒ CoE 13 %; Kd vor Steuern 5 %; Gewichte je 50 %; Steuer 0,5 % (tax_rate 0.5).
const ctrlWacc = (coe, kdPct = 5, taxPct = 0.5) => 0.5 * coe + 0.5 * kdPct * (1 - taxPct / 100);
const RND = 5e-5 + 1e-12;   // Produkt rundet den WACC auf 4 Nachkommastellen
const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < RND;
// Untergrenze standard_nonfin: max(8 %, RF 4 % + 4 pp) = 8 % (Regel unveraendert).
const FLOOR = 8;

function compMj(extra, comp) {
  const m = FX.corePeriodMj('valid');
  m.meta.sub_classification = 'standard_nonfin';
  const v = Object.assign({}, m.valuation);
  delete v.wacc_derived; delete v.cost_of_equity; delete v.cost_of_equity_derived;
  v.wacc_components = Object.assign({ risk_free: 0.04, risk_free_rate: 0.04, equity_risk_premium: 0.06, beta: 1.5,
    cost_of_debt_pretax: 0.05, tax_rate: 0.5, debt_weight: 0.5, equity_weight: 0.5 }, comp || {});
  Object.assign(v, extra || {});
  m.valuation = v;
  return m;
}

function imported(extra, comp) {
  const A = loadApp();
  assert.notEqual(A.importMj(compMj(extra, comp)), false, 'Import');
  return A;
}

// Unabhaengig aufgebauter Referenzzustand: frischer Import mit denselben
// endgueltigen Annahmen (manuelle CoE als Herkunft „manual“ im Master-JSON).
function reference(coe, comp) {
  return imported({ cost_of_equity_derived: coe, _derivationFlags: { cost_of_equity_derived: 'manual' } }, comp).snapshot();
}

// Bewertungsrelevante Groessen (ohne Kurs und Herkunftslisten).
const valuationOf = (s) => ({ coe: s.coe, wacc: s.wacc, usedWacc: s.usedWacc, usedWaccCons: s.usedWaccCons,
  usedWaccOpt: s.usedWaccOpt, usedCoe: s.usedCoe, dWacc: s.dWacc, dCoe: s.dCoe, dcf: s.dcf, rim: s.rim, range: s.range });

test('0 · Kontrollrechnung: 8.9875 % aus CoE 13, 9.9875 % aus CoE 15', () => {
  assert.ok(Math.abs(ctrlWacc(13) - 8.9875) < 1e-12);
  assert.ok(Math.abs(ctrlWacc(15) - 9.9875) < 1e-12);
});

test('1 · Import: WACC aus vollstaendigen Komponenten abgeleitet, oberhalb der Untergrenze (Gegenprobe)', () => {
  const s = imported().snapshot();
  assert.equal(s.coe, 13);
  assert.equal(s.coeFlag, 'derived');
  assert.equal(s.waccFlag, 'derived');
  assert.equal(s.floor, false);
  assert.ok(near(s.wacc, ctrlWacc(13)), String(s.wacc));
  assert.equal(s.usedWacc, s.wacc, 'Bewertung verwendet den angezeigten WACC');
});

test('2 · Fehlerfall: nur CoE 13 ⇒ 15, EIN Klick ⇒ WACC 9.9875 % (abgeleitet), Bewertung = Referenzzustand', () => {
  const A = imported();
  const before = A.snapshot();
  A.type('as-coe', 15);
  A.recalc();
  const s = A.snapshot();
  assert.equal(s.coe, 15);
  assert.equal(s.coeFlag, 'manual');
  assert.ok(near(s.wacc, ctrlWacc(15)), 'WACC nach erstem Klick ' + s.wacc + ' statt ' + ctrlWacc(15) + ' (vorher ' + before.wacc + ')');
  assert.equal(s.waccFlag, 'derived', 'WACC bleibt abgeleitet, kein Override');
  assert.equal(s.dOverride, null);
  assert.equal(s.usedWacc, s.wacc, 'DCF diskontiert mit dem angezeigten WACC');
  assert.equal(s.usedCoe, 15, 'RIM rechnet mit der manuellen CoE');
  assert.equal(s.dWacc, s.wacc, 'wacc_components.derived.wacc konsistent');
  assert.equal(s.dCoe, 15, 'wacc_components.derived.cost_of_equity konsistent');
  assert.equal(A.field('as-wacc'), String(s.wacc), 'Feld zeigt den verwendeten WACC');
  assert.equal(A.field('as-coe'), '15');
  assert.deepEqual(s.manual, ['cost_of_equity_derived']);
  assert.equal(s.srcCoe, 'manual');
  assert.equal(s.srcWacc, 'derived');
  assert.ok(s.dcf[1] < before.dcf[1], 'hoeherer WACC ⇒ niedrigerer DCF');
  assert.deepEqual(valuationOf(s), valuationOf(reference(15)), 'gleiche Bewertung wie ein Import mit CoE 15');
});

test('3 · zweites und drittes „Neu berechnen“ ohne Aenderung: CoE, WACC, Herkunft und Bewertung stabil', () => {
  const A = imported();
  A.type('as-coe', 15);
  A.recalc();
  const first = A.snapshot();
  A.recalc();
  const second = A.snapshot();
  A.recalc();
  const third = A.snapshot();
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.ok(near(third.wacc, ctrlWacc(15)));
});

test('4 · weitere CoE-Aenderung 15 ⇒ 17: abgeleiteter WACC folgt sofort', () => {
  const A = imported();
  A.type('as-coe', 15); A.recalc();
  A.type('as-coe', 17); A.recalc();
  const s = A.snapshot();
  assert.equal(s.coe, 17);
  assert.ok(near(s.wacc, ctrlWacc(17)), String(s.wacc));
  assert.equal(s.waccFlag, 'derived');
  assert.equal(s.usedWacc, s.wacc);
  assert.deepEqual(valuationOf(s), valuationOf(reference(17)));
});

test('4b · CoE 11 ⇒ Rohwert 7.9875 % unter der Untergrenze: 8 % wie beim Import (Regel unveraendert)', () => {
  const A = imported();
  A.type('as-coe', 11); A.recalc();
  const s = A.snapshot();
  assert.equal(s.coe, 11);
  assert.equal(s.wacc, FLOOR);
  assert.equal(s.floor, true);
  assert.ok(near(s.floorPrev, ctrlWacc(11)), 'Rohwert ' + s.floorPrev);
  assert.equal(s.waccFlag, 'derived');
  assert.equal(s.usedWacc, FLOOR);
  const ref = reference(11);
  assert.equal(ref.wacc, FLOOR, 'Referenz: Import mit CoE 11 hebt ebenfalls auf 8 %');
  assert.deepEqual(valuationOf(s), valuationOf(ref));
  // zurueck ueber die Untergrenze: Kennzeichen entfaellt
  A.type('as-coe', 15); A.recalc();
  const t = A.snapshot();
  assert.ok(near(t.wacc, ctrlWacc(15)));
  assert.equal(t.floor, false);
  assert.equal(t.floorPrev, null);
});

test('4c · Untergrenze beim Import (Beta 1 ⇒ Rohwert 7.4875 %): unveraendertes „Neu berechnen“ haelt 8 %, kein Override', () => {
  const A = imported(null, { beta: 1 });
  const a = A.snapshot();
  assert.equal(a.wacc, FLOOR);
  assert.equal(a.floor, true);
  A.recalc();
  const b = A.snapshot();
  A.recalc();
  const c = A.snapshot();
  assert.deepEqual(b, a, 'erster Klick ohne Aenderung');
  assert.deepEqual(c, a, 'zweiter Klick ohne Aenderung');
  assert.equal(c.waccFlag, 'derived');
  assert.deepEqual(c.manual, []);
});

test('5 · bereits manuelle CoE + Kd 5 % ⇒ 6 %: Ableitung verwendet weiter die manuelle CoE (Gegenprobe)', () => {
  const A = imported();
  A.type('as-coe', 15); A.recalc();
  A.type('as-kd', 0.06); A.recalc();
  const s = A.snapshot();
  assert.equal(s.coe, 15);
  assert.equal(s.coeFlag, 'manual');
  assert.equal(s.kd, 0.06);
  assert.ok(near(s.wacc, ctrlWacc(15, 6)), s.wacc + ' statt ' + ctrlWacc(15, 6));
  assert.equal(s.waccFlag, 'derived');
  assert.equal(s.usedWacc, s.wacc);
  const ref = reference(15, { cost_of_debt_pretax: 0.06 });
  for (const k of ['coe', 'wacc', 'usedWacc', 'usedCoe', 'dcf', 'rim', 'range']) assert.deepEqual(s[k], ref[k], k);
});

test('5b · Komponentenaenderung: wacc_components.derived (Verbraucher u. a. Synthese) folgt dem neuen WACC', () => {
  const A = imported();
  A.type('as-coe', 15); A.recalc();
  A.type('as-kd', 0.06); A.recalc();
  const s = A.snapshot();
  assert.equal(s.dWacc, s.wacc, 'derived.wacc ' + s.dWacc + ' statt ' + s.wacc);
  assert.equal(s.dCoe, 15);
  assert.deepEqual(valuationOf(s), valuationOf(reference(15, { cost_of_debt_pretax: 0.06 })));
});

test('6 · ausdruecklich manueller WACC 11.25 bleibt bei CoE-, Kd- und Beta-Aenderung erhalten (Gegenprobe)', () => {
  const A = imported();
  A.type('as-wacc', 11.25); A.recalc();
  let s = A.snapshot();
  assert.equal(s.wacc, 11.25);
  assert.equal(s.waccFlag, 'manual');
  A.type('as-coe', 16); A.recalc();
  s = A.snapshot();
  assert.equal(s.coe, 16);
  assert.equal(s.wacc, 11.25, 'nach CoE-Aenderung');
  A.type('as-kd', 0.07); A.recalc();
  A.type('as-beta', 2); A.recalc();
  s = A.snapshot();
  assert.equal(s.wacc, 11.25, 'nach Komponentenaenderung');
  assert.equal(s.waccFlag, 'manual');
  assert.equal(s.dOverride, 11.25);
  assert.equal(s.coe, 16, 'manuelle CoE bleibt bei Beta-Aenderung');
  assert.equal(s.usedWacc, 11.25);
  assert.deepEqual(s.manual, ['beta', 'cost_of_debt_pretax', 'cost_of_equity_derived', 'wacc_derived']);
  A.recalc();
  assert.deepEqual(A.snapshot(), s, 'unveraenderter Klick');
});

test('7 · CoE und WACC gleichzeitig manuell: beide Eingaben bleiben, WACC hat Vorrang (Gegenprobe)', () => {
  const A = imported();
  A.type('as-coe', 15);
  A.type('as-wacc', 12);
  A.recalc();
  const s = A.snapshot();
  assert.equal(s.coe, 15);
  assert.equal(s.wacc, 12);
  assert.equal(s.coeFlag, 'manual');
  assert.equal(s.waccFlag, 'manual');
  assert.equal(s.usedWacc, 12);
  assert.equal(s.usedCoe, 15);
  A.recalc();
  assert.deepEqual(A.snapshot(), s);
});

test('8 · reine Kursaenderung: CoE, WACC und kursunabhaengige Modellwerte unveraendert (Gegenprobe)', () => {
  const A = imported();
  const a = A.snapshot();
  A.type('as-price', 55); A.recalc();
  const b = A.snapshot();
  assert.equal(b.price, 55);
  for (const k of ['coe', 'wacc', 'coeFlag', 'waccFlag', 'usedWacc', 'dcf', 'rim', 'range']) assert.deepEqual(b[k], a[k], k);
});

test('8b · reine Kursaenderung nach manueller CoE: keine verzoegerte WACC-Aenderung', () => {
  const A = imported();
  A.type('as-coe', 15); A.recalc();
  const c = A.snapshot();
  A.type('as-price', 61.5); A.recalc();
  const d = A.snapshot();
  assert.equal(d.price, 61.5);
  for (const k of ['coe', 'wacc', 'coeFlag', 'waccFlag', 'usedWacc', 'dcf', 'rim', 'range']) assert.deepEqual(d[k], c[k], 'nach CoE: ' + k);
  assert.ok(near(d.wacc, ctrlWacc(15)));
});

test('9 · Export und Wiederimport: Werte und Herkunft gleich, danach „Neu berechnen“ ohne Wirkung', () => {
  const A = imported();
  A.type('as-coe', 15); A.recalc();
  const s = A.snapshot();
  const ex = A.exportJson();
  assert.equal(ex.valuation.cost_of_equity_derived, 15);
  assert.equal(ex.valuation._derivationFlags.cost_of_equity_derived, 'manual');
  assert.ok(near(ex.valuation.wacc_derived, ctrlWacc(15)));
  assert.equal(ex.valuation._derivationFlags.wacc_derived, 'derived');
  assert.equal(ex.valuation.wacc_components.derived.wacc, ex.valuation.wacc_derived);
  assert.equal(ex.valuation.wacc_components.tax_rate, 0.5);
  const B = loadApp();
  assert.notEqual(B.importMj(ex), false);
  const r = B.snapshot();
  assert.deepEqual(valuationOf(r), valuationOf(s));
  assert.equal(r.coeFlag, 'manual');
  assert.equal(r.waccFlag, 'derived');
  B.recalc();
  const r2 = B.snapshot();
  B.recalc();
  assert.deepEqual(B.snapshot(), r2);
  assert.deepEqual(valuationOf(r2), valuationOf(s));
  assert.equal(r2.coeFlag, 'manual');
  assert.equal(r2.waccFlag, 'derived');
});

// Ohne Beta ist der WACC beim Import heuristisch (Sektorwert 9 %). deriveCostOfCapital
// bildet ihn bei manueller CoE nach seiner bestehenden Regel („CoE abgeleitet ODER
// manuell“) aus CoE, Kd, Steuer und Gewichten; applyDerivedFieldsV4 verlangt dafuer
// Beta. Diese Abweichung der beiden Ableitungen bleibt unveraendert (Bericht §9.11);
// geprueft wird hier nur, dass kein zweiter Klick mehr etwas aendert.
function noBeta(extraDelete) {
  const m = compMj();
  delete m.valuation.wacc_components.beta;
  for (const k of extraDelete || []) delete m.valuation.wacc_components[k];
  const A = loadApp();
  assert.notEqual(A.importMj(m), false);
  return A;
}

test('11 · ohne Beta (heuristischer WACC), manuelle CoE: Ergebnis des ersten Klicks bleibt, kein verzoegerter Wechsel', () => {
  const A = noBeta();
  const a = A.snapshot();
  assert.equal(a.waccFlag, 'heuristic');
  A.type('as-coe', 15); A.recalc();
  const b = A.snapshot();
  A.recalc();
  const c = A.snapshot();
  A.recalc();
  assert.deepEqual(c, b, 'zweiter Klick');
  assert.deepEqual(A.snapshot(), b, 'dritter Klick');
  assert.equal(b.coe, 15);
  assert.ok(near(b.wacc, ctrlWacc(15)), 'bestehende Regel von deriveCostOfCapital: ' + b.wacc);
  assert.equal(b.usedWacc, b.wacc);
  assert.equal(b.dWacc, b.wacc);
});

test('11b · ohne Beta und ohne Kd (wie CRH): heuristischer WACC bleibt bei manueller CoE stehen (Gegenprobe)', () => {
  const A = noBeta(['cost_of_debt_pretax']);
  const a = A.snapshot();
  A.type('as-coe', 15); A.recalc();
  const b = A.snapshot();
  A.recalc();
  assert.deepEqual(A.snapshot(), b);
  assert.equal(b.coe, 15);
  assert.equal(b.wacc, a.wacc);
  assert.equal(b.waccFlag, 'heuristic');
  assert.equal(b.usedWacc, a.wacc);
});

test('10 · Quelltext: Herkunft „manual“ steht vor deriveCostOfCapital (Aufrufreihenfolge)', () => {
  const src = loadApp().run('recalcFromAssumptions.toString()');
  const flagCoe = src.indexOf("mj.valuation._derivationFlags.cost_of_equity_derived = 'manual'");
  const flagWacc = src.indexOf("mj.valuation._derivationFlags.wacc_derived = 'manual'");
  const derive = src.indexOf('deriveCostOfCapital(mj)');
  assert.ok(flagCoe > 0 && derive > 0 && flagCoe < derive, 'CoE-Flag vor der Ableitung');
  assert.ok(flagWacc > 0 && flagWacc < derive, 'WACC-Flag vor der Ableitung');
});
