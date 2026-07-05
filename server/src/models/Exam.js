const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true,
      maxlength: 100,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 50,
    },
    maxMarks: {
      type: Number,
      required: [true, 'Max marks is required'],
      min: 1,
    },
    date: {
      type: Date,
      required: [true, 'Exam date is required'],
    },
  },
  {
    timestamps: true,
  }
);

examSchema.index({ classId: 1, date: -1 });

module.exports = mongoose.model('Exam', examSchema);
