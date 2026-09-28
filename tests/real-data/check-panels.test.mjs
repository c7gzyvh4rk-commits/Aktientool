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

// ── D3-Vorbereitung: Diagnosemodelle (MCD-Fall) ───────────────────────────
// Die Engine rechnet ein Diagnosemodell (Router `diagnosticModels`), das
// Produkt zeigt es sichtbar, aber ungewichtet. Die Karte unten ist der
// wortgetreue Text der Bewertungsansicht aus dem MCD-Replay (V1.0.73).
const DIAG_CARD = '\nDDM\nDDM DIAGNOSTISCH\nBase\n108.90\nDiagnosemodell — nicht gewichtet, kein Fair Value; fließt nicht in Range oder Buy Price.\n';
const withDiag = (card) => {
  const c = cap('fy');
  c.router = { activeModels: ['dcf', 'rim'], diagnosticModels: ['ddm'] };
  c.models = Object.assign({}, c.models, { ddm: { base: 108.90190445495523 } });
  c.panels.valuation += card;
  return c;
};

test('Diagnosemodell mit Wert und Kennzeichnung besteht', () => {
  const res = checkPanels(withDiag(DIAG_CARD));
  assert.deepEqual(failed(res), []);
  assert.ok(res.some(x => x.ok && /Diagnosemodell ddm/.test(x.name)), 'Rollenpruefung gelaufen');
});

test('Diagnosemodell fehlt in der Ansicht: schlaegt fehl (keine Ausnahme)', () => {
  const res = checkPanels(withDiag(''));
  assert.ok(failed(res, /Basiswert ddm\b/).length > 0);
  assert.ok(failed(res, /Diagnosemodell ddm/).length > 0);
});

test('Diagnosemodell mit falschem Wert schlaegt fehl', () => {
  const res = checkPanels(withDiag(DIAG_CARD.replace('108.90', '108.91')));
  assert.ok(failed(res, /Basiswert ddm\b/).length > 0);
  assert.ok(failed(res, /Diagnosemodell ddm/).length > 0);
});

test('Diagnosemodell als aktives Kernmodell dargestellt schlaegt fehl', () => {
  const res = checkPanels(withDiag('\nDDM\nAKTIV\ncons\n90.00\nbase\n108.90\nopt\n120.00\n'));
  assert.deepEqual(failed(res, /Basiswert ddm\b/), [], 'Wert selbst stimmt');
  assert.ok(failed(res, /Diagnosemodell ddm/).length > 0, 'Rolle falsch');
});

test('Kennzeichnung bei einem anderen Modell zaehlt nicht fuer ddm', () => {
  const res = checkPanels(withDiag('\nEPV_FLOOR\nDIAGNOSTISCH\n\nDDM\nAKTIV\nbase\n108.90\n'));
  assert.ok(failed(res, /Diagnosemodell ddm/).length > 0);
});

test('aktives Modell (auch in diagnosticModels) braucht keine Diagnosekennzeichnung', () => {
  const c = withDiag('\nDDM\nAKTIV\nbase\n108.90\n');
  c.router.activeModels.push('ddm');
  assert.deepEqual(failed(checkPanels(c)), []);
});

// ── D3-Vorbereitung: Periode der Basis im Markt-Vergleich (JNJ-Fall) ──────
test('Markt-Vergleich ohne Periode (Stand vor V1.0.73) schlaegt fehl', () => {
  const c = cap('fy');
  c.market.basisPeriod = null;
  c.panels.market = c.panels.market.replace('LETZTES GESCHÄFTSJAHR (FY) · 2024-12-31', 'LETZTES GESCHÄFTSJAHR (FY)');
  assert.ok(failed(market(checkPanels(c)), /Periode der verwendeten Basis/).length > 0);
});

test('veraltete Periode im Markt-Vergleich schlaegt fehl, auch wenn Engine-Erwartung und Anzeige uebereinstimmen', () => {
  const c = cap('fy');
  c.market.basisPeriod = '2023-12-31';
  c.panels.market = c.panels.market.replace('· 2024-12-31', '· 2023-12-31');
  assert.ok(failed(market(checkPanels(c)), /Periode der verwendeten Basis/).length > 0);
});

test('Engine-Erwartung richtig, Anzeige ohne Periode: schlaegt fehl', () => {
  const c = cap('fy');
  c.panels.market = c.panels.market.replace('LETZTES GESCHÄFTSJAHR (FY) · 2024-12-31', 'LETZTES GESCHÄFTSJAHR (FY)');
  assert.ok(failed(market(checkPanels(c))).length > 0);
});

// ── D3-3: Uebersicht gegen den Sperrgrund der Synthese ───────────────────
const blockedCap = (overview, hardStops = []) => {
  const c = cap('fy');
  c.synthesis = { position: 'blocked', status: 'ok', blockReason: 'Kein Kurs verfügbar — SEC-Import ohne Yahoo (oder Yahoo fehlgeschlagen).' };
  c.quality = { hardStops };
  c.panels.overview = overview;
  return c;
};
const ovFailed = (res) => res.filter(x => !x.ok && x.name.startsWith('overview:'));

test('D3-3 gesperrte Synthese: Uebersicht mit dem Engine-Grund besteht', () => {
  const res = checkPanels(blockedCap('Bewertung gesperrt\nBewertung blockiert: Kein Kurs verfügbar — SEC-Import ohne Yahoo.\nKein Ausschlusskriterium aktiv.'));
  assert.deepEqual(ovFailed(res), []);
  assert.ok(res.some(x => x.ok && /Sperrgrund der Synthese/.test(x.name)));
});

test('D3-3 „Hard Stop aktiv“ ohne aktiven Hard Stop schlaegt fehl (Fall V1.0.73)', () => {
  const res = checkPanels(blockedCap('Bewertung blockiert: Hard Stop aktiv — siehe Quality-Tab für Details.\nDie Bewertung ist gesperrt — es liegt kein belastbarer Eigenkapitalwert vor.'));
  const f = ovFailed(res).map(x => x.name);
  assert.ok(f.includes('overview: keine Hard-Stop-Begruendung ohne aktiven Hard Stop'), JSON.stringify(f));
  assert.ok(f.includes('overview: Sperrgrund der Synthese sichtbar'), JSON.stringify(f));
});

test('D3-3 aktiver Hard Stop darf genannt werden', () => {
  const c = blockedCap('Bewertung blockiert: Going Concern aktiv. Kein Kurs verfügbar', [{ id: 'going_concern', triggered: true, overridden: false }]);
  assert.deepEqual(ovFailed(checkPanels(c)), []);
});
