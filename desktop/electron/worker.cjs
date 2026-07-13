/**
 * CMS Lite Desktop — System Guardian (formerly "Notification Worker")
 *
 * Responsibilities:
 *   1. Wake backend if asleep (health check with backoff)
 *   2. Detect internet connectivity
 *   3. Retry connections automatically
 *   4. Process notification queue (WhatsApp delivery)
 *   5. Recover automatically from any failure
 *   6. Keep WhatsApp connected
 *
 * The user should NEVER see: ECONNREFUSED, Socket Timeout, HTTP 503.
 * Everything is invisible. The user just does their work.
 *
 * Adaptive polling:
 *   - Queue has work → poll every 3s
 *   - Queue empty    → back off to 30s
 *   - Offline        → pause completely
 *   - Online again   → health check → resume
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = process.env.CMS_API_URL || 'https://cli-ents.vercel.app';
const WORKER_KEY = process.env.WORKER_API_KEY || 'cmslite-worker-secret-2026';
const SESSION_PATH = path.join(
  require('electron').app.getPath('userData'),
  '.wwebjs_auth'
);

// Adaptive polling intervals
const POLL_FAST = 3000;       // 3s when queue has work
const POLL_SLOW = 30000;      // 30s when queue is empty
const POLL_IDLE_MAX = 60000;  // 60s absolute max between polls
const MESSAGE_GAP_MIN = 3000; // Anti-spam: 3s min between messages
const MESSAGE_GAP_MAX = 8000; // Anti-spam: 8s max between messages

// Health check backoff: 5s → 10s → 20s → 40s → 60s (cap)
const HEALTH_BACKOFF = [5000, 10000, 20000, 40000, 60000];
const RECONNECT_DELAY_MS = 10000;

// ── State ────────────────────────────────────────────────────────────────────
let waClient = null;
let waReady = false;
let waInitializing = false;
let waLastError = null;
let pollTimer = null;
let isProcessing = false;
let reconnectTimer = null;
let isOnline = true;            // network connectivity
let backendHealthy = false;     // backend reachable
let healthCheckAttempt = 0;     // for exponential backoff
let consecutiveEmpty = 0;       // track empty polls for adaptive speed
let isPaused = false;           // paused due to offline
let stats = { processed: 0, failed: 0, lastPollAt: null };

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function apiGet(urlPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_BASE}${urlPath}`, {
      headers: { 'x-worker-key': WORKER_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function apiPatch(urlPath, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_BASE}${urlPath}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-key': WORKER_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Health Check with Exponential Backoff ─────────────────────────────────────

/**
 * Silently checks if the backend is alive.
 * If asleep (Render free tier), retries with gentle backoff: 5s → 10s → 20s → 40s → 60s.
 * Returns true when healthy, never throws.
 */
async function ensureBackendHealthy() {
  if (backendHealthy) return true;
  if (!isOnline) return false;

  while (healthCheckAttempt <= HEALTH_BACKOFF.length) {
    try {
      const result = await apiGet('/api/health');
      if (result.success) {
        backendHealthy = true;
        healthCheckAttempt = 0;
        console.log('[GUARDIAN] ✅ Backend is healthy');
        broadcastStatus('backend_ready');
        return true;
      }
    } catch (err) {
      // Silently handle — this is expected during cold starts
    }

    const delay = HEALTH_BACKOFF[Math.min(healthCheckAttempt, HEALTH_BACKOFF.length - 1)];
    healthCheckAttempt++;
    console.log(`[GUARDIAN] Backend not ready, retry ${healthCheckAttempt} in ${delay / 1000}s...`);
    broadcastStatus('waking_backend');

    await new Promise((r) => setTimeout(r, delay));

    // Check if we went offline during the wait
    if (!isOnline) return false;
  }

  console.warn('[GUARDIAN] Backend health check exhausted — will retry later');
  return false;
}

// ── Network Detection ────────────────────────────────────────────────────────

function handleOnline() {
  if (isOnline) return;
  isOnline = true;
  isPaused = false;
  console.log('[GUARDIAN] 🌐 Network online — resuming...');
  broadcastStatus('online');

  // Reset health check and try again
  backendHealthy = false;
  healthCheckAttempt = 0;
  scheduleNextPoll(500); // Quick restart
}

function handleOffline() {
  if (!isOnline) return;
  isOnline = false;
  isPaused = true;
  console.log('[GUARDIAN] ⚡ Network offline — pausing...');
  broadcastStatus('offline');

  // Clear any pending poll
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
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

    // Kick the polling loop — it may have stopped because WA wasn't ready
    if (backendHealthy && !isProcessing) {
      console.log('[GUARDIAN] WA ready — starting queue processing...');
      scheduleNextPoll(POLL_FAST);
    }
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
    if (isOnline) await initWhatsApp();
  }, delay);
}

