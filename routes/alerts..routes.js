const alertController = require("../controllers/alertController");
const authMiddleware = require("../middlewares/auth.middleware");

const router = require("express").Router();

router.get("/history", [authMiddleware], alertController.getOrderHistory);

const alertRoutes = router;
module.exports = alertRoutes;
