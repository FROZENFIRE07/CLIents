type ClassSeed = {
  _id: string;
  name: string;
  studentCount: number;
};

type StudentSeed = {
  _id: string;
  rollNo: string;
  fullName: string;
  parentName: string;
  parentPhone: string;
  classId: string;
  status: string;
  admissionDate: string;
};

type SessionSeed = {
  _id: string;
  classId: string;
  date: string;
  status: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
};

type ExamSeed = {
  _id: string;
  classId: string;
  name: string;
  subject: string;
  maxMarks: number;
  date: string;
};

type NotificationSeed = {
  _id: string;
  sessionId: string;
  studentId: string;
  parentPhone: string;
  message: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'expired';
  retryCount: number;
  queuedAt: string;
  sentAt?: string;
};

const now = new Date();
const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const dateOnly = (days: number) => isoDaysAgo(days).split('T')[0];

export const seedClasses: ClassSeed[] = [
  { _id: 'class-10a', name: '10th A', studentCount: 6 },
  { _id: 'class-9b', name: '9th B', studentCount: 6 },
];

export const seedStudents: StudentSeed[] = [
  { _id: 'stu-101', rollNo: '1', fullName: 'Aarav Patil', parentName: 'Mahesh Patil', parentPhone: '919876543210', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(120) },
  { _id: 'stu-102', rollNo: '2', fullName: 'Meera Joshi', parentName: 'Anita Joshi', parentPhone: '919876543211', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(118) },
  { _id: 'stu-103', rollNo: '3', fullName: 'Kabir Shah', parentName: 'Rohit Shah', parentPhone: '919876543212', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(117) },
  { _id: 'stu-104', rollNo: '4', fullName: 'Ira Kulkarni', parentName: 'Nitin Kulkarni', parentPhone: '919876543213', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(116) },
  { _id: 'stu-105', rollNo: '5', fullName: 'Vivaan Deshmukh', parentName: 'Sandeep Deshmukh', parentPhone: '919876543214', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(115) },
  { _id: 'stu-106', rollNo: '6', fullName: 'Anaya More', parentName: 'Priya More', parentPhone: '919876543215', classId: 'class-10a', status: 'active', admissionDate: isoDaysAgo(114) },
  { _id: 'stu-201', rollNo: '1', fullName: 'Rohan Sutar', parentName: 'Vijay Sutar', parentPhone: '919876543220', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(140) },
  { _id: 'stu-202', rollNo: '2', fullName: 'Sana Khan', parentName: 'Farida Khan', parentPhone: '919876543221', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(139) },
  { _id: 'stu-203', rollNo: '3', fullName: 'Arjun Bhosale', parentName: 'Suresh Bhosale', parentPhone: '919876543222', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(138) },
  { _id: 'stu-204', rollNo: '4', fullName: 'Nisha Jadhav', parentName: 'Deepak Jadhav', parentPhone: '919876543223', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(137) },
  { _id: 'stu-205', rollNo: '5', fullName: 'Tejas Gaikwad', parentName: 'Mangesh Gaikwad', parentPhone: '919876543224', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(136) },
  { _id: 'stu-206', rollNo: '6', fullName: 'Pooja Chavan', parentName: 'Usha Chavan', parentPhone: '919876543225', classId: 'class-9b', status: 'active', admissionDate: isoDaysAgo(135) },
];

export const seedSessions: SessionSeed[] = [
  { _id: 'sess-101', classId: 'class-10a', date: dateOnly(1), status: 'notifications_sent', totalStudents: 6, presentCount: 5, absentCount: 1 },
  { _id: 'sess-102', classId: 'class-10a', date: dateOnly(3), status: 'submitted', totalStudents: 6, presentCount: 4, absentCount: 2 },
  { _id: 'sess-103', classId: 'class-10a', date: dateOnly(6), status: 'notifications_sent', totalStudents: 6, presentCount: 6, absentCount: 0 },
  { _id: 'sess-201', classId: 'class-9b', date: dateOnly(2), status: 'submitted', totalStudents: 6, presentCount: 5, absentCount: 1 },
  { _id: 'sess-202', classId: 'class-9b', date: dateOnly(4), status: 'notifications_sent', totalStudents: 6, presentCount: 4, absentCount: 2 },
];

