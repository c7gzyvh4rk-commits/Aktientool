#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Browser-Abnahme (Folgechat B) — synthetische Daten, echter Browser
// ───────────────────────────────────────────────────────────────────────────
// Start:   npm run test:browser        (= node tests/browser/acceptance.mjs)
// Braucht: Node >= 22, lokales Chromium/Chrome (CHROME_PATH oder
//          /opt/pw-browsers/chromium, /usr/bin/chromium, google-chrome …).
// Exit:    0 = alle Pruefungen bestanden · 1 = mindestens eine Pruefung
//          fehlgeschlagen · 2 = Abnahme konnte nicht laufen (kein Browser,
//          Startfehler). Jede Pruefung erscheint als PASS/FAIL-Zeile.
//
// Die Produktdatei wird als file://-Dokument geladen. Bedient wird ueber
// echte Eingabeereignisse des Browsers (CDP Input: Mausklicks auf die
// sichtbaren Knoepfe, Tastatureingabe in Textfelder), Datei-Uploads ueber
// die echten <input type=file>-Elemente und echte Downloads. Nur zum
// AUSLESEN und fuer ausdruecklich markierte Zustandseingriffe wird
// Runtime.evaluate verwendet.
//
// Isolation: frisches temporaeres Browserprofil, temporaeres
// Download-Verzeichnis, beides wird geloescht. Keine SEC-/Yahoo-Abrufe;
// jede nicht-lokale Anfrage wird abgewiesen und protokolliert.
//
// Die Daten sind SYNTHETISCH (tests/browser/fixtures.mjs). Eine bestandene
// Abnahme ist KEINE Pruefung echter Unternehmensdaten.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { launch, findChrome } from './cdp.mjs';
import * as FX from './fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const APP = join(ROOT, 'us-aktienbewertungstool-v1036-sector-classification-patch.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Ergebnisprotokoll ─────────────────────────────────────────────────────
const results = [];
let section = '';
function sec(name) { section = name; console.log('\n── ' + name); }
function check(name, ok, detail) {
  results.push({ section, name, ok: !!ok, detail });
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (!ok && detail ? '\n        → ' + String(detail).slice(0, 600) : ''));
  return !!ok;
}

