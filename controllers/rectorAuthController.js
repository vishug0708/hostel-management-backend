const db = require("../config/database");
const bcrypt = require("bcryptjs");

const rectorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const [rows] = await db.query(
            `SELECT id, rector_id, name, email, password, phone, status, photo, salary
             FROM rectors
             WHERE LOWER(email) = ?
             LIMIT 1`,
            [cleanEmail]
        );

        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const rector = rows[0];

        if (String(rector.status || "").toLowerCase() !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact the administrator."
            });
        }

        if (!rector.password) {
            return res.status(500).json({
                success: false,
                message: "Rector password is not configured."
            });
        }

        const passwordMatch = await bcrypt.compare(
            String(password),
            rector.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const rectorData = {
            id: rector.id,
            rector_id: rector.rector_id,
            name: rector.name,
            email: rector.email,
            phone: rector.phone,
            status: rector.status,
            photo: rector.photo,
            salary: rector.salary
        };

        // Keep compatibility with the existing Rector frontend/dashboard.
        return res.status(200).json({
            success: true,
            message: "Rector login successful.",
            token: `rector-${rector.id}`,
            rector: rectorData
        });
    } catch (error) {
        console.error("Rector Login Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during rector login.",
            error: error.message
        });
    }
};

module.exports = { rectorLogin };
