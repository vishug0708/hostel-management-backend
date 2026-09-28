const db = require("../config/database.js");
const nodemailer = require("nodemailer");

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Get all complaints assigned to logged-in staff
const getAssignedComplaints = async (req, res) => {
  try {
    const staffId = req.user.id;
    const [complaints] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_phone,
        s.room_number AS student_room,
        s.photo AS student_photo,
        c.category,
        c.subject,
        c.description,
        c.status,
        c.created_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.assigned_at
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      WHERE c.assigned_staff_id = ?
      ORDER BY c.created_at DESC`,
      [staffId]
    );

    res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Assigned Complaints Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
      error: error.message,
    });
  }
};

// Get single complaint detail
const getComplaintDetail = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const staffId = req.user.id;

    const [complaint] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_phone,
        s.room_number AS student_room,
        s.photo AS student_photo,
        c.backup_student_id,
        c.backup_student_name,
        c.backup_student_mobile,
        c.backup_student_email,
        c.category,
        c.subject,
        c.description,
        c.attachment,
        c.status,
        c.created_at,
        c.assigned_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.resolution_marked_at,
        c.otp_verified,
        c.otp_verified_at,
        c.closed_at,
        c.rating,
        c.rating_feedback
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      WHERE c.id = ? AND c.assigned_staff_id = ?`,
      [complaintId, staffId]
    );

    if (!complaint || complaint.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found or not assigned to you.",
      });
    }

    res.json({
      success: true,
      complaint: complaint[0],
    });
  } catch (error) {
    console.error("Get Complaint Detail Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch complaint.",
      error: error.message,
    });
  }
};

// Update complaint status
const updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    const staffId = req.user.id;

    // Validate status
    const validStatuses = [
      "Assigned",
      "In Progress",
      "Resolution Pending",
      "OTP Verification",
      "Closed",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const updateQuery = `UPDATE complaints SET status = ?, resolution_marked_at = NOW() WHERE id = ? AND assigned_staff_id = ?`;

    const [result] = await db.query(updateQuery, [status, complaintId, staffId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found or not assigned to you.",
      });
    }

    res.json({
      success: true,
      message: "Complaint status updated successfully.",
    });
  } catch (error) {
    console.error("Update Complaint Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update complaint status.",
      error: error.message,
    });
  }
};

// Set expected resolution date
const setExpectedResolutionDate = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { expectedDate } = req.body;
    const staffId = req.user.id;

    if (!expectedDate) {
      return res.status(400).json({
        success: false,
        message: "Expected date is required.",
      });
    }

    const [result] = await db.query(
      `UPDATE complaints SET expected_resolution_at = ? WHERE id = ? AND assigned_staff_id = ?`,
      [expectedDate, complaintId, staffId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found or not assigned to you.",
      });
    }

    res.json({
      success: true,
      message: "Expected resolution date set successfully.",
    });
  } catch (error) {
    console.error("Set Expected Resolution Date Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set expected resolution date.",
      error: error.message,
    });
  }
};

// Add resolution note
const addResolutionNote = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { note } = req.body;
    const staffId = req.user.id;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Resolution note is required.",
      });
    }

    const [result] = await db.query(
      `UPDATE complaints SET resolution_note = ? WHERE id = ? AND assigned_staff_id = ?`,
      [note, complaintId, staffId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found or not assigned to you.",
      });
    }

    res.json({
      success: true,
      message: "Resolution note added successfully.",
    });
  } catch (error) {
    console.error("Add Resolution Note Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add resolution note.",
      error: error.message,
    });
  }
};

// Generate and send OTP to student
const sendOTPToStudent = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const staffId = req.user.id;

    // Get complaint and student details
    const [complaint] = await db.query(
      `SELECT c.student_id, c.id, s.email, s.name, c.complaint_code
       FROM complaints c
       LEFT JOIN students s ON s.id = c.student_id
       WHERE c.id = ? AND c.assigned_staff_id = ?`,
      [complaintId, staffId]
    );

    if (!complaint || complaint.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    const studentEmail = complaint[0].email;
    const studentName = complaint[0].name;
    const complaintCode = complaint[0].complaint_code;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = require("crypto")
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save OTP to database
    await db.query(
      `UPDATE complaints SET otp_hash = ?, otp_expires_at = ?, otp_recipient_type = 'Student', otp_email = ? WHERE id = ?`,
      [otpHash, expiresAt, studentEmail, complaintId]
    );

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: studentEmail,
      subject: `OTP for Complaint Resolution - ${complaintCode}`,
      html: `
        <h2>Complaint Resolution OTP</h2>
        <p>Dear ${studentName},</p>
        <p>Your complaint <strong>${complaintCode}</strong> has been resolved.</p>
        <p>Please verify with this OTP: <strong>${otp}</strong></p>
        <p>This OTP is valid for 15 minutes.</p>
        <p>Regards,<br/>Hostel Management System</p>
      `,
    });

    res.json({
      success: true,
      message: "OTP sent to student email successfully.",
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP.",
      error: error.message,
    });
  }
};

// Verify OTP and close complaint
const verifyOTPAndClose = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { otp } = req.body;
    const staffId = req.user.id;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required.",
      });
    }

    // Get complaint
    const [complaint] = await db.query(
      `SELECT otp_hash, otp_expires_at FROM complaints WHERE id = ? AND assigned_staff_id = ?`,
      [complaintId, staffId]
    );

    if (!complaint || complaint.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    // Verify OTP expiry
    if (new Date() > complaint[0].otp_expires_at) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired.",
      });
    }

    // Verify OTP hash
    const otpHash = require("crypto")
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (otpHash !== complaint[0].otp_hash) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // Update complaint to closed
    await db.query(
      `UPDATE complaints SET status = 'Closed', otp_verified = 'Yes', otp_verified_at = NOW(), closed_at = NOW() WHERE id = ?`,
      [complaintId]
    );

    res.json({
      success: true,
      message: "Complaint closed successfully.",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP.",
      error: error.message,
    });
  }
};

module.exports = {
  getAssignedComplaints,
  getComplaintDetail,
  updateComplaintStatus,
  setExpectedResolutionDate,
  addResolutionNote,
  sendOTPToStudent,
  verifyOTPAndClose,
};
