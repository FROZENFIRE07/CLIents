/**
 * CMS Lite Desktop — Electron Main Process
 *
 * Responsibilities:
 * 1. Host the React web app in a frameless BrowserWindow
 * 2. Custom title bar with IPC window controls
 * 3. Maximized on startup, remembers window state between sessions
 * 4. Manage system tray (minimize to tray, not quit)
 * 5. Start the notification worker (background WhatsApp delivery)
 * 6. Graceful shutdown: stop worker → destroy WhatsApp → exit
 */
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs   = require('fs');
const { createTray, setMainWindow } = require('./tray.cjs');
const { startWorker, stopWorker, getWorkerStatus } = require('./worker.cjs');

const IS_DEV  = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

// ── Window state persistence ─────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveWindowState(win) {
  try {
    const isMax = win.isMaximized();
    const b     = win.getNormalBounds(); // bounds before maximize
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      x: b.x, y: b.y,
      width: b.width, height: b.height,
      maximized: isMax,
    }));
  } catch { /* ignore */ }
}

// ── Window creation ──────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  // Remove the default application menu (File Edit View Window Help)
  Menu.setApplicationMenu(null);

  const saved   = loadWindowState();
  const display = screen.getPrimaryDisplay().workAreaSize;

  // Sensible defaults if no saved state
  const defaultW = Math.min(1400, display.width);
  const defaultH = Math.min(900,  display.height);

  // Icon: in packaged build it's in resources/public/, in dev it's in public/
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public', 'icon.ico')
    : path.join(__dirname, '..', 'public', 'icon.ico');

  mainWindow = new BrowserWindow({
    // Restore saved size or use defaults
    x:      saved?.x      ?? undefined,
    y:      saved?.y      ?? undefined,
    width:  saved?.width  ?? defaultW,
    height: saved?.height ?? defaultH,

    minWidth:  1100,
    minHeight: 680,

    // ── Frameless premium look ──────────────────────
    frame:          false,
    titleBarStyle:  'hidden',
    backgroundColor: '#090909',

    // ── Avoid flash on startup ──────────────────────
    show: false,

    title: 'Gorade Classes',
    icon: iconPath,

    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      false, // Required to allow type="module" on file:// protocol
    },
  });

  // Load the React app
  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show window after content is ready — start maximized if saved or first run
  mainWindow.once('ready-to-show', () => {
    if (saved?.maximized !== false) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Save state on resize/move/close
  const saveState = () => saveWindowState(mainWindow);
  mainWindow.on('resize',  saveState);
  mainWindow.on('move',    saveState);

  // Notify renderer of maximize state changes (for custom title bar icon toggle)
  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:maximizeChange', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximizeChange', false));

  mainWindow.on('close', (e) => {
    saveState();
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  setMainWindow(mainWindow);
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();
  startWorker();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  // Tray keeps the app alive — don't quit on all windows closed
});

// ── IPC: window controls (custom title bar) ──────────────────────────────────

ipcMain.on('window:minimize',  () => mainWindow?.minimize());
ipcMain.on('window:maximize',  () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close',     () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// Notify renderer when maximize state changes
const notifyMaximize = (val) => mainWindow?.webContents.send('window:maximizeChange', val);
app.whenReady().then(() => {
  // These events fire after createWindow sets up mainWindow — attach after ready
});

// ── IPC: worker & app ────────────────────────────────────────────────────────

ipcMain.handle('worker:status', () => getWorkerStatus());

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log('[MAIN] Shutting down...');
  await stopWorker();
  app.isQuitting = true;
  app.quit();
}

ipcMain.on('app:quit', shutdown);

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
