import { DEVICES } from './devices';
import { createId } from './id';
import { DEFAULT_LOCALES } from './locales';
import { OUTPUT_PRESETS } from './presets';
import type {
  CopyTable,
  DeviceLayer,
  EditorLayer,
  LayoutDocument,
  ScreenshotProject,
  TextLayer,
} from './types';

const starterCopy: CopyTable = {};

const sourceLines = [
  ['Learn anything, your way', 'Turn your own material into a clear learning path.'],
  ['See the whole topic clearly', 'Break difficult ideas into focused explanations.'],
  ['Build a plan that fits you', 'Move from intention to a realistic study routine.'],
  ['Go deeper when it matters', 'Explore every concept without losing the big picture.'],
  ['Practice with purpose', 'Review, recall and strengthen what you have learned.'],
  ['Keep your progress visible', 'Know what is complete and what deserves attention.'],
];

const turkishLines = [
  ['Her şeyi kendi yönteminizle öğrenin', 'Kendi içeriğinizi anlaşılır bir öğrenme yoluna dönüştürün.'],
  ['Konunun tamamını net görün', 'Zor fikirleri odaklı ve anlaşılır açıklamalara ayırın.'],
  ['Size uyan bir plan oluşturun', 'Niyetinizi gerçekçi bir çalışma düzenine dönüştürün.'],
  ['Gerektiğinde daha derine inin', 'Büyük resmi kaybetmeden her kavramı keşfedin.'],
  ['Amaca yönelik pratik yapın', 'Öğrendiklerinizi tekrar edin, hatırlayın ve güçlendirin.'],
  ['İlerlemenizi görünür tutun', 'Nelerin tamamlandığını ve neye odaklanmanız gerektiğini bilin.'],
];

sourceLines.forEach(([headline, body], index) => {
  const number = String(index + 1).padStart(2, '0');
  starterCopy[`shot_${number}_headline`] = { 'en-US': headline, tr: turkishLines[index][0] };
  starterCopy[`shot_${number}_body`] = { 'en-US': body, tr: turkishLines[index][1] };
});

starterCopy.creative_headline = {
  'en-US': 'A clearer way to learn',
  tr: 'Öğrenmenin daha net bir yolu',
};
starterCopy.creative_body = {
  'en-US': 'Build understanding from the material that matters to you.',
  tr: 'Sizin için önemli olan içeriklerle kalıcı bir anlayış oluşturun.',
};

function textLayer(
  name: string,
  translationKey: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  weight: number,
): TextLayer {
  return {
    id: createId('text'),
    type: 'text',
    name,
    translationKey,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize,
    fontWeight: weight,
    color: '#172033',
    align: 'center',
    lineHeight: 1.05,
    letterSpacing: -1,
    autoFit: true,
    minFontSize: Math.max(24, Math.round(fontSize * 0.58)),
    localeOverrides: {},
  };
}

function deviceLayer(deviceId: string, x: number, y: number, width: number): DeviceLayer {
  const device = DEVICES.find((item) => item.id === deviceId) ?? DEVICES[0];
  return {
    id: createId('device'),
    type: 'device',
    name: device.label,
    x,
    y,
    width,
    height: width * (device.frameHeight / device.frameWidth),
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    deviceId: device.id,
    colorId: device.colors[0].id,
    screenSrc: '',
    screenFit: 'cover',
    localeScreens: {},
    screenScale: 1,
    screenOffsetX: 0,
    screenOffsetY: 0,
    foldAngle: 110,
    foldDirection: 'toward',
  };
}

function deviceForPreset(presetId: string) {
  if (presetId.startsWith('android-tablet-7')) return 'android-tablet-7';
  if (presetId.startsWith('android-tablet-10')) return 'android-tablet-10';
  if (presetId.startsWith('android-phone')) return 'android-phone';
  if (presetId.includes('ipad')) return 'ipad-pro-m5-13';
  if (presetId.includes('duo')) return 'iphone-duo-outer-closed';
  if (presetId.includes('69')) return 'iphone-18-pro-max';
  return 'iphone-18-pro';
}

