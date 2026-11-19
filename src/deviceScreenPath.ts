import profiles from './screenProfiles.json';
import type { DeviceDefinition } from './types';

export type ScreenCorners = readonly [number, number, number, number];
// Clockwise from top-left. The fold edge is tight; the outer edge is broadly rounded.
export const FOLDABLE_COVER_CORNERS = profiles.foldableCoverCorners as unknown as ScreenCorners;
type ScreenArea = Pick<
  DeviceDefinition,
  'screenX' | 'screenY' | 'screenWidth' | 'screenHeight' | 'screenRadius' | 'screenCorners'
>;
type PathContext = Pick<CanvasRenderingContext2D, 'beginPath' | 'roundRect'>;
export function traceDeviceScreen(context: PathContext, screen: ScreenArea, scaleX = 1, scaleY = scaleX) {
  const radii = screen.screenCorners ?? [
    screen.screenRadius,
    screen.screenRadius,
    screen.screenRadius,
    screen.screenRadius,
  ];
  context.beginPath();
  context.roundRect(
    screen.screenX * scaleX,
    screen.screenY * scaleY,
    screen.screenWidth * scaleX,
    screen.screenHeight * scaleY,
    radii.map((radius) => ({ x: radius * scaleX, y: radius * scaleY })),
  );
}
