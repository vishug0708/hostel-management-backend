const express = require("express");

const {
    getAssignedComplaints,
    getComplaintDetail,
    updateComplaintStatus,
    setExpectedResolutionDate,
    addResolutionNote,
    sendOTPToStudent,
    verifyOTPAndClose
} = require("../controllers/staffComplaintsController.js");

const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getAssignedComplaints
);

router.get(
    "/:complaintId",
    authMiddleware,
    getComplaintDetail
);

router.put(
    "/:complaintId/status",
    authMiddleware,
    updateComplaintStatus
);

router.put(
    "/:complaintId/expected-date",
    authMiddleware,
    setExpectedResolutionDate
);

router.put(
    "/:complaintId/resolution-note",
    authMiddleware,
    addResolutionNote
);

router.post(
    "/:complaintId/send-otp",
    authMiddleware,
    sendOTPToStudent
);

router.post(
    "/:complaintId/verify-otp",
    authMiddleware,
    verifyOTPAndClose
);

module.exports = router;