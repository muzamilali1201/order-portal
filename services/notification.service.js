const Order = require("../models/Order");
const { getIO } = require("../socket");
const { userRoom } = require("../utils/socketRooms");

async function getRelevantUserIdsForOrder(orderOrId) {
  let order = orderOrId;

  if (!order || typeof order !== "object" || !order.userId) {
    order = await Order.findById(orderOrId).select("userId").lean();
  }

  if (!order?.userId) {
    return [];
  }

  return [String(order.userId)];
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
