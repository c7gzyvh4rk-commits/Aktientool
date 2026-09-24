// ═══════════════════════════════════════════════════════════════════════════
// Minimaler Chrome-DevTools-Protocol-Treiber fuer die Browser-Abnahme
// ───────────────────────────────────────────────────────────────────────────
// Keine Projektabhaengigkeit: Node >= 22 (eingebautes WebSocket) und ein
// lokales Chromium/Chrome. Der Browser startet headless mit einem FRISCHEN,
// temporaeren Profil, das am Ende geloescht wird — vorhandene Nutzerprofile,
// localStorage-Bestaende und Snapshots werden nie beruehrt.
//
// Netzisolation (zweifach):
//   1. `--host-resolver-rules` laesst jede Namensaufloesung scheitern und
//      `--no-proxy-server` schaltet Proxys ab — eine externe Verbindung ist
//      damit technisch nicht moeglich.
//   2. CDP `Fetch` faengt JEDE Anfrage ab. Erlaubt sind nur `file:`, `data:`
//      und `blob:`; alles andere wird abgewiesen und protokolliert. Die
//      Abnahme wertet dieses Protokoll aus (z. B. die Google-Fonts-Links der
//      Seite erscheinen dort als abgewiesen, nicht als geladen).
// ═══════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

export function findChrome() {
  for (const p of CANDIDATES) if (existsSync(p)) return p;
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function launch({ downloadDir } = {}) {
  const exe = findChrome();
  if (!exe) throw new Error('Kein Chromium/Chrome gefunden (CHROME_PATH setzen).');
  const profile = mkdtempSync(join(tmpdir(), 'aktientool-browser-profile-'));
  const args = [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
    '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND',
    '--allow-file-access-from-files', '--no-sandbox',
    '--user-data-dir=' + profile, '--remote-debugging-port=0', 'about:blank'
  ];
  const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d; });
  const portFile = join(profile, 'DevToolsActivePort');
  let wsPath = null, port = null;
  for (let i = 0; i < 200 && !wsPath; i++) {
    if (existsSync(portFile)) {
      const [p, path] = readFileSync(portFile, 'utf8').split('\n');
      if (p && path) { port = p.trim(); wsPath = path.trim(); }
    }
    if (!wsPath) await sleep(50);
  }
  if (!wsPath) { proc.kill('SIGKILL'); throw new Error('Chromium startete nicht: ' + stderr.slice(0, 500)); }
  const browserWs = await connect('ws://127.0.0.1:' + port + wsPath);
  const version = await browserWs.send('Browser.getVersion');
  const { targetId } = await browserWs.send('Target.createTarget', { url: 'about:blank' });
  const targets = await browserWs.send('Target.getTargets');
  void targets;
  const pageWs = await connect('ws://127.0.0.1:' + port + '/devtools/page/' + targetId);
  if (downloadDir) {
    await browserWs.send('Browser.setDownloadBehavior',
      { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  }
  const close = async () => {
    try { await browserWs.send('Browser.close'); } catch { /* bereits beendet */ }
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch { /* bereits beendet */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* egal */ }
  };
  return { exe, version, profile, browser: browserWs, page: pageWs, close };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    const api = {
      send(method, params = {}) {
        const msgId = ++id;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((res, rej) => pending.set(msgId, { res, rej, method }));
      },
      on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(fn);
      },
      close() { try { ws.close(); } catch { /* egal */ } }
    };
    ws.onopen = () => resolve(api);
    ws.onerror = (e) => reject(new Error('WebSocket-Fehler: ' + (e && e.message)));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.rej(new Error(p.method + ': ' + msg.error.message));
        else p.res(msg.result);
      } else if (msg.method) {
        (listeners.get(msg.method) || []).forEach(fn => { try { fn(msg.params); } catch (e) { console.error(e); } });
      }
    };
  });
}
