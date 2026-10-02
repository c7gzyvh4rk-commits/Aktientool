// ─────────────────────────────────────────────────────────────────────────────
// V1.0.81 · Nachreview PR #6 (AUDIT §13.18)
//
// 1. Unbrauchbare Periodenmetadaten galten als periodenfreie Altdaten:
//    `_seriesClaimPeriodContext` erkannte nur ein Array als Anspruch. Gemessen auf
//    bad9553: fcf.periods = "2025-12-31", net_debt.periods = "2024-12-31" (oder
//    beide null) ⇒ `unverified_manual`, Reported 15.46 %. Jetzt: ein vorhandenes
//    `periods`-Feld ist beanspruchter Periodenkontext; der verwendete Betrag
//    braucht dann ein gueltiges, zulaessiges Datum.
// 2. Bewertungskern (DCF, Mid-Cycle, Kern-Reverse-DCF, Matrix, Monte Carlo) und
//    Growth-Szenarien nahmen die Nettoschulden ohne Abgleich mit ihrer
//    Bewertungsbasis. Gemessen auf bad9553: net_debt[0] 4,000 zum 2024-12-31
//    neben Umsatz FY2025 ⇒ DCF 23.45 je Aktie (gewichtet 85 %), Reverse DCF
//    18.07 %, Growth-FV 2.11/48.28/141.98. Der Perioden-Gate der Engine
//    (validatePeriodAlignment, Jahresvergleich) erfasst net_debt nicht und
//    keinen Versatz innerhalb desselben Jahres (z. B. 2025-06-30, 2025-11-15).
//
// Regel (eine Pruefung fuer Diagnostik, Kern und Growth:
// _resolveNetDebtForFlowBasis): Stichtag des tatsaechlich verwendeten Betrags am
// Ende der tatsaechlich verwendeten Flussbasis (Kern: revenue[0]; Growth:
// revenue[0] und — falls vorhanden — fcf[0]; Diagnostik: FCF), ≤ 45 Tage.
//
// Sollwerte unabhaengig: refValuePerShare (eigene Formel, tests/audit-chat12.mjs)
// und die Brueckenidentitaet Eigenkapital = operativer Wert − ND / Aktien.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { app, evalInApp, refMj, scOf, refValuePerShare, importSecFacts } from './audit-chat12.mjs';

const S = app();
const CFG = evalInApp('SYNTHESIS_CONFIG');
const YE = (n) => Array.from({ length: n }, (_, i) => `${2025 - i}-12-31`);
const near = (a, b, tol = 1e-9) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;

// ── Kern: Referenzfirma (Umsatz 1,000, Marge 20 %, D&A 5 %, CapEx 5 %, t 25 %,
//    100 Mio. Aktien). Szenario g1 5 %, TG 2 %, WACC 9 %.
const SC = scOf(5, 2, 9, 20);
const opRef = refValuePerShare({ rev0: 1000, marginPct: 20, taxPct: 25, daRatio: 0.05, capexRatio: 0.05,
  owcRatio: 0, g1Pct: 5, tgPct: 2, waccPct: 9, sharesM: 100, netDebtM: 0 }).operatingPerShare;

function coreMj({ revPeriods = YE(4), nd, ndPeriods, td, cash, tdPeriods, derived } = {}) {
  const fo = {};
  const meta = {};
  if (revPeriods !== undefined) meta.revenue = { periods: revPeriods };
  if (nd !== undefined) { fo.net_debt = [nd]; if (ndPeriods !== undefined) meta.net_debt = { periods: ndPeriods }; }
  if (td !== undefined) {
    fo.total_debt = [td]; fo.cash_and_equivalents = [cash];
    if (tdPeriods !== undefined) { meta.total_debt = { periods: tdPeriods }; meta.cash_and_equivalents = { periods: tdPeriods }; }
  }
  fo._v4_meta = meta;
  if (derived) fo.derived = derived;
  return refMj(fo, { wacc_derived: 9, growth_terminal: 2, growth_stage1: 5 }, { price: 10 });
}
function noMetaMj(nd) {
  const m = refMj({ net_debt: [nd] }, { wacc_derived: 9, growth_terminal: 2, growth_stage1: 5 }, { price: 10 });
  return m;
}

