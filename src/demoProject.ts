// Original, fictional content used only for documentation and example projects.
// No captured product screens or user project data are used here.
import { createDefaultProject } from './defaultProject';
import type { DeviceLayer } from './types';
import { getDevice } from './devices';

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}
function screen(index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 2340;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#faf9ff';
  ctx.fillRect(0, 0, 1080, 2340);
  const text = (value: string, x: number, y: number, size: number, weight = 500, color = '#292641') => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText(value, x, y);
  };
  text('9:41', 65, 82, 31, 650);
  rounded(ctx, 935, 60, 68, 28, 8, '#292641');
  text('D A Y L I G H T', 66, 235, 28, 700, '#85809b');
  if (index === 0) {
    text('A little room', 66, 350, 75, 700);
    text('for your day.', 66, 439, 75, 700);
    text('MONDAY, NOVEMBER 16', 68, 540, 25, 650, '#8b859c');
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
      const x = 66 + i * 138;
      if (i === 0) rounded(ctx, x - 5, 590, 110, 156, 40, '#7566cc');
      text(d, x + 34, 638, 26, 500, i === 0 ? '#ffffff' : '#8a849c');
      text(String(16 + i), x + 26, 701, 37, 650, i === 0 ? '#ffffff' : '#302b46');
    });
    rounded(ctx, 66, 820, 948, 350, 38, '#eeebfa');
    text('YOUR NEXT MOMENT', 105, 884, 24, 650, '#8a7db1');
    text('Morning pages', 105, 979, 52, 650);
    text('09:00 – 09:25 · Just for you', 105, 1040, 29, 450, '#81778f');
    rounded(ctx, 105, 1083, 184, 48, 24, '#ffffff');
    text('25 min', 147, 1116, 24, 650, '#7566cc');
    text('A few good intentions', 66, 1290, 45, 650);
    [
      ['Read a chapter', 'A small step, every day'],
      ['Walk outside', 'A change of scenery'],
      ['Sketch something', 'Leave room to explore'],
    ].forEach(([title, sub], i) => {
      const y = 1370 + i * 205;
      rounded(ctx, 66, y, 948, 175, 29, '#ffffff');
      rounded(ctx, 100, y + 51, 52, 52, 17, i === 0 ? '#e7e0f6' : '#eef0f5');
      text(title, 183, y + 74, 34, 600);
      text(sub, 183, y + 124, 26, 400, '#928a9f');
    });
  } else if (index === 1) {
    text('Find your focus.', 66, 365, 74, 700);
    text('One small thing. All your attention.', 66, 444, 31, 450, '#8b839a');
    ctx.strokeStyle = '#ebe6f7';
    ctx.lineWidth = 27;
    ctx.beginPath();
    ctx.arc(540, 1020, 327, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#8877cf';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(540, 1020, 327, -Math.PI / 2, Math.PI * 0.98);
    ctx.stroke();
    ctx.textAlign = 'center';
    text('18:42', 540, 1044, 135, 550);
    text('MORNING PAGES', 540, 1130, 25, 650, '#8e85a0');
    ctx.textAlign = 'left';
    rounded(ctx, 330, 1450, 420, 110, 55, '#7666ca');
    text('Pause session', 414, 1522, 31, 600, '#ffffff');
    rounded(ctx, 66, 1720, 948, 275, 36, '#eeebfa');
    text('A quiet reminder', 108, 1795, 30, 650);
    text('Progress starts with showing up.', 108, 1870, 32, 450, '#81758e');
    text('You are doing enough.', 108, 1924, 32, 450, '#81758e');
  } else {
    text('Small steps,', 66, 352, 75, 700);
    text('adding up.', 66, 441, 75, 700);
    text('YOUR WEEK AT A GLANCE', 68, 543, 25, 650, '#8b859c');
    rounded(ctx, 66, 635, 948, 1030, 38, '#ffffff');
    text('A little more present', 108, 724, 38, 650);
    text('7 moments made for yourself', 108, 782, 28, 450, '#928a9f');
    const heights = [180, 280, 225, 355, 300, 410, 350];
    heights.forEach((h, i) => {
      const x = 124 + i * 123;
      rounded(ctx, x, 1320 - h, 60, h, 20, i === 5 ? '#7566cc' : '#d7cfee');
      text(['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], x + 16, 1390, 25, 500, '#8f879d');
    });
    rounded(ctx, 107, 1470, 865, 1, 0, '#ece9f3');
    text('3h 45m', 112, 1577, 58, 650);
    text('time well spent', 545, 1570, 28, 450, '#928a9f');
    rounded(ctx, 66, 1760, 948, 255, 36, '#eeebfa');
    text('A week to feel good about', 108, 1846, 37, 650);
    text('Keep a rhythm that feels like you.', 108, 1923, 29, 450, '#81758e');
  }
  rounded(ctx, 0, 2150, 1080, 190, 0, '#ffffff');
  ['Today', 'Focus', 'Your week'].forEach((label, i) => {
    const x = 146 + i * 332;
    rounded(ctx, x, 2190, 26, 26, 8, i === index ? '#7566cc' : '#bcb6c9');
    text(label, x - 25, 2258, 23, i === index ? 650 : 450, i === index ? '#7566cc' : '#a39ab1');
  });
  rounded(ctx, 382, 2306, 316, 10, 5, '#292641');
  return canvas.toDataURL('image/png');
}
export function createDemoProject() {
  const project = createDefaultProject();
  project.name = 'Daylight';
  project.notes = 'Fictional focus planner · original demo screens';
  project.locales = project.locales.filter((l) => ['en-US', 'tr', 'de-DE'].includes(l.code));
  project.defaultLocale = 'en-US';
  const headlines = ['A clearer kind of day.', 'One thing at a time.', 'Make space for progress.'];
  const bodies = [
    'A little structure. A lot more breathing room.',
    'Give your attention a place to land.',
    'Small moments make a meaningful rhythm.',
  ];
  const turkish = ['Gününe biraz alan aç.', 'Her seferinde tek bir şey.', 'İlerlemene yer aç.'];
  const german = ['Ein klarerer Tag.', 'Eins nach dem anderen.', 'Raum für Fortschritt.'];
  const screens = [screen(0), screen(1), screen(2)];
  project.copy = {};
  headlines.forEach((headline, i) => {
    const number = String(i + 1).padStart(2, '0');
    project.copy[`shot_${number}_headline`] = { 'en-US': headline, tr: turkish[i], 'de-DE': german[i] };
    project.copy[`shot_${number}_body`] = {
      'en-US': bodies[i],
      tr: ['Biraz düzen. Daha çok nefes alanı.', 'Dikkatine bir yer aç.', 'Küçük anlarla kendi ritmini bul.'][
        i
      ],
      'de-DE': [
        'Etwas Struktur. Mehr Raum zum Atmen.',
        'Gib deiner Aufmerksamkeit einen Platz.',
        'Kleine Momente, ein eigener Rhythmus.',
      ][i],
    };
  });
  project.copyOrder = Object.keys(project.copy);
  project.documents = project.documents.map((d) => ({
    ...d,
    pageCount: d.kind === 'creative' ? 1 : 3,
    enabled: d.presetId === 'iphone-63-portrait',
    background: { ...d.background, color: '#f5f1ff', color2: '#d8e3f3', angle: 145 },
    layers: d.layers
      .filter((l) => l.x < d.width * 3)
      .map((l) =>
        l.type === 'device'
          ? ({ ...l, screenSrc: screens[Math.min(2, Math.max(0, Math.floor(l.x / d.width)))] } as DeviceLayer)
          : l.type === 'text'
            ? {
                ...l,
                color: l.translationKey.endsWith('body') ? '#80748e' : '#332a4c',
                fontWeight: l.translationKey.endsWith('body') ? 450 : 700,
              }
            : l,
      ),
  }));
  for (const document of project.documents) {
    if (document.kind !== 'screenshots' || document.width > document.height) continue;
    for (const layer of document.layers) {
      const page = Math.max(0, Math.floor(layer.x / document.width));
      if (layer.type === 'device') {
        const device = getDevice(layer.deviceId);
        layer.height = document.height * 0.64;
        layer.width = (layer.height * device.frameWidth) / device.frameHeight;
        layer.x = page * document.width + (document.width - layer.width) / 2;
        layer.y = document.height * 0.31;
      } else if (layer.type === 'text') {
        const body = layer.translationKey.endsWith('body');
        layer.x = page * document.width + document.width * (body ? 0.12 : 0.07);
        layer.y = document.height * (body ? 0.195 : 0.055);
        layer.width = document.width * (body ? 0.76 : 0.86);
        layer.height = document.height * (body ? 0.075 : 0.12);
        layer.fontSize = document.width * (body ? 0.032 : 0.085);
      }
    }
  }
  return project;
}
