const db = require("../config/database");

// =====================================================
// GET ALL COMPLAINTS
// =====================================================

const getComplaints = (req, res) => {
    const sql = `
        SELECT
            c.id,
            c.student_id,
            c.subject,
            c.description,
            c.status,
            c.assigned_staff_id,
            c.created_at,
            c.complaint_date,
            c.resolution_note,
            c.resolved_at,
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

    db.query(sql, (err, complaints) => {
        if (err) {
            console.error("Get Admin Complaints Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch complaints.",
                error: err.message
            });
        }

        return res.status(200).json({
            success: true,
            complaints
        });
    });
};


// =====================================================
// GET COMPLAINT HISTORY
// =====================================================

const getComplaintHistory = (req, res) => {
    const sql = `
        SELECT
            c.id,
            c.student_id,
            c.subject,
            c.description,
            c.status,
            c.assigned_staff_id,
            c.created_at,
            c.complaint_date,
            c.resolution_note,
            c.resolved_at,
            s.name AS student_name,
            s.email AS student_email,
            s.mobile AS student_mobile,
            r.room_nor,
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

    db.query(sql, (err, complaints) => {
        if (err) {
            console.error("Get Complaint History Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch complaint history.",
                error: err.message
            });
        }

        return res.status(200).json({
            success: true,
            complaints
        });
    });
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getComplaints,
    getComplaintHistory
};