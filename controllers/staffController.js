const db = require("../config/database");

const getStaffProfile = async (req, res) => {
    try {
        const staffId = req.user?.id || req.staff?.id;

        if (!staffId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const [rows] = await db.query(
            `SELECT id, staff_id, name, email, mobile, role, status, photo, salary, created_at
             FROM staff
             WHERE id = ?
             LIMIT 1`,
            [staffId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Staff not found."
            });
        }

        return res.status(200).json({
            success: true,
            staff: rows[0]
        });
    } catch (error) {
        console.error("Get Staff Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch staff profile.",
            error: error.message
        });
    }
};

module.exports = {
    getStaffProfile
};
