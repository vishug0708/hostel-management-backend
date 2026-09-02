const db = require("../config/database");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ======================================================
// EMAIL CONFIGURATION
// ======================================================

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ======================================================
// GENERATE 6 DIGIT OTP
// ======================================================

const generateOTP = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

// ======================================================
// SEND PARENT OTP EMAIL
// ======================================================

const sendParentOTP = async (
    parentEmail,
    studentName,
    otp,
    gatePassId
) => {
    await transporter.sendMail({
        from: `"Virtuous Hostel" <${process.env.EMAIL_USER}>`,
        to: parentEmail,
        subject: "Gate Pass Verification OTP",

        html: `
        <div style="
            max-width:600px;
            margin:auto;
            font-family:Arial,sans-serif;
            background:#f5f8fa;
            padding:30px;
        ">

            <div style="
                background:white;
                border-radius:15px;
                padding:30px;
                border:1px solid #e1e8ee;
            ">

                <h2 style="
                    color:#117d75;
                    margin-top:0;
                ">
                    Virtuous Hostel
                </h2>

                <h3>
                    Gate Pass Verification
                </h3>

                <p>
                    Dear Parent,
                </p>

                <p>
                    Your ward has submitted a gate pass request.
                    Please verify the request using the OTP below.
                </p>

                <p>
                    <strong>Student:</strong>
                    ${studentName}
                </p>

                <p>
                    <strong>Gate Pass ID:</strong>
                    GP-${gatePassId}
                </p>

                <div style="
                    text-align:center;
                    margin:30px 0;
                ">

                    <div style="
                        display:inline-block;
                        background:#117d75;
                        color:white;
                        padding:15px 35px;
                        border-radius:10px;
                        font-size:30px;
                        font-weight:bold;
                        letter-spacing:8px;
                    ">
                        ${otp}
                    </div>

                </div>

                <p>
                    This OTP is valid for
                    <strong>10 minutes</strong>.
                </p>

                <p style="color:#777;">
                    If you did not expect this request,
                    please contact the hostel rector.
                </p>

                <hr>

                <p style="
                    font-size:12px;
                    color:#888;
                ">
                    Virtuous Hostel<br>
                    Hostel Management System
                </p>

            </div>

        </div>
        `
    });
};

// ======================================================
// APPLY GATE PASS
// POST /api/student/gatepass/apply
// ======================================================

const applyGatePass = async (req, res) => {
    try {
        const {
            student_id,
            purpose,
            destination,
            out_date,
            return_date,
            out_time
        } = req.body;

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        if (
            !student_id ||
            !purpose ||
            !destination ||
            !out_date ||
            !return_date ||
            !out_time
        ) {
            return res.status(400).json({
                success: false,
                message: "All gate pass fields are required."
            });
        }

        // --------------------------------------------------
        // GET STUDENT
        // --------------------------------------------------

        const [students] = await db.query(
            `
            SELECT
                id,
                name,
                email,
                parent_email,
                mobile,
                college,
                course,
                hostel
            FROM students
            WHERE id = ?
            LIMIT 1
            `,
            [student_id]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const student = students[0];

        // --------------------------------------------------
        // CHECK PARENT EMAIL
        // --------------------------------------------------

        if (!student.parent_email) {
            return res.status(400).json({
                success: false,
                message:
                    "Parent email is not registered for this student."
            });
        }

        // --------------------------------------------------
        // CHECK EXISTING PENDING REQUEST
        // --------------------------------------------------

        const [pendingRequests] = await db.query(
            `
            SELECT id
            FROM gate_pass
            WHERE student_id = ?
            AND rector = 'Pending'
            AND security_exit = 'No'
            AND security_entry = 'No'
            LIMIT 1
            `,
            [student_id]
        );

        if (pendingRequests.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "You already have a pending gate pass request."
            });
        }

        // --------------------------------------------------
        // GENERATE OTP
        // --------------------------------------------------

        const otp = generateOTP();

        const otpExpiry = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // --------------------------------------------------
        // INSERT GATE PASS
        // --------------------------------------------------

        const [result] = await db.query(
            `
            INSERT INTO gate_pass
            (
                student_id,
                purpose,
                destination,
                out_date,
                return_date,
                out_time,
                rector,
                created_at,
                verification_code,
                parent_otp,
                otp_expiry,
                otp_verified,
                otp_verified_at,
                otp_attempts,
                security_exit,
                security_entry
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                'Pending',
                NOW(),
                ?,
                ?,
                ?,
                'No',
                NULL,
                0,
                'No',
                'No'
            )
            `,
            [
                student_id,
                purpose.trim(),
                destination.trim(),
                out_date,
                return_date,
                out_time,
                crypto.randomBytes(32).toString("hex"),
                otp,
                otpExpiry
            ]
        );

        const gatePassId = result.insertId;

        // --------------------------------------------------
        // SEND OTP TO PARENT
        // --------------------------------------------------

        try {
            await sendParentOTP(
                student.parent_email,
                student.name,
                otp,
                gatePassId
            );
        } catch (emailError) {

            console.error(
                "Parent OTP Email Error:",
                emailError
            );

            // Delete gate pass if email fails
            await db.query(
                `
                DELETE FROM gate_pass
                WHERE id = ?
                `,
                [gatePassId]
            );

            return res.status(500).json({
                success: false,
                message:
                    "Gate pass could not be submitted because OTP email could not be sent."
            });
        }

        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        return res.status(201).json({
            success: true,
            message:
                "Gate pass submitted successfully. OTP has been sent to your parent's email.",
            gate_pass_id: gatePassId,
            otp_required: true
        });

    } catch (error) {

        console.error(
            "Apply Gate Pass Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to apply gate pass.",
            error: error.message
        });
    }
};

