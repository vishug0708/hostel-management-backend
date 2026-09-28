const db = require("../config/database.js");

// Helper function to get photo URL
const getPhotoUrl = (photo) => {
  if (!photo) return null;
  const value = String(photo).trim();
  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http")
  )
    return value;
  const normalized = value.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return normalized;
  return `uploads/students/${normalized}`;
};

// Get all complaints for a student
const getStudentComplaints = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId)
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required." });

    const [complaints] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        c.category,
        c.subject,
        c.description,
        c.attachment,
        c.assigned_staff_id,
        c.assigned_staff_name,
        c.assigned_staff_mobile,
        c.assigned_staff_photo,
        st.role AS assigned_staff_role,
        c.status,
        c.created_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.otp_verified,
        c.closed_at,
        c.rating
      FROM complaints c
      LEFT JOIN staff st ON st.id = c.assigned_staff_id
      WHERE c.student_id = ?
      ORDER BY c.created_at DESC`,
      [studentId],
    );

    res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Student Complaints Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch complaints.",
        error: error.message,
      });
  }
};

// Get single complaint by ID
const getComplaintById = async (req, res) => {
  try {
    const { studentId, complaintId } = req.params;
    if (!studentId || !complaintId)
      return res
        .status(400)
        .json({
          success: false,
          message: "Student ID and Complaint ID are required.",
        });

    const [complaint] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        c.category,
        c.subject,
        c.description,
        c.attachment,
        c.assigned_staff_id,
        c.assigned_staff_name,
        c.assigned_staff_mobile,
        c.assigned_staff_photo,
        st.role AS assigned_staff_role,
        c.status,
        c.created_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.otp_verified,
        c.closed_at,
        c.rating,
        c.rating_feedback
      FROM complaints c
      LEFT JOIN staff st ON st.id = c.assigned_staff_id
      WHERE c.student_id = ? AND c.id = ?`,
      [studentId, complaintId],
    );

    if (!complaint || complaint.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    res.json({
      success: true,
      complaint: complaint[0],
    });
  } catch (error) {
    console.error("Get Complaint By ID Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch complaint.",
        error: error.message,
      });
  }
};

