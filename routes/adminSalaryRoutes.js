const express = require("express");

const router = express.Router();

const {
    generateMonthly,
    getAllSalary,
    getStaffSalary,
    getRectorSalary,
    getPendingSalary,
    getSalaryHistory,
    getSalaryById,
    paySalary
} = require("../controllers/adminSalaryController");

// Generate current month's salary records
router.post("/generate-monthly", generateMonthly);

// IMPORTANT:
// These specific routes must come BEFORE /:id
router.get("/staff", getStaffSalary);
router.get("/rector", getRectorSalary);
router.get("/pending", getPendingSalary);
router.get("/history", getSalaryHistory);

// Get all salary records
router.get("/", getAllSalary);

// Get single salary record
router.get("/:id", getSalaryById);

// Mark salary as paid
router.patch("/:id/pay", paySalary);

module.exports = router;