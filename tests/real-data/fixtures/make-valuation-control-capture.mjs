#!/usr/bin/env node
// Erzeugt fixtures/valuation-control-capture.json aus einem ECHTEN Replay-Bericht
// (out/<T>-report.json, replay-import.mjs mit --price). Uebernommen wird nur die
// Teilmenge, die valuation-control.mjs vergleicht — unveraendert, keine Rundung.
//   node tests/real-data/fixtures/make-valuation-control-capture.mjs CRH
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const T = (process.argv[2] || 'CRH').toUpperCase();
const r = JSON.parse(readFileSync(join(HERE, '..', 'out', T + '-report.json'), 'utf8'));
const pick = (o, ks) => Object.fromEntries(ks.filter(k => o && k in o).map(k => [k, o[k]]));
const d = r.fy.modelInputs.dcf;
const out = {
  _note: 'Teilmenge eines echten Replay-Berichts (' + T + ', Lauf ' + r.runAt + '), erzeugt mit make-valuation-control-capture.mjs. Nur fuer valuation-control.test.mjs.',
  ...pick(r, ['ticker', 'commit', 'productSha256', 'productFileChanged', 'imported', 'selftest', 'priceAssumption', 'runAt']),
  fy: {
    basis: pick(r.fy.basis, ['requested', 'selected']),
    modelInputs: {
      dcf: pick(d, ['_coreTaxRatePct', '_coreOpMarginPctUsed', '_coreCapexIntensityPct', '_coreDaRatioPct', '_owcPctOfRevenue',
        '_netDebtM', '_sharesUsedM', '_operatingValuePerShareBase', 'conservative', 'base', 'optimistic', '_buybackUpliftPct']),
      rim: pick(r.fy.modelInputs.rim, ['conservative', 'base', 'optimistic'])
    },
    range: pick(r.fy.range, ['conservative', 'base', 'optimistic']),
    reverseDcf: pick(r.fy.reverseDcf, ['impliedGrowth']),
    quality: { descriptive: { netDebtToEbitda: pick(r.fy.quality.descriptive.netDebtToEbitda, ['value']) } },
    valuationResults: r.fy.valuationResults
  }
};
writeFileSync(join(HERE, 'valuation-control-capture.json'), JSON.stringify(out, null, 1) + '\n');
console.log('geschrieben: valuation-control-capture.json (' + T + ', commit ' + r.commit + ', geaendert ' + r.productFileChanged + ')');
