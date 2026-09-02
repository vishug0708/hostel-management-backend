const db = require("../config/database");

// ===============================
// GET STUDENT PROFILE
// ===============================
const getStudentProfile = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [rows] = await db.query(
            `SELECT
                id,
                name,
                email,
                mobile,
                hostel_fee,
                photo,
                parent_email,
                college,
                course,
                hostel
             FROM students
             WHERE id = ?`,
            [studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            student: rows[0]
        });

    } catch (error) {
        console.error("Get Student Profile Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student profile.",
            error: error.message
        });
    }
};


// ===============================
// UPDATE STUDENT PROFILE
// ===============================
const updateStudentProfile = async (req, res) => {
    try {
        const studentId = req.params.id;

        const {
            name,
            email,
            mobile
        } = req.body;

        // ===============================
        // VALIDATION
        // ===============================
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        if (!mobile || !mobile.trim()) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required."
            });
        }

        // ===============================
        // CHECK STUDENT
        // ===============================
        const [studentRows] = await db.query(
            `SELECT id, photo
             FROM students
             WHERE id = ?`,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // ===============================
        // CHECK EMAIL
        // ===============================
        const [emailRows] = await db.query(
            `SELECT id
             FROM students
             WHERE email = ?
             AND id != ?`,
            [email.trim(), studentId]
        );

        if (emailRows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        // ===============================
        // CHECK MOBILE
        // ===============================
        const [mobileRows] = await db.query(
            `SELECT id
             FROM students
             WHERE mobile = ?
             AND id != ?`,
            [mobile.trim(), studentId]
        );

        if (mobileRows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This mobile number is already registered."
            });
        }

        // ===============================
        // PHOTO UPDATE
        // ===============================
        let photo = studentRows[0].photo;

        if (req.file) {
            photo = `uploads/students/${req.file.filename}`;
        }

        // ===============================
        // UPDATE DATABASE
        // ===============================
        await db.query(
            `UPDATE students
             SET
                name = ?,
                email = ?,
                mobile = ?,
                photo = ?
             WHERE id = ?`,
            [
                name.trim(),
                email.trim(),
                mobile.trim(),
                photo,
                studentId
            ]
        );

        // ===============================
        // GET UPDATED PROFILE
        // ===============================
        const [updatedRows] = await db.query(
            `SELECT
                id,
                name,
                email,
                mobile,
                hostel_fee,
                photo,
                parent_email,
                college,
                course,
                hostel
             FROM students
             WHERE id = ?`,
            [studentId]
        );

        res.json({
            success: true,
            message: "Profile updated successfully.",
            student: updatedRows[0]
        });

    } catch (error) {
        console.error("Update Student Profile Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update student profile.",
            error: error.message
        });
    }
};


// ===============================
// GET STUDENT DASHBOARD
// ===============================
const getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [studentRows] = await db.query(
            `SELECT
                id,
                name,
                email,
                mobile,
                hostel_fee,
                photo,
                parent_email,
                college,
                course,
                hostel
             FROM students
             WHERE id = ?`,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const [allocationRows] = await db.query(
            `SELECT
                ra.id,
                ra.room_id,
                ra.bed_no,
                ra.allocation_date,
                ra.status,
                r.room_no,
                r.block,
                r.total_beds,
                r.hostel
             FROM room_allocation ra
             INNER JOIN rooms r ON ra.room_id = r.id
             WHERE ra.student_id = ?
             AND ra.status = 'Allocated'
             ORDER BY ra.id DESC
             LIMIT 1`,
            [studentId]
        );

        const [leaveRows] = await db.query(
            `SELECT
                id,
                from_date,
                to_date,
                reason,
                status
             FROM leave_requests
             WHERE student_id = ?
             ORDER BY id DESC
             LIMIT 5`,
            [studentId]
        );

        res.json({
            success: true,
            student: studentRows[0],
            room: allocationRows.length > 0
                ? allocationRows[0]
                : null,
            leaveRequests: leaveRows
        });

    } catch (error) {
        console.error("Get Student Dashboard Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student dashboard.",
            error: error.message
        });
    }
};


