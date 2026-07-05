const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { SESSION_STATUS, ATTENDANCE_STATUS, NOTIFICATION_STATUS, STUDENT_STATUS } = require('../config/constants');
const { asyncHandler, apiResponse, normalizeDate } = require('../utils/helpers');

/**
 * POST /api/attendance/sessions
 * Create a new draft attendance session for a class+date.
 * Returns existing session if one already exists (idempotent for offline sync).
 */
exports.createSession = asyncHandler(async (req, res) => {
  const { classId, date } = req.body;
  const normalizedDate = normalizeDate(date || new Date());

  // Check for existing session (idempotent — safe for offline retries)
  let session = await AttendanceSession.findOne({
    classId,
    date: normalizedDate,
  });

  if (session) {
    const records = await AttendanceRecord.find({ sessionId: session._id })
      .populate('studentId', 'rollNo fullName');

    return apiResponse(res, 200, { session, records }, 'Session already exists');
  }

  // Count active students in this class
  const totalStudents = await Student.countDocuments({
    classId,
    status: STUDENT_STATUS.ACTIVE,
  });

  session = await AttendanceSession.create({
    classId,
    date: normalizedDate,
    totalStudents,
    createdBy: req.user._id,
  });

  apiResponse(res, 201, { session, records: [] }, 'Draft session created');
});

/**
 * GET /api/attendance/sessions
 * List sessions for a class, newest first
 */
exports.getSessions = asyncHandler(async (req, res) => {
  const { classId, limit = 30 } = req.query;

  if (!classId) {
    return res.status(400).json({
      success: false,
      message: 'classId is required',
    });
  }

  const sessions = await AttendanceSession.find({ classId })
    .sort({ date: -1 })
    .limit(parseInt(limit))
    .populate('createdBy', 'name');

  apiResponse(res, 200, { sessions });
});

/**
 * GET /api/attendance/sessions/:id
 * Get a single session with all its records
 */
exports.getSession = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id)
    .populate('classId', 'name standard')
    .populate('createdBy', 'name');

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const records = await AttendanceRecord.find({ sessionId: session._id })
    .populate('studentId', 'rollNo fullName');

  apiResponse(res, 200, { session, records });
});

/**
 * PUT /api/attendance/sessions/:id/submit
 * Final submission — saves all records, updates counts, queues notifications.
 * This is the critical path. Attendance is saved FIRST, then notifications are queued.
 */
exports.submitSession = asyncHandler(async (req, res) => {
  const { records } = req.body; // [{ studentId, status }]
  const session = await AttendanceSession.findById(req.params.id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  if (session.status === SESSION_STATUS.SUBMITTED) {
    return res.status(409).json({
      success: false,
      message: 'Session already submitted',
    });
  }

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Attendance records are required',
    });
  }

  // --- Step 1: Save all attendance records (upsert for idempotency) ---
  const bulkOps = records.map((record) => ({
    updateOne: {
      filter: { sessionId: session._id, studentId: record.studentId },
      update: {
        $set: {
          status: record.status,
          markedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  await AttendanceRecord.bulkWrite(bulkOps);

  // --- Step 2: Calculate counts ---
  const presentCount = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const absentCount = records.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT).length;

  // --- Step 3: Update session status ---
  session.status = SESSION_STATUS.SUBMITTED;
  session.presentCount = presentCount;
  session.absentCount = absentCount;
  session.totalStudents = records.length;
  session.submittedAt = new Date();
  await session.save();

  // --- Step 4: Queue notifications for absent students ---
  const absentStudentIds = records
    .filter((r) => r.status === ATTENDANCE_STATUS.ABSENT)
    .map((r) => r.studentId);

  if (absentStudentIds.length > 0) {
    const absentStudents = await Student.find({
      _id: { $in: absentStudentIds },
    });

    const notifications = absentStudents.map((student) => ({
      sessionId: session._id,
      studentId: student._id,
      parentPhone: student.parentPhone,
      message: `Respected ${student.parentName}, this is to inform you that ${student.fullName} (Roll No: ${student.rollNo}) was absent today. — Gorade Classes`,
      status: NOTIFICATION_STATUS.QUEUED,
      queuedAt: new Date(),
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  }

  apiResponse(res, 200, {
    session,
    presentCount,
    absentCount,
    notificationsQueued: absentStudentIds.length,
  }, 'Attendance submitted successfully');
});

/**
 * POST /api/attendance/sync
 * Offline sync — receives a complete session from the mobile app.
 * Combines createSession + submitSession in one atomic call.
 */
exports.syncOfflineSession = asyncHandler(async (req, res) => {
  const { classId, date, records } = req.body;
  const normalizedDate = normalizeDate(date);

  // Check if already submitted (idempotent)
  const existing = await AttendanceSession.findOne({
    classId,
    date: normalizedDate,
    status: SESSION_STATUS.SUBMITTED,
  });

  if (existing) {
    return apiResponse(res, 200, { session: existing }, 'Session already synced');
  }

  // Create or find draft session
  let session = await AttendanceSession.findOne({ classId, date: normalizedDate });

  if (!session) {
    const totalStudents = await Student.countDocuments({
      classId,
      status: STUDENT_STATUS.ACTIVE,
    });

    session = await AttendanceSession.create({
      classId,
      date: normalizedDate,
      totalStudents,
      createdBy: req.user._id,
    });
  }

  // Delegate to submit logic by setting req.params and req.body
  req.params.id = session._id;
  req.body.records = records;

  return exports.submitSession(req, res);
});

/**
 * GET /api/attendance/absent-on-date?classId=X&date=YYYY-MM-DD
 * Returns array of studentIds who were absent on a given date.
 * Used by marks entry to display "Absent" remarks.
 * If no session exists for that date, returns empty array (no data = no remarks).
 */
exports.getAbsentOnDate = asyncHandler(async (req, res) => {
  const { classId, date } = req.query;
  if (!classId || !date) {
    return res.status(400).json({ success: false, message: 'classId and date are required' });
  }

  const normalizedDate = normalizeDate(date);
  const session = await AttendanceSession.findOne({ classId, date: normalizedDate });

  if (!session) {
    return apiResponse(res, 200, { absentStudentIds: [] }, 'No session for this date');
  }

  const absentRecords = await AttendanceRecord.find({
    sessionId: session._id,
    status: 'absent',
  }).select('studentId');

  const absentStudentIds = absentRecords.map((r) => String(r.studentId));
  apiResponse(res, 200, { absentStudentIds });
});
