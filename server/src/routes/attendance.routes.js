const router = require('express').Router();
const ctrl = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/sessions', ctrl.createSession);
router.get('/sessions', ctrl.getSessions);
router.get('/absent-on-date', ctrl.getAbsentOnDate);  // for marks entry
router.get('/sessions/:id', ctrl.getSession);
router.put('/sessions/:id/submit', ctrl.submitSession);
router.post('/sync', ctrl.syncOfflineSession);

module.exports = router;
