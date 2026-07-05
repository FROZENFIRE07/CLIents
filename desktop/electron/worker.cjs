/**
 * CMS Lite Desktop — Notification Worker
 *
 * This is a DUMB DELIVERY PIPE. It does exactly two things:
 * 1. Ask the server "what should I send?"     → GET  /api/worker/next
 * 2. Tell the server "here's what happened"   → PATCH /api/worker/:id/status
 *
 * ALL business logic (expiry, retries, status transitions) lives on the server.
 * The worker never touches MongoDB directly.
 *
 * It also manages the WhatsApp client lifecycle (Puppeteer + LocalAuth).
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = process.env.CMS_API_URL || 'http://localhost:5000';
const WORKER_KEY = process.env.WORKER_API_KEY || 'cmslite-worker-secret-2026';
const POLL_INTERVAL_MS = 10000;  // Check queue every 10 seconds
const MESSAGE_GAP_MIN = 3000;   // 3s min between WhatsApp messages
const MESSAGE_GAP_MAX = 8000;   // 8s max between WhatsApp messages
const SESSION_PATH = path.join(
  require('electron').app.getPath('userData'),
  '.wwebjs_auth'
);
const RECONNECT_DELAY_MS = 10000;

// ── State ────────────────────────────────────────────────────────────────────
let waClient = null;
let waReady = false;
let waInitializing = false;
let waLastError = null;
let pollTimer = null;
let isProcessing = false;
let reconnectTimer = null;
let stats = { processed: 0, failed: 0, lastPollAt: null };

// ── HTTP helpers (no axios dependency — use Node fetch) ──────────────────────
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-worker-key': WORKER_KEY },
  });
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-key': WORKER_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── WhatsApp Client ──────────────────────────────────────────────────────────

async function initWhatsApp() {
  if (waInitializing || waReady) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  waInitializing = true;
  console.log('[WA] Initializing WhatsApp client...');

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
    authTimeoutMs: 120000,
  });

  waClient.on('qr', (qr) => {
    console.log('[WA] QR code received — scan with WhatsApp');
    qrcode.generate(qr, { small: true });
    // Also push to renderer for in-app display
    broadcastToRenderer('worker:update', {
      event: 'qr',
      qr,
      whatsappReady: false,
    });
  });

  waClient.on('ready', () => {
    waReady = true;
    waInitializing = false;
    waLastError = null;
    console.log('[WA] ✅ WhatsApp client is ready!');
    broadcastToRenderer('worker:update', { event: 'ready', whatsappReady: true });
  });

  waClient.on('authenticated', () => {
    console.log('[WA] Session authenticated.');
  });

  waClient.on('auth_failure', (msg) => {
    waReady = false;
    waInitializing = false;
    waLastError = `Auth failure: ${msg}`;
    console.error(`[WA] ❌ Auth failed: ${msg}`);
    clearSessionAndReconnect();
  });

  waClient.on('disconnected', (reason) => {
    waReady = false;
    waInitializing = false;
    waLastError = `Disconnected: ${reason}`;
    console.warn(`[WA] ⚠️ Disconnected: ${reason}`);

    if (reason === 'LOGOUT') {
      clearSessionAndReconnect();
    } else {
      scheduleReconnect();
    }
    broadcastToRenderer('worker:update', { event: 'disconnected', whatsappReady: false });
  });

  try {
    await waClient.initialize();
  } catch (error) {
    waInitializing = false;
    waLastError = error.message;
    console.error(`[WA] ❌ Init failed: ${error.message}`);
    scheduleReconnect();
  }
}

function clearSessionAndReconnect() {
  try {
    if (waClient) {
      waClient.destroy().catch(() => {});
      waClient = null;
    }
    setTimeout(() => {
      try {
        if (fs.existsSync(SESSION_PATH)) {
          fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
          console.log('[WA] Session folder cleared.');
        }
      } catch (e) {
        console.warn(`[WA] Could not fully clear session (${e.code}) — continuing.`);
      }
      scheduleReconnect(2000);
    }, 3000);
  } catch (e) {
    console.warn(`[WA] clearSession error: ${e.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect(delay = RECONNECT_DELAY_MS) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await initWhatsApp();
  }, delay);
}

// ── Queue Processor ──────────────────────────────────────────────────────────

async function processNext() {
  if (isProcessing) return;
  if (!waReady) return;

  isProcessing = true;
  stats.lastPollAt = new Date().toISOString();

  try {
    // Step 1: Ask server for next notification
    const result = await apiGet('/api/worker/next');

    if (!result.success || !result.data?.notification) {
      isProcessing = false;
      return;
    }

    const notif = result.data.notification;
    console.log(`[WORKER] Sending to ${notif.parentPhone}...`);

    // Step 2: Attempt WhatsApp delivery
    const deliveryResult = await sendWhatsAppMessage(notif.parentPhone, notif.message);

    // Step 3: Report result to server
    if (deliveryResult.success) {
      await apiPatch(`/api/worker/${notif._id}/status`, { status: 'sent' });
      stats.processed++;
      console.log(`[WORKER] ✅ Sent to ${notif.parentPhone}`);
    } else {
      await apiPatch(`/api/worker/${notif._id}/status`, {
        status: 'failed',
        error: deliveryResult.error,
      });
      stats.failed++;
      console.warn(`[WORKER] ❌ Failed for ${notif.parentPhone}: ${deliveryResult.error}`);
    }

    // Anti-spam delay
    const gap = Math.floor(Math.random() * (MESSAGE_GAP_MAX - MESSAGE_GAP_MIN + 1)) + MESSAGE_GAP_MIN;
    await new Promise((r) => setTimeout(r, gap));
  } catch (error) {
    console.error(`[WORKER] Processing error: ${error.message}`);
  } finally {
    isProcessing = false;
    broadcastToRenderer('worker:update', {
      event: 'poll',
      whatsappReady: waReady,
      stats,
    });
  }
}

async function sendWhatsAppMessage(phone, message) {
  if (!waReady || !waClient || !waClient.pupPage) {
    return { success: false, error: 'WhatsApp client is not ready' };
  }

  try {
    const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';
    const isRegistered = await waClient.isRegisteredUser(chatId);
    if (!isRegistered) {
      return { success: false, error: `Number ${phone} is not registered on WhatsApp` };
    }
    await waClient.sendMessage(chatId, message);
    return { success: true };
  } catch (error) {
    if (error.message && (error.message.includes('createWid') || error.message.includes('null') || error.message.includes('pupPage'))) {
      waReady = false;
      console.warn('[WA] Lost page reference — marking as not ready.');
    }
    return { success: false, error: error.message };
  }
}

// ── IPC helper ───────────────────────────────────────────────────────────────

function broadcastToRenderer(channel, data) {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (win.webContents) {
        win.webContents.send(channel, data);
      }
    }
  } catch {
    // Renderer may not exist yet during startup
  }
}

// ── Public API (called from main.js) ─────────────────────────────────────────

function startWorker() {
  console.log('[WORKER] Starting notification worker...');
  initWhatsApp();
  pollTimer = setInterval(() => processNext(), POLL_INTERVAL_MS);
  processNext(); // Immediate first poll
}

async function stopWorker() {
  console.log('[WORKER] Stopping...');
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (waClient) {
    try {
      await waClient.destroy();
      waReady = false;
      waClient = null;
      console.log('[WA] Client disconnected.');
    } catch (e) {
      console.warn(`[WA] Disconnect warning: ${e.message}`);
      waReady = false;
    }
  }
}

function getWorkerStatus() {
  return {
    whatsappReady: waReady,
    whatsappInitializing: waInitializing,
    whatsappLastError: waLastError,
    stats,
  };
}

module.exports = { startWorker, stopWorker, getWorkerStatus };
