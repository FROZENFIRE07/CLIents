/**
 * Worker Controller
 *
 * Server-side business logic for the desktop notification worker.
 * The desktop worker is a dumb delivery pipe — it asks "what to send?"
 * and reports "what happened". All decisions (expiry, retries, status
 * transitions) happen HERE, never on the client.
 */
const Notification = require('../models/Notification');
const AttendanceSession = require('../models/AttendanceSession');
const {
  NOTIFICATION_STATUS,
  NOTIFICATION_CONFIG,
  SESSION_STATUS,
} = require('../config/constants');

/**
 * GET /api/worker/next
 *
 * 1. Bulk-expire all stale notifications (attendanceDate !== today)
 * 2. Find the oldest queued or retryable notification
 * 3. Mark it as 'sending' and return it to the worker
 */
exports.getNextNotification = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // ── Step 1: Bulk-expire stale notifications ────────────────────────
    const expireResult = await Notification.updateMany(
      {
        status: { $in: [NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.FAILED] },
        attendanceDate: { $ne: today },
      },
      {
        $set: {
          status: NOTIFICATION_STATUS.EXPIRED,
          errorReason: 'Notification expired: attendance date has passed',
        },
      }
    );

    if (expireResult.modifiedCount > 0) {
      console.log(`[WORKER-API] Expired ${expireResult.modifiedCount} stale notification(s)`);
    }

    // ── Step 2: Find next valid notification ───────────────────────────
    const notification = await Notification.findOne({
      $or: [
        { status: NOTIFICATION_STATUS.QUEUED },
        {
          status: NOTIFICATION_STATUS.FAILED,
          retryCount: { $lt: NOTIFICATION_CONFIG.MAX_RETRIES },
          nextRetryAt: { $lte: new Date() },
        },
      ],
    })
      .sort({ queuedAt: 1 })
      .lean();

    if (!notification) {
      return res.json({ success: true, data: { notification: null } });
    }

    // ── Step 3: Mark as sending ────────────────────────────────────────
    await Notification.findByIdAndUpdate(notification._id, {
      status: NOTIFICATION_STATUS.SENDING,
    });

    res.json({
      success: true,
      data: {
        notification: {
          _id: notification._id,
          parentPhone: notification.parentPhone,
          message: notification.message,
          sessionId: notification.sessionId,
          retryCount: notification.retryCount,
        },
      },
    });
  } catch (error) {
    console.error(`[WORKER-API] getNext error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/worker/:id/status
 *
 * Worker reports delivery result. Server handles:
 * - Success → mark as sent, check if all session notifications are done
 * - Failure → increment retry, schedule next attempt or mark permanent failure
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error: errorMsg } = req.body;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (status === 'sent') {
      // ── Success ────────────────────────────────────────────────────────
      notification.status = NOTIFICATION_STATUS.SENT;
      notification.sentAt = new Date();
      notification.errorReason = null;
      await notification.save();

      // Check if all notifications for this session are done
      const pending = await Notification.countDocuments({
        sessionId: notification.sessionId,
        status: { $in: [NOTIFICATION_STATUS.QUEUED, NOTIFICATION_STATUS.SENDING] },
      });

      if (pending === 0) {
        await AttendanceSession.findByIdAndUpdate(notification.sessionId, {
          status: SESSION_STATUS.NOTIFICATIONS_SENT,
        });
      }

      return res.json({ success: true, data: { status: 'sent' } });
    }

    if (status === 'failed') {
      // ── Failure ────────────────────────────────────────────────────────
      notification.retryCount += 1;
      notification.errorReason = errorMsg || 'Unknown error';

      if (notification.retryCount >= NOTIFICATION_CONFIG.MAX_RETRIES) {
        // Permanent failure
        notification.status = NOTIFICATION_STATUS.FAILED;
      } else {
        // Schedule retry with exponential backoff
        notification.status = NOTIFICATION_STATUS.FAILED;
        const delay = notification.retryCount * NOTIFICATION_CONFIG.BASE_DELAY_MS;
        notification.nextRetryAt = new Date(Date.now() + delay);
      }

      await notification.save();
      return res.json({
        success: true,
        data: {
          status: notification.status,
          retryCount: notification.retryCount,
          nextRetryAt: notification.nextRetryAt,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid status. Use "sent" or "failed".' });
  } catch (error) {
    console.error(`[WORKER-API] updateStatus error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/worker/stats
 *
 * Returns queue statistics for the desktop notification monitoring page.
 */
exports.getStats = async (req, res) => {
  try {
    const [queued, sending, sent, failed, expired] = await Promise.all([
      Notification.countDocuments({ status: NOTIFICATION_STATUS.QUEUED }),
      Notification.countDocuments({ status: NOTIFICATION_STATUS.SENDING }),
      Notification.countDocuments({ status: NOTIFICATION_STATUS.SENT }),
      Notification.countDocuments({
        status: NOTIFICATION_STATUS.FAILED,
        retryCount: { $gte: NOTIFICATION_CONFIG.MAX_RETRIES },
      }),
      Notification.countDocuments({ status: NOTIFICATION_STATUS.EXPIRED }),
    ]);

    res.json({
      success: true,
      data: { queued, sending, sent, permanentlyFailed: failed, expired },
    });
  } catch (error) {
    console.error(`[WORKER-API] getStats error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
