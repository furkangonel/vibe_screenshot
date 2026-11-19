import type { ScreenshotProject } from './types';
import { OUTPUT_PRESETS } from './presets';
import { DEVICES } from './devices';

type RecordValue = Record<string, unknown>;
function invalid(path: string): never {
  throw new Error(`Invalid project: ${path}`);
}
function object(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  if (Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key)))
    invalid(path);
  return value as RecordValue;
}
function string(value: unknown, path: string, max = 100_000): asserts value is string {
  if (typeof value !== 'string' || value.length > max) invalid(path);
}
function number(value: unknown, path: string, min = -1_000_000, max = 1_000_000) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(path);
}
function boolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') invalid(path);
}
function choice(value: unknown, choices: readonly unknown[], path: string) {
  if (!choices.includes(value)) invalid(path);
}
function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path);
  return value;
}
function image(value: unknown, path: string) {
  string(value, path, 70_000_000);
  if (value !== '' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)) invalid(path);
}
function map(value: unknown, path: string, check: (value: unknown, path: string) => void) {
  for (const [key, item] of Object.entries(object(value, path))) {
    string(key, path, 300);
    check(item, `${path}.${key}`);
  }
}
function color(value: unknown, path: string) {
  string(value, path, 32);
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) invalid(path);
}
function unique(values: unknown[], key: string, path: string) {
  const ids = values.map((v) => {
    const id = object(v, path)[key];
    string(id, path, 300);
    if (!id) invalid(path);
    return id;
  });
  if (new Set(ids).size !== ids.length) invalid(`${path}: duplicate ${key}`);
}
export function validateCopy(value: unknown) {
  map(value, 'copy', (translations, path) => map(translations, path, string));
  return value as ScreenshotProject['copy'];
}
export function validateLocales(value: unknown) {
  const locales = list(value, 'locales', 100);
  if (!locales.length) invalid('locales');
  unique(locales, 'code', 'locales');
  for (const item of locales) {
    const locale = object(item, 'locale');
    string(locale.name, 'locale.name', 200);
    string(locale.code, 'locale.code', 40);
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale.code)) invalid('locale.code');
  }
  return value as ScreenshotProject['locales'];
}
export function parseProject(value: unknown): ScreenshotProject {
  const p = object(value, 'root');
  if (p.version !== 1) invalid('version');
  string(p.name, 'name', 200);
  if (p.notes !== undefined) string(p.notes, 'notes', 10000);
  string(p.updatedAt, 'updatedAt', 100);
  string(p.defaultLocale, 'defaultLocale', 40);
  if (!Number.isFinite(Date.parse(p.updatedAt as string))) invalid('updatedAt');
  const locales = validateLocales(p.locales);
  if (!locales.some((l) => l.code === p.defaultLocale)) invalid('defaultLocale');
  validateCopy(p.copy);
  if (p.copyOrder !== undefined) {
    const order = list(p.copyOrder, 'copyOrder', 10000);
    for (const key of order) string(key, 'copyOrder.key', 300);
    if (new Set(order).size !== order.length) invalid('copyOrder: duplicate key');
  }
  const documents = list(p.documents, 'documents', 30);
  if (!documents.length) invalid('documents');
  unique(documents, 'id', 'documents');
  for (const item of documents) {
    const d = object(item, 'document');
    string(d.name, 'document.name', 200);
    const preset = OUTPUT_PRESETS.find((item) => item.id === d.presetId);
    const legacy = d.presetId === 'duo-inner-portrait' || d.presetId === 'duo-outer-portrait';
    if (!preset && !legacy) invalid('presetId');
    number(d.width, 'width', 1, 16384);
    number(d.height, 'height', 1, 16384);
    if (preset && (d.width !== preset.width || d.height !== preset.height || d.kind !== preset.kind))
      invalid('preset dimensions');
    number(d.pageCount, 'pageCount', 1, preset?.maxPages ?? 10);
    if (!Number.isInteger(d.pageCount)) invalid('pageCount');
    boolean(d.enabled, 'enabled');
    choice(d.kind, ['screenshots', 'creative'], 'kind');
    const bg = object(d.background, 'background');
    choice(bg.type, ['solid', 'linear', 'image'], 'background.type');
    color(bg.color, 'background.color');
    color(bg.color2, 'background.color2');
    number(bg.angle, 'background.angle');
    if (bg.imageSrc !== undefined) image(bg.imageSrc, 'background.imageSrc');
    if (bg.pageImages !== undefined) map(bg.pageImages, 'background.pageImages', image);
    if (bg.imageFit !== undefined) choice(bg.imageFit, ['cover', 'contain', 'fill'], 'background.imageFit');
    if (bg.imageOpacity !== undefined) number(bg.imageOpacity, 'background.imageOpacity', 0, 1);
    const layers = list(d.layers, 'layers', 1000);
    unique(layers, 'id', 'layers');
    for (const item of layers) {
      const l = object(item, 'layer');
      string(l.name, 'layer.name', 500);
      choice(l.type, ['text', 'image', 'shape', 'device'], 'layer.type');
      for (const key of ['x', 'y', 'rotation']) number(l[key], `layer.${key}`);
      for (const key of ['width', 'height']) number(l[key], `layer.${key}`, 0.01, 100_000);
      number(l.opacity, 'opacity', 0, 1);
      boolean(l.visible, 'visible');
      boolean(l.locked, 'locked');
      if (l.clipPage !== undefined) {
        number(l.clipPage, 'clipPage', 0, (d.pageCount as number) - 1);
        if (!Number.isInteger(l.clipPage)) invalid('clipPage');
      }
      if (l.type === 'text') {
        for (const key of ['translationKey', 'fontFamily']) string(l[key], key, 500);
        for (const key of ['fontSize', 'minFontSize']) number(l[key], key, 1, 10000);
        number(l.fontWeight, 'fontWeight', 100, 1000);
        number(l.lineHeight, 'lineHeight', 0.1, 10);
        number(l.letterSpacing, 'letterSpacing', -1000, 1000);
        color(l.color, 'text.color');
        boolean(l.autoFit, 'autoFit');
        choice(l.align, ['left', 'center', 'right'], 'align');
        map(l.localeOverrides, 'localeOverrides', (v, path) => {
          const style = object(v, path);
          for (const [key, val] of Object.entries(style)) {
            choice(key, ['x', 'y', 'width', 'height', 'fontSize', 'lineHeight', 'letterSpacing'], path);
            if (val !== undefined)
              number(
                val,
                path,
                ['width', 'height', 'fontSize', 'lineHeight'].includes(key) ? 0.01 : -1_000_000,
              );
          }
        });
      } else if (l.type === 'image') {
        image(l.src, 'image.src');
        map(l.localeSources, 'localeSources', image);
        choice(l.fit, ['cover', 'contain', 'fill'], 'image.fit');
        number(l.cornerRadius, 'cornerRadius', 0);
      } else if (l.type === 'device') {
        if (l.orientation !== undefined) choice(l.orientation, ['portrait', 'landscape'], 'orientation');
        if (l.crop !== undefined) {
          const crop = object(l.crop, 'device.crop');
          number(crop.x, 'crop.x', 0, 1);
          number(crop.y, 'crop.y', 0, 1);
          number(crop.width, 'crop.width', 0.000000001, 1);
          number(crop.height, 'crop.height', 0.000000001, 1);
          if (
            (crop.x as number) + (crop.width as number) > 1.000001 ||
            (crop.y as number) + (crop.height as number) > 1.000001
          )
            invalid('crop bounds');
        }
        const device = DEVICES.find((item) => item.id === l.deviceId);
        if (!device || !device.colors.some((c) => c.id === l.colorId)) invalid('device');
        image(l.screenSrc, 'screenSrc');
        map(l.localeScreens, 'localeScreens', image);
        choice(l.screenFit, ['cover', 'contain', 'fill'], 'screenFit');
        for (const key of ['screenScale', 'screenOffsetX', 'screenOffsetY', 'foldAngle'])
          if (l[key] !== undefined)
            number(
              l[key],
              key,
              key === 'screenScale' ? 0.1 : key === 'foldAngle' ? 35 : -100,
              key === 'foldAngle' ? 175 : 100,
            );
        if (l.sceneVersion !== undefined) choice(l.sceneVersion, [2], 'sceneVersion');
        if (l.foldDirection !== undefined) choice(l.foldDirection, ['toward', 'away'], 'foldDirection');
      } else {
        choice(l.shape, ['rectangle', 'ellipse'], 'shape');
        color(l.fill, 'fill');
        color(l.stroke, 'stroke');
        number(l.strokeWidth, 'strokeWidth', 0);
        number(l.cornerRadius, 'cornerRadius', 0);
      }
    }
  }
  return value as ScreenshotProject;
}
