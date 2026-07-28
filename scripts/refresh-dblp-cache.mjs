import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const query = new URLSearchParams({
  q: 'author:Aryan_Agarwala:',
  format: 'json',
  h: '1000',
  c: '0'
});

const endpoints = [
  'https://dblp.org/search/publ/api',
  'https://dblp.dagstuhl.de/search/publ/api',
  'https://dblp.uni-trier.de/search/publ/api'
].map((baseUrl) => `${baseUrl}?${query}`);

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function plainText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    value = value.text ?? value.url ?? value.value ?? value.href ?? '';
  }
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isValidPayload(payload) {
  const hitsObject = payload?.result?.hits;
  if (!hitsObject || typeof hitsObject !== 'object') return false;

  const hits = asArray(hitsObject.hit);
  if (!hits.length || hits.length > 2000) return false;

  return hits.every((hit) => {
    const record = hit?.info;
    if (!record || typeof record !== 'object' || !plainText(record.title)) return false;

    const year = plainText(record.year);
    if (year && !/^\d{4}$/.test(year)) return false;

    return asArray(record.authors?.author).length <= 100 &&
      asArray(record.ee).length <= 20;
  });
}

async function download(endpoint) {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'aryan-agarwala-github-pages-cache/1.0'
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);

  const text = await response.text();
  if (!text || text.length > 2_000_000) {
    throw new Error(`${endpoint}: invalid response size`);
  }

  const payload = JSON.parse(text);
  if (!isValidPayload(payload)) {
    throw new Error(`${endpoint}: invalid DBLP response`);
  }
  return payload;
}

let payload;
const failures = [];

for (const endpoint of endpoints) {
  try {
    payload = await download(endpoint);
    break;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (!payload) {
  throw new Error(`No DBLP endpoint returned valid data:\n${failures.join('\n')}`);
}

const cachePath = fileURLToPath(new URL('../dblp-cache.json', import.meta.url));
await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

