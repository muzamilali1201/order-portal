const Order = require("../models/Order");
const {
  uploadToR2,
  extractR2KeyFromUrl,
  deleteFromR2,
} = require("../services/r2.services");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const alertSystem = require("../models/AlertSystem");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const User = require("../models/User");
const { getIO } = require("../socket");
const Sheet = require("../models/Sheet");
const getNextStatusTime = require("../helpers/nextStatusTime");

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
  "COMMISSION_COLLECTED",
  "PAID",
  "SENT_TO SELLER",
  "ON HOLD",
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
    const {
      amazonOrderNo,
      buyerPaypal,
      orderName,
      comments,
      buyerName,
      sheetName,
      commission,
    } = req.body;

    if (!req.files?.OrderSS || !req.files?.AmazonProductSS) {
      return res.status(400).json({
        success: false,
        message: "Order and Amazon Product screenshots are required",
      });
    }
    let sheet = null;
    if (sheetName && sheetName.length > 0) {
      const sheetExist = await Sheet.findOne({ name: sheetName });
      sheet = sheetExist?._id;
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

    const commentsHistory = [
      {
        comment: comments,
        commentedBy: req.user._id,
        role: req.user.role,
      },
    ];

    const nextStatusAt = new Date();
    nextStatusAt.setDate(nextStatusAt.getDate() + 10);

    const order = await Order.create({
      userId: req.user._id,
      amazonOrderNo,
      buyerPaypal,
      orderName,
      commentsHistory,
      OrderSS: orderSSUrl,
      commission,
      AmazonProductSS: productSSUrl,
      buyerName,
      sheet,
      nextStatusAt,
    });

    const io = getIO();
    io.emit("newOrder", order);

    await alertSystem.create({
      orderId: order._id,
      changedBy: req.user._id,
      role: req.user.role,
      previousStatus: "ORDERED",
      newStatus: "ORDERED",
      action: "CREATE_ORDER",
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  }),

  getOrders: asyncHandler(async (req, res) => {
    const { filterBy, page = 1, perPage = 10, search = "" } = req.query;
    const user = req.user;
    const skip = (Number(page) - 1) * Number(perPage);
    const query = {};

    const allowedStatuses = [
      "ORDERED",
      "REVIEWED",
      "SENT_TO SELLER",
      "REVIEW_AWAITED",
      "REFUND_DELAYED",
      "REFUNDED",
      "CORRECTED",
      "CANCELLED",
      "COMMISSION_COLLECTED",
      "PAID",
      "ON HOLD",
      "SENT",
    ];

    if (user.role !== "admin") {
      query.userId = user._id;
    }

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
        { buyerName: { $regex: search, $options: "i" } },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const orders = await Order.find(query)
      .populate("userId", "email username")
      .populate("sheet", "name")
      .sort({ updatedAt: -1 })
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
    const admin = req.user?.role == "admin" ? true : false;
    const match = {};

    if (!admin) match.userId = req.user._id;

    const stats = await Order.aggregate([
      {
        $match: match,
      },
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

    const total = await Order.countDocuments(match);
    stats.push({ status: "TOTAL", count: total });

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: stats,
    });
  }),
  updateOrderStatus: asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, commission } = req.body;

    if (req.user.role !== "admin" && req?.files?.RefundSS?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Only admin can upload refund screenshot",
      });
    }

    let refundSSKey = null;

    let reviewedSSKey = null;

    if (req?.files?.ReviewSS?.length > 0)
      reviewedSSKey = await uploadToR2(
        req?.files?.ReviewSS[0],
        "screenshots/review"
      );

    if (req?.files?.RefundSS?.length > 0)
      refundSSKey = await uploadToR2(
        req?.files?.RefundSS[0],
        "screenshots/refund"
      );

    const refundSSUrl =
      req?.files?.RefundSS?.length > 0
        ? `${process.env.R2_PUBLIC_URL}/${refundSSKey}`
        : null;

    const reviewedSSUrl =
      req?.files?.ReviewSS?.length > 0
        ? `${process.env.R2_PUBLIC_URL}/${reviewedSSKey}`
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

    order.nextStatusAt = getNextStatusTime(status);

    let alert = false;

    if (oldStatus !== status) {
      alert = true;
      order.status = status;
    }

    if (refundSSUrl) {
      order.RefundSS = refundSSUrl;
    }

    if (reviewedSSUrl) {
      order.ReviewedSS = reviewedSSUrl;
    }
    if (commission) order.commission = commission;
    order.statusHistory.push({
      previousStatus: oldStatus,
      newStatus: status,
      changedBy: req.user._id,
      role: req.user.role,
      changedAt: new Date(),
    });

    await order.save();

    if (alert) {
      await alertSystem.create({
        orderId: order._id,
        changedBy: req.user._id,
        role: req.user.role,
        previousStatus: oldStatus,
        newStatus: status,
      });

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
    }

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
      .populate("statusHistory.changedBy", "email username role")
      .populate("commentsHistory.commentedBy", "email username commentedAt")
      .populate("sheet", "name")
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
  addComment: asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { comment } = req.body;

    if (!comment?.trim()) {
      throw new AppError("Comment is required", 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = order.userId.toString() === req.user._id.toString();

    // 🔐 ONLY admin OR order owner
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to add comment to this order",
      });
    }

    order.commentsHistory.push({
      comment,
      commentedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: order.commentsHistory,
    });
  }),
  deleteOrder: asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = order.userId.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this order",
      });
    }
    let key = null;
    // delete pictures from R2
    if (order.OrderSS) {
      key = extractR2KeyFromUrl(order.OrderSS);
      await deleteFromR2(key);
    }
    if (order.AmazonProductSS) {
      key = extractR2KeyFromUrl(order.AmazonProductSS);
      await deleteFromR2(key);
    }
    if (order.RefundSS) {
      key = extractR2KeyFromUrl(order.RefundSS);
      await deleteFromR2(key);
    }
    if (order.ReviewedSS) {
      key = extractR2KeyFromUrl(order.ReviewedSS);
      await deleteFromR2(key);
    }

    await Order.findByIdAndDelete(orderId);

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  }),
};

module.exports = ordersController;
