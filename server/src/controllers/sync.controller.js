const Class = require('../models/Class');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Exam = require('../models/Exam');
const Marks = require('../models/Marks');
const Notification = require('../models/Notification');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * GET /api/sync?since=ISO_TIMESTAMP
 *
 * Unified incremental sync endpoint.
 * Returns all records that changed after `since`.
 * If `since` is omitted, returns the FULL dataset (initial sync).
 *
 * Response shape:
 * {
 *   classes: [...],
 *   students: [...],
 *   sessions: [...],
 *   records: [...],
 *   exams: [...],
 *   marks: [...],
 *   notifications: [...],
 *   dashboard: { totalStudents, averageAttendance, ... },
 *   notifStats: { queued, sending, sent, failed, expired },
 *   serverTimestamp: "ISO string"
 * }
 *
 * Cap: 500 records per entity per call to prevent payload explosion.
 */
const sync = asyncHandler(async (req, res) => {
  const { since } = req.query;

  // Build time filter — if since is provided, only return changed records
  const timeFilter = since ? { updatedAt: { $gt: new Date(since) } } : {};

  // Capture server time BEFORE queries to avoid missing concurrent writes
  const serverTimestamp = new Date().toISOString();

  const CAP = 500;

  // Fetch all changed entities in parallel
  const [classes, students, sessions, exams, marks, notifications] =
    await Promise.all([
      Class.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Student.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      AttendanceSession.find(timeFilter)
        .sort({ updatedAt: -1 })
        .limit(CAP)
        .lean(),
      Exam.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Marks.find(timeFilter).sort({ updatedAt: -1 }).limit(CAP).lean(),
      Notification.find(timeFilter)
        .sort({ updatedAt: -1 })
        .limit(CAP)
        .lean(),
    ]);

  // Dashboard analytics — always compute fresh (cheap aggregate)
  const [totalStudents, totalSessions, notifStats] = await Promise.all([
    Student.countDocuments({ status: 'active' }),
    AttendanceSession.countDocuments({ status: 'submitted' }),
    Notification.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Compute average attendance from all submitted sessions
  const attendanceAgg = await AttendanceSession.aggregate([
    { $match: { status: 'submitted' } },
    {
      $group: {
        _id: null,
        totalPresent: { $sum: '$presentCount' },
        totalStudents: { $sum: '$totalStudents' },
      },
    },
  ]);

  const avgAttendance =
    attendanceAgg.length && attendanceAgg[0].totalStudents > 0
      ? +(
          (attendanceAgg[0].totalPresent / attendanceAgg[0].totalStudents) *
          100
        ).toFixed(1)
      : 0;

  // Flatten notif stats
  const statsMap = {};
  notifStats.forEach((s) => {
    statsMap[s._id] = s.count;
  });

  const dashboard = {
    totalStudents,
    averageAttendance: avgAttendance,
    totalSessions,
    msgsSent: statsMap.sent || 0,
    pendingAttendance: 0, // computed client-side from sessions
    upcomingExams: 0, // computed client-side from exams
  };

  const notifStatsFlat = {
    queued: statsMap.queued || 0,
    sending: statsMap.sending || 0,
    sent: statsMap.sent || 0,
    failed: statsMap.failed || 0,
    expired: statsMap.expired || 0,
  };

  return apiResponse(res, 200, {
    classes,
    students,
    sessions,
    exams,
    marks,
    notifications,
    dashboard,
    notifStats: notifStatsFlat,
    serverTimestamp,
  });
});

module.exports = { sync };
