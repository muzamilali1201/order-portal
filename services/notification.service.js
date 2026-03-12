const Order = require("../models/Order");
const User = require("../models/User");
const { getIO } = require("../socket");
const { userRoom } = require("../utils/socketRooms");

async function getRelevantUserIdsForOrder(orderOrId) {
  let order = orderOrId;

  if (!order || typeof order !== "object" || !order.userId) {
    order = await Order.findById(orderOrId).select("userId").lean();
  }

  const userIds = new Set();

  if (order?.userId) {
    userIds.add(String(order.userId));
  }

  const admins = await User.find({ role: "admin" }).select("_id").lean();
  for (const admin of admins) {
    userIds.add(String(admin._id));
  }

  return [...userIds];
}

function emitToUsers(eventName, payload, userIds) {
  const io = getIO();
  for (const userId of userIds) {
    io.to(userRoom(userId)).emit(eventName, payload);
  }
}

async function emitOrderStatusChanged(orderOrId, payload) {
  const userIds = await getRelevantUserIdsForOrder(orderOrId);
  emitToUsers("order-status-changed", payload, userIds);
}

async function emitNewOrder(orderOrId, payload) {
  const userIds = await getRelevantUserIdsForOrder(orderOrId);
  emitToUsers("newOrder", payload, userIds);
}

module.exports = {
  userRoom,
  emitToUsers,
  getRelevantUserIdsForOrder,
  emitOrderStatusChanged,
  emitNewOrder,
};
