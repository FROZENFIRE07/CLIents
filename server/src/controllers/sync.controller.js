const Class = require('../models/Class');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const Exam = require('../models/Exam');
const Marks = require('../models/Marks');
const Notification = require('../models/Notification');
const { asyncHandler, apiResponse } = require('../utils/helpers');
const { buildFullPayload } = require('./bootstrap.controller');

const COMPLETED_SESSION_STATUSES = ['submitted', 'notifications_sent'];

/**
 * GET /api/sync?since=ISO_TIMESTAMP
 *
 * Incremental delta sync.
 * - If `since` is provided → returns only records changed after that time.
 * - If `since` is omitted → delegates to buildFullPayload() for a full sync.
 */
const sync = asyncHandler(async (req, res) => {
  const { since } = req.query;

  // No since = full sync → same as bootstrap (minus user)
  if (!since) {
    const payload = await buildFullPayload();
    return apiResponse(res, 200, payload);
  }

  // Delta sync — only changed records
  const timeFilter = { updatedAt: { $gt: new Date(since) } };
  const serverTimestamp = new Date().toISOString();
  const CAP = 500;

  const [classes, students, sessions, exams, marks, notifications] =
    await Promise.all([
      Class.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Student.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      AttendanceSession.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Exam.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Marks.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Notification.find(timeFilter)
        .populate('studentId', 'fullName rollNo')
        .sort({ updatedAt: -1 }).limit(CAP).lean(),
    ]);

  // Dashboard analytics — always fresh
  const [totalStudents, totalSessions, notifStats, attendanceAgg] =
    await Promise.all([
      Student.countDocuments({ status: 'active' }),
      AttendanceSession.countDocuments({ status: { $in: COMPLETED_SESSION_STATUSES } }),
      Notification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      AttendanceSession.aggregate([
        { $match: { status: { $in: COMPLETED_SESSION_STATUSES } } },
        { $group: { _id: null, totalPresent: { $sum: '$presentCount' }, totalStudents: { $sum: '$totalStudents' } } },
      ]),
    ]);

  const avgAttendance =
    attendanceAgg.length && attendanceAgg[0].totalStudents > 0
      ? +((attendanceAgg[0].totalPresent / attendanceAgg[0].totalStudents) * 100).toFixed(1)
      : 0;

  const statsMap = {};
  notifStats.forEach((s) => { statsMap[s._id] = s.count; });

  return apiResponse(res, 200, {
    classes,
    students,
    sessions,
    exams,
    marks,
    notifications,
    dashboard: {
      totalStudents,
      averageAttendance: avgAttendance,
      totalSessions,
      msgsSent: statsMap.sent || 0,
      pendingAttendance: 0,
      upcomingExams: 0,
    },
    notifStats: {
      queued: statsMap.queued || 0,
      sending: statsMap.sending || 0,
      sent: statsMap.sent || 0,
      failed: statsMap.failed || 0,
      expired: statsMap.expired || 0,
    },
    serverTimestamp,
  });
});

module.exports = { sync };