const absentBySession: Record<string, string[]> = {
  'sess-101': ['stu-106'],
  'sess-102': ['stu-102', 'stu-105'],
  'sess-201': ['stu-202'],
  'sess-202': ['stu-203', 'stu-206'],
};

export const seedExams: ExamSeed[] = [
  { _id: 'exam-101', classId: 'class-10a', name: 'Unit Test 1', subject: 'Mathematics', maxMarks: 100, date: dateOnly(2) },
  { _id: 'exam-102', classId: 'class-10a', name: 'Science Drill', subject: 'Science', maxMarks: 50, date: dateOnly(8) },
  { _id: 'exam-201', classId: 'class-9b', name: 'Quarterly Review', subject: 'English', maxMarks: 80, date: dateOnly(5) },
];

const seedMarks = [
  { examId: 'exam-101', studentId: 'stu-101', marksObtained: 88 },
  { examId: 'exam-101', studentId: 'stu-102', marksObtained: 79 },
  { examId: 'exam-101', studentId: 'stu-103', marksObtained: 67 },
  { examId: 'exam-101', studentId: 'stu-104', marksObtained: 92 },
  { examId: 'exam-101', studentId: 'stu-105', marksObtained: 74 },
  { examId: 'exam-101', studentId: 'stu-106', marksObtained: 81 },
  { examId: 'exam-102', studentId: 'stu-101', marksObtained: 41 },
  { examId: 'exam-102', studentId: 'stu-103', marksObtained: 35 },
  { examId: 'exam-102', studentId: 'stu-104', marksObtained: 44 },
  { examId: 'exam-201', studentId: 'stu-201', marksObtained: 66 },
  { examId: 'exam-201', studentId: 'stu-202', marksObtained: 71 },
  { examId: 'exam-201', studentId: 'stu-203', marksObtained: 58 },
  { examId: 'exam-201', studentId: 'stu-204', marksObtained: 73 },
];

export const seedNotifications: NotificationSeed[] = [
  { _id: 'notif-101', sessionId: 'sess-101', studentId: 'stu-106', parentPhone: '919876543215', message: 'Respected Priya More, this is to inform you that Anaya More (Roll No: 6) was absent today. - Gorade Classes', status: 'sent', retryCount: 0, queuedAt: isoDaysAgo(1), sentAt: isoDaysAgo(1) },
  { _id: 'notif-102', sessionId: 'sess-102', studentId: 'stu-102', parentPhone: '919876543211', message: 'Respected Anita Joshi, this is to inform you that Meera Joshi (Roll No: 2) was absent today. - Gorade Classes', status: 'sent', retryCount: 0, queuedAt: isoDaysAgo(3), sentAt: isoDaysAgo(3) },
  { _id: 'notif-103', sessionId: 'sess-102', studentId: 'stu-105', parentPhone: '919876543214', message: 'Respected Sandeep Deshmukh, this is to inform you that Vivaan Deshmukh (Roll No: 5) was absent today. - Gorade Classes', status: 'sent', retryCount: 0, queuedAt: isoDaysAgo(3), sentAt: isoDaysAgo(3) },
  { _id: 'notif-104', sessionId: 'sess-201', studentId: 'stu-202', parentPhone: '919876543221', message: 'Respected Farida Khan, this is to inform you that Sana Khan (Roll No: 2) was absent today. - Gorade Classes', status: 'queued', retryCount: 0, queuedAt: isoDaysAgo(2) },
  { _id: 'notif-105', sessionId: 'sess-202', studentId: 'stu-203', parentPhone: '919876543222', message: 'Respected Suresh Bhosale, this is to inform you that Arjun Bhosale (Roll No: 3) was absent today. - Gorade Classes', status: 'failed', retryCount: 1, queuedAt: isoDaysAgo(4) },
];

const completedSessions = seedSessions.filter((session) => session.status === 'submitted' || session.status === 'notifications_sent');

function withClassName(session: SessionSeed) {
  return {
    ...session,
    classId: seedClasses.find((classDoc) => classDoc._id === session.classId) || session.classId,
  };
}

function withStudent(studentId: string) {
  return seedStudents.find((student) => student._id === studentId) || studentId;
}

function toStudentMarks(studentId: string) {
  return seedMarks
    .filter((mark) => mark.studentId === studentId)
    .map((mark) => ({
      ...mark,
      examId: seedExams.find((exam) => exam._id === mark.examId) || mark.examId,
    }));
}