function assertCoreComputes(m, nd, check) {
  const ctx = S.buildCoreValuationContext(m);
  assert.equal(ctx.netDebt.available, true, ctx.netDebt.reason);
  assert.equal(ctx.netDebt.netDebtM, nd);
  assert.equal(ctx.netDebt.periodCheck, check);
  const d = S.modelDcf(m, SC);
  assert.equal(d.applicable, true, d.reason);
  assert.ok(near(d._operatingValuePerShareBase, opRef, 1e-6), `operativ ${d._operatingValuePerShareBase} vs ${opRef}`);
  assert.ok(near(d.base, opRef - nd / 100, 1e-6), `Eigenkapital ${d.base} vs ${opRef - nd / 100}`);
  const rev = S.solveReverseDcfGrowth(m);
  assert.equal(rev.status, 'ok', rev.reason);
  return { ctx, d, rev };
}

function assertCoreBlocked(m, reasonRe) {
  const ctx = S.buildCoreValuationContext(m);
  assert.equal(ctx.ok, true);
  assert.equal(ctx.netDebt.available, false);
  assert.equal(ctx.netDebtPerShare, null, 'kein Abzug, keine Ersatznull');
  assert.match(ctx.netDebt.reason, reasonRe);
  const d = S.modelDcf(m, SC);
  assert.equal(d.applicable, false);
  assert.equal(d.base, null);
  assert.equal(d.conservative, null);
  assert.equal(d.optimistic, null);
  assert.equal(d._excludedFromSynthesis, true);
  assert.equal(d._equityValueUnavailable, true);
  assert.equal(d._netDebtPeriodBlocked, true);
  assert.match(d.reason, /nicht der Bewertungsbasis zuordenbar/);
  // Operativer Wert bleibt, eindeutig als solcher gekennzeichnet.
  assert.ok(near(d._operatingValuePerShareBase, opRef, 1e-6));
  assert.ok(d.warnings.some(w => /KEINEN Eigenkapitalwert/.test(w) && /operative/.test(w)));
  const rev = S.solveReverseDcfGrowth(m);
  assert.equal(rev.status, 'net_debt_unknown');
  assert.equal(rev.impliedGrowthPct ?? null, null);
  return { ctx, d, rev };
}

// ══ 1 · Periodenmetadaten: Vorhandensein ≠ Gueltigkeit ═══════════════════════
test('Metadaten: vollstaendig fehlende Perioden ⇒ manuelle Annahme (Gegenprobe), Kontrollrechnung', () => {
  const { ctx, d } = assertCoreComputes(noMetaMj(400), 400, 'unverified_manual');
  assert.match(ctx.netDebt.assumption, /NICHT geprueft/);
  assert.ok(d.warnings.some(w => /Annahme: Umsatz \(revenue\[0\]\) und Nettoschulden/.test(w)));
});

for (const [label, bad] of [['null', null], ['String statt Array', '2025-12-31'], ['leeres Array', []],
                            ['ungueltiges Kalenderdatum', ['2025-02-30']]]) {
  test(`Metadaten „${label}“: Bruecke, Basis bzw. beide ⇒ gesperrt, kein Altdatenmodus`, () => {
    // nur Bruecke betroffen (Basis gueltig)
    assertCoreBlocked(coreMj({ nd: 400, ndPeriods: bad }), /fuehren Periodenangaben, belegen fuer den verwendeten Betrag aber keinen gueltigen Stichtag/);
    // nur Basis betroffen (Bruecke gueltig)
    assertCoreBlocked(coreMj({ revPeriods: bad, nd: 400, ndPeriods: ['2025-12-31'] }),
      /Der Umsatz \(revenue\[0\]\) fuehrt Periodenangaben, belegt aber kein gueltiges Periodenende/);
    // beide betroffen
    assertCoreBlocked(coreMj({ revPeriods: bad, nd: 400, ndPeriods: bad }), /fuehrt Periodenangaben/);
  });
}

test('Metadaten in der FCF-Diagnostik (Nachreview-Faelle): null/String sperren, gueltig passend rechnet', () => {
  const diag = (fp, np) => {
    const f = { fcf: [180], net_debt: [4000], _v4_meta: {} };
    if (fp !== undefined) f._v4_meta.fcf = { periods: fp };
    if (np !== undefined) f._v4_meta.net_debt = { periods: np };
    return S._resolveFcfDiagnosticNetDebt(f, 'fcf');
  };
  assert.equal(diag(['2025-12-31'], ['2024-12-31']).available, false);
  for (const [fp, np] of [[null, null], ['2025-12-31', '2024-12-31'], ['2025-12-31', '2025-12-31'], [[], []],
                          [null, ['2025-12-31']], [['2025-12-31'], null]]) {
    const r = diag(fp, np);
    assert.equal(r.available, false, JSON.stringify([fp, np]));
    assert.notEqual(r.periodCheck, 'unverified_manual');
    assert.match(r.reason, /fuehr(t|en) Periodenangaben/);
  }
  const ok = diag(['2025-12-31'], ['2025-12-31']);
  assert.equal(ok.available, true);
  assert.equal(ok.periodCheck, 'period_checked');
  assert.equal(diag(undefined, undefined).periodCheck, 'unverified_manual');
  // Sperrgrund nennt die tatsaechliche Angabe
  assert.match(diag('2025-12-31', ['2025-12-31']).reason, /periods ist kein Array \(string: "2025-12-31"\)/);
});

