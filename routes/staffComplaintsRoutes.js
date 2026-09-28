const express = require("express");
const {
  getAssignedComplaints,
  getComplaintDetail,
  updateComplaintStatus,
  setExpectedResolutionDate,
  addResolutionNote,
  sendOTPToStudent,
  verifyOTPAndClose,
} = require("../controllers/staffComplaintsController.js");
const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

// Get all assigned complaints for staff
router.get("/complaints", authMiddleware, getAssignedComplaints);

// Get complaint detail
router.get("/complaints/:complaintId", authMiddleware, getComplaintDetail);

// Update complaint status
router.put("/complaints/:complaintId/status", authMiddleware, updateComplaintStatus);

// Set expected resolution date
router.put("/complaints/:complaintId/expected-date", authMiddleware, setExpectedResolutionDate);

// Add resolution note
router.put("/complaints/:complaintId/resolution-note", authMiddleware, addResolutionNote);

// Send OTP to student
router.post("/complaints/:complaintId/send-otp", authMiddleware, sendOTPToStudent);

// Verify OTP and close complaint
router.post("/complaints/:complaintId/verify-otp", authMiddleware, verifyOTPAndClose);

module.exports = router;
