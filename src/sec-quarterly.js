'use strict';
/**
 * src/sec-quarterly.js — Normalisierung von SEC-Quartalsdaten (isoliert)
 * ═══════════════════════════════════════════════════════════════════════════
 * Dieser Baustein steht bewusst NEBEN der produktiven Bewertung. Er wird in
 * diesem Schritt von der Anwendung nicht aufgerufen: die Bewertung bleibt auf
 * der bisherigen Jahresbasis (10-K / FY). Zweck ist ausschliesslich, die
 * Quartalsaufbereitung getrennt pruefbar zu machen.
 *
 * Eingabe   SEC-companyfacts-artige Struktur:
 *             { "us-gaap": { <Tag>: { units: { USD: [ fact, ... ] } } } }
 *           fact = { start?, end, val, form, frame?, filed?, accn? }
 *           `start` fehlt bei Stichtagsgroessen (Bilanz), `start`+`end` stehen
 *           bei Zeitraumgroessen (GuV, Kapitalfluss).
 *
 * Ausgabe   Je Feld entweder Einzelquartale (Zeitraumgroessen) oder
 *           Bilanzstichtage (Stichtagsgroessen) — immer mit Herkunft
 *           (Form, Filing-ID/accn, Veroeffentlichungsdatum) und Ableitungsweg.
 *
 * Grundsaetze
 * ───────────
 *  1. 10-Q und 10-K werden gemeinsam ausgewertet (inkl. der Berichtigungen
 *     10-Q/A und 10-K/A). Der Jahreswert aus dem 10-K ist fuer die
 *     Q4-Ableitung zwingend.
 *  2. Einzelquartal oder kumulierter Geschaeftsjahreswert wird an Start, Ende
 *     und Periodendauer entschieden — nicht am Formulartyp und nicht am
 *     `frame`-Feld.
 *  3. Einzelquartale entstehen nur aus kumulierten Werten DESSELBEN
 *     Geschaeftsjahres (Differenz zweier aufeinanderfolgender Kumulierungen);
 *     Q4 = Jahreswert − Neunmonatswert.
 *  4. Stichtagsgroessen werden nie summiert und nie differenziert. Fuer sie
 *     gibt es in diesem Modul keinen additiven Codepfad.
 *  5. Periodenschluessel ist das Geschaeftsjahr (aus dem beobachteten
 *     Geschaeftsjahresende), nicht das Kalenderjahr. Vom Kalenderjahr
 *     abweichende Geschaeftsjahre werden dadurch unterstuetzt.
 *  6. Veroeffentlichungsdatum (`filed`), Filing-ID (`accn`), Formular (`form`)
 *     und Ableitungsweg bleiben an jedem Wert erhalten.
 *  7. Berichtigungen: pro Periode gewinnt die zuletzt VEROEFFENTLICHTE Angabe.
 *     Mit `asOfDate` wird ein ausdruecklicher Datenstichtag gesetzt; spaeter
 *     veroeffentlichte Werte (und Angaben ohne `filed`) werden dann NICHT
 *     uebernommen. Verdraengte Angaben bleiben als `restatement.supersedes`
 *     sichtbar.
 *  8. Luecken und Widersprueche werden gemeldet, nicht gefuellt. Es wird keine
 *     vollstaendige Reihe erfunden; fehlende Quartale erscheinen ausschliesslich
 *     in `gaps`.
 *
 * Einheiten: Werte bleiben unveraendert wie gemeldet (USD, nicht Millionen).
 * Vorzeichen bleiben wie gemeldet (CapEx ist bei SEC ein positiver Abfluss).
 *
 * Keine Abhaengigkeiten, kein DOM, kein globaler Zustand, deterministisch.
 */

const path = require('node:path');

const DAY_MS = 86400000;

// ── Umfang dieses Schrittes ──────────────────────────────────────────────────
// flow    = Zeitraumgroesse (Quartal ableitbar)
// instant = Stichtagsgroesse (nur Bilanzstichtag, niemals summiert)
const SEC_QUARTERLY_FIELDS = Object.freeze({
  revenue:              'flow',     // Umsatz
  operating_income:     'flow',     // operatives Ergebnis
  net_income:           'flow',     // Nettoergebnis
  cfo:                  'flow',     // operativer Cashflow
  capex:                'flow',     // CapEx
  total_debt:           'instant',  // Schulden
  long_term_debt:       'instant',  // Schulden (langfristiger Teil)
  cash_and_equivalents: 'instant',  // Liquiditaet
  current_assets:       'instant',  // operatives Working Capital
  current_liabilities:  'instant'   // operatives Working Capital
});

