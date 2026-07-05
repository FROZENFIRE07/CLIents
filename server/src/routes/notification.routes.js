const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.getNotifications);
router.get('/stats', ctrl.getNotificationStats);

module.exports = router;
