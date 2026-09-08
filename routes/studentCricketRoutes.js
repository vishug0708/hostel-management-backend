const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getGrounds,
    getGroundSlots,
    getSlotById,
    createBooking,
    getMyBookings,
    getMyBookingById,
    getBookingPlayers,
    getBookingQr,
    searchStudents
} = require("../controllers/studentCricketController");

const router = express.Router();

// =====================================================
// GROUNDS
// =====================================================

router.get(
    "/grounds",
    authMiddleware,
    getGrounds
);

// =====================================================
// SLOTS
// =====================================================

router.get(
    "/grounds/:groundId/slots",
    authMiddleware,
    getGroundSlots
);

router.get(
    "/slots/:slotId",
    authMiddleware,
    getSlotById
);

// =====================================================
// STUDENT SEARCH
// =====================================================

router.get(
    "/students/search",
    authMiddleware,
    searchStudents
);

// =====================================================
// BOOKINGS
// =====================================================

router.post(
    "/bookings",
    authMiddleware,
    createBooking
);

router.get(
    "/bookings",
    authMiddleware,
    getMyBookings
);

router.get(
    "/bookings/:id",
    authMiddleware,
    getMyBookingById
);

router.get(
    "/bookings/:id/players",
    authMiddleware,
    getBookingPlayers
);

router.get(
    "/bookings/:id/qr",
    authMiddleware,
    getBookingQr
);

module.exports = router;