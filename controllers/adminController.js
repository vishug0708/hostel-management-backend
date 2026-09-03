const bcrypt = require("bcryptjs");
const db = require("../config/database");

// =====================================================
// GET ADMIN PROFILE
// =====================================================
const getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        const sql = `
            SELECT id, name, email, phone, photo
            FROM admins
            WHERE id = ?
            LIMIT 1
        `;
        const [results] = await db.query(sql, [adminId]);
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        return res.status(200).json({ success: true, admin: results[0] });
    } catch (error) {
        console.error("Admin Profile Database Error:", error);
        return res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
};

// =====================================================
// UPDATE ADMIN PROFILE
// =====================================================
const updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, message: "Name, email and phone are required" });
        }

        const values = [name.trim(), email.trim(), phone.trim()];
        let sql = `UPDATE admins SET name = ?, email = ?, phone = ?`;

        if (req.file) {
            sql += `, photo = ?`;
            values.push(`/uploads/admins/${req.file.filename}`);
        }

        sql += ` WHERE id = ?`;
        values.push(adminId);

        const [result] = await db.query(sql, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        const [rows] = await db.query(
            `SELECT id, name, email, phone, photo FROM admins WHERE id = ? LIMIT 1`,
            [adminId]
        );

        return res.status(200).json({
            success: true,
            message: "Admin profile updated successfully",
            admin: rows[0]
        });
    } catch (error) {
        console.error("Admin Profile Update Error:", error);
        return res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
};

// =====================================================
// CHANGE ADMIN PASSWORD
// =====================================================
const changeAdminPassword = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All password fields are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New password and confirm password do not match" });
        }

        const [results] = await db.query(
            `SELECT id, password FROM admins WHERE id = ? LIMIT 1`,
            [adminId]
        );
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, results[0].password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [updateResult] = await db.query(
            `UPDATE admins SET password = ? WHERE id = ?`,
            [hashedPassword, adminId]
        );
        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("Change Admin Password Error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = { getAdminProfile, updateAdminProfile, changeAdminPassword };
