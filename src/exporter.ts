import { deviceLayout, traceDeviceDisplay } from './deviceLayout';
import { drawDeviceScreen } from './deviceScreen';
import { getDevice, getDeviceColor } from './devices';
import { DEFAULT_FOLD_ANGLE, drawHalfFoldedDevice, foldOrientationForMode } from './duoHalfFold';
import { effectiveLayer, localizedText } from './layerUtils';
import { getPreset, validateOutputSize } from './presets';
import { downloadBlob } from './storage';
import type {
  Background,
  DeviceLayer,
  EditorLayer,
  LayoutDocument,
  ScreenshotProject,
  TextLayer,
} from './types';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string) {
  if (!imageCache.has(src)) {
    if (imageCache.size >= 48) imageCache.delete(imageCache.keys().next().value!);
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
          imageCache.delete(src);
          reject(new Error('Image could not be loaded.'));
        };
        image.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, safeRadius);
}

async function fillBackground(
  ctx: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
  pageIndex: number,
) {
  if (background.type === 'image') {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
    const src = background.pageImages?.[String(pageIndex)] || background.imageSrc;
    if (src) {
      const image = await loadImage(src);
      ctx.save();
      ctx.globalAlpha = background.imageOpacity ?? 1;
      drawImageFitted(ctx, image, 0, 0, width, height, background.imageFit ?? 'cover');
      ctx.restore();
    }
    return;
  }
  if (background.type === 'solid') {
    ctx.fillStyle = background.color;
  } else {
    const radians = (background.angle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const length = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
    const dx = (Math.cos(radians) * length) / 2;
    const dy = (Math.sin(radians) * length) / 2;
    const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    gradient.addColorStop(0, background.color);
    gradient.addColorStop(1, background.color2);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, width, height);
}

function coverRect(
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill',
) {
  if (fit === 'fill')
    return {
      sx: 0,
      sy: 0,
      sw: image.naturalWidth,
      sh: image.naturalHeight,
      dx: x,
      dy: y,
      dw: width,
      dh: height,
    };
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  if ((fit === 'cover' && imageRatio > targetRatio) || (fit === 'contain' && imageRatio < targetRatio)) {
    const sourceWidth = image.naturalHeight * targetRatio;
    const sx = (image.naturalWidth - sourceWidth) / 2;
    return { sx, sy: 0, sw: sourceWidth, sh: image.naturalHeight, dx: x, dy: y, dw: width, dh: height };
  }
  const sourceHeight = image.naturalWidth / targetRatio;
  const sy = (image.naturalHeight - sourceHeight) / 2;
  return { sx: 0, sy, sw: image.naturalWidth, sh: sourceHeight, dx: x, dy: y, dw: width, dh: height };
}

function drawImageFitted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill',
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const safeZoom = Math.max(0.1, zoom);
  if (safeZoom === 1 && offsetX === 0 && offsetY === 0 && fit !== 'contain') {
    const rect = coverRect(image, x, y, width, height, fit);
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
    return;
  }
  const baseScale =
    fit === 'fill'
      ? 1
      : fit === 'contain'
        ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
        : Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const dw = (fit === 'fill' ? width : image.naturalWidth * baseScale) * safeZoom;
  const dh = (fit === 'fill' ? height : image.naturalHeight * baseScale) * safeZoom;
  const dx = x + (width - dw) / 2 + width * (offsetX / 100);
  const dy = y + (height - dh) / 2 + height * (offsetY / 100);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, dx, dy, dw, dh);
}

function fontString(layer: TextLayer, fontSize: number) {
  return `${layer.fontWeight} ${fontSize}px ${layer.fontFamily}`;
}

