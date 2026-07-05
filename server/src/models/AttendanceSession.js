const mongoose = require('mongoose');
const { SESSION_STATUS } = require('../config/constants');

const attendanceSessionSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.DRAFT,
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    absentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate sessions: one session per class per date
attendanceSessionSchema.index({ classId: 1, date: 1 }, { unique: true });

// Query: sessions by class, newest first
attendanceSessionSchema.index({ classId: 1, createdAt: -1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
