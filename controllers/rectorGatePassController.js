const db = require("../config/database");

// ======================================================
// GET ALL GATE PASS REQUESTS FOR RECTOR
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
                gp.exit_datetime,
                gp.entry_datetime,
                gp.rector,
                gp.created_at,
                gp.verification_code,
                gp.qr_code,
                gp.otp_verified,
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
                gp.rector,
                gp.created_at,
                gp.otp_verified,

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

        // Check gate pass
        const [rows] = await db.query(
            `
            SELECT
                id,
                rector,
                otp_verified
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

        // Parent OTP must be verified first
        if (gatePass.otp_verified !== "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Parent OTP is not verified. Rector cannot approve this gate pass yet."
            });
        }

        // Already approved
        if (gatePass.rector === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Gate pass is already approved."
            });
        }

        // Already rejected
        if (gatePass.rector === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "Rejected gate pass cannot be approved."
            });
        }

        // Approve
        await db.query(
            `
            UPDATE gate_pass
            SET rector = 'Approved'
            WHERE id = ?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Gate pass approved successfully."
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
                message:
                    "Approved gate pass cannot be rejected."
            });
        }

        await db.query(
            `
            UPDATE gate_pass
            SET rector = 'Rejected'
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


// ======================================================
// EXPORT
// ======================================================
module.exports = {
    getAllGatePasses,
    getPendingGatePasses,
    getGatePassById,
    approveGatePass,
    rejectGatePass
};