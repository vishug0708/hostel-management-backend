const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createSalary,
    getAllSalaries,
    getSalary,
    markSalaryPaid,
    deleteSalary,
    getStaffSalaries,
    getRectorSalaries,
    getPendingSalaries,
    getPaymentHistory,
    getSalaryReport
} = require("../controllers/salaryController");

const router = express.Router();

// =====================================================
// STAFF SALARY
// =====================================================

router.get(
    "/staff",
    authMiddleware,
    getStaffSalaries
);

// =====================================================
// RECTOR SALARY
// =====================================================

router.get(
    "/rector",
    authMiddleware,
    getRectorSalaries
);

// =====================================================
// PENDING SALARY
// =====================================================

router.get(
    "/pending",
    authMiddleware,
    getPendingSalaries
);

// =====================================================
// PAYMENT HISTORY
// =====================================================

router.get(
    "/history",
    authMiddleware,
    getPaymentHistory
);

// =====================================================
// MONTHLY REPORT
// =====================================================

router.get(
    "/report",
    authMiddleware,
    getSalaryReport
);

// =====================================================
// ALL SALARIES
// =====================================================

router.get(
    "/",
    authMiddleware,
    getAllSalaries
);

// =====================================================
// SINGLE SALARY
// =====================================================

router.get(
    "/:id",
    authMiddleware,
    getSalary
);

// =====================================================
// CREATE SALARY
// =====================================================

router.post(
    "/",
    authMiddleware,
    createSalary
);

// =====================================================
// MARK PAID
// =====================================================

router.patch(
    "/:id/pay",
    authMiddleware,
    markSalaryPaid
);

// =====================================================
// DELETE
// =====================================================

router.delete(
    "/:id",
    authMiddleware,
    deleteSalary
);

module.exports = router;