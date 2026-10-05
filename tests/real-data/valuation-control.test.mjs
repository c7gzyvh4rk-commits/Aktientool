// ─────────────────────────────────────────────────────────────────────────────
// V1.0.85 · valuation-control.mjs vergleicht die sechs Ergebnisse (Altman Z″,
// Piotroski, g1, Sicherheitsabschlag, Einstiegs- und tiefer Pruefpreis) mit der
// AKTUELLEN Replay-Erfassung (fy.valuationResults), nicht mit dem historischen
// valuationControl.engineObserved.
//
// Befund des Nachreviews: bis V1.0.84 stand auf der Ist-Seite dieser sechs Zeilen
// ein fest eingetragener Wert aus evidence/CRH.json — eine Aenderung der Engine
// konnte den Vergleich nicht mehr rot machen.
//
// Gegenstand ist die echte Vergleichslogik (computeControl, checkCapture,
// compareCapture). Ist-Seite: Teilmenge eines echten CRH-Replay-Berichts
// (fixtures/valuation-control-capture.json, erzeugt mit
// fixtures/make-valuation-control-capture.mjs). Soll-Seite: Belegwerte aus
// evidence/CRH.json; deren Pruefung gegen das Original-iXBRL leistet
// evidence.mjs/valuation-control.mjs im Realdatenlauf (Cache nicht im Repo).
// Toleranzen kommen unveraendert aus evidence/CRH.json.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeControl, checkCapture, compareCapture, CURRENT_RESULT_KEYS } from './valuation-control.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EV = JSON.parse(readFileSync(join(HERE, 'evidence', 'CRH.json'), 'utf8'));
const CAP = JSON.parse(readFileSync(join(HERE, 'fixtures', 'valuation-control-capture.json'), 'utf8'));
const VC = EV.valuationControl;
const byId = Object.fromEntries(EV.items.map(i => [i.id, i.value]));
const v = (id) => { if (!(id in byId)) throw new Error('Beleg ' + id + ' fehlt'); return byId[id]; };
const C = computeControl(v, VC);
const fresh = () => JSON.parse(JSON.stringify(CAP));
const run = (rep, vc = VC) => compareCapture(C, rep, vc, 'CRH');
const row = (R, key) => R.rows.find(r => r.key === key);

test('0 · Toleranzen unveraendert (Beleg)', () => {
  assert.deepEqual(VC.tolerances, { relPerShare: 1e-4, reverseGrowthPp: 0.05, entryPrice: 0.01 });
});

test('1 · vollstaendige, passende aktuelle Erfassung ⇒ erfolgreich', () => {
  const R = run(fresh());
  assert.deepEqual(R.captureIssues, []);
  assert.deepEqual(R.failed.map(r => r.label), []);
  assert.equal(R.ok, true);
  for (const k of CURRENT_RESULT_KEYS) {
    const r = row(R, k);
    assert.ok(r, k);
    assert.equal(r.eng, CAP.fy.valuationResults[k], k + ' stammt aus der aktuellen Erfassung');
  }
});

// Abweichung knapp ausserhalb der jeweiligen Toleranz (Piotroski: ganzzahlig, Toleranz 0).
const OUTSIDE = { altmanZ: 1e-6, piotroski: 1, g1: 0.006, mosTotal: 1e-9, entryPrice: 0.011, deepValuePrice: 0.011 };

test('2 · jeder der sechs Werte ausserhalb der Toleranz ⇒ Fehlschlag (beide Richtungen)', () => {
  for (const k of CURRENT_RESULT_KEYS) for (const sgn of [1, -1]) {
    const rep = fresh();
    rep.fy.valuationResults[k] += sgn * OUTSIDE[k];
    const R = run(rep);
    assert.equal(R.ok, false, k + ' ' + sgn);
    assert.deepEqual(R.failed.map(r => r.key), [k], k + ': genau diese Zeile rot');
    assert.equal(row(R, k).missing, false);
  }
});

test('2b · innerhalb der Toleranz bleibt gruen (Gegenprobe, Toleranz nicht verschaerft)', () => {
  const INSIDE = { altmanZ: 1e-10, g1: 0.004, mosTotal: 1e-13, entryPrice: 0.009, deepValuePrice: 0.009 };
  for (const [k, d] of Object.entries(INSIDE)) {
    const rep = fresh(); rep.fy.valuationResults[k] += d;
    assert.equal(run(rep).ok, true, k);
  }
});

test('3 · fehlender oder nicht endlicher Wert ⇒ fehlender Nachweis (keine Ersatznull)', () => {
  for (const k of CURRENT_RESULT_KEYS) for (const bad of [undefined, null, NaN, '51.08']) {
    const rep = fresh();
    if (bad === undefined) delete rep.fy.valuationResults[k]; else rep.fy.valuationResults[k] = bad;
    const R = run(rep);
    assert.equal(R.ok, false, k + ' ' + bad);
    const r = row(R, k);
    assert.equal(r.missing, true, k);
    assert.equal(r.eng, null, k + ': kein Ersatzwert');
  }
});

