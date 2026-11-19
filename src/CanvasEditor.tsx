import Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { getDevice, getDeviceColor } from './devices';
import { createHalfFoldedDeviceCanvas, DEFAULT_FOLD_ANGLE, foldOrientationForMode } from './duoHalfFold';
import { deviceLayout, traceDeviceDisplay } from './deviceLayout';
import { getDeviceScreen } from './deviceScreen';
import { SELECTION_PADDING, SelectionBadge, SelectionFrame } from './SelectionControls';
import { effectiveLayer, localizedText } from './layerUtils';
import SmartGuides from './SmartGuides';
import { hasFiles } from './files';
import { useI18n } from './i18n';
import type { DeviceLayer, EditorLayer, ImageLayer, LayoutDocument, ScreenshotProject } from './types';

type Props = {
  project: ScreenshotProject;
  document: LayoutDocument;
  locale: string;
  zoom: number;
  selectedId: string | null;
  activePage: number;
  onSelect: (id: string | null) => void;
  onActivePage: (page: number) => void;
  onLayerChange: (id: string, patch: Partial<EditorLayer>) => void;
  guidesEnabled: boolean;
  snapDistance?: number;
  crossCanvas?: boolean;
  onFilesDrop: (files: File[], point: { x: number; y: number; page: number; layerId?: string }) => void;
};

function useAsset(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let active = true;
    setImage(null);
    const next = new Image();
    next.onerror = () => {
      if (active) setImage(null);
    };
    next.onload = () => active && setImage(next);
    next.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return image;
}

function roundedPath(
  context: Konva.Context,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function imageCrop(
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill',
) {
  if (fit !== 'cover') return undefined;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  if (imageRatio > targetRatio) {
    const cropWidth = image.naturalHeight * targetRatio;
    return { x: (image.naturalWidth - cropWidth) / 2, y: 0, width: cropWidth, height: image.naturalHeight };
  }
  const cropHeight = image.naturalWidth / targetRatio;
  return { x: 0, y: (image.naturalHeight - cropHeight) / 2, width: image.naturalWidth, height: cropHeight };
}

function imagePlacement(
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill',
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const safeZoom = Math.max(0.1, zoom);
  const baseScale =
    fit === 'fill'
      ? 1
      : fit === 'contain'
        ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
        : Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = (fit === 'fill' ? width : image.naturalWidth * baseScale) * safeZoom;
  const drawHeight = (fit === 'fill' ? height : image.naturalHeight * baseScale) * safeZoom;
  return {
    x: (width - drawWidth) / 2 + width * (offsetX / 100),
    y: (height - drawHeight) / 2 + height * (offsetY / 100),
    width: drawWidth,
    height: drawHeight,
  };
}

function fitText(layer: Extract<EditorLayer, { type: 'text' }>, text: string) {
  if (!layer.autoFit) return layer.fontSize;
  const minimum = Math.min(layer.fontSize, layer.minFontSize);
  let fontSize = layer.fontSize;
  while (fontSize > minimum) {
    const node = new Konva.Text({
      text,
      width: layer.width,
      fontSize,
      fontFamily: layer.fontFamily,
      fontStyle: String(layer.fontWeight),
      lineHeight: layer.lineHeight,
      wrap: 'word',
      letterSpacing: layer.letterSpacing,
    });
    const fits = node.height() <= layer.height;
    node.destroy();
    if (fits) break;
    fontSize -= Math.max(1, Math.round(layer.fontSize * 0.018));
  }
  return Math.max(minimum, fontSize);
}

type NodeProps = {
  layer: EditorLayer;
  project: ScreenshotProject;
  locale: string;
  selected: boolean;
  previewScale?: number;
  onSelect: () => void;
  onChange: (patch: Partial<EditorLayer>) => void;
};

function CommonNode({
  layer,
  children,
  onSelect,
  onChange,
  keepRatio,
}: {
  layer: EditorLayer;
  children: React.ReactNode;
  onSelect: () => void;
  onChange: (patch: Partial<EditorLayer>) => void;
  keepRatio?: boolean;
}) {
  return (
    <Group
      id={`node-${layer.id}`}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onDragStart={onSelect}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(event) => onChange({ x: event.target.x(), y: event.target.y() })}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = keepRatio ? scaleX : node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, layer.width * scaleX),
          height: Math.max(20, layer.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      {(layer.type === 'image' || layer.type === 'device') && (
        <Rect name="selection-hit-area" width={layer.width} height={layer.height} fill="transparent" />
      )}
      {children}
    </Group>
  );
}

