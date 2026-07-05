const Class = require('../models/Class');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * GET /api/classes
 * List all active classes (optionally filter by academicYear)
 */
exports.getClasses = asyncHandler(async (req, res) => {
  const { academicYear, all } = req.query;

  const filter = {};
  if (!all) filter.isActive = true;
  if (academicYear) filter.academicYear = academicYear;

  const classes = await Class.find(filter)
    .populate('teacherId', 'name')
    .sort({ standard: 1, name: 1 });

  apiResponse(res, 200, { classes });
});

/**
 * GET /api/classes/:id
 * Get single class
 */
exports.getClass = asyncHandler(async (req, res) => {
  const classDoc = await Class.findById(req.params.id).populate('teacherId', 'name');

  if (!classDoc) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  apiResponse(res, 200, { class: classDoc });
});

/**
 * POST /api/classes
 * Create a new class
 */
exports.createClass = asyncHandler(async (req, res) => {
  const { name, standard, academicYear, teacherId } = req.body;

  const classDoc = await Class.create({
    name,
    standard,
    academicYear,
    teacherId: teacherId || null,
  });

  apiResponse(res, 201, { class: classDoc }, 'Class created');
});

/**
 * PUT /api/classes/:id
 * Update a class
 */
exports.updateClass = asyncHandler(async (req, res) => {
  const { name, standard, academicYear, teacherId, isActive } = req.body;

  const classDoc = await Class.findByIdAndUpdate(
    req.params.id,
    { name, standard, academicYear, teacherId, isActive },
    { new: true, runValidators: true }
  );

  if (!classDoc) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  apiResponse(res, 200, { class: classDoc }, 'Class updated');
});
