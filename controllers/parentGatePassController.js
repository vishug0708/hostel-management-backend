const db = require("../config/database");
const crypto = require("crypto");
const {
    createGatePassToken,
    verifyGatePassToken
} = require("../utils/gatePassToken");

const getTokenFromRequest = (req) => {
    return String(
        req.query.token ||
        req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
        ""
    ).trim();
};

const getGatePassForParent = async (gatePassId) => {
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
            gp.return_time,
            gp.rector,
            gp.created_at,
            gp.verification_code,
            gp.parent_decision,
            gp.otp_verified,
            gp.qr_code,
            s.name AS student_name,
            s.parent_email,
            s.hostel,
            s.college,
            s.course,
            s.photo
        FROM gate_pass gp
        INNER JOIN students s
            ON gp.student_id = s.id
        WHERE gp.id = ?
        LIMIT 1
        `,
        [gatePassId]
    );

    return rows[0] || null;
};

const validateTokenForGatePass = async (req, gatePassId, requireVerified = false) => {
    const token = getTokenFromRequest(req);
    const payload = verifyGatePassToken(token);

    if (!payload || Number(payload.gatePassId) !== Number(gatePassId)) {
        return {
            valid: false,
            status: 401,
            message: "Invalid or expired gate pass link."
        };
    }

    const gatePass = await getGatePassForParent(gatePassId);

    if (!gatePass) {
        return {
            valid: false,
            status: 404,
            message: "Gate pass not found."
        };
    }

    if (String(payload.verificationCode) !== String(gatePass.verification_code)) {
        return {
            valid: false,
            status: 401,
            message: "Gate pass link is no longer valid."
        };
    }

    if (requireVerified && payload.verified !== true) {
        return {
            valid: false,
            status: 401,
            message: "Please verify the OTP first."
        };
    }

    return {
        valid: true,
        payload,
        gatePass
    };
};

const verifyParentOTP = async (req, res) => {
    try {
        const { gatePassId } = req.params;
        const { otp } = req.body;

        if (!gatePassId || !otp) {
            return res.status(400).json({
                success: false,
                message: "Gate pass ID and OTP are required."
            });
        }

        const tokenCheck = await validateTokenForGatePass(
            req,
            gatePassId,
            false
        );

        if (!tokenCheck.valid) {
            return res.status(tokenCheck.status).json({
                success: false,
                message: tokenCheck.message
            });
        }

        const gatePass = tokenCheck.gatePass;
        const cleanOTP = String(otp).trim();

        if (!/^\d{6}$/.test(cleanOTP)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 6-digit OTP."
            });
        }

        if (gatePass.parent_decision === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "This gate pass has already been rejected by the parent."
            });
        }

        if (gatePass.parent_decision === "Approved") {
            return res.status(200).json({
                success: true,
                alreadyApproved: true,
                message: "Parent approval is already completed.",
                accessToken: createGatePassToken({
                    gatePassId,
                    verificationCode: gatePass.verification_code,
                    verified: true,
                    expiresInSeconds: 30 * 60
                }),
                gatePass
            });
        }

        const [otpRows] = await db.query(
            `
            SELECT
                parent_otp,
                otp_expiry,
                otp_attempts
            FROM gate_pass
            WHERE id = ?
            LIMIT 1
            `,
            [gatePassId]
        );

        const otpRecord = otpRows[0];

        if (!otpRecord || !otpRecord.parent_otp) {
            return res.status(400).json({
                success: false,
                message: "OTP not found. Please request a new gate pass link."
            });
        }

        if (
            !otpRecord.otp_expiry ||
            new Date() > new Date(otpRecord.otp_expiry)
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please ask the student to submit the request again."
            });
        }

        if (Number(otpRecord.otp_attempts || 0) >= 5) {
            return res.status(429).json({
                success: false,
                message: "Maximum OTP attempts reached. Please ask the student to submit the request again."
            });
        }

        if (cleanOTP !== String(otpRecord.parent_otp)) {
            await db.query(
                `
                UPDATE gate_pass
                SET otp_attempts = COALESCE(otp_attempts, 0) + 1
                WHERE id = ?
                `,
                [gatePassId]
            );

            return res.status(400).json({
                success: false,
                message: "Incorrect OTP."
            });
        }

        const accessToken = createGatePassToken({
            gatePassId,
            verificationCode: gatePass.verification_code,
            verified: true,
            expiresInSeconds: 30 * 60
        });

        return res.status(200).json({
            success: true,
            message: "OTP verified. Please review the gate pass and approve or reject it.",
            accessToken,
            gatePass
        });
    } catch (error) {
        console.error("Parent OTP Verification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to verify parent OTP.",
            error: error.message
        });
    }
};

const getParentGatePass = async (req, res) => {
    try {
        const { gatePassId } = req.params;
        const tokenCheck = await validateTokenForGatePass(
            req,
            gatePassId,
            true
        );

        if (!tokenCheck.valid) {
            return res.status(tokenCheck.status).json({
                success: false,
                message: tokenCheck.message
            });
        }

        return res.status(200).json({
            success: true,
            gatePass: tokenCheck.gatePass
        });
    } catch (error) {
        console.error("Get Parent Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load gate pass.",
            error: error.message
        });
    }
};

const approveParentGatePass = async (req, res) => {
    try {
        const { gatePassId } = req.params;
        const tokenCheck = await validateTokenForGatePass(
            req,
            gatePassId,
            true
        );

        if (!tokenCheck.valid) {
            return res.status(tokenCheck.status).json({
                success: false,
                message: tokenCheck.message
            });
        }

        const gatePass = tokenCheck.gatePass;

        if (gatePass.parent_decision === "Approved") {
            return res.status(200).json({
                success: true,
                message: "Gate pass is already approved by the parent."
            });
        }

        if (gatePass.parent_decision === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "This gate pass has already been rejected by the parent."
            });
        }

        await db.query(
            `
            UPDATE gate_pass
            SET
                parent_decision = 'Approved',
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
            message: "Gate pass approved by parent. It is now waiting for rector approval."
        });
    } catch (error) {
        console.error("Parent Approve Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve gate pass.",
            error: error.message
        });
    }
};

const rejectParentGatePass = async (req, res) => {
    try {
        const { gatePassId } = req.params;
        const tokenCheck = await validateTokenForGatePass(
            req,
            gatePassId,
            true
        );

        if (!tokenCheck.valid) {
            return res.status(tokenCheck.status).json({
                success: false,
                message: tokenCheck.message
            });
        }

        const gatePass = tokenCheck.gatePass;

        if (gatePass.parent_decision === "Approved") {
            return res.status(400).json({
                success: false,
                message: "An approved gate pass cannot be rejected by the parent."
            });
        }

        if (gatePass.parent_decision === "Rejected") {
            return res.status(200).json({
                success: true,
                message: "Gate pass is already rejected by the parent."
            });
        }

        await db.query(
            `
            UPDATE gate_pass
            SET
                parent_decision = 'Rejected',
                parent_otp = NULL,
                otp_expiry = NULL,
                otp_attempts = 0
            WHERE id = ?
            `,
            [gatePassId]
        );

        return res.status(200).json({
            success: true,
            message: "Gate pass has been rejected by the parent."
        });
    } catch (error) {
        console.error("Parent Reject Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to reject gate pass.",
            error: error.message
        });
    }
};

module.exports = {
    verifyParentOTP,
    getParentGatePass,
    approveParentGatePass,
    rejectParentGatePass
};
