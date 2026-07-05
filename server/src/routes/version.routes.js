const router = require('express').Router();
const { checkVersion } = require('../controllers/version.controller');

// Version check is public — the app calls this before auth
router.get('/check', checkVersion);

module.exports = router;
