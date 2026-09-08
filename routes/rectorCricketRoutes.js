const express = require("express");

const {
    getCricketStats,
    getCricketBookings,
    getCricketBookingById,
    updateCricketBookingStatus
} = require("../controllers/rectorCricketController");

const router = express.Router();

/*
 * Authentication is handled inside rectorCricketController.
 * This keeps the new module compatible with the project's
 * current `rector-<id>` Rector token as well as JWT tokens.
 */

router.get("/stats", getCricketStats);

router.get("/bookings", getCricketBookings);

router.get("/bookings/:id", getCricketBookingById);

router.put("/bookings/:id/status", updateCricketBookingStatus);

module.exports = router;
