import { describe, expect, it } from 'vitest';
import { snapPosition, snapSpacing } from '../src/guideGeometry';
describe('precise smart guides', () => {
  it('snaps the gap between neighboring objects and draws both measurements', () => {
    const result = snapSpacing(
      { x: 204, y: 200, width: 100, height: 100 },
      [
        { id: 'left', x: 0, y: 200, width: 100, height: 100 },
        { id: 'right', x: 400, y: 200, width: 100, height: 100 },
      ],
      5,
    );
    expect(result.x?.delta).toBe(-4);
    expect(result.x?.gap).toBe(100);
    expect(result.x?.guides).toHaveLength(2);
    expect(result.x?.guides.map((g) => g.label)).toEqual(['100', '100']);
  });
  it('measures vertical spacing without snapping unrelated rows', () => {
    const refs = [
      { id: 'top', x: 100, y: 0, width: 100, height: 100 },
      { id: 'bottom', x: 100, y: 400, width: 100, height: 100 },
    ];
    expect(snapSpacing({ x: 100, y: 197, width: 100, height: 100 }, refs, 5).y?.delta).toBe(3);
    expect(snapSpacing({ x: 400, y: 197, width: 100, height: 100 }, refs, 5).y).toBeNull();
  });
  it('can align across canvases or restrict to the current canvas', () => {
    const refs = [{ id: 'next-page', x: 1250, y: 300, width: 100, height: 100 }];
    const box = { x: 248, y: 302, width: 100, height: 100 };
    expect(snapPosition(box, refs, 1000, 1800, 0, 5, true)).toMatchObject({ dx: 2, dy: -2 });
    expect(snapPosition(box, refs, 1000, 1800, 0, 5, false)).toMatchObject({ dx: 0, dy: 0, guides: [] });
  });
  it('keeps tolerance proportional to zoom and ignores gaps outside it', () => {
    const refs = [{ id: 'target', x: 300, y: 400, width: 100, height: 100 }];
    const box = { x: 290, y: 390, width: 100, height: 100 };
    expect(snapPosition(box, refs, 1000, 1800, 0, 5 / 0.25).dx).toBe(10);
    expect(snapPosition(box, refs, 1000, 1800, 0, 5).dx).toBe(0);
  });
});
