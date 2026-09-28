import db from "../config/database.js";

// Get all complaints (rector monitoring only)
export const getAllComplaints = async (req, res) => {
    try {
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
                c.backup_student_id,
                c.backup_student_name,
                c.backup_student_mobile,
                c.backup_student_email,
                c.backup_student_photo,
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
                c.expected_resolution_at,
                c.resolution_note,
                c.otp_verified,
                c.closed_at,
                c.rating,
                c.rating_feedback
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            LEFT JOIN staff st ON st.id = c.assigned_staff_id
            ORDER BY c.created_at DESC`
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get All Complaints Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
    }
};

// Get single complaint details (rector monitoring)
export const getComplaintDetails = async (req, res) => {
    try {
        const { complaintId } = req.params;
        if (!complaintId) return res.status(400).json({ success: false, message: "Complaint ID is required." });

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
                c.backup_student_photo,
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
                c.otp_verified,
                c.otp_verified_at,
                c.closed_at,
                c.rating,
                c.rating_feedback,
                c.rated_at
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            LEFT JOIN staff st ON st.id = c.assigned_staff_id
            WHERE c.id = ?`,
            [complaintId]
        );

        if (!complaint || complaint.length === 0) {
            return res.status(404).json({ success: false, message: "Complaint not found." });
        }

        res.json({
            success: true,
            complaint: complaint[0]
        });
    } catch (error) {
        console.error("Get Complaint Details Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch complaint.", error: error.message });
    }
};

