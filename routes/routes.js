const router = require("express").Router();
const alertRoutes = require("./alerts..routes.js");
const userRoutes = require("./user.routes");
const orderRoutes = require("./orders.routes");
const sheetRoutes = require("./sheet.routes");

router.use("/alert", alertRoutes);
router.use("/user", userRoutes);
router.use("/order", orderRoutes);
router.use("/sheet", sheetRoutes);

const appRoutes = router;
module.exports = appRoutes;
