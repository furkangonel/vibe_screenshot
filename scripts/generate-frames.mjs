// Original vector shells. No third-party product artwork is copied into these assets.
import fs from 'node:fs';
import path from 'node:path';
export const frames = [
  ['iphone-18-pro', 1350, 2760, 72, 69, 1206, 2622, 196, ['black', 'silver', 'glacier', 'burgundy']],
  ['iphone-18-pro-max', 1470, 3000, 75, 66, 1320, 2868, 198, ['black', 'silver', 'glacier', 'burgundy']],
  ['ipad-pro-m5-13', 2300, 3000, 118, 124, 2064, 2752, 61, ['space-black', 'silver']],
  ['iphone-duo-inner-open', 2247, 3093, 120, 120, 2007, 2853, 168, ['night-sky', 'star-white']],
  ['iphone-duo-outer-closed', 1574, 2194, 88, 80, 1398, 2034, 26, ['night-sky', 'star-white']],
  ['iphone-duo-outer-open', 3056, 2194, 1570, 80, 1398, 2034, 26, ['night-sky', 'star-white']],
  ...JSON.parse(fs.readFileSync(new URL('../src/androidDevices.json', import.meta.url), 'utf8')).map((d) => [
    d.id,
    d.frameWidth,
    d.frameHeight,
    d.screenX,
    d.screenY,
    d.screenWidth,
    d.screenHeight,
    d.screenRadius,
    d.colors,
  ]),
];
const profiles = JSON.parse(fs.readFileSync(new URL('../src/screenProfiles.json', import.meta.url), 'utf8'));
function roundedPath(x, y, width, height, radii) {
  const [tl, tr, br, bl] = radii;
  return `M ${x + tl},${y} H ${x + width - tr} A ${tr},${tr} 0 0 1 ${x + width},${y + tr} V ${y + height - br} A ${br},${br} 0 0 1 ${x + width - br},${y + height} H ${x + bl} A ${bl},${bl} 0 0 1 ${x},${y + height - bl} V ${y + tl} A ${tl},${tl} 0 0 1 ${x + tl},${y} Z`;
}
const palette = {
  black: ['#20242b', '#777d88', '#090b10'],
  silver: ['#e0e3e7', '#fafbfc', '#7b818b'],
  glacier: ['#8faab7', '#d2e0e6', '#465a68'],
  burgundy: ['#704858', '#bf95a4', '#38222e'],
  'space-black': ['#292e36', '#8c939e', '#0c1017'],
  'night-sky': ['#26374a', '#8298ad', '#0a1522'],
  'star-white': ['#d5dce2', '#ffffff', '#7c8893'],
  graphite: ['#333a40', '#a3adb5', '#10151a'],
  sage: ['#a3b7a9', '#e3eee5', '#526a5c'],
};
const lens = (x, y, radius) =>
  `<g transform="translate(${x} ${y})"><circle r="${radius}" fill="url(#lensRim)" stroke="#090d17" stroke-width="7"/><circle r="${radius * 0.87}" fill="#090d14" stroke="#7f91ac" stroke-opacity=".45" stroke-width="2"/><circle r="${radius * 0.67}" fill="url(#optic)"/><ellipse cx="${-radius * 0.23}" cy="${-radius * 0.26}" rx="${radius * 0.27}" ry="${radius * 0.12}" fill="#c3e0ff" opacity=".2" transform="rotate(-35)"/><circle r="${radius * 0.23}" fill="#02050a"/><circle cx="${radius * 0.11}" cy="${-radius * 0.14}" r="${radius * 0.1}" fill="#899cf7" opacity=".65"/></g>`;

