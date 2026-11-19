import { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import { FULL_CROP, type CropRegion } from './deviceLayout';
import { renderLayerPreview } from './exporter';
import { useI18n } from './i18n';
import type { DeviceLayer, ScreenshotProject } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export default function DeviceCropDialog({
  project,
  layer,
  locale,
  onApply,
  onClose,
}: {
  project: ScreenshotProject;
  layer: DeviceLayer;
  locale: string;
  onApply: (region: CropRegion) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);
  const [region, setRegion] = useState<CropRegion>({ ...FULL_CROP });
  const drag = useRef<{ x: number; y: number; region: CropRegion; handle: string } | null>(null);
  useEffect(() => {
    let live = true;
    void renderLayerPreview(project, layer, locale)
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [project, layer, locale]);
  return (
    <Dialog title={t('Crop device')} onClose={onClose}>
      <p>{t('Drag the area or its handles. The frame and screen crop together.')}</p>
      <div
        className="device-crop-preview"
        style={{
          width: Math.min(470, (window.innerHeight * 0.48 * layer.width) / layer.height),
          aspectRatio: `${layer.width}/${layer.height}`,
        }}
        onPointerDown={(event) => {
          if (!src) return;
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect(),
            x = clamp((event.clientX - box.left) / box.width, 0, 1),
            y = clamp((event.clientY - box.top) / box.height, 0, 1);
          const target = event.target as HTMLElement;
          const handle = target.dataset.cropHandle ?? (target.closest('.crop-region') ? 'move' : 'new');
          drag.current = { x, y, region: { ...region }, handle };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const box = event.currentTarget.getBoundingClientRect(),
            x = clamp((event.clientX - box.left) / box.width, 0, 1),
            y = clamp((event.clientY - box.top) / box.height, 0, 1),
            r = start.region;
          if (start.handle === 'move') {
            setRegion({
              ...r,
              x: clamp(r.x + x - start.x, 0, 1 - r.width),
              y: clamp(r.y + y - start.y, 0, 1 - r.height),
            });
            return;
          }
          if (start.handle === 'new') {
            setRegion({
              x: Math.min(0.98, Math.min(start.x, x)),
              y: Math.min(0.98, Math.min(start.y, y)),
              width: Math.max(0.02, Math.abs(x - start.x)),
              height: Math.max(0.02, Math.abs(y - start.y)),
            });
            return;
          }
          let left = r.x,
            right = r.x + r.width,
            top = r.y,
            bottom = r.y + r.height;
          if (start.handle.includes('w')) left = clamp(x, 0, right - 0.02);
          if (start.handle.includes('e')) right = clamp(x, left + 0.02, 1);
          if (start.handle.includes('n')) top = clamp(y, 0, bottom - 0.02);
          if (start.handle.includes('s')) bottom = clamp(y, top + 0.02, 1);
          setRegion({ x: left, y: top, width: right - left, height: bottom - top });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {src && <img src={src} alt={t('Device crop preview')} draggable={false} />}
        {src && (
          <div
            className="crop-region"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          >
            {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
              <span key={handle} data-crop-handle={handle} className={`crop-handle crop-${handle}`} />
            ))}
          </div>
        )}
      </div>
      {error && <p role="alert">{t('imageFailed')}</p>}
      <div className="crop-numbers">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key}>
            {t(key === 'width' ? 'Width' : key === 'height' ? 'Height' : key.toUpperCase())} %
            <input
              aria-label={`${t('Crop')} ${key}`}
              type="number"
              min={key === 'x' || key === 'y' ? 0 : 2}
              max={100}
              step={0.1}
              value={Math.round(region[key] * 1000) / 10}
              onChange={(event) => {
                const value = Number(event.target.value) / 100;
                if (!Number.isFinite(value)) return;
                setRegion((r) => ({
                  ...r,
                  [key]:
                    key === 'x'
                      ? clamp(value, 0, 1 - r.width)
                      : key === 'y'
                        ? clamp(value, 0, 1 - r.height)
                        : key === 'width'
                          ? clamp(value, 0.02, 1 - r.x)
                          : clamp(value, 0.02, 1 - r.y),
                }));
              }}
            />
          </label>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="button secondary" onClick={() => setRegion({ ...FULL_CROP })}>
          {t('Entire device')}
        </button>
        <button className="button secondary" onClick={onClose}>
          {t('Cancel')}
        </button>
        <button className="button primary" disabled={!src} onClick={() => onApply(region)}>
          {t('Apply crop')}
        </button>
      </div>
    </Dialog>
  );
}
