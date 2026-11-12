import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'https://aryan.agarwalas.in';
const pages = [
  {
    file: 'index.html',
    url: `${origin}/`,
    dependencies: ['index.html', 'scripts/publications.js', 'aryanagarwala-seagull.png', 'old-trafford-green-and-gold-crop.png'],
  },
  {
    file: 'music.html',
    url: `${origin}/music.html`,
    dependencies: ['music.html', 'heavy-rotation.json', 'your-essentials.json'],
  },
];

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
}

function timestamp(value, label, now) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime()) {
    throw new Error(`Invalid or future timestamp for ${label}: ${value}`);
  }
  return date.toISOString().replace('.000Z', 'Z');
}

/** Use content history, not the build time, so unrelated deploys do not bump dates. */
export function buildSitemap({ root = process.cwd(), includeWorkingTree = false, now = new Date() } = {}) {
  now = new Date(now);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid current timestamp');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git('rev-parse', '--is-shallow-repository') !== 'false') {
    throw new Error('Sitemap dates require complete Git history. Check out with fetch-depth: 0.');
  }

  const entries = pages.map(page => {
    const html = readFileSync(resolve(root, page.file), 'utf8');
    const canonicals = (html.match(/<link\b[^>]*>/gi) ?? [])
      .filter(tag => attribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('canonical'));
    if (canonicals.length !== 1 || attribute(canonicals[0], 'href') !== page.url) {
      throw new Error(`${page.file} must declare exactly one canonical URL: ${page.url}`);
    }

    const committed = git('log', '-1', '--format=%cI', '--', ...page.dependencies);
    if (!committed) throw new Error(`No committed content history found for ${page.file}`);
    let lastmod = timestamp(committed, page.file, now);
    if (includeWorkingTree && git('status', '--porcelain=v1', '--untracked-files=all', '--', ...page.dependencies)) {
      lastmod = now.toISOString().replace('.000Z', 'Z');
    }
    return `  <url>\n    <loc>${page.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--include-working-tree')) {
    throw new Error('Usage: node scripts/build-sitemap.mjs [--include-working-tree]');
  }
  const sitemap = buildSitemap({ includeWorkingTree: args.includes('--include-working-tree') });
  const output = resolve(process.cwd(), 'sitemap.xml');
  let previous;
  try {
    previous = readFileSync(output, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (sitemap !== previous) {
    writeFileSync(output, sitemap);
    console.log('Updated sitemap.xml using content modification dates.');
  } else {
    console.log('sitemap.xml is already up to date.');
  }
}
