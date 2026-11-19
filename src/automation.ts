import { createId } from './id';
import { createOutputDocument } from './defaultProject';
import { getDevice } from './devices';
import { getPreset, OUTPUT_PRESETS } from './presets';
import { parseProject, validateCopy } from './projectValidation';
import { DEFAULT_LOCALES } from './locales';
import { cropDevice, orientDevice, resetDeviceCrop } from './deviceLayout';
import { moveScreenshot } from './editorActions';
import { updateTextLayerForLocale } from './layerUtils';
import type { DeviceLayer, EditorLayer, ScreenshotProject, TextLayer } from './types';

type Args = Record<string, unknown>;
export function withoutImages<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === 'string' && item.startsWith('data:image/') ? '[embedded image omitted]' : item,
    ),
  );
}
function safePatch(value: unknown): Args {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  const patch = value as Args;
  if (Object.keys(patch).some((k) => ['__proto__', 'prototype', 'constructor'].includes(k)))
    throw new Error('Invalid property.');
  return patch;
}
function only(patch: Args, allowed: string[]) {
  if (Object.keys(patch).some((k) => !allowed.includes(k)))
    throw new Error(`Allowed properties: ${allowed.join(', ')}`);
}
export function applyAutomation(original: ScreenshotProject, method: string, args: Args) {
  const project = structuredClone(original);
  let result: unknown = { updated: true };
  if (method === 'project_update') {
    for (const key of ['name', 'notes', 'defaultLocale'] as const)
      if (args[key] !== undefined) project[key] = args[key] as string;
  } else if (method === 'document_add') {
    if (!OUTPUT_PRESETS.some((p) => p.id === args.presetId)) throw new Error('Unknown preset ID.');
    const document = {
      ...createOutputDocument(String(args.presetId), args.examples === true),
      enabled: true,
    };
    project.documents.push(document);
    result = { documentId: document.id };
  } else if (method === 'localizations_set') {
    const copy = validateCopy(args.copy);
    for (const [key, translations] of Object.entries(copy)) {
      if (Object.keys(translations).some((code) => !project.locales.some((locale) => locale.code === code)))
        throw new Error('Enable the content language before adding its translations.');
      project.copy[key] = { ...project.copy[key], ...translations };
    }
    project.copyOrder = [
      ...new Set([...(project.copyOrder ?? Object.keys(original.copy)), ...Object.keys(copy)]),
    ];
  } else if (method === 'locales_set') {
    if (!Array.isArray(args.codes) || !args.codes.length || new Set(args.codes).size !== args.codes.length)
      throw new Error('Choose unique supported locale codes.');
    project.locales = args.codes.map((code) => {
      const locale = DEFAULT_LOCALES.find((l) => l.code === code);
      if (!locale) throw new Error('Unknown content language.');
      return locale;
    });
    if (!project.locales.some((l) => l.code === project.defaultLocale))
      project.defaultLocale = project.locales[0].code;
  } else {
    const document = project.documents.find((d) => d.id === args.documentId);
    if (!document) throw new Error('Canvas ID was not found in this project.');
    if (method === 'document_update') {
      const patch = safePatch(args.patch);
      only(patch, ['name', 'pageCount', 'enabled', 'background']);
      if (patch.background) patch.background = { ...document.background, ...safePatch(patch.background) };
      Object.assign(document, patch);
    } else if (method === 'screenshots_reorder') {
      const from = Number(args.from),
        to = Number(args.to);
      if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < document.pageCount))
        throw new Error('Invalid screenshot index.');
      project.documents = project.documents.map((d) =>
        d.id === document.id ? moveScreenshot(d, from, to) : d,
      );
    } else if (method === 'layer_add') {
      const properties = safePatch(args.properties);
      const type = args.type;
      if (!['text', 'device', 'image', 'shape'].includes(String(type)))
        throw new Error('Unknown layer type.');
      if ('id' in properties || 'type' in properties)
        throw new Error('Layer ID and type are assigned by the studio.');
      const base = {
        id: createId(String(type)),
        name: String(type),
        x: 80,
        y: 80,
        width: Math.round(document.width * 0.6),
        height: 200,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
      };
      let defaults: Args;
      if (type === 'text')
        defaults = {
          translationKey: '',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 72,
          fontWeight: 700,
          color: '#172033',
          align: 'center',
          lineHeight: 1.1,
          letterSpacing: 0,
          autoFit: true,
          minFontSize: 24,
          localeOverrides: {},
        };
      else if (type === 'device') {
        const device = getDevice(String(properties.deviceId || 'iphone-18-pro'));
        if (properties.deviceId && device.id !== properties.deviceId) throw new Error('Unknown device ID.');
        defaults = {
          name: device.label,
          deviceId: device.id,
          colorId: device.colors[0].id,
          height: (base.width * device.frameHeight) / device.frameWidth,
          screenSrc: '',
          screenFit: 'cover',
          localeScreens: {},
          screenScale: 1,
          screenOffsetX: 0,
          screenOffsetY: 0,
          sceneVersion: 2,
        };
      } else if (type === 'image') defaults = { src: '', fit: 'cover', cornerRadius: 0, localeSources: {} };
      else
        defaults = {
          shape: 'rectangle',
          fill: '#0067e9',
          stroke: '#0067e9',
          strokeWidth: 0,
          cornerRadius: 24,
        };
      const layer = { ...base, ...defaults, ...properties, type } as EditorLayer;
      if (layer.type === 'text' && !layer.translationKey)
        throw new Error('Text layers need a translationKey. Add its text with localizations_set.');
      document.layers.push(layer);
      result = { layerId: layer.id };
    } else {
      const index = document.layers.findIndex((l) => l.id === args.layerId);
      const layer = document.layers[index];
      if (!layer) throw new Error('Layer ID was not found in this canvas.');
      if (method === 'layer_update') {
        const patch = safePatch(args.patch);
        if (['id', 'type'].some((k) => k in patch)) throw new Error('Layer ID and type cannot change.');
        if (args.locale) {
          if (layer.type !== 'text' || !project.locales.some((l) => l.code === args.locale))
            throw new Error('Choose a text layer and an enabled content language.');
          only(patch, ['x', 'y', 'width', 'height', 'fontSize', 'lineHeight', 'letterSpacing']);
          document.layers[index] = updateTextLayerForLocale(
            layer,
            String(args.locale),
            true,
            patch as Partial<TextLayer>,
          );
        } else document.layers[index] = { ...layer, ...patch } as EditorLayer;
      } else if (method === 'layer_duplicate') {
        const clone = {
          ...structuredClone(layer),
          id: createId(layer.type),
          name: `${layer.name} copy`,
          x: layer.x + 24,
          y: layer.y + 24,
        };
        document.layers.splice(index + 1, 0, clone);
        result = { layerId: clone.id };
      } else if (method === 'layer_remove') document.layers.splice(index, 1);
      else if (method === 'layer_reorder') {
        const target = Number(args.index);
        if (!Number.isInteger(target) || target < 0 || target >= document.layers.length)
          throw new Error('Invalid stacking index.');
        document.layers.splice(index, 1);
        document.layers.splice(target, 0, layer);
      } else if (method.startsWith('device_')) {
        if (layer.type !== 'device') throw new Error('Choose a device layer.');
        if (method === 'device_set_screen') {
          if (args.locale) {
            if (!project.locales.some((l) => l.code === args.locale))
              throw new Error('Enable this language first.');
            layer.localeScreens[String(args.locale)] = String(args.image);
          } else layer.screenSrc = String(args.image);
        } else if (method === 'device_orient')
          document.layers[index] = orientDevice(layer, args.orientation as 'portrait' | 'landscape');
        else if (method === 'device_crop')
          document.layers[index] =
            args.reset === true
              ? resetDeviceCrop(layer)
              : cropDevice(layer, safePatch(args.crop) as DeviceLayer['crop'] & object);
        else throw new Error('Unknown device action.');
      } else throw new Error('Unknown studio action.');
    }
  }
  // Use the same strict boundary as imported projects. Invalid patches never reach storage.
  parseProject(project);
  if (project.documents.some((d) => d.pageCount > getPreset(d.presetId).maxPages))
    throw new Error('Too many screenshots.');
  return { project, result };
}
