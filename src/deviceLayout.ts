import type { DeviceDefinition, DeviceLayer } from './types';
export type CropRegion = NonNullable<DeviceLayer['crop']>;
export const FULL_CROP: CropRegion = { x: 0, y: 0, width: 1, height: 1 };

export function deviceLayout(layer: DeviceLayer, device: DeviceDefinition) {
  const crop = layer.crop ?? FULL_CROP;
  const width = layer.width / crop.width,
    height = layer.height / crop.height;
  const landscape = layer.orientation === 'landscape' && (!device.renderMode || device.renderMode === 'flat');
  const sx = (landscape ? height : width) / device.frameWidth,
    sy = (landscape ? width : height) / device.frameHeight;
  const x = landscape
    ? (device.frameHeight - device.screenY - device.screenHeight) * sy
    : device.screenX * sx;
  const y = landscape ? device.screenX * sx : device.screenY * sy;
  const screenWidth = landscape ? device.screenHeight * sy : device.screenWidth * sx;
  const screenHeight = landscape ? device.screenWidth * sx : device.screenHeight * sy;
  const corners = device.screenCorners ?? [
    device.screenRadius,
    device.screenRadius,
    device.screenRadius,
    device.screenRadius,
  ];
  const radii = (landscape ? [corners[3], corners[0], corners[1], corners[2]] : corners).map((r) => ({
    x: r * (landscape ? sy : sx),
    y: r * (landscape ? sx : sy),
  }));
  return {
    width,
    height,
    offsetX: -crop.x * width,
    offsetY: -crop.y * height,
    landscape,
    screen: { x, y, width: screenWidth, height: screenHeight, radii },
  };
}
export function traceDeviceDisplay(
  context: Pick<CanvasRenderingContext2D, 'beginPath' | 'roundRect'>,
  screen: ReturnType<typeof deviceLayout>['screen'],
) {
  context.beginPath();
  context.roundRect(screen.x, screen.y, screen.width, screen.height, screen.radii);
}
export function cropDevice(layer: DeviceLayer, region: CropRegion): DeviceLayer {
  const width = Math.min(1, Math.max(Math.min(1, 1 / layer.width), region.width));
  const height = Math.min(1, Math.max(Math.min(1, 1 / layer.height), region.height));
  region = {
    x: Math.max(0, Math.min(1 - width, region.x)),
    y: Math.max(0, Math.min(1 - height, region.y)),
    width,
    height,
  };
  const previous = layer.crop ?? FULL_CROP;
  const a = (layer.rotation * Math.PI) / 180,
    dx = region.x * layer.width,
    dy = region.y * layer.height;
  return {
    ...layer,
    x: layer.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: layer.y + dx * Math.sin(a) + dy * Math.cos(a),
    width: layer.width * region.width,
    height: layer.height * region.height,
    crop: {
      x: previous.x + region.x * previous.width,
      y: previous.y + region.y * previous.height,
      width: previous.width * region.width,
      height: previous.height * region.height,
    },
  };
}
export function resetDeviceCrop(layer: DeviceLayer): DeviceLayer {
  if (!layer.crop) return layer;
  const fullWidth = layer.width / layer.crop.width,
    fullHeight = layer.height / layer.crop.height;
  const dx = layer.crop.x * fullWidth,
    dy = layer.crop.y * fullHeight,
    a = (layer.rotation * Math.PI) / 180;
  return {
    ...layer,
    x: layer.x - dx * Math.cos(a) + dy * Math.sin(a),
    y: layer.y - dx * Math.sin(a) - dy * Math.cos(a),
    width: fullWidth,
    height: fullHeight,
    crop: undefined,
  };
}
export function orientDevice(layer: DeviceLayer, orientation: 'portrait' | 'landscape'): DeviceLayer {
  if ((layer.orientation ?? 'portrait') === orientation) return layer;
  const c = layer.crop;
  const crop = c
    ? orientation === 'landscape'
      ? { x: 1 - c.y - c.height, y: c.x, width: c.height, height: c.width }
      : { x: c.y, y: 1 - c.x - c.width, width: c.height, height: c.width }
    : undefined;
  return {
    ...layer,
    orientation,
    width: layer.height,
    height: layer.width,
    x: layer.x + (layer.width - layer.height) / 2,
    y: layer.y + (layer.height - layer.width) / 2,
    crop,
  };
}
