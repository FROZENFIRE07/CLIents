const Student = require('../models/Student');
const Class = require('../models/Class');
const { STUDENT_STATUS } = require('../config/constants');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * GET /api/students
 * List students — requires classId query param
 */
exports.getStudents = asyncHandler(async (req, res) => {
  const { classId, status } = req.query;

  if (!classId) {
    return res.status(400).json({
      success: false,
      message: 'classId query parameter is required',
    });
  }

  const filter = { classId };
  if (status) {
    filter.status = status;
  } else {
    filter.status = STUDENT_STATUS.ACTIVE; // default: only active
  }

  const students = await Student.find(filter).sort({ rollNo: 1 });

  apiResponse(res, 200, { students, count: students.length });
});

/**
 * GET /api/students/:id
 * Get a single student
 */
exports.getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('classId', 'name standard');

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  apiResponse(res, 200, { student });
});

/**
 * POST /api/students
 * Create a new student
 */
exports.createStudent = asyncHandler(async (req, res) => {
  const { rollNo, fullName, parentName, parentPhone, classId, admissionDate } = req.body;

  // Verify class exists
  const classDoc = await Class.findById(classId);
  if (!classDoc) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const student = await Student.create({
    rollNo,
    fullName,
    parentName,
    parentPhone,
    classId,
    admissionDate: admissionDate || Date.now(),
  });

  // Increment denormalized studentCount
  await Class.findByIdAndUpdate(classId, { $inc: { studentCount: 1 } });

  apiResponse(res, 201, { student }, 'Student created');
});

/**
 * PUT /api/students/:id
 * Update student details
 */
exports.updateStudent = asyncHandler(async (req, res) => {
  const { rollNo, fullName, parentName, parentPhone, classId } = req.body;
  const student = await Student.findById(req.params.id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  // If class is changing, update counts on both classes
  if (classId && classId.toString() !== student.classId.toString()) {
    const newClass = await Class.findById(classId);
    if (!newClass) {
      return res.status(404).json({ success: false, message: 'New class not found' });
    }
    await Class.findByIdAndUpdate(student.classId, { $inc: { studentCount: -1 } });
    await Class.findByIdAndUpdate(classId, { $inc: { studentCount: 1 } });
  }

  const updated = await Student.findByIdAndUpdate(
    req.params.id,
    { rollNo, fullName, parentName, parentPhone, classId },
    { new: true, runValidators: true }
  );

  apiResponse(res, 200, { student: updated }, 'Student updated');
});

/**
 * PATCH /api/students/:id/archive
 * Archive a student (soft delete)
 */
exports.archiveStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  student.status = STUDENT_STATUS.ARCHIVED;
  await student.save();

  // Decrement class student count
  await Class.findByIdAndUpdate(student.classId, { $inc: { studentCount: -1 } });

  apiResponse(res, 200, { student }, 'Student archived');
});
