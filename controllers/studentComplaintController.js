const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "hostel_management_secret";

const VALID_CATEGORIES = [
    "Electrical",
    "Plumbing",
    "Carpenter",
    "Cleaning",
    "IT",
    "Maintenance"
];

const getToken = (req) => {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    return header.substring(7).trim();
};

const verifyStudent = (req, res) => {
    const token = getToken(req);
    if (!token) {
        res.status(401).json({ success: false, message: "Authentication token is required." });
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role && decoded.role !== "student") {
            res.status(403).json({ success: false, message: "Student access only." });
            return null;
        }
        const studentId = decoded.student_id || decoded.id;
        if (!studentId) {
            res.status(401).json({ success: false, message: "Invalid student token." });
            return null;
        }
        return { ...decoded, studentId };
    } catch (error) {
        console.error("Student Complaint JWT Error:", error.message);
        res.status(401).json({ success: false, message: "Invalid or expired student token." });
        return null;
    }
};

const getStudentById = async (studentId) => {
    const [rows] = await db.query(
        `SELECT id, name, email, mobile, photo, hostel, college, course
         FROM students
         WHERE id = ?
         LIMIT 1`,
        [studentId]
    );
    return rows[0] || null;
};

const getBackupStudents = async (req, res) => {
    const auth = verifyStudent(req, res);
    if (!auth) return;

    const requestedStudentId = Number(req.params.studentId);
    if (!requestedStudentId || requestedStudentId !== Number(auth.studentId)) {
        return res.status(403).json({ success: false, message: "You can only load backup students for your own account." });
    }

    try {
        // IMPORTANT: students table does not contain a status column in the current database.
        // Therefore do not use s.status in this query.
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
            [requestedStudentId]
        );

        return res.status(200).json({ success: true, students });
    } catch (error) {
        console.error("Get Backup Students Error:", error);
        return res.status(500).json({ success: false, message: "Failed to load backup students.", error: error.message });
    }
};

const getAvailableStaff = async (category) => {
    const [rows] = await db.query(
        `SELECT
            st.id,
            st.staff_id,
            st.name,
            st.email,
            st.mobile,
            st.photo,
            st.role,
            COUNT(CASE WHEN c.status <> 'Closed' THEN 1 END) AS active_complaints
         FROM staff st
         LEFT JOIN complaints c
            ON c.assigned_staff_id = st.id
         WHERE LOWER(st.role) = LOWER(?)
           AND LOWER(st.status) = 'active'
         GROUP BY st.id, st.staff_id, st.name, st.email, st.mobile, st.photo, st.role
         ORDER BY active_complaints ASC, st.id ASC
         LIMIT 1`,
        [category]
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

    const studentId = Number(auth.studentId);
    const backupStudentId = Number(req.body.backup_student_id);
    const category = String(req.body.category || "").trim();
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();

    if (!backupStudentId) return res.status(400).json({ success: false, message: "Backup student is mandatory." });
    if (backupStudentId === studentId) return res.status(400).json({ success: false, message: "Backup student must be different from the complaint student." });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: "Invalid complaint category." });
    if (!subject) return res.status(400).json({ success: false, message: "Complaint subject is required." });
    if (subject.length > 200) return res.status(400).json({ success: false, message: "Complaint subject cannot exceed 200 characters." });
    if (!description) return res.status(400).json({ success: false, message: "Complaint description is required." });

    try {
        const [students] = await db.query(
            `SELECT id, name, email, mobile, photo, hostel, college, course
             FROM students
             WHERE id IN (?, ?)
             LIMIT 2`,
            [studentId, backupStudentId]
        );

        const complaintStudent = students.find((item) => Number(item.id) === studentId);
        const backupStudent = students.find((item) => Number(item.id) === backupStudentId);

        if (!complaintStudent) return res.status(404).json({ success: false, message: "Complaint student was not found." });
        if (!backupStudent) return res.status(404).json({ success: false, message: "Selected backup student was not found." });

        const assignedStaff = await getAvailableStaff(category);
        if (!assignedStaff) {
            return res.status(409).json({ success: false, message: `No active ${category} staff is available for automatic assignment.` });
        }

        const attachment = req.file ? path.posix.join("uploads", "complaints", req.file.filename) : null;
        const complaintCode = generateComplaintCode();
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
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
                    assigned_staff_role,
                    assigned_at,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Assigned')`,
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
                    assignedStaff.photo,
                    assignedStaff.role
                ]
            );
            await connection.commit();

            return res.status(201).json({
                success: true,
                message: "Complaint submitted successfully.",
                complaint: {
                    id: result.insertId,
                    complaint_code: complaintCode,
                    status: "Assigned",
                    category,
                    assigned_staff_id: assignedStaff.id,
                    assigned_staff_name: assignedStaff.name,
                    assigned_staff_mobile: assignedStaff.mobile,
                    assigned_staff_photo: assignedStaff.photo,
                    assigned_staff_role: assignedStaff.role
                }
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Create Student Complaint Error:", error);
        return res.status(500).json({ success: false, message: "Failed to submit complaint.", error: error.message });
    }
};

const getStudentComplaints = async (req, res) => {
    const auth = verifyStudent(req, res);
    if (!auth) return;

    const requestedStudentId = Number(req.params.studentId);
    if (!requestedStudentId || requestedStudentId !== Number(auth.studentId)) {
        return res.status(403).json({ success: false, message: "You can only view your own complaints." });
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
                c.assigned_staff_role,
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
                c.updated_at
             FROM complaints c
             WHERE c.student_id = ?
             ORDER BY c.id DESC`,
            [requestedStudentId]
        );

        return res.status(200).json({ success: true, complaints });
    } catch (error) {
        console.error("Get Student Complaints Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch complaints.", error: error.message });
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
            c.assigned_staff_role,
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
            r.block
         FROM complaints c
         LEFT JOIN students s ON s.id = c.student_id
         LEFT JOIN students bs ON bs.id = c.backup_student_id
         LEFT JOIN room_allocation ra ON ra.student_id = c.student_id AND ra.status = 'Allocated'
         LEFT JOIN rooms r ON r.id = ra.room_id
         WHERE c.id = ? AND c.student_id = ?
         LIMIT 1`,
        [complaintId, studentId]
    );
    return rows[0] || null;
};

const getStudentComplaintDetails = async (req, res) => {
    const auth = verifyStudent(req, res);
    if (!auth) return;

    const studentId = Number(req.params.studentId);
    const complaintId = Number(req.params.complaintId);
    if (!studentId || studentId !== Number(auth.studentId)) return res.status(403).json({ success: false, message: "You can only view your own complaint." });
    if (!complaintId) return res.status(400).json({ success: false, message: "Complaint ID is required." });

    try {
        const complaint = await getComplaintById(complaintId, studentId);
        if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found." });
        return res.status(200).json({ success: true, complaint });
    } catch (error) {
        console.error("Get Student Complaint Details Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch complaint details.", error: error.message });
    }
};

module.exports = {
    getBackupStudents,
    createComplaint,
    getStudentComplaints,
    getStudentComplaintDetails
};
