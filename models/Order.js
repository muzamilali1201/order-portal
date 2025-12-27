const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "ORDERED",
        "REVIEWED",
        "REVIEW_AWAITED",
        "REFUND_DELAYED",
        "REFUNDED",
        "CORRECTED",
        "CANCELLED",
        "COMISSION_COLLECTED",
        "PAID",
      ],
      default: "ORDERED",
    },
    amazonOrderNo: {
      type: String,
      required: true,
    },
    buyerPaypal: {
      type: String,
      required: true,
    },
    orderName: {
      type: String,
      required: true,
    },
    OrderSS: {
      type: String,
      required: true,
    },
    AmazonProductSS: {
      type: String,
      required: true,
    },
    comments: {
      type: String,
    },
    statusHistory: [
      {
        previousStatus: String,
        newStatus: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: String,
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
