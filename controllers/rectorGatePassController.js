const db = require("../config/database");
const crypto = require("crypto");

// ======================================================
// GET ALL GATE PASS REQUESTS
// GET /api/rector/gatepass
// ======================================================
const getAllGatePasses = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                gp.id,
                gp.student_id,
                gp.purpose,
                gp.destination,
                gp.out_date,
                gp.return_date,
                gp.out_time,
                gp.return_time,
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
                gp.security_exit_time,
                gp.security_entry_time,
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
            ORDER BY gp.created_at DESC, gp.id DESC
        `);

        return res.status(200).json({
            success: true,
            gatePasses: rows
        });
    } catch (error) {
        console.error("Get Rector Gate Passes Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch gate pass requests.",
            error: error.message
        });
    }
};

// ======================================================
// GET PENDING GATE PASSES
// GET /api/rector/gatepass/pending
// ======================================================
const getPendingGatePasses = async (req, res) => {
    try {
        const [rows] = await db.query(`
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
                gp.otp_verified,
                gp.otp_verified_at,
                gp.qr_code,
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
            WHERE gp.rector = 'Pending'
            ORDER BY gp.created_at ASC, gp.id ASC
        `);

        return res.status(200).json({
            success: true,
            gatePasses: rows
        });
    } catch (error) {
        console.error("Get Pending Gate Passes Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch pending gate passes.",
            error: error.message
        });
    }
};

// ======================================================
// GET SINGLE GATE PASS
// GET /api/rector/gatepass/:id
// ======================================================
const getGatePassById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Gate pass ID is required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                gp.*,
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
            WHERE gp.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Gate pass not found."
            });
        }

        return res.status(200).json({
            success: true,
            gatePass: rows[0]
        });
    } catch (error) {
        console.error("Get Gate Pass By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch gate pass.",
            error: error.message
        });
    }
};

// ======================================================
// APPROVE GATE PASS
// PUT /api/rector/gatepass/:id/approve
// ======================================================
const approveGatePass = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Gate pass ID is required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                rector,
                otp_verified,
                qr_code,
                security_exit,
                security_entry
            FROM gate_pass
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Gate pass not found."
            });
        }

        const gatePass = rows[0];

        if (gatePass.otp_verified !== "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Parent OTP is not verified. Rector cannot approve this gate pass yet."
            });
        }

        if (gatePass.rector === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Gate pass is already approved."
            });
        }

        if (gatePass.rector === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "Rejected gate pass cannot be approved."
            });
        }

        // Generate the QR only after rector approval.
        // The existing verification_code remains the stable gate-pass identifier.
        const qrCode =
            gatePass.qr_code || crypto.randomBytes(32).toString("hex");

        await db.query(
            `
            UPDATE gate_pass
            SET
                rector = 'Approved',
                qr_code = ?
            WHERE id = ?
            `,
            [qrCode, id]
        );

        return res.status(200).json({
            success: true,
            message:
                "Gate pass approved successfully. QR code has been generated.",
            qr_code: qrCode
        });
    } catch (error) {
        console.error("Approve Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve gate pass.",
            error: error.message
        });
    }
};

// ======================================================
// REJECT GATE PASS
// PUT /api/rector/gatepass/:id/reject
// ======================================================
const rejectGatePass = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Gate pass ID is required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                rector
            FROM gate_pass
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Gate pass not found."
            });
        }

        if (rows[0].rector === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "Gate pass is already rejected."
            });
        }

        if (rows[0].rector === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Approved gate pass cannot be rejected."
            });
        }

        await db.query(
            `
            UPDATE gate_pass
            SET
                rector = 'Rejected',
                qr_code = NULL
            WHERE id = ?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Gate pass rejected successfully."
        });
    } catch (error) {
        console.error("Reject Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to reject gate pass.",
            error: error.message
        });
    }
};

module.exports = {
    getAllGatePasses,
    getPendingGatePasses,
    getGatePassById,
    approveGatePass,
    rejectGatePass
};
