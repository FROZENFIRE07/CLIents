const Class = require('../models/Class');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const Exam = require('../models/Exam');
const Marks = require('../models/Marks');
const Notification = require('../models/Notification');
const { asyncHandler, apiResponse } = require('../utils/helpers');

const COMPLETED_SESSION_STATUSES = ['submitted', 'notifications_sent'];

/**
 * Shared function that builds the full data payload.
 * Used by both /bootstrap and /sync (when since is empty).
 * Returns everything the client needs in a single object.
 *
 * Notifications are populated with studentId → { fullName }
 * so the UI can display student names without a separate lookup.
 */
async function buildFullPayload() {
  const serverTimestamp = new Date().toISOString();
  const CAP = 500;

  // All entities + analytics in parallel — one DB round trip
  const [
    classes, students, sessions, exams, marks, notifications,
    totalStudents, totalSessions, notifStats, attendanceAgg,
  ] = await Promise.all([
    Class.find().sort({ updatedAt: -1 }).limit(CAP).lean(),
    Student.find().sort({ updatedAt: -1 }).limit(CAP).lean(),
    AttendanceSession.find().sort({ updatedAt: -1 }).limit(CAP).lean(),
    Exam.find().sort({ updatedAt: -1 }).limit(CAP).lean(),
    Marks.find().sort({ updatedAt: -1 }).limit(CAP).lean(),
    Notification.find()
      .populate('studentId', 'fullName rollNo')
      .sort({ updatedAt: -1 })
      .limit(CAP)
      .lean(),
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

  return {
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
  };
}

/**
 * GET /api/bootstrap
 *
 * Single request that returns everything the client needs on startup:
 *   - Authenticated user
 *   - All classes, students, sessions, exams, marks, notifications
 *   - Dashboard analytics, notification stats
 *   - Server timestamp for future delta syncs
 *
 * Replaces: GET /auth/me + GET /sync (initial) + GET /dashboard + ...
 * One request. One invocation. One network trip.
 */
const bootstrap = asyncHandler(async (req, res) => {
  const payload = await buildFullPayload();

  return apiResponse(res, 200, {
    user: req.user,
    ...payload,
  });
});

module.exports = { bootstrap, buildFullPayload };
