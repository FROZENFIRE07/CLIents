const AppVersion = require('../models/AppVersion');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * GET /api/version/check?current=1.0.0
 * Check if an update is available
 */
exports.checkVersion = asyncHandler(async (req, res) => {
  const { current } = req.query;

  if (!current) {
    return res.status(400).json({ success: false, message: 'current version is required' });
  }

  // Get the latest version entry
  const latest = await AppVersion.findOne().sort({ createdAt: -1 });

  if (!latest) {
    return apiResponse(res, 200, { updateAvailable: false });
  }

  const updateAvailable = current !== latest.version;
  const forceUpdate = latest.mandatory && isVersionBelow(current, latest.minimumVersion);

  apiResponse(res, 200, {
    updateAvailable,
    forceUpdate,
    latest: updateAvailable ? latest : undefined,
  });
});

/**
 * Simple semver comparison: is vA < vB?
 */
function isVersionBelow(vA, vB) {
  const partsA = vA.split('.').map(Number);
  const partsB = vB.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((partsA[i] || 0) < (partsB[i] || 0)) return true;
    if ((partsA[i] || 0) > (partsB[i] || 0)) return false;
  }
  return false;
}

module.exports = exports;
