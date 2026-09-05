const express = require("express");
const router = express.Router();
const staffAuthMiddleware = require("../middleware/staffAuthMiddleware");
const { getMySalary } = require("../controllers/staffSalaryController");

router.get("/", staffAuthMiddleware, getMySalary);

module.exports = router;
