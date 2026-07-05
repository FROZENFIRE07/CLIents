const Notification = require('../models/Notification');
const { asyncHandler, apiResponse } = require('../utils/helpers');

exports.getNotifications = asyncHandler(async (req, res) => {
  const { sessionId, status, limit = 50, page = 1 } = req.query;
  const filter = {};
  if (sessionId) filter.sessionId = sessionId;
  if (status) filter.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate('studentId', 'rollNo fullName')
      .sort({ queuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments(filter),
  ]);

  apiResponse(res, 200, {
    notifications,
    pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
  });
});

exports.getNotificationStats = asyncHandler(async (req, res) => {
  const stats = await Notification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const result = { queued: 0, sending: 0, sent: 0, failed: 0 };
  stats.forEach((s) => { result[s._id] = s.count; });
  apiResponse(res, 200, { stats: result });
});
