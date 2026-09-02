const express = require("express");

const {
    getRooms,
    getRoomById,
    addRoom,
    updateRoom,
    deleteRoom,
    getRoomStats,
    getBlocks
} = require("../controllers/adminRoomController");

const router = express.Router();

// =====================================================
// ROOM ROUTES
// =====================================================

// GET all rooms
router.get(
    "/",
    getRooms
);

// GET room statistics
router.get(
    "/stats",
    getRoomStats
);

// GET fixed blocks A-H
router.get(
    "/blocks",
    getBlocks
);

// GET single room
router.get(
    "/:id",
    getRoomById
);

// ADD room
router.post(
    "/",
    addRoom
);

// UPDATE room
router.put(
    "/:id",
    updateRoom
);

// DELETE room
router.delete(
    "/:id",
    deleteRoom
);

module.exports = router;