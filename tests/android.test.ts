import { describe, expect, it } from 'vitest';
import { DEVICES } from '../src/devices';
import { OUTPUT_PRESETS } from '../src/presets';
import { createDefaultProject, createOutputDocument } from '../src/defaultProject';
import { migrateProject } from '../src/projectMigration';
import { parseProject } from '../src/projectValidation';
import { deviceLayout, orientDevice } from '../src/deviceLayout';
import type { DeviceLayer } from '../src/types';

const targets = [
  ['android-phone', 1080, 1920],
  ['android-tablet-7', 1440, 2560],
  ['android-tablet-10', 2160, 3840],
] as const;

describe('Google Play output canvases', () => {
  it.each(targets)(
    '%s provides exact portrait and landscape output with an eight-page limit',
    (id, width, height) => {
      for (const orientation of ['portrait', 'landscape']) {
        const preset = OUTPUT_PRESETS.find((p) => p.id === `${id}-${orientation}`)!;
        expect(preset).toMatchObject({
          store: 'google-play',
          maxPages: 8,
          kind: 'screenshots',
          width: orientation === 'portrait' ? width : height,
          height: orientation === 'portrait' ? height : width,
        });
        expect(Math.max(preset.width, preset.height) / Math.min(preset.width, preset.height)).toBeCloseTo(
          16 / 9,
        );
        expect(Math.min(preset.width, preset.height)).toBeGreaterThanOrEqual(1080);
        expect(Math.max(preset.width, preset.height)).toBeLessThanOrEqual(7680);
      }
    },
  );

  it('opens existing projects without adding canvases or changing their images, copy or layouts', () => {
    const legacy = createDefaultProject();
    legacy.documents = legacy.documents.filter((d) => !d.presetId.startsWith('android-'));
    legacy.name = 'Existing app';
    legacy.notes = 'Keep my work';
    legacy.documents[0].background.imageSrc = 'data:image/png;base64,aGVsbG8=';
    const before = structuredClone(legacy);
    expect(migrateProject(parseProject(structuredClone(legacy)))).toEqual(before);
    expect(legacy.documents).toHaveLength(9);
    const added = { ...createOutputDocument('android-tablet-7-portrait', false), enabled: true };
    const next = { ...legacy, documents: [...legacy.documents, added] };
    expect(parseProject(next)).toBe(next);
    expect(next.documents.slice(0, 9)).toEqual(before.documents);
    expect(added).toMatchObject({ pageCount: 1, layers: [], width: 1440, height: 2560 });
    expect(next.copy).toEqual(before.copy);
  });

  it('keeps Android output opt-in and fits the matching devices in all example layouts', () => {
    const project = createDefaultProject();
    expect(parseProject(project)).toBe(project);
    const android = project.documents.filter((d) => d.presetId.startsWith('android-'));
    expect(android).toHaveLength(6);
    for (const document of android) {
      expect(document.enabled).toBe(false);
      const layer = document.layers.find((l): l is DeviceLayer => l.type === 'device')!;
      expect(layer.deviceId).toBe(document.presetId.replace(/-(portrait|landscape)$/, ''));
      expect(layer.x).toBeGreaterThanOrEqual(0);
      expect(layer.y).toBeGreaterThanOrEqual(0);
      expect(layer.x + layer.width).toBeLessThan(document.width);
      expect(layer.y + layer.height).toBeLessThan(document.height);
    }
  });

  it('rejects a ninth Google Play screenshot without reducing the existing iOS limit', () => {
    const project = createDefaultProject();
    const android = project.documents.find((d) => d.presetId === 'android-phone-portrait')!;
    android.pageCount = 9;
    expect(() => parseProject(project)).toThrow('pageCount');
    android.pageCount = 8;
    project.documents[0].pageCount = 10;
    expect(parseProject(project)).toBe(project);
  });
});

describe('Android device frames', () => {
  it('adds a punch-hole phone and two tablets while retaining every existing device ID', () => {
    const android = DEVICES.filter((d) => d.platform === 'android');
    expect(android.map((d) => d.id)).toEqual(targets.map((t) => t[0]));
    expect(android.reduce((sum, d) => sum + d.colors.length, 0)).toBe(7);
    expect(DEVICES[0].id).toBe('iphone-18-pro');
    for (const device of android) {
      expect(device.screenX * 2 + device.screenWidth).toBe(device.frameWidth);
      expect(device.screenY * 2 + device.screenHeight).toBe(device.frameHeight);
      expect(device.screenRadius).toBeGreaterThan(0);
      expect(device.screenRadius).toBeLessThan(device.screenWidth / 2);
      expect(device.colors.every((c) => c.src.endsWith(`/${device.id}/${c.id}.svg`))).toBe(true);
    }
  });

  it('preserves the screenshot, translations and screen aspect when turning an Android tablet', () => {
    const layer = createDefaultProject()
      .documents.find((d) => d.presetId === 'android-tablet-10-portrait')!
      .layers.find((l): l is DeviceLayer => l.type === 'device')!;
    layer.screenSrc = 'data:image/png;base64,aGVsbG8=';
    layer.localeScreens = { tr: layer.screenSrc };
    const device = DEVICES.find((d) => d.id === layer.deviceId)!;
    const before = deviceLayout(layer, device);
    const rotated = orientDevice(layer, 'landscape');
    const after = deviceLayout(rotated, device);
    expect(after.screen.width).toBeCloseTo(before.screen.height);
    expect(after.screen.height).toBeCloseTo(before.screen.width);
    expect(rotated.screenSrc).toBe(layer.screenSrc);
    expect(rotated.localeScreens).toEqual(layer.localeScreens);
  });
});
