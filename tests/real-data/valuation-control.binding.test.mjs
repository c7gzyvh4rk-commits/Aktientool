// ─────────────────────────────────────────────────────────────────────────────
// V1.0.86 · Verbindliche Zuordnung der Erfassung zum abzunehmenden Produktstand.
//
// Befund aus dem Review von PR #12: checkCapture pruefte report.commit und
// report.productSha256 nur auf das Zeichenformat — ein sonst passender Bericht
// mit Commit 'a'×40 und Hash 'b'×64 wurde akzeptiert.
//
// Gegenstand ist die echte Verifikationslogik (productAtCommit,
// verifyProductBinding, compareCapture) einschliesslich Git-Aufloesung und
// Inhaltsvergleich. Dafuer entstehen isolierte, temporaere Git-Repositories;
// die Historie dieses Repositorys wird nicht beruehrt.
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { productAtCommit, verifyProductBinding, compareCapture, computeControl, PRODUCT_FILE } from './valuation-control.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Repository: A (Produkt v1) → B (nur Doku, Produkt bytegleich) → C (Produkt v2)
// sowie D auf einem Seitenzweig ohne Produktdatei.
const repo = mkdtempSync(join(tmpdir(), 'vc-binding-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
git('init', '-q');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'binding-test');
git('config', 'commit.gpgsign', 'false');
const V1 = '<!doctype html><script>var version = 1;</script>\n';
const V2 = '<!doctype html><script>var version = 2;</script>\n';
writeFileSync(join(repo, PRODUCT_FILE), V1); writeFileSync(join(repo, 'README.md'), 'a\n');
git('add', '-A'); git('commit', '-q', '-m', 'A');
const A = git('rev-parse', 'HEAD');
writeFileSync(join(repo, 'README.md'), 'b\n');
git('add', '-A'); git('commit', '-q', '-m', 'B (nur Doku)');
const B = git('rev-parse', 'HEAD');
writeFileSync(join(repo, PRODUCT_FILE), V2);
git('add', '-A'); git('commit', '-q', '-m', 'C (Produkt geaendert)');
const Cc = git('rev-parse', 'HEAD');
git('checkout', '-q', '--orphan', 'ohne-produkt'); git('rm', '-q', '-rf', '.');
writeFileSync(join(repo, 'README.md'), 'd\n'); git('add', '-A'); git('commit', '-q', '-m', 'D (ohne Produkt)');
const D = git('rev-parse', 'HEAD');
const H1 = sha256(V1), H2 = sha256(V2);
test.after(() => rmSync(repo, { recursive: true, force: true }));

const report = (commit, hash, changed = 'nein') => ({ commit, productSha256: hash, productFileChanged: changed });
const bind = (rep, targetRev) => verifyProductBinding(rep, { repoDir: repo, targetRev });

test('0 · productAtCommit: Hash aus den Bytes der Produktdatei im Commit', () => {
  const a = productAtCommit(repo, A);
  assert.equal(a.ok, true); assert.equal(a.commit, A); assert.equal(a.sha256, H1);
  assert.equal(productAtCommit(repo, Cc).sha256, H2);
  assert.equal(productAtCommit(repo, 'master').ok || productAtCommit(repo, 'main').ok, true, 'Branchname aufloesbar');
  assert.equal(productAtCommit(repo, '--help').ok, false, 'Option als Revision abgewiesen');
  assert.equal(productAtCommit(repo, '').ok, false);
});

test('1 · passender Erfassungscommit und passender Produktinhalt ⇒ erfolgreich (gleicher Commit)', () => {
  const r = bind(report(A, H1), A);
  assert.deepEqual(Array.from(r.issues), []);
  assert.equal(r.ok, true); assert.equal(r.sameCommit, true); assert.equal(r.contentIdentical, false);
  assert.equal(r.relation, 'gleicher Commit');
  assert.equal(r.target.sha256, H1);
});

test('2 · formal gueltiger, aber nicht vorhandener Commit ⇒ fehlgeschlagen', () => {
  const r = bind(report('a'.repeat(40), H1), A);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(i => /Erfassungscommit: Commit a{40} ist im Repository .* nicht vorhanden/.test(i)), r.issues.join(' | '));
  // Befund des Reviews: Commit 'a'×40 und Hash 'b'×64
  const f = bind(report('a'.repeat(40), 'b'.repeat(64)), A);
  assert.equal(f.ok, false);
  assert.ok(f.issues.length >= 2, f.issues.join(' | '));
  // Zielstand selbst unbekannt
  const t = bind(report(A, H1), 'f'.repeat(40));
  assert.equal(t.ok, false);
  assert.ok(t.issues.some(i => /^Zielstand: Commit f{40} .* nicht vorhanden/.test(i)), t.issues.join(' | '));
});

test('3 · existierender Commit mit abweichendem Produktinhalt ⇒ fehlgeschlagen', () => {
  // Erfassung auf C (v2), Hash konsistent mit C, Ziel A (v1)
  const r = bind(report(Cc, H2), A);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(i => /erfasste Produktdatei .* ≠ Zielstand/.test(i)), r.issues.join(' | '));
  // Commit ohne Produktdatei
  const d = bind(report(D, H1), A);
  assert.equal(d.ok, false);
  assert.ok(d.issues.some(i => /Produktdatei .* fehlt in Commit/.test(i)), d.issues.join(' | '));
});

