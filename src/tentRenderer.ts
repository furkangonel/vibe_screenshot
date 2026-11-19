import {
  getTentScene,
  TENT_LENGTH,
  TENT_WIDTH,
  type Point2,
  type TentFace,
  type TentScene,
} from './tentGeometry';

function path(ctx: CanvasRenderingContext2D, points: Point2[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
}
let innerTexture: HTMLCanvasElement | null = null;
function innerGlass() {
  if (innerTexture) return innerTexture;
  const canvas = document.createElement('canvas');
  canvas.width = TENT_LENGTH;
  canvas.height = TENT_WIDTH;
  const ctx = canvas.getContext('2d')!;
  const metal = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  metal.addColorStop(0, '#718191');
  metal.addColorStop(0.03, '#263340');
  metal.addColorStop(0.75, '#111923');
  metal.addColorStop(1, '#6b7c8e');
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 145);
  ctx.fill();
  const glass = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  glass.addColorStop(0, '#19222e');
  glass.addColorStop(0.35, '#0c121b');
  glass.addColorStop(0.7, '#111b28');
  glass.addColorStop(1, '#293848');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.roundRect(46, 45, canvas.width - 92, canvas.height - 90, 122);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const reflection = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  reflection.addColorStop(0, '#c4d8ed1a');
  reflection.addColorStop(0.5, '#a8bed81d');
  reflection.addColorStop(0.51, '#8aa3bf05');
  reflection.addColorStop(1, '#00000000');
  ctx.fillStyle = reflection;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.strokeStyle = '#b5c4d33a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(44, 43, canvas.width - 88, canvas.height - 86, 124);
  ctx.stroke();
  innerTexture = canvas;
  return canvas;
}
function triangle(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  src: Point2[],
  dst: Point2[],
  epsilon: number,
) {
  const [s0, s1, s2] = src,
    [d0, d1, d2] = dst;
  const du1 = s1.x - s0.x,
    dv1 = s1.y - s0.y,
    du2 = s2.x - s0.x,
    dv2 = s2.y - s0.y;
  const determinant = du1 * dv2 - du2 * dv1;
  if (Math.abs(determinant) < 1e-8) return;
  const a = ((d1.x - d0.x) * dv2 - (d2.x - d0.x) * dv1) / determinant;
  const b = ((d1.y - d0.y) * dv2 - (d2.y - d0.y) * dv1) / determinant;
  const c = (du1 * (d2.x - d0.x) - du2 * (d1.x - d0.x)) / determinant;
  const d = (du1 * (d2.y - d0.y) - du2 * (d1.y - d0.y)) / determinant;
  // Offset edges by a full output pixel, rather than moving vertices radially.
  // Radial expansion leaves hairline gaps on the rear slab's acute triangles.
  const winding = Math.sign((d1.x - d0.x) * (d2.y - d0.y) - (d1.y - d0.y) * (d2.x - d0.x));
  const normals = dst.map((point, i) => {
    const next = dst[(i + 1) % 3],
      dx = next.x - point.x,
      dy = next.y - point.y;
    const length = Math.max(1e-10, Math.hypot(dx, dy));
    return { x: (winding * dy) / length, y: (-winding * dx) / length };
  });
  const expanded = dst.map((point, i) => {
    const a = normals[(i + 2) % 3],
      b = normals[i];
    const miter = epsilon / Math.max(1e-6, 1 + a.x * b.x + a.y * b.y);
    return { x: point.x + (a.x + b.x) * miter, y: point.y + (a.y + b.y) * miter };
  });
  ctx.save();
  path(ctx, expanded);
  ctx.clip();
  ctx.transform(a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}
function paintSkin(
  ctx: CanvasRenderingContext2D,
  scene: TentScene,
  face: TentFace,
  texture: HTMLCanvasElement,
) {
  ctx.save();
  path(ctx, face.points);
  ctx.clip();
  const transform = ctx.getTransform(),
    scale = Math.hypot(transform.a, transform.b);
  const epsilon = 0.65 / Math.max(0.1, scale);
  const inside = face.material === 'inner';
  const source = inside ? innerGlass() : texture;
  const columns = 12,
    rows = 10;
  const vertex = (i: number, j: number) => {
    const u = -TENT_WIDTH / 2 + (TENT_WIDTH * i) / columns,
      v = (TENT_LENGTH * j) / rows;
    const sx = inside ? v : face.panel === 'front' ? TENT_LENGTH + v : TENT_LENGTH - v;
    return {
      src: { x: sx, y: TENT_WIDTH / 2 - u },
      dst: scene.project(scene.surface(face.panel, u, v, inside)),
    };
  };
  for (let i = 0; i < columns; i++)
    for (let j = 0; j < rows; j++) {
      const a = vertex(i, j),
        b = vertex(i + 1, j),
        c = vertex(i + 1, j + 1),
        d = vertex(i, j + 1);
      triangle(ctx, source, [a.src, b.src, c.src], [a.dst, b.dst, c.dst], epsilon);
      triangle(ctx, source, [a.src, c.src, d.src], [a.dst, c.dst, d.dst], epsilon);
    }
  // Keep lighting local to this rounded slab, with no artboard-wide blending.
  const bounds = face.points;
  const light = ctx.createLinearGradient(
    bounds[0].x,
    bounds[0].y,
    bounds[Math.floor(bounds.length / 2)].x,
    bounds[Math.floor(bounds.length / 2)].y,
  );
  if (inside) {
    light.addColorStop(0, '#ffffff04');
    light.addColorStop(1, '#0000002b');
  } else {
    light.addColorStop(0, '#ffffff05');
    light.addColorStop(1, '#0000000e');
  }
  ctx.fillStyle = light;
  path(ctx, face.points);
  ctx.fill();
  ctx.restore();
}
function paintRail(ctx: CanvasRenderingContext2D, face: TentFace, silver: boolean) {
  const a = face.points[0],
    b = face.points[3];
  const gradient = ctx.createLinearGradient(a.x, a.y, b.x + 0.01, b.y + 0.01);
  const illumination = Math.max(0, face.normal.x * -0.45 + face.normal.y * 0.75 + face.normal.z * 0.48);
  gradient.addColorStop(0, silver ? '#e3eaf0' : '#9babb9');
  gradient.addColorStop(0.13, silver ? '#adbcc9' : '#596b7c');
  gradient.addColorStop(0.35, silver ? '#718291' : '#202e3c');
  gradient.addColorStop(0.85, silver ? '#acb9c5' : '#35485a');
  gradient.addColorStop(1, silver ? '#e9eff4' : '#71869a');
  path(ctx, face.points);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.fillStyle = `rgba(0, 4, 12, ${0.38 * (1 - illumination)})`;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = silver ? '#e8f1f65c' : '#b4c7d23b';
  ctx.stroke();
}
function shadow(
  ctx: CanvasRenderingContext2D,
  scene: TentScene,
  z: number,
  radiusX: number,
  radiusZ: number,
  opacity: number,
) {
  const origin = scene.project({ x: 0, y: 0, z });
  const x = scene.project({ x: 1, y: 0, z }),
    depth = scene.project({ x: 0, y: 0, z: z + 1 });
  ctx.save();
  ctx.transform(x.x - origin.x, x.y - origin.y, depth.x - origin.x, depth.y - origin.y, origin.x, origin.y);
  ctx.scale(radiusX, radiusZ);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(7, 15, 28, ${opacity})`);
  gradient.addColorStop(0.5, `rgba(7, 15, 28, ${opacity * 0.4})`);
  gradient.addColorStop(1, 'rgba(7, 15, 28, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export function drawTentScene(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement,
  finish: string,
  angle: number,
  direction: 'toward' | 'away',
) {
  const scene = getTentScene(angle, direction);
  shadow(ctx, scene, 0, TENT_WIDTH * 0.67, scene.groundDepth + 175, 0.16);
  for (const z of [-scene.groundDepth, scene.groundDepth]) shadow(ctx, scene, z, TENT_WIDTH * 0.51, 56, 0.42);
  for (const face of scene.faces)
    if (face.visible) {
      if (face.material === 'edge') paintRail(ctx, face, finish === 'star-white');
      else paintSkin(ctx, scene, face, texture);
    }
  const [a, b] = scene.hinge.map(scene.project);
  // A rounded, machined hinge barrel. Its diameter follows the physical slab thickness.
  ctx.save();
  ctx.lineCap = 'round';
  const hingeWidth = scene.thickness * 0.88;
  const gradient = ctx.createLinearGradient(0, a.y - hingeWidth / 2, 0, a.y + hingeWidth / 2);
  gradient.addColorStop(0, '#a2b3c2');
  gradient.addColorStop(0.25, '#3b4d5d');
  gradient.addColorStop(0.7, '#14212d');
  gradient.addColorStop(1, '#6f8396');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = hingeWidth;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = '#d4e2ee66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 7);
  ctx.lineTo(b.x, b.y - 7);
  ctx.stroke();
  ctx.restore();
}