function buildScreenshotLayers(
  width: number,
  height: number,
  presetId: string,
  pageCount: number,
): EditorLayer[] {
  const layers: EditorLayer[] = [];
  const margin = Math.round(width * 0.085);
  const device = DEVICES.find((item) => item.id === deviceForPreset(presetId)) ?? DEVICES[0];
  const android = device.platform === 'android';
  const landscape = android && width > height;
  const deviceWidth = Math.round(
    android
      ? landscape
        ? width * 0.46
        : Math.min(width * 0.72, (height * 0.57 * device.frameWidth) / device.frameHeight)
      : width * (presetId.includes('ipad') ? 0.7 : 0.62),
  );
  const deviceHeight = deviceWidth * (device.frameHeight / device.frameWidth);

  for (let index = 0; index < pageCount; index += 1) {
    const pageX = index * width;
    const number = String(index + 1).padStart(2, '0');
    if (landscape) {
      const device = deviceLayer(deviceForPreset(presetId), pageX + width * 0.49, 0, deviceWidth);
      device.orientation = 'landscape';
      const definition = DEVICES.find((item) => item.id === device.deviceId)!;
      device.height = (deviceWidth * definition.frameWidth) / definition.frameHeight;
      device.y = (height - device.height) / 2;
      layers.push(
        textLayer(
          `Headline ${number}`,
          `shot_${number}_headline`,
          pageX + margin,
          height * 0.18,
          width * 0.35,
          height * 0.3,
          width * 0.043,
          760,
        ),
        textLayer(
          `Body ${number}`,
          `shot_${number}_body`,
          pageX + margin,
          height * 0.52,
          width * 0.35,
          height * 0.23,
          width * 0.019,
          480,
        ),
        device,
      );
      continue;
    }
    layers.push(
      textLayer(
        `Headline ${number}`,
        `shot_${number}_headline`,
        pageX + margin,
        Math.round(height * 0.07),
        width - margin * 2,
        Math.round(height * 0.17),
        Math.round(width * 0.07),
        760,
      ),
    );
    layers.push(
      textLayer(
        `Body ${number}`,
        `shot_${number}_body`,
        pageX + margin * 1.2,
        Math.round(height * 0.245),
        width - margin * 2.4,
        Math.round(height * 0.105),
        Math.round(width * 0.028),
        480,
      ),
    );
    layers.push(
      deviceLayer(
        device.id,
        pageX + Math.round((width - deviceWidth) / 2),
        android
          ? Math.round(height * 0.39)
          : Math.max(Math.round(height * 0.39), height - deviceHeight + Math.round(height * 0.085)),
        deviceWidth,
      ),
    );
  }

  return layers;
}

function buildCreativeLayers(width: number, height: number): EditorLayer[] {
  const deviceWidth = Math.round(height * 0.42);
  return [
    textLayer(
      'Creative headline',
      'creative_headline',
      Math.round(width * 0.08),
      Math.round(height * 0.27),
      Math.round(width * 0.52),
      Math.round(height * 0.28),
      Math.round(height * 0.105),
      760,
    ),
    textLayer(
      'Creative body',
      'creative_body',
      Math.round(width * 0.08),
      Math.round(height * 0.59),
      Math.round(width * 0.48),
      Math.round(height * 0.16),
      Math.round(height * 0.043),
      480,
    ),
    deviceLayer('iphone-18-pro', Math.round(width * 0.68), Math.round(height * 0.08), deviceWidth),
  ];
}

export function createOutputDocument(presetId: string, examples = true): LayoutDocument {
  const preset = OUTPUT_PRESETS.find((item) => item.id === presetId)!;
  const pageCount = examples && preset.kind === 'screenshots' ? 6 : 1;
  const layers = !examples
    ? []
    : preset.kind === 'screenshots'
      ? buildScreenshotLayers(preset.width, preset.height, preset.id, pageCount)
      : buildCreativeLayers(preset.width, preset.height);

  return {
    id: createId('layout'),
    presetId: preset.id,
    name: preset.label,
    width: preset.width,
    height: preset.height,
    kind: preset.kind,
    pageCount,
    enabled: preset.store !== 'google-play' && !preset.id.includes('landscape'),
    background: {
      type: 'linear',
      color: '#f5f7fb',
      color2: '#dce8ff',
      angle: 135,
      imageSrc: '',
      imageFit: 'cover',
      imageOpacity: 1,
      pageImages: {},
    },
    layers,
  };
}

export function createDefaultProject(): ScreenshotProject {
  return {
    version: 1,
    name: 'App Store Campaign',
    defaultLocale: 'en-US',
    locales: DEFAULT_LOCALES,
    copy: structuredClone(starterCopy),
    documents: OUTPUT_PRESETS.map((preset) => createOutputDocument(preset.id)),
    updatedAt: new Date().toISOString(),
  };
}
