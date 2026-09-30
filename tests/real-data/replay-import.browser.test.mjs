// ═══════════════════════════════════════════════════════════════════════════
// Regressionstests fuer das Auditwerkzeug tests/real-data/replay-import.mjs
// ───────────────────────────────────────────────────────────────────────────
// Start:  npm run test:audit-tool
//         (= node --test tests/real-data/replay-import.browser.test.mjs)
//
// Braucht ein lokales Chromium/Chrome (wie npm run test:browser) und gehoert
// deshalb NICHT zu npm test. Geprueft wird der echte Erfassungscode: Das
// Skript laeuft als eigener Prozess gegen SYNTHETISCHE SEC-Dateien in einem
// temporaeren Verzeichnis (frisches Browserprofil, keine externen Abrufe) und
// schreibt seinen Bericht; die Tests lesen nur diesen Bericht.
//
// REPLAY_SCRIPT=<pfad> fuehrt dieselben Tests gegen eine andere Fassung des
// Skripts aus (z. B. den Stand vor D1), um zu zeigen, dass sie die alten
// Fehler erkennen.
//
// Datensaetze:
//   SYNTR — Quartalsdaten bis Q3 2025 (tests/browser/fixtures.mjs → ttmFacts):
//           FY 2024: Umsatz 1000, EBITDA 250, Ende 2024-12-31;
//           TTM:     Umsatz 1375, EBITDA 343,75, Ende 2025-09-30.
//   SYNTN — dieselben Jahreswerte, aber nur 10-K-Angaben: keine TTM-Basis.
// ═══════════════════════════════════════════════════════════════════════════
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findChrome } from '../browser/cdp.mjs';
import { ttmFacts } from '../browser/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(process.env.REPLAY_SCRIPT || join(HERE, 'replay-import.mjs'));
const FY_LABEL = 'Letztes Geschäftsjahr (FY)';
const TTM_LABEL = 'TTM (letzte vier Quartale)';
const U = (s) => String(s == null ? '' : s).toLocaleUpperCase('de-DE');

let work;
const reports = {};

function writeFiler(dir, cik, ticker, facts) {
  writeFileSync(join(dir, 'company_tickers_exchange.json'), JSON.stringify({
    fields: ['cik', 'name', 'ticker', 'exchange'], data: [[Number(cik), 'Synthetik ' + ticker + ' AG', ticker, 'NYSE']] }));
  writeFileSync(join(dir, `CIK${cik}.companyfacts.json`), JSON.stringify({ cik: Number(cik), entityName: 'Synthetik ' + ticker + ' AG', facts }));
  writeFileSync(join(dir, `CIK${cik}.submissions.json`), JSON.stringify({ sic: '3674', fiscalYearEnd: '1231', exchanges: ['NYSE'] }));
}

// Nur Jahresangaben (10-K) — Quartale fehlen, eine TTM-Basis ist nicht bildbar.
// Die Aktienangaben der 10-K-Zeilen sind in ttmFacts Quartalsdurchschnitte;
// hier werden sie zu Jahresdurchschnitten (gleicher Wert, ganzes Jahr).
function annualOnlyFacts() {
  const f = ttmFacts();
  for (const concept of Object.values(f['us-gaap'])) {
    for (const [unit, rows] of Object.entries(concept.units)) {
      concept.units[unit] = rows.filter(r => r.form === '10-K').map(r =>
        unit === 'shares' ? Object.assign({}, r, { start: r.end.slice(0, 4) + '-01-01' }) : r);
    }
  }
  return f;
}

function runReplay(ticker, facts, cik) {
  const dir = mkdtempSync(join(work, ticker + '-'));
  writeFiler(dir, cik, ticker, facts);
  const out = join(dir, 'report.json');
  const r = spawnSync(process.execPath, [SCRIPT, ticker, '--data', dir, '--price', '25', '--out', out],
    { encoding: 'utf8', timeout: 240000 });
  if (!existsSync(out)) throw new Error('Kein Bericht (Exit ' + r.status + '):\n' + r.stdout + r.stderr);
  return { exit: r.status, stdout: r.stdout, report: JSON.parse(readFileSync(out, 'utf8')) };
}

// Zugriffe, die auch das Berichtsformat vor D1 lesen koennen — damit ein Lauf
// gegen den alten Stand an den INHALTEN scheitert, nicht nur am Format.
const val0 = (rec) => rec ? (rec.value !== undefined ? rec.value : (Array.isArray(rec.values) ? rec.values[0] : rec.values)) : undefined;
const end0 = (rec) => rec ? ((rec.period && rec.period.end) || (rec.periods && rec.periods[0]) || null) : undefined;
const panel = (r, cap, name) => {
  const c = r[cap];
  if (c && c.panels) return c.panels[name];
  return cap === 'ttmView' && r.panels ? r.panels[name] : undefined;
};
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;

