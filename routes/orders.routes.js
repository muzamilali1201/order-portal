const express = require("express");
const upload = require("../middlewares/upload.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createOrderSchema } = require("../validators/order.validator");
const ordersController = require("../controllers/orderController");

const router = express.Router();

router.delete("/:orderId", [authMiddleware], ordersController.deleteOrder);

router.post("/:orderId/comment", authMiddleware, ordersController.addComment);

router.get(
  "/overall-orders",
  [authMiddleware],
  ordersController.getOverAllOrders
);
router.get("/:orderId", [authMiddleware], ordersController.getOrder);

router.put(
  "/:orderId",
  [
    authMiddleware,
    upload.fields([
      { name: "RefundSS", maxCount: 1 },
      { name: "ReviewSS", maxCount: 1 },
    ]),
  ],
  ordersController.updateOrderStatus
);

router.get("/", [authMiddleware], ordersController.getOrders);

router.post(
  "/create",
  authMiddleware,

  upload.fields([
    { name: "OrderSS", maxCount: 1 },
    { name: "AmazonProductSS", maxCount: 1 },
  ]),
  validate(createOrderSchema),

  ordersController.createOrder
);

module.exports = router;
