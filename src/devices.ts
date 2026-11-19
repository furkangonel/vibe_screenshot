import { DEFAULT_FOLD_ANGLE, getHalfFoldedCanvasSize } from './duoHalfFold';
import { FOLDABLE_COVER_CORNERS } from './deviceScreenPath';
import type { DeviceDefinition } from './types';
import androidDevices from './androidDevices.json';

// Optional local artwork is discovered at build time; source-only installs retain
// the original vector fallback. No artwork is fetched from a remote service.
const localArtwork = import.meta.glob<string>('../.local/legacy-device-artwork/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const moduleDirectory = import.meta.url.slice(0, import.meta.url.lastIndexOf('/') + 1);
const asset = (device: string, color: string) =>
  localArtwork[`../.local/legacy-device-artwork/${device}/${color}.png`] ??
  new URL(`../assets/devices/${device}/${color}.svg`, moduleDirectory).href;
export const DEVICE_ARTWORK_KIND = Object.keys(localArtwork).length ? 'photographic' : 'vector';

export const DEVICES: DeviceDefinition[] = [
  {
    id: 'iphone-18-pro',
    label: 'Phone · 6.3″',
    frameWidth: 1350,
    frameHeight: 2760,
    screenX: 72,
    screenY: 69,
    screenWidth: 1206,
    screenHeight: 2622,
    screenRadius: 196,
    officialApple: false,
    colors: [
      { id: 'black', label: 'Black', src: asset('iphone-18-pro', 'black') },
      { id: 'silver', label: 'Silver', src: asset('iphone-18-pro', 'silver') },
      { id: 'glacier', label: 'Glacier', src: asset('iphone-18-pro', 'glacier') },
      { id: 'burgundy', label: 'Burgundy', src: asset('iphone-18-pro', 'burgundy') },
    ],
  },
  {
    id: 'iphone-18-pro-max',
    label: 'Phone · 6.9″',
    frameWidth: 1470,
    frameHeight: 3000,
    screenX: 75,
    screenY: 66,
    screenWidth: 1320,
    screenHeight: 2868,
    screenRadius: 198,
    officialApple: false,
    colors: [
      { id: 'black', label: 'Black', src: asset('iphone-18-pro-max', 'black') },
      { id: 'silver', label: 'Silver', src: asset('iphone-18-pro-max', 'silver') },
      { id: 'glacier', label: 'Glacier', src: asset('iphone-18-pro-max', 'glacier') },
      { id: 'burgundy', label: 'Burgundy', src: asset('iphone-18-pro-max', 'burgundy') },
    ],
  },
  {
    id: 'ipad-pro-m5-13',
    label: 'Tablet · 13″',
    frameWidth: 2300,
    frameHeight: 3000,
    screenX: 118,
    screenY: 124,
    screenWidth: 2064,
    screenHeight: 2752,
    screenRadius: 61,
    officialApple: false,
    colors: [
      { id: 'space-black', label: 'Space Black', src: asset('ipad-pro-m5-13', 'space-black') },
      { id: 'silver', label: 'Silver', src: asset('ipad-pro-m5-13', 'silver') },
    ],
  },
  {
    id: 'iphone-duo-inner-open',
    label: 'Foldable · Inner',
    frameWidth: 2247,
    frameHeight: 3093,
    screenX: 120,
    screenY: 120,
    screenWidth: 2007,
    screenHeight: 2853,
    screenRadius: 168,
    officialApple: false,
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-inner-open', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-inner-open', 'star-white') },
    ],
  },
  {
    id: 'iphone-duo-inner-half-folded',
    label: 'Foldable · Book',
    frameWidth: getHalfFoldedCanvasSize('vertical', DEFAULT_FOLD_ANGLE).width,
    frameHeight: getHalfFoldedCanvasSize('vertical', DEFAULT_FOLD_ANGLE).height,
    screenX: 80,
    screenY: 80,
    screenWidth: 1600,
    screenHeight: 2853,
    screenRadius: 108,
    officialApple: false,
    renderMode: 'duo-half-fold-vertical',
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-inner-open', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-inner-open', 'star-white') },
    ],
  },
  {
    id: 'iphone-duo-inner-half-folded-horizontal',
    label: 'Foldable · Tabletop',
    frameWidth: getHalfFoldedCanvasSize('horizontal', DEFAULT_FOLD_ANGLE).width,
    frameHeight: getHalfFoldedCanvasSize('horizontal', DEFAULT_FOLD_ANGLE).height,
    screenX: 80,
    screenY: 80,
    screenWidth: 2007,
    screenHeight: 2853,
    screenRadius: 108,
    officialApple: false,
    renderMode: 'duo-half-fold-horizontal',
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-inner-open', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-inner-open', 'star-white') },
    ],
  },
  {
    id: 'iphone-duo-folded-tent',
    label: 'Foldable · Tent',
    frameWidth: getHalfFoldedCanvasSize('tent', DEFAULT_FOLD_ANGLE).width,
    frameHeight: getHalfFoldedCanvasSize('tent', DEFAULT_FOLD_ANGLE).height,
    screenX: 0,
    screenY: 0,
    screenWidth: 2034,
    screenHeight: 1398,
    screenRadius: 26,
    officialApple: false,
    renderMode: 'duo-fold-tent',
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-outer-open', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-outer-open', 'star-white') },
    ],
  },
  {
    id: 'iphone-duo-outer-closed',
    label: 'Foldable · Closed',
    frameWidth: 1574,
    frameHeight: 2194,
    screenX: 88,
    screenY: 80,
    screenWidth: 1398,
    screenHeight: 2034,
    screenRadius: 26,
    screenCorners: FOLDABLE_COVER_CORNERS,
    officialApple: false,
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-outer-closed', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-outer-closed', 'star-white') },
    ],
  },
  {
    id: 'iphone-duo-outer-open',
    label: 'Foldable · Outer',
    frameWidth: 3056,
    frameHeight: 2194,
    screenX: 1570,
    screenY: 80,
    screenWidth: 1398,
    screenHeight: 2034,
    screenRadius: 26,
    screenCorners: FOLDABLE_COVER_CORNERS,
    officialApple: false,
    colors: [
      { id: 'night-sky', label: 'Night Sky', src: asset('iphone-duo-outer-open', 'night-sky') },
      { id: 'star-white', label: 'Star White', src: asset('iphone-duo-outer-open', 'star-white') },
    ],
  },
  ...androidDevices.map((device): DeviceDefinition => ({
    ...device,
    category: device.category === 'tablet' ? 'tablet' : 'phone',
    platform: 'android',
    officialApple: false,
    colors: device.colors.map((color) => ({
      id: color,
      label: color.charAt(0).toUpperCase() + color.slice(1),
      src: asset(device.id, color),
    })),
  })),
];

export function getDevice(id: string) {
  return DEVICES.find((device) => device.id === id) ?? DEVICES[0];
}

export function getDeviceColor(device: DeviceDefinition, colorId: string) {
  return device.colors.find((color) => color.id === colorId) ?? device.colors[0];
}
