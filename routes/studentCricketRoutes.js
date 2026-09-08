const express = require("express");

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
    getGrounds
);


// =====================================================
// SLOTS
// =====================================================

router.get(
    "/grounds/:groundId/slots",
    getGroundSlots
);

router.get(
    "/slots/:slotId",
    getSlotById
);

// =====================================================
// STUDENT SEARCH
// =====================================================

router.get(
    "/students/search",
    searchStudents
);


// =====================================================
// BOOKINGS
// =====================================================

router.post(
    "/bookings",
    createBooking
);

router.get(
    "/bookings",
    getMyBookings
);

router.get(
    "/bookings/:id",
    getMyBookingById
);

router.get(
    "/bookings/:id/players",
    getBookingPlayers
);

router.get(
    "/bookings/:id/qr",
    getBookingQr
);


module.exports = router;