// Get complaints by status
export const getComplaintsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        if (!status) return res.status(400).json({ success: false, message: "Status is required." });

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
                c.assigned_staff_name,
                c.assigned_staff_mobile,
                c.status,
                c.created_at
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE c.status = ?
            ORDER BY c.created_at DESC`,
            [status]
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Complaints By Status Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
    }
};

// Get complaints by category
export const getComplaintsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        if (!category) return res.status(400).json({ success: false, message: "Category is required." });

        const [complaints] = await db.query(
            `SELECT
                c.id,
                c.complaint_code,
                c.student_id,
                s.name AS student_name,
                c.category,
                c.subject,
                c.assigned_staff_name,
                c.status,
                c.created_at
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE c.category = ?
            ORDER BY c.created_at DESC`,
            [category]
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Complaints By Category Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
    }
};

// Get complaint statistics for rector dashboard
export const getComplaintStatistics = async (req, res) => {
    try {
        const [stats] = await db.query(
            `SELECT
                COUNT(*) as total_complaints,
                SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
                SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'Resolution Pending' THEN 1 ELSE 0 END) as resolution_pending,
                SUM(CASE WHEN status = 'OTP Verification' THEN 1 ELSE 0 END) as otp_verification,
                SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed,
                AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating,
                COUNT(DISTINCT category) as categories_count
            FROM complaints`
        );

        res.json({
            success: true,
            statistics: stats[0] || {}
        });
    } catch (error) {
        console.error("Get Complaint Statistics Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch statistics.", error: error.message });
    }
};

// Get staff performance on complaints
export const getStaffPerformance = async (req, res) => {
    try {
        const [performance] = await db.query(
            `SELECT
                st.id,
                st.name,
                st.role,
                st.photo,
                st.mobile,
                st.email,
                COUNT(c.id) as total_assigned,
                SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN c.status IN ('Submitted', 'Assigned') THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN c.status IN ('In Progress', 'Resolution Pending') THEN 1 ELSE 0 END) as in_progress,
                AVG(CASE WHEN c.rating IS NOT NULL THEN c.rating ELSE NULL END) as avg_rating
            FROM staff st
            LEFT JOIN complaints c ON c.assigned_staff_id = st.id
            GROUP BY st.id, st.name, st.role, st.photo, st.mobile, st.email
            ORDER BY resolved DESC`
        );

        res.json({
            success: true,
            performance: performance || []
        });
    } catch (error) {
        console.error("Get Staff Performance Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch staff performance.", error: error.message });
    }
};

// Get complaints by student
export const getStudentComplaints = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) return res.status(400).json({ success: false, message: "Student ID is required." });

        const [complaints] = await db.query(
            `SELECT
                c.id,
                c.complaint_code,
                c.category,
                c.subject,
                c.assigned_staff_name,
                c.status,
                c.created_at,
                c.rating
            FROM complaints
            WHERE student_id = ?
            ORDER BY created_at DESC`,
            [studentId]
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Student Complaints Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
    }
};

// Get pending resolutions (rector view only)
export const getPendingResolutions = async (req, res) => {
    try {
        const [complaints] = await db.query(
            `SELECT
                c.id,
                c.complaint_code,
                c.student_id,
                s.name AS student_name,
                c.category,
                c.subject,
                c.assigned_staff_name,
                c.status,
                c.created_at,
                c.expected_resolution_at,
                DATEDIFF(c.expected_resolution_at, NOW()) as days_remaining
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE c.status IN ('In Progress', 'Resolution Pending')
            ORDER BY c.expected_resolution_at ASC`
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Pending Resolutions Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch pending resolutions.", error: error.message });
    }
};

// Get overdue complaints
export const getOverdueComplaints = async (req, res) => {
    try {
        const [complaints] = await db.query(
            `SELECT
                c.id,
                c.complaint_code,
                c.student_id,
                s.name AS student_name,
                c.category,
                c.subject,
                c.assigned_staff_name,
                c.status,
                c.created_at,
                c.expected_resolution_at,
                DATEDIFF(NOW(), c.expected_resolution_at) as days_overdue
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE c.status NOT IN ('Closed', 'OTP Verification')
            AND c.expected_resolution_at < NOW()
            ORDER BY c.expected_resolution_at ASC`
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Overdue Complaints Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch overdue complaints.", error: error.message });
    }
};

// Get closed complaints with ratings
export const getClosedComplaintsWithRatings = async (req, res) => {
    try {
        const [complaints] = await db.query(
            `SELECT
                c.id,
                c.complaint_code,
                c.student_id,
                s.name AS student_name,
                c.category,
                c.subject,
                c.assigned_staff_name,
                c.status,
                c.created_at,
                c.closed_at,
                c.rating,
                c.rating_feedback
            FROM complaints c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE c.status = 'Closed'
            ORDER BY c.closed_at DESC`
        );

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Get Closed Complaints Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch closed complaints.", error: error.message });
    }
};

// Export complaint report with filters
export const exportComplaintReport = async (req, res) => {
    try {
        const { startDate, endDate, status, category } = req.query;

        let query = `SELECT
            c.complaint_code,
            s.name AS student_name,
            s.student_id,
            s.email AS student_email,
            s.mobile AS student_phone,
            c.category,
            c.subject,
            c.assigned_staff_name,
            c.status,
            c.created_at,
            c.expected_resolution_at,
            c.closed_at,
            c.rating,
            c.rating_feedback
        FROM complaints c
        LEFT JOIN students s ON s.id = c.student_id
        WHERE 1=1`;

        const params = [];

        if (startDate) {
            query += ` AND DATE(c.created_at) >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND DATE(c.created_at) <= ?`;
            params.push(endDate);
        }

        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }

        if (category) {
            query += ` AND c.category = ?`;
            params.push(category);
        }

        query += ` ORDER BY c.created_at DESC`;

        const [complaints] = await db.query(query, params);

        res.json({
            success: true,
            complaints: complaints || [],
            count: complaints?.length || 0
        });
    } catch (error) {
        console.error("Export Complaint Report Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate report.", error: error.message });
    }
};

// Get average resolution time by category
export const getResolutionTimeByCategory = async (req, res) => {
    try {
        const [stats] = await db.query(
            `SELECT
                c.category,
                COUNT(c.id) as total_complaints,
                AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.closed_at)) as avg_hours_to_resolve,
                AVG(c.rating) as avg_rating
            FROM complaints c
            WHERE c.status = 'Closed'
            GROUP BY c.category
            ORDER BY avg_hours_to_resolve ASC`
        );

        res.json({
            success: true,
            statistics: stats || []
        });
    } catch (error) {
        console.error("Get Resolution Time By Category Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch resolution statistics.", error: error.message });
    }
};

// Get daily complaints trends
export const getComplaintsTrend = async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const [trends] = await db.query(
            `SELECT
                DATE(c.created_at) as date,
                COUNT(c.id) as total_complaints,
                SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN c.status != 'Closed' THEN 1 ELSE 0 END) as pending
            FROM complaints c
            WHERE DATE(c.created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(c.created_at)
            ORDER BY date DESC`,
            [days]
        );

        res.json({
            success: true,
            trends: trends || []
        });
    } catch (error) {
        console.error("Get Complaints Trend Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch trends.", error: error.message });
    }
};
