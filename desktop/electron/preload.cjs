/**
 * CMS Lite Desktop — Preload Script
 *
 * Secure bridge between the renderer (React) and the Electron main process.
 * Only exposes what the UI needs — worker status and platform info.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get current worker + WhatsApp status
  getWorkerStatus: () => ipcRenderer.invoke('worker:status'),

  // Listen for real-time worker updates pushed from main process
  onWorkerUpdate: (callback) => {
    ipcRenderer.on('worker:update', (_event, data) => callback(data));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('worker:update');
  },

  // Quit the entire app (including tray and worker)
  quit: () => ipcRenderer.send('app:quit'),

  // Platform info
  platform: process.platform,
});