// ── Adaptive Queue Processor ─────────────────────────────────────────────────

async function processNext() {
  if (isProcessing || !isOnline || isPaused) return;
  if (!waReady) {
    // WhatsApp not ready yet — reschedule so polling doesn't die
    scheduleNextPoll(POLL_SLOW);
    return;
  }

  // Ensure backend is reachable before polling
  if (!backendHealthy) {
    const healthy = await ensureBackendHealthy();
    if (!healthy) {
      scheduleNextPoll(POLL_SLOW);
      return;
    }
  }

  isProcessing = true;
  stats.lastPollAt = new Date().toISOString();

  try {
    // Step 1: Ask server for next notification
    const result = await apiGet('/api/worker/next');

    if (!result.success || !result.data?.notification) {
      // Queue is empty — slow down polling
      consecutiveEmpty++;
      isProcessing = false;
      scheduleNextPoll(adaptiveInterval());
      return;
    }

    // Queue has work — reset to fast polling
    consecutiveEmpty = 0;

    const notif = result.data.notification;
    console.log(`[GUARDIAN] Sending to ${notif.parentPhone}...`);

    // Step 2: Attempt WhatsApp delivery
    const deliveryResult = await sendWhatsAppMessage(notif.parentPhone, notif.message);

    // Step 3: Report result to server
    if (deliveryResult.success) {
      await apiPatch(`/api/worker/${notif._id}/status`, { status: 'sent' });
      stats.processed++;
      console.log(`[GUARDIAN] ✅ Sent to ${notif.parentPhone}`);
    } else {
      await apiPatch(`/api/worker/${notif._id}/status`, {
        status: 'failed',
        error: deliveryResult.error,
      });
      stats.failed++;
      console.warn(`[GUARDIAN] ❌ Failed for ${notif.parentPhone}: ${deliveryResult.error}`);
    }

    // Anti-spam delay
    const gap = Math.floor(Math.random() * (MESSAGE_GAP_MAX - MESSAGE_GAP_MIN + 1)) + MESSAGE_GAP_MIN;
    await new Promise((r) => setTimeout(r, gap));

    // Schedule next poll immediately (fast mode — more work may exist)
    scheduleNextPoll(POLL_FAST);
  } catch (error) {
    console.error(`[GUARDIAN] Processing error: ${error.message}`);

    // If we got a network error, mark backend as unhealthy
    if (!error.response) {
      backendHealthy = false;
      healthCheckAttempt = 0;
    }

    scheduleNextPoll(POLL_SLOW);
  } finally {
    isProcessing = false;
    broadcastToRenderer('worker:update', {
      event: 'poll',
      whatsappReady: waReady,
      stats,
      isOnline,
      backendHealthy,
    });
  }
}

/**
 * Adaptive polling interval:
 *   0 empty polls → 3s (fast)
 *   1-2 empty    → 10s
 *   3-5 empty    → 30s
 *   6+ empty     → 60s (max)
 */
function adaptiveInterval() {
  if (consecutiveEmpty === 0) return POLL_FAST;
  if (consecutiveEmpty <= 2) return 10000;
  if (consecutiveEmpty <= 5) return POLL_SLOW;
  return POLL_IDLE_MAX;
}

function scheduleNextPoll(delay) {
  if (pollTimer) clearTimeout(pollTimer);
  if (!isOnline || isPaused) return;
  pollTimer = setTimeout(() => processNext(), delay);
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

// ── IPC + Status ─────────────────────────────────────────────────────────────

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

function broadcastStatus(event) {
  broadcastToRenderer('worker:update', {
    event,
    whatsappReady: waReady,
    isOnline,
    backendHealthy,
    stats,
  });
}

// ── Public API (called from main.js) ─────────────────────────────────────────

function startWorker() {
  console.log('[GUARDIAN] 🛡️ Starting System Guardian...');

  // Network detection via Electron's net module
  const { net } = require('electron');

  // Check initial connectivity
  isOnline = net.isOnline();
  console.log(`[GUARDIAN] Initial network state: ${isOnline ? 'online' : 'offline'}`);

  // Listen for connectivity changes
  // Electron doesn't have direct online/offline events in main process,
  // so we use a periodic check
  setInterval(() => {
    const nowOnline = net.isOnline();
    if (nowOnline && !isOnline) handleOnline();
    else if (!nowOnline && isOnline) handleOffline();
  }, 5000);

  // Initialize WhatsApp
  initWhatsApp();

  // Start with health check, then begin polling
  ensureBackendHealthy().then(() => {
    processNext();
  });
}

async function stopWorker() {
  console.log('[GUARDIAN] Stopping...');
  if (pollTimer) {
    clearTimeout(pollTimer);
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
    isOnline,
    backendHealthy,
    stats,
  };
}

module.exports = { startWorker, stopWorker, getWorkerStatus };
