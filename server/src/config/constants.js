module.exports = {
  // Attendance session statuses
  SESSION_STATUS: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    NOTIFICATIONS_SENT: 'notifications_sent',
  },

  // Attendance record statuses
  ATTENDANCE_STATUS: {
    PRESENT: 'present',
    ABSENT: 'absent',
  },

  // Student statuses
  STUDENT_STATUS: {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
  },

  // User roles
  USER_ROLES: {
    ADMIN: 'admin',
    TEACHER: 'teacher',
  },

  // Notification statuses
  NOTIFICATION_STATUS: {
    QUEUED: 'queued',
    SENDING: 'sending',
    SENT: 'sent',
    FAILED: 'failed',
    EXPIRED: 'expired',
  },

  // Notification retry config
  NOTIFICATION_CONFIG: {
    MAX_RETRIES: 3,
    BASE_DELAY_MS: 5 * 60 * 1000,       // 5 minutes
    MESSAGE_GAP_MIN_MS: 3000,             // 3 seconds between messages
    MESSAGE_GAP_MAX_MS: 8000,             // 8 seconds between messages
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
  },
};
