const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ===============================
// SECURITY LOGIN
// ===============================
const securityLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required."
            });
        }

        const [rows] = await db.query(
            `SELECT *
             FROM security
             WHERE email = ?
             AND status = 'Active'
             LIMIT 1`,
            [email.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const security = rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            security.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                id: security.id,
                email: security.email,
                role: "security"
            },
            process.env.JWT_SECRET || "hostel_management_secret",
            {
                expiresIn: "1d"
            }
        );

        const securityData = {
            id: security.id,
            name: security.name,
            email: security.email,
            mobile: security.mobile,
            hostel_name: security.hostel_name,
            shift: security.shift,
            status: security.status,
            photo: security.photo || null
        };

        return res.json({
            success: true,
            message: "Security login successful.",
            token,
            security: securityData
        });

    } catch (error) {
        console.error("Security Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during security login.",
            error: error.message
        });
    }
};

module.exports = {
    securityLogin
};