test('Metadaten: gueltige passende Perioden rechnen, gueltige unvereinbare sperren (Kern)', () => {
  const { ctx } = assertCoreComputes(coreMj({ nd: 400, ndPeriods: ['2025-12-31'] }), 400, 'period_checked');
  assert.match(ctx.netDebt.periodNote, /Stichtag 2025-12-31 zum Umsatz-Zeitraum bis 2025-12-31 geprueft/);
  assertCoreBlocked(coreMj({ nd: 400, ndPeriods: ['2024-12-31'] }),
    /Umsatz-Zeitraum endet 2025-12-31, Stichtag der Nettoschulden \(net_debt\[0\]\) ist 2024-12-31 — 365 Tage/);
});

test('EV/EBITDA-Bruecke: Korrektur des gemeinsamen Helfers gezielt abgesichert', () => {
  const mb = (ebMeta, ndMeta) => {
    const f = { ebitda: [250], net_debt: [400], _v4_meta: {} };
    if (ebMeta !== undefined) f._v4_meta.ebitda = ebMeta;
    if (ndMeta !== undefined) f._v4_meta.net_debt = ndMeta;
    return S._resolveMultiplesEvBridge(f);
  };
  // neu gesperrt: vorhandene, aber unbrauchbare periods-Angabe
  assert.equal(mb({ periods: null }, { periods: ['2025-12-31'] }).available, false);
  assert.equal(mb({ periods: '2025-12-31' }, { periods: ['2025-12-31'] }).available, false);
  assert.equal(mb({ periods: ['2025-12-31'] }, { periods: '2025-12-31' }).available, false);
  assert.match(mb({ periods: null }, { periods: ['2025-12-31'] }).reason, /Periodenende des EBITDA ist trotz vorhandener Periodenangaben nicht bestimmbar/);
  // unveraendert: gueltig, unvereinbar, beidseitig periodenfrei, einseitig ganz ohne Angabe
  assert.equal(mb({ periods: ['2025-12-31'] }, { periods: ['2025-12-31'] }).available, true);
  assert.equal(mb({ periods: ['2025-12-31'] }, { periods: ['2024-12-31'] }).available, false);
  assert.equal(mb(undefined, undefined).available, true);
  assert.equal(mb(undefined, { periods: ['2025-12-31'] }).available, true, 'bestehende Regel: Seite ganz ohne Angaben');
});

// ══ 2 · Kern und Growth: Stichtag ↔ Bewertungsbasis ══════════════════════════
test('Kern FY gueltig: Kontrollrechnung, belegte 0 und Nettoliquiditaet', () => {
  assertCoreComputes(coreMj({ td: 500, cash: 100, tdPeriods: ['2025-12-31'] }), 400, 'period_checked');
  assertCoreComputes(coreMj({ nd: 0, ndPeriods: ['2025-12-31'] }), 0, 'period_checked');
  assertCoreComputes(coreMj({ nd: -300, ndPeriods: ['2025-12-31'] }), -300, 'period_checked');
  // 52/53-Wochen-Jahr und Toleranzgrenze 45 Tage
  assertCoreComputes(coreMj({ revPeriods: ['2025-12-28', '2024-12-29', '2023-12-31', '2023-01-01'], nd: 400, ndPeriods: ['2025-12-31'] }), 400, 'period_checked');
  assertCoreComputes(coreMj({ nd: 400, ndPeriods: ['2025-11-16'] }), 400, 'period_checked');
});

test('Kern: zu alte, zu junge, unmittelbar unzulaessige und unterjaehrige Bilanz sperren', () => {
  assertCoreBlocked(coreMj({ nd: 400, ndPeriods: ['2025-11-15'] }), /46 Tage Abstand, zulaessig sind 45/);
  assertCoreBlocked(coreMj({ nd: 400, ndPeriods: ['2026-03-31'] }), /90 Tage/);
  assertCoreBlocked(coreMj({ td: 500, cash: 100, tdPeriods: ['2025-06-30'] }), /2025-06-30 — 184 Tage/);
});

