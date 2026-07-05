const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const { SESSION_STATUS, ATTENDANCE_STATUS } = require('../config/constants');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * GET /api/analytics/dashboard
 * Summary cards for the website dashboard
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const [
    totalStudents,
    totalSessions,
    recentSessions,
  ] = await Promise.all([
    Student.countDocuments({ status: 'active' }),
    AttendanceSession.countDocuments({ status: SESSION_STATUS.SUBMITTED }),
    AttendanceSession.find({ status: SESSION_STATUS.SUBMITTED })
      .sort({ date: -1 })
      .limit(7)
      .populate('classId', 'name'),
  ]);

  // Calculate overall attendance rate from recent sessions
  let totalPresent = 0;
  let totalMarked = 0;
  recentSessions.forEach((s) => {
    totalPresent += s.presentCount;
    totalMarked += s.totalStudents;
  });

  const attendanceRate = totalMarked > 0 ? ((totalPresent / totalMarked) * 100).toFixed(1) : 0;

  apiResponse(res, 200, {
    totalStudents,
    totalSessions,
    attendanceRate: parseFloat(attendanceRate),
    recentSessions,
  });
});

/**
 * GET /api/analytics/attendance
 * Attendance analytics for a class over a date range
 */
exports.getAttendanceAnalytics = asyncHandler(async (req, res) => {
  const { classId, from, to } = req.query;

  if (!classId) {
    return res.status(400).json({ success: false, message: 'classId is required' });
  }

  const filter = { classId, status: SESSION_STATUS.SUBMITTED };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const sessions = await AttendanceSession.find(filter).sort({ date: 1 });

  // Per-session breakdown for charting
  const timeline = sessions.map((s) => ({
    date: s.date,
    present: s.presentCount,
    absent: s.absentCount,
    total: s.totalStudents,
    rate: s.totalStudents > 0 ? ((s.presentCount / s.totalStudents) * 100).toFixed(1) : 0,
  }));

  apiResponse(res, 200, { timeline, sessionCount: sessions.length });
});

/**
 * GET /api/analytics/performance
 * Performance analytics for a student
 */
exports.getPerformanceAnalytics = asyncHandler(async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ success: false, message: 'studentId is required' });
  }

  // Get all marks with exam details
  const marks = await Marks.find({ studentId })
    .populate('examId', 'name subject maxMarks date')
    .sort({ 'examId.date': 1 });

  // Get attendance summary
  const attendanceRecords = await AttendanceRecord.find({ studentId });
  const totalClasses = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;

  apiResponse(res, 200, {
    marks,
    attendance: {
      total: totalClasses,
      present: presentCount,
      absent: totalClasses - presentCount,
      rate: totalClasses > 0 ? ((presentCount / totalClasses) * 100).toFixed(1) : 0,
    },
  });
});
