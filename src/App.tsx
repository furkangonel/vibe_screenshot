import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Download,
  MoreHorizontal,
  ImagePlus,
  Languages,
  Maximize2,
  Palette,
  PanelTop,
  PanelLeft,
  PanelRight,
  FolderOpen,
  Undo2,
  Redo2,
  Save,
  Shapes,
  Smartphone,
  Tablet,
  Settings2,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEVICES, getDevice } from './devices';
import { DEFAULT_FOLD_ANGLE, foldOrientationForMode, getHalfFoldedCanvasSize } from './duoHalfFold';
import { exportProjectZip, exportSinglePage } from './exporter';
import { createId } from './id';
import { effectiveLayer, isLayerAcrossSeam, updateTextLayerForLocale } from './layerUtils';
import { getPreset, OUTPUT_PRESETS, validateOutputSize } from './presets';
import { createOutputDocument } from './defaultProject';
import { migrateProject, needsDuoOutputMigration } from './projectMigration';
import { downloadBlob, readPreference, writePreference } from './storage';
import Settings, { type StudioPreferences } from './Settings';
import { desktop } from './desktop';
import { useDesktopAutomation } from './useDesktopAutomation';
import { useWorkspace } from './useWorkspace';
import { useI18n } from './i18n';
import ProjectLibrary from './ProjectLibrary';
import Dialog from './Dialog';
import { parseProject } from './projectValidation';
import { readFileAsDataUrl, readFileAsText } from './files';
import FileDrop from './FileDrop';
import DeviceCropDialog from './DeviceCropDialog';
import { cropDevice, orientDevice, resetDeviceCrop } from './deviceLayout';
import LocalizationTable from './LocalizationTable';
import LayerPanel from './LayerPanel';
import ScreenshotNavigator from './ScreenshotNavigator';
import { moveScreenshot } from './editorActions';
import type {
  DeviceLayer,
  EditorLayer,
  ImageLayer,
  LayoutDocument,
  ScreenshotProject,
  ShapeLayer,
  TextLayer,
} from './types';

const CanvasEditor = lazy(() => import('./CanvasEditor'));

type ViewMode = 'editor' | 'localizations';

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(numberValue(event.target.value, value))}
      />
    </Field>
  );
}

