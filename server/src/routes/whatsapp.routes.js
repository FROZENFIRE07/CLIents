const router = require('express').Router();
const whatsappService = require('../services/whatsapp.service');
const notificationQueue = require('../queues/notification.queue');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler, apiResponse } = require('../utils/helpers');

// All WhatsApp management routes require admin
router.use(protect);
router.use(authorize('admin'));

/**
 * GET /api/whatsapp/status
 * Get WhatsApp connection status + queue stats
 */
router.get('/status', asyncHandler(async (req, res) => {
  const waStatus = whatsappService.getStatus();
  const queueStats = await notificationQueue.getStats();

  apiResponse(res, 200, { whatsapp: waStatus, queue: queueStats });
}));

/**
 * POST /api/whatsapp/initialize
 * Manually trigger WhatsApp initialization (if not auto-started)
 */
router.post('/initialize', asyncHandler(async (req, res) => {
  if (whatsappService.isReady) {
    return apiResponse(res, 200, { message: 'WhatsApp is already connected' });
  }

  // Initialize in background (don't await — it takes time for QR scan)
  whatsappService.initialize();

  apiResponse(res, 202, { message: 'WhatsApp initialization started. Check terminal for QR code.' });
}));

/**
 * POST /api/whatsapp/disconnect
 * Disconnect WhatsApp session
 */
router.post('/disconnect', asyncHandler(async (req, res) => {
  await whatsappService.disconnect();
  apiResponse(res, 200, { message: 'WhatsApp disconnected' });
}));

/**
 * POST /api/whatsapp/test
 * Send a test message to verify the connection
 */
router.post('/test', asyncHandler(async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      message: 'Phone and message are required',
    });
  }

  const result = await whatsappService.sendMessage(phone, message);

  if (result.success) {
    apiResponse(res, 200, { message: 'Test message sent successfully' });
  } else {
    res.status(500).json({
      success: false,
      message: `Failed to send: ${result.error}`,
    });
  }
}));

module.exports = router;
