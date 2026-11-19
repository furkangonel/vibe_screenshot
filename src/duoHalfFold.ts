import { FOLDABLE_COVER_CORNERS, traceDeviceScreen } from './deviceScreenPath';
import { drawDeviceScreen } from './deviceScreen';
import { getTentScene } from './tentGeometry';
import { drawTentScene } from './tentRenderer';

const SOURCE_WIDTH = 2247;
const SOURCE_HEIGHT = 3093;
const SCREEN_X = 120;
const SCREEN_Y = 120;
const SCREEN_WIDTH = 2007;
const SCREEN_HEIGHT = 2853;
const PADDING = 82;
const MAX_RENDER_EDGE = 6144;
const OUTER_WIDTH = 3056;
const OUTER_HEIGHT = 2194;
const OUTER_SCREEN_X = 1570;
const OUTER_SCREEN_Y = 80;
const OUTER_SCREEN_WIDTH = 1398;
const OUTER_SCREEN_HEIGHT = 2034;

export const DEFAULT_FOLD_ANGLE = 110;
export type FoldOrientation = 'vertical' | 'horizontal' | 'tent';
export type FoldDirection = 'toward' | 'away';
type ScreenFit = 'cover' | 'contain' | 'fill';
type RenderSize = { width: number; height: number };

export function foldOrientationForMode(mode?: string): FoldOrientation | null {
  if (mode === 'duo-half-fold-vertical') return 'vertical';
  if (mode === 'duo-half-fold-horizontal') return 'horizontal';
  if (mode === 'duo-fold-tent') return 'tent';
  return null;
}

export function clampFoldAngle(angle = DEFAULT_FOLD_ANGLE) {
  return Math.max(35, Math.min(175, angle));
}

