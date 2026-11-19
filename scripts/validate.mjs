import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const expectedPresets = {
  'iphone-63-portrait': [1206, 2622],
  'iphone-69-portrait': [1320, 2868],
  'ipad-13-portrait': [2064, 2752],
  'iphone-duo-portrait': [1398, 2034],
  'iphone-63-landscape': [2622, 1206],
  'ipad-13-landscape': [2752, 2064],
  'product-header-21-9': [3840, 1646],
  'search-results-3-2': [3840, 2560],
  'universal-creative-16-9': [5244, 2950],
};

import { frames } from './generate-frames.mjs';

const presetSource = fs.readFileSync(path.join(root, 'src/presets.ts'), 'utf8');
for (const legacyId of ['duo-outer-portrait', 'duo-inner-portrait']) {
  if (presetSource.includes(`id: '${legacyId}'`))
    throw new Error(`Legacy Duo output hâlâ seçilebilir: ${legacyId}`);
}
for (const [id, [width, height]] of Object.entries(expectedPresets)) {
  const idIndex = presetSource.indexOf(`id: '${id}'`);
  if (idIndex < 0) throw new Error(`Preset eksik: ${id}`);
  const block = presetSource.slice(idIndex, idIndex + 420);
  if (!block.includes(`width: ${width}`) || !block.includes(`height: ${height}`)) {
    throw new Error(`Preset ölçüsü yanlış: ${id}`);
  }
}

const localeSource = fs.readFileSync(path.join(root, 'src/locales.ts'), 'utf8');
const localeCodes = Array.from(localeSource.matchAll(/code: '([^']+)'/g), (match) => match[1]);
if (localeCodes.length !== 28 || new Set(localeCodes).size !== 28) {
  throw new Error(`28 benzersiz locale bekleniyordu, ${localeCodes.length} bulundu.`);
}

const deviceSource = fs.readFileSync(path.join(root, 'src/devices.ts'), 'utf8');
for (const id of [
  'iphone-duo-inner-half-folded',
  'iphone-duo-inner-half-folded-horizontal',
  'iphone-duo-folded-tent',
]) {
  if (!deviceSource.includes(`id: '${id}'`)) throw new Error(`Synthetic Duo pose eksik: ${id}`);
}
if (
  !deviceSource.includes("renderMode: 'duo-half-fold-vertical'") ||
  !deviceSource.includes("renderMode: 'duo-half-fold-horizontal'") ||
  !deviceSource.includes("renderMode: 'duo-fold-tent'")
) {
  throw new Error('Duo fold render modları eksik.');
}

for (const [id, width, height, , , , , , colors] of frames) {
  for (const color of colors) {
    const filename = path.join(root, 'public/assets/devices', id, `${color}.svg`);
    const svg = fs.readFileSync(filename, 'utf8');
    if (!svg.includes(`viewBox="0 0 ${width} ${height}"`)) throw new Error(`Invalid frame: ${id}/${color}`);
  }
}
console.log(
  `Validated ${Object.keys(expectedPresets).length} output presets, ${localeCodes.length} locales, original SVG frames, and 3 fold poses.`,
);