before(() => {
  if (!findChrome()) throw new Error('NICHT AUSGEFUEHRT: kein Chromium/Chrome (CHROME_PATH setzen).');
  work = mkdtempSync(join(tmpdir(), 'aktientool-replay-test-'));
  reports.ttm = runReplay('SYNTR', ttmFacts(), '0000000999');
  reports.none = runReplay('SYNTN', annualOnlyFacts(), '0000000998');
});
after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

test('Lauf vollstaendig, ohne externe Abrufe ausser abgewiesenen', () => {
  for (const k of ['ttm', 'none']) {
    const { exit, report: r, stdout } = reports[k];
    assert.equal(r.error, undefined, k + ': ' + r.error);
    assert.equal(r.imported, true, k);
    assert.equal(exit, 0, k + ': Exit ' + exit + '\n' + stdout.split('\n').filter(l => /ABWEICHUNG|FEHLER/.test(l)).join('\n'));
    assert.ok(r.served.every(s => !s.missing && /sec\.gov/.test(s.url)), k + ': nur synthetische SEC-Dateien bedient');
    assert.ok(r.rejected.every(u => !/sec\.gov|sec-replay/.test(u)), k + ': abgewiesen nur Fremdanfragen');
  }
});

test('FY-Erfassung: bekannte Jahreswerte und Perioden', () => {
  const f = reports.ttm.report.fy.fields;
  assert.equal(val0(f.revenue), 1000);
  assert.equal(val0(f.ebitda), 250);
  assert.equal(end0(f.revenue), '2024-12-31');
  assert.equal(end0(f.ebitda), '2024-12-31');
  assert.equal(reports.ttm.report.fy.basis.selected, 'fy');
  assert.equal(f.revenue.provenance.tag, 'Revenues');
  assert.equal(f.revenue.unit.reporting, 'millions');
});

test('TTM-Erfassung: Werte, Perioden und Herkunft der tatsaechlichen TTM-Basis', () => {
  const c = reports.ttm.report.ttmView;
  const f = c.fields;
  assert.ok(near(val0(f.revenue), 1375), 'Umsatz TTM: ' + val0(f.revenue));
  assert.ok(near(val0(f.ebitda), 343.75), 'EBITDA TTM: ' + val0(f.ebitda));
  assert.equal(end0(f.revenue), '2025-09-30');
  assert.equal(end0(f.ebitda), '2025-09-30');
  assert.equal(c.basis && c.basis.selected, 'ttm');
  assert.equal(c.basis.ttm_used, true);
  // Komponentenperioden und Herkunft der Stromgroesse.
  assert.deepEqual(f.revenue.components.quarters, ['FY2024-Q4', 'FY2025-Q1', 'FY2025-Q2', 'FY2025-Q3']);
  assert.equal(f.revenue.components.start, '2024-10-01');
  assert.equal(f.revenue.provenance.tag, 'Revenues');
  assert.deepEqual(f.revenue.provenance.filed, ['2025-11-01']);
  assert.equal(f.revenue.concept, 'Stromgroesse');
  // Abgeleitete Groesse: Bestandteile aus denselben TTM-Fenstern.
  assert.deepEqual(f.ebitda.components.derivedFrom.map(x => [x.field, x.end]), [['ebit', '2025-09-30'], ['da', '2025-09-30']]);
  // Bilanzstichtag statt Zeitraum.
  assert.equal(f.total_debt.concept, 'Stichtag');
  assert.equal(f.total_debt.components.asOf, '2025-09-30');
  // Aktienbegriffe getrennt: gewichteter TTM-Durchschnitt vs. Stichtagszahl.
  assert.equal(c.shareConcepts.weightedAverage.method, 'day_weighted_mean_of_quarterly_weighted_average');
  assert.equal(c.shareConcepts.currentOutstanding.asOf, '2025-09-30');
  assert.equal(f.shares_diluted.components.quarters.length, 4);
  // Keine FY-Periode und keine FY-Metadaten an TTM-Werten.
  for (const [k, rec] of Object.entries(f)) {
    if (rec.value == null) continue;
    assert.notEqual(rec.period.end, '2024-12-31', k + ' traegt die FY-Periode');
    assert.equal(rec.basis, 'ttm', k);
    if (rec.provenance) assert.ok(!/^SEC EDGAR XBRL:/.test(rec.provenance.source_reference || ''), k + ' traegt FY-Herkunft');
  }
  // Ohne TTM-Wert: geleert, nicht mit dem Jahreswert aufgefuellt.
  assert.equal(val0(f.book_value), null);
  assert.match(f.book_value.status, /geleert/);
});