test('Kern: net_debt[0] mit falschem oder fehlendem Stichtag umgeht die Pruefung nicht; Ersatzreihe ohne Stichtag', () => {
  // eigener alter Stichtag; total_debt/cash zum 2025-12-31 leihen kein Datum
  const m = coreMj({ td: 500, cash: 100, tdPeriods: ['2025-12-31'], nd: 400, ndPeriods: ['2024-12-31'] });
  assertCoreBlocked(m, /\(net_debt\[0\]\) ist 2024-12-31/);
  // ohne jede Metadaten neben datierter Basis: gemischt
  assertCoreBlocked(coreMj({ nd: 400 }), /der Stichtag der Nettoschulden \(net_debt\[0\]\) ist nicht belegt/);
  // Ersatzreihe mit den Metadaten der ersetzten Reihe: nicht als geprueft
  assertCoreBlocked(coreMj({ nd: 400, ndPeriods: ['2025-12-31'], derived: { net_debt: { override_series: [400] } } }),
    /net_debt \(manuell gesetzte Ersatzreihe\)\) ist nicht belegt/);
});

test('Kern-Verbraucher: Matrix, Monte Carlo, Mid-Cycle und Anzeige ohne gesperrte Werte', () => {
  const m = coreMj({ nd: 400, ndPeriods: ['2024-12-31'] });
  m.fundamentals.revenue = [1000, 1000, 1000, 1000, 1000, 1000];
  m.fundamentals.ebit = [200, 200, 200, 200, 200, 200];
  m.fundamentals.ebitda = [250, 250, 250, 250, 250, 250];
  m.fundamentals.capex = [50, 50, 50, 50, 50, 50];
  m.fundamentals.shares_diluted = [100, 100, 100, 100, 100, 100];
  m.fundamentals._v4_meta.revenue = { periods: YE(6) };
  const v = S.runValuationEngine(m);
  assert.equal(v.error, undefined, v.error);
  const mat = S.computeSensitivityMatrix(m, v);
  assert.equal(mat.available, false);
  assert.equal(mat.equityValueUnavailable, true);
  const mc = S.runMonteCarloDcf(m, v);
  assert.ok(mc && mc._blocked === true, 'Monte Carlo gesperrt');
  for (const k of ['dcf', 'dcf_midcycle']) {
    const r = v.modelResults[k];
    if (r) assert.ok(r.applicable !== true && r.base == null, k + ' liefert keinen Wert');
  }
  const html = S.buildReverseDcfDiagnosticBlock(m, v, []);
  assert.match(html, /nicht der Bewertungsbasis zuordenbar/);
  assert.doesNotMatch(html, /Netto-Schulden \(Mio\.\)<\/span><span class="rdcf-val">400/);
});

// ── Engine + Synthese: Wirkung bis zu Gewichtung, Konfidenz, MoS, Einstiegspreis ──
const Y6 = YE(6);
function engMj(bridge) {
  const f = { revenue: [1000, 800, 640, 512, 410, 328], ebit: [200, 150, 110, 80, 60, 45], ebitda: [240, 185, 140, 105, 80, 62],
    cfo: [230, 170, 125, 90, 70, 52], capex: [50, 40, 32, 26, 20, 16], fcf: [180, 130, 93, 64, 50, 36],
    net_income: [150, 110, 80, 58, 43, 32], eps_diluted: [1.5, 1.1, 0.8, 0.58, 0.43, 0.32],
    book_value: [2000, 1850, 1740, 1660, 1600, 1560], shares_diluted: Array(6).fill(100), sbc: Array(6).fill(20),
    da: [40, 35, 30, 25, 20, 17], dps: Array(6).fill(0.3) };
  const meta = { revenue: { periods: Y6 }, ebit: { periods: Y6 }, ebitda: { periods: Y6 }, fcf: { periods: Y6 },
    cfo: { periods: Y6 }, capex: { periods: Y6 } };
  Object.assign(f, bridge.f); Object.assign(meta, bridge.meta);
  f._v4_meta = meta;
  return { meta: { ticker: 'ENG', sub_classification: 'high_growth' }, fundamentals: f, market: { price: 40 },
    valuation: { wacc_derived: 9, growth_terminal: 3, wacc_components: { tax_rate: 25 }, fade: { enabled: false },
                 cost_of_equity: 10, growth_stage1: 15 } };
}
const dc = (p, scope) => ({ f: { total_debt: [4500], cash_and_equivalents: [500] },
  meta: { total_debt: Object.assign({ periods: [p] }, scope ? { scopeComplete: false, scopeIndeterminateReason: 'Test' } : {}),
          cash_and_equivalents: { periods: [p] } } });
