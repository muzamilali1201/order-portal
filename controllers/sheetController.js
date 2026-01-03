const Sheet = require("../models/Sheet");
const User = require("../models/User");

const sheetController = {
  createSheet: async (req, res) => {
    const { name } = req.body;
    const sheet = await Sheet.create({ name, createdBy: req.user._id });
    return res.status(200).json({
      success: true,
      message: "Sheet created successfully",
      data: sheet,
    });
  },
  getSheets: async (req, res) => {
    const sheets = await Sheet.find().populate("createdBy", "email username");
    return res.status(200).json({
      success: true,
      message: "Sheets fetched successfully",
      data: sheets,
    });
  },
  deleteSheet: async (req, res) => {
    const { sheetId } = req.params;
    const sheet = await Sheet.findByIdAndDelete(sheetId);
    return res.status(200).json({
      success: true,
      message: "Sheet deleted successfully",
      data: sheet,
    });
  },
};

module.exports = sheetController;
