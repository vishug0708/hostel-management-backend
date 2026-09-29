const db = require("../config/database.js");

const baseComplaintSelect = `
  SELECT
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
    st.email AS assigned_staff_email,
    st.role AS assigned_staff_role,
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
  LEFT JOIN room_allocation ra
    ON ra.student_id = c.student_id
    AND ra.status = 'Allocated'
  LEFT JOIN rooms r ON r.id = ra.room_id
`;

const getAllComplaints = async (req, res) => {
  try {
    const [complaints] = await db.query(
      `${baseComplaintSelect}
       ORDER BY c.created_at DESC`
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get All Complaints Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
      error: error.message,
    });
  }
};

const getComplaintDetails = async (req, res) => {
  try {
    const complaintId = Number(req.params.complaintId);
    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: "Complaint ID is required.",
      });
    }

    const [rows] = await db.query(
      `${baseComplaintSelect}
       WHERE c.id = ?
       LIMIT 1`,
      [complaintId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    return res.json({ success: true, complaint: rows[0] });
  } catch (error) {
    console.error("Get Complaint Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint.",
      error: error.message,
    });
  }
};

const getComplaintsByStatus = async (req, res) => {
  try {
    const status = String(req.params.status || "").trim();
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required." });
    }

    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.status = ?
       ORDER BY c.created_at DESC`,
      [status]
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Complaints By Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints by status.",
      error: error.message,
    });
  }
};

const getComplaintsByCategory = async (req, res) => {
  try {
    const category = String(req.params.category || "").trim();
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required." });
    }

    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.category = ?
       ORDER BY c.created_at DESC`,
      [category]
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Complaints By Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints by category.",
      error: error.message,
    });
  }
};

const getComplaintStatistics = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        COUNT(*) AS total_complaints,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS assigned,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'Resolution Pending' THEN 1 ELSE 0 END) AS resolution_pending,
        SUM(CASE WHEN status = 'OTP Verification' THEN 1 ELSE 0 END) AS otp_verification,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
        AVG(CASE WHEN rating IS NOT NULL THEN rating END) AS avg_rating,
        COUNT(DISTINCT category) AS categories_count
       FROM complaints`
    );

    return res.json({
      success: true,
      statistics: rows[0] || {},
    });
  } catch (error) {
    console.error("Get Complaint Statistics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint statistics.",
      error: error.message,
    });
  }
};

const getStaffPerformance = async (req, res) => {
  try {
    const [performance] = await db.query(
      `SELECT
        st.id,
        st.staff_id,
        st.name,
        st.role,
        st.photo,
        st.mobile,
        st.email,
        COUNT(c.id) AS total_assigned,
        SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN c.status IN ('Assigned', 'In Progress', 'Resolution Pending', 'OTP Verification') THEN 1 ELSE 0 END) AS open_complaints,
        AVG(CASE WHEN c.rating IS NOT NULL THEN c.rating END) AS avg_rating
       FROM staff st
       LEFT JOIN complaints c ON c.assigned_staff_id = st.id
       WHERE LOWER(st.status) = 'active'
       GROUP BY st.id, st.staff_id, st.name, st.role, st.photo, st.mobile, st.email
       ORDER BY st.role ASC, st.id ASC`
    );

    return res.json({
      success: true,
      performance: performance || [],
    });
  } catch (error) {
    console.error("Get Staff Performance Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff performance.",
      error: error.message,
    });
  }
};

const getStudentComplaints = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required." });
    }

    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.student_id = ?
       ORDER BY c.created_at DESC`,
      [studentId]
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
      message: "Failed to fetch student complaints.",
      error: error.message,
    });
  }
};

const getPendingResolutions = async (req, res) => {
  try {
    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.status IN ('In Progress', 'Resolution Pending', 'OTP Verification')
       ORDER BY c.expected_resolution_at IS NULL, c.expected_resolution_at ASC, c.created_at ASC`
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Pending Resolutions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending resolutions.",
      error: error.message,
    });
  }
};

const getOverdueComplaints = async (req, res) => {
  try {
    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.status NOT IN ('Closed')
         AND c.expected_resolution_at IS NOT NULL
         AND c.expected_resolution_at < NOW()
       ORDER BY c.expected_resolution_at ASC`
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Overdue Complaints Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch overdue complaints.",
      error: error.message,
    });
  }
};

const getClosedComplaintsWithRatings = async (req, res) => {
  try {
    const [complaints] = await db.query(
      `${baseComplaintSelect}
       WHERE c.status = 'Closed'
       ORDER BY c.closed_at DESC, c.created_at DESC`
    );

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Get Closed Complaints Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch closed complaints.",
      error: error.message,
    });
  }
};

const exportComplaintReport = async (req, res) => {
  try {
    const { startDate, endDate, status, category } = req.query;

    let query = `
      SELECT
        c.complaint_code,
        s.id AS student_id,
        s.name AS student_name,
        s.email AS student_email,
        s.mobile AS student_phone,
        r.room_no AS student_room,
        c.category,
        c.subject,
        c.assigned_staff_name,
        c.assigned_staff_mobile,
        c.status,
        c.created_at,
        c.expected_resolution_at,
        c.closed_at,
        c.rating,
        c.rating_feedback
      FROM complaints c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN room_allocation ra
        ON ra.student_id = c.student_id
        AND ra.status = 'Allocated'
      LEFT JOIN rooms r ON r.id = ra.room_id
      WHERE 1 = 1
    `;

    const params = [];

    if (startDate) {
      query += " AND DATE(c.created_at) >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND DATE(c.created_at) <= ?";
      params.push(endDate);
    }

    if (status) {
      query += " AND c.status = ?";
      params.push(status);
    }

    if (category) {
      query += " AND c.category = ?";
      params.push(category);
    }

    query += " ORDER BY c.created_at DESC";

    const [complaints] = await db.query(query, params);

    return res.json({
      success: true,
      complaints: complaints || [],
      count: complaints?.length || 0,
    });
  } catch (error) {
    console.error("Export Complaint Report Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate report.",
      error: error.message,
    });
  }
};

const getResolutionTimeByCategory = async (req, res) => {
  try {
    const [statistics] = await db.query(
      `SELECT
        category,
        COUNT(*) AS total_complaints,
        AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) AS avg_hours_to_resolve,
        AVG(rating) AS avg_rating
       FROM complaints
       WHERE status = 'Closed'
       GROUP BY category
       ORDER BY category ASC`
    );

    return res.json({ success: true, statistics: statistics || [] });
  } catch (error) {
    console.error("Get Resolution Time By Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch resolution statistics.",
      error: error.message,
    });
  }
};

const getComplaintsTrend = async (req, res) => {
  try {
    const requestedDays = Number(req.query.days || 30);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 365);

    const [trends] = await db.query(
      `SELECT
        DATE(created_at) AS date,
        COUNT(*) AS total_complaints,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) AS pending
       FROM complaints
       WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [days]
    );

    return res.json({ success: true, trends: trends || [] });
  } catch (error) {
    console.error("Get Complaints Trend Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint trends.",
      error: error.message,
    });
  }
};

module.exports = {
  getAllComplaints,
  getComplaintDetails,
  getComplaintsByStatus,
  getComplaintsByCategory,
  getComplaintStatistics,
  getStaffPerformance,
  getStudentComplaints,
  getPendingResolutions,
  getOverdueComplaints,
  getClosedComplaintsWithRatings,
  exportComplaintReport,
  getResolutionTimeByCategory,
  getComplaintsTrend,
};