function TextNode({ layer: rawLayer, project, locale, onSelect, onChange }: NodeProps) {
  const layer = effectiveLayer(rawLayer, locale);
  if (layer.type !== 'text') return null;
  const text = localizedText(project, layer.translationKey, locale);
  const fontSize = fitText(layer, text);
  return (
    <CommonNode layer={layer} onSelect={onSelect} onChange={onChange}>
      <Text
        text={text}
        width={layer.width}
        height={layer.height}
        fill={layer.color}
        fontFamily={layer.fontFamily}
        fontSize={fontSize}
        fontStyle={String(layer.fontWeight)}
        align={layer.align}
        lineHeight={layer.lineHeight}
        letterSpacing={layer.letterSpacing}
        wrap="word"
        listening
      />
    </CommonNode>
  );
}

function ImageNode(props: NodeProps) {
  return props.layer.type === 'image' ? <ImageContent {...props} layer={props.layer} /> : null;
}
function ImageContent({ layer, locale, onSelect, onChange }: NodeProps & { layer: ImageLayer }) {
  const src = layer.localeSources[locale] || layer.src;
  const image = useAsset(src);
  const crop = image ? imageCrop(image, layer.width, layer.height, layer.fit) : undefined;
  let imageProps = { x: 0, y: 0, width: layer.width, height: layer.height };
  if (image && layer.fit === 'contain') {
    const scale = Math.min(layer.width / image.naturalWidth, layer.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    imageProps = { x: (layer.width - width) / 2, y: (layer.height - height) / 2, width, height };
  }
  return (
    <CommonNode layer={layer} onSelect={onSelect} onChange={onChange}>
      <Group
        clipFunc={(context) => roundedPath(context, 0, 0, layer.width, layer.height, layer.cornerRadius)}
      >
        {!image && (
          <Rect width={layer.width} height={layer.height} fill="rgba(125, 134, 150, .12)" listening={false} />
        )}
        {image && <KonvaImage image={image} {...imageProps} crop={crop} listening={false} />}
      </Group>
    </CommonNode>
  );
}

function DeviceNode(props: NodeProps) {
  return props.layer.type === 'device' ? <DeviceContent {...props} layer={props.layer} /> : null;
}
function DeviceContent({
  layer,
  locale,
  previewScale = 1,
  onSelect,
  onChange,
}: NodeProps & { layer: DeviceLayer }) {
  const device = getDevice(layer.deviceId);
  const layout = deviceLayout(layer, device);
  const renderWidth = layout.width,
    renderHeight = layout.height;
  const frame = useAsset(getDeviceColor(device, layer.colorId).src);
  const placeholder = useMemo(
    () =>
      getDeviceScreen(
        layout.landscape ? device.screenHeight : device.screenWidth,
        layout.landscape ? device.screenWidth : device.screenHeight,
      ),
    [device, layout.landscape],
  );
  const screen = useAsset(layer.localeScreens[locale] || layer.screenSrc);
  const [foldedDevice, setFoldedDevice] = useState<HTMLCanvasElement | null>(null);
  const foldOrientation = foldOrientationForMode(device.renderMode);
  useEffect(() => {
    if (!foldOrientation) {
      setFoldedDevice(null);
      return;
    }
    setFoldedDevice(
      createHalfFoldedDeviceCanvas(
        screen,
        frame,
        layer.screenFit,
        layer.colorId,
        foldOrientation,
        layer.foldAngle ?? DEFAULT_FOLD_ANGLE,
        layer.foldDirection ?? 'toward',
        {
          width: renderWidth * previewScale,
          height: renderHeight * previewScale,
        },
        layer.screenScale ?? 1,
        layer.screenOffsetX ?? 0,
        layer.screenOffsetY ?? 0,
      ),
    );
  }, [
    foldOrientation,
    frame,
    layer.colorId,
    layer.foldAngle,
    layer.foldDirection,
    renderHeight,
    layer.screenFit,
    layer.screenOffsetX,
    layer.screenOffsetY,
    layer.screenScale,
    renderWidth,
    previewScale,
    screen,
  ]);
  if (foldOrientation) {
    return (
      <CommonNode layer={layer} onSelect={onSelect} onChange={onChange} keepRatio>
        <Group clipX={0} clipY={0} clipWidth={layer.width} clipHeight={layer.height}>
          <Group x={layout.offsetX} y={layout.offsetY}>
            {foldedDevice && <KonvaImage image={foldedDevice} width={renderWidth} height={renderHeight} />}
          </Group>
        </Group>
      </CommonNode>
    );
  }
  const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = layout.screen;
  const screenPlacement = screen
    ? imagePlacement(
        screen,
        screenWidth,
        screenHeight,
        layer.screenFit,
        layer.screenScale ?? 1,
        layer.screenOffsetX ?? 0,
        layer.screenOffsetY ?? 0,
      )
    : { x: 0, y: 0, width: screenWidth, height: screenHeight };
  const screenImageProps = {
    x: screenX + screenPlacement.x,
    y: screenY + screenPlacement.y,
    width: screenPlacement.width,
    height: screenPlacement.height,
  };
  return (
    <CommonNode layer={layer} onSelect={onSelect} onChange={onChange} keepRatio>
      <Group clipX={0} clipY={0} clipWidth={layer.width} clipHeight={layer.height}>
        <Group x={layout.offsetX} y={layout.offsetY}>
          <Group clipFunc={(context) => traceDeviceDisplay(context, layout.screen)}>
            <Rect
              x={screenX}
              y={screenY}
              width={screenWidth}
              height={screenHeight}
              fill="#dfe7f7"
              listening={false}
            />
            {!screen && (
              <KonvaImage
                image={placeholder}
                x={screenX}
                y={screenY}
                width={screenWidth}
                height={screenHeight}
                listening={false}
              />
            )}
            {screen && <KonvaImage image={screen} {...screenImageProps} listening={false} />}
          </Group>
          {frame && (
            <KonvaImage
              image={frame}
              x={layout.landscape ? renderWidth : 0}
              rotation={layout.landscape ? 90 : 0}
              width={layout.landscape ? renderHeight : renderWidth}
              height={layout.landscape ? renderWidth : renderHeight}
              listening={false}
            />
          )}
        </Group>
      </Group>
    </CommonNode>
  );
}

function BackgroundPage({ document, index }: { document: LayoutDocument; index: number }) {
  const background = document.background;
  const src = background.pageImages?.[String(index)] || background.imageSrc || '';
  const image = useAsset(background.type === 'image' ? src : '');
  const fit = background.imageFit ?? 'cover';
  const crop = image ? imageCrop(image, document.width, document.height, fit) : undefined;
  let imageProps = { x: index * document.width, y: 0, width: document.width, height: document.height };
  if (image && fit === 'contain') {
    const scale = Math.min(document.width / image.naturalWidth, document.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    imageProps = {
      x: index * document.width + (document.width - width) / 2,
      y: (document.height - height) / 2,
      width,
      height,
    };
  }
  return (
    <>
      <Rect
        x={index * document.width}
        width={document.width}
        height={document.height}
        fill={background.color}
        listening={false}
      />
      {image && (
        <KonvaImage
          image={image}
          {...imageProps}
          crop={crop}
          opacity={background.imageOpacity ?? 1}
          listening={false}
        />
      )}
    </>
  );
}

function ShapeNode({ layer, onSelect, onChange }: NodeProps) {
  if (layer.type !== 'shape') return null;
  return (
    <CommonNode layer={layer} onSelect={onSelect} onChange={onChange}>
      {layer.shape === 'ellipse' ? (
        <Circle
          x={layer.width / 2}
          y={layer.height / 2}
          radius={Math.min(layer.width, layer.height) / 2}
          scaleX={layer.width / Math.min(layer.width, layer.height)}
          scaleY={layer.height / Math.min(layer.width, layer.height)}
          fill={layer.fill}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          listening
        />
      ) : (
        <Rect
          width={layer.width}
          height={layer.height}
          fill={layer.fill}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          cornerRadius={layer.cornerRadius}
          listening
        />
      )}
    </CommonNode>
  );
}

export default function CanvasEditor({
  project,
  document,
  locale,
  zoom,
  selectedId,
  activePage,
  onSelect,
  onActivePage,
  onLayerChange,
  guidesEnabled,
  snapDistance,
  crossCanvas,
  onFilesDrop,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropOver, setDropOver] = useState(false);
  const { t } = useI18n();
  const width = document.width * document.pageCount;
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const left = activePage * document.width * zoom;
    const right = left + document.width * zoom;
    if (left < scroll.scrollLeft || right > scroll.scrollLeft + scroll.clientWidth)
      scroll.scrollTo({ left: Math.max(0, left - (scroll.clientWidth - document.width * zoom) / 2) });
  }, [activePage, document.id, document.width, zoom]);

  const sourceSelected = document.layers.find((layer) => layer.id === selectedId);
  const selected = sourceSelected ? effectiveLayer(sourceSelected, locale) : undefined;
  const previewScale = useMemo(
    () => Math.max(0.5, Math.min(3, zoom * (window.devicePixelRatio || 1) * 1.5)),
    [zoom],
  );
  const backgroundPoints = useMemo(() => {
    const radians = (document.background.angle * Math.PI) / 180;
    const cx = document.width / 2;
    const cy = document.height / 2;
    const length =
      Math.abs(document.width * Math.cos(radians)) + Math.abs(document.height * Math.sin(radians));
    const dx = (Math.cos(radians) * length) / 2;
    const dy = (Math.sin(radians) * length) / 2;
    return [cx - dx, cy - dy, cx + dx, cy + dy];
  }, [document.background.angle, document.width, document.height]);

  return (
    <div
      ref={scrollRef}
      className={`canvas-scroll ${dropOver ? 'canvas-drop-over' : ''}`}
      onDragOver={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'copy';
          setDropOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropOver(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setDropOver(false);
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.container().getBoundingClientRect();
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const x = (pointer.x - SELECTION_PADDING) / zoom,
          y = (pointer.y - SELECTION_PADDING) / zoom;
        let node: Konva.Node | null = stage.getIntersection(pointer);
        while (node && !node.id().startsWith('node-')) node = node.getParent();
        const page = Math.max(0, Math.min(document.pageCount - 1, Math.floor(x / document.width)));
        onActivePage(page);
        onFilesDrop(Array.from(event.dataTransfer.files), { x, y, page, layerId: node?.id().slice(5) });
      }}
    >
      {dropOver && (
        <div className="canvas-drop-message">
          {t('Drop on a device to replace its screen. Drop elsewhere to add images.')}
        </div>
      )}
      <div className="canvas-shell" style={{ width: width * zoom, height: document.height * zoom }}>
        <Stage
          ref={stageRef}
          width={width * zoom + SELECTION_PADDING * 2}
          height={document.height * zoom + SELECTION_PADDING * 2}
          x={SELECTION_PADDING}
          y={SELECTION_PADDING}
          style={{ position: 'absolute', left: -SELECTION_PADDING, top: -SELECTION_PADDING }}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(event) => {
            if (event.target !== event.target.getStage()) return;
            const pointer = stageRef.current?.getPointerPosition();
            if (pointer)
              onActivePage(
                Math.max(
                  0,
                  Math.min(
                    document.pageCount - 1,
                    Math.floor((pointer.x - SELECTION_PADDING) / zoom / document.width),
                  ),
                ),
              );
            onSelect(null);
          }}
        >
          <Layer clipX={0} clipY={0} clipWidth={width} clipHeight={document.height}>
            {Array.from({ length: document.pageCount }, (_, index) =>
              document.background.type === 'image' ? (
                <BackgroundPage key={`page-bg-${index}`} document={document} index={index} />
              ) : (
                <Rect
                  key={`page-bg-${index}`}
                  x={index * document.width}
                  width={document.width}
                  height={document.height}
                  fill={document.background.type === 'solid' ? document.background.color : undefined}
                  fillLinearGradientStartPoint={
                    document.background.type === 'linear'
                      ? { x: backgroundPoints[0], y: backgroundPoints[1] }
                      : undefined
                  }
                  fillLinearGradientEndPoint={
                    document.background.type === 'linear'
                      ? { x: backgroundPoints[2], y: backgroundPoints[3] }
                      : undefined
                  }
                  fillLinearGradientColorStops={
                    document.background.type === 'linear'
                      ? [0, document.background.color, 1, document.background.color2]
                      : undefined
                  }
                  listening={false}
                />
              ),
            )}
            {document.layers.map((layer) => {
              const common = {
                layer,
                project,
                locale,
                previewScale,
                selected: selectedId === layer.id,
                onSelect: () => onSelect(layer.id),
                onChange: (patch: Partial<EditorLayer>) => onLayerChange(layer.id, patch),
              };
              const content =
                layer.type === 'text' ? (
                  <TextNode {...common} />
                ) : layer.type === 'image' ? (
                  <ImageNode {...common} />
                ) : layer.type === 'device' ? (
                  <DeviceNode {...common} />
                ) : (
                  <ShapeNode {...common} />
                );
              return (
                <Group
                  key={layer.id}
                  clipX={layer.clipPage === undefined ? undefined : layer.clipPage * document.width}
                  clipY={layer.clipPage === undefined ? undefined : 0}
                  clipWidth={layer.clipPage === undefined ? undefined : document.width}
                  clipHeight={layer.clipPage === undefined ? undefined : document.height}
                >
                  {content}
                </Group>
              );
            })}
            {Array.from({ length: document.pageCount - 1 }, (_, index) => (
              <Line
                key={`seam-${index}`}
                points={[(index + 1) * document.width, 0, (index + 1) * document.width, document.height]}
                stroke="rgba(18, 24, 38, .25)"
                strokeWidth={1 / zoom}
                dash={[18 / zoom, 14 / zoom]}
                listening={false}
              />
            ))}
            {Array.from({ length: document.pageCount }, (_, index) => (
              <Rect
                key={`page-outline-${index}`}
                x={index * document.width}
                width={document.width}
                height={document.height}
                stroke={index === activePage && !selectedId ? '#007aff' : 'rgba(18, 24, 38, .16)'}
                strokeWidth={(index === activePage && !selectedId ? 1.5 : 1) / zoom}
                listening={false}
              />
            ))}
          </Layer>
          <Layer>
            <SmartGuides
              stageRef={stageRef}
              document={document}
              locale={locale}
              zoom={zoom}
              enabled={guidesEnabled}
              snapDistance={snapDistance}
              crossCanvas={crossCanvas}
            />
            <SelectionFrame stageRef={stageRef} selected={selected} zoom={zoom} />
          </Layer>
        </Stage>
        <SelectionBadge stageRef={stageRef} selected={selected} zoom={zoom} />
        <div className="artboard-labels" aria-hidden="true">
          {Array.from({ length: document.pageCount }, (_, index) => (
            <span key={index} style={{ width: document.width * zoom }}>
              {String(index + 1).padStart(2, '0')} · {document.width}×{document.height}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
