const alertController = require("../controllers/alertController");

const router = require("express").Router();

router.get("/history", alertController.getOrderHistory);

const alertRoutes = router;
module.exports = alertRoutes;
