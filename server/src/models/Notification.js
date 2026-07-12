const mongoose = require('mongoose');
const { NOTIFICATION_STATUS } = require('../config/constants');

const notificationSchema = new mongoose.Schema(
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
    parentPhone: {
      type: String,
      required: [true, 'Parent phone is required'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: 500,
    },
    attendanceDate: {
      type: String, // "YYYY-MM-DD" — used for date-based expiry
      required: [true, 'Attendance date is required'],
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.QUEUED,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorReason: {
      type: String,
      default: null,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // enables updatedAt for incremental sync
  }
);

// Queue processing: pick oldest queued/retryable notifications
notificationSchema.index({ status: 1, nextRetryAt: 1 });

// Expiry: bulk-expire stale notifications by date
notificationSchema.index({ status: 1, attendanceDate: 1 });

// Query: all notifications for a session
notificationSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
