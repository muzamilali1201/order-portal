const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const userController = {
  // =========================
  // REGISTER USER
  // =========================
  registerUser: asyncHandler(async (req, res) => {
    const { username, email, password, role } = req.body;
    const userObj = req.user; // admin (if protected)

    if (role == "admin") {
      const adminExist = await User.findOne({ role: "admin" });
      if (adminExist) {
        return res.status(400).json({
          success: false,
          message: "Admin already exists",
        });
      }
    }

    const alreadyExist = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (alreadyExist) {
      throw new AppError("User already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
    });

    const newUser = user.toObject();

    delete newUser.password;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  }),

  // =========================
  // LOGIN USER (JWT ISSUED HERE)
  // =========================
  loginUser: asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found with this email.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user?.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    delete user.password;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: user,
    });
  }),
};

module.exports = userController;