function productState() {
  let commit = 'unbekannt', dirty = 'unbekannt';
  try {
    commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
    dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim() ? 'ja' : 'nein';
  } catch { /* kein git */ }
  return { commit, dirty };
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  if (!findChrome()) {
    console.error('ABNAHME NICHT AUSGEFUEHRT: kein Chromium/Chrome gefunden (CHROME_PATH setzen).');
    process.exit(2);
  }
  const work = mkdtempSync(join(tmpdir(), 'aktientool-browser-work-'));
  const downloads = join(work, 'downloads');
  execSync('mkdir -p ' + JSON.stringify(downloads));
  const b = await launch({ downloadDir: downloads });
  const P = b.page;
  const ps = productState();
  console.log('Browser:      ' + b.version.product + ' (' + b.exe + ')');
  console.log('Produktdatei: ' + APP);
  console.log('Commit:       ' + ps.commit + ' · lokale Aenderungen: ' + ps.dirty);

  // ── Netz, Dialoge, Ausnahmen, Downloads ─────────────────────────────────
  const external = [];
  const dialogs = [];
  const dialogAnswers = [];          // naechste Antworten fuer confirm()
  const exceptions = [];
  const downloadsDone = new Map();   // guid → { name, state }
  P.on('Fetch.requestPaused', async (e) => {
    const u = e.request.url;
    try {
      if (/^(file|data|blob|about):/.test(u)) await P.send('Fetch.continueRequest', { requestId: e.requestId });
      else { external.push(u); await P.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' }); }
    } catch { /* Seite gewechselt */ }
  });
  P.on('Page.javascriptDialogOpening', async (e) => {
    const accept = e.type === 'confirm' ? (dialogAnswers.length ? dialogAnswers.shift() : true) : true;
    dialogs.push({ type: e.type, message: e.message, accept });
    await P.send('Page.handleJavaScriptDialog', { accept });
  });
  P.on('Runtime.exceptionThrown', (e) => {
    const d = e.exceptionDetails || {};
    exceptions.push((d.exception && d.exception.description) || d.text || JSON.stringify(d).slice(0, 300));
  });
  b.browser.on('Browser.downloadWillBegin', (e) => downloadsDone.set(e.guid, { name: e.suggestedFilename, state: 'started' }));
  b.browser.on('Browser.downloadProgress', (e) => {
    const d = downloadsDone.get(e.guid); if (d) d.state = e.state;
  });
  await P.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await P.send('Page.enable');
  await P.send('Runtime.enable');
  await P.send('DOM.enable');
  await P.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

  // ── Hilfen ───────────────────────────────────────────────────────────────
  const ev = async (expr) => {
    const r = await P.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('evaluate: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch { /* Seite laedt */ } await sleep(50); }
    return false;
  };
  const load = async () => {
    await P.send('Page.navigate', { url: pathToFileURL(APP).href });
    await waitFor("document.readyState === 'complete' && typeof state === 'object' && !!document.getElementById('import-master-json')", 15000);
    await sleep(300);
  };
  const reload = async () => {
    await P.send('Page.reload', { ignoreCache: true });
    await sleep(300);
    await waitFor("document.readyState === 'complete' && typeof state === 'object' && !!document.getElementById('import-master-json')", 15000);
    await sleep(300);
  };
  // Echter Mausklick auf das Element, das `findJs` liefert (Ausdruck → Element).
  let markSeq = 0;
  const click = async (findJs, what) => {
    const id = 'acc' + (++markSeq);
    const box = await ev(`(() => { const el = (${findJs}); if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' }); el.setAttribute('data-acc', '${id}');
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
    if (!box || box.w === 0 || box.h === 0) throw new Error('Nicht klickbar/sichtbar: ' + (what || findJs));
    // Pruefen, dass das Element an der Klickposition tatsaechlich oben liegt.
    const top = await ev(`(() => { const e = document.elementFromPoint(${box.x}, ${box.y}); const t = document.querySelector('[data-acc="${id}"]'); return !!(e && t && (e === t || t.contains(e))); })()`);
    if (!top) throw new Error('Element verdeckt: ' + (what || findJs));
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await P.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    await sleep(120);
  };
  const byText = (sel, re) => `Array.from(document.querySelectorAll(${JSON.stringify(sel)})).find(e => ${re}.test(e.textContent) && e.offsetParent !== null)`;
  const tab = async (name) => {
    await click(`document.querySelector('#tabs button[onclick="switchTab(\\'${name}\\')"]')`, 'Tab ' + name);
    await sleep(150);
    return ev(`document.getElementById('panel-${name}').innerText`);
  };
  const panelHtml = (name) => ev(`document.getElementById('panel-${name}').innerHTML`);
  // Echte Tastatureingabe (Input.insertText) in ein Feld.
  const typeInto = async (findJs, text, what) => {
    await click(findJs, what);
    await ev(`(() => { const el = (${findJs}); el.focus(); el.select && el.select(); })()`);
    await P.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await P.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await P.send('Input.insertText', { text });
    await sleep(60);
  };
  const openSettings = async () => {
    const collapsed = await ev(`document.getElementById('settings-card').classList.contains('collapsed')`);
    if (collapsed) await click(`document.querySelector('#settings-card .card-title')`, 'Daten und Einstellungen');
  };
  // Master-JSON ueber die Oberflaeche: Text einfuegen, Knopf klicken.
  const importViaUi = async (obj) => {
    await openSettings();
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    await typeInto(`document.getElementById('import-master-json')`, text, 'Import-Textfeld');
    await click(byText('#settings-card button', '/Importieren/'), 'Importieren & berechnen');
    await sleep(400);
    return ev(`document.getElementById('import-master-status').textContent`);
  };
  const setFile = async (selector, path) => {
    const { root } = await P.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await P.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await P.send('DOM.setFileInputFiles', { nodeId, files: [path] });
    await sleep(500);
  };
  const waitDownload = async (namePart, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      for (const [guid, d] of downloadsDone) {
        if (d.state === 'completed' && d.name.indexOf(namePart) >= 0 && !d.taken) {
          d.taken = true;
          const files = readdirSync(downloads);
          const f = files.find(x => x === guid) || files.find(x => x === d.name);
          if (f) return join(downloads, f);
        }
      }
      await sleep(50);
    }
    return null;
  };
  const snapStore = () => ev(`localStorage.getItem(SNAP_KEY)`);
  const noInjected = async () => ev(`(() => ({
    pwned: typeof window.__pwned !== 'undefined' || typeof window.__accMarker !== 'undefined',
    imgs: document.querySelectorAll('#snap-list img, #panel-journal img').length,
    // Ereignisattribute: in der Snapshot-Liste gar keine; im ganzen Dokument
    // keines, das einen der Marker enthaelt (das statische onchange des
    // Datei-Felds ist Produkt-Markup, kein eingeschleuster Inhalt).
    inline: Array.from(document.querySelectorAll('#snap-list *')).some(e => Array.from(e.attributes).some(a => /^on/i.test(a.name))) ||
            Array.from(document.querySelectorAll('*')).some(e => Array.from(e.attributes).some(a => /^on/i.test(a.name) && /__pwned|__accMarker/.test(a.value))),
    scripts: document.querySelectorAll('#panel-journal script').length
  }))()`);

  const fail = (e) => check('Ablauf ohne Treiberfehler', false, e && e.stack || e);

  try {
    // ══════════════════════════════════════════════════════════════════════
    sec('0 · Start, Isolation, Produktstand');
    await load();
    check('Produktdatei geladen (file://)', await ev(`location.protocol === 'file:' && document.title.indexOf('Aktienbewertungstool') >= 0`));
    check('frisches Profil: kein Snapshot-Bestand, kein Proxy gespeichert',
      await ev(`localStorage.getItem(SNAP_KEY) == null && Object.keys(localStorage).length === 0`),
      await ev(`JSON.stringify(Object.keys(localStorage))`));
    check('Abrufknopf ohne Datenverbindung gesperrt (kein SEC-Abruf moeglich)',
      await ev(`document.getElementById('sec-fetch-btn').disabled === true`));
    check('keine Ausnahme beim Laden', exceptions.length === 0, exceptions.join(' | '));

    // ══════════════════════════════════════════════════════════════════════
    sec('1 · EV/EBITDA-Bruecke: Periodenpruefung je Seite (V1.0.69) und gueltige Kalenderdaten (V1.0.70)');
    const bridgeCases = FX.bridgeCases();
    for (const c of bridgeCases) {
      const status = await importViaUi(c.mj);
      if (!check(c.name + ': Import ueber die Oberflaeche', /Import OK/.test(status), status)) continue;
      const market = await tab('market');
      const mhtml = await panelHtml('market');
      if (c.expect === 'blocked') {
        check(c.name + ': kein freigegebener EV/EBITDA-Preis (kein 16.00/21.00)',
          market.indexOf('16.00') < 0 && market.indexOf('21.00') < 0, market);
        check(c.name + ': Markt-Vergleich zeigt „nicht ableitbar“ mit Sperrgrund',
          /EV\/EBITDA-Median[\s\S]*nicht ableitbar/.test(market) && c.reason.test(market), market);
        check(c.name + ': operativer EV 2500.0M sichtbar (Markt-Vergleich)',
          /Operativer Unternehmenswert[^\n]*2500\.0M/.test(market), market);
        const val = await tab('valuation');
        check(c.name + ': Fallback-Karte „gesperrt“ mit Grund und EV 2500.0M',
          /gesperrt/.test(val) && c.reason.test(val) && /Operativer Unternehmenswert \(EV\) bleibt bestimmbar: 2500\.0M/.test(val), val.slice(0, 3000));
        const st = await ev(`(() => { const m = state.synthesis && state.synthesis.relativeMultiples && state.synthesis.relativeMultiples.models.find(x => x.id === 'ev_ebitda_10y'); return m ? { a: m.available, b: m.base, ev: m.enterpriseValueM } : null; })()`);
        check(c.name + ': Zustand available=false, base=null, EV=2500', st && st.a === false && st.b == null && st.ev === 2500, JSON.stringify(st));
      } else {
        const shown = (market.match(/EV\/EBITDA-Median[^\n]*\n\s*([^\n]+)/) || [])[1];
        check(c.name + ': EV/EBITDA-Preis ' + c.expect + ' freigegeben', shown && shown.trim() === c.expect, market);
      }
      check(c.name + ': kein XSS-/Markup-Rest im Markt-Vergleich', !/<img|onerror=/i.test(mhtml));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('2 · Multiples vorhanden, Berechnungsgrundlage fehlt (12F Befund 3)');
    for (const c of FX.multiplesMissingInputCases()) {
      const status = await importViaUi(c.mj);
      if (!check(c.name + ': Import', /Import OK/.test(status), status)) continue;
      const market = await tab('market');
      check(c.name + ': Markt-Vergleich nennt Multiple und fehlenden Input',
        market.indexOf(c.multipleShown) >= 0 && /nicht ableitbar/.test(market) && c.missing.every(x => market.indexOf(x) >= 0), market);
      check(c.name + ': keine Behauptung „keine Multiples eingetragen“', !/Keine eigenen Multiples-Mediane/.test(market));
      const val = await tab('valuation');
      check(c.name + ': Fallback-Karte „Input fehlt“ statt „kein eigener Multiple-Median“',
        /Input fehlt/i.test(val) && !/kein eigener Multiple-Median/i.test(val), val.slice(0, 2500));
    }
    {
      const status = await importViaUi(FX.noMultiplesMj());
      check('Gegenfall ohne Multiples: Import', /Import OK/.test(status), status);
      const val = await tab('valuation');
      check('Gegenfall ohne Multiples: Aussage „kein eigener Multiple-Median“ bleibt', /kein eigener Multiple-Median/i.test(val), val.slice(0, 2500));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('3 · Nichtpositiver Aktienwert mit Ausschlussgrund');
    {
      const status = await importViaUi(FX.nonPositiveMj());
      check('Import', /Import OK/.test(status), status);
      const val = await tab('valuation');
      check('Fallback-Karte zeigt -5.00 und den Ausschlussgrund',
        val.indexOf('-5.00') >= 0 && /Ergebnis, kein fehlender Wert/.test(val), val.slice(0, 2500));
      check('kein Median-Referenzwert aus nichtpositivem Wert', !/Relativer Median-Referenzwert/.test(val));
      const market = await tab('market');
      check('Markt-Vergleich zeigt -5.00 mit Ausschlussgrund', market.indexOf('-5.00') >= 0 && /Ergebnis, kein fehlender Wert/.test(market), market);
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('4 · DDM: undatierte Null und fehlende belastbare Historie (12F Befund 2)');
    {
      const status = await importViaUi(FX.ddmUndatedZeroMj());
      check('DDM undatierte Null: Import', /Import OK/.test(status), status);
      const val = await tab('valuation');
      const src = await ev(`state.valuation.modelResults.ddm && state.valuation.modelResults.ddm._debug_g1Source`);
      check('DDM rechnet mit dps_median_annualized (nicht CAGR ueber die Luecke)', src === 'dps_median_annualized', src);
      check('Anzeige: Hinweis „ohne lesbare Berichtsperiode“', /ohne lesbare Berichtsperiode/.test(val), val.slice(0, 3000));
      check('Anzeige: kein dps_cagr_6y', !/dps_cagr_6y/.test(val));
    }
    {
      const status = await importViaUi(FX.ddmNoHistoryMj());
      check('DDM ohne belegbare Spanne: Import', /Import OK/.test(status), status);
      const val = await tab('valuation');
      const src = await ev(`state.valuation.modelResults.ddm && state.valuation.modelResults.ddm._debug_g1Source`);
      check('Ersatzquelle scenario_capped', src === 'scenario_capped', src);
      check('Anzeige: Ersatzquelle und Grund („kein gemessenes Wachstum: Gemeldete Dividende 0 …“)',
        /kein gemessenes Wachstum: Gemeldete Dividende 0 ohne lesbare Berichtsperiode/.test(val), val.slice(0, 3000));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('5 · Financials: eine Modellfamilie, kein Uebereinstimmungssignal');
    {
      const status = await importViaUi(FX.financialsMj());
      check('Import', /Import OK/.test(status), status);
      const s = await ev(`({ act: state.synthesis.activeModelsCount, ind: state.synthesis.independentModelCount, agr: state.synthesis.modelAgreement, why: state.synthesis.modelAgreementReason })`);
      check('Synthese: 2 Darstellungen, 1 unabhaengige Familie, Agreement n/a',
        s.act === 2 && s.ind === 1 && s.agr === 'n/a', JSON.stringify(s));
      const val = await tab('valuation');
      check('Anzeige erklaert „derselben Modellfamilie“', /derselben Modellfamilie/.test(val), val.slice(0, 3000));
      check('Anzeige: keine unabhaengige Bestaetigung behauptet', /keine unabhaengige Bestaetigung/i.test(val));
      const ov = await tab('overview');
      check('Uebersicht: kein „hohe Übereinstimmung“-Signal', !/(hohe|high)[^\n]{0,20}(Übereinstimmung|agreement)/i.test(ov), ov.slice(0, 2000));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('6 · Snapshot-ID-Angriffe (nur harmlose lokale Marker)');
    {
      // a) Import einer praeparierten Snapshot-Datei ueber das echte Datei-Feld.
      await ev(`localStorage.removeItem(SNAP_KEY); renderSnapshots();`);
      const attackFile = join(work, 'angriff-snapshots.json');
      writeFileSync(attackFile, JSON.stringify(await ev(`(${FX.attackBundleJs})()`)));
      await tab('journal');
      const nD = dialogs.length;
      await setFile('#snap-import-file', attackFile);
      await waitFor(`true`, 300);
      const dlg = dialogs.slice(nD).map(d => d.message).join(' | ');
      check('praeparierte IDs: Import abgelehnt („nichts wurde gespeichert“)', /Import abgebrochen/.test(dlg) && /unzulaessige Zeichen/.test(dlg), dlg);
      check('Bestand bleibt leer', (await snapStore()) == null || JSON.parse(await snapStore()).length === 0, await snapStore());
      let inj = await noInjected();
      check('kein Marker ausgefuehrt, kein <img>, kein Ereignisattribut', !inj.pwned && inj.imgs === 0 && !inj.inline && inj.scripts === 0, JSON.stringify(inj));
      // b) Frueher gespeicherter Schrott-Datensatz im Bestand (Zustandseingriff:
      //    so kann er nur aus einer Altversion stammen) → Journal rendern.
      await ev(`localStorage.setItem(SNAP_KEY, JSON.stringify((${FX.attackRecordsJs})())); renderSnapshots();`);
      await tab('journal');
      const jt = await ev(`document.getElementById('snap-list').innerText`);
      inj = await noInjected();
      check('Altbestand mit Angriffs-ID: als unbrauchbar ausgewiesen, nicht ausgefuehrt',
        /unbrauchbare/.test(jt) && !inj.pwned && inj.imgs === 0 && !inj.inline && inj.scripts === 0, JSON.stringify(inj) + ' ' + jt.slice(0, 500));
      // c) Klick auf die Knoepfe eines gueltigen Datensatzes im selben Bestand
      //    (Delegation) — der Marker darf nicht entstehen.
      const hasBtn = await ev(`!!document.querySelector('#snap-list [data-action="snapshot-load"]')`);
      if (hasBtn) {
        await click(`document.querySelector('#snap-list [data-action="snapshot-load"]')`, 'Gespeichertes Ergebnis (Angriffsbestand)');
        await sleep(300);
        // evtl. Kompatibilitaetsdialog schliessen
        if (await ev(`!!(document.getElementById('snap-compat-modal') && document.getElementById('snap-compat-modal').classList.contains('on'))`)) {
          await click(`document.getElementById('sncm-original')`, 'Original laden');
        }
      }
      inj = await noInjected();
      check('nach Klick: kein Marker, keine Codeausfuehrung', !inj.pwned, JSON.stringify(inj));
      const stored = JSON.parse(await snapStore());
      check('Angriffsbestand wurde weder umgeschrieben noch geloescht', stored.length === 2 && stored.some(s => /onerror/.test(s.id)), JSON.stringify(stored.map(s => s.id)));
      check('keine Ausnahme', exceptions.length === 0, exceptions.join(' | '));
      await ev(`localStorage.removeItem(SNAP_KEY); renderSnapshots();`);
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('7 · Zusammenhaengender Bedienungsablauf (synthetischer TTM-Filer)');
    await reload();
    check('nach Neuladen: leerer Ausgangszustand', await ev(`state.masterJson == null && localStorage.getItem(SNAP_KEY) == null`));
    const mainMj = FX.ttmMasterJson();
    {
      const status = await importViaUi(mainMj);
      check('7.1 Master-JSON ueber die Oberflaeche importiert', /Import OK — SYNTB/.test(status), status);
    }
    // 7.2 FY-Ergebnis
    const fy = {};
    fy.market = await tab('market');
    fy.ev = (fy.market.match(/EV\/EBITDA-Median[^\n]*\n\s*([^\n]+)/) || [])[1];
    fy.state = await ev(`({ basis: state.valuation.dataBasis.selected, g1: state.masterJson.valuation.growth_stage1,
      dcf: state.valuation.modelResults.dcf && state.valuation.modelResults.dcf.base, base: state.synthesis.range && state.synthesis.range.base })`);
    check('7.2 FY: EV/EBITDA 21.00, Basis FY · 2024-12-31',
      fy.ev && fy.ev.trim() === '21.00' && /LETZTES GESCHÄFTSJAHR \(FY\) · 2024-12-31/i.test(fy.market) && fy.state.basis === 'fy', JSON.stringify(fy.state) + ' ' + fy.market);
    // 7.3 Annahme aendern (Stage-1-Wachstum) und neu berechnen
    await tab('assumptions');
    const g1Before = await ev(`document.getElementById('as-g1').value`);
    await typeInto(`document.getElementById('as-g1')`, '7', 'Stage-1-Wachstum');
    await click(byText('#assumptions-output button', '/^\\s*Neu berechnen\\s*$/'), 'Neu berechnen');
    await sleep(400);
    const afterG1 = await ev(`({ g1: state.masterJson.valuation.growth_stage1, manual: state.manualAssumptionFields.has('growth_stage1'),
      dcf: state.valuation.modelResults.dcf && state.valuation.modelResults.dcf.base, base: state.synthesis.range && state.synthesis.range.base })`);
    check('7.3 Annahme g1 ' + g1Before + ' → 7 uebernommen und als manuell gefuehrt', afterG1.g1 === 7 && afterG1.manual, JSON.stringify(afterG1));
    check('7.3 Neuberechnung veraendert den DCF-Wert', afterG1.dcf != null && fy.state.dcf != null && afterG1.dcf > fy.state.dcf,
      fy.state.dcf + ' → ' + afterG1.dcf);
    const fyAfter = await ev(`({ dcf: state.valuation.modelResults.dcf.base, base: state.synthesis.range && state.synthesis.range.base })`);
    // 7.4 Basis auf TTM umschalten (echtes change-Ereignis am Auswahlfeld)
    await ev(`(() => { const s = document.getElementById('as-data-basis'); s.focus(); s.value = 'ttm'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(500);
    const ttm = {};
    ttm.state = await ev(`({ basis: state.valuation.dataBasis.selected, g1: state.masterJson.valuation.growth_stage1,
      dcf: state.valuation.modelResults.dcf && state.valuation.modelResults.dcf.base, base: state.synthesis.range && state.synthesis.range.base })`);
    ttm.market = await tab('market');
    ttm.ev = (ttm.market.match(/EV\/EBITDA-Median[^\n]*\n\s*([^\n]+)/) || [])[1];
    check('7.4 TTM: EV/EBITDA 30.38, Basis TTM · 2025-09-30',
      ttm.ev && ttm.ev.trim() === '30.38' && /TTM[^\n]*2025-09-30/.test(ttm.market) && ttm.state.basis === 'ttm', JSON.stringify(ttm.state) + ' ' + ttm.market);
    check('7.4 manuelle Annahme g1 = 7 bleibt beim Basiswechsel erhalten', ttm.state.g1 === 7, JSON.stringify(ttm.state));
    check('7.4 FY- und TTM-Ergebnis unterscheiden sich (DCF)', ttm.state.dcf != null && Math.abs(ttm.state.dcf - fyAfter.dcf) > 1e-6,
      fyAfter.dcf + ' vs ' + ttm.state.dcf);
    const ttmVal = await tab('valuation');
    check('7.4 Bewertungsansicht weist TTM mit Zeitraum 2025-09-30 aus', /TTM/.test(ttmVal) && /2025-09-30/.test(ttmVal), ttmVal.slice(0, 1500));
    // 7.5 Snapshot ueber die Oberflaeche speichern (TTM-Stand)
    await tab('journal');
    await click(byText('#panel-journal button', '/Aktuelle Bewertung speichern/'), 'Aktuelle Bewertung speichern');
    await sleep(300);
    const snaps1 = JSON.parse(await snapStore() || '[]');
    check('7.5 Snapshot gespeichert (1 Datensatz)', snaps1.length === 1, JSON.stringify(snaps1.map(s => s.id)));
    const saved = await ev(`({ basis: state.valuation.dataBasis.selected, g1: state.masterJson.valuation.growth_stage1,
      price: state.masterJson.market.price,
      models: Object.fromEntries(Object.entries(state.valuation.modelResults).filter(([k, m]) => m && m.base != null).map(([k, m]) => [k, m.base])),
      range: state.synthesis.range, buy: state.synthesis.buyPrice, pos: state.synthesis.position,
      agr: state.synthesis.modelAgreement, weights: (state.synthesis._modelWeightDiag || []).map(d => [d.model, d.effectiveWeight]) })`);
    const snapId = snaps1[0] && snaps1[0].id;
    // 7.6 Seite neu laden, gespeichertes Ergebnis oeffnen
    await reload();
    check('7.6 nach Neuladen: kein aktiver Datensatz, Snapshot noch vorhanden',
      await ev(`state.masterJson == null && JSON.parse(localStorage.getItem(SNAP_KEY)).length === 1`));
    await tab('journal');
    await click(`document.querySelector('#snap-list [data-action="snapshot-load"][data-action-value="${snapId}"]')`, 'Gespeichertes Ergebnis');
    await sleep(400);
    const loaded = await ev(`({ basis: state.valuation.dataBasis.selected, g1: state.masterJson.valuation.growth_stage1,
      price: state.masterJson.market.price,
      models: Object.fromEntries(Object.entries(state.valuation.modelResults).filter(([k, m]) => m && m.base != null).map(([k, m]) => [k, m.base])),
      range: state.synthesis.range, buy: state.synthesis.buyPrice, pos: state.synthesis.position,
      agr: state.synthesis.modelAgreement, weights: (state.synthesis._modelWeightDiag || []).map(d => [d.model, d.effectiveWeight]),
      fromSnap: state._loadedFromSnapshot, cur: state._usingCurrentEngine,
      status: document.getElementById('import-master-status').textContent, dataBasisSel: state.masterJson.valuation.data_basis })`);
    check('7.6 geladen als gespeichertes Ergebnis (nicht neu gerechnet)', loaded.fromSnap === true && loaded.cur === false && /Original-Bewertung geladen/.test(loaded.status), JSON.stringify(loaded.status));
    check('7.6 Eingaben identisch (g1, Kurs, Datenbasis)', loaded.g1 === saved.g1 && loaded.price === saved.price && loaded.dataBasisSel === 'ttm' && loaded.basis === saved.basis,
      JSON.stringify({ saved: [saved.g1, saved.price, saved.basis], loaded: [loaded.g1, loaded.price, loaded.dataBasisSel, loaded.basis] }));
    check('7.6 Modellwerte identisch', JSON.stringify(loaded.models) === JSON.stringify(saved.models), JSON.stringify({ saved: saved.models, loaded: loaded.models }));
    check('7.6 Synthese identisch (Range, Buy Price, Position, Agreement, Gewichte)',
      JSON.stringify([loaded.range, loaded.buy, loaded.pos, loaded.agr, loaded.weights]) === JSON.stringify([saved.range, saved.buy, saved.pos, saved.agr, saved.weights]),
      JSON.stringify({ saved: [saved.range, saved.buy, saved.pos, saved.agr], loaded: [loaded.range, loaded.buy, loaded.pos, loaded.agr] }));
    {
      const market = await tab('market');
      const e = (market.match(/EV\/EBITDA-Median[^\n]*\n\s*([^\n]+)/) || [])[1];
      check('7.6 Markt-Vergleich des geladenen Snapshots: 30.38 (TTM)', e && e.trim() === '30.38' && /TTM/.test(market), market);
    }
    // 7.7 Veraltetes Ergebnis nach Basiswechsel (Zustandseingriff: Auswahl
    //     umstellen OHNE Neuberechnung — die Oberflaeche selbst rechnet beim
    //     Umschalten sofort neu, siehe 7.4).
    {
      await ev(`state.masterJson.valuation.data_basis = 'fy'; renderMarket(); renderValuation();`);
      const market = await tab('market');
      check('7.7 veraltetes Ergebnis: keine Zahlen, Hinweis „neu berechnen“', /neu berechnen/i.test(market) && !/EV\/EBITDA-Median/.test(market), market);
      const val = await tab('valuation');
      check('7.7 Bewertungsansicht zeigt keinen gemischten Stand', /neu berechnen/i.test(val) || /Datenbasis/.test(val), val.slice(0, 1200));
      await ev(`state.masterJson.valuation.data_basis = 'ttm'; renderMarket(); renderValuation();`);
    }
    // 7.7b Basiswechsel auf einem GELADENEN gespeicherten Ergebnis: die
    //      Oberflaeche rechnet neu und muss das auch sagen (Befund B-2).
    {
      const before = await snapStore();
      await tab('assumptions');
      await ev(`(() => { const s = document.getElementById('as-data-basis'); s.focus(); s.value = 'fy'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await sleep(400);
      const r = await ev(`({ cur: state._usingCurrentEngine, basis: state.valuation.dataBasis.selected,
        status: document.getElementById('import-master-status').textContent })`);
      const ov = await tab('overview');
      check('7.7b Basiswechsel nach „Gespeichertes Ergebnis“: als Neuberechnung gekennzeichnet (Status + Hinweis)',
        r.cur === true && r.basis === 'fy' && !/Original-Bewertung geladen/.test(r.status) && /neu berechnet/.test(r.status) &&
        /Snapshot wurde mit einem kompatiblen Rechenkern[^\n]*neu bewertet/.test(ov), JSON.stringify(r) + ' ' + ov.slice(0, 400));
      check('7.7b Basiswechsel veraendert den gespeicherten Snapshot nicht', (await snapStore()) === before);
    }
    // 7.8 „Neu rechnen (aktuelles Modell)“ als getrennte Aktion
    {
      const before = await snapStore();
      await tab('journal');
      await click(`document.querySelector('#snap-list [data-action="snapshot-recompute"][data-action-value="${snapId}"]')`, 'Neu rechnen');
      await sleep(500);
      const re = await ev(`({ cur: state._usingCurrentEngine, fromSnap: state._loadedFromSnapshot, basis: state.valuation.dataBasis.selected,
        g1: state.masterJson.valuation.growth_stage1,
        models: Object.fromEntries(Object.entries(state.valuation.modelResults).filter(([k, m]) => m && m.base != null).map(([k, m]) => [k, m.base])),
        range: state.synthesis.range, status: document.getElementById('import-master-status').textContent })`);
      check('7.8 Neu rechnen: als Neuberechnung gekennzeichnet', re.cur === true && /Neu berechnet mit aktuellem Modell/.test(re.status) && /Snapshot wurde nicht verändert/.test(re.status), re.status);
      check('7.8 Neu rechnen: gespeicherter Snapshot unveraendert', (await snapStore()) === before);
      check('7.8 Neu rechnen: gleiche Eingaben und Datenbasis (g1 = 7, TTM)', re.g1 === 7 && re.basis === 'ttm', JSON.stringify(re));
      check('7.8 Neu rechnen: gleiches Modell ⇒ gleiche Modellwerte wie gespeichert',
        Object.keys(saved.models).every(k => re.models[k] != null && Math.abs(re.models[k] - saved.models[k]) < 1e-9), JSON.stringify({ saved: saved.models, re: re.models }));
    }
    // 7.9 Export erzeugen (Snapshots + Master-JSON) und wieder importieren
    let snapExport = null, masterExport = null;
    {
      await tab('journal');
      await click(byText('#panel-journal button', '/Alle exportieren \\(JSON\\)/'), 'Alle exportieren (JSON)');
      snapExport = await waitDownload('aktienbewertung_snapshots');
      check('7.9 Snapshot-Export als Datei erzeugt', !!snapExport, JSON.stringify([...downloadsDone.values()]));
      await openSettings();
      await click(byText('#settings-card button', '/JSON herunterladen/'), 'JSON herunterladen');
      masterExport = await waitDownload('_master.json');
      check('7.9 Master-JSON-Export als Datei erzeugt', !!masterExport, JSON.stringify([...downloadsDone.values()]));
    }
    if (snapExport) {
      const bundle = JSON.parse(readFileSync(snapExport, 'utf8'));
      check('7.9 Exportdatei enthaelt den Snapshot', Array.isArray(bundle.snapshots) && bundle.snapshots.length === 1 && bundle.snapshots[0].id === snapId, Object.keys(bundle).join(','));
    }
    // 7.10 Ungueltige Importe beschaedigen den Bestand nicht
    {
      const storeBefore = await snapStore();
      const stateBefore = await ev(`JSON.stringify({ t: state.masterJson.meta.ticker, g1: state.masterJson.valuation.growth_stage1, b: state.valuation.dataBasis.selected, r: state.synthesis.range })`);
      for (const [label, text] of [['null', 'null'], ['Array', '[1,2,3]'], ['kaputtes JSON', '{ nicht json'], ['ohne Bloecke', '{"foo":1}']]) {
        const st = await importViaUi(text);
        check('7.10 ungueltiger Master-Import (' + label + ') abgewiesen', /Kein gültiges Master-JSON|JSON-Parse-Fehler/.test(st), st);
      }
      check('7.10 aktiver Datensatz nach ungueltigen Importen unveraendert',
        (await ev(`JSON.stringify({ t: state.masterJson.meta.ticker, g1: state.masterJson.valuation.growth_stage1, b: state.valuation.dataBasis.selected, r: state.synthesis.range })`)) === stateBefore);
      const bad = join(work, 'ungueltig-snapshots.json');
      writeFileSync(bad, JSON.stringify({ _kind: 'irgendwas', snapshots: 'kein Array' }));
      await tab('journal');
      const nD = dialogs.length;
      await setFile('#snap-import-file', bad);
      const dlg = dialogs.slice(nD).map(d => d.message).join(' | ');
      check('7.10 ungueltiger Snapshot-Import abgewiesen', /Import abgebrochen|fehlgeschlagen/.test(dlg), dlg);
      const broken = join(work, 'kaputt.json');
      writeFileSync(broken, '{ kaputt');
      const nD2 = dialogs.length;
      await setFile('#snap-import-file', broken);
      const dlg2 = dialogs.slice(nD2).map(d => d.message).join(' | ');
      check('7.10 unlesbare Snapshot-Datei abgewiesen', /fehlgeschlagen|abgebrochen/.test(dlg2), dlg2);
      check('7.10 Snapshot-Bestand nach ungueltigen Importen unveraendert', (await snapStore()) === storeBefore);
    }
    // 7.11 Snapshot loeschen (UI, Bestaetigungsdialog) und Export wieder importieren
    {
      await tab('journal');
      dialogAnswers.push(false);   // erst abbrechen …
      await click(`document.querySelector('#snap-list [data-action="snapshot-delete"][data-action-value="${snapId}"]')`, 'Snapshot loeschen (Abbruch)');
      await sleep(200);
      check('7.11 Loeschen abgebrochen ⇒ Snapshot bleibt', JSON.parse(await snapStore()).length === 1);
      dialogAnswers.push(true);    // … dann bestaetigen
      await click(`document.querySelector('#snap-list [data-action="snapshot-delete"][data-action-value="${snapId}"]')`, 'Snapshot loeschen');
      await sleep(200);
      check('7.11 Snapshot geloescht', JSON.parse(await snapStore()).length === 0 && !(await ev(`!!document.querySelector('#snap-list [data-action="snapshot-load"]')`)));
      if (snapExport) {
        const nD = dialogs.length;
        await setFile('#snap-import-file', snapExport);
        const dlg = dialogs.slice(nD).map(d => d.message).join(' | ');
        const back = JSON.parse(await snapStore() || '[]');
        check('7.11 Export wieder importiert (1 neuer Snapshot)', /1 neue Snapshot/.test(dlg) && back.length === 1 && back[0].id === snapId, dlg);
        const orig = JSON.parse(readFileSync(snapExport, 'utf8')).snapshots[0];
        check('7.11 wieder importierter Snapshot inhaltlich identisch', JSON.stringify(back[0]) === JSON.stringify(orig));
        await click(`document.querySelector('#snap-list [data-action="snapshot-load"][data-action-value="${snapId}"]')`, 'Gespeichertes Ergebnis (reimportiert)');
        await sleep(400);
        const re = await ev(`({ g1: state.masterJson.valuation.growth_stage1, basis: state.valuation.dataBasis.selected,
          models: Object.fromEntries(Object.entries(state.valuation.modelResults).filter(([k, m]) => m && m.base != null).map(([k, m]) => [k, m.base])),
          range: state.synthesis.range, buy: state.synthesis.buyPrice })`);
        check('7.11 reimportierter Snapshot liefert dieselben Eingaben/Modellwerte/Synthese',
          re.g1 === saved.g1 && re.basis === saved.basis && JSON.stringify(re.models) === JSON.stringify(saved.models) &&
          JSON.stringify([re.range, re.buy]) === JSON.stringify([saved.range, saved.buy]), JSON.stringify(re));
      }
      if (masterExport) {
        await openSettings();
        await setFile('#json-file-input', masterExport);
        await sleep(300);
        const st = await ev(`document.getElementById('import-master-status').textContent`);
        const m = await ev(`({ t: state.masterJson.meta.ticker, g1: state.masterJson.valuation.growth_stage1, db: state.masterJson.valuation.data_basis,
          basis: state.valuation.dataBasis.selected, fromSnap: state._loadedFromSnapshot,
          models: Object.fromEntries(Object.entries(state.valuation.modelResults).filter(([k, m]) => m && m.base != null).map(([k, m]) => [k, m.base])) })`);
        check('7.12 exportiertes Master-JSON ueber das Datei-Feld wieder importiert', /Import OK — SYNTB/.test(st), st);
        check('7.12 Eingaben erhalten (g1 = 7, Datenbasis TTM)', m.g1 === 7 && m.db === 'ttm' && m.basis === 'ttm', JSON.stringify(m));
        check('7.12 Neuberechnung aus dem Export ergibt dieselben Modellwerte',
          Object.keys(saved.models).every(k => m.models[k] != null && Math.abs(m.models[k] - saved.models[k]) < 1e-9), JSON.stringify({ saved: saved.models, now: m.models }));
      }
    }
    // 7.13 Override-Aktion rund um einen geloeschten Snapshot
    {
      const status = await importViaUi(FX.hardStopMj());
      check('7.13 Datensatz mit ausgeloestem Hard Stop importiert', /Import OK/.test(status), status);
      let q = await tab('quality');
      check('7.13 Hard Stop „Going Concern“ TRIGGERED mit Override-Knopf', /TRIGGERED/.test(q) && await ev(`!!document.querySelector('[data-action="override-open"][data-action-value="going_concern"]')`), q.slice(0, 1500));
      await click(`document.querySelector('[data-action="override-open"][data-action-value="going_concern"]')`, 'Override...');
      await sleep(150);
      check('7.13 Override-Dialog offen', await ev(`document.getElementById('override-modal').classList.contains('on')`));
      await typeInto(`document.getElementById('modal-reason')`, 'zu kurz', 'Begruendung');
      await click(byText('#override-modal button', '/Override aktivieren/'), 'Override aktivieren (zu kurz)');
      check('7.13 zu kurze Begruendung abgewiesen', await ev(`document.getElementById('modal-error').classList.contains('on') && state.qualityOverrides.length === 0`));
      await typeInto(`document.getElementById('modal-reason')`, 'Synthetischer Testfall: Prüfvermerk bewusst übersteuert.', 'Begruendung');
      await click(byText('#override-modal button', '/Override aktivieren/'), 'Override aktivieren');
      await sleep(300);
      q = await tab('quality');
      check('7.13 Override aktiv (OVERRIDDEN)', /OVERRIDDEN/.test(q) && await ev(`state.qualityOverrides.length === 1`), q.slice(0, 1500));
      await tab('journal');
      await click(byText('#panel-journal button', '/Aktuelle Bewertung speichern/'), 'Aktuelle Bewertung speichern (mit Override)');
      await sleep(300);
      const all = JSON.parse(await snapStore());
      const hsSnap = all.find(s => s.id !== snapId);
      check('7.13 zweiter Snapshot mit Override gespeichert', all.length === 2 && hsSnap && Array.isArray(hsSnap.qualityOverrides) && hsSnap.qualityOverrides.length === 1, JSON.stringify(all.map(s => s.id)));
      await click(`document.querySelector('#snap-list [data-action="snapshot-load"][data-action-value="${hsSnap.id}"]')`, 'Gespeichertes Ergebnis (Override)');
      await sleep(400);
      await tab('journal');
      dialogAnswers.push(true);
      await click(`document.querySelector('#snap-list [data-action="snapshot-delete"][data-action-value="${hsSnap.id}"]')`, 'Snapshot mit Override loeschen');
      await sleep(250);
      const rest = JSON.parse(await snapStore());
      check('7.13 nur der Override-Snapshot geloescht, anderer Snapshot unberuehrt',
        rest.length === 1 && rest[0].id === snapId && JSON.stringify(rest[0]) === JSON.stringify(JSON.parse(readFileSync(snapExport, 'utf8')).snapshots[0]));
      q = await tab('quality');
      check('7.13 geladener Stand zeigt den Override weiterhin', /OVERRIDDEN/.test(q));
      const nEx = exceptions.length;
      await click(`document.querySelector('[data-action="override-remove"][data-action-value="going_concern"]')`, 'Override entfernen');
      await sleep(300);
      q = await tab('quality');
      check('7.13 „Override entfernen“ nach Loeschen des Snapshots wirkt (TRIGGERED, 0 Overrides)',
        /TRIGGERED/.test(q) && !/OVERRIDDEN/.test(q) && await ev(`state.qualityOverrides.length === 0`), q.slice(0, 1500));
      check('7.13 keine Ausnahme bei der Override-Aktion', exceptions.length === nEx, exceptions.slice(nEx).join(' | '));
      check('7.13 Entfernen des Overrides veraendert den Snapshot-Bestand nicht', JSON.stringify(JSON.parse(await snapStore())) === JSON.stringify(rest));
      await click(`document.querySelector('[data-action="override-open"][data-action-value="going_concern"]')`, 'Override... (erneut)');
      await sleep(150);
      check('7.13 Override-Dialog laesst sich erneut oeffnen', await ev(`document.getElementById('override-modal').classList.contains('on')`));
      await click(byText('#override-modal button', '/Abbrechen/'), 'Abbrechen');
      check('7.13 Abbrechen schliesst den Dialog ohne Override', await ev(`!document.getElementById('override-modal').classList.contains('on') && state.qualityOverrides.length === 0`));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('8 · Abschluss');
    check('keine unbehandelte Ausnahme im gesamten Ablauf', exceptions.length === 0, exceptions.join(' | '));
    const nonFont = external.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
    check('keine externe Anfrage ausser den abgewiesenen Web-Fonts', nonFont.length === 0, nonFont.join(' | '));
    check('keine SEC-/Yahoo-Anfrage', !external.some(u => /sec\.gov|yahoo/i.test(u)), external.join(' | '));
    console.log('  info  abgewiesene externe Anfragen: ' + (external.length ? [...new Set(external)].join(' | ') : 'keine'));
    console.log('  info  Dialoge: ' + dialogs.length + ' (' + dialogs.map(d => d.type).join(', ') + ')');
  } catch (e) {
    fail(e);
  } finally {
    await b.close();
    try { rmSync(work, { recursive: true, force: true }); } catch { /* egal */ }
  }

  const failed = results.filter(r => !r.ok);
  console.log('\n══ Browser-Abnahme: ' + results.length + ' Pruefungen · ' + (results.length - failed.length) + ' bestanden · ' + failed.length + ' fehlgeschlagen');
  console.log('   Produktstand: ' + ps.commit + (ps.dirty === 'ja' ? ' (+ lokale Aenderungen)' : ''));
  console.log(failed.length === 0 ? 'ERGEBNIS: BESTANDEN' : 'ERGEBNIS: FEHLGESCHLAGEN');
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(e => { console.error('ABNAHME ABGEBROCHEN: ' + (e && e.stack || e)); process.exit(2); });