function segmentLine(text: string, locale: string) {
  try {
    return Array.from(
      new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
      (item) => item.segment,
    );
  } catch {
    return text.split(/(\s+)/).filter(Boolean);
  }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, locale: string) {
  if (!text) return [''];
  const lines: string[] = [];
  let line = '';
  for (const token of segmentLine(text, locale)) {
    if (ctx.measureText(line + token).width <= maxWidth) {
      line += token;
      continue;
    }
    if (line) {
      lines.push(line.trimEnd());
      line = '';
    }
    const word = token.trimStart();
    for (const glyph of Array.from(word)) {
      if (line && ctx.measureText(line + glyph).width > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += glyph;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines.length ? lines : [''];
}

function layoutText(ctx: CanvasRenderingContext2D, layer: TextLayer, text: string, locale: string) {
  const minimum = Math.min(layer.fontSize, layer.minFontSize);
  let size = layer.fontSize;
  let lines: string[];
  while (true) {
    ctx.font = fontString(layer, size);
    lines = text.split('\n').flatMap((line) => wrapLine(ctx, line, layer.width, locale));
    const totalHeight = lines.length * size * layer.lineHeight;
    if (!layer.autoFit || totalHeight <= layer.height || size <= minimum) break;
    size = Math.max(minimum, size - Math.max(1, Math.round(layer.fontSize * 0.018)));
  }
  return { size, lines };
}

async function drawLayer(
  ctx: CanvasRenderingContext2D,
  rawLayer: EditorLayer,
  project: ScreenshotProject,
  locale: string,
  pageOffsetX: number,
) {
  if (!rawLayer.visible || rawLayer.opacity <= 0) return;
  const layer = effectiveLayer(rawLayer, locale);
  const localX = layer.x - pageOffsetX;

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.translate(localX, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);

  if (layer.type === 'shape') {
    ctx.fillStyle = layer.fill;
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
    if (layer.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(layer.width / 2, layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
    } else {
      roundedRect(ctx, 0, 0, layer.width, layer.height, layer.cornerRadius);
    }
    ctx.fill();
    if (layer.strokeWidth > 0) ctx.stroke();
  }

  if (layer.type === 'text') {
    const text = localizedText(project, layer.translationKey, locale);
    ctx.letterSpacing = `${layer.letterSpacing}px`;
    const { size, lines } = layoutText(ctx, layer, text, locale);
    ctx.font = fontString(layer, size);
    ctx.fillStyle = layer.color;
    ctx.textBaseline = 'top';
    ctx.textAlign = layer.align;
    const anchorX = layer.align === 'left' ? 0 : layer.align === 'right' ? layer.width : layer.width / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, anchorX, index * size * layer.lineHeight);
    });
  }

  if (layer.type === 'image') {
    const src = layer.localeSources[locale] || layer.src;
    if (src) {
      const image = await loadImage(src);
      ctx.save();
      roundedRect(ctx, 0, 0, layer.width, layer.height, layer.cornerRadius);
      ctx.clip();
      drawImageFitted(ctx, image, 0, 0, layer.width, layer.height, layer.fit);
      ctx.restore();
    }
  }

  if (layer.type === 'device') {
    const device = getDevice(layer.deviceId);
    const layout = deviceLayout(layer, device);
    ctx.beginPath();
    ctx.rect(0, 0, layer.width, layer.height);
    ctx.clip();
    ctx.translate(layout.offsetX, layout.offsetY);
    const screenSrc = layer.localeScreens[locale] || layer.screenSrc;
    const screen = screenSrc ? await loadImage(screenSrc) : null;
    const foldOrientation = foldOrientationForMode(device.renderMode);
    if (foldOrientation) {
      const frame = await loadImage(getDeviceColor(device, layer.colorId).src);
      drawHalfFoldedDevice(
        ctx,
        screen,
        frame,
        layer.screenFit,
        layer.colorId,
        foldOrientation,
        layer.foldAngle ?? DEFAULT_FOLD_ANGLE,
        layer.foldDirection ?? 'toward',
        0,
        0,
        layout.width,
        layout.height,
        layer.screenScale ?? 1,
        layer.screenOffsetX ?? 0,
        layer.screenOffsetY ?? 0,
      );
      ctx.restore();
      return;
    }
    const frame = await loadImage(getDeviceColor(device, layer.colorId).src);
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = layout.screen;
    ctx.save();
    traceDeviceDisplay(ctx, layout.screen);
    ctx.clip();
    if (screenSrc) {
      drawImageFitted(
        ctx,
        screen!,
        screenX,
        screenY,
        screenWidth,
        screenHeight,
        layer.screenFit,
        layer.screenScale ?? 1,
        layer.screenOffsetX ?? 0,
        layer.screenOffsetY ?? 0,
      );
    } else {
      drawDeviceScreen(ctx, screenX, screenY, screenWidth, screenHeight);
    }
    ctx.restore();
    if (layout.landscape) {
      ctx.save();
      ctx.translate(layout.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(frame, 0, 0, layout.height, layout.width);
      ctx.restore();
    } else ctx.drawImage(frame, 0, 0, layout.width, layout.height);
  }

  ctx.restore();
}

export async function renderLayerPreview(project: ScreenshotProject, layer: DeviceLayer, locale: string) {
  const scale = Math.min(1, 1200 / Math.max(layer.width, layer.height));
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(layer.width * scale));
  canvas.height = Math.max(1, Math.round(layer.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(canvas.width / layer.width, canvas.height / layer.height);
  await drawLayer(ctx, { ...layer, x: 0, y: 0, rotation: 0, opacity: 1, visible: true }, project, locale, 0);
  return canvas.toDataURL();
}

export async function renderPage(
  project: ScreenshotProject,
  document: LayoutDocument,
  locale: string,
  pageIndex: number,
  pixelRatio = 1,
) {
  await window.document.fonts.ready;
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.pageCount)
    throw new Error('Invalid page index.');
  if (!project.locales.some((item) => item.code === locale)) throw new Error('Invalid locale.');
  if (!validateOutputSize(document.presetId, document.width, document.height)) {
    throw new Error(`${document.name} ölçüsü Apple preset’iyle eşleşmiyor.`);
  }
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(document.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(document.height * pixelRatio));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas could not be created.');
  ctx.scale(canvas.width / document.width, canvas.height / document.height);
  await fillBackground(ctx, document.background, document.width, document.height, pageIndex);
  const offset = pageIndex * document.width;
  for (const layer of document.layers) {
    if (layer.clipPage !== undefined && layer.clipPage !== pageIndex) continue;
    await drawLayer(ctx, layer, project, locale, offset);
  }
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG üretilemedi.'))), 'image/png');
  });
}