// ======================================================
// GET MY GATE PASSES
// GET /api/student/gatepass/my/:student_id
// ======================================================

// ==========================================
// GET MY GATE PASSES
// GET
// /api/student/gatepass/my/:student_id
// ==========================================
const getMyGatePasses = async (req, res) => {
    try {
        const { student_id } = req.params;

        if (!student_id) {
            return res.status(400).json({
                success: false,
                message: "Student ID is required."
            });
        }

        const [rows] = await db.query(
            `SELECT
                gp.id,
                gp.student_id,
                gp.purpose,
                gp.destination,
                gp.out_date,
                gp.return_date,
                gp.out_time,
                gp.exit_datetime,
                gp.entry_datetime,
                gp.rector,
                gp.created_at,
                gp.verification_code,
                gp.qr_code,
                gp.parent_otp,
                gp.otp_expiry,
                gp.otp_verified,
                gp.otp_verified_at,
                gp.otp_attempts,
                gp.security_exit,
                gp.security_entry,

                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.parent_email,
                s.college,
                s.course,
                s.hostel,
                s.photo

             FROM gate_pass gp

             INNER JOIN students s
                ON gp.student_id = s.id

             WHERE gp.student_id = ?

             ORDER BY gp.created_at DESC, gp.id DESC`,
            [student_id]
        );

        return res.status(200).json({
            success: true,
            message: "Gate passes fetched successfully.",
            gatePasses: rows
        });

    } catch (error) {
        console.error("Get My Gate Passes Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch gate passes.",
            error: error.message
        });
    }
};
// ======================================================
// GET SINGLE GATE PASS
// GET /api/student/gatepass/:student_id/:gate_pass_id
// ======================================================

