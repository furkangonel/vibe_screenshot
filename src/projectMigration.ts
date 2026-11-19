import { getHalfFoldedCanvasSize } from './duoHalfFold';
import type { EditorLayer, LayoutDocument, LocaleTextStyle, ScreenshotProject } from './types';

const DUO_PRESET_ID = 'iphone-duo-portrait';
const LEGACY_DUO_INNER_ID = 'duo-inner-portrait';
const LEGACY_DUO_OUTER_ID = 'duo-outer-portrait';
const DUO_WIDTH = 1398;
const DUO_HEIGHT = 2034;

export function needsDuoOutputMigration(project: ScreenshotProject) {
  return project.documents.some(
    (document) => document.presetId === LEGACY_DUO_INNER_ID || document.presetId === LEGACY_DUO_OUTER_ID,
  );
}

function scaleLocaleStyle(style: LocaleTextStyle, scale: number, verticalOffset: number): LocaleTextStyle {
  return {
    ...style,
    x: style.x === undefined ? undefined : style.x * scale,
    y: style.y === undefined ? undefined : style.y * scale + verticalOffset,
    width: style.width === undefined ? undefined : style.width * scale,
    height: style.height === undefined ? undefined : style.height * scale,
    fontSize: style.fontSize === undefined ? undefined : style.fontSize * scale,
    letterSpacing: style.letterSpacing === undefined ? undefined : style.letterSpacing * scale,
  };
}

function scaleLayer(layer: EditorLayer, scale: number, verticalOffset: number): EditorLayer {
  if (layer.type === 'text') {
    return {
      ...layer,
      x: layer.x * scale,
      y: layer.y * scale + verticalOffset,
      width: layer.width * scale,
      height: layer.height * scale,
      fontSize: layer.fontSize * scale,
      minFontSize: layer.minFontSize * scale,
      letterSpacing: layer.letterSpacing * scale,
      localeOverrides: Object.fromEntries(
        Object.entries(layer.localeOverrides).map(([locale, style]) => [
          locale,
          scaleLocaleStyle(style, scale, verticalOffset),
        ]),
      ),
    };
  }
  if (layer.type === 'image') {
    return {
      ...layer,
      x: layer.x * scale,
      y: layer.y * scale + verticalOffset,
      width: layer.width * scale,
      height: layer.height * scale,
      cornerRadius: layer.cornerRadius * scale,
    };
  }
  if (layer.type === 'shape') {
    return {
      ...layer,
      x: layer.x * scale,
      y: layer.y * scale + verticalOffset,
      width: layer.width * scale,
      height: layer.height * scale,
      strokeWidth: layer.strokeWidth * scale,
      cornerRadius: layer.cornerRadius * scale,
    };
  }
  return {
    ...layer,
    x: layer.x * scale,
    y: layer.y * scale + verticalOffset,
    width: layer.width * scale,
    height: layer.height * scale,
  };
}

function convertDuoDocument(document: LayoutDocument): LayoutDocument {
  const scale = Math.min(DUO_WIDTH / document.width, DUO_HEIGHT / document.height);
  const verticalOffset = (DUO_HEIGHT - document.height * scale) / 2;
  return {
    ...document,
    presetId: DUO_PRESET_ID,
    name: 'Foldable · Custom',
    width: DUO_WIDTH,
    height: DUO_HEIGHT,
    enabled: true,
    layers: document.layers.map((layer) => scaleLayer(layer, scale, verticalOffset)),
  };
}

function migrateDuoProject(project: ScreenshotProject): ScreenshotProject {
  const existing = project.documents.find((document) => document.presetId === DUO_PRESET_ID);
  const legacyInner = project.documents.find((document) => document.presetId === LEGACY_DUO_INNER_ID);
  const legacyOuter = project.documents.find((document) => document.presetId === LEGACY_DUO_OUTER_ID);
  if (!existing && !legacyInner && !legacyOuter) return project;

  // Existing projects commonly contain both generated legacy canvases. Prefer the
  // Inner document because that was the editable working series; device layers
  // inside it may already mix Inner, Outer, and Folded Duo frames.
  const source = existing ?? legacyInner ?? legacyOuter!;
  const unified = source.presetId === DUO_PRESET_ID ? source : convertDuoDocument(source);
  let inserted = false;
  const documents = project.documents.flatMap((document) => {
    const isLegacy = document.presetId === LEGACY_DUO_INNER_ID || document.presetId === LEGACY_DUO_OUTER_ID;
    if (document.presetId === DUO_PRESET_ID || isLegacy) {
      if (inserted) return [];
      inserted = true;
      return [unified];
    }
    return [document];
  });

  return { ...project, documents };
}

// Update the old flattened tent aspect once; preserve explicit user stretching.
export function migrateProject(project: ScreenshotProject): ScreenshotProject {
  const migrated = migrateDuoProject(project);
  let changed = false;
  const documents = migrated.documents.map((document) => ({
    ...document,
    layers: document.layers.map((layer) => {
      if (layer.type !== 'device' || layer.deviceId !== 'iphone-duo-folded-tent' || layer.sceneVersion === 2)
        return layer;
      changed = true;
      const radians = (Math.max(35, Math.min(175, layer.foldAngle ?? 110)) * Math.PI) / 360;
      const projected = 1528 * Math.sin(radians),
        depth = 1528 * Math.cos(radians) * 0.9;
      const oldWidth = Math.ceil(2194 + projected * 1.15 + 164);
      const oldHeight = Math.ceil(depth + projected * 0.22 + 219.4 + 164);
      const automaticAspect = Math.abs(layer.height / layer.width - oldHeight / oldWidth) < 0.01;
      const next = getHalfFoldedCanvasSize('tent', layer.foldAngle ?? 110);
      return {
        ...layer,
        sceneVersion: 2 as const,
        height: automaticAspect ? (layer.width * next.height) / next.width : layer.height,
      };
    }),
  }));
  return changed ? { ...migrated, documents } : migrated;
}