export type ExportOptions = {
  localeCodes: string[];
  documentIds: string[];
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, label: string) => void;
};

export async function createProjectZip(project: ScreenshotProject, options: ExportOptions) {
  await document.fonts.ready;
  options.signal?.throwIfAborted();
  if (!options.localeCodes.length || !options.documentIds.length)
    throw new Error('Choose at least one language and output.');
  if (options.documentIds.some((id) => !project.documents.some((d) => d.id === id)))
    throw new Error('Invalid output.');
  const documents = project.documents.filter((item) => options.documentIds.includes(item.id));
  const total = documents.reduce((sum, item) => sum + item.pageCount * options.localeCodes.length, 0);
  let done = 0;
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const locale of options.localeCodes) {
    for (const document of documents) {
      const preset = getPreset(document.presetId);
      for (let pageIndex = 0; pageIndex < document.pageCount; pageIndex += 1) {
        options.signal?.throwIfAborted();
        const label = `${locale} · ${document.name} · ${pageIndex + 1}/${document.pageCount}`;
        options.onProgress?.(done, total, label);
        const canvas = await renderPage(project, document, locale, pageIndex);
        const blob = await canvasBlob(canvas);
        const filename = `${String(pageIndex + 1).padStart(2, '0')}_${preset.width}x${preset.height}.png`;
        zip.file(`${locale}/${preset.id}/${filename}`, blob);
        canvas.width = 1;
        canvas.height = 1;
        done += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
  }

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        project: project.name,
        locales: options.localeCodes,
        outputs: documents.map((item) => ({
          preset: item.presetId,
          width: item.width,
          height: item.height,
          pages: item.pageCount,
          format: 'png',
          alpha: false,
        })),
      },
      null,
      2,
    ),
  );
  options.onProgress?.(total, total, 'ZIP');
  options.signal?.throwIfAborted();
  // Do not throw from JSZip's asynchronous progress callback: it does not reject
  // the generation promise. Finish packing, then suppress the download if cancelled.
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });
  options.signal?.throwIfAborted();
  return blob;
}

export async function exportProjectZip(project: ScreenshotProject, options: ExportOptions) {
  const blob = await createProjectZip(project, options);
  downloadBlob(blob, `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'app-store-assets'}.zip`);
}

export async function exportSinglePage(
  project: ScreenshotProject,
  document: LayoutDocument,
  locale: string,
  pageIndex: number,
) {
  const canvas = await renderPage(project, document, locale, pageIndex);
  const blob = await canvasBlob(canvas);
  downloadBlob(blob, `${locale}_${document.presetId}_${String(pageIndex + 1).padStart(2, '0')}.png`);
}
