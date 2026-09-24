// ═══════════════════════════════════════════════════════════════════════════
// Regressionstests fuer checkPanels() aus tests/real-data/replay-import.mjs
// ───────────────────────────────────────────────────────────────────────────
// Start:  npm run test:audit-tool   (zusammen mit den Browser-Tests)
//         node --test tests/real-data/check-panels.test.mjs   (ohne Browser)
//
// Geprueft wird die Pruefunktion des Werkzeugs selbst (Import, kein Nachbau).
// Ausgangspunkt sind zwei echte Erfassungen (fixtures/check-panels-captures.json,
// aus replay-import.mjs --selftest). Die Fehlerfaelle veraendern gezielt den
// erfassten Anzeigetext oder die erfasste Engine-Erwartung.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPanels } from './replay-import.mjs';

const FX = JSON.parse(readFileSync(new URL('./fixtures/check-panels-captures.json', import.meta.url), 'utf8'));
const cap = (step) => structuredClone(FX[step]);
const failed = (res, re) => res.filter(x => !x.ok && (!re || re.test(x.name)));
const market = (res) => res.filter(x => x.name.startsWith('market:'));

const RIM = FX.ttm.basis.blocked_models.find(b => b.model === 'rim').reason;
const DDM = FX.ttm.basis.blocked_models.find(b => b.model === 'ddm').reason;
const EMPTY_HERO = 'Noch kein Markt-Vergleich\nMaster-JSON importieren.';

// ── Gegenfaelle ───────────────────────────────────────────────────────────
test('echte FY- und TTM-Erfassung bestehen vollstaendig', () => {
  for (const step of ['fy', 'ttm']) {
    const res = checkPanels(cap(step));
    assert.deepEqual(failed(res), [], step);
    assert.ok(market(res).length >= 3, step + ': Marktpruefungen gelaufen');
  }
});

test('berechtigter Leerzustand „keine eigenen Multiples“ besteht mit Grund', () => {
  const c = cap('ttm');
  assert.equal(c.market.rows.length, 0);
  const res = checkPanels(c);
  assert.ok(res.some(x => x.ok && /keine Multiples|Leerzustand/i.test(x.name)), JSON.stringify(market(res)));
});

test('berechtigte Sperre der Datenbasis: Marktansicht mit dem Engine-Grund besteht', () => {
  const c = cap('ttm');
  const reason = 'Die gespeicherte Bewertung beruht auf der Datenbasis "Letztes Geschäftsjahr (FY)", aktuell ausgewaehlt ist "TTM (letzte vier Quartale)". Bitte neu berechnen.';
  c.market = Object.assign({}, c.market, { basisBlocked: true, basisReason: reason, basisPeriod: null });
  c.panels.market = 'MARKT-VERGLEICH\nKEIN FAIR VALUE\n⚠ ' + reason.toUpperCase().replace(/ /g, '\n');
  assert.deepEqual(failed(market(checkPanels(c))), []);
  c.panels.market = 'MARKT-VERGLEICH\nKEIN FAIR VALUE\n⚠ Datenbasis nicht aufloesbar.';
  assert.ok(failed(market(checkPanels(c))).length > 0, 'anderer Sperrgrund darf nicht bestehen');
});

test('Sperrgrund mit anderem Leerraum und anderer Grossschreibung besteht', () => {
  const c = cap('ttm');
  c.panels.valuation = c.panels.valuation.replace('rim: ' + RIM, 'RIM:\n   ' + RIM.toUpperCase().replace(/ /g, '  \n'));
  assert.deepEqual(failed(checkPanels(c)), []);
});

// ── Fehlerfaelle: Marktansicht ───────────────────────────────────────────
test('leeres Marktpanel schlaegt fehl', () => {
  for (const t of ['', '   \n  ']) {
    const c = cap('ttm');
    c.panels.market = t;
    assert.ok(failed(market(checkPanels(c))).length > 0, JSON.stringify(t));
  }
});

test('fehlendes Marktpanel schlaegt fehl', () => {
  const c = cap('ttm');
  delete c.panels.market;
  assert.ok(failed(market(checkPanels(c))).length > 0);
});

test('unerwarteter Inhalt statt Markt-Vergleich schlaegt fehl', () => {
  for (const t of [EMPTY_HERO, 'TypeError: Cannot read properties of undefined', FX.fy.panels.valuation]) {
    const c = cap('ttm');
    c.panels.market = t;
    assert.ok(failed(market(checkPanels(c))).length > 0, t.slice(0, 40));
  }
});

test('fehlende Engine-Erwartung fuer den Markt-Vergleich schlaegt fehl', () => {
  const c = cap('ttm');
  delete c.market;
  assert.ok(failed(market(checkPanels(c))).length > 0);
});

test('Leerzustand ohne Grund: Engine hat Zeilen, Ansicht meldet keine Multiples', () => {
  const c = cap('ttm');
  c.market.rows = [{ id: 'ev_ebitda_10y', available: true, base: 16 }];
  assert.ok(failed(market(checkPanels(c))).length > 0);
  // Gegenfall: Zeile mit dem Engine-Wert sichtbar.
  c.panels.market = c.panels.market.replace(/Keine eigenen Multiples-Mediane[^\n]*/,
    'Impliziter Preis bei eigenem EV/EBITDA-Median (10.0x)\n16.00');
  assert.deepEqual(failed(market(checkPanels(c))), []);
  c.panels.market = c.panels.market.replace('16.00', '17.00');
  assert.ok(failed(market(checkPanels(c))).length > 0, 'falscher Zeilenwert');
});

// ── Fehlerfaelle: Modellsperren ──────────────────────────────────────────
test('fehlender Sperrgrund: nur der Modellname ist sichtbar', () => {
  const c = cap('ttm');
  c.panels.valuation = c.panels.valuation.replace('rim: ' + RIM, 'rim: gesperrt');
  assert.ok(failed(checkPanels(c), /Sperre von rim\b/).length > 0);
});

test('falscher Sperrgrund beim richtigen Modell schlaegt fehl', () => {
  const c = cap('ttm');
  c.panels.valuation = c.panels.valuation.replace('rim: ' + RIM, 'rim: ' + DDM);
  assert.ok(failed(checkPanels(c), /Sperre von rim\b/).length > 0);
});

test('richtiger Grund beim falschen Modell schlaegt fehl', () => {
  const c = cap('ttm');
  // Gruende von rim und ddm vertauscht.
  c.panels.valuation = c.panels.valuation.replace('rim: ' + RIM, 'rim: @@').replace('ddm: ' + DDM, 'ddm: ' + RIM).replace('rim: @@', 'rim: ' + DDM);
  const res = checkPanels(c);
  assert.ok(failed(res, /Sperre von rim\b/).length > 0, 'rim');
  assert.ok(failed(res, /Sperre von ddm\b/).length > 0, 'ddm');
});

test('Grund nur unter laengerem Modellnamen (rim_buyback) zaehlt nicht fuer rim', () => {
  const c = cap('ttm');
  c.panels.valuation = c.panels.valuation.replace('rim: ' + RIM + '\n', '');
  assert.ok(c.panels.valuation.includes('rim_buyback: ' + RIM));
  assert.ok(failed(checkPanels(c), /Sperre von rim\b/).length > 0);
});
