const Order = require("../models/Order");
const { uploadToR2 } = require("../services/r2.services");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const alertSystem = require("../models/AlertSystem");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const User = require("../models/User");
const { getIO } = require("../socket");

dayjs.extend(utc);
dayjs.extend(timezone);

const ADMIN_ALLOWED_STATUSES = [
  "ORDERED",
  "REVIEWED",
  "REVIEW_AWAITED",
  "REFUND_DELAYED",
  "REFUNDED",
  "CORRECTED",
  "CANCELLED",
  "COMISSION_COLLECTED",
  "PAID",
  "SEND_TO_SELLER",
  "HOLD",
  "SENT",
];

const USER_ALLOWED_STATUSES = [
  "REVIEWED",
  "CANCELLED",
  "ORDERED",
  "REFUND_DELAYED",
];

const ordersController = {
  createOrder: asyncHandler(async (req, res) => {
    const { amazonOrderNo, buyerPaypal, orderName, comments, buyerName } =
      req.body;

    if (!req.files?.OrderSS || !req.files?.AmazonProductSS) {
      return res.status(400).json({
        success: false,
        message: "Order and Amazon Product screenshots are required",
      });
    }

    const orderSSKey = await uploadToR2(
      req.files.OrderSS[0],
      "screenshots/order"
    );

    const productSSKey = await uploadToR2(
      req.files.AmazonProductSS[0],
      "screenshots/amazon"
    );

    const orderSSUrl = `${process.env.R2_PUBLIC_URL}/${orderSSKey}`;
    const productSSUrl = `${process.env.R2_PUBLIC_URL}/${productSSKey}`;

    const order = await Order.create({
      userId: req.user._id,
      amazonOrderNo,
      buyerPaypal,
      orderName,
      comments,
      OrderSS: orderSSUrl,
      AmazonProductSS: productSSUrl,
      buyerName,
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  }),

  getOrders: asyncHandler(async (req, res) => {
    const { filterBy, page = 1, perPage = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(perPage);
    const query = {};

    const allowedStatuses = [
      "ORDERED",
      "REVIEWED",
      "REVIEW_AWAITED",
      "REFUND_DELAYED",
      "REFUNDED",
      "CORRECTED",
      "CANCELLED",
      "COMISSION_COLLECTED",
      "PAID",
      "SEND_TO_SELLER",
    ];

    if (filterBy && !allowedStatuses.includes(filterBy)) {
      throw new AppError(
        `Invalid filter value, there's no status exists with "${filterBy}" name`,
        400
      );
    }

    if (filterBy) {
      query.status = filterBy;
    }

    if (search) {
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);

      query.$or = [
        { orderName: { $regex: search, $options: "i" } },
        { amazonOrderNo: { $regex: search, $options: "i" } },
        { buyerPaypal: { $regex: search, $options: "i" } },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const orders = await Order.find(query)
      .populate("userId", "email username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(perPage))
      .lean();

    const formattedOrders = orders.map((order) => ({
      ...order,
      createdAt: dayjs(order.createdAt)
        .tz("Asia/Karachi")
        .format("YYYY-MM-DD HH:mm:ss"),
    }));

    const totalCount = await Order.countDocuments(query);
    const count = formattedOrders.length;

    const totalPages = Math.ceil(totalCount / Number(perPage));

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      page: Number(page),
      perPage: Number(perPage),
      count,
      totalCount,
      totalPages,
      data: formattedOrders,
    });
  }),
  getOverAllOrders: asyncHandler(async (req, res) => {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
    ]);

    const total = await Order.countDocuments();
    stats.push({ status: "TOTAL", count: total });

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: stats,
    });
  }),
  updateOrderStatus: asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    if (req.user.role !== "admin" && req?.files?.RefundSS[0]) {
      return res.status(400).json({
        success: false,
        message: "Only admin can upload refund screenshot",
      });
    }

    let refundSSKey = null;

    if (req?.files?.RefundSS[0])
      refundSSKey = await uploadToR2(
        req?.files?.RefundSS[0],
        "screenshots/refund"
      );

    const refundSSUrl = req?.files?.RefundSS[0]
      ? `${process.env.R2_PUBLIC_URL}/${refundSSKey}`
      : null;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const oldStatus = order.status;
    const userRole = req.user.role;

    // 🔐 Role-based validation
    if (userRole === "admin") {
      if (!ADMIN_ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Admin cannot set status to "${status}". Allowed: ${ADMIN_ALLOWED_STATUSES.join(
            ", "
          )}`,
        });
      }
    } else if (userRole === "user") {
      if (!USER_ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `User cannot set status to "${status}". Allowed: ${USER_ALLOWED_STATUSES.join(
            ", "
          )}`,
        });
      }

      if (order.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update this order",
        });
      }
    }

    // 🚫 Prevent redundant updates
    if (oldStatus === status) {
      return res.status(400).json({
        success: false,
        message: "Order is already in this status",
      });
    }

    // ✅ Update order + push status history
    order.status = status;
    order.RefundSS = refundSSUrl;
    order.statusHistory.push({
      previousStatus: oldStatus,
      newStatus: status,
      changedBy: req.user._id,
      role: req.user.role,
      changedAt: new Date(),
    });

    await order.save();

    // 🧾 Optional: keep global alert collection (for feed)
    await alertSystem.create({
      orderId: order._id,
      changedBy: req.user._id,
      role: req.user.role,
      previousStatus: oldStatus,
      newStatus: status,
    });

    // 🔴 Real-time event (everyone sees)
    const io = getIO();
    io.emit("order-status-changed", {
      orderId: order._id,
      previousStatus: oldStatus,
      newStatus: status,
      changedBy: {
        id: req.user._id,
        username: req.user.username,
        role: req.user.role,
      },
      createdAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  }),
  getOrder: asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId", "email username")
      .populate("statusHistory.changedBy", "email username")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 🔄 Sort statusHistory (latest first)
    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.sort(
        (a, b) => new Date(b.changedAt) - new Date(a.changedAt)
      );
    }

    res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  }),
};

module.exports = ordersController;
