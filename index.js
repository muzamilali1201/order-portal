require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

const http = require("http");
const express = require("express");
const cors = require("cors");

const connectDb = require("./config/connectDb");
const appRoutes = require("./routes/routes");
const errorHandler = require("./middlewares/error.middleware");
const { initSocket } = require("./socket");

// initialize app
const app = express();
const PORT = process.env.PORT || 3001;

// middlewares
app.use(cors());
app.use(express.json());

// routes
app.use("/api/v1", appRoutes);

// error handler (must be last)
app.use(errorHandler);

// connect DB
connectDb();

// create HTTP server (IMPORTANT for socket.io)
const server = http.createServer(app);

// initialize socket.io
initSocket(server);

// start cron jobs (only once)
require("./jobs/orderStatus.job");

// start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
