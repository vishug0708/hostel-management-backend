const express = require("express");
const router = express.Router();
const { getMySalary } = require("../controllers/rectorSalaryController");

// No rectorAuthMiddleware exists in the current project.
// rectorSalaryController validates the existing rector-<id> token and active status.
router.get("/", getMySalary);

module.exports = router;
