import { readFile, writeFile } from 'node:fs/promises';
import { DOMParser, parseHTML } from 'linkedom';
import createPublicationRenderer from './publications.js';

const pagePath = new URL('../index.html', import.meta.url);
const cachePath = new URL('../dblp-cache.json', import.meta.url);
const [html, cache] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(cachePath, 'utf8')
]);
const { document } = parseHTML(html);
const renderer = createPublicationRenderer(document, DOMParser);
renderer.render(JSON.parse(cache));

const list = document.getElementById('dblp-publications');
const entries = Array.from(list.children)
  .map((item) => `            ${item.outerHTML}`)
  .join('\n');
const listPattern = /<ul\b[^>]*\bid="dblp-publications"[^>]*>[\s\S]*?<\/ul>/g;
if ([...html.matchAll(listPattern)].length !== 1) {
  throw new Error('Expected exactly one publication list in index.html');
}
const updated = html.replace(listPattern, () =>
  `<ul class="publications" id="dblp-publications" aria-busy="false">\n${entries}\n          </ul>`
);
if (updated !== html) await writeFile(pagePath, updated, 'utf8');
console.log(`Rendered ${list.children.length} publications into index.html`);
