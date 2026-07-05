const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', ctrl.getDashboard);
router.get('/attendance', ctrl.getAttendanceAnalytics);
router.get('/performance', ctrl.getPerformanceAnalytics);

module.exports = router;
