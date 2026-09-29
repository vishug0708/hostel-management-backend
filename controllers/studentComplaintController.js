const db = require("../config/database.js");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "hostel_management_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const VALID_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Carpenter",
  "Cleaning",
  "IT",
  "Maintenance",
];

const getToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

const verifyStudent = (req, res) => {
  const token = getToken(req);
  if (!token) {
    res
      .status(401)
      .json({ success: false, message: "Authentication token is required." });
    return null;
  }

  try {
    const decoded = require("jsonwebtoken").verify(token, JWT_SECRET);
    const studentId = decoded.student_id || decoded.id;

    if (!studentId || (decoded.role && decoded.role !== "student")) {
      res.status(403).json({ success: false, message: "Student access only." });
      return null;
    }

    return { ...decoded, studentId: Number(studentId) };
  } catch (error) {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired student token." });
    return null;
  }
};

const getPhotoUrl = (photo) => {
  if (!photo) return null;
  const value = String(photo).trim();
  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http")
  ) {
    return value;
  }
  const normalized = value.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return normalized;
  return `uploads/students/${normalized}`;
};

const getBackupStudents = async (req, res) => {
  const auth = verifyStudent(req, res);
  if (!auth) return;

  const requestedStudentId = Number(req.params.studentId);
  if (!requestedStudentId || requestedStudentId !== auth.studentId) {
    return res.status(403).json({
      success: false,
      message: "You can only load backup students for your own account.",
    });
  }

  try {
    // The current students table uses id as the student identifier.
    // There is no student_id/status column in students.
    const [students] = await db.query(
      `SELECT
        s.id,
        s.id AS student_id,
        s.name,
        s.email,
        s.mobile,
        s.photo,
        s.hostel,
        s.college,
        s.course,
        ra.bed_no,
        r.room_no,
        r.block
      FROM students s
      LEFT JOIN room_allocation ra
        ON ra.student_id = s.id
        AND ra.status = 'Allocated'
      LEFT JOIN rooms r
        ON r.id = ra.room_id
      WHERE s.id <> ?
      ORDER BY s.name ASC`,
      [requestedStudentId],
    );

    return res.json({ success: true, students: students || [] });
  } catch (error) {
    console.error("Get Backup Students Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load backup students.",
      error: error.message,
    });
  }
};

const getAvailableStaff = async (category) => {
  const categoryRoleMap = {
    Electrical: "Electrician",
    Plumbing: "Plumber",
    Carpenter: "Carpenter",
    Cleaning: "Housekeeping",
    IT: "IT",
    Maintenance: "Maintenance",
  };

  const staffRole = categoryRoleMap[category];

  if (!staffRole) {
    return null;
  }

  const [rows] = await db.query(
    `SELECT
      st.id,
      st.staff_id,
      st.name,
      st.email,
      st.mobile,
      st.photo,
      st.role,
      COUNT(
        CASE
          WHEN c.status <> 'Closed' THEN 1
        END
      ) AS active_complaints
    FROM staff st
    LEFT JOIN complaints c
      ON c.assigned_staff_id = st.id
    WHERE LOWER(st.role) = LOWER(?)
      AND LOWER(st.status) = 'active'
    GROUP BY
      st.id,
      st.staff_id,
      st.name,
      st.email,
      st.mobile,
      st.photo,
      st.role
    ORDER BY
      active_complaints ASC,
      st.id ASC
    LIMIT 1`,
    [staffRole],
  );

  return rows[0] || null;
};

