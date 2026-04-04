// const cron = require("node-cron");
// const Order = require("../models/Order");
// const alertSystem = require("../models/AlertSystem");
// const { getIO } = require("../socket");

// const SYSTEM_USER_ID = "AUTO"; // or create a system user later

// // Runs every day at 02:00 AM
// cron.schedule("0 2 * * *", async () => {
//   try {
//     console.log("Running order status automation job...");
//     const io = getIO();
//     const now = new Date();

//     // RULE 1: ORDERED -> REVIEW_AWAITED (10 days)
//     const tenDaysAgo = new Date(now);
//     tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

//     const orderedOrders = await Order.find({
//       status: "ORDERED",
//       createdAt: { $lte: tenDaysAgo },
//     });

//     for (const order of orderedOrders) {
//       await Order.findByIdAndUpdate(order._id, {
//         status: "REVIEW_AWAITED",
//       });

//       await alertSystem.create({
//         orderId: order._id,
//         changedBy: SYSTEM_USER_ID,
//         role: "system",
//         previousStatus: "ORDERED",
//         newStatus: "REVIEW_AWAITED",
//         action: "AUTO_STATUS_CHANGE",
//       });

//       io.emit("order-status-changed", {
//         orderId: order._id,
//         previousStatus: "ORDERED",
//         newStatus: "REVIEW_AWAITED",
//         role: "system",
//         createdAt: new Date(),
//       });
//     }
//     const fiveDaysAgo = new Date(now);
//     fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

//     const reviewAwaitedOrders = await Order.find({
//       status: "SEND_TO_SELLER",
//       updatedAt: { $lte: fiveDaysAgo },
//     });

//     for (const order of reviewAwaitedOrders) {
//       await Order.findByIdAndUpdate(order._id, {
//         status: "REFUND_DELAYED",
//       });

//       await alertSystem.create({
//         orderId: order._id,
//         changedBy: SYSTEM_USER_ID,
//         role: "system",
//         previousStatus: "REVIEW_AWAITED",
//         newStatus: "REFUND_DELAYED",
//         action: "AUTO_STATUS_CHANGE",
//       });

//       io.emit("order-status-changed", {
//         orderId: order._id,
//         previousStatus: "REVIEW_AWAITED",
//         newStatus: "REFUND_DELAYED",
//         role: "system",
//         createdAt: new Date(),
//       });
//     }

//     console.log("Order status automation completed");
//   } catch (error) {
//     console.error("Order status automation failed:", error);
//   }
// });

const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const Order = require("../models/Order");
const alertSystem = require("../models/AlertSystem");
const JobRun = require("../models/JobRun");
const { emitOrderStatusChanged } = require("../services/notification.service");
const { addBusinessDays } = require("../helpers/businessDays");

dayjs.extend(utc);
dayjs.extend(timezone);

const SYSTEM_ROLE = "system";
const APP_TIMEZONE = "Asia/Karachi";
const MONTHLY_COMMISSION_JOB_KEY = "monthly-commission-collection";
const SENT_TO_SELLER_STATUSES = ["SENT_TO SELLER", "SENT_TO_SELLER"];

let isMonthlyCommissionJobRunning = false;

function getSentToSellerAt(order) {
  let sentToSellerAt = null;
  if (Array.isArray(order.statusHistory)) {
    for (const entry of order.statusHistory) {
      if (SENT_TO_SELLER_STATUSES.includes(entry?.newStatus)) {
        const changedAt = entry?.changedAt ? new Date(entry.changedAt) : null;
        if (changedAt && (!sentToSellerAt || changedAt > sentToSellerAt)) {
          sentToSellerAt = changedAt;
        }
      }
    }
  }
  if (!sentToSellerAt && order.updatedAt) {
    sentToSellerAt = new Date(order.updatedAt);
  }
  return sentToSellerAt;
}

function getCurrentMonthlyPeriodKey(now = new Date()) {
  return dayjs(now).tz(APP_TIMEZONE).format("YYYY-MM");
}

