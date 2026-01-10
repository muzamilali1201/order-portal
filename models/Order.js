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
        "COMMISSION_COLLECTED",
        "PAID",
        "SENT_TO SELLER",
        "ON HOLD",
        "SENT",
      ],
      default: "ORDERED",
    },
    sheet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sheet",
    },
    amazonOrderNo: {
      type: String,
      required: true,
    },
    buyerPaypal: {
      type: String,
      required: true,
    },
    buyerName: {
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
    RefundSS: {
      type: String,
    },
    ReviewedSS: {
      type: String,
    },
    commission: {
      type: Number,
    },
    nextStatusAt: {
      type: Date,
      index: true,
    },
    commentsHistory: [
      {
        comment: {
          type: String,
          trim: true,
        },
        commentedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["admin", "user", "system"],
        },
        commentedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