const generateComplaintCode = () => {
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CMP-${Date.now().toString().slice(-8)}-${random}`;
};

const createComplaint = async (req, res) => {
  const auth = verifyStudent(req, res);
  if (!auth) return;

  const studentId = auth.studentId;
  const backupStudentId = Number(req.body.backup_student_id);
  const category = String(req.body.category || "").trim();
  const subject = String(req.body.subject || "").trim();
  const description = String(req.body.description || "").trim();

  if (!backupStudentId || !category || !subject || !description) {
    return res.status(400).json({
      success: false,
      message:
        "Backup student, category, subject and description are required.",
    });
  }

  if (backupStudentId === studentId) {
    return res.status(400).json({
      success: false,
      message:
        "Backup student must be different from the complaint-raising student.",
    });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: "Invalid complaint category.",
    });
  }

  if (subject.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Subject cannot exceed 200 characters.",
    });
  }

  try {
    const [studentRows] = await db.query(
      `SELECT
        id,
        name,
        email,
        mobile,
        photo,
        hostel,
        college,
        course
       FROM students
       WHERE id = ?
       LIMIT 1`,
      [studentId],
    );

    if (!studentRows.length) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const [backupRows] = await db.query(
      `SELECT
        id,
        name,
        email,
        mobile,
        photo,
        hostel,
        college,
        course
       FROM students
       WHERE id = ?
       LIMIT 1`,
      [backupStudentId],
    );

    if (!backupRows.length) {
      return res.status(404).json({
        success: false,
        message: "Backup student not found.",
      });
    }

    const backup = backupRows[0];

    const assignedStaff = await getAvailableStaff(category);

    if (!assignedStaff) {
      const categoryRoleMap = {
        Electrical: "Electrician",
        Plumbing: "Plumber",
        Carpenter: "Carpenter",
        Cleaning: "Housekeeping",
        IT: "IT",
        Maintenance: "Maintenance",
      };

      const staffRole = categoryRoleMap[category] || category;

      return res.status(404).json({
        success: false,
        message: `No active ${staffRole} staff is available for ${category} complaints.`,
      });
    }

    const complaintCode = generateComplaintCode();

    const attachment = req.file
      ? `uploads/complaints/${req.file.filename}`
      : null;

    const [result] = await db.query(
      `INSERT INTO complaints (
        complaint_code,
        student_id,
        backup_student_id,
        category,
        subject,
        description,
        attachment,
        assigned_staff_id,
        assigned_staff_name,
        assigned_staff_mobile,
        assigned_staff_photo,
        assigned_by_id,
        assigned_by_type,
        assigned_at,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        complaintCode,
        studentId,
        backupStudentId,
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
        "Assigned",
      ],
    );

    return res.status(201).json({
      success: true,
      message:
        "Complaint submitted successfully and staff assigned automatically.",
      complaint: {
        id: result.insertId,
        complaint_code: complaintCode,
        status: "Assigned",

        assigned_staff_id: assignedStaff.id,
        assigned_staff_id_code: assignedStaff.staff_id,
        assigned_staff_name: assignedStaff.name,
        assigned_staff_email: assignedStaff.email,
        assigned_staff_mobile: assignedStaff.mobile,
        assigned_staff_role: assignedStaff.role,
        assigned_staff_photo: getPhotoUrl(assignedStaff.photo),

        backup_student_id: backup.id,
        backup_student_name: backup.name,
        backup_student_email: backup.email,
        backup_student_mobile: backup.mobile,
        backup_student_photo: getPhotoUrl(backup.photo),
      },
    });
  } catch (error) {
    console.error("Create Complaint Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit complaint.",
      error: error.message,
    });
  }
};

const getStudentComplaints = async (req, res) => {
  const auth = verifyStudent(req, res);
  if (!auth) return;

  const requestedStudentId = Number(req.params.studentId);
  if (!requestedStudentId || requestedStudentId !== auth.studentId) {
    return res.status(403).json({
      success: false,
      message: "You can only view your own complaints.",
    });
  }

  try {
    const [complaints] = await db.query(
      `SELECT
        c.id,
        c.complaint_code,
        c.student_id,
        c.backup_student_id,
        c.category,
        c.subject,
        c.description,
        c.attachment,
        c.assigned_staff_id,
        c.assigned_staff_name,
        c.assigned_staff_mobile,
        c.assigned_staff_photo,
        st.role AS assigned_staff_role,
        c.assigned_at,
        c.expected_resolution_at,
        c.status,
        c.resolution_note,
        c.resolution_marked_at,
        c.otp_recipient_type,
        c.otp_email,
        c.otp_verified,
        c.otp_verified_at,
        c.closed_at,
        c.rating,
        c.rating_feedback,
        c.rated_at,
        c.created_at,
        c.updated_at,
        bs.name AS backup_student_name,
        bs.email AS backup_student_email,
        bs.mobile AS backup_student_mobile,
        bs.photo AS backup_student_photo
      FROM complaints c
      LEFT JOIN staff st ON st.id = c.assigned_staff_id
      LEFT JOIN students bs ON bs.id = c.backup_student_id
      WHERE c.student_id = ?
      ORDER BY c.created_at DESC`,
      [requestedStudentId],
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Student Complaints Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
      error: error.message,
    });
  }
};

