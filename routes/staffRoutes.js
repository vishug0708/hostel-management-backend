const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getStaffProfile } = require("../controllers/staffController");

const router = express.Router();

router.get("/profile", authMiddleware, getStaffProfile);

module.exports = router;