test('4 · formal gueltiger, aber falscher Produkt-Hash ⇒ fehlgeschlagen', () => {
  const r = bind(report(A, 'b'.repeat(64)), A);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(i => /gemeldeter Produkt-Hash bbbbbbbbbbbb… passt nicht zur Produktdatei im Erfassungscommit/.test(i)), r.issues.join(' | '));
  assert.ok(r.issues.some(i => /≠ Zielstand/.test(i)));
});

test('5 · passender Ziel-Hash, aber dazu widerspruechlicher Erfassungscommit ⇒ fehlgeschlagen', () => {
  // Hash H1 (= Ziel A), angeblich erfasst auf C — dort hat die Produktdatei H2.
  const r = bind(report(Cc, H1), A);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(i => /passt nicht zur Produktdatei im Erfassungscommit/.test(i)), r.issues.join(' | '));
  assert.ok(!r.issues.some(i => /≠ Zielstand/.test(i)), 'der Ziel-Hash selbst passt');
});

test('6 · fehlende Metadaten oder lokal veraenderte Produktdatei ⇒ fehlgeschlagen', () => {
  const cases = {
    'Commit fehlt': report(undefined, H1),
    'Commit gekuerzt': report(A.slice(0, 12), H1),
    'Hash fehlt': report(A, undefined),
    'Hash gekuerzt': report(A, H1.slice(0, 40)),
    'lokal geaendert': report(A, H1, 'ja'),
    'Aenderungsstatus fehlt': { commit: A, productSha256: H1 },
    'Aenderungsstatus unbekannt': report(A, H1, 'unbekannt'),
    'kein Bericht': null
  };
  for (const [name, rep] of Object.entries(cases)) {
    const r = bind(rep, A);
    assert.equal(r.ok, false, name);
    assert.ok(r.issues.length > 0, name);
  }
  assert.ok(bind(report(A, H1, 'ja'), A).issues.some(i => /lokal veraendert .* keine Commit-Zuordnung/.test(i)));
  // Zielstand fehlt (kein --product-commit)
  for (const t of [undefined, null, '']) assert.equal(bind(report(A, H1), t).ok, false, 'Ziel ' + t);
});

test('7 · verschiedene Commits mit nachweislich identischer Produktdatei ⇒ erfolgreich, als inhaltsgleich ausgewiesen', () => {
  // Erfasst auf A, Ziel B (nur Doku geaendert) — und umgekehrt.
  for (const [cap, tgt] of [[A, B], [B, A]]) {
    const r = bind(report(cap, H1), tgt);
    assert.deepEqual(Array.from(r.issues), [], cap + '→' + tgt);
    assert.equal(r.ok, true);
    assert.equal(r.sameCommit, false);
    assert.equal(r.contentIdentical, true);
    assert.equal(r.relation, 'inhaltsgleich (anderer Commit, Produktdatei bytegleich)');
    assert.equal(r.capture.sha256, r.target.sha256);
  }
});

test('8 · fruehere Erfassung mit anderem Produktinhalt geht fuer den neuen Zielstand nicht durch', () => {
  // Erfassung auf A/B (v1, in sich stimmig), neuer Zielstand C (v2).
  for (const cap of [A, B]) {
    const r = bind(report(cap, H1), Cc);
    assert.equal(r.ok, false, cap);
    assert.ok(r.issues.some(i => /≠ Zielstand/.test(i)), r.issues.join(' | '));
  }
});

test('9 · Ende-zu-Ende ueber compareCapture: echte Werte, Zuordnung entscheidet', () => {
  const EV = JSON.parse(readFileSync(join(HERE, 'evidence', 'CRH.json'), 'utf8'));
  const CAP = JSON.parse(readFileSync(join(HERE, 'fixtures', 'valuation-control-capture.json'), 'utf8'));
  const VC = EV.valuationControl;
  const byId = Object.fromEntries(EV.items.map(i => [i.id, i.value]));
  const C = computeControl((id) => byId[id], VC);
  // Werte aus dem echten CRH-Lauf, Metadaten auf das Testrepository umgestellt.
  const good = Object.assign(JSON.parse(JSON.stringify(CAP)), { commit: A, productSha256: H1, productFileChanged: 'nein' });
  assert.equal(compareCapture(C, good, VC, 'CRH', bind(good, B)).ok, true, 'inhaltsgleicher Zielstand');
  const fake = Object.assign(JSON.parse(JSON.stringify(CAP)), { commit: 'a'.repeat(40), productSha256: 'b'.repeat(64) });
  const R = compareCapture(C, fake, VC, 'CRH', bind(fake, A));
  assert.equal(R.ok, false, 'Befund: a×40/b×64 darf nicht durchgehen');
  assert.ok(R.captureIssues.some(i => /^Produktzuordnung: /.test(i)));
  const stale = Object.assign(JSON.parse(JSON.stringify(CAP)), { commit: A, productSha256: H1, productFileChanged: 'nein' });
  assert.equal(compareCapture(C, stale, VC, 'CRH', bind(stale, Cc)).ok, false, 'alte Erfassung, neuer Zielstand');
});
