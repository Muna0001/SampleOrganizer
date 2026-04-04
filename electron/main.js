const { app, BrowserWindow, ipcMain, nativeImage, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { initDatabase, getSamples, upsertSample, markDuplicates, toggleFavorite, updateTags, getStats } = require('./database');
const { scanDirectory } = require('./scanner');

// Cache converted AIFF → WAV files so we don't re-convert every play
const aiffCache = new Map();

// Register custom protocol for streaming local audio files to the renderer
protocol.registerSchemesAsPrivileged([
  { scheme: 'sample', privileges: { stream: true, supportFetchAPI: true } },
]);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#001a00',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Serve local audio files via sample:// protocol
  // AIFF isn't supported by Chromium — convert to WAV on the fly using macOS afconvert
  protocol.handle('sample', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.aif' || ext === '.aiff') {
      let wavPath = aiffCache.get(filePath);
      if (!wavPath || !fs.existsSync(wavPath)) {
        wavPath = path.join(os.tmpdir(), `sample-org-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        try {
          execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', filePath, wavPath]);
          aiffCache.set(filePath, wavPath);
        } catch {
          // Fall back to raw file if conversion fails
          return net.fetch(`file://${filePath}`);
        }
      }
      return net.fetch(`file://${wavPath}`);
    }

    return net.fetch(`file://${filePath}`);
  });

  const dbPath = path.join(app.getPath('userData'), 'samples.db');
  initDatabase(dbPath);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('scan-library', async (_event, dirPath) => {
  const result = await scanDirectory(dirPath, (progress) => {
    mainWindow.webContents.send('scan-progress', progress);
  }, { upsertSample });
  markDuplicates();
  return result;
});

ipcMain.handle('get-samples', (_event, filters) => {
  return getSamples(filters);
});

ipcMain.handle('get-stats', () => {
  return getStats();
});

ipcMain.handle('toggle-favorite', (_event, id) => {
  return toggleFavorite(id);
});

ipcMain.handle('update-tags', (_event, id, tags) => {
  return updateTags(id, tags);
});

// Native drag-to-DAW: hands the real file path to the OS drag system
ipcMain.on('start-drag', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: nativeImage.createEmpty(),
  });
});
