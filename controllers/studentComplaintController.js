const db = require("../config/database");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "hostel_management_secret";

const getTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }

    return authHeader.substring(7).trim();
};

const verifyStudentToken = (req) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return {
            valid: false,
            message: "Authentication token is required."
        };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (
            String(decoded.role || "").toLowerCase() !==
            "student"
        ) {
            return {
                valid: false,
                message: "Student access is required."
            };
        }

        return {
            valid: true,
            decoded
        };
    } catch (error) {
        return {
            valid: false,
            message:
                error.name === "TokenExpiredError"
                    ? "Student session has expired. Please login again."
                    : "Invalid authentication token."
        };
    }
};

const getAuthenticatedStudentId = (req) => {
    const decoded = req.studentAuth?.decoded;

    if (decoded?.student_id) {
        return decoded.student_id;
    }

    if (decoded?.id) {
        return decoded.id;
    }

    return null;
};

const normalizeStudentId = (value) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        return null;
    }

    return numberValue;
};

const generateComplaintCode = () => {
    const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

    const randomPart = crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

    return `CMP-${datePart}-${randomPart}`;
};

const normalizeCategory = (category) => {
    if (!category) {
        return "";
    }

    const value = String(category)
        .trim()
        .toLowerCase();

    const categoryMap = {
        electrical: "Electrical",
        plumbing: "Plumbing",
        carpenter: "Carpenter",
        cleaning: "Cleaning",
        it: "IT",
        maintenance: "Maintenance"
    };

    return categoryMap[value] || "";
};

const getStudentDetails = async (studentId) => {
    const [rows] = await db.query(
        `
        SELECT
            s.id,
            s.name,
            s.email,
            s.mobile,
            s.photo,
            s.parent_email,
            s.college,
            s.course,
            s.hostel,
            ra.bed_no,
            r.room_no,
            r.block
        FROM students s
        LEFT JOIN room_allocation ra
            ON ra.student_id = s.id
            AND ra.status = 'Allocated'
        LEFT JOIN rooms r
            ON r.id = ra.room_id
        WHERE s.id = ?
        ORDER BY ra.id DESC
        LIMIT 1
        `,
        [studentId]
    );

    return rows.length > 0 ? rows[0] : null;
};

