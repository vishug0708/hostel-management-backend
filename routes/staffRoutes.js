const express = require("express");
const authMiddleware = require("../middleware/staffAuthMiddleware");
const uploadStaffPhoto = require("../middleware/uploadStaffPhoto");
const { getStaffProfile, updateStaffProfile, changeStaffPassword } = require("../controllers/staffController");
const router = express.Router();
router.get("/profile", authMiddleware, getStaffProfile);
router.put("/profile", authMiddleware, uploadStaffPhoto.single("photo"), updateStaffProfile);
router.put("/change-password", authMiddleware, changeStaffPassword);
module.exports = router;