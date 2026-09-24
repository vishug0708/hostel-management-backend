const db = require("../config/database");

// ======================================================
// INDIA DATE/TIME HELPERS
// ======================================================

const getIndiaNowParts = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).formatToParts(new Date());

    const values = {};

    parts.forEach((part) => {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    });

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}:${values.second}`
    };
};

const getGatePassDateTime = (dateValue, timeValue = "00:00:00") => {
    if (!dateValue) {
        return null;
    }

    const date = String(dateValue).slice(0, 10);
    const time = String(timeValue || "00:00:00").slice(0, 8);

    return `${date} ${time}`;
};

const getReturnEndDateTime = (returnDate) => {
    if (!returnDate) {
        return null;
    }

    return `${String(returnDate).slice(0, 10)} 23:59:59`;
};

// ======================================================
// LOAD COMPLETE GATE PASS
// ======================================================

const getGatePassForScan = async (qrValue) => {
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

        ORDER BY gp.id DESC
        LIMIT 1
        `,
        [qrValue, qrValue]
    );

    return rows.length > 0 ? rows[0] : null;
};

// ======================================================
// BUILD FRONTEND-FRIENDLY GATE PASS RESPONSE
// ======================================================

const buildGatePassResponse = (gatePass, action = null) => {
    return {
        id: gatePass.id,
        student_id: gatePass.student_id,
        student_name: gatePass.name,
        email: gatePass.email,
        mobile: gatePass.mobile,
        parent_email: gatePass.parent_email,
        college: gatePass.college,
        course: gatePass.course,
        hostel: gatePass.hostel,
        photo: gatePass.photo,
        room_no: gatePass.room_no,
        block: gatePass.block,

        purpose: gatePass.purpose,
        destination: gatePass.destination,

        out_date: gatePass.out_date,
        return_date: gatePass.return_date,
        out_time: gatePass.out_time,
        return_time: gatePass.return_time,

        exit_datetime: gatePass.exit_datetime,
        entry_datetime: gatePass.entry_datetime,

        rector: gatePass.rector,
        otp_verified: gatePass.otp_verified,

        security_exit: gatePass.security_exit,
        security_entry: gatePass.security_entry,

        verification_code: gatePass.verification_code,
        qr_code: gatePass.qr_code,

        action
    };
};

// ======================================================
// SCAN / VERIFY QR GATE PASS
// ======================================================

const scanGatePass = async (req, res) => {
    try {
        const { verification_code, qr_code } = req.body;

        const qrValue = String(
            verification_code || qr_code || ""
        ).trim();

        if (!qrValue) {
            return res.status(400).json({
                success: false,
                message: "Verification code is required"
            });
        }

        const gatePass = await getGatePassForScan(qrValue);

        if (!gatePass) {
            return res.status(404).json({
                success: false,
                message: "Invalid Gate Pass QR Code"
            });
        }

        // --------------------------------------------------
        // PARENT OTP
        // --------------------------------------------------

        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message: "Parent OTP is not verified",
                gatePass: buildGatePassResponse(gatePass)
            });
        }

        // --------------------------------------------------
        // RECTOR APPROVAL
        // --------------------------------------------------

        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message: "Gate Pass is not approved by Rector",
                gatePass: buildGatePassResponse(gatePass)
            });
        }

        const indiaNow = getIndiaNowParts();
        const currentDateTime = `${indiaNow.date} ${indiaNow.time}`;

        // --------------------------------------------------
        // GATE PASS EXPIRY
        // Gate pass remains valid until the end of return date.
        // --------------------------------------------------

        const returnEndDateTime = getReturnEndDateTime(
            gatePass.return_date
        );

        if (
            returnEndDateTime &&
            currentDateTime > returnEndDateTime &&
            gatePass.security_entry !== "Yes"
        ) {
            return res.status(403).json({
                success: false,
                expired: true,
                action: "DENIED",
                message: "Gate Pass has expired",
                gatePass: buildGatePassResponse(
                    gatePass,
                    "DENIED"
                )
            });
        }

        // --------------------------------------------------
        // COMPLETED GATE PASS
        // No more ENTRY / EXIT after both are completed.
        // --------------------------------------------------

        if (
            gatePass.security_exit === "Yes" &&
            gatePass.security_entry === "Yes"
        ) {
            return res.status(409).json({
                success: false,
                completed: true,
                action: "DENIED",
                message:
                    "Gate Pass is already completed. No further entry or exit is allowed.",
                gatePass: buildGatePassResponse(
                    gatePass,
                    "DENIED"
                )
            });
        }

        // --------------------------------------------------
        // EXIT ACTION
        // Student has not left the hostel yet.
        // --------------------------------------------------

        if (gatePass.security_exit !== "Yes") {
            return res.status(200).json({
                success: true,
                action: "EXIT",
                message:
                    "Gate Pass verified. Student is allowed to exit.",
                gatePass: buildGatePassResponse(
                    gatePass,
                    "EXIT"
                )
            });
        }

        // --------------------------------------------------
        // ENTRY ACTION
        // Student has already exited and has not returned.
        // --------------------------------------------------

        if (
            gatePass.security_exit === "Yes" &&
            gatePass.security_entry !== "Yes"
        ) {
            return res.status(200).json({
                success: true,
                action: "ENTRY",
                message:
                    "Gate Pass verified. Student is allowed to enter.",
                gatePass: buildGatePassResponse(
                    gatePass,
                    "ENTRY"
                )
            });
        }

        return res.status(400).json({
            success: false,
            action: "DENIED",
            message: "Gate Pass cannot be processed.",
            gatePass: buildGatePassResponse(
                gatePass,
                "DENIED"
            )
        });

    } catch (error) {
        console.error("Scan Gate Pass Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while scanning gate pass",
            error: error.message
        });
    }
};

