const express = require("express");

const router =
    express.Router();

const {
    getAvailableStudents,
    getAvailableRooms,
    allocateRoom
} = require(
    "../controllers/rectorRoomAllocationController"
);


// =====================================================
// GET STUDENTS
// =====================================================

router.get(
    "/students",
    getAvailableStudents
);


// =====================================================
// GET ROOMS
// =====================================================

router.get(
    "/rooms",
    getAvailableRooms
);


// =====================================================
// ALLOCATE ROOM
// =====================================================

router.post(
    "/allocate",
    allocateRoom
);


module.exports = router;