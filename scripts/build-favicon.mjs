// Run from anywhere: NODE_PATH=/path/to/node_modules node scripts/build-favicon.mjs
// Requires sharp only when regenerating assets; the website serves committed files.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('favicon.svg', root));

async function png(size, background) {
  let image = sharp(svg, { density: 384 }).resize(size, size);
  if (background) image = image.flatten({ background });
  return image.png().toBuffer();
}

// ICO directory plus PNG payloads: each size has its own properly rendered image.
const sizes = [16, 32, 48];
const icons = await Promise.all(sizes.map(size => png(size)));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2); // Type 1: icon, not cursor.
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
icons.forEach((icon, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4); // One color plane.
  directory.writeUInt16LE(32, entry + 6); // RGBA.
  directory.writeUInt32LE(icon.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += icon.length;
});

await Promise.all([
  writeFile(new URL('favicon.ico', root), Buffer.concat([directory, ...icons])),
  png(192).then(data => writeFile(new URL('favicon.png', root), data)),
  png(180, '#fafaf8').then(data => writeFile(new URL('apple-touch-icon.png', root), data)),
]);
console.log('Built favicon.ico (16/32/48), favicon.png (192), and apple-touch-icon.png (180).');
