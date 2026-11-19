import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../src/defaultProject';
import { copyKeys, deleteCopyKeys, layerPages, moveCopyKey, moveScreenshot } from '../src/editorActions';
import { resizeOrigin, snapPosition, snapSize } from '../src/guideGeometry';
import { parseProject } from '../src/projectValidation';
import { cropDevice, deviceLayout, orientDevice, resetDeviceCrop } from '../src/deviceLayout';
import { getDevice } from '../src/devices';
import type { DeviceLayer } from '../src/types';

describe('translation editing', () => {
  it('persists arbitrary key order, including numeric names, without changing translations', () => {
    const p = createDefaultProject();
    p.copy = { '1': { tr: 'Bir' }, '2': { tr: 'İki' }, greeting: { tr: 'Merhaba' } };
    const moved = moveCopyKey(p, '2', 0);
    expect(copyKeys(parseProject(JSON.parse(JSON.stringify(moved))))).toEqual(['2', '1', 'greeting']);
    expect(moved.copy).toBe(p.copy);
    expect(moveCopyKey(moved, 'missing', 0)).toBe(moved);
  });
  it('removes selected keys and their references across outputs, preserving unrelated artwork', () => {
    const p = createDefaultProject();
    const before = p.documents.map((d) => d.layers.filter((l) => l.type !== 'text'));
    const after = deleteCopyKeys(p, ['shot_01_headline', 'shot_01_body']);
    expect(after.copy.shot_01_headline).toBeUndefined();
    expect(
      after.documents.every((d) =>
        d.layers.every((l) => l.type !== 'text' || !l.translationKey.startsWith('shot_01_')),
      ),
    ).toBe(true);
    expect(after.documents.map((d) => d.layers.filter((l) => l.type !== 'text'))).toEqual(before);
    expect(p.copy.shot_01_headline).toBeDefined();
  });
});

describe('screenshot order and shared layers', () => {
  it('moves backgrounds, objects and locale positions together and serializes the result', () => {
    const p = createDefaultProject(),
      d = p.documents[0],
      w = d.width;
    d.pageCount = 3;
    const text = d.layers.find((l) => l.type === 'text')!;
    if (text.type !== 'text') throw Error();
    d.layers = [{ ...text, x: 80, localeOverrides: { tr: { x: 100, fontSize: 70 } } }];
    d.background.pageImages = { '0': 'data:image/png;base64,YQ==', '1': 'data:image/png;base64,Yg==' };
    const moved = moveScreenshot(d, 0, 2);
    expect(moved.layers[0].x).toBe(2 * w + 80);
    expect(moved.layers[0].type === 'text' && moved.layers[0].localeOverrides.tr).toEqual({
      x: 2 * w + 100,
      fontSize: 70,
    });
    expect(moved.background.pageImages).toEqual({
      '0': 'data:image/png;base64,Yg==',
      '2': 'data:image/png;base64,YQ==',
    });
    p.documents = [moved];
    expect(() => parseProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  });
  it('shows a seam object in both groups and keeps each cropped half when pages separate', () => {
    const d = createDefaultProject().documents[0],
      w = d.width;
    d.pageCount = 3;
    const shape = {
      ...d.layers[0],
      type: 'shape' as const,
      shape: 'rectangle' as const,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 0,
      cornerRadius: 0,
      x: w - 100,
      y: 400,
      width: 200,
      height: 300,
    };
    d.layers = [shape];
    expect(layerPages(shape, d)).toEqual([0, 1]);
    const moved = moveScreenshot(d, 0, 2);
    expect(moved.layers).toHaveLength(2);
    expect(moved.layers.map((l) => l.clipPage)).toEqual([2, 0]);
    expect(moved.layers.map((l) => l.x - l.clipPage! * w)).toEqual([w - 100, -100]);
    expect(new Set(moved.layers.map((l) => l.id)).size).toBe(2);
    expect(moveScreenshot(moved, 2, 0).layers).toHaveLength(2);
  });
});

describe('smart alignment and dimensions', () => {
  it('snaps to the artboard center and equivalent positions on other screenshots', () => {
    const snap = snapPosition({ x: 402, y: 102, width: 200, height: 80 }, [], 1000, 1800, 0, 5);
    expect(snap.dx).toBe(-2);
    expect(snap.guides.some((g) => g.points[0] === 500)).toBe(true);
    const peer = snapPosition(
      { x: 1103, y: 203, width: 250, height: 100 },
      [{ id: 'a', x: 100, y: 200, width: 250, height: 100 }],
      1000,
      1800,
      1,
      5,
    );
    expect(peer.dx).toBe(-3);
    expect(peer.dy).toBe(-3);
  });
  it('keeps device proportions and the fixed resize corner while matching width', () => {
    const size = snapSize(799, 1598, [{ id: 'device', x: 0, y: 0, width: 800, height: 1700 }], 5, true);
    expect(size.width).toBe(800);
    expect(size.height).toBe(1600);
    expect(resizeOrigin({ x: 10, y: 20, width: 799, height: 1598 }, 800, 1600, 'top-left', 0)).toEqual({
      x: 9,
      y: 18,
    });
    expect(snapSize(799, 1598, [], 5, true).matches).toEqual([]);
  });
});

describe('device cropping and orientation', () => {
  const device = () =>
    createDefaultProject().documents[0].layers.find((l) => l.type === 'device') as DeviceLayer;
  it('composes crop regions without filtering the screen and reverses them exactly', () => {
    const original = device();
    original.rotation = 24;
    const first = cropDevice(original, { x: 0.2, y: 0.1, width: 0.6, height: 0.7 });
    const second = cropDevice(first, { x: 0.1, y: 0.2, width: 0.5, height: 0.5 });
    expect(second.crop).toEqual({ x: 0.26, y: 0.24, width: 0.3, height: 0.35 });
    expect(second.screenSrc).toBe(original.screenSrc);
    const reset = resetDeviceCrop(second);
    expect(reset.x).toBeCloseTo(original.x);
    expect(reset.y).toBeCloseTo(original.y);
    expect(reset.width).toBeCloseTo(original.width);
    expect(reset.height).toBeCloseTo(original.height);
  });
  it('turns the device frame while preserving upright landscape screen geometry and crop', () => {
    const original = cropDevice(device(), { x: 0.1, y: 0.2, width: 0.7, height: 0.6 });
    const landscape = orientDevice(original, 'landscape');
    expect(landscape.width).toBe(original.height);
    const layout = deviceLayout(landscape, getDevice(landscape.deviceId));
    expect(layout.landscape).toBe(true);
    expect(layout.screen.width).toBeGreaterThan(layout.screen.height);
    const portrait = orientDevice(landscape, 'portrait');
    expect(portrait.crop!.x).toBeCloseTo(original.crop!.x);
    expect(portrait.crop!.y).toBeCloseTo(original.crop!.y);
    expect(portrait.x).toBeCloseTo(original.x);
  });
});