// ======================================================
// RECORD STUDENT EXIT
// ======================================================

const recordExit = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                id,
                out_date,
                out_time,
                return_date,
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
                message: "Gate Pass not found"
            });
        }

        const gatePass = rows[0];

        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message: "Parent OTP is not verified"
            });
        }

        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message: "Gate Pass is not approved by Rector"
            });
        }

        if (gatePass.security_exit === "Yes") {
            return res.status(400).json({
                success: false,
                message: "Student has already exited"
            });
        }

        if (gatePass.security_entry === "Yes") {
            return res.status(400).json({
                success: false,
                message: "Gate Pass is already completed"
            });
        }

        const indiaNow = getIndiaNowParts();
        const currentDateTime = `${indiaNow.date} ${indiaNow.time}`;

        const now = currentDateTime;

        const [result] = await db.query(
            `
            UPDATE gate_pass
            SET
                security_exit = 'Yes',
                exit_datetime = ?
            WHERE id = ?
              AND security_exit = 'No'
              AND security_entry = 'No'
            `,
            [now, id]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Exit was already recorded or gate pass was completed."
            });
        }

        return res.status(200).json({
            success: true,
            action: "EXIT",
            message: "Student exit recorded successfully",
            exit_time: now
        });

    } catch (error) {
        console.error("Record Exit Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while recording student exit",
            error: error.message
        });
    }
};

// ======================================================
// RECORD STUDENT ENTRY
// ======================================================

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
                message: "Gate Pass not found"
            });
        }

        const gatePass = rows[0];

        if (gatePass.otp_verified !== "Yes") {
            return res.status(403).json({
                success: false,
                message: "Parent OTP is not verified"
            });
        }

        if (gatePass.rector !== "Approved") {
            return res.status(403).json({
                success: false,
                message: "Gate Pass is not approved by Rector"
            });
        }

        if (gatePass.security_exit !== "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Student exit has not been recorded yet"
            });
        }

        if (gatePass.security_entry === "Yes") {
            return res.status(400).json({
                success: false,
                message:
                    "Student has already entered. Gate Pass is completed."
            });
        }

        const indiaNow = getIndiaNowParts();
        const now = `${indiaNow.date} ${indiaNow.time}`;

        const [result] = await db.query(
            `
            UPDATE gate_pass
            SET
                security_entry = 'Yes',
                entry_datetime = ?
            WHERE id = ?
              AND security_exit = 'Yes'
              AND security_entry = 'No'
            `,
            [now, id]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Entry was already recorded or gate pass state changed."
            });
        }

        return res.status(200).json({
            success: true,
            action: "ENTRY",
            message: "Student entry recorded successfully",
            entry_time: now
        });

    } catch (error) {
        console.error("Record Entry Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while recording student entry",
            error: error.message
        });
    }
};

// ======================================================
// GET EXIT RECORDS
// ======================================================

const getExitRecords = async (req, res) => {
    try {
        const [rows] = await db.query(
            `
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
            `
        );

        return res.status(200).json({
            success: true,
            records: rows
        });

    } catch (error) {
        console.error("Get Exit Records Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// ======================================================
// GET ENTRY RECORDS
// ======================================================

const getEntryRecords = async (req, res) => {
    try {
        const [rows] = await db.query(
            `
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
            `
        );

        return res.status(200).json({
            success: true,
            records: rows
        });

    } catch (error) {
        console.error("Get Entry Records Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    scanGatePass,
    recordExit,
    recordEntry,
    getExitRecords,
    getEntryRecords
};
