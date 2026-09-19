const express = require("express");

const {
    applyGatePass,
    getMyGatePasses,
    getGatePassById,
    verifyParentOTP,
    resendParentOTP
} = require("../controllers/studentGatePassController");

const router = express.Router();


// ======================================================
// APPLY GATE PASS
// ======================================================

router.post(
    "/apply",
    applyGatePass
);


// ======================================================
// GET MY GATE PASSES
// ======================================================

router.get(
    "/my/:student_id",
    getMyGatePasses
);


// ======================================================
// GET SINGLE GATE PASS
// ======================================================

router.get(
    "/:student_id/:gate_pass_id",
    getGatePassById
);


router.post(
    "/verify-otp/:gatePassId",
    verifyParentOTP
);

router.post(
    "/resend-otp/:gatePassId",
    resendParentOTP
);


module.exports = router;