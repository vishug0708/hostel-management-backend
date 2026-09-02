const express = require("express");

const router = express.Router();

const {
    getBookingHistory
} = require("../controllers/adminCricketBookingController");

router.get(
    "/history",
    getBookingHistory
);

module.exports = router;