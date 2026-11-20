import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'https://aryan.agarwalas.in';
const pages = [
  {
    file: 'index.html',
    url: `${origin}/`,
  },
  {
    file: 'music.html',
    url: `${origin}/music.html`,
  },
];

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
}

/** Plain-text sitemaps contain absolute canonical URLs only, one per line. */
export function buildSitemap({ root = process.cwd() } = {}) {
  const urls = pages.map(page => {
    const html = readFileSync(resolve(root, page.file), 'utf8');
    const canonicals = (html.match(/<link\b[^>]*>/gi) ?? [])
      .filter(tag => attribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('canonical'));
    if (canonicals.length !== 1 || attribute(canonicals[0], 'href') !== page.url) {
      throw new Error(`${page.file} must declare exactly one canonical URL: ${page.url}`);
    }

    return page.url;
  });
  return urls.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 2) {
    throw new Error('Usage: node scripts/build-sitemap.mjs');
  }
  const contents = buildSitemap();
  const output = resolve(process.cwd(), 'sitemap.txt');
  let previous;
  try {
    previous = readFileSync(output, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (contents !== previous) {
    writeFileSync(output, contents);
    console.log('Updated sitemap.txt.');
  } else {
    console.log('sitemap.txt is already up to date.');
  }
}
