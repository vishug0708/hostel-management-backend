const db = require("../config/database");

// =====================================================
// GET ALL COMPLAINTS
// =====================================================

const getComplaints = async (req, res) => {
    try {
        const sql = `
            SELECT
                c.id,
                c.student_id,
                c.subject,
                c.description,
                c.complaint_date,
                c.resolution_note,
                c.resolved_at,
                c.status,
                c.assigned_staff_id,
                c.created_at,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                r.room_no,
                st.name AS staff_name,
                st.role AS staff_role
            FROM complaints c
            LEFT JOIN students s
                ON c.student_id = s.id
            LEFT JOIN room_allocation ra
                ON ra.student_id = c.student_id
            LEFT JOIN rooms r
                ON ra.room_id = r.id
            LEFT JOIN staff st
                ON c.assigned_staff_id = st.id
            ORDER BY c.id DESC
        `;

        const [complaints] = await db.query(sql);

        return res.status(200).json({
            success: true,
            complaints
        });

    } catch (error) {
        console.error("Get Admin Complaints Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaints.",
            error: error.message
        });
    }
};


// =====================================================
// GET COMPLAINT HISTORY
// =====================================================

const getComplaintHistory = async (req, res) => {
    try {
        const sql = `
            SELECT
                c.id,
                c.student_id,
                c.subject,
                c.description,
                c.complaint_date,
                c.resolution_note,
                c.resolved_at,
                c.status,
                c.assigned_staff_id,
                c.created_at,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                r.room_no,
                st.name AS staff_name,
                st.role AS staff_role
            FROM complaints c
            LEFT JOIN students s
                ON c.student_id = s.id
            LEFT JOIN room_allocation ra
                ON ra.student_id = c.student_id
            LEFT JOIN rooms r
                ON ra.room_id = r.id
            LEFT JOIN staff st
                ON c.assigned_staff_id = st.id
            WHERE c.status = 'Resolved'
            ORDER BY c.id DESC
        `;

        const [complaints] = await db.query(sql);

        return res.status(200).json({
            success: true,
            complaints
        });

    } catch (error) {
        console.error("Get Complaint History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaint history.",
            error: error.message
        });
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getComplaints,
    getComplaintHistory
};




