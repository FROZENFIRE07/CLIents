const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const attendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: [true, 'Session is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: [true, 'Attendance status is required'],
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // markedAt is sufficient
  }
);

// Query: all records for a session
attendanceRecordSchema.index({ sessionId: 1 });

// Query: student's attendance history (for analytics)
attendanceRecordSchema.index({ studentId: 1, markedAt: -1 });

// Prevent duplicate: one record per student per session
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
