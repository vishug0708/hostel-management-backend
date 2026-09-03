const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const cleanEmail = email.trim().toLowerCase();
        const sql = `
            SELECT id, name, email, password, phone, photo
            FROM admins
            WHERE LOWER(email) = ?
            LIMIT 1
        `;
        const [results] = await db.query(sql, [cleanEmail]);

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const admin = results[0];
        if (!admin.password) {
            return res.status(500).json({ success: false, message: "Admin password is not configured" });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (!process.env.JWT_SECRET) {
            console.error("❌ JWT_SECRET is missing in .env");
            return res.status(500).json({ success: false, message: "JWT secret is not configured" });
        }

        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: "admin" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                photo: admin.photo
            }
        });
    } catch (error) {
        console.error("❌ Admin Login Error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = { adminLogin };
