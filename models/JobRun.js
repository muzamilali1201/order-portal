const mongoose = require("mongoose");

const jobRunSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    lastCompletedPeriodKey: {
      type: String,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const JobRun = mongoose.model("job-run", jobRunSchema);

module.exports = JobRun;