const getComplaintById = async (complaintId, studentId) => {
  const [rows] = await db.query(
    `SELECT
      c.id,
      c.complaint_code,
      c.student_id,
      c.backup_student_id,
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
      c.assigned_at,
      c.expected_resolution_at,
      c.status,
      c.resolution_note,
      c.resolution_marked_at,
      c.otp_recipient_type,
      c.otp_email,
      c.otp_verified,
      c.otp_verified_at,
      c.closed_at,
      c.rating,
      c.rating_feedback,
      c.rated_at,
      c.created_at,
      c.updated_at,
      s.name AS student_name,
      s.email AS student_email,
      s.mobile AS student_mobile,
      s.photo AS student_photo,
      bs.name AS backup_student_name,
      bs.email AS backup_student_email,
      bs.mobile AS backup_student_mobile,
      bs.photo AS backup_student_photo,
      r.room_no,
      r.block,
      ra.bed_no
    FROM complaints c
    LEFT JOIN students s ON s.id = c.student_id
    LEFT JOIN students bs ON bs.id = c.backup_student_id
    LEFT JOIN staff st ON st.id = c.assigned_staff_id
    LEFT JOIN room_allocation ra
      ON ra.student_id = c.student_id
      AND ra.status = 'Allocated'
    LEFT JOIN rooms r ON r.id = ra.room_id
    WHERE c.id = ? AND c.student_id = ?
    LIMIT 1`,
    [complaintId, studentId],
  );

  return rows[0] || null;
};

const getStudentComplaintDetails = async (req, res) => {
  const auth = verifyStudent(req, res);
  if (!auth) return;

  const studentId = Number(req.params.studentId);
  const complaintId = Number(req.params.complaintId);

  if (!studentId || studentId !== auth.studentId) {
    return res.status(403).json({
      success: false,
      message: "You can only view your own complaint.",
    });
  }

  if (!complaintId) {
    return res.status(400).json({
      success: false,
      message: "Complaint ID is required.",
    });
  }

  try {
    const complaint = await getComplaintById(complaintId, studentId);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error("Get Student Complaint Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint details.",
      error: error.message,
    });
  }
};

const createRatingToken = (complaintId, email) => {
  const payload = Buffer.from(
    JSON.stringify({
      complaintId: Number(complaintId),
      email: String(email).toLowerCase(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
};

const verifyRatingToken = (token) => {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data?.complaintId || !data?.email || Date.now() > Number(data.exp)) {
    return null;
  }

  return data;
};

const getComplaintRating = async (req, res) => {
  try {
    const data = verifyRatingToken(req.params.token);
    if (!data) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired rating link.",
      });
    }

    const [rows] = await db.query(
      `SELECT id, complaint_code, subject, category, otp_email, otp_verified, rating, rating_feedback
       FROM complaints
       WHERE id = ?
       LIMIT 1`,
      [data.complaintId],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const complaint = rows[0];

    if (String(complaint.otp_email || "").toLowerCase() !== data.email) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Rating link is not valid for this recipient.",
        });
    }

    if (complaint.otp_verified !== "Yes") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Complaint resolution has not been OTP verified.",
        });
    }

    return res.json({
      success: true,
      complaint: {
        id: complaint.id,
        complaint_code: complaint.complaint_code,
        subject: complaint.subject,
        category: complaint.category,
        rating: complaint.rating,
        rating_feedback: complaint.rating_feedback,
      },
    });
  } catch (error) {
    console.error("Get Complaint Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load rating page.",
      error: error.message,
    });
  }
};

const submitComplaintRating = async (req, res) => {
  try {
    const data = verifyRatingToken(req.params.token);
    if (!data) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired rating link.",
      });
    }

    const rating = Number(req.body.rating);
    const ratingFeedback = String(req.body.rating_feedback || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    const [rows] = await db.query(
      `SELECT id, otp_email, otp_verified, rating
       FROM complaints
       WHERE id = ?
       LIMIT 1`,
      [data.complaintId],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const complaint = rows[0];

    if (String(complaint.otp_email || "").toLowerCase() !== data.email) {
      return res
        .status(403)
        .json({ success: false, message: "Rating link is not valid." });
    }

    if (complaint.otp_verified !== "Yes") {
      return res.status(403).json({
        success: false,
        message: "OTP verification is required before rating.",
      });
    }

    if (complaint.rating !== null && complaint.rating !== undefined) {
      return res.status(400).json({
        success: false,
        message: "This complaint has already been rated.",
      });
    }

    await db.query(
      `UPDATE complaints
       SET rating = ?, rating_feedback = ?, rated_at = NOW()
       WHERE id = ?`,
      [rating, ratingFeedback || null, data.complaintId],
    );

    return res.json({
      success: true,
      message: "Thank you. Your complaint rating has been submitted.",
    });
  } catch (error) {
    console.error("Submit Complaint Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit rating.",
      error: error.message,
    });
  }
};

module.exports = {
  getBackupStudents,
  createComplaint,
  getStudentComplaints,
  getComplaintById,
  getStudentComplaintDetails,
  createRatingToken,
  getComplaintRating,
  submitComplaintRating,
};
