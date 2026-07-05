/**
 * Demo data seeder — populates classes, students, attendance sessions, and marks
 * for a realistic dashboard experience.
 * Run with: node src/utils/seed-demo.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Class = require('../models/Class');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Exam = require('../models/Exam');
const Marks = require('../models/Marks');

const STUDENTS_DATA = {
  '10th A': [
    { rollNo: '1', fullName: 'Aarav Sharma', parentName: 'Rajesh Sharma', parentPhone: '919876543201' },
    { rollNo: '2', fullName: 'Priya Patel', parentName: 'Suresh Patel', parentPhone: '919876543202' },
    { rollNo: '3', fullName: 'Rohan Deshmukh', parentName: 'Mahesh Deshmukh', parentPhone: '919876543203' },
    { rollNo: '4', fullName: 'Sneha Kulkarni', parentName: 'Anil Kulkarni', parentPhone: '919876543204' },
    { rollNo: '5', fullName: 'Vikram Joshi', parentName: 'Deepak Joshi', parentPhone: '919876543205' },
    { rollNo: '6', fullName: 'Ananya Gorade', parentName: 'Sanjay Gorade', parentPhone: '919876543206' },
    { rollNo: '7', fullName: 'Kunal More', parentName: 'Prakash More', parentPhone: '919876543207' },
    { rollNo: '8', fullName: 'Ishita Bhosale', parentName: 'Ganesh Bhosale', parentPhone: '919876543208' },
  ],
  '9th B': [
    { rollNo: '1', fullName: 'Arjun Patil', parentName: 'Nilesh Patil', parentPhone: '919876543211' },
    { rollNo: '2', fullName: 'Kavya Deshpande', parentName: 'Rahul Deshpande', parentPhone: '919876543212' },
    { rollNo: '3', fullName: 'Siddharth Rane', parentName: 'Vijay Rane', parentPhone: '919876543213' },
    { rollNo: '4', fullName: 'Tanvi Chavan', parentName: 'Ajay Chavan', parentPhone: '919876543214' },
    { rollNo: '5', fullName: 'Omkar Jadhav', parentName: 'Sachin Jadhav', parentPhone: '919876543215' },
    { rollNo: '6', fullName: 'Riya Shinde', parentName: 'Manoj Shinde', parentPhone: '919876543216' },
  ],
};

async function seed() {
  await connectDB();
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) { console.error('Run seed.js first.'); process.exit(1); }

  // Clean existing demo data
  await Promise.all([
    Class.deleteMany({}), Student.deleteMany({}),
    AttendanceSession.deleteMany({}), AttendanceRecord.deleteMany({}),
    Exam.deleteMany({}), Marks.deleteMany({}),
  ]);
  console.log('[DEMO] Cleared old data.');

  // Create classes
  const class10 = await Class.create({ name: '10th A', standard: '10th', academicYear: '2026-27', teacherId: admin._id, studentCount: 8 });
  const class9 = await Class.create({ name: '9th B', standard: '9th', academicYear: '2026-27', teacherId: admin._id, studentCount: 6 });
  console.log('[DEMO] Created classes.');

  // Create students
  const allStudents = {};
  for (const [className, studentsArr] of Object.entries(STUDENTS_DATA)) {
    const classDoc = className === '10th A' ? class10 : class9;
    for (const s of studentsArr) {
      const student = await Student.create({ ...s, classId: classDoc._id });
      if (!allStudents[className]) allStudents[className] = [];
      allStudents[className].push(student);
    }
  }
  console.log('[DEMO] Created students.');

  // Create attendance sessions for the last 10 days
  for (let daysAgo = 9; daysAgo >= 0; daysAgo--) {
    // Skip weekends
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getDay() === 0) continue; // Skip Sunday

    for (const [className, studentsArr] of Object.entries(allStudents)) {
      const classDoc = className === '10th A' ? class10 : class9;
      const totalStudents = studentsArr.length;

      // Random: 1-2 absent per session
      const absentCount = Math.floor(Math.random() * 3);
      const absentIndices = new Set();
      while (absentIndices.size < absentCount) {
        absentIndices.add(Math.floor(Math.random() * totalStudents));
      }

      const session = await AttendanceSession.create({
        classId: classDoc._id,
        date,
        status: 'submitted',
        totalStudents,
        presentCount: totalStudents - absentCount,
        absentCount,
        createdBy: admin._id,
        submittedAt: date,
      });

      // Create records
      for (let i = 0; i < studentsArr.length; i++) {
        await AttendanceRecord.create({
          sessionId: session._id,
          studentId: studentsArr[i]._id,
          status: absentIndices.has(i) ? 'absent' : 'present',
          markedAt: date,
        });
      }
    }
  }
  console.log('[DEMO] Created attendance sessions.');

  // Create exams and marks for 10th A
  const exams = [
    { name: 'Unit Test 1', subject: 'Mathematics', maxMarks: 50, daysAgo: 30 },
    { name: 'Unit Test 1', subject: 'Science', maxMarks: 50, daysAgo: 28 },
    { name: 'Mid-Term', subject: 'Mathematics', maxMarks: 100, daysAgo: 15 },
    { name: 'Mid-Term', subject: 'Science', maxMarks: 100, daysAgo: 13 },
  ];

  for (const examData of exams) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() - examData.daysAgo);

    const exam = await Exam.create({
      name: examData.name,
      classId: class10._id,
      subject: examData.subject,
      maxMarks: examData.maxMarks,
      date: examDate,
    });

    for (const student of allStudents['10th A']) {
      const score = Math.floor(examData.maxMarks * (0.4 + Math.random() * 0.55)); // 40%-95%
      await Marks.create({
        examId: exam._id,
        studentId: student._id,
        marksObtained: score,
      });
    }
  }
  console.log('[DEMO] Created exams and marks.');

  console.log('\n[DEMO] ✅ Demo data seeded successfully!');
  console.log('[DEMO] Classes: 10th A (8 students), 9th B (6 students)');
  console.log('[DEMO] Attendance: ~10 days of sessions');
  console.log('[DEMO] Exams: 4 exams with marks for 10th A');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
