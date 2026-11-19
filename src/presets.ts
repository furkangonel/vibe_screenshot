import type { OutputPreset } from './types';

export const OUTPUT_PRESETS: OutputPreset[] = [
  {
    id: 'iphone-63-portrait',
    label: 'iPhone 6.3″ · Portrait',
    group: 'App screenshots',
    width: 1206,
    height: 2622,
    kind: 'screenshots',
    maxPages: 10,
    required: true,
    notes: '6.3-inch portrait screenshot. Check the store requirements for your target device.',
    extension: 'png',
  },
  {
    id: 'iphone-69-portrait',
    label: 'iPhone 6.9″ · Portrait',
    group: 'App screenshots',
    width: 1320,
    height: 2868,
    kind: 'screenshots',
    maxPages: 10,
    notes: 'En büyük Dynamic Island iPhone çıktısı.',
    extension: 'png',
  },
  {
    id: 'ipad-13-portrait',
    label: 'iPad 13″ · Portrait',
    group: 'App screenshots',
    width: 2064,
    height: 2752,
    kind: 'screenshots',
    maxPages: 10,
    required: true,
    notes: 'iPadOS destekleyen uygulamalar için zorunlu 13 inç hedef.',
    extension: 'png',
  },
  {
    id: 'iphone-duo-portrait',
    label: 'Foldable · Custom',
    group: 'App screenshots',
    width: 1398,
    height: 2034,
    kind: 'screenshots',
    maxPages: 10,
    notes: 'Custom foldable canvas. Confirm accepted dimensions in your store before submission.',
    extension: 'png',
  },
  {
    id: 'iphone-63-landscape',
    label: 'iPhone 6.3″ · Landscape',
    group: 'Landscape alternatives',
    width: 2622,
    height: 1206,
    kind: 'screenshots',
    maxPages: 10,
    notes: '6.3 inç iPhone yatay alternatifi.',
    extension: 'png',
  },
  {
    id: 'ipad-13-landscape',
    label: 'iPad 13″ · Landscape',
    group: 'Landscape alternatives',
    width: 2752,
    height: 2064,
    kind: 'screenshots',
    maxPages: 10,
    notes: '13 inç iPad yatay alternatifi.',
    extension: 'png',
  },
  {
    id: 'product-header-21-9',
    label: 'Product Page Header · 21:9',
    group: 'Creative assets',
    width: 3840,
    height: 1646,
    kind: 'creative',
    maxPages: 1,
    notes: 'Product page header için özel 21:9 görsel.',
    extension: 'png',
  },
  {
    id: 'search-results-3-2',
    label: 'Search Results · 3:2',
    group: 'Creative assets',
    width: 3840,
    height: 2560,
    kind: 'creative',
    maxPages: 1,
    notes: 'Search Results için izin verilen maksimum 3:2 görsel.',
    extension: 'png',
  },
  {
    id: 'universal-creative-16-9',
    label: 'Universal Creative · 16:9',
    group: 'Creative assets',
    width: 5244,
    height: 2950,
    kind: 'creative',
    maxPages: 1,
    notes: 'Header ve Search Results için kullanılabilen evrensel PNG.',
    extension: 'png',
  },
  ...[
    { id: 'android-phone', label: 'Android Phone', width: 1080, height: 1920 },
    { id: 'android-tablet-7', label: 'Android Tablet 7″', width: 1440, height: 2560 },
    { id: 'android-tablet-10', label: 'Android Tablet 10″', width: 2160, height: 3840 },
  ].flatMap((target): OutputPreset[] =>
    (['portrait', 'landscape'] as const).map((orientation) => ({
      id: `${target.id}-${orientation}`,
      label: `${target.label} · ${orientation === 'portrait' ? 'Portrait' : 'Landscape'}`,
      group: 'Google Play screenshots',
      store: 'google-play',
      width: orientation === 'portrait' ? target.width : target.height,
      height: orientation === 'portrait' ? target.height : target.width,
      kind: 'screenshots',
      maxPages: 8,
      notes:
        target.id === 'android-phone'
          ? 'Google Play phone canvas. 9:16 portrait or 16:9 landscape; use 2–8 screenshots.'
          : 'Google Play tablet canvas. 9:16 portrait or 16:9 landscape; use at least 4 screenshots of the tablet app.',
      extension: 'png',
    })),
  ),
];

export function getPreset(id: string) {
  return OUTPUT_PRESETS.find((preset) => preset.id === id) ?? OUTPUT_PRESETS[0];
}

export function validateOutputSize(presetId: string, width: number, height: number) {
  const preset = getPreset(presetId);
  return preset.width === width && preset.height === height;
}
