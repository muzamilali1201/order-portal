const alertSystem = require("../models/AlertSystem");
const asyncHandler = require("../utils/asyncHandler");

const alertController = {
  getOrderHistory: asyncHandler(async (req, res) => {
    const { page = 1, perPage = 10 } = req.query;

    const currentPage = Number(page);
    const limit = Number(perPage);
    const skip = (currentPage - 1) * limit;

    const [history, total] = await Promise.all([
      alertSystem
        .find()
        .populate([
          {
            path: "orderId",
            select: "-OrderSS -AmazonProductSS",
          },
          {
            path: "changedBy",
            select: "email username",
          },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      alertSystem.countDocuments(),
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
