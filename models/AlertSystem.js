const mongoose = require("mongoose");

const alertSystemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      required: true,
    },
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: "STATUS_CHANGED",
    },
  },
  { timestamps: true }
);

const alertSystem = mongoose.model("alert-system", alertSystemSchema);

module.exports = alertSystem;
