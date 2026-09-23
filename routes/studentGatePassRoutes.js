const express = require("express");

const {
    applyGatePass,
    getMyGatePasses,
    getGatePassById
} = require("../controllers/studentGatePassController");

const router = express.Router();

// ======================================================
// APPLY GATE PASS
// POST /api/student/gatepass/apply
// ======================================================

router.post(
    "/apply",
    applyGatePass
);

// ======================================================
// GET MY GATE PASSES
// GET /api/student/gatepass/my/:student_id
// ======================================================

router.get(
    "/my/:student_id",
    getMyGatePasses
);

// ======================================================
// GET SINGLE GATE PASS
// GET /api/student/gatepass/:student_id/:gate_pass_id
// ======================================================

router.get(
    "/:student_id/:gate_pass_id",
    getGatePassById
);

module.exports = router;
