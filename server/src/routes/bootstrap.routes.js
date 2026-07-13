const router = require('express').Router();
const { bootstrap } = require('../controllers/bootstrap.controller');
const { protect } = require('../middleware/auth');

// GET /api/bootstrap — single request for everything on startup
router.get('/', protect, bootstrap);

module.exports = router;
