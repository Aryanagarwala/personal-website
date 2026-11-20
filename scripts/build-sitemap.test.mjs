import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildSitemap } from './build-sitemap.mjs';

const expected = 'https://aryan.agarwalas.in/\nhttps://aryan.agarwalas.in/music.html\n';
const script = fileURLToPath(new URL('./build-sitemap.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'website-sitemap-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, contents) => writeFileSync(join(root, file), contents);
  write('index.html', '<link rel="canonical" href="https://aryan.agarwalas.in/">');
  write('music.html', "<link href='https://aryan.agarwalas.in/music.html' rel='canonical'>");
  return { root, write, build: () => buildSitemap({ root }) };
}

test('generates exactly two absolute canonical URLs without requiring Git history', t => {
  const f = fixture(t);
  assert.equal(f.build(), expected);
  assert.equal(existsSync(join(f.root, '.git')), false);
  for (const line of f.build().trim().split('\n')) {
    const url = new URL(line);
    assert.equal(url.origin, 'https://aryan.agarwalas.in');
    assert.equal(url.hash, '');
  }
});

test('content updates and unrelated files do not change the URL list', t => {
  const f = fixture(t);
  f.write('index.html', readFileSync(join(f.root, 'index.html'), 'utf8') + '<p>Updated biography</p>');
  f.write('README.md', 'Unrelated documentation');
  assert.equal(f.build(), expected);
  assert.equal(f.build(), expected);
});

test('rejects missing, duplicate, insecure, incorrect, and data-attribute canonicals', t => {
  const f = fixture(t);
  for (const file of ['index.html', 'music.html']) {
    const original = readFileSync(join(f.root, file), 'utf8');
    for (const html of [
      '', original + original, original.replace('https:', 'http:'),
      original.replace('aryan.agarwalas.in', 'wrong.example'),
      original.replace('rel=', 'data-rel='), original.replace('href=', 'data-href='),
    ]) {
      f.write(file, html);
      assert.throws(() => f.build(), /exactly one canonical URL/);
    }
    f.write(file, original);
  }
});

test('CLI creates only sitemap.txt and leaves an unchanged output untouched', t => {
  const f = fixture(t);
  const run = () => execFileSync(process.execPath, [script], { cwd: f.root, encoding: 'utf8' });
  run();
  const output = join(f.root, 'sitemap.txt');
  assert.equal(readFileSync(output, 'utf8'), expected);
  assert.equal(existsSync(join(f.root, 'sitemap.xml')), false);
  const earlier = new Date('2026-01-01T00:00:00Z');
  utimesSync(output, earlier, earlier);
  assert.match(run(), /already up to date/);
  assert.equal(statSync(output).mtimeMs, earlier.getTime());
});

test('CLI rejects obsolete options rather than silently generating the wrong format', t => {
  const f = fixture(t);
  assert.throws(() => execFileSync(process.execPath, [script, '--include-working-tree'], {
    cwd: f.root, stdio: 'pipe',
  }), /Usage: node scripts\/build-sitemap.mjs/);
  assert.equal(existsSync(join(f.root, 'sitemap.txt')), false);
});