async function runMonthlyCommissionCollection(now = new Date()) {
  if (isMonthlyCommissionJobRunning) {
    return;
  }

  isMonthlyCommissionJobRunning = true;

  try {
    const periodKey = getCurrentMonthlyPeriodKey(now);

    let jobRun = await JobRun.findOne({ key: MONTHLY_COMMISSION_JOB_KEY });
    if (!jobRun) {
      jobRun = await JobRun.create({
        key: MONTHLY_COMMISSION_JOB_KEY,
      });
    }

    if (jobRun.lastCompletedPeriodKey === periodKey) {
      return;
    }

    console.log("Running monthly commission collection job...");

    const orders = await Order.find({
      status: "REFUNDED",
    });

    for (const order of orders) {
      const previousStatus = order.status;
      const newStatus = "COMMISSION_COLLECTED";

      order.status = newStatus;
      order.nextStatusAt = null;

      order.statusHistory.push({
        previousStatus,
        newStatus,
        role: SYSTEM_ROLE,
        changedAt: now,
      });

      await order.save();

      const alertEntry = await alertSystem.create({
        orderId: order._id,
        role: SYSTEM_ROLE,
        previousStatus,
        newStatus,
        action: "MONTHLY_COMMISSION_COLLECTION",
      });

      await emitOrderStatusChanged(order, {
        alertId: String(alertEntry._id),
        orderId: order._id,
        previousStatus,
        newStatus,
        role: SYSTEM_ROLE,
        createdAt: now,
        changedBy: {
          id: null,
          username: "System",
          role: SYSTEM_ROLE,
        },
      });
    }

    jobRun.lastCompletedPeriodKey = periodKey;
    jobRun.lastRunAt = now;
    await jobRun.save();

    console.log(`Monthly job completed: ${orders.length} orders updated`);
  } catch (err) {
    console.error("Monthly commission job failed:", err);
  } finally {
    isMonthlyCommissionJobRunning = false;
  }
}

// runs every minute
cron.schedule(
  "* * * * *",
  async () => {
    try {
      const now = new Date();
      console.log("Job is running");

      const orders = await Order.find({
        nextStatusAt: { $lte: now },
      }).populate("sheet", "name");

      for (const order of orders) {
        let newStatus = null;

        if (order.status === "ORDERED") {
          newStatus = "REVIEW_AWAITED";
        } else if (SENT_TO_SELLER_STATUSES.includes(order.status)) {
          const sentToSellerAt = getSentToSellerAt(order);
          if (sentToSellerAt) {
            const softReminderAt = addBusinessDays(sentToSellerAt, 3);

            if (now < softReminderAt) {
              order.nextStatusAt = softReminderAt;
              await order.save();
              continue;
            }
          }

          newStatus = "SOFT_REMINDER";
        } else if (order.status === "SOFT_REMINDER") {
          const sheetName = order.sheet?.name?.toLowerCase();
          const sentToSellerAt = getSentToSellerAt(order);
          if (sentToSellerAt) {
            const targetDate = addBusinessDays(
              sentToSellerAt,
              sheetName === "adverzpro" ? 7 : 5
            );

            if (now < targetDate) {
              order.nextStatusAt = targetDate;
              await order.save();
              continue;
            }
          }

          newStatus = "REFUND_DELAYED";
        }

        if (!newStatus) {
          order.nextStatusAt = null;
          await order.save();
          continue;
        }

        const previousStatus = order.status;
        order.status = newStatus;

        // schedule next transition
        const next = new Date();

        if (newStatus === "SENT_TO SELLER") {
          order.nextStatusAt = addBusinessDays(next, 3);
        } else if (newStatus === "SOFT_REMINDER") {
          const sheetName = order.sheet?.name?.toLowerCase();
          const sentToSellerAt = getSentToSellerAt(order);
          if (sentToSellerAt) {
            const targetDate = addBusinessDays(
              sentToSellerAt,
              sheetName === "adverzpro" ? 7 : 5
            );
            order.nextStatusAt = targetDate;
          } else {
            order.nextStatusAt = addBusinessDays(next, 2);
          }
        } else {
          order.nextStatusAt = null;
        }

        order.statusHistory.push({
          previousStatus,
          newStatus,
          role: SYSTEM_ROLE,
        });

        await order.save();

        const alertEntry = await alertSystem.create({
          orderId: order._id,
          role: SYSTEM_ROLE,
          previousStatus,
          newStatus,
          action: "AUTO_STATUS_CHANGE",
        });

        await emitOrderStatusChanged(order, {
          alertId: String(alertEntry._id),
          orderId: order._id,
          previousStatus,
          newStatus,
          role: SYSTEM_ROLE,
          createdAt: new Date(),
          changedBy: {
            id: null,
            username: "System",
            role: SYSTEM_ROLE,
          },
        });
      }
    } catch (err) {
      console.error("Order automation failed:", err);
    }
  },
  {
    timezone: APP_TIMEZONE,
  }
);

// Run hourly and once at startup so a missed midnight window can catch up.
cron.schedule(
  "0 * * * *",
  async () => {
    await runMonthlyCommissionCollection();
  },
  {
    timezone: APP_TIMEZONE,
  }
);

void runMonthlyCommissionCollection();
