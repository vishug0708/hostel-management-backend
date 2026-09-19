const express = require("express");

const {
    getAllGatePasses,
    getPendingGatePasses,
    getGatePassById,
    approveGatePass,
    rejectGatePass
} = require("../controllers/rectorGatePassController");

const router = express.Router();

// ======================================================
// GET ALL GATE PASSES
// GET /api/rector/gatepass
// ======================================================

router.get(
    "/",
    getAllGatePasses
);

// ======================================================
// GET PENDING GATE PASSES
// GET /api/rector/gatepass/pending
// ======================================================

router.get(
    "/pending",
    getPendingGatePasses
);

// ======================================================
// GET SINGLE GATE PASS
// GET /api/rector/gatepass/:id
// ======================================================

router.get(
    "/:id",
    getGatePassById
);

// ======================================================
// APPROVE GATE PASS
// PUT /api/rector/gatepass/:id/approve
// ======================================================

router.put(
    "/:id/approve",
    approveGatePass
);

// ======================================================
// REJECT GATE PASS
// PUT /api/rector/gatepass/:id/reject
// ======================================================

router.put(
    "/:id/reject",
    rejectGatePass
);

module.exports = router;
