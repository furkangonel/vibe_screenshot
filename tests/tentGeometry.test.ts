import { describe, expect, it } from 'vitest';
import { getTentScene, polygonArea, TENT_THICKNESS } from '../src/tentGeometry';
import { getHalfFoldedCanvasSize } from '../src/duoHalfFold';
import { createDefaultProject } from '../src/defaultProject';
import { migrateProject } from '../src/projectMigration';
import type { DeviceLayer } from '../src/types';

describe('physical tent scene', () => {
  it.each(['toward', 'away'] as const)('keeps the rear slab substantial at 90° from %s', (direction) => {
    const scene = getTentScene(90, direction);
    const front = scene.faces.find((face) => face.id === 'front-outer')!;
    const rear = scene.faces.find((face) => face.id === 'rear-inner')!;
    expect(front.visible).toBe(true);
    expect(rear.visible).toBe(true);
    expect(polygonArea(rear.points) / polygonArea(front.points)).toBeGreaterThan(0.22);
    expect(
      scene.faces.some((face) => face.material === 'edge' && face.visible && polygonArea(face.points) > 1000),
    ).toBe(true);
    expect(scene.thickness).toBe(TENT_THICKNESS);
  });
  it.each([35, 45, 90, 110, 135, 165, 175])(
    'bounds both viewpoints at %s° and avoids invalid projections',
    (angle) => {
      const left = getTentScene(angle, 'toward'),
        right = getTentScene(angle, 'away');
      expect(left.width).toBe(right.width);
      expect(left.height).toBe(right.height);
      for (const scene of [left, right])
        for (const face of scene.faces)
          for (const point of face.points) {
            expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
            expect(point.x).toBeGreaterThan(0);
            expect(point.x).toBeLessThan(scene.width);
            expect(point.y).toBeGreaterThan(0);
            expect(point.y).toBeLessThan(scene.height);
          }
      expect(getHalfFoldedCanvasSize('tent', angle)).toMatchObject({
        width: left.width,
        height: left.height,
      });
    },
  );
  it('models slab thickness in world space and contacts the floor', () => {
    const scene = getTentScene(90);
    for (const panel of ['front', 'rear'] as const) {
      const outer = scene.surface(panel, 0, 1500),
        inner = scene.surface(panel, 0, 1500, true);
      expect(Math.hypot(inner.x - outer.x, inner.y - outer.y, inner.z - outer.z)).toBeCloseTo(TENT_THICKNESS);
      expect(inner.y).toBeCloseTo(0);
    }
  });
});

describe('saved tent layouts', () => {
  function projectWithTent(stretch = false) {
    const p = createDefaultProject();
    const layer = p.documents[0].layers.find((l) => l.type === 'device') as DeviceLayer;
    layer.deviceId = 'iphone-duo-folded-tent';
    layer.foldAngle = 90;
    layer.width = 1000;
    const half = (90 * Math.PI) / 360,
      projected = 1528 * Math.sin(half),
      depth = 1528 * Math.cos(half) * 0.9;
    layer.height = stretch
      ? 850
      : (1000 * Math.ceil(depth + projected * 0.22 + 219.4 + 164)) / Math.ceil(2194 + projected * 1.15 + 164);
    return p;
  }
  it('migrates automatic legacy proportions once without moving the layer', () => {
    const p = projectWithTent(),
      old = p.documents[0].layers.find((l) => l.type === 'device')!;
    const next = migrateProject(p),
      layer = next.documents[0].layers.find((l) => l.id === old.id) as DeviceLayer;
    const size = getHalfFoldedCanvasSize('tent', 90);
    expect(layer.height).toBeCloseTo((layer.width * size.height) / size.width);
    expect(layer).toMatchObject({ sceneVersion: 2, x: old.x, y: old.y, width: old.width });
    expect(migrateProject(next).documents[0].layers.find((l) => l.id === old.id)).toBe(layer);
  });
  it('preserves deliberately stretched layouts', () => {
    const p = projectWithTent(true),
      next = migrateProject(p);
    expect((next.documents[0].layers.find((l) => l.type === 'device') as DeviceLayer).height).toBe(850);
  });
});
