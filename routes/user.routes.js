const express = require("express");
const userController = require("../controllers/userController");
const validate = require("../middlewares/validate.middleware");
const { registerSchema, loginSchema } = require("../validators/user.validator");

const router = express.Router();

router.post(
  "/register",
  [validate(registerSchema)],
  userController.registerUser
);
router.post("/login", [validate(loginSchema)], userController.loginUser);

module.exports = router;
