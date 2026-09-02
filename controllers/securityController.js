const db = require("../config/database");

// ===============================
// GET SECURITY PROFILE
// ===============================
const getSecurityProfile = async (req, res) => {
    try {
        const securityId = req.params.id;

        const [rows] = await db.query(
            `SELECT
                id,
                name,
                email,
                mobile,
                hostel
             FROM security
             WHERE id = ?
             LIMIT 1`,
            [securityId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Security user not found."
            });
        }

        res.json({
            success: true,
            security: rows[0]
        });

    } catch (error) {
        console.error(
            "Get Security Profile Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch security profile.",
            error: error.message
        });
    }
};


// ===============================
// SECURITY DASHBOARD
// ===============================
const getSecurityDashboard = async (req, res) => {
    try {
        const securityId = req.params.id;

        // Check security user
        const [securityRows] = await db.query(
            `SELECT
        id,
        name,
        email,
        mobile,
        hostel_name,
        shift,
        status,
        photo
     FROM security
     WHERE id = ?
     LIMIT 1`,
            [securityId]
        );

        if (securityRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Security user not found."
            });
        }

        // Total gate passes
        const [totalRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM gate_pass`
        );

        // Active / approved gate passes
        const [activeRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM gate_pass
             WHERE rector = 'Approved'
             AND security_exit = 'No'`
        );

        // Students currently outside
        const [outsideRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM gate_pass
             WHERE security_exit = 'Yes'
             AND security_entry = 'No'`
        );

        // Completed gate passes
        const [completedRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM gate_pass
             WHERE security_exit = 'Yes'
             AND security_entry = 'Yes'`
        );

        res.json({
            success: true,

            security: securityRows[0],

            stats: {
                totalGatePasses: totalRows[0].total,
                activeGatePasses: activeRows[0].total,
                studentsOutside: outsideRows[0].total,
                completedGatePasses: completedRows[0].total
            }
        });

    } catch (error) {
        console.error(
            "Security Dashboard Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch security dashboard.",
            error: error.message
        });
    }
};


// ===============================
// GET SECURITY GATE PASS SUMMARY
// ===============================
const getSecurityGatePassSummary = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                gp.id,
                gp.student_id,
                gp.destination,
                gp.purpose,
                gp.out_date,
                gp.return_date,
                gp.out_time,
                gp.exit_datetime,
                gp.entry_datetime,
                gp.rector,
                gp.verification_code,
                gp.security_exit,
                gp.security_entry,
                s.name AS student_name,
                s.mobile AS student_mobile,
                s.email AS student_email,
                s.photo AS student_photo,
                s.hostel,
                s.college,
                s.course
             FROM gate_pass gp
             INNER JOIN students s
                ON gp.student_id = s.id
             ORDER BY gp.created_at DESC
             LIMIT 50`
        );

        res.json({
            success: true,
            gatePasses: rows
        });

    } catch (error) {
        console.error(
            "Security Gate Pass Summary Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch gate pass records.",
            error: error.message
        });
    }
};


module.exports = {
    getSecurityProfile,
    getSecurityDashboard,
    getSecurityGatePassSummary
};