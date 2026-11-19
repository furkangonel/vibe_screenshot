import type { EditorLayer, LayoutDocument, ScreenshotProject } from './types';
import { createId } from './id';

export function copyKeys(project: Pick<ScreenshotProject, 'copy' | 'copyOrder'>) {
  return [...new Set([...(project.copyOrder ?? []), ...Object.keys(project.copy)])].filter((key) =>
    Object.hasOwn(project.copy, key),
  );
}

export function moveCopyKey(project: ScreenshotProject, key: string, target: number): ScreenshotProject {
  const order = copyKeys(project);
  const from = order.indexOf(key);
  if (from < 0 || target < 0 || target >= order.length || from === target) return project;
  order.splice(from, 1);
  order.splice(target, 0, key);
  return { ...project, copyOrder: order };
}

export function deleteCopyKeys(project: ScreenshotProject, keys: string[]): ScreenshotProject {
  const removed = new Set(keys);
  return {
    ...project,
    copy: Object.fromEntries(Object.entries(project.copy).filter(([key]) => !removed.has(key))),
    copyOrder: copyKeys(project).filter((key) => !removed.has(key)),
    documents: project.documents.map((document) => ({
      ...document,
      layers: document.layers.filter((layer) => layer.type !== 'text' || !removed.has(layer.translationKey)),
    })),
  };
}

export function layerBounds(layer: Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>) {
  const a = (layer.rotation * Math.PI) / 180;
  const points = [
    [0, 0],
    [layer.width, 0],
    [layer.width, layer.height],
    [0, layer.height],
  ].map(([x, y]) => ({
    x: layer.x + x * Math.cos(a) - y * Math.sin(a),
    y: layer.y + x * Math.sin(a) + y * Math.cos(a),
  }));
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}

export function layerPages(
  layer: EditorLayer,
  document: Pick<LayoutDocument, 'width' | 'height' | 'pageCount'>,
) {
  const box = layerBounds(layer);
  if (layer.clipPage !== undefined) return [layer.clipPage];
  if (box.y >= document.height || box.y + box.height <= 0) return [];
  return Array.from({ length: document.pageCount }, (_, i) => i).filter(
    (i) => box.x < (i + 1) * document.width && box.x + box.width > i * document.width,
  );
}

export function layerPage(
  layer: EditorLayer,
  document: Pick<LayoutDocument, 'width' | 'height' | 'pageCount'>,
) {
  const pages = layerPages(layer, document);
  if (!pages.length) return -1;
  const bounds = layerBounds(layer);
  return Math.max(
    pages[0],
    Math.min(pages.at(-1)!, Math.floor((bounds.x + bounds.width / 2) / document.width)),
  );
}

// Preserve each exported screenshot, including bleed from shared objects. When a
// seam moves, its shared object becomes separately clipped, editable fragments.
export function moveScreenshot(document: LayoutDocument, from: number, to: number): LayoutDocument {
  if (from === to || from < 0 || to < 0 || from >= document.pageCount || to >= document.pageCount)
    return document;
  const order = Array.from({ length: document.pageCount }, (_, i) => i);
  order.splice(to, 0, order.splice(from, 1)[0]);
  const layers = document.layers.flatMap((layer) => {
    const owner = layerPage(layer, document);
    if (owner < 0) return [layer];
    const pages = layerPages(layer, document);
    if (pages.every((page) => order.indexOf(page) === page)) return [layer];
    const box = layerBounds(layer);
    const fragment =
      pages.length > 1 ||
      box.x < owner * document.width ||
      box.x + box.width > (owner + 1) * document.width ||
      layer.clipPage !== undefined;
    return pages.map((page) => {
      const target = order.indexOf(page),
        dx = (target - page) * document.width;
      return {
        ...layer,
        id: page === owner ? layer.id : createId(layer.type),
        x: layer.x + dx,
        ...(fragment ? { clipPage: target } : {}),
        ...(layer.type === 'text'
          ? {
              localeOverrides: Object.fromEntries(
                Object.entries(layer.localeOverrides).map(([locale, style]) => [
                  locale,
                  { ...style, ...(style.x === undefined ? {} : { x: style.x + dx }) },
                ]),
              ),
            }
          : {}),
      } as EditorLayer;
    });
  });
  const pageImages = Object.fromEntries(
    order.flatMap((old, index) => {
      const src = document.background.pageImages?.[String(old)];
      return src ? [[String(index), src]] : [];
    }),
  );
  return { ...document, layers, background: { ...document.background, pageImages } };
}