test('Ansichten: Texte stimmen mit der jeweiligen Berechnungsbasis ueberein', () => {
  const r = reports.ttm.report;
  const fyVal = panel(r, 'fy', 'valuation'), ttmVal = panel(r, 'ttmView', 'valuation');
  const fyMk = panel(r, 'fy', 'market'), ttmMk = panel(r, 'ttmView', 'market');
  assert.ok(U(ttmMk).includes(U(TTM_LABEL + ' · 2025-09-30')), 'TTM-Marktansicht nennt TTM: ' + String(ttmMk).replace(/\s+/g, ' ').trim().slice(0, 90));
  assert.ok(!U(ttmMk).includes(U(FY_LABEL)), 'TTM-Marktansicht enthaelt noch die FY-Basis');
  assert.ok(U(ttmVal).includes(U(TTM_LABEL)), 'TTM-Bewertungsansicht nennt TTM');
  assert.ok(ttmVal.includes('2024-10-01 – 2025-09-30'), 'TTM-Zeitraum in der Bewertungsansicht');
  assert.ok(U(fyVal).includes(U(FY_LABEL)) && fyVal.includes('2024-12-31'), 'FY-Bewertungsansicht');
  assert.ok(U(fyMk).includes(U(FY_LABEL + ' · 2024-12-31')), 'FY-Marktansicht');
  // Sichtbare Modellwerte = Ergebnisse der jeweiligen Berechnung, und die
  // Ergebnisse unterscheiden sich sichtbar.
  const dcfFy = r.fy.models.dcf.base, dcfTtm = r.ttmView.models.dcf.base;
  assert.ok(typeof dcfFy === 'number' && typeof dcfTtm === 'number');
  assert.notEqual(dcfFy.toFixed(2), dcfTtm.toFixed(2));
  assert.ok(fyVal.includes(dcfFy.toFixed(2)) && !fyVal.includes(dcfTtm.toFixed(2)), 'FY-DCF sichtbar');
  assert.ok(ttmVal.includes(dcfTtm.toFixed(2)) && !ttmVal.includes(dcfFy.toFixed(2)), 'TTM-DCF sichtbar, FY-DCF nicht');
  const gFy = r.fy.reverseDcf.impliedGrowth.toFixed(1) + '%', gTtm = r.ttmView.reverseDcf.impliedGrowth.toFixed(1) + '%';
  assert.notEqual(gFy, gTtm);
  assert.ok(fyMk.includes(gFy) && ttmMk.includes(gTtm), 'Reverse DCF je Basis');
  // Der Abgleich des Werkzeugs selbst ist vollstaendig bestanden.
  assert.ok(Array.isArray(r.checks) && r.checks.length > 0);
  assert.deepEqual(r.checks.filter(x => !x.ok), []);
});

test('FY → TTM → FY: keine veralteten Eingaben oder Anzeigen', () => {
  const r = reports.ttm.report;
  assert.ok(r.fyReturn, 'Rueckweg auf FY erfasst');
  assert.equal(r.fyReturn.basis.selected, 'fy');
  for (const [k, rec] of Object.entries(r.fy.fields)) {
    assert.deepEqual(r.fyReturn.fields[k].values, rec.values, k);
    assert.deepEqual(r.fyReturn.fields[k].period, rec.period, k);
  }
  assert.deepEqual(r.fyReturn.models, r.fy.models);
  for (const p of ['valuation', 'market', 'assumptions']) {
    assert.equal(r.fyReturn.panels[p], r.fy.panels[p], p);
    assert.ok(!U(r.fyReturn.panels[p]).includes(U(TTM_LABEL + ' ·')), p + ' traegt noch die TTM-Basis');
  }
});

test('TTM nicht verfuegbar: Rueckfall wird ausgewiesen, nicht als TTM gemeldet', () => {
  const c = reports.none.report.ttmView;
  assert.ok(c && c.basis, 'Schritt „TTM angefordert“ erfasst');
  assert.equal(c.basis.requested, 'ttm');
  assert.equal(c.basis.selected, 'fy');
  assert.equal(c.basis.ttm_used, false);
  assert.equal(c.basis.ttm_available, false);
  assert.equal(c.basis.fallback.active, true);
  assert.ok(c.basis.fallback.reasons.length > 0);
  assert.equal(c.fields.revenue.basis, 'fy');
  assert.equal(val0(c.fields.revenue), 1000);
  assert.equal(end0(c.fields.revenue), '2024-12-31');
  assert.ok(U(c.panels.valuation).includes(U(FY_LABEL)), 'Ansicht nennt die tatsaechlich verwendete FY-Basis');
  assert.ok(!U(c.panels.market).includes(U(TTM_LABEL)), 'Marktansicht behauptet keine TTM-Basis');
  assert.ok(reports.none.report.checks.some(x => /Rueckfall mit Grund/.test(x.name) && x.ok));
});

test('FY-Ausgangsdaten werden durch die Erfassung nicht veraendert', () => {
  for (const k of ['ttm', 'none']) {
    const i = reports[k].report.integrity;
    assert.ok(i && i.fundamentalsSha256AfterImport, k);
    assert.equal(i.fundamentalsSha256AtEnd, i.fundamentalsSha256AfterImport, k);
  }
  const p = reports.ttm.report.pendingMasterJson.fundamentals;
  assert.deepEqual(reports.ttm.report.fyReturn.fields.revenue.values, p.revenue.slice(0, 3));
});
