/**
 * CMS Lite Desktop — Preload Script
 *
 * Secure bridge between the renderer (React) and the Electron main process.
 * Exposes: worker status, window controls, platform info.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Worker / WhatsApp ──────────────────────────────────────────────────────
  getWorkerStatus: () => ipcRenderer.invoke('worker:status'),

  onWorkerUpdate: (callback) => {
    ipcRenderer.on('worker:update', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('worker:update');
  },

  // ── App ───────────────────────────────────────────────────────────────────
  quit: () => ipcRenderer.send('app:quit'),

  // ── Window controls (custom title bar) ────────────────────────────────────
  window: {
    minimize:    ()  => ipcRenderer.send('window:minimize'),
    maximize:    ()  => ipcRenderer.send('window:maximize'),
    close:       ()  => ipcRenderer.send('window:close'),
    isMaximized: ()  => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (callback) => {
      ipcRenderer.on('window:maximizeChange', (_e, val) => callback(val));
      return () => ipcRenderer.removeAllListeners('window:maximizeChange');
    },
  },

  // ── Platform ──────────────────────────────────────────────────────────────
  platform: process.platform,
});
