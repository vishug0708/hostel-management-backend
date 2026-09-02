const express = require("express");

const router = express.Router();

const {
    getRectorRooms,
    getRectorRoomById
} = require("../controllers/rectorRoomController");


// ==========================================
// RECTOR ROOM ROUTES
// ==========================================

// Get all rooms
router.get(
    "/",
    getRectorRooms
);

// Get single room with students
router.get(
    "/:id",
    getRectorRoomById
);


module.exports = router;