export function renderFrame(frame, color) {
  const [id, w, h, x, y, sw, sh, r] = frame;
  const [body, light, dark] = palette[color];
  const android = id.startsWith('android');
  const tablet = id.startsWith('ipad') || id.startsWith('android-tablet');
  const outerOpen = id === 'iphone-duo-outer-open';
  const foldable = id.includes('duo');
  const margin = tablet ? 10 : 14;
  const cover = id.includes('duo-outer');
  const radii = cover ? profiles.foldableCoverCorners : [r, r, r, r];
  const outerRadius = cover ? 224 : Math.min(r + 52, 224);
  const bodyCorners =
    cover && !outerOpen ? [78, 224, 224, 78] : [outerRadius, outerRadius, outerRadius, outerRadius];
  const buttonHeight = h * 0.065;
  const originalButtons = `<g fill="url(#edge)" stroke="${dark}" stroke-width="3"><rect x="1" y="${h * 0.22}" width="${margin + 7}" height="${buttonHeight * 0.45}" rx="6"/><rect x="1" y="${h * 0.31}" width="${margin + 7}" height="${buttonHeight}" rx="7"/><rect x="1" y="${h * 0.4}" width="${margin + 7}" height="${buttonHeight}" rx="7"/><rect x="${w - margin - 8}" y="${h * 0.33}" width="${margin + 7}" height="${buttonHeight * 1.3}" rx="7"/></g>`;
  const buttons = android
    ? `<g fill="url(#edge)" stroke="${dark}" stroke-width="3"><rect x="${w - margin - 8}" y="${h * 0.2}" width="${margin + 7}" height="${buttonHeight * 1.3}" rx="6"/><rect x="${w - margin - 8}" y="${h * 0.34}" width="${margin + 7}" height="${buttonHeight * 0.7}" rx="6"/></g>`
    : originalButtons;
  const antenna = [0.11, 0.88]
    .map(
      (position) =>
        `<g fill="${light}" opacity=".28"><rect x="${margin}" y="${h * position}" width="25" height="13"/><rect x="${w - margin - 25}" y="${h * position}" width="25" height="13"/></g>`,
    )
    .join('');
  const camera = android
    ? tablet
      ? lens(w / 2, y * 0.5, Math.max(9, x * 0.13))
      : lens(w / 2, y + 43, 19)
    : tablet
      ? lens(x * 0.5, h * 0.5, 15)
      : foldable
        ? lens(x + sw * 0.9, y + 91, 20)
        : `<rect x="${w / 2 - 116}" y="${y + 43}" width="232" height="78" rx="39" fill="#03050a"/>${lens(w / 2 + 70, y + 82, 19)}`;
  const rear = outerOpen
    ? `<rect x="${margin + 18}" y="${margin + 18}" width="${w / 2 - margin - 40}" height="${h - margin * 2 - 36}" rx="${outerRadius - 18}" fill="url(#back)"/><rect x="105" y="120" width="1100" height="520" rx="245" fill="#000000" opacity=".2"/><rect x="105" y="108" width="1100" height="520" rx="245" fill="url(#edge)" stroke="${light}" stroke-opacity=".28" stroke-width="3"/>${lens(385, 368, 192)}${lens(846, 368, 192)}<circle cx="1100" cy="535" r="43" fill="url(#flash)" stroke="${dark}" stroke-width="4"/><rect x="${w / 2 - 10}" y="45" width="20" height="${h - 90}" rx="8" fill="url(#edge)"/><path d="M ${w / 2} 60 V ${h - 60}" stroke="${light}" stroke-width="3" opacity=".65"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2=".13"><stop stop-color="${dark}"/><stop offset=".025" stop-color="${light}"/><stop offset=".05" stop-color="${body}"/><stop offset=".17" stop-color="${dark}"/><stop offset=".46" stop-color="${body}"/><stop offset=".74" stop-color="${dark}"/><stop offset=".96" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".8"/><stop offset=".19" stop-color="${light}" stop-opacity=".28"/><stop offset=".45" stop-color="#090b12"/><stop offset=".73" stop-color="#05070d"/><stop offset=".94" stop-color="${light}" stop-opacity=".7"/><stop offset="1" stop-color="#10151e"/></linearGradient>
  <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${body}"/><stop offset=".36" stop-color="${dark}"/><stop offset="1" stop-color="${body}"/></linearGradient>
  <radialGradient id="optic"><stop stop-color="#163854"/><stop offset=".25" stop-color="#091420"/><stop offset=".47" stop-color="#302e63"/><stop offset=".7" stop-color="#14212e"/><stop offset="1" stop-color="#04070d"/></radialGradient>
  <linearGradient id="lensRim" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset=".25" stop-color="#172332"/><stop offset=".6" stop-color="#080d16"/><stop offset=".9" stop-color="${body}"/><stop offset="1" stop-color="${light}"/></linearGradient>
  <radialGradient id="flash"><stop stop-color="#fffde8"/><stop offset=".52" stop-color="#e0d8bd"/><stop offset=".8" stop-color="#bcc1bb"/><stop offset="1" stop-color="#75808c"/></radialGradient>
  <pattern id="grain" width="9" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".6" fill="#fff" opacity=".11"/><circle cx="7" cy="8" r=".65" fill="#000" opacity=".15"/></pattern>
  <mask id="cut"><rect width="${w}" height="${h}" fill="#fff"/><path d="${roundedPath(x, y, sw, sh, radii)}" fill="#000"/></mask>
</defs>
<g mask="url(#cut)">
${buttons}
<path d="${roundedPath(margin, 5, w - margin * 2, h - 10, bodyCorners)}" fill="url(#edge)" stroke="${dark}" stroke-width="5"/>
<path d="${roundedPath(
    margin + 7,
    12,
    w - margin * 2 - 14,
    h - 24,
    bodyCorners.map((v) => v - 6),
  )}" fill="none" stroke="url(#rim)" stroke-width="5"/>
<path d="${roundedPath(
    margin + 16,
    21,
    w - margin * 2 - 32,
    h - 42,
    bodyCorners.map((v) => v - 14),
  )}" fill="none" stroke="#000" stroke-opacity=".65" stroke-width="6"/>
<path d="${roundedPath(
    x - 17,
    y - 17,
    sw + 34,
    sh + 34,
    radii.map((v) => v + 17),
  )}" fill="#05070c"/>
<path d="${roundedPath(
    x - 10,
    y - 10,
    sw + 20,
    sh + 20,
    radii.map((v) => v + 10),
  )}" fill="none" stroke="url(#rim)" stroke-width="3"/>
<path d="${roundedPath(
    margin + 4,
    9,
    w - margin * 2 - 8,
    h - 18,
    bodyCorners.map((v) => v - 3),
  )}" fill="url(#grain)"/>
${rear}${antenna}
</g>
${camera}
${!android && !tablet && !foldable ? `<rect x="${w / 2 - 85}" y="30" width="170" height="7" rx="3.5" fill="#05070a"/><path d="M ${w / 2 - 75} 32 H ${w / 2 + 75}" stroke="#ffffff" stroke-opacity=".1"/>` : ''}
</svg>
`;
}

for (const frame of frames) {
  const [id, , , , , , , , colors] = frame;
  const dir = path.join('public/assets/devices', id);
  fs.mkdirSync(dir, { recursive: true });
  for (const color of colors) fs.writeFileSync(path.join(dir, `${color}.svg`), renderFrame(frame, color));
}
console.log(
  `Generated ${frames.reduce((sum, f) => sum + f[8].length, 0)} studio-detail vector device shells.`,
);
