import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const playlistId = 'pl.pm-d5779e520ff52d7f27baa09ac519ba18';
const playlistUrl = `https://music.apple.com/de/playlist/heavy-rotation/${playlistId}?l=en`;

function findTrackSection(payload) {
  for (const page of Array.isArray(payload?.data) ? payload.data : []) {
    for (const section of Array.isArray(page?.data?.sections) ? page.data.sections : []) {
      if (section?.itemKind === 'trackLockup' && Array.isArray(section.items)) {
        return section.items;
      }
    }
  }
  return [];
}

function extractManifest(html) {
  if (!html || html.length > 5_000_000) {
    throw new Error('Apple Music returned an invalid page size');
  }

  const match = html.match(
    /<script[^>]+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) throw new Error('Apple Music playlist data was not found');

  const items = findTrackSection(JSON.parse(match[1]));
  const tracks = items.map((item) => ({
    id: String(item?.contentDescriptor?.identifiers?.storeAdamID ?? ''),
    title: String(item?.title ?? '').trim(),
    artist: String(item?.artistName ?? '').trim()
  }));

  if (tracks.length < 1 || tracks.length > 100) {
    throw new Error(`Unexpected Heavy Rotation track count: ${tracks.length}`);
  }

  const ids = new Set();
  for (const track of tracks) {
    if (!/^\d+$/.test(track.id) || !track.title || !track.artist || ids.has(track.id)) {
      throw new Error('Apple Music returned invalid or duplicate track data');
    }
    ids.add(track.id);
  }

  return { playlistId, source: playlistUrl, tracks };
}

const response = await fetch(playlistUrl, {
  headers: {
    Accept: 'text/html',
    'User-Agent': 'aryan-agarwala-github-pages-cache/1.0'
  },
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error(`Apple Music returned HTTP ${response.status}`);

const manifest = extractManifest(await response.text());
const cachePath = fileURLToPath(new URL('../heavy-rotation.json', import.meta.url));
await writeFile(cachePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
