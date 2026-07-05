/**
 * Worker API Routes
 *
 * Consumed by the desktop notification worker.
 * Authenticated via WORKER_API_KEY (shared secret), not JWT.
 */
const router = require('express').Router();
const ctrl = require('../controllers/worker.controller');
const { workerAuth } = require('../middleware/auth');

router.use(workerAuth);

router.get('/next',         ctrl.getNextNotification);  // Fetch + auto-expire stale
router.patch('/:id/status', ctrl.updateStatus);         // Worker reports delivery result
router.get('/stats',        ctrl.getStats);              // Dashboard monitoring

module.exports = router;
