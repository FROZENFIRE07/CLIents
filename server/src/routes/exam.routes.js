const router = require('express').Router();
const ctrl = require('../controllers/exam.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', ctrl.createExam);
router.get('/', ctrl.getExams);
router.post('/:id/marks', ctrl.submitMarks);
router.get('/:id/marks', ctrl.getMarks);

module.exports = router;