const getBackupStudents = async (req, res) => {
    try {
        const auth = verifyStudentToken(req);

        if (!auth.valid) {
            return res.status(401).json({
                success: false,
                message: auth.message
            });
        }

        const tokenStudentId = normalizeStudentId(
            auth.decoded.student_id ||
                auth.decoded.id
        );

        const requestedStudentId =
            normalizeStudentId(req.params.studentId);

        if (!tokenStudentId) {
            return res.status(401).json({
                success: false,
                message:
                    "Student information is missing from token."
            });
        }

        if (
            requestedStudentId &&
            requestedStudentId !== tokenStudentId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only access your own backup students."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
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
            WHERE s.id != ?
            AND (
                s.status IS NULL
                OR LOWER(s.status) = 'active'
            )
            ORDER BY s.name ASC
            `,
            [tokenStudentId]
        );

        return res.status(200).json({
            success: true,
            students: rows
        });
    } catch (error) {
        console.error(
            "Get Backup Students Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch backup students.",
            error: error.message
        });
    }
};

const getAvailableStaff = async (category) => {
    const [rows] = await db.query(
        `
        SELECT
            s.id,
            s.staff_id,
            s.name,
            s.mobile,
            s.email,
            s.photo,
            s.role,
            s.status,
            COUNT(
                CASE
                    WHEN c.status != 'Closed'
                    THEN c.id
                END
            ) AS active_complaints
        FROM staff s
        LEFT JOIN complaints c
            ON c.assigned_staff_id = s.id
        WHERE LOWER(s.role) = LOWER(?)
        AND LOWER(s.status) = 'active'
        GROUP BY
            s.id,
            s.staff_id,
            s.name,
            s.mobile,
            s.email,
            s.photo,
            s.role,
            s.status
        ORDER BY
            active_complaints ASC,
            s.id ASC
        `,
        [category]
    );

    return rows;
};

const getComplaintById = async (
    complaintId,
    studentId
) => {
    const [rows] = await db.query(
        `
        SELECT
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
            s.hostel AS student_hostel,

            ra.bed_no AS student_bed_no,
            r.room_no AS student_room_no,
            r.block AS student_block,

            bs.name AS backup_student_name,
            bs.email AS backup_student_email,
            bs.mobile AS backup_student_mobile,
            bs.photo AS backup_student_photo,
            bs.hostel AS backup_student_hostel,

            bra.bed_no AS backup_student_bed_no,
            br.room_no AS backup_student_room_no,
            br.block AS backup_student_block

        FROM complaints c

        INNER JOIN students s
            ON s.id = c.student_id

        INNER JOIN students bs
            ON bs.id = c.backup_student_id

        LEFT JOIN room_allocation ra
            ON ra.student_id = s.id
            AND ra.status = 'Allocated'

        LEFT JOIN rooms r
            ON r.id = ra.room_id

        LEFT JOIN room_allocation bra
            ON bra.student_id = bs.id
            AND bra.status = 'Allocated'

        LEFT JOIN rooms br
            ON br.id = bra.room_id

        WHERE c.id = ?
        AND c.student_id = ?

        ORDER BY
            ra.id DESC,
            bra.id DESC

        LIMIT 1
        `,
        [complaintId, studentId]
    );

    return rows.length > 0 ? rows[0] : null;
};

const createComplaint = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const auth = verifyStudentToken(req);

        if (!auth.valid) {
            return res.status(401).json({
                success: false,
                message: auth.message
            });
        }

        const tokenStudentId = normalizeStudentId(
            auth.decoded.student_id ||
                auth.decoded.id
        );

        if (!tokenStudentId) {
            return res.status(401).json({
                success: false,
                message:
                    "Student information is missing from token."
            });
        }

        const requestedStudentId =
            normalizeStudentId(req.body.student_id);

        if (
            requestedStudentId &&
            requestedStudentId !== tokenStudentId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only create complaints for your own account."
            });
        }

        const backupStudentId =
            normalizeStudentId(
                req.body.backup_student_id
            );

        const category = normalizeCategory(
            req.body.category
        );

        const subject = String(
            req.body.subject || ""
        ).trim();

        const description = String(
            req.body.description || ""
        ).trim();

        if (!backupStudentId) {
            return res.status(400).json({
                success: false,
                message:
                    "Backup student is required."
            });
        }

        if (backupStudentId === tokenStudentId) {
            return res.status(400).json({
                success: false,
                message:
                    "You cannot select yourself as backup student."
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid complaint category is required."
            });
        }

        if (!subject) {
            return res.status(400).json({
                success: false,
                message:
                    "Complaint subject is required."
            });
        }

        if (subject.length > 200) {
            return res.status(400).json({
                success: false,
                message:
                    "Complaint subject cannot exceed 200 characters."
            });
        }

        if (!description) {
            return res.status(400).json({
                success: false,
                message:
                    "Complaint description is required."
            });
        }

        const student =
            await getStudentDetails(
                tokenStudentId
            );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const backupStudent =
            await getStudentDetails(
                backupStudentId
            );

        if (!backupStudent) {
            return res.status(404).json({
                success: false,
                message:
                    "Selected backup student was not found."
            });
        }

        const staffList =
            await getAvailableStaff(category);

        if (staffList.length === 0) {
            return res.status(409).json({
                success: false,
                message:
                    `No active ${category} staff is currently available.`
            });
        }

        const assignedStaff = staffList[0];

        const complaintCode =
            generateComplaintCode();

        const attachment = req.file
            ? `uploads/complaints/${req.file.filename}`
            : null;

        await connection.beginTransaction();

        const [insertResult] =
            await connection.query(
                `
                INSERT INTO complaints (
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

                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,

                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NOW(),

                    'Assigned',
                    NOW(),
                    NOW()
                )
                `,
                [
                    complaintCode,
                    tokenStudentId,
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

        const complaint =
            await getComplaintById(
                insertResult.insertId,
                tokenStudentId
            );

        return res.status(201).json({
            success: true,
            message:
                "Complaint submitted and assigned successfully.",
            complaint
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                "Complaint Rollback Error:",
                rollbackError
            );
        }

        console.error(
            "Create Student Complaint Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to create complaint.",
            error: error.message
        });
    } finally {
        connection.release();
    }
};

const getStudentComplaints = async (req, res) => {
    try {
        const auth = verifyStudentToken(req);

        if (!auth.valid) {
            return res.status(401).json({
                success: false,
                message: auth.message
            });
        }

        const tokenStudentId = normalizeStudentId(
            auth.decoded.student_id ||
                auth.decoded.id
        );

        if (!tokenStudentId) {
            return res.status(401).json({
                success: false,
                message:
                    "Student information is missing from token."
            });
        }

        const requestedStudentId =
            normalizeStudentId(
                req.params.studentId
            );

        if (
            requestedStudentId &&
            requestedStudentId !== tokenStudentId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only access your own complaints."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
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
                c.resolution_marked_at,
                c.otp_verified,
                c.closed_at,

                c.rating,
                c.rating_feedback,
                c.rated_at,

                c.created_at,
                c.updated_at

            FROM complaints c

            WHERE c.student_id = ?

            ORDER BY c.id DESC
            `,
            [tokenStudentId]
        );

        return res.status(200).json({
            success: true,
            complaints: rows
        });
    } catch (error) {
        console.error(
            "Get Student Complaints Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch student complaints.",
            error: error.message
        });
    }
};

const getStudentComplaintDetails = async (
    req,
    res
) => {
    try {
        const auth = verifyStudentToken(req);

        if (!auth.valid) {
            return res.status(401).json({
                success: false,
                message: auth.message
            });
        }

        const tokenStudentId = normalizeStudentId(
            auth.decoded.student_id ||
                auth.decoded.id
        );

        const complaintId =
            normalizeStudentId(
                req.params.complaintId ||
                    req.params.id
            );

        if (!tokenStudentId) {
            return res.status(401).json({
                success: false,
                message:
                    "Student information is missing from token."
            });
        }

        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid complaint ID is required."
            });
        }

        const complaint =
            await getComplaintById(
                complaintId,
                tokenStudentId
            );

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message:
                    "Complaint not found."
            });
        }

        return res.status(200).json({
            success: true,
            complaint
        });
    } catch (error) {
        console.error(
            "Get Student Complaint Details Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch complaint details.",
            error: error.message
        });
    }
};

module.exports = {
    createComplaint,
    getStudentComplaints,
    getStudentComplaintDetails,
    getBackupStudents
};