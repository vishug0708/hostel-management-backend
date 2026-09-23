const db = require("../config/db");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const { createGatePassToken } = require("../utils/gatePassToken");

const generateOTP = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

// ======================================================
// SEND PARENT GATE PASS EMAIL
// ======================================================

const sendParentGatePassEmail = async (
    parentEmail,
    studentName,
    otp,
    gatePassId,
    verificationCode
) => {
    const frontendUrl = String(
        process.env.FRONTEND_URL ||
        "http://localhost:5173"
    ).replace(/\/$/, "");

    const reviewToken = createGatePassToken({
        gatePassId,
        verificationCode,
        verified: false,
        expiresInSeconds: 24 * 60 * 60
    });

    const reviewUrl = `${frontendUrl}/parent/gatepass/verify-otp/${gatePassId}?token=${encodeURIComponent(reviewToken)}`;

    const result = await sendEmail({
        to: parentEmail,
        subject: "Gate Pass Verification - Virtuous Hostel",
        text: `Dear Parent,\n\nYour ward ${studentName} has submitted a gate pass request.\n\nGate Pass ID: GP-${gatePassId}\nOTP: ${otp}\nOTP validity: 10 minutes\n\nReview Gate Pass: ${reviewUrl}\n\nPlease open the review link and enter the OTP to view the gate pass details and approve or reject the request.\n\nVirtuous Hostel\nHostel Management System`,
        html: `
        <div style="max-width:620px;margin:auto;font-family:Arial,Helvetica,sans-serif;background:#f4f8fa;padding:28px;">
            <div style="background:#ffffff;border:1px solid #dce7ec;border-radius:18px;padding:32px;">
                <h2 style="margin:0 0 8px;color:#117d75;">Virtuous Hostel</h2>
                <h3 style="margin:0 0 24px;color:#153654;">Gate Pass Verification</h3>
                <p style="color:#334e68;">Dear Parent,</p>
                <p style="color:#334e68;line-height:1.7;">
                    Your ward <strong>${studentName}</strong> has submitted a gate pass request.
                    Please review the request using the secure link below.
                </p>
                <p style="color:#334e68;"><strong>Gate Pass ID:</strong> GP-${gatePassId}</p>
                <div style="margin:24px 0;padding:20px;text-align:center;background:#f7fafc;border:1px solid #e1e8ed;border-radius:14px;">
                    <div style="font-size:12px;color:#718096;margin-bottom:8px;">ONE-TIME PASSWORD</div>
                    <div style="font-size:30px;font-weight:800;letter-spacing:7px;color:#117d75;">${otp}</div>
                    <div style="margin-top:8px;color:#718096;font-size:13px;">Valid for 10 minutes</div>
                </div>
                <div style="text-align:center;margin:28px 0;">
                    <a href="${reviewUrl}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#117d75;color:#ffffff;text-decoration:none;font-weight:700;">
                        Review Gate Pass
                    </a>
                </div>
                <p style="color:#718096;line-height:1.7;">
                    After opening the link, enter the OTP to view the gate pass details.
                    You can then approve or reject the request. The student does not need to verify this OTP.
                </p>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:26px 0;">
                <p style="margin:0;color:#8a9aab;font-size:12px;">Virtuous Hostel<br>Hostel Management System</p>
            </div>
        </div>
        `
    });

    if (!result.success) {
        throw new Error(
            result.message ||
            "Brevo could not send the parent gate pass email."
        );
    }

    return result;
};

const getGatePassVerificationCode = async (gatePassId) => {
    const [rows] = await db.query(
        `SELECT verification_code FROM gate_pass WHERE id = ? LIMIT 1`,
        [gatePassId]
    );

    if (!rows.length || !rows[0].verification_code) {
        throw new Error("Gate pass verification code could not be created.");
    }

    return rows[0].verification_code;
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
                parent_decision,
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
        const verificationCode = await getGatePassVerificationCode(
            gatePassId
        );

        // --------------------------------------------------
        // SEND PARENT GATE PASS EMAIL
        // --------------------------------------------------

        try {
            await sendParentGatePassEmail(
                student.parent_email,
                student.name,
                otp,
                gatePassId,
                verificationCode
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
                "Gate pass submitted successfully. A review link and OTP have been sent to your parent's email.",
            gate_pass_id: gatePassId,
            otp_required: true,
            parent_review_required: true
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
                gp.parent_decision,
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
                gp.parent_decision,
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
// EXPORTS
// ======================================================

module.exports = {
    applyGatePass,
    getMyGatePasses,
    getGatePassById,
    sendParentGatePassEmail
};