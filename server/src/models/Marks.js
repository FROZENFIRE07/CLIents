const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    marksObtained: {
      type: Number,
      required: [true, 'Marks obtained is required'],
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One mark entry per student per exam
marksSchema.index({ examId: 1, studentId: 1 }, { unique: true });

// Query: all marks for a student (performance analytics)
marksSchema.index({ studentId: 1 });

module.exports = mongoose.model('Marks', marksSchema);
