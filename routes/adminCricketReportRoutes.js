const express = require("express");

const router = express.Router();

const {
    getCricketReports
} = require("../controllers/adminCricketReportController");

const authMiddleware = require("../middleware/authMiddleware");

router.get(
    "/",
    authMiddleware,
    getCricketReports
);

module.exports = router;