function toAttendanceTimeline(classId: string) {
  return seedSessions
    .filter((session) => session.classId === classId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      date: session.date,
      present: session.presentCount,
      absent: session.absentCount,
      total: session.totalStudents,
      rate: session.totalStudents > 0 ? ((session.presentCount / session.totalStudents) * 100).toFixed(1) : '0',
    }));
}

export function getSeededApiData(pathname: string, params: URLSearchParams) {
  if (pathname.endsWith('/classes')) {
    return { classes: seedClasses };
  }

  if (pathname.endsWith('/students')) {
    const classId = params.get('classId');
    const students = seedStudents.filter((student) => !classId || student.classId === classId);
    return { students, count: students.length };
  }

  if (pathname.endsWith('/analytics/dashboard')) {
    const totalStudents = seedStudents.filter((student) => student.status === 'active').length;
    const totalSessions = completedSessions.length;
    const recentSessions = completedSessions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(withClassName);
    const totalPresent = recentSessions.reduce((sum, session) => sum + session.presentCount, 0);
    const totalMarked = recentSessions.reduce((sum, session) => sum + session.totalStudents, 0);
    const attendanceRate = totalMarked > 0 ? Number(((totalPresent / totalMarked) * 100).toFixed(1)) : 0;

    return {
      totalStudents,
      totalSessions,
      attendanceRate,
      recentSessions,
    };
  }

  if (pathname.endsWith('/notifications/stats')) {
    const stats = seedNotifications.reduce(
      (acc, notification) => {
        acc[notification.status] += 1;
        return acc;
      },
      { queued: 0, sending: 0, sent: 0, failed: 0, expired: 0 }
    );
    return { stats };
  }

  if (pathname.endsWith('/notifications')) {
    const status = params.get('status');
    const page = Number(params.get('page') || 1);
    const limit = Number(params.get('limit') || 25);
    const filtered = seedNotifications
      .filter((notification) => !status || notification.status === status)
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
    const total = filtered.length;
    const notifications = filtered.slice((page - 1) * limit, page * limit).map((notification) => ({
      ...notification,
      studentId: withStudent(notification.studentId),
    }));

    return {
      notifications,
      pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  if (pathname.endsWith('/analytics/attendance')) {
    const classId = params.get('classId') || '';
    return { timeline: toAttendanceTimeline(classId) };
  }

  if (pathname.endsWith('/attendance/sessions')) {
    const classId = params.get('classId');
    const limit = Number(params.get('limit') || 20);
    const sessions = seedSessions
      .filter((session) => !classId || session.classId === classId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map(withClassName);

    return { sessions };
  }

  if (pathname.endsWith('/attendance/absent-on-date')) {
    const classId = params.get('classId');
    const date = params.get('date');
    const session = seedSessions.find((item) => item.classId === classId && item.date === date);
    if (!session) return { absentStudentIds: [] };
    return { absentStudentIds: absentBySession[session._id] || [] };
  }

  if (pathname.endsWith('/exams')) {
    const classId = params.get('classId');
    const exams = seedExams.filter((exam) => !classId || exam.classId === classId);
    return { exams };
  }

  if (/\/exams\/[^/]+\/marks$/.test(pathname)) {
    const examId = pathname.split('/').at(-2) || '';
    const exam = seedExams.find((item) => item._id === examId);
    const marks = seedMarks
      .filter((mark) => mark.examId === examId)
      .map((mark) => ({
        ...mark,
        studentId: withStudent(mark.studentId),
      }));

    return { exam, marks };
  }

  if (pathname.endsWith('/analytics/performance')) {
    const studentId = params.get('studentId') || '';
    const student = seedStudents.find((item) => item._id === studentId);
    const marks = toStudentMarks(studentId);
    const classSessions = seedSessions.filter((session) => session.classId === student?.classId);
    const absentCount = classSessions.filter((session) => absentBySession[session._id]?.includes(studentId)).length;
    const total = classSessions.length;
    const present = Math.max(0, total - absentCount);

    return {
      marks,
      attendance: {
        total,
        present,
        absent: Math.max(0, total - present),
        rate: total > 0 ? ((present / total) * 100).toFixed(1) : '0.0',
      },
    };
  }

  return null;
}
