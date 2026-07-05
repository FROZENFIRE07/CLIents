const mongoose = require('mongoose');
const { STUDENT_STATUS } = require('../config/constants');

const studentSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      maxlength: 100,
    },
    parentName: {
      type: String,
      required: [true, 'Parent name is required'],
      trim: true,
      maxlength: 100,
    },
    parentPhone: {
      type: String,
      required: [true, 'Parent phone is required'],
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      default: STUDENT_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique: rollNo must be unique within a class
studentSchema.index({ rollNo: 1, classId: 1 }, { unique: true });

// Query index: list students by class + status
studentSchema.index({ classId: 1, status: 1 });

module.exports = mongoose.model('Student', studentSchema);
