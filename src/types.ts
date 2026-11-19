export type LocaleDefinition = {
  code: string;
  name: string;
};

export type OutputKind = 'screenshots' | 'creative';

export type OutputPreset = {
  id: string;
  label: string;
  group: string;
  width: number;
  height: number;
  kind: OutputKind;
  maxPages: number;
  required?: boolean;
  notes: string;
  extension: 'png';
  store?: 'google-play';
};

export type Background = {
  type: 'solid' | 'linear' | 'image';
  color: string;
  color2: string;
  angle: number;
  imageSrc?: string;
  imageFit?: 'cover' | 'contain' | 'fill';
  imageOpacity?: number;
  pageImages?: Record<string, string>;
};

export type LocaleTextStyle = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
};

export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  clipPage?: number;
};

export type TextLayer = LayerBase & {
  type: 'text';
  translationKey: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  autoFit: boolean;
  minFontSize: number;
  localeOverrides: Record<string, LocaleTextStyle>;
};

export type ImageLayer = LayerBase & {
  type: 'image';
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  cornerRadius: number;
  localeSources: Record<string, string>;
};

export type DeviceLayer = LayerBase & {
  type: 'device';
  deviceId: string;
  orientation?: 'portrait' | 'landscape';
  crop?: { x: number; y: number; width: number; height: number };
  colorId: string;
  screenSrc: string;
  screenFit: 'cover' | 'contain' | 'fill';
  localeScreens: Record<string, string>;
  screenScale?: number;
  screenOffsetX?: number;
  screenOffsetY?: number;
  foldAngle?: number;
  foldDirection?: 'toward' | 'away';
  sceneVersion?: 2;
};

export type ShapeLayer = LayerBase & {
  type: 'shape';
  shape: 'rectangle' | 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
};

export type EditorLayer = TextLayer | ImageLayer | DeviceLayer | ShapeLayer;

export type LayoutDocument = {
  id: string;
  presetId: string;
  name: string;
  width: number;
  height: number;
  kind: OutputKind;
  pageCount: number;
  enabled: boolean;
  background: Background;
  layers: EditorLayer[];
};

export type CopyTable = Record<string, Record<string, string>>;

export type ScreenshotProject = {
  version: 1;
  name: string;
  notes?: string;
  defaultLocale: string;
  locales: LocaleDefinition[];
  copy: CopyTable;
  copyOrder?: string[];
  documents: LayoutDocument[];
  updatedAt: string;
};

export type DeviceDefinition = {
  id: string;
  label: string;
  frameWidth: number;
  frameHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  screenRadius: number;
  screenCorners?: readonly [number, number, number, number];
  officialApple: boolean;
  platform?: 'android';
  category?: 'phone' | 'tablet';
  renderMode?: 'flat' | 'duo-half-fold-vertical' | 'duo-half-fold-horizontal' | 'duo-fold-tent';
  colors: Array<{ id: string; label: string; src: string }>;
};