function App() {
  const workspace = useWorkspace();
  const { project, setProject, undo, redo, status: saveState } = workspace;
  const { t } = useI18n();
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [preferences, setPreferences] = useState<StudioPreferences>(() => {
    const defaults = {
      layers: window.innerWidth > 720,
      inspector: window.innerWidth > 1000,
      guides: true,
      snapDistance: 5,
      crossCanvas: true,
    };
    try {
      const stored = JSON.parse(readPreference('studio-preferences') || '{}');
      return { ...defaults, ...stored };
    } catch {
      return defaults;
    }
  });
  const [compact, setCompact] = useState(window.innerWidth <= 720);
  const [compactPane, setCompactPane] = useState<'left' | 'right' | null>(null);
  const leftOpen = compact ? compactPane === 'left' : preferences.layers;
  const rightOpen = compact ? compactPane === 'right' : preferences.inspector;
  const setLeftOpen = (value: boolean) =>
    compact
      ? setCompactPane((current) => (value ? 'left' : current === 'left' ? null : current))
      : changePreferences({ layers: value });
  const setRightOpen = (value: boolean) =>
    compact
      ? setCompactPane((current) => (value ? 'right' : current === 'right' ? null : current))
      : changePreferences({ inspector: value });
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const resize = () => {
      setCompact(query.matches);
      setCompactPane(null);
    };
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  function changePreferences(patch: Partial<StudioPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writePreference('studio-preferences', JSON.stringify(next));
      return next;
    });
  }
  const [notice, setNotice] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zoom, setZoom] = useState(0.22);
  const guidesEnabled = preferences.guides;
  const [view, setView] = useState<ViewMode>('editor');
  const [exportOpen, setExportOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const [duoMigrationNotice, setDuoMigrationNotice] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);
  useDesktopAutomation(workspace, () => {
    setLibraryOpen(false);
    setView('editor');
  });
  useEffect(() => {
    if (desktop?.platform === 'darwin') document.documentElement.classList.add('desktop-mac');
    const navigate = (destination: string) => {
      if (destination === 'home') setLibraryOpen(true);
      if (destination === 'settings') setSettingsOpen(true);
      if (window.innerWidth <= 720 && ['toggle-left', 'toggle-right', 'focus'].includes(destination)) {
        setCompactPane((current) =>
          destination === 'focus'
            ? null
            : destination === 'toggle-left'
              ? current === 'left'
                ? null
                : 'left'
              : current === 'right'
                ? null
                : 'right',
        );
        return;
      }
      if (destination === 'toggle-left')
        setPreferences((p) => {
          const next = { ...p, layers: !p.layers };
          writePreference('studio-preferences', JSON.stringify(next));
          return next;
        });
      if (destination === 'toggle-right')
        setPreferences((p) => {
          const next = { ...p, inspector: !p.inspector };
          writePreference('studio-preferences', JSON.stringify(next));
          return next;
        });
      if (destination === 'focus')
        setPreferences((p) => {
          const next = { ...p, layers: !(p.layers || p.inspector), inspector: !(p.layers || p.inspector) };
          writePreference('studio-preferences', JSON.stringify(next));
          return next;
        });
    };
    const off = desktop?.onNavigate(navigate);
    const keys = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || document.querySelector('dialog[open]')) return;
      if (event.key === ',') {
        event.preventDefault();
        navigate('settings');
      }
      if (event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        navigate('home');
      }
      if (!desktop && ['1', '2', '\\'].includes(event.key)) {
        event.preventDefault();
        navigate(event.key === '1' ? 'toggle-left' : event.key === '2' ? 'toggle-right' : 'focus');
      }
    };
    window.addEventListener('keydown', keys);
    return () => {
      off?.();
      window.removeEventListener('keydown', keys);
    };
  }, []);

  useEffect(() => {
    const current = workspace.entries.find((e) => e.id === workspace.activeId)?.project;
    if (!current) return;
    setDocumentId(current.documents[0]?.id ?? '');
    setLocale(current.defaultLocale);
    setSelectedId(null);
    setActivePage(0);
    setDuoMigrationNotice(false);
    // Reset editing selection only when the project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.activeId]);

  const currentDocument = useMemo(
    () => project?.documents.find((document) => document.id === documentId) ?? project?.documents[0],
    [project, documentId],
  );

  useEffect(() => {
    setActivePage((page) => Math.min(page, (currentDocument?.pageCount ?? 1) - 1));
  }, [currentDocument?.pageCount]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.project-menu-wrap')) setProjectMenuOpen(false);
      if (!target.closest('.device-tool-wrap')) setDeviceMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectMenuOpen(false);
        setDeviceMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', closeMenus);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', closeMenus);
      window.removeEventListener('keydown', escape);
    };
  }, []);

  const selectedLayer = useMemo(
    () => currentDocument?.layers.find((layer) => layer.id === selectedId) ?? null,
    [currentDocument, selectedId],
  );
  const visibleSelectedLayer = selectedLayer ? effectiveLayer(selectedLayer, locale) : null;

  const updateProject = useCallback(
    (updater: (current: ScreenshotProject) => ScreenshotProject) => {
      setProject(updater);
    },
    [setProject],
  );

  const updateDocument = useCallback(
    (updater: (document: LayoutDocument) => LayoutDocument) => {
      if (!currentDocument) return;
      updateProject((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === currentDocument.id ? updater(document) : document,
        ),
      }));
    },
    [currentDocument, updateProject],
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<EditorLayer>) => {
      updateDocument((document) => ({
        ...document,
        layers: document.layers.map((layer) => {
          if (layer.id !== id) return layer;
          if (layer.type === 'text' && Object.keys(layer.localeOverrides).includes(locale)) {
            return updateTextLayerForLocale(layer, locale, true, patch as Partial<TextLayer>);
          }
          return { ...layer, ...patch } as EditorLayer;
        }),
      }));
    },
    [locale, updateDocument],
  );

  const removeLayer = useCallback(
    (id: string) => {
      updateDocument((document) => ({
        ...document,
        layers: document.layers.filter((layer) => layer.id !== id),
      }));
      setSelectedId((selected) => (selected === id ? null : selected));
    },
    [updateDocument],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const source = currentDocument?.layers.find((layer) => layer.id === id);
      if (!source || !currentDocument) return;
      const clone = structuredClone(source);
      clone.id = createId(source.type);
      clone.name = `${source.name} ${t('copySuffix')}`;
      clone.x += Math.round(currentDocument.width * 0.025);
      clone.y += Math.round(currentDocument.height * 0.018);
      setSelectedId(clone.id);
      updateDocument((document) => ({ ...document, layers: [...document.layers, clone] }));
    },
    [currentDocument, updateDocument, t],
  );

  const reorderLayer = useCallback(
    (id: string, direction: -1 | 1) => {
      updateDocument((document) => {
        const index = document.layers.findIndex((layer) => layer.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= document.layers.length) return document;
        const layers = [...document.layers];
        [layers[index], layers[target]] = [layers[target], layers[index]];
        return { ...document, layers };
      });
    },
    [updateDocument],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (window.document.querySelector('[role="dialog"], dialog') || libraryOpen) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (!selectedId || !selectedLayer || selectedLayer.locked) return;
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        removeLayer(selectedId);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateLayer(selectedId);
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
      const delta = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') updateLayer(selectedId, { x: visibleSelectedLayer!.x - delta });
      if (event.key === 'ArrowRight') updateLayer(selectedId, { x: visibleSelectedLayer!.x + delta });
      if (event.key === 'ArrowUp') updateLayer(selectedId, { y: visibleSelectedLayer!.y - delta });
      if (event.key === 'ArrowDown') updateLayer(selectedId, { y: visibleSelectedLayer!.y + delta });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    duplicateLayer,
    removeLayer,
    selectedId,
    selectedLayer,
    updateLayer,
    visibleSelectedLayer,
    libraryOpen,
    undo,
    redo,
  ]);

  if (!project || !currentDocument) {
    return (
      <div className="loading-screen">
        <span className="loading-mark">VS</span>
        <p>{t('Studio hazırlanıyor…')}</p>
      </div>
    );
  }

  function addLayer(layer: EditorLayer, copy?: Record<string, string>) {
    updateProject((current) => ({
      ...current,
      copy: layer.type === 'text' && copy ? { ...current.copy, [layer.translationKey]: copy } : current.copy,
      documents: current.documents.map((document) =>
        document.id === currentDocument!.id ? { ...document, layers: [...document.layers, layer] } : document,
      ),
    }));
    setSelectedId(layer.id);
    setView('editor');
  }

  function addText() {
    let index = Object.keys(project!.copy).length + 1;
    let key = `text_${index}`;
    while (project!.copy[key]) key = `text_${++index}`;
    const width = currentDocument!.width * 0.68;
    const pageX = activePage * currentDocument!.width;
    addLayer(
      {
        id: createId('text'),
        type: 'text',
        name: t('Text'),
        translationKey: key,
        x: pageX + currentDocument!.width * 0.16,
        y: currentDocument!.height * 0.12,
        width,
        height: currentDocument!.height * 0.18,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: Math.round(currentDocument!.width * 0.065),
        fontWeight: 700,
        color: '#172033',
        align: 'center',
        lineHeight: 1.05,
        letterSpacing: -1,
        autoFit: true,
        minFontSize: 24,
        localeOverrides: {},
      },
      { [project!.defaultLocale]: t('Yeni metin') },
    );
  }

  async function addImageFiles(files: File[], point?: { x: number; y: number; page: number }) {
    const document = currentDocument!;
    const images = await Promise.all(
      files.map(async (file, index) => {
        const src = await readFileAsDataUrl(file);
        const image = new Image();
        image.src = src;
        await image.decode();
        const factor = Math.min(
          (document.width * 0.68) / image.naturalWidth,
          (document.height * 0.65) / image.naturalHeight,
        );
        const width = image.naturalWidth * factor,
          height = image.naturalHeight * factor;
        const page = point?.page ?? activePage,
          pageX = page * document.width;
        return {
          id: createId('image'),
          type: 'image',
          name: file.name.replace(/\.[^.]+$/, ''),
          x: Math.max(
            pageX,
            Math.min(
              pageX + document.width - width,
              (point?.x ?? pageX + document.width / 2) - width / 2 + index * 24,
            ),
          ),
          y: Math.max(
            0,
            Math.min(document.height - height, (point?.y ?? document.height / 2) - height / 2 + index * 24),
          ),
          width,
          height,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          src,
          fit: 'contain',
          cornerRadius: 0,
          localeSources: {},
        } as ImageLayer;
      }),
    );
    updateDocument((current) => ({ ...current, layers: [...current.layers, ...images] }));
    setSelectedId(images.at(-1)?.id ?? null);
    setView('editor');
    setLibraryOpen(false);
  }

  async function dropFiles(files: File[], point?: { x: number; y: number; page: number; layerId?: string }) {
    if (!files.length) return;
    if (files[0].name.toLowerCase().endsWith('.json')) {
      try {
        await importProjectFile(files[0]);
      } catch {
        setNotice('invalidProject');
      }
      return;
    }
    try {
      const target = point?.layerId
        ? currentDocument!.layers.find((layer) => layer.id === point.layerId)
        : undefined;
      if (target && (target.type === 'device' || target.type === 'image')) {
        if (target.locked) {
          setNotice('Unlock the layer before replacing its image');
          return;
        }
        if (files.length !== 1) {
          setNotice('Drop one image here');
          return;
        }
        const src = await readFileAsDataUrl(files[0]);
        updateLayer(target.id, target.type === 'device' ? { screenSrc: src } : { src });
        setSelectedId(target.id);
      } else await addImageFiles(files, point);
    } catch {
      setNotice('imageFailed');
    }
  }

  function reorderScreenshot(from: number, to: number) {
    updateDocument((document) => moveScreenshot(document, from, to));
    setActivePage(to);
  }

  function addShape() {
    const pageX = activePage * currentDocument!.width;
    const layer: ShapeLayer = {
      id: createId('shape'),
      type: 'shape',
      name: t('Shape'),
      x: pageX + currentDocument!.width * 0.23,
      y: currentDocument!.height * 0.28,
      width: currentDocument!.width * 0.54,
      height: currentDocument!.height * 0.22,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      shape: 'rectangle',
      fill: '#ffffff',
      stroke: '#d3d8e3',
      strokeWidth: 0,
      cornerRadius: Math.round(currentDocument!.width * 0.035),
    };
    addLayer(layer);
  }

  function addDevice(deviceId = 'iphone-18-pro') {
    const device = getDevice(deviceId);
    const pageX = activePage * currentDocument!.width;
    const width =
      currentDocument!.width * (device.category === 'tablet' || device.id.includes('ipad') ? 0.72 : 0.6);
    const layer: DeviceLayer = {
      id: createId('device'),
      type: 'device',
      name: device.label,
      x: pageX + (currentDocument!.width - width) / 2,
      y: currentDocument!.height * 0.3,
      width,
      height: width * (device.frameHeight / device.frameWidth),
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      deviceId: device.id,
      colorId: device.colors[0].id,
      screenSrc: '',
      screenFit: 'cover',
      localeScreens: {},
      screenScale: 1,
      screenOffsetX: 0,
      screenOffsetY: 0,
      sceneVersion: 2,
      foldAngle: DEFAULT_FOLD_ANGLE,
      foldDirection: 'toward',
    };
    addLayer(layer);
  }

  function exportProjectJson() {
    downloadBlob(
      new Blob([JSON.stringify(project!, null, 2)], { type: 'application/json' }),
      `${project!.name}.vibescreens.json`,
    );
    setProjectMenuOpen(false);
  }

  async function importProjectFile(file: File) {
    const parsed = parseProject(JSON.parse(await readFileAsText(file)));
    const duoWasMigrated = needsDuoOutputMigration(parsed);
    const next = migrateProject(parsed);
    workspace.add(next);
    setDuoMigrationNotice(duoWasMigrated);
    setProjectMenuOpen(false);
    setLibraryOpen(false);
  }

  const preset = getPreset(currentDocument.presetId);
  const exactSize = validateOutputSize(
    currentDocument.presetId,
    currentDocument.width,
    currentDocument.height,
  );
  const isDuoOutput = currentDocument.presetId === 'iphone-duo-portrait';

  return (
    <FileDrop
      onFiles={(files) => {
        void dropFiles(files);
      }}
      label={t('Drop project or images')}
    >
      <div className={`app-shell ${libraryOpen ? 'is-home' : ''}`}>
        <header className="topbar">
          <div className="brand-block">
            {!libraryOpen && view === 'editor' && (
              <button
                className="icon-button panel-toggle left-toggle"
                aria-label={t('Layers')}
                title={t('Layers') + ' · ⌘1'}
                aria-expanded={leftOpen}
                onClick={() => {
                  setLeftOpen(!leftOpen);
                  if (window.innerWidth <= 720) setRightOpen(false);
                }}
              >
                <PanelLeft size={16} />
              </button>
            )}

            <button
              className={`brand-mark ${!libraryOpen ? 'back-to-library' : ''}`}
              title={t('All projects') + ' · ⇧⌘H'}
              aria-label={t('Projects')}
              onClick={() => setLibraryOpen(true)}
            >
              {libraryOpen ? (
                <img src="./brand/icon.svg" alt="" />
              ) : (
                <>
                  <ChevronLeft size={17} />
                  <span>{t('All projects')}</span>
                </>
              )}
            </button>
            {libraryOpen ? (
              <div className="home-project-title">
                <strong>Vibe Screenshots</strong>
                <span>{t('Screenshot studio')}</span>
              </div>
            ) : (
              <div>
                <input
                  className="project-name"
                  style={{ width: `${Math.min(24, Math.max(7, project.name.length + 2))}ch` }}
                  value={project.name}
                  maxLength={200}
                  onChange={(event) => updateProject((current) => ({ ...current, name: event.target.value }))}
                  aria-label={t('Proje adı')}
                />
                <span className={`save-state ${saveState}`}>
                  <Save size={12} />{' '}
                  {!workspace.persisted
                    ? t('Session only')
                    : t(
                        saveState === 'saved'
                          ? t('Yerelde kayıtlı')
                          : saveState === 'saving'
                            ? t('Kaydediliyor')
                            : t('Kayıt hatası'),
                      )}
                </span>
              </div>
            )}
            {!libraryOpen && (
              <div className="project-menu-wrap">
                <button
                  className="icon-button project-options"
                  aria-label={t('Project')}
                  title={t('Project options')}
                  onClick={() => setProjectMenuOpen((open) => !open)}
                >
                  <MoreHorizontal size={17} />
                </button>
                {projectMenuOpen && (
                  <div className="project-menu">
                    <button onClick={exportProjectJson}>
                      <Download size={15} /> {t('Projeyi dışa aktar')}
                    </button>
                    <button onClick={() => projectImportRef.current?.click()}>
                      <Upload size={15} /> {t('Proje içe aktar')}
                    </button>
                    <button
                      onClick={() => {
                        setLibraryOpen(true);
                        setProjectMenuOpen(false);
                      }}
                    >
                      <FolderOpen size={15} />
                      {t('Projects')}
                    </button>
                    <button
                      onClick={() => {
                        if (workspace.persisted || saveState === 'saving') void workspace.flush();
                        else void workspace.persist(true);
                        setProjectMenuOpen(false);
                      }}
                    >
                      <Save size={15} />
                      {t('Save on this device')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!libraryOpen && (
            <nav className="view-tabs" aria-label={t('Görünüm')}>
              <button
                className={!libraryOpen && view === 'editor' ? 'active' : ''}
                onClick={() => {
                  setLibraryOpen(false);
                  setView('editor');
                }}
              >
                <PanelTop size={15} /> {t('Studio')}
              </button>
              <button
                className={!libraryOpen && view === 'localizations' ? 'active' : ''}
                onClick={() => {
                  setLibraryOpen(false);
                  setView('localizations');
                }}
              >
                <Languages size={15} /> {t('Localizations')}
              </button>
            </nav>
          )}

          <div className="topbar-actions">
            {!libraryOpen && (
              <>
                {' '}
                <button
                  className="icon-button"
                  aria-label={t('Undo')}
                  title={t('Undo') + ' · ⌘Z'}
                  disabled={!workspace.past.length || libraryOpen}
                  onClick={workspace.undo}
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t('Redo')}
                  title={t('Redo') + ' · ⇧⌘Z'}
                  disabled={!workspace.future.length || libraryOpen}
                  onClick={workspace.redo}
                >
                  <Redo2 size={16} />
                </button>
                <button className="button primary" onClick={() => setExportOpen(true)}>
                  <Download size={16} /> {t('Export')}
                </button>
              </>
            )}
            {!libraryOpen && <span className="toolbar-divider" />}
            <button
              className="icon-button settings-button"
              aria-label={t('Settings')}
              title={t('Settings') + ' · ⌘,'}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={17} />
            </button>
            {!libraryOpen && view === 'editor' && (
              <button
                className="icon-button panel-toggle right-toggle"
                aria-label={t('Artboard')}
                title={t('Artboard') + ' · ⌘2'}
                aria-expanded={rightOpen}
                onClick={() => {
                  setRightOpen(!rightOpen);
                  if (window.innerWidth <= 720) setLeftOpen(false);
                }}
              >
                <PanelRight size={16} />
              </button>
            )}
          </div>
        </header>

        {libraryOpen ? (
          <ProjectLibrary
            workspace={workspace}
            onOpen={() => setLibraryOpen(false)}
            onImport={() => projectImportRef.current?.click()}
          />
        ) : view === 'editor' ? (
          <main
            className={`editor-layout ${leftOpen ? 'left-open' : 'left-closed'} ${rightOpen ? 'right-open' : 'right-closed'}`}
          >
            <aside className="left-panel">
              <section className="panel-section output-section">
                <div className="section-heading">
                  <span>{t('Output')}</span>
                  <span title={t(preset.notes)} className={`status-dot ${exactSize ? 'good' : 'bad'}`} />
                </div>
                <select
                  aria-label={t('Output')}
                  value={currentDocument.id}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith('new:')) {
                      const document = { ...createOutputDocument(value.slice(4), false), enabled: true };
                      updateProject((current) => ({
                        ...current,
                        documents: [...current.documents, document],
                      }));
                      setDocumentId(document.id);
                    } else setDocumentId(value);
                    setSelectedId(null);
                    setActivePage(0);
                  }}
                >
                  {project.documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {t(document.name)}
                    </option>
                  ))}
                  <optgroup label={t('Add Google Play canvas')}>
                    {OUTPUT_PRESETS.filter(
                      (preset) =>
                        preset.store === 'google-play' &&
                        !project.documents.some((document) => document.presetId === preset.id),
                    ).map((preset) => (
                      <option key={preset.id} value={`new:${preset.id}`}>
                        {t(preset.label)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className="dimension-row">
                  <span>
                    {currentDocument.width} × {currentDocument.height}
                  </span>
                  <span>
                    {preset.kind === 'creative'
                      ? t('Creative asset')
                      : `${currentDocument.pageCount} ${t('screenshots')}`}
                  </span>
                </div>

                {isDuoOutput && (
                  <div className="duo-output-contract">
                    <div>
                      <span>{t('OUTPUT')}</span>
                      <strong>1398 × 2034</strong>
                    </div>
                    <p>
                      {t(
                        'Inner, outer ve folded yalnızca cihaz mock’udur. Cihaz seçimi bu çıktı ölçüsünü değiştirmez.',
                      )}
                    </p>
                  </div>
                )}
                {isDuoOutput && duoMigrationNotice && (
                  <div className="migration-note">
                    <span>{t('Inner çalışman bu yüzeye oranı korunarak taşındı.')}</span>
                    <button
                      type="button"
                      aria-label={t('Geçiş bilgisini kapat')}
                      onClick={() => setDuoMigrationNotice(false)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </section>

              <section className="panel-section tools-section">
                <div className="section-heading">
                  <span>{t('Add')}</span>
                </div>
                <div className="tool-grid">
                  <button
                    onClick={() => {
                      setDeviceMenuOpen(false);
                      addText();
                    }}
                  >
                    <Type size={18} />
                    <span>{t('Text')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setDeviceMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                  >
                    <ImagePlus size={18} />
                    <span>{t('Image')}</span>
                  </button>
                  <div className="device-tool-wrap">
                    <button
                      className={deviceMenuOpen ? 'active' : ''}
                      aria-expanded={deviceMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setDeviceMenuOpen((open) => !open)}
                    >
                      <Smartphone size={18} />
                      <span>{t('Device')}</span>
                      <ChevronDown className="tool-chevron" size={11} />
                    </button>
                    {deviceMenuOpen && (
                      <div className="device-add-menu" role="menu" aria-label={t('Cihaz ekle')}>
                        <div className="device-add-menu-title">{t('Choose device')}</div>
                        {DEVICES.map((device) => (
                          <button
                            key={device.id}
                            role="menuitem"
                            onClick={() => {
                              addDevice(device.id);
                              setDeviceMenuOpen(false);
                            }}
                          >
                            {device.category === 'tablet' ? <Tablet size={15} /> : <Smartphone size={15} />}
                            <span>
                              <strong>{t(device.label)}</strong>
                              <small>
                                {foldOrientationForMode(device.renderMode)
                                  ? t('Adjustable fold scene')
                                  : device.platform === 'android'
                                    ? t('Android device frame')
                                    : device.officialApple
                                      ? t('Apple bezel')
                                      : t('Device frame')}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setDeviceMenuOpen(false);
                      addShape();
                    }}
                  >
                    <Shapes size={18} />
                    <span>{t('Shape')}</span>
                  </button>
                </div>
                <input
                  ref={imageInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addImageFiles([file]).catch(() => setNotice('imageFailed'));
                    event.target.value = '';
                  }}
                />
              </section>

              <LayerPanel
                document={currentDocument}
                locale={locale}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={updateLayer}
                onPage={(page) => {
                  setActivePage(page);
                  setSelectedId(null);
                }}
              />
            </aside>

            <section className="workspace">
              <div className="workspace-toolbar">
                <div className="locale-picker">
                  <Languages size={15} />
                  <span className="preview-language-label">{t('Preview language')}</span>
                  <select
                    aria-label={t('Preview language')}
                    value={locale}
                    onChange={(event) => {
                      setLocale(event.target.value);
                      setSelectedId(null);
                    }}
                  >
                    {project.locales.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} · {item.code}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className={`guides-toggle ${guidesEnabled ? 'active' : ''}`}
                  aria-pressed={guidesEnabled}
                  title={t('Hold Alt to bypass snapping')}
                  onClick={() => changePreferences({ guides: !guidesEnabled })}
                >
                  {t('Smart guides')}
                </button>
                <div className="zoom-control">
                  <button
                    className="fit-canvas plain-icon"
                    aria-label={t('Fit canvas')}
                    title={t('Fit canvas')}
                    onClick={() => {
                      const shell = window.document.querySelector('.canvas-scroll');
                      if (shell)
                        setZoom(
                          Math.max(
                            0.08,
                            Math.min(
                              0.5,
                              (shell.clientWidth - 80) / (currentDocument.width * currentDocument.pageCount),
                              (shell.clientHeight - 112) / currentDocument.height,
                            ),
                          ),
                        );
                    }}
                  >
                    <Maximize2 size={14} />
                  </button>
                  <input
                    type="range"
                    min="0.08"
                    max="0.5"
                    step="0.01"
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
              </div>

              <Suspense fallback={<div className="canvas-loading">{t('Studio hazırlanıyor…')}</div>}>
                <CanvasEditor
                  project={project}
                  document={currentDocument}
                  locale={locale}
                  zoom={zoom}
                  selectedId={selectedId}
                  activePage={Math.min(activePage, currentDocument.pageCount - 1)}
                  onSelect={setSelectedId}
                  onActivePage={setActivePage}
                  onLayerChange={updateLayer}
                  guidesEnabled={guidesEnabled}
                  snapDistance={preferences.snapDistance}
                  crossCanvas={preferences.crossCanvas}
                  onFilesDrop={(files, point) => {
                    void dropFiles(files, point);
                  }}
                />
              </Suspense>
              <ScreenshotNavigator
                count={currentDocument.pageCount}
                active={activePage}
                onSelect={(page) => {
                  setActivePage(page);
                  setSelectedId(null);
                }}
                onMove={reorderScreenshot}
              />
            </section>

            <aside className="right-panel">
              {visibleSelectedLayer ? (
                <Inspector
                  project={project}
                  document={currentDocument}
                  locale={locale}
                  layer={visibleSelectedLayer}
                  sourceLayer={selectedLayer!}
                  onChange={(patch) => updateLayer(selectedLayer!.id, patch)}
                  onProjectChange={updateProject}
                  onDuplicate={() => duplicateLayer(selectedLayer!.id)}
                  onDelete={() => removeLayer(selectedLayer!.id)}
                  onMove={(direction) => reorderLayer(selectedLayer!.id, direction)}
                />
              ) : (
                <DocumentInspector
                  document={currentDocument}
                  activePage={Math.min(activePage, currentDocument.pageCount - 1)}
                  onChange={updateDocument}
                />
              )}
            </aside>
          </main>
        ) : (
          <LocalizationTable project={project} onChange={setProject} />
        )}

        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            preferences={{ ...preferences, layers: leftOpen, inspector: rightOpen }}
            onPreferences={(patch) => {
              if (patch.layers !== undefined) setLeftOpen(patch.layers);
              if (patch.inspector !== undefined) setRightOpen(patch.inspector);
              const rest = { ...patch };
              delete rest.layers;
              delete rest.inspector;
              if (Object.keys(rest).length) changePreferences(rest);
            }}
          />
        )}
        {(notice || workspace.error) && (
          <div className="toast" role="alert">
            <span>{t(notice || workspace.error)}</span>
            {workspace.error === 'saveFailed' && (
              <button
                onClick={() => {
                  if (workspace.persisted) void workspace.flush();
                  else void workspace.persist(true);
                }}
              >
                {t('Retry save')}
              </button>
            )}
            <button
              className="plain-icon"
              aria-label={t('Kapat')}
              onClick={() => {
                setNotice('');
                workspace.clearError();
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {exportOpen && (
          <ExportDialog
            project={project}
            currentDocument={currentDocument}
            currentLocale={locale}
            activePage={Math.min(activePage, currentDocument.pageCount - 1)}
            onClose={() => setExportOpen(false)}
          />
        )}

        <input
          ref={projectImportRef}
          className="sr-only"
          type="file"
          accept="application/json,.json,.vibescreens"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importProjectFile(file).catch(() => setNotice('invalidProject'));
            event.target.value = '';
          }}
        />
      </div>
    </FileDrop>
  );
}

function DocumentInspector({
  document,
  activePage,
  onChange,
}: {
  document: LayoutDocument;
  activePage: number;
  onChange: (updater: (document: LayoutDocument) => LayoutDocument) => void;
}) {
  const { t } = useI18n();
  const preset = getPreset(document.presetId);
  const globalBackgroundInput = useRef<HTMLInputElement>(null);
  const pageBackgroundInput = useRef<HTMLInputElement>(null);
  const activePageImage = document.background.pageImages?.[String(activePage)] ?? '';

  async function applyBackgroundImage(file: File, pageOnly: boolean) {
    const src = await readFileAsDataUrl(file);
    onChange((current) => ({
      ...current,
      background: pageOnly
        ? {
            ...current.background,
            type: 'image',
            pageImages: { ...current.background.pageImages, [String(activePage)]: src },
          }
        : { ...current.background, type: 'image', imageSrc: src },
    }));
  }

  function clearActivePageImage() {
    onChange((current) => {
      const pageImages = { ...current.background.pageImages };
      delete pageImages[String(activePage)];
      return { ...current, background: { ...current.background, pageImages } };
    });
  }

  return (
    <div className="inspector">
      <div className="inspector-title">
        <Palette size={16} />
        <span>{t('Artboard')}</span>
      </div>
      <div className="rule-card">
        <div>
          <strong>
            {document.width} × {document.height}
          </strong>
          <span>{t('Exact PNG output')}</span>
        </div>
        <span className="rule-badge">
          {t(preset.store === 'google-play' ? 'Google Play preset' : 'Apple preset')}
        </span>
      </div>
      {document.kind === 'screenshots' && (
        <Field
          label={t('Screenshot count')}
          hint={t(
            preset.store === 'google-play'
              ? 'Use 1–8 screenshots for each Google Play device type.'
              : 'Apple her cihaz boyutu için 1–10 screenshot kabul eder.',
          )}
        >
          <input
            type="number"
            min={1}
            max={preset.maxPages}
            value={document.pageCount}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                pageCount: Math.max(
                  1,
                  Math.min(preset.maxPages, Math.round(numberValue(event.target.value, current.pageCount))),
                ),
              }))
            }
          />
        </Field>
      )}
      <Field label={t('Background')}>
        <select
          value={document.background.type}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              background: { ...current.background, type: event.target.value as 'solid' | 'linear' | 'image' },
            }))
          }
        >
          <option value="solid">{t('Solid')}</option>
          <option value="linear">{t('Linear gradient')}</option>
          <option value="image">{t('Image')}</option>
        </select>
      </Field>
      {document.background.type !== 'image' && (
        <div className="two-fields">
          <Field label={t('Color A')}>
            <input
              type="color"
              value={document.background.color}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  background: { ...current.background, color: event.target.value },
                }))
              }
            />
          </Field>
          {document.background.type === 'linear' && (
            <Field label={t('Color B')}>
              <input
                type="color"
                value={document.background.color2}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    background: { ...current.background, color2: event.target.value },
                  }))
                }
              />
            </Field>
          )}
        </div>
      )}
      {document.background.type === 'linear' && (
        <NumericField
          label={t('Gradient angle')}
          value={document.background.angle}
          onChange={(value) =>
            onChange((current) => ({ ...current, background: { ...current.background, angle: value } }))
          }
        />
      )}
      {document.background.type === 'image' && (
        <div className="background-image-controls">
          <Field label={t('Fit')}>
            <select
              value={document.background.imageFit ?? 'cover'}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  background: {
                    ...current.background,
                    imageFit: event.target.value as 'cover' | 'contain' | 'fill',
                  },
                }))
              }
            >
              <option value="cover">{t('Cover')}</option>
              <option value="contain">{t('Contain')}</option>
              <option value="fill">{t('Fill exact ratio')}</option>
            </select>
          </Field>
          <NumericField
            label={t('Image opacity')}
            value={document.background.imageOpacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) =>
              onChange((current) => ({
                ...current,
                background: { ...current.background, imageOpacity: Math.max(0, Math.min(1, value)) },
              }))
            }
          />
          <Field label={t('Fallback color')}>
            <input
              type="color"
              value={document.background.color}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  background: { ...current.background, color: event.target.value },
                }))
              }
            />
          </Field>
          <div className="background-upload-stack">
            <FileDrop
              label={t('Drop background for all panels')}
              onFiles={(files) => {
                if (files[0])
                  void applyBackgroundImage(files[0], false).catch(() => window.alert(t('imageFailed')));
              }}
            >
              <button className="button secondary" onClick={() => globalBackgroundInput.current?.click()}>
                <Upload size={15} /> {t('Tüm paneller için yükle')}
              </button>
            </FileDrop>
            <FileDrop
              label={t('Drop background for this panel')}
              onFiles={(files) => {
                if (files[0])
                  void applyBackgroundImage(files[0], true).catch(() => window.alert(t('imageFailed')));
              }}
            >
              <button className="button secondary" onClick={() => pageBackgroundInput.current?.click()}>
                <PanelTop size={15} /> {t('Yalnızca panel')} {activePage + 1}
              </button>
            </FileDrop>
            {activePageImage && (
              <button className="button ghost background-clear" onClick={clearActivePageImage}>
                <Trash2 size={14} /> {t('Panel görselini kaldır')}
              </button>
            )}
          </div>
          <input
            ref={globalBackgroundInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void applyBackgroundImage(file, false).catch(() => window.alert(t('imageFailed')));
              event.target.value = '';
            }}
          />
          <input
            ref={pageBackgroundInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void applyBackgroundImage(file, true).catch(() => window.alert(t('imageFailed')));
              event.target.value = '';
            }}
          />
          <div className="image-dimension-note">
            <strong>
              {document.width} × {document.height}
            </strong>
            <span>{t('En net sonuç için görseli bu oranda hazırla.')}</span>
          </div>
        </div>
      )}
      <div className="field">
        <span className="field-label">{t('Include in bulk export')}</span>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={document.enabled}
            onChange={(event) => onChange((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span>{t('Enabled')}</span>
        </label>
      </div>
      <div className="info-card">
        <strong>{t(preset.group)}</strong>
        <p>{t(preset.notes)}</p>
        <p>{t('PNG export opaktır; alpha channel üretilmez.')}</p>
      </div>
    </div>
  );
}

type InspectorProps = {
  project: ScreenshotProject;
  document: LayoutDocument;
  locale: string;
  layer: EditorLayer;
  sourceLayer: EditorLayer;
  onChange: (patch: Partial<EditorLayer>) => void;
  onProjectChange: (updater: (current: ScreenshotProject) => ScreenshotProject) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

function Inspector({
  project,
  document,
  locale,
  layer,
  sourceLayer,
  onChange,
  onProjectChange,
  onDuplicate,
  onDelete,
  onMove,
}: InspectorProps) {
  const { t } = useI18n();
  const [cropOpen, setCropOpen] = useState(false);
  const localeImageInput = useRef<HTMLInputElement>(null);
  const baseImageInput = useRef<HTMLInputElement>(null);
  const hasTextOverride = sourceLayer.type === 'text' && Boolean(sourceLayer.localeOverrides[locale]);
  const device = sourceLayer.type === 'device' ? getDevice(sourceLayer.deviceId) : null;
  const foldOrientation = foldOrientationForMode(device?.renderMode);
  const crossesSeam = isLayerAcrossSeam(layer, document.width);

  function setFoldAngle(value: number) {
    if (sourceLayer.type !== 'device' || !foldOrientation) return;
    const angle = Math.max(35, Math.min(175, value));
    const size = getHalfFoldedCanvasSize(foldOrientation, angle);
    onChange({
      foldAngle: angle,
      sceneVersion: 2,
      height:
        (layer.width / (sourceLayer.crop?.width ?? 1)) *
        (size.height / size.width) *
        (sourceLayer.crop?.height ?? 1),
    } as Partial<DeviceLayer>);
  }

  async function applyImage(file: File, localized: boolean) {
    const src = await readFileAsDataUrl(file);
    if (sourceLayer.type === 'image') {
      if (localized)
        onChange({ localeSources: { ...sourceLayer.localeSources, [locale]: src } } as Partial<ImageLayer>);
      else onChange({ src } as Partial<ImageLayer>);
    }
    if (sourceLayer.type === 'device') {
      if (localized)
        onChange({ localeScreens: { ...sourceLayer.localeScreens, [locale]: src } } as Partial<DeviceLayer>);
      else onChange({ screenSrc: src } as Partial<DeviceLayer>);
    }
  }

  function setCopy(value: string) {
    if (sourceLayer.type !== 'text') return;
    onProjectChange((current) => ({
      ...current,
      copy: {
        ...current.copy,
        [sourceLayer.translationKey]: { ...current.copy[sourceLayer.translationKey], [locale]: value },
      },
    }));
  }

  function toggleTextOverride(enabled: boolean) {
    if (sourceLayer.type !== 'text' || layer.type !== 'text') return;
    const localeOverrides = { ...sourceLayer.localeOverrides };
    if (enabled) {
      localeOverrides[locale] = {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        fontSize: layer.fontSize,
        lineHeight: layer.lineHeight,
        letterSpacing: layer.letterSpacing,
      };
    } else {
      delete localeOverrides[locale];
    }
    onChange({ localeOverrides } as Partial<TextLayer>);
  }

  return (
    <div className="inspector">
      <div className="inspector-title">
        {layer.type === 'text' ? (
          <Type size={16} />
        ) : layer.type === 'device' ? (
          <Smartphone size={16} />
        ) : layer.type === 'image' ? (
          <ImagePlus size={16} />
        ) : (
          <Shapes size={16} />
        )}
        <input value={sourceLayer.name} onChange={(event) => onChange({ name: event.target.value })} />
      </div>
      <div className="object-actions">
        <button title={t('Aşağı taşı')} onClick={() => onMove(-1)}>
          <ChevronDown size={15} />
        </button>
        <button title={t('Yukarı taşı')} onClick={() => onMove(1)}>
          <ChevronUp size={15} />
        </button>
        <button title={t('Çoğalt')} onClick={onDuplicate}>
          <Copy size={15} />
        </button>
        <button className="danger" title={t('Sil')} onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      {sourceLayer.type === 'device' && (
        <div className="device-composition-controls">
          {!foldOrientation && (
            <Field label={t('Device orientation')}>
              <select
                aria-label={t('Device orientation')}
                value={sourceLayer.orientation ?? 'portrait'}
                onChange={(event) =>
                  onChange(orientDevice(sourceLayer, event.target.value as 'portrait' | 'landscape'))
                }
              >
                <option value="portrait">{t('Portrait')}</option>
                <option value="landscape">{t('Landscape')}</option>
              </select>
            </Field>
          )}
          <div className="crop-actions">
            <button className="button secondary" onClick={() => setCropOpen(true)}>
              {t('Crop device')}
            </button>
            {sourceLayer.crop && (
              <button className="button ghost" onClick={() => onChange(resetDeviceCrop(sourceLayer))}>
                {t('Reset crop')}
              </button>
            )}
          </div>
          {cropOpen && (
            <DeviceCropDialog
              project={project}
              layer={sourceLayer}
              locale={locale}
              onClose={() => setCropOpen(false)}
              onApply={(region) => {
                onChange(cropDevice(sourceLayer, region));
                setCropOpen(false);
              }}
            />
          )}
        </div>
      )}
      <div className="inspector-group">
        <h3>{t('Geometry')}</h3>
        <div className="two-fields">
          <NumericField label="X" value={layer.x} onChange={(value) => onChange({ x: value })} />
          <NumericField label="Y" value={layer.y} onChange={(value) => onChange({ y: value })} />
        </div>
        <div className="two-fields">
          <NumericField
            label={t('Width')}
            value={layer.width}
            min={1}
            onChange={(value) => onChange({ width: Math.max(1, value) })}
          />
          <NumericField
            label={t('Height')}
            value={layer.height}
            min={1}
            onChange={(value) => onChange({ height: Math.max(1, value) })}
          />
        </div>
        <div className="two-fields">
          <NumericField
            label={t('Rotation')}
            value={layer.rotation}
            onChange={(value) => onChange({ rotation: value })}
          />
          <NumericField
            label={t('Opacity')}
            value={layer.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onChange({ opacity: Math.max(0, Math.min(1, value)) })}
          />
        </div>
        {sourceLayer.clipPage !== undefined && (
          <label className="switch-row">
            <input type="checkbox" checked onChange={() => onChange({ clipPage: undefined })} />
            <span>{t('Clip to this screenshot')}</span>
          </label>
        )}
        {crossesSeam && sourceLayer.clipPage === undefined && (
          <div className="seam-note">
            <Maximize2 size={14} />{' '}
            {t('Bu katman komşu screenshot’a taşıyor; export sırasında panellere ayrı kırpılacak.')}
          </div>
        )}
      </div>

      {sourceLayer.type === 'text' && layer.type === 'text' && (
        <div className="inspector-group">
          <h3>
            {t('Text ·')} {locale}
          </h3>
          <Field label={t('Translation key')}>
            <input
              value={sourceLayer.translationKey}
              onChange={(event) => onChange({ translationKey: event.target.value })}
            />
          </Field>
          <Field label={t('Copy')}>
            <textarea
              rows={4}
              value={project.copy[sourceLayer.translationKey]?.[locale] ?? ''}
              placeholder={project.copy[sourceLayer.translationKey]?.[project.defaultLocale] ?? ''}
              onChange={(event) => setCopy(event.target.value)}
            />
          </Field>
          <label className="switch-row locale-override">
            <input
              type="checkbox"
              checked={hasTextOverride}
              onChange={(event) => toggleTextOverride(event.target.checked)}
            />
            <span>{t('Bu dile özel boyut ve konum')}</span>
          </label>
          <Field label={t('Font family')}>
            <select
              value={layer.fontFamily}
              onChange={(event) => onChange({ fontFamily: event.target.value })}
            >
              <option value={'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}>
                {t('System Sans')}
              </option>
              <option value={'"Avenir Next", Avenir, sans-serif'}>Avenir Next</option>
              <option value={'Arial, Helvetica, sans-serif'}>Arial</option>
              <option value={'Georgia, serif'}>Georgia</option>
              <option value={'"Times New Roman", serif'}>Times New Roman</option>
            </select>
          </Field>
          <div className="two-fields">
            <NumericField
              label={t('Font size')}
              value={layer.fontSize}
              min={8}
              onChange={(value) => onChange({ fontSize: value })}
            />
            <NumericField
              label={t('Weight')}
              value={layer.fontWeight}
              min={100}
              max={900}
              step={100}
              onChange={(value) => onChange({ fontWeight: value })}
            />
          </div>
          <div className="two-fields">
            <NumericField
              label={t('Line height')}
              value={layer.lineHeight}
              min={0.7}
              max={3}
              step={0.05}
              onChange={(value) => onChange({ lineHeight: value })}
            />
            <NumericField
              label={t('Tracking')}
              value={layer.letterSpacing}
              step={0.5}
              onChange={(value) => onChange({ letterSpacing: value })}
            />
          </div>
          <Field label={t('Color')}>
            <input
              type="color"
              value={layer.color}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </Field>
          <div className="segmented">
            <button
              aria-label={t('Align left')}
              className={layer.align === 'left' ? 'active' : ''}
              onClick={() => onChange({ align: 'left' })}
            >
              <AlignLeft size={15} />
            </button>
            <button
              aria-label={t('Align center')}
              className={layer.align === 'center' ? 'active' : ''}
              onClick={() => onChange({ align: 'center' })}
            >
              <AlignCenter size={15} />
            </button>
            <button
              aria-label={t('Align right')}
              className={layer.align === 'right' ? 'active' : ''}
              onClick={() => onChange({ align: 'right' })}
            >
              <AlignRight size={15} />
            </button>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={layer.autoFit}
              onChange={(event) => onChange({ autoFit: event.target.checked })}
            />
            <span>{t('Metni alana otomatik sığdır')}</span>
          </label>
          {layer.autoFit && (
            <NumericField
              label={t('Minimum font size')}
              value={layer.minFontSize}
              min={8}
              onChange={(value) => onChange({ minFontSize: value })}
            />
          )}
        </div>
      )}

      {(sourceLayer.type === 'image' || sourceLayer.type === 'device') && (
        <div className="inspector-group">
          <h3>{sourceLayer.type === 'device' ? t('Screen') : t('Image')}</h3>
          {sourceLayer.type === 'device' && (
            <>
              <Field label={t('Device')}>
                <select
                  value={sourceLayer.deviceId}
                  onChange={(event) => {
                    const next = getDevice(event.target.value);
                    const nextFoldOrientation = foldOrientationForMode(next.renderMode);
                    const foldAngle = nextFoldOrientation
                      ? (sourceLayer.foldAngle ?? DEFAULT_FOLD_ANGLE)
                      : undefined;
                    const size = nextFoldOrientation
                      ? getHalfFoldedCanvasSize(nextFoldOrientation, foldAngle)
                      : sourceLayer.orientation === 'landscape'
                        ? { width: next.frameHeight, height: next.frameWidth }
                        : { width: next.frameWidth, height: next.frameHeight };
                    onChange({
                      deviceId: next.id,
                      colorId: next.colors[0].id,
                      height:
                        (layer.width / (sourceLayer.crop?.width ?? 1)) *
                        (size.height / size.width) *
                        (sourceLayer.crop?.height ?? 1),
                      name: next.label,
                      foldAngle,
                      sceneVersion: 2,
                      foldDirection: nextFoldOrientation
                        ? (sourceLayer.foldDirection ?? 'toward')
                        : undefined,
                    } as Partial<DeviceLayer>);
                  }}
                >
                  {DEVICES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(item.label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('Finish')}>
                <select
                  value={sourceLayer.colorId}
                  onChange={(event) => onChange({ colorId: event.target.value } as Partial<DeviceLayer>)}
                >
                  {device?.colors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {t(color.label)}
                    </option>
                  ))}
                </select>
              </Field>
              {foldOrientation && (
                <div className="fold-controls">
                  <div className="fold-angle-heading">
                    <span>{t('Fold angle')}</span>
                    <strong>{Math.round(sourceLayer.foldAngle ?? DEFAULT_FOLD_ANGLE)}°</strong>
                  </div>
                  <input
                    aria-label={t('Fold angle')}
                    type="range"
                    min={35}
                    max={175}
                    step={1}
                    value={sourceLayer.foldAngle ?? DEFAULT_FOLD_ANGLE}
                    onChange={(event) => setFoldAngle(numberValue(event.target.value, DEFAULT_FOLD_ANGLE))}
                  />
                  <div className="fold-presets" aria-label={t('Fold angle presets')}>
                    {[45, 90, 135, 165].map((angle) => (
                      <button
                        key={angle}
                        className={
                          Math.round(sourceLayer.foldAngle ?? DEFAULT_FOLD_ANGLE) === angle ? 'active' : ''
                        }
                        onClick={() => setFoldAngle(angle)}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                  <Field label={foldOrientation === 'tent' ? t('Viewpoint') : t('Fold direction')}>
                    <select
                      value={sourceLayer.foldDirection ?? 'toward'}
                      onChange={(event) =>
                        onChange({
                          foldDirection: event.target.value as DeviceLayer['foldDirection'],
                        } as Partial<DeviceLayer>)
                      }
                    >
                      <option value="toward">
                        {foldOrientation === 'tent'
                          ? t('Front left · screen visible')
                          : t('Hinge toward viewer')}
                      </option>
                      <option value="away">
                        {foldOrientation === 'tent'
                          ? t('Front right · screen visible')
                          : t('Hinge away from viewer')}
                      </option>
                    </select>
                  </Field>
                  <div className="fold-pose-note">
                    <strong>
                      {foldOrientation === 'tent'
                        ? t('Tent stand · landscape cover display')
                        : foldOrientation === 'vertical'
                          ? t('Vertical book pose')
                          : t('Horizontal tabletop pose')}
                    </strong>
                    <span>
                      {foldOrientation === 'tent'
                        ? t(
                            'Çadır duruşu. Dış ekran için yatay görsel yükle. Açı, ayak açıklığını değiştirir.',
                          )
                        : t('35° daha kapalı, 175° neredeyse düz.')}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          <Field label={t('Fit')}>
            <select
              value={sourceLayer.type === 'image' ? sourceLayer.fit : sourceLayer.screenFit}
              onChange={(event) =>
                onChange(
                  sourceLayer.type === 'image'
                    ? { fit: event.target.value as ImageLayer['fit'] }
                    : { screenFit: event.target.value as DeviceLayer['screenFit'] },
                )
              }
            >
              <option value="cover">{t('Cover')}</option>
              <option value="contain">{t('Contain')}</option>
              <option value="fill">{t('Fill')}</option>
            </select>
          </Field>
          {sourceLayer.type === 'device' && (
            <div className="screen-placement-controls">
              <div className="screen-placement-heading">
                <strong>{t('Screen placement')}</strong>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ screenScale: 1, screenOffsetX: 0, screenOffsetY: 0 } as Partial<DeviceLayer>)
                  }
                >
                  {t('Reset')}
                </button>
              </div>
              <Field label={`${t('Screen zoom')} · ${Math.round((sourceLayer.screenScale ?? 1) * 100)}%`}>
                <input
                  aria-label={t('Screen zoom')}
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.01}
                  value={sourceLayer.screenScale ?? 1}
                  onChange={(event) =>
                    onChange({ screenScale: numberValue(event.target.value, 1) } as Partial<DeviceLayer>)
                  }
                />
              </Field>
              <div className="two-fields">
                <NumericField
                  label={t('Horizontal %')}
                  value={sourceLayer.screenOffsetX ?? 0}
                  min={-100}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    onChange({ screenOffsetX: Math.max(-100, Math.min(100, value)) } as Partial<DeviceLayer>)
                  }
                />
                <NumericField
                  label={t('Vertical %')}
                  value={sourceLayer.screenOffsetY ?? 0}
                  min={-100}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    onChange({ screenOffsetY: Math.max(-100, Math.min(100, value)) } as Partial<DeviceLayer>)
                  }
                />
              </div>
              <p>{t('Görseli çerçevenin içinde büyütüp odağını kaydır. Şeffaflık korunur.')}</p>
            </div>
          )}
          {sourceLayer.type === 'image' && (
            <NumericField
              label={t('Corner radius')}
              value={sourceLayer.cornerRadius}
              min={0}
              onChange={(value) => onChange({ cornerRadius: value } as Partial<ImageLayer>)}
            />
          )}
          <div className="upload-stack">
            <FileDrop
              label={t('Drop base image')}
              onFiles={(files) => {
                if (files[0]) void applyImage(files[0], false).catch(() => window.alert(t('imageFailed')));
              }}
            >
              <button className="button secondary" onClick={() => baseImageInput.current?.click()}>
                <Upload size={15} /> {t('Ana görseli yükle')}
              </button>
            </FileDrop>
            <FileDrop
              label={t('Drop localized image')}
              onFiles={(files) => {
                if (files[0]) void applyImage(files[0], true).catch(() => window.alert(t('imageFailed')));
              }}
            >
              <button className="button secondary" onClick={() => localeImageInput.current?.click()}>
                <Languages size={15} /> {locale} {t('için yükle')}
              </button>
            </FileDrop>
          </div>
          <input
            ref={baseImageInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void applyImage(file, false).catch(() => window.alert(t('imageFailed')));
              event.target.value = '';
            }}
          />
          <input
            ref={localeImageInput}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void applyImage(file, true).catch(() => window.alert(t('imageFailed')));
              event.target.value = '';
            }}
          />
          {sourceLayer.type === 'device' &&
            device?.officialApple &&
            (crossesSeam || Math.abs(layer.rotation) > 0.01) && (
              <div className="warning-card">
                <strong>{t('Apple bezel usage')}</strong>
                <p>
                  {t(
                    'Resmî Apple ürün bezelleri kırpılmamalı, döndürülmemeli veya kapatılmamalı. Bu kompozisyon teknik olarak export edilir ancak Apple’ın pazarlama kullanım kurallarını ayrıca kontrol et.',
                  )}
                </p>
              </div>
            )}
          {sourceLayer.type === 'device' && foldOrientation && (
            <div className="warning-card">
              <strong>{t('Scene mockup')}</strong>
              <p>
                {t('Bu sahne Apple’ın')} {foldOrientation === 'tent' ? t('açık dış') : t('açık iç')}{' '}
                {t(
                  'iPhone Duo bezel görselini taban alır; katlanma açısı editörde dinamik olarak türetilir ve Apple’ın yayımladığı resmî bir poz değildir. Pazarlama kurallarında bezel görsellerinin döndürülmesi veya değiştirilmesi kısıtlanabildiği için gönderimden önce kullanımı kontrol et.',
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {sourceLayer.type === 'shape' && layer.type === 'shape' && (
        <div className="inspector-group">
          <h3>{t('Shape')}</h3>
          <Field label={t('Type')}>
            <select
              value={layer.shape}
              onChange={(event) => onChange({ shape: event.target.value as ShapeLayer['shape'] })}
            >
              <option value="rectangle">{t('Rectangle')}</option>
              <option value="ellipse">{t('Ellipse')}</option>
            </select>
          </Field>
          <div className="two-fields">
            <Field label={t('Fill')}>
              <input
                type="color"
                value={layer.fill}
                onChange={(event) => onChange({ fill: event.target.value })}
              />
            </Field>
            <Field label={t('Stroke')}>
              <input
                type="color"
                value={layer.stroke}
                onChange={(event) => onChange({ stroke: event.target.value })}
              />
            </Field>
          </div>
          <div className="two-fields">
            <NumericField
              label={t('Stroke width')}
              value={layer.strokeWidth}
              min={0}
              onChange={(value) => onChange({ strokeWidth: value })}
            />
            <NumericField
              label={t('Radius')}
              value={layer.cornerRadius}
              min={0}
              onChange={(value) => onChange({ cornerRadius: value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExportDialog({
  project,
  currentDocument,
  currentLocale,
  activePage,
  onClose,
}: {
  project: ScreenshotProject;
  currentDocument: LayoutDocument;
  currentLocale: string;
  activePage: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [localeCodes, setLocaleCodes] = useState(() => [currentLocale]);
  const [documentIds, setDocumentIds] = useState(() => [currentDocument.id]);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  async function runSingleExport() {
    setError('');
    setProgress({ done: 0, total: 1, label: t('Rendering…') });
    try {
      await exportSinglePage(project, currentDocument, currentLocale, activePage);
    } catch {
      setError(t('exportFailed'));
    } finally {
      setProgress(null);
    }
  }

  async function runBulkExport() {
    setError('');
    abort.current = new AbortController();
    setProgress({ done: 0, total: 1, label: t('Rendering…') });
    try {
      await exportProjectZip(project, {
        localeCodes,
        documentIds,
        signal: abort.current.signal,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      setProgress(null);
      onClose();
    } catch {
      setProgress(null);
      if (!abort.current?.signal.aborted) setError(t('exportFailed'));
    }
  }

  return (
    <Dialog title={t('Exact export')} onClose={onClose} busy={Boolean(progress)} wide>
      <div className="export-dialog-body">
        <div className="export-summary">
          <div>
            <span>{t('Format')}</span>
            <strong>{t('PNG · opaque')}</strong>
          </div>
          <div>
            <span>{t('Selection')}</span>
            <strong>
              {localeCodes.length} {t('dil ·')} {documentIds.length} {t('çıktı')}
            </strong>
          </div>
          <div>
            <span>{t('Validation')}</span>
            <strong>{t('Exact dimensions')}</strong>
          </div>
        </div>
        <div className="export-columns">
          <section>
            <h3>{t('Languages')}</h3>
            <div className="export-list-toolbar">
              <button type="button" onClick={() => setLocaleCodes(project.locales.map((item) => item.code))}>
                {t('Tümü')}
              </button>
              <button type="button" onClick={() => setLocaleCodes([currentLocale])}>
                {t('Aktif dil')}
              </button>
              <button type="button" onClick={() => setLocaleCodes([])}>
                {t('Temizle')}
              </button>
            </div>
            <div className="export-language-list">
              {project.locales.map((locale) => (
                <label className="check-row" key={locale.code}>
                  <input
                    type="checkbox"
                    checked={localeCodes.includes(locale.code)}
                    onChange={(event) =>
                      setLocaleCodes((current) =>
                        event.target.checked
                          ? [...current, locale.code]
                          : current.filter((code) => code !== locale.code),
                      )
                    }
                  />
                  <span>
                    <strong>{locale.name}</strong>
                    <small>{locale.code}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3>{t('Devices & outputs')}</h3>
            <div className="export-list-toolbar">
              <button type="button" onClick={() => setDocumentIds(project.documents.map((item) => item.id))}>
                {t('Tümü')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDocumentIds(project.documents.filter((item) => item.enabled).map((item) => item.id))
                }
              >
                {t('Aktifler')}
              </button>
              <button type="button" onClick={() => setDocumentIds([])}>
                {t('Temizle')}
              </button>
            </div>
            <div className="export-output-list">
              {project.documents.map((document) => (
                <label className="check-row" key={document.id}>
                  <input
                    type="checkbox"
                    checked={documentIds.includes(document.id)}
                    onChange={(event) =>
                      setDocumentIds((current) =>
                        event.target.checked
                          ? [...current, document.id]
                          : current.filter((id) => id !== document.id),
                      )
                    }
                  />
                  <span>
                    <strong>{t(document.name)}</strong>
                    <small>
                      {document.width}×{document.height} · {document.pageCount} {t('file')}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
        {progress && (
          <div className="progress-card">
            <div className="progress-track">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <strong>
              {progress.done} / {progress.total}
            </strong>
            <p>{progress.label}</p>
          </div>
        )}
        {error && (
          <div className="warning-card">
            <strong>{t('Export durdu')}</strong>
            <p>{error}</p>
          </div>
        )}
      </div>
      <footer className="modal-footer">
        {progress && abort.current && (
          <button className="button secondary" onClick={() => abort.current?.abort()}>
            {t('Cancel')}
          </button>
        )}
        <button
          className="button secondary"
          disabled={Boolean(progress)}
          onClick={() => void runSingleExport()}
        >
          <Download size={15} /> {t('Aktif panel')}
        </button>
        <button
          className="button primary"
          disabled={Boolean(progress) || documentIds.length === 0 || localeCodes.length === 0}
          onClick={() => void runBulkExport()}
        >
          <Box size={15} /> {progress ? t('Rendering…') : t('ZIP oluştur')}
        </button>
      </footer>
    </Dialog>
  );
}

export default App;
