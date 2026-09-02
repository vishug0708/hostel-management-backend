const express = require("express");

const {
    getSecurityProfile,
    getSecurityDashboard,
    getSecurityGatePassSummary
} = require("../controllers/securityController");

const router = express.Router();


// ===============================
// SECURITY PROFILE
// ===============================

router.get(
    "/profile/:id",
    getSecurityProfile
);


// ===============================
// SECURITY DASHBOARD
// ===============================

router.get(
    "/dashboard/:id",
    getSecurityDashboard
);


// ===============================
// SECURITY GATE PASS SUMMARY
// ===============================

router.get(
    "/gatepass",
    getSecurityGatePassSummary
);


module.exports = router;