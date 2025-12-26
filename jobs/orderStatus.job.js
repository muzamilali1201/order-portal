const cron = require("node-cron");
const Order = require("../models/Order");
const alertSystem = require("../models/AlertSystem");
const { getIO } = require("../socket");

const SYSTEM_USER_ID = "AUTO"; // or create a system user later

// Runs every day at 02:00 AM
cron.schedule("0 2 * * *", async () => {
  try {
    console.log("⏳ Running order status automation job...");
    const io = getIO();
    const now = new Date();

    // ---------------------------
    // RULE 1: ORDERED → REVIEW_AWAITED (10 days)
    // ---------------------------
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const orderedOrders = await Order.find({
      status: "ORDERED",
      createdAt: { $lte: tenDaysAgo },
    });

    for (const order of orderedOrders) {
      await Order.findByIdAndUpdate(order._id, {
        status: "REVIEW_AWAITED",
      });

      await alertSystem.create({
        orderId: order._id,
        changedBy: SYSTEM_USER_ID,
        role: "system",
        previousStatus: "ORDERED",
        newStatus: "REVIEW_AWAITED",
        action: "AUTO_STATUS_CHANGE",
      });

      io.emit("order-status-changed", {
        orderId: order._id,
        previousStatus: "ORDERED",
        newStatus: "REVIEW_AWAITED",
        role: "system",
        createdAt: new Date(),
      });
    }
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const reviewAwaitedOrders = await Order.find({
      status: "REVIEW_AWAITED",
      updatedAt: { $lte: fiveDaysAgo },
    });

    for (const order of reviewAwaitedOrders) {
      await Order.findByIdAndUpdate(order._id, {
        status: "REFUND_DELAYED",
      });

      await alertSystem.create({
        orderId: order._id,
        changedBy: SYSTEM_USER_ID,
        role: "system",
        previousStatus: "REVIEW_AWAITED",
        newStatus: "REFUND_DELAYED",
        action: "AUTO_STATUS_CHANGE",
      });

      io.emit("order-status-changed", {
        orderId: order._id,
        previousStatus: "REVIEW_AWAITED",
        newStatus: "REFUND_DELAYED",
        role: "system",
        createdAt: new Date(),
      });
    }

    console.log("✅ Order status automation completed");
  } catch (error) {
    console.error("❌ Order status automation failed:", error);
  }
});
