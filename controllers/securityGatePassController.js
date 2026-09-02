const db = require("../config/database");

// ==========================================
// SCAN / VERIFY QR GATE PASS
// ==========================================
const scanGatePass = async (req, res) => {
    try {
        const { verification_code, qr_code } = req.body;

        const qrValue = String(
            verification_code || qr_code || ""
        ).trim();

        if (!qrValue) {
            return res.status(400).json({
                success: false,
                message: "Verification code is required",
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
                gp.verification_code,
                gp.qr_code,
                gp.otp_verified,
                gp.security_exit,
                gp.security_entry,
                gp.created_at,
                s.name,
                s.email,
                s.mobile,
                s.parent_email,
                s.college,
                s.course,
                s.hostel,
                s.photo,
                r.room_no,
                r.block
            FROM gate_pass gp
            INNER JOIN students s
                ON gp.student_id = s.id
            LEFT JOIN room_allocation ra
                ON ra.student_id = s.id
                AND ra.status = 'Allocated'
            LEFT JOIN rooms r
                ON ra.room_id = r.id
            WHERE gp.verification_code = ?
               OR gp.qr_code = ?
            LIMIT 1
            `,
            [qrValue, qrValue]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Invalid Gate Pass QR Code",
            });
        }

        const gatePass = rows[0];

        // Parent OTP verification
        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message: "Parent OTP is not verified",
            });
        }

        // Rector approval
        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message:
                    "Gate Pass is not approved by Rector",
            });
        }

        // Gate pass valid until end of return date
        if (gatePass.return_date) {
            const returnDate = new Date(
                gatePass.return_date
            );

            returnDate.setHours(
                23,
                59,
                59,
                999
            );

            if (
                new Date() > returnDate &&
                gatePass.security_entry !== "Yes"
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Gate Pass has expired",
                    expired: true,
                    gatePass,
                });
            }
        }

        return res.status(200).json({
            success: true,
            message:
                "Gate Pass verified successfully",
            gatePass,
        });
    } catch (error) {
        console.error(
            "Scan Gate Pass Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error while scanning gate pass",
            error: error.message,
        });
    }
};


// ==========================================
// RECORD STUDENT EXIT
// ==========================================
const recordExit = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                id,
                rector,
                otp_verified,
                security_exit,
                security_entry,
                return_date,
                out_time
            FROM gate_pass
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Gate Pass not found",
            });
        }

        const gatePass = rows[0];

        // Parent OTP verification
        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message:
                    "Parent OTP is not verified",
            });
        }

        // Rector approval
        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message:
                    "Gate Pass is not approved by Rector",
            });
        }

        // Already exited
        if (gatePass.security_exit === "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Student has already exited",
            });
        }

        const now = new Date();

        // Record exit
        const [result] = await db.query(
            `
            UPDATE gate_pass
            SET
                security_exit = 'Yes',
                exit_datetime = ?
            WHERE id = ?
            `,
            [now, id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Unable to record student exit",
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Student exit recorded successfully",
            exit_time: now,
        });
    } catch (error) {
        console.error(
            "Record Exit Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error while recording exit",
            error: error.message,
        });
    }
};


// ==========================================
// RECORD STUDENT ENTRY
// ==========================================
const recordEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                id,
                rector,
                otp_verified,
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
                message: "Gate Pass not found",
            });
        }

        const gatePass = rows[0];

        // Parent OTP verification
        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message:
                    "Parent OTP is not verified",
            });
        }

        // Rector approval
        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message:
                    "Gate Pass is not approved by Rector",
            });
        }

        // Student must exit first
        if (gatePass.security_exit !== "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Student exit has not been recorded yet",
            });
        }

        // Already entered
        if (gatePass.security_entry === "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Student has already entered",
            });
        }

        const now = new Date();

        // Record entry
        const [result] = await db.query(
            `
            UPDATE gate_pass
            SET
                security_entry = 'Yes',
                entry_datetime = ?
            WHERE id = ?
            `,
            [now, id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Unable to record student entry",
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Student entry recorded successfully",
            entry_time: now,
        });
    } catch (error) {
        console.error(
            "Record Entry Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error while recording entry",
            error: error.message,
        });
    }
};


// ==========================================
// GET EXIT RECORDS
// ==========================================
const getExitRecords = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                gp.id,
                gp.student_id,
                gp.destination,
                gp.purpose,
                gp.out_date,
                gp.return_date,
                gp.exit_datetime,
                gp.entry_datetime,
                gp.security_exit,
                gp.security_entry,
                s.name,
                s.mobile,
                s.hostel,
                s.photo,
                r.room_no,
                r.block
            FROM gate_pass gp
            INNER JOIN students s
                ON gp.student_id = s.id
            LEFT JOIN room_allocation ra
                ON ra.student_id = s.id
                AND ra.status = 'Allocated'
            LEFT JOIN rooms r
                ON ra.room_id = r.id
            WHERE gp.security_exit = 'Yes'
            ORDER BY gp.exit_datetime DESC
        `);

        return res.status(200).json({
            success: true,
            records: rows,
        });
    } catch (error) {
        console.error(
            "Get Exit Records Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};


// ==========================================
// GET ENTRY RECORDS
// ==========================================
const getEntryRecords = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                gp.id,
                gp.student_id,
                gp.destination,
                gp.purpose,
                gp.out_date,
                gp.return_date,
                gp.exit_datetime,
                gp.entry_datetime,
                gp.security_exit,
                gp.security_entry,
                s.name,
                s.mobile,
                s.hostel,
                s.photo,
                r.room_no,
                r.block
            FROM gate_pass gp
            INNER JOIN students s
                ON gp.student_id = s.id
            LEFT JOIN room_allocation ra
                ON ra.student_id = s.id
                AND ra.status = 'Allocated'
            LEFT JOIN rooms r
                ON ra.room_id = r.id
            WHERE gp.security_entry = 'Yes'
            ORDER BY gp.entry_datetime DESC
        `);

        return res.status(200).json({
            success: true,
            records: rows,
        });
    } catch (error) {
        console.error(
            "Get Entry Records Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};


// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    scanGatePass,
    recordExit,
    recordEntry,
    getExitRecords,
    getEntryRecords,
};