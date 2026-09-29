const express = require("express");
const {
  getAssignedComplaints,
  getComplaintDetail,
  updateComplaintStatus,
  setExpectedResolutionDate,
  addResolutionNote,
  sendOTPToRecipient,
  verifyOTPAndClose,
} = require("../controllers/staffComplaintsController.js");
const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

router.get("/complaints", authMiddleware, getAssignedComplaints);
router.get("/complaints/:complaintId", authMiddleware, getComplaintDetail);

router.put(
  "/complaints/:complaintId/status",
  authMiddleware,
  updateComplaintStatus
);

router.put(
  "/complaints/:complaintId/expected-date",
  authMiddleware,
  setExpectedResolutionDate
);

router.put(
  "/complaints/:complaintId/resolution-note",
  authMiddleware,
  addResolutionNote
);

router.post(
  "/complaints/:complaintId/send-otp",
  authMiddleware,
  sendOTPToRecipient
);

router.post(
  "/complaints/:complaintId/verify-otp",
  authMiddleware,
  verifyOTPAndClose
);

module.exports = router;
