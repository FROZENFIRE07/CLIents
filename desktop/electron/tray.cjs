/**
 * CMS Lite Desktop — System Tray
 *
 * | Action              | Behavior                                    |
 * |---------------------|---------------------------------------------|
 * | Close button (✕)    | Window hides, app stays in tray             |
 * | Tray double-click   | Window restores                             |
 * | Tray → "Open"       | Window restores                             |
 * | Tray → "Quit"       | Worker stops, WhatsApp disconnects, app exits|
 */
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;
let mainWindow = null;

function setMainWindow(win) {
  mainWindow = win;
}

function createTray() {
  // Use a small icon — fallback to a 16x16 empty image if SVG not loadable
  const iconPath = path.join(__dirname, '..', 'public', 'favicon.svg');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('CMS Lite Desktop — Notifications Active');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CMS Lite',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click restores window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

module.exports = { createTray, setMainWindow };
