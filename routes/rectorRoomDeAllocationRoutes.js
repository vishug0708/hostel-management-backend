const express = require("express");

const router = express.Router();

const {
    getRectorRoomAllocations,
    deallocateRoom
} = require(
    "../controllers/rectorRoomDeAllocationController"
);


// =====================================================
// GET ACTIVE ROOM ALLOCATIONS
// =====================================================

router.get(
    "/",
    getRectorRoomAllocations
);


// =====================================================
// DEALLOCATE STUDENT
// =====================================================

router.put(
    "/deallocate",
    deallocateRoom
);


module.exports = router;