import { describe, expect, it } from 'vitest';
import { applyAutomation } from '../src/automation';
import { createDefaultProject } from '../src/defaultProject';
import type { DeviceLayer, TextLayer } from '../src/types';
describe('MCP project edits', () => {
  it('preserves screenshots, translations and unrelated properties during an edit', () => {
    const original = createDefaultProject();
    const device = original.documents[0].layers.find((l) => l.type === 'device') as DeviceLayer;
    device.screenSrc = 'data:image/png;base64,aGVsbG8=';
    const before = structuredClone(original);
    const { project } = applyAutomation(original, 'project_update', { name: 'New launch' });
    expect(project.name).toBe('New launch');
    expect(project.documents).toEqual(before.documents);
    expect(project.copy).toEqual(before.copy);
    expect(original).toEqual(before);
  });
  it('rejects invalid patches before changing the original project', () => {
    const original = createDefaultProject(),
      document = original.documents[0];
    expect(() =>
      applyAutomation(original, 'document_update', { documentId: document.id, patch: { width: 12 } }),
    ).toThrow('Allowed properties');
    expect(() =>
      applyAutomation(original, 'document_update', { documentId: document.id, patch: { pageCount: 11 } }),
    ).toThrow('pageCount');
    const device = document.layers.find((l) => l.type === 'device')!;
    expect(() =>
      applyAutomation(original, 'device_set_screen', {
        documentId: document.id,
        layerId: device.id,
        image: 'https://example.com/image.png',
      }),
    ).toThrow('screenSrc');
    expect((device as DeviceLayer).screenSrc).toBe('');
  });
  it('merges one translation and one localized geometry without replacing other languages', () => {
    const original = createDefaultProject(),
      document = original.documents[0];
    const text = document.layers.find((l) => l.type === 'text') as TextLayer;
    const translated = applyAutomation(original, 'localizations_set', {
      copy: { [text.translationKey]: { tr: 'Yeni metin' } },
    }).project;
    expect(translated.copy[text.translationKey]['en-US']).toBe(original.copy[text.translationKey]['en-US']);
    const moved = applyAutomation(translated, 'layer_update', {
      documentId: document.id,
      layerId: text.id,
      locale: 'tr',
      patch: { x: 140 },
    }).project;
    const next = moved.documents[0].layers.find((l) => l.id === text.id) as TextLayer;
    expect(next.x).toBe(text.x);
    expect(next.localeOverrides.tr.x).toBe(140);
  });
  it('adds a matching device, rotates it and leaves the screenshot intact', () => {
    const original = createDefaultProject(),
      document = original.documents[0];
    const added = applyAutomation(original, 'layer_add', {
      documentId: document.id,
      type: 'device',
      properties: { deviceId: 'android-tablet-7', x: 300 },
    });
    const layerId = (added.result as { layerId: string }).layerId;
    const screened = applyAutomation(added.project, 'device_set_screen', {
      documentId: document.id,
      layerId,
      image: 'data:image/png;base64,aGVsbG8=',
    });
    const rotated = applyAutomation(screened.project, 'device_orient', {
      documentId: document.id,
      layerId,
      orientation: 'landscape',
    }).project.documents[0].layers.find((l) => l.id === layerId) as DeviceLayer;
    expect(rotated.orientation).toBe('landscape');
    expect(rotated.screenSrc).toBe('data:image/png;base64,aGVsbG8=');
    expect(rotated.width).toBeGreaterThan(rotated.height);
  });
  it('keeps existing documents unchanged when adding an Android output', () => {
    const original = createDefaultProject();
    original.documents = original.documents.filter((d) => !d.presetId.startsWith('android-'));
    const added = applyAutomation(original, 'document_add', { presetId: 'android-phone-portrait' }).project;
    expect(added.documents.slice(0, 9)).toEqual(original.documents);
    expect(added.documents[9]).toMatchObject({ width: 1080, height: 1920, pageCount: 1, layers: [] });
  });
});
