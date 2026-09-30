// ─────────────────────────────────────────────────────────────────────────────
// Nachreview PR #3 · O-1 (V1.0.78): gemischte Periodenangaben im vereinfachten
// ROIC (computeBaseRateLite → historicProfile, Anzeige „Historisches Profil“).
//
// V1.0.77 nutzte _roicStockMatchers im Standardmodus: Traegt das EBIT Perioden,
// wurden Bestaende OHNE Perioden per Arrayposition gepaart; traegt das EBIT
// keine Perioden, galt fuer alle Reihen Positionsbezug, auch wenn die Bestaende
// Perioden fuehrten. So entstand ein ROIC ohne belegte zeitliche Zuordnung.
// Jetzt: Positionsbezug nur, wenn KEINE der vier Reihen Periodenkontext hat;
// sonst muessen alle vier gueltig datiert und zuordenbar sein.
//
// Sollwerte aus der Definition: Steuer 25 %, EBIT 100 ⇒ NOPAT 75; Eigenkapital
// 500, Schulden 600, Liquiditaet 400 ⇒ IC 700 ⇒ ROIC 10.714 %; Liquiditaet 0 ⇒
// IC 1100 ⇒ 6.818 %; EBIT 80 im Vergleichsjahr ⇒ 60/700 = 8.571 %.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './audit-chat12.mjs';

const S = app();
const close = (a, b, eps = 1e-9) => a != null && Math.abs(a - b) <= eps;
const YE = Array.from({ length: 6 }, (_, i) => `${2025 - i}-12-31`);
const ROIC = 75 / 700 * 100;

// meta: Objekt je Reihe (undefined = kein Metadatenobjekt)
function mj({ meta = {}, cash = 400, ebit = [100, 100, 80, 100, 100, 100] } = {}) {
  const fill = (v) => Array(6).fill(v);
  const f = { revenue: fill(1000), ebit, ebitda: fill(150), capex: fill(50), cfo: fill(130), fcf: fill(80),
    net_income: fill(70), eps_diluted: fill(0.7), shares_diluted: fill(100),
    book_value: fill(500), total_debt: fill(600), cash_and_equivalents: fill(cash), _v4_meta: meta };
  return { meta: { ticker: 'BRP', sub_classification: 'standard_nonfin' }, fundamentals: f, market: { price: 10 },
    valuation: { wacc_derived: 9, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 9, growth_terminal: 2, growth_stage1: 5 } };
}
const P = (p) => ({ periods: p });
const ALL = (p) => ({ ebit: P(p), book_value: P(p), total_debt: P(p), cash_and_equivalents: P(p) });
const hp = (m) => S.computeBaseRateLite(m, S.runQualityEngine(m), null).historicProfile;
const html = (m) => S.buildBaseRateLiteDetailBlock(m, S.runQualityEngine(m), null);

const BLOCKED = [
  ['EBIT mit Perioden, Bestaende ohne Perioden', { ebit: P(YE) }, /Eigenkapital, Finanzschulden, Liquidität/],
  ['Bestaende mit Perioden, EBIT ohne Perioden', { book_value: P(YE), total_debt: P(YE), cash_and_equivalents: P(YE) }, /EBIT ohne Periodenangabe/],
  ['Bestandsperioden als null gefuehrt', { ebit: P(YE), book_value: P(null), total_debt: P(null), cash_and_equivalents: P(null) }, /ohne Periodenangabe/],
  ['nur Liquiditaet ohne Perioden', { ebit: P(YE), book_value: P(YE), total_debt: P(YE) }, /Liquidität/],
  ['ungueltige Kalenderdaten in allen Reihen (2025-02-30)', ALL(YE.map(p => p.slice(0, 4) + '-02-30')), /kein gültiges Kalenderdatum/]
];

for (const [label, meta, why] of BLOCKED) {
  test(`O-1 Mischfall nicht bewertbar: ${label}`, () => {
    const h = hp(mj({ meta }));
    assert.equal(h.roicCurrent, null, 'kein ROIC aus Positionsbezug');
    assert.equal(h.roicTrend, null);
    assert.match(h.roicCurrentReason, why);
    const out = html(mj({ meta }));
    assert.match(out, /ROIC akt\. \(vereinfacht\):<\/span> <span[^>]*>nicht bewertbar/);
    assert.match(out, /Nicht bewertbar: /);
  });
}

test('Gegenprobe: vollstaendige gueltige Perioden ⇒ 10.714 %, Trend +2.143 pp', () => {
  const h = hp(mj({ meta: ALL(YE) }));
  assert.ok(close(h.roicCurrent, ROIC), String(h.roicCurrent));
  assert.ok(close(h.roicTrend, ROIC - 60 / 700 * 100));
  assert.equal(h.roicCurrentPeriod, '2025-12-31');
  assert.match(html(mj({ meta: ALL(YE) })), /ROIC akt\. \(vereinfacht, 2025-12-31\):<\/span> <span[^>]*>10\.7%/);
});

test('Gegenprobe: 52/53-Wochen-Stichtag (Bestaende 2026-01-03, EBIT bis 2025-12-31) bleibt zuordenbar', () => {
  const S3 = YE.map((p, i) => `${2026 - i}-01-03`);
  const h = hp(mj({ meta: { ebit: P(YE), book_value: P(S3), total_debt: P(S3), cash_and_equivalents: P(S3) } }));
  assert.ok(close(h.roicCurrent, ROIC), String(h.roicCurrent));
});

test('Gegenprobe: vollstaendig periodenfreie Altdaten ⇒ Positionsbezug wie bisher', () => {
  const h = hp(mj({ meta: {} }));
  assert.ok(close(h.roicCurrent, ROIC));
  assert.ok(close(h.roicTrend, ROIC - 60 / 700 * 100));
  assert.ok(h.roicCurrentPeriod == null);
});

test('Gegenprobe: belegte Liquiditaet 0 mit gueltigen Perioden bleibt gueltig (6.818 %)', () => {
  const h = hp(mj({ meta: ALL(YE), cash: 0 }));
  assert.ok(close(h.roicCurrent, 75 / 1100 * 100), String(h.roicCurrent));
});

test('Keine Wirkung auf ROIC − WACC und Qualitaetsurteil (Standardzuordnung unveraendert)', () => {
  // Mischfall EBIT mit / Bestaende ohne Perioden gegen vollstaendig periodenfreie Daten:
  // der bewertete ROIC − WACC paart in beiden Faellen positionsweise (bestehende Regel).
  const a = mj({ meta: { ebit: P(YE) } }), b = mj({ meta: {} });
  const qa = S.runQualityEngine(a), qb = S.runQualityEngine(b);
  assert.equal(qa.descriptive.roicMinusWacc.status, 'ok');
  // Median der sechs Jahre: fuenfmal 10.714 %, einmal 8.571 % ⇒ 10.714 %; WACC 9 %.
  assert.ok(close(qa.descriptive.roicMinusWacc.value, ROIC - 9), String(qa.descriptive.roicMinusWacc.value));
  assert.equal(qa.descriptive.roicMinusWacc.value, qb.descriptive.roicMinusWacc.value);
  assert.equal(qa.verdict, qb.verdict);
  assert.equal(S.computeRoicMinusWacc(a).value, S.computeRoicMinusWacc(b).value);
});
