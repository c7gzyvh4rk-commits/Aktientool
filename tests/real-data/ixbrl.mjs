// ═══════════════════════════════════════════════════════════════════════════
// Realdaten-Audit (D3): Inline-XBRL-Fakten aus einem Original-10-K/10-Q lesen
// ───────────────────────────────────────────────────────────────────────────
// Unabhaengig vom Produktcode. Liest aus dem unveraenderten Hauptdokument
// (iXBRL-HTML) jedes ix:nonFraction mit Name, Kontext (Periode, Dimensionen),
// angezeigtem Text, scale, decimals und sign sowie dem Text der Tabellenzeile,
// in der der Wert steht (Zeilenbeschriftung als Fundstelle). Keine Rechnung,
// keine Auswahl: die Kontrollrechnung entscheidet selbst, welcher Fakt gilt.
// ═══════════════════════════════════════════════════════════════════════════

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#160;': ' ', '&#8217;': '’', '&#8211;': '–', '&#8212;': '—' };
const decode = s => s.replace(/&[#\w]+;/g, m => ENT[m] ?? (m.startsWith('&#') ? String.fromCharCode(parseInt(m.slice(2, -1), 10)) : m));
const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, n) => { const m = tag.match(new RegExp('\\s' + n + '="([^"]*)"')); return m ? m[1] : null; };

export function parseContexts(html) {
  const ctx = {};
  const re = /<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g;
  let m;
  while ((m = re.exec(html))) {
    const body = m[2];
    const inst = body.match(/<xbrli:instant>([^<]+)</);
    const st = body.match(/<xbrli:startDate>([^<]+)</), en = body.match(/<xbrli:endDate>([^<]+)</);
    const dims = [];
    const dre = /<xbrldi:explicitMember dimension="([^"]+)">([^<]+)</g;
    let d; while ((d = dre.exec(body))) dims.push(d[1] + '=' + d[2].trim());
    const tre = /<xbrldi:typedMember dimension="([^"]+)">/g;
    while ((d = tre.exec(body))) dims.push(d[1] + '=typed');
    ctx[m[1]] = inst ? { instant: inst[1].trim(), dims } : { start: st && st[1].trim(), end: en && en[1].trim(), dims };
  }
  return ctx;
}

// Zeilentext: letzte <tr ...> vor dem Fakt bis zum naechsten </tr>.
function rowLabel(html, pos) {
  const trStart = html.lastIndexOf('<tr', pos);
  const tblStart = html.lastIndexOf('<table', pos);
  const inTable = tblStart >= 0 && html.lastIndexOf('</table>', pos) < tblStart;
  if (!inTable || trStart < tblStart) {
    // Fliesstext (Anhang): kurzer Textausschnitt vor dem Wert als Fundstelle.
    return 'Text: …' + strip(html.slice(Math.max(0, pos - 1500), pos)).slice(-110);
  }
  const trEnd = html.indexOf('</tr>', pos);
  if (trEnd < 0) return null;
  const cells = html.slice(trStart, trEnd).split(/<td[^>]*>/).map(strip).filter(Boolean);
  return cells.find(c => /[A-Za-z]/.test(c)) || null;
}

export function parseIxFacts(html) {
  const contexts = parseContexts(html);
  const facts = [];
  const re = /<ix:nonFraction([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1];
    const shown = strip(m[2]);
    const scale = Number(attr(tag, 'scale') || 0);
    const sign = attr(tag, 'sign') === '-' ? -1 : 1;
    const fmt = attr(tag, 'format') || '';
    let num;
    if (/zerodash|fixed-zero/.test(fmt) || shown === '—' || shown === '-') num = 0;
    else num = Number(shown.replace(/[,\s$()]/g, ''));
    const c = contexts[attr(tag, 'contextRef')] || {};
    facts.push({
      name: attr(tag, 'name'), context: attr(tag, 'contextRef'), unit: attr(tag, 'unitRef'),
      shown, scale, decimals: attr(tag, 'decimals'), sign,
      value: Number.isFinite(num) ? sign * num * Math.pow(10, scale) : null,
      start: c.start || null, end: c.end || null, instant: c.instant || null, dims: c.dims || [],
      row: rowLabel(html, m.index), id: attr(tag, 'id'),
    });
  }
  return facts;
}

// Fakten ohne Dimensionen (Konzernwerte) zu einem Namen, optional gefiltert.
export function pick(facts, name, { start, end, instant, dims = false } = {}) {
  return facts.filter(f => f.name === name
    && (dims || f.dims.length === 0)
    && (start === undefined || f.start === start)
    && (end === undefined || f.end === end)
    && (instant === undefined || f.instant === instant));
}

// Klassische XBRL-Instanz (aeltere Filings ohne Inline-XBRL). Gleiche
// Fakt-Struktur wie parseIxFacts; `shown` ist der Rohwert, `row` nennt die
// Instanz als Fundstelle (keine Tabellenzeile verfuegbar).
export function parseXbrlInstance(xml) {
  const ctx = {};
  const cre = /<(?:xbrli:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:xbrli:)?context>/g;
  let m;
  while ((m = cre.exec(xml))) {
    const b = m[2];
    const inst = b.match(/<(?:xbrli:)?instant>([^<]+)</);
    const st = b.match(/<(?:xbrli:)?startDate>([^<]+)</), en = b.match(/<(?:xbrli:)?endDate>([^<]+)</);
    const dims = [];
    const dre = /<xbrldi:(?:explicit|typed)Member[^>]*dimension="([^"]+)"[^>]*>([^<]*)</g;
    let d; while ((d = dre.exec(b))) dims.push(d[1] + '=' + d[2].trim());
    ctx[m[1]] = inst ? { instant: inst[1].trim(), dims } : { start: st && st[1].trim(), end: en && en[1].trim(), dims };
  }
  const facts = [];
  const fre = /<((?:us-gaap|dei|[a-z]{2,6}):[A-Za-z0-9_]+)\b([^>]*\bcontextRef="[^"]+"[^>]*)>([^<]*)<\/\1>/g;
  while ((m = fre.exec(xml))) {
    const tag = m[2];
    const c = ctx[attr(tag, 'contextRef')] || {};
    const num = Number(m[3].trim());
    facts.push({ name: m[1], context: attr(tag, 'contextRef'), unit: attr(tag, 'unitRef'), shown: m[3].trim(),
      scale: 0, decimals: attr(tag, 'decimals'), sign: 1, value: Number.isFinite(num) ? num : null,
      start: c.start || null, end: c.end || null, instant: c.instant || null, dims: c.dims || [],
      row: 'XBRL-Instanz (Filing ohne Inline-XBRL)', id: attr(tag, 'id') });
  }
  return facts;
}

// Fakten eines Originaldokuments (iXBRL-HTML oder klassische Instanz).
export function parseFacts(text) {
  return text.includes('<ix:nonFraction') ? parseIxFacts(text) : parseXbrlInstance(text);
}
