// A neutral studio wallpaper for devices without an uploaded screenshot.
// The same vector drawing is used in preview, folded scenes and PNG exports.
export function drawDeviceScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);
  const base = ctx.createLinearGradient(0, 0, 1, 1);
  base.addColorStop(0, '#10182a');
  base.addColorStop(0.5, '#384d70');
  base.addColorStop(1, '#080e1c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1, 1);
  const glow = ctx.createRadialGradient(0.9, 0.26, 0, 0.65, 0.38, 0.95);
  glow.addColorStop(0, '#a8c2d7');
  glow.addColorStop(0.38, '#687e9b');
  glow.addColorStop(1, '#1d294400');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1, 1);
  const silk = ctx.createLinearGradient(0.1, 0.25, 0.95, 0.9);
  silk.addColorStop(0, '#d9e6ef');
  silk.addColorStop(0.32, '#9fbbd0');
  silk.addColorStop(0.52, '#4c668b');
  silk.addColorStop(0.8, '#111d35');
  silk.addColorStop(1, '#080e1d');
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.8);
  ctx.bezierCurveTo(0.15, 0.45, 0.91, 0.78, 1.25, 0.16);
  ctx.bezierCurveTo(0.86, 0.94, 0.38, 0.7, 0.1, 1.22);
  ctx.lineTo(-0.2, 1.2);
  ctx.closePath();
  ctx.fillStyle = silk;
  ctx.fill();
  const rim = ctx.createLinearGradient(0, 0.4, 1, 0.8);
  rim.addColorStop(0, '#f8fbff00');
  rim.addColorStop(0.55, '#f0f8ff88');
  rim.addColorStop(1, '#c9e0fa00');
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.8);
  ctx.bezierCurveTo(0.15, 0.45, 0.91, 0.78, 1.25, 0.16);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.002;
  ctx.stroke();
  const vignette = ctx.createRadialGradient(0.5, 0.4, 0.28, 0.5, 0.5, 0.85);
  vignette.addColorStop(0, '#00000000');
  vignette.addColorStop(1, '#02050f99');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
}
const screens = new Map<string, HTMLCanvasElement>();
export function getDeviceScreen(width: number, height: number) {
  const key = `${width}:${height}`;
  if (!screens.has(key)) {
    if (screens.size >= 8) screens.delete(screens.keys().next().value!);
    const ratio = Math.min(1, 1200 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Device screen canvas could not be created.');
    drawDeviceScreen(context, 0, 0, canvas.width, canvas.height);
    screens.set(key, canvas);
  }
  return screens.get(key)!;
}