function pipeline(m) {
  const v = S.runValuationEngine(m);
  const qr = S.runQualityEngine(m);
  qr.scores.piotroski = { status: 'ok', value: 8 }; qr.scores.altman = { status: 'ok', value: 3.5 }; qr.hardStops = [];
  const sv = S.synthesizeVerdict(qr); qr.verdict = sv.verdict; qr.reasons = sv.reasons;
  const syn = S.runFairValueSynthesizer(m, v, qr, Object.assign({}, CFG, { _dqResult: S.computeDataQualityScore(m) }));
  S._ensureGrowthAssumptionsBlock(m);
  const g = S.runGrowthCaseEngine(m);
  return { v, syn, g, weights: (syn._modelWeightDiag || []).map(x => x.model + '=' + x.effectiveWeight).join(',') };
}

test('gesperrte Faelle bis Synthese: DCF ungewichtet, Rest neu gewichtet wie bei sonst unbelegter Bruecke', () => {
  const valid = pipeline(engMj(dc('2025-12-31')));
  assert.match(valid.weights, /dcf=/);
  // Referenz: dieselben Daten, Bruecke aus bestehendem Grund gesperrt (Umfang offen).
  const ref = pipeline(engMj(dc('2025-11-15', true)));
  for (const [label, b] of [['46 Tage', dc('2025-11-15')], ['Halbjahr', dc('2025-06-30')]]) {
    const r = pipeline(engMj(b));
    assert.equal(r.v.error, undefined, label + ': Engine-Gate greift hier nicht (gleiches Jahr)');
    const d = r.v.modelResults.dcf;
    assert.equal(d.applicable, false, label);
    assert.equal(d._netDebtPeriodBlocked, true, label);
    assert.doesNotMatch(r.weights, /dcf/, label + ': DCF nicht gewichtet');
    assert.ok(!(r.syn._finalSynthesisModels || []).includes('dcf'), label);
    // gleiche Behandlung wie die bestehende Regel fuer eine unbelegte Bruecke
    assert.equal(r.weights, ref.weights, label);
    assert.equal(r.syn.buyPrice, ref.syn.buyPrice, label);
    // Zahlenwerte der MoS-Komponenten identisch (nur der Begruendungstext unterscheidet sich)
    const num = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => typeof x === 'number'));
    assert.deepEqual(num(r.syn.mosComponents), num(ref.syn.mosComponents), label);
    for (const k of ['dataConfidence', 'modelFitConfidence', 'assumptionConfidence', 'finalValuationConfidence']) {
      assert.equal(r.syn[k], ref.syn[k], label + ' ' + k);
    }
    // Growth: keine Szenario-Werte, keine Rendite, kein Kaufurteil
    assert.ok(r.g.growthCases.every(c => c.fairValuePerShare == null && c.irr == null), label);
    assert.equal(r.g.expectedIrr ?? null, null);
    assert.notEqual(r.g.verdict, 'GROWTH_BUY');
    assert.equal(r.g.growthModuleFairValueActive, null, label + ': null, nicht false (keine Konfidenzdeckelung)');
    assert.match(r.g.netDebtUnavailable, /nicht der Bewertungsbasis zuordenbar/);
  }
  // Fachlich notwendige Folge: ohne DCF verbleibt RIM; Modellabdeckung sinkt.
  assert.ok(ref.syn.modelFitConfidence < valid.syn.modelFitConfidence);
});

test('net_debt[0] mit falschem Stichtag (Engine-Gate erfasst net_debt nicht): bis Synthese gesperrt', () => {
  const r = pipeline(engMj({ f: { net_debt: [4000] }, meta: { net_debt: { periods: ['2024-12-31'] } } }));
  assert.equal(r.v.error, undefined);
  assert.equal(r.v.modelResults.dcf.applicable, false);
  assert.doesNotMatch(r.weights, /dcf/);
  assert.equal(S.solveReverseDcfGrowth(engMj({ f: { net_debt: [4000] }, meta: { net_debt: { periods: ['2024-12-31'] } } })).status, 'net_debt_unknown');
});

