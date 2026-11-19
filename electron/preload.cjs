const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vibeDesktop', {
  platform: process.platform,
  status: () => ipcRenderer.invoke('vibe:status'),
  setMcp: (patch) => ipcRenderer.invoke('vibe:mcp-settings', patch),
  agents: () => ipcRenderer.invoke('vibe:agents'),
  copyAgentConfiguration: (id) => ipcRenderer.invoke('vibe:copy-agent-config', id),
  configureAgent: (id, remove = false) => ipcRenderer.invoke('vibe:configure-agent', { id, remove }),
  showExports: () => ipcRenderer.invoke('vibe:show-exports'),
  onStatus: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on('vibe:status-update', listener);
    return () => ipcRenderer.removeListener('vibe:status-update', listener);
  },
  onNavigate: (callback) => {
    const listener = (_e, destination) => callback(destination);
    ipcRenderer.on('vibe:navigate', listener);
    return () => ipcRenderer.removeListener('vibe:navigate', listener);
  },
  onAutomation: (callback) => {
    const listener = async (_e, request) => {
      try {
        ipcRenderer.send('vibe:automation-result', {
          id: request.id,
          result: await callback(request.method, request.args),
        });
      } catch (e) {
        ipcRenderer.send('vibe:automation-result', { id: request.id, error: e.message });
      }
    };
    ipcRenderer.on('vibe:automation', listener);
    return () => ipcRenderer.removeListener('vibe:automation', listener);
  },
});
