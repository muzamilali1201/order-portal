const mongoose = require("mongoose");

const sheetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Sheet = mongoose.model("Sheet", sheetSchema);
module.exports = Sheet;
