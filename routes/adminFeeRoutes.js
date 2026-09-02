const express = require("express");

const router = express.Router();

const {
    getFeesDashboard,
    getPaymentHistory,
    getPendingFees
} = require("../controllers/adminFeeController");

const authMiddleware = require("../middleware/authMiddleware");

// =====================================================
// FEES DASHBOARD
// =====================================================

router.get(
    "/dashboard",
    authMiddleware,
    getFeesDashboard
);

// =====================================================
// PAYMENT HISTORY
// =====================================================

router.get(
    "/payment-history",
    authMiddleware,
    getPaymentHistory
);

// =====================================================
// PENDING FEES
// =====================================================

router.get(
    "/pending",
    authMiddleware,
    getPendingFees
);

module.exports = router;