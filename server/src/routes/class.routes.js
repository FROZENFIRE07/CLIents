const router = require('express').Router();
const { getClasses, getClass, createClass, updateClass } = require('../controllers/class.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect); // All class routes require auth

router.get('/', getClasses);
router.get('/:id', getClass);
router.post('/', authorize('admin'), createClass);
router.put('/:id', authorize('admin'), updateClass);

module.exports = router;