test('gueltige vollstaendige Faelle: keine Wertaenderung (Kontrollrechnung, belegte 0, Nettoliquiditaet)', () => {
  for (const [b, nd] of [[dc('2025-12-31'), 4000],
                         [{ f: { total_debt: [500], cash_and_equivalents: [500] }, meta: { total_debt: { periods: [Y6[0]] }, cash_and_equivalents: { periods: [Y6[0]] } } }, 0],
                         [{ f: { total_debt: [100], cash_and_equivalents: [600] }, meta: { total_debt: { periods: [Y6[0]] }, cash_and_equivalents: { periods: [Y6[0]] } } }, -500]]) {
    const r = pipeline(engMj(b));
    const d = r.v.modelResults.dcf;
    assert.equal(d.applicable, true);
    assert.ok(near(d.base, d._operatingValuePerShareBase - nd / 100, 1e-9), `${d.base} vs ${d._operatingValuePerShareBase} − ${nd / 100}`);
    assert.match(r.weights, /dcf=/);
    assert.ok(r.g.growthCases.every(c => c.fairValuePerShare != null));
    assert.equal(r.g.netDebtPeriodCheck, 'period_checked');
  }
});

test('Growth: Basis Umsatz und FCF; gemischte bzw. unbrauchbare FCF-Periode sperrt, ohne FCF nur Umsatz', () => {
  const g = (b, mut) => { const m = engMj(b); if (mut) mut(m); S._ensureGrowthAssumptionsBlock(m); return S.runGrowthCaseEngine(m); };
  const okB = dc('2025-12-31');
  assert.equal(g(okB).netDebtPeriodCheck, 'period_checked');
  assert.match(g(okB).netDebtPeriodNote, /Umsatz-Zeitraum bis 2025-12-31, FCF-Zeitraum bis 2025-12-31/);
  const bad = g(okB, (m) => { m.fundamentals._v4_meta.fcf = { periods: '2025-12-31' }; });
  assert.equal(bad.netDebtUnavailable != null, true);
  assert.match(bad.netDebtUnavailable, /Der FCF \(fcf\[0\]\) fuehrt Periodenangaben/);
  const mixed = g(okB, (m) => { delete m.fundamentals._v4_meta.fcf; });
  assert.match(mixed.netDebtUnavailable, /der Zeitraum des FCF \(fcf\[0\]\) ist nicht belegt/);
  const noFcf = g(okB, (m) => { m.fundamentals.fcf = []; delete m.fundamentals._v4_meta.fcf; });
  assert.equal(noFcf.netDebtUnavailable, null, 'ohne FCF zaehlt nur der Umsatz');
  assert.equal(noFcf.netDebtPeriodCheck, 'period_checked');
});

test('vollstaendig periodenfreie manuelle Daten: Kern und Growth rechnen, Annahme sichtbar', () => {
  const m = engMj({ f: { net_debt: [4000] }, meta: {} });
  m.fundamentals._v4_meta = {};
  const r = pipeline(m);
  const d = r.v.modelResults.dcf;
  assert.equal(d.applicable, true);
  assert.equal(d._netDebtPeriodCheck, 'unverified_manual');
  assert.ok(d.warnings.some(w => /NICHT geprueft/.test(w)));
  assert.equal(r.g.netDebtPeriodCheck, 'unverified_manual');
  assert.match(r.g.netDebtAssumption, /NICHT geprueft/);
  assert.ok(r.g.growthCases.every(c => c.fairValuePerShare != null));
});

// ── Produktive Datenaufbereitung: TTM tatsaechlich ausgewaehlt, FY-Rueckfall ──
const _M6 = 1e6;
const _QEnd = { 1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31' };
const _qF = (n) => (n === 4 ? '10-K' : '10-Q');
const _qD = (y, n) => (n === 4 ? (y + 1) + '-02-15' : y + '-' + String(n * 3 + 2).padStart(2, '0') + '-01');
const _cum4 = (q) => [q, 2 * q, 3 * q, 4 * q];
const _cum3 = (q) => [q, 2 * q, 3 * q];
const _qFlow = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-01-01', end: y + _QEnd[i + 1], val: v * _M6, form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 'f' + y + i }))) } });
const _qInst = (spec) => ({ units: { USD: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  end: y + _QEnd[i + 1], val: v * _M6, form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 'i' + y + i }))) } });
const _qShr = (spec) => ({ units: { shares: Object.keys(spec).flatMap(y => spec[y].map((v, i) => ({
  start: y + '-' + String(i * 3 + 1).padStart(2, '0') + '-01', end: y + _QEnd[i + 1], val: v * _M6,
  form: _qF(i + 1), filed: _qD(+y, i + 1), accn: 's' + y + i }))) } });
