const express = require("express");

const {
    verifyParentOTP,
    getParentGatePass,
    approveParentGatePass,
    rejectParentGatePass
} = require("../controllers/parentGatePassController");

const router = express.Router();

router.post(
    "/:gatePassId/verify-otp",
    verifyParentOTP
);

router.get(
    "/:gatePassId",
    getParentGatePass
);

router.post(
    "/:gatePassId/approve",
    approveParentGatePass
);

router.post(
    "/:gatePassId/reject",
    rejectParentGatePass
);

module.exports = router;
