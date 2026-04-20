const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanLibrary: (dirPath) => ipcRenderer.invoke('scan-library', dirPath),
  getSamples: (filters) => ipcRenderer.invoke('get-samples', filters),
  getStats: () => ipcRenderer.invoke('get-stats'),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  updateTags: (id, tags) => ipcRenderer.invoke('update-tags', id, tags),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  onScanProgress: (callback) => {
    ipcRenderer.on('scan-progress', (_event, data) => callback(data));
  },
});
