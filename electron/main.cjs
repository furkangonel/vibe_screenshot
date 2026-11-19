const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  net,
  protocol,
  session,
  ipcMain,
  shell,
  clipboard,
} = require('electron');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createMcpService } = require('./mcp-service.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'vibe', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
if (process.env.VIBE_PROFILE_DIR) app.setPath('userData', path.resolve(process.env.VIBE_PROFILE_DIR));
const root = path.join(__dirname, '..', 'dist');
const devUrl = process.env.VIBE_DEV_URL;
let mainWindow;
let mcp;
const pending = new Map();
function trusted(event) {
  const url = event.senderFrame?.url;
  if (
    event.sender !== mainWindow?.webContents ||
    !url ||
    new URL(url).href !== new URL(devUrl || 'vibe://app/index.html').href
  )
    throw new Error('Untrusted renderer.');
}
function callRenderer(method, args) {
  if (!mainWindow || mainWindow.isDestroyed())
    return Promise.reject(new Error('Open the Vibe Screenshots studio to use its tools.'));
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The studio did not respond. Open it and try again.'));
    }, 115_000);
    pending.set(id, { resolve, reject, timer });
    mainWindow.webContents.send('vibe:automation', { id, method, args });
  });
}
ipcMain.on('vibe:automation-result', (event, message) => {
  try {
    trusted(event);
  } catch {
    return;
  }
  const request = pending.get(message?.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(String(message.error).slice(0, 1000)));
  else request.resolve(message.result);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 720,
    minHeight: 600,
    title: 'Vibe Screenshots',
    backgroundColor: '#f5f5f7',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 18, y: 20 },
          vibrancy: 'sidebar',
          visualEffectState: 'active',
        }
      : {}),
    icon: path.join(root, 'brand', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.once('ready-to-show', () => {
    if (process.env.VIBE_HIDE_TEST_WINDOW !== '1') mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== (devUrl || 'vibe://app/index.html')) event.preventDefault();
  });
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Wait for save / Kaydı bekle', 'Close / Kapat'],
      defaultId: 0,
      cancelId: 0,
      title: 'Vibe Screenshots',
      message: 'A project is still saving. / Bir proje hâlâ kaydediliyor.',
      detail: 'Keep this window open until saving finishes. / Kayıt tamamlanana kadar pencereyi açık tut.',
    });
    if (choice === 1) event.preventDefault();
  });
  mainWindow.loadURL(devUrl || 'vibe://app/index.html').catch((error) => {
    dialog.showErrorBox('Vibe Screenshots', error.message);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (devUrl && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(devUrl))
        throw new Error('VIBE_DEV_URL must be a loopback Vite URL.');
      protocol.handle('vibe', async (request) => {
        const url = new URL(request.url);
        if (url.hostname !== 'app') return new Response('Forbidden', { status: 403 });
        let relative;
        try {
          relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
        } catch {
          return new Response('Bad path', { status: 400 });
        }
        const filename = path.resolve(root, relative);
        if (!filename.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
        try {
          const response = await net.fetch(pathToFileURL(filename).href);
          const headers = new Headers(response.headers);
          headers.set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'",
          );
          return new Response(response.body, { status: response.status, headers });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      });
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      mcp = createMcpService({
        userData: app.getPath('userData'),
        executable: process.execPath,
        bridgePath: path.join(__dirname, 'stdio-bridge.cjs'),
        callRenderer,
        ...(process.env.VIBE_AGENT_TEST_HOME && process.env.VIBE_PROFILE_DIR
          ? {
              agentOptions: {
                home: process.env.VIBE_AGENT_TEST_HOME,
                platform: process.platform,
                env: { ...process.env, CODEX_HOME: path.join(process.env.VIBE_AGENT_TEST_HOME, '.codex') },
              },
            }
          : {}),
        onChange: (state) => {
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('vibe:status-update', state);
        },
      });
      await mcp.init();
      const handle = (channel, callback) =>
        ipcMain.handle(channel, async (event, ...args) => {
          trusted(event);
          return callback(...args);
        });
      let settingsQueue = Promise.resolve();
      handle('vibe:status', () => mcp.status());
      handle('vibe:mcp-settings', (patch) => {
        const next = settingsQueue.then(() =>
          mcp.setSettings({ enabled: patch?.enabled, port: patch?.port }),
        );
        settingsQueue = next.catch(() => {});
        return next;
      });
      handle('vibe:agents', () => mcp.agents());
      handle('vibe:copy-agent-config', async (id) => {
        const agent = (await mcp.agents()).find((agent) => agent.id === id);
        if (!agent) throw new Error('Unsupported agent.');
        clipboard.writeText(agent.preview);
      });
      handle('vibe:configure-agent', (data) => mcp.configure(String(data?.id), data?.remove === true));
      handle('vibe:show-exports', async () => {
        await require('node:fs/promises').mkdir(mcp.exportsFolder, { recursive: true });
        return shell.openPath(mcp.exportsFolder);
      });
      const navigate = (destination) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send('vibe:navigate', destination);
      };
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === 'darwin'
            ? [
                {
                  label: app.name,
                  submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => navigate('settings') },
                    { type: 'separator' },
                    { role: 'services' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' },
                  ],
                },
              ]
            : []),
          {
            label: 'File',
            submenu: [
              { label: 'All projects', accelerator: 'CmdOrCtrl+Shift+H', click: () => navigate('home') },
              {
                label: 'Settings…',
                accelerator: process.platform === 'darwin' ? undefined : 'CmdOrCtrl+,',
                click: () => navigate('settings'),
              },
              { type: 'separator' },
              { role: 'close' },
            ],
          },
          { role: 'editMenu' },
          {
            label: 'View',
            submenu: [
              { label: 'Toggle layers', accelerator: 'CmdOrCtrl+1', click: () => navigate('toggle-left') },
              {
                label: 'Toggle inspector',
                accelerator: 'CmdOrCtrl+2',
                click: () => navigate('toggle-right'),
              },
              { label: 'Focus canvas', accelerator: 'CmdOrCtrl+\\', click: () => navigate('focus') },
              { type: 'separator' },
              { role: 'togglefullscreen' },
              ...(devUrl ? [{ role: 'reload' }, { role: 'toggleDevTools' }] : []),
            ],
          },
          { role: 'windowMenu' },
        ]),
      );
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox('Vibe Screenshots', error.message);
      app.quit();
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  let closing = false;
  app.on('before-quit', (event) => {
    if (closing || !mcp) return;
    event.preventDefault();
    closing = true;
    void mcp.close().finally(() => app.quit());
  });
}
