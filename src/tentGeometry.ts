// A physical A-frame: two rounded slabs, a shared hinge and a perspective camera.
// Source units match the 3056 × 2194 outer-device artwork.
export type Vec3 = { x: number; y: number; z: number };
export type Point2 = { x: number; y: number };
export type TentDirection = 'toward' | 'away';
export type TentFace = {
  id: string;
  panel: 'front' | 'rear';
  material: 'outer' | 'inner' | 'edge';
  world: Vec3[];
  points: Point2[];
  normal: Vec3;
  visible: boolean;
  depth: number;
};
export const TENT_WIDTH = 2194;
export const TENT_LENGTH = 1528;
export const TENT_THICKNESS = 58;
const BORDER = 92;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: Vec3, n: number): Vec3 => ({ x: a.x * n, y: a.y * n, z: a.z * n });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (a: Vec3) => mul(a, 1 / Math.max(1e-10, Math.hypot(a.x, a.y, a.z)));
const center = (points: Vec3[]) => mul(points.reduce(add, { x: 0, y: 0, z: 0 }), 1 / points.length);
export function polygonArea(points: Point2[]) {
  return (
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2
  );
}
function roundedContour() {
  const left = -TENT_WIDTH / 2 + 22,
    right = TENT_WIDTH / 2 - 22;
  const top = 24,
    bottom = TENT_LENGTH - 28;
  const corners = [
    { x: right - 46, y: top + 46, radius: 46, from: -90 },
    { x: right - 155, y: bottom - 155, radius: 155, from: 0 },
    { x: left + 155, y: bottom - 155, radius: 155, from: 90 },
    { x: left + 46, y: top + 46, radius: 46, from: 180 },
  ];
  return corners.flatMap((corner) =>
    Array.from({ length: 9 }, (_, i) => {
      const a = ((corner.from + (i * 90) / 8) * Math.PI) / 180;
      return { x: corner.x + Math.cos(a) * corner.radius, y: corner.y + Math.sin(a) * corner.radius };
    }),
  );
}
export function getTentScene(angle = 90, direction: TentDirection = 'toward') {
  const safeAngle = Math.max(35, Math.min(175, angle));
  const a = (safeAngle * Math.PI) / 360;
  const sin = Math.sin(a),
    cos = Math.cos(a);
  const height = (TENT_LENGTH - 28) * cos + TENT_THICKNESS * sin;
  // View from an open end, below the rear slab's grazing angle.
  const yaw = ((44 * Math.PI) / 180) * (direction === 'toward' ? 1 : -1);
  const elevation = (Math.max(4, Math.min(21, (90 - safeAngle / 2) * 0.3)) * Math.PI) / 180;
  const view = {
    x: Math.sin(yaw) * Math.cos(elevation),
    y: Math.sin(elevation),
    z: Math.cos(yaw) * Math.cos(elevation),
  };
  const right = unit({ x: view.z, y: 0, z: -view.x });
  const up = cross(view, right);
  const target = { x: 0, y: height * 0.43, z: 0 };
  const distance = TENT_WIDTH * 4.3;
  const camera = add(target, mul(view, distance));
  function rawProject(point: Vec3): Point2 {
    const delta = sub(point, target);
    const perspective = distance / (distance - dot(delta, view));
    return { x: dot(delta, right) * perspective, y: -dot(delta, up) * perspective };
  }
  function surface(panel: 'front' | 'rear', u: number, v: number, inside = false): Vec3 {
    const sign = panel === 'front' ? 1 : -1;
    const point = { x: u, y: height - v * cos, z: sign * v * sin };
    return inside ? add(point, { x: 0, y: -TENT_THICKNESS * sin, z: -sign * TENT_THICKNESS * cos }) : point;
  }
  const contour = roundedContour();
  const faces: TentFace[] = [];
  for (const panel of ['front', 'rear'] as const) {
    const outer = contour.map((p) => surface(panel, p.x, p.y));
    const inner = contour.map((p) => surface(panel, p.x, p.y, true));
    const bodyCenter = center([...outer, ...inner]);
    const makeFace = (id: string, material: TentFace['material'], world: Vec3[]) => {
      const middle = center(world);
      let normal = unit(cross(sub(world[1], world[0]), sub(world[2], world[0])));
      if (dot(normal, sub(middle, bodyCenter)) < 0) normal = mul(normal, -1);
      faces.push({
        id,
        panel,
        material,
        world,
        points: world.map(rawProject),
        normal,
        visible: dot(normal, sub(camera, middle)) > 0,
        depth: dot(sub(middle, target), view),
      });
    };
    makeFace(`${panel}-outer`, 'outer', outer);
    makeFace(`${panel}-inner`, 'inner', inner);
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      makeFace(`${panel}-edge-${i}`, 'edge', [outer[i], outer[j], inner[j], inner[i]]);
    }
  }
  const groundDepth = (TENT_LENGTH - 28) * sin;
  const shadowBounds = Array.from({ length: 24 }, (_, i) => {
    const t = (i * Math.PI) / 12;
    return rawProject({ x: Math.cos(t) * TENT_WIDTH * 0.67, y: 0, z: Math.sin(t) * (groundDepth + 175) });
  });
  const bounds = [...faces.flatMap((f) => f.points), ...shadowBounds];
  const minX = Math.min(...bounds.map((p) => p.x)),
    maxX = Math.max(...bounds.map((p) => p.x));
  const minY = Math.min(...bounds.map((p) => p.y)),
    maxY = Math.max(...bounds.map((p) => p.y));
  const width = Math.ceil(maxX - minX + BORDER * 2),
    sceneHeight = Math.ceil(maxY - minY + BORDER * 2);
  function project(point: Vec3): Point2 {
    const p = rawProject(point);
    return { x: p.x - minX + BORDER, y: p.y - minY + BORDER };
  }
  for (const face of faces) face.points = face.world.map(project);
  const hinge = [
    { x: -TENT_WIDTH / 2 + 38, y: height, z: 0 },
    { x: TENT_WIDTH / 2 - 38, y: height, z: 0 },
  ];
  return {
    width,
    height: sceneHeight,
    faces: faces.sort((a, b) => a.depth - b.depth),
    project,
    surface,
    hinge,
    groundDepth,
    thickness: TENT_THICKNESS,
    angle: safeAngle,
    direction,
  };
}
export type TentScene = ReturnType<typeof getTentScene>;
