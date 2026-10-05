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
    sec('9 · D2-Nachbesserung: Leasing-ROIC und Net Debt/EBITDA (V1.0.72)');
    for (const n of [4, 1]) {
      const status = await importViaUi(FX.roicLeaseMj(n));
      if (!check(`ROIC ${n} Leasingjahr(e): Import`, /Import OK/.test(status), status)) continue;
      const q = await tab('quality');
      check(`ROIC ${n} Leasingjahr(e): Qualitaet nennt die Datenluecke`,
        new RegExp('ROIC − WACC[\\s\\S]*nur für ' + n + ' von 6 Jahren periodengleich gemeldet \\(mindestens 5 erforderlich\\)').test(q), q.slice(0, 4000));
      check(`ROIC ${n} Leasingjahr(e): kein Spread +7.0pp angezeigt`, !/\+7\.0pp/.test(q), q.slice(0, 4000));
      const st = await ev(`(() => { const d = state.quality.descriptive.roicMinusWacc; const c = computeQualityCapitalEfficiencyScore(state.quality, state.masterJson).components.find(x => x.key === 'roicSpread'); return { s: d.status, v: d.value, ca: c.available, cs: c.score }; })()`);
      check(`ROIC ${n} Leasingjahr(e): Zustand gesperrt, kein Score`, st.s === 'insufficient_data' && st.v == null && st.ca === false && st.cs == null, JSON.stringify(st));
    }
    {
      const status = await importViaUi(FX.roicLeaseMj(5));
      check('ROIC 5 Leasingjahre (Gegenprobe): Import', /Import OK/.test(status), status);
      const q = await tab('quality');
      check('ROIC 5 Leasingjahre: bereinigter Spread +2.0pp sichtbar', /\+2\.0pp/.test(q) && /lease-adj/.test(q), q.slice(0, 4000));
    }
    for (const c of [
      { tag: 'A', nd: ['2025-12-31'], eb: [null], why: /EBITDA fuehrt Periodenangaben, belegt aber kein lesbares Periodenende/ },
      { tag: 'B', nd: undefined, eb: ['n/a'], why: /EBITDA fuehrt Periodenangaben/ },
      { tag: 'C', nd: [null], eb: ['2025-12-31'], why: /Nettoschulden \(net_debt\[0\]\) fuehren Periodenangaben/ }]) {
      const status = await importViaUi(FX.leverageMj(c.tag, c.nd, c.eb));
      if (!check(`ND/EBITDA Fall ${c.tag}: Import`, /Import OK/.test(status), status)) continue;
      const q = await tab('quality');
      check(`ND/EBITDA Fall ${c.tag}: Qualitaet zeigt Sperrgrund statt 4.00x`, c.why.test(q) && !/4\.00x/.test(q), q.slice(0, 5000));
      const o = await tab('overview');
      check(`ND/EBITDA Fall ${c.tag}: Uebersicht „nicht verfuegbar“ mit Grund`,
        /Nettoverschuldung zu EBITDA[\s\S]{0,120}nicht verfügbar/.test(o) && c.why.test(o), o.slice(0, 5000));
      const mc = await ev(`(() => { const m = state.synthesis && state.synthesis.mosComponents; return m ? { r: m._mosLeverageRatio, a: m.leverageAddon, u: m._mosLeverageUnavailable } : null; })()`);
      check(`ND/EBITDA Fall ${c.tag}: MoS ohne Verhaeltnis und ohne Zuschlag, Grund gespeichert`,
        mc && mc.r == null && mc.a === 0 && c.why.test(mc.u || ''), JSON.stringify(mc));
      const val = await tab('valuation');
      check(`ND/EBITDA Fall ${c.tag}: MoS-Aufschluesselung „Leverage Add-on … nicht bewertbar … n/a“ (nicht „–“)`,
        /Leverage Add-on \(nicht bewertbar[^\n]*\)\s*n\/a/.test(val) && !/ND\/EBITDA \d/.test(val), val.slice(0, 6000));
    }
    {
      const status = await importViaUi(FX.leverageMj('G', ['2025-12-31'], ['2025-12-31']));
      check('ND/EBITDA Gegenprobe gueltig datiert: Import', /Import OK/.test(status), status);
      const q = await tab('quality');
      check('ND/EBITDA Gegenprobe: 4.00x sichtbar', /4\.00x/.test(q), q.slice(0, 5000));
      const mc = await ev(`(() => { const m = state.synthesis.mosComponents; return { r: m._mosLeverageRatio, a: m.leverageAddon }; })()`);
      check('ND/EBITDA Gegenprobe: MoS-Zuschlag +5 pp aus 4.0x', mc.r === 4 && mc.a === 0.05, JSON.stringify(mc));
      const val = await tab('valuation');
      check('ND/EBITDA Gegenprobe: Aufschluesselung zeigt ND/EBITDA 4.0x', /ND\/EBITDA 4\.0x/.test(val), val.slice(0, 6000));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('10 · D3-Nachbesserung: ROIC-Trend nur aus gueltigen Perioden (V1.0.75)');
    const trendState = `(() => { const c = state.quality && state.quality.qceScore && state.quality.qceScore.components.find(x => x.key === 'roicTrend');
      return c ? { a: c.available, s: c.score, v: c.valStr } : null; })()`;
    for (const kind of ['na', 'impossible']) {
      const status = await importViaUi(FX.roicTrendMj(kind));
      if (!check(`ROIC-Trend Perioden „${kind}“: Import`, /Import OK/.test(status), status)) continue;
      const q = await tab('quality');
      check(`ROIC-Trend Perioden „${kind}“: Qualitaet zeigt ROIC-Trend n/a, kein Score`,
        /ROIC-Trend \(3y vs 3y\)\s*n\/a/i.test(q) && !/ROIC-Trend \(3y vs 3y\)\s*\+1\.9pp/i.test(q), q.slice(0, 5000));
      const st = await ev(trendState);
      check(`ROIC-Trend Perioden „${kind}“: Zustand nicht verfuegbar, Score leer`, st && st.a === false && st.s == null, JSON.stringify(st));
    }
    {
      const status = await importViaUi(FX.roicTrendMj('valid'));
      check('ROIC-Trend gueltige Perioden (Gegenprobe): Import', /Import OK/.test(status), status);
      const q = await tab('quality');
      check('ROIC-Trend gueltige Perioden: +1.9pp · 7/10 sichtbar', /ROIC-Trend \(3y vs 3y\)\s*\+1\.9pp · 7\/10/i.test(q), q.slice(0, 5000));
      const st = await ev(trendState);
      check('ROIC-Trend gueltige Perioden: Zustand Score 7', st && st.a === true && st.s === 7, JSON.stringify(st));
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('11 · Restpunkte PR #2: FCF-Diagnostik ohne belegte Nettoschulden, vereinfachter ROIC (V1.0.77)');
    {
      const status = await importViaUi(FX.diagNetDebtMj('none'));
      if (check('Diagnose ohne Schuldenangaben: Import', /Import OK/.test(status), status)) {
        const val = await tab('valuation');
        const diag = val.slice(val.search(/GETRENNTE DIAGNOSE AUF REPORTED-FCF-BASIS/i));
        check('11.1 Bewertung: Reported-/Owner-FCF-Basis ohne Wachstumszahl, Grund „Nettoschulden nicht belegt“',
          /REPORTED-FCF-BASIS\s*– \(Nettoschulden nicht belegt/i.test(diag) && /OWNER-FCF-BASIS\s*– \(Nettoschulden nicht belegt/i.test(diag)
          && !/FCF-BASIS\s*[+-]\d/i.test(diag), diag.slice(0, 1500));
        check('11.2 Bewertung: vereinfachter ROIC „nicht bewertbar“ mit Grund, keine Zahl',
          /ROIC akt\. \(vereinfacht\):\s*nicht bewertbar/.test(val) && /Nicht bewertbar: [^\n]*Finanzschulden, Liquidität/.test(val)
          && !/ROIC akt\.[^\n]*\d+\.\d%/.test(val), val.slice(val.indexOf('Historisches Profil') - 50, val.indexOf('Historisches Profil') + 1200));
        const gr = await tab('growth');
        const html = await panelHtml('growth');
        check('11.3 Wachstum: Reverse DCF nicht berechenbar mit Nettoschulden-Grund, keine Kursszenarien',
          /Reverse DCF nicht berechenbar: Nettoschulden nicht belegt/.test(gr) && !/Kurs heute\s+40\.00\s+\d/.test(gr), gr.slice(0, 4000));
        check('11.4 Wachstum: Owner-FCF-DCF ohne Fair Value, NetDebt „nicht belegt“ statt $0 M, SBC-Diagnose sichtbar',
          /DCF Fair Value: nicht bestimmbar \(Nettoschulden nicht belegt\)/.test(html) && !/DCF Fair Value: \$/.test(html)
          && /NetDebt\s*nicht belegt/.test(html) && !/NetDebt\s*\$0/.test(html) && /\$160 M/.test(html), gr.slice(0, 6000));
        const st = await ev(`(() => { const r = state.growth && state.growth.reverseDcfFull; return r ? { rep: r.reverseDcfReported, own: r.reverseDcfOwner, nd: r.inputs.netDebtM, v: state.growth.verdict } : null; })()`);
        check('11.5 Zustand: kein Reported-/Owner-Wachstum, Nettoschulden null, kein Growth-Verdict aus Wachstum', st && st.rep == null && st.own == null && st.nd == null
          && !['GROWTH_WATCH', 'GROWTH_BUY', 'PRICED_FOR_PERFECTION', 'BUBBLE_RISK'].includes(st.v), JSON.stringify(st));
      }
    }
    {
      const status = await importViaUi(FX.diagNetDebtMj('valid'));
      if (check('Diagnose mit belegten Nettoschulden 4,000 (Gegenprobe): Import', /Import OK/.test(status), status)) {
        const gr = await tab('growth');
        const html = await panelHtml('growth');
        check('11.6 Gegenprobe Wachstum: Reported-/Owner-Wachstum und Owner-FV sichtbar, NetDebt $4000 M',
          /Reported FCF Basis\s*\d+\.\d%/i.test(gr) && /DCF Fair Value: \$\d/.test(html) && /NetDebt\s*\$4000\s*M/.test(html),
          gr.slice(Math.max(0, gr.search(/Reported FCF Basis/i) - 200), gr.search(/Reported FCF Basis/i) + 400) + ' | '
          + (html.match(/DCF Fair Value:[^<]*/g) || []).join(' ; ') + ' | ' + (html.match(/NetDebt[^·]*/) || [''])[0]);
        const val = await tab('valuation');
        check('11.7 Gegenprobe Bewertung: vereinfachter ROIC mit Stichtag und Zahl',
          /ROIC akt\. \(vereinfacht, 2025-12-31\):\s*\d+\.\d%/.test(val), val.slice(val.indexOf('Historisches Profil') - 50, val.indexOf('Historisches Profil') + 1200));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('12 · Nachreview PR #3: vereinfachter ROIC nur bei belegter Periodenzuordnung (V1.0.78)');
    {
      const snap = `(() => ({ rw: state.quality.descriptive.roicMinusWacc.value, v: state.quality.verdict,
        qce: state.quality.qceScore && state.quality.qceScore.value,
        buy: state.synthesis && state.synthesis.buyPrice, mos: state.synthesis && state.synthesis.mosComponents && state.synthesis.mosComponents.base }))()`;
      const res = {};
      for (const kind of ['mixed', 'reverse', 'legacy']) {
        const status = await importViaUi(FX.roicMixedMj(kind));
        if (!check(`ROIC-Perioden „${kind}“: Import`, /Import OK/.test(status), status)) continue;
        const val = await tab('valuation');
        const i0 = val.search(/Historisches Profil/i);
        const hp = i0 < 0 ? '' : val.slice(i0, i0 + 1500);
        if (kind === 'legacy') {
          check('12.3 periodenfreie Altdaten: ROIC 10.7 % und Trend +2.1pp sichtbar',
            /ROIC akt\. \(vereinfacht\):\s*10\.7%/.test(hp) && /ROIC-Trend \(2 GJ, vereinfacht\):\s*\+2\.1pp/.test(hp), hp);
        } else {
          check(`12.${kind === 'mixed' ? 1 : 2} Mischfall „${kind}“: ROIC „nicht bewertbar“ mit Periodengrund, keine Zahl`,
            /ROIC akt\. \(vereinfacht\):\s*nicht bewertbar/.test(hp) && !/ROIC akt\.[^\n]*\d+\.\d%/.test(hp)
            && (kind === 'mixed' ? /ohne Periodenangabe/ : /EBIT ohne Periodenangabe/).test(hp), hp);
        }
        res[kind] = await ev(snap);
      }
      // „mixed“ unterscheidet sich von „legacy“ nur durch die EBIT-Metadaten; bewertete
      // Pfade (ROIC − WACC, Urteil, Kaufpreis, Basis-MoS) muessen identisch bleiben.
      // („reverse“ aendert ueber die Bestandsperioden auch die Nettoschuldenbruecke —
      // dort gilt der Alt/Neu-Vergleich im Auditbericht.)
      if (res.mixed && res.legacy) {
        check('12.4 keine Wirkung auf ROIC − WACC, Qualitaetsurteil, Kaufpreis und Basis-MoS (Mischfall = Altdaten)',
          ['rw', 'v', 'buy', 'mos'].every(k => res.mixed[k] === res.legacy[k]), JSON.stringify(res));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('13 · Nettoschulden ↔ FCF-Zeitraum und fehlende Liquiditaet in Altdaten (V1.0.80)');
    {
      const status = await importViaUi(FX.diagPeriodMj('stale'));
      if (check('13.0 Nettoschulden zum 2024-12-31 neben FCF FY2025: Import', /Import OK/.test(status), status)) {
        const val = await tab('valuation');
        const diag = val.slice(val.search(/GETRENNTE DIAGNOSE AUF REPORTED-FCF-BASIS/i));
        check('13.1 Bewertung: Reported-/Owner-FCF-Basis ohne Wachstumszahl, Grund „nicht dem FCF-Zeitraum zuordenbar“ mit beiden Daten',
          /REPORTED-FCF-BASIS\s*– \(Nettoschulden nicht dem FCF-Zeitraum zuordenbar \(FCF-Zeitraum endet 2025-12-31[\s\S]{0,80}ist 2024-12-31 — 365 Tage/i.test(diag)
          && !/FCF-BASIS\s*[+-]\d/i.test(diag), diag.slice(0, 1500));
        const gr = await tab('growth');
        const html = await panelHtml('growth');
        check('13.2 Wachstum: Reverse DCF nicht berechenbar mit Periodengrund, kein Growth-Verdict aus Wachstum',
          /Reverse DCF nicht berechenbar: Nettoschulden nicht dem FCF-Zeitraum zuordenbar/.test(gr), gr.slice(0, 4000));
        check('13.3 Wachstum: Owner-FCF-DCF ohne Fair Value, Grund genannt, SBC-Diagnose sichtbar',
          /DCF Fair Value: nicht bestimmbar \(Nettoschulden nicht dem FCF-Zeitraum zuordenbar\)/.test(html) && !/DCF Fair Value: \$/.test(html)
          && !/SBC-Abschlag \(FV\)/.test(html) && /\$160 M/.test(html), gr.slice(0, 6000));
        const st = await ev(`(() => { const r = state.growth.reverseDcfFull; return { rep: r.reverseDcfReported, own: r.reverseDcfOwner, nd: r.inputs.netDebtM,
          b: r.netDebtPeriodBlocked, v: state.growth.verdict, core: r.coreStatus }; })()`);
        check('13.4 Zustand: kein Reported-/Owner-Wachstum, Sperre wegen Periode, Verdict MODEL_UNSUITABLE',
          st.rep == null && st.own == null && st.nd == null && st.b === true && st.v === 'MODEL_UNSUITABLE', JSON.stringify(st));
      }
    }
    {
      const status = await importViaUi(FX.diagPeriodMj('manual'));
      if (check('13.5 vollstaendig periodenfreier Datensatz mit manuellem net_debt: Import', /Import OK/.test(status), status)) {
        const val = await tab('valuation');
        check('13.6 Bewertung: Diagnose rechnet, Zuordnung als Annahme „NICHT geprueft“ ausgewiesen',
          /Nettoschulden ↔ FCF₀\s*Annahme: FCF \(fcf\[0\]\) und Nettoschulden \(net_debt\[0\]\) ohne Periodenangaben[^\n]*NICHT geprueft/i.test(val)
          && /REPORTED-FCF-BASIS\s*[+-]\d+\.\d\d%/i.test(val), val.slice(Math.max(0, val.search(/GETRENNTE DIAGNOSE/i)), val.search(/GETRENNTE DIAGNOSE/i) + 1500));
        await tab('growth');
        const html = await panelHtml('growth');
        check('13.7 Wachstum: Owner-FV sichtbar und Annahme ausgewiesen', /DCF Fair Value: \$\d/.test(html) && /NICHT geprueft/.test(html),
          (html.match(/DCF Fair Value:[^<]*/g) || []).join(' ; '));
      }
    }
    {
      const status = await importViaUi(FX.diagNetDebtMj('valid'));
      if (check('13.8 belegte Nettoschulden zum FCF-Stichtag (Gegenprobe): Import', /Import OK/.test(status), status)) {
        const val = await tab('valuation');
        check('13.9 Bewertung: Zuordnung als geprueft ausgewiesen, keine Annahme',
          /Nettoschulden ↔ FCF₀\s*Stichtag 2025-12-31 zum FCF-Zeitraum bis 2025-12-31 geprueft/i.test(val) && !/NICHT geprueft/.test(val),
          val.slice(Math.max(0, val.search(/GETRENNTE DIAGNOSE/i)), val.search(/GETRENNTE DIAGNOSE/i) + 1500));
      }
    }
    {
      const qs = `(() => { const d = state.quality.descriptive.roicMinusWacc; const c = state.quality.qceScore.components.find(x => x.key === 'roicTrend');
        return { s: d.status, v: d.value, vd: (state.quality.reasons || []).includes('value_destroyer'), ta: c.available, tr: c.reason || null }; })()`;
      const status = await importViaUi(FX.roicLegacyCashMj('null'));
      if (check('13.10 Altdaten mit Liquiditaet 6 × null: Import', /Import OK/.test(status), status)) {
        const q = await tab('quality');
        check('13.11 Qualitaet: ROIC − WACC nicht bewertbar mit Grund, kein Spread −2.2pp',
          /ohne Liquiditätsangabe ausgelassen/.test(q) && !/-2\.2pp|−2\.2pp/.test(q), q.slice(0, 5000));
        const st = await ev(qs);
        check('13.12 Zustand: kein Spread, kein value_destroyer, ROIC-Trend ohne Score mit Grund',
          st.s === 'insufficient_data' && st.v == null && !st.vd && st.ta === false && /nicht als 0 gewertet/.test(st.tr || ''), JSON.stringify(st));
      }
      const status0 = await importViaUi(FX.roicLegacyCashMj('zero'));
      if (check('13.13 Altdaten mit belegter Liquiditaet 0 (Gegenprobe): Import', /Import OK/.test(status0), status0)) {
        const st = await ev(qs);
        check('13.14 echter negativer Spread bleibt: −2.18 pp, value_destroyer',
          st.s === 'ok' && Math.abs(st.v - (75 / 1100 * 100 - 9)) < 1e-9 && st.vd === true, JSON.stringify(st));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('14 · Nettoschulden ↔ Bewertungsbasis in Kern, Synthese und Growth (V1.0.81)');
    {
      const st = `(() => { const d = state.valuation && state.valuation.modelResults && state.valuation.modelResults.dcf;
        const w = (state.synthesis && state.synthesis._modelWeightDiag || []).map(x => x.model);
        const g = state.growth; return { dA: d ? d.applicable : null, dB: d ? d.base : null, dP: d ? d._netDebtPeriodBlocked : null,
          op: d ? d._operatingValuePerShareBase : null, w, gfv: g ? g.growthCases.map(c => c.fairValuePerShare) : null,
          gnd: g ? g.netDebtUnavailable : null, buy: state.synthesis ? state.synthesis.buyPrice : null }; })()`;
      for (const kind of ['stale', 'str']) {
        const status = await importViaUi(FX.corePeriodMj(kind));
        if (!check(`14.${kind} Import`, /Import OK/.test(status), status)) continue;
        const s = await ev(st);
        check(`14.${kind} DCF ohne Eigenkapitalwert, gesperrt wegen Stichtag, operativer Wert erhalten`,
          s.dA === false && s.dB == null && s.dP === true && s.op != null, JSON.stringify(s));
        check(`14.${kind} Synthese gewichtet den DCF nicht`, !s.w.includes('dcf'), JSON.stringify(s.w));
        check(`14.${kind} Growth-Szenarien ohne Fair Value, Grund genannt`,
          s.gfv && s.gfv.every(x => x == null) && /nicht der Bewertungsbasis zuordenbar/.test(s.gnd || ''), JSON.stringify(s));
        const val = await tab('valuation');
        check(`14.${kind} Bewertung nennt den Sperrgrund`, /nicht der Bewertungsbasis zuordenbar/.test(val), val.slice(0, 4000));
        const gr = await tab('growth');
        check(`14.${kind} Wachstum: Weighted Fair Value N/A mit Grund`,
          /nicht der Bewertungsbasis zuordenbar/.test(gr) && !/GROWTH BUY/.test(gr), gr.slice(0, 3000));
      }
      const status = await importViaUi(FX.corePeriodMj('valid'));
      if (check('14.valid Gegenprobe Import', /Import OK/.test(status), status)) {
        const s = await ev(st);
        check('14.valid DCF gewichtet, Growth-Szenarien mit Fair Value',
          s.dA === true && s.dB != null && s.w.includes('dcf') && s.gfv.every(x => x != null), JSON.stringify(s));
        const val = await tab('valuation');
        check('14.valid Bewertung weist die gepruefte Zuordnung aus',
          /Stichtag 2025-12-31 zum Umsatz-Zeitraum bis 2025-12-31 geprueft/.test(val), val.slice(0, 4000));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('15 · Steuerquote bleibt bei „Neu berechnen“ in Prozentpunkten (V1.0.83)');
    {
      // Befund der Praxisabnahme CRH: „Neu berechnen“ ohne Aenderung schrieb
      // tax_rate 21.71 als 0.2171 zurueck; der Kern rechnete danach mit 0,2 %
      // Steuern (DCF 91.68 ⇒ 124.09). Fixture mit tax_rate 25 (Prozentpunkte).
      const st = `({ tax: state.masterJson.valuation.wacc_components.tax_rate,
        core: state.valuation.modelResults.dcf && state.valuation.modelResults.dcf._coreTaxRatePct,
        dcf: state.valuation.modelResults.dcf && state.valuation.modelResults.dcf.base,
        manual: state.manualAssumptionFields.has('tax_rate'), field: document.getElementById('as-tax') && document.getElementById('as-tax').value })`;
      const recalc = async () => {
        await ev('window.__accPrevVal = state.valuation; true');
        await click(byText('#assumptions-output button', '/^\\s*Neu berechnen\\s*$/'), 'Neu berechnen');
        await waitFor('state.valuation !== window.__accPrevVal', 5000);
        await sleep(200);
      };
      const status = await importViaUi(FX.corePeriodMj('valid'));
      if (check('15.1 Import', /Import OK/.test(status), status)) {
        await tab('assumptions');
        const s0 = await ev(st);
        check('15.1 nach dem Import: Steuerquote 25 (Prozentpunkte) im Zustand, im Kern und im Feld',
          s0.tax === 25 && s0.core === 25 && s0.field === '25' && s0.dcf != null && !s0.manual, JSON.stringify(s0));
        await recalc();
        const s1 = await ev(st);
        check('15.2 „Neu berechnen“ ohne Aenderung: Steuerquote, DCF und Herkunft unveraendert',
          s1.tax === 25 && s1.core === 25 && s1.field === '25' && s1.dcf === s0.dcf && !s1.manual, JSON.stringify([s0, s1]));
        await recalc();
        const s2 = await ev(st);
        check('15.3 zweites „Neu berechnen“: weiterhin unveraendert', s2.tax === 25 && s2.dcf === s0.dcf, JSON.stringify(s2));
        // Das Feld steht in der (eingeklappten) Karte „WACC-Komponenten“.
        const waccCard = `Array.from(document.querySelectorAll('#assumptions-output .card-title')).find(e => /WACC-Komponenten/.test(e.textContent))`;
        const openWacc = async () => { if (await ev(`${waccCard}.parentElement.classList.contains('collapsed')`)) await click(waccCard, 'Karte WACC-Komponenten'); };
        await openWacc();
        await typeInto(`document.getElementById('as-tax')`, '0.3', 'Steuerquote');
        await recalc();
        const s3 = await ev(st);
        check('15.4 Eingabe als Bruch 0.3 ⇒ 30 Prozentpunkte, als manuell gefuehrt, DCF sinkt',
          s3.tax === 30 && s3.core === 30 && s3.manual && s3.dcf != null && s3.dcf < s0.dcf, JSON.stringify(s3));
        await openWacc();
        await typeInto(`document.getElementById('as-tax')`, '30', 'Steuerquote');
        await recalc();
        const s4 = await ev(st);
        check('15.5 Eingabe als Prozent 30 ⇒ identisch mit 0.3', s4.tax === 30 && s4.dcf === s3.dcf, JSON.stringify([s3, s4]));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    sec('16 · Kritische Schema-Befunde folgen der Kurseingabe (V1.0.84)');
    {
      // Befund der Praxisabnahme CRH: SEC-Import ohne Yahoo ⇒ C-MKT „market.price
      // fehlt … Valuation blockiert“. Nach Kurseingabe und „Neu berechnen“ blieb
      // der Befund in der Uebersicht stehen, obwohl Kurs und Einstiegszone da waren.
      const m = FX.corePeriodMj('valid');
      m.market = Object.assign({}, m.market, { price: null });
      m.meta = Object.assign({}, m.meta, { _sec_fetch: Object.assign({}, m.meta._sec_fetch || {}, { price_missing: true }) });
      m.valuation = Object.assign({}, m.valuation, { wacc_components: Object.assign({}, m.valuation.wacc_components,
        { risk_free: 0.043, equity_risk_premium: 0.055 }) });
      const MSG = /market\.price fehlt/;
      const status = await importViaUi(m);
      if (check('16.1 Import ohne Kurs (SEC-Fall)', /Import OK/.test(status), status)) {
        const ov0 = await tab('overview');
        const c0 = await ev(`state.v4criticals.slice()`);
        check('16.1 ohne Kurs: C-MKT als kritischer Befund sichtbar', MSG.test(ov0) && c0.some(c => /^C-MKT/.test(c)), JSON.stringify(c0));
        await tab('assumptions');
        await typeInto(`document.getElementById('as-price')`, '25', 'Kurs');
        await ev('window.__accPrevVal = state.valuation; true');
        await click(byText('#assumptions-output button', '/^\\s*Neu berechnen\\s*$/'), 'Neu berechnen');
        await waitFor('state.valuation !== window.__accPrevVal', 5000);
        await sleep(200);
        const ov1 = await tab('overview');
        const c1 = await ev(`({ crits: state.v4criticals.slice(), price: state.masterJson.market.price })`);
        check('16.2 nach Kurseingabe: kein C-MKT mehr im Zustand und in der Uebersicht',
          c1.price === 25 && !c1.crits.some(c => /^C-MKT/.test(c)) && !MSG.test(ov1), JSON.stringify(c1));
        // MoS-Aufschluesselung: „Cap aktiv“ nur bei tatsaechlich greifender Obergrenze.
        const val = await tab('valuation');
        const sd = await ev(`(() => { const s = state.synthesis.safetyDiscount || {}, m = state.synthesis.mosComponents || {};
          return { capActive: s.capActive, total: m.total, additive: m._additiveSum }; })()`);
        const expectCap = sd.capActive === true;
        const expectComp = !expectCap && sd.additive != null && Math.abs(sd.additive - sd.total) > 0.001;
        check('16.3 MoS: „Cap aktiv“ genau dann, wenn die Obergrenze greift; sonst „Komposition“',
          /Cap aktiv \(additiv/.test(val) === expectCap && /Komposition \(additiv/.test(val) === expectComp && (expectCap || expectComp),
          JSON.stringify(sd));
        check('16.4 Datenbasis-Karte: D&A-Beschriftung ohne doppelt maskiertes &',
          !/D&AMP;A|D&amp;A/i.test(val) && /Abschreibungen \(D&A\) \/ Umsatz/i.test(val), (val.match(/Abschreibungen[^\n]*/i) || [''])[0]);
        const as = await tab('assumptions');
        const kursZeile = (as.match(/Kurs \(USD\)[^\n]*(\n[^\n]*){0,3}/) || [''])[0];
        check('16.5 Marktdaten-Tabelle: von Hand gesetzter Kurs nicht als „Yahoo Finance“',
          /manuell eingegeben/.test(kursZeile) && !/Yahoo/.test(kursZeile), kursZeile);
        check('16.6 Marktdaten-Tabelle: Risk-free 4.30 %, ERP 5.50 % (Bruch als Prozent)',
          /Risk-free Rate\s+4\.30 %/.test(as) && /ERP\s+5\.50 %/.test(as), (as.match(/Risk-free Rate[^\n]*\n?[^\n]*/) || [''])[0]);
        check('16.7 Annahmen ohne „undefined“', !/undefined/.test(as), (as.match(/[^\n]*undefined[^\n]*/) || [''])[0]);
        // QCE-Zeile in der Uebersicht (Wert aus qceScore.value), sofern ein Score vorliegt.
        const qv = await ev(`(state.quality && state.quality.qceScore && state.quality.qceScore.value != null) ? state.quality.qceScore.value : null`);
        const ov2 = await tab('overview');
        check('16.8 Uebersicht: Zeile „Qualität und Kapitaleffizienz“ mit dem Engine-Wert',
          qv == null ? !/Qualität und Kapitaleffizienz\s+\d/.test(ov2)
                     : new RegExp('Qualität und Kapitaleffizienz\\s+' + qv.toFixed(1).replace('.', ',') + ' von 10').test(ov2),
          String(qv) + ' · ' + ((ov2.match(/Qualität und Kapitaleffizienz[^\n]*\n?[^\n]*/) || [''])[0]));
      }
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
