// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit (D3): Auditbelege gegen die Originalberichte pruefen
// ───────────────────────────────────────────────────────────────────────────
// evidence/<TICKER>.json nennt je Posten Dokument (Akte), XBRL-Konzept,
// Periode und den im Bericht ANGEZEIGTEN Wert (Tabelleneinheit) samt
// Fundstelle. verifyEvidence() sucht den Posten im unveraenderten
// Originaldokument (cache/filings, geladen mit fetch-filings.mjs) und prueft
// den angezeigten Wert. Textposten (ohne Tag) werden im Dokumenttext gesucht.
// Keine Produktfunktion, keine Rechnung.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFacts } from './ixbrl.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadEvidence(ticker, dir = join(HERE, 'evidence')) {
  const f = join(dir, ticker + '.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

// Originaldokumente je Akte aus dem Manifest von fetch-filings.mjs.
export function filingIndex(cacheDir = join(HERE, 'cache')) {
  const mf = join(cacheDir, 'filings', 'manifest.json');
  if (!existsSync(mf)) return { byAccn: {}, manifest: null };
  const manifest = JSON.parse(readFileSync(mf, 'utf8'));
  const byAccn = {};
  for (const [rel, m] of Object.entries(manifest.files)) {
    if (/index\.json$/.test(rel)) continue;
    (byAccn[m.accn] = byAccn[m.accn] || []).push(Object.assign({ rel, path: join(cacheDir, rel) }, m));
  }
  return { byAccn, manifest };
}

const _parsed = new Map();
export function factsOfAccn(idx, accn) {
  if (_parsed.has(accn)) return _parsed.get(accn);
  const docs = (idx.byAccn[accn] || []).filter(d => existsSync(d.path));
  // Bevorzugt das iXBRL-Hauptdokument; enthaelt es kein Inline-XBRL (aeltere
  // Filings), die XBRL-Instanz desselben Filings.
  let out = null;
  const htm = docs.find(d => /\.htm$/.test(d.rel));
  if (htm) { const text = readFileSync(htm.path, 'utf8'); if (text.includes('<ix:nonFraction')) out = { doc: htm, text }; }
  if (!out) { const x = docs.find(d => /\.xml$/.test(d.rel)); if (x) out = { doc: x, text: readFileSync(x.path, 'utf8'), htmlDoc: htm || null }; }
  if (out) out.facts = parseFacts(out.text);
  _parsed.set(accn, out);
  return out;
}

const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#8217;|&rsquo;/g, '’').replace(/\s+/g, ' ');

// Angezeigter Zahlenwert eines Fakts in der Einheit der Berichtstabelle.
export const shownNumber = (f) => {
  if (f.shown === '—' || f.shown === '-' || f.shown === '') return 0;
  const n = Number(String(f.shown).replace(/[,\s$()]/g, ''));
  return Number.isFinite(n) ? f.sign * n : null;
};

export function verifyEvidence(ev, idx) {
  const res = {};
  for (const it of ev.items) {
    const d = ev.docs[it.doc];
    const r = { id: it.id, where: it.where, expected: it.value, unit: it.unit || null, doc: d, ok: false };
    const F = d ? factsOfAccn(idx, d.accn) : null;
    if (!F) { r.error = 'Originaldokument nicht geladen (fetch-filings.mjs)'; res[it.id] = r; continue; }
    r.file = F.doc.rel; r.sha256 = F.doc.sha256; r.filed = F.doc.filed;
    if (it.text) {
      // Leerraum unberuecksichtigt (iXBRL trennt z. B. „$“ und Betrag in eigene Elemente).
      const T = F.htmlDoc ? readFileSync(F.htmlDoc.path, 'utf8') : F.text;
      const hit = plain(T).replace(/\s+/g, '').includes(it.text.replace(/\s+/g, ''));
      r.ok = hit; r.found = hit ? it.text : null;
      if (!hit) r.error = 'Textstelle nicht gefunden';
      res[it.id] = r; continue;
    }
    const cands = F.facts.filter(x => x.name === it.concept
      && (it.dims ? x.dims.some(dd => dd.includes(it.dims)) : x.dims.length === 0)
      && (it.instant ? x.instant === it.instant : (x.start === it.start && x.end === it.end)));
    const match = cands.find(x => Math.abs(shownNumber(x) - it.value) < 1e-9);
    if (!match) {
      r.error = cands.length ? 'Wert abweichend: ' + cands.map(x => x.shown + (x.sign < 0 ? ' (neg)' : '')).join(' / ') : 'Fakt nicht gefunden';
    } else {
      r.ok = true;
      r.row = match.row; r.decimals = [...new Set(cands.map(x => x.decimals))];
      r.scale = match.scale; r.xbrlValue = match.value;
    }
    res[it.id] = r;
  }
  return res;
}
