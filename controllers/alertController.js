const mongoose = require("mongoose");
const alertSystem = require("../models/AlertSystem");
const Order = require("../models/Order");
const asyncHandler = require("../utils/asyncHandler");

const alertController = {
  getOrderHistory: asyncHandler(async (req, res) => {
    const { page = 1, perPage = 10, orderId, status, since } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const limit = Math.max(Number(perPage) || 10, 1);
    const skip = (currentPage - 1) * limit;
    const query = {};

    if (status) {
      query.newStatus = status;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    }

    if (req.user.role === "admin") {
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
        query.orderId = orderId;
      }
    } else {
      const ownerOrderQuery = { userId: req.user._id };
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
        ownerOrderQuery._id = orderId;
      }

      const ownOrders = await Order.find(ownerOrderQuery).select("_id").lean();
      const ownOrderIds = ownOrders.map((o) => o._id);

      if (ownOrderIds.length === 0) {
        return res.status(200).json({
          success: true,
          message: "Order history fetched successfully",
          page: currentPage,
          perPage: limit,
          totalCount: 0,
          count: 0,
          totalPages: 0,
          data: [],
        });
      }

      query.orderId = { $in: ownOrderIds };
    }

    const [history, total] = await Promise.all([
      alertSystem
        .find(query)
        .populate([
          {
            path: "orderId",
            select: "-OrderSS -AmazonProductSS",
          },
          {
            path: "changedBy",
            select: "email username role",
          },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      alertSystem.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Order history fetched successfully",
      page: currentPage,
      perPage: limit,
      totalCount: total,
      count: history.length,
      totalPages: Math.ceil(total / limit),
      data: history,
    });
  }),
};

module.exports = alertController;