// Create new complaint with automatic staff assignment
const createComplaint = async (req, res) => {
  try {
    const { student_id, category, subject, description } = req.body;

    if (!student_id || !category || !subject || !description) {
      return res
        .status(400)
        .json({
          success: false,
          message: "All required fields must be filled.",
        });
    }

    // Get staff with least active complaints in the selected category
    const [staff] = await db.query(
      `SELECT st.id, st.name, st.mobile, st.photo, st.role,
                    COUNT(c.id) as active_complaints
            FROM staff st
            LEFT JOIN complaints c ON c.assigned_staff_id = st.id AND c.status NOT IN ('Closed')
            WHERE st.role = ?
            GROUP BY st.id, st.name, st.mobile, st.photo, st.role
            ORDER BY active_complaints ASC
            LIMIT 1`,
      [category],
    );

    if (!staff || staff.length === 0)
      return res
        .status(404)
        .json({
          success: false,
          message: `No staff available for ${category} category.`,
        });

    const assignedStaff = staff[0];
    const complaintCode = `COMP-${Date.now()}`;
    const attachment = req.file ? getPhotoUrl(req.file.path) : null;

    const [result] = await db.query(
      `INSERT INTO complaints (
                complaint_code, student_id, category, subject, description, attachment,
                assigned_staff_id, assigned_staff_name, assigned_staff_mobile, assigned_staff_photo,
                assigned_by_id, assigned_by_type, assigned_at, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        complaintCode,
        student_id,
        category,
        subject,
        description,
        attachment,
        assignedStaff.id,
        assignedStaff.name,
        assignedStaff.mobile,
        getPhotoUrl(assignedStaff.photo),
        assignedStaff.id,
        "Staff",
        new Date(),
        "Assigned",
      ],
    );

    res.status(201).json({
      success: true,
      message:
        "Complaint submitted successfully. Staff has been assigned automatically.",
      complaint: {
        id: result.insertId,
        complaint_code: complaintCode,
        assigned_staff_name: assignedStaff.name,
        status: "Assigned",
      },
    });
  } catch (error) {
    console.error("Create Complaint Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create complaint.",
        error: error.message,
      });
  }
};

// Get backup students for a student
const getBackupStudents = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId)
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required." });

    const [students] = await db.query(
      `SELECT id, student_id, name, mobile, email, hostel, photo
            FROM students
            WHERE id != ? AND status = 'Active'
            LIMIT 10`,
      [studentId],
    );

    res.json({
      success: true,
      students: students || [],
    });
  } catch (error) {
    console.error("Get Backup Students Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch backup students.",
        error: error.message,
      });
  }
};

// Update complaint status (for staff)
const updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, resolution_note, expected_resolution_at } = req.body;

    if (!complaintId || !status)
      return res
        .status(400)
        .json({
          success: false,
          message: "Complaint ID and status are required.",
        });

    const [result] = await db.query(
      `UPDATE complaints
            SET status = ?, resolution_note = ?, expected_resolution_at = ?, resolution_marked_at = NOW()
            WHERE id = ?`,
      [
        status,
        resolution_note || null,
        expected_resolution_at || null,
        complaintId,
      ],
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    res.json({
      success: true,
      message: "Complaint status updated successfully.",
    });
  } catch (error) {
    console.error("Update Complaint Status Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update complaint status.",
        error: error.message,
      });
  }
};

// Send OTP verification
const sendOtpVerification = async (req, res) => {
  try {
    const { complaintId, backup_student_email } = req.body;

    if (!complaintId || !backup_student_email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Complaint ID and backup student email are required.",
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_expires_at = new Date(Date.now() + 15 * 60 * 1000);

    const [result] = await db.query(
      `UPDATE complaints
            SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0
            WHERE id = ?`,
      [otp, otp_expires_at, complaintId],
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    console.log(`OTP for complaint ${complaintId}: ${otp}`);

    res.json({
      success: true,
      message: "OTP sent to backup student email.",
      otp_sent_to: backup_student_email,
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send OTP.",
        error: error.message,
      });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { complaintId, otp } = req.body;

    if (!complaintId || !otp)
      return res
        .status(400)
        .json({
          success: false,
          message: "Complaint ID and OTP are required.",
        });

    const [complaint] = await db.query(
      "SELECT otp_hash, otp_expires_at, otp_attempts FROM complaints WHERE id = ?",
      [complaintId],
    );

    if (!complaint || complaint.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    const c = complaint[0];

    if (new Date() > new Date(c.otp_expires_at))
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired." });

    if (c.otp_attempts >= 3)
      return res
        .status(400)
        .json({ success: false, message: "Maximum OTP attempts exceeded." });

    if (String(c.otp_hash) !== String(otp)) {
      const [updateResult] = await db.query(
        "UPDATE complaints SET otp_attempts = otp_attempts + 1 WHERE id = ?",
        [complaintId],
      );
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid OTP.",
          attempts_remaining: 3 - (c.otp_attempts + 1),
        });
    }

    const [result] = await db.query(
      `UPDATE complaints
            SET otp_verified = 'Yes', otp_verified_at = NOW(), status = 'OTP Verification'
            WHERE id = ?`,
      [complaintId],
    );

    res.json({
      success: true,
      message: "OTP verified successfully.",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to verify OTP.",
        error: error.message,
      });
  }
};

// Submit complaint rating
const submitComplaintRating = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { rating, rating_feedback } = req.body;

    if (!complaintId || !rating)
      return res
        .status(400)
        .json({
          success: false,
          message: "Complaint ID and rating are required.",
        });

    if (rating < 1 || rating > 5)
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5." });

    const [result] = await db.query(
      `UPDATE complaints
            SET rating = ?, rating_feedback = ?, rated_at = NOW(), status = 'Closed', closed_at = NOW()
            WHERE id = ?`,
      [rating, rating_feedback || null, complaintId],
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    res.json({
      success: true,
      message: "Rating submitted successfully. Complaint closed.",
    });
  } catch (error) {
    console.error("Submit Rating Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to submit rating.",
        error: error.message,
      });
  }
};

// Get complaint statistics for student
const getComplaintStats = async (req, res) => {
  try {
    const { studentId } = req.params;

    const [stats] = await db.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status IN ('Submitted', 'Assigned') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('In Progress', 'Resolution Pending') THEN 1 ELSE 0 END) as in_progress,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
      FROM complaints
      WHERE student_id = ?`,
      [studentId],
    );

    res.json({
      success: true,
      stats: stats[0] || {},
    });
  } catch (error) {
    console.error("Get Complaint Stats Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch complaint statistics.",
        error: error.message,
      });
  }
};

// Delete complaint (only if status is Submitted)
const deleteComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const [complaint] = await db.query(
      "SELECT status FROM complaints WHERE id = ?",
      [complaintId],
    );

    if (!complaint || complaint.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });

    if (complaint[0].status !== "Submitted")
      return res
        .status(400)
        .json({
          success: false,
          message: "Only submitted complaints can be deleted.",
        });

    const [result] = await db.query("DELETE FROM complaints WHERE id = ?", [
      complaintId,
    ]);

    res.json({
      success: true,
      message: "Complaint deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Complaint Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete complaint.",
        error: error.message,
      });
  }
};

module.exports = {
  getStudentComplaints,
  getComplaintById,
  createComplaint,
  getBackupStudents,
  updateComplaintStatus,
  sendOtpVerification,
  verifyOtp,
  submitComplaintRating,
  getComplaintStats,
  deleteComplaint,
};