const _flat = (v4, v3) => ({ 2022: [v4, v4, v4, v4], 2023: [v4, v4, v4, v4], 2024: [v4, v4, v4, v4], 2025: [v3, v3, v3] });
function ttmFacts() {
  return { 'us-gaap': {
    Revenues:            _qFlow({ 2022: _cum4(250), 2023: _cum4(250), 2024: _cum4(250), 2025: _cum3(375) }),
    OperatingIncomeLoss: _qFlow({ 2022: _cum4(50),  2023: _cum4(50),  2024: _cum4(50),  2025: _cum3(75) }),
    NetIncomeLoss:       _qFlow({ 2022: _cum4(37.5), 2023: _cum4(37.5), 2024: _cum4(37.5), 2025: _cum3(56.25) }),
    NetCashProvidedByUsedInOperatingActivities: _qFlow({ 2022: _cum4(50), 2023: _cum4(50), 2024: _cum4(50), 2025: _cum3(75) }),
    PaymentsToAcquirePropertyPlantAndEquipment: _qFlow({ 2022: _cum4(12.5), 2023: _cum4(12.5), 2024: _cum4(12.5), 2025: _cum3(18.75) }),
    DepreciationDepletionAndAmortization:       _qFlow({ 2022: _cum4(12.5), 2023: _cum4(12.5), 2024: _cum4(12.5), 2025: _cum3(18.75) }),
    CashAndCashEquivalentsAtCarryingValue: _qInst(_flat(100, 100)),
    DebtAndCapitalLeaseObligations:        _qInst(_flat(500, 500)),
    LongTermDebtNoncurrent:                _qInst(_flat(500, 500)),
    LongTermDebtCurrent:                   _qInst(_flat(0, 0)),
    ShortTermBorrowings:                   _qInst(_flat(0, 0)),
    FinanceLeaseLiabilityCurrent:          _qInst(_flat(0, 0)),
    FinanceLeaseLiabilityNoncurrent:       _qInst(_flat(0, 0)),
    AssetsCurrent:       _qInst(_flat(400, 400)),
    LiabilitiesCurrent:  _qInst(_flat(500, 500)),
    StockholdersEquity:  _qInst(_flat(3000, 3000)),
    Assets:              _qInst(_flat(7000, 7000)),
    WeightedAverageNumberOfDilutedSharesOutstanding: _qShr(_flat(100, 100))
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
    { end: '2025-09-30', val: 100 * _M6, form: '10-Q', filed: '2025-11-01' } ] } } } };
}

test('TTM tatsaechlich ausgewaehlt (produktiver Weg) und FY desselben Imports: Kern geprueft, Bruecke 400', () => {
  const m = importSecFacts(ttmFacts(), { ticker: 'TTMC', price: 30 });
  m.valuation.data_basis = 'ttm'; m.valuation.wacc_derived = 9; m.valuation.growth_terminal = 2; m.valuation.growth_stage1 = 5;
  const vw = S.resolveValuationView(m, null);
  assert.equal(vw.basis, 'ttm', (vw.resolved.reasons || []).join(' '));
  const ctx = S.buildCoreValuationContext(vw.mj);
  assert.equal(ctx.ok, true, ctx.reason);
  // Kontrollrechnung: Umsatz TTM = 250 + 3·375 = 1,375 bis 2025-09-30; ND = 500 − 100 zum 2025-09-30.
  assert.equal(ctx.fi.revenue0, 1375);
  assert.equal(ctx.netDebt.netDebtM, 400);
  assert.equal(ctx.netDebt.periodCheck, 'period_checked');
  assert.equal(ctx.netDebt.bridgePeriod, '2025-09-30');
  assert.equal(ctx.netDebt.flowPeriods[0].period, '2025-09-30');
  const v = S.runValuationEngine(m);
  assert.equal(v.dataBasis.selected, 'ttm');
  const d = v.modelResults.dcf;
  assert.ok(d && d.applicable === true, d && d.reason);
  assert.ok(near(d.base, d._operatingValuePerShareBase - 4, 1e-9));
  // FY desselben Imports: Umsatz FY2024 mit Bilanz 2024-12-31
  const mf = JSON.parse(JSON.stringify(m)); mf.valuation.data_basis = 'fy';
  const cf = S.buildCoreValuationContext(mf);
  assert.equal(cf.fi.revenue0, 1000);
  assert.equal(cf.netDebt.periodCheck, 'period_checked');
  assert.equal(cf.netDebt.bridgePeriod, '2024-12-31');
});