test('4 · historische engineObserved-Werte verdecken keinen Fehler', () => {
  // Historische Werte sind vorhanden und passen exakt zur Kontrolle …
  for (const k of CURRENT_RESULT_KEYS) assert.ok(typeof VC.engineObserved[k] === 'number', k);
  // … trotzdem: aktueller Wert fehlt ⇒ rot.
  for (const k of CURRENT_RESULT_KEYS) {
    const rep = fresh(); delete rep.fy.valuationResults[k];
    const R = run(rep);
    assert.equal(R.ok, false, k);
    assert.notEqual(row(R, k).eng, VC.engineObserved[k], k + ': kein Rueckfall');
  }
  // Ganze Erfassung fehlt (Bericht vor V1.0.85) ⇒ rot, alle sechs fehlen.
  const rep = fresh(); delete rep.fy.valuationResults;
  const R = run(rep);
  assert.equal(R.ok, false);
  assert.deepEqual(R.failed.filter(r => r.key).map(r => r.key).sort(), CURRENT_RESULT_KEYS.slice().sort());
  assert.ok(R.captureIssues.some(i => /valuationResults fehlt/.test(i)));
  // Aktuell abweichend, historisch passend ⇒ rot.
  const rep2 = fresh(); rep2.fy.valuationResults.entryPrice = VC.engineObserved.entryPrice + 5;
  assert.equal(run(rep2).ok, false);
  // engineObserved manipuliert, aktuelle Erfassung passend ⇒ weiterhin gruen (historisch wird nicht verglichen).
  const vc2 = JSON.parse(JSON.stringify(VC));
  for (const k of CURRENT_RESULT_KEYS) vc2.engineObserved[k] = -999;
  assert.equal(run(fresh(), vc2).ok, true);
});

test('5 · unpassende Erfassungsmetadaten ⇒ Fehlschlag', () => {
  const cases = {
    'falscher Ticker': (r) => { r.ticker = 'MCD'; },
    'kein Import': (r) => { r.imported = false; },
    'Selbsttest': (r) => { r.selftest = true; },
    'Commit fehlt': (r) => { delete r.commit; },
    'Commit kein SHA': (r) => { r.commit = 'b3f0c1e'; },
    'Produkt-Hash fehlt': (r) => { delete r.productSha256; },
    'Produktdatei lokal geaendert': (r) => { r.productFileChanged = 'ja'; },
    'Produktdatei unbekannt': (r) => { delete r.productFileChanged; },
    'Basis TTM angefordert': (r) => { r.fy.basis.requested = 'ttm'; },
    'Basis TTM verwendet': (r) => { r.fy.basis.selected = 'ttm'; r.fy.valuationResults.inputs.dataBasisSelected = 'ttm'; },
    'Basis in Erfassung abweichend': (r) => { r.fy.valuationResults.inputs.dataBasisSelected = 'ttm'; },
    'Kurs-Annahme abweichend': (r) => { r.priceAssumption = 90; },
    'Kurs im Zustand abweichend': (r) => { r.fy.valuationResults.inputs.price = 90; },
    'Kurs fehlt': (r) => { r.fy.valuationResults.inputs.price = null; },
    'WACC abweichend': (r) => { r.fy.valuationResults.inputs.wacc = 8.5; },
    'CoE abweichend': (r) => { r.fy.valuationResults.inputs.coe = 11; },
    'g_T abweichend': (r) => { r.fy.valuationResults.inputs.growthTerminal = 3; },
    'Schritt fy fehlt': (r) => { delete r.fy; }
  };
  for (const [name, mut] of Object.entries(cases)) {
    const rep = fresh(); mut(rep);
    const R = run(rep);
    assert.equal(R.ok, false, name);
    assert.ok(R.captureIssues.length > 0, name + ': als unpassende Erfassung gemeldet');
  }
  assert.ok(checkCapture(null, VC, 'CRH').length > 0, 'kein Bericht');
});

test('6 · erwartete Datenbasis aus dem Beleg (expectedCapture), Default fy', () => {
  assert.equal((VC.expectedCapture || {}).dataBasis || 'fy', 'fy');
  const vc = JSON.parse(JSON.stringify(VC)); vc.expectedCapture = { dataBasis: 'ttm' };
  assert.ok(checkCapture(fresh(), vc, 'CRH').some(i => /Datenbasis/.test(i)));
});

test('7 · Sollseite unabhaengig: Aenderung der Erfassung aendert die Kontrolle nicht', () => {
  const rep = fresh();
  for (const k of CURRENT_RESULT_KEYS) rep.fy.valuationResults[k] = 0;
  const R = run(rep);
  for (const k of CURRENT_RESULT_KEYS) assert.equal(row(R, k).ctrl, row(run(fresh()), k).ctrl, k);
  assert.equal(R.ok, false);
});
