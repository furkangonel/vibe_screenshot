import { ArrowUpRight, Copy, FolderOpen, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import { renderPage } from './exporter';
import type { ScreenshotProject } from './types';
import { createDefaultProject } from './defaultProject';
import { useI18n } from './i18n';
import type { useWorkspace } from './useWorkspace';

function ProjectPreview({ project }: { project: ScreenshotProject }) {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const document = project.documents[0];
      if (!document) return;
      const next: string[] = [];
      try {
        for (let i = 0; i < Math.min(3, document.pageCount); i++) {
          const canvas = await renderPage(
            project,
            document,
            project.defaultLocale,
            i,
            Math.min(90 / document.width, 180 / document.height),
          );
          if (!active) return;
          next.push(canvas.toDataURL('image/png'));
          canvas.width = 1;
          canvas.height = 1;
        }
        if (active) setImages(next);
      } catch {
        /* A project with a missing image can still be opened and repaired. */
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [project]);
  return images.length ? (
    <div className="project-preview" aria-hidden="true">
      {images.map((src, i) => (
        <img src={src} key={i} alt="" />
      ))}
    </div>
  ) : (
    <div className="preview-placeholder" aria-hidden="true">
      <FolderOpen size={28} />
    </div>
  );
}

type Props = { workspace: ReturnType<typeof useWorkspace>; onOpen: () => void; onImport: () => void };
export default function ProjectLibrary({ workspace, onOpen, onImport }: Props) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [defaultLocale, setDefaultLocale] = useState(language === 'tr' ? 'tr' : 'en-US');
  const [save, setSave] = useState(true);
  const [example, setExample] = useState(true);
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [createError, setCreateError] = useState(false);
  const entries = workspace.entries.filter((entry) =>
    `${entry.project.name} ${entry.project.notes ?? ''}`
      .toLocaleLowerCase(language)
      .includes(search.toLocaleLowerCase(language)),
  );
  async function create() {
    const project = createDefaultProject();
    project.name = name.trim() || t('Untitled project');
    project.notes = notes.trim();
    project.defaultLocale = defaultLocale;
    if (!example) {
      project.copy = {};
      project.documents = project.documents.map((d) => ({ ...d, layers: [], pageCount: 1 }));
    }
    // Persist before opening, so a failed save never masquerades as a saved project.
    const id = await workspace.addProject(project, save);
    if (!id) {
      setCreateError(true);
      return;
    }
    setCreating(false);
    setName('');
    setNotes('');
    onOpen();
  }
  return (
    <main className="library-view">
      <header className="library-heading">
        <div>
          <span className="eyebrow">Vibe Screenshots</span>
          <h1>{t('Your workspace')}</h1>
          <p>{t('libraryDescription')}</p>
        </div>
        <div className="library-actions">
          <button className="button secondary" onClick={onImport}>
            <Upload size={15} />
            {t('Proje içe aktar')}
          </button>
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            {t('New project')}
          </button>
        </div>
      </header>
      <div className="library-toolbar">
        <label className="project-search">
          <Search size={16} />
          <input
            aria-label={t('Search projects')}
            placeholder={t('Search projects')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>
          {entries.length} {t('Projects').toLocaleLowerCase(language)}
        </span>
      </div>
      <div className="project-grid">
        {entries.map((entry) => (
          <article
            className={`project-card ${entry.id === workspace.activeId ? 'current' : ''}`}
            key={entry.id}
          >
            <button
              className="project-cover"
              onClick={() => {
                workspace.switchProject(entry.id);
                onOpen();
              }}
              aria-label={`${t('Open project')}: ${entry.project.name}`}
            >
              <ProjectPreview project={entry.project} />
              <ArrowUpRight size={18} />
            </button>
            <div className="project-card-body">
              <div className="project-card-title">
                <h2>{entry.project.name || t('Untitled project')}</h2>
                <span className={`project-badge ${entry.persisted ? 'is-saved' : ''}`}>
                  {t(entry.persisted ? 'Saved' : 'Session only')}
                </span>
              </div>
              <p>
                {entry.project.notes ||
                  `${entry.project.documents.length} ${t('çıktı')} · ${entry.project.locales.length} ${t('Languages').toLocaleLowerCase(language)}`}
              </p>
              <footer>
                <time dateTime={entry.project.updatedAt}>
                  {new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(
                    new Date(entry.project.updatedAt),
                  )}
                </time>
                <div>
                  <button
                    className="plain-icon"
                    aria-label={`${t('Duplicate project')}: ${entry.project.name}`}
                    onClick={() => {
                      workspace.add({
                        ...structuredClone(entry.project),
                        name: `${entry.project.name} ${t('copySuffix')}`,
                      });
                    }}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="plain-icon danger"
                    aria-label={`${t('Sil')}: ${entry.project.name}`}
                    onClick={() => {
                      if (window.confirm(t('deleteProjectConfirm'))) void workspace.remove(entry.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </footer>
            </div>
          </article>
        ))}
        {!entries.length && (
          <div className="library-empty">
            <FolderOpen size={30} />
            <p>{t('No projects found')}</p>
            <button className="button secondary" onClick={() => setSearch('')}>
              {t('Temizle')}
            </button>
          </div>
        )}
      </div>
      {workspace.project && (
        <section className="project-details">
          <div>
            <h2>{workspace.project.name || t('Untitled project')}</h2>
            <p>{t(workspace.persisted ? 'saveDescription' : 'sessionDescription')}</p>
          </div>
          <div className="project-settings">
            <label className="field">
              <span className="field-label">{t('Project notes')}</span>
              <textarea
                rows={3}
                maxLength={10000}
                value={workspace.project.notes ?? ''}
                placeholder={t('notesPlaceholder')}
                onChange={(e) => workspace.setProject((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('Default language')}</span>
              <select
                value={workspace.project.defaultLocale}
                onChange={(e) => workspace.setProject((p) => ({ ...p, defaultLocale: e.target.value }))}
              >
                {workspace.project.locales.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                disabled={pendingSave === workspace.activeId}
                checked={workspace.persisted}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  if (!enabled && !window.confirm(t('stopSavingConfirm'))) return;
                  setPendingSave(workspace.activeId);
                  await workspace.persist(enabled);
                  setPendingSave(null);
                }}
              />
              {t('Save on this device')}
            </label>
          </div>
        </section>
      )}
      {creating && (
        <Dialog title={t('New project')} onClose={() => setCreating(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="field">
              <span className="field-label">{t('Name your project')}</span>
              <input
                autoFocus
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Untitled project')}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('Project notes')}</span>
              <textarea
                rows={3}
                maxLength={10000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('Default language')}</span>
              <select value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)}>
                <option value="en-US">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={example} onChange={(e) => setExample(e.target.checked)} />
              {t('Start with example layouts')}
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
              {t('Save on this device')}
            </label>
            {createError && <p role="alert">{t('saveFailed')}</p>}
            <footer>
              <button type="button" className="button secondary" onClick={() => setCreating(false)}>
                {t('Cancel')}
              </button>
              <button type="submit" className="button primary">
                {t('Create project')}
              </button>
            </footer>
          </form>
        </Dialog>
      )}
    </main>
  );
}
