import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSitemap } from './build-sitemap.mjs';

const now = '2026-11-12T12:00:00Z';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'website-sitemap-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  git('config', 'user.name', 'Sitemap Test');
  git('config', 'user.email', 'sitemap-test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const write = (file, contents) => writeFileSync(join(root, file), contents);
  const commit = (date, message = 'Fixture content') => {
    git('add', '.');
    execFileSync('git', ['commit', '-m', message], {
      cwd: root, stdio: 'pipe',
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
  };
  mkdirSync(join(root, 'scripts'));
  write('index.html', '<link rel="canonical" href="https://aryan.agarwalas.in/">');
  write('music.html', '<link href="https://aryan.agarwalas.in/music.html" rel="canonical">');
  write('scripts/publications.js', '// Publications');
  write('aryanagarwala-seagull.png', 'Image fixture');
  write('heavy-rotation.json', '[]');
  write('your-essentials.json', '[]');
  commit('2026-11-01T10:00:00Z');
  return { root, git, write, commit, build: options => buildSitemap({ root, now, ...options }) };
}

test('uses independent page dates and ignores unrelated commits and repeated builds', t => {
  const f = fixture(t);
  f.write('scripts/publications.js', '// Updated publications');
  f.commit('2026-11-05T11:00:00+01:00');
  f.write('your-essentials.json', '["New song"]');
  f.commit('2026-11-06T08:00:00Z');
  const xml = f.build();
  assert.match(xml, /<loc>https:\/\/aryan\.agarwalas\.in\/<\/loc>\s*<lastmod>2026-11-05T10:00:00Z<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/aryan\.agarwalas\.in\/music\.html<\/loc>\s*<lastmod>2026-11-06T08:00:00Z<\/lastmod>/);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.endsWith('</urlset>\n'));
  f.write('README.md', 'Unrelated documentation');
  f.commit('2026-11-10T10:00:00Z');
  assert.equal(f.build(), xml);
  assert.equal(f.build({ now: '2026-11-20T12:00:00Z' }), xml);
});

test('working-tree mode updates only a page with relevant changed files', t => {
  const f = fixture(t);
  const original = f.build();
  f.write('README.md', 'Unrelated pending changes');
  assert.equal(f.build({ includeWorkingTree: true }), original);
  f.write('heavy-rotation.json', '["Pending song"]');
  assert.equal(f.build(), original);
  const changed = f.build({ includeWorkingTree: true });
  assert.match(changed, /<loc>https:\/\/aryan\.agarwalas\.in\/<\/loc>\s*<lastmod>2026-11-01T10:00:00Z<\/lastmod>/);
  assert.match(changed, /<loc>https:\/\/aryan\.agarwalas\.in\/music\.html<\/loc>\s*<lastmod>2026-11-12T12:00:00Z<\/lastmod>/);
  f.git('add', 'heavy-rotation.json');
  assert.equal(f.build({ includeWorkingTree: true }), changed);
});

test('rejects absent, duplicate, and incorrect canonical URLs', t => {
  const f = fixture(t);
  const original = readFileSync(join(f.root, 'index.html'), 'utf8');
  for (const html of ['', original + original, original.replace('https:', 'http:')]) {
    f.write('index.html', html);
    assert.throws(() => f.build(), /exactly one canonical URL/);
  }
});

test('rejects invalid current time and future content dates', t => {
  const f = fixture(t);
  assert.throws(() => f.build({ now: 'invalid' }), /Invalid current timestamp/);
  assert.throws(() => f.build({ now: '2026-10-01T00:00:00Z' }), /future timestamp/);
});

test('rejects shallow history', t => {
  const f = fixture(t);
  f.write('.git/shallow', f.git('rev-parse', 'HEAD') + '\n');
  assert.throws(() => f.build(), /complete Git history/);
});
