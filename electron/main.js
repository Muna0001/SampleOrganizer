const { app, BrowserWindow, ipcMain, nativeImage, protocol, net, shell, dialog } = require('electron');
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

const isMac = process.platform === 'darwin';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#001a00',
    // Frameless inset title bar is macOS-only; Windows/Linux get a standard frame
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } }
      : { autoHideMenuBar: true }),
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
  // Grant all permissions (MIDI, media, etc.) so Web MIDI API works in the renderer
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  // Serve local audio files via sample:// protocol
  // AIFF isn't supported by Chromium — convert to WAV on the fly using macOS afconvert
  protocol.handle('sample', (request) => {
    // Extract path: strip scheme, decode percent-encoded characters
    const rawUrl = request.url.replace(/^sample:\/\//, '');
    const filePath = decodeURIComponent(rawUrl);
    const ext = path.extname(filePath).toLowerCase();

    // Build a proper file:// URL (handles Windows drive letters, backslashes,
    // and special chars like #)
    const toFileUrl = (p) => require('url').pathToFileURL(p).href;

    // afconvert only exists on macOS; on other platforms unsupported formats
    // fall through and are served as-is
    if ((ext === '.aif' || ext === '.aiff') && isMac) {
      let wavPath = aiffCache.get(filePath);
      if (!wavPath || !fs.existsSync(wavPath)) {
        wavPath = path.join(os.tmpdir(), `sample-org-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        try {
          execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', filePath, wavPath]);
          aiffCache.set(filePath, wavPath);
        } catch {
          return net.fetch(toFileUrl(filePath));
        }
      }
      return net.fetch(toFileUrl(wavPath));
    }

    return net.fetch(toFileUrl(filePath));
  });

  const dbPath = path.join(app.getPath('userData'), 'samples.db');
  initDatabase(dbPath);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
  });
  return result.canceled ? null : result.filePaths;
});

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

ipcMain.handle('show-in-folder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// Native drag-to-DAW: hands the real file path to the OS drag system.
// Windows refuses to start a drag with an empty icon, so use a 1x1
// transparent image instead.
const dragIcon = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);

ipcMain.on('start-drag', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: dragIcon,
  });
});