// ===============================
// GET STUDENT ROOM + ROOMMATES
// ===============================
const getStudentRoom = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [roomRows] = await db.query(
            `SELECT
                ra.id AS allocation_id,
                ra.student_id,
                ra.room_id,
                ra.bed_no,
                ra.allocation_date,
                ra.status,
                r.room_no,
                r.block,
                r.total_beds,
                r.hostel
             FROM room_allocation ra
             INNER JOIN rooms r ON ra.room_id = r.id
             WHERE ra.student_id = ?
             AND ra.status = 'Allocated'
             ORDER BY ra.id DESC
             LIMIT 1`,
            [studentId]
        );

        if (roomRows.length === 0) {
            return res.json({
                success: true,
                room: null,
                roommates: [],
                message: "No room allocated."
            });
        }

        const room = roomRows[0];

        const [roommateRows] = await db.query(
            `SELECT
                s.id,
                s.name,
                s.email,
                s.mobile,
                s.photo,
                ra.bed_no,
                ra.allocation_date,
                ra.status
             FROM room_allocation ra
             INNER JOIN students s
                ON ra.student_id = s.id
             WHERE ra.room_id = ?
             AND ra.status = 'Allocated'
             AND ra.student_id != ?
             ORDER BY ra.bed_no ASC`,
            [room.room_id, studentId]
        );

        res.json({
            success: true,
            room: {
                allocation_id: room.allocation_id,
                student_id: room.student_id,
                room_id: room.room_id,
                bed_no: room.bed_no,
                allocation_date: room.allocation_date,
                status: room.status,
                room_no: room.room_no,
                block: room.block,
                total_beds: room.total_beds,
                hostel: room.hostel,
                roommates: roommateRows
            }
        });

    } catch (error) {
        console.error("Get Student Room Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch room details.",
            error: error.message
        });
    }
};


// ===============================
// GET STUDENT LEAVE REQUESTS
// ===============================
const getStudentLeaves = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [rows] = await db.query(
            `SELECT
                id,
                from_date,
                to_date,
                reason,
                status,
                created_at
             FROM leave_requests
             WHERE student_id = ?
             ORDER BY id DESC`,
            [studentId]
        );

        res.json({
            success: true,
            leaves: rows
        });

    } catch (error) {
        console.error("Get Student Leaves Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch leave requests.",
            error: error.message
        });
    }
};


// ===============================
// GET STUDENT ATTENDANCE
// ===============================
const getStudentAttendance = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [rows] = await db.query(
            `SELECT
                id,
                student_id,
                attendance_date,
                status,
                created_at
             FROM attendance
             WHERE student_id = ?
             ORDER BY attendance_date DESC`,
            [studentId]
        );

        res.json({
            success: true,
            attendance: rows
        });

    } catch (error) {
        console.error("Get Student Attendance Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance.",
            error: error.message
        });
    }
};


// ===============================
// GET STUDENT COMPLAINTS
// ===============================
const getStudentComplaints = async (req, res) => {
    try {
        const studentId = req.params.id;

        const [rows] = await db.query(
            `SELECT
                id,
                student_id,
                subject,
                description,
                status,
                created_at
             FROM complaints
             WHERE student_id = ?
             ORDER BY id DESC`,
            [studentId]
        );

        res.json({
            success: true,
            complaints: rows
        });

    } catch (error) {
        console.error("Get Student Complaints Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch complaints.",
            error: error.message
        });
    }
};


// ===============================
// EXPORTS
// ===============================
module.exports = {
    getStudentProfile,
    updateStudentProfile,
    getStudentDashboard,
    getStudentRoom,
    getStudentLeaves,
    getStudentAttendance,
    getStudentComplaints
};