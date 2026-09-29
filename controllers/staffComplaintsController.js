const db = require("../config/database.js");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "hostel_management_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.BREVO_SMTP_PORT || 587),
  secure: Number(process.env.BREVO_SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.BREVO_SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.BREVO_SMTP_PASS || process.env.EMAIL_PASSWORD,
  },
});

const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_USER;
const fromName = process.env.BREVO_FROM_NAME || "Hostel Management System";

const getStaffId = (req) => Number(req.user?.id || req.user?.staff_id || 0);

const getPhotoUrl = (photo) => {
  if (!photo) return null;
  const value = String(photo).trim();
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http")) return value;
  const normalized = value.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return normalized;
  return `uploads/staff/${normalized}`;
};

const getAssignedComplaints = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });

    const [complaints] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_phone,
        s.photo AS student_photo,
        r.room_no AS student_room,
        r.block AS student_block,
        c.backup_student_id,
        bs.name AS backup_student_name,
        bs.email AS backup_student_email,
        bs.mobile AS backup_student_mobile,
        bs.photo AS backup_student_photo,
        c.category,
        c.subject,
        c.description,
        c.status,
        c.created_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.assigned_at,
        c.resolution_marked_at,
        c.otp_recipient_type,
        c.otp_email,
        c.otp_verified,
        c.closed_at,
        c.rating,
        c.rating_feedback
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN students bs ON bs.id = c.backup_student_id
      LEFT JOIN room_allocation ra ON ra.student_id = c.student_id AND ra.status = 'Allocated'
      LEFT JOIN rooms r ON r.id = ra.room_id
      WHERE c.assigned_staff_id = ?
      ORDER BY c.created_at DESC`,
      [staffId]
    );

    return res.json({ success: true, complaints: complaints || [], count: complaints?.length || 0 });
  } catch (error) {
    console.error("Get Assigned Complaints Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
  }
};

const getComplaintDetail = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });
    if (!complaintId) return res.status(400).json({ success: false, message: "Complaint ID is required." });

    const [rows] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_phone,
        s.photo AS student_photo,
        r.room_no AS student_room,
        r.block AS student_block,
        c.backup_student_id,
        bs.name AS backup_student_name,
        bs.email AS backup_student_email,
        bs.mobile AS backup_student_mobile,
        bs.photo AS backup_student_photo,
        c.category,
        c.subject,
        c.description,
        c.attachment,
        c.assigned_staff_id,
        c.assigned_staff_name,
        c.assigned_staff_mobile,
        c.assigned_staff_photo,
        st.role AS assigned_staff_role,
        st.email AS assigned_staff_email,
        c.status,
        c.created_at,
        c.assigned_at,
        c.expected_resolution_at,
        c.resolution_note,
        c.resolution_marked_at,
        c.otp_recipient_type,
        c.otp_email,
        c.otp_verified,
        c.otp_verified_at,
        c.closed_at,
        c.rating,
        c.rating_feedback,
        c.rated_at
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN students bs ON bs.id = c.backup_student_id
      LEFT JOIN staff st ON st.id = c.assigned_staff_id
      LEFT JOIN room_allocation ra ON ra.student_id = c.student_id AND ra.status = 'Allocated'
      LEFT JOIN rooms r ON r.id = ra.room_id
      WHERE c.id = ? AND c.assigned_staff_id = ?
      LIMIT 1`,
      [complaintId, staffId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Complaint not found or not assigned to you." });
    }

    return res.json({ success: true, complaint: rows[0] });
  } catch (error) {
    console.error("Get Complaint Detail Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch complaint.", error: error.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    const requestedStatus = String(req.body.status || "").trim();

    const transitions = {
      Assigned: "In Progress",
      "In Progress": "Resolution Pending",
    };

    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });
    if (!transitions[requestedStatus]) {
      return res.status(400).json({
        success: false,
        message: "Staff can move a complaint only from Assigned to In Progress or In Progress to Resolution Pending.",
      });
    }

    const [rows] = await db.query(
      `SELECT status FROM complaints WHERE id = ? AND assigned_staff_id = ? LIMIT 1`,
      [complaintId, staffId]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Complaint not found or not assigned to you." });

    if (rows[0].status !== Object.keys(transitions).find((key) => transitions[key] === requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${rows[0].status}.`,
      });
    }

    await db.query(
      `UPDATE complaints
       SET status = ?
       WHERE id = ? AND assigned_staff_id = ?`,
      [requestedStatus, complaintId, staffId]
    );

    return res.json({ success: true, message: `Complaint moved to ${requestedStatus}.` });
  } catch (error) {
    console.error("Update Complaint Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update complaint status.", error: error.message });
  }
};

const setExpectedResolutionDate = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    const expectedDate = String(req.body.expectedDate || "").trim();

    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });
    if (!expectedDate) return res.status(400).json({ success: false, message: "Expected resolution date/time is required." });

    const parsed = new Date(expectedDate);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid expected resolution date/time." });
    }

    const [result] = await db.query(
      `UPDATE complaints
       SET expected_resolution_at = ?
       WHERE id = ? AND assigned_staff_id = ? AND status <> 'Closed'`,
      [expectedDate, complaintId, staffId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Complaint not found, not assigned to you, or already closed." });
    }

    return res.json({ success: true, message: "Expected resolution date/time saved." });
  } catch (error) {
    console.error("Set Expected Resolution Date Error:", error);
    return res.status(500).json({ success: false, message: "Failed to set expected resolution date/time.", error: error.message });
  }
};

const addResolutionNote = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    const note = String(req.body.note || "").trim();

    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });
    if (!note) return res.status(400).json({ success: false, message: "Resolution note is required." });

    const [result] = await db.query(
      `UPDATE complaints
       SET resolution_note = ?
       WHERE id = ? AND assigned_staff_id = ? AND status <> 'Closed'`,
      [note, complaintId, staffId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Complaint not found, not assigned to you, or already closed." });
    }

    return res.json({ success: true, message: "Resolution note saved." });
  } catch (error) {
    console.error("Add Resolution Note Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save resolution note.", error: error.message });
  }
};

const createRatingToken = (complaintId, email) => {
  const payload = Buffer.from(
    JSON.stringify({
      complaintId: Number(complaintId),
      email: String(email).toLowerCase(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
};

const sendOTPToRecipient = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    const recipientType = String(req.body.recipient_type || "").trim();

    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });

    if (!["Student", "Backup Student"].includes(recipientType)) {
      return res.status(400).json({
        success: false,
        message: "Select either Student or Backup Student.",
      });
    }

    const [rows] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.status,
        s.name AS student_name,
        s.email AS student_email,
        bs.name AS backup_student_name,
        bs.email AS backup_student_email
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN students bs ON bs.id = c.backup_student_id
      WHERE c.id = ? AND c.assigned_staff_id = ?
      LIMIT 1`,
      [complaintId, staffId]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Complaint not found or not assigned to you." });

    const complaint = rows[0];

    if (!["Resolution Pending", "OTP Verification"].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: "Complaint must be in Resolution Pending or OTP Verification before a resolution OTP can be sent.",
      });
    }

    const recipientEmail =
      recipientType === "Student"
        ? complaint.student_email
        : complaint.backup_student_email;

    const recipientName =
      recipientType === "Student"
        ? complaint.student_name
        : complaint.backup_student_name;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: `${recipientType} does not have an email address.`,
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      `UPDATE complaints
       SET
         otp_hash = ?,
         otp_expires_at = ?,
         otp_attempts = 0,
         otp_recipient_type = ?,
         otp_email = ?,
         otp_verified = 'No',
         otp_verified_at = NULL,
         status = 'OTP Verification'
       WHERE id = ? AND assigned_staff_id = ?`,
      [otpHash, expiresAt, recipientType, recipientEmail, complaintId, staffId]
    );

    await transporter.sendMail({
      from: {
        address: fromEmail,
        name: fromName,
      },
      to: recipientEmail,
      subject: `Complaint Resolution OTP - ${complaint.complaint_code}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Hostel Complaint Resolution</h2>
          <p>Dear ${recipientName || "Student"},</p>
          <p>Complaint <strong>${complaint.complaint_code}</strong> has been marked as resolved by the assigned staff member.</p>
          <p>Your verification OTP is:</p>
          <h1 style="letter-spacing:6px">${otp}</h1>
          <p>This OTP is valid for 15 minutes.</p>
          <p>After successful verification, the complaint will be closed and this same email address will receive the rating link.</p>
          <p>Regards,<br/>${fromName}</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: `Resolution OTP sent to ${recipientType.toLowerCase()} email.`,
      recipient_type: recipientType,
      recipient_email: recipientEmail,
    });
  } catch (error) {
    console.error("Send Complaint OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send resolution OTP.",
      error: error.message,
    });
  }
};

const verifyOTPAndClose = async (req, res) => {
  try {
    const staffId = getStaffId(req);
    const complaintId = Number(req.params.complaintId);
    const otp = String(req.body.otp || "").trim();

    if (!staffId) return res.status(401).json({ success: false, message: "Staff session not found." });
    if (!otp) return res.status(400).json({ success: false, message: "OTP is required." });

    const [rows] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.otp_hash,
        c.otp_expires_at,
        c.otp_attempts,
        c.otp_email,
        c.otp_verified,
        c.status,
        c.subject
      FROM complaints c
      WHERE c.id = ? AND c.assigned_staff_id = ?
      LIMIT 1`,
      [complaintId, staffId]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Complaint not found or not assigned to you." });

    const complaint = rows[0];

    if (complaint.status !== "OTP Verification") {
      return res.status(400).json({ success: false, message: "Complaint is not waiting for OTP verification." });
    }

    if (!complaint.otp_hash || !complaint.otp_expires_at) {
      return res.status(400).json({ success: false, message: "No active OTP exists for this complaint." });
    }

    if (complaint.otp_attempts >= 3) {
      return res.status(400).json({ success: false, message: "Maximum OTP attempts exceeded. Send a new OTP." });
    }

    if (new Date() > new Date(complaint.otp_expires_at)) {
      return res.status(400).json({ success: false, message: "OTP has expired. Send a new OTP." });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    if (otpHash !== complaint.otp_hash) {
      await db.query(
        `UPDATE complaints SET otp_attempts = otp_attempts + 1 WHERE id = ? AND assigned_staff_id = ?`,
        [complaintId, staffId]
      );
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    await db.query(
      `UPDATE complaints
       SET status = 'Closed',
           otp_verified = 'Yes',
           otp_verified_at = NOW(),
           closed_at = NOW()
       WHERE id = ? AND assigned_staff_id = ?`,
      [complaintId, staffId]
    );

    const ratingToken = createRatingToken(complaintId, complaint.otp_email);
    const ratingUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/complaint-rating/${encodeURIComponent(ratingToken)}`;

    try {
      await transporter.sendMail({
        from: {
          address: fromEmail,
          name: fromName,
        },
        to: complaint.otp_email,
        subject: `Rate Your Hostel Complaint - ${complaint.complaint_code}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Complaint Closed</h2>
            <p>Your complaint <strong>${complaint.complaint_code}</strong> has been successfully closed after OTP verification.</p>
            <p>Please share your experience by rating the resolution:</p>
            <p><a href="${ratingUrl}" style="display:inline-block;padding:12px 18px;background:#134e4a;color:#fff;text-decoration:none;border-radius:6px">Rate Complaint</a></p>
            <p>The rating link is valid for 30 days.</p>
            <p>Regards,<br/>${fromName}</p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("Rating Email Error:", mailError);
    }

    return res.json({
      success: true,
      message: "OTP verified. Complaint closed and rating email sent to the verified recipient.",
      rating_email: complaint.otp_email,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
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
  sendOTPToRecipient,
  verifyOTPAndClose,
};