// Zuordnung auf die Feldnamen der SEC_TAG_MAP der Anwendung. Die Tag-Listen
// werden NICHT kopiert, sondern aus der ausgelieferten HTML-Datei gelesen
// (siehe appTagMap()) — eine zweite Fassung wuerde auseinanderlaufen.
const APP_TAG_FIELD = Object.freeze({
  revenue:              'revenue',
  operating_income:     'ebit',
  net_income:           'net_income',
  cfo:                  'cfo',
  capex:                'capex',
  total_debt:           'total_debt',
  long_term_debt:       'long_term_debt',
  cash_and_equivalents: 'cash_and_equivalents',
  current_assets:       'current_assets',
  current_liabilities:  'current_liabilities'
});

// Beruecksichtigte Formulare: Quartals- und Jahresbericht samt Berichtigungen.
const ACCEPTED_FORMS = Object.freeze(['10-K', '10-Q', '10-K/A', '10-Q/A']);

// Periodendauer in EINSCHLIESSLICH gezaehlten Tagen (Ende − Start + 1).
// Die Fenster ueberschneiden sich nicht; alles ausserhalb bleibt unklassifiziert.
const PERIOD_WINDOWS = Object.freeze([
  { type: 'quarter',      quarters: 1, minDays:  80, maxDays: 100 },
  { type: 'half_year',    quarters: 2, minDays: 160, maxDays: 200 },
  { type: 'nine_months',  quarters: 3, minDays: 250, maxDays: 290 },
  { type: 'fiscal_year',  quarters: 4, minDays: 340, maxDays: 385 }
]);

// Toleranzen (Tage). 52/53-Wochen-Geschaeftsjahre verschieben die Stichtage um
// bis zu einer Woche; Monatsenden um bis zu drei Tage.
const FY_ANCHOR_TOL_DAYS   = 20;  // Ende → Geschaeftsjahr
const QUARTER_ALIGN_TOL_DAYS = 20; // Ende → Quartalsraster
const CUM_START_TOL_DAYS   = 20;  // Beginn einer Kumulierung → Geschaeftsjahresbeginn

// Relative Toleranz beim Wertvergleich (Widerspruch/Berichtigung).
const VALUE_EPS_REL = 1e-9;

// ═════════════════════════════════════════════════════════════════════════════
// Datumshilfen — ausschliesslich UTC, damit das Ergebnis zeitzonenunabhaengig
// und damit reproduzierbar ist.
// ═════════════════════════════════════════════════════════════════════════════
function parseIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

