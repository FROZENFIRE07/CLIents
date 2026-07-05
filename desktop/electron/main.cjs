/**
 * CMS Lite Desktop — Electron Main Process
 *
 * Responsibilities:
 * 1. Host the React web app in a BrowserWindow
 * 2. Manage system tray (minimize to tray, not quit)
 * 3. Start the notification worker (background WhatsApp delivery)
 * 4. Graceful shutdown: stop worker → destroy WhatsApp → exit
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createTray, setMainWindow } = require('./tray.cjs');
const { startWorker, stopWorker, getWorkerStatus } = require('./worker.cjs');

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'CMS Lite Desktop',
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the React app
  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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

// Prevent default quit — let tray handle it
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until Cmd+Q
  if (process.platform !== 'darwin') {
    // Don't quit — tray keeps the app alive
  }
});

// ── IPC handlers for renderer ────────────────────────────────────────────────

ipcMain.handle('worker:status', () => getWorkerStatus());

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log('[MAIN] Shutting down...');
  await stopWorker();
  app.isQuitting = true;
  app.quit();
}

ipcMain.on('app:quit', shutdown);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
