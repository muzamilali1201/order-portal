const alertSystem = require("../models/AlertSystem");
const asyncHandler = require("../utils/asyncHandler");

const alertController = {
  getOrderHistory: asyncHandler(async (req, res) => {
    const { page = 1, perPage = 10 } = req.query;

    const currentPage = Number(page);
    const limit = Number(perPage);
    const skip = (currentPage - 1) * limit;

    const isAdmin = req.user.role === "admin";

    // 🔐 base query
    const query = {};

    const [history, total] = await Promise.all([
      alertSystem
        .find(query)
        .populate([
          {
            path: "orderId",
            select: "-OrderSS -AmazonProductSS",
            ...(isAdmin
              ? {}
              : {
                  match: { userId: req.user._id }, // 👈 KEY LINE
                }),
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

      alertSystem.countDocuments(query),
    ]);

    // ❗ remove alerts where populate failed (non-owner orders)
    const filteredHistory = isAdmin
      ? history
      : history.filter((h) => h.orderId !== null);

    const totalFiltered = isAdmin ? total : filteredHistory.length;

    res.status(200).json({
      success: true,
      message: "Order history fetched successfully",
      page: currentPage,
      perPage: limit,
      totalCount: totalFiltered,
      count: filteredHistory.length,
      totalPages: Math.ceil(totalFiltered / limit),
      data: filteredHistory,
    });
  }),
};

module.exports = alertController;
