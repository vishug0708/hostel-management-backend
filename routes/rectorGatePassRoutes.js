const express = require("express");

const router = express.Router();

const {
    getAllGatePasses,
    getPendingGatePasses,
    getGatePassById,
    approveGatePass,
    rejectGatePass
} = require("../controllers/rectorGatePassController");


// ======================================================
// GET ALL GATE PASSES
// ======================================================
router.get(
    "/",
    getAllGatePasses
);


// ======================================================
// GET PENDING GATE PASSES
// ======================================================
router.get(
    "/pending",
    getPendingGatePasses
);


// ======================================================
// GET SINGLE GATE PASS
// ======================================================
router.get(
    "/:id",
    getGatePassById
);


// ======================================================
// APPROVE GATE PASS
// ======================================================
router.put(
    "/:id/approve",
    approveGatePass
);


// ======================================================
// REJECT GATE PASS
// ======================================================
router.put(
    "/:id/reject",
    rejectGatePass
);


module.exports = router;