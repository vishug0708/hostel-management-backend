const express = require("express");
const router = express.Router();
const { generateMonthly, getAllSalary, getSalaryById, paySalary } = require("../controllers/adminSalaryController");

// No adminAuthMiddleware exists in the current project.
// adminSalaryController validates the existing Admin JWT itself (role === admin).
router.post("/generate-monthly", generateMonthly);
router.get("/", getAllSalary);
router.get("/:id", getSalaryById);
router.patch("/:id/pay", paySalary);

module.exports = router;
