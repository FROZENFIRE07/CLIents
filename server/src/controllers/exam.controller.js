const Exam = require('../models/Exam');
const Marks = require('../models/Marks');
const Class = require('../models/Class');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * POST /api/exams
 * Create an exam
 */
exports.createExam = asyncHandler(async (req, res) => {
  const { name, classId, subject, maxMarks, date } = req.body;

  const classDoc = await Class.findById(classId);
  if (!classDoc) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const exam = await Exam.create({ name, classId, subject, maxMarks, date });

  apiResponse(res, 201, { exam }, 'Exam created');
});

/**
 * GET /api/exams
 * List exams by class
 */
exports.getExams = asyncHandler(async (req, res) => {
  const { classId } = req.query;

  if (!classId) {
    return res.status(400).json({ success: false, message: 'classId is required' });
  }

  const exams = await Exam.find({ classId }).sort({ date: -1 });

  apiResponse(res, 200, { exams });
});

/**
 * POST /api/exams/:id/marks
 * Submit marks in bulk
 * Body: { marks: [{ studentId, marksObtained }] }
 */
exports.submitMarks = asyncHandler(async (req, res) => {
  const { marks } = req.body;
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  if (!marks || !Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({ success: false, message: 'Marks array is required' });
  }

  // Validate no marks exceed max
  const invalid = marks.find((m) => m.marksObtained > exam.maxMarks);
  if (invalid) {
    return res.status(400).json({
      success: false,
      message: `Marks cannot exceed maximum (${exam.maxMarks})`,
    });
  }

  // Upsert all marks (idempotent)
  const bulkOps = marks.map((m) => ({
    updateOne: {
      filter: { examId: exam._id, studentId: m.studentId },
      update: { $set: { marksObtained: m.marksObtained } },
      upsert: true,
    },
  }));

  await Marks.bulkWrite(bulkOps);

  apiResponse(res, 200, { count: marks.length }, 'Marks submitted');
});

/**
 * GET /api/exams/:id/marks
 * Get all marks for an exam
 */
exports.getMarks = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const marks = await Marks.find({ examId: exam._id })
    .populate('studentId', 'rollNo fullName')
    .sort({ 'studentId.rollNo': 1 });

  apiResponse(res, 200, { exam, marks });
});
