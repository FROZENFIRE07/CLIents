const router = require('express').Router();
const ctrl = require('../controllers/student.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.getStudents);
router.get('/:id', ctrl.getStudent);
router.post('/', ctrl.createStudent);
router.put('/:id', ctrl.updateStudent);
router.patch('/:id/archive', ctrl.archiveStudent);

module.exports = router;
