import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FolderOpen,
  Keyboard,
  Loader2,
  Monitor,
  PlugZap,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import Dialog from './Dialog';
import { desktop, type LocalAgent, type McpStatus } from './desktop';
import { useI18n } from './i18n';
import packageInfo from '../package.json';

export type StudioPreferences = {
  layers: boolean;
  inspector: boolean;
  guides: boolean;
  snapDistance: number;
  crossCanvas: boolean;
};
export default function Settings({
  onClose,
  preferences,
  onPreferences,
}: {
  onClose: () => void;
  preferences: StudioPreferences;
  onPreferences: (patch: Partial<StudioPreferences>) => void;
}) {
  const { t, language, setLanguage } = useI18n();
  const [tab, setTab] = useState('general');
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [expanded, setExpanded] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [port, setPort] = useState('37891');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let active = true;
    if (desktop) {
      desktop!
        .status()
        .then((s) => {
          if (active) {
            setStatus(s);
            setPort(String(s.port));
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      desktop!
        .agents()
        .then((a) => {
          if (active) setAgents(a);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    const off = desktop?.onStatus((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
      off?.();
    };
  }, []);
  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }
  async function copy(agent: LocalAgent) {
    try {
      if (desktop) await desktop.copyAgentConfiguration(agent.id);
      else await navigator.clipboard.writeText(agent.preview);
      setCopied(agent.id);
    } catch {
      setError(t('Select and copy the configuration below.'));
    }
  }
  return (
    <Dialog title={t('Settings')} onClose={onClose} wide busy={!!busy}>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('Settings sections')}>
          {[
            ['general', SlidersHorizontal, 'General'],
            ['connections', PlugZap, 'Agent connections'],
            ['tools', Wrench, 'MCP tools'],
          ].map(([id, Icon, label]) => {
            const ItemIcon = Icon as typeof Monitor;
            return (
              <button
                key={String(id)}
                className={tab === id ? 'selected' : ''}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(String(id))}
              >
                <ItemIcon size={17} />
                {t(String(label))}
              </button>
            );
          })}
          <div className="settings-version">
            <img src="./brand/icon.svg" alt="" />
            <strong>Vibe Screenshots</strong>
            <span>{packageInfo.version} · MIT</span>
          </div>
        </nav>
        <section className="settings-content">
          {tab === 'general' && (
            <>
              <div className="settings-title">
                <span className="settings-symbol">
                  <SlidersHorizontal size={22} />
                </span>
                <h3>{t('Make room for your work')}</h3>
                <p>{t('A few preferences for a quieter studio.')}</p>
              </div>
              <h4>{t('Workspace')}</h4>
              <div className="settings-group">
                <label className="preference-row">
                  <span>
                    <strong>{t('Interface language')}</strong>
                    <small>{t('Screenshot languages are managed inside each project.')}</small>
                  </span>
                  <select
                    aria-label={t('Settings language')}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'tr')}
                  >
                    <option value="en">English</option>
                    <option value="tr">Türkçe</option>
                  </select>
                </label>
                <label className="preference-row">
                  <span>
                    <strong>{t('Layers sidebar')}</strong>
                    <small>{t('Keep the output picker and layers within reach.')}</small>
                  </span>
                  <input
                    className="native-switch"
                    type="checkbox"
                    checked={preferences.layers}
                    onChange={(e) => onPreferences({ layers: e.target.checked })}
                  />
                </label>
                <label className="preference-row">
                  <span>
                    <strong>{t('Inspector sidebar')}</strong>
                    <small>{t('Show the properties of the selected layer or canvas.')}</small>
                  </span>
                  <input
                    className="native-switch"
                    type="checkbox"
                    checked={preferences.inspector}
                    onChange={(e) => onPreferences({ inspector: e.target.checked })}
                  />
                </label>
              </div>
              <h4>{t('Precision')}</h4>
              <div className="settings-group">
                <label className="preference-row">
                  <span>
                    <strong>{t('Smart guides')}</strong>
                    <small>
                      {t('Align edges, centers, sizes and equal gaps. Hold Option / Alt to move freely.')}
                    </small>
                  </span>
                  <input
                    className="native-switch"
                    type="checkbox"
                    checked={preferences.guides}
                    onChange={(e) => onPreferences({ guides: e.target.checked })}
                  />
                </label>
                <label className="preference-row">
                  <span>
                    <strong>{t('Snap distance')}</strong>
                    <small>{t('Measured in screen pixels, at every zoom level.')}</small>
                  </span>
                  <div className="snap-preference">
                    <input
                      aria-label={t('Snap distance')}
                      type="range"
                      min="2"
                      max="12"
                      step="1"
                      value={preferences.snapDistance}
                      onChange={(e) => onPreferences({ snapDistance: Number(e.target.value) })}
                    />
                    <output>{preferences.snapDistance} px</output>
                  </div>
                </label>
                <label className="preference-row">
                  <span>
                    <strong>{t('Align across screenshots')}</strong>
                    <small>{t('Match positions on neighboring canvases.')}</small>
                  </span>
                  <input
                    className="native-switch"
                    type="checkbox"
                    checked={preferences.crossCanvas}
                    onChange={(e) => onPreferences({ crossCanvas: e.target.checked })}
                  />
                </label>
              </div>
              <div className="shortcut-summary">
                <Keyboard size={17} />
                <span>
                  {t('All projects')} <kbd>⌘ ⇧ H</kbd>
                </span>
                <span>
                  {t('Settings')} <kbd>⌘ ,</kbd>
                </span>
                <span>
                  {t('Focus canvas')} <kbd>⌘ \</kbd>
                </span>
              </div>
            </>
          )}
          {tab === 'connections' && (
            <>
              <div className="settings-title">
                <span className="settings-symbol">
                  <PlugZap size={22} />
                </span>
                <h3>{t('Your agents. Your studio.')}</h3>
                <p>{t('Let an agent work with your local projects while you keep the canvas in view.')}</p>
              </div>
              {!desktop ? (
                <div className="settings-empty">
                  <Monitor size={28} />
                  <strong>{t('Available in the desktop app')}</strong>
                  <p>
                    {t(
                      'Install Vibe Screenshots to connect agents on this computer. The browser editor keeps working on its own.',
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mcp-master settings-group">
                    <label className="preference-row">
                      <span>
                        <strong>{t('Enable MCP')}</strong>
                        <small>{t('Allow connected agents to read and edit projects in this app.')}</small>
                      </span>
                      <input
                        aria-label={t('Enable MCP')}
                        className="native-switch"
                        type="checkbox"
                        checked={status?.enabled ?? false}
                        disabled={!!busy || !status}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          void run('toggle', async () => {
                            setStatus(await desktop!.setMcp({ enabled }));
                          });
                        }}
                      />
                    </label>
                    <div className="connection-summary">
                      <span className={`connection-state ${status?.running ? 'online' : ''}`}>
                        <i />
                        {t(
                          status?.running
                            ? 'Running locally'
                            : status?.error
                              ? 'Connection needs attention'
                              : 'MCP is off',
                        )}
                      </span>
                      <code>{status?.url || '127.0.0.1'}</code>
                    </div>
                  </div>
                  <p className="settings-footnote">
                    {t(
                      'Only this computer can connect. Each request is authenticated. Turning MCP off disconnects every agent immediately.',
                    )}
                  </p>
                  <div className="settings-section-heading">
                    <h4>{t('Detected agents')}</h4>
                    <button
                      className="text-action"
                      disabled={!!busy}
                      onClick={() =>
                        void run('refresh', async () => {
                          setAgents(await desktop!.agents());
                          setStatus(await desktop!.status());
                        })
                      }
                    >
                      <RefreshCw size={13} />
                      {t('Refresh')}
                    </button>
                  </div>
                  <div className="agent-list">
                    {[...agents]
                      .sort((a, b) => Number(b.detected) - Number(a.detected))
                      .map((agent) => (
                        <article
                          className={`agent-card ${agent.connected ? 'connected' : ''}`}
                          key={agent.id}
                        >
                          <div className="agent-row">
                            <div className={`agent-monogram ${agent.id}`}>
                              {agent.name === 'VS Code' ? '<>' : agent.name.slice(0, 1)}
                            </div>
                            <div className="agent-identity">
                              <strong>{agent.name}</strong>
                              <small>
                                {t(
                                  agent.connected
                                    ? 'Configuration added'
                                    : agent.detected
                                      ? 'Detected on this computer'
                                      : 'Not detected',
                                )}
                              </small>
                            </div>
                            <button
                              className="button secondary compact"
                              disabled={!!busy || (!status?.running && !agent.connected) || !!agent.error}
                              onClick={() =>
                                void run(agent.id, async () => {
                                  const result = await desktop!.configureAgent(agent.id, agent.connected);
                                  setAgents(await desktop!.agents());
                                  setMessage(
                                    agent.connected
                                      ? t('Configuration removed. Restart the agent to apply it.')
                                      : `${t('Configuration added. Restart the agent to connect.')}${result.backup ? ` ${t('Previous settings backed up to')} ${result.backup}` : ''}`,
                                  );
                                })
                              }
                            >
                              {busy === agent.id ? (
                                <Loader2 size={14} className="spin" />
                              ) : agent.connected ? (
                                <Check size={14} />
                              ) : (
                                <PlugZap size={14} />
                              )}{' '}
                              {t(agent.connected ? 'Disconnect' : 'Connect')}
                            </button>
                            <button
                              className="plain-icon"
                              aria-label={`${t('Show configuration')}: ${agent.name}`}
                              aria-expanded={expanded === agent.id}
                              onClick={() => setExpanded(expanded === agent.id ? '' : agent.id)}
                            >
                              <ChevronRight className={expanded === agent.id ? 'turned' : ''} size={16} />
                            </button>
                          </div>
                          {agent.error && <p className="agent-error">{agent.error}</p>}
                          {expanded === agent.id && (
                            <div className="agent-details">
                              <span className="field-label">{t('Configuration file')}</span>
                              <code className="config-path">{agent.path}</code>
                              <pre tabIndex={0}>{agent.preview}</pre>
                              <button className="text-action" onClick={() => void copy(agent)}>
                                {copied === agent.id ? <Check size={13} /> : <Copy size={13} />}{' '}
                                {t(copied === agent.id ? 'Copied' : 'Copy configuration')}
                              </button>
                              <p>
                                {t(
                                  'Only the Vibe Screenshots entry changes. Other servers and settings stay in place. An existing file is backed up before each change.',
                                )}
                              </p>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                  <details className="advanced-connection">
                    <summary>{t('Connection details')}</summary>
                    <label className="field">
                      <span className="field-label">{t('Local port')}</span>
                      <div className="port-field">
                        <input
                          aria-label={t('Local port')}
                          type="number"
                          min="1024"
                          max="65535"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                        />
                        <button
                          className="button secondary compact"
                          disabled={!!busy || Number(port) === status?.port}
                          onClick={() =>
                            void run('port', async () => {
                              setStatus(await desktop!.setMcp({ port: Number(port) }));
                            })
                          }
                        >
                          {t('Apply')}
                        </button>
                      </div>
                    </label>
                    <p>
                      {t(
                        'The app must stay open. Connections use its bundled runtime; a separate Node.js installation is not needed.',
                      )}
                    </p>
                    <button
                      className="text-action"
                      onClick={() =>
                        void run('exports', async () => {
                          const result = await desktop!.showExports();
                          if (result) throw new Error(result);
                        })
                      }
                    >
                      <FolderOpen size={14} />
                      {t('Open export folder')}
                    </button>
                  </details>
                </>
              )}
            </>
          )}
          {tab === 'tools' && (
            <>
              <div className="settings-title">
                <span className="settings-symbol">
                  <Wrench size={22} />
                </span>
                <h3>{t('An entire studio, within reach')}</h3>
                <p>
                  {t(
                    'Tools use the same canvas renderer, project validation and local saving as the editor.',
                  )}
                </p>
              </div>
              <div className="tool-summary">
                <span>
                  <strong>{status?.toolCount ?? 34}</strong>
                  {t('tools')}
                </span>
                <span>
                  <strong>1</strong>
                  {t('reference resource')}
                </span>
                <span>
                  <strong>1</strong>
                  {t('composition prompt')}
                </span>
              </div>
              <label className="tool-search">
                <Search size={15} />
                <input
                  aria-label={t('Search tools')}
                  placeholder={t('Search tools')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {!desktop && (
                <p className="settings-footnote">
                  {t('The full tool catalog is available in the desktop app and in docs/MCP.md.')}
                </p>
              )}
              <div className="tool-list">
                {status?.tools
                  .filter((tool) =>
                    `${tool.name} ${tool.description}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((tool) => (
                    <div className="tool-item" key={tool.name}>
                      <div>
                        <code>{tool.name}</code>
                        <span className={`tool-access ${tool.readOnly ? 'read' : ''}`}>
                          {t(tool.readOnly ? 'Read' : 'Edit')}
                        </span>
                      </div>
                      <p>{tool.description}</p>
                    </div>
                  ))}
              </div>
              {!!status?.recent.length && (
                <>
                  <h4>{t('Recent activity')}</h4>
                  <div className="activity-list">
                    {status.recent.slice(0, 6).map((event, i) => (
                      <div key={`${event.time}-${i}`}>
                        <CheckCircle2 size={14} className={event.ok ? 'success' : 'danger'} />
                        <code>{event.name}</code>
                        <span>{event.duration} ms</span>
                        <time>{new Date(event.time).toLocaleTimeString(language)}</time>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {(error || status?.error) && (
            <p className="settings-feedback error" role="alert">
              {error || status?.error}
            </p>
          )}
          {message && (
            <p className="settings-feedback" role="status">
              <CheckCircle2 size={15} />
              {message}
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