export function getHalfFoldedCanvasSize(orientation: FoldOrientation, angle = DEFAULT_FOLD_ANGLE) {
  const safeAngle = clampFoldAngle(angle);
  const radians = ((safeAngle / 2) * Math.PI) / 180;
  if (orientation === 'tent') {
    const scene = getTentScene(safeAngle);
    return {
      width: scene.width,
      height: scene.height,
      projected: (OUTER_WIDTH / 2) * Math.sin(radians),
      depth: (OUTER_WIDTH / 2) * Math.cos(radians),
    };
  }
  if (orientation === 'vertical') {
    const half = SOURCE_WIDTH / 2;
    const projected = half * Math.sin(radians);
    const depth = half * Math.cos(radians) * 0.62;
    return {
      width: Math.ceil(projected * 2 + PADDING * 2),
      height: Math.ceil(SOURCE_HEIGHT + depth + PADDING * 2),
      projected,
      depth,
    };
  }

  const half = SOURCE_HEIGHT / 2;
  const projected = half * Math.sin(radians);
  const depth = half * Math.cos(radians) * 0.45;
  return {
    width: Math.ceil(SOURCE_WIDTH + depth + PADDING * 2),
    height: Math.ceil(projected * 2 + PADDING * 2),
    projected,
    depth,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
}

function polygon(context: CanvasRenderingContext2D, points: Array<[number, number]>) {
  context.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
}

function drawFitted(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: ScreenFit,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const safeZoom = Math.max(0.1, zoom);
  const baseScale =
    fit === 'fill'
      ? 1
      : fit === 'contain'
        ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
        : Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = (fit === 'fill' ? width : image.naturalWidth * baseScale) * safeZoom;
  const drawHeight = (fit === 'fill' ? height : image.naturalHeight * baseScale) * safeZoom;
  const drawX = x + (width - drawWidth) / 2 + width * (offsetX / 100);
  const drawY = y + (height - drawHeight) / 2 + height * (offsetY / 100);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawPlaceholder(context: CanvasRenderingContext2D) {
  drawDeviceScreen(context, SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawFlatDevice(
  context: CanvasRenderingContext2D,
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  screenScale: number,
  screenOffsetX: number,
  screenOffsetY: number,
) {
  if (frame) {
    context.save();
    roundedRect(context, SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT, 168);
    context.clip();
    context.fillStyle = '#050608';
    context.fillRect(SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT);
    if (screen)
      drawFitted(
        context,
        screen,
        SCREEN_X,
        SCREEN_Y,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        fit,
        screenScale,
        screenOffsetX,
        screenOffsetY,
      );
    else drawPlaceholder(context);
    context.restore();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(frame, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
    return;
  }

  const lightFinish = finish === 'star-white';
  const frameGradient = context.createLinearGradient(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
  if (lightFinish) {
    frameGradient.addColorStop(0, '#fbfcfc');
    frameGradient.addColorStop(0.28, '#d7d9d8');
    frameGradient.addColorStop(0.62, '#aeb2b2');
    frameGradient.addColorStop(1, '#707676');
  } else {
    frameGradient.addColorStop(0, '#606977');
    frameGradient.addColorStop(0.22, '#303641');
    frameGradient.addColorStop(0.64, '#11151c');
    frameGradient.addColorStop(1, '#030508');
  }

  context.fillStyle = frameGradient;
  roundedRect(context, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT, 142);
  context.fill();

  context.save();
  roundedRect(context, SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT, 104);
  context.clip();
  context.fillStyle = '#dfe7f7';
  context.fillRect(SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT);
  if (screen)
    drawFitted(
      context,
      screen,
      SCREEN_X,
      SCREEN_Y,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      fit,
      screenScale,
      screenOffsetX,
      screenOffsetY,
    );
  else drawPlaceholder(context);

  const glass = context.createLinearGradient(
    SCREEN_X,
    SCREEN_Y,
    SCREEN_X + SCREEN_WIDTH,
    SCREEN_Y + SCREEN_HEIGHT * 0.68,
  );
  glass.addColorStop(0, 'rgba(255,255,255,.085)');
  glass.addColorStop(0.34, 'rgba(255,255,255,0)');
  glass.addColorStop(1, 'rgba(0,0,0,.025)');
  context.fillStyle = glass;
  context.fillRect(SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.restore();

  context.lineJoin = 'round';
  context.strokeStyle = lightFinish ? 'rgba(60, 66, 68, .48)' : 'rgba(0, 0, 0, .82)';
  context.lineWidth = 12;
  roundedRect(context, SCREEN_X, SCREEN_Y, SCREEN_WIDTH, SCREEN_HEIGHT, 104);
  context.stroke();

  context.strokeStyle = lightFinish ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.36)';
  context.lineWidth = 4;
  roundedRect(context, 9, 9, SOURCE_WIDTH - 18, SOURCE_HEIGHT - 18, 134);
  context.stroke();

  context.strokeStyle = lightFinish ? 'rgba(36,42,43,.34)' : 'rgba(0,0,0,.72)';
  context.lineWidth = 5;
  roundedRect(context, 2.5, 2.5, SOURCE_WIDTH - 5, SOURCE_HEIGHT - 5, 140);
  context.stroke();
}

function drawVerticalFold(
  context: CanvasRenderingContext2D,
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  projected: number,
  depth: number,
  direction: FoldDirection,
  screenScale: number,
  screenOffsetX: number,
  screenOffsetY: number,
) {
  const half = SOURCE_WIDTH / 2;
  const scale = projected / half;
  const toward = direction === 'toward';
  const outerY = PADDING + (toward ? 0 : depth);
  const hingeY = PADDING + (toward ? depth : 0);
  const shear = (hingeY - outerY) / half;

  context.save();
  context.transform(scale, shear, 0, 1, PADDING, outerY);
  context.beginPath();
  context.rect(-2, -2, half + 4, SOURCE_HEIGHT + 4);
  context.clip();
  drawFlatDevice(context, screen, frame, fit, finish, screenScale, screenOffsetX, screenOffsetY);
  context.restore();

  context.save();
  context.transform(scale, -shear, 0, 1, PADDING + projected - scale * half, hingeY + shear * half);
  context.beginPath();
  context.rect(half - 2, -2, half + 4, SOURCE_HEIGHT + 4);
  context.clip();
  drawFlatDevice(context, screen, frame, fit, finish, screenScale, screenOffsetX, screenOffsetY);
  context.restore();

  const hingeX = PADDING + projected;
  // Lighting must preserve the device's alpha, including rounded corners and
  // transparent bezel padding. The caller provides an isolated device canvas.
  context.save();
  context.globalCompositeOperation = 'source-atop';
  const shade = context.createLinearGradient(hingeX - projected, 0, hingeX + projected, 0);
  shade.addColorStop(0, toward ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.09)');
  shade.addColorStop(0.48, 'rgba(0,0,0,0)');
  shade.addColorStop(0.52, 'rgba(0,0,0,.025)');
  shade.addColorStop(1, toward ? 'rgba(0,0,0,.11)' : 'rgba(255,255,255,.02)');
  context.fillStyle = shade;
  context.beginPath();
  polygon(context, [
    [PADDING, outerY],
    [hingeX, hingeY],
    [PADDING + projected * 2, outerY],
    [PADDING + projected * 2, outerY + SOURCE_HEIGHT],
    [hingeX, hingeY + SOURCE_HEIGHT],
    [PADDING, outerY + SOURCE_HEIGHT],
  ]);
  context.fill();

  const crease = context.createLinearGradient(hingeX - 18, 0, hingeX + 18, 0);
  crease.addColorStop(0, 'rgba(0,0,0,0)');
  crease.addColorStop(0.36, 'rgba(0,0,0,.16)');
  crease.addColorStop(0.49, 'rgba(0,0,0,.48)');
  crease.addColorStop(0.54, 'rgba(255,255,255,.2)');
  crease.addColorStop(0.7, 'rgba(0,0,0,.08)');
  crease.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = crease;
  context.fillRect(hingeX - 18, hingeY + 28, 36, SOURCE_HEIGHT - 56);
  context.restore();
}

function drawHorizontalFold(
  context: CanvasRenderingContext2D,
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  projected: number,
  depth: number,
  direction: FoldDirection,
  screenScale: number,
  screenOffsetX: number,
  screenOffsetY: number,
) {
  const half = SOURCE_HEIGHT / 2;
  const scale = projected / half;
  const toward = direction === 'toward';
  const outerX = PADDING + (toward ? 0 : depth);
  const hingeX = PADDING + (toward ? depth : 0);
  const shear = (hingeX - outerX) / half;

  context.save();
  context.transform(1, 0, shear, scale, outerX, PADDING);
  context.beginPath();
  context.rect(-2, -2, SOURCE_WIDTH + 4, half + 4);
  context.clip();
  drawFlatDevice(context, screen, frame, fit, finish, screenScale, screenOffsetX, screenOffsetY);
  context.restore();

  context.save();
  context.transform(1, 0, -shear, scale, hingeX + shear * half, PADDING + projected - scale * half);
  context.beginPath();
  context.rect(-2, half - 2, SOURCE_WIDTH + 4, half + 4);
  context.clip();
  drawFlatDevice(context, screen, frame, fit, finish, screenScale, screenOffsetX, screenOffsetY);
  context.restore();

  const hingeY = PADDING + projected;
  context.save();
  context.globalCompositeOperation = 'source-atop';
  const shade = context.createLinearGradient(0, hingeY - projected, 0, hingeY + projected);
  shade.addColorStop(0, toward ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.1)');
  shade.addColorStop(0.48, 'rgba(0,0,0,0)');
  shade.addColorStop(0.52, 'rgba(0,0,0,.025)');
  shade.addColorStop(1, toward ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.02)');
  context.fillStyle = shade;
  context.beginPath();
  polygon(context, [
    [outerX, PADDING],
    [outerX + SOURCE_WIDTH, PADDING],
    [hingeX + SOURCE_WIDTH, hingeY],
    [outerX + SOURCE_WIDTH, PADDING + projected * 2],
    [outerX, PADDING + projected * 2],
    [hingeX, hingeY],
  ]);
  context.fill();

  const crease = context.createLinearGradient(0, hingeY - 18, 0, hingeY + 18);
  crease.addColorStop(0, 'rgba(0,0,0,0)');
  crease.addColorStop(0.36, 'rgba(0,0,0,.16)');
  crease.addColorStop(0.49, 'rgba(0,0,0,.48)');
  crease.addColorStop(0.54, 'rgba(255,255,255,.2)');
  crease.addColorStop(0.7, 'rgba(0,0,0,.08)');
  crease.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = crease;
  context.fillRect(hingeX + 28, hingeY - 18, SOURCE_WIDTH - 56, 36);
  context.restore();
}

function drawOuterDevice(
  context: CanvasRenderingContext2D,
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  screenScale: number,
  screenOffsetX: number,
  screenOffsetY: number,
) {
  if (!frame) {
    context.fillStyle = finish === 'star-white' ? '#d7dbde' : '#202735';
    roundedRect(context, 36, 30, OUTER_WIDTH - 72, OUTER_HEIGHT - 60, 210);
    context.fill();
  }
  context.save();
  traceDeviceScreen(context, {
    screenX: OUTER_SCREEN_X,
    screenY: OUTER_SCREEN_Y,
    screenWidth: OUTER_SCREEN_WIDTH,
    screenHeight: OUTER_SCREEN_HEIGHT,
    screenRadius: 26,
    screenCorners: FOLDABLE_COVER_CORNERS,
  });
  context.clip();
  context.fillStyle = '#dfe7f7';
  context.fillRect(OUTER_SCREEN_X, OUTER_SCREEN_Y, OUTER_SCREEN_WIDTH, OUTER_SCREEN_HEIGHT);
  // Tent mode uses the landscape cover display. Rotate only the screen content
  // into the portrait source bezel; the projected result keeps text upright.
  context.translate(OUTER_SCREEN_X, OUTER_SCREEN_Y + OUTER_SCREEN_HEIGHT);
  context.rotate(-Math.PI / 2);
  if (screen) {
    drawFitted(
      context,
      screen,
      0,
      0,
      OUTER_SCREEN_HEIGHT,
      OUTER_SCREEN_WIDTH,
      fit,
      screenScale,
      screenOffsetX,
      screenOffsetY,
    );
  } else {
    drawDeviceScreen(context, 0, 0, OUTER_SCREEN_HEIGHT, OUTER_SCREEN_WIDTH);
  }
  context.restore();
  if (frame) context.drawImage(frame, 0, 0, OUTER_WIDTH, OUTER_HEIGHT);
}

export function drawHalfFoldedDevice(
  context: CanvasRenderingContext2D,
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  orientation: FoldOrientation,
  angle: number,
  direction: FoldDirection,
  x: number,
  y: number,
  width: number,
  height: number,
  screenScale = 1,
  screenOffsetX = 0,
  screenOffsetY = 0,
) {
  // Isolate lighting from the artboard and other layers. Rasterize at output
  // scale so the editor and PNG export use the same alpha-safe renderer.
  const transform = context.getTransform();
  const rasterScaleX = Math.hypot(transform.a, transform.b);
  const rasterScaleY = Math.hypot(transform.c, transform.d);
  const canvas = createHalfFoldedDeviceCanvas(
    screen,
    frame,
    fit,
    finish,
    orientation,
    angle,
    direction,
    { width: width * rasterScaleX, height: height * rasterScaleY },
    screenScale,
    screenOffsetX,
    screenOffsetY,
  );
  context.drawImage(canvas, x, y, width, height);
}

export function createHalfFoldedDeviceCanvas(
  screen: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  fit: ScreenFit,
  finish: string,
  orientation: FoldOrientation,
  angle = DEFAULT_FOLD_ANGLE,
  direction: FoldDirection = 'toward',
  renderSize?: RenderSize,
  screenScale = 1,
  screenOffsetX = 0,
  screenOffsetY = 0,
) {
  const geometry = getHalfFoldedCanvasSize(orientation, angle);
  const requestedWidth = Math.max(1, Math.round(renderSize?.width ?? geometry.width));
  const requestedHeight = Math.max(1, Math.round(renderSize?.height ?? geometry.height));
  const limitScale = Math.min(1, MAX_RENDER_EDGE / requestedWidth, MAX_RENDER_EDGE / requestedHeight);
  const width = Math.max(1, Math.round(requestedWidth * limitScale));
  const height = Math.max(1, Math.round(requestedHeight * limitScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(width / geometry.width, height / geometry.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (orientation === 'tent') {
    const texture = document.createElement('canvas');
    texture.width = OUTER_WIDTH;
    texture.height = OUTER_HEIGHT;
    const surface = texture.getContext('2d');
    if (!surface) return canvas;
    drawOuterDevice(surface, screen, frame, fit, finish, screenScale, screenOffsetX, screenOffsetY);
    drawTentScene(context, texture, finish, angle, direction);
    texture.width = 1;
    texture.height = 1;
    return canvas;
  }
  const draw = orientation === 'vertical' ? drawVerticalFold : drawHorizontalFold;
  draw(
    context,
    screen,
    frame,
    fit,
    finish,
    geometry.projected,
    geometry.depth,
    direction,
    screenScale,
    screenOffsetX,
    screenOffsetY,
  );
  return canvas;
}