const getGatePassById = async (req, res) => {
    try {

        const {
            student_id,
            gate_pass_id
        } = req.params;

        if (!student_id || !gate_pass_id) {
            return res.status(400).json({
                success: false,
                message:
                    "Student ID and Gate Pass ID are required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                gp.id,
                gp.student_id,
                gp.purpose,
                gp.destination,
                gp.out_date,
                gp.return_date,
                gp.out_time,
                gp.exit_datetime,
                gp.entry_datetime,
                gp.rector,
                gp.created_at,
                gp.verification_code,
                gp.qr_code,
                gp.otp_verified,
                gp.otp_verified_at,
                gp.security_exit,
                gp.security_entry,

                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.parent_email,
                s.college,
                s.course,
                s.hostel

            FROM gate_pass gp

            INNER JOIN students s
                ON gp.student_id = s.id

            WHERE gp.id = ?
            AND gp.student_id = ?

            LIMIT 1
            `,
            [
                gate_pass_id,
                student_id
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Gate pass not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        console.error(
            "Get Gate Pass Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch gate pass.",
            error: error.message
        });
    }
};

// ======================================================
// VERIFY PARENT OTP
// POST /api/student/gatepass/verify-otp/:gatePassId
// ======================================================

const verifyParentOTP = async (req, res) => {
    try {

        const { gatePassId } = req.params;
        const { otp } = req.body;

        if (!gatePassId) {
            return res.status(400).json({
                success: false,
                message:
                    "Gate pass ID is required."
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message:
                    "OTP is required."
            });
        }

        const cleanOTP = String(otp).trim();

        if (!/^\d{6}$/.test(cleanOTP)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid 6-digit OTP."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                parent_otp,
                otp_expiry,
                otp_verified,
                otp_attempts
            FROM gate_pass
            WHERE id = ?
            LIMIT 1
            `,
            [gatePassId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Gate pass not found."
            });
        }

        const gatePass = rows[0];

        // Already verified
        if (gatePass.otp_verified === "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "OTP has already been verified."
            });
        }

        // OTP missing
        if (!gatePass.parent_otp) {
            return res.status(400).json({
                success: false,
                message:
                    "OTP not found. Please resend OTP."
            });
        }

        // Expired
        if (
            !gatePass.otp_expiry ||
            new Date() > new Date(gatePass.otp_expiry)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "OTP has expired. Please resend OTP."
            });
        }

        // Maximum attempts
        if (
            Number(gatePass.otp_attempts || 0) >= 5
        ) {
            return res.status(429).json({
                success: false,
                message:
                    "Maximum OTP attempts reached. Please resend OTP."
            });
        }

        // Wrong OTP
        if (
            cleanOTP !==
            String(gatePass.parent_otp)
        ) {

            await db.query(
                `
                UPDATE gate_pass
                SET otp_attempts =
                    COALESCE(otp_attempts, 0) + 1
                WHERE id = ?
                `,
                [gatePassId]
            );

            return res.status(400).json({
                success: false,
                message:
                    "Incorrect OTP."
            });
        }

        // OTP verified
        await db.query(
            `
            UPDATE gate_pass
            SET
                otp_verified = 'Yes',
                otp_verified_at = NOW(),
                parent_otp = NULL,
                otp_expiry = NULL,
                otp_attempts = 0
            WHERE id = ?
            `,
            [gatePassId]
        );

        return res.status(200).json({
            success: true,
            message:
                "OTP verified successfully. Gate pass request has been sent for rector approval."
        });

    } catch (error) {

        console.error(
            "Verify Parent OTP Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to verify OTP.",
            error: error.message
        });
    }
};

// ======================================================
// RESEND PARENT OTP
// POST /api/student/gatepass/resend-otp/:gatePassId
// ======================================================

const resendParentOTP = async (req, res) => {
    try {

        const { gatePassId } = req.params;

        if (!gatePassId) {
            return res.status(400).json({
                success: false,
                message:
                    "Gate pass ID is required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                gp.id,
                gp.otp_verified,
                s.name AS student_name,
                s.parent_email

            FROM gate_pass gp

            INNER JOIN students s
                ON gp.student_id = s.id

            WHERE gp.id = ?

            LIMIT 1
            `,
            [gatePassId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Gate pass not found."
            });
        }

        const gatePass = rows[0];

        if (
            gatePass.otp_verified === "Yes"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "OTP has already been verified."
            });
        }

        if (!gatePass.parent_email) {
            return res.status(400).json({
                success: false,
                message:
                    "Parent email is not registered."
            });
        }

        // Generate new OTP
        const otp = generateOTP();

        const expiry = new Date(
            Date.now() + 10 * 60 * 1000
        );

        await db.query(
            `
            UPDATE gate_pass
            SET
                parent_otp = ?,
                otp_expiry = ?,
                otp_verified = 'No',
                otp_verified_at = NULL,
                otp_attempts = 0
            WHERE id = ?
            `,
            [
                otp,
                expiry,
                gatePassId
            ]
        );

        await sendParentOTP(
            gatePass.parent_email,
            gatePass.student_name,
            otp,
            gatePassId
        );

        return res.status(200).json({
            success: true,
            message:
                "A new OTP has been sent to the parent's email."
        });

    } catch (error) {

        console.error(
            "Resend Parent OTP Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to resend OTP.",
            error: error.message
        });
    }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    applyGatePass,
    getMyGatePasses,
    getGatePassById,
    verifyParentOTP,
    resendParentOTP,
    sendParentOTP,
    generateOTP
};