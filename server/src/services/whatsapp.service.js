/**
 * WhatsApp Service — manages whatsapp-web.js client lifecycle.
 *
 * Responsibilities:
 * - Initialize client with session persistence (LocalAuth)
 * - QR code display for first-time pairing
 * - Connection state tracking
 * - Send message with phone number formatting
 * - Auto-reconnect after LOGOUT or unexpected disconnect
 * - Graceful EBUSY file-lock handling (Windows)
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(process.cwd(), '.wwebjs_auth');
const RECONNECT_DELAY_MS = 10000; // 10 seconds before retry after logout

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isInitializing = false;
    this.lastError = null;
    this._reconnectTimer = null;
  }

  /**
   * Initialize the WhatsApp client.
   * Session data is stored in .wwebjs_auth/ for persistence across restarts.
   */
  async initialize() {
    if (this.isInitializing || this.isReady) {
      console.log('[WA] Already initialized or initializing.');
      return;
    }

    // Clear any pending reconnect timer
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    this.isInitializing = true;
    console.log('[WA] Initializing WhatsApp client...');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_PATH,
      }),
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
      // Give puppeteer more time to start on Windows
      authTimeoutMs: 120000,
    });

    // QR Code — displayed in terminal for first-time pairing
    this.client.on('qr', (qr) => {
      console.log('\n[WA] ========================================');
      console.log('[WA]  Scan this QR code with WhatsApp:');
      console.log('[WA] ========================================\n');
      qrcode.generate(qr, { small: true });
      console.log('\n[WA] Waiting for scan...\n');
    });

    // Ready — session established
    this.client.on('ready', () => {
      this.isReady = true;
      this.isInitializing = false;
      this.lastError = null;
      console.log('[WA] ✅ WhatsApp client is ready!');
    });

    // Authentication success
    this.client.on('authenticated', () => {
      console.log('[WA] Session authenticated successfully.');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      this.isReady = false;
      this.isInitializing = false;
      this.lastError = `Auth failure: ${msg}`;
      console.error(`[WA] ❌ Authentication failed: ${msg}`);
      // Wipe session and reconnect so fresh QR is shown
      this._clearSessionAndReconnect();
    });

    // Disconnected — handle LOGOUT vs network drop
    this.client.on('disconnected', (reason) => {
      this.isReady = false;
      this.isInitializing = false;
      this.lastError = `Disconnected: ${reason}`;
      console.warn(`[WA] ⚠️  Disconnected: ${reason}`);

      if (reason === 'LOGOUT') {
        // Phone actively logged out — clear session, show new QR after delay
        console.log('[WA] LOGOUT detected — will clear session and reconnect in 10s...');
        this._clearSessionAndReconnect();
      } else {
        // Network drop or server issue — just reinitialize
        console.log('[WA] Will attempt reconnect in 10s...');
        this._scheduleReconnect();
      }
    });

    try {
      await this.client.initialize();
    } catch (error) {
      this.isInitializing = false;
      this.lastError = error.message;
      console.error(`[WA] ❌ Failed to initialize: ${error.message}`);
      // Retry after delay
      this._scheduleReconnect();
    }
  }

  /**
   * Wipe the local session folder (handles Windows EBUSY gracefully),
   * then schedule reconnect.
   */
  _clearSessionAndReconnect() {
    try {
      // Attempt to destroy first (ignore errors — Chromium may already be dead)
      if (this.client) {
        this.client.destroy().catch(() => {});
        this.client = null;
      }

      // Wait a moment for file handles to release, then wipe session
      setTimeout(() => {
        try {
          if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
            console.log('[WA] Session folder cleared.');
          }
        } catch (e) {
          // EBUSY on Windows — non-fatal, old session files will be overwritten
          console.warn(`[WA] Could not fully clear session (${e.code}) — continuing anyway.`);
        }
        this._scheduleReconnect(2000);
      }, 3000);
    } catch (e) {
      console.warn(`[WA] _clearSessionAndReconnect error: ${e.message}`);
      this._scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnect attempt after a delay.
   */
  _scheduleReconnect(delayMs = RECONNECT_DELAY_MS) {
    if (this._reconnectTimer) return; // already scheduled
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      console.log('[WA] Attempting reconnect...');
      await this.initialize();
    }, delayMs);
  }

  /**
   * Send a WhatsApp message.
   * @param {string} phone — Phone number (with country code, e.g. "919876543210")
   * @param {string} message — Message text
   * @returns {{ success: boolean, error?: string }}
   */
  async sendMessage(phone, message) {
    // Double-check: flag AND actual client/page existence (race condition guard)
    if (!this.isReady || !this.client || !this.client.pupPage) {
      return { success: false, error: 'WhatsApp client is not ready' };
    }

    try {
      const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';

      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        return { success: false, error: `Number ${phone} is not registered on WhatsApp` };
      }

      await this.client.sendMessage(chatId, message);
      return { success: true };
    } catch (error) {
      // If we get a page/null error, mark as not ready so queue skips until reconnect
      if (error.message && (error.message.includes('createWid') || error.message.includes('null') || error.message.includes('pupPage'))) {
        this.isReady = false;
        console.warn('[WA] Lost page reference — marking as not ready, will reconnect.');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current status of the WhatsApp service.
   */
  getStatus() {
    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      lastError: this.lastError,
    };
  }

  /**
   * Gracefully disconnect the client.
   */
  async disconnect() {
    // Cancel any pending reconnect
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.destroy();
        this.isReady = false;
        this.client = null;
        console.log('[WA] Client disconnected.');
      } catch (error) {
        // Ignore EBUSY on Windows during shutdown
        console.warn(`[WA] Disconnect warning: ${error.message}`);
        this.isReady = false;
      }
    }
  }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
