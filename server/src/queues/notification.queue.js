/**
 * Notification Queue Processor
 *
 * Runs on a configurable interval (default: 10 seconds).
 * Picks up queued/retryable notifications and sends them via WhatsApp.
 *
 * Design rules:
 * 1. Process ONE notification at a time (no parallelism)
 * 2. Random delay between messages (3-8 seconds) to avoid bot detection
 * 3. Max 3 retries per notification with exponential backoff
 * 4. Notifications only queued AFTER attendance is in the database
 * 5. If WhatsApp is not ready, skip the cycle (don't fail)
 *
 * Lifecycle: queued → sending → sent | failed
 */
const Notification = require('../models/Notification');
const AttendanceSession = require('../models/AttendanceSession');
const whatsappService = require('../services/whatsapp.service');
const {
  NOTIFICATION_STATUS,
  NOTIFICATION_CONFIG,
  SESSION_STATUS,
} = require('../config/constants');

class NotificationQueue {
  constructor() {
    this.isProcessing = false;
    this.intervalId = null;
    this.processedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Start the queue processor.
   * @param {number} intervalMs — How often to check for new notifications (default: 10s)
   */
  start(intervalMs = 10000) {
    if (this.intervalId) {
      console.log('[QUEUE] Already running.');
      return;
    }

    console.log(`[QUEUE] Notification processor started (interval: ${intervalMs / 1000}s)`);

    this.intervalId = setInterval(() => {
      this.processNext();
    }, intervalMs);

    // Also process immediately on start
    this.processNext();
  }

  /**
   * Stop the queue processor.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[QUEUE] Notification processor stopped.');
    }
  }

  /**
   * Process the next notification in the queue.
   */
  async processNext() {
    // Guard: don't overlap processing
    if (this.isProcessing) return;

    // Guard: WhatsApp must be ready
    if (!whatsappService.isReady) return;

    this.isProcessing = true;

    try {
      // Find the oldest queued notification (or one that's due for retry)
      const notification = await Notification.findOne({
        $or: [
          { status: NOTIFICATION_STATUS.QUEUED },
          {
            status: NOTIFICATION_STATUS.FAILED,
            retryCount: { $lt: NOTIFICATION_CONFIG.MAX_RETRIES },
            nextRetryAt: { $lte: new Date() },
          },
        ],
      }).sort({ queuedAt: 1 });

      if (!notification) {
        this.isProcessing = false;
        return;
      }

      // Mark as sending
      notification.status = NOTIFICATION_STATUS.SENDING;
      await notification.save();

      console.log(
        `[QUEUE] Sending notification ${notification._id} to ${notification.parentPhone}...`
      );

      // Send via WhatsApp
      const result = await whatsappService.sendMessage(
        notification.parentPhone,
        notification.message
      );

      if (result.success) {
        // ✅ Success
        notification.status = NOTIFICATION_STATUS.SENT;
        notification.sentAt = new Date();
        notification.errorReason = null;
        await notification.save();

        this.processedCount++;
        console.log(`[QUEUE] ✅ Sent to ${notification.parentPhone}`);

        // Update session status if all notifications for this session are sent
        await this._updateSessionStatus(notification.sessionId);
      } else {
        // ❌ Failed
        notification.retryCount += 1;
        notification.errorReason = result.error;

        if (notification.retryCount >= NOTIFICATION_CONFIG.MAX_RETRIES) {
          notification.status = NOTIFICATION_STATUS.FAILED;
          console.warn(
            `[QUEUE] ❌ Permanently failed for ${notification.parentPhone}: ${result.error}`
          );
        } else {
          // Schedule retry with exponential backoff
          notification.status = NOTIFICATION_STATUS.FAILED;
          const delay = notification.retryCount * NOTIFICATION_CONFIG.BASE_DELAY_MS;
          notification.nextRetryAt = new Date(Date.now() + delay);
          console.warn(
            `[QUEUE] ⚠️  Retry ${notification.retryCount}/${NOTIFICATION_CONFIG.MAX_RETRIES} ` +
            `for ${notification.parentPhone} in ${delay / 60000} min: ${result.error}`
          );
        }

        await notification.save();
        this.failedCount++;
      }

      // Anti-spam: random delay before processing the next one
      const delay = this._randomDelay(
        NOTIFICATION_CONFIG.MESSAGE_GAP_MIN_MS,
        NOTIFICATION_CONFIG.MESSAGE_GAP_MAX_MS
      );
      console.log(`[QUEUE] Waiting ${(delay / 1000).toFixed(1)}s before next message...`);
      await this._sleep(delay);
    } catch (error) {
      console.error(`[QUEUE] Processing error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if all notifications for a session are sent.
   * If so, update the session status to 'notifications_sent'.
   */
  async _updateSessionStatus(sessionId) {
    const pending = await Notification.countDocuments({
      sessionId,
      status: { $in: [NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.SENDING] },
    });

    if (pending === 0) {
      await AttendanceSession.findByIdAndUpdate(sessionId, {
        status: SESSION_STATUS.NOTIFICATIONS_SENT,
      });
      console.log(`[QUEUE] All notifications sent for session ${sessionId}`);
    }
  }

  /**
   * Get queue statistics.
   */
  async getStats() {
    const [queued, sending, sent, failed] = await Promise.all([
      Notification.countDocuments({ status: NOTIFICATION_STATUS.QUEUED }),
      Notification.countDocuments({ status: NOTIFICATION_STATUS.SENDING }),
      Notification.countDocuments({ status: NOTIFICATION_STATUS.SENT }),
      Notification.countDocuments({
        status: NOTIFICATION_STATUS.FAILED,
        retryCount: { $gte: NOTIFICATION_CONFIG.MAX_RETRIES },
      }),
    ]);

    return {
      queued,
      sending,
      sent,
      permanentlyFailed: failed,
      totalProcessed: this.processedCount,
      totalFailed: this.failedCount,
      whatsappStatus: whatsappService.getStatus(),
    };
  }

  /**
   * Random delay in the given range.
   */
  _randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep helper.
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
const notificationQueue = new NotificationQueue();

module.exports = notificationQueue;
