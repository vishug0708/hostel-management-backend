const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;

const staffLogin = async (req, res) => {
    try {
        const { staff_id, password } = req.body;
        if (!staff_id || !password) return res.status(400).json({ success: false, message: "Staff ID and password are required." });
        const [rows] = await db.query(`SELECT id, staff_id, name, email, mobile, password, role, status, photo, salary, created_at FROM staff WHERE staff_id = ? LIMIT 1`, [String(staff_id).trim()]);
        if (!rows.length) return res.status(401).json({ success: false, message: "Invalid Staff ID or password." });
        const staff = rows[0];
        if (String(staff.status || "active").toLowerCase() !== "active") return res.status(403).json({ success: false, message: "Your staff account is inactive. Please contact the administrator." });
        const ok = await bcrypt.compare(String(password), staff.password);
        if (!ok) return res.status(401).json({ success: false, message: "Invalid Staff ID or password." });
        if (!JWT_SECRET) return res.status(500).json({ success: false, message: "JWT_SECRET is not configured." });
        const token = jwt.sign({ id: staff.id, staff_id: staff.staff_id, role: staff.role, userType: "staff" }, JWT_SECRET, { expiresIn: "7d" });
        delete staff.password;
        return res.json({ success: true, message: "Staff login successful.", token, staff });
    } catch (error) {
        console.error("Staff Login Error:", error);
        return res.status(500).json({ success: false, message: "Unable to login.", error: error.message });
    }
};
module.exports = { staffLogin };