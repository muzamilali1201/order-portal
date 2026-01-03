const router = require("express").Router();
const sheetController = require("../controllers/sheetController");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/", [authMiddleware], sheetController.createSheet);
router.get("/", [authMiddleware], sheetController.getSheets);
router.delete("/:sheetId", [authMiddleware], sheetController.deleteSheet);

const sheeRoutes = router;
module.exports = sheeRoutes;
