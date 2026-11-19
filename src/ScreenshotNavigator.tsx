import { ArrowLeft, ArrowRight, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from './i18n';

const PAGE_DRAG = 'application/x-vibe-screenshot';
export default function ScreenshotNavigator({
  count,
  active,
  onSelect,
  onMove,
}: {
  count: number;
  active: number;
  onSelect: (page: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <nav className="screenshot-navigator" aria-label={t('Screenshot order')}>
      <span className="navigator-label">{t('Screenshots')}</span>
      <div className="screenshot-items">
        {Array.from({ length: count }, (_, page) => (
          <div
            key={page}
            className={`screenshot-item ${active === page ? 'active' : ''} ${dragging === page ? 'is-dragging' : ''} ${over === page ? 'drop-target' : ''}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(PAGE_DRAG, String(page));
              event.dataTransfer.effectAllowed = 'move';
              setDragging(page);
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(PAGE_DRAG)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(page);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(event) => {
              const data = event.dataTransfer.getData(PAGE_DRAG);
              if (data === '') return;
              event.preventDefault();
              event.stopPropagation();
              onMove(Number(data), page);
              setDragging(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
          >
            <GripVertical className="page-grip" size={12} />
            <button
              className="screenshot-select"
              aria-label={`${t('Screenshot')} ${page + 1}`}
              aria-current={active === page ? 'page' : undefined}
              onClick={() => onSelect(page)}
            >
              {String(page + 1).padStart(2, '0')}
            </button>
            <div className="screenshot-move">
              <button
                aria-label={`${t('Move screenshot left')} ${page + 1}`}
                disabled={page === 0}
                onClick={() => onMove(page, page - 1)}
              >
                <ArrowLeft size={12} />
              </button>
              <button
                aria-label={`${t('Move screenshot right')} ${page + 1}`}
                disabled={page === count - 1}
                onClick={() => onMove(page, page + 1)}
              >
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="page-destination">
        <span>{t('Move to')}</span>
        <select
          aria-label={t('Move screenshot to')}
          value={active}
          onChange={(event) => onMove(active, Number(event.target.value))}
        >
          {Array.from({ length: count }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
