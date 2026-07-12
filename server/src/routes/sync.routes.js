const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { sync } = require('../controllers/sync.controller');

// GET /api/sync?since=ISO_TIMESTAMP
// Protected — requires valid JWT
router.get('/', protect, sync);

module.exports = router;
