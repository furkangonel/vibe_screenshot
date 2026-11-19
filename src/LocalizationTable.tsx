import { ArrowDown, ArrowUp, Download, GripVertical, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import Dialog from './Dialog';
import FileDrop from './FileDrop';
import { copyKeys, deleteCopyKeys, moveCopyKey } from './editorActions';
import { readFileAsText } from './files';
import { useI18n } from './i18n';
import { validateCopy, validateLocales } from './projectValidation';
import { downloadBlob } from './storage';
import type { ScreenshotProject } from './types';

const DRAG_KEY = 'application/x-vibe-copy-key';
function KeyName({ value, onRename }: { value: string; onRename: (next: string) => boolean }) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  return (
    <input
      aria-label={value}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          setDraft(value);
          return;
        }
        if (!onRename(draft.trim())) setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function LocalizationTable({
  project,
  onChange,
}: {
  project: ScreenshotProject;
  onChange: (project: ScreenshotProject) => void;
}) {
  const { t } = useI18n();
  const importRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const keys = copyKeys(project);
  const selection = selected.filter((key) => keys.includes(key));
  const references = project.documents
    .flatMap((d) => d.layers)
    .filter((l) => l.type === 'text' && deleting.includes(l.translationKey)).length;

  async function importCopy(file: File) {
    const parsed = JSON.parse(await readFileAsText(file));
    const copy = validateCopy(parsed.copy);
    const locales = validateLocales(parsed.locales ?? project.locales);
    if (!locales.some((item) => item.code === project.defaultLocale))
      throw new Error('Missing default locale');
    if (
      parsed.copyOrder !== undefined &&
      (!Array.isArray(parsed.copyOrder) ||
        parsed.copyOrder.length > 10000 ||
        !parsed.copyOrder.every((v: unknown) => typeof v === 'string'))
    )
      throw new Error('Invalid key order');
    onChange({
      ...project,
      locales,
      copy,
      copyOrder: copyKeys({ copy, copyOrder: parsed.copyOrder ?? Object.keys(copy) }),
    });
    setSelected([]);
  }
  const load = (files: File[]) => {
    if (files[0]) void importCopy(files[0]).catch(() => window.alert(t('invalidCopy')));
  };
  function addKey() {
    let index = keys.length + 1;
    let key = `copy_${index}`;
    while (project.copy[key]) key = `copy_${++index}`;
    onChange({
      ...project,
      copy: { ...project.copy, [key]: { [project.defaultLocale]: t('New copy') } },
      copyOrder: [...keys, key],
    });
  }
  function rename(key: string, next: string) {
    if (key === next) return true;
    if (
      !next ||
      next.length > 300 ||
      Object.hasOwn(project.copy, next) ||
      ['__proto__', 'constructor', 'prototype'].includes(next)
    )
      return false;
    const copy = { ...project.copy, [next]: project.copy[key] };
    delete copy[key];
    onChange({
      ...project,
      copy,
      copyOrder: keys.map((item) => (item === key ? next : item)),
      documents: project.documents.map((d) => ({
        ...d,
        layers: d.layers.map((l) =>
          l.type === 'text' && l.translationKey === key ? { ...l, translationKey: next } : l,
        ),
      })),
    });
    setSelected((current) => current.map((item) => (item === key ? next : item)));
    return true;
  }
  return (
    <FileDrop onFiles={load} label={t('Drop localization JSON')}>
      <main className="localizations-view">
        <header className="localizations-header">
          <div>
            <span className="eyebrow">{t('Copy matrix')}</span>
            <h1>{t('Localizations')}</h1>
            <p>
              {t(
                'Mağaza metinleri uygulama içi çevirilerden bağımsızdır. Boş hücreler export sırasında ana dile düşer.',
              )}
            </p>
          </div>
          <div className="localization-actions">
            {!!selection.length && (
              <button className="button secondary danger-action" onClick={() => setDeleting(selection)}>
                <Trash2 size={15} />
                {t('Delete selected')} ({selection.length})
              </button>
            )}
            <button className="button secondary" onClick={addKey}>
              <Plus size={15} />
              {t('Key ekle')}
            </button>
            <button className="button secondary" onClick={() => importRef.current?.click()}>
              <Upload size={15} />
              {t('JSON içe aktar')}
            </button>
            <button
              className="button primary"
              onClick={() =>
                downloadBlob(
                  new Blob(
                    [
                      JSON.stringify(
                        { locales: project.locales, copy: project.copy, copyOrder: keys },
                        null,
                        2,
                      ),
                    ],
                    { type: 'application/json' },
                  ),
                  'app-store-localizations.json',
                )
              }
            >
              <Download size={15} />
              {t('JSON dışa aktar')}
            </button>
          </div>
        </header>
        <div className="matrix-wrap">
          <table className="locale-matrix">
            <thead>
              <tr>
                <th>
                  <label className="key-select-all">
                    <input
                      type="checkbox"
                      aria-label={t('Select all keys')}
                      checked={!!keys.length && selection.length === keys.length}
                      onChange={(event) => setSelected(event.target.checked ? keys : [])}
                    />
                    {t('Translation key')}
                  </label>
                </th>
                {project.locales.map((l) => (
                  <th key={l.code}>
                    <strong>{l.name}</strong>
                    <span>{l.code}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key, index) => (
                <tr
                  key={key}
                  className={selection.includes(key) ? 'key-selected' : ''}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(DRAG_KEY)) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => {
                    const from = event.dataTransfer.getData(DRAG_KEY);
                    if (!from) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onChange(moveCopyKey(project, from, index));
                    setDragging(null);
                  }}
                  data-copy-key={key}
                >
                  <th>
                    <div className={`key-controls ${dragging === key ? 'is-dragging' : ''}`}>
                      <input
                        type="checkbox"
                        aria-label={`${t('Select key')} ${key}`}
                        checked={selection.includes(key)}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked ? [...selection, key] : selection.filter((k) => k !== key),
                          )
                        }
                      />
                      <button
                        className="icon-button key-drag"
                        draggable
                        aria-label={`${t('Drag key')} ${key}`}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(DRAG_KEY, key);
                          event.dataTransfer.effectAllowed = 'move';
                          setDragging(key);
                        }}
                        onDragEnd={() => setDragging(null)}
                        onKeyDown={(event) => {
                          if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                            event.preventDefault();
                            onChange(moveCopyKey(project, key, index + (event.key === 'ArrowUp' ? -1 : 1)));
                          }
                        }}
                      >
                        <GripVertical size={14} />
                      </button>
                      <KeyName value={key} onRename={(next) => rename(key, next)} />
                    </div>
                    <div className="key-row-actions">
                      <button
                        className="icon-button"
                        aria-label={`${t('Move key up')} ${key}`}
                        disabled={index === 0}
                        onClick={() => onChange(moveCopyKey(project, key, index - 1))}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${t('Move key down')} ${key}`}
                        disabled={index === keys.length - 1}
                        onClick={() => onChange(moveCopyKey(project, key, index + 1))}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        className="icon-button danger-action"
                        aria-label={`${t('Delete key')} ${key}`}
                        onClick={() => setDeleting([key])}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </th>
                  {project.locales.map((l) => (
                    <td key={l.code}>
                      <textarea
                        rows={3}
                        aria-label={`${key} · ${l.code}`}
                        value={project.copy[key]?.[l.code] ?? ''}
                        placeholder={
                          l.code === project.defaultLocale
                            ? t('Required')
                            : (project.copy[key]?.[project.defaultLocale] ?? '')
                        }
                        onChange={(event) =>
                          onChange({
                            ...project,
                            copy: {
                              ...project.copy,
                              [key]: { ...project.copy[key], [l.code]: event.target.value },
                            },
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <input
          ref={importRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            load(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        {!!deleting.length && (
          <Dialog title={t('Delete translation keys')} onClose={() => setDeleting([])}>
            <p>
              {deleting.length} {t('keys selected')}. {references} {t('linked text layers')}.
            </p>
            <p>{t('Deleting keys also removes their text layers from every output. You can undo this.')}</p>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setDeleting([])}>
                {t('Cancel')}
              </button>
              <button
                className="button primary danger-button"
                onClick={() => {
                  onChange(deleteCopyKeys(project, deleting));
                  setSelected([]);
                  setDeleting([]);
                }}
              >
                {t('Delete selected')}
              </button>
            </div>
          </Dialog>
        )}
      </main>
    </FileDrop>
  );
}
