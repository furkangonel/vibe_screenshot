import type { EditorLayer, ScreenshotProject, TextLayer } from './types';

export function localizedText(project: ScreenshotProject, key: string, locale: string) {
  const entry = project.copy[key] ?? {};
  return entry[locale] || entry[project.defaultLocale] || key;
}

export function effectiveLayer<T extends EditorLayer>(layer: T, locale: string): T {
  if (layer.type !== 'text') return layer;
  const override = layer.localeOverrides[locale];
  if (!override) return layer;
  return { ...layer, ...override } as T;
}

export function updateTextLayerForLocale(
  layer: TextLayer,
  locale: string,
  localeSpecific: boolean,
  patch: Partial<TextLayer>,
): TextLayer {
  if (!localeSpecific) return { ...layer, ...patch };
  const allowed = ['x', 'y', 'width', 'height', 'fontSize', 'lineHeight', 'letterSpacing'] as const;
  const localePatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => (allowed as readonly string[]).includes(key)),
  );
  const globalPatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !(allowed as readonly string[]).includes(key)),
  );
  return {
    ...layer,
    ...globalPatch,
    localeOverrides: {
      ...layer.localeOverrides,
      [locale]: { ...layer.localeOverrides[locale], ...localePatch },
    },
  };
}

export function isLayerAcrossSeam(layer: EditorLayer, pageWidth: number) {
  const start = Math.floor(layer.x / pageWidth);
  const end = Math.floor((layer.x + layer.width) / pageWidth);
  return start !== end;
}
