const mongoose = require('mongoose');

const appVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: [true, 'Version is required'],
      unique: true,
    },
    minimumVersion: {
      type: String,
      required: [true, 'Minimum supported version is required'],
    },
    apkUrl: {
      type: String,
      default: null,
    },
    releaseNotes: {
      type: String,
      default: '',
    },
    mandatory: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AppVersion', appVersionSchema);