test('FY-Rueckfall (TTM angefordert, keine Quartale): Pruefung auf den tatsaechlichen FY-Daten', async () => {
  const { secFactsWithDebt, fullyDocumented, secInst, allYears } = await import('./audit-chat12.mjs');
  const m = importSecFacts(secFactsWithDebt(fullyDocumented({ LongTermDebtNoncurrent: secInst(allYears(500)),
    LongTermDebtCurrent: secInst(allYears(0)) })), { ticker: 'FBK', price: 20 });
  m.valuation.data_basis = 'ttm'; m.valuation.wacc_derived = 9; m.valuation.growth_terminal = 2; m.valuation.growth_stage1 = 5;
  const vw = S.resolveValuationView(m, null);
  assert.equal(vw.basis, 'fy');
  const ctx = S.buildCoreValuationContext(vw.mj);
  assert.equal(ctx.netDebt.netDebtM, 400);
  assert.equal(ctx.netDebt.periodCheck, 'period_checked');
  assert.equal(ctx.netDebt.bridgePeriod, '2025-12-31');
  const v = S.runValuationEngine(m);
  assert.equal(v.modelResults.dcf.applicable, true);
});

// ── Erhaltungstests: nur Werte, keine neuen Felder — muessen vorher (bad9553)
//    und nachher identisch gruen sein (keine unbegruendete Wertaenderung).
test('Erhalt: gueltige FY-Faelle, belegte 0, Nettoliquiditaet und periodenfreie Daten — Werte unveraendert', () => {
  for (const [m, nd] of [[coreMj({ td: 500, cash: 100, tdPeriods: ['2025-12-31'] }), 400],
                         [coreMj({ nd: 0, ndPeriods: ['2025-12-31'] }), 0],
                         [coreMj({ nd: -300, ndPeriods: ['2025-12-31'] }), -300],
                         [coreMj({ nd: 400, ndPeriods: ['2025-11-16'] }), 400],
                         [noMetaMj(400), 400]]) {
    const d = S.modelDcf(m, SC);
    assert.equal(d.applicable, true);
    assert.ok(near(d.base, opRef - nd / 100, 1e-6), `${d.base} vs ${opRef - nd / 100}`);
    assert.equal(S.solveReverseDcfGrowth(m).status, 'ok');
  }
  for (const b of [dc('2025-12-31')]) {
    const r = pipeline(engMj(b));
    assert.match(r.weights, /dcf=/);
    assert.ok(r.g.growthCases.every(c => c.fairValuePerShare != null));
  }
});

test('Erhalt: TTM-Weg und FY-Rueckfall rechnen mit 400 zum jeweiligen Stichtag', async () => {
  const m = importSecFacts(ttmFacts(), { ticker: 'TTME', price: 30 });
  m.valuation.data_basis = 'ttm'; m.valuation.wacc_derived = 9; m.valuation.growth_terminal = 2; m.valuation.growth_stage1 = 5;
  const v = S.runValuationEngine(m);
  assert.equal(v.dataBasis.selected, 'ttm');
  assert.ok(near(v.modelResults.dcf.base, v.modelResults.dcf._operatingValuePerShareBase - 4, 1e-9));
  const { secFactsWithDebt, fullyDocumented, secInst, allYears } = await import('./audit-chat12.mjs');
  const mf = importSecFacts(secFactsWithDebt(fullyDocumented({ LongTermDebtNoncurrent: secInst(allYears(500)),
    LongTermDebtCurrent: secInst(allYears(0)) })), { ticker: 'FBE', price: 20 });
  mf.valuation.data_basis = 'ttm'; mf.valuation.wacc_derived = 9; mf.valuation.growth_terminal = 2; mf.valuation.growth_stage1 = 5;
  const vf = S.runValuationEngine(mf);
  assert.equal(vf.dataBasis.selected, 'fy');
  assert.ok(near(vf.modelResults.dcf.base, vf.modelResults.dcf._operatingValuePerShareBase - 4, 1e-9));
});

test('Abgrenzung: leere, vom Import als „unavailable“ markierte Reihe mit periods: null ist kein Anspruch', () => {
  // Manueller periodenfreier Datensatz nach dem Importweg: total_debt [] mit
  // { source_type: 'unavailable', periods: null } (no current-year debt fact).
  const f = { revenue: [1000], ebitda: [250], fcf: [180], net_debt: [900], total_debt: [],
    _v4_meta: { total_debt: { source_type: 'unavailable', periods: null, scopeComplete: false } } };
  assert.equal(S._seriesClaimPeriodContext(f, ['total_debt']), false);
  assert.equal(S._resolveMultiplesEvBridge(f).available, true);
  assert.equal(S._resolveFcfDiagnosticNetDebt(f, 'fcf').periodCheck, 'unverified_manual');
  // dieselbe Angabe an einer Reihe MIT Wert ist ein Anspruch
  const g = { revenue: [1000], net_debt: [900], _v4_meta: { net_debt: { periods: null } } };
  assert.equal(S._seriesClaimPeriodContext(g, ['net_debt']), true);
});
