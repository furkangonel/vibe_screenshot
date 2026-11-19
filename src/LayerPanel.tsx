import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Link2,
  Lock,
  Shapes,
  Smartphone,
  Type,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';
import { layerPages } from './editorActions';
import { effectiveLayer } from './layerUtils';
import { useI18n } from './i18n';
import type { EditorLayer, LayoutDocument } from './types';

export default function LayerPanel({
  document,
  locale,
  selectedId,
  onSelect,
  onChange,
  onPage,
}: {
  document: LayoutDocument;
  locale: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<EditorLayer>) => void;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const layers = [...document.layers]
    .reverse()
    .map((layer) => ({ layer, pages: layerPages(effectiveLayer(layer, locale), document) }));
  const groups = Array.from({ length: document.pageCount }, (_, page) => ({
    id: `${document.id}:${page}`,
    page,
    label: `${t('Screenshot')} ${String(page + 1).padStart(2, '0')}`,
    entries: layers.filter((item) => item.pages.includes(page)),
  }));
  const outside = layers.filter((item) => !item.pages.length);
  if (outside.length)
    groups.push({
      id: `${document.id}:outside`,
      page: -1,
      label: t('Outside screenshots'),
      entries: outside,
    });
  return (
    <section className="panel-section layers-section">
      <div className="section-heading">
        <span>{t('Layers')}</span>
        <Layers3 size={14} />
      </div>
      <div className="layer-list">
        {groups.map((group) => (
          <div className="layer-page-group" key={group.id}>
            <button
              className="layer-page-heading"
              aria-expanded={!collapsed.includes(group.id)}
              onClick={() => {
                setCollapsed((current) =>
                  current.includes(group.id)
                    ? current.filter((id) => id !== group.id)
                    : [...current, group.id],
                );
                if (group.page >= 0) onPage(group.page);
              }}
            >
              {collapsed.includes(group.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              <span>{group.label}</span>
              <small>{group.entries.length}</small>
            </button>
            {!collapsed.includes(group.id) &&
              group.entries.map(({ layer, pages }) => (
                <div key={layer.id} className={`layer-row ${selectedId === layer.id ? 'selected' : ''}`}>
                  <button
                    className="layer-select"
                    aria-label={layer.name}
                    onClick={() => {
                      if (group.page >= 0) onPage(group.page);
                      onSelect(layer.id);
                    }}
                  >
                    <span className="layer-icon">
                      {layer.type === 'text' ? (
                        <Type size={14} />
                      ) : layer.type === 'device' ? (
                        <Smartphone size={14} />
                      ) : layer.type === 'image' ? (
                        <ImagePlus size={14} />
                      ) : (
                        <Shapes size={14} />
                      )}
                    </span>
                    <span className="layer-name">{layer.name}</span>
                    {pages.length > 1 && (
                      <Link2 size={12} className="shared-layer" aria-label={t('Across screenshots')} />
                    )}
                  </button>
                  <button
                    className="layer-mini-action"
                    aria-label={t(layer.visible ? 'Hide layer' : 'Show layer')}
                    onClick={() => onChange(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    className="layer-mini-action"
                    aria-label={t(layer.locked ? 'Unlock layer' : 'Lock layer')}
                    onClick={() => onChange(layer.id, { locked: !layer.locked })}
                  >
                    {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
