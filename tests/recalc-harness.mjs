// ═══════════════════════════════════════════════════════════════════════════
// Testhilfe: produktiver Ablauf Import → Annahmen → „Neu berechnen“ ohne Browser.
//
// Laedt den ausgelieferten <script>-Block wie tests/audit-chat12.mjs, aber mit
// einer einfachen DOM-Attrappe: getElementById liefert fuer jede id ein
// Element (value, innerHTML, …). Ablauf wie in der Oberflaeche:
//   * importMasterJsonFromTextarea() liest das Feld import-master-json,
//   * renderAssumptions() schreibt das Formular als HTML; die Werte der
//     <input id="as-…"> werden daraus in die Elemente uebernommen — genau die
//     Werte, die der Nutzer im Reiter Annahmen sieht,
//   * recalcFromAssumptions() ist der Klick auf „Neu berechnen“; danach wird
//     das neu gerenderte Formular wieder eingelesen.
// Es wird keine Produktlogik nachgebaut. Die Browser-Abnahme
// (tests/browser/acceptance.mjs) prueft denselben Ablauf mit echten Klicks.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { APP_FILE } from './audit-chat12.mjs';

function makeElement(id) {
  return {
    id, value: '', checked: false, textContent: '', innerHTML: '', className: '', style: {}, dataset: {},
    classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
    querySelector: () => null, querySelectorAll: () => [], appendChild() {}, addEventListener() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, focus() {}, scrollIntoView() {},
    closest: () => null, remove() {}, insertAdjacentHTML() {}, click() {}
  };
}

export function loadApp() {
  const html = readFileSync(APP_FILE, 'utf8');
  const i = html.indexOf('<script>');
  const j = html.indexOf('</script>', i);
  if (i < 0 || j < 0) throw new Error('Kein <script>-Block gefunden');
  const src = html.slice(i + '<script>'.length, j);
  const els = new Map();
  const document = {
    addEventListener() {},
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeElement(id)); return els.get(id); },
    createElement: (tag) => makeElement(tag),
    querySelector: () => null, querySelectorAll: () => [],
    body: makeElement('body')
  };
  const store = new Map();
  const sandbox = {
    console: { log() {}, info() {}, warn() {}, error: console.error, debug() {} },
    document,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k), clear: () => store.clear() },
    location: { search: '' }, navigator: { userAgent: 'recalc-harness' }, URLSearchParams, URL,
    fetch: () => Promise.reject(new Error('Netzwerkzugriff ist im Test nicht vorgesehen.')),
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: APP_FILE, timeout: 30000 });

  const run = (expr) => vm.runInContext(expr, sandbox);
  const el = (id) => document.getElementById(id);

  // Formular so einlesen, wie renderAssumptions() es zuletzt geschrieben hat.
  function syncForm() {
    const out = el('assumptions-output').innerHTML;
    for (const m of out.matchAll(/<input\b[^>]*\bid="(as-[^"]+)"[^>]*>/g)) {
      const tag = m[0];
      const e = el(m[1]);
      if (/type="checkbox"/.test(tag)) { e.checked = /\schecked\b/.test(tag); continue; }
      const v = /\svalue="([^"]*)"/.exec(tag);
      e.value = v ? v[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
    }
  }

  return {
    sandbox, run, el,
    importMj(mj) {
      el('import-master-json').value = JSON.stringify(mj);
      const ok = run('importMasterJsonFromTextarea()');
      if (ok !== false) { run('renderAssumptions()'); syncForm(); }
      return ok;
    },
    type(id, value) { el(id).value = String(value); },
    field(id) { return el(id).value; },
    recalc() { run('recalcFromAssumptions()'); syncForm(); },
    exportJson() { run('exportMasterJsonToTextarea()'); return JSON.parse(el('import-master-json').value); },
    // Zustand, Herkunft und der von der Bewertung TATSAECHLICH verwendete WACC.
    snapshot() {
      return JSON.parse(run(`JSON.stringify((() => {
        const v = state.masterJson.valuation, f = v._derivationFlags || {}, d = (v.wacc_components || {}).derived || {};
        const mr = (state.valuation && state.valuation.modelResults) || {};
        const sc = (state.valuation && state.valuation.scenarios) || {};
        return {
          coe: v.cost_of_equity_derived, wacc: v.wacc_derived, coeFlag: f.cost_of_equity_derived, waccFlag: f.wacc_derived,
          floor: !!f.wacc_floor_applied, floorPrev: v._heuristicDetails && v._heuristicDetails.wacc_floor ? v._heuristicDetails.wacc_floor.previous : null,
          dCoe: d.cost_of_equity, dWacc: d.wacc, dOverride: d.wacc_override == null ? null : d.wacc_override,
          tax: v.wacc_components.tax_rate, kd: v.wacc_components.cost_of_debt_pretax, beta: v.wacc_components.beta,
          price: state.masterJson.market.price,
          usedWacc: sc.base ? sc.base.wacc : null, usedWaccCons: sc.conservative ? sc.conservative.wacc : null,
          usedWaccOpt: sc.optimistic ? sc.optimistic.wacc : null,
          usedCoe: sc.base ? sc.base.coe : null,
          dcf: mr.dcf ? [mr.dcf.conservative, mr.dcf.base, mr.dcf.optimistic] : null,
          rim: mr.rim ? [mr.rim.conservative, mr.rim.base, mr.rim.optimistic] : null,
          range: state.synthesis && state.synthesis.range ? state.synthesis.range : null,
          manual: Array.from(state.manualAssumptionFields || []).sort(),
          srcCoe: getAssumptionSource(state.masterJson, 'cost_of_equity_derived'),
          srcWacc: getAssumptionSource(state.masterJson, 'wacc_derived')
        };
      })())`));
    }
  };
}