function isoOf(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function daysInMonth(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Periodendauer einschliesslich beider Randtage.
function inclusiveDays(startMs, endMs) {
  return Math.round((endMs - startMs) / DAY_MS) + 1;
}

/**
 * Periodendauer klassifizieren. Rueckgabe { type, quarters, days } oder null.
 */
function classifyPeriodDuration(days) {
  for (const w of PERIOD_WINDOWS) {
    if (days >= w.minDays && days <= w.maxDays) return { type: w.type, quarters: w.quarters, days };
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Geschaeftsjahr
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Nominelles Geschaeftsjahresende als Zeitpunkt eines Jahres.
 */
function fiscalAnchorMs(year, fyEnd) {
  return Date.UTC(year, fyEnd.month - 1, Math.min(fyEnd.day, daysInMonth(year, fyEnd.month)));
}

/**
 * Geschaeftsjahr eines Periodenendes. Das Geschaeftsjahr wird mit dem
 * Kalenderjahr SEINES ENDES benannt (FY2025 endet z. B. am 2025-01-31).
 * Gesucht wird das naechstliegende Geschaeftsjahresende, das nicht wesentlich
 * vor dem Periodenende liegt.
 */
function fiscalYearOf(endMs, fyEnd) {
  const y0 = new Date(endMs).getUTCFullYear();
  let best = null;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const a = fiscalAnchorMs(y, fyEnd);
    if (a < endMs - FY_ANCHOR_TOL_DAYS * DAY_MS) continue;
    if (best === null || a < best.anchorMs) best = { fiscalYear: y, anchorMs: a };
  }
  return best;
}

/**
 * Geschaeftsjahr und Quartalsposition eines Periodenendes.
 * Rueckgabe { fiscalYear, fiscalQuarter, fiscalYearEnd, fiscalYearStart } oder
 * null, wenn das Ende nicht auf dem Quartalsraster des Geschaeftsjahres liegt.
 */
function fiscalPeriodOf(endMs, fyEnd) {
  const fy = fiscalYearOf(endMs, fyEnd);
  if (!fy) return null;
  const months = ((fy.anchorMs - endMs) / DAY_MS) / 30.4375;
  const steps  = Math.round(months / 3);            // 0 = Q4 … 3 = Q1
  if (steps < 0 || steps > 3) return null;
  if (Math.abs(months - steps * 3) > QUARTER_ALIGN_TOL_DAYS / 30.4375) return null;
  const prevAnchor = fiscalAnchorMs(fy.fiscalYear - 1, fyEnd);
  return {
    fiscalYear:      fy.fiscalYear,
    fiscalQuarter:   4 - steps,
    fiscalYearEnd:   isoOf(fy.anchorMs),
    fiscalYearStart: isoOf(prevAnchor + DAY_MS)
  };
}

/**
 * Geschaeftsjahresende aus den Daten bestimmen: haeufigster Monat der
 * beobachteten Jahresperioden (Zeitraum ~1 Jahr) bzw. der 10-K-Stichtage,
 * darin der mittlere Tag. Das Kalenderjahr wird bewusst nicht unterstellt.
 */
function detectFiscalYearEnd(facts, tagsByField, options = {}, asOfMs = null) {
  if (options.fiscalYearEnd && options.fiscalYearEnd.month) {
    return {
      month: options.fiscalYearEnd.month,
      day:   options.fiscalYearEnd.day || daysInMonth(2001, options.fiscalYearEnd.month),
      source: 'option',
      observedEnds: []
    };
  }
  // Gestufte Kandidaten. Der Jahresbericht bestimmt das Geschaeftsjahresende;
  // Jahresperioden aus einem 10-Q (z. B. rollierende Zwoelfmonatswerte) sind
  // nur die letzte Rueckfallebene und duerfen den Jahresbericht nicht
  // ueberstimmen.
  const tiers = [[], [], []];   // 0: 10-K-Jahresperiode · 1: 10-K-Stichtag · 2: sonstige Jahresperiode
  for (const [field, kind] of Object.entries(SEC_QUARTERLY_FIELDS)) {
    const tags = tagsByField[field] || [];
    for (const tag of tags) {
      for (const f of rawFacts(facts, tag)) {
        if (!ACCEPTED_FORMS.includes(f.form)) continue;
        const endMs = parseIsoDate(f.end);
        if (endMs == null) continue;
        // Datenstichtag gilt auch hier: was noch nicht veroeffentlicht war,
        // kann den Periodenkalender nicht bestimmen.
        if (asOfMs != null) {
          const filedMs = parseIsoDate(f.filed);
          if (filedMs == null || filedMs > asOfMs) continue;
        }
        const annualForm = (f.form === '10-K' || f.form === '10-K/A');
        if (kind === 'flow') {
          const startMs = parseIsoDate(f.start);
          if (startMs == null) continue;
          const cls = classifyPeriodDuration(inclusiveDays(startMs, endMs));
          if (!cls || cls.type !== 'fiscal_year') continue;
          tiers[annualForm ? 0 : 2].push(endMs);
        } else if (annualForm) {
          // Bilanzstichtag eines Jahresberichts (auch der Vorjahresstichtag —
          // gleicher Monat/Tag, daher unschaedlich).
          tiers[1].push(endMs);
        }
      }
    }
  }
  const ends = tiers.find(t => t.length > 0);
  if (!ends) return null;
  const byMonth = new Map();
  for (const ms of ends) {
    const m = new Date(ms).getUTCMonth() + 1;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(new Date(ms).getUTCDate());
  }
  let month = null, days = null;
  for (const [m, ds] of [...byMonth.entries()].sort((a, b) => (b[1].length - a[1].length) || (a[0] - b[0]))) {
    month = m; days = ds; break;
  }
  const sortedDays = days.slice().sort((a, b) => a - b);
  const day = sortedDays[Math.floor((sortedDays.length - 1) / 2)];
  return { month, day, source: 'observed', observedEnds: ends.slice().sort((a, b) => b - a).map(isoOf) };
}

// ═════════════════════════════════════════════════════════════════════════════
// Rohdatenzugriff
// ═════════════════════════════════════════════════════════════════════════════
function conceptOf(facts, tag) {
  const ns = facts && facts['us-gaap'];
  return (ns && ns[tag]) ? ns[tag] : null;
}

function unitKeyOf(concept) {
  const units = (concept && concept.units) || {};
  if (units['USD'])        return 'USD';
  if (units['USD/shares']) return 'USD/shares';
  if (units['shares'])     return 'shares';
  const keys = Object.keys(units);
  return keys.length > 0 ? keys[0] : null;
}

function rawFacts(facts, tag) {
  const concept = conceptOf(facts, tag);
  if (!concept) return [];
  const unit = unitKeyOf(concept);
  if (!unit) return [];
  const arr = concept.units[unit];
  return Array.isArray(arr) ? arr : [];
}

// ═════════════════════════════════════════════════════════════════════════════
// Berichtigungsregel
// ═════════════════════════════════════════════════════════════════════════════
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= VALUE_EPS_REL * scale;
}

function provenanceOf(c) {
  return { form: c.form, accn: c.accn != null ? c.accn : null,
           filed: c.filed != null ? c.filed : null,
           frame: c.frame != null ? c.frame : null, tag: c.tag };
}

/**
 * Aus mehreren Angaben zu DERSELBEN Periode die gueltige auswaehlen.
 *
 *   asOfMs == null → die zuletzt veroeffentlichte Angabe gewinnt.
 *   asOfMs != null → Angaben mit spaeterem `filed` und Angaben OHNE `filed`
 *                    werden verworfen (sie lassen sich dem Stichtag nicht
 *                    zuordnen). Es wird also nie ein spaeter veroeffentlichter
 *                    Wert in einen frueheren Datenstichtag uebernommen.
 *
 * Zwei abweichende Werte mit demselben `filed` sind ein Widerspruch: dann wird
 * KEIN Wert gewaehlt (kein stilles Erraten).
 */
function selectByRestatementRule(candidates, asOfMs) {
  const excludedAfterAsOf = [];
  let pool = candidates;
  if (asOfMs != null) {
    pool = [];
    for (const c of candidates) {
      const f = parseIsoDate(c.filed);
      if (f == null || f > asOfMs) { excludedAfterAsOf.push(c); continue; }
      pool.push(c);
    }
  }
  if (pool.length === 0) return { chosen: null, excludedAfterAsOf, conflict: null, supersedes: [] };

  const keyOf = c => {
    const f = parseIsoDate(c.filed);
    return [f == null ? -1 : f, c.accn == null ? '' : String(c.accn)];
  };
  const sorted = pool.slice().sort((a, b) => {
    const ka = keyOf(a), kb = keyOf(b);
    if (kb[0] !== ka[0]) return kb[0] - ka[0];
    if (kb[1] !== ka[1]) return kb[1] < ka[1] ? -1 : 1;
    return 0;
  });
  const chosen = sorted[0];
  const chosenFiled = keyOf(chosen)[0];

  const rivals = sorted.slice(1).filter(c => keyOf(c)[0] === chosenFiled && !sameValue(c.val, chosen.val));
  if (rivals.length > 0) {
    return {
      chosen: null, excludedAfterAsOf, supersedes: [],
      conflict: {
        reason: 'widerspruechliche Angaben mit demselben Veroeffentlichungsdatum',
        values: [chosen, ...rivals].map(c => ({ value: c.val, ...provenanceOf(c) }))
      }
    };
  }
  const supersedes = sorted.slice(1)
    .filter(c => !sameValue(c.val, chosen.val))
    .map(c => ({ value: c.val, ...provenanceOf(c) }));
  return { chosen, excludedAfterAsOf, conflict: null, supersedes };
}

// ═════════════════════════════════════════════════════════════════════════════
// Einordnung einer einzelnen Zeitraumangabe
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Rueckgabe { role:'cumulative'|'discrete', ... } oder { rejected:<grund> }.
 *
 *   cumulative — Beginn faellt (in Toleranz) auf den Geschaeftsjahresbeginn UND
 *                die Anzahl abgedeckter Quartale passt zur Endposition.
 *   discrete   — genau ein Quartal Dauer, Ende auf dem Quartalsraster.
 *
 * Alles andere (rollierende Zwoelfmonatswerte, Halbjahre mit Ende im dritten
 * Quartal, Mehrquartalsbloecke ohne Bezug zum Geschaeftsjahresbeginn) wird
 * ausdruecklich verworfen.
 */
function classifyFlowFact(startMs, endMs, fyEnd) {
  const days = inclusiveDays(startMs, endMs);
  const cls  = classifyPeriodDuration(days);
  if (!cls) return { rejected: 'Periodendauer ausserhalb der Quartals-/Jahresraster', days };
  const pos = fiscalPeriodOf(endMs, fyEnd);
  if (!pos) return { rejected: 'Periodenende nicht auf dem Quartalsraster des Geschaeftsjahres', days };

  const fyStartMs = parseIsoDate(pos.fiscalYearStart);
  const startFitsFyStart = Math.abs(startMs - fyStartMs) <= CUM_START_TOL_DAYS * DAY_MS;

  // Zusaetzliche Konsistenzbedingung: die abgedeckten Quartale muessen zur
  // Endposition im Geschaeftsjahr passen. Bei in sich stimmigen Datumsangaben
  // folgt das bereits aus den nicht ueberlappenden Dauerfenstern (rund 91 Tage
  // Abstand je Stufe gegenueber +/- 40 Tagen Toleranz) — die Bedingung bleibt
  // als ausdrueckliche Absicherung stehen, falls die Fenster spaeter weiter
  // gefasst werden.
  if (startFitsFyStart && cls.quarters === pos.fiscalQuarter) {
    return { role: 'cumulative', through: pos.fiscalQuarter, days, periodType: cls.type, pos };
  }
  if (cls.quarters === 1) {
    return { role: 'discrete', quarter: pos.fiscalQuarter, days, periodType: cls.type, pos };
  }
  return {
    rejected: startFitsFyStart
      ? 'abgedeckte Quartale passen nicht zur Endposition im Geschaeftsjahr'
      : 'Mehrquartalsperiode beginnt nicht zum Geschaeftsjahr',
    days
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Felder normalisieren
// ═════════════════════════════════════════════════════════════════════════════
function pickTag(facts, tags) {
  for (const tag of tags) {
    const arr = rawFacts(facts, tag);
    if (arr.some(f => ACCEPTED_FORMS.includes(f.form) && parseIsoDate(f.end) != null)) {
      return tag;
    }
  }
  return null;
}

function normalizeFlowField(field, facts, tags, fyEnd, asOfMs) {
  const out = {
    field, kind: 'flow', usedTag: null, consideredTags: tags.slice(), unit: null,
    quarters: [], cumulatives: [], gaps: [], conflicts: [], notes: []
  };
  const tag = pickTag(facts, tags);
  if (!tag) { out.notes.push('keine verwertbaren Angaben zu diesem Feld'); return out; }
  out.usedTag = tag;
  out.unit = unitKeyOf(conceptOf(facts, tag));

  // 1. Rohangaben einordnen (Kumulierung vs. Einzelquartal)
  const cumBuckets  = new Map();  // "fy|through" → Kandidaten
  const discBuckets = new Map();  // "fy|quarter"  → Kandidaten
  for (const f of rawFacts(facts, tag)) {
    if (!ACCEPTED_FORMS.includes(f.form)) continue;
    const endMs = parseIsoDate(f.end);
    const startMs = parseIsoDate(f.start);
    if (endMs == null) continue;
    if (startMs == null) {
      out.notes.push(`Stichtagsangabe unter einer Zeitraumgroesse verworfen (${f.end})`);
      continue;
    }
    if (typeof f.val !== 'number' || !isFinite(f.val)) {
      out.notes.push(`nicht numerischer Wert verworfen (${f.start}…${f.end})`);
      continue;
    }
    const cls = classifyFlowFact(startMs, endMs, fyEnd);
    if (cls.rejected) { out.notes.push(`${f.start}…${f.end} (${cls.days} Tage): ${cls.rejected}`); continue; }
    const cand = { val: f.val, start: f.start, end: f.end, days: cls.days, periodType: cls.periodType,
                   form: f.form, accn: f.accn, filed: f.filed, frame: f.frame, tag, pos: cls.pos };
    if (cls.role === 'cumulative') {
      const k = `${cls.pos.fiscalYear}|${cls.through}`;
      if (!cumBuckets.has(k)) cumBuckets.set(k, []);
      cumBuckets.get(k).push(cand);
      // Die Kumulierung ueber ein Quartal IST das erste Quartal; sie wird
      // unten als gemeldetes Q1 verwendet (kein zweiter Behaelter, sonst
      // wuerde derselbe Widerspruch doppelt gemeldet).
    } else {
      const k = `${cls.pos.fiscalYear}|${cls.quarter}`;
      if (!discBuckets.has(k)) discBuckets.set(k, []);
      discBuckets.get(k).push(cand);
    }
  }

  // 2. Je Periode die gueltige Angabe waehlen (Berichtigungsregel)
  const cumSel = new Map(), discSel = new Map();
  for (const [k, cands] of cumBuckets) {
    const sel = selectByRestatementRule(cands, asOfMs);
    if (sel.conflict) { out.conflicts.push({ scope: 'kumuliert', key: k, ...sel.conflict }); continue; }
    if (sel.chosen) cumSel.set(k, { ...sel.chosen, supersedes: sel.supersedes });
  }
  for (const [k, cands] of discBuckets) {
    const sel = selectByRestatementRule(cands, asOfMs);
    if (sel.conflict) { out.conflicts.push({ scope: 'Einzelquartal', key: k, ...sel.conflict }); continue; }
    if (sel.chosen) discSel.set(k, { ...sel.chosen, supersedes: sel.supersedes });
  }

  for (const [k, c] of [...cumSel.entries()].sort((a, b) => b[1].end.localeCompare(a[1].end))) {
    out.cumulatives.push({
      fiscalYear: c.pos.fiscalYear, throughQuarter: Number(k.split('|')[1]),
      periodKey: `FY${c.pos.fiscalYear}-YTD${k.split('|')[1]}`,
      start: c.start, end: c.end, durationDays: c.days, periodType: c.periodType,
      value: c.val, unit: out.unit, source: provenanceOf(c),
      restatement: { restated: c.supersedes.length > 0, supersedes: c.supersedes }
    });
  }

  // 3. Einzelquartale: gemeldet bevorzugt, sonst aus kompatibler Kumulierung
  const years = new Set();
  for (const k of cumSel.keys())  years.add(Number(k.split('|')[0]));
  for (const k of discSel.keys()) years.add(Number(k.split('|')[0]));

  const quarters = [];
  const gaps = [];
  for (const fy of [...years].sort((a, b) => b - a)) {
    for (let q = 1; q <= 4; q++) {
      const cumThis = cumSel.get(`${fy}|${q}`) || null;
      // Q1 ist zugleich die Kumulierung ueber ein Quartal — ein ausdruecklich
      // gemeldetes Einzelquartal geht vor.
      const rep = discSel.get(`${fy}|${q}`) || (q === 1 ? cumThis : null);
      const cumPrev = q > 1 ? (cumSel.get(`${fy}|${q - 1}`) || null) : null;

      // Ableitung nur aus zwei kompatiblen Kumulierungen desselben
      // Geschaeftsjahres (Q4 = Jahreswert − Neunmonatswert).
      let derived = null;
      if (q > 1 && cumThis && cumPrev) {
        const filedMs = [cumThis.filed, cumPrev.filed].map(parseIsoDate);
        const known = (filedMs[0] == null || filedMs[1] == null)
          ? null
          : isoOf(Math.max(filedMs[0], filedMs[1]));
        derived = {
          value: cumThis.val - cumPrev.val,
          start: cumPrev.end,   // vorlaeufig; unten auf Folgetag gesetzt
          end:   cumThis.end,
          filed: known,
          minuend:    { value: cumThis.val, start: cumThis.start, end: cumThis.end, ...provenanceOf(cumThis) },
          subtrahend: { value: cumPrev.val, start: cumPrev.start, end: cumPrev.end, ...provenanceOf(cumPrev) }
        };
        derived.start = isoOf(parseIsoDate(cumPrev.end) + DAY_MS);
      } else if (q === 1 && cumThis) {
        derived = null; // Q1 ist die Kumulierung selbst und steht bereits als `rep`
      }

      if (!rep && !derived) {
        // Nur innerhalb der beobachteten Spanne als Luecke melden — es wird
        // nichts ergaenzt, nur benannt.
        gaps.push({
          fiscalYear: fy, fiscalQuarter: q, periodKey: `FY${fy}-Q${q}`,
          reason: (q > 1 && (cumThis || cumPrev))
            ? 'kumulierte Gegenperiode desselben Geschaeftsjahres fehlt'
            : 'weder gemeldetes Quartal noch kompatible Kumulierung'
        });
        continue;
      }

      let entry;
      if (rep) {
        entry = {
          fiscalYear: fy, fiscalQuarter: q, periodKey: `FY${fy}-Q${q}`,
          start: rep.start, end: rep.end, durationDays: rep.days,
          fiscalYearEnd: rep.pos.fiscalYearEnd,
          value: rep.val, unit: out.unit, basis: 'reported',
          source: provenanceOf(rep),
          derivation: null,
          restatement: { restated: rep.supersedes.length > 0, supersedes: rep.supersedes },
          conflict: null
        };
        if (derived && !sameValue(derived.value, rep.val)) {
          // Gemeldet und abgeleitet widersprechen sich: der gemeldete Wert
          // bleibt stehen (er ist nicht gerechnet), der Widerspruch wird
          // ausgewiesen statt stillschweigend aufgeloest.
          entry.conflict = {
            reason: 'gemeldetes Quartal weicht von der Differenz der Kumulierungen ab',
            derivedValue: derived.value, reportedMinusDerived: rep.val - derived.value,
            derivedFrom: { minuend: derived.minuend, subtrahend: derived.subtrahend }
          };
          out.conflicts.push({ scope: 'Einzelquartal', key: `${fy}|${q}`, ...entry.conflict });
        }
      } else {
        entry = {
          fiscalYear: fy, fiscalQuarter: q, periodKey: `FY${fy}-Q${q}`,
          start: derived.start, end: derived.end,
          durationDays: inclusiveDays(parseIsoDate(derived.start), parseIsoDate(derived.end)),
          fiscalYearEnd: cumThis.pos.fiscalYearEnd,
          value: derived.value, unit: out.unit, basis: 'derived',
          // Herkunft eines abgeleiteten Wertes: er ist erst bekannt, wenn BEIDE
          // Kumulierungen veroeffentlicht sind — daher das spaetere `filed`.
          source: { form: `${derived.minuend.form} − ${derived.subtrahend.form}`,
                    accn: null, filed: derived.filed, frame: null, tag },
          derivation: {
            method: q === 4 ? 'fiscal_year_minus_nine_months' : 'cumulative_difference',
            formula: `FY${fy}-YTD${q} − FY${fy}-YTD${q - 1}`,
            minuend: derived.minuend, subtrahend: derived.subtrahend
          },
          restatement: {
            restated: (cumThis.supersedes.length + cumPrev.supersedes.length) > 0,
            supersedes: [...cumThis.supersedes, ...cumPrev.supersedes]
          },
          conflict: null
        };
      }
      quarters.push(entry);
    }
  }

  quarters.sort((a, b) => b.end.localeCompare(a.end));
  // Luecken nur innerhalb der tatsaechlich belegten Spanne melden — ausserhalb
  // gibt es schlicht keine Daten, das ist keine Luecke.
  if (quarters.length > 0) {
    const ord = e => e.fiscalYear * 4 + e.fiscalQuarter;
    const max = Math.max(...quarters.map(ord)), min = Math.min(...quarters.map(ord));
    out.gaps = gaps.filter(g => { const o = g.fiscalYear * 4 + g.fiscalQuarter; return o > min && o < max; })
                   .sort((a, b) => (b.fiscalYear * 4 + b.fiscalQuarter) - (a.fiscalYear * 4 + a.fiscalQuarter));
  }
  out.quarters = quarters;
  return out;
}

function normalizeInstantField(field, facts, tags, fyEnd, asOfMs) {
  const out = {
    field, kind: 'instant', usedTag: null, consideredTags: tags.slice(), unit: null,
    instants: [], conflicts: [], notes: []
  };
  const tag = pickTag(facts, tags);
  if (!tag) { out.notes.push('keine verwertbaren Angaben zu diesem Feld'); return out; }
  out.usedTag = tag;
  out.unit = unitKeyOf(conceptOf(facts, tag));

  // Stichtagsgroessen: je Bilanzstichtag genau ein Wert. Es gibt hier weder
  // eine Summe noch eine Differenz — nur Auswahl.
  const buckets = new Map();
  for (const f of rawFacts(facts, tag)) {
    if (!ACCEPTED_FORMS.includes(f.form)) continue;
    const endMs = parseIsoDate(f.end);
    if (endMs == null) continue;
    if (f.start != null && parseIsoDate(f.start) != null) {
      out.notes.push(`Zeitraumangabe unter einer Stichtagsgroesse verworfen (${f.start}…${f.end})`);
      continue;
    }
    if (typeof f.val !== 'number' || !isFinite(f.val)) {
      out.notes.push(`nicht numerischer Wert verworfen (${f.end})`);
      continue;
    }
    const pos = fiscalPeriodOf(endMs, fyEnd);
    if (!pos) { out.notes.push(`Stichtag ${f.end} liegt nicht auf dem Quartalsraster`); continue; }
    const k = `${pos.fiscalYear}|${pos.fiscalQuarter}|${f.end}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push({ val: f.val, end: f.end, form: f.form, accn: f.accn,
                          filed: f.filed, frame: f.frame, tag, pos });
  }

  for (const [k, cands] of buckets) {
    const sel = selectByRestatementRule(cands, asOfMs);
    if (sel.conflict) { out.conflicts.push({ scope: 'Stichtag', key: k, ...sel.conflict }); continue; }
    if (!sel.chosen) continue;
    const c = sel.chosen;
    out.instants.push({
      fiscalYear: c.pos.fiscalYear, fiscalQuarter: c.pos.fiscalQuarter,
      periodKey: `FY${c.pos.fiscalYear}-Q${c.pos.fiscalQuarter}`,
      date: c.end, fiscalYearEnd: c.pos.fiscalYearEnd,
      value: c.val, unit: out.unit, basis: 'reported',
      source: provenanceOf(c),
      restatement: { restated: sel.supersedes.length > 0, supersedes: sel.supersedes }
    });
  }
  out.instants.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tag-Listen der Anwendung
// ═════════════════════════════════════════════════════════════════════════════
const APP_FILE = path.join(__dirname, '..',
  'us-aktienbewertungstool-v1036-sector-classification-patch.html');

let _appTagMapCache = null;

/**
 * SEC_TAG_MAP aus der ausgelieferten HTML-Datei lesen und auf den Umfang
 * dieses Moduls einschraenken. Bewusst KEINE zweite Fassung der Tag-Listen.
 */
function appTagMap(appFile) {
  if (!appFile && _appTagMapCache) return _appTagMapCache;
  const core = require('./dcf-core.js');
  const lines = core.readAppScript(appFile || APP_FILE).split('\n');
  const src = core.grabDeclaration(lines, 'SEC_TAG_MAP');
  // eslint-disable-next-line no-new-func
  const map = new Function(`${src}; return SEC_TAG_MAP;`)();
  const out = {};
  for (const [field, appField] of Object.entries(APP_TAG_FIELD)) {
    const tags = map[appField];
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error(`SEC_TAG_MAP.${appField} fehlt oder ist leer (benoetigt fuer ${field})`);
    }
    out[field] = tags.slice();
  }
  if (!appFile) _appTagMapCache = out;
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// Oeffentliche Schnittstelle
// ═════════════════════════════════════════════════════════════════════════════
/**
 * normalizeSecQuarters(facts, options)
 *
 * options:
 *   asOfDate       'YYYY-MM-DD' | null — ausdruecklicher Datenstichtag.
 *                  Spaeter veroeffentlichte Angaben werden nicht uebernommen.
 *   fiscalYearEnd  { month, day } | null — erzwungenes Geschaeftsjahresende.
 *                  Ohne Angabe wird es aus den Daten bestimmt.
 *   tags           { feld: [tag, ...] } | null — Tag-Listen. Ohne Angabe
 *                  werden die der Anwendung gelesen (appTagMap()).
 *   fields         [feld, ...] | null — Teilmenge des Umfangs.
 */
function normalizeSecQuarters(facts, options = {}) {
  const warnings = [];
  const asOfDate = options.asOfDate || null;
  let asOfMs = null;
  if (asOfDate != null) {
    asOfMs = parseIsoDate(asOfDate);
    if (asOfMs == null) {
      return { ok: false, reason: `asOfDate ist kein gueltiges Datum: ${asOfDate}`,
               fiscalYearEnd: null, asOfDate, fields: {}, warnings };
    }
  }
  if (!facts || !facts['us-gaap']) {
    return { ok: false, reason: 'keine us-gaap-Facts uebergeben',
             fiscalYearEnd: null, asOfDate, fields: {}, warnings };
  }

  const tagsByField = options.tags || appTagMap(options.appFile);
  const fields = options.fields || Object.keys(SEC_QUARTERLY_FIELDS);
  for (const f of fields) {
    if (!SEC_QUARTERLY_FIELDS[f]) {
      return { ok: false, reason: `Feld ausserhalb des Umfangs: ${f}`,
               fiscalYearEnd: null, asOfDate, fields: {}, warnings };
    }
  }

  const fyEnd = detectFiscalYearEnd(facts, tagsByField, options, asOfMs);
  if (!fyEnd) {
    // Ohne Geschaeftsjahresende ist kein belastbarer Periodenschluessel
    // moeglich. Dann wird nichts geraten und nichts geliefert.
    return { ok: false, reason: 'Geschaeftsjahresende nicht bestimmbar (kein Jahreswert und kein 10-K-Stichtag)',
             fiscalYearEnd: null, asOfDate, fields: {}, warnings };
  }

  const out = {};
  for (const field of fields) {
    const tags = tagsByField[field] || [];
    if (tags.length === 0) { warnings.push(`keine Tags fuer ${field}`); continue; }
    out[field] = SEC_QUARTERLY_FIELDS[field] === 'flow'
      ? normalizeFlowField(field, facts, tags, fyEnd, asOfMs)
      : normalizeInstantField(field, facts, tags, fyEnd, asOfMs);
    if (out[field].conflicts.length > 0) {
      warnings.push(`${field}: ${out[field].conflicts.length} widerspruechliche Periode(n)`);
    }
    if (SEC_QUARTERLY_FIELDS[field] === 'flow' && out[field].gaps.length > 0) {
      warnings.push(`${field}: ${out[field].gaps.length} Luecke(n) in der Quartalsreihe`);
    }
  }

  return {
    ok: true,
    fiscalYearEnd: { month: fyEnd.month, day: fyEnd.day, source: fyEnd.source,
                     label: `${String(fyEnd.month).padStart(2, '0')}-${String(fyEnd.day).padStart(2, '0')}`,
                     observedEnds: fyEnd.observedEnds },
    asOfDate,
    fields: out,
    warnings
  };
}

module.exports = {
  SEC_QUARTERLY_FIELDS,
  APP_TAG_FIELD,
  ACCEPTED_FORMS,
  PERIOD_WINDOWS,
  APP_FILE,
  parseIsoDate,
  isoOf,
  inclusiveDays,
  classifyPeriodDuration,
  fiscalYearOf,
  fiscalPeriodOf,
  detectFiscalYearEnd,
  classifyFlowFact,
  selectByRestatementRule,
  appTagMap,
  normalizeSecQuarters
};
