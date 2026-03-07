const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { userRoom } = require("../utils/socketRooms");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers["x-auth-token"] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id role username");

      if (!user) {
        return next(new Error("Authentication failed"));
      }

      socket.user = {
        id: String(user._id),
        role: user.role,
        username: user.username,
      };

      return next();
    } catch (err) {
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const room = userRoom(socket.user.id);
    socket.join(room);

    console.log(
      "Client connected:",
      socket.id,
      "user:",
      socket.user.id,
      "room:",
      room
    );

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id, "user:", socket.user.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

module.exports = { initSocket, getIO };
